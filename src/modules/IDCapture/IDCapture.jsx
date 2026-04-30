import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import {
  Camera, FlipHorizontal, Zap, AlertTriangle,
  Sun, Maximize, Aperture, User, ArrowRight, RotateCcw,
  Upload, FileImage, X as XIcon,
} from 'lucide-react'
import { useCamera } from '../../hooks/useCamera'
import { useVerification, STEPS } from '../../context/VerificationContext'
import { useI18n } from '../../context/I18nContext'

// ─── Subcomponents ────────────────────────────────────────────────────────────

function TelemetryRow({ label, value, unit = '', color }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="font-mono text-xs" style={{ color: color || 'var(--text-primary)' }}>
        {value}{unit}
      </span>
    </div>
  )
}

/** Tab switcher: Cámara / Subir Documento */
function ModeTab({ mode, current, icon: Icon, label, onClick }) {
  const active = mode === current
  return (
    <button
      onClick={() => onClick(mode)}
      className="relative flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-[8px] flex-1 sm:flex-none"
      style={{
        background: active ? 'var(--surface-el)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      <Icon size={14} />
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
          style={{ background: 'var(--primary)', bottom: '-1px' }}
        />
      )}
    </button>
  )
}

/** Drag & Drop upload zone */
function UploadZone({ onFile, preview, onClear }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = useCallback((files) => {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => onFile(e.target.result)
    reader.readAsDataURL(file)
  }, [onFile])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  // If we already have a preview, show it
  if (preview) {
    return (
      <div className="relative rounded-container overflow-hidden border"
        style={{ border: '1px solid var(--tertiary)', minHeight: '280px' }}>
        <img
          src={preview}
          alt="Documento cargado"
          className="w-full h-full object-contain"
          style={{ background: 'var(--surface)', minHeight: '280px' }}
        />
        {/* Clear button */}
        <button
          onClick={onClear}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ background: 'rgba(9,9,11,0.85)', border: '1px solid var(--border)' }}
          title="Cambiar imagen"
        >
          <XIcon size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>
        {/* Accepted badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid var(--tertiary)' }}>
          <FileImage size={11} style={{ color: 'var(--tertiary)' }} />
          <span className="text-xs font-mono" style={{ color: 'var(--tertiary)' }}>
            Documento cargado
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      className="flex flex-col items-center justify-center gap-4 rounded-container cursor-pointer transition-all duration-200"
      style={{
        minHeight: '280px',
        border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
        background: dragging ? 'rgba(167,139,250,0.05)' : 'var(--surface)',
        boxShadow: dragging ? '0 0 24px var(--primary-glow)' : 'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Icon */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-200"
          style={{
            background: dragging ? 'rgba(167,139,250,0.15)' : 'var(--surface-el)',
            border: `1px solid ${dragging ? 'var(--primary)' : 'var(--border)'}`,
            transform: dragging ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          <Upload size={24} style={{ color: dragging ? 'var(--primary)' : 'var(--text-muted)' }} />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            {dragging ? 'Suelta la imagen aquí' : 'Arrastra tu documento aquí'}
          </p>
          <p className="text-xs text-text-muted mt-1">
            o haz clic para seleccionar archivo
          </p>
        </div>

        {/* Accepted formats */}
        <div className="flex gap-2">
          {['JPG', 'PNG', 'WEBP', 'HEIC'].map(fmt => (
            <span key={fmt} className="code-block px-2 py-0.5 text-[10px]">{fmt}</span>
          ))}
        </div>
      </div>

      {/* Security note */}
      <p className="text-[11px] text-text-muted text-center px-8"
        style={{ lineHeight: 1.5 }}>
        La imagen se procesa localmente. No se sube a ningún servidor.
      </p>
    </div>
  )
}

// ─── Image analysis helper ────────────────────────────────────────────────────
// Computes luminance mean (brightness) and variance over a sampled pixel grid.
// High variance = structured content (text, photo borders, document).
// Low variance  = plain surface, wall, blank space.
function analyzeFrame(data) {
  const stride = Math.max(1, Math.floor(data.length / (256 * 4)))
  let sum = 0, count = 0
  const vals = []
  for (let i = 0; i < data.length; i += stride * 4) {
    const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    vals.push(luma)
    sum += luma
    count++
  }
  const mean = sum / count
  let variance = 0
  for (const v of vals) variance += (v - mean) ** 2
  variance /= count
  return {
    brightness: Math.round((mean / 255) * 100),
    variance:   Math.round(variance),
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IDCapture() {
  const { t } = useI18n()
  const { setCapturedID, setStep } = useVerification()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const containerRef = useRef(null)

  // 'camera' | 'upload'
  const [inputMode, setInputMode] = useState('camera')

  const [capturedImage, setCapturedImage] = useState(null)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [faceDetected, setFaceDetected] = useState(false)
  const [telemetry, setTelemetry] = useState({ lighting: 0, distance: '--', blur: '--' })
  const [flashActive, setFlashActive] = useState(false)

  // Face detection — native API + debounce refs
  const nativeFDRef      = useRef(null)   // FaceDetector instance (when supported)
  const facePositiveRef  = useRef(0)      // consecutive positive frames
  const faceNegativeRef  = useRef(0)      // consecutive negative frames

  const { videoRef: camVideoRef, isReady, error, flipCamera, startCamera, captureFrame } = useCamera({
    facing: 'environment', width: 1280, height: 720,
  })

  // Sync camera video ref
  useEffect(() => {
    if (camVideoRef && videoRef.current) {
      camVideoRef.current = videoRef.current
    }
  })

  // Start camera only in camera mode
  useEffect(() => {
    if (inputMode === 'camera') {
      startCamera('environment')
    }
  }, [inputMode])

  // Init native FaceDetector once (Chrome / Edge, Android Chrome)
  useEffect(() => {
    if ('FaceDetector' in window) {
      try {
        nativeFDRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
      } catch { /* API present but unsupported (security policy, etc.) */ }
    }
  }, [])

  // GSAP entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.idc-title',  { opacity: 0, y: 20, duration: 0.6, ease: 'power3.out', delay: 0.1 })
      gsap.from('.idc-tabs',   { opacity: 0, y: 10, duration: 0.4, ease: 'power3.out', delay: 0.15 })
      gsap.from('.idc-camera', { opacity: 0, scale: 0.97, duration: 0.6, ease: 'power3.out', delay: 0.2 })
      gsap.from('.idc-tips',   { opacity: 0, x: 20, duration: 0.5, ease: 'power3.out', delay: 0.4 })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  // Animate mode switch
  const handleModeSwitch = (newMode) => {
    if (newMode === inputMode) return
    gsap.to('.idc-camera', {
      opacity: 0, scale: 0.96, duration: 0.18, ease: 'power2.in',
      onComplete: () => {
        setInputMode(newMode)
        setCapturedImage(null)
        setUploadedImage(null)
        gsap.to('.idc-camera', { opacity: 1, scale: 1, duration: 0.22, ease: 'power2.out', delay: 0.05 })
      },
    })
  }

  // Telemetry + face detection loop (camera mode only)
  useEffect(() => {
    if (!isReady || inputMode !== 'camera') return

    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return
      const video  = videoRef.current
      const canvas = canvasRef.current

      // Cap resolution for performance on mobile
      canvas.width  = Math.min(video.videoWidth  || 320, 640)
      canvas.height = Math.min(video.videoHeight || 240, 480)

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      const { brightness, variance } = analyzeFrame(data)

      // ── Detection strategy ──────────────────────────────────────────────────
      let rawDetected = false

      if (nativeFDRef.current) {
        // Native FaceDetector (Chrome Android, Edge) — actual ML face detection
        try {
          const faces = await nativeFDRef.current.detect(video)
          // Require the face bounding box to occupy >3% of frame area
          // (filters distant background faces, needs a document held close)
          if (faces.length > 0) {
            const frameArea = canvas.width * canvas.height
            const { boundingBox: bb } = faces[0]
            rawDetected = (bb.width * bb.height) / frameArea > 0.03
          }
        } catch { /* silently ignore; falls through to false */ }
      } else {
        // Fallback heuristic: require structured content (not just brightness)
        // A document with a face photo has distinct text, borders, and photo contrast
        // → high variance AND acceptable brightness range
        // Variance: plain wall ~50-200 | empty room ~300-700 | document with photo ~1200+
        rawDetected = brightness >= 28 && brightness <= 88 && variance >= 1200
      }

      // ── Debounce ────────────────────────────────────────────────────────────
      // Require 2 consecutive positives to show badge, 4 negatives to hide it
      if (rawDetected) {
        facePositiveRef.current  = Math.min(facePositiveRef.current + 1, 5)
        faceNegativeRef.current  = 0
      } else {
        faceNegativeRef.current  = Math.min(faceNegativeRef.current + 1, 6)
        facePositiveRef.current  = 0
      }

      const confirmed = facePositiveRef.current >= 2
      const absent    = faceNegativeRef.current >= 4
      setFaceDetected(prev => confirmed ? true : absent ? false : prev)

      // ── Telemetry ───────────────────────────────────────────────────────────
      const blurLabel =
        variance >= 1200 ? 'Nítido'
        : variance >= 600 ? 'Aceptable'
        : 'Bajo'

      const distLabel =
        confirmed ? 'Óptima'
        : brightness < 28 ? 'Muy oscuro'
        : variance < 300  ? 'Sin contenido'
        : 'Ajustar'

      setTelemetry({ lighting: brightness, distance: distLabel, blur: blurLabel })
    }, 450)

    return () => clearInterval(interval)
  }, [isReady, inputMode])

  // Camera capture
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    setFlashActive(true)
    setTimeout(() => setFlashActive(false), 200)
    const frame = captureFrame(canvasRef)
    if (frame) setCapturedImage(frame)
  }, [captureFrame])

  // Upload handler
  const handleUpload = useCallback((dataUrl) => {
    setUploadedImage(dataUrl)
  }, [])

  // Determine what to send to context
  const activeImage = inputMode === 'camera' ? capturedImage : uploadedImage

  const handleContinue = useCallback(() => {
    if (activeImage) {
      setCapturedID(activeImage, null)
      setStep(STEPS.LIVENESS)
    }
  }, [activeImage, setCapturedID, setStep])

  const lightingColor = telemetry.lighting < 30
    ? 'var(--error)'
    : telemetry.lighting > 80
      ? 'var(--error)'
      : 'var(--tertiary)'

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto px-6 pb-16">
      {/* Title */}
      <div className="idc-title text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-1">
          {t('idCapture.title')}
        </h2>
        <p className="text-sm text-text-secondary">{t('idCapture.subtitle')}</p>
      </div>

      {/* Mode Tabs — full-width on mobile to prevent overflow */}
      <div className="idc-tabs flex items-center gap-1 mb-6 p-1 rounded-[10px] w-full sm:w-fit mx-auto"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <ModeTab
          mode="camera"
          current={inputMode}
          icon={Camera}
          label="Cámara"
          onClick={handleModeSwitch}
        />
        <ModeTab
          mode="upload"
          current={inputMode}
          icon={Upload}
          label="Subir Documento"
          onClick={handleModeSwitch}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera / Upload area */}
        <div className="lg:col-span-2">

          {/* ── CAMERA MODE ─────────────────────────────────── */}
          {inputMode === 'camera' && (
            <div className="idc-camera camera-feed relative rounded-container w-full"
              style={{ aspectRatio: '16/9', minHeight: '200px', maxHeight: '60vh' }}>

              <video
                ref={videoRef}
                autoPlay playsInline muted
                className="w-full h-full object-cover rounded-container"
                style={{ transform: 'scaleX(-1)' }}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Document frame overlay */}
              <div ref={overlayRef} className="absolute inset-6 pointer-events-none">
                <div className="relative w-full h-full">
                  <div className={`doc-corner doc-corner-tl ${faceDetected ? 'active' : ''}`} />
                  <div className={`doc-corner doc-corner-tr ${faceDetected ? 'active' : ''}`} />
                  <div className={`doc-corner doc-corner-bl ${faceDetected ? 'active' : ''}`} />
                  <div className={`doc-corner doc-corner-br ${faceDetected ? 'active' : ''}`} />
                  {faceDetected && <div className="scan-line" />}
                </div>
              </div>

              {flashActive && (
                <div className="absolute inset-0 bg-white rounded-container opacity-70 pointer-events-none" />
              )}

              {/* Controls */}
              <div className="absolute bottom-3 right-3">
                <button
                  id="flip-camera-btn"
                  onClick={flipCamera}
                  className="btn-ghost p-2 rounded-[8px]"
                  style={{ background: 'rgba(9,9,11,0.7)', border: '1px solid var(--border)' }}
                  title={t('idCapture.flipCamera')}
                >
                  <FlipHorizontal size={16} />
                </button>
              </div>

              {faceDetected && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid var(--tertiary)' }}>
                  <User size={11} style={{ color: 'var(--tertiary)' }} />
                  <span className="text-xs font-mono" style={{ color: 'var(--tertiary)' }}>
                    {t('idCapture.detected')}
                  </span>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center rounded-container"
                  style={{ background: 'rgba(9,9,11,0.9)' }}>
                  <div className="text-center p-6">
                    <AlertTriangle size={24} className="text-error mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">{t(`errors.${error}`)}</p>
                  </div>
                </div>
              )}

              {!isReady && !error && (
                <div className="absolute inset-0 flex items-center justify-center rounded-container"
                  style={{ background: 'var(--surface)' }}>
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-text-muted animate-pulse" />
                    <span className="text-sm font-mono text-text-muted">Inicializando cámara...</span>
                  </div>
                </div>
              )}

              {/* Captured preview overlay */}
              {capturedImage && (
                <div className="absolute inset-0 rounded-container overflow-hidden">
                  <img src={capturedImage} alt="Captura" className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid var(--tertiary)' }}>
                    <Camera size={11} style={{ color: 'var(--tertiary)' }} />
                    <span className="text-xs font-mono" style={{ color: 'var(--tertiary)' }}>Capturado</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── UPLOAD MODE ─────────────────────────────────── */}
          {inputMode === 'upload' && (
            <div className="idc-camera">
              <UploadZone
                onFile={handleUpload}
                preview={uploadedImage}
                onClear={() => setUploadedImage(null)}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            {inputMode === 'camera' && !capturedImage && (
              <button
                id="capture-doc-btn"
                onClick={handleCapture}
                disabled={!isReady || !!error}
                className="btn-primary flex-1 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Camera size={16} />
                {t('idCapture.btn_capture')}
              </button>
            )}

            {activeImage && (
              <>
                <button
                  id="retake-doc-btn"
                  onClick={() => {
                    setCapturedImage(null)
                    setUploadedImage(null)
                  }}
                  className="btn-secondary flex items-center gap-2 px-4 py-3 text-sm"
                >
                  <RotateCcw size={14} />
                  {inputMode === 'camera' ? t('idCapture.btn_retake') : 'Cambiar archivo'}
                </button>
                <button
                  id="continue-to-liveness-btn"
                  onClick={handleContinue}
                  className="btn-primary flex-1 py-3 text-sm"
                >
                  {t('idCapture.btn_continue')}
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="idc-tips flex flex-col gap-4">

          {/* Telemetry — camera mode only */}
          {inputMode === 'camera' && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={12} className="text-primary" />
                <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Telemetría</span>
              </div>
              <TelemetryRow
                label={t('idCapture.telemetry.lighting')}
                value={`${telemetry.lighting}`}
                unit="%"
                color={lightingColor}
              />
              <TelemetryRow label={t('idCapture.telemetry.distance')} value={telemetry.distance} color="var(--text-primary)" />
              <TelemetryRow label={t('idCapture.telemetry.blur')} value={telemetry.blur} color="var(--tertiary)" />
              <TelemetryRow
                label={t('idCapture.telemetry.face')}
                value={faceDetected ? t('idCapture.detected') : '—'}
                color={faceDetected ? 'var(--tertiary)' : 'var(--text-muted)'}
              />
            </div>
          )}

          {/* Upload tips — upload mode */}
          {inputMode === 'upload' && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileImage size={12} className="text-primary" />
                <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Requisitos</span>
              </div>
              <ul className="space-y-2">
                {[
                  'Documento original (no fotocopia)',
                  'Imagen nítida, sin brillo excesivo',
                  'Documento completo visible en el encuadre',
                  'Fondo contrastante recomendado',
                ].map(text => (
                  <li key={text} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
                      style={{ background: 'var(--primary)' }} />
                    <span className="text-xs text-text-secondary leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* General tips */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sun size={12} className="text-primary" />
              <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Consejos</span>
            </div>
            <ul className="space-y-2">
              {[
                { icon: Sun,      text: t('idCapture.tip1') },
                { icon: Aperture, text: t('idCapture.tip2') },
                { icon: Maximize, text: t('idCapture.tip3') },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon size={11} className="text-text-muted mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-text-secondary leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Uploaded preview thumbnail */}
          {uploadedImage && inputMode === 'upload' && (
            <div className="card overflow-hidden">
              <img src={uploadedImage} alt="Documento" className="w-full h-auto" />
              <div className="p-2.5 flex items-center gap-1.5">
                <span className="status-dot online" />
                <span className="text-xs font-mono text-tertiary">Listo para verificar</span>
              </div>
            </div>
          )}

          {/* Captured preview thumbnail (camera mode) */}
          {capturedImage && inputMode === 'camera' && (
            <div className="card overflow-hidden">
              <img src={capturedImage} alt="Documento capturado" className="w-full h-auto" />
              <div className="p-2.5 flex items-center gap-1.5">
                <span className="status-dot online" />
                <span className="text-xs font-mono text-tertiary">Capturado</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
