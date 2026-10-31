import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ActivityType =
  | 'Parcial'
  | 'Quiz'
  | 'Entrega'
  | 'Laboratorio'
  | 'Estudio'
  | 'Otro';

/** Dónde se guardó la actividad. */
export type ActivityDestino = 'local' | 'google' | 'ambos';

/**
 * Actividad del calendario local de AcademicSync (persistida en BD).
 * Puede además reflejarse en Google Calendar (googleEventId) cuando el
 * destino es "google" o "ambos".
 */
@Entity('calendar_activities')
@Index('idx_calendar_activity_user', ['googleUserId'])
export class CalendarActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_user_id', type: 'varchar', length: 255 })
  googleUserId: string;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  /** Id de la materia asociada (null = General / Personal). */
  @Column({ name: 'materia_id', type: 'uuid', nullable: true })
  materiaId: string | null;

  /** Etiqueta de materia mostrada (código/nombre) para el color. */
  @Column({ name: 'materia_label', type: 'varchar', length: 200, nullable: true })
  materiaLabel: string | null;

  @Column({ type: 'varchar', length: 30, default: 'Otro' })
  tipo: string;

  /** Inicio y fin (timestamptz). */
  @Column({ name: 'inicio', type: 'timestamptz' })
  inicio: Date;

  @Column({ name: 'fin', type: 'timestamptz' })
  fin: Date;

  @Column({ type: 'varchar', length: 10, default: 'local' })
  destino: string;

  /** Id del evento en Google Calendar si se replicó allí. */
  @Column({ name: 'google_event_id', type: 'varchar', length: 255, nullable: true })
  googleEventId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
