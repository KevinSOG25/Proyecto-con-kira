import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Materia aprobada registrada en el servidor al cerrar un semestre.
 * Es la fuente de verdad duradera de las materias aprobadas del pensum
 * (antes solo vivían en localStorage del navegador). El frontend sincroniza
 * su estado local con estos registros al cargar el Pensum.
 *
 * Único por (usuario, codigo): aprobar el mismo código de nuevo actualiza la
 * nota/periodo en vez de duplicar (idempotente). Códigos genéricos repetibles
 * (CBU/CLE) simplemente conservan el último aprobado.
 */
@Entity('approved_courses')
@Index('uq_approved_course_user_codigo', ['googleUserId', 'codigo'], {
  unique: true,
})
export class ApprovedCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_user_id', type: 'varchar', length: 255 })
  googleUserId: string;

  @Column({ type: 'varchar', length: 40 })
  codigo: string;

  /** Periodo en que se aprobó. Ej: "2026-2". */
  @Column({ type: 'varchar', length: 20 })
  periodo: string;

  @Column({
    name: 'nota_final',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  notaFinal: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
