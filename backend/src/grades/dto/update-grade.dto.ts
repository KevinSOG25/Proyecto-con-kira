import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateGradeDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreCorte?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  calificacionObtenida?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  temas?: string[];
}
