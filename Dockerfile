# ─── Stage 1: Build del frontend React ────────────────────────────────────────
# Node 20-slim para compilar Vite + copiar binarios de MediaPipe a public/
FROM node:20-slim AS builder

WORKDIR /frontend

# Instalar deps primero (capa cacheada en re-builds)
COPY package.json package-lock.json ./
RUN npm ci

# Copiar todo el source necesario para el build
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY public/       ./public/
COPY src/          ./src/
COPY scripts/      ./scripts/

# VITE_API_URL vacío → llamadas relativas /api/* (mismo origen en prod)
# El proxy de Vite se encarga de redirigir en modo dev
RUN npm run build


# ─── Stage 2: Python runtime — FastAPI + InsightFace ──────────────────────────
FROM python:3.11-slim AS runtime

# Dependencias de sistema requeridas por InsightFace / OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Python (capa cacheada)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código fuente del backend
COPY backend/main.py .

# Frontend compilado desde el stage anterior
COPY --from=builder /frontend/dist ./dist

EXPOSE 8000

# Railway inyecta $PORT — uvicorn lo lee en runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
