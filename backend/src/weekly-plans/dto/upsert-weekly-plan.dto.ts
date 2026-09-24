import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** Crea o actualiza la planeación de una semana concreta. */
export class UpsertWeeklyPlanDto {
  @IsInt()
  @Min(1)
  @Max(16)
  weekNumber: number;

  @IsString()
  content: string;

  /** Materia opcional. Si se omite, es una planeación general del semestre. */
  @IsOptional()
  @IsUUID()
  materiaId?: string;
}
