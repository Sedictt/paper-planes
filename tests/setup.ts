/**
 * tests/setup.ts
 * Comprehensive Headless Test Polyfills for Three.js WebGL2, Canvas 2D, Web Audio API, and DOM.
 */

// ============================================================================
// 1. WebGL 2 Mock Implementation for Three.js (r160+ / r187+ compatible)
// ============================================================================

export function createMockWebGL2Context(canvas: HTMLCanvasElement | null): any {
  const noop = () => {};

  const ctx = {
    canvas: canvas || { width: 800, height: 600, style: {} },
    get drawingBufferWidth() {
      return canvas && typeof canvas.width === 'number' ? canvas.width : 800;
    },
    get drawingBufferHeight() {
      return canvas && typeof canvas.height === 'number' ? canvas.height : 600;
    },
    isContextLost: () => false,

    // WebGL 1 & 2 Constants
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    HIGH_FLOAT: 0x8dfa,
    MEDIUM_FLOAT: 0x8dfb,
    LOW_FLOAT: 0x8dfc,
    HIGH_INT: 0x8dfd,
    MEDIUM_INT: 0x8dfe,
    LOW_INT: 0x8dff,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    VALIDATE_STATUS: 0x8b83,
    ACTIVE_UNIFORMS: 0x8b86,
    ACTIVE_ATTRIBUTES: 0x8b89,
    MAX_VERTEX_ATTRIBS: 0x8869,
    MAX_VERTEX_UNIFORM_VECTORS: 0x8dfb,
    MAX_VARYING_VECTORS: 0x8dfc,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8b4d,
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8b4c,
    MAX_TEXTURE_IMAGE_UNITS: 0x8872,
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
    MAX_FRAGMENT_UNIFORM_VECTORS: 0x8dfd,
    MAX_RENDERBUFFER_SIZE: 0x84e8,
    MAX_SAMPLES: 0x8d57,
    SAMPLES: 0x80a9,
    MAX_DRAW_BUFFERS: 0x8824,
    VERSION: 0x1f02,
    SHADING_LANGUAGE_VERSION: 0x8b8c,
    VENDOR: 0x1f00,
    RENDERER: 0x1f01,
    IMPLEMENTATION_COLOR_READ_FORMAT: 0x8b9b,
    IMPLEMENTATION_COLOR_READ_TYPE: 0x8b9a,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    COLOR_BUFFER_BIT: 0x00004000,
    DEPTH_BUFFER_BIT: 0x00000100,
    STENCIL_BUFFER_BIT: 0x00000400,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    ARRAY_BUFFER: 0x8892,
    UNIFORM_BUFFER: 0x8a11,
    FLOAT_MAT2: 0x8b5a,
    FLOAT_MAT3: 0x8b5b,
    FLOAT_MAT4: 0x8b5c,
    FLOAT: 0x1406,
    STATIC_DRAW: 0x88e4,
    DYNAMIC_DRAW: 0x88e8,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    FRAMEBUFFER: 0x8d40,
    TEXTURE_2D: 0x0de1,
    TEXTURE_CUBE_MAP: 0x8513,
    TEXTURE_2D_ARRAY: 0x8c1a,
    TEXTURE_3D: 0x806f,
    COLOR_ATTACHMENT0: 0x8ce0,
    DEPTH_ATTACHMENT: 0x8d00,
    STENCIL_ATTACHMENT: 0x8d20,
    DEPTH_STENCIL_ATTACHMENT: 0x821a,

    getContextAttributes: () => ({
      alpha: true,
      depth: true,
      stencil: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    }),

    getExtension: (name: string) => {
      if (name === 'WEBGL_lose_context') {
        return {
          loseContext: () => {},
          restoreContext: () => {},
        };
      }
      if (name === 'EXT_texture_filter_anisotropic') {
        return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 0x84ff };
      }
      if (name === 'KHR_parallel_shader_compile') {
        return { COMPLETION_STATUS_KHR: 0x91b1 };
      }
      return null;
    },

    getParameter: (pname: number) => {
      switch (pname) {
        case 0x8b4d: // MAX_COMBINED_TEXTURE_IMAGE_UNITS
        case 0x8b4c: // MAX_VERTEX_TEXTURE_IMAGE_UNITS
        case 0x8872: // MAX_TEXTURE_IMAGE_UNITS
          return 16;
        case 0x0d33: // MAX_TEXTURE_SIZE
        case 0x851c: // MAX_CUBE_MAP_TEXTURE_SIZE
        case 0x84e8: // MAX_RENDERBUFFER_SIZE
          return 4096;
        case 0x8869: // MAX_VERTEX_ATTRIBS
          return 16;
        case 0x8dfb: // MAX_VERTEX_UNIFORM_VECTORS
        case 0x8dfd: // MAX_FRAGMENT_UNIFORM_VECTORS
          return 1024;
        case 0x8dfc: // MAX_VARYING_VECTORS
          return 30;
        case 0x8d57: // MAX_SAMPLES
        case 0x80a9: // SAMPLES
          return 4;
        case 0x8824: // MAX_DRAW_BUFFERS
          return 8;
        case 0x1f02: // VERSION
          return 'WebGL 2.0 (Vitest Headless Mock)';
        case 0x8b8c: // SHADING_LANGUAGE_VERSION
          return 'WebGL GLSL ES 3.00 (Vitest Headless Mock)';
        case 0x1f00: // VENDOR
          return 'Three.js Mock Vendor';
        case 0x1f01: // RENDERER
          return 'Three.js Mock WebGL2 Renderer';
        case 0x8b9b: // IMPLEMENTATION_COLOR_READ_FORMAT
          return 0x1908; // RGBA
        case 0x8b9a: // IMPLEMENTATION_COLOR_READ_TYPE
          return 0x1401; // UNSIGNED_BYTE
        default:
          return 0;
      }
    },

    getShaderPrecisionFormat: () => ({
      rangeMin: 127,
      rangeMax: 127,
      precision: 23,
    }),

    // Shader & Program Lifecycles
    createShader: (type: number) => ({ type, id: Math.random() }),
    shaderSource: noop,
    compileShader: noop,
    getShaderParameter: (_shader: any, pname: number) => {
      if (pname === 0x8b81) return true; // COMPILE_STATUS
      return true;
    },
    getShaderInfoLog: () => '',
    deleteShader: noop,

    createProgram: () => ({ id: Math.random() }),
    attachShader: noop,
    detachShader: noop,
    linkProgram: noop,
    getProgramParameter: (_program: any, pname: number) => {
      if (pname === 0x8b82) return true; // LINK_STATUS
      if (pname === 0x8b83) return true; // VALIDATE_STATUS
      if (pname === 0x8b86) return 0; // ACTIVE_UNIFORMS
      if (pname === 0x8b89) return 0; // ACTIVE_ATTRIBUTES
      if (pname === 0x91b1) return true; // COMPLETION_STATUS_KHR
      return 0;
    },
    getProgramInfoLog: () => '',
    useProgram: noop,
    deleteProgram: noop,

    getActiveUniform: () => ({ name: '', type: 0, size: 0 }),
    getActiveAttrib: () => ({ name: '', type: 0, size: 0 }),
    getUniformLocation: (_program: any, name: string) => ({ name, id: Math.random() }),
    getAttribLocation: () => 0,
    bindAttribLocation: noop,

    // Buffers & Vertex Array Objects (WebGL2)
    createBuffer: () => ({ id: Math.random() }),
    bindBuffer: noop,
    bufferData: noop,
    bufferSubData: noop,
    deleteBuffer: noop,

    createVertexArray: () => ({ id: Math.random() }),
    bindVertexArray: noop,
    deleteVertexArray: noop,
    vertexAttribPointer: noop,
    vertexAttribIPointer: noop,
    vertexAttribDivisor: noop,
    enableVertexAttribArray: noop,
    disableVertexAttribArray: noop,

    // Textures & Samplers
    createTexture: () => ({ id: Math.random() }),
    bindTexture: noop,
    texParameteri: noop,
    texParameterf: noop,
    texImage2D: noop,
    texImage3D: noop,
    texSubImage2D: noop,
    texSubImage3D: noop,
    texStorage2D: noop,
    texStorage3D: noop,
    compressedTexImage2D: noop,
    compressedTexSubImage2D: noop,
    generateMipmap: noop,
    deleteTexture: noop,
    activeTexture: noop,
    pixelStorei: noop,
    createSampler: () => ({ id: Math.random() }),
    bindSampler: noop,
    deleteSampler: noop,

    // Framebuffers & Renderbuffers
    createFramebuffer: () => ({ id: Math.random() }),
    bindFramebuffer: noop,
    framebufferTexture2D: noop,
    framebufferTextureLayer: noop,
    framebufferRenderbuffer: noop,
    checkFramebufferStatus: () => 0x8cd5, // FRAMEBUFFER_COMPLETE
    deleteFramebuffer: noop,
    createRenderbuffer: () => ({ id: Math.random() }),
    bindRenderbuffer: noop,
    renderbufferStorage: noop,
    renderbufferStorageMultisample: noop,
    deleteRenderbuffer: noop,
    drawBuffers: noop,
    readBuffer: noop,
    blitFramebuffer: noop,

    // Transform Feedback & Queries
    createTransformFeedback: () => ({ id: Math.random() }),
    bindTransformFeedback: noop,
    deleteTransformFeedback: noop,
    createQuery: () => ({ id: Math.random() }),
    beginQuery: noop,
    endQuery: noop,
    deleteQuery: noop,

    // Uniform setters
    uniform1i: noop,
    uniform1f: noop,
    uniform2f: noop,
    uniform3f: noop,
    uniform4f: noop,
    uniform1iv: noop,
    uniform1fv: noop,
    uniform2fv: noop,
    uniform3fv: noop,
    uniform4fv: noop,
    uniformMatrix2fv: noop,
    uniformMatrix3fv: noop,
    uniformMatrix4fv: noop,
    uniformBlockBinding: noop,
    getUniformBlockIndex: () => 0,

    // Pipeline State, Scissor, Viewport, Clear
    enable: noop,
    disable: noop,
    blendFunc: noop,
    blendFuncSeparate: noop,
    blendEquation: noop,
    blendEquationSeparate: noop,
    cullFace: noop,
    frontFace: noop,
    depthMask: noop,
    depthFunc: noop,
    colorMask: noop,
    stencilMask: noop,
    stencilFunc: noop,
    stencilOp: noop,
    polygonOffset: noop,
    viewport: noop,
    scissor: noop,
    lineWidth: noop,
    clearColor: noop,
    clearDepth: noop,
    clearStencil: noop,
    clear: noop,
    getError: () => 0, // NO_ERROR

    // Draw calls
    drawArrays: noop,
    drawElements: noop,
    drawArraysInstanced: noop,
    drawElementsInstanced: noop,
    finish: noop,
    flush: noop,
  };

  return ctx;
}

