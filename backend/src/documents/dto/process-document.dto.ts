import { IsEnum } from 'class-validator';

export enum DocumentType {
  SYLLABUS = 'syllabus',
  DIAPOSITIVAS = 'diapositivas',
}

export class ProcessDocumentDto {
  /** Tipo de documento a procesar: define el prompt y la salida. */
  @IsEnum(DocumentType)
  tipo: DocumentType;
}
