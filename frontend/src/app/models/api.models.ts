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
  temas?: string[];
  createdAt?: string;
}

export interface CreateGrade {
  materiaId: string;
  nombreCorte: string;
  porcentaje: number;
  calificacionObtenida?: number | null;
  temas?: string[];
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
  temas?: string[];
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


/** ---- Planeación semanal ---- */
export interface WeeklyPlan {
  id: string;
  googleUserId: string;
  materiaId: string | null;
  weekNumber: number;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertWeeklyPlan {
  weekNumber: number;
  content: string;
  materiaId?: string;
}


/** ---- Analytics / Dashboard ---- */
export type RiskLevel = 'SAFE' | 'WARNING' | 'DANGER';

export interface SubjectGrade {
  materiaId: string;
  nombre: string;
  codigo: string | null;
  creditos: number;
  notaFinal: number;
  notaAcumulada: number;
  porcentajeEvaluado: number;
  porcentajeRestante: number;
  notaNecesaria: number | null;
  riskLevel: RiskLevel;
  completa: boolean;
}

export interface DashboardAnalytics {
  promedioPonderadoSemestral: number;
  totalCreditos: number;
  totalMaterias: number;
  materias: SubjectGrade[];
}

/** ---- Importación de syllabus ---- */
export interface ImportSubjectPayload {
  materia: string;
  codigo?: string | null;
  creditos?: number | null;
  semestre?: string | null;
  evaluaciones: EvaluacionExtraida[];
}
