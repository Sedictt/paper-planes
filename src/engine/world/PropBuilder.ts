import * as THREE from 'three';
import type { WeatherMode, TimeOfDay } from '../../types';
import { TILE_SPACING, ELEV_UNIT, gridToWorld3D } from './TerrainBuilder';

export interface PropBuildResult {
  group: THREE.Group;
  campfirePosition: THREE.Vector3;
  update: (dt: number, elapsed: number) => void;
  updateWeather: (weather: WeatherMode) => void;
  updateTimeOfDay: (timeOfDay: TimeOfDay) => void;
  dispose: () => void;
}

export interface PropRecord {
  id: string;
  kind: string;
  gx: number;
  gy: number;
  gz: number;
  group: THREE.Group;
}

export class PropBuilder {
  public readonly group: THREE.Group;
  public campfirePosition: THREE.Vector3;
  public readonly propRecords: PropRecord[] = [];

  private geometries: Set<THREE.BufferGeometry> = new Set();
  private materials: Set<THREE.Material> = new Set();

  private pineMeshes: THREE.Mesh[] = [];
  private flameGroup: THREE.Group | null = null;
  private cottageWindowLit: THREE.MeshBasicMaterial;
  private pineFoliageMat: THREE.MeshLambertMaterial;
  private pineSnowMat: THREE.MeshLambertMaterial;

