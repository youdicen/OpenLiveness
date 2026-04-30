import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/OpenLiveness/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  // Allow Vite to process WASM and .data binary files
  assetsInclude: ['**/*.wasm', '**/*.data'],
  optimizeDeps: {
    // Let Vite pre-bundle mediapipe CJS modules → ESM so named exports work
    include: ['@mediapipe/face_mesh'],
  },
})
