import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Subject } from '../subjects/entities/subject.entity';
import { Grade } from '../grades/entities/grade.entity';
import { CurriculumItem } from './entities/curriculum-item.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import {
  SemesterHistory,
  SnapshotBloqueHorario,
  SnapshotMateria,
} from './entities/semester-history.entity';
import { ApprovedCourse } from './entities/approved-course.entity';
import { CloseSemesterDto, StartSemesterDto } from './dto/curriculum.dto';

/** Nota mínima aprobatoria. */
const APROBATORIA = 3.0;

@Injectable()
export class SemesterService {
  private readonly logger = new Logger(SemesterService.name);

  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    @InjectRepository(CurriculumItem)
    private readonly curriculumRepo: Repository<CurriculumItem>,
    @InjectRepository(SemesterHistory)
    private readonly historyRepo: Repository<SemesterHistory>,
    @InjectRepository(ApprovedCourse)
    private readonly approvedRepo: Repository<ApprovedCourse>,
    @InjectRepository(UserTokens)
    private readonly tokensRepo: Repository<UserTokens>,
    private readonly dataSource: DataSource,
  ) {}

  private toNumber(value: number | string | null): number {
    if (value === null || value === undefined) return 0;
    return typeof value === 'string' ? parseFloat(value) : value;
  }

  /** Usuario autenticado (monousuario: primer token) o 'local-user'. */
  private async resolveUser(): Promise<string> {
    const record = await this.tokensRepo.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    return record?.googleUserId ?? 'local-user';
  }

  /**
   * Calcula la nota final neta de una materia a partir de sus cortes
   * (suma de nota * peso/100). Permite sobrescribir con una nota manual.
   */
  private notaFinalDeCortes(grades: Grade[]): number {
    let acc = 0;
    for (const g of grades) {
      const peso = this.toNumber(g.porcentaje);
      const nota = g.calificacionObtenida;
      if (nota !== null && nota !== undefined) {
        acc += this.toNumber(nota) * (peso / 100);
      }
    }
    return Number(acc.toFixed(2));
  }

  // ============================================================
  //  Cierre de semestre
  // ============================================================
  async closeSemester(dto: CloseSemesterDto) {
    const googleUserId = await this.resolveUser();
    const periodo = dto.periodo?.trim();
    if (!periodo) {
      throw new BadRequestException('Debes indicar el periodo a cerrar.');
    }

    const activas = await this.subjectsRepo.find({
      where: { activo: true },
      order: { createdAt: 'ASC' },
    });
    if (activas.length === 0) {
      throw new BadRequestException(
        'No hay materias activas para cerrar en este periodo.',
      );
    }

    const notasFinales = dto.notasFinales ?? {};
    const snapshotMaterias: SnapshotMateria[] = [];
    let sumaPonderada = 0;
    let sumaCreditos = 0;
    let creditosAprobados = 0;

    for (const subject of activas) {
      const grades = await this.gradesRepo.find({
        where: { materiaId: subject.id },
      });
      const creditos = this.toNumber(subject.creditos);

      // Nota final: la manual (por id o por código) tiene prioridad; si no,
      // se calcula a partir de los cortes evaluados.
      const manual =
        notasFinales[subject.id] ??
        (subject.codigo ? notasFinales[subject.codigo] : undefined);
      const notaFinal =
        manual !== undefined && manual !== null
          ? Number(Number(manual).toFixed(2))
          : this.notaFinalDeCortes(grades);

      const aprobada = notaFinal >= APROBATORIA;

      sumaPonderada += notaFinal * creditos;
      sumaCreditos += creditos;
      if (aprobada) creditosAprobados += creditos;

      snapshotMaterias.push({
        materiaId: subject.id,
        codigo: subject.codigo ?? null,
        nombre: subject.nombre,
        creditos,
        notaFinal,
        aprobada,
        evaluaciones: grades.map((g) => ({
          nombreCorte: g.nombreCorte,
          porcentaje: this.toNumber(g.porcentaje),
          calificacionObtenida:
            g.calificacionObtenida === null
              ? null
              : this.toNumber(g.calificacionObtenida),
        })),
      });
    }

    const promedioFinal =
      sumaCreditos > 0 ? Number((sumaPonderada / sumaCreditos).toFixed(2)) : 0;

    const snapshotHorario: SnapshotBloqueHorario[] = (
      dto.snapshotHorario ?? []
    ).map((b) => ({
      materia: b.materia,
      codigo: b.codigo ?? null,
      tipo: b.tipo ?? 'Clase',
      inicio: b.inicio ?? '',
      fin: b.fin ?? '',
    }));

    // Todo lo crítico en una transacción: historial + aprobadas + archivado.
    await this.dataSource.transaction(async (manager) => {
      // 1) Upsert del historial (idempotente por usuario+periodo).
      let history = await manager.findOne(SemesterHistory, {
        where: { googleUserId, periodo },
      });
      if (!history) {
        history = manager.create(SemesterHistory, { googleUserId, periodo });
      }
      history.fechaCierre = new Date();
      history.promedioFinal = promedioFinal;
      history.creditosCursados = sumaCreditos;
      history.creditosAprobados = creditosAprobados;
      history.snapshotMaterias = snapshotMaterias;
      history.snapshotHorario = snapshotHorario;
      await manager.save(history);

      // 2) Registrar materias aprobadas (nota >= 3.0) en el pensum.
      for (const m of snapshotMaterias) {
        if (!m.aprobada || !m.codigo) continue;
        let approved = await manager.findOne(ApprovedCourse, {
          where: { googleUserId, codigo: m.codigo },
        });
        if (!approved) {
          approved = manager.create(ApprovedCourse, {
            googleUserId,
            codigo: m.codigo,
          });
        }
        approved.periodo = periodo;
        approved.notaFinal = m.notaFinal;
        await manager.save(approved);
      }

      // 3) Archivar materias activas (NO se borran: activo = false).
      await manager.update(
        Subject,
        { activo: true },
        { activo: false, semestre: periodo },
      );
    });

    const aprobadasCodigos = snapshotMaterias
      .filter((m) => m.aprobada && m.codigo)
      .map((m) => m.codigo as string);

    this.logger.log(
      `Semestre ${periodo} cerrado: ${activas.length} materias archivadas, ` +
        `${aprobadasCodigos.length} aprobadas, promedio ${promedioFinal}.`,
    );

    return {
      periodo,
      promedioFinal,
      creditosCursados: sumaCreditos,
      creditosAprobados,
      materiasArchivadas: activas.length,
      aprobadas: aprobadasCodigos,
      mensaje: `Semestre ${periodo} archivado. ${aprobadasCodigos.length} materias aprobadas añadidas a tu pensum.`,
    };
  }

  // ============================================================
  //  Historial de semestres
  // ============================================================
  async history() {
    const googleUserId = await this.resolveUser();
    const registros = await this.historyRepo.find({
      where: { googleUserId },
      order: { periodo: 'DESC' },
    });

    // PGA acumulado progresivo (de más antiguo a más nuevo) por si el
    // frontend quiere graficar la evolución semestral vs. acumulada.
    const cronologico = [...registros].sort((a, b) =>
      a.periodo.localeCompare(b.periodo),
    );
    let accPonderado = 0;
    let accCreditos = 0;
    const pgaPorPeriodo = new Map<string, number>();
    for (const r of cronologico) {
      accPonderado += this.toNumber(r.promedioFinal) * r.creditosCursados;
      accCreditos += r.creditosCursados;
      pgaPorPeriodo.set(
        r.periodo,
        accCreditos > 0 ? Number((accPonderado / accCreditos).toFixed(2)) : 0,
      );
    }

    const semestres = registros.map((r) => ({
      id: r.id,
      periodo: r.periodo,
      fechaCierre: r.fechaCierre,
      promedioFinal: this.toNumber(r.promedioFinal),
      creditosCursados: r.creditosCursados,
      creditosAprobados: r.creditosAprobados,
      pgaAcumulado: pgaPorPeriodo.get(r.periodo) ?? 0,
      materias: r.snapshotMaterias ?? [],
      horario: r.snapshotHorario ?? [],
    }));

    const pgaGlobal =
      accCreditos > 0 ? Number((accPonderado / accCreditos).toFixed(2)) : 0;

    return {
      semestres,
      totalSemestres: semestres.length,
      pgaGlobal,
      creditosAprobadosTotales: registros.reduce(
        (acc, r) => acc + r.creditosAprobados,
        0,
      ),
    };
  }

  // ============================================================
  //  Inicio de nuevo semestre
  // ============================================================
  async startSemester(dto: StartSemesterDto) {
    const periodo = dto.periodo?.trim();
    if (!periodo) {
      throw new BadRequestException('Debes indicar el periodo del nuevo semestre.');
    }

    const codigos = (dto.materias ?? [])
      .map((c) => c.trim())
      .filter(Boolean);

    // Sin códigos => arranca en blanco (nada que crear).
    if (codigos.length === 0) {
      return { periodo, creadas: [], total: 0, mensaje: `Nuevo semestre ${periodo} iniciado en blanco.` };
    }

    // Resolver nombre/créditos desde el pensum cuando exista el código.
    const pensum = await this.curriculumRepo.find();
    const byNorm = new Map(
      pensum.map((i) => [i.codigo.replace(/[-\s]/g, '').toUpperCase(), i]),
    );

    const creadas: Subject[] = [];
    for (const codigo of codigos) {
      const match = byNorm.get(codigo.replace(/[-\s]/g, '').toUpperCase());
      const subject = this.subjectsRepo.create({
        nombre: match?.nombre ?? codigo,
        codigo,
        creditos: match?.creditos ?? 3,
        semestre: periodo,
        activo: true,
      });
      creadas.push(await this.subjectsRepo.save(subject));
    }

    this.logger.log(
      `Nuevo semestre ${periodo}: ${creadas.length} materias creadas.`,
    );

    return {
      periodo,
      creadas: creadas.map((s) => ({
        id: s.id,
        codigo: s.codigo,
        nombre: s.nombre,
        creditos: s.creditos,
      })),
      total: creadas.length,
      mensaje: `Nuevo semestre ${periodo} iniciado con ${creadas.length} materias.`,
    };
  }

  // ============================================================
  //  Reabrir / restaurar un semestre archivado (deshacer cierre)
  // ============================================================
  async reopenSemester(periodo: string) {
    const googleUserId = await this.resolveUser();
    const target = periodo?.trim();
    if (!target) throw new BadRequestException('Indica el periodo a reabrir.');

    const history = await this.historyRepo.findOne({
      where: { googleUserId, periodo: target },
    });
    if (!history) {
      throw new NotFoundException(
        `No existe un semestre archivado con periodo ${target}.`,
      );
    }

    // Evitar colisión: si ya hay materias activas, no se puede reabrir encima.
    const activasCount = await this.subjectsRepo.count({
      where: { activo: true },
    });
    if (activasCount > 0) {
      throw new BadRequestException(
        'Ya hay un semestre activo. Cierra o vacía el periodo actual antes de reabrir uno archivado.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // 1) Reactivar las materias de ese periodo.
      await manager.update(
        Subject,
        { activo: false, semestre: target },
        { activo: true },
      );

      // 2) Revertir las materias aprobadas que se registraron en ese cierre.
      const codigosDelPeriodo = (history.snapshotMaterias ?? [])
        .filter((m) => m.aprobada && m.codigo)
        .map((m) => m.codigo as string);
      for (const codigo of codigosDelPeriodo) {
        await manager.delete(ApprovedCourse, {
          googleUserId,
          codigo,
          periodo: target,
        });
      }

      // 3) Eliminar el registro de historial (el cierre queda deshecho).
      await manager.delete(SemesterHistory, { id: history.id });
    });

    this.logger.log(`Semestre ${target} reabierto (cierre deshecho).`);

    return {
      periodo: target,
      mensaje: `Semestre ${target} reabierto. Sus materias vuelven a estar activas.`,
    };
  }

  /** Códigos de materias aprobadas persistidas en el servidor. */
  async approvedCourses(): Promise<
    { codigo: string; periodo: string; notaFinal: number | null }[]
  > {
    const googleUserId = await this.resolveUser();
    const rows = await this.approvedRepo.find({
      where: { googleUserId },
      order: { periodo: 'ASC' },
    });
    return rows.map((r) => ({
      codigo: r.codigo,
      periodo: r.periodo,
      notaFinal: r.notaFinal === null ? null : this.toNumber(r.notaFinal),
    }));
  }
}
