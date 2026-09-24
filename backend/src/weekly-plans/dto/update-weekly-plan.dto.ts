import { IsString } from 'class-validator';

/** Actualiza únicamente el contenido de una planeación existente (por id). */
export class UpdateWeeklyPlanDto {
  @IsString()
  content: string;
}
