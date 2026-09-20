/**
 * Tarea académica extraída por Gemini a partir de un correo.
 * fechaLimite en ISO 8601 o null si no se detectó.
 * esTareaAcademica permite descartar correos irrelevantes.
 */
export interface ExtractedTask {
  esTareaAcademica: boolean;
  titulo: string | null;
  fechaLimite: string | null;
  materia: string | null;
  confianza: number;
}

/** Resultado de escanear un correo, con metadatos de origen. */
export interface EmailScanResult {
  emailId: string;
  asunto: string;
  remitente: string;
  fecha: string;
  extraido: ExtractedTask;
}