// ============================================================================
// 2. 2D Canvas Mock for Procedural Textures & Pixel Art
// ============================================================================

export function createMock2DContext(canvas: HTMLCanvasElement | null): any {
  const noop = () => {};
  return {
    canvas: canvas || { width: 800, height: 600 },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    imageSmoothingEnabled: false,
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: noop,
    getImageData: (sx: number, sy: number, sw: number, sh: number) => ({
      width: sw,
      height: sh,
      data: new Uint8ClampedArray(sw * sh * 4),
    }),
    createPattern: () => ({}),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    fillRect: noop,
    clearRect: noop,
    strokeRect: noop,
    drawImage: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    arcTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    save: noop,
    restore: noop,
    setTransform: noop,
    resetTransform: noop,
    scale: noop,
    rotate: noop,
    translate: noop,
    transform: noop,
    measureText: (text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
  };
}

// ============================================================================
// 3. Web Audio API Mocks
// ============================================================================

export class MockAudioParam {
  public value: number;
  public defaultValue: number;
  public minValue: number;
  public maxValue: number;

  constructor(defaultValue = 1) {
    this.value = defaultValue;
    this.defaultValue = defaultValue;
    this.minValue = -3.4028235e38;
    this.maxValue = 3.4028235e38;
  }

  public setValueAtTime(value: number, _startTime: number): MockAudioParam {
    this.value = value;
    return this;
  }

  public setTargetAtTime(target: number, _startTime: number, _timeConstant: number): MockAudioParam {
    this.value = target;
    return this;
  }

  public exponentialRampToValueAtTime(value: number, _endTime: number): MockAudioParam {
    this.value = value;
    return this;
  }

  public linearRampToValueAtTime(value: number, _endTime: number): MockAudioParam {
    this.value = value;
    return this;
  }

  public cancelScheduledValues(_cancelTime: number): MockAudioParam {
    return this;
  }

  public cancelAndHoldAtTime(_cancelTime: number): MockAudioParam {
    return this;
  }
}

export class MockAudioNode {
  public context: MockAudioContext;
  public numberOfInputs = 1;
  public numberOfOutputs = 1;
  public channelCount = 2;

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  public connect<T extends MockAudioNode | MockAudioParam>(
    destination: T,
    _outputIndex?: number,
    _inputIndex?: number
  ): T {
    return destination;
  }

  public disconnect(): void {}
}

export class MockAudioDestinationNode extends MockAudioNode {
  public maxChannelCount = 2;
  constructor(context: MockAudioContext) {
    super(context);
  }
}

export class MockGainNode extends MockAudioNode {
  public gain: MockAudioParam;
  constructor(context: MockAudioContext) {
    super(context);
    this.gain = new MockAudioParam(1.0);
  }
}

export class MockAudioBuffer {
  public numberOfChannels: number;
  public length: number;
  public sampleRate: number;
  public duration: number;
  private _channels: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      this._channels.push(new Float32Array(length));
    }
  }

  public getChannelData(channel: number): Float32Array {
    if (channel < 0 || channel >= this.numberOfChannels) {
      throw new DOMException(`IndexSizeError: channel ${channel} out of bounds`, 'IndexSizeError');
    }
    return this._channels[channel];
  }

  public copyFromChannel(destination: Float32Array, channelNumber: number, bufferOffset = 0): void {
    const data = this.getChannelData(channelNumber);
    destination.set(data.subarray(bufferOffset, bufferOffset + destination.length));
  }

  public copyToChannel(source: Float32Array, channelNumber: number, bufferOffset = 0): void {
    const data = this.getChannelData(channelNumber);
    data.set(source, bufferOffset);
  }
}

