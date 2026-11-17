import * as THREE from 'three';
import type { TimeOfDay } from '../../types';
import type { InteriorPropId } from '../../lib/lore';
import { TILE_SPACING, ELEV_UNIT } from './TerrainBuilder';

export class CottageInteriorBuilder {
  public readonly group: THREE.Group;
  private roomPivot: THREE.Group;

  private geometries: Set<THREE.BufferGeometry> = new Set();
  private materials: Set<THREE.Material> = new Set();
  private raycaster = new THREE.Raycaster();

  private roomScale = TILE_SPACING * 0.78;
  private roomCenter = new THREE.Vector3(-5.5 * TILE_SPACING, 26 * ELEV_UNIT, 5.5 * TILE_SPACING);

  private propGroups: Record<InteriorPropId, THREE.Group>;
  private propBaseY: Record<InteriorPropId, number> = {
    inkstone: 1.08,
    drafts: 1.08,
    mug: 1.08,
    window: 2.25,
    door: 0.1,
  };
  private propHoverBlend: Record<InteriorPropId, number> = {
    inkstone: 0,
    drafts: 0,
    mug: 0,
    window: 0,
    door: 0,
  };
  private propOutlineMats: Record<InteriorPropId, THREE.MeshBasicMaterial | null> = {
    inkstone: null,
    drafts: null,
    mug: null,
    window: null,
    door: null,
  };
  private propOutlines: Record<InteriorPropId, THREE.Mesh[]> = {
    inkstone: [],
    drafts: [],
    mug: [],
    window: null as unknown as THREE.Mesh[],
    door: [],
  };
  private hoveredProp: InteriorPropId | null = null;
  private pulseTimers: Record<InteriorPropId, number> = {
    inkstone: 0,
    drafts: 0,
    mug: 0,
    window: 0,
    door: 0,
  };

  private inkstoneCoreMat!: THREE.MeshStandardMaterial;
  private inkPlumeMat!: THREE.ShaderMaterial;
  private inkFloatingShards: {
    mesh: THREE.Mesh;
    basePos: THREE.Vector3;
    amp: number;
    speed: number;
    phase: number;
    rotSpeed: THREE.Vector3;
  }[] = [];
  private inkstoneLight!: THREE.PointLight;
  private hearthLight!: THREE.PointLight;
  private hearthFlames: THREE.Mesh[] = [];
  private windowPaneMat!: THREE.MeshBasicMaterial;
  private steamPuffs: THREE.Mesh[] = [];
  private inkMotes: THREE.Mesh[] = [];

