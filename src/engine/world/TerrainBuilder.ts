import * as THREE from 'three';
import type { Palette } from '../ThreeWorldEngine';

export type TerrainKind =
  | 'void'
  | 'grass'
  | 'grassAlt'
  | 'plank'
  | 'stairs_sw'
  | 'stairs_se'
  | 'mulch'
  | 'earth_cut'
  | 'garden_bed'
  | 'stream'
  | 'waterfall';

export interface TerrainCell {
  gx: number;
  gy: number;
  kind: TerrainKind;
  elev: number;
}

export const TILE_SPACING = 39 * Math.SQRT2; // ~55.154272966
export const ELEV_UNIT = 2 / Math.sqrt(3);   // ~1.154700538

export function gridToWorld3D(gx: number, gy: number, gz = 0): THREE.Vector3 {
  return new THREE.Vector3(-gy * TILE_SPACING, gz * ELEV_UNIT, gx * TILE_SPACING);
}

export class TerrainBuilder {
  public readonly group: THREE.Group;
  private textures: Map<string, THREE.CanvasTexture> = new Map();
  private materials: Map<string, THREE.Material> = new Map();
  private grid: (TerrainCell | null)[][] = [];

  constructor(timeOfDayPalette?: Palette) {
    this.group = new THREE.Group();
    this.group.name = 'DioramaTerrain';

    this.initTextureGenerators(timeOfDayPalette);
    this.initMaterials(timeOfDayPalette);
    this.buildGridData();
    this.buildTerrainMeshes();
    this.buildGrassTufts();
    this.buildBedrockKeel();
  }

  // ---------------------------------------------------------------------------
  // 1. PROCEDURAL PIXEL-ART TEXTURE GENERATION
  // ---------------------------------------------------------------------------
  private createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    return {
      width,
      height,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
  }

  private registerCanvasTexture(name: string, canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.textures.set(name, tex);
    return tex;
  }

  private initTextureGenerators(pal?: Palette): void {
    // 1. Grass Texture (64x64) - neutral bright values so material.color tints without double-darkening
    this.registerCanvasTexture('grass', this.createGrassCanvas('#f2f4ea', '#dce2cc', '#ffffff'));
    // 2. GrassAlt Texture (64x64)
    this.registerCanvasTexture('grassAlt', this.createGrassCanvas('#eef0e4', '#d6dcc4', '#fbfcf7'));
    // 3. Timber Planks (64x64)
    this.registerCanvasTexture('plank', this.createPlankCanvas());
    // 4. Mulch / Peat Bed (64x64)
    this.registerCanvasTexture('mulch', this.createMulchCanvas());
    // 5. Garden Bed (64x64)
    this.registerCanvasTexture('garden_bed', this.createGardenBedCanvas());
    // 6. Earth Cut / Exposed Loam (64x64)
    this.registerCanvasTexture('earth_cut', this.createEarthCutCanvas());
    // 7. Riverbed / Stream Bed Silt (64x64) - neutral bright values for material.color tinting
    this.registerCanvasTexture('stream_bed', this.createStreamBedCanvas());
    // 8. SW Cliff Face (Left Wall - Shaded Loam)
    this.registerCanvasTexture('cliff_sw', this.createCliffCanvas('sw'));
    // 9. SE Cliff Face (Right Wall - Sunlit Loam)
    this.registerCanvasTexture('cliff_se', this.createCliffCanvas('se'));
  }

  private createGrassCanvas(base: string, dark: string, light: string): HTMLCanvasElement {
    const canvas = this.createOffscreenCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);

