import { createContext, useContext, useState, useEffect } from 'react'
import es from '../locales/es.json'
import en from '../locales/en.json'
import fr from '../locales/fr.json'
import pt from '../locales/pt.json'

const locales = { es, en, fr, pt }

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('es')

  const t = (key) => {
    const keys = key.split('.')
    let val = locales[lang]
    for (const k of keys) {
      val = val?.[k]
    }
    return val ?? key
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
