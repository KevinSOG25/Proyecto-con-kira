# ============================================================
# AcademicSync backend — Dockerfile multietapa para producción
# ============================================================

# ---------- Etapa 1: dependencias (todas, incl. dev) ----------
FROM node:22-alpine AS deps
WORKDIR /app
# Solo los manifiestos para aprovechar la caché de capas.
COPY package.json package-lock.json ./
# npm ci = instalación reproducible desde el lockfile.
RUN npm ci

# ---------- Etapa 2: build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Compila TypeScript -> dist/
RUN npm run build
# Elimina las devDependencies para dejar solo runtime.
RUN npm prune --omit=dev

# ---------- Etapa 3: runtime (imagen final mínima) ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
# Cloud Run inyecta PORT; 8080 por defecto.
ENV PORT=8080
WORKDIR /app

# Usuario no-root para reducir superficie de ataque.
# La imagen node:alpine ya trae el usuario "node" (uid 1000).
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/package.json ./package.json

USER node

EXPOSE 8080

# Ejecuta directamente el bundle compilado.
CMD ["node", "dist/main.js"]
