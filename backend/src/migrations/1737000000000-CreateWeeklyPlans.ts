import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla weekly_plans para la funcionalidad de Planeación Semanal.
 * Se ejecuta con: npm run migration:run
 */
export class CreateWeeklyPlans1737000000000 implements MigrationInterface {
  name = 'CreateWeeklyPlans1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "weekly_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "google_user_id" character varying(255) NOT NULL,
        "materia_id" uuid,
        "week_number" integer NOT NULL,
        "content" text NOT NULL DEFAULT '',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_weekly_plans" PRIMARY KEY ("id"),
        CONSTRAINT "uq_weekly_plan_user_subject_week" UNIQUE ("google_user_id", "materia_id", "week_number"),
        CONSTRAINT "fk_weekly_plan_subject" FOREIGN KEY ("materia_id")
          REFERENCES "subjects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_weekly_plan_user" ON "weekly_plans" ("google_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_weekly_plan_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "weekly_plans"`);
  }
}