export class MockAudioBufferSourceNode extends MockAudioNode {
  public buffer: MockAudioBuffer | null = null;
  public loop = false;
  public loopStart = 0;
  public loopEnd = 0;
  public playbackRate: MockAudioParam;
  public started = false;
  public stopped = false;

  constructor(context: MockAudioContext) {
    super(context);
    this.playbackRate = new MockAudioParam(1.0);
  }

  public start(_when = 0, _offset = 0, _duration?: number): void {
    this.started = true;
  }

  public stop(_when = 0): void {
    this.stopped = true;
  }
}

export type BiquadFilterType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'lowshelf'
  | 'highshelf'
  | 'peaking'
  | 'notch'
  | 'allpass';

export class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency: MockAudioParam;
  public detune: MockAudioParam;
  public Q: MockAudioParam;
  public gain: MockAudioParam;

  constructor(context: MockAudioContext) {
    super(context);
    this.frequency = new MockAudioParam(350);
    this.detune = new MockAudioParam(0);
    this.Q = new MockAudioParam(1);
    this.gain = new MockAudioParam(0);
  }
}

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom';

export class MockOscillatorNode extends MockAudioNode {
  public type: OscillatorType = 'sine';
  public frequency: MockAudioParam;
  public detune: MockAudioParam;
  public started = false;
  public stopped = false;

