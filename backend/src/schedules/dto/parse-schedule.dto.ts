import { IsArray, IsOptional, IsString } from 'class-validator';

/** Entrada para el parser de horarios con IA (texto y/o imágenes base64). */
export class ParseScheduleDto {
  /** Texto libre pegado (oferta de cursos, Banner, etc.). */
  @IsOptional()
  @IsString()
  texto?: string;

  /**
   * Imágenes en base64 (con o sin prefijo data:). Capturas del horario o de
   * las secciones ofertadas.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagenes?: string[];

  /** MIME de las imágenes (por defecto image/png). */
  @IsOptional()
  @IsString()
  imagenMime?: string;
}
