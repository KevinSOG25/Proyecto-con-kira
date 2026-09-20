import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { SimulateGradeDto } from './dto/simulate-grade.dto';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post()
  create(@Body() dto: CreateGradeDto) {
    return this.gradesService.create(dto);
  }

  @Get('subject/:materiaId')
  findBySubject(@Param('materiaId', ParseUUIDPipe) materiaId: string) {
    return this.gradesService.findBySubject(materiaId);
  }

  /** Promedio ponderado actual de la materia (aporte de los cortes evaluados). */
  @Get('subject/:materiaId/average')
  async average(@Param('materiaId', ParseUUIDPipe) materiaId: string) {
    const promedio = await this.gradesService.calcularPromedioPonderado(materiaId);
    return { materiaId, promedioPonderado: promedio };
  }

  /** Simula la nota mínima requerida para alcanzar un objetivo (default 3.0). */
  @Get('subject/:materiaId/simulate')
  simulate(
    @Param('materiaId', ParseUUIDPipe) materiaId: string,
    @Query() query: SimulateGradeDto,
  ) {
    return this.gradesService.simular(materiaId, query.objetivo);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeDto,
  ) {
    return this.gradesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradesService.remove(id);
  }
}
