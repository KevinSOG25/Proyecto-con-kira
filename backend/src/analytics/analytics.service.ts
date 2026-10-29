import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from '../subjects/entities/subject.entity';
import { Grade } from '../grades/entities/grade.entity';

/** Nivel de riesgo de perder la materia (semáforo). */
export type RiskLevel = 'SAFE' | 'WARNING' | 'DANGER';

/** Nota final calculada de una materia. */
export interface SubjectGrade {
  materiaId: string;
  nombre: string;
  codigo: string | null;
  creditos: number;
  /** Nota final (0-5): suma del aporte de los cortes evaluados. */
  notaFinal: number;
  /** Nota acumulada neta = aporte de los cortes ya evaluados (0-5). */
  notaAcumulada: number;
  /**
   * Nota actual relativa a lo evaluado: notaAcumulada / (%evaluado/100).
   * Es la nota que llevas "sobre lo visto". null si no hay cortes evaluados.
   */
  notaActualRelativa: number | null;
  /** % de la materia ya evaluado. */
  porcentajeEvaluado: number;
  /** % de la materia aún por evaluar. */
  porcentajeRestante: number;
  /**
   * Nota necesaria (0-5) en el % restante para alcanzar 3.0 final.
   * null si no queda nada por evaluar. Puede ser > 5 (imposible) o <= 0 (asegurado).
   */
  notaNecesaria: number | null;
  /** Semáforo de riesgo de perder la materia. */
  riskLevel: RiskLevel;
  /** true si todos los cortes tienen nota. */
  completa: boolean;
}

/** Evaluación próxima con fecha programada. */
export interface UpcomingEvaluation {
  gradeId: string;
  materiaId: string;
  materia: string;
  codigo: string | null;
  nombreCorte: string;
  porcentaje: number;
  fecha: string;
  /** Días que faltan para la fecha (0 = hoy, negativos quedan excluidos). */
  diasRestantes: number;
  temas: string[];
}

export interface DashboardAnalytics {
  /**
   * Promedio ponderado ACTUAL del semestre, usando la nota relativa a lo
   * evaluado de cada materia, ponderada por créditos (valor principal).
   */
  promedioPonderadoActual: number;
  /**
   * Promedio ponderado ACUMULADO NETO (dato secundario): usa la nota neta,
   * que asume 0.0 en lo aún no evaluado.
   */
  promedioAcumuladoNeto: number;
  /**
   * Alias retrocompatible del acumulado neto (lo que devolvía antes el campo
   * promedioPonderadoSemestral).
   */
  promedioPonderadoSemestral: number;
  totalCreditos: number;
  totalMaterias: number;
  materias: SubjectGrade[];
  proximasEvaluaciones: UpcomingEvaluation[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
  ) {}

  private toNumber(value: number | string | null): number | null {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? parseFloat(value) : value;
  }

  /**
   * Calcula la nota necesaria en el % restante para alcanzar el 3.0 final
   * y clasifica el nivel de riesgo (semáforo).
   *
   * Modelo: notaFinal = notaAcumulada + notaNecesaria * (%restante / 100)
   *   => notaNecesaria = (3.0 - notaAcumulada) / (%restante / 100)
   */
  private calcularRiesgo(
    notaAcumulada: number,
    porcentajeRestante: number,
  ): { notaNecesaria: number | null; riskLevel: RiskLevel } {
    const APROBATORIA = 3.0;

    if (porcentajeRestante <= 0) {
      return {
        notaNecesaria: null,
        riskLevel: notaAcumulada >= APROBATORIA ? 'SAFE' : 'DANGER',
      };
    }

    const necesariaRaw =
      (APROBATORIA - notaAcumulada) / (porcentajeRestante / 100);
    const notaNecesaria = Number(necesariaRaw.toFixed(2));

    let riskLevel: RiskLevel;
    if (necesariaRaw > 5.0) {
      riskLevel = 'DANGER';
    } else if (necesariaRaw >= 4.0) {
      riskLevel = 'WARNING';
    } else {
      riskLevel = 'SAFE';
    }

    return { notaNecesaria, riskLevel };
  }

