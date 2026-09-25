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
  /** Nota acumulada actual = aporte de los cortes ya evaluados (0-5). */
  notaAcumulada: number;
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

export interface DashboardAnalytics {
  /** Promedio Ponderado Semestral = Σ(notaFinal * créditos) / Σ créditos. */
  promedioPonderadoSemestral: number;
  totalCreditos: number;
  totalMaterias: number;
  materias: SubjectGrade[];
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
   *
   * riskLevel:
   *  - DANGER : notaNecesaria > 5.0 (matemáticamente imposible aprobar).
   *  - WARNING: notaNecesaria entre 4.0 y 5.0 (exige rendimiento alto).
   *  - SAFE   : notaNecesaria < 4.0 (incluye objetivo ya asegurado).
   */
  private calcularRiesgo(
    notaAcumulada: number,
    porcentajeRestante: number,
  ): { notaNecesaria: number | null; riskLevel: RiskLevel } {
    const APROBATORIA = 3.0;

    // No queda nada por evaluar: el resultado ya está definido.
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

  /**
   * Calcula el dashboard estadístico:
   *  - nota final por materia (aporte ponderado de sus cortes evaluados),
   *  - promedio ponderado semestral por créditos.
   */
  async getDashboard(): Promise<DashboardAnalytics> {
    const subjects = await this.subjectsRepo.find({
      order: { createdAt: 'ASC' },
    });

    const materias: SubjectGrade[] = [];

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
      }

      // Base para el % restante: si los cortes suman 100 usamos lo pendiente;
      // si no llegan a 100, consideramos el resto hasta 100 como pendiente.
      const notaAcumulada = Number(notaFinal.toFixed(2));
      const porcentajeRestante = Math.max(0, 100 - porcentajeEvaluado);

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
        porcentajeEvaluado,
        porcentajeRestante,
        notaNecesaria,
        riskLevel,
        completa: porcentajeTotal > 0 && porcentajeEvaluado >= porcentajeTotal,
      });
    }

    // Promedio ponderado semestral: Σ(notaFinal * créditos) / Σ créditos.
    // Solo se consideran materias con al menos un corte evaluado.
    let sumaPonderada = 0;
    let sumaCreditos = 0;
    for (const m of materias) {
      if (m.porcentajeEvaluado > 0 && m.creditos > 0) {
        sumaPonderada += m.notaFinal * m.creditos;
        sumaCreditos += m.creditos;
      }
    }

    const promedio =
      sumaCreditos > 0 ? Number((sumaPonderada / sumaCreditos).toFixed(2)) : 0;

    return {
      promedioPonderadoSemestral: promedio,
      totalCreditos: sumaCreditos,
      totalMaterias: materias.length,
      materias,
    };
  }
}
