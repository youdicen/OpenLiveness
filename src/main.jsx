import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './context/I18nContext'
import { VerificationProvider } from './context/VerificationContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <VerificationProvider>
        <App />
      </VerificationProvider>
    </I18nProvider>
  </StrictMode>,
)
