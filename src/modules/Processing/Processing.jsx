import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useVerification, STEPS } from '../../context/VerificationContext'

const STEPS_LOG = [
  { label: 'Validando prueba de vida...', delay: 0 },
  { label: 'Extrayendo ROI del documento...', delay: 400 },
  { label: 'Vectorizando biometría facial...', delay: 900 },
  { label: 'Calculando distancia coseno...', delay: 1500 },
  { label: 'Evaluando umbral de similitud...', delay: 2100 },
]

export default function Processing() {
  const { setStep } = useVerification()
  const containerRef = useRef(null)
  const logRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.proc-ring', { scale: 0.7, opacity: 0, duration: 0.5, ease: 'back.out(1.4)' })
      gsap.from('.proc-title', { y: 16, opacity: 0, duration: 0.5, ease: 'power3.out', delay: 0.2 })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const timers = STEPS_LOG.map(({ label, delay }, i) =>
      setTimeout(() => {
        if (logRef.current) {
          const line = document.createElement('div')
          line.className = 'text-[11px] font-mono animate-fade-up'
          line.style.color = i === STEPS_LOG.length - 1 ? 'var(--tertiary)' : 'var(--text-muted)'
          line.textContent = `[${String(delay).padStart(4, '0')}ms] ${label}`
          logRef.current.appendChild(line)
        }
      }, delay)
    )

    const finalTimer = setTimeout(() => {
      setStep(STEPS.RESULT)
    }, 2800)

    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(finalTimer)
    }
  }, [setStep])

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
      {/* Animated ring */}
      <div className="proc-ring relative">
        <div className="w-20 h-20 rounded-full" style={{ border: '1px solid var(--border)' }} />
        <div className="absolute inset-0 w-20 h-20 rounded-full border-t-2 border-l-2 border-primary animate-spin" />
        <div className="absolute inset-3 w-14 h-14 rounded-full border-b-2 border-primary/40 animate-spin"
          style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
      </div>

      {/* Title */}
      <div className="proc-title text-center">
        <h3 className="text-lg font-bold text-text-primary mb-1">Procesando Análisis</h3>
        <p className="text-sm text-text-muted font-mono">Biometric Inference Engine</p>
      </div>

      {/* Log output */}
      <div className="code-block w-full max-w-sm space-y-1" ref={logRef} />
    </div>
  )
}
