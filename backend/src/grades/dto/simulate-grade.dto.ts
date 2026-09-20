import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SimulateGradeDto {
  /** Nota final objetivo (0.0-5.0). Por defecto la aprobatoria 3.0. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  objetivo?: number;
}
