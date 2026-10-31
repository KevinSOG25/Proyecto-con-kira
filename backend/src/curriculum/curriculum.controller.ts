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
import { SemesterService } from './semester.service';
import {
  CloseSemesterDto,
  CreateCurriculumItemDto,
  ProjectSemesterDto,
  SimulateNextSemesterDto,
  StartSemesterDto,
  UpdateCurriculumItemDto,
  UpdateDegreeAuditDto,
} from './dto/curriculum.dto';

@Controller('curriculum')
export class CurriculumController {
  constructor(
    private readonly curriculumService: CurriculumService,
    private readonly semesterService: SemesterService,
  ) {}

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

  /** Catálogo de posgrado DISC + maestrías (para coterminal/énfasis). */
  @Get('disc-catalog')
  discCatalog() {
    return this.curriculumService.discCatalog();
  }

  /**
   * Auditor de grado: requisitos transversales + progreso global.
   * ?aprobadas=ISIS-1221,MATE-1201 (coma-separado) para calcular créditos.
   */
  @Get('degree-audit')
  getDegreeAudit(
    @Query('aprobadas') aprobadas?: string,
    @Query('enCurso') enCurso?: string,
  ) {
    const ap = aprobadas ? aprobadas.split(',').filter(Boolean) : [];
    const ec = enCurso ? enCurso.split(',').filter(Boolean) : [];
    return this.curriculumService.getDegreeAudit(ap, ec);
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

  /** Proyección con IA: Gemini propone una combinación balanceada. */
  @Post('project-semester')
  projectSemester(@Body() dto: ProjectSemesterDto) {
    return this.curriculumService.projectWithGemini(dto);
  }

  // ===================== Ciclo de vida multi-semestre =====================

  /**
   * Cierra y archiva el semestre actual: consolida el snapshot, marca las
   * materias aprobadas (nota >= 3.0) en el pensum y archiva (activo=false)
   * las materias activas sin borrarlas.
   */
  @Post('close-semester')
  closeSemester(@Body() dto: CloseSemesterDto) {
    return this.semesterService.closeSemester(dto);
  }

  /** Historial ordenado de semestres cerrados con promedios y desglose. */
  @Get('history')
  history() {
    return this.semesterService.history();
  }

  /** Materias aprobadas persistidas (para sincronizar el estado del pensum). */
  @Get('approved-courses')
  approvedCourses() {
    return this.semesterService.approvedCourses();
  }

  /** Inicia un nuevo semestre: vacío o precargado con códigos del pensum. */
  @Post('start-semester')
  startSemester(@Body() dto: StartSemesterDto) {
    return this.semesterService.startSemester(dto);
  }

  /** Reabre un semestre archivado (deshace el cierre y reactiva materias). */
  @Post('reopen-semester')
  reopenSemester(@Body('periodo') periodo: string) {
    return this.semesterService.reopenSemester(periodo);
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
