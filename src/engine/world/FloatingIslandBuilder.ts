import * as THREE from 'three';
import type { Palette } from '../ThreeWorldEngine';
import type { TimeOfDay, WeatherMode } from '../../types';
import { TILE_SPACING, ELEV_UNIT } from './TerrainBuilder';

interface IslandCell {
  x: number;
  z: number;
  d: number;
  pool: boolean;
  stone: boolean;
  used?: number;
}

export class FloatingIslandBuilder {
  public readonly group: THREE.Group;
  private islandPivot: THREE.Group;

  private geometries: Set<THREE.BufferGeometry> = new Set();
  private materials: Set<THREE.Material> = new Set();
  private textures: Set<THREE.Texture> = new Set();

  private waterMat!: THREE.ShaderMaterial;
  private fallMat!: THREE.ShaderMaterial;
  private foamMat!: THREE.MeshBasicMaterial;
  private grassCapMat!: THREE.MeshLambertMaterial;
  private bladesMat!: THREE.MeshLambertMaterial;
  private cloudMat!: THREE.MeshLambertMaterial;
  private lanternMat!: THREE.MeshBasicMaterial;
  private lanternGlowMat!: THREE.MeshLambertMaterial;
  private cottageWindowMat!: THREE.MeshLambertMaterial;
  private volumetricGlowMat!: THREE.ShaderMaterial;
  private shrineLight!: THREE.PointLight;
  private nightLights: THREE.PointLight[] = [];
  private isWetOrColdWeather = false;
  private isDarkTime = false;
  private volumetricScale = 1.35;

