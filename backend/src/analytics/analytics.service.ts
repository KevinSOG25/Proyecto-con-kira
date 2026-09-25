import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from '../subjects/entities/subject.entity';
import { Grade } from '../grades/entities/grade.entity';

/** Nota final calculada de una materia. */
export interface SubjectGrade {
  materiaId: string;
  nombre: string;
  codigo: string | null;
  creditos: number;
  /** Nota final (0-5): suma del aporte de los cortes evaluados. */
  notaFinal: number;
  /** % de la materia ya evaluado. */
  porcentajeEvaluado: number;
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

      materias.push({
        materiaId: subject.id,
        nombre: subject.nombre,
        codigo: subject.codigo ?? null,
        creditos: this.toNumber(subject.creditos) ?? 0,
        notaFinal: Number(notaFinal.toFixed(2)),
        porcentajeEvaluado,
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
