import { BadRequestException, Injectable } from '@nestjs/common';
import { Type } from '@google/genai';
import { GeminiService } from '../gemini/gemini.service';
import { DocumentType } from './dto/process-document.dto';
import {
  SlidesAnalysis,
  SyllabusAnalysis,
} from './interfaces/document-analysis.interface';

const SYLLABUS_PROMPT = `Eres un asistente académico que analiza el SYLLABUS (programa) de una materia universitaria en formato PDF.
Reglas estrictas:
- Responde ÚNICAMENTE con el JSON solicitado, sin texto adicional.
- Extrae el nombre de la materia, su código y número de créditos si aparecen (si no, null).
- En "evaluaciones" incluye cada corte/actividad calificable con su nombre, su porcentaje (número 0-100 o null) y su fecha en ISO 8601 (YYYY-MM-DD) o null.
- Para cada corte, analiza el CRONOGRAMA/temario del documento y asigna en "temas" la lista de temas o unidades específicas que se evalúan en ese corte (p. ej. ["Límites", "Derivadas", "Regla de la cadena"]). Si el syllabus no detalla los temas de un corte, devuelve un arreglo vacío []. No inventes temas que no aparezcan en el documento.
- En "fechasClave" incluye fechas importantes que no sean necesariamente evaluaciones (inicio, receso, entrega de notas, etc.).
- No inventes datos que no aparezcan en el documento.`;

const SLIDES_PROMPT = `Eres un asistente académico que analiza DIAPOSITIVAS de clase de una materia universitaria en formato PDF.
Reglas estrictas:
- Responde ÚNICAMENTE con el JSON solicitado, sin texto adicional.
- "resumenEjecutivo": un resumen claro de 4 a 8 frases del contenido principal.
- "temasPrincipales": lista de los temas o conceptos clave tratados.
- "fechasOcultas": cualquier fecha, entrega o plazo mencionado dentro de las diapositivas (a veces aparecen en notas al pie o ejemplos), con su descripción y fecha en ISO 8601 (YYYY-MM-DD) o null.
- No inventes fechas ni temas que no aparezcan en el documento.`;

const SYLLABUS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    materia: { type: Type.STRING, nullable: true },
    codigo: { type: Type.STRING, nullable: true },
    creditos: { type: Type.INTEGER, nullable: true },
    evaluaciones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nombreCorte: { type: Type.STRING },
          porcentaje: { type: Type.NUMBER, nullable: true },
          fecha: { type: Type.STRING, nullable: true },
          temas: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['nombreCorte'],
      },
    },
    fechasClave: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          descripcion: { type: Type.STRING },
          fecha: { type: Type.STRING, nullable: true },
        },
        required: ['descripcion'],
      },
    },
  },
  required: ['evaluaciones', 'fechasClave'],
} as const;

const SLIDES_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    resumenEjecutivo: { type: Type.STRING },
    temasPrincipales: { type: Type.ARRAY, items: { type: Type.STRING } },
    fechasOcultas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          descripcion: { type: Type.STRING },
          fecha: { type: Type.STRING, nullable: true },
        },
        required: ['descripcion'],
      },
    },
  },
  required: ['resumenEjecutivo', 'temasPrincipales', 'fechasOcultas'],
} as const;

@Injectable()
export class DocumentsService {
  constructor(private readonly gemini: GeminiService) {}

  private validatePdf(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo PDF (campo "file").');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Tipo de archivo no soportado: ${file.mimetype}. Solo se aceptan PDF.`,
      );
    }
  }

  /** Analiza un syllabus: fechas clave y porcentajes de evaluación. */
  async analyzeSyllabus(file: Express.Multer.File): Promise<SyllabusAnalysis> {
    this.validatePdf(file);
    return this.gemini.generateJson<SyllabusAnalysis>(
      SYLLABUS_PROMPT,
      [
        this.gemini.textPart('Analiza este syllabus:'),
        this.gemini.filePart(file.buffer, 'application/pdf'),
      ],
      SYLLABUS_SCHEMA as any,
    );
  }

  /** Analiza diapositivas: resumen ejecutivo + fechas ocultas. */
  async analyzeSlides(file: Express.Multer.File): Promise<SlidesAnalysis> {
    this.validatePdf(file);
    return this.gemini.generateJson<SlidesAnalysis>(
      SLIDES_PROMPT,
      [
        this.gemini.textPart('Analiza estas diapositivas de clase:'),
        this.gemini.filePart(file.buffer, 'application/pdf'),
      ],
      SLIDES_SCHEMA as any,
    );
  }

  /** Enruta según el tipo de documento. */
  async process(file: Express.Multer.File, tipo: DocumentType) {
    return tipo === DocumentType.SYLLABUS
      ? this.analyzeSyllabus(file)
      : this.analyzeSlides(file);
  }
}
