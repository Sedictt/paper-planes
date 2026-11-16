import type { PaperPlaneNote, TimeOfDay, WeatherMode } from '../types';

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

export const PALETTES: Record<TimeOfDay, Palette> = {
  dawn: {
    label: 'Dawn',
    skyTop: '#24224a',
    skyMid: '#7c567b',
    skyBottom: '#f2a482',
    sea: '#46587d',
    seaDeep: '#354463',
    seaFoam: '#adc2e6',
    river: '#526891',
    sand: '#cfa98c',
    grass: '#4c7364',
    grassAlt: '#426658',
    cobble: '#8c796e',
    cobbleLine: '#6b5b52',
    asphalt: '#3b374f',
    crosswalk: '#d4c5c9',
    windowLit: '#ffe1a6',
    windowDark: '#3f3854',
    windowChance: 0.32,
    stars: 0.35,
    cloudTop: '#ffd1bd',
    cloudShade: '#9e758c',
    streetLight: true,
    neon: false,
    shadeMul: 0.86,
    shadowAlpha: 0.28,
  },
  morning: {
    label: 'Morning',
    skyTop: '#458fd9',
    skyMid: '#85c1f2',
    skyBottom: '#d9f0ff',
    sea: '#3880bd',
    seaDeep: '#2b679c',
    seaFoam: '#c2e9ff',
    river: '#4b97d4',
    sand: '#ebd5a9',
    grass: '#63ad6d',
    grassAlt: '#569e60',
    cobble: '#b8a28c',
    cobbleLine: '#8f7b66',
    asphalt: '#505966',
    crosswalk: '#eef4fa',
    windowLit: '#c7e8ff',
    windowDark: '#586f87',
    windowChance: 0.12,
    stars: 0,
    cloudTop: '#ffffff',
    cloudShade: '#c7ddf0',
    streetLight: false,
    neon: false,
    shadeMul: 1.0,
    shadowAlpha: 0.24,
  },
  afternoon: {
    label: 'Afternoon',
    skyTop: '#296eba',
    skyMid: '#68aded',
    skyBottom: '#b8e0ff',
    sea: '#2b71ad',
    seaDeep: '#20588a',
    seaFoam: '#b0e0ff',
    river: '#3d88c7',
    sand: '#f0daaf',
    grass: '#58a362',
    grassAlt: '#4d9456',
    cobble: '#c2ab93',
    cobbleLine: '#96816b',
    asphalt: '#4a525e',
    crosswalk: '#f5f8fc',
    windowLit: '#b5e2ff',
    windowDark: '#4d637a',
    windowChance: 0.08,
    stars: 0,
    cloudTop: '#ffffff',
    cloudShade: '#bed6eb',
    streetLight: false,
    neon: false,
    shadeMul: 1.04,
    shadowAlpha: 0.28,
  },
  dusk: {
    label: 'Dusk',
    skyTop: '#1d1742',
    skyMid: '#753b69',
    skyBottom: '#eb7356',
    sea: '#3f3866',
    seaDeep: '#2d274d',
    seaFoam: '#c98f9f',
    river: '#4d4375',
    sand: '#a87e72',
    grass: '#3d5c54',
    grassAlt: '#344f48',
    cobble: '#7d6664',
    cobbleLine: '#594645',
    asphalt: '#2d273d',
    crosswalk: '#baa6b0',
    windowLit: '#ffcf70',
    windowDark: '#2f2540',
    windowChance: 0.58,
    stars: 0.45,
    cloudTop: '#ff9d7a',
    cloudShade: '#6e3f66',
    streetLight: true,
    neon: true,
    shadeMul: 0.80,
    shadowAlpha: 0.34,
  },
  evening: {
    label: 'Evening',
    skyTop: '#0b0e26',
    skyMid: '#1b224d',
    skyBottom: '#353c73',
    sea: '#172245',
    seaDeep: '#101833',
    seaFoam: '#5d73b0',
    river: '#1e2c57',
    sand: '#5e5668',
    grass: '#223d3c',
    grassAlt: '#1c3332',
    cobble: '#4a455c',
    cobbleLine: '#322e40',
    asphalt: '#191d33',
    crosswalk: '#7d84a6',
    windowLit: '#ffd478',
    windowDark: '#1b1e36',
    windowChance: 0.72,
    stars: 0.85,
    cloudTop: '#475085',
    cloudShade: '#252b52',
    streetLight: true,
    neon: true,
    shadeMul: 0.64,
    shadowAlpha: 0.36,
  },
  midnight: {
    label: 'Midnight',
    skyTop: '#040612',
    skyMid: '#0b1026',
    skyBottom: '#161f42',
    sea: '#0c1329',
    seaDeep: '#070c1c',
    seaFoam: '#3c4e7d',
    river: '#111a36',
    sand: '#3a374a',
    grass: '#142629',
    grassAlt: '#101f21',
    cobble: '#302e42',
    cobbleLine: '#1f1d2e',
    asphalt: '#101321',
    crosswalk: '#565c7a',
    windowLit: '#ffe08a',
    windowDark: '#0f1224',
    windowChance: 0.42,
    stars: 1.0,
    cloudTop: '#262e52',
    cloudShade: '#141933',
    streetLight: true,
    neon: true,
    shadeMul: 0.50,
    shadowAlpha: 0.40,
  },
};

const GRID = 24;
const TILE_W = 30;
const TILE_H = 15;

interface BuildingProp {
  kind: 'downtown_shop' | 'timber_cottage' | 'temple_shrine' | 'lighthouse' | 'pine' | 'oak' | 'fountain' | 'umbrella';
  h: number;
  wallLeft: string;
  wallRight: string;
  roofColor: string;
  roofStyle?: 'flat_ac' | 'gabled_terracotta' | 'pagoda';
  signColor?: string;
  signText?: string;
  awningColor?: string;
  timberFrame?: boolean;
  flowerBox?: boolean;
  winSeeds: number[];
}

interface WorldCell {
  gx: number;
  gy: number;
  elev: number;
  terrain: 'grass' | 'grassAlt' | 'hill' | 'rock' | 'river' | 'sea' | 'sand' | 'asphalt' | 'crosswalk' | 'cobble' | 'bridge' | 'pier';
  prop: BuildingProp | null;
}

interface ActivePlaneEntity {
  note: PaperPlaneNote;
  gx: number;
  gy: number;
  gz: number;
  vx: number;
  vy: number;
  turnRate: number;
  bobPhase: number;
  trail: Array<{ gx: number; gy: number; gz: number }>;
  screenX: number;
  screenY: number;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadeHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

export class IsometricWorldEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId = 0;

  private pixW = 640;
  private pixH = 360;
  public zoom = 1.05;
  public camX = 0;
  public camY = -55;
  private targetCamX = 0;
  private targetCamY = -55;
  private targetZoom = 1.05;

  public timeOfDay: TimeOfDay = 'dusk';
  public weather: WeatherMode = 'clear';
  public fireworksActive = false;

  private world: WorldCell[][] = [];
  private planes: ActivePlaneEntity[] = [];
  private hoveredPlane: ActivePlaneEntity | null = null;
  private onSelectPlane: (note: PaperPlaneNote) => void;
  private onZoomChange: (z: number) => void;

