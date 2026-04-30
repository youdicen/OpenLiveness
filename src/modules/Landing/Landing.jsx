import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Shield, Eye, Cpu, ArrowRight, Scan, Lock, Zap } from 'lucide-react'
import { useVerification } from '../../context/VerificationContext'

const FEATURES = [
  {
    icon: Eye,
    title: 'Detección de Vida Activa',
    description: 'MediaPipe rastrea 468 puntos faciales en tiempo real para validar parpadeos y rotación de cabeza.',
    tag: 'LIVENESS',
  },
  {
    icon: Cpu,
    title: 'Cotejo Biométrico',
    description: 'DeepFace convierte rostros en vectores numéricos y calcula la distancia matemática entre ambos.',
    tag: 'DEEPFACE',
  },
  {
    icon: Lock,
    title: 'Arquitectura Stateless',
    description: 'Sin bases de datos. Los datos biométricos se procesan y se descartan inmediatamente tras el resultado.',
    tag: 'PRIVACY',
  },
]

const STATS = [
  { value: '468', label: 'Puntos Faciales', unit: 'landmarks' },
  { value: '99.2', label: 'Precisión', unit: '%' },
  { value: '<250', label: 'Latencia', unit: 'ms' },
]

export default function Landing() {
  const { startSession } = useVerification()
  const heroRef = useRef(null)
  const featuresRef = useRef(null)
  const statsRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance
      gsap.from('.hero-badge', { opacity: 0, y: -12, duration: 0.5, ease: 'power3.out', delay: 0.1 })
      gsap.from('.hero-title', { opacity: 0, y: 24, duration: 0.7, ease: 'power3.out', delay: 0.2 })
      gsap.from('.hero-subtitle', { opacity: 0, y: 16, duration: 0.6, ease: 'power3.out', delay: 0.4 })
      gsap.from('.hero-cta', { opacity: 0, y: 16, duration: 0.6, ease: 'power3.out', delay: 0.55 })
      gsap.from('.hero-stats', { opacity: 0, y: 12, duration: 0.6, ease: 'power3.out', delay: 0.7 })

      // Feature cards stagger
      gsap.from('.feature-card', {
        opacity: 0,
        y: 32,
        stagger: 0.12,
        duration: 0.7,
        ease: 'power3.out',
        delay: 0.9,
      })
    }, heroRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={heroRef} className="min-h-screen flex flex-col items-center justify-center px-6 pb-16 pt-28">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        {/* Badge */}
        <div className="hero-badge inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <span className="status-dot online" />
          <span className="text-xs font-mono text-text-muted">Open Source · Stateless · Anti-Spoofing</span>
        </div>

        {/* Title */}
        <h1 className="hero-title text-5xl sm:text-6xl font-bold text-text-primary mb-4 tracking-tight">
          Verificación
          <br />
          <span className="text-primary">Biométrica</span> de
          <br />
          Código Abierto
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle text-base text-text-secondary max-w-lg mx-auto mb-8 leading-relaxed">
          Compara un documento de identidad con un rostro en vivo usando{' '}
          <span className="text-text-primary font-medium">detección de vida activa</span>. Sin almacenamiento.
          Sin costos de licencia.
        </p>

        {/* CTA */}
        <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            id="start-verification-btn"
            onClick={startSession}
            className="btn-primary text-base px-7 py-3 group"
          >
            <Scan size={16} className="transition-transform group-hover:rotate-12 duration-300" />
            Iniciar Verificación
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 duration-200" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div ref={statsRef} className="hero-stats grid grid-cols-3 gap-4 max-w-md mx-auto mb-16 w-full">
        {STATS.map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl font-bold text-text-primary tracking-tight font-mono mb-0.5">
              {s.value}
              <span className="text-sm text-text-muted ml-0.5">{s.unit}</span>
            </div>
            <div className="text-xs text-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div ref={featuresRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto w-full">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <div
              key={f.tag}
              className="feature-card card p-5 hover:bg-surface-elevated transition-colors duration-300 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-[8px]"
                  style={{ background: 'var(--surface-mid)', border: '1px solid var(--border)' }}>
                  <Icon size={15} className="text-primary" />
                </div>
                <span className="text-mono text-[10px] text-text-muted px-2 py-0.5 rounded-full"
                  style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-mid)' }}>
                  {f.tag}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2 leading-tight">{f.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{f.description}</p>
            </div>
          )
        })}
      </div>

      {/* Tech diagram */}
      <div className="mt-12 max-w-3xl mx-auto w-full">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={12} className="text-primary" />
            <span className="text-xs font-mono text-text-muted">PIPELINE TÉCNICO</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {['ID Document', '→', 'Face Detection', '→', 'MediaPipe FaceMesh', '→', 'Liveness Checks', '→', 'DeepFace Match', '→', 'Result'].map((item, i) => (
              <span key={i} className={
                item === '→'
                  ? 'text-text-muted text-sm'
                  : 'text-mono text-[11px] px-2 py-1 rounded text-primary'
              }
                style={item !== '→' ? { background: 'var(--surface-mid)', border: '1px solid var(--border-subtle)' } : {}}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
