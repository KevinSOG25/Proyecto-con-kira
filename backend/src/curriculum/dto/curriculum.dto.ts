import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCurriculumItemDto {
  @IsString()
  @MaxLength(40)
  codigo: string;

  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsInt()
  @Min(0)
  @Max(30)
  creditos: number;

  @IsInt()
  @Min(1)
  @Max(8)
  semestre: number;

  @IsString()
  @MaxLength(60)
  area: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerrequisitos?: string[];

  @IsOptional()
  @IsInt()
  orden?: number;
}

export class UpdateCurriculumItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  creditos?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  semestre?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  area?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerrequisitos?: string[];
}

/**
 * Entrada para simular el próximo semestre. Se pueden pasar explícitamente
 * los códigos aprobados; si se omiten, el backend no asume ninguno y el
 * frontend suele enviar aprobadas + en curso.
 */
export class SimulateNextSemesterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aprobadas?: string[];
}

/** Actualización parcial del auditor de grado (requisitos transversales). */
export class UpdateDegreeAuditDto {
  @IsOptional()
  @IsBoolean()
  rlecAprobado?: boolean;

  @IsOptional()
  @IsBoolean()
  ridiAprobado?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cursoTipoE1?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cursoTipoE2?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cursoTipoEpsilon?: string | null;

  @IsOptional()
  @IsBoolean()
  internacionalizacion?: boolean;

  /**
   * Códigos de materias aprobadas (opcional). Si se envían, el backend calcula
   * el progreso de créditos y la elegibilidad de grado con base en ellos.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aprobadas?: string[];
}