  private rng = mulberry32(199804);
  private stars: Array<{ u: number; v: number; phase: number }> = [];
  private clouds: Array<{
    gx: number;
    gy: number;
    gz: number;
    layer: 'back' | 'front';
    speed: number;
    puffs: Array<{ dx: number; dy: number; r: number }>;
  }> = [];
  private npcs: Array<{
    axis: 'x' | 'y';
    lane: number;
    pos: number;
    minPos: number;
    maxPos: number;
    dir: number;
    speed: number;
    shirt: string;
    hair: string;
    bob: number;
  }> = [];
  private vans: Array<{
    axis: 'x' | 'y';
    lane: number;
    pos: number;
    dir: number;
    speed: number;
    bodyColor: string;
    stripeColor: string;
  }> = [];
  private airliner = {
    active: true,
    gx: -5,
    gy: 15,
    gz: 112,
    vx: 1.5,
    vy: -0.6,
    cooldown: 0,
    contrail: [] as Array<{ gx: number; gy: number; gz: number }>,
  };
  private weatherParticles: Array<{ x: number; y: number; speed: number }> = [];
  private fireworks: Array<{
    phase: 'rocket' | 'burst';
    gx: number;
    gy: number;
    gz: number;
    targetZ: number;
    color: string;
    sparks: Array<{ dx: number; dy: number; vx: number; vy: number; life: number }>;
  }> = [];
  private fireworkTimer = 0;

  // Pointer & Pinch-to-Zoom State
  private isDragging = false;
  private dragMoved = false;
  private dragStart = { x: 0, y: 0 };
  private pinchDist = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onSelectPlane: (note: PaperPlaneNote) => void,
    onZoomChange: (z: number) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2D context unavailable');
    this.ctx = context;
    this.onSelectPlane = onSelectPlane;
    this.onZoomChange = onZoomChange;

