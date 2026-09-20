import { Injectable, Logger } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { Type } from '@google/genai';
import { GoogleAuthClient } from '../auth/google-auth.client';
import { GeminiService } from '../gemini/gemini.service';
import { ScanEmailsDto } from './dto/scan-emails.dto';
import {
  EmailScanResult,
  ExtractedTask,
} from './interfaces/extracted-task.interface';

const DEFAULT_KEYWORDS = [
  'tarea',
  'parcial',
  'brightspace',
  'entrega',
  'examen',
];

/** Prompt de sistema estricto para forzar extracción estructurada. */
const SYSTEM_PROMPT = `Eres un asistente académico que extrae información de tareas y entregas a partir del texto de un correo electrónico universitario.
Reglas estrictas:
- Responde ÚNICAMENTE con el JSON solicitado, sin texto adicional ni explicaciones.
- Si el correo NO describe una tarea, entrega, parcial o examen concreto, marca esTareaAcademica=false y deja los demás campos en null.
- "titulo": nombre corto y claro de la tarea/entrega (máx 100 caracteres).
- "fechaLimite": fecha y hora límite en formato ISO 8601 (YYYY-MM-DDTHH:mm:ss). Si solo hay fecha, usa T23:59:00. Si no hay fecha, null.
- "materia": nombre de la asignatura si se menciona; si no, null.
- "confianza": número entre 0 y 1 con tu certeza de que es una tarea académica real.
- No inventes fechas ni materias que no aparezcan en el texto.`;

/** Esquema JSON que Gemini debe cumplir. */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    esTareaAcademica: { type: Type.BOOLEAN },
    titulo: { type: Type.STRING, nullable: true },
    fechaLimite: { type: Type.STRING, nullable: true },
    materia: { type: Type.STRING, nullable: true },
    confianza: { type: Type.NUMBER },
  },
  required: ['esTareaAcademica', 'confianza'],
} as const;

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly googleAuth: GoogleAuthClient,
    private readonly gemini: GeminiService,
  ) {}

  private async getClient(): Promise<gmail_v1.Gmail> {
    const auth = await this.googleAuth.getAuthenticatedClient();
    return google.gmail({ version: 'v1', auth });
  }

  /** Construye el query de búsqueda de Gmail con las palabras clave y ventana temporal. */
  private buildQuery(keywords: string[], dias: number): string {
    const orKeywords = keywords.map((k) => `"${k}"`).join(' OR ');
    return `(${orKeywords}) newer_than:${dias}d`;
  }

  /**
   * Escanea los correos recientes que coincidan con las palabras clave
   * y usa Gemini para extraer, de cada uno, la tarea académica estructurada.
   */
  async scanEmails(dto: ScanEmailsDto): Promise<EmailScanResult[]> {
    const keywords = dto.keywords?.length ? dto.keywords : DEFAULT_KEYWORDS;
    const dias = dto.dias ?? 7;
    const maxResultados = dto.maxResultados ?? 10;

    const gmail = await this.getClient();
    const query = this.buildQuery(keywords, dias);

    const list = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: maxResultados,
    });

    const messages = list.data.messages ?? [];
    this.logger.log(`Gmail devolvió ${messages.length} correos para "${query}".`);

    const results: EmailScanResult[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });
        const result = await this.processMessage(full.data);
        results.push(result);
      } catch (err: any) {
        this.logger.error(`Error procesando correo ${msg.id}: ${err.message}`);
      }
    }

    return results;
  }

  /** Extrae metadatos + cuerpo del mensaje y llama a Gemini. */
  private async processMessage(
    message: gmail_v1.Schema$Message,
  ): Promise<EmailScanResult> {
    const headers = message.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value ?? '';

    const asunto = getHeader('Subject');
    const remitente = getHeader('From');
    const fecha = getHeader('Date');
    const body = this.extractBody(message.payload);

    const extraido = await this.extractWithGemini(asunto, body);

    return {
      emailId: message.id ?? '',
      asunto,
      remitente,
      fecha,
      extraido,
    };
  }

  /** Recorre las partes MIME para obtener el texto plano (o HTML como fallback). */
  private extractBody(payload?: gmail_v1.Schema$MessagePart): string {
    if (!payload) return '';

    const decode = (data?: string | null): string =>
      data ? Buffer.from(data, 'base64').toString('utf-8') : '';

    // Cuerpo directo.
    if (payload.body?.data && payload.mimeType === 'text/plain') {
      return decode(payload.body.data);
    }

    // Buscar recursivamente text/plain, luego text/html.
    const findPart = (
      parts: gmail_v1.Schema$MessagePart[] | undefined,
      mime: string,
    ): string => {
      if (!parts) return '';
      for (const part of parts) {
        if (part.mimeType === mime && part.body?.data) {
          return decode(part.body.data);
        }
        const nested = findPart(part.parts, mime);
        if (nested) return nested;
      }
      return '';
    };

    const plain = findPart(payload.parts, 'text/plain');
    if (plain) return plain;

    const html = findPart(payload.parts, 'text/html');
    if (html) {
      // Limpieza básica de etiquetas HTML.
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    return decode(payload.body?.data);
  }

  /** Envía asunto + cuerpo a Gemini y obtiene el JSON estructurado. */
  private async extractWithGemini(
    asunto: string,
    body: string,
  ): Promise<ExtractedTask> {
    // Recorte para controlar costos/tokens.
    const contenido = `ASUNTO: ${asunto}\n\nCUERPO:\n${body.slice(0, 6000)}`;

    return this.gemini.generateJson<ExtractedTask>(
      SYSTEM_PROMPT,
      [this.gemini.textPart(contenido)],
      RESPONSE_SCHEMA as any,
    );
  }
}
