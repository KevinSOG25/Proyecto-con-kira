import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajusta el valor por defecto de subjects.creditos a 3
 * y normaliza filas antiguas que quedaron en 0 (creadas con el default previo).
 */
export class SubjectCreditsDefault1737500000000 implements MigrationInterface {
  name = 'SubjectCreditsDefault1737500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subjects" ALTER COLUMN "creditos" SET DEFAULT 3`,
    );
    // Filas heredadas con 0 créditos pasan a 3 (default anterior era 0).
    await queryRunner.query(
      `UPDATE "subjects" SET "creditos" = 3 WHERE "creditos" = 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subjects" ALTER COLUMN "creditos" SET DEFAULT 0`,
    );
  }
}