    this.buildWorld();
    this.bindEvents();
    this.handleResize();
    this.startLoop();
  }

  private isRiver(gx: number, gy: number): boolean {
    const curve = Math.round(gx * 0.78 + Math.sin(gx * 0.42) * 1.7);
    return gx >= 1 && gx < 19 && Math.abs(gy - curve) === 0;
  }

  private buildWorld() {
    const r = this.rng;

    // 1. Stars
    for (let i = 0; i < 85; i++) {
      this.stars.push({ u: r(), v: r() * 0.68, phase: r() * Math.PI * 2 });
    }

    // 2. Foreground & Background Clouds
    for (let i = 0; i < 16; i++) {
      this.clouds.push({
        gx: -5 + r() * (GRID + 10),
        gy: -5 + r() * (GRID + 10),
        gz: i < 10 ? 18 + r() * 18 : 82 + r() * 22,
        layer: i < 10 ? 'back' : 'front',
        speed: 0.16 + r() * 0.2,
        puffs: [
          { dx: -9, dy: 2, r: 6 },
          { dx: -2, dy: -2, r: 8.5 },
          { dx: 6, dy: 0, r: 7.5 },
          { dx: 12, dy: 2, r: 5.5 },
        ],
      });
    }

    // 3. Multi-Biome 24x24 World Grid
    const shopConfigs = [
      { wallL: '#d99b66', wallR: '#f2ba85', roof: '#8c7d70', sign: '#238c53', awning: '#238c53', text: 'MART' },
      { wallL: '#b8c4d1', wallR: '#e1ebf5', roof: '#7d8c9c', sign: '#d94141', awning: '#d94141', text: 'CAFE' },
      { wallL: '#d48a84', wallR: '#f0aca6', roof: '#756268', sign: '#3884d6', awning: '#f2c94c', text: 'BOOKS' },
      { wallL: '#8ea4ba', wallR: '#b5cce0', roof: '#5e7082', sign: '#e86f38', awning: '#2d9cdb', text: 'BAKERY' },
      { wallL: '#c7b299', wallR: '#e6d3bc', roof: '#80705e', sign: '#9b51e0', awning: '#27ae60', text: 'RAMEN' },
    ];

    for (let gx = 0; gx < GRID; gx++) {
      this.world[gx] = [];
      for (let gy = 0; gy < GRID; gy++) {
        let elev = 4;
        let terrain: WorldCell['terrain'] = (gx + gy) % 2 === 0 ? 'grass' : 'grassAlt';
        let prop: BuildingProp | null = null;

        const valleySum = gx + gy;

        // Biome 1: Ocean & Sandy Beach (South-East gx >= 19 or gy >= 19)
        if (gx >= 20 || gy >= 20) {
          terrain = 'sea';
          elev = 0;
        } else if (gx === 19 || gy === 19) {
          terrain = 'sand';
          elev = 2;
        } else if (this.isRiver(gx, gy)) {
          terrain = 'river';
          elev = valleySum <= 7 ? 14 : 2;
        } else if (valleySum <= 8) {
          // Biome 2: Terraced Mountain Valley & Pine Overlook (North-West)
          elev = Math.max(8, (9 - valleySum) * 7 + Math.floor(r() * 4));
          terrain = elev > 28 ? 'rock' : 'hill';
        } else {
          elev = 4 + Math.floor(Math.max(0, (15 - valleySum) * 0.5));
        }

        // Streets: Downtown Asphalt & Zebra Crosswalks vs. Cozy Village Cobblestone Lanes
        const isDowntownRoad =
          (gx === 10 && gy >= 3 && gy <= 11) || (gy === 7 && gx >= 6 && gx <= 15);
        const isCobbleLane =
          (gx === 8 && gy >= 11 && gy <= 18) ||
          (gy === 14 && gx >= 4 && gx <= 17) ||
          (gx === 14 && gy >= 7 && gy <= 18);

        if (terrain !== 'sea' && terrain !== 'sand' && valleySum > 7) {
          if (this.isRiver(gx, gy) && (isDowntownRoad || isCobbleLane)) {
            terrain = 'bridge';
            elev = 5;
          } else if (isDowntownRoad) {
            const isCrosswalk =
              (gx === 10 && (gy === 6 || gy === 8)) || (gy === 7 && (gx === 9 || gx === 11));
            terrain = isCrosswalk ? 'crosswalk' : 'asphalt';
          } else if (isCobbleLane) {
            terrain = 'cobble';
          }
        }

        // Seaside Boardwalk Pier
        if (gx === 14 && gy >= 19 && gy <= 22) {
          terrain = 'pier';
          elev = 4;
        }

        const winSeeds = Array.from({ length: 32 }, () => r());

        // Landmark placements
        if (gx === 18 && gy === 18) {
          prop = {
            kind: 'lighthouse',
            h: 40,
            wallLeft: '#d9d9d9',
            wallRight: '#ffffff',
            roofColor: '#d94141',
            winSeeds,
          };
        } else if (gx === 7 && gy === 13) {
          // Village Stone Well / Fountain Plaza (like Reference 2)
          terrain = 'cobble';
          prop = {
            kind: 'fountain',
            h: 8,
            wallLeft: '#707882',
            wallRight: '#959fab',
            roofColor: '#4da6ff',
            winSeeds,
          };
        } else if (gx === 13 && gy === 5) {
          // Traditional Pagoda / Shrine Roof (like Reference 1 top-right)
          prop = {
            kind: 'temple_shrine',
            h: 20,
            wallLeft: '#8c3b32',
            wallRight: '#b84d42',
            roofColor: '#c94a38',
            roofStyle: 'pagoda',
            winSeeds,
          };
        } else if (terrain === 'hill' || terrain === 'rock') {
          if (valleySum >= 6 && r() > 0.58) {
            prop = {
              kind: 'timber_cottage',
              h: 12,
              wallLeft: '#d6c7b2',
              wallRight: '#f2e4d0',
              roofColor: '#b85a46',
              roofStyle: 'gabled_terracotta',
              timberFrame: true,
              flowerBox: true,
              winSeeds,
            };
          } else if (r() > 0.3) {
            prop = {
              kind: 'pine',
              h: 13 + Math.floor(r() * 6),
              wallLeft: '',
              wallRight: '',
              roofColor: '',
              winSeeds,
            };
          }
        } else if (terrain === 'grass' || terrain === 'grassAlt') {
          // Downtown District (Reference 1 style: colorful storefronts, signage, awnings, AC units)
          const inDowntown = gx >= 7 && gx <= 15 && gy >= 3 && gy <= 10;
          // Cozy Storybook Village (Reference 2 style: timber frames, terracotta roofs, flower boxes)
          const inCozyVillage = gx >= 4 && gx <= 16 && gy >= 11 && gy <= 17;

          if (inDowntown && r() > 0.2) {
            const cfg = shopConfigs[Math.floor(r() * shopConfigs.length)];
            prop = {
              kind: 'downtown_shop',
              h: 22 + Math.floor(r() * 24),
              wallLeft: cfg.wallL,
              wallRight: cfg.wallR,
              roofColor: cfg.roof,
              roofStyle: 'flat_ac',
              signColor: cfg.sign,
              signText: cfg.text,
              awningColor: cfg.awning,
              winSeeds,
            };
          } else if (inCozyVillage && r() > 0.28) {
            const terracottaShades = ['#c45b45', '#b8523d', '#cf6a4c', '#a84c3a', '#8c584c'];
            prop = {
              kind: 'timber_cottage',
              h: 11 + Math.floor(r() * 6),
              wallLeft: '#d9cbb8',
              wallRight: '#f5ead8',
              roofColor: terracottaShades[Math.floor(r() * terracottaShades.length)],
              roofStyle: 'gabled_terracotta',
              timberFrame: true,
              flowerBox: r() > 0.3,
              awningColor: r() > 0.5 ? '#f5efe6' : undefined,
              winSeeds,
            };
          } else if (r() > 0.38) {
            prop = {
              kind: r() > 0.45 ? 'oak' : 'pine',
              h: 11 + Math.floor(r() * 6),
              wallLeft: '',
              wallRight: '',
              roofColor: '',
              winSeeds,
            };
          }
        } else if (terrain === 'sand' && r() > 0.72) {
          prop = {
            kind: 'umbrella',
            h: 6,
            wallLeft: '',
            wallRight: '',
            roofColor: r() > 0.5 ? '#ff6b6b' : '#38b6ff',
            winSeeds,
          };
        }

        this.world[gx][gy] = { gx, gy, elev, terrain, prop };
      }
    }

    // 4. Delivery Vans on Downtown Streets (like Reference 1)
    this.vans = [
      { axis: 'y', lane: 10, pos: 4, dir: 1, speed: 1.15, bodyColor: '#f2f5fa', stripeColor: '#238c53' },
      { axis: 'x', lane: 7, pos: 14, dir: -1, speed: 1.0, bodyColor: '#f2f5fa', stripeColor: '#3884d6' },
    ];

    // 5. Walking Pedestrians / Villagers on Cobblestone Lanes & Sidewalks
    const shirts = ['#d9534f', '#4a90e2', '#f0ad4e', '#5cb85c', '#9b59b6', '#e67e22'];
    const hairs = ['#3b281e', '#6e4726', '#d9a15b', '#222222'];
    for (let i = 0; i < 26; i++) {
      const roadIdx = i % 3;
      const axis = roadIdx === 0 ? 'y' : 'x';
      const lane = roadIdx === 0 ? 8 : roadIdx === 1 ? 14 : 7;
      this.npcs.push({
        axis,
        lane: lane + (r() - 0.5) * 0.42,
        pos: 5 + r() * 11,
        minPos: 4.5,
        maxPos: 17.2,
        dir: r() > 0.5 ? 1 : -1,
        speed: 0.32 + r() * 0.25,
        shirt: shirts[i % shirts.length],
        hair: hairs[i % hairs.length],
        bob: r() * Math.PI * 2,
      });
    }

    // 6. Weather Particles
    for (let i = 0; i < 120; i++) {
      this.weatherParticles.push({
        x: r() * 800,
        y: r() * 500,
        speed: 0.85 + r() * 0.7,
      });
    }
  }

  public syncPlanes(notes: PaperPlaneNote[]) {
    const existingById = new Map(this.planes.map((p) => [p.note.id, p]));
    const updated: ActivePlaneEntity[] = [];

    notes.forEach((n, idx) => {
      const existing = existingById.get(n.id);
      if (existing) {
        existing.note = n;
        updated.push(existing);
      } else {
        const angle = ((idx * 137.5) % 360) * (Math.PI / 180);
        const speed = 0.8 + (idx % 5) * 0.12;
        const isJustLaunched = n.createdAt === 'Just now';
        updated.push({
          note: n,
          gx: isJustLaunched ? 10.5 : 3 + ((idx * 3.7) % (GRID - 6)),
          gy: isJustLaunched ? 10.5 : 3 + ((idx * 5.3) % (GRID - 6)),
          gz: isJustLaunched ? 64 : 42 + ((idx * 7) % 32),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          turnRate: ((idx % 2 === 0 ? 1 : -1) * (0.18 + (idx % 4) * 0.06)),
          bobPhase: idx * 0.9,
          trail: [],
          screenX: 0,
          screenY: 0,
        });
      }
    });

    this.planes = updated;
  }

  public focusBiome(gx: number, gy: number, targetZoom: number) {
    const worldX = (gx - gy) * (TILE_W / 2);
    const worldY = (gx + gy) * (TILE_H / 2) - 18;
    this.targetCamX = -worldX;
    this.targetCamY = -worldY;
    this.targetZoom = Math.max(0.65, Math.min(2.3, targetZoom));
    this.onZoomChange(this.targetZoom);
  }

  public adjustZoom(delta: number) {
    this.targetZoom = Math.max(0.65, Math.min(2.3, Number((this.targetZoom + delta).toFixed(2))));
    this.onZoomChange(this.targetZoom);
  }

  public triggerFireworkVolley() {
    for (let i = 0; i < 2; i++) {
      this.spawnFirework();
    }
  }

  private spawnFirework() {
    const r = this.rng;
    const gx = 18.5 + r() * 4;
    const gy = 14 + r() * 7;
    const targetZ = 56 + r() * 34;
    const colors = ['#ff5e7e', '#ffbe55', '#55ffe1', '#a77dff', '#7dff7a', '#ffffff'];
    this.fireworks.push({
      phase: 'rocket',
      gx,
      gy,
      gz: 2,
      targetZ,
      color: colors[Math.floor(r() * colors.length)],
      sparks: [],
    });
  }

  private isoToScreen(gx: number, gy: number, gz = 0) {
    const worldX = (gx - gy) * (TILE_W / 2);
    const worldY = (gx + gy) * (TILE_H / 2) - gz;
    return {
      x: this.pixW / 2 + (worldX + this.camX) * this.zoom,
      y: this.pixH / 2 + (worldY + this.camY) * this.zoom,
    };
  }

  private getSurfaceElevation(gx: number, gy: number): number {
    const ix = Math.max(0, Math.min(GRID - 1, Math.floor(gx)));
    const iy = Math.max(0, Math.min(GRID - 1, Math.floor(gy)));
    const cell = this.world[ix][iy];
    let h = cell.elev;
    if (cell.prop && ['downtown_shop', 'timber_cottage', 'temple_shrine', 'lighthouse'].includes(cell.prop.kind)) {
      h += cell.prop.h;
    }
    return h;
  }

  // =========================================================================
  // DRAWING: TERRAIN, REFERENCE-INSPIRED BUILDINGS & PAPER PLANES
  // =========================================================================
  private drawTile(cell: WorldCell, pal: Palette, tick: number) {
    const { gx, gy, elev, terrain } = cell;
    const top = this.isoToScreen(gx, gy, elev);
    const base = this.isoToScreen(gx, gy, 0);
    const z = this.zoom;
    const hw = (TILE_W / 2) * z;
    const hh = (TILE_H / 2) * z;
    const ctx = this.ctx;

    // Viewport Culling for 60 FPS mobile performance
    if (top.x + hw < -20 || top.x - hw > this.pixW + 20 || base.y + hh * 2 < -20 || top.y - 60 * z > this.pixH + 20) {
      return;
    }

    let topColor = pal.grass;
    if (terrain === 'grassAlt') topColor = pal.grassAlt;
    else if (terrain === 'hill') topColor = shadeHex(pal.grass, 0.88);
    else if (terrain === 'rock') topColor = '#6d7785';
    else if (terrain === 'sand') topColor = pal.sand;
    else if (terrain === 'sea') topColor = (gx + gy) % 2 === 0 ? pal.sea : pal.seaDeep;
    else if (terrain === 'river') topColor = pal.river;
    else if (terrain === 'asphalt' || terrain === 'crosswalk') topColor = pal.asphalt;
    else if (terrain === 'cobble') topColor = pal.cobble;
    else if (terrain === 'bridge' || terrain === 'pier') topColor = '#8a6045';

    if (this.weather === 'snow' && !['sea', 'river', 'asphalt', 'crosswalk', 'bridge', 'pier'].includes(terrain)) {
      topColor = shadeHex('#e8f2fc', pal.shadeMul);
    }

    // Cliff / Earth Extrusion
    if (elev > 0) {
      const cliffColor = terrain === 'rock' ? '#5c6470' : '#6e5849';
      ctx.fillStyle = shadeHex(cliffColor, 0.72 * pal.shadeMul);
      ctx.beginPath();
      ctx.moveTo(top.x - hw, top.y + hh);
      ctx.lineTo(top.x, top.y + hh * 2);
      ctx.lineTo(base.x, base.y + hh * 2);
      ctx.lineTo(base.x - hw, base.y + hh);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = shadeHex(cliffColor, 0.92 * pal.shadeMul);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y + hh * 2);
      ctx.lineTo(top.x + hw, top.y + hh);
      ctx.lineTo(base.x + hw, base.y + hh);
      ctx.lineTo(base.x, base.y + hh * 2);
      ctx.closePath();
      ctx.fill();
    }

    // Surface Diamond
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(top.x + hw + 0.6, top.y + hh);
    ctx.lineTo(top.x, top.y + hh * 2 + 0.6);
    ctx.lineTo(top.x - hw - 0.6, top.y + hh);
    ctx.closePath();
    ctx.fill();

    // Zebra Crosswalk Stripes (Reference 1 detail)
    if (terrain === 'crosswalk') {
      ctx.fillStyle = pal.crosswalk;
      for (let s = -2; s <= 2; s++) {
        ctx.fillRect(top.x + s * 3 * z - 1 * z, top.y + hh - 1 * z, 2 * z, 2.5 * z);
      }
    }

    // Cobblestone Texture Stones (Reference 2 detail)
    if (terrain === 'cobble' && this.weather !== 'snow') {
      ctx.fillStyle = pal.cobbleLine;
      ctx.fillRect(top.x - 4 * z, top.y + hh - 1 * z, 2.5 * z, 1.5 * z);
      ctx.fillRect(top.x + 2 * z, top.y + hh + 1 * z, 2.5 * z, 1.5 * z);
      ctx.fillRect(top.x - 1 * z, top.y + hh - 3 * z, 2 * z, 1.5 * z);
    }

    // Waterfall cascade
    if (terrain === 'river' && gx === 4 && gy === 3) {
      ctx.fillStyle = pal.seaFoam;
      ctx.fillRect(top.x - 2.5 * z, top.y + hh, 5 * z, 11 * z);
    }

    // Sea Shimmer
    if (terrain === 'sea' && Math.sin(tick * 2.2 + gx * 0.9 + gy * 0.7) > 0.38) {
      ctx.fillStyle = pal.seaFoam;
      ctx.fillRect(top.x - 2.5 * z, top.y + hh, 4.5 * z, 1.2 * z);
    }

    // Warm Streetlight Halo at Dusk/Night
    if (pal.streetLight && (terrain === 'asphalt' || terrain === 'cobble' || terrain === 'pier') && (gx + gy) % 3 === 0) {
      ctx.fillStyle = 'rgba(255, 214, 128, 0.25)';
      ctx.beginPath();
      ctx.arc(top.x, top.y + hh, 6 * z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBuildingOrProp(cell: WorldCell, pal: Palette, tick: number) {
    const p = cell.prop;
    if (!p) return;
    const { gx, gy, elev } = cell;
    const base = this.isoToScreen(gx, gy, elev);
    const z = this.zoom;
    const hw = (TILE_W / 2 - 1.5) * z;
    const hh = (TILE_H / 2 - 0.75) * z;
    const ctx = this.ctx;

    if (base.x + hw * 2 < -30 || base.x - hw * 2 > this.pixW + 30) return;

    // 1. Lush Layered Trees (Reference 2 multi-puff foliage + ground shadow)
    if (p.kind === 'oak' || p.kind === 'pine') {
      // Ground shadow
      ctx.fillStyle = `rgba(0,0,0,${pal.shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(base.x + 2 * z, base.y + hh + 1 * z, 5.5 * z, 2.8 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trunk
      ctx.fillStyle = '#54392b';
      ctx.fillRect(base.x - 1.2 * z, base.y + hh - 5 * z, 2.4 * z, 5.5 * z);

      if (p.kind === 'pine') {
        const col = this.weather === 'snow' ? shadeHex('#dfeaf5', pal.shadeMul) : shadeHex('#2c5942', pal.shadeMul);
        ctx.fillStyle = col;
        for (let tier = 0; tier < 3; tier++) {
          const ty = base.y + hh - (4 + tier * 3.5) * z;
          const tw = (6 - tier * 1.3) * z;
          ctx.beginPath();
          ctx.moveTo(base.x, ty - 5 * z);
          ctx.lineTo(base.x + tw, ty);
          ctx.lineTo(base.x - tw, ty);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Lush Storybook Oak Canopy (dark base + mid green + sunlit top puffs)
        const cDark = this.weather === 'snow' ? '#bdd0e3' : shadeHex('#2f5938', pal.shadeMul);
        const cMid = this.weather === 'snow' ? '#d8e7f5' : shadeHex('#457d49', pal.shadeMul);
        const cBright = this.weather === 'snow' ? '#f0f7fc' : shadeHex('#6ab05a', pal.shadeMul);

        ctx.fillStyle = cDark;
        ctx.beginPath();
        ctx.arc(base.x - 2.5 * z, base.y + hh - 6.5 * z, 4.5 * z, 0, Math.PI * 2);
        ctx.arc(base.x + 2.5 * z, base.y + hh - 6.5 * z, 4.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = cMid;
        ctx.beginPath();
        ctx.arc(base.x, base.y + hh - 8.5 * z, 5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = cBright;
        ctx.beginPath();
        ctx.arc(base.x + 1 * z, base.y + hh - 10 * z, 3.2 * z, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // 2. Village Fountain / Stone Well (Reference 2 left plaza detail)
    if (p.kind === 'fountain') {
      ctx.fillStyle = shadeHex(p.wallLeft, pal.shadeMul);
      ctx.fillRect(base.x - 5 * z, base.y + hh - 3 * z, 10 * z, 5 * z);
      ctx.fillStyle = pal.river;
      ctx.fillRect(base.x - 3.5 * z, base.y + hh - 2 * z, 7 * z, 2.5 * z);
      return;
    }

    // 3. Beach Umbrella
    if (p.kind === 'umbrella') {
      ctx.fillStyle = p.roofColor;
      ctx.beginPath();
      ctx.arc(base.x, base.y + hh - 3.5 * z, 4.5 * z, Math.PI, 0);
      ctx.fill();
      return;
    }

    // 4. Cozy Storybook Timber Cottage (Reference 2: Timber beams, terracotta shingles, awning, flower boxes)
    if (p.kind === 'timber_cottage') {
      const top = this.isoToScreen(gx, gy, elev + p.h);
      const cw = hw * 0.85;
      const ch = hh * 0.85;

      // Cast Ground Shadow
      ctx.fillStyle = `rgba(0,0,0,${pal.shadowAlpha})`;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y + ch * 2);
      ctx.lineTo(base.x + cw + 5 * z, base.y + ch + 2 * z);
      ctx.lineTo(base.x + 4 * z, base.y + ch * 2 + 4 * z);
      ctx.closePath();
      ctx.fill();

      // Left Wall
      ctx.fillStyle = shadeHex(p.wallLeft, pal.shadeMul);
      ctx.beginPath();
      ctx.moveTo(top.x - cw, top.y + ch);
      ctx.lineTo(top.x, top.y + ch * 2);
      ctx.lineTo(base.x, base.y + ch * 2);
      ctx.lineTo(base.x - cw, base.y + ch);
      ctx.closePath();
      ctx.fill();

      // Right Wall
      ctx.fillStyle = shadeHex(p.wallRight, pal.shadeMul);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y + ch * 2);
      ctx.lineTo(top.x + cw, top.y + ch);
      ctx.lineTo(base.x + cw, base.y + ch);
      ctx.lineTo(base.x, base.y + ch * 2);
      ctx.closePath();
      ctx.fill();

      // Dark Timber Framing Beams
      if (p.timberFrame) {
        ctx.strokeStyle = shadeHex('#4a3525', pal.shadeMul);
        ctx.lineWidth = Math.max(1, 1 * z);
        ctx.strokeRect(top.x - cw * 0.85, top.y + ch * 1.2, cw * 0.7, (base.y - top.y) * 0.75);
      }

      // Steep Gabled Terracotta Roof
      const peakY = top.y - 6.5 * z;
      const roofCol = this.weather === 'snow' ? shadeHex('#edf5fc', pal.shadeMul) : shadeHex(p.roofColor, pal.shadeMul);
      ctx.fillStyle = roofCol;
      ctx.beginPath();
      ctx.moveTo(top.x, peakY);
      ctx.lineTo(top.x + cw + 2 * z, top.y + ch);
      ctx.lineTo(top.x, top.y + ch * 2 + 1.5 * z);
      ctx.lineTo(top.x - cw - 2 * z, top.y + ch);
      ctx.closePath();
      ctx.fill();

      // Brick Chimney
      ctx.fillStyle = shadeHex('#8c4638', pal.shadeMul);
      ctx.fillRect(top.x + 2 * z, peakY + 1 * z, 2.5 * z, 4.5 * z);

      // Warm Cottage Window + Flower Box
      const isLit = p.winSeeds[0] < pal.windowChance + 0.25;
      ctx.fillStyle = isLit ? pal.windowLit : pal.windowDark;
      ctx.fillRect(base.x + 2 * z, base.y + ch - 3.5 * z, 3 * z, 3 * z);
      ctx.fillRect(base.x - 5 * z, base.y + ch - 3.5 * z, 3 * z, 3 * z);

      if (p.flowerBox) {
        ctx.fillStyle = '#3b6e38';
        ctx.fillRect(base.x + 1.5 * z, base.y + ch - 0.5 * z, 4 * z, 1.2 * z);
        ctx.fillStyle = '#ff6b81';
        ctx.fillRect(base.x + 2 * z, base.y + ch - 1 * z, 1.2 * z, 1.2 * z);
      }
      return;
    }

    // 5. Downtown Shop / Commercial Tower (Reference 1: Billboards, Storefront Awnings, Rooftop AC units)
    if (p.kind === 'downtown_shop' || p.kind === 'temple_shrine') {
      const top = this.isoToScreen(gx, gy, elev + p.h);

      // Left Face
      ctx.fillStyle = shadeHex(p.wallLeft, pal.shadeMul);
      ctx.beginPath();
      ctx.moveTo(top.x - hw, top.y + hh);
      ctx.lineTo(top.x, top.y + hh * 2);
      ctx.lineTo(base.x, base.y + hh * 2);
      ctx.lineTo(base.x - hw, base.y + hh);
      ctx.closePath();
      ctx.fill();

      // Right Face
      ctx.fillStyle = shadeHex(p.wallRight, pal.shadeMul);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y + hh * 2);
      ctx.lineTo(top.x + hw, top.y + hh);
      ctx.lineTo(base.x + hw, base.y + hh);
      ctx.lineTo(base.x, base.y + hh * 2);
      ctx.closePath();
      ctx.fill();

      // Roof Top
      const rCol = this.weather === 'snow' ? shadeHex('#e6f0fa', pal.shadeMul) : shadeHex(p.roofColor, pal.shadeMul);
      ctx.fillStyle = rCol;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x + hw, top.y + hh);
      ctx.lineTo(top.x, top.y + hh * 2);
      ctx.lineTo(top.x - hw, top.y + hh);
      ctx.closePath();
      ctx.fill();

      // Multi-Floor Pixel Windows
      const floors = Math.floor((p.h - 8) / 6);
      let sIdx = 0;
      for (let f = 0; f < floors; f++) {
        const wy = (5 + f * 6) * z;
        for (let c = 0; c < 2; c++) {
          const litL = p.winSeeds[sIdx++ % p.winSeeds.length] < pal.windowChance;
          ctx.fillStyle = litL ? pal.windowLit : pal.windowDark;
          ctx.fillRect(top.x - hw + (3 + c * 4.5) * z, top.y + hh + wy + c * 2 * z, 2.2 * z, 3.2 * z);

          const litR = p.winSeeds[sIdx++ % p.winSeeds.length] < pal.windowChance;
          ctx.fillStyle = litR ? pal.windowLit : pal.windowDark;
          ctx.fillRect(top.x + (2.5 + c * 4.5) * z, top.y + hh * 2 + wy - c * 2 * z - 2 * z, 2.2 * z, 3.2 * z);
        }
      }

      // Ground-floor Storefront Awning (Reference 1 green/red striped canopies)
      if (p.awningColor) {
        ctx.fillStyle = shadeHex(p.awningColor, pal.shadeMul);
        ctx.fillRect(base.x + 1 * z, base.y + hh + 1 * z, hw * 0.75, 2.5 * z);
      }

      // Colorful Vertical Signboard / Rooftop Billboard (Reference 1)
      if (p.signColor) {
        ctx.fillStyle = pal.neon ? p.signColor : shadeHex(p.signColor, pal.shadeMul);
        ctx.fillRect(top.x - hw + 2 * z, top.y + hh + 2 * z, 5 * z, 4 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(top.x - hw + 3 * z, top.y + hh + 3.5 * z, 3 * z, 1 * z);
      }

      // Rooftop HVAC / AC Ducts (Reference 1 rooftop detail)
      if (p.roofStyle === 'flat_ac') {
        ctx.fillStyle = shadeHex('#7f8c99', pal.shadeMul);
        ctx.fillRect(top.x - 3 * z, top.y + hh - 2 * z, 3.5 * z, 2.5 * z);
        ctx.fillRect(top.x + 1 * z, top.y + hh, 2.5 * z, 2 * z);
      }
      return;
    }

    // 6. Seaside Lighthouse + Rotating Beam
    if (p.kind === 'lighthouse') {
      const top = this.isoToScreen(gx, gy, elev + p.h);
      ctx.fillStyle = shadeHex('#f5f5f5', pal.shadeMul);
      ctx.fillRect(top.x - 3.5 * z, top.y + 4 * z, 7 * z, p.h * z);
      ctx.fillStyle = shadeHex('#d94141', pal.shadeMul);
      ctx.fillRect(top.x - 3.5 * z, top.y + 12 * z, 7 * z, 6 * z);
      ctx.fillRect(top.x - 3.5 * z, top.y + 24 * z, 7 * z, 6 * z);
      ctx.fillStyle = '#ffe58f';
      ctx.fillRect(top.x - 3 * z, top.y, 6 * z, 4 * z);

      if (pal.streetLight) {
        const bx = Math.cos(tick * 1.3) * 60 * z;
        const by = Math.sin(tick * 1.3) * 26 * z;
        const grad = ctx.createLinearGradient(top.x, top.y + 2 * z, top.x + bx, top.y + by);
        grad.addColorStop(0, 'rgba(255, 238, 160, 0.45)');
        grad.addColorStop(1, 'rgba(255, 238, 160, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y + 2 * z);
        ctx.lineTo(top.x + bx - 12 * z, top.y + by - 8 * z);
        ctx.lineTo(top.x + bx + 12 * z, top.y + by + 8 * z);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawPaperPlane(p: ActivePlaneEntity, pal: Palette, tick: number) {
    const ctx = this.ctx;
    const z = this.zoom;
    const isHovered = p === this.hoveredPlane;
    const bob = Math.sin(tick * 2.6 + p.bobPhase) * 2.2;
    const pos = this.isoToScreen(p.gx, p.gy, p.gz + bob);

    // 1. Cast Ground / Rooftop Shadow directly below the plane
    const surfH = this.getSurfaceElevation(p.gx, p.gy);
    const sh = this.isoToScreen(p.gx, p.gy, surfH);
    ctx.fillStyle = `rgba(0, 0, 0, ${pal.shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y + 6 * z, 4.2 * z, 2.1 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Breezy Wind Contrail
    p.trail.forEach((pt, idx) => {
      const tp = this.isoToScreen(pt.gx, pt.gy, pt.gz);
      const alpha = (idx / p.trail.length) * 0.42;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(tp.x, tp.y, 1.6 * z, 1.6 * z);
    });

    // 3. Crisp Multi-Tone Folded Paper Plane Sprite
    const svx = p.vx - p.vy;
    const svy = (p.vx + p.vy) * 0.5;
    const angle = Math.atan2(svy, svx);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    const scale = Math.max(1.05, z * 1.18);
    ctx.scale(scale, scale);

    if (isHovered || p.note.isUserCreated) {
      ctx.fillStyle = isHovered ? 'rgba(255, 255, 255, 0.38)' : 'rgba(243, 198, 99, 0.30)';
      ctx.beginPath();
      ctx.arc(0, 0, isHovered ? 11 : 8.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const quantAngle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
    ctx.rotate(quantAngle);

    // Paper Tint Mapping
    const tintColors: Record<string, { top: string; crease: string; bottom: string }> = {
      cream: { top: '#ffffff', crease: '#c2cfde', bottom: '#ebf1f7' },
      rose: { top: '#fff0f0', crease: '#deb8b8', bottom: '#f7dede' },
      sky: { top: '#f0f8ff', crease: '#acc8de', bottom: '#dcecf7' },
      sage: { top: '#f0faf2', crease: '#b4d4bc', bottom: '#def0e3' },
      gold: { top: '#fff8e6', crease: '#dec99b', bottom: '#f7ebd2' },
    };
    const tc = tintColors[p.note.paperTint] || tintColors.cream;

    // Dark pixel outline for high contrast against any building or sky
    ctx.fillStyle = isHovered ? '#e27249' : '#262b40';
    ctx.beginPath();
    ctx.moveTo(8.5, 0);
    ctx.lineTo(-7.5, -6.5);
    ctx.lineTo(-4.2, 0);
    ctx.lineTo(-7.5, 6.5);
    ctx.closePath();
    ctx.fill();

    // Left / Upper Wing
    ctx.fillStyle = tc.top;
    ctx.beginPath();
    ctx.moveTo(7.2, 0);
    ctx.lineTo(-6.2, -5.2);
    ctx.lineTo(-3.2, -0.8);
    ctx.closePath();
    ctx.fill();

    // Center Fold Valley Crease
    ctx.fillStyle = tc.crease;
    ctx.beginPath();
    ctx.moveTo(7.2, 0);
    ctx.lineTo(-3.2, -0.8);
    ctx.lineTo(-5.2, 2.2);
    ctx.closePath();
    ctx.fill();

    // Right / Lower Wing
    ctx.fillStyle = tc.bottom;
    ctx.beginPath();
    ctx.moveTo(7.2, 0);
    ctx.lineTo(-3.2, 0.8);
    ctx.lineTo(-6.2, 5.2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    p.screenX = pos.x;
    p.screenY = pos.y;
  }

  private drawCloud(
    c: IsometricWorldEngine['clouds'][0],
    pal: Palette,
    alpha: number
  ) {
    const pos = this.isoToScreen(c.gx, c.gy, c.gz);
    const z = this.zoom;
    const ctx = this.ctx;

    if (pos.x < -80 || pos.x > this.pixW + 80 || pos.y < -80 || pos.y > this.pixH + 80) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    c.puffs.forEach((pf) => {
      ctx.fillStyle = pal.cloudShade;
      ctx.beginPath();
      ctx.arc(pos.x + pf.dx * z, pos.y + (pf.dy + 2) * z, pf.r * z, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pal.cloudTop;
      ctx.beginPath();
      ctx.arc(pos.x + pf.dx * z, pos.y + pf.dy * z, pf.r * z, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // =========================================================================
  // MAIN ANIMATION LOOP
  // =========================================================================
  private startLoop() {
    let lastTime = performance.now();
    let tick = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      tick += dt;

      // Smooth camera interpolation
      this.camX += (this.targetCamX - this.camX) * Math.min(1, dt * 9);
      this.camY += (this.targetCamY - this.camY) * Math.min(1, dt * 9);
      this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 9);

      const pal = PALETTES[this.timeOfDay];
      const ctx = this.ctx;
      const z = this.zoom;

      // 1. Sky Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, this.pixH);
      grad.addColorStop(0, pal.skyTop);
      grad.addColorStop(0.52, pal.skyMid);
      grad.addColorStop(1, pal.skyBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.pixW, this.pixH);

      // 2. Stars
      if (pal.stars > 0) {
        this.stars.forEach((s) => {
          const tw = 0.35 + 0.65 * Math.abs(Math.sin(tick * 1.6 + s.phase));
          ctx.fillStyle = `rgba(255,255,255,${pal.stars * tw})`;
          ctx.fillRect(Math.floor(s.u * this.pixW), Math.floor(s.v * this.pixH), 1.5, 1.5);
        });
      }

      // 3. Background Clouds
      this.clouds.forEach((c) => {
        c.gx += c.speed * dt;
        if (c.gx > GRID + 8) c.gx = -7;
        if (c.layer === 'back') this.drawCloud(c, pal, 0.78);
      });

      // 4. Terrain Grid
      for (let gx = 0; gx < GRID; gx++) {
        for (let gy = 0; gy < GRID; gy++) {
          this.drawTile(this.world[gx][gy], pal, tick);
        }
      }

      // 5. Delivery Vans on Downtown Roads (Reference 1)
      this.vans.forEach((v) => {
        v.pos += v.dir * v.speed * dt;
        if (v.pos > 15) v.dir = -1;
        if (v.pos < 4) v.dir = 1;
        const gx = v.axis === 'x' ? v.pos : v.lane;
        const gy = v.axis === 'y' ? v.pos : v.lane;
        const vp = this.isoToScreen(gx, gy, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(vp.x - 3.5 * z, vp.y + 5.5 * z, 7 * z, 2 * z);
        ctx.fillStyle = shadeHex(v.bodyColor, pal.shadeMul);
        ctx.fillRect(vp.x - 3 * z, vp.y + 1.5 * z, 6 * z, 4 * z);
        ctx.fillStyle = v.stripeColor;
        ctx.fillRect(vp.x - 3 * z, vp.y + 3 * z, 6 * z, 1.2 * z);
      });

      // 6. Walking Pedestrians / Villagers
      this.npcs.forEach((n) => {
        n.pos += n.dir * n.speed * dt;
        if (n.pos > n.maxPos) n.dir = -1;
        if (n.pos < n.minPos) n.dir = 1;
        const gx = n.axis === 'x' ? n.pos : n.lane;
        const gy = n.axis === 'y' ? n.pos : n.lane;
        const elev = this.world[Math.floor(gx)]?.[Math.floor(gy)]?.elev ?? 4;
        const hop = Math.abs(Math.sin(tick * 7.5 + n.bob)) * 1.1;
        const np = this.isoToScreen(gx, gy, elev + hop);

        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(np.x - 1.2 * z, np.y + 6 * z, 2.4 * z, 1 * z);
        ctx.fillStyle = n.shirt;
        ctx.fillRect(np.x - 1.1 * z, np.y + 3 * z, 2.2 * z, 3 * z);
        ctx.fillStyle = '#ffdbb5';
        ctx.fillRect(np.x - 1 * z, np.y + 1.4 * z, 2 * z, 1.6 * z);
        ctx.fillStyle = n.hair;
        ctx.fillRect(np.x - 1 * z, np.y + 0.8 * z, 2 * z, 0.9 * z);
      });

      // 7. Update Paper Planes (slow down gently on hover for easy catching)
      this.planes.forEach((p) => {
        const isHovered = p === this.hoveredPlane;
        const speedMul = isHovered ? 0.2 : 1.0;
        const speed = Math.hypot(p.vx, p.vy);
        let ang = Math.atan2(p.vy, p.vx) + p.turnRate * dt * speedMul;

        const cx = GRID / 2;
        const cy = GRID / 2;
        if (p.gx < 2 || p.gx > GRID - 2 || p.gy < 2 || p.gy > GRID - 2) {
          const toCenter = Math.atan2(cy - p.gy, cx - p.gx);
          const diff = Math.atan2(Math.sin(toCenter - ang), Math.cos(toCenter - ang));
          ang += diff * 1.85 * dt;
        }

        p.vx = Math.cos(ang) * speed;
        p.vy = Math.sin(ang) * speed;
        p.gx += p.vx * dt * speedMul;
        p.gy += p.vy * dt * speedMul;

        if (Math.floor(tick * 25) % 4 === 0) {
          p.trail.push({
            gx: p.gx,
            gy: p.gy,
            gz: p.gz + Math.sin(tick * 2.6 + p.bobPhase) * 2.2,
          });
          if (p.trail.length > 9) p.trail.shift();
        }
      });

      // 8. Painter's Algorithm Depth Sorting (Buildings + Trees + Paper Planes)
      const renderItems: Array<
        | { kind: 'prop'; depth: number; cell: WorldCell }
        | { kind: 'plane'; depth: number; plane: ActivePlaneEntity }
      > = [];

      for (let gx = 0; gx < GRID; gx++) {
        for (let gy = 0; gy < GRID; gy++) {
          if (this.world[gx][gy].prop) {
            renderItems.push({ kind: 'prop', depth: gx + gy, cell: this.world[gx][gy] });
          }
        }
      }
      this.planes.forEach((p) => {
        renderItems.push({ kind: 'plane', depth: p.gx + p.gy + 2.1, plane: p });
      });

      renderItems.sort((a, b) => a.depth - b.depth);

      renderItems.forEach((item) => {
        if (item.kind === 'prop') {
          this.drawBuildingOrProp(item.cell, pal, tick);
        } else {
          this.drawPaperPlane(item.plane, pal, tick);
        }
      });

      // 9. Occasional High-Altitude Airliner Flyby
      if (this.airliner.active) {
        this.airliner.gx += this.airliner.vx * dt;
        this.airliner.gy += this.airliner.vy * dt;
        if (Math.floor(tick * 20) % 3 === 0) {
          this.airliner.contrail.push({
            gx: this.airliner.gx,
            gy: this.airliner.gy,
            gz: this.airliner.gz,
          });
          if (this.airliner.contrail.length > 26) this.airliner.contrail.shift();
        }
        const ap = this.isoToScreen(this.airliner.gx, this.airliner.gy, this.airliner.gz);
        this.airliner.contrail.forEach((pt, idx) => {
          const cp = this.isoToScreen(pt.gx, pt.gy, pt.gz);
          const a = (idx / this.airliner.contrail.length) * 0.35;
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(cp.x - 2 * z, cp.y - 2 * z, 1.8 * z, 1.8 * z);
          ctx.fillRect(cp.x + 2 * z, cp.y + 2 * z, 1.8 * z, 1.8 * z);
        });
        ctx.save();
        ctx.translate(ap.x, ap.y);
        ctx.scale(z, z);
        ctx.fillStyle = '#e8eef5';
        ctx.fillRect(-10, -2, 20, 3);
        ctx.fillStyle = '#b8c7d9';
        ctx.fillRect(-2, -9, 5, 16);
        if (Math.sin(tick * 8) > 0.25) {
          ctx.fillStyle = '#ff3b30';
          ctx.fillRect(0, -10, 2, 2);
        }
        ctx.restore();

        if (this.airliner.gx > GRID + 10) {
          this.airliner.active = false;
          this.airliner.cooldown = 9;
        }
      } else {
        this.airliner.cooldown -= dt;
        if (this.airliner.cooldown <= 0) {
          this.airliner.active = true;
          this.airliner.gx = -6;
          this.airliner.gy = 13 + this.rng() * 7;
          this.airliner.contrail = [];
        }
      }

      // 10. Fireworks by the Sea
      if (this.fireworksActive) {
        this.fireworkTimer -= dt;
        if (this.fireworkTimer <= 0) {
          this.spawnFirework();
          this.fireworkTimer = 0.65 + this.rng() * 0.75;
        }
      }
      for (let i = this.fireworks.length - 1; i >= 0; i--) {
        const fw = this.fireworks[i];
        if (fw.phase === 'rocket') {
          fw.gz += 58 * dt;
          const rp = this.isoToScreen(fw.gx, fw.gy, fw.gz);
          ctx.fillStyle = '#fff5cc';
          ctx.fillRect(rp.x - 1 * z, rp.y - 1 * z, 2 * z, 3 * z);
          if (fw.gz >= fw.targetZ) {
            fw.phase = 'burst';
            for (let s = 0; s < 28; s++) {
              const a = (s / 28) * Math.PI * 2;
              const sp = 9 + this.rng() * 18;
              fw.sparks.push({
                dx: Math.cos(a) * sp,
                dy: Math.sin(a) * sp,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 1.0,
              });
            }
          }
        } else {
          const bp = this.isoToScreen(fw.gx, fw.gy, fw.gz);
          let alive = 0;
          fw.sparks.forEach((sp) => {
            sp.life -= dt * 0.85;
            if (sp.life > 0) {
              alive++;
              sp.dx += sp.vx * dt;
              sp.dy += sp.vy * dt + 8 * dt;
              ctx.fillStyle = fw.color;
              ctx.globalAlpha = sp.life;
              ctx.fillRect(bp.x + sp.dx * z, bp.y + sp.dy * z, 2.2 * z, 2.2 * z);
              ctx.globalAlpha = 1.0;
            }
          });
          if (alive === 0) this.fireworks.splice(i, 1);
        }
      }

      // 11. Foreground Clouds
      this.clouds.forEach((c) => {
        if (c.layer === 'front') this.drawCloud(c, pal, 0.38);
      });

      // 12. Weather Particles (Rain / Winter Snow)
      if (this.weather !== 'clear') {
        this.weatherParticles.forEach((wp) => {
          if (this.weather === 'rain') {
            wp.y += 270 * dt * wp.speed;
            wp.x -= 65 * dt;
            if (wp.y > this.pixH) {
              wp.y = -10;
              wp.x = this.rng() * this.pixW;
            }
            if (wp.x < 0) wp.x = this.pixW;
            ctx.strokeStyle = 'rgba(185, 215, 255, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(wp.x, wp.y);
            ctx.lineTo(wp.x - 2, wp.y + 7);
            ctx.stroke();
          } else {
            wp.y += 42 * dt * wp.speed;
            wp.x += Math.sin(tick * 2 + wp.speed) * 14 * dt;
            if (wp.y > this.pixH) {
              wp.y = -5;
              wp.x = this.rng() * this.pixW;
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            ctx.fillRect(wp.x, wp.y, 2, 2);
          }
        });
      }

      this.rafId = requestAnimationFrame(frame);
    };

    this.rafId = requestAnimationFrame(frame);
  }

  // =========================================================================
  // INPUT & MOBILE TOUCH / PINCH-TO-ZOOM ERGONOMICS (Fitts's Law Hit Targets)
  // =========================================================================
  private getCanvasPoint(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * this.pixW,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * this.pixH,
    };
  }

  private findPlaneAt(x: number, y: number, isTouch = false): ActivePlaneEntity | null {
    // Generous hit target radius (especially on mobile touch per AGENTS.md Fitts's Law)
    const hitRadius = (isTouch ? 24 : 16) * Math.max(0.85, this.zoom);
    let best: ActivePlaneEntity | null = null;
    let bestDist = hitRadius;
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const p = this.planes[i];
      const d = Math.hypot(x - p.screenX, y - p.screenY);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  private handleResize = () => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    this.pixH = 340;
    this.pixW = Math.round(this.pixH * aspect);
    this.canvas.width = this.pixW;
    this.canvas.height = this.pixH;
    this.ctx.imageSmoothingEnabled = false;
  };

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.adjustZoom(e.deltaY < 0 ? 0.15 : -0.15);
      },
      { passive: false }
    );

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStart = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (Math.hypot(dx, dy) > 4) this.dragMoved = true;
        const rect = this.canvas.getBoundingClientRect();
        this.targetCamX += ((dx / Math.max(1, rect.width)) * this.pixW) / this.zoom;
        this.targetCamY += ((dy / Math.max(1, rect.height)) * this.pixH) / this.zoom;
        this.camX = this.targetCamX;
        this.camY = this.targetCamY;
        this.dragStart = { x: e.clientX, y: e.clientY };
        return;
      }

      const pt = this.getCanvasPoint(e.clientX, e.clientY);
      this.hoveredPlane = this.findPlaneAt(pt.x, pt.y, false);
      this.canvas.style.cursor = this.hoveredPlane ? 'pointer' : 'grab';
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.dragMoved) return;
      const pt = this.getCanvasPoint(e.clientX, e.clientY);
      const hit = this.findPlaneAt(pt.x, pt.y, false);
      if (hit) {
        this.onSelectPlane(hit.note);
      }
    });

    // Mobile Touch: 1-finger Pan, Tap to Catch Plane, 2-finger Pinch-to-Zoom
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.pinchDist = Math.hypot(dx, dy);
        } else if (e.touches.length === 1) {
          this.isDragging = true;
          this.dragMoved = false;
          this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      },
      { passive: true }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && this.pinchDist > 0) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const diff = (dist - this.pinchDist) * 0.005;
          this.adjustZoom(diff);
          this.pinchDist = dist;
          this.dragMoved = true;
        } else if (e.touches.length === 1 && this.isDragging) {
          const dx = e.touches[0].clientX - this.dragStart.x;
          const dy = e.touches[0].clientY - this.dragStart.y;
          if (Math.hypot(dx, dy) > 6) this.dragMoved = true;
          const rect = this.canvas.getBoundingClientRect();
          this.targetCamX += ((dx / Math.max(1, rect.width)) * this.pixW) / this.zoom;
          this.targetCamY += ((dy / Math.max(1, rect.height)) * this.pixH) / this.zoom;
          this.camX = this.targetCamX;
          this.camY = this.targetCamY;
          this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      },
      { passive: true }
    );

    this.canvas.addEventListener('touchend', (e) => {
      if (!this.dragMoved && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const pt = this.getCanvasPoint(t.clientX, t.clientY);
        const hit = this.findPlaneAt(pt.x, pt.y, true);
        if (hit) {
          this.onSelectPlane(hit.note);
        }
      }
      this.isDragging = false;
      this.pinchDist = 0;
    });
  }

  public destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
  }
}