    // Soft organic moss/sunlight dappling (low-contrast, non-blocky)
    ctx.globalAlpha = 0.28;
    const patches: [number, number, number, string][] = [
      [12, 14, 10, light], [42, 10, 11, dark], [28, 30, 12, light],
      [52, 36, 9, dark], [14, 48, 11, dark], [40, 52, 10, light],
    ];
    for (const [cx, cy, r, col] of patches) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    return canvas;
  }

  private createPlankCanvas(): HTMLCanvasElement {
    const canvas = this.createOffscreenCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // 4 horizontal warm golden-amber timber planks (16px high each)
    const plankColors = ['#d49442', '#dc9c48', '#cc8c3c', '#e0a24e'];
    for (let p = 0; p < 4; p++) {
      const y = p * 16;
      ctx.fillStyle = plankColors[p];
      ctx.fillRect(0, y, 64, 16);

      // Top edge highlight
      ctx.fillStyle = '#ebba6c';
      ctx.fillRect(0, y, 64, 1);

      // Plank grain lines
      ctx.fillStyle = '#ba7d32';
      ctx.fillRect(4, y + 5, 24, 1);
      ctx.fillRect(34, y + 9, 22, 1);
      ctx.fillRect(18, y + 12, 16, 1);

      // Bottom groove
      ctx.fillStyle = '#855222';
      ctx.fillRect(0, y + 15, 64, 1);

      // Iron nail pips
      ctx.fillStyle = '#5c3614';
      ctx.fillRect(4, y + 7, 2, 2);
      ctx.fillRect(58, y + 7, 2, 2);
    }

    return canvas;
  }

  private createMulchCanvas(): HTMLCanvasElement {
    const canvas = this.createOffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Warm, natural forest soil/loam base
    ctx.fillStyle = '#5e3f27';
    ctx.fillRect(0, 0, 128, 128);

    // Soft organic soil mottling & pebbles
    ctx.globalAlpha = 0.35;
    const spots: [number, number, number, string][] = [
      [18, 22, 14, '#4d331f'], [58, 18, 18, '#704d31'], [96, 30, 15, '#4d331f'],
      [34, 62, 16, '#704d31'], [78, 56, 20, '#4d331f'], [110, 78, 14, '#704d31'],
      [22, 98, 18, '#4d331f'], [64, 102, 16, '#704d31'], [98, 112, 14, '#4d331f'],
    ];
    for (const [cx, cy, r, col] of spots) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.65;
    const pebbles: [number, number, number, string][] = [
      [24, 38, 3.5, '#7a573a'], [72, 28, 3.0, '#3f2817'], [104, 52, 4.0, '#7a573a'],
      [48, 84, 3.5, '#3f2817'], [88, 92, 3.0, '#7a573a'], [14, 72, 3.0, '#3f2817'],
    ];
    for (const [cx, cy, r, col] of pebbles) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    return canvas;
  }

  private createGardenBedCanvas(): HTMLCanvasElement {
    const canvas = this.createOffscreenCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Rich dark compost soil
    ctx.fillStyle = '#332012';
    ctx.fillRect(0, 0, 64, 64);

    // Furrows and planting ridges (horizontal bands)
    for (let y = 0; y < 64; y += 16) {
      // Deep furrow
      ctx.fillStyle = '#24160c';
      ctx.fillRect(0, y, 64, 3);

      // Raised ridge
      ctx.fillStyle = '#4a301b';
      ctx.fillRect(0, y + 3, 64, 10);

      // Ridge highlight
      ctx.fillStyle = '#593a20';
      ctx.fillRect(0, y + 4, 64, 2);

      // Soil crumble pebbles
      ctx.fillStyle = '#22140a';
      ctx.fillRect(12, y + 8, 3, 2);
      ctx.fillRect(36, y + 7, 2, 2);
      ctx.fillRect(50, y + 9, 3, 2);

      // Sprout fleck
      ctx.fillStyle = '#5d8f28';
      ctx.fillRect(24, y + 6, 2, 2);
    }

    return canvas;
  }

  private createEarthCutCanvas(): HTMLCanvasElement {
    const canvas = this.createOffscreenCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = '#6b3d1e';
    ctx.fillRect(0, 0, 64, 64);

    // Strata layers
    ctx.fillStyle = '#854f2b';
    ctx.fillRect(0, 12, 64, 8);
    ctx.fillRect(0, 36, 64, 10);

    ctx.fillStyle = '#522e16';
    ctx.fillRect(0, 20, 64, 4);
    ctx.fillRect(0, 46, 64, 5);

    // Gravel specks
    ctx.fillStyle = '#9a6038';
    ctx.fillRect(10, 8, 2, 2);
    ctx.fillRect(32, 28, 3, 2);
    ctx.fillRect(48, 56, 2, 2);

    return canvas;
  }

  private createStreamBedCanvas(): HTMLCanvasElement {
    const canvas = this.createOffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Smooth sandy-teal riverbed (no pixelated squares)
    ctx.fillStyle = '#d4e2df';
    ctx.fillRect(0, 0, 128, 128);

    ctx.globalAlpha = 0.25;
    const stones: [number, number, number, string][] = [
      [22, 24, 14, '#b0c5c1'], [68, 20, 18, '#eef6f4'], [102, 42, 14, '#b0c5c1'],
      [38, 74, 16, '#eef6f4'], [82, 80, 18, '#b0c5c1'], [20, 108, 12, '#eef6f4'],
    ];
    for (const [cx, cy, r, col] of stones) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    return canvas;
  }

  private createCliffCanvas(side: 'sw' | 'se'): HTMLCanvasElement {
    const canvas = this.createOffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const isSW = side === 'sw';
    const baseColor = isSW ? '#8a6245' : '#a17756';
    const softDark = isSW ? '#785339' : '#8f6748';
    const softLight = isSW ? '#996f50' : '#b28663';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 128, 128);

    // Soft painterly earth blotches (matching stylized Redby Art soil, no crate lines!)
    ctx.globalAlpha = 0.35;
    const blobs: [number, number, number, string][] = [
      [24, 30, 22, softDark], [74, 22, 24, softLight], [108, 52, 20, softDark],
      [42, 76, 26, softLight], [90, 92, 22, softDark], [20, 108, 18, softLight],
    ];
    for (const [cx, cy, r, col] of blobs) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle organic diagonal rock/soil crack accent
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = isSW ? '#5e3f29' : '#734f34';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 95);
    ctx.lineTo(42, 72);
    ctx.lineTo(54, 78);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    return canvas;
  }

  // ---------------------------------------------------------------------------
  // 2. MATERIALS INITIALIZATION
  // ---------------------------------------------------------------------------
  private initMaterials(pal?: Palette): void {
    const getMat = (texName: string): THREE.MeshLambertMaterial => {
      const tex = this.textures.get(texName);
      const mat = new THREE.MeshLambertMaterial({
        map: tex,
        flatShading: true,
      });
      this.materials.set(texName, mat);
      return mat;
    };

    getMat('grass');
    getMat('grassAlt');
    getMat('plank');
    getMat('mulch');
    getMat('garden_bed');
    getMat('earth_cut');
    getMat('stream_bed');
    getMat('cliff_sw');
    getMat('cliff_se');

    // Solid warm wood riser material for stairs
    const stairRiser = new THREE.MeshLambertMaterial({
      color: 0x8a5226,
      flatShading: true,
    });
    this.materials.set('stair_riser', stairRiser);

    // Bedrock keel material (warm faceted low-poly stone underbelly)
    const bedrockMat = new THREE.MeshLambertMaterial({
      color: 0x7a6e65,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    this.materials.set('bedrock_keel', bedrockMat);

    // Grass tuft material (DoubleSide + smooth shading for soft curved blades)
    const tuftMat = new THREE.MeshLambertMaterial({
      color: pal?.grass ?? '#9bb043',
      side: THREE.DoubleSide,
    });
    this.materials.set('grass_tuft', tuftMat);

    // Tiny wildflower accent material
    const wildflowerMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
    });
    this.materials.set('wildflower_fleck', wildflowerMat);
  }

  // ---------------------------------------------------------------------------
  // 3. 12x12 GRID DATA BUILDER
  // ---------------------------------------------------------------------------
  private buildGridData(): void {
    this.grid = Array.from({ length: 12 }, () => Array(12).fill(null));

    const setCell = (gx: number, gy: number, kind: TerrainKind, elev: number) => {
      this.grid[gx][gy] = { gx, gy, kind, elev };
    };

    // Row 1 (NW Pine Ridge sloping naturally toward SW)
    setCell(1, 3, 'grassAlt', 48);
    setCell(1, 4, 'grassAlt', 42);
    setCell(1, 5, 'grassAlt', 34);
    setCell(1, 6, 'grass', 34);
    setCell(1, 8, 'grass', 25);

    // Row 2 (Continuous Cottage -> Campfire -> Lower Meadow Boardwalk)
    setCell(2, 2, 'plank', 52); // Cottage stoop/terrace
    setCell(2, 3, 'plank', 42); // Upper boardwalk landing
    setCell(2, 4, 'plank', 42); // Mid boardwalk
    setCell(2, 5, 'stairs_sw', 34); // Stairs down to campfire terrace
    setCell(2, 6, 'mulch', 34); // Campfire hearth
    setCell(2, 7, 'stairs_sw', 25); // Stairs down to lower meadow
    setCell(2, 8, 'plank', 25); // Lower meadow boardwalk
    setCell(2, 9, 'grass', 26);

    // Row 3 (Natural stepped hillside)
    setCell(3, 1, 'grass', 54); // Hollow trunk peak
    setCell(3, 2, 'grass', 52); // Pine
    setCell(3, 3, 'grass', 42); // Grassy slope
    setCell(3, 4, 'grass', 42); // Round bush
    setCell(3, 5, 'grass', 34);
    setCell(3, 6, 'grassAlt', 34);
    setCell(3, 7, 'grassAlt', 25);
    setCell(3, 8, 'grass', 25);
    setCell(3, 9, 'grassAlt', 25);

    // Row 4 (Upper ridge -> stream valley)
    setCell(4, 1, 'grass', 52);
    setCell(4, 2, 'grass', 42);
    setCell(4, 3, 'grass', 42); // Pine
    setCell(4, 4, 'grass', 34);
    setCell(4, 5, 'grass', 25);
    setCell(4, 6, 'grass', 25);
    setCell(4, 7, 'stream', 14);
    setCell(4, 8, 'stream', 14);
    setCell(4, 9, 'stream', 14);
    setCell(4, 10, 'waterfall', 14); // Stream outflow

    // Row 5 (East stairs down to boardwalk + stream channel)
    setCell(5, 2, 'grass', 42);
    setCell(5, 3, 'stairs_se', 34); // Stairs down from ridge to east plateau
    setCell(5, 4, 'grassAlt', 25);
    setCell(5, 5, 'stream', 14); // Cattails
    setCell(5, 6, 'stream', 14); // Lily
    setCell(5, 7, 'stream', 14); // Rock
    setCell(5, 8, 'stream', 14);
    setCell(5, 9, 'grass', 25);

    // Row 6 (East boardwalk -> riverside dock next to garden bed)
    setCell(6, 2, 'grassAlt', 34); // Monolith
    setCell(6, 3, 'plank', 34); // East boardwalk landing
    setCell(6, 4, 'plank', 34); // East boardwalk
    setCell(6, 5, 'stairs_sw', 25); // Stairs down to riverside dock
    setCell(6, 6, 'plank', 25); // Watering can dock
    setCell(6, 7, 'plank', 25); // Dock beside garden bed
    setCell(6, 8, 'grass', 25);
    setCell(6, 9, 'grassAlt', 25);

    // Row 7 (Garden terrace)
    setCell(7, 3, 'grassAlt', 34); // Amanita mushroom
    setCell(7, 4, 'grass', 34);
    setCell(7, 5, 'grass', 25);
    setCell(7, 6, 'garden_bed', 26); // Cabbage
    setCell(7, 7, 'garden_bed', 26); // Sprout
    setCell(7, 8, 'grass', 25);

    // Row 8
    setCell(8, 3, 'grass', 34);
    setCell(8, 4, 'grass', 34);
    setCell(8, 5, 'grass', 25);
    setCell(8, 6, 'grassAlt', 26);
    setCell(8, 7, 'grass', 26);
    setCell(8, 8, 'grass', 25); // Mushroom stump on natural grass

    // Row 9
    setCell(9, 4, 'grass', 25);
    setCell(9, 5, 'grass', 25);
    setCell(9, 6, 'grassAlt', 25); // Frog planter
    setCell(9, 7, 'grass', 25);
  }

  // ---------------------------------------------------------------------------
  // 4. MESH CREATION & EXTRACTED FACES
  // ---------------------------------------------------------------------------
  private buildTerrainMeshes(): void {
    const matCliffSW = this.materials.get('cliff_sw')!;
    const matCliffSE = this.materials.get('cliff_se')!;

    for (let gx = 0; gx < 12; gx++) {
      for (let gy = 0; gy < 12; gy++) {
        const cell = this.grid[gx][gy];
        if (!cell || cell.kind === 'void') continue;

        if (cell.kind === 'stairs_sw' || cell.kind === 'stairs_se') {
          const stairs = this.createStaircase(gx, gy, cell.elev, cell.kind);
          this.group.add(stairs);
          continue;
        }

        const isGrass = cell.kind === 'grass' || cell.kind === 'grassAlt';
        const H = cell.elev * ELEV_UNIT;
        const cx = -(gy + 0.5) * TILE_SPACING;
        const cz = (gx + 0.5) * TILE_SPACING;

        if (isGrass) {
          // 1. Earth/soil base (inset slightly under turf cap)
          const capH = 5.2;
          const baseH = Math.max(2, H - capH);
          const baseGeo = new THREE.BoxGeometry(TILE_SPACING * 0.985, baseH, TILE_SPACING * 0.985);
          const baseMats = [
            matCliffSE, matCliffSW, matCliffSE, matCliffSW, matCliffSE, matCliffSW,
          ];
          const baseMesh = new THREE.Mesh(baseGeo, baseMats);
          baseMesh.position.set(cx, baseH / 2, cz);
          baseMesh.castShadow = true;
          baseMesh.receiveShadow = true;
          baseMesh.name = `Terrain_${cell.kind}_${gx}_${gy}`;
          this.group.add(baseMesh);

          // 2. Clean lush grass turf cap (exact TILE_SPACING so adjacent same-height tiles merge seamlessly)
          const capMat = this.materials.get(cell.kind)!;
          const capGeo = new THREE.BoxGeometry(TILE_SPACING, capH, TILE_SPACING);
          const capMesh = new THREE.Mesh(capGeo, capMat);
          capMesh.position.set(cx, H - capH / 2, cz);
          capMesh.castShadow = false;
          capMesh.receiveShadow = true;
          this.group.add(capMesh);
          continue;
        }

        // Voxel Box (non-grass tiles)
        const geo = new THREE.BoxGeometry(TILE_SPACING, H, TILE_SPACING);

        const topMat =
          cell.kind === 'stream' || cell.kind === 'waterfall'
            ? this.materials.get('stream_bed')!
            : this.materials.get(cell.kind) || this.materials.get('grass')!;

        // BoxGeometry materials: [+X, -X (SW cliff), +Y (Top), -Y, +Z (SE cliff), -Z]
        const mats = [
          matCliffSE, // +X
          matCliffSW, // -X (SW cliff)
          topMat,     // +Y (Top surface)
          matCliffSW, // -Y
          matCliffSE, // +Z (SE cliff)
          matCliffSW, // -Z
        ];

        const mesh = new THREE.Mesh(geo, mats);
        mesh.position.set(cx, H / 2, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `Terrain_${cell.kind}_${gx}_${gy}`;
        this.group.add(mesh);
      }
    }
  }

  private createStaircase(
    gx: number,
    gy: number,
    elev: number,
    kind: 'stairs_sw' | 'stairs_se'
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `Stairs_${kind}_${gx}_${gy}`;
    const stepDelta = 8;
    const isSW = kind === 'stairs_sw';

    const treadMat = this.materials.get('plank')!;
    const riserMat = this.materials.get('stair_riser')!;

    for (let step = 0; step < 3; step++) {
      const stepElev = elev - (step / 3) * stepDelta;
      const stepH = stepElev * ELEV_UNIT;

      const width = isSW ? TILE_SPACING / 3 : TILE_SPACING;
      const depth = isSW ? TILE_SPACING : TILE_SPACING / 3;

      const geo = new THREE.BoxGeometry(width, stepH, depth);
      const mats = [riserMat, riserMat, treadMat, riserMat, riserMat, riserMat];
      const mesh = new THREE.Mesh(geo, mats);

      const xOffset = isSW
        ? -(gy + (step + 0.5) / 3) * TILE_SPACING
        : -(gy + 0.5) * TILE_SPACING;
      const zOffset = isSW
        ? (gx + 0.5) * TILE_SPACING
        : (gx + (step + 0.5) / 3) * TILE_SPACING;

      mesh.position.set(xOffset, stepH / 2, zOffset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }

  // ---------------------------------------------------------------------------
  // 5. BEDROCK KEEL (INVERTED FLOATING ISLAND CRAGGY ROCK UNDERSIDE)
  // ---------------------------------------------------------------------------
  private buildGrassTufts(): void {
    const grassCells: TerrainCell[] = [];
    for (let gx = 0; gx < 12; gx++) {
      for (let gy = 0; gy < 12; gy++) {
        const cell = this.grid[gx][gy];
        if (cell && (cell.kind === 'grass' || cell.kind === 'grassAlt')) {
          grassCells.push(cell);
        }
      }
    }
    if (grassCells.length === 0) return;

    // Lightweight, clean grass tufts (5 per tile) matching stylized reference
    const tuftsPerTile = 5;
    const total = grassCells.length * tuftsPerTile;

    // Low, soft 3-blade grass tuft
    const blades = [
      { angle: 0.2, tilt: 0.42, h: 4.4, w: 2.5 },
      { angle: 2.3, tilt: 0.48, h: 3.8, w: 2.3 },
      { angle: 4.4, tilt: 0.45, h: 4.0, w: 2.4 },
    ];
    const positions: number[] = [];
    for (const b of blades) {
      const dx = Math.cos(b.angle);
      const dz = Math.sin(b.angle);
      const px = -dz * b.w * 0.5;
      const pz = dx * b.w * 0.5;
      const tipX = dx * b.h * Math.sin(b.tilt);
      const tipY = b.h * Math.cos(b.tilt);
      const tipZ = dz * b.h * Math.sin(b.tilt);
      positions.push(-px, 0, -pz, px, 0, pz, tipX, tipY, tipZ);
    }
    const tuftGeo = new THREE.BufferGeometry();
    tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    tuftGeo.computeVertexNormals();

    const tuftMat = this.materials.get('grass_tuft')!;
    const inst = new THREE.InstancedMesh(tuftGeo, tuftMat, total);
    inst.name = 'GrassTufts';
    inst.castShadow = false;
    inst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let idx = 0;

    // Tiny wildflower flecks (~1 per grass tile)
    const flowerGeo = new THREE.DodecahedronGeometry(1.3, 0);
    const flowerMat = this.materials.get('wildflower_fleck')!;
    const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, grassCells.length);
    flowerInst.name = 'GrassWildflowers';
    let fIdx = 0;
    const flowerColors = [0xfff5d6, 0xffd666, 0xf7b8cc, 0xe8f0a8];

    // Exposed cliff-edge hanging turf overhang tabs (draping over brown soil walls)
    const overhangPositions: Array<{ x: number; y: number; z: number; rotY: number; sx: number; sy: number }> = [];
    for (const cell of grassCells) {
      const H = cell.elev * ELEV_UNIT;
      const cx = -(cell.gy + 0.5) * TILE_SPACING;
      const cz = (cell.gx + 0.5) * TILE_SPACING;
      const swNeighbor = this.getCell(cell.gx, cell.gy + 1);
      const seNeighbor = this.getCell(cell.gx + 1, cell.gy);

      // Exposed SW face (-X)
      if (!swNeighbor || swNeighbor.kind === 'void' || swNeighbor.elev < cell.elev) {
        for (let k = 0; k < 3; k++) {
          const off = (k - 1) * (TILE_SPACING * 0.28);
          overhangPositions.push({
            x: cx - TILE_SPACING * 0.502,
            y: H - 4.8,
            z: cz + off,
            rotY: Math.PI / 2,
            sx: 1.0 + (k % 2) * 0.35,
            sy: 1.0 + ((cell.gx + k) % 2) * 0.45,
          });
        }
      }
      // Exposed SE face (+Z)
      if (!seNeighbor || seNeighbor.kind === 'void' || seNeighbor.elev < cell.elev) {
        for (let k = 0; k < 3; k++) {
          const off = (k - 1) * (TILE_SPACING * 0.28);
          overhangPositions.push({
            x: cx + off,
            y: H - 4.8,
            z: cz + TILE_SPACING * 0.502,
            rotY: 0,
            sx: 1.0 + (k % 2) * 0.35,
            sy: 1.0 + ((cell.gy + k) % 2) * 0.45,
          });
        }
      }
    }

    for (const cell of grassCells) {
      for (let t = 0; t < tuftsPerTile; t++) {
        const h1 = Math.sin(cell.gx * 127.1 + cell.gy * 311.7 + t * 74.7) * 43758.5453;
        const h2 = Math.sin(cell.gx * 269.5 + cell.gy * 183.3 + t * 19.3) * 43758.5453;
        const rx = h1 - Math.floor(h1);
        const ry = h2 - Math.floor(h2);

        const pos = gridToWorld3D(
          cell.gx + 0.5 + (rx - 0.5) * 0.68,
          cell.gy + 0.5 + (ry - 0.5) * 0.68,
          cell.elev
        );
        dummy.position.copy(pos);
        dummy.rotation.set(0, rx * Math.PI * 2, 0);
        const s = 0.85 + (rx + ry) * 0.25;
        dummy.scale.set(s, s * (0.8 + ry * 0.3), s);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);

        // Soft, harmonious olive-lime matching the turf cap
        color.setHSL(0.20 + (rx - 0.5) * 0.02, 0.46, 0.58 + (ry - 0.5) * 0.06);
        inst.setColorAt(idx, color);
        idx++;
      }

      const fh1 = Math.sin(cell.gx * 91.7 + cell.gy * 213.1) * 43758.5453;
      const fh2 = Math.sin(cell.gx * 173.9 + cell.gy * 41.7) * 43758.5453;
      const frx = fh1 - Math.floor(fh1);
      const fry = fh2 - Math.floor(fh2);

      const fPos = gridToWorld3D(
        cell.gx + 0.5 + (frx - 0.5) * 0.6,
        cell.gy + 0.5 + (fry - 0.5) * 0.6,
        cell.elev + 0.5
      );
      dummy.position.copy(fPos);
      dummy.rotation.set(0, frx * Math.PI, 0);
      const fs = 0.8 + fry * 0.4;
      dummy.scale.set(fs, fs * 0.5, fs);
      dummy.updateMatrix();
      flowerInst.setMatrixAt(fIdx, dummy.matrix);

      color.setHex(flowerColors[(cell.gx + cell.gy) % flowerColors.length]);
      flowerInst.setColorAt(fIdx, color);
      fIdx++;
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.group.add(inst);

    flowerInst.instanceMatrix.needsUpdate = true;
    if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
    this.group.add(flowerInst);

    if (overhangPositions.length > 0) {
      // Inverted triangle hanging down from turf cap
      const tabGeo = new THREE.BufferGeometry();
      tabGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([-6.5, 0.5, 0, 6.5, 0.5, 0, 0, -5.5, 0], 3)
      );
      tabGeo.computeVertexNormals();
      const tabInst = new THREE.InstancedMesh(tabGeo, tuftMat, overhangPositions.length);
      tabInst.name = 'GrassEdgeOverhangs';
      tabInst.receiveShadow = true;
      overhangPositions.forEach((oh, i) => {
        dummy.position.set(oh.x, oh.y, oh.z);
        dummy.rotation.set(0, oh.rotY, 0);
        dummy.scale.set(oh.sx, oh.sy, 1);
        dummy.updateMatrix();
        tabInst.setMatrixAt(i, dummy.matrix);
        color.setHSL(0.20, 0.48, 0.54);
        tabInst.setColorAt(i, color);
      });
      tabInst.instanceMatrix.needsUpdate = true;
      if (tabInst.instanceColor) tabInst.instanceColor.needsUpdate = true;
      this.group.add(tabInst);
    }
  }

  private buildBedrockKeel(): void {
    const S = TILE_SPACING;
    const cx = -5.5 * S;
    const cz = 5.5 * S;

    // Collect all active cells' outer corners to form a clean angular perimeter ring
    const ringCount = 18;
    const outerRing: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      // Ray-march outward from center to find the farthest active tile in this direction
      let maxDist = 3.2 * S;
      for (let gx = 0; gx < 12; gx++) {
        for (let gy = 0; gy < 12; gy++) {
          const cell = this.grid[gx]?.[gy];
          if (!cell || cell.kind === 'void') continue;
          const tx = -(gy + 0.5) * S - cx;
          const tz = (gx + 0.5) * S - cz;
          const proj = tx * dx + tz * dz;
          const perp = Math.abs(tx * -dz + tz * dx);
          if (proj > 0 && perp < S * 1.15) {
            maxDist = Math.max(maxDist, proj + S * 0.42);
          }
        }
      }
      outerRing.push({ x: cx + dx * maxDist, z: cz + dz * maxDist });
    }

    // Multi-tiered craggy floating-island rings tapering down to a rocky spire
    const tiers = [
      { y: 2.0,   scale: 0.96, jitter: 0.0 },
      { y: -34.0, scale: 0.78, jitter: 16.0 },
      { y: -82.0, scale: 0.48, jitter: 18.0 },
      { y: -130.0, scale: 0.22, jitter: 10.0 },
    ];

    const ringVerts: THREE.Vector3[][] = tiers.map((t, ti) =>
      outerRing.map((pt, i) => {
        const h = Math.sin(i * 43.7 + ti * 19.3) * 43758.5453;
        const rJitter = ((h - Math.floor(h)) - 0.5) * t.jitter;
        const dx = pt.x - cx;
        const dz = pt.z - cz;
        const len = Math.hypot(dx, dz) || 1;
        return new THREE.Vector3(
          cx + dx * t.scale + (dx / len) * rJitter,
          t.y,
          cz + dz * t.scale + (dz / len) * rJitter
        );
      })
    );

    const positions: number[] = [];
    const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    };

    // Connect rings into faceted craggy rock walls
    for (let t = 0; t < ringVerts.length - 1; t++) {
      const upper = ringVerts[t];
      const lower = ringVerts[t + 1];
      for (let i = 0; i < ringCount; i++) {
        const next = (i + 1) % ringCount;
        pushTri(upper[i], lower[i], upper[next]);
        pushTri(upper[next], lower[i], lower[next]);
      }
    }

    // Close bottom spire tip
    const apex = new THREE.Vector3(cx - 8, -168, cz + 6);
    const bottomRing = ringVerts[ringVerts.length - 1];
    for (let i = 0; i < ringCount; i++) {
      const next = (i + 1) % ringCount;
      pushTri(bottomRing[i], apex, bottomRing[next]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();

    const bedrockMat = this.materials.get('bedrock_keel')!;
    const keelMesh = new THREE.Mesh(geo, bedrockMat);
    keelMesh.name = 'BedrockKeel';
    keelMesh.receiveShadow = true;
    this.group.add(keelMesh);

    // Protruding faceted rock plates & floating shards around the underbelly
    const boulderGeo = new THREE.DodecahedronGeometry(18, 0);
    const boulderInst = new THREE.InstancedMesh(boulderGeo, bedrockMat, 11);
    boulderInst.name = 'BedrockBoulders';
    boulderInst.receiveShadow = true;
    const dummy = new THREE.Object3D();

    // 8 chunky rock outcrops embedded in the sides (focusing on camera-facing SW/SE sides)
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor((i / 8) * ringCount);
      const pt = ringVerts[1][idx];
      dummy.position.set(pt.x, -36 - (i % 3) * 24, pt.z);
      dummy.rotation.set(i * 0.7, i * 1.1, i * 0.4);
      const s = 0.85 + (i % 3) * 0.35;
      dummy.scale.set(s * 1.1, s * 1.4, s * 0.9);
      dummy.updateMatrix();
      boulderInst.setMatrixAt(i, dummy.matrix);
    }

    // 3 tiny floating rock shards beneath the island tip
    const shards = [
      { x: cx - 45, y: -152, z: cz + 35, s: 0.45 },
      { x: cx + 30, y: -165, z: cz + 20, s: 0.35 },
      { x: cx - 10, y: -182, z: cz - 15, s: 0.30 },
    ];
    shards.forEach((sh, i) => {
      dummy.position.set(sh.x, sh.y, sh.z);
      dummy.rotation.set(i, i * 1.3, 0.5);
      dummy.scale.setScalar(sh.s);
      dummy.updateMatrix();
      boulderInst.setMatrixAt(8 + i, dummy.matrix);
    });

    boulderInst.instanceMatrix.needsUpdate = true;
    this.group.add(boulderInst);
  }

  // ---------------------------------------------------------------------------
  // 6. PUBLIC ACCESSORS & LIFECYCLE
  // ---------------------------------------------------------------------------
  public getElevation(gx: number, gy: number): number {
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    if (ix < 0 || ix >= 12 || iy < 0 || iy >= 12) return 0;
    const cell = this.grid[ix]?.[iy];
    if (cell && cell.kind !== 'void') {
      return cell.elev;
    }
    return 25;
  }

  public getCell(gx: number, gy: number): TerrainCell | null {
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    if (ix < 0 || ix >= 12 || iy < 0 || iy >= 12) return null;
    return this.grid[ix]?.[iy] ?? null;
  }

  public getGrid(): (TerrainCell | null)[][] {
    return this.grid;
  }

  public getMaterials(): Map<string, THREE.Material> {
    return this.materials;
  }

  public getTextures(): Map<string, THREE.CanvasTexture> {
    return this.textures;
  }

  public updatePalette(pal: Palette): void {
    const grassMat = this.materials.get('grass') as THREE.MeshLambertMaterial;
    if (grassMat) {
      grassMat.color.set(pal.grass);
    }

    const grassAltMat = this.materials.get('grassAlt') as THREE.MeshLambertMaterial;
    if (grassAltMat) {
      grassAltMat.color.set(pal.grassAlt);
    }

    const streamMat = this.materials.get('stream_bed') as THREE.MeshLambertMaterial;
    if (streamMat) {
      streamMat.color.set(pal.river);
    }

    const tuftMat = this.materials.get('grass_tuft') as THREE.MeshLambertMaterial;
    if (tuftMat) {
      tuftMat.color.set(pal.grass);
    }
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
      }
    });

    this.textures.forEach((tex) => tex.dispose());
    this.materials.forEach((mat) => mat.dispose());

    this.textures.clear();
    this.materials.clear();
    this.group.clear();
  }
}
