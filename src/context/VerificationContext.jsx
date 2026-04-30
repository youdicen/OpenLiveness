import { createContext, useContext, useState, useCallback } from 'react'

const VerificationContext = createContext(null)

export const STEPS = {
  IDLE: 'IDLE',
  ID_CAPTURE: 'ID_CAPTURE',
  LIVENESS: 'LIVENESS',
  PROCESSING: 'PROCESSING',
  RESULT: 'RESULT',
}

const initialState = {
  step: STEPS.IDLE,
  capturedIDFrame: null,       // base64 image of document
  idFaceROI: null,             // cropped face from document
  capturedLivenessFrame: null, // base64 image from liveness
  livenessData: null,          // { blink: bool, turnLeft: bool, turnRight: bool }
  result: null,                // { similarity, liveness_pass, confidence, latency, verified }
  sessionId: null,
}

export function VerificationProvider({ children }) {
  const [state, setState] = useState(initialState)

  const setStep = useCallback((step) => setState(s => ({ ...s, step })), [])

  const setCapturedID = useCallback((frame, faceROI) => {
    setState(s => ({ ...s, capturedIDFrame: frame, idFaceROI: faceROI }))
  }, [])

  const setLivenessData = useCallback((frame, data) => {
    setState(s => ({ ...s, capturedLivenessFrame: frame, livenessData: data }))
  }, [])

  const setResult = useCallback((result) => {
    setState(s => ({ ...s, result }))
  }, [])

  const reset = useCallback(() => {
    setState({ ...initialState, sessionId: `sess_${Date.now()}` })
  }, [])

  const startSession = useCallback(() => {
    setState(s => ({
      ...s,
      step: STEPS.ID_CAPTURE,
      sessionId: `sess_${Date.now()}`,
    }))
  }, [])

  return (
    <VerificationContext.Provider value={{
      ...state,
      setStep,
      setCapturedID,
      setLivenessData,
      setResult,
      reset,
      startSession,
    }}>
      {children}
    </VerificationContext.Provider>
  )
}

export const useVerification = () => useContext(VerificationContext)
