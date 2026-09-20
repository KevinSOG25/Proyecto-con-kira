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
 * Entrega / tarea asociada a una materia.
 * Puede sincronizarse con Google Calendar (google_event_id).
 */
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'materia_id', type: 'uuid' })
  materiaId: string;

  @ManyToOne(() => Subject, (subject) => subject.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'materia_id' })
  subject: Subject;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ name: 'fecha_limite', type: 'timestamptz' })
  fechaLimite: Date;

  /** ID del evento creado en Google Calendar para poder actualizar/borrar. */
  @Column({ name: 'google_event_id', type: 'varchar', length: 255, nullable: true })
  googleEventId: string;

  @Column({ type: 'boolean', default: false })
  completada: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
