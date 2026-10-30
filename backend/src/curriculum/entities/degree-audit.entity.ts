import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Registro del cumplimiento de requisitos transversales de grado, ligado al
 * usuario autenticado (googleUserId). En esta app monousuario habrá una fila.
 * Guarda estados que no dependen de una nota numérica regular.
 */
@Entity('degree_audit')
export class DegreeAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_user_id', type: 'varchar', length: 255, unique: true })
  googleUserId: string;

  /** Requisito de Lectura en Inglés (RLEC). */
  @Column({ name: 'rlec_aprobado', type: 'boolean', default: false })
  rlecAprobado: boolean;

  /** Requisito de Idiomas (RIDI). */
  @Column({ name: 'ridi_aprobado', type: 'boolean', default: false })
  ridiAprobado: boolean;

  /** Código de la materia que homologa el Curso Tipo E 1 (null = no asignado). */
  @Column({ name: 'curso_tipo_e1', type: 'varchar', length: 40, nullable: true })
  cursoTipoE1: string | null;

  /** Código de la materia que homologa el Curso Tipo E 2. */
  @Column({ name: 'curso_tipo_e2', type: 'varchar', length: 40, nullable: true })
  cursoTipoE2: string | null;

  /** Código de la materia que cumple el requisito Ética / Tipo Épsilon. */
  @Column({ name: 'curso_tipo_epsilon', type: 'varchar', length: 40, nullable: true })
  cursoTipoEpsilon: string | null;

  /** Cumplimiento del requisito de internacionalización. */
  @Column({ name: 'internacionalizacion', type: 'boolean', default: false })
  internacionalizacion: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
