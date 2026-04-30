/**
 * setup-public.js
 * ----------------
 * Copia los activos binarios de MediaPipe (WASM + .data) a /public/mediapipe/
 * para que la app funcione completamente offline, sin referencias a CDN externo.
 *
 * Se ejecuta automáticamente antes de `npm run dev` y `npm run build`.
 */
import { cpSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const MEDIAPIPE_SRC = resolve(root, 'node_modules/@mediapipe/face_mesh')
const MEDIAPIPE_DEST = resolve(root, 'public/mediapipe')

// Files to copy — only the runtime binaries needed by face_mesh
const MEDIAPIPE_FILES = [
  'face_mesh.binarypb',
  'face_mesh.js',
  'face_mesh_solution_packed_assets.data',
  'face_mesh_solution_packed_assets_loader.js',
  'face_mesh_solution_simd_wasm_bin.data',
  'face_mesh_solution_simd_wasm_bin.js',
  'face_mesh_solution_simd_wasm_bin.wasm',
  'face_mesh_solution_wasm_bin.js',
  'face_mesh_solution_wasm_bin.wasm',
]

mkdirSync(MEDIAPIPE_DEST, { recursive: true })

let copied = 0
for (const file of MEDIAPIPE_FILES) {
  const src = resolve(MEDIAPIPE_SRC, file)
  const dest = resolve(MEDIAPIPE_DEST, file)
  if (existsSync(src)) {
    cpSync(src, dest)
    copied++
  } else {
    console.warn(`  [WARN] No encontrado: ${file}`)
  }
}

console.log(`✓ MediaPipe: ${copied}/${MEDIAPIPE_FILES.length} archivos copiados → public/mediapipe/`)
console.log('✓ Fuentes Geist: servidas desde node_modules (@fontsource-variable)')
console.log('✓ Sin dependencias de red externas.')
