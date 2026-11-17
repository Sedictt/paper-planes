import * as THREE from 'three';
import type { PaperPlaneNote, TimeOfDay, WeatherMode } from '../types';
import { IsometricCamera } from './camera/IsometricCamera';
import { DioramaWorld } from './world/DioramaWorld';
import { CottageInteriorBuilder } from './world/CottageInteriorBuilder';
import { BackgroundEnvironmentGroup } from './world/BackgroundEnvironmentGroup';
import { AtmosphereEffects } from './effects/AtmosphereEffects';
import { PaperPlaneSystem } from './entities/PaperPlaneSystem';
import { soundscape } from '../lib/soundscape';
import type { InteractivePropId, InteriorPropId } from '../lib/lore';

export type { TimeOfDay, WeatherMode, PaperPlaneNote };
export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface Palette {
  label: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  sea: string;
  seaDeep: string;
  seaFoam: string;
  river: string;
  sand: string;
  grass: string;
  grassAlt: string;
  cobble: string;
  cobbleLine: string;
  asphalt: string;
  crosswalk: string;
  windowLit: string;
  windowDark: string;
  windowChance: number;
  stars: number;
  cloudTop: string;
  cloudShade: string;
  streetLight: boolean;
  neon: boolean;
  shadeMul: number;
  shadowAlpha: number;
}

export interface ShaderDebugConfig {
  tintR: number;
  tintG: number;
  tintB: number;
  saturation: number;
  exposure: number;
  toneMappingExposure: number;
  tiltShiftMax: number;
  vignette: number;
  ambientIntensity: number;
  hemiIntensity: number;
  dirIntensity: number;
  dirColor: string;
  skyColor: string;
  waterDeep: string;
  waterShallow: string;
  waterFoam: string;
}

export type PaletteConfig = Palette;

export const PALETTES: Record<TimeOfDay, Palette> = {
  dawn: {
    label: 'Dawn',
    skyTop: '#6b7fc9',
    skyMid: '#c49dc2',
    skyBottom: '#ffd6b8',
    sea: '#4daab8',
    seaDeep: '#388999',
    seaFoam: '#e8fbfc',
    river: '#56b8c6',
    sand: '#e39e3c',
    grass: '#95a844',
    grassAlt: '#8b9e3d',
    cobble: '#996038',
    cobbleLine: '#734525',
    asphalt: '#4a2c19',
    crosswalk: '#e3a84e',
    windowLit: '#ffd470',
    windowDark: '#7a593c',
    windowChance: 0.8,
    stars: 0.35,
    cloudTop: '#f5e6d3',
    cloudShade: '#c9b59c',
    streetLight: true,
    neon: false,
    shadeMul: 0.98,
    shadowAlpha: 0.2,
  },
  morning: {
    label: 'Morning',
    skyTop: '#3f9de6',
    skyMid: '#8dd4f5',
    skyBottom: '#ffe9cf',
    sea: '#33d9e0',
    seaDeep: '#148cd9',
    seaFoam: '#8ce6e6',
    river: '#33cce6',
    sand: '#e5a03c',
    grass: '#9bb043',
    grassAlt: '#90a43c',
    cobble: '#9e6236',
    cobbleLine: '#784725',
    asphalt: '#4d2d18',
    crosswalk: '#e8a848',
    windowLit: '#ffd66b',
    windowDark: '#826042',
    windowChance: 0.9,
    stars: 0.3,
    cloudTop: '#f2ebd9',
    cloudShade: '#c9c1a9',
    streetLight: true,
    neon: false,
    shadeMul: 1.04,
    shadowAlpha: 0.18,
  },
  afternoon: {
    label: 'Afternoon',
    skyTop: '#3f9de6',
    skyMid: '#8dd4f5',
    skyBottom: '#ffe9cf',
    sea: '#33d9e0',
    seaDeep: '#148cd9',
    seaFoam: '#8ce6e6',
    river: '#33cce6',
    sand: '#e8a23f',
    grass: '#9fb446',
    grassAlt: '#94a83f',
    cobble: '#a16438',
    cobbleLine: '#7a4927',
    asphalt: '#4f2e19',
    crosswalk: '#ebaa4b',
    windowLit: '#ffd870',
    windowDark: '#7d5b3e',
    windowChance: 0.85,
    stars: 0.25,
    cloudTop: '#f5efe0',
    cloudShade: '#ccc4ac',
    streetLight: true,
    neon: false,
    shadeMul: 1.06,
    shadowAlpha: 0.2,
  },
  dusk: {
    label: 'Dusk',
    skyTop: '#4c5794',
    skyMid: '#a87d99',
    skyBottom: '#ffc494',
    sea: '#4697a6',
    seaDeep: '#327685',
    seaFoam: '#dff7f8',
    river: '#4ea4b3',
    sand: '#de9335',
    grass: '#8fa03e',
    grassAlt: '#849438',
    cobble: '#8f552e',
    cobbleLine: '#693d1f',
    asphalt: '#422513',
    crosswalk: '#e39f40',
    windowLit: '#ffd260',
    windowDark: '#694b32',
    windowChance: 1.0,
    stars: 0.55,
    cloudTop: '#ebd5be',
    cloudShade: '#b89f86',
    streetLight: true,
    neon: true,
    shadeMul: 0.96,
    shadowAlpha: 0.22,
  },
  evening: {
    label: 'Evening',
    skyTop: '#2d3630',
    skyMid: '#3a453c',
    skyBottom: '#495448',
    sea: '#364f4d',
    seaDeep: '#283d3b',
    seaFoam: '#9ec2bc',
    river: '#3b5452',
    sand: '#b57428',
    grass: '#5d6e2c',
    grassAlt: '#536326',
    cobble: '#633a1f',
    cobbleLine: '#472814',
    asphalt: '#2e190c',
    crosswalk: '#bd8030',
    windowLit: '#ffd466',
    windowDark: '#3d2c1e',
    windowChance: 1.0,
    stars: 0.85,
    cloudTop: '#637064',
    cloudShade: '#3d473e',
    streetLight: true,
    neon: true,
    shadeMul: 0.78,
    shadowAlpha: 0.3,
  },
  midnight: {
    label: 'Midnight',
    skyTop: '#18201d',
    skyMid: '#212b27',
    skyBottom: '#2b3832',
    sea: '#263b39',
    seaDeep: '#1b2b29',
    seaFoam: '#7ca39d',
    river: '#2a403e',
    sand: '#945d1f',
    grass: '#455420',
    grassAlt: '#3d4b1c',
    cobble: '#4d2d17',
    cobbleLine: '#361e0e',
    asphalt: '#211208',
    crosswalk: '#9c6825',
    windowLit: '#ffda75',
    windowDark: '#2b1f15',
    windowChance: 1.0,
    stars: 1.0,
    cloudTop: '#3d4a43',
    cloudShade: '#242e29',
    streetLight: true,
    neon: true,
    shadeMul: 0.66,
    shadowAlpha: 0.35,
  },
};

