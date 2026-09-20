import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGradeDto {
  @IsUUID()
  materiaId: string;

  @IsString()
  @MaxLength(150)
  nombreCorte: string;

  /** Peso del corte sobre la nota final (0-100). */
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje: number;

  /** Nota obtenida (0.0-5.0). Opcional: null si el corte aún no se evalúa. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  calificacionObtenida?: number;
}
