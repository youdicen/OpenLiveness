import { useRef, useState, useCallback, useEffect } from 'react'

export function useCamera({ facing = 'user', width = 1280, height = 720 } = {}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [facingMode, setFacingMode] = useState(facing)

  const startCamera = useCallback(async (mode = facingMode) => {
    try {
      setError(null)
      setIsReady(false)

      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }

      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          setIsReady(true)
        }
      }
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'camera_denied'
        : 'camera_failed'
      )
    }
  }, [facingMode, width, height])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsReady(false)
  }, [])

  const flipCamera = useCallback(() => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    startCamera(newMode)
  }, [facingMode, startCamera])

  const captureFrame = useCallback((canvasRef) => {
    if (!videoRef.current || !canvasRef?.current) return null
    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    // Flip back for capture (front camera is mirrored in CSS)
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }
    return canvas.toDataURL('image/jpeg', 0.92)
  }, [facingMode])

  // Brightness estimation
  const getBrightness = useCallback((canvasRef) => {
    if (!canvasRef?.current) return 0
    // willReadFrequently:true optimizes for repeated getImageData reads
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })
    if (!ctx) return 0
    const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data
    let sum = 0
    for (let i = 0; i < data.length; i += 16) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3
    }
    return Math.round((sum / (data.length / 16)) / 255 * 100)
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  return {
    videoRef,
    isReady,
    error,
    facingMode,
    startCamera,
    stopCamera,
    flipCamera,
    captureFrame,
    getBrightness,
  }
}
