import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { Subject } from '../subjects/entities/subject.entity';
import { Task } from '../tasks/entities/task.entity';
import { Grade } from '../grades/entities/grade.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';

loadEnv();

/**
 * DataSource usado por la CLI de TypeORM para generar y correr migraciones.
 * La conexión en runtime de Nest se configura en AppModule con TypeOrmModule.
 */
const host = process.env.DB_HOST ?? 'localhost';
const isCloudSqlSocket = host.startsWith('/cloudsql/');

export default new DataSource({
  type: 'postgres',
  host,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  extra: isCloudSqlSocket ? { socketPath: host } : undefined,
  entities: [Subject, Task, Grade, UserTokens],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
