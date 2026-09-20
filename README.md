# AcademicSync

Aplicación de gestión académica personal con IA, optimizada para Google Cloud Run.

- **Backend:** NestJS + TypeScript + TypeORM
- **Base de datos:** PostgreSQL
- **Frontend:** Angular + RxJS + Bootstrap *(fase posterior)*
- **IA:** Gemini 1.5 Flash (multimodal)
- **Integraciones:** Google OAuth 2.0, Google Calendar API, Gmail API
- **Infraestructura:** Docker + Cloud Run + Cloud Scheduler

## Estado del proyecto

- [x] **Fase 1** — Entidades TypeORM y base de autenticación
- [x] **Fase 2** — OAuth 2.0 + lógica académica + integración Google Calendar
- [ ] **Fase 3** — Procesamiento con IA (Gmail + documentos)
- [ ] **Fase 4** — Dockerfile y despliegue en Cloud Run

## Endpoints (Fase 2)

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/auth/google` | Redirige al consentimiento de Google (scopes Calendar + Gmail read-only) |
| GET | `/auth/google/callback` | Callback OAuth; persiste tokens y redirige al frontend |

### Materias
`POST /subjects` · `GET /subjects` · `GET /subjects/:id` · `PATCH /subjects/:id` · `DELETE /subjects/:id`

### Calificaciones y simulación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/grades` | Crea un corte de una materia |
| GET | `/grades/subject/:materiaId` | Lista los cortes de la materia |
| GET | `/grades/subject/:materiaId/average` | Promedio ponderado actual |
| GET | `/grades/subject/:materiaId/simulate?objetivo=4.0` | Nota mínima requerida para el objetivo |
| PATCH | `/grades/:id` · DELETE `/grades/:id` | Actualiza / elimina un corte |

### Tareas (con sincronización a Google Calendar)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/tasks` | Crea la tarea e inserta evento en Calendar (guarda `googleEventId`) |
| GET | `/tasks/subject/:materiaId` | Lista tareas de la materia |
| PATCH | `/tasks/:id` | Actualiza la tarea y su evento de Calendar |
| DELETE | `/tasks/:id` | Elimina la tarea y su evento de Calendar |

> La creación de tarea acepta `"sincronizarCalendar": false` para omitir el evento.

## Estructura sugerida del backend

```
backend/
├── src/
│   ├── main.ts                     # Bootstrap (puerto 8080 para Cloud Run)
│   ├── app.module.ts               # Módulo raíz (config + TypeORM)
│   ├── config/
│   │   ├── typeorm.config.ts       # Opciones de conexión (host o socket Cloud SQL)
│   │   └── data-source.ts          # DataSource para migraciones (CLI TypeORM)
│   ├── subjects/                   # Módulo Materias
│   │   └── entities/subject.entity.ts
│   ├── tasks/                      # Módulo Entregas
│   │   └── entities/task.entity.ts
│   ├── grades/                     # Módulo Calificaciones
│   │   └── entities/grade.entity.ts
│   ├── auth/                       # OAuth 2.0 de Google
│   │   ├── entities/user-tokens.entity.ts
│   │   ├── google-auth.client.ts   # OAuth2Client + refresh automático
│   │   ├── auth.service.ts · auth.controller.ts · auth.module.ts
│   ├── calendar/                   # Google Calendar (CalendarService)
│   ├── gmail/                      # (Fase 3) Procesamiento de correos
│   ├── documents/                  # (Fase 3) PDFs con Gemini multimodal
│   └── gemini/                     # (Fase 3) Cliente de Gemini
├── .env.example
├── Dockerfile                      # (Fase 4) multietapa para producción
├── nest-cli.json
├── tsconfig.json
└── package.json
```

## Entidades (Fase 1)

| Entidad      | Campos principales                                                        |
| ------------ | ------------------------------------------------------------------------- |
| `Subject`    | id, nombre, codigo, creditos, semestre                                    |
| `Task`       | id, materia_id, titulo, descripcion, fecha_limite, google_event_id        |
| `Grade`      | id, materia_id, nombre_corte, porcentaje, calificacion_obtenida           |
| `UserTokens` | id, access_token, refresh_token, scope, expiry_date                       |

## Puesta en marcha (desarrollo)

```bash
cd backend
cp .env.example .env      # completar credenciales
npm install
npm run start:dev
```

Con `DB_SYNCHRONIZE=true` TypeORM crea las tablas automáticamente en desarrollo.
En producción se recomienda usar migraciones (`npm run migration:generate` / `migration:run`).
