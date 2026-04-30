import { useRef, useState, useCallback } from 'react'

// ─── Thresholds ───────────────────────────────────────────────────────────────
const BLINK_FALLBACK   = 0.24   // fallback antes de calibración (más alto = más fácil)
const BLINK_RATIO      = 0.75   // umbral dinámico = baseline * 0.75 (más generoso en móvil)
const BLINK_FLOOR      = 0.17   // mínimo absoluto
const BLINK_CEIL       = 0.28   // máximo absoluto
const FRAMES_CLOSE     = 1      // 1 frame basta — a 10fps móvil un parpadeo solo genera 1-2 frames
const FRAMES_OPEN      = 1      // frames "abierto" para completar ciclo (bajado de 2)
const BLINK_COOLDOWN   = 15     // frames de espera tras parpadeo exitoso (bajado de 25)
const CALIBRATION_FRAMES = 45   // frames para calcular baseline personal

const YAW_THRESHOLD = 18

export const DEPTH_THRESHOLD       = 0.018
export const DEPTH_FRAMES_REQUIRED = 20

// ─── Challenge sequence ───────────────────────────────────────────────────────
export const CHALLENGES = [
  { id: 'center', key: 'challenge_center', check: 'center' },
  { id: 'blink',  key: 'challenge_blink',  check: 'blink'  },
  { id: 'left',   key: 'challenge_left',   check: 'left'   },
  { id: 'right',  key: 'challenge_right',  check: 'right'  },
]

// ─── Eye landmark indices ─────────────────────────────────────────────────────
const LEFT_EYE_IDX  = [362, 385, 387, 263, 373, 380]
const RIGHT_EYE_IDX = [33,  160, 158, 133, 153, 144]

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function calcEAR(eye) {
  const p = eye
  const A = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y)
  const B = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)
  const C = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y)
  return (A + B) / (2.0 * C)
}

function calcYaw(landmarks) {
  const noseTip  = landmarks[4]
  const leftEar  = landmarks[234]
  const rightEar = landmarks[454]
  if (!noseTip || !leftEar || !rightEar) return 0
  const faceWidth  = Math.abs(rightEar.x - leftEar.x)
  const noseOffset = noseTip.x - (leftEar.x + rightEar.x) / 2
  return (noseOffset / faceWidth) * 90
}

function calcDepthScore(landmarks) {
  const zVals = landmarks.map(lm => lm.z)
  const mean  = zVals.reduce((a, b) => a + b, 0) / zVals.length
  const variance = zVals.reduce((s, z) => s + (z - mean) ** 2, 0) / zVals.length
  return Math.sqrt(variance)
}

// ─── Face mesh drawing ────────────────────────────────────────────────────────
function stroke(ctx, lm, connections, w, h) {
  if (!connections) return
  ctx.beginPath()
  for (const [i, j] of connections) {
    const a = lm[i], b = lm[j]
    if (!a || !b) continue
    ctx.moveTo(a.x * w, a.y * h)
    ctx.lineTo(b.x * w, b.y * h)
  }
  ctx.stroke()
}

