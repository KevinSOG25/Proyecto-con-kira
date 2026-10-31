import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ciclo de vida multi-semestre. Es aditiva e idempotente:
 *  - Agrega subjects.activo (boolean, default true) sin tocar datos existentes.
 *  - Crea semester_history (snapshot consolidado por periodo).
 *  - Crea approved_courses (persistencia de materias aprobadas por usuario).
 * No crea ningún constraint UNIQUE sobre subjects.codigo: permite re-inscribir
 * el mismo código en un nuevo semestre mientras el anterior quede activo=false.
 */
export class SemesterLifecycle1743000000000 implements MigrationInterface {
  name = 'SemesterLifecycle1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 1) Flag activo en subjects (default true => todo lo existente sigue activo).
    await queryRunner.query(`
      ALTER TABLE "subjects"
        ADD COLUMN IF NOT EXISTS "activo" boolean NOT NULL DEFAULT true
    `);

    // 2) Historial de semestres (snapshot).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "semester_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "google_user_id" character varying(255) NOT NULL,
        "periodo" character varying(20) NOT NULL,
        "fecha_cierre" TIMESTAMP WITH TIME ZONE NOT NULL,
        "promedio_final" numeric(4,2) NOT NULL DEFAULT 0,
        "creditos_cursados" integer NOT NULL DEFAULT 0,
        "creditos_aprobados" integer NOT NULL DEFAULT 0,
        "snapshot_materias" jsonb NOT NULL DEFAULT '[]',
        "snapshot_horario" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_semester_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_semester_history_user_periodo"
        ON "semester_history" ("google_user_id", "periodo")
    `);

    // 3) Materias aprobadas persistidas por usuario.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "approved_courses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "google_user_id" character varying(255) NOT NULL,
        "codigo" character varying(40) NOT NULL,
        "periodo" character varying(20) NOT NULL,
        "nota_final" numeric(4,2),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_approved_courses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_approved_course_user_codigo"
        ON "approved_courses" ("google_user_id", "codigo")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_approved_course_user_codigo"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "approved_courses"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_semester_history_user_periodo"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "semester_history"`);
    await queryRunner.query(
      `ALTER TABLE "subjects" DROP COLUMN IF EXISTS "activo"`,
    );
  }
}
