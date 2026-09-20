import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';
import { Grade } from '../../grades/entities/grade.entity';

/**
 * Materia académica que el usuario está cursando.
 */
@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codigo: string;

  @Column({ type: 'int', default: 0 })
  creditos: number;

  /** Semestre al que pertenece la materia. Ej: "2026-1" */
  @Column({ type: 'varchar', length: 20, nullable: true })
  semestre: string;

  @OneToMany(() => Task, (task) => task.subject, { cascade: true })
  tasks: Task[];

  @OneToMany(() => Grade, (grade) => grade.subject, { cascade: true })
  grades: Grade[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
