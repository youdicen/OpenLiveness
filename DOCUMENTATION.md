# Open Liveness — Reporte de Documentación Técnica

## Resumen Ejecutivo
**Open Liveness** es una solución avanzada de verificación de identidad biométrica de código abierto. El sistema está diseñado bajo el principio de "Seguridad y Privacidad First", permitiendo la validación de la identidad de un usuario a través de una captura de documento y una prueba de vida activa, todo con una **arquitectura stateless** (sin estado). Esto significa que ningún dato biométrico es almacenado permanentemente; toda la información se procesa en tiempo real y se descarta inmediatamente tras emitir un veredicto.

El sistema fue diseñado como un "instrumento digital" enfocado en alta fidelidad y un flujo riguroso "1:1 Pixel Perfect", eliminando la fricción y operando en entornos locales u offline sin depender de APIs de terceros (todo el procesamiento ML se ejecuta dentro del entorno provisto).

---

## 🏗 Arquitectura del Sistema

La aplicación está dividida en dos componentes principales:
1. **Frontend (React + Vite + GSAP):** Interfaz altamente pulida que guía al usuario, realiza capturas (documento y video) y preprocesa cálculos de liveness a nivel de navegador.
2. **Backend (Python FastAPI + ONNX):** Motor robusto que ejecuta las validaciones intensivas mediante modelos de visión artificial e inferencia de Machine Learning local.

### El Flujo de Verificación (3 Pasos)
1. **Captura de Documento:** El usuario alinea su documento de identidad (ej. DPI o Pasaporte) frente a la cámara. El frontend asiste con telemetría visual sobre distancia e iluminación.
2. **Prueba de Vida Activa (Liveness):** Se requiere que la persona interactúe con el sistema frente a la cámara (ej. girar la cabeza, parpadear). 
3. **Análisis de Resultados:** El backend consolida los datos de ambas fases y devuelve un veredicto a través de una interfaz detallada.

---

## 🛡️ Tres Capas de Defensa Anti-Spoofing

El núcleo tecnológico de Open Liveness reside en su esquema estricto de triple verificación. **Para ser aprobado, un usuario debe superar obligatoriamente las tres capas**.

### Capa 1: Análisis Topológico Z-Depth (Navegador)
*   **Módulo:** `MediaPipe FaceMesh` en el Frontend (`useLiveness.js`).
*   **Mecanismo:** El sistema mapea 468 landmarks (puntos faciales) en 3D directamente desde el navegador. Se calcula la desviación estándar del eje Z (profundidad).
*   **Objetivo:** Distinguir rostros humanos reales (alta varianza volumétrica) de fotografías impresas o pantallas planas (baja o nula profundidad).
*   **Umbral:** Desviación Z `≥ 0.018`.

### Capa 2: Detección de Texturas LCD por FFT (Servidor)
*   **Módulo:** Servidor Python (`NumPy`, Análisis en el dominio de frecuencias).
*   **Mecanismo:** Utiliza la Transformada Rápida de Fourier (FFT) para identificar periodicidades de alta frecuencia.
*   **Objetivo:** Evitar el "Screen Spoofing" (mostrar una pantalla frente a la cámara). Las pantallas LCD/OLED generan patrones geométricos de píxeles altamente regulares. La piel humana y orgánica distribuye su energía visual de forma natural hacia bajas frecuencias.
*   **Umbral:** Ratio de centralidad FFT `≥ 0.70` (Mucha energía fuera del centro implica presencia de píxeles/mallas digitales).

### Capa 3: Cotejo Biométrico 1:1 (Servidor)
*   **Módulo:** Servidor Python (`InsightFace` + Modelo `buffalo_sc` vía `ONNXRuntime`).
*   **Mecanismo:** Convierte tanto la foto del documento como una captura limpia del usuario en vectores matemáticos de 512 dimensiones (embeddings). 
*   **Objetivo:** Validar que la persona que realiza la prueba de vida es exactamente la misma que figura en el documento de identidad oficial.
*   **Umbral:** Similitud Coseno `≥ 0.30`.

---

## 💻 Pila Tecnológica

### Frontend
*   **Framework:** React 19 + Vite.
*   **Estilos:** Tailwind CSS v3.4.17.
*   **Animaciones:** GSAP 3 (ScrollTrigger) - Proporciona físicas de movimiento pesadas, transiciones tipo "capa" y sensación magnética para transformar un simple formulario en un instrumento clínico.
*   **Localización (i18n):** Contexto nativo para soporte fluido y dinámico en Español (ES), Inglés (EN), Francés (FR) y Portugués (PT).

### Backend
*   **Framework:** FastAPI + Uvicorn.
*   **Inferencia ML:** `onnxruntime` y `insightface`. Al prescindir de dependencias pesadas como TensorFlow, el servidor corre de forma altamente eficiente, exclusivamente en CPU y es compatible con versiones modernas de Python (3.14).
*   **Procesamiento de Imágenes:** OpenCV (`cv2`) y Pillow.

---

## 🎨 Principios de Diseño y Estética

La interfaz gráfica opera bajo un perfil estético riguroso denominado **"Organic Tech / Midnight Luxe"**:
*   **Identidad:** Visualmente posicionado entre un laboratorio de investigación y una plataforma de alta seguridad. El uso de colores es calculado (Verde "Musgo", rojo "Señal" y carbón obsidiana).
*   **Telemetría:** La interfaz muestra datos precisos de forma transparente. Componentes estilo *Shufflers* de números, Typewriters y cursores parpadeantes aumentan la percepción de densidad y rigor técnico.
*   **Sin Distracciones:** Libre de enlaces innecesarios o salidas de escape (ej. links a GitHub o logos distractores redundantes) enfocando al usuario el 100% en el proceso de verificación.

---

## 🔒 Privacidad y Cumplimiento
Open Liveness es intrínsecamente seguro por diseño:
*   **Zero-Knowledge Storage:** El backend procesa objetos (imágenes, metadatos) en memoria RAM y al retornar el `200 OK` (o rechazo), todos los búferes se liberan.
*   **No se guardan logs fotográficos** en el disco del servidor.
*   Cumple de manera inherente con los esquemas rigurosos de GDPR relativos al manejo y almacenamiento de biometría.

## 🚀 Cómo Ejecutar

1. **Frontend:**
   ```bash
   npm install
   npm run dev
   ```

2. **Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python -m uvicorn main:app --reload --port 8000
   ```
   *(Nota: En la primera ejecución, InsightFace descargará el modelo de 100MB).*
