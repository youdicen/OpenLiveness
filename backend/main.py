"""
Open Liveness — FastAPI Backend  (3-Layer Anti-Spoofing)
=========================================================
Layer 1 (Frontend): Z-depth from MediaPipe landmarks → depth_score sent here
Layer 2 (Here):     FFT texture analysis → detect LCD pixel-grid patterns
Layer 3 (Here):     InsightFace ArcFace 1:1 biometric matching (ONNX, no TF)

All three layers must pass for verified=True.
Compatible with Python 3.14 — uses ONNX Runtime, no TensorFlow required.

Run:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

On first run, InsightFace downloads the buffalo_sc model (~100MB).
"""
from __future__ import annotations

import base64
import logging
import os
import time
from io import BytesIO
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis
from PIL import Image
from pydantic import BaseModel

logger = logging.getLogger("open_liveness")
logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")

# ─── InsightFace — lazy singleton ─────────────────────────────────────────────
# buffalo_sc: small, fast, accurate (~100MB) — works entirely on CPU
_face_app: Optional[FaceAnalysis] = None

def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        logger.info("[InsightFace] Initializing buffalo_sc model (first run downloads ~100MB)…")
        _face_app = FaceAnalysis(
            name="buffalo_sc",
            providers=["CPUExecutionProvider"],
        )
        _face_app.prepare(ctx_id=0, det_size=(320, 320))
        logger.info("[InsightFace] Model ready.")
    return _face_app


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Open Liveness API",
    description="3-layer biometric identity verification — stateless (InsightFace / FFT)",
    version="2.0.0",
)

_default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

def _parse_origins() -> list[str]:
    """Lee ALLOWED_ORIGINS (CSV) desde env; si no existe usa defaults de desarrollo."""
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    return list(dict.fromkeys(_default_origins + extra))  # deduplica, mantiene orden

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic models ──────────────────────────────────────────────────────────

class VerifyRequest(BaseModel):
    id_image:       str            # base64 JPEG — identity document photo
    liveness_frame: str            # base64 JPEG — liveness capture frame
    depth_score:    float = 0.0   # Z std-dev from MediaPipe (Layer 1, browser)
    session_id:     Optional[str] = None


class VerifyResponse(BaseModel):
    verified:           bool
    similarity:         float
    liveness_pass:      bool
    doc_authentic:      bool
    confidence:         float
    latency:            int
    model:              str
    distance_metric:    str
    threshold:          float
    session_id:         Optional[str]
    depth_pass:         bool
    depth_score:        float
    texture_pass:       bool
    texture_score:      float
    face_detected_id:   bool
    face_detected_live: bool
    reject_reason:      Optional[str] = None


# ─── Thresholds ───────────────────────────────────────────────────────────────

DEPTH_THRESHOLD    = 0.018   # min Z std-dev from MediaPipe (≥ → real 3D face)
TEXTURE_THRESHOLD  = 0.70    # min FFT centrality (screens < 0.65, real faces > 0.75)
# InsightFace cosine similarity: 1.0 = identical, 0.0 = unrelated
# ArcFace threshold: 0.30 is conservative (high security)
FACE_SIM_THRESHOLD = 0.30    # cosine similarity ≥ 0.30 → same person


# ─── Utilities ────────────────────────────────────────────────────────────────

def b64_to_bgr(b64_data: str, field_name: str) -> np.ndarray:
    """Decode base64 image → BGR numpy array (OpenCV / InsightFace format)."""
    try:
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        raw = base64.b64decode(b64_data)
        img = Image.open(BytesIO(raw)).convert("RGB")
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image '{field_name}': {exc}")


# ─── Layer 2: FFT Texture Anti-Spoofing ──────────────────────────────────────