  private bladesMesh!: THREE.InstancedMesh;
  private bladeData: Array<[number, number, number, number, number]> = [];
  private pads: THREE.Mesh[] = [];
  private debris: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = [];
  private clouds: Array<{
    group: THREE.Group;
    mat: THREE.MeshLambertMaterial;
    orbitAngle: number;
    orbitRadius: number;
    baseAltitude: number;
    angularSpeed: number;
    wobblePhase: number;
    bobPhase: number;
  }> = [];
  private smokePuffs: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];
  private fireLight!: THREE.PointLight;
  private shrineFrog?: THREE.Group;
  private frogMats: THREE.MeshLambertMaterial[] = [];
  private frogOutlineMat!: THREE.MeshBasicMaterial;
  private frogHovered = false;
  private frogHoverBlend = 0;
  private frogBounceTimer = 0;
  private frogRaycaster = new THREE.Raycaster();
  private dummy = new THREE.Object3D();
  private campfireWorldPos = new THREE.Vector3();

  private seed = 11;
  private islandScale = TILE_SPACING * 0.48; // ~26.47 world units per voxel
  private islandCenter = new THREE.Vector3(-5.5 * TILE_SPACING, 26 * ELEV_UNIT, 5.5 * TILE_SPACING);

  constructor(initialPalette?: Palette) {
    this.group = new THREE.Group();
    this.group.name = 'FloatingIslandRoot';

    this.islandPivot = new THREE.Group();
    this.islandPivot.name = 'FloatingIslandPivot';
    this.islandPivot.position.copy(this.islandCenter);
    this.islandPivot.scale.setScalar(this.islandScale);
    this.group.add(this.islandPivot);

    this.buildIsland(initialPalette);
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

  private trackTex<T extends THREE.Texture>(t: T): T {
    this.textures.add(t);
    return t;
  }

  private buildIsland(pal?: Palette): void {
    const sharedMats = new Map<number, THREE.MeshLambertMaterial>();
    const M = (color: number): THREE.MeshLambertMaterial => {
      let m = sharedMats.get(color);
      if (!m) {
        m = this.trackMat(new THREE.MeshLambertMaterial({ color }));
        sharedMats.set(color, m);
      }
      return m;
    };

    const box = (
      w: number,
      h: number,
      d: number,
      c: number,
      x: number,
      y: number,
      z: number,
      parent?: THREE.Object3D,
      ry = 0
    ): THREE.Mesh => {
      const m = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), M(c));
      m.position.set(x, y, z);
      if (ry) m.rotation.y = ry;
      m.castShadow = true;
      m.receiveShadow = true;
      (parent || this.islandPivot).add(m);
      return m;
    };

    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, sh = false): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(this.trackGeo(geo), mat, n);
      m.castShadow = sh;
      m.receiveShadow = sh;
      this.islandPivot.add(m);
      return m;
    };

    const put = (
      m: THREE.InstancedMesh,
      i: number,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0
    ) => {
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(rx, ry, rz);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      m.setMatrixAt(i, this.dummy.matrix);
    };

    // 1. Grid & Voxel Terrain
    const map: Record<string, IslandCell> = {};
    const cells: IslandCell[] = [];
    const key = (x: number, z: number) => `${x},${z}`;

    for (let x = -12; x <= 12; x++) {
      for (let z = -12; z <= 12; z++) {
        const d = Math.hypot(x, z * 1.1) + (this.rnd() - 0.5) * 1.1;
        if (d < 10.2) {
          const o: IslandCell = { x, z, d, pool: false, stone: false };
          cells.push(o);
          map[key(x, z)] = o;
        }
      }
    }

    const dirt: Array<[number, number, number, number, boolean]> = [];
    const caps: Array<[number, number]> = [];
    const water: IslandCell[] = [];
    const stones: IslandCell[] = [];
    const free: IslandCell[] = [];

    for (const o of cells) {
      const { x, z } = o;
      o.pool = x >= -3 && Math.abs(z) <= (x >= 3 ? 2 : 3);
      // Clear central 7x7 pond area around shrine center (cx=1, cz=0) while keeping peripheral stones
      const inShrineFootprint = x >= -2 && x <= 3 && Math.abs(z) <= 2;
      o.stone =
        o.pool &&
        !inShrineFootprint &&
        ((x % 2) + 2) % 2 === 0 &&
        ((z % 2) + 2) % 2 === 0 &&
        this.rnd() < 0.9;
      let dep = Math.max(1, Math.round((10.4 - o.d) * 0.68 + this.rnd() * 0.8));
      const bed = o.pool && !o.stone;
      if (bed) dep = Math.max(dep, 2);
      for (let k = bed ? 1 : 0; k < dep; k++) {
        dirt.push([x, -0.5 - k, z, k / dep, bed && k === 1]);
      }
      if (!bed) caps.push([x, z]);
      if (bed) water.push(o);
      else if (o.stone) stones.push(o);
      else free.push(o);
    }

    const col = new THREE.Color();
    const dark = new THREE.Color(0x6e4538);
    const dirtMat = this.trackMat(new THREE.MeshLambertMaterial());
    const dm = inst(new THREE.BoxGeometry(0.995, 1, 0.995), dirtMat, dirt.length, true);
    dirt.forEach((d, i) => {
      put(dm, i, d[0], d[1], d[2]);
      col.set(d[4] ? 0xc9955f : 0xb86b48).lerp(dark, d[3] * 0.8).offsetHSL(0, 0, (this.rnd() - 0.5) * 0.06);
      dm.setColorAt(i, col);
    });
    dm.instanceMatrix.needsUpdate = true;
    if (dm.instanceColor) dm.instanceColor.needsUpdate = true;

    this.grassCapMat = this.trackMat(new THREE.MeshLambertMaterial());
    const cm = inst(new THREE.BoxGeometry(1, 0.32, 1), this.grassCapMat, caps.length, true);
    caps.forEach((c, i) => {
      put(cm, i, c[0], -0.14, c[1]);
      col.set(0x82c92f).offsetHSL((this.rnd() - 0.5) * 0.03, 0, (this.rnd() - 0.3) * 0.08);
      cm.setColorAt(i, col);
    });
    cm.instanceMatrix.needsUpdate = true;
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;

    // 2. Water Pool, Shoreline Foam & Waterfall (exact shaders from floating-island.html)
    this.waterMat = this.trackMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: 0 } },
        vertexShader:
          'varying vec3 vW;void main(){vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
        fragmentShader: `uniform float uT;varying vec3 vW;
          vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
          vec2 vor(vec2 p){vec2 i=floor(p),f=fract(p);float a=8.,b=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=.5+.5*sin(uT*.6+6.2831*h2(i+g));float d=length(g+o-f);if(d<a){b=a;a=d;}else if(d<b)b=d;}return vec2(a,b);}
          void main(){vec2 p=vW.xz*0.045+vec2(sin(vW.z*0.06+uT),cos(vW.x*0.06+uT))*.05;
          vec2 v=vor(p);float e=1.-smoothstep(0.,.12,v.y-v.x);vec2 v2=vor(p*2.3+7.);float e2=1.-smoothstep(0.,.1,v2.y-v2.x);
          vec3 c=mix(vec3(.08,.55,.85),vec3(.2,.85,.88),v.x*.9+.1);c+=e*vec3(.55,.9,.9)*.38+e2*.12;
          float sp=step(.985,fract(sin(dot(floor(vW.xz*0.35),vec2(12.9,78.2)))*43758.5))*(.5+.5*sin(uT*3.+vW.x*0.35));
          gl_FragColor=vec4(c+sp*.35,.84);}`,
      })
    );
    const wm = inst(new THREE.PlaneGeometry(1.001, 1.001).rotateX(-Math.PI / 2), this.waterMat, water.length);
    water.forEach((o, i) => put(wm, i, o.x, -0.3, o.z));
    wm.instanceMatrix.needsUpdate = true;

    const fc = typeof document !== 'undefined' && document.createElement
      ? document.createElement('canvas')
      : ({ width: 4, height: 64, getContext: () => null } as unknown as HTMLCanvasElement);
    fc.width = 4;
    fc.height = 64;
    const fg = fc.getContext('2d');
    if (fg) {
      const gr = fg.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, 'rgba(255,255,255,.95)');
      gr.addColorStop(0.35, 'rgba(255,255,255,.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      fg.fillStyle = gr;
      fg.fillRect(0, 0, 4, 64);
    }

    const strips: Array<[number, number, number]> = [];
    const falls: IslandCell[] = [];
    for (const o of water) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = map[key(o.x + dx, o.z + dz)];
        if (n && (!n.pool || n.stone)) {
          strips.push([o.x + dx * 0.275, o.z + dz * 0.275, Math.atan2(-dx, -dz)]);
        }
        if (!n && dx === 1) falls.push(o);
      }
    }

    this.foamMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: this.trackTex(new THREE.CanvasTexture(fc)),
        transparent: true,
        depthWrite: false,
      })
    );
    const fm = inst(new THREE.PlaneGeometry(1, 0.45).rotateX(-Math.PI / 2), this.foamMat, strips.length);
    strips.forEach((s, i) => put(fm, i, s[0], -0.29, s[1], 0, s[2], 0));
    fm.instanceMatrix.needsUpdate = true;

    this.fallMat = this.trackMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uT: { value: 0 } },
        vertexShader:
          'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);}',
        fragmentShader: `uniform float uT;varying vec2 vU;void main(){float st=sin(vU.x*40.+sin(vU.y*6.)*2.)*.5+.5;float fl=sin(vU.y*22.+uT*6.+vU.x*5.)*.5+.5;
          vec3 c=mix(vec3(.2,.8,.92),vec3(.95,1.,1.),fl*st);gl_FragColor=vec4(c,smoothstep(0.,.45,vU.y)*(.55+.35*fl));}`,
      })
    );
    if (falls.length > 0) {
      const wf = inst(new THREE.PlaneGeometry(1, 5), this.fallMat, falls.length);
      falls.forEach((o, i) => put(wf, i, o.x + 0.53, -2.8, o.z, 0, Math.PI / 2, 0));
      wf.instanceMatrix.needsUpdate = true;
    }

    // 3. Stone Props in Pool
    stones.forEach((o, i) => {
      const g = new THREE.Group();
      g.position.set(o.x, 0, o.z);
      g.rotation.y = this.rnd() * 6.28;
      this.islandPivot.add(g);
      const t = i % 6;
      if (t === 0) {
        box(0.65, 0.35, 0.65, 0x8fcf2a, 0, 0.17, 0, g);
        box(0.4, 0.3, 0.4, 0xa3da3a, 0, 0.45, 0, g);
      } else if (t === 1) {
        box(0.2, 0.45, 0.5, 0xd9703c, -0.22, 0.22, 0, g);
        box(0.2, 0.45, 0.5, 0xd9703c, 0.22, 0.22, 0, g);
        box(0.65, 0.2, 0.5, 0xd9703c, 0, 0.55, 0, g);
        box(0.28, 0.28, 0.28, 0xf0b440, 0, 0.8, 0, g);
      } else if (t === 2) {
        box(0.4, 0.4, 0.4, 0x9a90b8, -0.12, 0.2, 0.05, g);
        box(0.35, 0.55, 0.35, 0xb0a6c8, 0.18, 0.28, -0.08, g);
        box(0.25, 0.25, 0.25, 0x8a80a8, 0.05, 0.52, 0.1, g);
      } else if (t === 3) {
        box(0.35, 0.28, 0.35, 0x84c82f, 0, 0.14, 0, g);
        const a = box(0.12, 0.55, 0.08, 0x7ccb2b, -0.1, 0.5, 0, g);
        a.rotation.z = 0.35;
        const b = box(0.12, 0.55, 0.08, 0x8ad632, 0.1, 0.5, 0, g);
        b.rotation.z = -0.35;
      } else if (t === 4) {
        box(0.45, 0.3, 0.45, 0xd0703a, 0, 0.15, 0, g);
        box(0.3, 0.3, 0.3, 0xe05a9a, 0, 0.45, 0, g);
      } else {
        const m = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 8)), M(0xe86a3a));
        m.position.y = 0.06;
        m.castShadow = true;
        g.add(m);
        box(0.16, 0.12, 0.16, 0xf3d07a, 0.3, 0.06, 0.1, g);
      }
    });

    const keep = (o: IslandCell) => {
      const { x, z } = o;
      return (
        (x > -9.5 && x < -3.2 && z > -7.5 && z < -1.4) ||
        (x > -10 && x < -4.5 && z > 1 && z < 5.8) ||
        (x > -3 && x < 6.5 && z < -3.2) ||
        (x >= -5 && x <= 1 && z >= 1 && z <= 5)
      );
    };

    // 4. Trees, Paving, Swaying Grass Blades & Pebbles
    free.sort(() => this.rnd() - 0.5);
    const placed: IslandCell[] = [];
    const tree = (x: number, z: number, s: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      g.rotation.y = this.rnd() * 6.28;
      this.islandPivot.add(g);
      box(0.45, 1.1, 0.45, 0x7a3f33, 0, 0.55, 0, g);
      box(1.5, 1, 1.5, 0x84c42b, 0, 1.5, 0, g);
      box(1.1, 0.9, 1.1, 0x95d12f, 0, 2.35, 0, g);
      box(0.7, 0.7, 0.7, 0xa6dc3a, 0, 3, 0, g);
    };

    for (const o of free) {
      if (placed.length >= 14) break;
      if (o.d < 2.5 || (o.x < -3 && Math.abs(o.z) <= 1) || keep(o)) continue;
      if (placed.some((p) => Math.hypot(p.x - o.x, p.z - o.z) < 2.6)) continue;
      placed.push(o);
      o.used = 1;
      tree(o.x, o.z, 0.8 + this.rnd() * 0.45);
    }

    for (const o of free) {
      if (o.x < -3 && Math.abs(o.z) <= 1 && !o.used) {
        o.used = 1;
        box(0.88, 0.08, 0.88, this.rnd() < 0.5 ? 0xe3a98c : 0xc9a9c4, o.x, 0.03, o.z);
      }
    }

    const pick = free.filter((o) => !o.used).slice(0, 170);
    this.bladesMat = this.trackMat(new THREE.MeshLambertMaterial());
    this.bladesMesh = inst(
      new THREE.BoxGeometry(0.08, 0.55, 0.08).translate(0, 0.27, 0),
      this.bladesMat,
      pick.length * 3,
      true
    );
    pick.forEach((o) => {
      const bx = o.x + (this.rnd() - 0.5) * 0.6;
      const bz = o.z + (this.rnd() - 0.5) * 0.6;
      for (let k = 0; k < 3; k++) {
        this.bladeData.push([
          bx + (k - 1) * 0.1,
          bz + (this.rnd() - 0.5) * 0.1,
          this.rnd() * 6,
          (this.rnd() - 0.5) * 0.5,
          (this.rnd() - 0.5) * 0.5,
        ]);
        this.bladesMesh.setColorAt(
          this.bladeData.length - 1,
          col.set(this.rnd() < 0.5 ? 0x72c42a : 0xa3dc3c)
        );
      }
    });
    if (this.bladesMesh.instanceColor) this.bladesMesh.instanceColor.needsUpdate = true;

    for (const o of free.filter((x) => !x.used).slice(170, 180)) {
      box(0.45, 0.4, 0.45, 0xb0a6c8, o.x, 0.2, o.z, undefined, this.rnd());
    }

    // 5. Humble Abode, Campfire, Garden Beds, Well, Frogs, Flowers
    const G = (x: number, z: number, ry = 0) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      if (ry) g.rotation.y = ry;
      this.islandPivot.add(g);
      return g;
    };
    const cyl = (r: number, h: number, c: number, x: number, y: number, z: number, p?: THREE.Object3D) => {
      const m = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(r, r, h, 10)), M(c));
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      (p || this.islandPivot).add(m);
      return m;
    };
    const frog = (x: number, z: number, s: number, c: number, ry: number) => {
      const g = G(x, z, ry);
      box(0.8 * s, 0.5 * s, 0.7 * s, c, 0, 0.27 * s, 0, g);
      for (const e of [-1, 1]) {
        box(0.2 * s, 0.2 * s, 0.2 * s, c, e * 0.22 * s, 0.6 * s, 0.2 * s, g);
        box(0.08 * s, 0.08 * s, 0.08 * s, 0x222222, e * 0.22 * s, 0.62 * s, 0.31 * s, g);
      }
      box(0.5 * s, 0.08 * s, 0.1 * s, 0xc9d87a, 0, 0.3 * s, 0.36 * s, g);
    };
    const shroom = (x: number, z: number, s: number, c: number) => {
      const g = G(x, z);
      box(0.1 * s, 0.3 * s, 0.1 * s, 0xf0e2c8, 0, 0.15 * s, 0, g);
      box(0.3 * s, 0.14 * s, 0.3 * s, c, 0, 0.36 * s, 0, g);
    };
    const flower = (x: number, z: number, c: number) => {
      const g = G(x, z, this.rnd() * Math.PI * 2);
      const variant = Math.floor(this.rnd() * 3);

      if (variant === 0) {
        // 4-petal Daisy Blossom with golden stamen & angled leaves
        box(0.055, 0.34, 0.055, 0x6fb02b, 0, 0.17, 0, g);
        for (const s of [-1, 1]) {
          const leaf = box(0.14, 0.04, 0.07, 0x569620, s * 0.08, 0.09, 0, g);
          leaf.rotation.z = s * 0.45;
        }
        const head = new THREE.Group();
        head.position.set(0, 0.36, 0);
        head.rotation.x = 0.2;
        g.add(head);
        box(0.1, 0.08, 0.1, 0xffd646, 0, 0.02, 0, head);
        for (const [px, pz] of [
          [0.11, 0],
          [-0.11, 0],
          [0, 0.11],
          [0, -0.11],
        ] as const) {
          box(0.1, 0.06, 0.1, c, px, 0.0, pz, head);
        }
      } else if (variant === 1) {
        // Layered Cupped Tulip
        box(0.06, 0.38, 0.06, 0x62a324, 0, 0.19, 0, g);
        for (const s of [-1, 1]) {
          const leaf = box(0.05, 0.22, 0.08, 0x4f8a1b, s * 0.06, 0.12, 0, g);
          leaf.rotation.z = -s * 0.28;
        }
        box(0.18, 0.12, 0.18, c, 0, 0.4, 0, g);
        for (const [px, pz] of [
          [0.08, 0],
          [-0.08, 0],
          [0, 0.08],
          [0, -0.08],
        ] as const) {
          box(0.07, 0.12, 0.07, c, px, 0.49, pz, g);
        }
        box(0.08, 0.08, 0.08, 0xffe478, 0, 0.48, 0, g);
      } else {
        // Multi-stem Wildflower Cluster
        const stems: Array<[number, number, number]> = [
          [-0.07, 0.28, -0.04],
          [0.08, 0.36, 0.05],
          [0.01, 0.22, 0.09],
        ];
        for (const [sx, sh, sz] of stems) {
          box(0.04, sh, 0.04, 0x69ab29, sx, sh * 0.5, sz, g);
          box(0.13, 0.08, 0.13, c, sx, sh + 0.03, sz, g);
          box(0.06, 0.05, 0.06, 0xffe066, sx, sh + 0.08, sz, g);
        }
      }
    };
    const barrel = (g: THREE.Object3D, x: number, y: number, z: number, ax: 'x' | 'z' | null) => {
      const b = new THREE.Group();
      b.position.set(x, y, z);
      if (ax === 'z') b.rotation.x = Math.PI / 2;
      else if (ax === 'x') b.rotation.z = Math.PI / 2;
      g.add(b);
      cyl(0.3, 0.55, 0xd9905a, 0, 0, 0, b);
      for (const k of [-0.17, 0.17]) cyl(0.32, 0.05, 0x9a9a90, 0, k, 0, b);
      return b;
    };

    // Volumetric lantern & campfire light-cone shader (soft Fresnel & vertical falloff)
    this.volumetricGlowMat = this.trackMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color('#ffbd66') },
          uIntensity: { value: 0.1 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalView;
          varying vec3 vViewPos;
          void main() {
            vUv = uv;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vViewPos = -mvPos.xyz;
            vNormalView = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec2 vUv;
          varying vec3 vNormalView;
          varying vec3 vViewPos;
          void main() {
            float fresnel = pow(abs(dot(normalize(vNormalView), normalize(vViewPos))), 1.7);
            float vertFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
            float alpha = fresnel * vertFade * uIntensity;
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(uColor * alpha, alpha);
          }
        `,
      })
    );

    const addVolumetricCone = (
      parent: THREE.Object3D,
      x: number,
      y: number,
      z: number,
      radius: number,
      height: number
    ) => {
      const geo = this.trackGeo(new THREE.ConeGeometry(radius, height, 14, 1, true));
      const cone = new THREE.Mesh(geo, this.volumetricGlowMat);
      cone.position.set(x, y, z);
      cone.raycast = () => {};
      parent.add(cone);
    };

    // Campfire local & world position
    this.campfireWorldPos.set(-7, 1, 2.8).multiplyScalar(this.islandScale).add(this.islandCenter);
    this.fireLight = new THREE.PointLight(0xff9a40, 120, 180, 1.3);
    this.fireLight.position.set(-7, 1, 2.8);
    this.islandPivot.add(this.fireLight);
    addVolumetricCone(this.islandPivot, -7, 1.05, 2.8, 1.25, 1.7);

    // Cottage
    {
      const g = G(-6.4, -3.8);
      const W = 0xf4efe6;
      const Tm = 0xc97a4a;
      box(2.4, 0.18, 2.8, 0xb8b0a8, 0, 0.09, 0, g);
      box(2.2, 1.4, 2.6, W, 0, 0.88, 0, g);
      for (const e of [-1, 1]) {
        box(0.2, 1.45, 0.2, Tm, e * 1.1, 0.9, 1.3, g);
        box(0.2, 1.45, 0.2, Tm, e * 1.1, 0.9, -1.3, g);
        box(0.14, 0.14, 2.6, Tm, e * 1.1, 1.5, 0, g);
      }
      box(2.2, 0.14, 0.16, Tm, 0, 1.5, 1.32, g);
      box(0.9, 0.14, 0.16, Tm, -0.45, 1.1, 1.33, g);
      for (const [w, y] of [[1.8, 1.7], [1.2, 2], [0.6, 2.3]] as const) {
        box(w, 0.3, 0.1, W, 0, y, 1.28, g);
        box(w, 0.3, 0.1, W, 0, y, -1.28, g);
      }
      box(0.5, 0.95, 0.06, 0xb8743f, -0.45, 0.66, 1.31, g);
      box(0.07, 1, 0.1, Tm, -0.74, 0.68, 1.33, g);
      box(0.07, 1, 0.1, Tm, -0.16, 0.68, 1.33, g);
      this.cottageWindowMat = this.trackMat(
        new THREE.MeshLambertMaterial({
          color: 0xbfe3f0,
          emissive: 0xffc864,
          emissiveIntensity: 0.1,
        })
      );
      const winMesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.45, 0.45, 0.06)), this.cottageWindowMat);
      winMesh.position.set(0.55, 0.95, 1.31);
      g.add(winMesh);
      box(0.58, 0.58, 0.04, Tm, 0.55, 0.95, 1.3, g);
      box(0.9, 0.16, 0.5, 0xc9a97a, -0.45, 0.08, 1.6, g);

      // Warm porch light outside the cottage door & window
      const cottageLight = new THREE.PointLight(0xffb454, 45, 175, 1.35);
      cottageLight.position.set(0.15, 1.35, 2.05);
      g.add(cottageLight);
      this.nightLights.push(cottageLight);
      addVolumetricCone(g, 0.15, 0.8, 1.85, 1.05, 1.5);
      for (const s of [-1, 1]) {
        for (let r = 0; r < 5; r++) {
          for (let j = 0; j < 3; j++) {
            const d = (r + 0.5) * 0.38;
            const th = r % 2 ? 0.16 : 0.12;
            const c = [0x9a5a62, 0x8a4a58, 0xa86a6a][(r + j) % 3];
            box(0.38, th, 1.07, c, s * (1.45 - d * 0.765), 1.61 + d * 0.644, (j - 1) * 1.07 + (r % 2 ? 0.2 : 0), g).rotation.z =
              -s * 0.7;
          }
        }
      }
      box(0.2, 0.14, 3.3, 0x7a3f4a, 0, 2.83, 0, g);
      box(0.55, 0.8, 0.55, 0xd8cfc8, 0.85, 2.45, -0.7, g);
      box(0.5, 0.6, 0.5, 0xe4dcd4, 0.85, 3.15, -0.7, g);
      box(0.45, 0.5, 0.45, 0xd8cfc8, 0.85, 3.7, -0.7, g);
      box(0.25, 0.02, 0.25, 0x4a4040, 0.85, 3.96, -0.7, g);
      const b = barrel(g, 0, 1.95, 1.45, 'z');
      b.scale.setScalar(1.25);
      cyl(0.28, 0.02, 0xf0c080, 0, 0.28, 0, b);
      barrel(g, 1.75, 0.3, 0.9, 'x');
      barrel(g, 1.75, 0.3, 0.3, 'x');
      barrel(g, 1.75, 0.8, 0.6, 'x');
    }
    barrel(G(-8.1, -1.2), 0, 0.28, 0, null);

    // Chimney smoke
    for (let i = 0; i < 5; i++) {
      const sm = new THREE.Mesh(
        this.trackGeo(new THREE.SphereGeometry(0.28, 8, 6)),
        this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }))
      );
      this.islandPivot.add(sm);
      this.smokePuffs.push(sm);
    }

    // Fence, stepping stones, mailbox, woodpile
    for (let x = -8.2; x <= -4; x += 0.6) {
      if (x < -7.5 || x > -6.3) box(0.12, 0.55, 0.12, 0xe8d0a0, x, 0.28, -2);
    }
    for (let z = -2.6; z >= -6; z -= 0.6) box(0.12, 0.55, 0.12, 0xe8d0a0, -4, 0.28, z);
    box(0.8, 0.08, 0.06, 0xe8d0a0, -7.9, 0.4, -2);
    box(2.4, 0.08, 0.06, 0xe8d0a0, -5.1, 0.4, -2);
    box(0.06, 0.08, 4, 0xe8d0a0, -4, 0.4, -4);
    box(0.8, 0.07, 0.5, 0xc9a9c4, -6.9, 0.03, -1.45);
    box(0.8, 0.07, 0.5, 0xe3a98c, -6.9, 0.03, -2.05);
    box(0.1, 0.8, 0.1, 0x8a5a3a, -3.7, 0.4, -1.7);
    box(0.45, 0.3, 0.3, 0x3f6fb0, -3.7, 0.95, -1.7);
    box(0.05, 0.25, 0.05, 0xe0402a, -3.5, 1.1, -1.7);
    for (const [y, z] of [[0.1, -3], [0.1, -3.35], [0.1, -3.7], [0.3, -3.17], [0.3, -3.52], [0.5, -3.35]] as const) {
      box(0.9, 0.2, 0.3, 0xb07a45, -8.2, y, z);
    }

    // Detailed Glowing Campfire + Stumps
    {
      const g = G(-7, 2.8);
      // Charred ash pit & glowing ember bed
      cyl(0.76, 0.04, 0x3b2a22, 0, 0.025, 0, g);
      const emberMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
      const emberHotMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffa62b }));
      for (let e = 0; e < 6; e++) {
        const ea = (e / 6) * Math.PI * 2 + 0.3;
        const er = 0.14 + (e % 2) * 0.12;
        const em = new THREE.Mesh(
          this.trackGeo(new THREE.BoxGeometry(0.16, 0.07, 0.16)),
          e % 2 === 0 ? emberMat : emberHotMat
        );
        em.position.set(Math.cos(ea) * er, 0.06, Math.sin(ea) * er);
        em.rotation.y = ea;
        g.add(em);
      }

      // Varied cobblestone fire ring
      const stoneShades = [0x82848a, 0x9a9c9f, 0x72747a];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + (i % 2) * 0.08;
        const sw = 0.18 + (i % 3) * 0.04;
        const sh = 0.14 + ((i + 1) % 3) * 0.035;
        const sd = 0.2 + (i % 2) * 0.04;
        box(sw, sh, sd, stoneShades[i % 3], Math.cos(a) * 0.63, sh * 0.5 + 0.02, Math.sin(a) * 0.63, g, a + 0.2);
      }

      // Crossed base logs & angled tepee logs
      box(0.84, 0.14, 0.15, 0x6b3f24, 0, 0.11, 0, g, 0.35);
      box(0.82, 0.14, 0.15, 0x5c341d, 0, 0.14, 0, g, 1.92);
      for (let l = 0; l < 4; l++) {
        const la = (l / 4) * Math.PI * 2 + 0.45;
        const log = box(0.14, 0.56, 0.14, l % 2 === 0 ? 0x784829 : 0x63391f, Math.cos(la) * 0.22, 0.26, Math.sin(la) * 0.22, g, la);
        log.rotation.z = Math.cos(la) * 0.55;
        log.rotation.x = -Math.sin(la) * 0.55;
      }

      // Multi-layered self-luminous voxel flames
      const flameOuterMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xff621f }));
      const flameMidMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffa624 }));
      const flameCoreMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffe875 }));

      const addFlame = (w: number, h: number, d: number, mat: THREE.MeshBasicMaterial, x: number, y: number, z: number, ry = 0) => {
        const fm = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
        fm.position.set(x, y, z);
        fm.rotation.y = ry;
        g.add(fm);
        this.flames.push(fm);
        return fm;
      };

      addFlame(0.34, 0.36, 0.34, flameOuterMat, 0, 0.34, 0, 0.3);
      addFlame(0.22, 0.46, 0.22, flameMidMat, 0.06, 0.46, -0.05, 0.8);
      addFlame(0.2, 0.42, 0.2, flameMidMat, -0.08, 0.44, 0.06, 0.1);
      addFlame(0.15, 0.52, 0.15, flameCoreMat, 0, 0.54, 0, 0.45);
      addFlame(0.08, 0.1, 0.08, flameCoreMat, 0.08, 0.9, 0.04, 0.2);
    }
    cyl(0.28, 0.36, 0xb07a45, -8.4, 0.18, 2.1);
    cyl(0.28, 0.36, 0xb07a45, -5.7, 0.18, 3.6);
    cyl(0.28, 0.36, 0xb07a45, -8.3, 0.18, 4.1);
    box(1.2, 0.3, 0.4, 0xb07a45, -7, 0.15, 5.3);

    // Garden beds, crops, harvest crate, scarecrow, well, lantern
    const gardenBed = (x: number, z: number) => {
      const g = G(x, z);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(0.16, 0.38, 0.16, 0x8c5632, sx * 1.12, 0.19, sz * 0.52, g);
          box(0.18, 0.05, 0.18, 0xa86f3e, sx * 1.12, 0.39, sz * 0.52, g);
        }
        box(0.1, 0.13, 1.02, 0xb87432, sx * 1.12, 0.065, 0, g);
        box(0.1, 0.14, 1.02, 0xcc8840, sx * 1.12, 0.21, 0, g);
      }
      for (const sz of [-1, 1]) {
        box(2.22, 0.13, 0.1, 0xc47e39, 0, 0.065, sz * 0.52, g);
        box(2.22, 0.14, 0.1, 0xd69249, 0, 0.21, sz * 0.52, g);
      }
      // Rich dark soil + tilled furrows
      box(2.14, 0.24, 0.94, 0x6e3d24, 0, 0.12, 0, g);
      for (const fz of [-0.26, 0, 0.26]) {
        box(2.04, 0.07, 0.16, 0x824a2e, 0, 0.26, fz, g);
      }
    };
    gardenBed(2, -6);
    gardenBed(4.8, -6);

    const buildCabbage = (x: number, z: number, ry: number, scale = 1) => {
      const g = G(x, z, ry);
      if (scale !== 1) g.scale.setScalar(scale);
      box(0.32, 0.06, 0.32, 0x5c321c, 0, 0.29, 0, g);
      box(0.18, 0.07, 0.24, 0x4b8736, 0.17, 0.37, 0, g).rotation.z = -0.35;
      box(0.18, 0.07, 0.24, 0x4b8736, -0.17, 0.37, 0, g).rotation.z = 0.35;
      box(0.24, 0.07, 0.18, 0x56963e, 0, 0.37, 0.17, g).rotation.x = 0.35;
      box(0.24, 0.07, 0.18, 0x56963e, 0, 0.37, -0.17, g).rotation.x = -0.35;
      box(0.3, 0.2, 0.3, 0x67ad48, 0, 0.42, 0, g);
      box(0.24, 0.22, 0.24, 0x7cc458, 0.02, 0.46, -0.01, g, 0.3);
      box(0.16, 0.1, 0.16, 0x98db72, 0, 0.56, 0, g, -0.2);
    };
    buildCabbage(1.32, -6.02, 0.15, 0.96);
    buildCabbage(2.0, -5.96, -0.25, 1.05);
    buildCabbage(2.68, -6.03, 0.4, 0.92);

    const buildCarrot = (x: number, z: number, ry: number, scale = 1) => {
      const g = G(x, z, ry);
      if (scale !== 1) g.scale.setScalar(scale);
      box(0.18, 0.06, 0.18, 0x5c321c, 0, 0.29, 0, g);
      box(0.14, 0.1, 0.14, 0xe87a1e, 0, 0.34, 0, g);
      box(0.11, 0.06, 0.11, 0xf59433, 0, 0.4, 0, g);
      box(0.05, 0.22, 0.05, 0x5ca824, 0, 0.52, 0, g);
      box(0.05, 0.2, 0.04, 0x76c930, -0.06, 0.53, 0.02, g).rotation.z = 0.32;
      box(0.05, 0.19, 0.04, 0x8ad941, 0.06, 0.52, -0.02, g).rotation.z = -0.34;
      box(0.04, 0.17, 0.05, 0x67b828, 0, 0.51, -0.05, g).rotation.x = -0.28;
    };
    for (let i = 0; i < 3; i++) {
      buildCarrot(4.18 + i * 0.62, -5.82, i * 0.7, 0.98);
      buildCarrot(4.32 + i * 0.56, -6.2, i * 0.9 + 0.4, 0.92);
    }

    // Small harvest crate between the two beds
    {
      const g = G(3.4, -5.95, -0.18);
      box(0.36, 0.2, 0.32, 0xb3763b, 0, 0.1, 0, g);
      box(0.38, 0.22, 0.06, 0x8c5632, 0, 0.11, 0.14, g);
      box(0.38, 0.22, 0.06, 0x8c5632, 0, 0.11, -0.14, g);
      box(0.16, 0.14, 0.16, 0x67ad48, -0.07, 0.23, 0, g, 0.2);
      box(0.08, 0.12, 0.08, 0xe87a1e, 0.08, 0.22, 0.04, g).rotation.z = -0.4;
      box(0.06, 0.08, 0.06, 0x76c930, 0.12, 0.26, 0.04, g).rotation.z = -0.4;
    }

    // Detailed Voxel Scarecrow
    {
      const g = G(3.4, -7.4, 0.08);
      // Base mound & timber cross
      box(0.32, 0.1, 0.32, 0x7a4f32, 0, 0.05, 0, g);
      box(0.12, 1.55, 0.12, 0x6b4226, 0, 0.78, 0, g);
      box(1.24, 0.1, 0.1, 0x7a4a2a, 0, 1.14, 0, g);

      // Tunic, sleeves, patch & twine ties
      box(0.42, 0.52, 0.32, 0xd4a448, 0, 0.98, 0, g);
      box(0.14, 0.16, 0.04, 0xb07538, 0.1, 0.9, 0.16, g);
      box(0.44, 0.07, 0.34, 0x8f6236, 0, 0.76, 0, g);
      box(0.92, 0.22, 0.22, 0xc7953c, 0, 1.14, 0, g);
      // Frayed straw tufts at cuffs & hem
      box(0.14, 0.14, 0.14, 0xe8cb68, -0.52, 1.14, 0, g, 0.3);
      box(0.14, 0.14, 0.14, 0xe8cb68, 0.52, 1.14, 0, g, -0.3);
      box(0.36, 0.1, 0.26, 0xe8cb68, 0, 0.69, 0, g);

      // Red bandana scarf
      box(0.34, 0.1, 0.32, 0xb84335, 0, 1.24, 0, g);
      box(0.12, 0.18, 0.08, 0xa33629, 0.06, 1.14, 0.17, g).rotation.z = -0.2;
      box(0.24, 0.07, 0.24, 0x8f6236, 0, 1.29, 0, g);

      // Burlap head, button eyes & carrot nose
      box(0.32, 0.32, 0.32, 0xe8d0a0, 0, 1.44, 0, g);
      box(0.05, 0.05, 0.04, 0x24201c, -0.08, 1.47, 0.16, g);
      box(0.05, 0.05, 0.04, 0x24201c, 0.08, 1.47, 0.16, g);
      box(0.05, 0.05, 0.08, 0xe67a22, 0, 1.42, 0.18, g);

      // Tilted wide-brimmed straw hat
      const hat = new THREE.Group();
      hat.position.set(0, 1.6, 0);
      hat.rotation.set(-0.06, 0.12, 0.06);
      g.add(hat);
      box(0.64, 0.06, 0.64, 0x8a5630, 0, 0, 0, hat);
      box(0.36, 0.07, 0.36, 0xb84335, 0, 0.06, 0, hat);
      box(0.32, 0.2, 0.32, 0x7a4a2a, 0, 0.16, 0, hat);
      box(0.24, 0.05, 0.24, 0x6b3e20, 0, 0.27, 0, hat);

      // Tiny crow perched on right arm
      box(0.12, 0.11, 0.18, 0x262830, 0.44, 1.3, 0, g);
      box(0.09, 0.09, 0.09, 0x262830, 0.44, 1.38, 0.06, g);
      box(0.04, 0.03, 0.06, 0xe09f2d, 0.44, 1.37, 0.12, g);
      box(0.08, 0.04, 0.1, 0x1c1e24, 0.44, 1.28, -0.12, g).rotation.x = 0.35;
    }
    // Detailed Voxel Wishing Well
    {
      const g = G(-1.5, -4.8);
      // Stepped cobblestone plinth
      box(1.28, 0.12, 1.28, 0x7c7e82, 0, 0.06, 0, g);
      // Hollow 4-sided stone wall ring around recessed water
      box(1.12, 0.44, 0.2, 0x929498, 0, 0.34, 0.46, g);
      box(1.12, 0.44, 0.2, 0x888a8e, 0, 0.34, -0.46, g);
      box(0.2, 0.44, 0.72, 0x8e9094, -0.46, 0.34, 0, g);
      box(0.2, 0.44, 0.72, 0x989a9e, 0.46, 0.34, 0, g);
      // Staggered stone cap bricks + moss accent
      box(1.2, 0.1, 0.24, 0xa8aaae, 0, 0.58, 0.46, g);
      box(1.2, 0.1, 0.24, 0x9ea0a4, 0, 0.58, -0.46, g);
      box(0.24, 0.1, 0.76, 0xa2a4a8, -0.46, 0.58, 0, g);
      box(0.24, 0.1, 0.76, 0xaab0b4, 0.46, 0.58, 0, g);
      box(0.24, 0.08, 0.22, 0x76a83b, -0.46, 0.65, 0.44, g);
      // Recessed shimmering water inside the well
      box(0.72, 0.08, 0.72, 0x24749c, 0, 0.32, 0, g);
      box(0.45, 0.04, 0.45, 0x45a3c9, -0.05, 0.36, 0.05, g);

      // Timber support posts & braces
      for (const s of [-1, 1]) {
        box(0.12, 1.18, 0.12, 0x6b4226, s * 0.48, 0.98, 0, g);
        box(0.16, 0.12, 0.18, 0x57341d, s * 0.48, 0.66, 0, g);
      }
      // Windlass roller axle + crank handle
      cyl(0.065, 1.12, 0xa86f3e, 0, 1.18, 0, g).rotation.z = Math.PI / 2;
      box(0.06, 0.2, 0.06, 0x55585e, 0.6, 1.12, 0.06, g);
      box(0.14, 0.05, 0.05, 0x55585e, 0.66, 1.04, 0.06, g);
      // Hanging rope & wooden water bucket
      box(0.035, 0.52, 0.035, 0xd8c398, 0, 0.9, 0, g);
      cyl(0.14, 0.22, 0x8f5830, 0, 0.56, 0, g);
      cyl(0.15, 0.04, 0x4d4f54, 0, 0.65, 0, g);

      // Stepped shingled gable roof (matching cottage palette)
      for (let tier = 0; tier < 3; tier++) {
        const yOff = 1.46 + tier * 0.14;
        const zOff = 0.38 - tier * 0.14;
        const shade = [0x8d5058, 0x9e5e64, 0x7a424c][tier];
        for (const s of [-1, 1]) {
          box(1.36, 0.11, 0.34, shade, 0, yOff, s * zOff, g);
        }
      }
      // Wooden ridge beam & gable trim
      box(1.42, 0.12, 0.18, 0x6b4226, 0, 1.82, 0, g);
      box(0.1, 0.14, 0.14, 0x8c5632, -0.68, 1.86, 0, g);
      box(0.1, 0.14, 0.14, 0x8c5632, 0.68, 1.86, 0, g);
    }
    {
      const g = G(-3.9, 1.9);
      box(0.1, 1.4, 0.1, 0x5a3a2a, 0, 0.7, 0, g);
      this.lanternMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffe28a }));
      const l = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.3, 0.34, 0.3)), this.lanternMat);
      l.position.y = 1.5;
      g.add(l);
      box(0.4, 0.08, 0.4, 0x5a3a2a, 0, 1.72, 0, g);

      const pathLight = new THREE.PointLight(0xffb85c, 45, 175, 1.35);
      pathLight.position.set(0, 1.65, 0);
      g.add(pathLight);
      this.nightLights.push(pathLight);
      addVolumetricCone(g, 0, 0.9, 0, 0.95, 1.55);
    }

    // Extra stone lanterns + warm lights for the garden/well & eastern grove at night
    for (const [lx, lz] of [
      [0.2, -5.0],
      [5.4, 1.8],
    ] as const) {
      const g = G(lx, lz);
      box(0.32, 0.14, 0.32, 0x8a8c90, 0, 0.07, 0, g);
      box(0.14, 0.44, 0.14, 0x9a9c9f, 0, 0.36, 0, g);
      box(0.28, 0.08, 0.28, 0x8a8c90, 0, 0.62, 0, g);
      const glow = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.2, 0.22, 0.2)), this.lanternMat);
      glow.position.y = 0.77;
      g.add(glow);
      box(0.38, 0.1, 0.38, 0x76787d, 0, 0.93, 0, g);
      box(0.16, 0.1, 0.16, 0x8a8c90, 0, 1.03, 0, g);

      const stoneLight = new THREE.PointLight(0xffb454, 45, 175, 1.35);
      stoneLight.position.set(0, 0.9, 0);
      g.add(stoneLight);
      this.nightLights.push(stoneLight);
      addVolumetricCone(g, 0, 0.55, 0, 0.85, 1.15);
    }

    frog(-3.6, 2.4, 1, 0x8aa648, 0.8);
    frog(-5.6, -2.5, 0.5, 0x9ab84a, 0.4);
    frog(-5.8, 4.5, 0.7, 0x8aa648, 2.4);
    frog(2.5, -3.8, 0.6, 0xa8c258, 3);
    stones.filter((_, i) => i % 4 === 1).forEach((o) => frog(o.x + 0.3, o.z + 0.3, 0.45, 0x9ab84a, this.rnd() * 6));

    [
      [-2.6, -6.2, 1.3, 0xd84b2a],
      [-2.2, -6.5, 0.8, 0xe8a0b0],
      [-8.4, -1.3, 0.9, 0xe8a0b0],
      [-8, -1.6, 0.7, 0xd84b2a],
      [5.2, -3.9, 1, 0xd84b2a],
    ].forEach((a) => shroom(a[0], a[1], a[2], a[3]));

    const fc2 = [0xf0b440, 0xe05a9a, 0xf4f0e8, 0xf06a2a];
    free
      .filter((o) => !o.used && !keep(o))
      .slice(0, 22)
      .forEach((o, i) => flower(o.x, o.z, fc2[i % 4]));
    [
      [-8.6, -0.8, 0xe05a9a],
      [-3.4, -6.4, 0xf0b440],
      [-5, -7, 0xf4f0e8],
      [-9, 2, 0xf0b440],
      [0, -7, 0xe05a9a],
    ].forEach((a) => flower(a[0], a[1], a[2]));

    // 6. Lily Pads & Floating Debris (kept outside central shrine deck)
    this.pads = water
      .filter((o) => !(o.x >= -1 && o.x <= 3 && Math.abs(o.z) <= 2) && this.rnd() < 0.22)
      .map((o) => {
        const m = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10)), M(0x7fd44a));
        m.position.set(o.x + (this.rnd() - 0.5) * 0.3, -0.27, o.z + (this.rnd() - 0.5) * 0.3);
        this.islandPivot.add(m);
        return m;
      });

    // 6b. Central "Lanterns & Shrine" Voxel Centerpiece + Arched Red Bridge
    this.buildLanternShrine(1, -0.3, 0);

    for (let i = 0; i < 9; i++) {
      const s = 0.3 + this.rnd() * 0.45;
      const a = this.rnd() * 6.28;
      const r = 2 + this.rnd() * 7;
      const m = box(s, s, s, 0xa86044, Math.cos(a) * r, -11 - this.rnd() * 4, Math.sin(a) * r, undefined, this.rnd() * 3);
      this.debris.push({ mesh: m, baseY: m.position.y, phase: this.rnd() * 6 });
    }

    // 7. Clustered Orbital Voxel Clouds (4 weighted archetypes + Parent-Child trailing clusters)
    this.cloudMat = this.trackMat(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    type CloudArchetype = 'cumulus' | 'puff' | 'stratus' | 'wisp';

    const pickWeightedArchetype = (): CloudArchetype => {
      const r = this.rnd();
      if (r < 0.15) return 'cumulus';      // 15%
      if (r < 0.50) return 'puff';         // 35%
      if (r < 0.70) return 'stratus';      // 20%
      return 'wisp';                       // 30%
    };

    const buildCloudMesh = (kind: CloudArchetype): { group: THREE.Group; mat: THREE.MeshLambertMaterial } => {
      const g = new THREE.Group();
      const mat = this.trackMat(
        new THREE.MeshLambertMaterial({
          color: 0xffffff,
          emissive: 0x56709a,
          transparent: false,
          opacity: 1,
        })
      );

      const addVox = (x: number, y: number, z: number, w: number, h: number, d: number) => {
        const m = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
        m.position.set(x, y, z);
        g.add(m);
      };

      if (kind === 'cumulus') {
        // Tall, bulky multi-tiered stack with flat bottom and stepped pyramid-like peaks
        addVox(0, 0, 0, 3.2, 0.85, 3.0);
        addVox(-0.25, 0.72, 0.15, 2.3, 0.85, 2.2);
        addVox(-0.35, 1.4, 0.05, 1.4, 0.8, 1.4);
        addVox(-0.4, 1.95, 0.0, 0.75, 0.55, 0.75);
        addVox(1.3, -0.08, -0.8, 1.2, 0.65, 1.2);
        addVox(-1.25, -0.08, 0.95, 1.1, 0.65, 1.0);
      } else if (kind === 'puff') {
        // Medium roughly spherical/rounded voxel cluster (equal width & depth)
        addVox(0, 0.15, 0, 1.9, 1.35, 1.9);
        addVox(0.65, 0.0, 0.55, 1.2, 0.95, 1.2);
        addVox(-0.6, 0.05, -0.5, 1.2, 1.0, 1.2);
        addVox(0.05, 0.85, -0.05, 1.05, 0.75, 1.05);
      } else if (kind === 'stratus') {
        // Low horizontal cloud with asymmetrical stepped heights & jagged edges
        addVox(0, 0, 0, 3.4, 0.55, 2.1);
        addVox(1.4, -0.05, 0.55, 1.6, 0.45, 1.3);
        addVox(-1.35, -0.05, -0.5, 1.5, 0.45, 1.2);
        addVox(0.25, 0.45, -0.15, 1.9, 0.45, 1.3);
        addVox(-0.65, 0.4, 0.25, 1.2, 0.4, 1.0);
      } else {
        // Tiny 1x1 to 3x3 voxel wisp/fragment
        const vCount = 1 + Math.floor(this.rnd() * 3);
        for (let i = 0; i < vCount; i++) {
          const s = 0.45 + this.rnd() * 0.45;
          addVox((this.rnd() - 0.5) * 0.8, (this.rnd() - 0.5) * 0.35, (this.rnd() - 0.5) * 0.8, s, s * 0.75, s);
        }
      }

      // Strict 90-degree isometric Y-axis rotation + subtle non-uniform scaling (0.85..1.25)
      const rotSteps = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI];
      g.rotation.y = rotSteps[Math.floor(this.rnd() * 4)];
      g.scale.set(
        0.85 + this.rnd() * 0.4,
        0.85 + this.rnd() * 0.4,
        0.85 + this.rnd() * 0.4
      );

      return { group: g, mat };
    };

    const spawnCloud = (
      kind: CloudArchetype,
      orbitAngle: number,
      orbitRadius: number,
      angularSpeed: number,
      altitudeOverride?: number,
      opacityOverride?: number
    ) => {
      const { group, mat } = buildCloudMesh(kind);
      if (opacityOverride !== undefined) {
        mat.opacity = opacityOverride;
      }

      // Stratify Y by cloud type, and force below island rock base if inside exclusion radius
      let baseAltitude: number;
      if (altitudeOverride !== undefined) {
        baseAltitude = altitudeOverride;
      } else if (orbitRadius < 12.2) {
        baseAltitude = -7.5 - this.rnd() * 2.5;
      } else if (kind === 'wisp' || kind === 'puff') {
        baseAltitude = -0.5 + this.rnd() * 4.2; // High altitude (can pass in front of lower island rim)
      } else if (kind === 'cumulus') {
        baseAltitude = -5.2 + this.rnd() * 2.4; // Mid altitude (island base level)
      } else {
        baseAltitude = -8.6 + this.rnd() * 2.2; // Low altitude (below island)
      }

      group.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        baseAltitude,
        Math.sin(orbitAngle) * orbitRadius
      );
      this.islandPivot.add(group);
      this.clouds.push({
        group,
        mat,
        orbitAngle,
        orbitRadius,
        baseAltitude,
        angularSpeed,
        wobblePhase: this.rnd() * Math.PI * 2,
        bobPhase: this.rnd() * Math.PI * 2,
      });
    };

    const baseAngularSpeed = 0.032;
    const anchorCount = 5 + Math.floor(this.rnd() * 3); // 5..7 Anchor Clouds
    for (let a = 0; a < anchorCount; a++) {
      const anchorKind: CloudArchetype = this.rnd() < 0.48 ? 'cumulus' : 'stratus';
      const anchorAngle = (a / anchorCount) * Math.PI * 2 + (this.rnd() - 0.5) * 0.45;
      const anchorRadius = 13.5 + this.rnd() * 5.5;
      const anchorSpeed =
        anchorKind === 'cumulus'
          ? baseAngularSpeed * (0.62 + this.rnd() * 0.1)
          : baseAngularSpeed * (0.78 + this.rnd() * 0.14);

      spawnCloud(anchorKind, anchorAngle, anchorRadius, anchorSpeed);

      // 2..5 Satellite Clouds trailing downwind (lagging orbitAngle = parentAngle - offset)
      const satCount = 2 + Math.floor(this.rnd() * 4);
      for (let s = 0; s < satCount; s++) {
        const satKind: CloudArchetype = s === 0 && this.rnd() < 0.55 ? 'puff' : pickWeightedArchetype() === 'cumulus' ? 'puff' : this.rnd() < 0.55 ? 'wisp' : 'puff';
        const lagOffset = 0.08 + this.rnd() * 0.24;
        const satAngle = anchorAngle - lagOffset;
        const satRadius = anchorRadius + (this.rnd() - 0.5) * 2.8;
        const satAlt =
          satKind === 'wisp'
            ? -2.0 + this.rnd() * 3.5
            : anchorKind === 'stratus'
              ? -8.2 + this.rnd() * 2.5
              : -4.8 + this.rnd() * 3.2;

        // Share parent's angularSpeed so cluster stays cohesive
        spawnCloud(satKind, satAngle, satRadius, anchorSpeed, satAlt);
      }
    }

    // Extra inner/high free-roaming wisps & compact puffs (faster orbital speed)
    for (let i = 0; i < 6; i++) {
      const kind = pickWeightedArchetype() === 'cumulus' ? 'puff' : pickWeightedArchetype();
      const angle = this.rnd() * Math.PI * 2;
      const radius = kind === 'stratus' ? 10.5 + this.rnd() * 4.0 : 12.8 + this.rnd() * 5.0;
      const speed = baseAngularSpeed * (kind === 'wisp' ? 1.25 : 1.05);
      spawnCloud(kind, angle, radius, speed);
    }

    // Foreground-passing tier: elevated clouds that drift across the camera-facing front arc (3*PI/4)
    const foregroundKinds: CloudArchetype[] = ['puff', 'wisp', 'stratus', 'puff'];
    for (let i = 0; i < foregroundKinds.length; i++) {
      const kind = foregroundKinds[i];
      // Seed around the front-facing arc (PI/2 .. PI) with spread so foreground depth is visible immediately
      const angle = (Math.PI * 0.45) + (i / foregroundKinds.length) * (Math.PI * 0.65) + (this.rnd() - 0.5) * 0.25;
      const radius = 12.6 + this.rnd() * 2.4;
      const altitude = 1.4 + this.rnd() * 2.6;
      const speed = baseAngularSpeed * (1.15 + this.rnd() * 0.2);
      spawnCloud(kind, angle, radius, speed, altitude);

      // Pair with a trailing foreground wisp
      if (kind !== 'wisp') {
        spawnCloud(
          'wisp',
          angle - (0.08 + this.rnd() * 0.08),
          radius + (this.rnd() - 0.5) * 0.8,
          speed,
          altitude + 0.35 + this.rnd() * 0.5
        );
      }
    }

    if (pal) this.setPalette(pal);
  }

  private buildLanternShrine(cx: number, wy: number, cz: number): void {
    const SHRINE_WOOD_DARK = 0x6b3e24;
    const SHRINE_DECK_LIGHT = 0xd69f68;
    const SHRINE_DECK_TRIM = 0xb57d47;
    const SHRINE_RED = 0xb8352a;
    const SHRINE_RED_DARK = 0x8a241c;
    const ROOF_PLUM = 0x68303e;
    const ROOF_PLUM_DARK = 0x4b222e;
    const ROOF_RIDGE_GOLD = 0xe6a642;
    const STONE_LIGHT = 0x9fa2aa;
    const STONE_DARK = 0x7c7f87;
    const LANTERN_GLOW = 0xffd56b;

    const shrineGroup = new THREE.Group();
    shrineGroup.name = 'LanternShrineCenterpiece';
    shrineGroup.position.set(cx, 0, cz);
    this.islandPivot.add(shrineGroup);

    const matCache = new Map<number, THREE.MeshLambertMaterial>();
    const getMat = (hex: number): THREE.MeshLambertMaterial => {
      let m = matCache.get(hex);
      if (!m) {
        m = this.trackMat(new THREE.MeshLambertMaterial({ color: hex }));
        matCache.set(hex, m);
      }
      return m;
    };

    this.lanternGlowMat = this.trackMat(
      new THREE.MeshLambertMaterial({
        color: LANTERN_GLOW,
        emissive: 0xffa833,
        emissiveIntensity: 1.4,
      })
    );

    const part = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0,
      cast = true
    ): THREE.Mesh => {
      const m = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
      m.position.set(x, y, z);
      if (rx || ry || rz) m.rotation.set(rx, ry, rz);
      m.castShadow = cast;
      m.receiveShadow = true;
      shrineGroup.add(m);
      return m;
    };

    // 1. Grassy Shrine Islet rising out of the pond (3.8 x 3.8 units)
    const isletW = 3.85;
    part(isletW - 0.08, 0.72, isletW - 0.08, getMat(0x8e5638), 0, -0.36, 0);
    part(isletW, 0.24, isletW, getMat(0x7cc42b), 0, 0.06, 0);
    // Decorative rock & grass tufts on the islet
    part(0.32, 0.22, 0.28, getMat(STONE_DARK), 1.35, 0.26, 0.75, 0.1, 0.4, 0);
    part(0.22, 0.16, 0.2, getMat(STONE_LIGHT), 1.48, 0.24, 0.92, 0, -0.3, 0.15);

    // 2. Elevated Wooden Deck & Stilts
    const deckY = 0.62;
    const deckW = 2.45;
    for (const sx of [-1.05, 1.05]) {
      for (const sz of [-1.05, 1.05]) {
        part(0.18, 0.56, 0.18, getMat(SHRINE_WOOD_DARK), sx, 0.34, sz);
      }
    }
    // Crossbeams under deck
    part(deckW - 0.12, 0.1, 0.12, getMat(SHRINE_WOOD_DARK), 0, deckY - 0.1, -1.05);
    part(deckW - 0.12, 0.1, 0.12, getMat(SHRINE_WOOD_DARK), 0, deckY - 0.1, 1.05);
    part(0.12, 0.1, deckW - 0.12, getMat(SHRINE_WOOD_DARK), -1.05, deckY - 0.1, 0);
    part(0.12, 0.1, deckW - 0.12, getMat(SHRINE_WOOD_DARK), 1.05, deckY - 0.1, 0);

    // Planked deck floor + trim rim
    part(deckW, 0.12, deckW, getMat(SHRINE_DECK_TRIM), 0, deckY, 0);
    for (let i = -3; i <= 3; i++) {
      part(deckW - 0.14, 0.04, 0.28, getMat(SHRINE_DECK_LIGHT), 0, deckY + 0.07, i * 0.32);
    }

    // 3. Stone Staircase on the front (-X) leading from islet grass up to deck
    for (let s = 0; s < 4; s++) {
      const sy = 0.18 + s * 0.125;
      const sx = -1.62 + s * 0.16;
      part(0.22, 0.14 + s * 0.08, 0.95, getMat(s % 2 === 0 ? STONE_LIGHT : STONE_DARK), sx, sy * 0.5 + 0.12, 0);
    }

    // 4. Slatted Red Side Railings (on +Z, -Z, and back +X flanks)
    const buildRailing = (rx: number, rz: number, rotY: number, len: number) => {
      const rg = new THREE.Group();
      rg.position.set(rx, deckY + 0.08, rz);
      rg.rotation.y = rotY;
      shrineGroup.add(rg);
      const mk = (w: number, h: number, d: number, x: number, y: number, z: number, col: number) => {
        const m = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), getMat(col));
        m.position.set(x, y, z);
        m.castShadow = true;
        rg.add(m);
      };
      mk(len, 0.07, 0.08, 0, 0.34, 0, SHRINE_RED);
      mk(len, 0.05, 0.06, 0, 0.1, 0, SHRINE_RED_DARK);
      for (let b = -len * 0.42; b <= len * 0.43; b += 0.26) {
        mk(0.06, 0.34, 0.06, b, 0.17, 0, SHRINE_RED);
      }
    };
    buildRailing(0, 1.12, 0, 1.9);
    buildRailing(0, -1.12, 0, 1.9);
    buildRailing(1.12, 0, Math.PI / 2, 1.9);

    // 5. Slender Shrine Pillars + Glowing Inner Sanctum Altar
    const colTopY = deckY + 1.55;
    for (const px of [-1.02, 1.02]) {
      for (const pz of [-1.02, 1.02]) {
        part(0.15, 1.55, 0.15, getMat(SHRINE_WOOD_DARK), px, deckY + 0.82, pz);
        part(0.19, 0.12, 0.19, getMat(SHRINE_RED), px, deckY + 1.48, pz);
      }
    }
    // Warm Inner Altar & Glowing Lantern Core
    part(0.68, 0.38, 0.68, getMat(SHRINE_WOOD_DARK), 0.25, deckY + 0.26, 0);
    part(0.42, 0.46, 0.42, this.lanternGlowMat, 0.25, deckY + 0.66, 0, 0, 0, 0, false);
    part(0.52, 0.08, 0.52, getMat(SHRINE_RED), 0.25, deckY + 0.92, 0);

    this.shrineLight = new THREE.PointLight(0xffaa44, 110, 185, 1.25);
    this.shrineLight.position.set(0.25, deckY + 0.85, 0);
    shrineGroup.add(this.shrineLight);

    const shrineCone = new THREE.Mesh(
      this.trackGeo(new THREE.ConeGeometry(1.75, 1.9, 16, 1, true)),
      this.volumetricGlowMat
    );
    shrineCone.position.set(0, deckY + 0.82, 0);
    shrineCone.raycast = () => {};
    shrineGroup.add(shrineCone);

    // 6. Curved Pagoda Roof with Tile Ribs, Upturned Corner Eaves & Gold Finial
    const roofBaseY = colTopY + 0.06;
    // Red under-eave beam frame
    part(2.35, 0.12, 2.35, getMat(SHRINE_RED), 0, roofBaseY, 0);

    // 5 stepped, smoothly curved pagoda tiers
    const tiers = [
      { w: 3.15, h: 0.14, y: 0.12, col: ROOF_PLUM_DARK },
      { w: 2.55, h: 0.18, y: 0.26, col: ROOF_PLUM },
      { w: 1.92, h: 0.22, y: 0.44, col: ROOF_PLUM_DARK },
      { w: 1.32, h: 0.24, y: 0.64, col: ROOF_PLUM },
      { w: 0.76, h: 0.22, y: 0.84, col: ROOF_PLUM_DARK },
    ];
    for (const t of tiers) {
      part(t.w, t.h, t.w, getMat(t.col), 0, roofBaseY + t.y, 0);
    }

    // Ribbed tile strips on the 4 roof slopes
    for (let r = -2; r <= 2; r++) {
      if (r === 0) continue;
      const off = r * 0.44;
      part(0.07, 0.16, 2.75, getMat(ROOF_PLUM), off, roofBaseY + 0.24, 0, 0.24, 0, 0);
      part(2.75, 0.16, 0.07, getMat(ROOF_PLUM), 0, roofBaseY + 0.24, off, 0, 0, 0.24);
    }

    // 4 Diagonal Upturned Corner Hip Ridges
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const hip = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.14, 0.14, 1.95)), getMat(ROOF_PLUM_DARK));
        hip.position.set(sx * 0.86, roofBaseY + 0.46, sz * 0.86);
        hip.rotation.y = Math.atan2(sx, sz);
        hip.rotation.x = 0.46;
        hip.castShadow = true;
        shrineGroup.add(hip);

        // Upturned eave tip
        part(0.24, 0.14, 0.24, getMat(ROOF_PLUM), sx * 1.56, roofBaseY + 0.24, sz * 1.56);
      }
    }

    // Top ridge & Golden Finial Spire
    part(0.42, 0.14, 0.42, getMat(ROOF_PLUM), 0, roofBaseY + 0.98, 0);
    const spire = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.05, 0.13, 0.42, 8)), getMat(ROOF_RIDGE_GOLD));
    spire.position.set(0, roofBaseY + 1.24, 0);
    spire.castShadow = true;
    shrineGroup.add(spire);
    const orb = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.12, 8, 8)), getMat(ROOF_RIDGE_GOLD));
    orb.position.set(0, roofBaseY + 1.32, 0);
    shrineGroup.add(orb);

    // 7. 4 Hanging Paper Lanterns under roof corners
    for (const lx of [-1.36, 1.36]) {
      for (const lz of [-1.36, 1.36]) {
        part(0.04, 0.22, 0.04, getMat(SHRINE_WOOD_DARK), lx, roofBaseY - 0.04, lz);
        part(0.2, 0.05, 0.2, getMat(SHRINE_WOOD_DARK), lx, roofBaseY - 0.14, lz);
        const body = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.15, 0.13, 0.28, 8)), this.lanternGlowMat);
        body.position.set(lx, roofBaseY - 0.28, lz);
        shrineGroup.add(body);
        part(0.18, 0.04, 0.18, getMat(SHRINE_WOOD_DARK), lx, roofBaseY - 0.42, lz);
      }
    }

    // 8. Sculpted Arched Red Bridge connecting islet (-1.92) to paved patio (-4.65 -> world x=-3.65 on x=-4 bank)
    const bridgeCount = 11;
    const bridgeStartX = -1.90;
    const bridgeEndX = -4.65;
    for (let i = 0; i < bridgeCount; i++) {
      const t = i / (bridgeCount - 1);
      const bx = bridgeStartX + (bridgeEndX - bridgeStartX) * t;
      const arch = Math.sin(t * Math.PI);
      const by = 0.06 + arch * 0.36;
      const slope = Math.cos(t * Math.PI) * 0.24;

      // Plank deck
      part(0.27, 0.09, 1.05, getMat(SHRINE_DECK_LIGHT), bx, by, 0, 0, 0, -slope);
      // Side red arch stringers
      part(0.3, 0.1, 0.1, getMat(SHRINE_RED_DARK), bx, by - 0.02, -0.56, 0, 0, -slope);
      part(0.3, 0.1, 0.1, getMat(SHRINE_RED_DARK), bx, by - 0.02, 0.56, 0, 0, -slope);
      // Handrail posts & top rail
      if (i % 2 === 0) {
        part(0.09, 0.44, 0.09, getMat(SHRINE_RED), bx, by + 0.2, -0.56);
        part(0.09, 0.44, 0.09, getMat(SHRINE_RED), bx, by + 0.2, 0.56);
      }
      part(0.31, 0.08, 0.11, getMat(SHRINE_RED), bx, by + 0.38, -0.56, 0, 0, -slope);
      part(0.31, 0.08, 0.11, getMat(SHRINE_RED), bx, by + 0.38, 0.56, 0, 0, -slope);
    }

    // 9. 4 Sculpted Stone Tōrō Lanterns on the corners of the grassy islet
    const buildToro = (tx: number, tz: number) => {
      part(0.34, 0.12, 0.34, getMat(STONE_DARK), tx, 0.24, tz);
      part(0.16, 0.32, 0.16, getMat(STONE_LIGHT), tx, 0.46, tz);
      part(0.28, 0.08, 0.28, getMat(STONE_DARK), tx, 0.65, tz);
      part(0.2, 0.2, 0.2, this.lanternGlowMat, tx, 0.79, tz, 0, 0, 0, false);
      part(0.38, 0.1, 0.38, getMat(STONE_LIGHT), tx, 0.94, tz);
      part(0.22, 0.08, 0.22, getMat(STONE_DARK), tx, 1.03, tz);
      part(0.1, 0.08, 0.1, getMat(STONE_LIGHT), tx, 1.1, tz);
    };
    buildToro(-1.42, -1.35);
    buildToro(-1.42, 1.35);
    buildToro(1.42, -1.35);
    buildToro(1.42, 1.35);

    // 10. Cute Voxel Shrine Frog with Duck Floatie & Pink Bow
    const frogGroup = new THREE.Group();
    frogGroup.name = 'ShrineDuckFloatieFrog';
    frogGroup.position.set(0.15, 0.18, 1.48);
    frogGroup.rotation.y = -0.35;
    frogGroup.scale.setScalar(0.72);
    shrineGroup.add(frogGroup);
    this.shrineFrog = frogGroup;

    this.frogOutlineMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfff3a8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.NotEqualStencilFunc,
      })
    );

    const frogMatCache = new Map<number, THREE.MeshLambertMaterial>();
    const getFrogMat = (hex: number): THREE.MeshLambertMaterial => {
      let m = frogMatCache.get(hex);
      if (!m) {
        m = this.trackMat(
          new THREE.MeshLambertMaterial({
            color: hex,
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp,
            stencilFail: THREE.KeepStencilOp,
            stencilZFail: THREE.KeepStencilOp,
          })
        );
        frogMatCache.set(hex, m);
        this.frogMats.push(m);
      }
      return m;
    };

    const fBox = (
      w: number,
      h: number,
      d: number,
      hex: number,
      x: number,
      y: number,
      z: number,
      rz = 0
    ) => {
      const m = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(w, h, d)), getFrogMat(hex));
      m.position.set(x, y, z);
      if (rz) m.rotation.z = rz;
      m.castShadow = true;
      m.receiveShadow = true;
      m.renderOrder = 49;
      frogGroup.add(m);

      const outline = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(w + 0.055, h + 0.055, d + 0.055)),
        this.frogOutlineMat
      );
      outline.position.set(x, y, z);
      if (rz) outline.rotation.z = rz;
      outline.visible = false;
      outline.renderOrder = 50;
      outline.raycast = () => {};
      outline.userData.isFrogOutline = true;
      frogGroup.add(outline);

      return m;
    };

    const FROG_GREEN = 0x6ea63c;
    const FROG_DARK = 0x4e7a29;
    const FROG_BELLY = 0xdbe2a8;
    const FROG_EYE_RIM = 0xecc37c;
    const EYE_BLACK = 0x241812;
    const FLOAT_YELLOW = 0xf2b838;
    const FLOAT_SHADE = 0xd99624;
    const BEAK_ORANGE = 0xe06d2c;
    const BOW_PINK = 0xe88ae0;
    const BOW_DARK = 0xcf6ac8;

    // Stubby legs & webbed feet
    for (const s of [-1, 1]) {
      fBox(0.16, 0.16, 0.16, FROG_GREEN, s * 0.16, 0.1, 0);
      fBox(0.2, 0.06, 0.24, FROG_DARK, s * 0.17, 0.03, 0.04);
    }

    // Torso & cream belly
    fBox(0.46, 0.44, 0.42, FROG_GREEN, 0, 0.4, 0);
    fBox(0.32, 0.34, 0.05, FROG_BELLY, 0, 0.38, 0.2);

    // Yellow duck swim floatie ring around waist
    fBox(0.76, 0.18, 0.16, FLOAT_YELLOW, 0, 0.28, 0.29);
    fBox(0.76, 0.18, 0.16, FLOAT_SHADE, 0, 0.28, -0.29);
    fBox(0.16, 0.18, 0.44, FLOAT_YELLOW, -0.3, 0.28, 0);
    fBox(0.16, 0.18, 0.44, FLOAT_SHADE, 0.3, 0.28, 0);
    // Duck wings on sides of floatie + tail nub
    fBox(0.08, 0.14, 0.24, FLOAT_SHADE, -0.4, 0.29, -0.02);
    fBox(0.08, 0.14, 0.24, FLOAT_SHADE, 0.4, 0.29, -0.02);
    fBox(0.12, 0.1, 0.12, FLOAT_YELLOW, 0, 0.34, -0.38);

    // Duck head & orange beak at front-left of floatie
    fBox(0.24, 0.22, 0.22, FLOAT_YELLOW, -0.2, 0.42, 0.36);
    fBox(0.14, 0.08, 0.12, BEAK_ORANGE, -0.2, 0.39, 0.5);
    fBox(0.05, 0.05, 0.04, EYE_BLACK, -0.28, 0.45, 0.46);
    fBox(0.05, 0.05, 0.04, EYE_BLACK, -0.12, 0.45, 0.46);

    // Chubby frog arms resting over the duck floatie
    fBox(0.14, 0.22, 0.16, FROG_GREEN, -0.32, 0.44, 0.06, 0.3);
    fBox(0.14, 0.22, 0.16, FROG_GREEN, 0.32, 0.44, 0.06, -0.3);

    // Frog head, snout & big golden-tan bulging eyes
    fBox(0.52, 0.28, 0.46, FROG_GREEN, 0, 0.72, 0.02);
    fBox(0.46, 0.14, 0.12, FROG_GREEN, 0, 0.67, 0.26);
    for (const s of [-1, 1]) {
      fBox(0.18, 0.16, 0.18, FROG_EYE_RIM, s * 0.19, 0.89, 0.14);
      fBox(0.12, 0.07, 0.05, EYE_BLACK, s * 0.19, 0.89, 0.22);
    }

    // Pastel-pink voxel bow perched on top-right of head
    fBox(0.12, 0.12, 0.12, BOW_DARK, 0.08, 0.96, -0.02);
    fBox(0.18, 0.18, 0.1, BOW_PINK, -0.06, 1.0, -0.02, 0.25);
    fBox(0.18, 0.18, 0.1, BOW_PINK, 0.22, 0.94, -0.02, -0.25);
  }

  private syncLanternIntensity(): void {
    if (!this.lanternGlowMat || !this.shrineLight) return;
    const boost = (this.isDarkTime ? 1.0 : 0.0) + (this.isWetOrColdWeather ? 0.65 : 0.0);
    this.lanternGlowMat.emissiveIntensity = 1.35 + boost * 1.1;
    this.shrineLight.intensity = 90 + boost * 140;

    for (const light of this.nightLights) {
      light.intensity = 25 + boost * 145;
    }

    if (this.cottageWindowMat) {
      this.cottageWindowMat.color.setHex(this.isDarkTime ? 0xffd678 : 0xbfe3f0);
      this.cottageWindowMat.emissiveIntensity = this.isDarkTime ? 1.25 : 0.08;
    }

    if (this.volumetricGlowMat) {
      this.volumetricGlowMat.uniforms.uIntensity.value = (0.1 + boost * 0.28) * this.volumetricScale;
    }
  }

  public update(dt: number, elapsed: number): void {
    this.waterMat.uniforms.uT.value = elapsed;
    this.fallMat.uniforms.uT.value = elapsed;
    this.foamMat.opacity = 0.8 + 0.2 * Math.sin(elapsed * 1.5);

    this.islandPivot.position.y = this.islandCenter.y + Math.sin(elapsed * 0.6) * (0.25 * this.islandScale);
    this.islandPivot.rotation.y = Math.sin(elapsed * 0.2) * 0.02;

    this.pads.forEach((p, i) => {
      p.position.y = -0.27 + Math.sin(elapsed * 1.3 + i) * 0.015;
    });

    if (this.shrineFrog) {
      const targetHover = this.frogHovered ? 1 : 0;
      this.frogHoverBlend += (targetHover - this.frogHoverBlend) * Math.min(1, dt * 14);
      const showOutline = this.frogHoverBlend > 0.01;
      if (this.frogOutlineMat) {
        this.frogOutlineMat.opacity = this.frogHoverBlend;
      }
      for (const child of this.shrineFrog.children) {
        if (child.userData.isFrogOutline) {
          child.visible = showOutline;
        }
      }

      const baseScale = 0.72 * (1 + this.frogHoverBlend * 0.08);
      if (this.frogBounceTimer > 0) {
        this.frogBounceTimer = Math.max(0, this.frogBounceTimer - dt);
        const progress = 1 - this.frogBounceTimer / 0.65;
        const decay = Math.exp(-progress * 4.2);
        const squash = Math.sin(progress * Math.PI * 3.5) * decay;
        const hop = Math.abs(Math.sin(progress * Math.PI * 2.2)) * decay;
        const wiggle = Math.sin(progress * Math.PI * 5.0) * decay;

        this.shrineFrog.position.y = 0.18 + hop * 0.36;
        this.shrineFrog.scale.set(
          baseScale * (1 - squash * 0.22),
          baseScale * (1 + squash * 0.38),
          baseScale * (1 - squash * 0.22)
        );
        this.shrineFrog.rotation.z = wiggle * 0.28;
      } else {
        const hop = Math.max(0, Math.sin(elapsed * 2.2));
        this.shrineFrog.position.y = 0.18 + hop * 0.04;
        this.shrineFrog.scale.set(baseScale, baseScale * (1 + hop * 0.05), baseScale);
        this.shrineFrog.rotation.z = 0;
      }
    }

    this.debris.forEach((d) => {
      d.mesh.position.y = d.baseY + Math.sin(elapsed * 0.7 + d.phase) * 0.35;
      d.mesh.rotation.y += dt * 0.1;
    });

    // Revolving orbital clouds with radial breathing & vertical bobbing (grid-locked rotation.y)
    for (const c of this.clouds) {
      c.orbitAngle += dt * c.angularSpeed;
      const r = c.orbitRadius * (1 + Math.sin(elapsed * 0.35 + c.wobblePhase) * 0.05);
      const y = c.baseAltitude + Math.sin(elapsed * 0.5 + c.bobPhase) * 0.28;
      c.group.position.set(Math.cos(c.orbitAngle) * r, y, Math.sin(c.orbitAngle) * r);
    }

    for (let i = 0; i < this.bladeData.length; i++) {
      const b = this.bladeData[i];
      this.dummy.position.set(b[0], 0, b[1]);
      this.dummy.rotation.set(
        b[3] + Math.sin(elapsed * 1.6 + b[2]) * 0.12,
        0,
        b[4] + Math.cos(elapsed * 1.3 + b[2]) * 0.12
      );
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.bladesMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.bladesMesh.instanceMatrix.needsUpdate = true;

    this.smokePuffs.forEach((m, i) => {
      const k = (elapsed * 0.12 + i / 5) % 1;
      m.position.set(-5.55 + k * 1.6 + Math.sin(k * 6 + i) * 0.15, 4 + k * 3.2, -4.5 - k * 0.6);
      m.scale.setScalar(0.5 + k * 1.8);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.65 * Math.sin(k * 3.1416);
    });

    this.flames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(elapsed * 9 + i * 2) * 0.2;
    });
    this.fireLight.intensity = 120 + Math.sin(elapsed * 11) * 35;
  }

  public setPalette(pal: Palette): void {
    const isNight = pal.stars >= 0.5;
    const isDawnOrDusk = pal.label === 'Dawn' || pal.label === 'Dusk';

    const topColor = isNight ? 0x586b8e : isDawnOrDusk ? new THREE.Color(pal.cloudTop).getHex() : 0xffffff;
    const emissiveColor = isNight ? 0x202b44 : isDawnOrDusk ? 0x705058 : 0x56709a;

    this.cloudMat.color.setHex(topColor);
    this.cloudMat.emissive.setHex(emissiveColor);
    for (const c of this.clouds) {
      c.mat.color.setHex(topColor);
      c.mat.emissive.setHex(emissiveColor);
    }
  }

  public setWaterColors(_deep: string, _shallow: string, _foam: string): void {
    // Water uses exact floating-island.html shader colors
  }

  public setWeather(weather: WeatherMode): void {
    const isSnow = weather === 'snow';
    this.grassCapMat.color.setHex(isSnow ? 0xdbe8f2 : 0xffffff);
    this.bladesMat.color.setHex(isSnow ? 0xcfdfeb : 0xffffff);
    this.isWetOrColdWeather = weather === 'rain' || weather === 'snow';
    this.syncLanternIntensity();
  }

  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    const isNight = timeOfDay === 'midnight' || timeOfDay === 'evening' || timeOfDay === 'dusk';
    this.lanternMat.color.setHex(isNight ? 0xfff0a0 : 0xffe28a);
    this.isDarkTime = isNight;
    this.syncLanternIntensity();
  }

  public setVolumetricScale(scale: number): void {
    this.volumetricScale = Math.max(0, Math.min(2, scale));
    this.syncLanternIntensity();
  }

  public pickFrogAt(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    camera: THREE.Camera
  ): boolean {
    if (!this.shrineFrog) return false;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.frogRaycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    return this.frogRaycaster.intersectObject(this.shrineFrog, true).length > 0;
  }

  public setFrogHovered(hovered: boolean): void {
    this.frogHovered = hovered;
  }

  public triggerFrogBounce(): void {
    this.frogBounceTimer = 0.65;
  }

  public getFrogWorldPosition(out: THREE.Vector3): boolean {
    if (!this.shrineFrog) return false;
    this.shrineFrog.getWorldPosition(out);
    out.y += 1.25 * 0.72 * this.islandScale;
    return true;
  }

  public getCampfirePosition(): THREE.Vector3 {
    return this.campfireWorldPos;
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