  constructor(context: MockAudioContext) {
    super(context);
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
  }

  public start(_when = 0): void {
    this.started = true;
  }

  public stop(_when = 0): void {
    this.stopped = true;
  }
}

export class MockAudioContext {
  public state: 'suspended' | 'running' | 'closed' = 'running';
  public sampleRate = 44100;
  public destination: MockAudioDestinationNode;
  private _startTime: number;

  constructor() {
    this._startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.destination = new MockAudioDestinationNode(this);
  }

  public get currentTime(): number {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return Math.max(0, (now - this._startTime) / 1000);
  }

  public async resume(): Promise<void> {
    this.state = 'running';
  }

  public async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  public async close(): Promise<void> {
    this.state = 'closed';
  }

  public createGain(): MockGainNode {
    return new MockGainNode(this);
  }

  public createBuffer(numberOfChannels: number, length: number, sampleRate: number): MockAudioBuffer {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate);
  }

  public createBufferSource(): MockAudioBufferSourceNode {
    return new MockAudioBufferSourceNode(this);
  }

  public createBiquadFilter(): MockBiquadFilterNode {
    return new MockBiquadFilterNode(this);
  }

  public createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode(this);
  }

  public createDynamicsCompressor() {
    return {
      threshold: new MockAudioParam(-24),
      knee: new MockAudioParam(30),
      ratio: new MockAudioParam(12),
      attack: new MockAudioParam(0.003),
      release: new MockAudioParam(0.25),
      connect: () => this.destination,
      disconnect: () => {},
    };
  }

  public createDelay() {
    return {
      delayTime: new MockAudioParam(0),
      connect: () => this.destination,
      disconnect: () => {},
    };
  }

  public createStereoPanner() {
    return {
      pan: new MockAudioParam(0),
      connect: () => this.destination,
      disconnect: () => {},
    };
  }
}

