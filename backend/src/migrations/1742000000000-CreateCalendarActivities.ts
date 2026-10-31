import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla calendar_activities para el calendario local de AcademicSync.
 * Cada actividad puede además reflejarse en Google Calendar (google_event_id)
 * cuando destino es "google" o "ambos". Es aditiva: no modifica ni borra datos.
 */
export class CreateCalendarActivities1742000000000
  implements MigrationInterface
{
  name = 'CreateCalendarActivities1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_activities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "google_user_id" character varying(255) NOT NULL,
        "titulo" character varying(200) NOT NULL,
        "materia_id" uuid,
        "materia_label" character varying(200),
        "tipo" character varying(30) NOT NULL DEFAULT 'Otro',
        "inicio" TIMESTAMP WITH TIME ZONE NOT NULL,
        "fin" TIMESTAMP WITH TIME ZONE NOT NULL,
        "destino" character varying(10) NOT NULL DEFAULT 'local',
        "google_event_id" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_calendar_activities" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_calendar_activity_user"
        ON "calendar_activities" ("google_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_calendar_activity_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_activities"`);
  }
}
