# Reactive AudioOrb

Este proyecto es un visualizador de audio 3D interactivo que reacciona en tiempo real a la entrada de audio y video. Utiliza la API de Gemini para analizar el contenido multimedia y generar efectos visuales dinámicos en un "orbe" 3D, todo renderizado en el navegador con Three.js.

## Descripción Detallada

El núcleo de la aplicación es un orbe 3D cuya apariencia y comportamiento son controlados por un modelo de IA de Gemini. El modelo recibe un flujo constante de datos de audio y fotogramas de video de un archivo seleccionado por el usuario. En respuesta, la IA puede invocar un conjunto de funciones predefinidas para:

- **Cambiar el color del orbe** (`setOrbColor`): Ajusta el color base del orbe.
- **Crear pulsos visuales** (`triggerPulse`): Genera un pulso de luz temporal, ideal para sincronizarse con los ritmos de la música.
- **Deformar la geometría del orbe** (`setDeformation`): Modifica la forma del orbe, ajustando la amplitud, frecuencia y velocidad de la deformación para crear efectos que van desde ondulaciones suaves hasta patrones caóticos y complejos.

El resultado es una experiencia visual única y cautivadora que se sincroniza dinámicamente con cualquier archivo de audio o video.

## Instalación

Para ejecutar este proyecto localmente, sigue estos pasos:

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/reactive-audioorb.git
    cd reactive-audioorb
    ```

2.  **Instala las dependencias:**
    Necesitarás tener [Node.js](https://nodejs.org/) instalado.
    ```bash
    npm install
    ```

3.  **Configura tu clave de API:**
    - Renombra el archivo `.env.local.example` a `.env.local`.
    - Abre `.env.local` y reemplaza `YOUR_API_KEY` con tu clave de la API de Google Gemini.

4.  **Inicia el servidor de desarrollo:**
    ```bash
    npm run dev
    ```
    Esto iniciará un servidor local y abrirá la aplicación en tu navegador.

## Uso

Una vez que la aplicación esté en funcionamiento en tu navegador:

1.  **Selecciona un archivo:** Haz clic en el botón "📂 Select File" y elige un archivo de audio o video de tu computadora.
2.  **Observa la visualización:** La aplicación comenzará a procesar el archivo inmediatamente. Verás un orbe 3D que reacciona al sonido y al contenido visual del archivo. Si es un video, se mostrará en la parte superior.
3.  **Cambia el tema de color:** Puedes seleccionar diferentes paletas de colores desde el menú desplegable.
4.  **Detén el procesamiento:** Para detener la visualización y seleccionar otro archivo, haz clic en "⏹️ Stop Processing".

## Dependencias Principales

El proyecto se basa en las siguientes bibliotecas y tecnologías:

-   **Lit**: Para crear componentes web ligeros y reactivos.
-   **Three.js**: Para el renderizado de gráficos 3D en el navegador.
-   **@google/genai**: Para la integración con la API de Gemini.
-   **Vite**: Como herramienta de construcción y servidor de desarrollo.

Para una lista completa, consulta el archivo `package.json`.

## Estructura del Proyecto

A continuación se muestra un resumen de los archivos clave del proyecto:

-   `index.html`: El punto de entrada principal de la aplicación.
-   `index.tsx`: Contiene la lógica principal de la aplicación, manejo de la interfaz de usuario, la interacción con la API de Gemini y la gestión del estado.
-   `visual-3d.ts`: El componente Lit encargado de renderizar y animar la escena 3D con Three.js. Define el orbe, las partículas y los efectos de postprocesamiento.
-   `analyser.ts`: Una clase de utilidad para analizar los datos de frecuencia del audio en tiempo real.
-   `sphere-shader.ts` / `backdrop-shader.ts`: Contienen los shaders GLSL personalizados para la apariencia del orbe y el fondo, respectivamente.
-   `vite.config.ts`: Configuración para el servidor de desarrollo y el proceso de construcción de Vite.
-   `package.json`: Define los scripts del proyecto y gestiona las dependencias de Node.js.