export class ThreeWorldEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraCtrl: IsometricCamera;
  private worldGroup: THREE.Group;
  private diorama: DioramaWorld | null = null;
  private cottageInterior: CottageInteriorBuilder | null = null;
  private insideCottage = false;
  private savedOutdoorCam = { camX: 0, camY: -175, zoom: 1.6 };
  private cutsceneLocked = false;
  private savedCutsceneCam = { camX: 0, camY: -175, zoom: 1.6 };
  private atmosphere: AtmosphereEffects | null = null;
  private planeSystem: PaperPlaneSystem | null = null;

  // Lights
  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;

  // Tilt-shift bokeh + color-grade post-processing
  private postRT: THREE.WebGLRenderTarget;
  private postScene: THREE.Scene;
  private postCamera: THREE.Camera;
  private postGeo: THREE.PlaneGeometry;
  private postMat: THREE.ShaderMaterial;
  private backgroundEnv: BackgroundEnvironmentGroup;
  private tiltShiftMax = 0.85;
  private graphicsQuality: GraphicsQuality = 'high';
  private volumetricScale = 1.35;
  private bloomEnabled = true;

  // Viewport & Frustum metrics
  private virtualHeight = 740;
  private pixW = 1280;
  private pixH = 740;

  // Atmosphere State
  private _timeOfDay: TimeOfDay = 'morning';
  private _weather: WeatherMode = 'clear';
  public fireworksActive = false;

  public get weather(): WeatherMode {
    return this._weather;
  }
  public set weather(v: WeatherMode) {
    if (this._weather !== v) {
      this._weather = v;
      this.diorama?.setWeather(v);
      this.atmosphere?.setWeather(v);
      this.backgroundEnv?.setWeather(v);
    }
  }

  public getDiorama(): DioramaWorld | null {
    return this.diorama;
  }

  public getAtmosphere(): AtmosphereEffects | null {
    return this.atmosphere;
  }

  public getPlaneSystem(): PaperPlaneSystem | null {
    return this.planeSystem;
  }

  // Callbacks
  private onSelectPlane: (note: PaperPlaneNote) => void;
  private onZoomChange: (z: number) => void;

  // Loop & Lifecycle
  private rafId = 0;
  private isRunning = false;
  private lastTime = 0;
  private resizeObserver: ResizeObserver | null = null;

  // Interaction State
  private isDragging = false;
  private dragMoved = false;
  private dragOrigin = { x: 0, y: 0 };
  private dragStart = { x: 0, y: 0 };
  private touchVel = { x: 0, y: 0 };
  private lastTouchTime = 0;
  private lastTouchEndTime = 0;
  private pinchDist = 0;
  private planesPool: PaperPlaneNote[] = [];

  // Public Camera State Accessors for backward compatibility
  public get zoom(): number {
    return this.cameraCtrl.zoom;
  }
  public set zoom(v: number) {
    this.cameraCtrl.zoom = v;
    this.cameraCtrl.targetZoom = v;
    this.cameraCtrl.syncCameraTransform();
  }

  public get camX(): number {
    return this.cameraCtrl.camX;
  }
  public set camX(v: number) {
    this.cameraCtrl.camX = v;
    this.cameraCtrl.targetCamX = v;
    this.cameraCtrl.syncCameraTransform();
  }

  public get camY(): number {
    return this.cameraCtrl.camY;
  }
  public set camY(v: number) {
    this.cameraCtrl.camY = v;
    this.cameraCtrl.targetCamY = v;
    this.cameraCtrl.syncCameraTransform();
  }

  public get timeOfDay(): TimeOfDay {
    return this._timeOfDay;
  }
  public set timeOfDay(v: TimeOfDay) {
    if (this._timeOfDay !== v) {
      this._timeOfDay = v;
      this.updatePaletteColors();
    }
  }

  constructor(
    canvas: HTMLCanvasElement,
    onSelectPlane: (note: PaperPlaneNote) => void,
    onZoomChange: (z: number) => void
  ) {
    this.canvas = canvas;
    this.onSelectPlane = onSelectPlane;
    this.onZoomChange = onZoomChange;

    // 1. Initialize WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      stencil: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const maxDpr = this.graphicsQuality === 'low' ? 1 : this.graphicsQuality === 'medium' ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.renderer.setPixelRatio(dpr);

    // 2. Initialize Scene & World Group
    this.scene = new THREE.Scene();
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // 2b. Mount Diorama World Container
    this.diorama = new DioramaWorld(PALETTES[this._timeOfDay]);
    this.worldGroup.add(this.diorama.group);

    // 2c. Mount Atmosphere Effects (Campfire Light, Fireflies, Leaves, Weather, Fireworks)
    this.atmosphere = new AtmosphereEffects(
      this.diorama.getCampfirePosition(),
      PALETTES[this._timeOfDay]
    );
    this.worldGroup.add(this.atmosphere.group);

    // 2d. Mount 3D Paper Plane Entity System
    this.planeSystem = new PaperPlaneSystem((gx, gy) => this.getSurfaceElevation(gx, gy));
    this.worldGroup.add(this.planeSystem.group);

    this.cottageInterior = new CottageInteriorBuilder(this._timeOfDay);
    this.worldGroup.add(this.cottageInterior.group);

    // 3. Initialize Lighting (matched to floating-island.html in Three.js r187 physical units)
    this.ambientLight = new THREE.AmbientLight(0xcfeaff, 0.15);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xcfeaff, 0xa08060, 1.5);
    this.scene.add(this.hemiLight);

    // Sun shining from front-left/top onto island center (-303, 30, 303) matching floating-island.html (14, 22, 9)
    this.dirLight = new THREE.DirectionalLight(0xfff0d0, 2.8);
    this.dirLight.position.set(-303 + 370, 30 + 580, 303 + 240);
    this.dirLight.target.position.set(-303, 30, 303);
    this.scene.add(this.dirLight.target);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 50;
    this.dirLight.shadow.camera.far = 2200;
    const shadowD = 480;
    this.dirLight.shadow.camera.left = -shadowD;
    this.dirLight.shadow.camera.right = shadowD;
    this.dirLight.shadow.camera.top = shadowD;
    this.dirLight.shadow.camera.bottom = -shadowD;
    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.normalBias = 0.6;
    this.scene.add(this.dirLight);

    // 4. Initialize Camera & Projection (zoom range [1.55x .. 4.5x], default overview 1.6x)
    this.cameraCtrl = new IsometricCamera(
      { virtualHeight: this.virtualHeight, initialZoom: 1.6, minZoom: 1.55, maxZoom: 4.5 },
      (z) => this.onZoomChange(z)
    );

    // 4a. Multi-layered Atmospheric Sky, Horizon Sun, Distant Islands, Cloud Sea & Birds
    this.backgroundEnv = new BackgroundEnvironmentGroup(
      this.virtualHeight,
      this._timeOfDay,
      this._weather
    );
    this.scene.add(this.backgroundEnv.group);
    this.scene.add(this.cameraCtrl.camera);

    // 4b. Exact Tilt-Shift Bokeh + Grade Post-Processing Shader from floating-island.html
    const samples = this.renderer.capabilities?.isWebGL2 ? 4 : 0;
    this.postRT = new THREE.WebGLRenderTarget(4, 4, {
      samples,
      type: THREE.HalfFloatType,
      stencilBuffer: true,
    });
    this.postGeo = new THREE.PlaneGeometry(2, 2);
    this.postMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        t: { value: this.postRT.texture },
        asp: { value: 1 },
        str: { value: 0 },
        uSunUv: { value: new THREE.Vector2(0.8, 0.6) },
        uSunColor: { value: new THREE.Color('#fff1cf') },
        uRayStr: { value: 0.2 },
        uBloom: { value: 1.0 },
      },
      vertexShader: 'varying vec2 u;void main(){u=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `uniform sampler2D t;uniform float asp,str,uRayStr,uBloom;uniform vec2 uSunUv;uniform vec3 uSunColor;varying vec2 u;
