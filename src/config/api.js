/**
 * API Configuration — Open Liveness
 *
 * En desarrollo: apunta a http://localhost:8000 (backend local)
 * En producción: usa la variable de entorno VITE_API_URL inyectada por Railway
 *
 * Nunca hardcodear la URL directamente en los componentes.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
