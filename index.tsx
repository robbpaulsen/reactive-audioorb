/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
  Type,
} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {blobToBase64, createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';

// Define the functions the model can call
const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'setOrbColor',
    parameters: {
      type: Type.OBJECT,
      description: 'Set the base color of the orb.',
      properties: {
        hex: {
          type: Type.STRING,
          description: 'The color in hexadecimal format, e.g., "#FF5733".',
        },
      },
      required: ['hex'],
    },
  },
  {
    name: 'triggerPulse',
    parameters: {
      type: Type.OBJECT,
      description:
        'Trigger a temporary visual pulse effect on the orb, great for beats.',
      properties: {
        intensity: {
          type: Type.NUMBER,
          description: 'The strength of the pulse, from 0.1 to 1.0.',
        },
        duration: {
          type: Type.NUMBER,
          description: 'The duration of the pulse in milliseconds.',
        },
      },
      required: ['intensity', 'duration'],
    },
  },
  {
    name: 'setDeformation',
    parameters: {
      type: Type.OBJECT,
      description: 'Set the geometric deformation parameters of the orb.',
      properties: {
        amplitude: {
          type: Type.NUMBER,
          description:
            'The intensity of the deformation, from 0.0 (sphere) to 2.0 (chaotic).',
        },
        frequency: {
          type: Type.NUMBER,
          description:
            'The complexity and detail of the surface, from 1.0 (smooth) to 10.0 (intricate).',
        },
        speed: {
          type: Type.NUMBER,
          description:
            'The animation speed of the surface patterns, from 0.1 (slow) to 2.0 (fast).',
        },
      },
      required: ['amplitude', 'frequency', 'speed'],
    },
  },
];

