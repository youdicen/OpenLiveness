import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import {
  Shield, ShieldCheck, ShieldX, Download, RefreshCw,
  Check, X, AlertTriangle, WifiOff,
} from 'lucide-react'
import { useVerification, STEPS } from '../../context/VerificationContext'
import { useI18n } from '../../context/I18nContext'
import { API_BASE } from '../../config/api'

// ─── Real API call — no mock fallback ────────────────────────────────────────

async function callVerifyAPI(idImage, livenessImage, livenessData) {
  const depthScore = livenessData?.depthScore ?? 0

  const resp = await fetch(`${API_BASE}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_image:       idImage,
      liveness_frame: livenessImage,
      depth_score:    depthScore,
      session_id:     `sess_${Date.now()}`,
    }),
  })

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body?.detail ?? `HTTP ${resp.status}`)
  }
  return resp.json()
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreGauge({ score, verified }) {
  const pathRef = useRef(null)
  const r       = 70
  const circ    = 2 * Math.PI * r
  const safeScore = Math.max(0, Math.min(100, score))
  const offset    = circ - (safeScore / 100) * circ
  const color     = verified ? 'var(--tertiary)' : 'var(--error)'

  useEffect(() => {
    if (!pathRef.current) return
    gsap.fromTo(pathRef.current,
      { strokeDashoffset: circ },
      { strokeDashoffset: offset, duration: 1.5, ease: 'power2.out', delay: 0.3 }
    )
  }, [score, circ, offset])

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="160" height="160" className="rotate-[-90deg]">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          ref={pathRef}
          cx="80" cy="80" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono text-text-primary">{safeScore}%</span>
        <span className="text-xs text-text-muted mt-0.5">similitud</span>
      </div>
    </div>
  )
}

function VerificationBadge({ label, passed, value }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: passed ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
          border:     `1px solid ${passed ? 'var(--tertiary)' : 'var(--error)'}`,
        }}
      >
        {passed
          ? <Check size={14} style={{ color: 'var(--tertiary)' }} />
          : <X     size={14} style={{ color: 'var(--error)' }} />
        }
      </div>
      <div>
        <div className="text-xs text-text-muted">{label}</div>
        <div className="text-xs font-semibold"
          style={{ color: passed ? 'var(--tertiary)' : 'var(--error)' }}>
          {value || (passed ? 'APROBADO' : 'RECHAZADO')}
        </div>
      </div>
    </div>
  )
}

// Translate reject_reason codes to human-readable messages
function rejectMessage(reason) {
  if (!reason) return null
  const map = {
    no_face_in_document:   'No se detectó rostro en el documento. Suba una imagen más clara.',
    no_face_in_liveness:   'No se detectó rostro en la captura de vida. Repita la prueba.',
    face_detection_failed: 'Error al detectar rostro. Verifique la iluminación.',
    biometric_error:       'Error interno en comparación biométrica.',
  }
  if (reason.startsWith('failed_layers:')) {
    const layers = reason.replace('failed_layers:', '').split(',')
    const names  = { depth_3d: 'Profundidad 3D', texture: 'Textura', biometric: 'Biométrica' }
    return `Capas fallidas: ${layers.map(l => names[l] || l).join(', ')}`
  }
  return map[reason] ?? reason
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResultModule() {
  const { t } = useI18n()
  const { capturedIDFrame, capturedLivenessFrame, livenessData, result, setResult, reset } =
    useVerification()

  const [loading,  setLoading]  = useState(!result)
  const [apiError, setApiError] = useState(null)
  const containerRef = useRef(null)

  // Call real API
  useEffect(() => {
    if (result) { setLoading(false); return }
    let cancelled = false

    callVerifyAPI(capturedIDFrame, capturedLivenessFrame, livenessData)
      .then(r => {
        if (!cancelled) { setResult(r); setLoading(false) }
      })
      .catch(err => {
        if (!cancelled) {
          setApiError(err.message)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [capturedIDFrame, capturedLivenessFrame, livenessData, result, setResult])

  // GSAP entrance after load
  useEffect(() => {
    if (!loading && result) {
      const ctx = gsap.context(() => {
        gsap.from('.res-header', { opacity: 0, y: 20, duration: 0.6, ease: 'power3.out', delay: 0.1 })
        gsap.from('.res-gauge',  { opacity: 0, scale: 0.8, duration: 0.7, ease: 'back.out(1.4)', delay: 0.2 })
        gsap.from('.res-badge',  { opacity: 0, y: 16, stagger: 0.1, duration: 0.5, ease: 'power3.out', delay: 0.4 })
        gsap.from('.res-table',  { opacity: 0, y: 12, duration: 0.5, ease: 'power3.out', delay: 0.7 })
      }, containerRef)
      return () => ctx.revert()
    }
  }, [loading, result])

  const handleDownload = () => {
    if (!result) return
    const report = {
      sessionId: result.session_id ?? `sess_${Date.now()}`,
      timestamp: new Date().toISOString(),
      result,
      livenessData,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `verification-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full" style={{ border: '2px solid var(--border)' }} />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-t-2 border-primary animate-spin" />
        </div>
        <p className="text-sm font-mono text-text-muted">{t('result.processing')}</p>
        <div className="code-block text-[11px] mt-2 space-y-0.5" style={{ minWidth: '260px' }}>
          <div className="text-tertiary">► Validando profundidad 3D...</div>
          <div className="text-text-muted">► Analizando textura (FFT)...</div>
          <div className="text-text-muted">► Comparación biométrica DeepFace...</div>
        </div>
      </div>
    )
  }

  // ── API error state ────────────────────────────────────────────────────────
  if (apiError) {
    const isOffline = apiError.includes('fetch') || apiError.includes('Failed')
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6">
        {isOffline
          ? <WifiOff    size={36} className="text-error" />
          : <AlertTriangle size={36} className="text-error" />
        }
        <div className="text-center">
          <p className="text-base font-semibold text-text-primary mb-1">
            {isOffline ? 'Backend no disponible' : 'Error en verificación'}
          </p>
          <p className="text-sm text-text-muted max-w-sm">
            {isOffline
              ? 'Asegúrate de que el backend Python esté corriendo: cd backend && uvicorn main:app --reload --port 8000'
              : apiError
            }
          </p>
        </div>
        <div className="code-block text-[11px] text-error">{apiError}</div>
        <button onClick={reset} className="btn-secondary text-sm">
          <RefreshCw size={14} /> {t('result.btn_restart')}
        </button>
      </div>
    )
  }

  // ── No result (shouldn't happen, safety net) ───────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldX size={32} className="text-error" />
        <p className="text-sm text-text-secondary">{t('errors.api_failed')}</p>
        <button onClick={reset} className="btn-secondary text-sm">
          <RefreshCw size={14} /> {t('result.btn_restart')}
        </button>
      </div>
    )
  }

  // ── Destructure result ─────────────────────────────────────────────────────
  const {
    verified, similarity, liveness_pass, doc_authentic,
    confidence, latency, model, distance_metric, threshold,
    depth_pass, depth_score, texture_pass, texture_score,
    face_detected_id, face_detected_live, reject_reason,
  } = result

  const friendlyReject = rejectMessage(reject_reason)

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto px-6 pb-16">
      {/* Header */}
      <div className="res-header text-center mb-8">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
          style={{
            background: verified ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${verified ? 'var(--tertiary)' : 'var(--error)'}`,
          }}
        >
          {verified
            ? <ShieldCheck size={14} style={{ color: 'var(--tertiary)' }} />
            : <ShieldX    size={14} style={{ color: 'var(--error)'    }} />
          }
          <span className="text-sm font-semibold"
            style={{ color: verified ? 'var(--tertiary)' : 'var(--error)' }}>
            {verified ? t('result.verified') : t('result.failed')}
          </span>
        </div>
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">{t('result.title')}</h2>

        {/* Reject reason */}
        {!verified && friendlyReject && (
          <p className="text-xs text-text-muted mt-2 max-w-sm mx-auto">{friendlyReject}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gauge */}
        <div className="res-gauge flex flex-col items-center gap-4 card p-6">
          <ScoreGauge score={similarity} verified={verified} />
          <div className="text-center">
            <div className="text-xs text-text-muted">{t('result.similarity')}</div>
            <div className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
              umbral: {threshold}
            </div>
          </div>
        </div>

        {/* Badges + table */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* 5 verification badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="res-badge">
              <VerificationBadge label="Desafío Activo (Prueba de Vida)" passed={liveness_pass} />
            </div>
            <div className="res-badge">
              <VerificationBadge
                label="Profundidad 3D (Anti-Foto)"
                passed={depth_pass}
                value={depth_pass ? `Score: ${depth_score?.toFixed(3)}` : `Score: ${depth_score?.toFixed(3)} — muy bajo`}
              />
            </div>
            <div className="res-badge">
              <VerificationBadge
                label="Textura Orgánica (Anti-Pantalla)"
                passed={texture_pass}
                value={`${texture_score}% ${texture_pass ? '' : '— patrón LCD'}`}
              />
            </div>
            <div className="res-badge">
              <VerificationBadge
                label="Rostro Detectado en Documento"
                passed={face_detected_id}
                value={face_detected_id ? 'Detectado' : 'No encontrado'}
              />
            </div>
            <div className="res-badge sm:col-span-2">
              <VerificationBadge
                label="Coincidencia Biométrica 1:1 (DeepFace)"
                passed={doc_authentic}
                value={doc_authentic ? `${similarity}% similitud` : `${similarity}% — por debajo del umbral`}
              />
            </div>
          </div>

          {/* Breakdown table */}
          <div className="res-table code-block">
            <div className="text-xs font-mono text-text-muted mb-2">{t('result.breakdown')}</div>
            <div className="space-y-1.5">
              {[
                { label: t('result.similarity'),      value: `${similarity}%` },
                { label: 'Confianza global',           value: `${confidence}%` },
                { label: t('result.latency'),          value: `${latency}ms` },
                { label: t('result.model'),            value: model },
                { label: t('result.distance_metric'),  value: distance_metric },
                { label: t('result.threshold'),        value: threshold.toString() },
                { label: 'Umbral profundidad 3D',      value: '≥ 0.018' },
                { label: 'Umbral textura FFT',         value: '≥ 70%' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1 border-b border-border-subtle last:border-0">
                  <span className="text-text-muted">{label}</span>
                  <span className="text-text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button id="download-report-btn" onClick={handleDownload}
              className="btn-secondary flex-1 py-2.5 text-sm">
              <Download size={14} />
              {t('result.btn_download')}
            </button>
            <button id="restart-verification-btn" onClick={reset}
              className="btn-primary flex-1 py-2.5 text-sm">
              <RefreshCw size={14} />
              {t('result.btn_restart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
