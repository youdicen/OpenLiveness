/**
 * API Configuration — Open Liveness
 *
 * Producción (Railway):  API_BASE = '' → fetch('/api/verify') — mismo origen, sin CORS
 * Desarrollo (local):    API_BASE = '' → Vite proxy reenvía /api/* → localhost:8000
 *
 * VITE_API_URL puede setearse para split-deployment futuro si se necesita.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
