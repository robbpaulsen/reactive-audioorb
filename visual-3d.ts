/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:organize-imports
// tslint:disable:ban-malformed-import-paths
// tslint:disable:no-new-decorators

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from './analyser';

import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {fs as backdropFS, vs as backdropVS} from './backdrop-shader';
import {fs as sphereFS, vs as sphereVS} from './sphere-shader';

const PARTICLE_VS = `
  uniform float time;
  uniform float size;
  attribute vec2 blinkInfo; // x: rate, y: offset
  attribute vec3 color; // Per-particle color
  varying float vBlink;
  varying vec3 vColor;
  void main() {
    vBlink = blinkInfo.x > 0.0 ? 0.5 + 0.5 * sin(blinkInfo.y + blinkInfo.x * time) : 1.0;
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PARTICLE_FS = `
  uniform float time;
  uniform float opacity;
  varying float vBlink;
  varying vec3 vColor;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) {
      discard;
    }
    // Subtle shimmer effect
    float shimmer = 1.0 + 0.15 * sin(time * 2.0 + gl_FragCoord.x * 0.02 + gl_FragCoord.y * 0.02);
    vec3 finalColor = vColor * shimmer;

    gl_FragColor = vec4(finalColor, opacity * vBlink * (1.0 - dist * 2.0));
  }
