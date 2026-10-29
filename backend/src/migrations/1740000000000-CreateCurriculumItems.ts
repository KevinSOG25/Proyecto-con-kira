import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla curriculum_items para la malla curricular (pensum).
 * El seed de datos se ejecuta automáticamente al arrancar si la tabla
 * está vacía (CurriculumService.onModuleInit).
 */
export class CreateCurriculumItems1740000000000 implements MigrationInterface {
  name = 'CreateCurriculumItems1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "curriculum_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "codigo" character varying(40) NOT NULL,
        "nombre" character varying(200) NOT NULL,
        "creditos" integer NOT NULL DEFAULT 0,
        "semestre" integer NOT NULL,
        "area" character varying(60) NOT NULL,
        "prerrequisitos" text[] NOT NULL DEFAULT '{}',
        "orden" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_curriculum_items" PRIMARY KEY ("id"),
        CONSTRAINT "uq_curriculum_codigo" UNIQUE ("codigo")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_curriculum_semestre" ON "curriculum_items" ("semestre")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_curriculum_semestre"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "curriculum_items"`);
  }
}
