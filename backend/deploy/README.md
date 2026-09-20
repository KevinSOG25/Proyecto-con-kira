# Despliegue de AcademicSync en Google Cloud Run

Guía de contenedorización y despliegue del backend NestJS.

## 1. Ejecutar el contenedor localmente

```bash
cd backend

# Construir la imagen
docker build -t academicsync-backend:local .

# Ejecutar (mapea 8080 y carga tu .env)
docker run --rm -p 8080:8080 --env-file .env academicsync-backend:local
```

La API quedará en `http://localhost:8080`.
Si tu PostgreSQL corre en el host, usa `DB_HOST=host.docker.internal`.

## 2. Requisitos previos en GCP

```bash
gcloud auth login
gcloud config set project TU_PROJECT_ID

# Habilitar servicios necesarios
gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

### (Recomendado) Guardar secretos en Secret Manager

```bash
printf '%s' "TU_GEMINI_API_KEY"        | gcloud secrets create GEMINI_API_KEY --data-file=-
printf '%s' "TU_DB_PASSWORD"           | gcloud secrets create DB_PASSWORD --data-file=-
printf '%s' "TU_GOOGLE_CLIENT_ID"      | gcloud secrets create GOOGLE_CLIENT_ID --data-file=-
printf '%s' "TU_GOOGLE_CLIENT_SECRET"  | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
printf '%s' "https://TU_SERVICIO.run.app/auth/google/callback" \
  | gcloud secrets create GOOGLE_OAUTH_REDIRECT_URI --data-file=-
```

## 3. Despliegue automatizado (script)

```bash
export PROJECT_ID=tu-project-id
export REGION=us-central1
export CLOUD_SQL_INSTANCE=tu-project:us-central1:academicsync-db   # opcional
./deploy/deploy-cloud-run.sh
```

El script construye la imagen con Cloud Build y ejecuta `gcloud run deploy`
con la configuración de costos mínimos acordada.

## 4. Comando `gcloud run deploy` exacto

Con la configuración acordada (min 1 / max 2 instancias, 512Mi, 1 CPU, puerto 8080):

```bash
# 1) Construir la imagen
gcloud builds submit --tag gcr.io/TU_PROJECT_ID/academicsync-backend:latest ./backend

# 2) Desplegar
gcloud run deploy academicsync-backend \
  --image gcr.io/TU_PROJECT_ID/academicsync-backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 \
  --max-instances 2 \
  --memory 512Mi \
  --cpu 1 \
  --add-cloudsql-instances TU_PROJECT_ID:us-central1:academicsync-db \
  --set-env-vars "NODE_ENV=production,DB_HOST=/cloudsql/TU_PROJECT_ID:us-central1:academicsync-db,DB_NAME=academicsync,DB_USERNAME=postgres,GEMINI_MODEL=gemini-1.5-flash,FRONTEND_URL=https://tu-frontend.web.app" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,DB_PASSWORD=DB_PASSWORD:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GOOGLE_OAUTH_REDIRECT_URI=GOOGLE_OAUTH_REDIRECT_URI:latest"
```

> **Sin Cloud SQL:** omite `--add-cloudsql-instances` y usa `DB_HOST`/`DB_PORT`
> apuntando a tu PostgreSQL accesible por red.

## 5. Notas de costos y operación

- **`--min-instances 1`** evita cold starts pero mantiene 1 instancia siempre activa
  (tiene un costo base). Si quieres costo casi cero cuando no se usa, cambia a
  `--min-instances 0` (habrá arranque en frío de ~1-3 s).
- **`--max-instances 2`** limita el gasto ante picos de tráfico.
- **512Mi / 1 CPU** es suficiente para NestJS + llamadas a Gemini/Google APIs.
- **Cloud Scheduler** (fase futura) puede invocar `POST /gmail/scan` periódicamente
  para automatizar la extracción de tareas:
  ```bash
  gcloud scheduler jobs create http academicsync-scan \
    --schedule "0 7 * * *" \
    --uri "https://TU_SERVICIO.run.app/gmail/scan" \
    --http-method POST \
    --oidc-service-account-email TU_SA@TU_PROJECT.iam.gserviceaccount.com
  ```
