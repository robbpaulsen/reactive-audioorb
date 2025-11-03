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
  varying float vBlink;
  void main() {
    vBlink = blinkInfo.x > 0.0 ? 0.5 + 0.5 * sin(blinkInfo.y + blinkInfo.x * time) : 1.0;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PARTICLE_FS = `
  uniform vec3 color;
  uniform float time;
  uniform float opacity;
  varying float vBlink;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) {
      discard;
    }
    // Create a cyclical color shift through a cool-toned palette.
    float angle = time * 0.5 + gl_FragCoord.x * 0.01;
    vec3 colorOffset = vec3(sin(angle), 0.0, cos(angle)) * 0.1; // Cycle in R-B plane
    vec3 shiftedColor = color + colorOffset;

    gl_FragColor = vec4(shiftedColor, opacity * vBlink * (1.0 - dist * 2.0));
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
  private raycaster = new THREE.Raycaster();
  private mouseIntersection = new THREE.Vector3(-99, -99, -99);
  private particleVelocities: Float32Array;

  // Component properties
  @property({type: Boolean}) isProcessing = false;
  @property({type: Boolean}) isDarkMode = true;
  @property({type: Number}) brightness = 0.5;
  @property({type: String}) orbColor = '#aaaaff';
  @property({type: Number}) pulseIntensity = 0.0;
  @property({type: Number}) amplitude = 0.5;
  @property({type: Number}) frequency = 3.0;
  @property({type: Number}) speed = 0.5;
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
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
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
    const blinkInfos = new Float32Array(particleCount * 2);
    this.particleVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const i2 = i * 2;
      positions[i3] = (Math.random() - 0.5) * 15;
      positions[i3 + 1] = (Math.random() - 0.5) * 15;
      positions[i3 + 2] = (Math.random() - 0.5) * 15;

      this.particleVelocities[i3] = (Math.random() - 0.5) * 0.0005;
      this.particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.0005;
      this.particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.0005;

      if (Math.random() < 0.1) {
        // 10% of particles blink
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
      'blinkInfo',
      new THREE.BufferAttribute(blinkInfos, 2),
    );

    const particlesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: {value: new THREE.Color(0xaaaaff)},
        time: {value: 0},
        opacity: {value: 0.5},
        size: {value: 0.02},
      },
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(this.particles);

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

    const geometry = new THREE.IcosahedronGeometry(1, 10);

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

    const renderPass = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      5,
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
    const backdropMaterial = this.backdrop.material as THREE.RawShaderMaterial;
    const sphereMaterial = this.sphere.material as THREE.MeshStandardMaterial;

    backdropMaterial.uniforms.rand.value = Math.random() * 10000;

    // Orb scaling
    const targetScale = this.isProcessing
      ? 1 + (0.2 * this.outputAnalyser.data[1]) / 255
      : 0.1 + Math.sin(t * 0.002) * 0.05; // Pulse when idle, but larger
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

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals-3d': GdmLiveAudioVisuals3D;
  }
}