`;

/**
 * 3D live audio visual.
 */
@customElement('gdm-live-audio-visuals-3d')
export class GdmLiveAudioVisuals3D extends LitElement {
  private inputAnalyser!: Analyser;
  private outputAnalyser!: Analyser;
  private camera!: THREE.PerspectiveCamera;
  private backdrop!: THREE.Mesh;
  private composer!: EffectComposer;
  private sphere!: THREE.Mesh;
  private particles: THREE.Points;
  private prevTime = 0;
  private rotation = new THREE.Vector3(0, 0, 0);
  private mouse = new THREE.Vector2(-10, -10);
  private targetMouse = new THREE.Vector2(-10, -10); // Target for smooth following
  private raycaster = new THREE.Raycaster();
  private mouseIntersection = new THREE.Vector3(-99, -99, -99);
  private particleVelocities: Float32Array;

  // Component properties
  @property({type: Boolean}) isProcessing = false;
  @property({type: Boolean}) isDarkMode = true;
  @property({type: Number}) brightness = 0.5;
  @property({type: String}) orbColor = '#aaaaff';
  @property({type: Array}) themeColors: string[] = ['#aaaaff', '#ffaaaa', '#aaffaa'];
  @property({type: Number}) pulseIntensity = 0.0;
  @property({type: Number}) amplitude = 0.5;
  @property({type: Number}) frequency = 3.0;
  @property({type: Number}) speed = 0.5;
  @property({type: Number}) audioIntensity = 0.0;
  @property({type: Number}) surfaceRoughness = 0.3;
  @property({type: Number}) surfaceMetalness = 0.5;
  @property({type: Number}) temperature = 0.7;
  @property({type: Number}) topK = 20;
  @property({type: Number}) topP = 0.8;

  private _outputNode!: AudioNode;
  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }
  get outputNode() {
    return this._outputNode;
  }

  private _inputNode!: AudioNode;
  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }
  get inputNode() {
    return this._inputNode;
  }

  private canvas!: HTMLCanvasElement;

  static styles = css`
    canvas {
      width: 100% !important;
      height: 100% !important;
      position: absolute;
      inset: 0;
      image-rendering: pixelated;
    }
  `;

  private onMouseMove(event: MouseEvent) {
    // Update target, actual mouse will follow with lag
    this.targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('mousemove', this.onMouseMove.bind(this));
  }

  private init() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050208);

    const backdrop = new THREE.Mesh(
      new THREE.IcosahedronGeometry(10, 5),
      new THREE.RawShaderMaterial({
        uniforms: {
          resolution: {value: new THREE.Vector2(1, 1)},
          rand: {value: 0},
        },
        vertexShader: backdropVS,
        fragmentShader: backdropFS,
        glslVersion: THREE.GLSL3,
      }),
    );
    backdrop.material.side = THREE.BackSide;
    scene.add(backdrop);
    this.backdrop = backdrop;

    // Particles
    const particleCount = 5000;
    const particlesGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const blinkInfos = new Float32Array(particleCount * 2);
    this.particleVelocities = new Float32Array(particleCount * 3);

    // Use theme colors for particles
    const themeColorObjs = this.themeColors.map(c => new THREE.Color(c));
    const numColors = themeColorObjs.length;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const i2 = i * 2;

      // Generate position
      const x = (Math.random() - 0.5) * 15;
      const y = (Math.random() - 0.5) * 15;
      const z = (Math.random() - 0.5) * 15;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      // Calculate angle in XZ plane to determine sector
      const angle = Math.atan2(z, x);
      const normalizedAngle = (angle + Math.PI) / (2 * Math.PI); // 0 to 1

      // Determine which color pair to use based on angle (creates sectors)
      const sectorIndex = Math.floor(normalizedAngle * numColors);
      const nextSectorIndex = (sectorIndex + 1) % numColors;

      // Calculate blend factor within sector for gradient effect
      const sectorPhase = (normalizedAngle * numColors) % 1;
      const blendFactor = sectorPhase;

      // Mix colors for gradient effect
      const color1 = themeColorObjs[sectorIndex];
      const color2 = themeColorObjs[nextSectorIndex];
      const mixedColor = new THREE.Color();
      mixedColor.r = color1.r * (1 - blendFactor) + color2.r * blendFactor;
      mixedColor.g = color1.g * (1 - blendFactor) + color2.g * blendFactor;
      mixedColor.b = color1.b * (1 - blendFactor) + color2.b * blendFactor;

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;

      this.particleVelocities[i3] = (Math.random() - 0.5) * 0.0005;
      this.particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.0005;
      this.particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.0005;

      if (Math.random() < 0.25) {
        // 25% of particles blink
        blinkInfos[i2] = 0.5 + Math.random() * 0.5; // rate
        blinkInfos[i2 + 1] = Math.random() * Math.PI * 2; // offset
      } else {
        blinkInfos[i2] = 0;
        blinkInfos[i2 + 1] = 0;
      }
    }
    particlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    );
    particlesGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 3),
    );
    particlesGeometry.setAttribute(
      'blinkInfo',
      new THREE.BufferAttribute(blinkInfos, 2),
    );

    const particlesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: {value: 0},
        opacity: {value: 0.5},
        size: {value: 0.06}, // Slightly smaller for better balance
      },
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(this.particles);

    // Initialize audio reactive properties for particles
    (this.particles as any).audioReactive = {
      baseSize: 0.06, // Match material size
      targetSize: 0.06,
      positions: particlesGeometry.attributes.position.array,
      originalPositions: particlesGeometry.attributes.position.array.slice()
    };

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(2, -2, 5);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio / 1);

    const geometry = new THREE.IcosahedronGeometry(1.5, 16); // 50% larger, smoother

    const sphereMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.5,
      roughness: 0.1,
      emissive: 0x000010,
      emissiveIntensity: 1.5,
    });

    sphereMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.time = {value: 0};
      shader.uniforms.volume = {value: 0.0};
      shader.uniforms.brightness = {value: 0.5};
      shader.uniforms.orbColor = {value: new THREE.Color(this.orbColor)};
      shader.uniforms.pulseIntensity = {value: 0.0};
      shader.uniforms.amplitude = {value: 0.5};
      shader.uniforms.frequency = {value: 3.0};
      shader.uniforms.speed = {value: 0.5};
      shader.uniforms.mousePos = {
        value: new THREE.Vector3(-99, -99, -99),
      };
      shader.uniforms.temperature = {value: 0.7};
      shader.uniforms.topK = {value: 20};
      shader.uniforms.topP = {value: 0.8};

      sphereMaterial.userData.shader = shader;

      shader.vertexShader = sphereVS;
      shader.fragmentShader = sphereFS;
    };

    const sphere = new THREE.Mesh(geometry, sphereMaterial);
    sphere.scale.setScalar(0.1); // Start with a small but visible scale
    scene.add(sphere);

    this.sphere = sphere;

    // Initialize audio reactive properties to avoid undefined errors
    (this.sphere as any).audioReactive = {
      baseScale: 1.0,
      targetScale: 1.0,
      colorPhase: 0
    };

    const renderPass = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      2.0, // Nice bloom intensity
      0.5,
      0,
    );

    const fxaaPass = new ShaderPass(FXAAShader);

    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    this.composer = composer;

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const dPR = renderer.getPixelRatio();
      const w = window.innerWidth;
      const h = window.innerHeight;
      backdrop.material.uniforms.resolution.value.set(w * dPR, h * dPR);
      renderer.setSize(w, h);
      composer.setSize(w, h);
      fxaaPass.material.uniforms['resolution'].value.set(
        1 / (w * dPR),
        1 / (h * dPR),
      );
    }

    window.addEventListener('resize', onWindowResize);
    onWindowResize();

    this.animation();
  }

  private animation() {
    requestAnimationFrame(() => this.animation());

    this.inputAnalyser.update();
    this.outputAnalyser.update();

    const t = performance.now();
    const dt = (t - this.prevTime) / (1000 / 60);
    this.prevTime = t;

    // Smooth mouse following with lag (creates fun drawing effect)
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;

    const backdropMaterial = this.backdrop.material as THREE.RawShaderMaterial;
    const sphereMaterial = this.sphere.material as THREE.MeshStandardMaterial;

    backdropMaterial.uniforms.rand.value = Math.random() * 10000;

    // Calculate audio intensity from input analyser (average of all frequencies)
    const avgVolume = this.inputAnalyser.data.reduce((a, b) => a + b, 0) / this.inputAnalyser.data.length / 255;

    // Update surface properties based on audio intensity
    const targetRoughness = THREE.MathUtils.clamp(0.1 + avgVolume * 0.6, 0.1, 0.7);
    const targetMetalness = THREE.MathUtils.clamp(0.3 + avgVolume * 0.4, 0.3, 0.7);

    sphereMaterial.roughness = THREE.MathUtils.lerp(sphereMaterial.roughness, targetRoughness, 0.1);
    sphereMaterial.metalness = THREE.MathUtils.lerp(sphereMaterial.metalness, targetMetalness, 0.1);

    // Orb scaling with MAX LIMIT to prevent screen-filling
    const rawTargetScale = this.isProcessing
      ? 1 + (0.2 * this.outputAnalyser.data[1]) / 255 + avgVolume * 0.3
      : 0.1 + Math.sin(t * 0.001) * 0.05; // Slower pulse when idle

    // CRITICAL: Clamp scale to max 1.5x to keep orb from dominating screen
    const targetScale = THREE.MathUtils.clamp(rawTargetScale, 0.1, 1.5);

    this.sphere.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1,
    );
    (this.sphere.material as THREE.MeshStandardMaterial).emissiveIntensity =
      THREE.MathUtils.lerp(
        (this.sphere.material as THREE.MeshStandardMaterial).emissiveIntensity,
        this.isProcessing ? 1.5 : 0.5,
        0.1,
      );

    // Animate Particles
    const positions = this.particles.geometry.attributes.position
      .array as Float32Array;
    const mouse3D = new THREE.Vector3(
      this.mouse.x * this.camera.aspect * 4,
      this.mouse.y * 4,
      0,
    );

    for (let i = 0; i < positions.length; i += 3) {
      const p = new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2],
      );

      // Mouse interaction
      const distToMouse = p.distanceTo(mouse3D);
      if (distToMouse < 2.0) {
        const repelForce = p
          .clone()
          .sub(mouse3D)
          .normalize()
          .multiplyScalar(0.005 / (distToMouse + 0.1));
        this.particleVelocities[i] += repelForce.x;
        this.particleVelocities[i + 1] += repelForce.y;
      }

      // Update position and add damping
      positions[i] += this.particleVelocities[i];
      positions[i + 1] += this.particleVelocities[i + 1];
      positions[i + 2] += this.particleVelocities[i + 2];

      this.particleVelocities[i] *= 0.99;
      this.particleVelocities[i + 1] *= 0.99;
      this.particleVelocities[i + 2] *= 0.99;

      // Boundaries
      if (Math.abs(positions[i]) > 8) this.particleVelocities[i] *= -1;
      if (Math.abs(positions[i + 1]) > 8) this.particleVelocities[i + 1] *= -1;
      if (Math.abs(positions[i + 2]) > 8) this.particleVelocities[i + 2] *= -1;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    (this.particles.material as THREE.ShaderMaterial).uniforms.time.value =
      t * 0.001;

    // Mouse-Orb interaction
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.sphere);
    if (intersects.length > 0) {
      this.mouseIntersection.copy(intersects[0].point);
    } else {
      this.mouseIntersection.set(-99, -99, -99); // No intersection
    }

    if (sphereMaterial.userData.shader) {
      const f = 0.001;
      this.rotation.x += (dt * f * 0.5 * this.outputAnalyser.data[1]) / 255;
      this.rotation.z += (dt * f * 0.5 * this.inputAnalyser.data[1]) / 255;
      this.rotation.y += (dt * f * 0.25 * this.inputAnalyser.data[2]) / 255;
      this.rotation.y += (dt * f * 0.25 * this.outputAnalyser.data[2]) / 255;

      // Orb attraction to cursor
      const desiredPosition = new THREE.Vector3(
        this.mouse.x * 2,
        this.mouse.y * 2,
        5,
      );
      const euler = new THREE.Euler(
        this.rotation.x,
        this.rotation.y,
        this.rotation.z,
      );
      const quaternion = new THREE.Quaternion().setFromEuler(euler);
      let vector = new THREE.Vector3(0, 0, 5);
      vector.applyQuaternion(quaternion);
      vector.lerp(desiredPosition, 0.02);

      this.camera.position.copy(vector);
      this.camera.lookAt(this.sphere.position);

      const avgVolume =
        this.inputAnalyser.data.reduce((a, b) => a + b, 0) /
        this.inputAnalyser.data.length /
        255;

      const uniforms = sphereMaterial.userData.shader.uniforms;
      uniforms.time.value = t * 0.001;
      uniforms.volume.value = avgVolume;
      uniforms.brightness.value = this.brightness;
      uniforms.orbColor.value.set(this.orbColor);
      uniforms.pulseIntensity.value = THREE.MathUtils.lerp(
        uniforms.pulseIntensity.value,
        this.pulseIntensity,
        0.1,
      );
      uniforms.amplitude.value = this.amplitude;
      uniforms.frequency.value = this.frequency;
      uniforms.speed.value = this.speed;
      uniforms.mousePos.value.copy(this.mouseIntersection);
      uniforms.temperature.value = this.temperature;
      uniforms.topK.value = this.topK;
      uniforms.topP.value = this.topP;
    }

    this.composer.render();
  }

  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    this.init();
  }

  protected updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    // Update particle colors when theme changes
    if (changedProperties.has('themeColors') && this.particles) {
      this.updateParticleColors();
    }
  }

  private updateParticleColors() {
    const geometry = this.particles.geometry;
    const colors = geometry.attributes.color.array as Float32Array;
    const positions = geometry.attributes.position.array as Float32Array;
    const particleCount = positions.length / 3;

    // Use theme colors for particles
    const themeColorObjs = this.themeColors.map(c => new THREE.Color(c));
    const numColors = themeColorObjs.length;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const x = positions[i3];
      const z = positions[i3 + 2];

      // Calculate angle in XZ plane to determine sector
      const angle = Math.atan2(z, x);
      const normalizedAngle = (angle + Math.PI) / (2 * Math.PI); // 0 to 1

      // Determine which color pair to use based on angle (creates sectors)
      const sectorIndex = Math.floor(normalizedAngle * numColors);
      const nextSectorIndex = (sectorIndex + 1) % numColors;

      // Calculate blend factor within sector for gradient effect
      const sectorPhase = (normalizedAngle * numColors) % 1;
      const blendFactor = sectorPhase;

      // Mix colors for gradient effect
      const color1 = themeColorObjs[sectorIndex];
      const color2 = themeColorObjs[nextSectorIndex];
      const mixedColor = new THREE.Color();
      mixedColor.r = color1.r * (1 - blendFactor) + color2.r * blendFactor;
      mixedColor.g = color1.g * (1 - blendFactor) + color2.g * blendFactor;
      mixedColor.b = color1.b * (1 - blendFactor) + color2.b * blendFactor;

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    geometry.attributes.color.needsUpdate = true;
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals-3d': GdmLiveAudioVisuals3D;
  }
}