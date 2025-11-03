# Integración de Gemini

Este documento describe cómo se utiliza la API de Google Gemini en el proyecto Reactive AudioOrb.

## Modelo Utilizado

-   **Nombre del Modelo:** `gemini-2.5-flash-native-audio-preview-09-2025`
-   **API:** Gemini Live (`@google/genai`)

## Funcionalidad Principal

La integración con Gemini es el núcleo de la funcionalidad reactiva de la aplicación. Se establece una sesión de streaming bidireccional con el modelo para analizar contenido multimedia en tiempo real y generar respuestas que controlan la visualización.

1.  **Conexión en Tiempo Real:** La aplicación utiliza `client.live.connect` para establecer una conexión persistente con el modelo. Esta sesión permanece abierta mientras se procesa un archivo.

2.  **Entrada Multimedia (Input):**
    -   **Audio:** Los datos de audio del archivo seleccionado se capturan, se procesan y se envían al modelo en un flujo continuo.
    -   **Video:** Para los archivos de video, se extraen fotogramas a una velocidad de 2 FPS. Cada fotograma se convierte a formato JPEG y se envía al modelo.

3.  **Salida del Modelo (Output):**
    -   **Llamadas a Herramientas (Tool Calling):** El modelo no responde con texto, sino invocando un conjunto de funciones predefinidas que la aplicación le proporciona. Estas funciones son el mecanismo principal para controlar la visualización.
    -   **Audio Generado:** El modelo también tiene la capacidad de generar audio (voz), que se reproduce en la aplicación.

## Herramientas (Tool Calling)

Se han definido las siguientes funciones para que el modelo las utilice:

-   `setOrbColor(hex: string)`: Cambia el color base del orbe 3D. El modelo elige un color basándose en el ambiente del audio o los colores predominantes en el video.
-   `triggerPulse(intensity: number, duration: number)`: Activa un efecto de pulso visual en el orbe. Es ideal para acentuar ritmos, golpes de batería o eventos visuales importantes.
-   `setDeformation(amplitude: number, frequency: number, speed: number)`: Controla la geometría del orbe.
    -   `amplitude`: La intensidad de la deformación.
    -   `frequency`: La complejidad o detalle de la superficie.
    -   `speed`: La velocidad con la que se animan los patrones de la superficie.

## Instrucción del Sistema (System Instruction)

Para guiar el comportamiento del modelo, se utiliza una instrucción de sistema que lo define como una "inteligencia visual creativa". Se le indica cómo debe interpretar la entrada multimedia y cómo utilizar las herramientas disponibles para crear una experiencia visual sincronizada y atractiva. También se le informa sobre las paletas de colores disponibles en el tema actual para que sus elecciones de color sean coherentes.
