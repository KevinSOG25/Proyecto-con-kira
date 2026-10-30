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
import { CurriculumService } from './curriculum.service';
import {
  CreateCurriculumItemDto,
  SimulateNextSemesterDto,
  UpdateCurriculumItemDto,
  UpdateDegreeAuditDto,
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

  /**
   * Auditor de grado: requisitos transversales + progreso global.
   * ?aprobadas=ISIS-1221,MATE-1201 (coma-separado) para calcular créditos.
   */
  @Get('degree-audit')
  getDegreeAudit(@Query('aprobadas') aprobadas?: string) {
    const codes = aprobadas ? aprobadas.split(',').filter(Boolean) : [];
    return this.curriculumService.getDegreeAudit(codes);
  }

  /** Actualiza los requisitos transversales del auditor de grado. */
  @Patch('degree-audit')
  updateDegreeAudit(@Body() dto: UpdateDegreeAuditDto) {
    return this.curriculumService.updateDegreeAudit(dto);
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
