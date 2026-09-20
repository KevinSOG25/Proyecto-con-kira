/** Un corte de evaluación detectado en el syllabus. */
export interface EvaluacionExtraida {
  nombreCorte: string;
  porcentaje: number | null;
  fecha: string | null;
}

/** Resultado del análisis de un syllabus. */
export interface SyllabusAnalysis {
  materia: string | null;
  codigo: string | null;
  creditos: number | null;
  evaluaciones: EvaluacionExtraida[];
  fechasClave: { descripcion: string; fecha: string | null }[];
}

/** Resultado del análisis de diapositivas de clase. */
export interface SlidesAnalysis {
  resumenEjecutivo: string;
  temasPrincipales: string[];
  fechasOcultas: { descripcion: string; fecha: string | null }[];
}

export type DocumentAnalysis = SyllabusAnalysis | SlidesAnalysis;