  constructor(initialTimeOfDay: TimeOfDay = 'morning') {
    this.propOutlines.window = [];
    this.group = new THREE.Group();
    this.group.name = 'CottageInteriorRoot';
    this.group.visible = false;

    this.roomPivot = new THREE.Group();
    this.roomPivot.name = 'CottageInteriorPivot';
    this.roomPivot.position.copy(this.roomCenter);
    this.roomPivot.scale.setScalar(this.roomScale);
    this.group.add(this.roomPivot);

    this.propGroups = {
      inkstone: new THREE.Group(),
      drafts: new THREE.Group(),
      mug: new THREE.Group(),
      window: new THREE.Group(),
      door: new THREE.Group(),
    };

    this.buildRoom(initialTimeOfDay);
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.add(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.add(m);
    return m;
  }

  private box(
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = this.roomPivot,
    ry = 0
  ): THREE.Mesh {
    const mat = this.trackMat(new THREE.MeshLambertMaterial({ color }));
    const mesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private buildRoom(initialTimeOfDay: TimeOfDay): void {
    const FLOOR_BASE = 0x875636;
    const FLOOR_PLANK = 0x9b6642;
    const FLOOR_STAIN = 0x4f4452; // subtle Astral Inkstone residue near the desk
    const WALL_CREAM = 0xf4ead8;
    const WAINSCOT = 0xc99666;
    const TIMBER = 0x6b3e24;
    const TIMBER_LIGHT = 0x9c6239;
    const DESK_WOOD = 0x995f38;
    const STONE_DARK = 0x645f5c;
    const STONE_LIGHT = 0x857f7a;

    // 1. Diorama Base & Planked Timber Floor
    this.box(8.2, 0.44, 8.2, 0x523421, 0, -0.22, 0);
    for (let i = -3.4; i <= 3.4; i += 0.85) {
      const isStained = Math.abs(i + 0.85) < 0.45;
      this.box(
        7.8,
        0.12,
        0.78,
        isStained ? FLOOR_STAIN : Math.round(i * 10) % 2 === 0 ? FLOOR_PLANK : FLOOR_BASE,
        0,
        0.06,
        i
      );
    }

    // Cozy layered woven rug in the center
    this.box(3.8, 0.04, 3.1, 0xb86f6a, -0.2, 0.14, 0.65);
    this.box(3.3, 0.05, 2.6, 0xdfd0b8, -0.2, 0.15, 0.65);
    this.box(2.5, 0.055, 1.8, 0xc7897e, -0.2, 0.155, 0.65);

    // 2. Cutaway Back Walls (Camera looks from -X, +Z toward +X, -Z)
    // Back-Left Wall (z = -3.85)
    this.box(7.9, 3.6, 0.24, WALL_CREAM, 0, 1.85, -3.85);
    this.box(7.9, 0.95, 0.27, WAINSCOT, 0, 0.52, -3.82);

    // Back-Right Wall (x = +3.85)
    this.box(0.24, 3.6, 7.9, WALL_CREAM, 3.85, 1.85, 0);
    this.box(0.27, 0.95, 7.9, WAINSCOT, 3.82, 0.52, 0);

    // Timber framing posts & top beams
    for (const x of [-3.75, -0.1, 3.75]) {
      this.box(0.26, 3.75, 0.3, TIMBER, x, 1.9, -3.8);
    }
    for (const z of [-3.75, 0.1, 3.75]) {
      this.box(0.3, 3.75, 0.26, TIMBER, 3.8, 1.9, z);
    }
    this.box(8.1, 0.24, 0.34, TIMBER, 0, 3.72, -3.8);
    this.box(0.34, 0.24, 8.1, TIMBER, 3.8, 3.72, 0);

    // Pitched A-frame roof eaves hint along the back-right gable
    const gablePts: Array<[number, number]> = [
      [6.2, 4.15],
      [4.4, 4.95],
      [2.4, 5.65],
    ];
    for (const [w, y] of gablePts) {
      this.box(0.24, 0.72, w, WALL_CREAM, 3.85, y, 0);
    }
    this.box(0.32, 0.22, 4.8, TIMBER, 3.8, 4.85, -1.6).rotation.x = 0.56;
    this.box(0.32, 0.22, 4.8, TIMBER, 3.8, 4.85, 1.6).rotation.x = -0.56;

    // 3. Stone Hearth & Glowing Fireplace (on back-left wall, x = -1.9, z = -3.3)
    const cx = -1.9;
    const STONE_MID = 0x756f6a;

    // Stepped hearthstone base & front slab
    this.box(1.96, 0.08, 1.15, STONE_DARK, cx, 0.16, -3.15);
    this.box(1.68, 0.1, 0.56, STONE_LIGHT, cx, 0.21, -2.78);

    // Recessed firebox cavity (open front so logs, embers, and flames are clearly visible)
    this.box(1.16, 1.16, 0.22, 0x221a16, cx, 0.78, -3.62); // Firebox back wall
    this.box(0.96, 0.06, 0.54, 0x2a211c, cx, 0.23, -3.24); // Ash bed floor
    this.box(0.5, 1.32, 0.8, STONE_DARK, cx - 0.67, 0.86, -3.33); // Left stone jamb
    this.box(0.5, 1.32, 0.8, STONE_DARK, cx + 0.67, 0.86, -3.33); // Right stone jamb
    this.box(1.84, 0.34, 0.8, STONE_DARK, cx, 1.35, -3.33); // Stone lintel
    this.box(0.3, 0.36, 0.08, STONE_LIGHT, cx, 1.36, -2.92); // Keystone accent

    // Masonry quoin / relief stones on the jambs
    this.box(0.26, 0.24, 0.82, STONE_MID, cx - 0.81, 0.42, -3.33);
    this.box(0.24, 0.26, 0.82, STONE_LIGHT, cx - 0.81, 0.96, -3.33);
    this.box(0.26, 0.24, 0.82, STONE_LIGHT, cx + 0.81, 0.68, -3.33);
    this.box(0.24, 0.26, 0.82, STONE_MID, cx + 0.81, 1.18, -3.33);

    // Timber & stone mantelpiece with corbel brackets
    this.box(1.94, 0.08, 0.88, STONE_LIGHT, cx, 1.56, -3.3);
    this.box(2.08, 0.16, 0.96, TIMBER, cx, 1.68, -3.26);
    this.box(0.18, 0.22, 0.18, TIMBER, cx - 0.72, 1.46, -2.86);
    this.box(0.18, 0.22, 0.18, TIMBER, cx + 0.72, 1.46, -2.86);

    // Stepped, tapered chimney breast rising cleanly to the ceiling beam
    this.box(1.64, 0.82, 0.6, STONE_DARK, cx, 2.17, -3.43); // Lower hood
    this.box(1.74, 0.1, 0.66, STONE_LIGHT, cx, 2.58, -3.43); // Hood shoulder trim
    this.box(1.22, 1.06, 0.48, STONE_DARK, cx, 3.16, -3.49); // Upper flue shaft
    this.box(1.36, 0.14, 0.56, STONE_LIGHT, cx, 3.66, -3.49); // Crown collar

    // Subtle relief stone blocks on the chimney breast
    this.box(0.36, 0.22, 0.05, STONE_MID, cx - 0.52, 2.05, -3.12);
    this.box(0.32, 0.2, 0.05, STONE_LIGHT, cx + 0.46, 2.28, -3.12);
    this.box(0.3, 0.22, 0.05, STONE_MID, cx - 0.28, 3.05, -3.24);
    this.box(0.28, 0.2, 0.05, STONE_LIGHT, cx + 0.3, 3.32, -3.24);

    // Glowing ember bed & stacked firewood logs inside the open firebox
    const emberBed = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.68, 0.06, 0.3)),
      this.trackMat(new THREE.MeshBasicMaterial({ color: 0xe84a18 }))
    );
    emberBed.position.set(cx, 0.28, -3.22);
    this.roomPivot.add(emberBed);

    this.box(0.72, 0.14, 0.16, 0x5c341d, cx, 0.35, -3.23, this.roomPivot, 0.22);
    this.box(0.68, 0.14, 0.16, 0x6b3e24, cx, 0.38, -3.2, this.roomPivot, -0.28);
    this.box(0.54, 0.12, 0.14, 0x4f2b16, cx, 0.45, -3.22, this.roomPivot, 0.06);

