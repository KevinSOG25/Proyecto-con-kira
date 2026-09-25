import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade la columna "temas" (text[]) a la tabla grades para almacenar
 * los temas específicos que se evalúan en cada corte.
 */
export class AddTemasToGrades1738000000000 implements MigrationInterface {
  name = 'AddTemasToGrades1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "temas" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grades" DROP COLUMN IF EXISTS "temas"`);
  }
}
