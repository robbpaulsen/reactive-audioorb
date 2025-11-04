# 🔮 Reactive AudioOrb: Una Aventura Audiovisual con IA

¡Hola! Te damos la bienvenida a **Reactive AudioOrb**, una experiencia audiovisual revolucionaria que fusiona arte, música y la inteligencia artificial más avanzada. Este no es solo un visualizador; es un lienzo digital donde tus archivos de audio y video cobran vida, transformándose en una hipnótica obra de arte en 3D que reacciona en tiempo real.

Imagina una esfera pulsante que cambia de color con la melancolía de un piano, se deforma con la energía de un beat electrónico y brilla al ritmo de los fotogramas de tu video favorito. Eso es Reactive AudioOrb, una creación posible gracias a las tecnologías web más modernas y el poder de la IA de Google Gemini.

![Versión](https://img.shields.io/badge/versión-2.0.0-blue.svg?style=for-the-badge)
![Estado](https://img.shields.io/badge/estado-estable-success.svg?style=for-the-badge)
![IA](https://img.shields.io/badge/IA-Gemini%202.5%20Flash-purple.svg?style=for-the-badge)

## ✨ ¿Qué es Reactive AudioOrb y Cómo Funciona?

En el corazón de este proyecto se encuentra una idea simple pero poderosa: **hacer que la música y el video se puedan "ver" y "sentir" de una forma completamente nueva**. Para lograrlo, combinamos varias tecnologías de vanguardia:

1.  **Análisis con Inteligencia Artificial:** Utilizamos el modelo **Gemini 2.5 Flash de Google**, una IA capaz de procesar audio y video en tiempo real. La aplicación establece una conexión directa con el modelo y le envía un flujo constante de datos: el audio de tu canción o las imágenes (fotogramas) de tu video.

2.  **Interpretación Creativa:** Gemini no solo "escucha" o "mira", sino que "interpreta". Gracias a una instrucción de sistema cuidadosamente diseñada, el modelo actúa como una "inteligencia visual creativa". Analiza el ambiente, el ritmo, la melodía, los colores y la intensidad del contenido multimedia.

3.  **Control del Orbe 3D:** Basándose en su análisis, la IA toma decisiones y las comunica a la aplicación mediante un sistema de "llamada a funciones" (Tool Calling). En lugar de devolver texto, invoca comandos específicos para controlar el orbe:
    *   `setOrbColor(hex)`: Cambia el color del orbe para reflejar el ambiente.
    *   `triggerPulse(intensity, duration)`: Crea un pulso de luz para acentuar ritmos o eventos importantes.
    *   `setDeformation(amplitude, frequency, speed)`: Modifica la forma del orbe, desde una esfera perfecta hasta una forma caótica y compleja.

4.  **Renderizado en Tiempo Real:** Un motor 3D construido con **Three.js** se encarga de dibujar el orbe, un fondo estrellado y un sistema de partículas. Este motor recibe los comandos de la IA y los traduce en transformaciones visuales fluidas y espectaculares a 60 fotogramas por segundo.

El resultado es una simbiosis única entre tu contenido multimedia, la inteligencia artificial y el arte generativo.

## 🛠️ Arquitectura y Tecnologías

Este proyecto es un escaparate de lo que es posible en la web moderna. Aquí tienes un vistazo a los componentes clave:

| Componente          | Tecnología                  | Propósito                                                               |
| ------------------- | --------------------------- | ----------------------------------------------------------------------- |
| **Interfaz (UI)**   | Lit Elements + TypeScript   | Componentes web modernos, reactivos y eficientes.                       |
| **Motor 3D**        | Three.js + GLSL Shaders     | Renderizado 3D de alto rendimiento en el navegador.                     |
| **Inteligencia IA** | Google Gemini 2.5 Flash     | Análisis inteligente y en tiempo real de audio y video.                 |
| **Procesamiento Audio** | Web Audio API               | Captura y análisis de frecuencias de audio directamente en el navegador. |
| **Build Tool**      | Vite                        | Entorno de desarrollo ultrarrápido y empaquetado optimizado.            |
| **Estilos**         | CSS Custom Properties       | Un sistema dinámico para crear y cambiar temas de color fácilmente.     |

### 🏗️ Estructura del Proyecto

Si sientes curiosidad por el código, aquí tienes un mapa para navegar por el proyecto:

```
reactive-audioorb/
├── 📄 index.html          # El punto de entrada de la aplicación.
├── ⚛️ index.tsx           # El componente principal de Lit que gestiona la UI y la lógica de la IA.
├── 🎨 index.css           # Estilos generales de la aplicación.
├── 🔮 visual-3d.ts        # ¡La magia del 3D! Aquí vive la escena de Three.js, el orbe y las partículas.
├── 🎵 analyser.ts         # Una clase de ayuda para analizar los datos de frecuencia del audio.
├── 🛠️ utils.ts            # Funciones útiles para codificar/decodificar audio y otros datos.
├── 🌊 sphere-shader.ts    # El código (GLSL) que define la apariencia y deformación del orbe.
├── 🌌 backdrop-shader.ts  # El código (GLSL) para el fondo estrellado y dinámico.
├── ⚡ vite.config.ts      # Configuración del entorno de desarrollo de Vite.
├── 📦 package.json        # Dependencias y scripts del proyecto.
└── 🔑 .env.local          # Donde guardarás tu clave de API de Gemini (¡no la compartas!).
```

## 🚀 Guía de Instalación y Uso

¿Quieres probarlo en tu propia máquina? ¡Es muy fácil!

### Prerrequisitos

*   **Node.js** (versión 18 o superior).
*   Una **Clave de API de Google Gemini**. Puedes obtener una gratis en [Google AI Studio](https://aistudio.google.com/app/apikey).
*   Un navegador moderno compatible con WebGL (Chrome, Firefox, Edge).

### Pasos de Instalación

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/reactive-audioorb.git
    cd reactive-audioorb
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Configura tu clave de API:**
    Crea un archivo llamado `.env.local` en la raíz del proyecto y añade tu clave de API de Gemini:
    ```
    GEMINI_API_KEY=TU_CLAVE_DE_API_AQUÍ
    ```

4.  **Inicia el servidor de desarrollo:**
    ```bash
    npm run dev
    ```

¡Y listo! La aplicación se abrirá en `http://localhost:3000` en tu navegador.

### 🎮 ¿Cómo se Usa?

1.  **Elige un Tema:** Comienza seleccionando una de las paletas de colores predefinidas. Cada una ofrece una atmósfera diferente.
2.  **Sube tu Archivo:** Haz clic en el botón para seleccionar un archivo de audio (MP3, WAV, etc.) o de video (MP4, WebM, etc.) de tu computadora.
3.  **Disfruta la Magia:** La aplicación comenzará a procesar el archivo inmediatamente. Verás cómo el orbe cobra vida, reaccionando a cada nota, ritmo y cambio de escena.
4.  **Interactúa:** Mueve el ratón por la pantalla para influir en el sistema de partículas y la cámara. ¡Tú también eres parte de la experiencia!
5.  **Detente cuando quieras:** Usa los controles flotantes para detener la visualización o para entrar/salir del modo de pantalla completa.

## 🧠 Profundizando en la Audio-Reactividad

La verdadera innovación de Reactive AudioOrb es cómo la IA abre nuevas puertas para la visualización de contenido.

### ¿Qué Funcionalidades Cumple?

*   **Visualización Emocional:** A diferencia de los visualizadores tradicionales que solo reaccionan al volumen o a las frecuencias graves, la IA puede interpretar el "sentimiento" de la música. Una balada triste puede generar colores suaves y movimientos lentos, mientras que una canción de rock puede provocar pulsos rápidos y deformaciones agresivas.
*   **Sincronización Inteligente:** La IA identifica los momentos clave. Puede sincronizar un pulso de luz con un golpe de batería, un cambio de color con un nuevo verso, o una deformación compleja con un solo de guitarra.
*   **Análisis de Video Contextual:** Para los videos, la IA no solo reacciona al audio. También analiza los colores predominantes en cada fotograma y puede hacer que el orbe los refleje. Un atardecer en un video puede teñir el orbe de tonos naranjas y rojos.

### ¿Qué Puertas Abre para el Futuro?

Este proyecto es solo la punta del iceberg. La capacidad de una IA para interpretar contenido multimedia en tiempo real abre un universo de posibilidades:

*   **Experiencias Interactivas Personalizadas:** Imagina un orbe que no solo reacciona a la música, sino también a tu ritmo cardíaco a través de un smartwatch, o a tu estado de ánimo a través de una cámara.
*   **Arte Generativo Infinito:** La IA podría recibir instrucciones más complejas, como "crea una visualización que se sienta como un sueño" o "genera un paisaje visual inspirado en el océano", y utilizar las herramientas para crear experiencias completamente nuevas y únicas cada vez.
*   **Herramientas para Artistas y Músicos:** Los músicos podrían usar esta tecnología para generar videos musicales automáticos para sus canciones, o los VJs podrían integrarla en sus sets en vivo para crear visuales que reaccionen de forma inteligente a su música.
*   **Accesibilidad:** Para personas con discapacidad auditiva, esta tecnología podría ofrecer una forma rica y matizada de "sentir" la música a través de la vista.

Reactive AudioOrb es un experimento, una invitación a explorar el futuro de la interacción entre humanos, arte y máquinas. ¡Esperamos que lo disfrutes y te inspire tanto como a nosotros nos inspiró crearlo!

---

<div align="center">

**🌟 Hecho con ❤️ para la comunidad del arte audiovisual 🌟**

[⭐ Dale una estrella a este repo](https://github.com/tu-usuario/reactive-audioorb) • [🐛 Reportar un Bug](https://github.com/tu-usuario/reactive-audioorb/issues) • [💡 Solicitar una Característica](https://github.com/tu-usuario/reactive-audioorb/issues)

</div>