void main(){float m=smoothstep(.14,.5,abs(u.y-.46)+abs(u.x-.5)*.18);float r=.0008+m*.026*str;
vec3 acc=texture2D(t,u).rgb;float w=1.;
for(int i=0;i<28;i++){float fi=float(i)+1.;float a=fi*2.39996;vec2 o=vec2(cos(a)/asp,sin(a))*sqrt(fi/28.)*r;vec3 c=texture2D(t,u+o).rgb;float l=dot(c,vec3(.3,.59,.11));float k=1.+pow(l,3.)*1.5;acc+=c*k;w+=k;}
vec3 linearCol=acc/w;
if(uBloom>0.01){vec3 bloomAcc=vec3(0.);float bw=0.;
for(int i=0;i<12;i++){float a=float(i)*0.523599;float rad=(mod(float(i),2.)<0.5)?0.012:0.028;vec2 bo=vec2(cos(a)/asp,sin(a))*rad;vec3 bc=texture2D(t,clamp(u+bo,0.001,0.999)).rgb;float bl=dot(bc,vec3(.3,.59,.11));float wt=smoothstep(0.62,1.25,bl);bloomAcc+=max(bc-vec3(0.55),vec3(0.))*wt;bw+=1.;}
linearCol+=(bloomAcc/max(bw,1.))*0.85*uBloom;}
if(uRayStr>0.001){vec2 delta=(uSunUv-u)*0.042;vec2 rayUv=u;float raySum=0.;float decay=1.;
for(int i=0;i<14;i++){rayUv+=delta;vec3 s=texture2D(t,clamp(rayUv,0.001,0.999)).rgb;float lum=dot(s,vec3(.3,.59,.11));raySum+=smoothstep(0.18,0.72,lum)*decay*0.085;decay*=0.88;}
float distFalloff=1.-smoothstep(0.0,1.05,length((u-uSunUv)*vec2(asp,1.0)));
linearCol+=uSunColor*raySum*distFalloff*uRayStr;}
vec3 c=pow(max(linearCol,vec3(0.)),vec3(1./2.2));float L=dot(c,vec3(.3,.59,.11));c=mix(vec3(L),c,1.18);c*=.94;c=(c-.5)*1.1+.5;c=c/(1.+max(c-.8,0.)*.8);c*=vec3(1.02,1.,.98);
c*=1.-smoothstep(.45,.95,distance(u,vec2(.5)))*.34;gl_FragColor=vec4(c,1.);}`,
    });
    const postMesh = new THREE.Mesh(this.postGeo, this.postMat);
    postMesh.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.Camera();
    this.postScene.add(postMesh);

    // 5. Update Backdrop & Initial Lighting
    this.updatePaletteColors();

    // 6. Bind Events & Observers
    this.bindEvents();
    this.handleResize();

    // 7. Start Animation Loop
    this.startLoop();
  }

  private updatePaletteColors(): void {
    const pal = PALETTES[this._timeOfDay];
    if (!pal) return;

    this.scene.background = new THREE.Color(pal.skyMid);
    this.backgroundEnv?.setTimeOfDay(this._timeOfDay);
    this.cottageInterior?.setTimeOfDay(this._timeOfDay);
    const isNight = this._timeOfDay === 'midnight' || this._timeOfDay === 'evening';

    if (this.ambientLight) {
      this.ambientLight.color.set(pal.skyTop);
      this.ambientLight.intensity = pal.shadeMul * (isNight ? 0.28 : 0.15);
    }

    if (this.hemiLight) {
      this.hemiLight.color.set(isNight ? '#5c769e' : '#cfeaff');
      this.hemiLight.groundColor.set(isNight ? '#2e2938' : '#a08060');
      this.hemiLight.intensity = pal.shadeMul * (isNight ? 0.78 : 1.5);
    }

    if (this.dirLight) {
      this.dirLight.color.set(isNight ? '#99b8eb' : '#fff0d0');
      this.dirLight.intensity = isNight ? 1.18 : 2.8 * pal.shadeMul;
    }

    if (this.diorama) {
      this.diorama.setPalette(pal);
      this.diorama.setTimeOfDay(this._timeOfDay);
    }

    if (this.atmosphere) {
      this.atmosphere.setPalette(pal);
      this.atmosphere.setTimeOfDay(this._timeOfDay);
    }
  }

  // ---------------------------------------------------------------------------
  // RESIZE & DPR HANDLING
  // ---------------------------------------------------------------------------
  private handleResize = () => {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth || window.innerWidth || 1280);
    const height = Math.max(1, parent?.clientHeight || window.innerHeight || 740);
    const aspect = width / height;

    const maxDpr = this.graphicsQuality === 'low' ? 1 : this.graphicsQuality === 'medium' ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    if (this.renderer.getPixelRatio() !== dpr) {
      this.renderer.setPixelRatio(dpr);
    }

    this.renderer.setSize(width, height, false);
    this.postRT.setSize(Math.max(1, Math.floor(width * dpr)), Math.max(1, Math.floor(height * dpr)));
    this.postMat.uniforms.asp.value = aspect;

    this.pixH = this.virtualHeight;
    this.pixW = Math.round(this.pixH * aspect);

    this.cameraCtrl.updateAspect(aspect);
  };

  // ---------------------------------------------------------------------------
  // EVENT BINDINGS & DISPOSAL
  // ---------------------------------------------------------------------------
  private bindEvents(): void {
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
    window.addEventListener('resize', this.handleResize);

    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('click', this.onClick);

    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
    this.canvas.addEventListener('touchend', this.onTouchEnd);
    this.canvas.addEventListener('touchcancel', this.onTouchCancel);

    this.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  };

  private onContextRestored = (): void => {
    this.handleResize();
    this.startLoop();
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (this.cutsceneLocked) return;
    this.cameraCtrl.adjustZoom(e.deltaY < 0 ? 0.15 : -0.15);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.cutsceneLocked) return;
    this.cameraCtrl.stopMomentum();
    this.isDragging = true;
    this.dragMoved = false;
    this.dragOrigin = { x: e.clientX, y: e.clientY };
    this.dragStart = { x: e.clientX, y: e.clientY };
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.cutsceneLocked) {
      this.canvas.style.cursor = 'default';
      delete this.canvas.dataset.hoverTarget;
      return;
    }
    if (this.isDragging) {
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      if (Math.hypot(e.clientX - this.dragOrigin.x, e.clientY - this.dragOrigin.y) > 6) {
        this.dragMoved = true;
      }
      this.cameraCtrl.panByScreenDelta(dx, dy, this.canvas.clientWidth, this.canvas.clientHeight);
      this.dragStart = { x: e.clientX, y: e.clientY };
      return;
    }

    if (this.insideCottage) {
      const interiorHit =
        this.cottageInterior?.pickPropAt(e.clientX, e.clientY, this.canvas, this.cameraCtrl.camera) ??
        null;
      this.cottageInterior?.setHoveredProp(interiorHit);
      this.diorama?.setHoveredProp(null);
      if (interiorHit) {
        this.canvas.style.cursor = 'pointer';
        this.canvas.dataset.hoverTarget = interiorHit;
      } else {
        this.canvas.style.cursor = 'grab';
        delete this.canvas.dataset.hoverTarget;
      }
      return;
    }

    if (this.planeSystem) {
      const hit = this.planeSystem.pickPlaneAt(
        e.clientX,
        e.clientY,
        this.canvas,
        this.cameraCtrl.camera,
        false
      );
      this.planeSystem.hoveredPlane = hit;
      const propHit = !hit
        ? this.diorama?.pickInteractivePropAt(
            e.clientX,
            e.clientY,
            this.canvas,
            this.cameraCtrl.camera
          ) ?? null
        : null;
      this.diorama?.setHoveredProp(propHit);

      if (hit) {
        this.canvas.style.cursor = 'pointer';
        this.canvas.dataset.hoverTarget = 'plane';
      } else if (propHit) {
        this.canvas.style.cursor = 'pointer';
        this.canvas.dataset.hoverTarget = propHit;
      } else {
        this.canvas.style.cursor = 'grab';
        delete this.canvas.dataset.hoverTarget;
      }
    }
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  private handleInteractivePropClick(propHit: InteractivePropId): void {
    this.diorama?.triggerPropPulse(propHit);
    if (propHit === 'frog') {
      soundscape.playFrogRibbit();
      window.dispatchEvent(new CustomEvent('paperplanes:frog-click'));
    }
    window.dispatchEvent(new CustomEvent('paperplanes:prop-click', { detail: { id: propHit } }));
  }

  private onClick = (e: MouseEvent): void => {
    if (this.dragMoved || this.cutsceneLocked) return;
    // Ignore synthetic click events fired immediately after touchend on mobile browsers
    if (performance.now() - this.lastTouchEndTime < 450) return;
    if (this.insideCottage) {
      const interiorHit = this.cottageInterior?.pickPropAt(
        e.clientX,
        e.clientY,
        this.canvas,
        this.cameraCtrl.camera
      );
      if (interiorHit) {
        this.cottageInterior?.triggerPropPulse(interiorHit);
        window.dispatchEvent(
          new CustomEvent('paperplanes:prop-click', { detail: { id: interiorHit } })
        );
      }
      return;
    }

    if (this.planeSystem) {
      const hit = this.planeSystem.pickPlaneAt(
        e.clientX,
        e.clientY,
        this.canvas,
        this.cameraCtrl.camera,
        false
      );
      if (hit) {
        this.onSelectPlane(hit.note);
        return;
      }
    }
    const propHit = this.diorama?.pickInteractivePropAt(
      e.clientX,
      e.clientY,
      this.canvas,
      this.cameraCtrl.camera
    );
    if (propHit) {
      this.handleInteractivePropClick(propHit);
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (this.cutsceneLocked) return;
    this.cameraCtrl.stopMomentum();
    if (e.touches.length === 2) {
      this.isDragging = false;
      this.dragMoved = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinchDist = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      this.isDragging = true;
      this.dragMoved = false;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      this.dragOrigin = { x, y };
      this.dragStart = { x, y };
      this.touchVel = { x: 0, y: 0 };
      this.lastTouchTime = performance.now();
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length === 2 && this.pinchDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const diff = (dist - this.pinchDist) * 0.005;
      this.cameraCtrl.adjustZoom(diff);
      this.pinchDist = dist;
      this.dragMoved = true;
    } else if (e.touches.length === 1 && this.isDragging) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      if (!this.dragMoved && Math.hypot(x - this.dragOrigin.x, y - this.dragOrigin.y) <= 14) {
        return;
      }
      this.dragMoved = true;

      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      const now = performance.now();
      const dtSec = Math.max(0.004, (now - this.lastTouchTime) / 1000);
      const instVx = dx / dtSec;
      const instVy = dy / dtSec;
      this.touchVel.x = this.touchVel.x * 0.45 + instVx * 0.55;
      this.touchVel.y = this.touchVel.y * 0.45 + instVy * 0.55;
      this.lastTouchTime = now;

      this.cameraCtrl.panByScreenDelta(dx, dy, this.canvas.clientWidth, this.canvas.clientHeight);
      this.dragStart = { x, y };
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (this.cutsceneLocked) return;
    this.lastTouchEndTime = performance.now();
    // Seamless 2-to-1 finger transition without camera jump
    if (e.touches.length === 1) {
      this.pinchDist = 0;
      this.isDragging = true;
      this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.touchVel = { x: 0, y: 0 };
      this.lastTouchTime = performance.now();
      return;
    }

    if (
      !this.dragMoved &&
      e.changedTouches &&
      e.changedTouches.length === 1 &&
      this.planeSystem
    ) {
      const t = e.changedTouches[0];
      if (this.insideCottage) {
        const interiorHit = this.cottageInterior?.pickPropAt(
          t.clientX,
          t.clientY,
          this.canvas,
          this.cameraCtrl.camera
        );
        if (interiorHit) {
          this.cottageInterior?.triggerPropPulse(interiorHit);
          window.dispatchEvent(
            new CustomEvent('paperplanes:prop-click', { detail: { id: interiorHit } })
          );
        }
      } else {
        const hit = this.planeSystem.pickPlaneAt(
          t.clientX,
          t.clientY,
          this.canvas,
          this.cameraCtrl.camera,
          true
        );
        if (hit) {
          this.onSelectPlane(hit.note);
        } else {
          const propHit = this.diorama?.pickInteractivePropAt(
            t.clientX,
            t.clientY,
            this.canvas,
            this.cameraCtrl.camera,
            true
          );
          if (propHit) {
            this.handleInteractivePropClick(propHit);
          }
        }
      }
    } else if (this.dragMoved && performance.now() - this.lastTouchTime < 90) {
      this.cameraCtrl.setPanVelocity(
        this.touchVel.x,
        this.touchVel.y,
        this.canvas.clientWidth,
        this.canvas.clientHeight
      );
    }

    this.isDragging = false;
    this.pinchDist = 0;
    this.touchVel = { x: 0, y: 0 };
  };

  private onTouchCancel = (): void => {
    this.isDragging = false;
    this.pinchDist = 0;
    this.touchVel = { x: 0, y: 0 };
    this.cameraCtrl.stopMomentum();
  };

  // ---------------------------------------------------------------------------
  // PUBLIC CONTROLS & COMPATIBILITY
  // ---------------------------------------------------------------------------
  public syncPlanes(notes: PaperPlaneNote[]): void {
    this.planesPool = notes;
    this.planeSystem?.syncPlanes(notes);
  }

  public getSurfaceElevation(gx: number, gy: number): number {
    if (Math.abs(gx - 5.5) < 0.1 && Math.abs(gy - 5.5) < 0.1) return 25;
    if (this.diorama) {
      return this.diorama.getTerrainElevation(gx, gy);
    }
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const sum = ix + iy;
    if (sum <= 5) return 52;
    if (sum <= 7) return 42;
    if (ix === 4 && iy >= 8) return 14;
    if (sum <= 9 && ix <= 4) return 34;
    if (ix >= 6 && iy <= 4) return 34;
    if (ix === 2 && iy === 9) return 26;
    return 25;
  }

  public focusBiome(gx: number, gy: number, targetZoom: number): void {
    const elev = this.getSurfaceElevation(gx, gy);
    this.cameraCtrl.focusBiome(gx, gy, targetZoom, elev);
  }

  public adjustZoom(delta: number): void {
    this.cameraCtrl.adjustZoom(delta);
  }

  public triggerFireworkVolley(): void {
    this.atmosphere?.triggerFireworkVolley();
  }

  public triggerLanternWindSwell(): void {
    this.diorama?.triggerLanternWindSwell();
  }

  public enterFrogCutscene(): void {
    if (this.insideCottage) {
      this.exitCottage();
    }
    this.savedCutsceneCam = {
      camX: this.cameraCtrl.camX,
      camY: this.cameraCtrl.camY,
      zoom: this.cameraCtrl.zoom,
    };
    this.cutsceneLocked = true;
    this.isDragging = false;
    this.diorama?.setHoveredProp(null);
    const frogPos = new THREE.Vector3();
    if (this.diorama?.getPropWorldPosition('frog', frogPos)) {
      this.cameraCtrl.focusWorldPoint(frogPos, 10.5, -14);
    } else {
      this.cameraCtrl.focusBiome(6.2, 6.2, 4.5, 18);
    }
    this.diorama?.triggerPropPulse('frog');
    soundscape.playFrogRibbit();
  }

  public exitFrogCutscene(): void {
    if (!this.cutsceneLocked) return;
    this.cutsceneLocked = false;
    this.cameraCtrl.targetCamX = this.savedCutsceneCam.camX;
    this.cameraCtrl.targetCamY = this.savedCutsceneCam.camY;
    this.cameraCtrl.targetZoom = this.savedCutsceneCam.zoom;
  }

  public pulseFrogInCutscene(): void {
    this.diorama?.triggerPropPulse('frog');
    soundscape.playFrogRibbit();
  }

  public isInsideCottage(): boolean {
    return this.insideCottage;
  }

  public enterCottage(): void {
    if (this.insideCottage || !this.cottageInterior || !this.diorama) return;
    this.savedOutdoorCam = {
      camX: this.cameraCtrl.camX,
      camY: this.cameraCtrl.camY,
      zoom: this.cameraCtrl.zoom,
    };
    this.insideCottage = true;
    this.diorama.group.visible = false;
    if (this.planeSystem) this.planeSystem.group.visible = false;
    if (this.atmosphere) this.atmosphere.group.visible = false;
    this.cottageInterior.group.visible = true;
    this.cameraCtrl.focusBiome(5.5, 5.5, 1.85, 26);
    soundscape.setIndoorMuffled(true);
    window.dispatchEvent(new CustomEvent('paperplanes:cottage-state', { detail: { inside: true } }));
  }

  public exitCottage(): void {
    if (!this.insideCottage || !this.cottageInterior || !this.diorama) return;
    this.insideCottage = false;
    this.cottageInterior.group.visible = false;
    this.diorama.group.visible = true;
    if (this.planeSystem) this.planeSystem.group.visible = true;
    if (this.atmosphere) this.atmosphere.group.visible = true;
    this.cameraCtrl.targetCamX = this.savedOutdoorCam.camX;
    this.cameraCtrl.targetCamY = this.savedOutdoorCam.camY;
    this.cameraCtrl.targetZoom = this.savedOutdoorCam.zoom;
    soundscape.setIndoorMuffled(false);
    window.dispatchEvent(new CustomEvent('paperplanes:cottage-state', { detail: { inside: false } }));
  }

  public getPropScreenPosition(propId: string): { x: number; y: number } | null {
    const worldPos = new THREE.Vector3();
    let ok = false;
    if (this.insideCottage) {
      if (!this.cottageInterior) return null;
      ok = this.cottageInterior.getPropWorldPosition(propId as InteriorPropId, worldPos);
    } else {
      if (!this.diorama) return null;
      ok = this.diorama.getPropWorldPosition(propId as InteractivePropId, worldPos);
    }
    if (!ok) return null;
    worldPos.project(this.cameraCtrl.camera);
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.left + (worldPos.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height,
    };
  }

  public getFrogScreenPosition(): { x: number; y: number } | null {
    return this.getPropScreenPosition('frog');
  }

  public captureSnapshotDataUrl(): string | null {
    try {
      this.render();
      return this.canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER LOOP & UPDATE
  // ---------------------------------------------------------------------------
  private startLoop(): void {
    this.isRunning = true;
    this.lastTime = performance.now();

    const tick = (now: number) => {
      if (!this.isRunning) return;
      this.rafId = requestAnimationFrame(tick);

      const elapsed = (now - this.lastTime) / 1000;
      this.lastTime = now;

      const dt = Math.max(0, Math.min(0.05, elapsed || 1 / 60));

      this.update(dt);
      this.render();
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public getShaderDebugConfig(): ShaderDebugConfig {
    const pal = PALETTES[this._timeOfDay];
    return {
      tintR: 1.02,
      tintG: 1.0,
      tintB: 0.98,
      saturation: 1.18,
      exposure: 0.94,
      toneMappingExposure: Number(this.renderer.toneMappingExposure.toFixed(2)),
      tiltShiftMax: Number(this.tiltShiftMax.toFixed(2)),
      vignette: 0.34,
      ambientIntensity: Number(this.ambientLight.intensity.toFixed(2)),
      hemiIntensity: Number(this.hemiLight.intensity.toFixed(2)),
      dirIntensity: Number(this.dirLight.intensity.toFixed(2)),
      dirColor: `#${this.dirLight.color.getHexString()}`,
      skyColor:
        this.scene.background instanceof THREE.Color
          ? `#${this.scene.background.getHexString()}`
          : pal.skyMid,
      waterDeep: pal.seaDeep,
      waterShallow: pal.sea,
      waterFoam: pal.seaFoam,
    };
  }

  public applyShaderDebugConfig(cfg: Partial<ShaderDebugConfig>): void {
    if (cfg.toneMappingExposure !== undefined) {
      this.renderer.toneMappingExposure = cfg.toneMappingExposure;
    }
    if (cfg.tiltShiftMax !== undefined) this.tiltShiftMax = cfg.tiltShiftMax;
    if (cfg.ambientIntensity !== undefined) this.ambientLight.intensity = cfg.ambientIntensity;
    if (cfg.hemiIntensity !== undefined) this.hemiLight.intensity = cfg.hemiIntensity;
    if (cfg.dirIntensity !== undefined) this.dirLight.intensity = cfg.dirIntensity;
    if (cfg.dirColor !== undefined) this.dirLight.color.set(cfg.dirColor);
    if (cfg.skyColor !== undefined) {
      this.scene.background = new THREE.Color(cfg.skyColor);
    }
  }

  public resetShaderDebugConfig(): void {
    this.renderer.toneMappingExposure = 1.0;
    this.tiltShiftMax = 0.85;
    this.updatePaletteColors();
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphicsQuality = quality;
    const enableShadows = quality !== 'low';
    this.renderer.shadowMap.enabled = enableShadows;
    this.dirLight.castShadow = enableShadows;
    this.tiltShiftMax = quality === 'low' ? 0 : quality === 'medium' ? 0.55 : 0.85;
    this.handleResize();
  }

  public setVolumetricIntensity(scale: number): void {
    this.volumetricScale = Math.max(0, Math.min(2, scale));
    this.diorama?.setVolumetricScale(this.volumetricScale);
  }

  public setBloomEnabled(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.postMat.uniforms.uBloom.value = enabled ? 1.0 : 0.0;
  }

  public getGraphicsSettings(): { quality: GraphicsQuality; volumetric: number; bloom: boolean } {
    return { quality: this.graphicsQuality, volumetric: this.volumetricScale, bloom: this.bloomEnabled };
  }

  private update(dt: number): void {
    this.cameraCtrl.update(dt);
    soundscape.updateCameraLocation(
      -this.cameraCtrl.camX,
      -this.cameraCtrl.camY,
      this.cameraCtrl.zoom,
      this._timeOfDay
    );

    // Ramp tilt-shift bokeh strength smoothly as the user zooms in past 1.55x (keep crisp during frog cutscene)
    const k = Math.min(1, Math.max(0, (this.cameraCtrl.zoom - 1.55) / (2.6 - 1.55)));
    this.postMat.uniforms.str.value = this.cutsceneLocked
      ? 0.15
      : this.tiltShiftMax * (k * k * (3 - 2 * k));

    const elapsed = performance.now() / 1000;
    this.backgroundEnv?.update(dt, elapsed, this.cameraCtrl.camera, this.cameraCtrl.zoom);
    if (this.backgroundEnv) {
      this.backgroundEnv.getSunScreenUv(this.cameraCtrl.camera, this.postMat.uniforms.uSunUv.value);
      const rayCfg = this.backgroundEnv.getSunRayConfig();
      this.postMat.uniforms.uSunColor.value.copy(rayCfg.color);
      this.postMat.uniforms.uRayStr.value = rayCfg.strength * this.volumetricScale;
    }
    this.diorama?.update(dt, elapsed);
    this.cottageInterior?.update(dt, elapsed);
    this.atmosphere?.update(dt, elapsed, this.fireworksActive);
    this.planeSystem?.update(dt, elapsed);
  }

  private render(): void {
    this.renderer.setRenderTarget(this.postRT);
    this.renderer.render(this.scene, this.cameraCtrl.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  // ---------------------------------------------------------------------------
  // CLEANUP & DISPOSAL
  // ---------------------------------------------------------------------------
  public destroy(): void {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener('resize', this.handleResize);

    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('click', this.onClick);

    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchCancel);

    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);

    if (this.planeSystem) {
      this.planeSystem.dispose();
      this.planeSystem = null;
    }

    if (this.atmosphere) {
      this.atmosphere.dispose();
      this.atmosphere = null;
    }

    if (this.diorama) {
      this.diorama.dispose();
      this.diorama = null;
    }

    if (this.cottageInterior) {
      this.cottageInterior.dispose();
      this.cottageInterior = null;
    }

    if (this.backgroundEnv) {
      this.backgroundEnv.dispose();
    }

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        obj.geometry?.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            for (const key of Object.keys(m)) {
              const val = (m as any)[key];
              if (
                val &&
                typeof val === 'object' &&
                'isTexture' in val &&
                typeof val.dispose === 'function'
              ) {
                val.dispose();
              }
            }
            m.dispose();
          });
        }
      }
    });
    this.scene.clear();

    this.postRT.dispose();
    this.postGeo.dispose();
    this.postMat.dispose();
    this.postScene.clear();

    this.renderer.dispose();
    try {
      this.renderer.forceContextLoss();
    } catch {
      // Ignored in test/headless environments without WEBGL_lose_context extension
    }
  }
}
