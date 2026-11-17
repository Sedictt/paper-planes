import * as THREE from 'three';
import type { TimeOfDay, WeatherMode } from '../../types';
import { TILE_SPACING, ELEV_UNIT } from './TerrainBuilder';

interface SkyAtmospherePreset {
  zenith: string;
  horizonLeft: string;
  horizonRight: string;
  bottom: string;
  sunCore: string;
  sunHalo: string;
  sunOpacity: number;
  stars: number;
  fogMix: number;
  birdColor: string;
}

const SKY_PRESETS: Record<TimeOfDay, SkyAtmospherePreset> = {
  dawn: {
    zenith: '#4e5f8c',
    horizonLeft: '#f59f8c',
    horizonRight: '#ffd6ad',
    bottom: '#9aa4c8',
    sunCore: '#fff1cf',
    sunHalo: '#f7b98f',
    sunOpacity: 0.9,
    stars: 0.25,
    fogMix: 0.7,
    birdColor: '#4e5b73',
  },
  morning: {
    zenith: '#566d91',
    horizonLeft: '#f3b192',
    horizonRight: '#f4dfb3',
    bottom: '#9cb0cb',
    sunCore: '#fff7db',
    sunHalo: '#f7d9a6',
    sunOpacity: 0.95,
    stars: 0.0,
    fogMix: 0.7,
    birdColor: '#4c596e',
  },
  afternoon: {
    zenith: '#4287cc',
    horizonLeft: '#a6d8f5',
    horizonRight: '#fce9c7',
    bottom: '#b8d7eb',
    sunCore: '#fff9e6',
    sunHalo: '#ffe8b8',
    sunOpacity: 0.88,
    stars: 0.0,
    fogMix: 0.68,
    birdColor: '#495f78',
  },
  dusk: {
    zenith: '#403e6b',
    horizonLeft: '#eb8372',
    horizonRight: '#f4b57e',
    bottom: '#887ea3',
    sunCore: '#ffe2ad',
    sunHalo: '#e88b6b',
    sunOpacity: 0.92,
    stars: 0.35,
    fogMix: 0.72,
    birdColor: '#3f3d59',
  },
  evening: {
    zenith: '#1f2847',
    horizonLeft: '#4e4c73',
    horizonRight: '#6d5e82',
    bottom: '#3a4263',
    sunCore: '#e6efff',
    sunHalo: '#7b93c4',
    sunOpacity: 0.75,
    stars: 0.75,
    fogMix: 0.72,
    birdColor: '#2d3550',
  },
  midnight: {
    zenith: '#0c1226',
    horizonLeft: '#1d2745',
    horizonRight: '#243254',
    bottom: '#1b243d',
    sunCore: '#dce8ff',
    sunHalo: '#5670a6',
    sunOpacity: 0.7,
    stars: 1.0,
    fogMix: 0.74,
    birdColor: '#212b45',
  },
};

interface FogTintedMat {
  mat: THREE.MeshLambertMaterial;
  baseColor: THREE.Color;
  emissiveRatio: number;
  fogBias: number;
}

interface DistantIslandEntry {
  group: THREE.Group;
  basePos: THREE.Vector3;
  phase: number;
  amplitude: number;
  frequency: number;
  waterfallVoxels: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>;
}

interface CloudSeaEntry {
  group: THREE.Group;
  baseScreenX: number;
  baseScreenY: number;
  depth: number;
  driftSpeed: number;
  bobPhase: number;
}

interface BirdEntry {
  root: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  offset: THREE.Vector3;
  flapPhase: number;
  flapSpeed: number;
}

interface BirdFlock {
  group: THREE.Group;
  centerScreen: THREE.Vector2;
  depth: number;
  arcRadiusX: number;
  arcRadiusY: number;
  speed: number;
  phase: number;
  birds: BirdEntry[];
}

export class BackgroundEnvironmentGroup {
  public readonly group: THREE.Group;
  public readonly skyMesh: THREE.Mesh;
  public readonly horizonSun: THREE.Mesh;
  public readonly distantIslandsGroup: THREE.Group;
  public readonly lowerCloudSeaGroup: THREE.Group;
  public readonly distantBirdsGroup: THREE.Group;

  private geometries: Set<THREE.BufferGeometry> = new Set();
  private materials: Set<THREE.Material> = new Set();
  private textures: Set<THREE.Texture> = new Set();

  private skyMat!: THREE.ShaderMaterial;
  private sunMat!: THREE.ShaderMaterial;

