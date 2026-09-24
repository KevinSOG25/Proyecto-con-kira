import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Part, Schema } from '@google/genai';

/**
 * Envoltura del SDK oficial de Google GenAI (@google/genai) usando el
 * modelo Gemini 3.1 Pro (modelo Pro vigente de la familia 3; las familias
 * 1.5 y 2.0 fueron retiradas por Google). Centraliza:
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

    // El modelo por defecto es 'gemini-3.1-pro-preview' (el modelo Pro vigente
    // de la familia 3; gemini-3-pro-preview y las familias 1.5/2.0 fueron
    // retirados y devuelven 404).
    // El SDK @google/genai ya añade el prefijo "models/" internamente; por eso
    // NUNCA debe incluirse en el string. Si por configuración llega con el
    // prefijo, lo removemos para evitar el 404 "models/models/... not found".
    const configured = this.config.get<string>(
      'GEMINI_MODEL',
      'gemini-3.1-pro-preview',
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
      const response = await this.client.models.generateContent({
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
    } catch (err: any) {
      this.logger.error(`Error al generar JSON con Gemini: ${err.message}`);
      throw new InternalServerErrorException(
        `Fallo en el procesamiento con Gemini: ${err.message}`,
      );
    }
  }

  /** Genera texto libre (para resúmenes ejecutivos, etc.). */
  async generateText(
    systemInstruction: string,
    parts: Part[],
  ): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction, temperature: 0.3 },
      });
      return response.text ?? '';
    } catch (err: any) {
      this.logger.error(`Error al generar texto con Gemini: ${err.message}`);
      throw new InternalServerErrorException(
        `Fallo en el procesamiento con Gemini: ${err.message}`,
      );
    }
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
