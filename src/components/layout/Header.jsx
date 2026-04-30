import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../context/I18nContext'
import { Scan, Globe } from 'lucide-react'

const LANGS = ['ES', 'EN', 'FR', 'PT']

export default function Header() {
  const { t, lang, setLang } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const headerRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      ref={headerRef}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4"
    >
      <div
        className="flex items-center justify-between px-5 py-3 rounded-full transition-all duration-300"
        style={{
          background: scrolled
            ? 'rgba(9,9,11,0.85)'
            : 'rgba(12,12,15,0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(39,39,42,0.8)',
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Brand */}
        <a 
          href="/" 
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer"
          title="Recargar página principal"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 border border-primary/30 overflow-hidden p-1.5">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="Open Liveness" className="w-full h-full object-contain" />
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            Open Liveness
          </span>
        </a>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* System status */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
            <span className="status-dot online" />
            <span className="text-xs font-mono text-text-muted">{t('header.status')}</span>
          </div>

          {/* Language switcher */}
          <div className="relative">
            <button
              id="lang-switcher"
              onClick={() => setLangOpen(o => !o)}
              className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Globe size={12} />
              <span className="font-mono">{lang.toUpperCase()}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 rounded-[8px] overflow-hidden"
                style={{ background: 'var(--surface-el)', border: '1px solid var(--border)', minWidth: '80px' }}>
                {LANGS.map(l => (
                  <button
                    key={l}
                    onClick={() => { setLang(l.toLowerCase()); setLangOpen(false) }}
                    className="block w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-surface-high transition-colors"
                    style={{ color: lang === l.toLowerCase() ? 'var(--primary)' : 'var(--text-secondary)' }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
