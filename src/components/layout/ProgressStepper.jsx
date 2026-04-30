import { Check, FileText, Eye, ShieldCheck } from 'lucide-react'
import { useI18n } from '../../context/I18nContext'
import { STEPS } from '../../context/VerificationContext'

const STEP_DEFS = [
  { id: STEPS.ID_CAPTURE, icon: FileText, labelKey: 'stepper.step1' },
  { id: STEPS.LIVENESS,   icon: Eye,      labelKey: 'stepper.step2' },
  { id: STEPS.RESULT,     icon: ShieldCheck, labelKey: 'stepper.step3' },
]

const STEP_ORDER = [STEPS.ID_CAPTURE, STEPS.LIVENESS, STEPS.PROCESSING, STEPS.RESULT]

function getStepState(stepId, currentStep) {
  const currentIdx = STEP_ORDER.indexOf(currentStep)
  const stepIdx = STEP_ORDER.indexOf(stepId)
  if (stepIdx < currentIdx) return 'completed'
  if (stepIdx === currentIdx) return 'active'
  return 'upcoming'
}

export default function ProgressStepper({ currentStep }) {
  const { t } = useI18n()

  if (currentStep === STEPS.IDLE) return null

  return (
    <div className="w-full max-w-lg mx-auto px-6 py-4">
      <div className="flex items-center gap-0">
        {STEP_DEFS.map((step, i) => {
          const state = getStepState(step.id, currentStep)
          const Icon = step.icon
          const isLast = i === STEP_DEFS.length - 1

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-500"
                  style={{
                    background: state === 'completed' ? 'rgba(52,211,153,0.15)'
                             : state === 'active'    ? 'rgba(167,139,250,0.15)'
                             : 'var(--surface-mid)',
                    border: `1px solid ${
                      state === 'completed' ? 'var(--tertiary)'
                    : state === 'active'    ? 'var(--primary)'
                    : 'var(--border)'
                    }`,
                    boxShadow: state === 'active'
                      ? '0 0 16px rgba(167,139,250,0.2)'
                      : 'none',
                  }}
                >
                  {state === 'completed' ? (
                    <Check size={14} style={{ color: 'var(--tertiary)' }} />
                  ) : (
                    <Icon
                      size={14}
                      style={{ color: state === 'active' ? 'var(--primary)' : 'var(--text-muted)' }}
                    />
                  )}
                </div>
                <span
                  className="text-xs font-medium whitespace-nowrap"
                  style={{
                    color: state === 'completed' ? 'var(--tertiary)'
                         : state === 'active'    ? 'var(--primary)'
                         : 'var(--text-muted)',
                  }}
                >
                  {t(step.labelKey)}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 h-px mx-3 mb-5 overflow-hidden rounded-full"
                  style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full transition-all duration-700 ease-out"
                    style={{
                      width: state === 'completed' ? '100%' : '0%',
                      background: 'linear-gradient(90deg, var(--tertiary), var(--primary))',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
