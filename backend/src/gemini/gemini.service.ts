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
/** Número máximo de reintentos (además del intento inicial) para el modelo principal. */
const MAX_RETRIES = 3;
/** Reintentos (además del intento inicial) para el modelo de respaldo. */
const FALLBACK_MAX_RETRIES = 1;
/** Retardo base en ms; crece exponencialmente: 2s, 4s, 8s. */
const BASE_DELAY_MS = 2000;

/**
 * Envoltura del SDK oficial de Google GenAI (@google/genai) usando el
 * modelo Gemini 3.8 Flash (stable vigente de la familia 3). Incluye:
 *  - Exponential Backoff ante errores transitorios 503/429.
 *  - Fallback Model: si el modelo principal agota reintentos por saturación,
 *    reintenta la petición con un modelo de respaldo antes de fallar.
 * Centraliza:
 *  - generación de texto libre,
 *  - generación con salida JSON forzada (responseMimeType + responseSchema),
 *  - entrada multimodal (PDF inline en base64).
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly fallbackModel: string;

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
    this.model = this.sanitizeModel(
      this.config.get<string>('GEMINI_MODEL', 'gemini-3.8-flash'),
    );

    // Modelo de respaldo, usado si el principal se satura (503/429) tras
    // agotar sus reintentos. Por defecto 'gemini-3.5-flash'.
    this.fallbackModel = this.sanitizeModel(
      this.config.get<string>('FALLBACK_GEMINI_MODEL', 'gemini-3.5-flash'),
    );

    this.logger.log(
      `Modelo Gemini principal: ${this.model} · respaldo: ${this.fallbackModel}`,
    );
  }

  /** Quita el prefijo "models/" (el SDK lo añade) y espacios sobrantes. */
  private sanitizeModel(value: string): string {
    return value.replace(/^models\//i, '').trim();
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
      const response = await this.generateWithFallback({
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
      const response = await this.generateWithFallback({
        contents: [{ role: 'user', parts }],
        config: { systemInstruction, temperature: 0.3 },
      });
      return response.text ?? '';
    } catch (err: unknown) {
      throw this.toHttpException(err, 'texto');
    }
  }

  /**
   * Orquesta el patrón Fallback Model:
   *  1. Ejecuta con el modelo PRINCIPAL aplicando Exponential Backoff.
   *  2. Si se agotan los reintentos por un error transitorio (503/429),
   *     reintenta con el modelo de RESPALDO (con un backoff simple).
   *  3. Solo si el respaldo también falla, se propaga el error (que
   *     luego se traduce a ServiceUnavailableException para el frontend).
   *
   * Errores NO transitorios del modelo principal se propagan de inmediato
   * (no tiene sentido cambiar de modelo ante, p. ej., un 400 o 404).
   */
  private async generateWithFallback(
    baseParams: Omit<GenerateContentParameters, 'model'>,
  ): Promise<GenerateContentResponse> {
    try {
      return await this.attemptWithRetry(
        { ...baseParams, model: this.model },
        this.model,
        MAX_RETRIES,
      );
    } catch (primaryErr: unknown) {
      const status = this.extractStatus(primaryErr);

      // Si el fallo no es por saturación, o no hay un respaldo distinto
      // configurado, no intentamos el plan B.
      const canFallback =
        RETRYABLE_STATUS.has(status) &&
        !!this.fallbackModel &&
        this.fallbackModel !== this.model;

      if (!canFallback) {
        throw primaryErr;
      }

      this.logger.warn(
        `El modelo principal (${this.model}) agotó reintentos con ${status}. ` +
          `Ejecutando plan B con el modelo de respaldo (${this.fallbackModel})…`,
      );

      try {
        const response = await this.attemptWithRetry(
          { ...baseParams, model: this.fallbackModel },
          this.fallbackModel,
          FALLBACK_MAX_RETRIES,
        );
        this.logger.log(
          `El modelo de respaldo (${this.fallbackModel}) respondió correctamente.`,
        );
        return response;
      } catch (fallbackErr: unknown) {
        this.logger.error(
          `El modelo de respaldo (${this.fallbackModel}) también falló ` +
            `(${this.extractStatus(fallbackErr)}). Se propaga el error.`,
        );
        throw fallbackErr;
      }
    }
  }

  /**
   * Llama a generateContent con un modelo concreto aplicando Exponential
   * Backoff: ante un 503/429 espera 2s, 4s, 8s… y reintecta hasta
   * `maxRetries` veces. Cualquier otro error se propaga de inmediato.
   */
  private async attemptWithRetry(
    params: GenerateContentParameters,
    model: string,
    maxRetries: number,
  ): Promise<GenerateContentResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.models.generateContent(params);
      } catch (err: unknown) {
        lastError = err;
        const status = this.extractStatus(err);

        // No reintentar si el error no es transitorio o si ya agotamos intentos.
        if (!RETRYABLE_STATUS.has(status) || attempt === maxRetries) {
          throw err;
        }

        const delay = BASE_DELAY_MS * 2 ** attempt; // 2000, 4000, 8000
        this.logger.warn(
          `Modelo ${model} respondió ${status}. Reintento ${attempt + 1}/${maxRetries} en ${delay} ms…`,
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
