import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade la columna "fecha" (date, nullable) a la tabla grades para registrar
 * la fecha programada de cada corte (usada en "Próximas Evaluaciones").
 */
export class AddFechaToGrades1739000000000 implements MigrationInterface {
  name = 'AddFechaToGrades1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "fecha" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grades" DROP COLUMN IF EXISTS "fecha"`);
  }
}