  private fogTintedMats: FogTintedMat[] = [];
  private waterfallMats: Array<{ mat: THREE.MeshBasicMaterial; baseColor: THREE.Color }> = [];
  private mistPlaneMats: THREE.MeshBasicMaterial[] = [];
  private birdMat!: THREE.MeshBasicMaterial;

  private distantIslands: DistantIslandEntry[] = [];
  private cloudSeaEntries: CloudSeaEntry[] = [];
  private birdFlocks: BirdFlock[] = [];

  private timeOfDay: TimeOfDay = 'morning';
  private weather: WeatherMode = 'clear';

  // Smoothly interpolated atmosphere state (linear colors)
  private currentZenith = new THREE.Color();
  private currentHorizonLeft = new THREE.Color();
  private currentHorizonRight = new THREE.Color();
  private currentBottom = new THREE.Color();
  private currentSunCore = new THREE.Color();
  private currentSunHalo = new THREE.Color();
  private currentBirdColor = new THREE.Color();
  private currentSunOpacity = 0.95;
  private currentStars = 0.0;
  private currentFogMix = 0.7;

  private targetZenith = new THREE.Color();
  private targetHorizonLeft = new THREE.Color();
  private targetHorizonRight = new THREE.Color();
  private targetBottom = new THREE.Color();
  private targetSunCore = new THREE.Color();
  private targetSunHalo = new THREE.Color();
  private targetBirdColor = new THREE.Color();
  private targetSunOpacity = 0.95;
  private targetStars = 0.0;
  private targetFogMix = 0.7;

  private readonly islandScale = TILE_SPACING * 0.48;
  private readonly islandCenter = new THREE.Vector3(
    -5.5 * TILE_SPACING,
    26 * ELEV_UNIT,
    5.5 * TILE_SPACING
  );