// Bind AudioContext to both window and globalThis
const AudioContextCtor = MockAudioContext as unknown as typeof AudioContext;
if (typeof window !== 'undefined') {
  window.AudioContext = AudioContextCtor;
  (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext = AudioContextCtor;
}
if (typeof globalThis !== 'undefined') {
  globalThis.AudioContext = AudioContextCtor;
  (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext = AudioContextCtor;
}

// ============================================================================
// 4. Global DOM, Canvas & Layout Polyfills
// ============================================================================

if (typeof window !== 'undefined') {
  // 4.1 Intercept HTMLCanvasElement.prototype.getContext
  if (typeof HTMLCanvasElement !== 'undefined') {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...args: any[]
    ): any {
      if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'experimental-webgl') {
        const self = this as any;
        if (!self._mockWebGL2Context) {
          self._mockWebGL2Context = createMockWebGL2Context(this);
        }
        return self._mockWebGL2Context;
      }
      if (contextId === '2d') {
        const self = this as any;
        if (!self._mock2DContext) {
          self._mock2DContext = createMock2DContext(this);
        }
        return self._mock2DContext;
      }
      return originalGetContext ? (originalGetContext as any).apply(this, [contextId, ...args]) : null;
    };

    // 4.2 Define client dimensions and getBoundingClientRect for layout and raycasting
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
      get() {
        return typeof this.width === 'number' ? this.width : 800;
      },
      configurable: true,
    });

    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
      get() {
        return typeof this.height === 'number' ? this.height : 600;
      },
      configurable: true,
    });

    HTMLCanvasElement.prototype.getBoundingClientRect = function (this: HTMLCanvasElement): DOMRect {
      const width = typeof this.width === 'number' ? this.width : 800;
      const height = typeof this.height === 'number' ? this.height : 600;
      return {
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect;
    };
  }

  // 4.3 Animation Frame Polyfills
  let lastTime = 0;
  const raf = (callback: FrameRequestCallback): number => {
    const now = performance.now();
    const delay = Math.max(0, 16 - (now - lastTime));
    const id = setTimeout(() => {
      lastTime = performance.now();
      callback(lastTime);
    }, delay) as unknown as number;
    return id;
  };
  const caf = (id: number): void => {
    clearTimeout(id);
  };

  window.requestAnimationFrame = raf;
  window.cancelAnimationFrame = caf;
  globalThis.requestAnimationFrame = raf;
  globalThis.cancelAnimationFrame = caf;

  // 4.4 Device Pixel Ratio
  if (typeof window.devicePixelRatio === 'undefined' || window.devicePixelRatio === 0) {
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: 1,
    });
  }

  // 4.5 ResizeObserver Polyfill
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class MockResizeObserver implements ResizeObserver {
      private callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: {
                width: (target as HTMLCanvasElement).width || 800,
                height: (target as HTMLCanvasElement).height || 600,
                top: 0,
                left: 0,
                bottom: (target as HTMLCanvasElement).height || 600,
                right: (target as HTMLCanvasElement).width || 800,
                x: 0,
                y: 0,
                toJSON: () => {},
              },
              borderBoxSize: [],
              contentBoxSize: [],
              devicePixelContentBoxSize: [],
            } as unknown as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver
        );
      }
      unobserve() {}
      disconnect() {}
    }

    window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  }

  // 4.6 matchMedia Polyfill
  if (typeof window.matchMedia === 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  // 4.7 PointerEvent Polyfill
  if (typeof window.PointerEvent === 'undefined') {
    class MockPointerEvent extends MouseEvent {
      public pointerId = 1;
      public pointerType = 'mouse';
      public isPrimary = true;
      public pressure = 0;
      public tangentialPressure = 0;
      public tiltX = 0;
      public tiltY = 0;
      public twist = 0;
      public width = 1;
      public height = 1;
    }
    window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
    globalThis.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
  }
}

// 4.8 URL Object URL Stubs
if (typeof URL !== 'undefined') {
  if (typeof URL.createObjectURL === 'undefined') {
    URL.createObjectURL = () => 'blob:mock-url';
  }
  if (typeof URL.revokeObjectURL === 'undefined') {
    URL.revokeObjectURL = () => {};
  }
}
