import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Construye las opciones de conexión de TypeORM a partir de variables de entorno.
 * Prioridad:
 *  1. DATABASE_URL (Neon / proveedores gestionados) — con SSL habilitado.
 *  2. Socket de Cloud SQL (DB_HOST empieza por "/cloudsql/").
 *  3. host/puerto clásico (desarrollo local).
 */
export const buildTypeOrmOptions = (
  config: ConfigService,
): TypeOrmModuleOptions => {
  const synchronize = config.get<string>('DB_SYNCHRONIZE', 'false') === 'true';
  const logging = config.get<string>('NODE_ENV') === 'development';

  const databaseUrl = config.get<string>('DATABASE_URL');

  // --- 1) Conexión por URL (Neon y similares) ---
  if (databaseUrl) {
    // Neon exige SSL; sin esto rechaza con "insecure connection (try using sslmode=require)".
    return {
      type: 'postgres',
      url: databaseUrl,
      autoLoadEntities: true,
      synchronize,
      logging,
      ssl: { rejectUnauthorized: false },
      extra: { ssl: { rejectUnauthorized: false } },
    };
  }

  // --- 2) / 3) Conexión por host (socket Cloud SQL o TCP) ---
  const host = config.get<string>('DB_HOST', 'localhost');
  const isCloudSqlSocket = host.startsWith('/cloudsql/');
  // SSL opcional por host (p. ej. Neon vía host directo): DB_SSL=true.
  const useSsl = config.get<string>('DB_SSL', 'false') === 'true';

  return {
    type: 'postgres',
    host,
    port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
    username: config.get<string>('DB_USERNAME'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_NAME'),
    // En Cloud SQL por socket no se usa TCP port.
    extra: isCloudSqlSocket
      ? { socketPath: host }
      : useSsl
        ? { ssl: { rejectUnauthorized: false } }
        : undefined,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    autoLoadEntities: true,
    synchronize,
    logging,
  };
};