function drawFaceMesh(canvas, lm, mc, depthPass) {
  if (!canvas || !lm || !mc) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const w = canvas.width
  const h = canvas.height

  const accent = depthPass ? 'rgba(50,205,50,' : 'rgba(167,139,250,'

  // Tesselation — very subtle
  ctx.strokeStyle = `${accent}0.07)`
  ctx.lineWidth = 0.5
  stroke(ctx, lm, mc.tesselation, w, h)

  // Face oval
  ctx.strokeStyle = `${accent}0.45)`
  ctx.lineWidth = 1.5
  stroke(ctx, lm, mc.faceOval, w, h)

  // Eyebrows
  ctx.strokeStyle = `${accent}0.65)`
  ctx.lineWidth = 1.2
  stroke(ctx, lm, mc.leftEyebrow,  w, h)
  stroke(ctx, lm, mc.rightEyebrow, w, h)

  // Eyes
  ctx.strokeStyle = `${accent}0.9)`
  ctx.lineWidth = 1.5
  stroke(ctx, lm, mc.leftEye,  w, h)
  stroke(ctx, lm, mc.rightEye, w, h)

  // Irises — cyan glow
  ctx.strokeStyle = 'rgba(100,210,255,0.85)'
  ctx.lineWidth = 1.5
  stroke(ctx, lm, mc.leftIris,  w, h)
  stroke(ctx, lm, mc.rightIris, w, h)

  // Lips
  ctx.strokeStyle = 'rgba(255,120,120,0.65)'
  ctx.lineWidth = 1.2
  stroke(ctx, lm, mc.lips, w, h)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLiveness({ onComplete } = {}) {
  const [status,              setStatus]             = useState('idle')
  const [challengeIndex,      setChallengeIndex]     = useState(0)
  const [completedChallenges, setCompletedChallenges]= useState([])
  const [capturedFrame,       setCapturedFrame]      = useState(null)
  const [calibrated,          setCalibrated]         = useState(false)
  const [telemetry, setTelemetry] = useState({
    ear: 0, yaw: 0, landmarks: 0, fps: 0,
    depthScore: 0, depthAvg: 0, depthPass: false,
  })

  // Calibration
  const earSamplesRef    = useRef([])
  const earBaselineRef   = useRef(null)
  const calibratedRef    = useRef(false)

  // Blink state machine
  const blinkPhaseRef    = useRef('idle')   // 'idle' | 'closing' | 'closed' | 'opening'
  const blinkCloseFrames = useRef(0)
  const blinkOpenFrames  = useRef(0)
  const blinkCooldownRef = useRef(0)
  const blinkDetectedRef = useRef(false)

  // Depth tracking
  const depthBufferRef   = useRef([])
  const depthFramesOkRef = useRef(0)
  const depthAvgRef      = useRef(0)

  // Infrastructure
  const faceMeshRef      = useRef(null)
  const initPromiseRef   = useRef(null)    // evita race condition al cargar MediaPipe
  const isPreviewModeRef = useRef(false)   // true = solo dibuja, no avanza desafíos
  const meshConstantsRef = useRef(null)
  const lastFrameTimeRef = useRef(Date.now())
  const fpsRef           = useRef(0)
  const videoRef         = useRef(null)
  const canvasRef        = useRef(null)
  const calibTimerRef    = useRef(null)    // timeout de calibración de 10s

  const currentChallenge = CHALLENGES[challengeIndex]

  // ── initFaceMesh ──────────────────────────────────────────────────────────
  const initFaceMesh = useCallback(async () => {
    if (faceMeshRef.current) return true           // ya inicializado
    if (initPromiseRef.current) return initPromiseRef.current  // carga en progreso

    initPromiseRef.current = (async () => {
    try {
      const mod = await import('@mediapipe/face_mesh')
      const FaceMeshCtor =
        mod.FaceMesh ?? mod.default?.FaceMesh ?? mod.default

      if (typeof FaceMeshCtor !== 'function') throw new Error('FaceMesh not found')

      // Capture face mesh connection constants
      meshConstantsRef.current = {
        tesselation:   mod.FACEMESH_TESSELATION,
        faceOval:      mod.FACEMESH_FACE_OVAL,
        leftEye:       mod.FACEMESH_LEFT_EYE,
        rightEye:      mod.FACEMESH_RIGHT_EYE,
        leftEyebrow:   mod.FACEMESH_LEFT_EYEBROW,
        rightEyebrow:  mod.FACEMESH_RIGHT_EYEBROW,
        lips:          mod.FACEMESH_LIPS,
        leftIris:      mod.FACEMESH_LEFT_IRIS,
        rightIris:     mod.FACEMESH_RIGHT_IRIS,
      }

      const fm = new FaceMeshCtor({ locateFile: (f) => `/mediapipe/${f}` })
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      })
      fm.onResults(handleResults)
      faceMeshRef.current = fm
      initPromiseRef.current = null
      return true
    } catch (e) {
      initPromiseRef.current = null
      console.error('[useLiveness] MediaPipe init failed:', e)
      return false
    }
    })()
    return initPromiseRef.current
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── handleResults — called every frame ────────────────────────────────────
  const handleResults = useCallback((results) => {
    const now   = Date.now()
    const delta = now - lastFrameTimeRef.current
    lastFrameTimeRef.current = now
    fpsRef.current = Math.round(1000 / Math.max(delta, 1))

    if (!results.multiFaceLandmarks?.[0]) {
      setTelemetry(t => ({ ...t, fps: fpsRef.current, landmarks: 0 }))
      return
    }

    const lm = results.multiFaceLandmarks[0]

    // ── Draw face mesh ───────────────────────────────────────────────────────
    if (canvasRef.current && results.image) {
      canvasRef.current.width  = results.image.width
      canvasRef.current.height = results.image.height
      const depthNow = depthFramesOkRef.current >= DEPTH_FRAMES_REQUIRED
      drawFaceMesh(canvasRef.current, lm, meshConstantsRef.current, depthNow)
    }

    // Preview mode: solo dibuja la malla, no avanza desafíos
    if (isPreviewModeRef.current) return

    // ── EAR / Yaw / Depth ────────────────────────────────────────────────────
    const earL = calcEAR(LEFT_EYE_IDX.map(i => lm[i]))
    const earR = calcEAR(RIGHT_EYE_IDX.map(i => lm[i]))
    const ear  = (earL + earR) / 2
    const yaw  = calcYaw(lm)
    const depthScore = calcDepthScore(lm)

    const buf = depthBufferRef.current
    buf.push(depthScore)
    if (buf.length > 60) buf.shift()
    const depthAvg = buf.reduce((a, b) => a + b, 0) / buf.length
    depthAvgRef.current = depthAvg

    if (depthScore >= DEPTH_THRESHOLD) {
      depthFramesOkRef.current = Math.min(depthFramesOkRef.current + 1, DEPTH_FRAMES_REQUIRED + 10)
    } else {
      depthFramesOkRef.current = Math.max(0, depthFramesOkRef.current - 2)
    }
    const depthPass = depthFramesOkRef.current >= DEPTH_FRAMES_REQUIRED

    setTelemetry({
      ear:        Math.round(ear        * 1000) / 1000,
      yaw:        Math.round(yaw        * 10)   / 10,
      landmarks:  lm.length,
      fps:        fpsRef.current,
      depthScore: Math.round(depthScore * 1000) / 1000,
      depthAvg:   Math.round(depthAvg   * 1000) / 1000,
      depthPass,
      earBaseline: earBaselineRef.current
        ? Math.round(earBaselineRef.current * 1000) / 1000
        : null,
    })

    // ── Challenge progression ─────────────────────────────────────────────────
    setChallengeIndex(idx => {
      const challenge = CHALLENGES[idx]
      if (!challenge) return idx

      let passed = false

      if (challenge.check === 'center') {
        // Collect EAR samples for personal calibration while centered
        if (!calibratedRef.current && Math.abs(yaw) < 12) {
          earSamplesRef.current.push(ear)
          if (earSamplesRef.current.length >= CALIBRATION_FRAMES) {
            const sorted = [...earSamplesRef.current].sort((a, b) => a - b)
            // 80th percentile = open-eye EAR (filters accidental blinks)
            earBaselineRef.current = sorted[Math.floor(sorted.length * 0.80)]
            calibratedRef.current = true
            setCalibrated(true)
          }
        }
        // center solo pasa cuando la calibración está completa
        passed = calibratedRef.current && Math.abs(yaw) < 10

      } else if (challenge.check === 'blink') {
        // Dynamic threshold based on personal baseline
        const threshold = calibratedRef.current
          ? Math.max(Math.min(earBaselineRef.current * BLINK_RATIO, BLINK_CEIL), BLINK_FLOOR)
          : BLINK_FALLBACK

        if (blinkCooldownRef.current > 0) {
          blinkCooldownRef.current--
        } else if (ear < threshold) {
          // Eye closing / closed
          blinkCloseFrames.current++
          blinkOpenFrames.current = 0
          if (blinkCloseFrames.current >= FRAMES_CLOSE) {
            blinkPhaseRef.current = 'closed'
          }
        } else {
          // Eye open
          if (blinkPhaseRef.current === 'closed') {
            blinkOpenFrames.current++
            if (blinkOpenFrames.current >= FRAMES_OPEN) {
              // Full blink cycle complete ✓
              blinkDetectedRef.current = true
              blinkCooldownRef.current = BLINK_COOLDOWN
              blinkPhaseRef.current    = 'idle'
              blinkCloseFrames.current = 0
              blinkOpenFrames.current  = 0
            }
          } else {
            blinkPhaseRef.current    = 'idle'
            blinkCloseFrames.current = 0
          }
        }
        passed = blinkDetectedRef.current

      } else if (challenge.check === 'left') {
        passed = yaw < -YAW_THRESHOLD
      } else if (challenge.check === 'right') {
        passed = yaw > YAW_THRESHOLD
      }

      if (passed) {
        setCompletedChallenges(c => {
          if (!c.includes(challenge.id)) {
            const updated = [...c, challenge.id]
            if (updated.length >= CHALLENGES.length) {
              setStatus('passed')
              if (videoRef.current && canvasRef.current) {
                const cap = document.createElement('canvas')
                cap.width  = videoRef.current.videoWidth
                cap.height = videoRef.current.videoHeight
                cap.getContext('2d').drawImage(videoRef.current, 0, 0)
                setCapturedFrame(cap.toDataURL('image/jpeg', 0.92))
              }
              onComplete?.()
            }
            blinkDetectedRef.current = false
            blinkPhaseRef.current    = 'idle'
            blinkCloseFrames.current = 0
            blinkOpenFrames.current  = 0
            return updated
          }
          return c
        })
        return Math.min(idx + 1, CHALLENGES.length - 1)
      }
      return idx
    })
  }, [onComplete])

  // ── startPreview — dibuja la malla sin avanzar desafíos ──────────────────
  const startPreview = useCallback(async (video, canvas) => {
    videoRef.current  = video
    canvasRef.current = canvas
    isPreviewModeRef.current = true

    const ok = await initFaceMesh()
    if (!ok) return

    let rafId
    const runRef = { current: true }
    const tick = async () => {
      if (!runRef.current) return
      if (faceMeshRef.current && video.readyState >= 2) {
        try { await faceMeshRef.current.send({ image: video }) } catch { /* ignore */ }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    faceMeshRef._previewStop = () => { runRef.current = false; cancelAnimationFrame(rafId) }
  }, [initFaceMesh])

  // ── stopPreview ───────────────────────────────────────────────────────────
  const stopPreview = useCallback(() => {
    if (faceMeshRef._previewStop) {
      faceMeshRef._previewStop()
      faceMeshRef._previewStop = null
    }
    // isPreviewModeRef se resetea en start() cuando arranca el test real
  }, [])

  // ── start ──────────────────────────────────────────────────────────────────
  const start = useCallback(async (video, canvas) => {
    // Detener preview si estaba activo
    if (faceMeshRef._previewStop) {
      faceMeshRef._previewStop()
      faceMeshRef._previewStop = null
    }
    isPreviewModeRef.current = false  // salir del modo preview

    videoRef.current  = video
    canvasRef.current = canvas

    // Reset all state
    blinkPhaseRef.current    = 'idle'
    blinkCloseFrames.current = 0
    blinkOpenFrames.current  = 0
    blinkCooldownRef.current = 0
    blinkDetectedRef.current = false
    earSamplesRef.current    = []
    earBaselineRef.current   = null
    calibratedRef.current    = false
    depthBufferRef.current   = []
    depthFramesOkRef.current = 0

    setChallengeIndex(0)
    setCompletedChallenges([])
    setStatus('running')
    setCapturedFrame(null)
    setCalibrated(false)

    const ok = await initFaceMesh()
    if (!ok) { setStatus('failed'); return }

    // Fallback: si tras 10s el usuario no completó calibración, usar baseline por defecto
    calibTimerRef.current = setTimeout(() => {
      if (!calibratedRef.current) {
        console.warn('[useLiveness] Calibration timeout — using fallback baseline')
        earBaselineRef.current = BLINK_FALLBACK
        calibratedRef.current  = true
        setCalibrated(true)
      }
    }, 10_000)

    let rafId
    const isRunningRef = { current: true }
    const tick = async () => {
      if (!isRunningRef.current) return
      if (faceMeshRef.current && video.readyState >= 2) {
        try { await faceMeshRef.current.send({ image: video }) } catch { /* ignore */ }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    faceMeshRef._stopCamera = () => { isRunningRef.current = false; cancelAnimationFrame(rafId) }
  }, [initFaceMesh])

  // ── reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (faceMeshRef._stopCamera) faceMeshRef._stopCamera()
    if (calibTimerRef.current) { clearTimeout(calibTimerRef.current); calibTimerRef.current = null }
    depthBufferRef.current   = []
    depthFramesOkRef.current = 0
    earSamplesRef.current    = []
    earBaselineRef.current   = null
    calibratedRef.current    = false
    blinkPhaseRef.current    = 'idle'
    blinkCloseFrames.current = 0
    blinkOpenFrames.current  = 0
    blinkCooldownRef.current = 0
    blinkDetectedRef.current = false
    setChallengeIndex(0)
    setCompletedChallenges([])
    setStatus('idle')
    setCapturedFrame(null)
    setCalibrated(false)
  }, [])

  // ── getDepthResult ─────────────────────────────────────────────────────────
  const getDepthResult = useCallback(() => ({
    depthScore:     depthAvgRef.current,
    depthFramesOk:  depthFramesOkRef.current,
    depthPass:      depthFramesOkRef.current >= DEPTH_FRAMES_REQUIRED,
    depthThreshold: DEPTH_THRESHOLD,
  }), [])

  return {
    status,
    currentChallenge,
    challengeIndex,
    completedChallenges,
    totalChallenges: CHALLENGES.length,
    telemetry,
    capturedFrame,
    calibrated,
    start,
    startPreview,
    stopPreview,
    reset,
    getDepthResult,
  }
}
