import { Body, Controller, Post } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { ParseScheduleDto } from './dto/parse-schedule.dto';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  /** Extrae un horario normalizado desde texto y/o imágenes con IA. */
  @Post('parse-ai')
  parseAi(@Body() dto: ParseScheduleDto) {
    return this.schedulesService.parseWithAI(dto);
  }
}