def analyze_texture(img_bgr: np.ndarray) -> tuple[float, bool]:
    """
    FFT-based screen detection.

    LCD screens → regular pixel-grid → periodic high-freq peaks → lower centrality.
    Real faces / organic textures → energy in low frequencies → higher centrality.

    Returns: (centrality 0.0–1.0, pass_bool)
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (256, 256)).astype(float)

    fft_shift = np.fft.fftshift(np.fft.fft2(gray))
    magnitude  = np.abs(fft_shift)

    h, w   = magnitude.shape
    cy, cx = h // 2, w // 2
    radius = int(min(h, w) * 0.25)

    y_idx, x_idx = np.ogrid[:h, :w]
    mask = (x_idx - cx) ** 2 + (y_idx - cy) ** 2 <= radius ** 2

    low_energy   = float(np.sum(magnitude[mask]))
    total_energy = float(np.sum(magnitude)) + 1e-10
    centrality   = low_energy / total_energy

    passed = centrality >= TEXTURE_THRESHOLD
    logger.info(f"[Texture]  centrality={centrality:.4f}  threshold={TEXTURE_THRESHOLD}  pass={passed}")
    return round(centrality, 4), passed


# ─── Layer 3: InsightFace Biometric Comparison ───────────────────────────────

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two unit-norm embedding vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def verify_faces(id_img: np.ndarray, live_img: np.ndarray) -> dict:
    """
    1:1 biometric comparison using InsightFace ArcFace embeddings.

    Steps:
      1. Detect largest face in each image
      2. Extract 512-d ArcFace embedding
      3. Compute cosine similarity
      4. Match if cosine_sim ≥ FACE_SIM_THRESHOLD

    Returns dict with verified, similarity, cosine_sim, face_detected_id, face_detected_live
    """
    fa = get_face_app()

    id_faces   = fa.get(id_img)
    live_faces = fa.get(live_img)

    if not id_faces:
        raise ValueError("no_face_in_document")
    if not live_faces:
        raise ValueError("no_face_in_liveness")

    # Use the largest (most prominent) face in each image
    id_face   = max(id_faces,   key=lambda f: f.det_score)
    live_face = max(live_faces, key=lambda f: f.det_score)

    # ArcFace 512-d embeddings (unit-normalized by InsightFace)
    id_emb   = id_face.normed_embedding    if hasattr(id_face,   "normed_embedding") else id_face.embedding   / (np.linalg.norm(id_face.embedding) + 1e-10)
    live_emb = live_face.normed_embedding  if hasattr(live_face, "normed_embedding") else live_face.embedding / (np.linalg.norm(live_face.embedding) + 1e-10)

    cos_sim   = cosine_similarity(id_emb, live_emb)
    verified  = cos_sim >= FACE_SIM_THRESHOLD
    # Scale cosine similarity [0,1] → similarity percentage [0,100]
    similarity = round(max(0.0, cos_sim) * 100, 1)

    logger.info(
        f"[InsightFace]  cos_sim={cos_sim:.4f}  threshold={FACE_SIM_THRESHOLD}  "
        f"similarity={similarity}%  verified={verified}  "
        f"id_det={id_face.det_score:.2f}  live_det={live_face.det_score:.2f}"
    )

    return {
        "verified":           verified,
        "similarity":         similarity,
        "cosine_sim":         round(cos_sim, 4),
        "threshold":          FACE_SIM_THRESHOLD,
        "face_detected_id":   True,
        "face_detected_live": True,
    }


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":  "ok",
        "service": "open-liveness-api",
        "version": "2.0.0",
        "model":   "InsightFace-ArcFace (buffalo_sc)",
        "layers":  [
            "Layer 1: Z-depth 3D from MediaPipe (browser)",
            "Layer 2: FFT texture — screen detection",
            "Layer 3: ArcFace 512-d cosine similarity",
        ],
    }


@app.on_event("startup")
async def startup_event():
    """Pre-load the InsightFace model on startup (avoids cold-start on first request)."""
    try:
        get_face_app()
    except Exception as e:
        logger.warning(f"[Startup] Model pre-load failed (will retry on first request): {e}")


@app.post("/api/verify", response_model=VerifyResponse)
def verify_identity(payload: VerifyRequest):
    """
    3-layer identity verification endpoint.
    All layers must pass simultaneously for verified=True.
    """
    t_start = time.time()

    # ── Decode images ──────────────────────────────────────────────────────
    id_img   = b64_to_bgr(payload.id_image,       "id_image")
    live_img = b64_to_bgr(payload.liveness_frame,  "liveness_frame")

    # ── Layer 1: Z-depth (computed browser-side, validated here) ───────────
    depth_score = round(float(payload.depth_score), 4)
    depth_pass  = depth_score >= DEPTH_THRESHOLD
    logger.info(f"[Depth]    score={depth_score}  threshold={DEPTH_THRESHOLD}  pass={depth_pass}")

    # ── Layer 2: FFT texture anti-spoofing ─────────────────────────────────
    texture_centrality, texture_pass = analyze_texture(live_img)
    texture_score = round(texture_centrality * 100, 1)

    # ── Layer 3: InsightFace biometric comparison ──────────────────────────
    biometric      = {}
    face_id_ok     = False
    face_live_ok   = False
    biometric_pass = False
    similarity     = 0.0
    reject_reason  = None

    try:
        biometric      = verify_faces(id_img, live_img)
        biometric_pass = biometric["verified"]
        similarity     = biometric["similarity"]
        face_id_ok     = biometric["face_detected_id"]
        face_live_ok   = biometric["face_detected_live"]
    except ValueError as exc:
        reject_reason = str(exc)
        logger.warning(f"[FaceRec] {exc}")
    except Exception as exc:
        reject_reason = "biometric_error"
        logger.error(f"[FaceRec] Unexpected error: {exc}", exc_info=True)

    # ── Final decision — ALL 3 layers must pass ────────────────────────────
    verified = depth_pass and texture_pass and biometric_pass

    if not verified and not reject_reason:
        failed = []
        if not depth_pass:     failed.append("depth_3d")
        if not texture_pass:   failed.append("texture")
        if not biometric_pass: failed.append("biometric")
        reject_reason = f"failed_layers:{','.join(failed)}"

    # Overall confidence — geometric mean of layer scores (only meaningful when verified)
    depth_pct   = min(100.0, (depth_score / max(DEPTH_THRESHOLD, 1e-6)) * 100)
    texture_pct = texture_score
    bio_pct     = similarity
    confidence  = round((depth_pct * texture_pct * bio_pct + 1e-6) ** (1/3), 1) if verified else 0.0

    latency = int((time.time() - t_start) * 1000)
    logger.info(
        f"[Result]   {'✓ VERIFIED' if verified else '✗ REJECTED'}  "
        f"sim={similarity}%  depth={'✓' if depth_pass else '✗'}({depth_score:.4f})  "
        f"tex={'✓' if texture_pass else '✗'}({texture_score}%)  "
        f"bio={'✓' if biometric_pass else '✗'}  {latency}ms"
        + (f"  [{reject_reason}]" if reject_reason else "")
    )

    return VerifyResponse(
        verified=verified,
        similarity=similarity,
        liveness_pass=depth_pass,
        doc_authentic=biometric_pass and face_id_ok,
        confidence=confidence,
        latency=latency,
        model="InsightFace-ArcFace-buffalo_sc",
        distance_metric="cosine",
        threshold=biometric.get("threshold", FACE_SIM_THRESHOLD),
        session_id=payload.session_id,
        depth_pass=depth_pass,
        depth_score=depth_score,
        texture_pass=texture_pass,
        texture_score=texture_score,
        face_detected_id=face_id_ok,
        face_detected_live=face_live_ok,
        reject_reason=reject_reason,
    )
