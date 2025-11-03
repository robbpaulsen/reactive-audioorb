# Changelog

## [1.0.0] - 2025-11-03

### Added

-   **Inicialización del Proyecto:** Creación de la estructura inicial del proyecto con Vite y TypeScript.
-   **Visualizador 3D con Three.js:**
    -   Implementación de una escena 3D utilizando `Lit` y `Three.js`.
    -   Creación de un "orbe" central reactivo con geometría de icosaedro y shaders personalizados (GLSL).
    -   Adición de un sistema de partículas dinámico que reacciona a la interacción del mouse.
    -   Implementación de un fondo (backdrop) animado con shaders.
    -   Configuración de efectos de post-procesamiento como `UnrealBloomPass` para un aspecto visual mejorado.
-   **Integración con la API de Gemini:**
    -   Conexión con el modelo `gemini-2.5-flash-native-audio-preview-09-2025` a través de la API de Gemini Live.
    -   Streaming en tiempo real de datos de audio y fotogramas de video (JPEG) al modelo.
    -   Definición de herramientas (`FunctionDeclaration`) que el modelo puede invocar: `setOrbColor`, `triggerPulse`, y `setDeformation`.
    -   Manejo de las respuestas del modelo para controlar dinámicamente las propiedades del orbe 3D (color, pulsos, deformación).
-   **Procesamiento de Audio y Video:**
    -   Carga y reproducción de archivos locales de audio y video.
    -   Uso de `AnalyserNode` para analizar los datos de frecuencia del audio en tiempo real.
    -   Extracción de fotogramas de video para ser enviados al modelo.
-   **Interfaz de Usuario (UI):**
    -   Creación de un componente principal `gdm-live-audio` con Lit.
    -   Implementación de controles para la selección de archivos y la detención del procesamiento.
    -   Adición de un selector de temas con múltiples paletas de colores predefinidas (Default, Catppuccin, Tokyonight, etc.).
    -   Visualización del estado actual de la aplicación (ej. "procesando", "detenido", errores).
-   **Configuración y Documentación:**
    -   Configuración del entorno de desarrollo con variables de entorno (`.env.local`) para la clave de API.
    -   Creación del archivo `README.md` con instrucciones detalladas de instalación y uso.
