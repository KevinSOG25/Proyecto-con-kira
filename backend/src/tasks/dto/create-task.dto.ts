import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  materiaId: string;

  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  /** Fecha límite en formato ISO 8601. */
  @IsDateString()
  fechaLimite: string;

  @IsOptional()
  @IsBoolean()
  completada?: boolean;

  /**
   * Si es false, no se crea evento en Google Calendar.
   * Por defecto true.
   */
  @IsOptional()
  @IsBoolean()
  sincronizarCalendar?: boolean;
}
