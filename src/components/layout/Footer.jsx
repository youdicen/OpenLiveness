import { useI18n } from '../../context/I18nContext'
import { Github, Lock, Zap } from 'lucide-react'

export default function Footer() {
  const { t } = useI18n()

  return (
    <footer className="border-t border-border-subtle py-5 px-6">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status */}
        <div className="flex items-center gap-2.5">
          <span className="status-dot online" />
          <span className="text-xs font-mono text-text-muted">{t('footer.status')}</span>
          <span className="text-border">|</span>
          <span className="text-xs font-mono text-text-muted">{t('footer.version')}</span>
        </div>

        {/* Privacy notice */}
        <div className="flex items-center gap-1.5">
          <Lock size={11} className="text-text-muted" />
          <span className="text-xs text-text-muted text-center">{t('footer.privacy')}</span>
        </div>

        {/* Tech stack */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-primary" />
            <span className="text-xs font-mono text-text-muted">{t('footer.tech')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
