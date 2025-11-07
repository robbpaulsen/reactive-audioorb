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
    icon: '🔹',
    colors: ['#aaaaff', '#ffaaaa', '#aaffaa', '#aaffff', '#ffaaff'],
  },
  catppuccin: {
    name: 'Catppuccin',
    icon: '🔹',
    colors: ['#cba6f7', '#b4befe', '#89dceb', '#a6e3a1', '#fab387'],
  },
  tokyonight: {
    name: 'Tokyonight',
    icon: '🔹',
    colors: ['#7aa2f7', '#bb9af7', '#9ece6a', '#e0af68', '#f7768e'],
  },
  poimandres: {
    name: 'Poimandres',
    icon: '🔹',
    colors: ['#add7ff', '#5de4c7', '#fffac2', '#d0679d'],
  },
  eldritch: {
    name: 'Eldritch',
    icon: '🔹',
    colors: ['#5D3A9B', '#4E878C', '#3A6B35', '#8C271E'],
  },
  halcyon: {
    name: 'Halcyon',
    icon: '🔹',
    colors: ['#94e2d5', '#f5c2e7', '#cba6f7', '#fab387'],
  },
  dracula: {
    name: 'Dracula',
    icon: '🔹',
    colors: ['#bd93f9', '#ff79c6', '#8be9fd', '#50fa7b', '#ffb86c', '#ff5555'],
  },
  nord: {
    name: 'Nord',
    icon: '🔹',
    colors: ['#88c0d0', '#81a1c1', '#5e81ac', '#b48ead', '#a3be8c', '#ebcb8b'],
  },
  gruvbox: {
    name: 'Gruvbox',
    icon: '🔹',
    colors: ['#fb4934', '#b8bb26', '#fabd2f', '#83a598', '#d3869b', '#fe8019'],
  },
  synthwave: {
    name: 'Synthwave',
    icon: '🔹',
    colors: ['#ff00ff', '#00ffff', '#ff1493', '#7b68ee', '#ff6ec7', '#00d9ff'],
  },
  rosepine: {
    name: 'Rose Pine',
    icon: '🔹',
    colors: ['#ebbcba', '#f6c177', '#ea9a97', '#9ccfd8', '#c4a7e7', '#eb6f92'],
  },
  material: {
    name: 'Material',
    icon: '🔹',
    colors: ['#82aaff', '#c792ea', '#89ddff', '#c3e88d', '#ffcb6b', '#f07178'],
  },
  solarized: {
    name: 'Solarized',
    icon: '🔹',
    colors: ['#268bd2', '#2aa198', '#859900', '#b58900', '#cb4b16', '#dc322f'],
  },
  cyberpunk: {
    name: 'Cyberpunk',
    icon: '🔹',
    colors: ['#00ff9f', '#00b8ff', '#d600ff', '#ff00ff', '#fffc00', '#ff003c'],
  },
  sunset: {
    name: 'Sunset',
    icon: '🔹',
    colors: ['#ff6b6b', '#ee5a6f', '#c44569', '#f8b500', '#ff9a56', '#ff6348'],
  },
  ocean: {
    name: 'Ocean',
    icon: '🔹',
    colors: ['#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#667eea', '#764ba2'],
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
  @state() private showFloatingControls = true; // Show/hide controls on mouse move
  @state() private isFullscreen = false; // Track fullscreen state
  @state() private isPaused = false; // Track pause state
  private mouseInactivityTimeout: number = 0;

  // Playlist management
  private playlist: {file: File, url: string, isVideo: boolean}[] = [];
  private currentTrackIndex = 0;

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
      opacity: 1;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    #media-container.hidden {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
      pointer-events: none;
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
      opacity: 1;
      transition: opacity 0.3s ease, transform 0.3s ease;
      transform: translateY(0);
    }

    .controls.hidden {
      opacity: 0;
      transform: translateY(20px);
      pointer-events: none;
    }

    .theme-controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: all;
      padding: 40px 0;
    }

    .theme-controls:hover {
      opacity: 1;
    }

    button,
    .file-label,
    .theme-select {
      outline: none;
      border: 2px solid rgba(255, 255, 255, 0.15);
      color: white;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
      backdrop-filter: blur(20px);
      height: 54px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      padding: 0 24px;
      margin: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 240px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    button::before,
    .file-label::before,
    .theme-select::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
      transition: left 0.5s;
    }

    button:hover,
    .file-label:hover,
    .theme-select:hover {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    button:hover::before,
    .file-label:hover::before,
    .theme-select:hover::before {
      left: 100%;
    }

    button:active,
    .file-label:active,
    .theme-select:active {
      transform: translateY(0);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    button:disabled:hover {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
      border-color: rgba(255, 255, 255, 0.15);
      transform: none;
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
      background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05)),
                        url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
      background-repeat: no-repeat, no-repeat;
      background-position: 0 0, right 24px top 50%;
      background-size: 100% 100%, 0.6em auto;
      padding-right: 50px;
      padding-left: 20px;
      text-align: left;
    }

    .theme-select:hover {
      background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1)),
                        url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
      background-repeat: no-repeat, no-repeat;
      background-position: 0 0, right 24px top 50%;
      background-size: 100% 100%, 0.6em auto;
    }

    .theme-select option {
      background: #1a1a2e;
      color: white;
      padding: 10px;
    }

    .floating-controls {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 15;
      display: flex;
      gap: 15px;
      opacity: 1;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    .floating-controls.hidden {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
      pointer-events: none;
    }

    .floating-btn {
      outline: none;
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 50px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(15px);
      height: 60px;
      min-width: 180px;
      cursor: pointer;
      font-size: 18px;
      font-weight: 600;
      padding: 0 30px;
      transition: all 0.2s ease;
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .floating-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(1.05);
      box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
    }

    .floating-btn:active {
      transform: scale(0.98);
    }

    .floating-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      transform: none;
    }

    .floating-btn:disabled:hover {
      background: rgba(0, 0, 0, 0.5);
      transform: scale(1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
  `;

  constructor() {
    super();
    this.initClient();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      this.isDarkMode = e.matches;
    });

    // Handle mouse movement to show/hide controls
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('keydown', this.handleKeyPress);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('keydown', this.handleKeyPress);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    clearTimeout(this.mouseInactivityTimeout);
  }

  private handleMouseMove() {
    if (!this.isProcessing) return;

    this.showFloatingControls = true;
    clearTimeout(this.mouseInactivityTimeout);

    this.mouseInactivityTimeout = window.setTimeout(() => {
      this.showFloatingControls = false;
    }, 3000); // Hide after 3 seconds of inactivity
  }

  private handleKeyPress(e: KeyboardEvent) {
    if (!this.isProcessing) return;

    if (e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      this.showFloatingControls = !this.showFloatingControls;

      if (this.showFloatingControls) {
        clearTimeout(this.mouseInactivityTimeout);
        this.mouseInactivityTimeout = window.setTimeout(() => {
          this.showFloatingControls = false;
        }, 3000);
      }
    }

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this.toggleFullscreen();
    }
  }

  private handleFullscreenChange() {
    this.isFullscreen = !!document.fullscreenElement;
  }

  private async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        this.isFullscreen = true;
      } else {
        await document.exitFullscreen();
        this.isFullscreen = false;
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
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
        systemInstruction: `You are a creative visual intelligence. As you process incoming audio and video, use the provided tools to control a visual orb to match the mood and events. Be creative and responsive. Use 'setDeformation' to control the shape: 'amplitude' for intensity, 'frequency' for detail, and 'speed' for animation. For example, calm music might have low amplitude and speed, while intense electronic music might have high amplitude and frequency.

IMPORTANT: Use 'setOrbColor' to set the orb color. You MUST ONLY use colors from the current theme's palette: ${availableColors}. DO NOT use colors outside this palette. Rotate through these colors to match the mood. Use 'triggerPulse' for sharp beats or visual flashes. Combine these tools to create a compelling, synchronized visual experience.`,
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

    // Add all selected files to playlist
    this.playlist = [];
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const fileUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      this.playlist.push({file, url: fileUrl, isVideo});
    }

    this.currentTrackIndex = 0;
    const firstTrack = this.playlist[0];

    await this.stopProcessing(); // Stop any previous playback
    this.startProcessing(firstTrack.url, firstTrack.isVideo);
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
      // Hot-swap theme: restart AI session without stopping media playback
      const currentThemeData = themes[this.currentTheme];

      // Close old session and create new one with updated theme colors
      const oldSession = await this.sessionPromise.catch(() => null);
      oldSession?.close();
      this.initSession();

      this.updateStatus(`Theme changed to ${currentThemeData.name} - colors updating...`);

      // Status message will auto-clear after 2 seconds
      setTimeout(() => {
        if (this.isProcessing) {
          this.updateStatus('Processing file...');
        }
      }, 2000);
    } else {
      const session = await this.sessionPromise.catch(() => null);
      session?.close();
      this.initSession();
    }
  }

  private togglePlayPause() {
    if (!this.mediaElement) return;

    if (this.isPaused) {
      this.mediaElement.play();
      this.inputAudioContext.resume();
      this.outputAudioContext.resume();
      this.isPaused = false;
    } else {
      this.mediaElement.pause();
      this.isPaused = true;
    }
  }

  private playNext() {
    if (this.playlist.length === 0) return;

    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
    const track = this.playlist[this.currentTrackIndex];

    this.stopProcessing().then(() => {
      this.startProcessing(track.url, track.isVideo);
    });
  }

  private playPrevious() {
    if (this.playlist.length === 0) return;

    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    const track = this.playlist[this.currentTrackIndex];

    this.stopProcessing().then(() => {
      this.startProcessing(track.url, track.isVideo);
    });
  }

  render() {
    return html`
      <div>
        <div id="media-container" class="${this.isProcessing ? 'hidden' : ''}"></div>
        <div class="controls ${this.isProcessing ? 'hidden' : ''}">
          ${
            this.isProcessing
              ? html``
              : html`
                  <input
                    type="file"
                    @change=${this.handleFileSelect}
                    accept="audio/*,video/*"
                    id="file-input"
                    class="file-input"
                    multiple
                  />
                  <label for="file-input" class="file-label">
                    🎵 Choose Audio/Video
                  </label>
                  <select
                    @change=${this.handleThemeChange}
                    class="theme-select"
                    aria-label="Select color theme"
                  >
                    ${Object.entries(themes).map(
                      ([key, theme]) => html`
                        <option value=${key} ?selected=${key === this.currentTheme}>
                          ${theme.icon} ${theme.name}
                        </option>
                      `,
                    )}
                  </select>
                `
          }
        </div>

        ${
          this.isProcessing
            ? html`
                <div class="theme-controls">
                  <select
                    @change=${this.handleThemeChange}
                    class="theme-select"
                    aria-label="Select color theme"
                  >
                    ${Object.entries(themes).map(
                      ([key, theme]) => html`
                        <option value=${key} ?selected=${key === this.currentTheme}>
                          ${theme.icon} ${theme.name}
                        </option>
                      `,
                    )}
                  </select>
                </div>
                <div class="floating-controls ${this.showFloatingControls ? '' : 'hidden'}">
                  <button class="floating-btn" @click=${this.playPrevious} ?disabled=${this.playlist.length <= 1}>
                    ⏮️ Previous
                  </button>
                  <button class="floating-btn" @click=${this.togglePlayPause}>
                    ${this.isPaused ? '▶️ Play' : '⏸️ Pause'}
                  </button>
                  <button class="floating-btn" @click=${this.playNext} ?disabled=${this.playlist.length <= 1}>
                    ⏭️ Next
                  </button>
                  <button class="floating-btn" @click=${this.toggleFullscreen}>
                    ${this.isFullscreen ? '🪟 Exit Fullscreen' : '🖥️ Fullscreen'}
                  </button>
                  <button class="floating-btn" @click=${this.stopProcessing}>
                    ⏹️ Stop
                  </button>
                </div>
              `
            : ''
        }

        <div id="status">${this.error ? this.error : this.status}</div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}
          .isProcessing=${this.isProcessing}
          .isDarkMode=${this.isDarkMode}
          .brightness=${this.ambientBrightness}
          .orbColor=${this.orbColor}
          .themeColors=${themes[this.currentTheme].colors}
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