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

  /** Códigos de materias en curso (para el tercer estado de la barra). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enCurso?: string[];
}

/** Bloque de horario (snapshot) que se guarda al cerrar el semestre. */
export class SnapshotBloqueHorarioDto {
  @IsString()
  materia: string;

  @IsOptional()
  @IsString()
  codigo?: string | null;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  inicio?: string;

  @IsOptional()
  @IsString()
  fin?: string;
}

/**
 * Cierre de semestre. notasFinales mapea el identificador de la materia
 * (id UUID o código) a su nota final definitiva (0-5). El backend consolida
 * el snapshot, marca aprobadas (nota >= 3.0) y archiva las materias activas.
 */
export class CloseSemesterDto {
  @IsString()
  @MaxLength(20)
  periodo: string;

  /** { materiaId|codigo : notaFinal }. Ajustes manuales del estudiante. */
  @IsOptional()
  notasFinales?: Record<string, number>;

  /** Snapshot opcional del horario del periodo (grilla de clases). */
  @IsOptional()
  @IsArray()
  snapshotHorario?: SnapshotBloqueHorarioDto[];
}

/**
 * Inicio de un nuevo semestre. Si "materias" trae códigos del pensum, se
 * crean las materias activas correspondientes; si viene vacío, arranca en blanco.
 */
export class StartSemesterDto {
  @IsString()
  @MaxLength(20)
  periodo: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materias?: string[];
}

/** Entrada para la proyección con IA del próximo semestre. */
export class ProjectSemesterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aprobadas?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enCurso?: string[];

  /** Créditos objetivo para el próximo semestre (ej. 16-18). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  creditosObjetivo?: number;
}
