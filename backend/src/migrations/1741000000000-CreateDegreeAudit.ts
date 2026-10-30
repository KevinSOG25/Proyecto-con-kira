import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla degree_audit para registrar los requisitos transversales de
 * grado del usuario (RLEC, RIDI, Cursos Tipo E, Épsilon, internacionalización).
 * Es aditiva: no modifica ni borra datos existentes.
 */
export class CreateDegreeAudit1741000000000 implements MigrationInterface {
  name = 'CreateDegreeAudit1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "degree_audit" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "google_user_id" character varying(255) NOT NULL,
        "rlec_aprobado" boolean NOT NULL DEFAULT false,
        "ridi_aprobado" boolean NOT NULL DEFAULT false,
        "curso_tipo_e1" character varying(40),
        "curso_tipo_e2" character varying(40),
        "curso_tipo_epsilon" character varying(40),
        "internacionalizacion" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_degree_audit" PRIMARY KEY ("id"),
        CONSTRAINT "uq_degree_audit_user" UNIQUE ("google_user_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "degree_audit"`);
  }
}
