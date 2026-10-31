import { BadRequestException, Injectable } from '@nestjs/common';
import { Type, Part } from '@google/genai';
import { GeminiService } from '../gemini/gemini.service';
import { ParseScheduleDto } from './dto/parse-schedule.dto';

const SYSTEM_PROMPT = `Eres un asistente que extrae horarios académicos universitarios.
Recibes texto (copiado de un sistema tipo Banner) y/o imágenes (capturas del horario u oferta de secciones).
Reglas estrictas:
- Responde ÚNICAMENTE con el JSON del esquema, sin texto adicional ni markdown.
- Extrae CADA clase con su código, nombre, sección, créditos y sus bloques horarios.
- "dia" debe ser uno de: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado.
- "horaInicio" y "horaFin" en formato 24h "HH:MM".
- "salon" y "tipo" (Magistral, Complementaria, Laboratorio, etc.) si aparecen; si no, cadena vacía.
- Si un código aparece con varias secciones, crea una entrada por cada sección.
- No inventes datos que no estén en el texto o la imagen.`;

const SCHEDULE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          codigo: { type: Type.STRING },
          nombre: { type: Type.STRING },
          seccion: { type: Type.STRING },
          creditos: { type: Type.NUMBER },
          bloques: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dia: { type: Type.STRING },
                horaInicio: { type: Type.STRING },
                horaFin: { type: Type.STRING },
                salon: { type: Type.STRING },
                tipo: { type: Type.STRING },
              },
              required: ['dia', 'horaInicio', 'horaFin'],
            },
          },
        },
        required: ['codigo', 'nombre', 'bloques'],
      },
    },
  },
  required: ['clases'],
} as const;

interface ParsedSchedule {
  clases: {
    codigo: string;
    nombre: string;
    seccion?: string;
    creditos?: number;
    bloques: {
      dia: string;
      horaInicio: string;
      horaFin: string;
      salon?: string;
      tipo?: string;
    }[];
  }[];
}

@Injectable()
export class SchedulesService {
  constructor(private readonly gemini: GeminiService) {}

  /**
   * Extrae un horario normalizado desde texto libre y/o imágenes usando
   * gemini-3.8-flash (timeout 20s + fallback). Groq solo se usa si la
   * entrada es texto puro (sin imágenes).
   */
  async parseWithAI(dto: ParseScheduleDto) {
    const texto = (dto.texto ?? '').trim();
    const imagenes = dto.imagenes ?? [];

    if (!texto && imagenes.length === 0) {
      throw new BadRequestException(
        'Debes enviar texto, al menos una imagen, o ambos.',
      );
    }

    const parts: Part[] = [];
    if (texto) {
      parts.push(this.gemini.textPart(`Texto del horario:\n${texto}`));
    }
    for (const img of imagenes) {
      parts.push(this.gemini.imagePart(img, dto.imagenMime ?? 'image/png'));
    }
    if (parts.length === 0) {
      parts.push(this.gemini.textPart('Extrae el horario.'));
    }

    // Si es solo texto, permitimos el fallback a Groq con ese mismo texto.
    const groqText = imagenes.length === 0 && texto ? texto : undefined;

    const { data, provider } =
      await this.gemini.generateJsonMultimodalFast<ParsedSchedule>(
        SYSTEM_PROMPT,
        parts,
        SCHEDULE_SCHEMA as any,
        groqText ? { allowGroqText: groqText } : undefined,
      );

    return {
      clases: data.clases ?? [],
      totalClases: data.clases?.length ?? 0,
      provider,
    };
  }
}
