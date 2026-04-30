# ─── Stage: runtime ───────────────────────────────────────────────────────────
# Python 3.11-slim — compatible con InsightFace + ONNX Runtime + OpenCV
FROM python:3.11-slim

# System dependencies requeridas por InsightFace / OpenCV / cmake
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

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias Python primero (capa cacheada)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente del backend
COPY . .

# Puerto expuesto (Railway inyecta $PORT en runtime, no en build)
EXPOSE 8000

# Railway inyecta $PORT — uvicorn lo lee directamente
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
