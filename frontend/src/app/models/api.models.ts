/** Modelos de datos alineados con las respuestas del backend NestJS. */

export interface Subject {
  id: string;
  nombre: string;
  codigo?: string;
  creditos: number;
  semestre?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSubject {
  nombre: string;
  codigo?: string;
  creditos?: number;
  semestre?: string;
}

export interface Grade {
  id: string;
  materiaId: string;
  nombreCorte: string;
  porcentaje: number;
  calificacionObtenida: number | null;
  createdAt?: string;
}

export interface CreateGrade {
  materiaId: string;
  nombreCorte: string;
  porcentaje: number;
  calificacionObtenida?: number | null;
}

export type SimulationEstado =
  | 'OBJETIVO_YA_ASEGURADO'
  | 'ALCANZABLE'
  | 'IMPOSIBLE'
  | 'SIN_CORTES_PENDIENTES'
  | 'SIN_CORTES';

export interface SimulationResult {
  materiaId: string;
  objetivo: number;
  porcentajeEvaluado: number;
  porcentajeRestante: number;
  aporteActual: number;
  promedioParcial: number | null;
  notaRequerida: number | null;
  estado: SimulationEstado;
  mensaje: string;
}

export interface Task {
  id: string;
  materiaId: string;
  titulo: string;
  descripcion?: string;
  fechaLimite: string;
  googleEventId?: string | null;
  completada: boolean;
  createdAt?: string;
}

export interface CreateTask {
  materiaId: string;
  titulo: string;
  descripcion?: string;
  fechaLimite: string;
  sincronizarCalendar?: boolean;
}

/** ---- Gmail (extracción con IA) ---- */
export interface ExtractedTask {
  esTareaAcademica: boolean;
  titulo: string | null;
  fechaLimite: string | null;
  materia: string | null;
  confianza: number;
}

export interface EmailScanResult {
  emailId: string;
  asunto: string;
  remitente: string;
  fecha: string;
  extraido: ExtractedTask;
}

export interface ScanEmailsRequest {
  keywords?: string[];
  dias?: number;
  maxResultados?: number;
}

/** ---- Documentos (Gemini multimodal) ---- */
export interface EvaluacionExtraida {
  nombreCorte: string;
  porcentaje: number | null;
  fecha: string | null;
}

export interface SyllabusAnalysis {
  materia: string | null;
  codigo: string | null;
  creditos: number | null;
  evaluaciones: EvaluacionExtraida[];
  fechasClave: { descripcion: string; fecha: string | null }[];
}

export interface SlidesAnalysis {
  resumenEjecutivo: string;
  temasPrincipales: string[];
  fechasOcultas: { descripcion: string; fecha: string | null }[];
}
