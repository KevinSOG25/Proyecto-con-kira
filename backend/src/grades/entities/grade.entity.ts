import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Subject } from '../../subjects/entities/subject.entity';

/**
 * Corte de calificación de una materia.
 * El porcentaje indica el peso del corte sobre la nota final.
 * calificacionObtenida es null mientras el corte no se haya evaluado.
 */
@Entity('grades')
export class Grade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'materia_id', type: 'uuid' })
  materiaId: string;

  @ManyToOne(() => Subject, (subject) => subject.grades, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'materia_id' })
  subject: Subject;

  /** Nombre del corte. Ej: "Primer parcial", "Proyecto final". */
  @Column({ name: 'nombre_corte', type: 'varchar', length: 150 })
  nombreCorte: string;

  /** Peso del corte sobre la nota final (0-100). */
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  porcentaje: number;

  /** Nota obtenida en el corte. null si aún no se evalúa. */
  @Column({
    name: 'calificacion_obtenida',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  calificacionObtenida: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
