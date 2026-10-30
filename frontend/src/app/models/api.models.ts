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
  notaActualRelativa: number | null;
  porcentajeEvaluado: number;
  porcentajeRestante: number;
  notaNecesaria: number | null;
  riskLevel: RiskLevel;
  completa: boolean;
}

export interface UpcomingEvaluation {
  gradeId: string;
  materiaId: string;
  materia: string;
  codigo: string | null;
  nombreCorte: string;
  porcentaje: number;
  fecha: string;
  diasRestantes: number;
  temas: string[];
}

export type PriorityLevel = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';

export interface EffortMatrixItem {
  corteId: string;
  materiaId: string;
  materiaNombre: string;
  codigo: string | null;
  nombreCorte: string;
  porcentaje: number;
  creditos: number;
  fecha: string | null;
  diasRestantes: number | null;
  riskLevel: RiskLevel;
  impactoMaximoPromedio: number;
  sensibilidadDecima: number;
  scorePrioridad: number;
  nivelPrioridad: PriorityLevel;
  motivo: string;
}

export interface DashboardAnalytics {
  promedioPonderadoActual: number;
  promedioAcumuladoNeto: number;
  promedioPonderadoSemestral: number;
  totalCreditos: number;
  totalCreditosMatriculados: number;
  totalMaterias: number;
  materias: SubjectGrade[];
  proximasEvaluaciones: UpcomingEvaluation[];
  effortMatrix: EffortMatrixItem[];
}

/** ---- Pensum (malla curricular) ---- */
export type CurriculumStatus = 'pendiente' | 'en_curso' | 'aprobada';

export interface CurriculumItem {
  id: string;
  codigo: string;
  nombre: string;
  creditos: number;
  semestre: number;
  area: string;
  prerrequisitos: string[];
  orden: number;
}

export interface CurriculumResponse {
  items: CurriculumItem[];
  creditosPorSemestre: Record<number, number>;
  equivalencias: Record<string, string>;
}

export interface CreateCurriculumItem {
  codigo: string;
  nombre: string;
  creditos: number;
  semestre: number;
  area: string;
  prerrequisitos?: string[];
  orden?: number;
}

export type UpdateCurriculumItem = Partial<Omit<CreateCurriculumItem, 'orden'>>;

export interface SimulateNextSemesterResult {
  elegibles: CurriculumItem[];
  totalElegibles: number;
  creditosSugeridos: number;
  aprobadasConsideradas: string[];
}

export interface CriticalPathNode {
  codigo: string;
  nombre: string;
  impactoCadena: number;
  dependientesDirectos: string[];
  descendientes: string[];
}

export interface GeminiProjectionCourse {
  codigo: string;
  nombre: string;
  creditos: number;
  razon?: string;
}

export interface GeminiProjection {
  materias: GeminiProjectionCourse[];
  creditosTotales: number;
  creditosObjetivo?: number;
  justificacion: string;
  generadoPorIA: boolean;
  /** Proveedor que resolvió la consulta: 'Gemini' | 'Groq' | 'Respaldo'. */
  provider?: 'Gemini' | 'Groq' | 'Respaldo';
}

/** ---- Catálogo DISC (posgrado / coterminal) ---- */
export type Maestria = 'MISIS' | 'MINE' | 'MATI' | 'MESI' | 'MAIA' | 'MISO';
export type ClasificacionMaestria =
  | 'Fundamentación'
  | 'Profundización'
  | 'Complemento';

export interface DiscCourse {
  codigo: string;
  nombre: string;
  creditos: number;
  area: string;
  clasificaciones: { maestria: Maestria; tipo: ClasificacionMaestria }[];
}

export interface DiscCatalog {
  cursos: DiscCourse[];
  maestrias: { codigo: Maestria; nombre: string }[];
  creditosPosgradoObjetivo: number;
}

/** ---- Auditor de grado ---- */
export interface DegreeAuditState {
  id: string;
  googleUserId: string;
  rlecAprobado: boolean;
  ridiAprobado: boolean;
  cursoTipoE1: string | null;
  cursoTipoE2: string | null;
  cursoTipoEpsilon: string | null;
  internacionalizacion: boolean;
}

export interface DegreeProgress {
  creditosAprobados: number;
  creditosEnCurso: number;
  creditosTotales: number;
  porcentajeAvance: number;
  porcentajeEnCurso: number;
  cbusTotales: number;
  cbusCompletados: number;
  clesTotales: number;
  clesCompletados: number;
  nivel12Totales: number;
  nivel12Aprobados: number;
  elegibleProyectoGrado: boolean;
}

export interface DegreeAuditResponse {
  audit: DegreeAuditState;
  progreso: DegreeProgress;
  creditosTotales: number;
}

export interface UpdateDegreeAudit {
  rlecAprobado?: boolean;
  ridiAprobado?: boolean;
  cursoTipoE1?: string | null;
  cursoTipoE2?: string | null;
  cursoTipoEpsilon?: string | null;
  internacionalizacion?: boolean;
  aprobadas?: string[];
  enCurso?: string[];
}

/** ---- Importación de syllabus ---- */
export interface ImportSubjectPayload {
  materia: string;
  codigo?: string | null;
  creditos?: number | null;
  semestre?: string | null;
  evaluaciones: EvaluacionExtraida[];
}