const themes = {
  default: {
    name: 'Default',
    colors: ['#aaaaff', '#ffaaaa', '#aaffaa', '#aaffff', '#ffaaff'],
  },
  catppuccin: {
    name: 'Catppuccin',
    colors: ['#cba6f7', '#b4befe', '#89dceb', '#a6e3a1', '#fab387'],
  },
  tokyonight: {
    name: 'Tokyonight',
    colors: ['#7aa2f7', '#bb9af7', '#9ece6a', '#e0af68', '#f7768e'],
  },
  poimandres: {
    name: 'Poimandres',
    colors: ['#add7ff', '#5de4c7', '#fffac2', '#d0679d'],
  },
  eldritch: {
    name: 'Eldritch',
    colors: ['#5D3A9B', '#4E878C', '#3A6B35', '#8C271E'],
  },
  halcyon: {
    name: 'Halcyon',
    colors: ['#94e2d5', '#f5c2e7', '#cba6f7', '#fab387'],
  },
};

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isProcessing = false;
  @state() status = 'Select an audio or video file to begin.';
  @state() error = '';
  @state() private isDarkMode = window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches;
  @state() private ambientBrightness = 0.5;
  @state() private currentTheme = 'default';

  // Orb control states, modified by function calls
  @state() private orbColor = themes.default.colors[0]; // Default color
  @state() private pulseIntensity = 0.0;
  @state() private orbAmplitude = 0.5;
  @state() private orbFrequency = 3.0;
  @state() private orbSpeed = 0.5;

  // Model generation parameters
  @state() private temperature = 0.7;
  @state() private topK = 20;
  @state() private topP = 0.8;

  private client: GoogleGenAI;
  private sessionPromise: Promise<Session>;
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();

  private mediaElement: HTMLVideoElement | HTMLAudioElement;
  private mediaSourceNode: MediaElementAudioSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private frameGrabberInterval: number;
  private frameCanvas: HTMLCanvasElement;
  private brightnessCanvas: HTMLCanvasElement;
  private splitterNode: ChannelSplitterNode;

  static styles = css`
    #media-container {
      position: absolute;
      top: 5vh;
      left: 50%;
      transform: translateX(-50%);
      width: 80%;
      max-width: 640px;
      z-index: 5;
    }

    #media-container video,
    #media-container audio {
      width: 100%;
      border-radius: 8px;
    }

    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      font-family: sans-serif;
      color: white;
      text-shadow: 0 0 4px black;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;
    }

    button,
    .file-label,
    .theme-select {
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 99px;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      height: 50px;
      cursor: pointer;
      font-size: 16px;
      padding: 0 20px;
      margin: 0;
      transition: background 0.2s ease;
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 220px;
    }

    button:hover,
    .file-label:hover,
    .theme-select:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .file-input {
      width: 0.1px;
      height: 0.1px;
      opacity: 0;
      overflow: hidden;
      position: absolute;
      z-index: -1;
    }

    .theme-select {
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
      background-repeat: no-repeat;
      background-position: right 20px top 50%;
      background-size: 0.65em auto;
      padding-right: 40px;
    }
  `;

  constructor() {
    super();
    this.initClient();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      this.isDarkMode = e.matches;
    });
  }

  private async initClient() {
    this.client = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });
    this.initSession();
  }

  private initSession() {
    const model = 'gemini-2.5-flash-native-audio-preview-09-2025';
    const currentThemeData = themes[this.currentTheme];
    const availableColors = currentThemeData.colors.join(', ');

    this.sessionPromise = this.client.live.connect({
      model: model,
      callbacks: {
        onopen: () => {
          this.updateStatus('Session opened');
        },
        onmessage: async (message: LiveServerMessage) => {
          const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData;
          if (audio) {
            const audioBuffer = await decodeAudioData(
              decode(audio.data),
              this.outputAudioContext,
              24000,
              1,
            );
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputNode);
            source.start();
          }

          if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
              const result = this.handleFunctionCall(fc.name, fc.args);
              this.sessionPromise.then((session) => {
                session.sendToolResponse({
                  functionResponses: {
                    id: fc.id,
                    name: fc.name,
                    response: {result},
                  },
                });
              });
            }
          }
        },
        onerror: (e: ErrorEvent) => {
          this.updateError(e.message);
        },
        onclose: (e: CloseEvent) => {
          this.updateStatus('Session closed.');
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Zephyr'}},
        },
        tools: [{functionDeclarations}],
        systemInstruction: `You are a creative visual intelligence. As you process incoming audio and video, use the provided tools to control a visual orb to match the mood and events. Be creative and responsive. Use 'setDeformation' to control the shape: 'amplitude' for intensity, 'frequency' for detail, and 'speed' for animation. For example, calm music might have low amplitude and speed, while intense electronic music might have high amplitude and frequency. Use 'setOrbColor' to match the video's colors or the music's mood, choosing from the current theme's palette: ${availableColors}. Use 'triggerPulse' for sharp beats or visual flashes. Combine these tools to create a compelling, synchronized visual experience.`,
        topK: this.topK,
        topP: this.topP,
        temperature: this.temperature,
      },
    });

    this.sessionPromise.catch((e) => {
      this.updateError(e.message);
    });
  }

  private handleFunctionCall(name: string, args: any): string {
    switch (name) {
      case 'setOrbColor':
        this.orbColor = args.hex;
        return `Color set to ${args.hex}`;
      case 'triggerPulse':
        this.pulseIntensity = args.intensity;
        setTimeout(() => (this.pulseIntensity = 0), args.duration);
        return `Pulse triggered with intensity ${args.intensity}`;
      case 'setDeformation':
        this.orbAmplitude = args.amplitude;
        this.orbFrequency = args.frequency;
        this.orbSpeed = args.speed;
        return `Deformation set to amp ${args.amplitude}, freq ${args.frequency}, speed ${args.speed}`;
      default:
        return 'Unknown function';
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
    this.error = '';
  }

  private updateError(msg: string) {
    this.error = msg;
    this.status = `Error: ${msg}`;
  }

  private async handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const fileUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');

    await this.stopProcessing(); // Stop any previous playback
    this.startProcessing(fileUrl, isVideo);
  }

  private async startProcessing(mediaUrl: string, isVideo: boolean) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.updateStatus('Initializing...');

    const oldSession = await this.sessionPromise.catch(() => null);
    oldSession?.close();
    this.initSession();

    this.updateStatus('Processing file...');
    this.inputAudioContext.resume();
    this.outputAudioContext.resume();

    // Setup media element and audio pipeline
    const mediaContainer =
      this.shadowRoot!.querySelector<HTMLDivElement>('#media-container')!;
    mediaContainer.innerHTML = '';
    this.mediaElement = document.createElement(isVideo ? 'video' : 'audio');
    this.mediaElement.src = mediaUrl;
    this.mediaElement.controls = true;
    this.mediaElement.autoplay = true;
    this.mediaElement.onended = () => this.stopProcessing();
    mediaContainer.appendChild(this.mediaElement);

    this.mediaSourceNode =
      this.inputAudioContext.createMediaElementSource(this.mediaElement);

    // Route source media audio to speakers for playback.
    this.mediaSourceNode.connect(this.inputAudioContext.destination);

    const bufferSize = 4096;
    this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
      bufferSize,
      1,
      1,
    );

    this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
      const pcmData = audioProcessingEvent.inputBuffer.getChannelData(0);
      this.sessionPromise.then((session) => {
        session.sendRealtimeInput({media: createBlob(pcmData)});
      });
    };

    this.splitterNode = this.inputAudioContext.createChannelSplitter(2);
    this.mediaSourceNode.connect(this.splitterNode);
    this.splitterNode.connect(this.scriptProcessorNode, 0);

    const zeroGain = this.inputAudioContext.createGain();
    zeroGain.gain.setValueAtTime(0, this.inputAudioContext.currentTime);
    this.scriptProcessorNode.connect(zeroGain);
    zeroGain.connect(this.inputAudioContext.destination);

    this.mediaSourceNode.connect(this.inputNode);

    if (isVideo) {
      this.frameCanvas = document.createElement('canvas');
      this.brightnessCanvas = document.createElement('canvas');
      this.brightnessCanvas.width = 1;
      this.brightnessCanvas.height = 1;
      const videoEl = this.mediaElement as HTMLVideoElement;
      const frameCtx = this.frameCanvas.getContext('2d');
      const brightnessCtx = this.brightnessCanvas.getContext('2d', {
        willReadFrequently: true,
      });
      const FRAME_RATE = 2; // 2fps

      this.frameGrabberInterval = window.setInterval(() => {
        if (videoEl.paused || videoEl.ended) return;
        if (videoEl.readyState < videoEl.HAVE_CURRENT_DATA) return;

        if (brightnessCtx) {
          brightnessCtx.drawImage(videoEl, 0, 0, 1, 1);
          const pixelData = brightnessCtx.getImageData(0, 0, 1, 1).data;
          this.ambientBrightness =
            (0.299 * pixelData[0] +
              0.587 * pixelData[1] +
              0.114 * pixelData[2]) /
            255;
        }

        this.frameCanvas.width = videoEl.videoWidth;
        this.frameCanvas.height = videoEl.videoHeight;
        frameCtx!.drawImage(
          videoEl,
          0,
          0,
          videoEl.videoWidth,
          videoEl.videoHeight,
        );
        this.frameCanvas.toBlob(
          async (blob) => {
            if (blob) {
              const base64Data = await blobToBase64(blob);
              this.sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: {data: base64Data, mimeType: 'image/jpeg'},
                });
              });
            }
          },
          'image/jpeg',
          0.8,
        );
      }, 1000 / FRAME_RATE);
    } else {
      this.ambientBrightness = 0.5;
    }

    this.mediaElement
      .play()
      .catch((e) => this.updateError(`Playback failed: ${e.message}`));
  }

  private async stopProcessing() {
    if (!this.isProcessing && !this.mediaElement) return;

    this.updateStatus('Stopping...');
    this.isProcessing = false;
    this.ambientBrightness = 0.5;

    if (this.mediaElement) {
      this.mediaElement.pause();
      const mediaContainer =
        this.shadowRoot!.querySelector<HTMLDivElement>('#media-container')!;
      mediaContainer.innerHTML = '';
      this.mediaElement = null;
    }

    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode = null;
    }

    if (this.splitterNode) {
      this.splitterNode.disconnect();
      this.splitterNode = null;
    }

    if (this.mediaSourceNode) {
      this.mediaSourceNode.disconnect();
      this.mediaSourceNode = null;
    }

    if (this.frameGrabberInterval) {
      clearInterval(this.frameGrabberInterval);
      this.frameGrabberInterval = null;
    }

    const session = await this.sessionPromise.catch(() => null);
    session?.close();

    this.initSession();
    this.updateStatus('Select an audio or video file to begin.');
  }

  private async handleThemeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.currentTheme = select.value;
    this.orbColor = themes[this.currentTheme].colors[0];

    if (this.isProcessing) {
      await this.stopProcessing();
      this.updateStatus('Theme changed. Please select a file again.');
    } else {
      const session = await this.sessionPromise.catch(() => null);
      session?.close();
      this.initSession();
    }
  }

  render() {
    return html`
      <div>
        <div id="media-container"></div>
        <div class="controls">
          ${
            this.isProcessing
              ? html`
                  <button @click=${this.stopProcessing}>⏹️ Stop Processing</button>
                `
              : html`
                  <input
                    type="file"
                    @change=${this.handleFileSelect}
                    accept="audio/*,video/*"
                    id="file-input"
                    class="file-input"
                  />
                  <label for="file-input" class="file-label">
                    📂 Select File
                  </label>
                `
          }
          <select
            @change=${this.handleThemeChange}
            class="theme-select"
            aria-label="Select color theme"
          >
            ${Object.entries(themes).map(
              ([key, theme]) => html`
                <option value=${key} ?selected=${key === this.currentTheme}>
                  ${theme.name}
                </option>
              `,
            )}
          </select>
        </div>

        <div id="status">${this.error ? this.error : this.status}</div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}
          .isProcessing=${this.isProcessing}
          .isDarkMode=${this.isDarkMode}
          .brightness=${this.ambientBrightness}
          .orbColor=${this.orbColor}
          .pulseIntensity=${this.pulseIntensity}
          .amplitude=${this.orbAmplitude}
          .frequency=${this.orbFrequency}
          .speed=${this.orbSpeed}
          .temperature=${this.temperature}
          .topK=${this.topK}
          .topP=${this.topP}
        ></gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}