  /** Días (enteros) entre hoy y una fecha ISO (YYYY-MM-DD). */
  private diffDays(fechaIso: string): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const target = new Date(`${fechaIso}T00:00:00`);
    const ms = target.getTime() - hoy.getTime();
    return Math.round(ms / 86_400_000);
  }

  async getDashboard(): Promise<DashboardAnalytics> {
    const subjects = await this.subjectsRepo.find({
      order: { createdAt: 'ASC' },
    });

    const materias: SubjectGrade[] = [];
    const proximasEvaluaciones: UpcomingEvaluation[] = [];

    for (const subject of subjects) {
      const grades = await this.gradesRepo.find({
        where: { materiaId: subject.id },
      });

      let notaFinal = 0;
      let porcentajeEvaluado = 0;
      let porcentajeTotal = 0;

      for (const g of grades) {
        const peso = this.toNumber(g.porcentaje) ?? 0;
        const nota = this.toNumber(g.calificacionObtenida);
        porcentajeTotal += peso;
        if (nota !== null) {
          notaFinal += nota * (peso / 100);
          porcentajeEvaluado += peso;
        }

        // Próximas evaluaciones: cortes con fecha futura (o de hoy) sin calificar.
        if (g.fecha && nota === null) {
          const dias = this.diffDays(g.fecha);
          if (dias >= 0) {
            proximasEvaluaciones.push({
              gradeId: g.id,
              materiaId: subject.id,
              materia: subject.nombre,
              codigo: subject.codigo ?? null,
              nombreCorte: g.nombreCorte,
              porcentaje: peso,
              fecha: g.fecha,
              diasRestantes: dias,
              temas: g.temas ?? [],
            });
          }
        }
      }

      const notaAcumulada = Number(notaFinal.toFixed(2));
      const porcentajeRestante = Math.max(0, 100 - porcentajeEvaluado);

      // Nota relativa a lo evaluado (lo que llevas "sobre lo visto").
      const notaActualRelativa =
        porcentajeEvaluado > 0
          ? Number((notaAcumulada / (porcentajeEvaluado / 100)).toFixed(2))
          : null;

      const { notaNecesaria, riskLevel } = this.calcularRiesgo(
        notaAcumulada,
        porcentajeRestante,
      );

      materias.push({
        materiaId: subject.id,
        nombre: subject.nombre,
        codigo: subject.codigo ?? null,
        creditos: this.toNumber(subject.creditos) ?? 0,
        notaFinal: notaAcumulada,
        notaAcumulada,
        notaActualRelativa,
        porcentajeEvaluado,
        porcentajeRestante,
        notaNecesaria,
        riskLevel,
        completa: porcentajeTotal > 0 && porcentajeEvaluado >= porcentajeTotal,
      });
    }

    // Promedios ponderados por créditos, solo materias con algo evaluado.
    let sumaRelativa = 0;
    let sumaNeta = 0;
    let sumaCreditos = 0;
    for (const m of materias) {
      if (m.porcentajeEvaluado > 0 && m.creditos > 0) {
        sumaRelativa += (m.notaActualRelativa ?? 0) * m.creditos;
        sumaNeta += m.notaAcumulada * m.creditos;
        sumaCreditos += m.creditos;
      }
    }

    const promedioPonderadoActual =
      sumaCreditos > 0 ? Number((sumaRelativa / sumaCreditos).toFixed(2)) : 0;
    const promedioAcumuladoNeto =
      sumaCreditos > 0 ? Number((sumaNeta / sumaCreditos).toFixed(2)) : 0;

    // Ordenar próximas evaluaciones de la más cercana a la más lejana.
    proximasEvaluaciones.sort((a, b) => a.diasRestantes - b.diasRestantes);

    return {
      promedioPonderadoActual,
      promedioAcumuladoNeto,
      promedioPonderadoSemestral: promedioAcumuladoNeto, // alias retrocompatible
      totalCreditos: sumaCreditos,
      totalMaterias: materias.length,
      materias,
      proximasEvaluaciones,
    };
  }
}
