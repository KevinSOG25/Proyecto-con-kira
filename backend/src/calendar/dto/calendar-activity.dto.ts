import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const TIPOS = ['Parcial', 'Quiz', 'Entrega', 'Laboratorio', 'Estudio', 'Otro'];
const DESTINOS = ['local', 'google', 'ambos'];

export class CreateCalendarActivityDto {
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsUUID()
  materiaId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  materiaLabel?: string | null;

  @IsOptional()
  @IsIn(TIPOS)
  tipo?: string;

  @IsDateString()
  inicio: string;

  @IsDateString()
  fin: string;

  @IsOptional()
  @IsIn(DESTINOS)
  destino?: string;
}

export class UpdateCalendarActivityDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  materiaLabel?: string | null;

  @IsOptional()
  @IsUUID()
  materiaId?: string | null;

  @IsOptional()
  @IsIn(TIPOS)
  tipo?: string;

  @IsOptional()
  @IsDateString()
  inicio?: string;

  @IsOptional()
  @IsDateString()
  fin?: string;
}
