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

/** Timeout estricto para el modelo principal en el modo "fast" (ms). */
const FAST_PRIMARY_TIMEOUT_MS = 20_000;
/** Timeout corto para el respaldo Gemini en el modo "fast" (ms). */
const FAST_FALLBACK_TIMEOUT_MS = 8_000;
/** Timeout para la llamada a Groq (ms). */
const GROQ_TIMEOUT_MS = 10_000;
/** Endpoint OpenAI-compatible de Groq. */
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Modelo de Groq por defecto (muy rápido). */
const GROQ_MODEL_DEFAULT = 'llama-3.3-70b-versatile';

/** Error interno para señalar que se agotó el timeout. */
class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timeout de ${ms} ms alcanzado.`);
    this.name = 'TimeoutError';
  }
}

/** Resultado de una generación con indicación del proveedor que respondió. */
export interface ProviderResult<T> {
  data: T;
  provider: 'Gemini' | 'Groq' | 'Respaldo';
}

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
  /** Modelo Gemini de respaldo rápido para el modo "fast" (sin reintentos). */
  private readonly fastFallbackModel: string;
  private readonly groqApiKey: string | undefined;
  private readonly groqModel: string;

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

    // Respaldo rápido para el modo "fast" (timeout corto, sin reintentos).
    this.fastFallbackModel = this.sanitizeModel(
      this.config.get<string>('FAST_FALLBACK_GEMINI_MODEL', 'gemini-3.7-flash'),
    );

    // Proveedor secundario Groq (opcional).
    this.groqApiKey = this.config.get<string>('GROQ_API_KEY') || undefined;
    this.groqModel = this.config.get<string>('GROQ_MODEL', GROQ_MODEL_DEFAULT);

    this.logger.log(
      `Modelo Gemini principal: ${this.model} · respaldo: ${this.fallbackModel}` +
        (this.groqApiKey ? ' · Groq disponible' : ''),
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
   * Generación JSON de BAJA LATENCIA pensada para endpoints interactivos
   * (p. ej. proyección de semestre) donde Cloud Run puede cortar con 504.
   *
   * Estrategia (sin backoff exponencial):
   *  1. Modelo principal (gemini-3.8-flash) envuelto en Promise.race con
   *     timeout ESTRICTO de 20s. Si vence el timeout o la API responde
   *     503/429, se aborta de inmediato (no se reintenta).
   *  2. Conmutación inmediata al respaldo:
   *     - Si hay GROQ_API_KEY -> Groq (llama-3.3-70b-versatile), JSON, ~1s.
   *     - Si no -> Gemini secundario (gemini-3.7-flash) con timeout corto 8s,
   *       sin reintentos.
   *  3. Devuelve { data, provider } indicando quién resolvió.
   */
  async generateJsonFast<T>(
    systemInstruction: string,
    userPrompt: string,
    schema: Schema,
  ): Promise<ProviderResult<T>> {
    // --- 1) Modelo principal con timeout estricto ---
    try {
      const response = await this.withTimeout(
        this.client.models.generateContent({
          model: this.model,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1,
          },
        }),
        FAST_PRIMARY_TIMEOUT_MS,
      );
      const text = response.text;
      if (!text) throw new Error('Respuesta vacía del modelo principal.');
      return { data: this.parseJson<T>(text), provider: 'Gemini' };
    } catch (primaryErr: unknown) {
      const esTimeout = primaryErr instanceof TimeoutError;
      const status = this.extractStatus(primaryErr);
      this.logger.warn(
        `Modelo principal (${this.model}) no resolvió a tiempo ` +
          `(${esTimeout ? 'timeout 20s' : 'status ' + status}). Conmutando a respaldo…`,
      );
    }

    // --- 2) Respaldo inmediato: Groq si hay API key ---
    if (this.groqApiKey) {
      try {
        const data = await this.generateWithGroq<T>(
          systemInstruction,
          userPrompt,
        );
        this.logger.log(`Respaldo Groq (${this.groqModel}) respondió.`);
        return { data, provider: 'Groq' };
      } catch (groqErr: unknown) {
        this.logger.error(
          `Respaldo Groq falló: ${(groqErr as Error)?.message}. ` +
            'Intentando respaldo Gemini secundario…',
        );
      }
    }

    // --- 2b) Respaldo Gemini secundario con timeout corto (sin reintentos) ---
    try {
      const response = await this.withTimeout(
        this.client.models.generateContent({
          model: this.fastFallbackModel,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1,
          },
        }),
        FAST_FALLBACK_TIMEOUT_MS,
      );
      const text = response.text;
      if (!text) throw new Error('Respuesta vacía del respaldo Gemini.');
      this.logger.log(`Respaldo Gemini (${this.fastFallbackModel}) respondió.`);
      return { data: this.parseJson<T>(text), provider: 'Respaldo' };
    } catch (fallbackErr: unknown) {
      this.logger.error(
        `Todos los proveedores fallaron: ${(fallbackErr as Error)?.message}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de IA está saturado y el respaldo no respondió a tiempo. ' +
          'Inténtalo de nuevo en unos momentos.',
      );
    }
  }

  /** Envuelve una promesa en un Promise.race con timeout estricto. */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    });
    return Promise.race([promise, timeout]).finally(() =>
      clearTimeout(timer),
    ) as Promise<T>;
  }

  /**
   * Llama al endpoint OpenAI-compatible de Groq pidiendo salida JSON.
   * Usa fetch nativo (Node 18+) con AbortController para el timeout.
   */
  private async generateWithGroq<T>(
    systemInstruction: string,
    userPrompt: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify({
          model: this.groqModel,
          messages: [
            {
              role: 'system',
              content:
                systemInstruction +
                '\nResponde ÚNICAMENTE con un objeto JSON válido.',
            },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Groq respondió ${res.status}: ${body.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error('Groq devolvió una respuesta vacía.');
      return this.parseJson<T>(content);
    } finally {
      clearTimeout(timer);
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
