import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import ProgressStepper from './components/layout/ProgressStepper'
import Landing from './modules/Landing/Landing'
import IDCapture from './modules/IDCapture/IDCapture'
import LivenessModule from './modules/Liveness/LivenessModule'
import Processing from './modules/Processing/Processing'
import ResultModule from './modules/Result/ResultModule'
import { useVerification, STEPS } from './context/VerificationContext'

function ModuleTransition({ children, stepKey }) {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }
      )
    })
    return () => ctx.revert()
  }, [stepKey])

  return <div ref={ref}>{children}</div>
}

export default function App() {
  const { step } = useVerification()

  const renderModule = () => {
    switch (step) {
      case STEPS.IDLE:        return <Landing />
      case STEPS.ID_CAPTURE:  return <IDCapture />
      case STEPS.LIVENESS:    return <LivenessModule />
      case STEPS.PROCESSING:  return <Processing />
      case STEPS.RESULT:      return <ResultModule />
      default:                return <Landing />
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
      <Header />

      <main className="flex-1 flex flex-col pt-24">
        {step !== STEPS.IDLE && (
          <ProgressStepper currentStep={step} />
        )}

        <ModuleTransition stepKey={step}>
          {renderModule()}
        </ModuleTransition>
      </main>

      <Footer />
    </div>
  )
}
