import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { WeeklyPlansService } from './weekly-plans.service';
import { UpsertWeeklyPlanDto } from './dto/upsert-weekly-plan.dto';
import { UpdateWeeklyPlanDto } from './dto/update-weekly-plan.dto';

@Controller('weekly-plans')
export class WeeklyPlansController {
  constructor(private readonly weeklyPlansService: WeeklyPlansService) {}

  /**
   * Lista las planeaciones del usuario autenticado.
   * ?materiaId=<uuid> filtra por materia; ?materiaId=null trae las generales.
   */
  @Get()
  findAll(@Query('materiaId') materiaId?: string) {
    return this.weeklyPlansService.findAll(materiaId);
  }

  /** Crea o actualiza (upsert) la planeación de una semana. */
  @Post()
  upsert(@Body() dto: UpsertWeeklyPlanDto) {
    return this.weeklyPlansService.upsert(dto);
  }

  /** Actualiza el contenido de una planeación existente por id. */
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWeeklyPlanDto,
  ) {
    return this.weeklyPlansService.update(id, dto);
  }
}
