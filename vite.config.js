import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // En dev: redirige /api/* y /health → backend Python en localhost:8000
    // En prod (Docker): FastAPI sirve /api/* directamente — proxy no aplica
    proxy: {
      '/api':    { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  // Allow Vite to process WASM and .data binary files
  assetsInclude: ['**/*.wasm', '**/*.data'],
  optimizeDeps: {
    // Let Vite pre-bundle mediapipe CJS modules → ESM so named exports work
    include: ['@mediapipe/face_mesh'],
  },
})
