#!/usr/bin/env bash
# ============================================================
# AcademicSync — Despliegue a Google Cloud Run
# ------------------------------------------------------------
# Construye la imagen con Cloud Build y la despliega en Cloud Run
# con la configuración de costos mínimos acordada:
#   --min-instances 1  --max-instances 2  --memory 512Mi  --cpu 1  --port 8080
#
# Uso:
#   export PROJECT_ID=mi-proyecto
#   export GEMINI_API_KEY=...        # o usar Secret Manager (ver más abajo)
#   ./deploy-cloud-run.sh
# ============================================================
set -euo pipefail

# ---------- Parámetros (ajustables por variables de entorno) ----------
PROJECT_ID="${PROJECT_ID:?Debes exportar PROJECT_ID}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-academicsync-backend}"
IMAGE="${IMAGE:-gcr.io/${PROJECT_ID}/${SERVICE}:latest}"

# Conexión a Cloud SQL (opcional). Formato: PROJECT:REGION:INSTANCE
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-}"

# ---------- 1. Construir la imagen con Cloud Build ----------
echo ">> Construyendo imagen ${IMAGE} ..."
gcloud builds submit --project "${PROJECT_ID}" --tag "${IMAGE}" .

# ---------- 2. Variables de entorno del servicio ----------
# NOTA: para secretos (GEMINI_API_KEY, DB_PASSWORD, GOOGLE_CLIENT_SECRET)
# se recomienda Secret Manager con --set-secrets en lugar de --set-env-vars.
ENV_VARS="NODE_ENV=production"
ENV_VARS="${ENV_VARS},DB_NAME=${DB_NAME:-academicsync}"
ENV_VARS="${ENV_VARS},DB_USERNAME=${DB_USERNAME:-postgres}"
ENV_VARS="${ENV_VARS},GEMINI_MODEL=${GEMINI_MODEL:-gemini-1.5-flash}"
ENV_VARS="${ENV_VARS},FRONTEND_URL=${FRONTEND_URL:-*}"

# Si hay Cloud SQL, la conexión se hace por socket unix.
if [[ -n "${CLOUD_SQL_INSTANCE}" ]]; then
  ENV_VARS="${ENV_VARS},DB_HOST=/cloudsql/${CLOUD_SQL_INSTANCE}"
fi

# ---------- 3. Desplegar en Cloud Run ----------
echo ">> Desplegando ${SERVICE} en Cloud Run (${REGION}) ..."

DEPLOY_ARGS=(
  "${SERVICE}"
  --project "${PROJECT_ID}"
  --image "${IMAGE}"
  --region "${REGION}"
  --platform managed
  --allow-unauthenticated
  --port 8080
  --min-instances 1
  --max-instances 2
  --memory 512Mi
  --cpu 1
  --set-env-vars "${ENV_VARS}"
)

# Secretos vía Secret Manager (crea los secretos previamente):
#   gcloud secrets create GEMINI_API_KEY --data-file=-
DEPLOY_ARGS+=(--set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,DB_PASSWORD=DB_PASSWORD:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GOOGLE_OAUTH_REDIRECT_URI=GOOGLE_OAUTH_REDIRECT_URI:latest")

# Adjunta la instancia de Cloud SQL si se definió.
if [[ -n "${CLOUD_SQL_INSTANCE}" ]]; then
  DEPLOY_ARGS+=(--add-cloudsql-instances "${CLOUD_SQL_INSTANCE}")
fi

gcloud run deploy "${DEPLOY_ARGS[@]}"

echo ">> Despliegue completado."
gcloud run services describe "${SERVICE}" \
  --project "${PROJECT_ID}" --region "${REGION}" \
  --format 'value(status.url)'
