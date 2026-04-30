import { useRef, useState, useCallback } from 'react'

// ─── Thresholds ───────────────────────────────────────────────────────────────

// Eye Aspect Ratio — blink detection
const BLINK_THRESHOLD    = 0.21
const EAR_FRAMES_REQUIRED = 2

// Yaw threshold (degrees) for head-turn challenges
const YAW_THRESHOLD = 18

// Depth anti-spoofing — Z std-dev across all 468 landmarks
// Real face: ~0.030–0.070 | Flat photo/screen: ~0.003–0.014
export const DEPTH_THRESHOLD       = 0.018   // minimum to be considered "3D"
export const DEPTH_FRAMES_REQUIRED = 20      // consecutive frames above threshold

// ─── Challenge sequence ───────────────────────────────────────────────────────

export const CHALLENGES = [
  { id: 'center', key: 'challenge_center', check: 'center' },
  { id: 'blink',  key: 'challenge_blink',  check: 'blink'  },
  { id: 'left',   key: 'challenge_left',   check: 'left'   },
  { id: 'right',  key: 'challenge_right',  check: 'right'  },
]

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function calcEAR(eye) {
  const p = eye
  const A = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y)
  const B = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)
  const C = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y)
  return (A + B) / (2.0 * C)
}

const LEFT_EYE_IDX  = [362, 385, 387, 263, 373, 380]
const RIGHT_EYE_IDX = [33,  160, 158, 133, 153, 144]

function calcYaw(landmarks) {
  const noseTip  = landmarks[4]
  const leftEar  = landmarks[234]
  const rightEar = landmarks[454]
  if (!noseTip || !leftEar || !rightEar) return 0
  const faceWidth  = Math.abs(rightEar.x - leftEar.x)
  const noseOffset = noseTip.x - (leftEar.x + rightEar.x) / 2
  return (noseOffset / faceWidth) * 90
}

/**
 * Calculates the standard deviation of Z-coordinates across all 468 landmarks.
 * MediaPipe Z is relative depth — real 3D faces show high variance
 * (nose protrudes, ears recede, forehead is intermediate).
 * Flat photo or screen → near-zero Z variance.
 */
