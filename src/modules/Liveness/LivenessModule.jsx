import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import { Eye, AlertTriangle, Check, RefreshCw, ArrowRight, Activity, Gauge } from 'lucide-react'
import { useLiveness, CHALLENGES } from '../../hooks/useLiveness'
import { useCamera } from '../../hooks/useCamera'
import { useVerification, STEPS } from '../../context/VerificationContext'
import { useI18n } from '../../context/I18nContext'

function ChallengeCard({ challenge, completedChallenges, currentIndex, t }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Eye size={12} className="text-primary" />
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Desafíos</span>
      </div>
      {CHALLENGES.map((ch, i) => {
        const isDone = completedChallenges.includes(ch.id)
        const isActive = i === currentIndex && !isDone
        return (
          <div key={ch.id} className="flex items-center gap-3">
            <div
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
              style={{
                background: isDone ? 'rgba(52,211,153,0.15)'
                          : isActive ? 'rgba(167,139,250,0.1)'
                          : 'var(--surface-mid)',
                border: `1px solid ${isDone ? 'var(--tertiary)' : isActive ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {isDone ? (
                <Check size={12} style={{ color: 'var(--tertiary)' }} />
              ) : (
                <span className="text-[10px] font-mono"
                  style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {i + 1}
                </span>
              )}
            </div>
            <span
              className="text-xs"
              style={{
                color: isDone ? 'var(--tertiary)'
                     : isActive ? 'var(--text-primary)'
                     : 'var(--text-muted)',
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {t(`liveness.${ch.key}`)}
            </span>
            {isActive && (
              <span className="ml-auto">
                <span className="status-dot online" style={{ width: '6px', height: '6px' }} />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ProgressArc({ progress }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (progress / 100) * circ

  return (
    <svg width="88" height="88" className="rotate-[-90deg]">
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle
        cx="44" cy="44" r={r} fill="none"
        stroke="var(--primary)" strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  )
}

export default function LivenessModule() {
  const { t } = useI18n()
  const { setLivenessData, setStep } = useVerification()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [started, setStarted] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  const { startCamera, isReady } = useCamera({ facing: 'user' })

  const handleComplete = useCallback(() => {
    // Handled below via status === 'passed'
  }, [])

  const {
    status,
    currentChallenge,
    challengeIndex,
    completedChallenges,
    totalChallenges,
    telemetry,
    capturedFrame,
    calibrated,
    start: startLiveness,
    startPreview,
    stopPreview,
    reset,
    getDepthResult,
  } = useLiveness({ onComplete: handleComplete })

  // Progress percentage
  const progress = (completedChallenges.length / totalChallenges) * 100

  useEffect(() => {
    // Start camera for liveness (front-facing)
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play()
            setVideoReady(true)
          }
        }
      } catch (e) {
        console.error('Camera error', e)
      }
    }
    initCamera()
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Start preview mesh when video is ready (before user presses Iniciar)
  useEffect(() => {
    if (videoReady && !started && videoRef.current && canvasRef.current) {
      startPreview(videoRef.current, canvasRef.current)
    }
    return () => {
      if (!started) stopPreview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoReady])

  // GSAP entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.lv-title', { opacity: 0, y: 20, duration: 0.6, ease: 'power3.out', delay: 0.1 })
      gsap.from('.lv-camera', { opacity: 0, scale: 0.97, duration: 0.6, ease: 'power3.out', delay: 0.2 })
      gsap.from('.lv-sidebar', { opacity: 0, x: 20, duration: 0.5, ease: 'power3.out', delay: 0.35 })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  // Auto-proceed when passed — capture depth result at this moment
  useEffect(() => {
    if (status === 'passed' && capturedFrame) {
      const timer = setTimeout(() => {
        const depthResult = getDepthResult()
        setLivenessData(capturedFrame, {
          blink: true, turnLeft: true, turnRight: true,
          ...depthResult,    // depthScore, depthFramesOk, depthPass, depthThreshold
        })
        setStep(STEPS.PROCESSING)
      }, 1800)
      return () => clearTimeout(timer)
    }
  }, [status, capturedFrame, setLivenessData, setStep, getDepthResult])

  const handleStart = useCallback(() => {
    if (!videoRef.current) return
    setStarted(true)
    startLiveness(videoRef.current, canvasRef.current)
  }, [startLiveness])

  // Active instruction
  const instruction = currentChallenge ? t(`liveness.${currentChallenge.key}`) : ''

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto px-6 pb-16">
      {/* Title */}
      <div className="lv-title text-center mb-8">
        <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-1">{t('liveness.title')}</h2>
        <p className="text-sm text-text-secondary">{t('liveness.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera */}
        <div className="lg:col-span-2">
          <div className="lv-camera camera-feed aspect-video relative rounded-container"
            style={{ minHeight: '280px' }}>

            {/* Video */}
            <video
              ref={videoRef}
              autoPlay playsInline muted
              className="w-full h-full object-cover rounded-container"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Landmark overlay canvas — animated based on state */}
            <canvas
              ref={canvasRef}
              className={[
                'absolute inset-0 w-full h-full rounded-container',
                status === 'running' && telemetry.depthPass
                  ? 'canvas-mesh-active'
                  : !started && videoReady
                  ? 'canvas-mesh-preview'
                  : '',
              ].join(' ')}
              style={{ transform: 'scaleX(-1)', pointerEvents: 'none' }}
            />

            {/* Status passed overlay */}
            {status === 'passed' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-container"
                style={{ background: 'rgba(9,9,11,0.75)' }}>
                <div className="text-center animate-fade-up">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ background: 'rgba(52,211,153,0.15)', border: '2px solid var(--tertiary)' }}>
                    <Check size={28} style={{ color: 'var(--tertiary)' }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--tertiary)' }}>
                    {t('liveness.completed')}
                  </p>
                </div>
              </div>
            )}

            {/* Active challenge instruction */}
            {started && status === 'running' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full"
                style={{ background: 'rgba(9,9,11,0.85)', border: '1px solid var(--primary)' }}>
                <span className="text-sm font-medium text-text-primary">{instruction}</span>
              </div>
            )}

            {/* Calibration indicator */}
            {started && status === 'running' && !calibrated && currentChallenge?.check === 'center' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(9,9,11,0.80)', border: '1px solid var(--border)' }}>
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  ◌ Calibrando perfil ocular...
                </span>
              </div>
            )}

            {/* Calibration done badge */}
            {started && status === 'running' && calibrated && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded-full"
                style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid var(--tertiary)' }}>
                <span className="text-[10px] font-mono" style={{ color: 'var(--tertiary)' }}>✓ Perfil listo</span>
              </div>
            )}

            {/* Start button overlay */}
            {!started && (
              <div className="absolute inset-0 flex items-center justify-center rounded-container"
                style={{ background: videoReady ? 'rgba(9,9,11,0.6)' : 'var(--surface)' }}>
                {videoReady ? (
                  <button
                    id="start-liveness-btn"
                    onClick={handleStart}
                    className="btn-primary px-6 py-3 text-sm"
                  >
                    <Eye size={16} />
                    Iniciar Prueba de Vida
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-text-muted animate-pulse" />
                    <span className="text-sm font-mono text-text-muted">Preparando cámara...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reset button */}
          {status === 'failed' && (
            <button
              id="retry-liveness-btn"
              onClick={reset}
              className="btn-secondary w-full mt-4 py-3 text-sm"
            >
              <RefreshCw size={14} />
              {t('liveness.btn_retry')}
            </button>
          )}
        </div>

        {/* Sidebar */}
        <div className="lv-sidebar flex flex-col gap-4">
          {/* Progress arc */}
          <div className="card p-4 flex flex-col items-center gap-3">
            <div className="relative">
              <ProgressArc progress={progress} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold font-mono text-text-primary">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
            <span className="text-xs text-text-muted">{t('liveness.progress')}</span>
          </div>

          {/* Challenges */}
          <ChallengeCard
            challenge={currentChallenge}
            completedChallenges={completedChallenges}
            currentIndex={challengeIndex}
            t={t}
          />

          {/* Telemetry */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={12} className="text-primary" />
              <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Telemetría</span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: t('liveness.ear_score'),  value: telemetry.ear.toString() },
                { label: 'EAR baseline',            value: telemetry.earBaseline != null ? telemetry.earBaseline.toString() : '—' },
                { label: t('liveness.yaw_angle'),  value: `${telemetry.yaw}°` },
                { label: t('liveness.landmarks'),  value: telemetry.landmarks.toString() },
                { label: t('liveness.fps'),         value: telemetry.fps.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1 border-b border-border-subtle last:border-0">
                  <span className="text-xs text-text-muted">{label}</span>
                  <span className="text-xs font-mono text-text-primary">{value}</span>
                </div>
              ))}
              {/* Depth anti-spoofing row */}
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-xs text-text-muted">Profundidad 3D</span>
                <span className="text-xs font-mono" style={{ color: telemetry.depthPass ? 'var(--tertiary)' : 'var(--text-muted)' }}>
                  {telemetry.depthScore?.toFixed(3) ?? '—'} {telemetry.depthPass ? '✓' : '…'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
