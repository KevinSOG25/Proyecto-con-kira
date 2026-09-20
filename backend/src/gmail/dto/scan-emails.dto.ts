import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ScanEmailsDto {
  /**
   * Palabras clave a buscar. Si no se envían, se usan las por defecto
   * (tarea, parcial, brightspace, entrega, examen).
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  /** Días hacia atrás a considerar. Por defecto 7. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  dias?: number;

  /** Máximo de correos a procesar. Por defecto 10 (control de costos). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxResultados?: number;
}
