import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Construye las opciones de conexión de TypeORM a partir de variables de entorno.
 * Soporta conexión por host/puerto (desarrollo) y por socket de Cloud SQL
 * cuando DB_HOST empieza por "/cloudsql/" (Cloud Run).
 */
export const buildTypeOrmOptions = (
  config: ConfigService,
): TypeOrmModuleOptions => {
  const host = config.get<string>('DB_HOST', 'localhost');
  const isCloudSqlSocket = host.startsWith('/cloudsql/');

  return {
    type: 'postgres',
    host,
    port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
    username: config.get<string>('DB_USERNAME'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_NAME'),
    // En Cloud SQL por socket no se usa TCP port.
    extra: isCloudSqlSocket ? { socketPath: host } : undefined,
    autoLoadEntities: true,
    synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
    logging: config.get<string>('NODE_ENV') === 'development',
  };
};