  // Camera isometric basis vectors (matches IsometricCamera rotation Y=-PI/4, X=-PI/6)
  private readonly camRight = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);
  private readonly camForward = new THREE.Vector3(
    Math.SQRT1_2 * Math.cos(Math.PI / 6),
    -0.5,
    -Math.SQRT1_2 * Math.cos(Math.PI / 6)
  );
  private readonly camUp = new THREE.Vector3(
    -Math.SQRT1_2 * 0.5,
    Math.cos(Math.PI / 6),
    Math.SQRT1_2 * 0.5
  );

  private seed = 42;
  private readonly virtualHeight: number;
  private tempColor = new THREE.Color();
  private tempHorizonMix = new THREE.Color();
  private tempVec = new THREE.Vector3();

  constructor(virtualHeight = 740, initialTime: TimeOfDay = 'morning', initialWeather: WeatherMode = 'clear') {
    this.virtualHeight = virtualHeight;
    this.timeOfDay = initialTime;
    this.weather = initialWeather;

    this.group = new THREE.Group();
    this.group.name = 'BackgroundEnvironmentGroup';

    this.distantIslandsGroup = new THREE.Group();
    this.distantIslandsGroup.name = 'distantIslands';

    this.lowerCloudSeaGroup = new THREE.Group();
    this.lowerCloudSeaGroup.name = 'lowerCloudSea';

    this.distantBirdsGroup = new THREE.Group();
    this.distantBirdsGroup.name = 'distantBirds';

    this.skyMesh = this.buildSkyDome();
    this.horizonSun = this.buildHorizonSun();

    this.group.add(this.skyMesh);
    this.group.add(this.horizonSun);
    this.group.add(this.distantIslandsGroup);
    this.group.add(this.lowerCloudSeaGroup);
    this.group.add(this.distantBirdsGroup);

    this.buildDistantIslands();
    this.buildLowerCloudSea();
    this.buildDistantBirds();

    // Snap initial colors immediately without waiting for lerp
    this.computeTargetAtmosphere();
    this.snapAtmosphereToTarget();
    this.applyAtmosphereToMaterials();
    this.disableRaycastRecursive(this.group);
  }

  private rnd(): number {
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.add(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.add(m);
    return m;
  }

  private disableRaycastRecursive(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.raycast = () => {};
      }
    });
  }

  private screenToWorld(screenX: number, screenY: number, depth: number): THREE.Vector3 {
    return new THREE.Vector3()
      .copy(this.islandCenter)
      .addScaledVector(this.camRight, screenX)
      .addScaledVector(this.camUp, screenY)
      .addScaledVector(this.camForward, depth);
  }

  // ---------------------------------------------------------------------------
  // 1. MULTI-STOP ATMOSPHERIC SKY & HORIZON SUN
  // ---------------------------------------------------------------------------
  private buildSkyDome(): THREE.Mesh {
    this.skyMat = this.trackMat(
      new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uZenithColor: { value: new THREE.Color('#566d91') },
          uHorizonLeftColor: { value: new THREE.Color('#f3b192') },
          uHorizonRightColor: { value: new THREE.Color('#f4dfb3') },
          uBottomColor: { value: new THREE.Color('#9cb0cb') },
          uStars: { value: 0.0 },
          uTime: { value: 0.0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uZenithColor;
          uniform vec3 uHorizonLeftColor;
          uniform vec3 uHorizonRightColor;
          uniform vec3 uBottomColor;
          uniform float uStars;
          uniform float uTime;
          varying vec2 vUv;

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          void main() {
            // Base multi-stop vertical gradient: bottom mist -> mid horizon -> zenith
            float y = clamp(vUv.y, 0.0, 1.0);
            vec3 horizonMid = mix(uHorizonLeftColor, uHorizonRightColor, smoothstep(0.18, 0.85, vUv.x));

            vec3 col = mix(uBottomColor, horizonMid, smoothstep(0.06, 0.46, y));
            col = mix(col, uZenithColor, smoothstep(0.42, 0.94, y));

            // Soft radial left-horizon warm pastel glow
            vec2 dLeft = (vUv - vec2(0.14, 0.48)) * vec2(0.85, 1.9);
            float leftGlow = exp(-dot(dLeft, dLeft) * 3.4);
            col = mix(col, uHorizonLeftColor, leftGlow * 0.58);

            // Soft radial right-horizon golden-cyan glow
            vec2 dRight = (vUv - vec2(0.79, 0.50)) * vec2(0.95, 1.8);
            float rightGlow = exp(-dot(dRight, dRight) * 3.0);
            col = mix(col, uHorizonRightColor, rightGlow * 0.52);

            // Subtle upper-sky starfield at dusk/night
            if (uStars > 0.01 && y > 0.35) {
              vec2 grid = floor(vUv * vec2(220.0, 130.0));
              float h = hash21(grid);
              if (h > 0.992) {
                vec2 cellUv = fract(vUv * vec2(220.0, 130.0)) - 0.5;
                float d = length(cellUv);
                float twinkle = 0.6 + 0.4 * sin(uTime * 2.2 + h * 120.0);
                float star = smoothstep(0.28, 0.0, d) * twinkle * smoothstep(0.35, 0.72, y);
                col += vec3(0.9, 0.95, 1.0) * star * uStars * 0.85;
              }
            }

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );

    const mesh = new THREE.Mesh(
      this.trackGeo(new THREE.PlaneGeometry(this.virtualHeight * 4.5, this.virtualHeight * 1.4)),
      this.skyMat
    );
    mesh.name = 'skyDome';
    mesh.renderOrder = -1000;
    mesh.frustumCulled = false;
    return mesh;
  }

  private buildHorizonSun(): THREE.Mesh {
    this.sunMat = this.trackMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: true,
        depthWrite: false,
        uniforms: {
          uCoreColor: { value: new THREE.Color('#fff7db') },
          uHaloColor: { value: new THREE.Color('#f7d9a6') },
          uOpacity: { value: 0.95 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uCoreColor;
          uniform vec3 uHaloColor;
          uniform float uOpacity;
          varying vec2 vUv;

          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float edgeFade = smoothstep(0.98, 0.32, d);
            float core = smoothstep(0.28, 0.14, d);
            float innerGlow = exp(-d * 4.0) * 0.62;
            float outerHalo = exp(-d * 1.9) * 0.28 * edgeFade;

            vec3 col = mix(uHaloColor, uCoreColor, clamp(core + innerGlow * 0.5, 0.0, 1.0));
            float alpha = clamp(core * 0.92 + innerGlow * edgeFade + outerHalo, 0.0, 1.0) * uOpacity;
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      })
    );

    const mesh = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(360, 360)), this.sunMat);
    mesh.name = 'horizonSun';
    mesh.renderOrder = -990;
    mesh.frustumCulled = false;
    return mesh;
  }

  // ---------------------------------------------------------------------------
  // 2. DISTANT FLOATING ARCHIPELAGOS
  // ---------------------------------------------------------------------------
  private createFogTintedMaterial(hex: string, emissiveRatio = 0.35, fogBias = 0.0): THREE.MeshLambertMaterial {
    const baseColor = new THREE.Color(hex);
    const mat = this.trackMat(
      new THREE.MeshLambertMaterial({
        color: baseColor.clone(),
        emissive: baseColor.clone(),
        emissiveIntensity: emissiveRatio,
      })
    );
    this.fogTintedMats.push({ mat, baseColor, emissiveRatio, fogBias });
    return mat;
  }

  private buildDistantIslands(): void {
    const boxGeo = this.trackGeo(new THREE.BoxGeometry(1, 1, 1));
    const grassMat = this.createFogTintedMaterial('#7da842', 0.38);
    const dirtMat = this.createFogTintedMaterial('#7a5542', 0.35);
    const rockMat = this.createFogTintedMaterial('#767b87', 0.35);
    const trunkMat = this.createFogTintedMaterial('#634736', 0.35);
    const leafMat = this.createFogTintedMaterial('#6e9d3b', 0.38);

    const waterColor = new THREE.Color('#9ad7eb');
    const waterMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: waterColor.clone(),
        transparent: true,
        opacity: 0.72,
      })
    );
    this.waterfallMats.push({ mat: waterMat, baseColor: waterColor });

    const mistColor = new THREE.Color('#eef7fc');
    const mistMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: mistColor.clone(),
        transparent: true,
        opacity: 0.58,
      })
    );
    this.waterfallMats.push({ mat: mistMat, baseColor: mistColor });

    const specs = [
      // Upper-left background archipelago
      {
        screenX: -315,
        screenY: 112,
        depth: 740,
        scale: this.islandScale * 0.27,
        trees: [
          [-1.2, 0.9, -0.8, 1.3],
          [0.8, 0.9, -1.1, 1.1],
          [1.3, 0.9, 0.7, 0.95],
        ],
        waterfallSide: 1,
        phase: 0.4,
      },
      // Upper-right background archipelago (near sun)
      {
        screenX: 325,
        screenY: 105,
        depth: 760,
        scale: this.islandScale * 0.29,
        trees: [
          [-1.0, 0.9, -1.0, 1.25],
          [1.1, 0.9, -0.6, 1.4],
          [-0.4, 0.9, 1.1, 1.0],
        ],
        waterfallSide: -1,
        phase: 2.1,
      },
      // Smaller far upper-left distant isle
      {
        screenX: -368,
        screenY: 148,
        depth: 880,
        scale: this.islandScale * 0.17,
        trees: [
          [-0.6, 0.85, -0.4, 1.1],
          [0.7, 0.85, 0.5, 0.95],
        ],
        waterfallSide: 1,
        phase: 4.3,
      },
    ];

    for (const spec of specs) {
      const island = new THREE.Group();
      const basePos = this.screenToWorld(spec.screenX, spec.screenY, spec.depth);
      island.position.copy(basePos);
      island.scale.setScalar(spec.scale);

      // Grass cap platform
      const top = new THREE.Mesh(boxGeo, grassMat);
      top.scale.set(4.6, 0.7, 4.4);
      top.position.set(0, 0.35, 0);
      island.add(top);

      // Tapered floating rock/dirt base
      const tier1 = new THREE.Mesh(boxGeo, dirtMat);
      tier1.scale.set(4.0, 1.0, 3.8);
      tier1.position.set(0, -0.5, 0);
      island.add(tier1);

      const tier2 = new THREE.Mesh(boxGeo, rockMat);
      tier2.scale.set(2.7, 1.2, 2.6);
      tier2.position.set(0.1, -1.5, -0.1);
      island.add(tier2);

      const tier3 = new THREE.Mesh(boxGeo, rockMat);
      tier3.scale.set(1.4, 1.1, 1.4);
      tier3.position.set(-0.1, -2.5, 0.1);
      island.add(tier3);

      // Small rock accents
      for (let r = 0; r < 2; r++) {
        const rock = new THREE.Mesh(boxGeo, rockMat);
        rock.scale.set(0.65, 0.45, 0.65);
        rock.position.set((r === 0 ? -1.4 : 1.3), 0.9, r === 0 ? 1.2 : -1.3);
        island.add(rock);
      }

      // 2-4 simple blocky trees
      for (const [tx, ty, tz, tScale] of spec.trees) {
        const trunk = new THREE.Mesh(boxGeo, trunkMat);
        trunk.scale.set(0.45, 1.1 * tScale, 0.45);
        trunk.position.set(tx, ty + 0.3 * tScale, tz);
        island.add(trunk);

        const crown1 = new THREE.Mesh(boxGeo, leafMat);
        crown1.scale.set(1.35 * tScale, 0.95 * tScale, 1.35 * tScale);
        crown1.position.set(tx, ty + 1.15 * tScale, tz);
        island.add(crown1);

        const crown2 = new THREE.Mesh(boxGeo, leafMat);
        crown2.scale.set(0.85 * tScale, 0.75 * tScale, 0.85 * tScale);
        crown2.position.set(tx, ty + 1.85 * tScale, tz);
        island.add(crown2);
      }

      // Mini waterfall spilling off the front-facing edge
      const wfX = spec.waterfallSide * 0.4;
      const wfZ = 2.25;
      const waterfallVoxels: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = [];

      // Mist cluster at top crest
      for (let m = 0; m < 3; m++) {
        const mist = new THREE.Mesh(boxGeo, mistMat);
        mist.scale.set(0.55, 0.35, 0.45);
        mist.position.set(wfX + (m - 1) * 0.42, 0.52, wfZ - 0.15);
        island.add(mist);
      }

      // Vertical strip of pale blue/white semi-transparent voxels fading below
      for (let w = 0; w < 6; w++) {
        const drop = new THREE.Mesh(boxGeo, w % 2 === 0 ? waterMat : mistMat);
        const fadeScale = 1 - w * 0.11;
        drop.scale.set(0.75 * fadeScale, 0.72, 0.32 * fadeScale);
        const baseY = 0.15 - w * 0.68;
        drop.position.set(wfX, baseY, wfZ);
        island.add(drop);
        waterfallVoxels.push({ mesh: drop, baseY, phase: w * 0.8 + spec.phase });
      }

      this.distantIslandsGroup.add(island);
      this.distantIslands.push({
        group: island,
        basePos,
        phase: spec.phase,
        amplitude: 0.15 * this.islandScale * 0.4,
        frequency: 0.3,
        waterfallVoxels,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. LOWER "SEA OF CLOUDS" & DEEP SKY LAYER
  // ---------------------------------------------------------------------------
  private createSoftMistTexture(): THREE.CanvasTexture {
    const canvas =
      typeof document !== 'undefined' && document.createElement
        ? document.createElement('canvas')
        : ({ width: 128, height: 128, getContext: () => null } as unknown as HTMLCanvasElement);
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext?.('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
      grad.addColorStop(0, 'rgba(255,255,255,0.65)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.28)');
      grad.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.add(tex);
    return tex;
  }

  private buildLowerCloudSea(): void {
    const boxGeo = this.trackGeo(new THREE.BoxGeometry(1, 1, 1));
    // High fogBias & high emissive so shadow faces have very low contrast against bottom sky
    const seaCloudMat = this.createFogTintedMaterial('#d8e2f0', 0.62, 0.12);
    seaCloudMat.transparent = true;
    seaCloudMat.opacity = 0.78;

    const mistTex = this.createSoftMistTexture();
    const mistPlaneMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: mistTex,
        color: new THREE.Color('#9cb0cb'),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    this.mistPlaneMats.push(mistPlaneMat);

    // Wide, flat-ish stepped voxel cloud banks underneath and behind the sanctuary
    const bankCount = 12;
    for (let i = 0; i < bankCount; i++) {
      const bank = new THREE.Group();
      const tiers = 2 + Math.floor(this.rnd() * 2);
      const baseW = 5.5 + this.rnd() * 4.5;
      const baseD = 4.2 + this.rnd() * 3.2;

      for (let t = 0; t < tiers; t++) {
        const tier = new THREE.Mesh(boxGeo, seaCloudMat);
        const shrink = 1 - t * 0.28;
        tier.scale.set(baseW * shrink, 0.85, baseD * shrink);
        tier.position.set(
          (this.rnd() - 0.5) * 1.1,
          t * 0.72,
          (this.rnd() - 0.5) * 0.9
        );
        bank.add(tier);
      }

      // Snap to 90-deg isometric grid alignment
      bank.rotation.y = Math.floor(this.rnd() * 4) * (Math.PI / 2);
      bank.scale.setScalar(this.islandScale * (0.45 + this.rnd() * 0.25));

      const baseScreenX = -440 + (i / (bankCount - 1)) * 880 + (this.rnd() - 0.5) * 70;
      const baseScreenY = -175 - this.rnd() * 85;
      const depth = 460 + this.rnd() * 420;
      bank.position.copy(this.screenToWorld(baseScreenX, baseScreenY, depth));

      this.lowerCloudSeaGroup.add(bank);
      this.cloudSeaEntries.push({
        group: bank,
        baseScreenX,
        baseScreenY,
        depth,
        driftSpeed: 2.2 + this.rnd() * 2.5,
        bobPhase: this.rnd() * Math.PI * 2,
      });
    }

    // Soft mist planes stretching across the bottom void
    const mistGeo = this.trackGeo(new THREE.PlaneGeometry(520, 180));
    for (let m = 0; m < 4; m++) {
      const mist = new THREE.Mesh(mistGeo, mistPlaneMat);
      const mx = -330 + m * 220;
      const my = -195 - (m % 2) * 30;
      mist.position.copy(this.screenToWorld(mx, my, 650 + m * 40));
      mist.rotation.order = 'YXZ';
      mist.rotation.y = -Math.PI / 4;
      mist.rotation.x = -Math.PI / 6;
      mist.renderOrder = -950;
      this.lowerCloudSeaGroup.add(mist);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. AMBIENT BACKGROUND LIFE (DISTANT VOXEL BIRDS)
  // ---------------------------------------------------------------------------
  private buildDistantBirds(): void {
    const wingGeo = this.trackGeo(new THREE.BoxGeometry(2.6, 0.55, 0.9));
    const bodyGeo = this.trackGeo(new THREE.BoxGeometry(0.9, 0.7, 1.3));
    this.birdMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#4c596e'),
      })
    );

    const flockConfigs = [
      { count: 7, cx: 210, cy: 138, depth: 710, arcX: 55, arcY: 16, speed: 0.16, phase: 0.0 },
      { count: 5, cx: -215, cy: 152, depth: 760, arcX: 45, arcY: 14, speed: 0.13, phase: 2.4 },
    ];

    for (const cfg of flockConfigs) {
      const flockGroup = new THREE.Group();
      const birds: BirdEntry[] = [];

      for (let i = 0; i < cfg.count; i++) {
        const root = new THREE.Group();
        const body = new THREE.Mesh(bodyGeo, this.birdMat);
        root.add(body);

        const leftWing = new THREE.Mesh(wingGeo, this.birdMat);
        leftWing.position.set(-1.3, 0.1, 0);
        root.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, this.birdMat);
        rightWing.position.set(1.3, 0.1, 0);
        root.add(rightWing);

        // V-formation / loose cluster offset
        const row = Math.floor((i + 1) / 2);
        const side = i % 2 === 0 ? 1 : -1;
        const offset = new THREE.Vector3(
          side * row * 8.5 + (this.rnd() - 0.5) * 4.5,
          (this.rnd() - 0.5) * 5.0 + row * 1.4,
          (this.rnd() - 0.5) * 6.0
        );
        root.position.copy(offset);
        root.scale.setScalar(0.85 + this.rnd() * 0.35);
        root.rotation.order = 'YXZ';
        root.rotation.y = -Math.PI / 4;

        flockGroup.add(root);
        birds.push({
          root,
          leftWing,
          rightWing,
          offset,
          flapPhase: this.rnd() * Math.PI * 2,
          flapSpeed: 5.2 + this.rnd() * 2.0,
        });
      }

      flockGroup.position.copy(this.screenToWorld(cfg.cx, cfg.cy, cfg.depth));
      this.distantBirdsGroup.add(flockGroup);
      this.birdFlocks.push({
        group: flockGroup,
        centerScreen: new THREE.Vector2(cfg.cx, cfg.cy),
        depth: cfg.depth,
        arcRadiusX: cfg.arcX,
        arcRadiusY: cfg.arcY,
        speed: cfg.speed,
        phase: cfg.phase,
        birds,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. ATMOSPHERE INTERPOLATION (TIME OF DAY + WEATHER)
  // ---------------------------------------------------------------------------
  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    this.timeOfDay = timeOfDay;
    this.computeTargetAtmosphere();
  }

  public setWeather(weather: WeatherMode): void {
    this.weather = weather;
    this.computeTargetAtmosphere();
  }

  private computeTargetAtmosphere(): void {
    const preset = SKY_PRESETS[this.timeOfDay] ?? SKY_PRESETS.morning;

    this.targetZenith.set(preset.zenith);
    this.targetHorizonLeft.set(preset.horizonLeft);
    this.targetHorizonRight.set(preset.horizonRight);
    this.targetBottom.set(preset.bottom);
    this.targetSunCore.set(preset.sunCore);
    this.targetSunHalo.set(preset.sunHalo);
    this.targetBirdColor.set(preset.birdColor);
    this.targetSunOpacity = preset.sunOpacity;
    this.targetStars = preset.stars;
    this.targetFogMix = preset.fogMix;

    if (this.weather === 'rain') {
      const rainZenith = new THREE.Color('#5a6b80');
      const rainHorizon = new THREE.Color('#8090a3');
      const rainBottom = new THREE.Color('#6f7f94');
      this.targetZenith.lerp(rainZenith, 0.55);
      this.targetHorizonLeft.lerp(rainHorizon, 0.6);
      this.targetHorizonRight.lerp(rainHorizon, 0.6);
      this.targetBottom.lerp(rainBottom, 0.55);
      this.targetSunOpacity *= 0.35;
      this.targetStars *= 0.2;
      this.targetFogMix = Math.min(0.8, this.targetFogMix + 0.08);
    } else if (this.weather === 'snow') {
      const snowZenith = new THREE.Color('#7f98b8');
      const snowHorizon = new THREE.Color('#d2e0ee');
      const snowBottom = new THREE.Color('#b6c8de');
      this.targetZenith.lerp(snowZenith, 0.45);
      this.targetHorizonLeft.lerp(snowHorizon, 0.5);
      this.targetHorizonRight.lerp(snowHorizon, 0.5);
      this.targetBottom.lerp(snowBottom, 0.5);
      this.targetSunOpacity *= 0.65;
      this.targetFogMix = Math.min(0.78, this.targetFogMix + 0.05);
    }
  }

  private snapAtmosphereToTarget(): void {
    this.currentZenith.copy(this.targetZenith);
    this.currentHorizonLeft.copy(this.targetHorizonLeft);
    this.currentHorizonRight.copy(this.targetHorizonRight);
    this.currentBottom.copy(this.targetBottom);
    this.currentSunCore.copy(this.targetSunCore);
    this.currentSunHalo.copy(this.targetSunHalo);
    this.currentBirdColor.copy(this.targetBirdColor);
    this.currentSunOpacity = this.targetSunOpacity;
    this.currentStars = this.targetStars;
    this.currentFogMix = this.targetFogMix;
  }

  private applyAtmosphereToMaterials(): void {
    this.skyMat.uniforms.uZenithColor.value.copy(this.currentZenith);
    this.skyMat.uniforms.uHorizonLeftColor.value.copy(this.currentHorizonLeft);
    this.skyMat.uniforms.uHorizonRightColor.value.copy(this.currentHorizonRight);
    this.skyMat.uniforms.uBottomColor.value.copy(this.currentBottom);
    this.skyMat.uniforms.uStars.value = this.currentStars;

    this.sunMat.uniforms.uCoreColor.value.copy(this.currentSunCore);
    this.sunMat.uniforms.uHaloColor.value.copy(this.currentSunHalo);
    this.sunMat.uniforms.uOpacity.value = this.currentSunOpacity;

    // Average horizon mist color for distant islands & silhouettes
    this.tempHorizonMix.copy(this.currentHorizonLeft).lerp(this.currentHorizonRight, 0.5);
    this.tempHorizonMix.lerp(this.currentBottom, 0.35);

    for (const entry of this.fogTintedMats) {
      const mixAmt = Math.min(0.88, this.currentFogMix + entry.fogBias);
      entry.mat.color.copy(entry.baseColor).lerp(this.tempHorizonMix, mixAmt);
      entry.mat.emissive.copy(this.tempHorizonMix);
      entry.mat.emissiveIntensity = entry.emissiveRatio;
    }

    for (const wf of this.waterfallMats) {
      wf.mat.color.copy(wf.baseColor).lerp(this.tempHorizonMix, this.currentFogMix * 0.72);
    }

    for (const mMat of this.mistPlaneMats) {
      mMat.color.copy(this.currentBottom);
    }

    this.birdMat.color.copy(this.currentBirdColor).lerp(this.tempHorizonMix, this.currentFogMix * 0.78);
  }

  public getPrimarySkyColor(): THREE.Color {
    return this.currentBottom;
  }

  public getSunScreenUv(camera: THREE.Camera, out: THREE.Vector2): THREE.Vector2 {
    this.tempVec.copy(this.horizonSun.position).project(camera);
    return out.set(this.tempVec.x * 0.5 + 0.5, this.tempVec.y * 0.5 + 0.5);
  }

  public getSunRayConfig(): { color: THREE.Color; strength: number } {
    const baseStr =
      this.timeOfDay === 'morning' || this.timeOfDay === 'dawn' || this.timeOfDay === 'dusk'
        ? 0.24
        : this.timeOfDay === 'afternoon'
          ? 0.16
          : 0.13;
    const weatherMul = this.weather === 'rain' ? 0.45 : this.weather === 'snow' ? 0.7 : 1.0;
    this.tempColor.copy(this.currentSunCore).lerp(this.currentSunHalo, 0.45);
    return {
      color: this.tempColor,
      strength: baseStr * weatherMul * this.currentSunOpacity,
    };
  }

  // ---------------------------------------------------------------------------
  // UPDATE & LIFECYCLE
  // ---------------------------------------------------------------------------
  public update(dt: number, elapsed: number, camera: THREE.Camera, zoom: number): void {
    // 1. Smoothly interpolate sky & atmospheric fog colors
    const lerpT = Math.min(1, dt * 3.5);
    this.currentZenith.lerp(this.targetZenith, lerpT);
    this.currentHorizonLeft.lerp(this.targetHorizonLeft, lerpT);
    this.currentHorizonRight.lerp(this.targetHorizonRight, lerpT);
    this.currentBottom.lerp(this.targetBottom, lerpT);
    this.currentSunCore.lerp(this.targetSunCore, lerpT);
    this.currentSunHalo.lerp(this.targetSunHalo, lerpT);
    this.currentBirdColor.lerp(this.targetBirdColor, lerpT);
    this.currentSunOpacity += (this.targetSunOpacity - this.currentSunOpacity) * lerpT;
    this.currentStars += (this.targetStars - this.currentStars) * lerpT;
    this.currentFogMix += (this.targetFogMix - this.currentFogMix) * lerpT;
    this.applyAtmosphereToMaterials();

    this.skyMat.uniforms.uTime.value = elapsed;

    // 2. Keep sky dome & horizon sun locked to camera view plane regardless of pan/zoom
    const invZ = 1 / Math.max(0.25, zoom);
    this.skyMesh.quaternion.copy(camera.quaternion);
    this.skyMesh.position
      .copy(camera.position)
      .addScaledVector(
        this.tempVec.set(0, 0, -2500).applyQuaternion(camera.quaternion),
        1
      );
    this.skyMesh.scale.set(invZ, invZ, 1);

    this.horizonSun.quaternion.copy(camera.quaternion);
    this.horizonSun.position
      .copy(camera.position)
      .addScaledVector(
        this.tempVec.set(285 * invZ, 56 * invZ, -2420).applyQuaternion(camera.quaternion),
        1
      );
    this.horizonSun.scale.set(invZ, invZ, 1);

    // 3. Gentle independent bobbing + waterfall shimmer on distant islands
    for (const isl of this.distantIslands) {
      const bob = Math.sin(elapsed * isl.frequency + isl.phase) * isl.amplitude;
      isl.group.position.set(isl.basePos.x, isl.basePos.y + bob, isl.basePos.z);

      for (const wf of isl.waterfallVoxels) {
        wf.mesh.position.y = wf.baseY - ((elapsed * 1.4 + wf.phase) % 0.45);
      }
    }

    // 4. Slow drifting sea of clouds underneath
    for (const c of this.cloudSeaEntries) {
      const wrappedX = ((c.baseScreenX + elapsed * c.driftSpeed + 520) % 1040) - 520;
      const bobY = c.baseScreenY + Math.sin(elapsed * 0.4 + c.bobPhase) * 3.5;
      c.group.position.copy(this.screenToWorld(wrappedX, bobY, c.depth));
    }

    // 5. Distant bird flocks gliding in a wide background arc with smooth wingbeats
    for (const flock of this.birdFlocks) {
      const t = elapsed * flock.speed + flock.phase;
      const sx = flock.centerScreen.x + Math.cos(t) * flock.arcRadiusX;
      const sy = flock.centerScreen.y + Math.sin(t * 0.8) * flock.arcRadiusY;
      flock.group.position.copy(this.screenToWorld(sx, sy, flock.depth));

      for (const b of flock.birds) {
        const flap = Math.sin(elapsed * b.flapSpeed + b.flapPhase) * 0.48;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
        b.root.position.y = b.offset.y + Math.sin(elapsed * 2.2 + b.flapPhase) * 0.45;
      }
    }
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.group.clear();
  }
}
