import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Área académica de la materia (define su color de acento). */
export type CurriculumArea =
  | 'Proyectos'
  | 'Ciencias de la Computación'
  | 'Programación y Software'
  | 'Infraestructura'
  | 'Negocios Digitales'
  | 'Datos'
  | 'Inteligencia Artificial'
  | 'Complemento de Ingeniería'
  | 'Fundamentos'
  | 'Electivas';

/**
 * Materia de la malla curricular (pensum) de Ingeniería de Sistemas.
 * Es un catálogo editable precargado por seed. El estado del estudiante
 * (pendiente/en curso/aprobada) se gestiona en el frontend y no rompe
 * el cruce automático con las materias matriculadas (Subjects).
 */
@Entity('curriculum_items')
@Index('idx_curriculum_semestre', ['semestre'])
export class CurriculumItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código único de la materia. Ej: "ISIS-1225". */
  @Column({ type: 'varchar', length: 40, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'int', default: 0 })
  creditos: number;

  /** Semestre 1-8. */
  @Column({ type: 'int' })
  semestre: number;

  @Column({ type: 'varchar', length: 60 })
  area: string;

  /**
   * Prerrequisitos como arreglo de strings. Cada entrada puede ser un código
   * simple ("ISIS-1225") o una alternativa ("ISIS-1511 o ISIS-2304").
   */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  prerrequisitos: string[];

  /** Orden dentro del semestre (para mantener el layout del seed). */
  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
