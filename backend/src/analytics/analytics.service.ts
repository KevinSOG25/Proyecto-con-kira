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

/** Nivel de prioridad de un corte en la Matriz de Retorno de Esfuerzo. */
export type PriorityLevel = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';

/** Ítem de la Matriz de Retorno de Esfuerzo (corte pendiente priorizado). */
export interface EffortMatrixItem {
  corteId: string;
  materiaId: string;
  materiaNombre: string;
  codigo: string | null;
  nombreCorte: string;
  porcentaje: number;
  creditos: number;
  fecha: string | null;
  diasRestantes: number | null;
  riskLevel: RiskLevel;
  /** Aporte máximo al promedio semestral si saca 5.0 en este corte. */
  impactoMaximoPromedio: number;
  /** Cuánto suma al promedio semestral cada 0.1 adicional en este corte. */
  sensibilidadDecima: number;
  /** Score interno de apalancamiento (para ordenar). */
  scorePrioridad: number;
  nivelPrioridad: PriorityLevel;
  motivo: string;
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
  /** Total de créditos matriculados (todas las materias, denominador del PGA). */
  totalCreditosMatriculados: number;
  totalMaterias: number;
  materias: SubjectGrade[];
  proximasEvaluaciones: UpcomingEvaluation[];
  /** Matriz de retorno de esfuerzo: cortes pendientes ordenados por apalancamiento. */
  effortMatrix: EffortMatrixItem[];
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

    // Total de créditos matriculados = todas las materias (denominador del PGA).
    const totalCreditosMatriculados = subjects.reduce(
      (acc, s) => acc + (this.toNumber(s.creditos) ?? 0),
      0,
    );

    // Cortes pendientes (sin nota) para construir la matriz de esfuerzo.
    interface PendingCut {
      grade: Grade;
      subject: Subject;
      riskLevel: RiskLevel;
    }
    const pendingCuts: PendingCut[] = [];

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

      // Acumula cortes sin calificar de esta materia para la matriz.
      for (const g of grades) {
        if (this.toNumber(g.calificacionObtenida) === null) {
          pendingCuts.push({ grade: g, subject, riskLevel });
        }
      }
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

    proximasEvaluaciones.sort((a, b) => a.diasRestantes - b.diasRestantes);

    const effortMatrix = this.buildEffortMatrix(
      pendingCuts,
      totalCreditosMatriculados,
    );

    return {
      promedioPonderadoActual,
      promedioAcumuladoNeto,
      promedioPonderadoSemestral: promedioAcumuladoNeto, // alias retrocompatible
      totalCreditos: sumaCreditos,
      totalCreditosMatriculados,
      totalMaterias: materias.length,
      materias,
      proximasEvaluaciones,
      effortMatrix,
    };
  }

  /**
   * Construye la Matriz de Retorno de Esfuerzo: para cada corte pendiente
   * calcula su impacto marginal sobre el Promedio Ponderado Semestral y un
   * score de apalancamiento que combina impacto, urgencia y riesgo.
   */
  private buildEffortMatrix(
    pendingCuts: {
      grade: Grade;
      subject: Subject;
      riskLevel: RiskLevel;
    }[],
    totalCreditosMatriculados: number,
  ): EffortMatrixItem[] {
    if (totalCreditosMatriculados <= 0) return [];

    const items: EffortMatrixItem[] = pendingCuts.map(
      ({ grade, subject, riskLevel }) => {
        const creditos = this.toNumber(subject.creditos) ?? 0;
        const peso = this.toNumber(grade.porcentaje) ?? 0;

        // Aporte máximo al promedio semestral si obtiene 5.0 en este corte.
        const impactoMaximoPromedio =
          (creditos * (peso / 100) * 5.0) / totalCreditosMatriculados;
        // Sensibilidad: cuánto suma cada 0.1 adicional de nota.
        const sensibilidadDecima =
          (creditos * (peso / 100) * 0.1) / totalCreditosMatriculados;

        const diasRestantes = grade.fecha ? this.diffDays(grade.fecha) : null;

        // --- Score de apalancamiento ---
        // 1) Impacto (normalizado): el propio impacto máximo es la base.
        const impactoScore = impactoMaximoPromedio;

        // 2) Urgencia temporal: fechas próximas valen más. Sin fecha => neutro.
        let urgenciaMult = 1;
        if (diasRestantes !== null) {
          if (diasRestantes <= 2) urgenciaMult = 2.0;
          else if (diasRestantes <= 5) urgenciaMult = 1.6;
          else if (diasRestantes <= 10) urgenciaMult = 1.3;
          else if (diasRestantes <= 20) urgenciaMult = 1.1;
          else urgenciaMult = 1.0;
        }

        // 3) Riesgo de la materia: DANGER/WARNING incrementan prioridad.
        let riesgoMult = 1;
        if (riskLevel === 'DANGER') riesgoMult = 1.8;
        else if (riskLevel === 'WARNING') riesgoMult = 1.35;

        const scorePrioridad = impactoScore * urgenciaMult * riesgoMult;

        return {
          corteId: grade.id,
          materiaId: subject.id,
          materiaNombre: subject.nombre,
          codigo: subject.codigo ?? null,
          nombreCorte: grade.nombreCorte,
          porcentaje: peso,
          creditos,
          fecha: grade.fecha ?? null,
          diasRestantes,
          riskLevel,
          impactoMaximoPromedio: Number(impactoMaximoPromedio.toFixed(4)),
          sensibilidadDecima: Number(sensibilidadDecima.toFixed(4)),
          scorePrioridad: Number(scorePrioridad.toFixed(6)),
          nivelPrioridad: 'BAJA',
          motivo: '',
        };
      },
    );

    // Ordenar de mayor a menor apalancamiento.
    items.sort((a, b) => b.scorePrioridad - a.scorePrioridad);

    // Clasificar niveles por cuartiles del score + razones legibles.
    const maxScore = items.length ? items[0].scorePrioridad : 0;
    for (const it of items) {
      const ratio = maxScore > 0 ? it.scorePrioridad / maxScore : 0;
      if (ratio >= 0.75) it.nivelPrioridad = 'CRITICA';
      else if (ratio >= 0.5) it.nivelPrioridad = 'ALTA';
      else if (ratio >= 0.25) it.nivelPrioridad = 'MEDIA';
      else it.nivelPrioridad = 'BAJA';

      it.motivo = this.motivoPrioridad(it);
    }

    return items;
  }

  /** Genera una razón legible del nivel de prioridad. */
  private motivoPrioridad(it: EffortMatrixItem): string {
    const partes: string[] = [];
    partes.push(
      `Vale hasta +${it.impactoMaximoPromedio.toFixed(2)} pts del promedio`,
    );
    if (it.riskLevel === 'DANGER') partes.push('materia en riesgo alto');
    else if (it.riskLevel === 'WARNING') partes.push('materia en riesgo medio');
    if (it.diasRestantes !== null) {
      if (it.diasRestantes <= 2) partes.push('examen inminente');
      else if (it.diasRestantes <= 5) partes.push('fecha próxima');
    }
    return partes.join(' · ');
  }
}
