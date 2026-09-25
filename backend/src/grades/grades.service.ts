import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from './entities/grade.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

/** Escala de calificación (configurable a futuro). */
const NOTA_MAXIMA = 5.0;
const NOTA_MINIMA = 0.0;
const APROBATORIA = 3.0;

export interface SimulationResult {
  materiaId: string;
  objetivo: number;
  /** Suma de porcentajes de cortes ya calificados. */
  porcentajeEvaluado: number;
  /** Suma de porcentajes de cortes pendientes. */
  porcentajeRestante: number;
  /** Aporte acumulado a la nota final de los cortes ya calificados. */
  aporteActual: number;
  /**
   * Promedio ponderado *sobre lo evaluado* (nota proyectada si el resto
   * valiera lo mismo que lo ya obtenido). null si no hay cortes evaluados.
   */
  promedioParcial: number | null;
  /** Nota mínima (0-5) requerida en cada punto del % restante para lograr el objetivo. */
  notaRequerida: number | null;
  /** Clasificación del escenario para el frontend. */
  estado:
    | 'OBJETIVO_YA_ASEGURADO'
    | 'ALCANZABLE'
    | 'IMPOSIBLE'
    | 'SIN_CORTES_PENDIENTES'
    | 'SIN_CORTES';
  mensaje: string;
}

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
  ) {}

  private toNumber(value: number | string | null): number | null {
    // TypeORM devuelve decimales como string.
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? parseFloat(value) : value;
  }

  async create(dto: CreateGradeDto): Promise<Grade> {
    const subject = await this.subjectsRepo.findOne({
      where: { id: dto.materiaId },
    });
    if (!subject) {
      throw new NotFoundException(`No existe la materia ${dto.materiaId}.`);
    }
    const grade = this.gradesRepo.create({
      materiaId: dto.materiaId,
      nombreCorte: dto.nombreCorte,
      porcentaje: dto.porcentaje,
      calificacionObtenida: dto.calificacionObtenida ?? null,
      temas: dto.temas ?? [],
    });
    return this.gradesRepo.save(grade);
  }

  findBySubject(materiaId: string): Promise<Grade[]> {
    return this.gradesRepo.find({
      where: { materiaId },
      order: { createdAt: 'ASC' },
    });
  }

  async update(id: string, dto: UpdateGradeDto): Promise<Grade> {
    const grade = await this.gradesRepo.findOne({ where: { id } });
    if (!grade) throw new NotFoundException(`No existe el corte ${id}.`);
    Object.assign(grade, dto);
    return this.gradesRepo.save(grade);
  }

  async remove(id: string): Promise<void> {
    const result = await this.gradesRepo.delete(id);
    if (!result.affected) throw new NotFoundException(`No existe el corte ${id}.`);
  }

  /**
   * Promedio ponderado ACTUAL: aporte real de los cortes calificados a la
   * nota final (en escala 0-5). Solo considera lo ya evaluado.
   */
  async calcularPromedioPonderado(materiaId: string): Promise<number> {
    const grades = await this.findBySubject(materiaId);
    let aporte = 0;
    for (const g of grades) {
      const nota = this.toNumber(g.calificacionObtenida);
      const peso = this.toNumber(g.porcentaje) ?? 0;
      if (nota !== null) {
        aporte += nota * (peso / 100);
      }
    }
    return Number(aporte.toFixed(4));
  }

  /**
   * Simula la nota mínima necesaria en el porcentaje restante para
   * alcanzar el objetivo indicado (por defecto la aprobatoria 3.0).
   *
   * Modelo: nota_final = aporteActual + notaRequerida * (%restante / 100)
   *   => notaRequerida = (objetivo - aporteActual) / (%restante / 100)
   */
  async simular(
    materiaId: string,
    objetivo: number = APROBATORIA,
  ): Promise<SimulationResult> {
    const subject = await this.subjectsRepo.findOne({
      where: { id: materiaId },
    });
    if (!subject) {
      throw new NotFoundException(`No existe la materia ${materiaId}.`);
    }

    const grades = await this.findBySubject(materiaId);

    if (grades.length === 0) {
      return {
        materiaId,
        objetivo,
        porcentajeEvaluado: 0,
        porcentajeRestante: 0,
        aporteActual: 0,
        promedioParcial: null,
        notaRequerida: null,
        estado: 'SIN_CORTES',
        mensaje: 'La materia no tiene cortes definidos.',
      };
    }

    const totalPorcentaje = grades.reduce(
      (acc, g) => acc + (this.toNumber(g.porcentaje) ?? 0),
      0,
    );
    if (Math.abs(totalPorcentaje - 100) > 0.01) {
      throw new BadRequestException(
        `Los porcentajes de los cortes suman ${totalPorcentaje}%, deben sumar 100%.`,
      );
    }

    let aporteActual = 0;
    let porcentajeEvaluado = 0;
    let porcentajeRestante = 0;

    for (const g of grades) {
      const peso = this.toNumber(g.porcentaje) ?? 0;
      const nota = this.toNumber(g.calificacionObtenida);
      if (nota !== null) {
        aporteActual += nota * (peso / 100);
        porcentajeEvaluado += peso;
      } else {
        porcentajeRestante += peso;
      }
    }

    aporteActual = Number(aporteActual.toFixed(4));
    const promedioParcial =
      porcentajeEvaluado > 0
        ? Number((aporteActual / (porcentajeEvaluado / 100)).toFixed(2))
        : null;

    // No quedan cortes pendientes: la nota ya está definida.
    if (porcentajeRestante === 0) {
      const estado =
        aporteActual >= objetivo ? 'OBJETIVO_YA_ASEGURADO' : 'IMPOSIBLE';
      return {
        materiaId,
        objetivo,
        porcentajeEvaluado,
        porcentajeRestante,
        aporteActual,
        promedioParcial,
        notaRequerida: null,
        estado,
        mensaje:
          estado === 'OBJETIVO_YA_ASEGURADO'
            ? `Todos los cortes están evaluados. Nota final: ${aporteActual.toFixed(2)}. Objetivo alcanzado.`
            : `Todos los cortes están evaluados. Nota final: ${aporteActual.toFixed(2)}. Ya no es posible alcanzar ${objetivo}.`,
      };
    }

    const notaRequeridaRaw =
      (objetivo - aporteActual) / (porcentajeRestante / 100);
    const notaRequerida = Number(notaRequeridaRaw.toFixed(2));

    // Objetivo ya asegurado aunque saques 0 en lo que falta.
    if (notaRequeridaRaw <= NOTA_MINIMA) {
      return {
        materiaId,
        objetivo,
        porcentajeEvaluado,
        porcentajeRestante,
        aporteActual,
        promedioParcial,
        notaRequerida: NOTA_MINIMA,
        estado: 'OBJETIVO_YA_ASEGURADO',
        mensaje: `Ya aseguraste el objetivo de ${objetivo}: con 0.0 en el ${porcentajeRestante}% restante lo mantienes.`,
      };
    }

    // Imposible: ni con la nota máxima en lo restante se llega.
    if (notaRequeridaRaw > NOTA_MAXIMA) {
      return {
        materiaId,
        objetivo,
        porcentajeEvaluado,
        porcentajeRestante,
        aporteActual,
        promedioParcial,
        notaRequerida,
        estado: 'IMPOSIBLE',
        mensaje: `Necesitarías ${notaRequerida} en el ${porcentajeRestante}% restante, pero la nota máxima es ${NOTA_MAXIMA}. El objetivo ${objetivo} ya no es alcanzable.`,
      };
    }

    return {
      materiaId,
      objetivo,
      porcentajeEvaluado,
      porcentajeRestante,
      aporteActual,
      promedioParcial,
      notaRequerida,
      estado: 'ALCANZABLE',
      mensaje: `Necesitas al menos ${notaRequerida} (de ${NOTA_MAXIMA}) en el ${porcentajeRestante}% restante para alcanzar ${objetivo}.`,
    };
  }
}
