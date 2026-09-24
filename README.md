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
- [x] **Fase 3** — Procesamiento con IA (Gemini 1.5 Flash): Gmail + documentos PDF
- [x] **Fase 4** — Dockerfile multietapa y despliegue en Cloud Run
- [x] **Frontend** — Angular + Bootstrap + RxJS (Dashboard de Materias, Tareas/Calendario, Centro de IA, auth Google)

## Frontend (Angular)

App SPA en `/frontend` (Angular standalone + signals, Bootstrap 5, RxJS) que consume la API del backend.

### Vistas
- **Dashboard de Materias** (`/materias`): listado y creación de materias, gestión de cortes y **simulador visual "¿Cuánto necesito para pasar?"**.
- **Tareas y Calendario** (`/tareas`): lista de pendientes, alta de entregas con opción de **sincronizar con Google Calendar** y aviso de vencidas.
- **Centro de IA** (`/ia`): subida de **syllabus** (muestra cortes/porcentajes extraídos) y **diapositivas** (resumen ejecutivo + temas + fechas detectadas).
- **Planeación Semanal** (`/planeacion`): acordeón de 16 semanas con área de notas por semana, con ámbito general o por materia (persistido en `weekly_plans`).
- **Auth Google**: botón "Conectar con Google" en la navbar que inicia el flujo OAuth del backend y refleja el estado de sesión.

### Edición de cortes
En el Dashboard de Materias, cada corte tiene botones **Editar** / **Eliminar**. "Editar" convierte la fila en campos editables (peso % y nota) y guarda con `PATCH /grades/:id` (sin borrar/recrear).

### Planeación Semanal (backend)
Entidad TypeORM `WeeklyPlan` (`weekly_plans`) asociada al usuario (`googleUserId`) y opcionalmente a una materia, con `weekNumber` (1-16) y `content`. Endpoints: `GET /weekly-plans`, `POST /weekly-plans` (upsert por semana), `PUT /weekly-plans/:id`. Incluye migración `CreateWeeklyPlans` para Neon/producción (`npm run migration:run`).

### Puesta en marcha
```bash
cd frontend
pnpm install            # (npm 11.4.2 tiene un bug de resolución; se usa pnpm)
pnpm start              # ng serve -> http://localhost:4200
```
La URL de la API se configura en `src/environments/` (`environment.development.ts` para local → `http://localhost:8080`; `environment.ts` para producción → URL de Cloud Run).

### Build de producción
```bash
cd frontend
pnpm exec ng build --configuration production   # salida en dist/frontend
```

## Despliegue y contenedor (Fase 4)

### Ejecutar localmente con Docker
```bash
cd backend
docker build -t academicsync-backend:local .
docker run --rm -p 8080:8080 --env-file .env academicsync-backend:local
```
La API queda en `http://localhost:8080`. (Si Postgres corre en el host, usa `DB_HOST=host.docker.internal`.)

### Desplegar en Cloud Run
Script automatizado:
```bash
cd backend
export PROJECT_ID=tu-project-id
./deploy/deploy-cloud-run.sh
```

O el comando directo con la configuración de costos mínimos acordada:
```bash
gcloud run deploy academicsync-backend \
  --image gcr.io/TU_PROJECT_ID/academicsync-backend:latest \
  --region us-central1 --platform managed --allow-unauthenticated \
  --port 8080 --min-instances 1 --max-instances 2 --memory 512Mi --cpu 1 \
  --add-cloudsql-instances TU_PROJECT_ID:us-central1:academicsync-db \
  --set-env-vars "NODE_ENV=production,DB_HOST=/cloudsql/TU_PROJECT_ID:us-central1:academicsync-db,DB_NAME=academicsync,DB_USERNAME=postgres,GEMINI_MODEL=gemini-1.5-flash" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,DB_PASSWORD=DB_PASSWORD:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"
```

Detalle completo (Secret Manager, Cloud SQL, Cloud Scheduler): ver [`backend/deploy/README.md`](backend/deploy/README.md).

## Endpoints (Fase 3 — IA con Gemini 1.5 Flash)

> Usa el SDK oficial **`@google/genai`** (el anterior `@google/generative-ai` quedó en EOL en ago-2025).

### Gmail — extracción de tareas desde correos
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/gmail/scan` | Escanea correos recientes por palabras clave y extrae con Gemini `{ titulo, fecha_limite, materia }` por correo |

Body (todos opcionales):
```json
{ "keywords": ["tarea","parcial","brightspace"], "dias": 7, "maxResultados": 10 }
```
Devuelve, por correo, sus metadatos + el objeto extraído (`esTareaAcademica`, `titulo`, `fechaLimite`, `materia`, `confianza`). Requiere sesión de Google activa.

### Documentos — PDFs con Gemini multimodal
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/documents/process?tipo=syllabus` | Extrae materia, evaluaciones (nombre + porcentaje + fecha) y fechas clave |
| POST | `/documents/process?tipo=diapositivas` | Genera resumen ejecutivo, temas principales y detecta fechas ocultas |

`multipart/form-data` con campo **`file`** (PDF, máx. 15 MB). El PDF se envía inline (base64) al modelo multimodal.

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
│   ├── gemini/                     # Cliente de Gemini (@google/genai)
│   ├── gmail/                      # Escaneo de correos + extracción con IA
│   └── documents/                  # PDFs con Gemini multimodal (syllabus/diapositivas)
├── .env.example
├── Dockerfile                      # Multietapa para producción (node:22-alpine, usuario no-root)
├── .dockerignore
├── deploy/
│   ├── deploy-cloud-run.sh         # Script de build + gcloud run deploy
│   └── README.md                   # Guía de despliegue (Secret Manager, Cloud SQL, Scheduler)
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
