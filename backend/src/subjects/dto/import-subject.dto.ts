import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Un corte de evaluación extraído del syllabus. */
export class ImportCutDto {
  @IsString()
  @MaxLength(150)
  nombreCorte: string;

  /** Peso del corte (0-100). Puede venir null desde la IA. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje?: number | null;

  /** Fecha ISO (YYYY-MM-DD) o null. Informativa; no se persiste en Grade. */
  @IsOptional()
  @IsString()
  fecha?: string | null;

  /** Temas específicos que se evalúan en este corte. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  temas?: string[] | null;
}

/**
 * Payload de importación de un syllabus analizado por la IA.
 * Crea la materia y sus cortes en una sola operación.
 */
export class ImportSubjectDto {
  @IsString()
  @MaxLength(150)
  materia: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string | null;

  /** Créditos; si no viene, el backend asigna 3 por defecto. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  creditos?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  semestre?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCutDto)
  evaluaciones: ImportCutDto[];
}
