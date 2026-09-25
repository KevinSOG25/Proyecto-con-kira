import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GenerateContentParameters,
  GenerateContentResponse,
  GoogleGenAI,
  Part,
  Schema,
} from '@google/genai';

/** Códigos HTTP que justifican reintento con backoff. */
const RETRYABLE_STATUS = new Set([429, 503]);
/** Número máximo de reintentos (además del intento inicial). */
const MAX_RETRIES = 3;
/** Retardo base en ms; crece exponencialmente: 2s, 4s, 8s. */
const BASE_DELAY_MS = 2000;

/**
 * Envoltura del SDK oficial de Google GenAI (@google/genai) usando el
 * modelo Gemini 3.8 Flash (stable vigente de la familia 3). Incluye
 * Exponential Backoff ante errores transitorios 503/429. Centraliza:
 *  - generación de texto libre,
 *  - generación con salida JSON forzada (responseMimeType + responseSchema),
 *  - entrada multimodal (PDF inline en base64).
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY no está configurada; las llamadas a Gemini fallarán.',
      );
    }
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' });

    // El modelo por defecto es 'gemini-3.8-flash' (stable vigente de la familia 3).
    // El SDK @google/genai ya añade el prefijo "models/" internamente; por eso
    // NUNCA debe incluirse en el string. Si por configuración llega con el
    // prefijo, lo removemos para evitar el 404 "models/models/... not found".
    const configured = this.config.get<string>(
      'GEMINI_MODEL',
      'gemini-3.8-flash',
    );
    this.model = configured.replace(/^models\//i, '').trim();
    this.logger.log(`Modelo Gemini configurado: ${this.model}`);
  }

  /**
   * Genera contenido y devuelve un objeto JSON tipado. Fuerza a Gemini a
   * responder JSON válido mediante responseMimeType + responseSchema.
   *
   * @param systemInstruction  Prompt de sistema estricto.
   * @param parts              Partes del contenido (texto y/o PDF inline).
   * @param schema             Esquema de la respuesta esperada.
   */
  async generateJson<T>(
    systemInstruction: string,
    parts: Part[],
    schema: Schema,
  ): Promise<T> {
    try {
      const response = await this.generateWithRetry({
        model: this.model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini devolvió una respuesta vacía.');
      }
      return this.parseJson<T>(text);
    } catch (err: unknown) {
      throw this.toHttpException(err, 'JSON');
    }
  }

  /** Genera texto libre (para resúmenes ejecutivos, etc.). */
  async generateText(
    systemInstruction: string,
    parts: Part[],
  ): Promise<string> {
    try {
      const response = await this.generateWithRetry({
        model: this.model,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction, temperature: 0.3 },
      });
      return response.text ?? '';
    } catch (err: unknown) {
      throw this.toHttpException(err, 'texto');
    }
  }

  /**
   * Llama a generateContent aplicando Exponential Backoff:
   * ante un 503 (UNAVAILABLE) o 429 (RESOURCE_EXHAUSTED), espera
   * 2s, 4s, 8s y reintenta hasta MAX_RETRIES veces. Cualquier otro
   * error se propaga de inmediato (no se reintenta).
   */
  private async generateWithRetry(
    params: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.client.models.generateContent(params);
      } catch (err: unknown) {
        lastError = err;
        const status = this.extractStatus(err);

        // No reintentar si el error no es transitorio o si ya agotamos intentos.
        if (!RETRYABLE_STATUS.has(status) || attempt === MAX_RETRIES) {
          throw err;
        }

        const delay = BASE_DELAY_MS * 2 ** attempt; // 2000, 4000, 8000
        this.logger.warn(
          `Gemini respondió ${status}. Reintento ${attempt + 1}/${MAX_RETRIES} en ${delay} ms…`,
        );
        await this.sleep(delay);
      }
    }

    // Inalcanzable en teoría, pero satisface el tipado.
    throw lastError;
  }

  /** Extrae el código HTTP de los distintos formatos de error del SDK. */
  private extractStatus(err: unknown): number {
    const e = err as {
      status?: number;
      code?: number;
      response?: { status?: number };
      message?: string;
    };
    if (typeof e?.status === 'number') return e.status;
    if (typeof e?.code === 'number') return e.code;
    if (typeof e?.response?.status === 'number') return e.response.status;
    // Fallback: buscar el código en el mensaje (p. ej. "[503] ...").
    const match = e?.message?.match(/\b(429|503)\b/);
    return match ? Number(match[1]) : 0;
  }

  /**
   * Convierte el error en una excepción HTTP adecuada para el frontend.
   * 503/429 tras agotar reintentos -> 503 (servicio no disponible).
   */
  private toHttpException(err: unknown, tipo: string): Error {
    const status = this.extractStatus(err);
    const message = (err as { message?: string })?.message ?? 'error desconocido';
    this.logger.error(`Error al generar ${tipo} con Gemini: ${message}`);

    if (RETRYABLE_STATUS.has(status)) {
      return new ServiceUnavailableException(
        'El servicio de IA (Gemini) está temporalmente saturado. ' +
          'Se reintentó automáticamente sin éxito; inténtalo de nuevo en unos momentos.',
      );
    }
    return new InternalServerErrorException(
      `Fallo en el procesamiento con Gemini: ${message}`,
    );
  }

  /** Promesa de espera. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Construye una Part de texto. */
  textPart(text: string): Part {
    return { text };
  }

  /** Construye una Part multimodal a partir de un buffer (PDF, imagen, etc.). */
  filePart(buffer: Buffer, mimeType = 'application/pdf'): Part {
    return {
      inlineData: {
        mimeType,
        data: buffer.toString('base64'),
      },
    };
  }

  /**
   * Parseo robusto: Gemini a veces envuelve el JSON en ```json ... ```.
   * Limpia esos fences antes de parsear.
   */
  private parseJson<T>(raw: string): T {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
    }
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Último recurso: extraer el primer bloque {...} o [...].
      const match = cleaned.match(/[[{][\s\S]*[\]}]/);
      if (match) {
        return JSON.parse(match[0]) as T;
      }
      throw new Error('No se pudo parsear la respuesta JSON de Gemini.');
    }
  }
}
