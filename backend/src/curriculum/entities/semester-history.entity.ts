import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Nota final consolidada de una materia dentro del snapshot. */
export interface SnapshotMateria {
  materiaId: string;
  codigo: string | null;
  nombre: string;
  creditos: number;
  notaFinal: number;
  aprobada: boolean;
  evaluaciones: {
    nombreCorte: string;
    porcentaje: number;
    calificacionObtenida: number | null;
  }[];
}

/** Bloque de clase dentro del snapshot del horario. */
export interface SnapshotBloqueHorario {
  materia: string;
  codigo: string | null;
  tipo: string;
  inicio: string;
  fin: string;
}

/**
 * Registro histórico (snapshot inmutable) de un semestre cerrado.
 * Al cerrar un periodo se consolida aquí el promedio final, los créditos y
 * un snapshot JSONB de materias y horario, de modo que el detalle del
 * semestre quede preservado aunque las materias activas se archiven.
 */
@Entity('semester_history')
@Index('uq_semester_history_user_periodo', ['googleUserId', 'periodo'], {
  unique: true,
})
export class SemesterHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_user_id', type: 'varchar', length: 255 })
  googleUserId: string;

  /** Periodo académico cerrado. Ej: "2026-2". */
  @Column({ type: 'varchar', length: 20 })
  periodo: string;

  @Column({ name: 'fecha_cierre', type: 'timestamptz' })
  fechaCierre: Date;

  /** Promedio ponderado por créditos del semestre (0-5). */
  @Column({
    name: 'promedio_final',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: 0,
  })
  promedioFinal: number;

  @Column({ name: 'creditos_cursados', type: 'int', default: 0 })
  creditosCursados: number;

  @Column({ name: 'creditos_aprobados', type: 'int', default: 0 })
  creditosAprobados: number;

  /** Snapshot consolidado de materias con notas finales y evaluaciones. */
  @Column({ name: 'snapshot_materias', type: 'jsonb', default: () => "'[]'" })
  snapshotMaterias: SnapshotMateria[];

  /** Snapshot de la grilla de clases del periodo. */
  @Column({ name: 'snapshot_horario', type: 'jsonb', default: () => "'[]'" })
  snapshotHorario: SnapshotBloqueHorario[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