function calcDepthScore(landmarks) {
  const zVals = landmarks.map(lm => lm.z)
  const mean  = zVals.reduce((a, b) => a + b, 0) / zVals.length
  const variance = zVals.reduce((s, z) => s + (z - mean) ** 2, 0) / zVals.length
  return Math.sqrt(variance)   // std deviation
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveness({ onComplete } = {}) {
  const [status,             setStatus]             = useState('idle')
  const [challengeIndex,     setChallengeIndex]     = useState(0)
  const [completedChallenges,setCompletedChallenges]= useState([])
  const [capturedFrame,      setCapturedFrame]      = useState(null)
  const [telemetry, setTelemetry] = useState({
    ear: 0, yaw: 0, landmarks: 0, fps: 0,
    depthScore: 0, depthAvg: 0, depthPass: false,
  })

  // Refs — mutable state that should NOT trigger re-renders
  const blinkFramesRef      = useRef(0)
  const blinkDetectedRef    = useRef(false)
  const faceMeshRef         = useRef(null)
  const lastFrameTimeRef    = useRef(Date.now())
  const fpsRef              = useRef(0)
  const videoRef            = useRef(null)
  const canvasRef           = useRef(null)

  // Depth tracking: rolling buffer of last 60 frame scores
  const depthBufferRef      = useRef([])
  const depthFramesOkRef    = useRef(0)   // consecutive frames above DEPTH_THRESHOLD
  const depthAvgRef         = useRef(0)   // running average — read at completion time

  const currentChallenge = CHALLENGES[challengeIndex]

  // ── initFaceMesh ────────────────────────────────────────────────────────────
  const initFaceMesh = useCallback(async () => {
    try {
      const faceMeshMod = await import('@mediapipe/face_mesh')
      // Handle CJS default-export wrapping in Vite
      const FaceMeshCtor =
        faceMeshMod.FaceMesh ??
        faceMeshMod.default?.FaceMesh ??
        faceMeshMod.default

      if (typeof FaceMeshCtor !== 'function') {
        throw new Error(`FaceMesh constructor not found: ${Object.keys(faceMeshMod)}`)
      }

      const fm = new FaceMeshCtor({
        locateFile: (file) => `/mediapipe/${file}`,
      })
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      })
      fm.onResults(handleResults)
      faceMeshRef.current = fm
      return true
    } catch (e) {
      console.error('[useLiveness] MediaPipe init failed:', e)
      return false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── handleResults — called every frame by MediaPipe ──────────────────────────
  const handleResults = useCallback((results) => {
    const now   = Date.now()
    const delta = now - lastFrameTimeRef.current
    lastFrameTimeRef.current = now
    fpsRef.current = Math.round(1000 / delta)

    if (!results.multiFaceLandmarks?.[0]) {
      setTelemetry(t => ({ ...t, fps: fpsRef.current, landmarks: 0 }))
      return
    }

    const lm = results.multiFaceLandmarks[0]

    // ── Draw landmark overlay ──────────────────────────────────────────────────
    if (canvasRef.current && results.image) {
      const ctx = canvasRef.current.getContext('2d')
      canvasRef.current.width  = results.image.width
      canvasRef.current.height = results.image.height
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      lm.forEach(pt => {
        ctx.beginPath()
        ctx.arc(pt.x * canvasRef.current.width, pt.y * canvasRef.current.height, 1, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(167,139,250,0.4)'
        ctx.fill()
      })
    }

    // ── EAR / Yaw ─────────────────────────────────────────────────────────────
    const ear = (calcEAR(LEFT_EYE_IDX.map(i => lm[i])) + calcEAR(RIGHT_EYE_IDX.map(i => lm[i]))) / 2
    const yaw = calcYaw(lm)

    // ── LAYER 1: Z-depth anti-spoofing ────────────────────────────────────────
    const depthScore = calcDepthScore(lm)

    // Rolling buffer (last 60 frames ≈ 3s at 20fps)
    const buf = depthBufferRef.current
    buf.push(depthScore)
    if (buf.length > 60) buf.shift()

    const depthAvg = buf.reduce((a, b) => a + b, 0) / buf.length
    depthAvgRef.current = depthAvg

    // Track consecutive frames above threshold (stricter check)
    if (depthScore >= DEPTH_THRESHOLD) {
      depthFramesOkRef.current = Math.min(depthFramesOkRef.current + 1, DEPTH_FRAMES_REQUIRED + 10)
    } else {
      // Decay — don't instantly reset, allow brief dips
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
    })

    // ── Challenge progression ──────────────────────────────────────────────────
    setChallengeIndex(idx => {
      const challenge = CHALLENGES[idx]
      if (!challenge) return idx

      let passed = false
      if (challenge.check === 'center') {
        passed = Math.abs(yaw) < 10
      } else if (challenge.check === 'blink') {
        if (ear < BLINK_THRESHOLD) {
          blinkFramesRef.current++
        } else {
          if (blinkFramesRef.current >= EAR_FRAMES_REQUIRED) blinkDetectedRef.current = true
          blinkFramesRef.current = 0
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
              // Capture the liveness frame at completion
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
            return updated
          }
          return c
        })
        return Math.min(idx + 1, CHALLENGES.length - 1)
      }
      return idx
    })
  }, [onComplete])

  // ── start ────────────────────────────────────────────────────────────────────
  const start = useCallback(async (video, canvas) => {
    videoRef.current  = video
    canvasRef.current = canvas

    // Reset all state
    blinkFramesRef.current   = 0
    blinkDetectedRef.current = false
    depthBufferRef.current   = []
    depthFramesOkRef.current = 0

    setChallengeIndex(0)
    setCompletedChallenges([])
    setStatus('running')
    setCapturedFrame(null)

    const ok = await initFaceMesh()
    if (!ok) { setStatus('failed'); return }

    // RAF loop — avoids @mediapipe/camera_utils CJS issues, gives full control
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

    faceMeshRef._stopCamera = () => {
      isRunningRef.current = false
      cancelAnimationFrame(rafId)
    }
  }, [initFaceMesh])

  // ── reset ────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (faceMeshRef._stopCamera) faceMeshRef._stopCamera()
    depthBufferRef.current   = []
    depthFramesOkRef.current = 0
    setChallengeIndex(0)
    setCompletedChallenges([])
    setStatus('idle')
    setCapturedFrame(null)
    blinkFramesRef.current   = 0
    blinkDetectedRef.current = false
  }, [])

  // ── getDepthResult — snapshot of depth analysis at completion time ───────────
  const getDepthResult = useCallback(() => ({
    depthScore:        depthAvgRef.current,
    depthFramesOk:     depthFramesOkRef.current,
    depthPass:         depthFramesOkRef.current >= DEPTH_FRAMES_REQUIRED,
    depthThreshold:    DEPTH_THRESHOLD,
  }), [])

  return {
    status,
    currentChallenge,
    challengeIndex,
    completedChallenges,
    totalChallenges: CHALLENGES.length,
    telemetry,
    capturedFrame,
    start,
    reset,
    getDepthResult,   // ← NEW: call this when status === 'passed'
  }
}
