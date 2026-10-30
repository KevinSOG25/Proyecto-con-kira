import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurriculumService } from './curriculum.service';
import {
  CreateCurriculumItemDto,
  SimulateNextSemesterDto,
  UpdateCurriculumItemDto,
} from './dto/curriculum.dto';

@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  /** Lista el pensum completo + créditos por semestre + equivalencias. */
  @Get()
  findAll() {
    return this.curriculumService.findAll();
  }

  /** Ruta crítica: impacto en cadena (materias que bloquea cada asignatura). */
  @Get('critical-path')
  criticalPath() {
    return this.curriculumService.criticalPath();
  }

  /** Simula el próximo semestre: materias elegibles dadas las aprobadas. */
  @Post('simulate-next-semester')
  simulateNextSemester(@Body() dto: SimulateNextSemesterDto) {
    return this.curriculumService.simulateNextSemester(dto.aprobadas ?? []);
  }

  @Post()
  create(@Body() dto: CreateCurriculumItemDto) {
    return this.curriculumService.create(dto);
  }

  /** Re-siembra el seed inicial (sembrado automático si la tabla está vacía). */
  @Post('seed')
  reseed() {
    return this.curriculumService.restore();
  }

  /** Restaura el pensum original. */
  @Post('restore')
  restore() {
    return this.curriculumService.restore();
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurriculumItemDto,
  ) {
    return this.curriculumService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.curriculumService.remove(id);
  }
}
