# syntax=docker/dockerfile:1
FROM python:3.11-slim

# ── System dependencies (requeridas por insightface + onnxruntime + opencv) ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    libglib2.0-0 \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Application code ─────────────────────────────────────────────────────────
COPY . .

# Railway inyecta $PORT dinámicamente
EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
