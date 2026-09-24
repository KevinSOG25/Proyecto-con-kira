import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Subject } from '../../subjects/entities/subject.entity';

/**
 * Planeación de una semana académica (1-16).
 * Se asocia al usuario autenticado (googleUserId) y, opcionalmente, a una materia.
 * Restricción única por (usuario, materia, semana) para evitar duplicados.
 */
@Entity('weekly_plans')
@Unique('uq_weekly_plan_user_subject_week', [
  'googleUserId',
  'materiaId',
  'weekNumber',
])
@Index('idx_weekly_plan_user', ['googleUserId'])
export class WeeklyPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID de la cuenta de Google del usuario (dueño de la planeación). */
  @Column({ name: 'google_user_id', type: 'varchar', length: 255 })
  googleUserId: string;

  /** Materia asociada (opcional). null = planeación general del semestre. */
  @Column({ name: 'materia_id', type: 'uuid', nullable: true })
  materiaId: string | null;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'materia_id' })
  subject?: Subject | null;

  /** Número de semana en el rango 1-16. */
  @Column({ name: 'week_number', type: 'int' })
  weekNumber: number;

  /** Contenido de la planeación/notas de la semana. */
  @Column({ type: 'text', default: '' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