  constructor(elevationLookup: (gx: number, gy: number) => number) {
    this.group = new THREE.Group();
    this.group.name = 'DioramaProps';
    this.campfirePosition = new THREE.Vector3();

    // Reusable Materials
    const createLambert = (color: number): THREE.MeshLambertMaterial => {
      const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.materials.add(mat);
      return mat;
    };

    const woodTrunk = createLambert(0x8c552e);
    const darkWood = createLambert(0x7a4826);
    const stumpWood = createLambert(0x9c6236);
    const gardenBorderWood = createLambert(0xd19140);
    this.pineFoliageMat = createLambert(0x4b6b33);
    this.pineSnowMat = createLambert(0xd5e4f0);
    const cottageRoof = createLambert(0x7d6552);
    const cottageGable = createLambert(0xf2e7d5);
    const cottageDoor = createLambert(0xc98a3b);
    const stone = createLambert(0x9aa09a);
    const stoneDark = createLambert(0x6e736e);
    const hearthStone = createLambert(0x7c7972);
    const mushroomRed = createLambert(0xd94426);
    const mushroomWhite = createLambert(0xfbf7ee);
    const mushroomBrown = createLambert(0xa86b38);
    const mushroomPink = createLambert(0xe89ab2);
    const frogGreen = createLambert(0x8fb848);
    const frogPlanterGreen = createLambert(0xa5c454);
    const goldFlower = createLambert(0xfca311);
    const orangeFlower = createLambert(0xf06e18);
    const bushGreen = createLambert(0x4a7332);
    const bushLight = createLambert(0x639442);
    const cabbageGreen = createLambert(0x5b8f44);
    const cabbageLight = createLambert(0x8bc263);
    const sproutGreen = createLambert(0x7dc440);
    const cattailSpike = createLambert(0x5c341a);
    const reedGreen = createLambert(0x588a44);
    const lilyPadMat = createLambert(0x4b853e);
    const lilyBloom = createLambert(0xf7b2c7);
    const tulipRed = createLambert(0xd63c36);
    const tulipYellow = createLambert(0xf7c530);
    const daisyPetal = createLambert(0xfaf7f0);
    const daisyCenter = createLambert(0xffcf2e);
    const wateringCanBody = createLambert(0xa6a2ab);
    const wateringCanBrass = createLambert(0xd4ba72);

    this.cottageWindowLit = new THREE.MeshBasicMaterial({ color: 0xffd666 });
    this.materials.add(this.cottageWindowLit);

    const flameOuter = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });
    const flameInner = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
    this.materials.add(flameOuter);
    this.materials.add(flameInner);
    this.materials.add(shadowMat);

    const trackGeom = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.add(g);
      return g;
    };

    // Helper: Contact Shadow Disc
    const addShadow = (parent: THREE.Group, radius: number) => {
      const disc = new THREE.Mesh(trackGeom(new THREE.CircleGeometry(radius, 8)), shadowMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.08;
      parent.add(disc);
    };

    // 1. A-FRAME COTTAGE at (2, 2, elev: 52)
    const buildAFrameCottage = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_aframe_cottage';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 26);

      // Stone stoop step
      const stoop = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(16, 3.5, 10)), stone);
      stoop.position.set(0, 1.75, 22);
      stoop.castShadow = true;
      stoop.receiveShadow = true;
      p.add(stoop);

      // True triangular A-frame body via ExtrudeGeometry
      const gableShape = new THREE.Shape();
      gableShape.moveTo(-20, 0);
      gableShape.lineTo(20, 0);
      gableShape.lineTo(0, 40);
      gableShape.closePath();

      const gableGeom = trackGeom(
        new THREE.ExtrudeGeometry(gableShape, {
          depth: 36,
          bevelEnabled: false,
        })
      );
      gableGeom.translate(0, 0, -18);
      const gableBody = new THREE.Mesh(gableGeom, cottageGable);
      gableBody.castShadow = true;
      gableBody.receiveShadow = true;
      p.add(gableBody);

      // Properly pitched A-frame roof panels (forming ^ shape!)
      const roofGeom = trackGeom(new THREE.BoxGeometry(3.6, 48, 42));
      const leftRoof = new THREE.Mesh(roofGeom, cottageRoof);
      leftRoof.position.set(-11.5, 21.5, 0);
      leftRoof.rotation.z = -Math.PI / 6.2; // Top tilts RIGHT toward ridge
      leftRoof.castShadow = true;
      leftRoof.receiveShadow = true;
      p.add(leftRoof);

      const rightRoof = new THREE.Mesh(roofGeom, cottageRoof);
      rightRoof.position.set(11.5, 21.5, 0);
      rightRoof.rotation.z = Math.PI / 6.2; // Top tilts LEFT toward ridge
      rightRoof.castShadow = true;
      rightRoof.receiveShadow = true;
      p.add(rightRoof);

      // Roof ridge cap
      const ridge = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(4.5, 3.5, 42.5)), darkWood);
      ridge.position.set(0, 42.5, 0);
      ridge.castShadow = true;
      p.add(ridge);

      // Stone chimney
      const chimney = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(6, 26, 6)), stoneDark);
      chimney.position.set(9, 29, -6);
      chimney.castShadow = true;
      p.add(chimney);

      // Wooden Front Door & warm glowing diamond window
      const door = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(9, 15, 1.2)), cottageDoor);
      door.position.set(0, 7.5, 18.2);
      door.castShadow = true;
      p.add(door);

      const windowMesh = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(5.2, 5.2, 1.0)), this.cottageWindowLit);
      windowMesh.position.set(0, 23, 18.2);
      windowMesh.rotation.z = Math.PI / 4;
      p.add(windowMesh);

      this.group.add(p);
      this.propRecords.push({ id: 'cottage', kind: 'aframe_cottage', gx, gy, gz, group: p });
    };

    // 2. HOLLOW TRUNK (Dead Tree) at (3, 1, elev: 54)
    const buildHollowTrunk = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_hollow_trunk';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 18);

      // Tall chunky trunk
      const mainTrunk = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(8.0, 12.5, 52, 8)), stumpWood);
      mainTrunk.position.y = 26;
      mainTrunk.castShadow = true;
      mainTrunk.receiveShadow = true;
      p.add(mainTrunk);

      // Top hollow rim
      const innerRim = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(5.2, 5.2, 2.0, 7)), darkWood);
      innerRim.position.y = 51.5;
      p.add(innerRim);

      // Two chunky stubby branches
      const branchL = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(4.5, 6.0, 20, 7)), stumpWood);
      branchL.position.set(-10, 34, 2);
      branchL.rotation.z = Math.PI / 3.4;
      branchL.castShadow = true;
      p.add(branchL);

      const branchR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(4.0, 5.5, 18, 7)), stumpWood);
      branchR.position.set(9, 28, -2);
      branchR.rotation.z = -Math.PI / 3.2;
      branchR.castShadow = true;
      p.add(branchR);

      // Root buttresses
      for (let i = 0; i < 4; i++) {
        const root = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(5, 6, 9)), stumpWood);
        const a = (i / 4) * Math.PI * 2 + 0.4;
        root.position.set(Math.cos(a) * 10, 3, Math.sin(a) * 10);
        root.rotation.y = a;
        root.castShadow = true;
        p.add(root);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'trunk', kind: 'hollow_trunk', gx, gy, gz, group: p });
    };

    // 3. PINE TREES (4 placements)
    const buildPine = (gx: number, gy: number, gz: number, scale = 1.0, index = 0) => {
      const p = new THREE.Group();
      p.name = `Prop_pine_${index}`;
      p.position.copy(gridToWorld3D(gx, gy, gz));
      p.scale.setScalar(scale * 1.35);
      addShadow(p, 14);

      // Chunky trunk with root flare
      const trunk = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(2.6, 4.2, 19, 7)), woodTrunk);
      trunk.position.y = 9.5;
      trunk.castShadow = true;
      p.add(trunk);

      // 4 Lush Overlapping Tiered Boughs (slightly rotated per tier for organic silhouette)
      const tiers = [
        { r: 16.0, h: 16.5, y: 18.0, rot: 0.0 },
        { r: 13.5, h: 15.5, y: 26.5, rot: 0.35 },
        { r: 10.5, h: 14.5, y: 34.5, rot: 0.7 },
        { r: 7.2,  h: 13.0, y: 42.0, rot: 1.05 },
      ];

      for (const t of tiers) {
        const bough = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(t.r, t.h, 7)), this.pineFoliageMat);
        bough.position.y = t.y;
        bough.rotation.y = t.rot;
        bough.castShadow = true;
        bough.receiveShadow = true;
        p.add(bough);
        this.pineMeshes.push(bough);
      }

      this.group.add(p);
      this.propRecords.push({ id: `pine_${index}`, kind: 'pine', gx, gy, gz, group: p });
    };

    // 4. ROUND BUSH at (3.5, 4.5, elev: 34)
    const buildRoundBush = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_round_bush';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 16);

      const puffs = [
        { x: 0, y: 11.0, z: 0, r: 12.5, mat: bushGreen },
        { x: -6.5, y: 8.5, z: 4.5, r: 8.5, mat: bushGreen },
        { x: 6.5, y: 9.0, z: -3.5, r: 8.5, mat: bushLight },
        { x: 3.5, y: 12.5, z: 5.5, r: 7.5, mat: bushLight },
        { x: -3.0, y: 14.0, z: -3.0, r: 7.0, mat: bushLight },
      ];
      for (const pf of puffs) {
        const m = new THREE.Mesh(trackGeom(new THREE.IcosahedronGeometry(pf.r, 1)), pf.mat);
        m.position.set(pf.x, pf.y, pf.z);
        m.castShadow = true;
        m.receiveShadow = true;
        p.add(m);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'round_bush', kind: 'round_bush', gx, gy, gz, group: p });
    };

    // 5. MONOLITH STONE at (6, 2, elev: 34)
    const buildMonolithStone = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_monolith_stone';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 15);

      const pillar = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(7.0, 10.5, 44, 5)), stone);
      pillar.position.y = 22;
      pillar.rotation.y = 0.4;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      p.add(pillar);

      const mossPatch = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(4, 9, 2)), createLambert(0x8fa368));
      mossPatch.position.set(3.5, 14, 6.5);
      p.add(mossPatch);

      this.group.add(p);
      this.propRecords.push({ id: 'monolith_stone', kind: 'monolith_stone', gx, gy, gz, group: p });
    };

    // 6. AMANITA MUSHROOM at (7, 3, elev: 34)
    const buildAmanitaMushroom = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_amanita_mushroom';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 12);

      const stem = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(3.2, 4.4, 15, 8)), mushroomWhite);
      stem.position.y = 7.5;
      stem.castShadow = true;
      p.add(stem);

      // Rounded dome cap
      const cap = new THREE.Mesh(
        trackGeom(new THREE.SphereGeometry(12.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        mushroomRed
      );
      cap.position.y = 13.5;
      cap.castShadow = true;
      p.add(cap);

      // Cute raised white polka dots
      const dotGeom = trackGeom(new THREE.SphereGeometry(1.6, 6, 6));
      for (let i = 0; i < 6; i++) {
        const dot = new THREE.Mesh(dotGeom, mushroomWhite);
        const a = (i / 6) * Math.PI * 2;
        dot.position.set(Math.cos(a) * 8.0, 18.2, Math.sin(a) * 8.0);
        p.add(dot);
      }
      const topDot = new THREE.Mesh(dotGeom, mushroomWhite);
      topDot.position.set(1.5, 24.5, -1.0);
      p.add(topDot);

      this.group.add(p);
      this.propRecords.push({ id: 'amanita_mushroom', kind: 'amanita_mushroom', gx, gy, gz, group: p });
    };

    // 7. CAMPFIRE at (2.5, 6.5, elev: 34)
    const buildCampfire = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_campfire';
      const basePos = gridToWorld3D(gx, gy, gz);
      p.position.copy(basePos);
      this.campfirePosition = basePos.clone().add(new THREE.Vector3(0, 3.0, 0));
      addShadow(p, 16);

      // Dark charcoal ash bed
      const ashBed = new THREE.Mesh(
        trackGeom(new THREE.CylinderGeometry(11.5, 12.5, 1.4, 10)),
        createLambert(0x2a211c)
      );
      ashBed.position.y = 0.7;
      ashBed.receiveShadow = true;
      p.add(ashBed);

      // Neat ring of 10 rounded hearth stones
      const stoneGeom = trackGeom(new THREE.DodecahedronGeometry(3.0, 1));
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const s = new THREE.Mesh(stoneGeom, hearthStone);
        s.position.set(Math.cos(a) * 13.5, 2.0, Math.sin(a) * 13.5);
        s.scale.set(1.15, 0.78, 1.0);
        s.rotation.set(0, a, 0);
        s.castShadow = true;
        s.receiveShadow = true;
        p.add(s);
      }

      // 4 crossed firewood logs resting naturally in a low teepee
      const logGeom = trackGeom(new THREE.CylinderGeometry(1.6, 2.0, 16.5, 7));
      logGeom.rotateX(Math.PI / 2); // Align log along Z axis
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.35;
        const log = new THREE.Mesh(logGeom, stumpWood);
        log.position.set(Math.sin(a) * 2.0, 3.2, Math.cos(a) * 2.0);
        log.rotation.order = 'YXZ';
        log.rotation.y = a;
        log.rotation.x = 0.28; // Tilt inner end up toward center
        log.castShadow = true;
        p.add(log);
      }

      // Cozy multi-layered animated flame
      this.flameGroup = new THREE.Group();
      const outerF = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(5.5, 12.5, 7)), flameOuter);
      outerF.position.y = 8.2;
      this.flameGroup.add(outerF);

      const flameMidMat = new THREE.MeshBasicMaterial({ color: 0xffa826 });
      this.materials.add(flameMidMat);
      const midF = new THREE.Mesh(
        trackGeom(new THREE.ConeGeometry(3.8, 9.5, 7)),
        flameMidMat
      );
      midF.position.y = 7.4;
      this.flameGroup.add(midF);

      const innerF = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(2.2, 6.2, 6)), flameInner);
      innerF.position.y = 6.2;
      this.flameGroup.add(innerF);

      p.add(this.flameGroup);
      this.group.add(p);
      this.propRecords.push({ id: 'campfire', kind: 'campfire', gx, gy, gz, group: p });
    };

    // 8. WATERING CAN at (6, 6, elev: 26)
    const buildWateringCan = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_watering_can';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 9);

      const body = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(6.2, 6.8, 13.0, 10)), wateringCanBody);
      body.position.y = 6.5;
      body.castShadow = true;
      body.receiveShadow = true;
      p.add(body);

      // Curved handle
      const handle = new THREE.Mesh(trackGeom(new THREE.TorusGeometry(4.5, 0.9, 6, 12, Math.PI * 1.15)), wateringCanBody);
      handle.position.set(-5.5, 7.5, 0);
      handle.rotation.z = Math.PI * 0.45;
      handle.castShadow = true;
      p.add(handle);

      const spout = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(1.0, 2.0, 13.5, 6)), wateringCanBody);
      spout.position.set(6.8, 8.2, 0);
      spout.rotation.z = -Math.PI / 3.6;
      spout.castShadow = true;
      p.add(spout);

      const rose = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(2.6, 2.2, 8)), wateringCanBrass);
      rose.position.set(11.8, 12.2, 0);
      rose.rotation.z = -Math.PI / 3.6;
      p.add(rose);

      this.group.add(p);
      this.propRecords.push({ id: 'watering_can', kind: 'watering_can', gx, gy, gz, group: p });
    };

    // 9. CABBAGE + RAISED GARDEN BED BORDER at (7, 6) & (7, 7)
    const buildGardenBedFrame = (gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_garden_bed_frame';
      const c1 = gridToWorld3D(7.5, 6.5, gz);
      const c2 = gridToWorld3D(7.5, 7.5, gz);
      p.position.set((c1.x + c2.x) * 0.5, c1.y, (c1.z + c2.z) * 0.5);

      const lenX = TILE_SPACING * 1.92;
      const lenZ = TILE_SPACING * 0.92;
      const wallH = 5.5;
      const wallT = 4.2;

      const north = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(lenX, wallH, wallT)), gardenBorderWood);
      north.position.set(0, wallH * 0.5, -lenZ * 0.5);
      north.castShadow = true;
      north.receiveShadow = true;
      p.add(north);

      const south = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(lenX, wallH, wallT)), gardenBorderWood);
      south.position.set(0, wallH * 0.5, lenZ * 0.5);
      south.castShadow = true;
      south.receiveShadow = true;
      p.add(south);

      const west = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(wallT, wallH, lenZ)), gardenBorderWood);
      west.position.set(-lenX * 0.5, wallH * 0.5, 0);
      west.castShadow = true;
      west.receiveShadow = true;
      p.add(west);

      const east = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(wallT, wallH, lenZ)), gardenBorderWood);
      east.position.set(lenX * 0.5, wallH * 0.5, 0);
      east.castShadow = true;
      east.receiveShadow = true;
      p.add(east);

      this.group.add(p);
    };

    const buildCabbage = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_cabbage';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 9);

      const core = new THREE.Mesh(trackGeom(new THREE.DodecahedronGeometry(6.8, 1)), cabbageGreen);
      core.position.y = 6.0;
      core.castShadow = true;
      p.add(core);

      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(7.2, 2.0, 7.2)), cabbageLight);
        const a = (i / 6) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 4.8, 3.6, Math.sin(a) * 4.8);
        leaf.rotation.y = a;
        leaf.rotation.x = 0.25;
        leaf.castShadow = true;
        p.add(leaf);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'cabbage', kind: 'cabbage', gx, gy, gz, group: p });
    };

    // 10. GARDEN SPROUT at (7, 7, elev: 26)
    const buildGardenSprout = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_garden_sprout';
      p.position.copy(gridToWorld3D(gx, gy, gz));

      const stem = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.9, 1.2, 10.0, 5)), reedGreen);
      stem.position.y = 5.0;
      stem.castShadow = true;
      p.add(stem);

      const l1 = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(5.0, 1.0, 3.0)), sproutGreen);
      l1.position.set(2.5, 7.5, 0);
      l1.rotation.z = -0.3;
      p.add(l1);

      const l2 = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(5.0, 1.0, 3.0)), sproutGreen);
      l2.position.set(-2.5, 7.5, 0);
      l2.rotation.z = 0.3;
      p.add(l2);

      const flower = new THREE.Mesh(trackGeom(new THREE.DodecahedronGeometry(2.6, 0)), tulipYellow);
      flower.position.set(0, 10.8, 0);
      p.add(flower);

      this.group.add(p);
      this.propRecords.push({ id: 'garden_sprout', kind: 'garden_sprout', gx, gy, gz, group: p });
    };

    // 11. FROG PLANTER at (9, 6, elev: 26)
    const buildFrogPlanter = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_frog_planter';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 15);

      // Chunky lime-green frog pot body
      const pot = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(12.5, 12, 10)), frogPlanterGreen);
      pot.scale.set(1.1, 0.85, 1.05);
      pot.position.y = 10.0;
      pot.castShadow = true;
      pot.receiveShadow = true;
      p.add(pot);

      // 4 stubby legs
      const legGeom = trackGeom(new THREE.CylinderGeometry(2.6, 3.0, 5.5, 7));
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(legGeom, frogPlanterGreen);
          leg.position.set(sx * 8.5, 2.75, sz * 7.5);
          leg.castShadow = true;
          p.add(leg);
        }
      }

      // Big frog eyes
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(3.2, 8, 8)), frogPlanterGreen);
        eye.position.set(side * 6.5, 18.0, 6.2);
        p.add(eye);
        const pupil = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(1.4, 1.4, 1.4)), createLambert(0x1f2418));
        pupil.position.set(side * 6.5, 18.2, 8.9);
        p.add(pupil);
      }

      // Soil rim & bright orange flower blooming out of pot
      const soil = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(8.5, 8.5, 1.5, 10)), darkWood);
      soil.position.set(0, 19.2, 0);
      p.add(soil);

      const center = new THREE.Mesh(trackGeom(new THREE.DodecahedronGeometry(3.5, 0)), goldFlower);
      center.position.set(0, 22.5, 0);
      p.add(center);

      for (let i = 0; i < 6; i++) {
        const petal = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(2.8, 6, 6)), orangeFlower);
        const a = (i / 6) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 4.5, 22.2, Math.sin(a) * 4.5);
        p.add(petal);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'frog_planter', kind: 'frog_planter', gx, gy, gz, group: p });
    };

    // 12. MUSHROOM STUMP at (8, 8, elev: 25)
    const buildMushroomStump = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_mushroom_stump';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 16);

      const stump = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(11.0, 14.5, 16.0, 9)), stumpWood);
      stump.position.y = 8.0;
      stump.castShadow = true;
      stump.receiveShadow = true;
      p.add(stump);

      // Cluster of cute brown-capped mushrooms on top
      const shrooms = [
        { x: 0, z: 0, h: 8.5, r: 4.0 },
        { x: -4.8, z: 3.0, h: 6.5, r: 3.0 },
        { x: 4.5, z: 2.5, h: 7.0, r: 3.2 },
        { x: 1.5, z: -4.5, h: 5.5, r: 2.6 },
      ];
      for (const s of shrooms) {
        const stem = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.9, 1.2, s.h, 6)), mushroomWhite);
        stem.position.set(s.x, 16.0 + s.h * 0.5, s.z);
        p.add(stem);

        const cap = new THREE.Mesh(
          trackGeom(new THREE.SphereGeometry(s.r, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)),
          mushroomBrown
        );
        cap.position.set(s.x, 16.0 + s.h, s.z);
        cap.castShadow = true;
        p.add(cap);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'mushroom_stump', kind: 'mushroom_stump', gx, gy, gz, group: p });
    };

    // 13. FALLEN LOG at (6, 5, elev: 25)
    const buildFallenLog = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_fallen_log';
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 15);

      const log = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(5.8, 6.5, 34.0, 8)), stumpWood);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = 0.35;
      log.position.y = 5.8;
      log.castShadow = true;
      log.receiveShadow = true;
      p.add(log);

      const branch = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(2.6, 3.2, 10.0, 6)), stumpWood);
      branch.position.set(4, 9.5, -2);
      branch.rotation.z = -0.5;
      branch.castShadow = true;
      p.add(branch);

      this.group.add(p);
      this.propRecords.push({ id: 'fallen_log', kind: 'fallen_log', gx, gy, gz, group: p });
    };

    // 14. POND FROG at (6, 9, elev: 18)
    const buildPondFrog = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_pond_frog';
      p.position.copy(gridToWorld3D(gx, gy, gz));

      const pad = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(11.0, 11.0, 1.2, 9)), lilyPadMat);
      pad.position.y = 0.6;
      pad.receiveShadow = true;
      p.add(pad);

      const frogBody = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(5.2, 8, 8)), frogGreen);
      frogBody.scale.set(1.15, 0.85, 1.0);
      frogBody.position.set(0, 4.2, 0);
      frogBody.castShadow = true;
      p.add(frogBody);

      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(1.6, 6, 6)), frogGreen);
        eye.position.set(side * 2.5, 7.8, 2.8);
        p.add(eye);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'pond_frog', kind: 'pond_frog', gx, gy, gz, group: p });
    };

    // 15. CATTAILS at (5, 5, elev: 14)
    const buildCattails = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_cattails';
      p.position.copy(gridToWorld3D(gx, gy, gz));

      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * 5.0;
        const stem = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.6, 0.8, 24.0, 5)), reedGreen);
        stem.position.set(ox, 12.0, (i % 2) * 3.0);
        stem.castShadow = true;
        p.add(stem);

        const spike = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(1.6, 1.6, 7.5, 6)), cattailSpike);
        spike.position.set(ox, 19.0, (i % 2) * 3.0);
        p.add(spike);
      }
      // Reed leaf blades
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const leaf = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(1.2, 16.0, 0.4)), reedGreen);
        leaf.position.set(Math.cos(a) * 3.5, 7.5, Math.sin(a) * 3.5);
        leaf.rotation.y = a;
        leaf.rotation.z = 0.25;
        p.add(leaf);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'cattails', kind: 'cattails', gx, gy, gz, group: p });
    };

    // 16. LILYPADS (2 placements)
    const buildLilypads = (gx: number, gy: number, gz: number, index = 0) => {
      const p = new THREE.Group();
      p.name = `Prop_lilypads_${index}`;
      p.position.copy(gridToWorld3D(gx, gy, gz));

      const pad = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(7.5, 7.5, 0.8, 8)), lilyPadMat);
      pad.position.y = 0.5;
      p.add(pad);

      const blossom = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(2.8, 2.6, 6)), lilyBloom);
      blossom.position.set(1.5, 1.8, 1.5);
      p.add(blossom);

      this.group.add(p);
      this.propRecords.push({ id: `lilypads_${index}`, kind: 'lilypads', gx, gy, gz, group: p });
    };

    // 17. STREAM ROCK at (5, 7, elev: 14)
    const buildStreamRock = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_stream_rock';
      p.position.copy(gridToWorld3D(gx, gy, gz));

      const rock = new THREE.Mesh(trackGeom(new THREE.DodecahedronGeometry(8.5, 0)), stone);
      rock.position.y = 4.5;
      rock.scale.set(1.2, 0.75, 1.0);
      rock.castShadow = true;
      p.add(rock);

      this.group.add(p);
      this.propRecords.push({ id: 'stream_rock', kind: 'stream_rock', gx, gy, gz, group: p });
    };

    // 18. PINK MUSHROOMS at (2, 4, elev: 42)
    const buildPinkMushrooms = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_pink_mushrooms';
      p.position.copy(gridToWorld3D(gx, gy, gz));

      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * 5.2;
        const stem = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(1.0, 1.4, 7.5, 6)), mushroomWhite);
        stem.position.set(ox, 3.75, (i % 2) * 3.5);
        p.add(stem);

        const cap = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(4.2, 3.8, 7)), mushroomPink);
        cap.position.set(ox, 8.0, (i % 2) * 3.5);
        cap.castShadow = true;
        p.add(cap);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'pink_mushrooms', kind: 'pink_mushrooms', gx, gy, gz, group: p });
    };

    // 19. TULIPS (3 placements)
    const buildTulips = (gx: number, gy: number, gz: number, index = 0) => {
      const p = new THREE.Group();
      p.name = `Prop_tulips_${index}`;
      p.position.copy(gridToWorld3D(gx, gy, gz));

      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * 4.5;
        const oz = (i % 2) * 2.5;
        const stem = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.6, 0.7, 9.0, 5)), reedGreen);
        stem.position.set(ox, 4.5, oz);
        p.add(stem);

        const leaf = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(2.8, 0.5, 1.4)), bushLight);
        leaf.position.set(ox + 1.4, 2.2, oz);
        leaf.rotation.z = 0.45;
        p.add(leaf);

        const mat = i % 2 === 0 ? tulipRed : tulipYellow;
        const bloom = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(2.0, 1.0, 3.6, 6)), mat);
        bloom.position.set(ox, 10.0, oz);
        p.add(bloom);
      }

      this.group.add(p);
      this.propRecords.push({ id: `tulips_${index}`, kind: 'tulips', gx, gy, gz, group: p });
    };

    // 20. DAISIES (2 placements)
    const buildDaisies = (gx: number, gy: number, gz: number, index = 0) => {
      const p = new THREE.Group();
      p.name = `Prop_daisies_${index}`;
      p.position.copy(gridToWorld3D(gx, gy, gz));

      for (let i = 0; i < 2; i++) {
        const ox = (i - 0.5) * 6.5;
        const stem = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.5, 0.6, 5.0, 4)), reedGreen);
        stem.position.set(ox, 2.5, 0);
        p.add(stem);

        const leaf = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(3.2, 0.5, 1.6)), bushLight);
        leaf.position.set(ox, 1.0, 1.2);
        leaf.rotation.x = 0.3;
        p.add(leaf);

        const petal = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(4.2, 4.2, 0.8, 8)), daisyPetal);
        petal.position.set(ox, 5.0, 0);
        p.add(petal);

        const center = new THREE.Mesh(trackGeom(new THREE.DodecahedronGeometry(1.7, 0)), daisyCenter);
        center.position.set(ox, 5.6, 0);
        p.add(center);
      }

      this.group.add(p);
      this.propRecords.push({ id: `daisies_${index}`, kind: 'daisies', gx, gy, gz, group: p });
    };

    // 21. MARIGOLDS at (2, 9, elev: 25)
    const buildMarigolds = (gx: number, gy: number, gz: number) => {
      const p = new THREE.Group();
      p.name = 'Prop_marigolds';
      p.position.copy(gridToWorld3D(gx, gy, gz));

      // Leafy base cushion
      const baseLeaves = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(6.0, 4.0, 2.2, 7)), bushGreen);
      baseLeaves.position.y = 1.1;
      p.add(baseLeaves);

      for (let i = 0; i < 4; i++) {
        const puff = new THREE.Mesh(trackGeom(new THREE.DodecahedronGeometry(3.2, 0)), orangeFlower);
        const a = (i / 4) * Math.PI * 2;
        puff.position.set(Math.cos(a) * 4.2, 4.2, Math.sin(a) * 4.2);
        p.add(puff);
      }

      this.group.add(p);
      this.propRecords.push({ id: 'marigolds', kind: 'marigolds', gx, gy, gz, group: p });
    };

    // 22. SPROUT SHRUB (3 placements)
    const buildSproutShrub = (gx: number, gy: number, gz: number, index = 0) => {
      const p = new THREE.Group();
      p.name = `Prop_sprout_shrub_${index}`;
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 10);

      const d1 = new THREE.Mesh(trackGeom(new THREE.IcosahedronGeometry(6.5, 1)), bushGreen);
      d1.position.set(0, 5.8, 0);
      d1.castShadow = true;
      p.add(d1);

      const d2 = new THREE.Mesh(trackGeom(new THREE.IcosahedronGeometry(4.5, 1)), bushLight);
      d2.position.set(-4.2, 4.5, 3.0);
      d2.castShadow = true;
      p.add(d2);

      const d3 = new THREE.Mesh(trackGeom(new THREE.IcosahedronGeometry(4.2, 1)), bushLight);
      d3.position.set(4.0, 4.2, -2.5);
      d3.castShadow = true;
      p.add(d3);

      const sprout1 = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(3.2, 0.8, 1.8)), sproutGreen);
      sprout1.position.set(1.6, 11.2, 0);
      sprout1.rotation.z = -0.35;
      p.add(sprout1);

      const sprout2 = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(3.2, 0.8, 1.8)), sproutGreen);
      sprout2.position.set(-1.4, 11.2, 0);
      sprout2.rotation.z = 0.35;
      p.add(sprout2);

      this.group.add(p);
      this.propRecords.push({ id: `sprout_shrub_${index}`, kind: 'sprout_shrub', gx, gy, gz, group: p });
    };

    // 23. BONSAI BUSH (2 placements)
    const buildBonsaiBush = (gx: number, gy: number, gz: number, index = 0) => {
      const p = new THREE.Group();
      p.name = `Prop_bonsai_bush_${index}`;
      p.position.copy(gridToWorld3D(gx, gy, gz));
      addShadow(p, 12);

      const trunk = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(2.4, 3.8, 13.0, 6)), stumpWood);
      trunk.position.set(0, 6.5, 0);
      trunk.rotation.z = 0.2;
      trunk.castShadow = true;
      p.add(trunk);

      const cloud1 = new THREE.Mesh(trackGeom(new THREE.IcosahedronGeometry(7.2, 1)), bushGreen);
      cloud1.position.set(-3.2, 13.0, 0);
      cloud1.scale.set(1.3, 0.65, 1.1);
      cloud1.castShadow = true;
      p.add(cloud1);

      const cloud2 = new THREE.Mesh(trackGeom(new THREE.IcosahedronGeometry(5.8, 1)), bushLight);
      cloud2.position.set(4.0, 11.0, 1.2);
      cloud2.scale.set(1.2, 0.6, 1.0);
      cloud2.castShadow = true;
      p.add(cloud2);

      const cloud3 = new THREE.Mesh(trackGeom(new THREE.IcosahedronGeometry(4.5, 1)), bushLight);
      cloud3.position.set(-0.5, 15.8, -1.5);
      cloud3.scale.set(1.15, 0.6, 1.0);
      cloud3.castShadow = true;
      p.add(cloud3);

      this.group.add(p);
      this.propRecords.push({ id: `bonsai_bush_${index}`, kind: 'bonsai_bush', gx, gy, gz, group: p });
    };

    // -------------------------------------------------------------------------
    // INSTANTIATE ALL 23 KINDS (33 TOTAL PLACEMENTS) - centered at (gx+0.5, gy+0.5)
    // -------------------------------------------------------------------------
    buildAFrameCottage(2.5, 2.5, elevationLookup(2, 2) ?? 52);
    buildHollowTrunk(3.5, 1.5, elevationLookup(3, 1) ?? 54);

    const pines = [
      { gx: 3, gy: 2, scale: 1.05 },
      { gx: 4, gy: 3, scale: 0.98 },
      { gx: 1, gy: 5, scale: 0.95 },
      { gx: 1, gy: 8, scale: 0.88 },
    ];
    pines.forEach((p, idx) => buildPine(p.gx + 0.5, p.gy + 0.5, elevationLookup(p.gx, p.gy) ?? 25, p.scale, idx));

    buildRoundBush(3.5, 4.5, elevationLookup(3, 4) ?? 42);
    buildMonolithStone(6.5, 2.5, elevationLookup(6, 2) ?? 34);
    buildAmanitaMushroom(7.5, 3.5, elevationLookup(7, 3) ?? 34);
    buildCampfire(2.5, 6.5, 34); // hearth elevation 34 on mulch tile (2,6)
    buildWateringCan(6.5, 6.5, elevationLookup(6, 6) ?? 25);
    buildGardenBedFrame(elevationLookup(7, 6) ?? 26);
    buildCabbage(7.5, 6.5, elevationLookup(7, 6) ?? 26);
    buildGardenSprout(7.5, 7.5, elevationLookup(7, 7) ?? 26);
    buildFrogPlanter(9.5, 6.5, elevationLookup(9, 6) ?? 25);
    buildMushroomStump(8.5, 8.5, elevationLookup(8, 8) ?? 25);
    buildFallenLog(5.5, 4.5, elevationLookup(5, 4) ?? 25);
    buildPondFrog(6.5, 9.5, 18);
    buildCattails(5.5, 5.5, 14);

    const lilypadCoords = [[5, 6], [4, 8]];
    lilypadCoords.forEach(([gx, gy], idx) => buildLilypads(gx + 0.5, gy + 0.5, 14, idx));

    buildStreamRock(5.5, 7.5, 14);
    buildPinkMushrooms(3.5, 3.5, elevationLookup(3, 3) ?? 42);

    const tulipCoords = [[5, 2], [8, 3], [1, 4]];
    tulipCoords.forEach(([gx, gy], idx) => buildTulips(gx + 0.5, gy + 0.5, elevationLookup(gx, gy) ?? 34, idx));

    const daisyCoords = [[8, 5], [6, 8]];
    daisyCoords.forEach(([gx, gy], idx) => buildDaisies(gx + 0.5, gy + 0.5, elevationLookup(gx, gy) ?? 25, idx));

    buildMarigolds(2.5, 9.5, elevationLookup(2, 9) ?? 26);

    const shrubCoords = [[4, 4], [7, 4], [3, 7]];
    shrubCoords.forEach(([gx, gy], idx) => buildSproutShrub(gx + 0.5, gy + 0.5, elevationLookup(gx, gy) ?? 34, idx));

    const bonsaiCoords = [[9, 4], [7, 9]];
    bonsaiCoords.forEach(([gx, gy], idx) => buildBonsaiBush(gx + 0.5, gy + 0.5, elevationLookup(gx, gy) ?? 25, idx));
  }

  public static build(elevationLookup: (gx: number, gy: number) => number): PropBuildResult {
    const builder = new PropBuilder(elevationLookup);
    return {
      group: builder.group,
      campfirePosition: builder.campfirePosition,
      update: (dt: number, elapsed: number) => builder.update(dt, elapsed),
      updateWeather: (weather: WeatherMode) => builder.updateWeather(weather),
      updateTimeOfDay: (timeOfDay: TimeOfDay) => builder.updateTimeOfDay(timeOfDay),
      dispose: () => builder.dispose(),
    };
  }

  public getCampfirePosition(): THREE.Vector3 {
    return this.campfirePosition;
  }

  public update(_dt: number, elapsed: number): void {
    if (this.flameGroup) {
      const flicker = 1.0 + Math.sin(elapsed * 11) * 0.08;
      this.flameGroup.scale.set(flicker, flicker * 1.05, flicker);
      this.flameGroup.rotation.y = Math.sin(elapsed * 3) * 0.15;
    }
  }

  public updateWeather(weather: WeatherMode): void {
    const foliageMat = weather === 'snow' ? this.pineSnowMat : this.pineFoliageMat;
    for (const m of this.pineMeshes) {
      m.material = foliageMat;
    }
  }

  public updateTimeOfDay(timeOfDay: TimeOfDay): void {
    const isNight = timeOfDay === 'midnight' || timeOfDay === 'evening';
    this.cottageWindowLit.color.setHex(isNight ? 0xffe680 : 0xffd666);
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.pineMeshes.length = 0;
    this.propRecords.length = 0;
    this.group.clear();
  }
}