    // Animated hearth flames
    const flameColors = [0xff621f, 0xffa624, 0xffe875];
    const flameSizes: Array<[number, number, number, number]> = [
      [0.36, 0.48, 0.22, cx],
      [0.24, 0.38, 0.18, cx - 0.18],
      [0.22, 0.36, 0.16, cx + 0.18],
    ];
    flameSizes.forEach(([w, h, d, fx], i) => {
      const fm = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(w, h, d)),
        this.trackMat(new THREE.MeshBasicMaterial({ color: flameColors[i] }))
      );
      fm.position.set(fx, 0.58, -3.18);
      this.roomPivot.add(fm);
      this.hearthFlames.push(fm);
    });

    // Mantelpiece decor sitting cleanly on the shelf in front of the stepped-back hood
    this.box(0.18, 0.04, 0.18, 0xd4a43b, cx - 0.62, 1.78, -2.94); // Brass candle holder
    this.box(0.1, 0.24, 0.1, 0xfbf4e4, cx - 0.62, 1.92, -2.94); // Wax candle
    const candleFlame = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.045, 0.08, 0.045)),
      this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffd25a }))
    );
    candleFlame.position.set(cx - 0.62, 2.08, -2.94);
    this.roomPivot.add(candleFlame);

    this.box(0.14, 0.2, 0.14, 0x6b8e9b, cx - 0.3, 1.86, -2.96); // Ceramic pot
    this.box(0.48, 0.36, 0.05, TIMBER_LIGHT, cx + 0.38, 1.94, -3.07); // Framed picture
    this.box(0.38, 0.26, 0.06, 0xdbe6d5, cx + 0.38, 1.94, -3.065); // Picture art

    this.hearthLight = new THREE.PointLight(0xff9c48, 220, 420, 1.1);
    this.hearthLight.position.set(cx, 0.95, -2.45);
    this.roomPivot.add(this.hearthLight);

    // 4. Open-Front Bookshelf (against back-right wall, x = 3.25, z = -2.0, facing -X)
    const shelfX = 3.22;
    const shelfZ = -2.0;
    this.box(0.14, 2.55, 1.9, TIMBER, shelfX + 0.35, 1.32, shelfZ); // Backboard
    this.box(0.75, 2.55, 0.14, TIMBER_LIGHT, shelfX, 1.32, shelfZ - 0.92); // Left side
    this.box(0.75, 2.55, 0.14, TIMBER_LIGHT, shelfX, 1.32, shelfZ + 0.92); // Right side
    for (const sy of [0.22, 0.92, 1.62, 2.38]) {
      this.box(0.76, 0.1, 1.9, TIMBER_LIGHT, shelfX, sy, shelfZ);
    }
    // Books & paper stacks on open shelves
    const bookColors = [0xb84a39, 0x3f6fb0, 0x6b8e4e, 0xd99b38, 0x8a5a7a];
    for (let i = 0; i < 5; i++) {
      this.box(0.42, 0.44, 0.18, bookColors[i], shelfX - 0.05, 1.2, shelfZ - 0.62 + i * 0.22);
    }
    this.box(0.48, 0.24, 0.52, 0xf6eedf, shelfX - 0.05, 1.8, shelfZ + 0.3);
    this.box(0.44, 0.2, 0.46, 0xf8e6e4, shelfX - 0.05, 2.02, shelfZ + 0.28, this.roomPivot, 0.15);
    this.box(0.45, 0.32, 0.48, 0xe8eff5, shelfX - 0.05, 0.44, shelfZ - 0.35);

    // 5. Writer's Oak Desk & Chair (facing -Z/+X area at x = 0.85, z = -1.9)
    const deskX = 0.85;
    const deskZ = -1.95;
    this.box(2.9, 0.15, 1.45, DESK_WOOD, deskX, 1.0, deskZ);
    // Desk legs
    for (const lx of [-1.25, 1.25]) {
      for (const lz of [-0.58, 0.58]) {
        this.box(0.16, 0.92, 0.16, TIMBER, deskX + lx, 0.48, deskZ + lz);
      }
    }
    // Desk apron & drawer front facing +Z
    this.box(2.5, 0.32, 0.1, TIMBER_LIGHT, deskX, 0.78, deskZ + 0.56);
    this.box(0.18, 0.08, 0.08, 0xf2c94c, deskX, 0.78, deskZ + 0.64); // Brass drawer pull

    // Warm desk lamp on right corner of desk
    this.box(0.24, 0.08, 0.24, TIMBER, deskX + 1.1, 1.12, deskZ - 0.38);
    this.box(0.08, 0.36, 0.08, TIMBER, deskX + 1.1, 1.32, deskZ - 0.38);
    const shadeMat = this.trackMat(
      new THREE.MeshBasicMaterial({ color: 0xffe49e })
    );
    const shade = new THREE.Mesh(this.trackGeo(new THREE.ConeGeometry(0.26, 0.24, 6)), shadeMat);
    shade.position.set(deskX + 1.1, 1.56, deskZ - 0.38);
    this.roomPivot.add(shade);

    const deskLampLight = new THREE.PointLight(0xffcf70, 160, 320, 1.1);
    deskLampLight.position.set(deskX + 1.0, 1.65, deskZ - 0.2);
    this.roomPivot.add(deskLampLight);

    // Wooden chair in front of desk (+Z)
    this.box(0.86, 0.12, 0.86, TIMBER_LIGHT, deskX - 0.15, 0.56, deskZ + 1.25, this.roomPivot, 0.18);
    this.box(0.72, 0.08, 0.72, 0xc97b74, deskX - 0.15, 0.65, deskZ + 1.25, this.roomPivot, 0.18); // Cushion
    this.box(0.86, 0.78, 0.12, TIMBER, deskX - 0.22, 0.96, deskZ + 1.62, this.roomPivot, 0.18);
    for (const cx of [-0.34, 0.34]) {
      for (const cz of [-0.34, 0.34]) {
        this.box(0.1, 0.5, 0.1, TIMBER, deskX - 0.15 + cx, 0.26, deskZ + 1.25 + cz);
      }
    }

    // =========================================================================
    // INTERACTIVE INTERIOR PROPS
    // =========================================================================

    // Prop 1: Broken Astral Inkstone (shattered circular stone basin with glowing core & levitating shards)
    const inkGroup = this.propGroups.inkstone;
    inkGroup.name = 'Interior_inkstone';
    inkGroup.position.set(deskX - 0.18, 1.08, deskZ - 0.12);
    this.roomPivot.add(inkGroup);

    const stoneAssembly = new THREE.Group();
    stoneAssembly.rotation.y = -0.32;
    inkGroup.add(stoneAssembly);

    const stoneDarkMat = this.trackMat(
      new THREE.MeshLambertMaterial({ color: 0x3b3e52, flatShading: true })
    );
    const stoneMidMat = this.trackMat(
      new THREE.MeshLambertMaterial({ color: 0x4b4f66, flatShading: true })
    );
    const stoneRimMat = this.trackMat(
      new THREE.MeshLambertMaterial({ color: 0x595e78, flatShading: true })
    );
    const goldMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd9a84e,
        roughness: 0.36,
        metalness: 0.45,
        flatShading: true,
      })
    );
    const mossDarkMat = this.trackMat(
      new THREE.MeshLambertMaterial({ color: 0x4f7d36, flatShading: true })
    );
    const mossBrightMat = this.trackMat(
      new THREE.MeshLambertMaterial({ color: 0x6ea344, flatShading: true })
    );

    const buildArcGeo = (
      outerR: number,
      innerR: number,
      height: number,
      startAng: number,
      endAng: number,
      segments: number
    ): THREE.ExtrudeGeometry => {
      const shape = new THREE.Shape();
      for (let i = 0; i <= segments; i++) {
        const a = startAng + (endAng - startAng) * (i / segments);
        const x = Math.cos(a) * outerR;
        const y = Math.sin(a) * outerR;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      for (let i = segments; i >= 0; i--) {
        const a = startAng + (endAng - startAng) * (i / segments);
        const x = Math.cos(a) * innerR;
        const y = Math.sin(a) * innerR;
        shape.lineTo(x, y);
      }
      shape.closePath();
      const geo = this.trackGeo(
        new THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: true,
          bevelThickness: 0.008,
          bevelSize: 0.008,
          bevelSegments: 1,
        })
      );
      geo.rotateX(-Math.PI / 2);
      return geo;
    };

    // 1. Split circular stone plinth base (left & right halves separated by a central crack)
    const leftHalf = new THREE.Group();
    leftHalf.position.set(-0.045, 0, 0.012);
    leftHalf.rotation.y = 0.07;
    leftHalf.rotation.z = 0.05;
    stoneAssembly.add(leftHalf);

    const rightHalf = new THREE.Group();
    rightHalf.position.set(0.05, 0, -0.01);
    rightHalf.rotation.y = -0.06;
    rightHalf.rotation.z = -0.045;
    stoneAssembly.add(rightHalf);

    const leftPlinth = new THREE.Mesh(
      buildArcGeo(0.355, 0.04, 0.036, Math.PI * 0.54, Math.PI * 1.46, 6),
      stoneMidMat
    );
    leftPlinth.castShadow = true;
    leftPlinth.receiveShadow = true;
    leftHalf.add(leftPlinth);

    const rightPlinth = new THREE.Mesh(
      buildArcGeo(0.355, 0.04, 0.036, -Math.PI * 0.46, Math.PI * 0.46, 6),
      stoneMidMat
    );
    rightPlinth.castShadow = true;
    rightPlinth.receiveShadow = true;
    rightHalf.add(rightPlinth);

    // 2. Shattered carved stone basin walls (left & right curved halves)
    const leftWall = new THREE.Mesh(
      buildArcGeo(0.275, 0.17, 0.128, Math.PI * 0.62, Math.PI * 1.38, 6),
      stoneDarkMat
    );
    leftWall.position.y = 0.038;
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    leftHalf.add(leftWall);

    const leftRim = new THREE.Mesh(
      buildArcGeo(0.25, 0.175, 0.03, Math.PI * 0.66, Math.PI * 1.34, 6),
      stoneRimMat
    );
    leftRim.position.y = 0.165;
    leftRim.castShadow = true;
    leftHalf.add(leftRim);

    const rightWall = new THREE.Mesh(
      buildArcGeo(0.275, 0.17, 0.128, -Math.PI * 0.38, Math.PI * 0.38, 6),
      stoneDarkMat
    );
    rightWall.position.y = 0.038;
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    rightHalf.add(rightWall);

    const rightRim = new THREE.Mesh(
      buildArcGeo(0.25, 0.175, 0.03, -Math.PI * 0.34, Math.PI * 0.34, 6),
      stoneRimMat
    );
    rightRim.position.y = 0.165;
    rightRim.castShadow = true;
    rightHalf.add(rightRim);

    // Remnant gold/brass trim clinging to the broken edge of the right half
    const goldRemnant = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.034, 0.115, 0.042)),
      goldMat
    );
    goldRemnant.position.set(0.095, 0.115, 0.215);
    goldRemnant.rotation.set(-0.18, 0.35, 0.12);
    goldRemnant.castShadow = true;
    rightHalf.add(goldRemnant);

    const goldClasp = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.044, 0.024, 0.056)),
      goldMat
    );
    goldClasp.position.set(0.088, 0.178, 0.195);
    goldClasp.rotation.y = 0.35;
    rightHalf.add(goldClasp);

    // 3. Jagged fractured stone chunks wedged along the inner break & rubble on the plinth
    const fractureChunks: [THREE.Group, number, number, number, number, number, number, number][] = [
      [leftHalf, -0.14, 0.085, 0.13, 0.065, 1.2, 0.9, 0.8],
      [leftHalf, -0.13, 0.09, -0.12, 0.058, 1.0, 1.1, 0.9],
      [leftHalf, -0.07, 0.055, 0.17, 0.045, 1.1, 0.7, 1.0],
      [rightHalf, 0.12, 0.08, 0.14, 0.062, 1.1, 0.95, 0.85],
      [rightHalf, 0.11, 0.085, -0.14, 0.055, 0.95, 1.05, 1.0],
      [rightHalf, 0.06, 0.05, -0.19, 0.04, 1.2, 0.65, 0.9],
    ];
    fractureChunks.forEach(([parent, cx, cy, cz, size, sx, sy, sz], idx) => {
      const chunk = new THREE.Mesh(
        this.trackGeo(new THREE.DodecahedronGeometry(size, 0)),
        idx % 2 === 0 ? stoneMidMat : stoneDarkMat
      );
      chunk.position.set(cx, cy, cz);
      chunk.scale.set(sx, sy, sz);
      chunk.rotation.set(idx * 0.7, idx * 1.1, idx * 0.4);
      chunk.castShadow = true;
      chunk.receiveShadow = true;
      parent.add(chunk);
    });

    // Small fallen stone rubble shards in the front fissure
    const rubble1 = new THREE.Mesh(
      this.trackGeo(new THREE.DodecahedronGeometry(0.036, 0)),
      stoneMidMat
    );
    rubble1.position.set(-0.01, 0.022, 0.25);
    rubble1.scale.set(1.2, 0.55, 0.9);
    rubble1.rotation.y = 0.5;
    stoneAssembly.add(rubble1);

    const rubble2 = new THREE.Mesh(
      this.trackGeo(new THREE.DodecahedronGeometry(0.026, 0)),
      stoneDarkMat
    );
    rubble2.position.set(0.03, 0.018, 0.29);
    rubble2.scale.set(1.0, 0.5, 1.15);
    rubble2.rotation.y = -0.7;
    stoneAssembly.add(rubble2);

    // Moss tufts & tiny green leaves along the outer plinth rim
    const mossSpots: [THREE.Group, number, number, number, number][] = [
      [leftHalf, -0.25, 0.045, 0.16, 0.052],
      [leftHalf, -0.29, 0.045, -0.08, 0.044],
      [leftHalf, -0.18, 0.044, -0.24, 0.048],
      [rightHalf, 0.26, 0.045, 0.15, 0.046],
      [rightHalf, 0.24, 0.044, -0.19, 0.05],
    ];
    mossSpots.forEach(([parent, mx, my, mz, ms], idx) => {
      const tuft = new THREE.Mesh(
        this.trackGeo(new THREE.DodecahedronGeometry(ms, 0)),
        idx % 2 === 0 ? mossDarkMat : mossBrightMat
      );
      tuft.position.set(mx, my, mz);
      tuft.scale.set(1.3, 0.5, 1.0);
      tuft.rotation.y = idx * 1.2;
      tuft.userData.skipOutline = true;
      parent.add(tuft);
    });

    // 4. Radiant Glowing Cyan-Blue Astral Core in the central fissure
    this.inkstoneCoreMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa6f7ff,
        emissive: 0x38c8ff,
        emissiveIntensity: 2.0,
        roughness: 0.2,
      })
    );
    const coreGlow = new THREE.Mesh(
      this.trackGeo(new THREE.DodecahedronGeometry(0.095, 0)),
      this.inkstoneCoreMat
    );
    coreGlow.position.set(0, 0.065, 0.01);
    coreGlow.scale.set(1.1, 0.65, 1.35);
    coreGlow.userData.skipOutline = true;
    stoneAssembly.add(coreGlow);

    // Vertical swirling/flickering astral energy plume rising from the cracked core
    this.inkPlumeMat = this.trackMat(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPulse: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uPulse;
          varying vec2 vUv;

          void main() {
            float x = abs(vUv.x - 0.5) * 2.0;
            float y = vUv.y;

            // Tapered flame/wisp silhouette
            float width = mix(0.85, 0.22, y);
            float radial = smoothstep(width, 0.0, x);
            float vert = smoothstep(0.0, 0.14, y) * smoothstep(1.0, 0.18, y);

            // Swirling upward energy waves
            float wave = sin(y * 12.0 - uTime * 3.8 + sin(vUv.x * 8.0 + uTime * 2.0)) * 0.5 + 0.5;
            float alpha = radial * vert * (0.55 + 0.45 * wave);

            vec3 outerCyan = vec3(0.18, 0.68, 1.0);
            vec3 coreWhite = vec3(0.78, 0.97, 1.0);
            vec3 col = mix(outerCyan, coreWhite, radial * (1.0 - y * 0.55));
            col *= 1.15 + uPulse * 0.45;

            gl_FragColor = vec4(col, alpha * 0.85);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );

    for (let i = 0; i < 2; i++) {
      const plume = new THREE.Mesh(
        this.trackGeo(new THREE.PlaneGeometry(0.24, 0.36)),
        this.inkPlumeMat
      );
      plume.position.set(0, 0.22, 0);
      plume.rotation.y = (i * Math.PI) / 2 + 0.35;
      plume.userData.skipOutline = true;
      stoneAssembly.add(plume);
    }

    // 5. Levitating Stone Shards hovering in the glowing updraft
    this.inkFloatingShards.length = 0;
    const shardConfigs: {
      pos: [number, number, number];
      size: number;
      scale: [number, number, number];
      amp: number;
      speed: number;
      phase: number;
    }[] = [
      { pos: [-0.08, 0.34, 0.04], size: 0.048, scale: [1.2, 0.7, 0.95], amp: 0.018, speed: 1.5, phase: 0.0 },
      { pos: [0.01, 0.26, -0.02], size: 0.042, scale: [0.95, 1.15, 0.85], amp: 0.022, speed: 1.8, phase: 1.7 },
      { pos: [0.06, 0.42, -0.04], size: 0.026, scale: [1.0, 1.25, 0.9], amp: 0.025, speed: 2.1, phase: 3.1 },
      { pos: [-0.03, 0.19, 0.08], size: 0.034, scale: [1.1, 0.85, 1.0], amp: 0.014, speed: 1.4, phase: 4.5 },
    ];
    shardConfigs.forEach((cfg, idx) => {
      const shard = new THREE.Mesh(
        this.trackGeo(new THREE.DodecahedronGeometry(cfg.size, 0)),
        idx % 2 === 0 ? stoneMidMat : stoneRimMat
      );
      shard.position.set(...cfg.pos);
      shard.scale.set(...cfg.scale);
      shard.rotation.set(idx * 0.9, idx * 1.4, idx * 0.5);
      shard.castShadow = true;
      stoneAssembly.add(shard);
      this.inkFloatingShards.push({
        mesh: shard,
        basePos: new THREE.Vector3(...cfg.pos),
        amp: cfg.amp,
        speed: cfg.speed,
        phase: cfg.phase,
        rotSpeed: new THREE.Vector3(0.25 + idx * 0.08, 0.35 + idx * 0.1, 0.18),
      });
    });

    // 6. Rising astral motes & sparkles around the levitating shards
    for (let i = 0; i < 5; i++) {
      const mote = new THREE.Mesh(
        this.trackGeo(new THREE.OctahedronGeometry(0.016, 0)),
        this.trackMat(
          new THREE.MeshBasicMaterial({ color: 0xa8f6ff, transparent: true, opacity: 0.8 })
        )
      );
      inkGroup.add(mote);
      this.inkMotes.push(mote);
    }

    // 7. Carved brush rest + wooden calligraphy brush beside the broken stone
    this.box(0.1, 0.038, 0.06, 0x5c3620, 0.44, 0.019, 0.04, inkGroup);
    const brushGroup = new THREE.Group();
    brushGroup.position.set(0.45, 0.055, 0.08);
    brushGroup.rotation.y = 0.28;
    inkGroup.add(brushGroup);
    this.box(0.036, 0.036, 0.34, 0x3b2218, 0, 0, -0.04, brushGroup); // Wood handle
    this.box(0.042, 0.042, 0.045, 0xe8be54, 0, 0, 0.145, brushGroup); // Brass ferrule
    this.box(0.024, 0.022, 0.055, 0xf2ede0, 0, -0.004, 0.195, brushGroup); // White bristles
    this.box(0.016, 0.016, 0.028, 0x4ad2ff, 0, -0.005, 0.232, brushGroup); // Ink-dipped tip

    this.inkstoneLight = new THREE.PointLight(0x6ad8ff, 95, 160, 1.2);
    this.inkstoneLight.position.set(0, 0.42, 0);
    inkGroup.add(this.inkstoneLight);

    // Prop 2: Scattered Folded Drafts (on desk right)
    const draftsGroup = this.propGroups.drafts;
    draftsGroup.name = 'Interior_drafts';
    draftsGroup.position.set(deskX + 0.68, 1.08, deskZ + 0.22);
    this.roomPivot.add(draftsGroup);

    this.box(0.44, 0.03, 0.34, 0xfbf4e4, 0, 0.02, 0, draftsGroup, 0.22);
    this.box(0.38, 0.03, 0.28, 0xf8e6e4, 0.12, 0.05, -0.14, draftsGroup, -0.35);
    this.box(0.34, 0.08, 0.18, 0xfffcf5, -0.1, 0.09, 0.16, draftsGroup, 0.65);

    // Prop 3: Warm Ceramic Mug (on desk left)
    const mugGroup = this.propGroups.mug;
    mugGroup.name = 'Interior_mug';
    mugGroup.position.set(deskX - 0.96, 1.08, deskZ + 0.22);
    this.roomPivot.add(mugGroup);

    const mugBody = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.16, 0.14, 0.28, 10)),
      this.trackMat(new THREE.MeshLambertMaterial({ color: 0xf4ead8 }))
    );
    mugBody.position.y = 0.14;
    mugBody.castShadow = true;
    mugGroup.add(mugBody);
    const teaDisc = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 10)),
      this.trackMat(new THREE.MeshLambertMaterial({ color: 0x6f432a }))
    );
    teaDisc.position.y = 0.26;
    mugGroup.add(teaDisc);

    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(
        this.trackGeo(new THREE.SphereGeometry(0.06, 6, 6)),
        this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }))
      );
      mugGroup.add(puff);
      this.steamPuffs.push(puff);
    }

    // Prop 4: Diamond A-Frame Window (on back-left wall, z = -3.7)
    const winGroup = this.propGroups.window;
    winGroup.name = 'Interior_window';
    winGroup.position.set(1.25, 2.35, -3.7);
    this.roomPivot.add(winGroup);

    const frame = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(1.22, 1.22, 0.12)),
      this.trackMat(new THREE.MeshLambertMaterial({ color: TIMBER }))
    );
    frame.rotation.z = Math.PI / 4;
    winGroup.add(frame);

    this.windowPaneMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0x9ec9e2 }));
    const pane = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.94, 0.94, 0.14)),
      this.windowPaneMat
    );
    pane.rotation.z = Math.PI / 4;
    winGroup.add(pane);
    this.setTimeOfDay(initialTimeOfDay);

    // Prop 5: Wooden Front Door (on back-right wall, x = 3.68, z = 1.65, facing -X)
    const doorGroup = this.propGroups.door;
    doorGroup.name = 'Interior_door';
    doorGroup.position.set(3.68, 0.1, 1.65);
    this.roomPivot.add(doorGroup);

    this.box(0.14, 2.45, 1.4, TIMBER, 0, 1.22, 0, doorGroup);
    this.box(0.16, 2.22, 1.14, 0xb8743f, -0.04, 1.15, 0, doorGroup);
    // Brass doorknob
    this.box(0.12, 0.12, 0.12, 0xf2c94c, -0.14, 1.08, -0.36, doorGroup);
    // Warm doormat inside the threshold
    this.box(0.85, 0.04, 1.35, 0xc9a97a, -0.68, 0.04, 0, doorGroup);

    // Warm overhead interior fill light
    const roomFill = new THREE.PointLight(0xffdfb0, 240, 650, 1.0);
    roomFill.position.set(-0.5, 4.5, 0.5);
    this.roomPivot.add(roomFill);

    // Set up stencil-based silhouette outlines for each interactive interior prop
    const keys: InteriorPropId[] = ['inkstone', 'drafts', 'mug', 'window', 'door'];
    keys.forEach((k, idx) => {
      const stencilRef = idx + 1;
      const g = this.propGroups[k];
      this.propBaseY[k] = g.position.y;

      const outlineMat = this.trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xfff3a8,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          stencilWrite: true,
          stencilRef,
          stencilFunc: THREE.NotEqualStencilFunc,
        })
      );
      this.propOutlineMats[k] = outlineMat;

      const meshes: THREE.Mesh[] = [];
      g.traverse((node) => {
        if (node instanceof THREE.Mesh && !node.userData.isPropOutline && !node.userData.skipOutline) {
          if (!this.steamPuffs.includes(node) && !this.inkMotes.includes(node)) {
            meshes.push(node);
          }
        }
      });

      for (const mesh of meshes) {
        if (!Array.isArray(mesh.material)) {
          mesh.material.stencilWrite = true;
          mesh.material.stencilRef = stencilRef;
          mesh.material.stencilFunc = THREE.AlwaysStencilFunc;
          mesh.material.stencilZPass = THREE.ReplaceStencilOp;
          mesh.material.stencilFail = THREE.KeepStencilOp;
          mesh.material.stencilZFail = THREE.KeepStencilOp;
          mesh.renderOrder = 49;
        }

        let outlineGeo: THREE.BufferGeometry;
        let useUniformScale = false;
        if (mesh.geometry instanceof THREE.BoxGeometry) {
          const { width, height, depth } = mesh.geometry.parameters;
          outlineGeo = this.trackGeo(
            new THREE.BoxGeometry(width + 0.055, height + 0.055, depth + 0.055)
          );
        } else if (mesh.geometry instanceof THREE.CylinderGeometry) {
          const { radiusTop, radiusBottom, height, radialSegments } = mesh.geometry.parameters;
          outlineGeo = this.trackGeo(
            new THREE.CylinderGeometry(
              radiusTop + 0.03,
              radiusBottom + 0.03,
              height + 0.05,
              radialSegments
            )
          );
        } else {
          outlineGeo = mesh.geometry;
          useUniformScale = true;
        }

        const outline = new THREE.Mesh(outlineGeo, outlineMat);
        outline.position.copy(mesh.position);
        outline.rotation.copy(mesh.rotation);
        outline.scale.copy(mesh.scale);
        if (useUniformScale) outline.scale.multiplyScalar(1.08);
        outline.visible = false;
        outline.renderOrder = 50;
        outline.raycast = () => {};
        outline.userData.isPropOutline = true;
        mesh.parent?.add(outline);
        this.propOutlines[k].push(outline);
      }
    });
  }

  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    if (!this.windowPaneMat) return;
    const skyMap: Record<TimeOfDay, number> = {
      dawn: 0xf4a582,
      morning: 0x9ec9e2,
      afternoon: 0x7cb9e8,
      dusk: 0xd97d6c,
      evening: 0x3b4870,
      midnight: 0x16203a,
    };
    this.windowPaneMat.color.setHex(skyMap[timeOfDay]);
  }

  public update(dt: number, elapsed: number): void {
    if (!this.group.visible) return;

    // Gentle hearth flicker
    this.hearthFlames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(elapsed * 10.5 + i * 1.9) * 0.18;
    });
    this.hearthLight.intensity = 215 + Math.sin(elapsed * 11) * 32;

    // Rising mug steam puffs
    this.steamPuffs.forEach((puff, idx) => {
      const k = (elapsed * 0.32 + idx / 3) % 1;
      puff.position.set(
        Math.sin(k * 6 + idx) * 0.04,
        0.34 + k * 0.42,
        Math.cos(k * 5 + idx) * 0.03
      );
      puff.scale.setScalar(0.6 + k * 0.9);
      (puff.material as THREE.MeshBasicMaterial).opacity = 0.42 * Math.sin(k * Math.PI);
    });

    // Decay prop pulses, hover outlines & click bounce
    const keys: InteriorPropId[] = ['inkstone', 'drafts', 'mug', 'window', 'door'];
    for (const k of keys) {
      if (this.pulseTimers[k] > 0) {
        this.pulseTimers[k] = Math.max(0, this.pulseTimers[k] - dt);
      }
      const targetHover = this.hoveredProp === k ? 1 : 0;
      this.propHoverBlend[k] += (targetHover - this.propHoverBlend[k]) * Math.min(1, dt * 12);

      const g = this.propGroups[k];
      const hover = this.propHoverBlend[k];
      const timer = this.pulseTimers[k];
      const baseScale = 1 + hover * 0.065;
      let clickGlow = 0;

      if (timer > 0) {
        const progress = 1 - timer / 0.6;
        const decay = Math.exp(-progress * 4.5);
        const squash = Math.sin(progress * Math.PI * 3.0) * decay;
        const hop = Math.abs(Math.sin(progress * Math.PI * 1.8)) * decay;
        g.scale.set(
          baseScale * (1 - squash * 0.1),
          baseScale * (1 + squash * 0.16),
          baseScale * (1 - squash * 0.1)
        );
        g.position.y = this.propBaseY[k] + hop * 0.14;
        clickGlow = Math.sin(progress * Math.PI) * 0.5;
      } else {
        g.scale.setScalar(baseScale);
        g.position.y = this.propBaseY[k];
      }

      const outlineAlpha = Math.max(hover, clickGlow);
      const outlineMat = this.propOutlineMats[k];
      if (outlineMat) {
        outlineMat.opacity = outlineAlpha;
      }
      const showOutline = outlineAlpha > 0.01;
      for (const outline of this.propOutlines[k]) {
        outline.visible = showOutline;
      }
    }

    const inkPulse =
      (this.pulseTimers.inkstone > 0
        ? Math.sin((1 - this.pulseTimers.inkstone / 0.6) * Math.PI) * 1.8
        : 0) + this.propHoverBlend.inkstone * 0.65;
    this.inkstoneCoreMat.emissiveIntensity = 1.6 + Math.sin(elapsed * 2.4) * 0.35 + inkPulse;
    this.inkstoneLight.intensity = 95 + inkPulse * 65;
    if (this.inkPlumeMat) {
      this.inkPlumeMat.uniforms.uTime.value = elapsed;
      this.inkPlumeMat.uniforms.uPulse.value = inkPulse;
    }
    for (const s of this.inkFloatingShards) {
      s.mesh.position.y = s.basePos.y + Math.sin(elapsed * s.speed + s.phase) * s.amp;
      s.mesh.rotation.x += s.rotSpeed.x * dt;
      s.mesh.rotation.y += s.rotSpeed.y * dt;
      s.mesh.rotation.z += s.rotSpeed.z * dt;
    }

    // Bobbing astral motes above the broken inkstone
    this.inkMotes.forEach((mote, idx) => {
      const t = (elapsed * 0.45 + idx / this.inkMotes.length) % 1;
      const angle = t * 4.8 + idx * 1.4;
      const radius = 0.025 + Math.sin(t * Math.PI) * 0.065;
      mote.position.set(
        Math.cos(angle) * radius,
        0.12 + t * 0.34,
        Math.sin(angle) * radius
      );
      mote.rotation.y = elapsed * 1.6 + idx;
      (mote.material as THREE.MeshBasicMaterial).opacity = 0.85 * Math.sin(t * Math.PI);
    });
  }

  public pickPropAt(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    camera: THREE.Camera
  ): InteriorPropId | null {
    if (!this.group.visible) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    const order: InteriorPropId[] = ['inkstone', 'drafts', 'mug', 'window', 'door'];
    for (const id of order) {
      if (this.raycaster.intersectObject(this.propGroups[id], true).length > 0) {
        return id;
      }
    }
    return null;
  }

  public setHoveredProp(propId: InteriorPropId | null): void {
    this.hoveredProp = propId;
  }

  public triggerPropPulse(propId: InteriorPropId): void {
    this.pulseTimers[propId] = 0.6;
  }

  public getPropWorldPosition(propId: InteriorPropId, out: THREE.Vector3): boolean {
    const g = this.propGroups[propId];
    if (!g) return false;
    g.getWorldPosition(out);
    out.y += (propId === 'door' || propId === 'window' ? 1.5 : 0.75) * this.roomScale;
    return true;
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.steamPuffs.length = 0;
    this.inkMotes.length = 0;
    this.inkFloatingShards.length = 0;
    this.hearthFlames.length = 0;
    this.group.clear();
  }
}
