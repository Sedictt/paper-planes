import * as THREE from 'three';
import type { Palette } from '../ThreeWorldEngine';
import type { TimeOfDay, WeatherMode } from '../../types';
import { gridToWorld3D } from '../world/TerrainBuilder';

interface FloatingLeaf3D {
  mesh: THREE.Mesh;
  gx: number;
  gy: number;
  gz: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
}

interface FireworkRocket {
  phase: 'rocket' | 'burst';
  gx: number;
  gy: number;
  gz: number;
  targetZ: number;
  color: THREE.Color;
  rocketMesh: THREE.Mesh;
  sparks: Array<{
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
  }>;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class AtmosphereEffects {
  public readonly group: THREE.Group;
  public readonly campfireLight: THREE.PointLight;

  private rng = mulberry32(20261116);
  private campfireBasePos: THREE.Vector3;

  // Sparkles / Fireflies
  private sparklePoints: THREE.Points;
  private sparkleBaseY: Float32Array;
  private sparklePhases: Float32Array;
  private sparkleMaterial: THREE.PointsMaterial;

  // Floating Woodland Leaves
  private leaves: FloatingLeaf3D[] = [];
  private leafGeometry: THREE.BoxGeometry;
  private leafMaterials: THREE.MeshLambertMaterial[] = [];

  // Weather Particles (Rain & Snow)
  private weatherCount = 130;
  private rainGroup: THREE.Group;
  private rainMeshes: THREE.Mesh[] = [];
  private snowPoints: THREE.Points;
  private weatherPositions: Float32Array;
  private weatherSpeeds: Float32Array;
  private rainGeometry: THREE.BoxGeometry;
  private rainMaterial: THREE.MeshBasicMaterial;
  private snowMaterial: THREE.PointsMaterial;

  // Fireworks
  private fireworks: FireworkRocket[] = [];
  private fireworkTimer = 0;
  private sparkGeometry: THREE.BoxGeometry;

  // Floating Island 2D Stylized Clouds
  private cloudGroup: THREE.Group;
  private cloudTexture: THREE.CanvasTexture;
  private cloudTopMat: THREE.SpriteMaterial;
  private cloudShadeMat: THREE.SpriteMaterial;
  private cloudSprites: Array<{
    sprite: THREE.Sprite;
    x: number;
    y: number;
    z: number;
    phase: number;
  }> = [];

  private weather: WeatherMode = 'clear';

  constructor(campfirePos: THREE.Vector3, initialPalette: Palette) {
    this.group = new THREE.Group();
    this.group.name = 'AtmosphereEffects';
    this.campfireBasePos = campfirePos.clone();

    // 1. Flickering Campfire PointLight (physical units for Three r155+)
    this.campfireLight = new THREE.PointLight(0xffa438, 320, 220, 1.25);
    this.campfireLight.position.copy(this.campfireBasePos).add(new THREE.Vector3(0, 18, 0));
    this.group.add(this.campfireLight);

    // 2. Floating Sparkles / Fireflies (44 motes around the sanctuary)
    const sparkleCount = 44;
    const sparkleGeom = new THREE.BufferGeometry();
    const sPos = new Float32Array(sparkleCount * 3);
    this.sparkleBaseY = new Float32Array(sparkleCount);
    this.sparklePhases = new Float32Array(sparkleCount);

    for (let i = 0; i < sparkleCount; i++) {
      const gx = 0.5 + this.rng() * 10.5;
      const gy = 0.5 + this.rng() * 10.5;
      const gz = 18 + this.rng() * 58;
      const wPos = gridToWorld3D(gx, gy, gz);
      sPos[i * 3 + 0] = wPos.x;
      sPos[i * 3 + 1] = wPos.y;
      sPos[i * 3 + 2] = wPos.z;
      this.sparkleBaseY[i] = wPos.y;
      this.sparklePhases[i] = this.rng() * Math.PI * 2;
    }
    sparkleGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    this.sparkleMaterial = new THREE.PointsMaterial({
      color: 0xfff6d6,
      size: 4.5,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.sparklePoints = new THREE.Points(sparkleGeom, this.sparkleMaterial);
    this.sparklePoints.name = 'FirefliesSparkles';
    this.group.add(this.sparklePoints);

    // 3. Drifting 3D Woodland Leaves (18 voxel leaf platelets)
    this.leafGeometry = new THREE.BoxGeometry(5.2, 0.7, 3.0);
    const leafHexes = [0x556b2f, 0x6b8238, 0x485c26, 0x7d9442, 0x8c6239];
    leafHexes.forEach((hex) => {
      this.leafMaterials.push(new THREE.MeshLambertMaterial({ color: hex, flatShading: true }));
    });

    for (let i = 0; i < 18; i++) {
      const mat = this.leafMaterials[i % this.leafMaterials.length];
      const mesh = new THREE.Mesh(this.leafGeometry, mat);
      const gx = 0.5 + this.rng() * 10;
      const gy = 0.5 + this.rng() * 10;
      const gz = 16 + this.rng() * 56;
      mesh.position.copy(gridToWorld3D(gx, gy, gz));
      this.group.add(mesh);

      this.leaves.push({
        mesh,
        gx,
        gy,
        gz,
        vx: 0.22 + this.rng() * 0.22,
        vy: 0.12 + this.rng() * 0.18,
        vz: -1.6 - this.rng() * 1.2,
        rx: (this.rng() - 0.5) * 2.4,
        ry: (this.rng() - 0.5) * 2.4,
        rz: (this.rng() - 0.5) * 2.4,
      });
    }

    // 4. Weather Particle Systems (130 particles for Rain & Snow)
    this.weatherPositions = new Float32Array(this.weatherCount * 3);
    this.weatherSpeeds = new Float32Array(this.weatherCount);
    const center3D = gridToWorld3D(5.5, 5.5, 35);

    this.rainGroup = new THREE.Group();
    this.rainGroup.name = 'RainParticles';
    this.rainGroup.visible = false;
    this.rainGeometry = new THREE.BoxGeometry(0.9, 13, 0.9);
    this.rainMaterial = new THREE.MeshBasicMaterial({
      color: 0xdceef8,
      transparent: true,
      opacity: 0.52,
    });

    for (let i = 0; i < this.weatherCount; i++) {
      const px = center3D.x + (this.rng() - 0.5) * 680;
      const py = this.rng() * 220;
      const pz = center3D.z + (this.rng() - 0.5) * 680;
      this.weatherPositions[i * 3 + 0] = px;
      this.weatherPositions[i * 3 + 1] = py;
      this.weatherPositions[i * 3 + 2] = pz;
      this.weatherSpeeds[i] = 0.85 + this.rng() * 0.65;

      const drop = new THREE.Mesh(this.rainGeometry, this.rainMaterial);
      drop.position.set(px, py, pz);
      drop.rotation.z = 0.22;
      this.rainGroup.add(drop);
      this.rainMeshes.push(drop);
    }
    this.group.add(this.rainGroup);

    const snowGeom = new THREE.BufferGeometry();
    snowGeom.setAttribute('position', new THREE.BufferAttribute(this.weatherPositions, 3));
    this.snowMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 5.0,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.snowPoints = new THREE.Points(snowGeom, this.snowMaterial);
    this.snowPoints.name = 'SnowParticles';
    this.snowPoints.visible = false;
    this.group.add(this.snowPoints);

    // 5. Fireworks Geometry
    this.sparkGeometry = new THREE.BoxGeometry(2.8, 2.8, 2.8);

    // 6. Floating Island 2D Stylized Cloud Ring (billboarded soft 2D sprites touching island edges)
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.name = 'IslandClouds';

    const cCanvas = typeof document !== 'undefined' && document.createElement
      ? document.createElement('canvas')
      : ({ width: 128, height: 96, getContext: () => null } as unknown as HTMLCanvasElement);
    cCanvas.width = 128;
    cCanvas.height = 96;
    const cCtx = cCanvas.getContext('2d');
    if (cCtx) {
      cCtx.clearRect(0, 0, 128, 96);
      // Soft overlapping 2D stylized cloud silhouette
      const puffs: [number, number, number, string][] = [
        [36, 56, 26, 'rgba(235, 238, 245, 0.92)'],
        [92, 56, 26, 'rgba(235, 238, 245, 0.92)'],
        [64, 52, 34, 'rgba(248, 250, 255, 0.96)'],
        [48, 40, 24, 'rgba(255, 255, 255, 0.98)'],
        [78, 42, 22, 'rgba(255, 255, 255, 0.98)'],
        [64, 62, 28, 'rgba(225, 230, 240, 0.90)'],
      ];
      for (const [px, py, pr, col] of puffs) {
        const grad = cCtx.createRadialGradient(px, py - pr * 0.15, pr * 0.2, px, py, pr);
        grad.addColorStop(0, col);
        grad.addColorStop(0.75, col);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        cCtx.fillStyle = grad;
        cCtx.beginPath();
        cCtx.arc(px, py, pr, 0, Math.PI * 2);
        cCtx.fill();
      }
    }

    this.cloudTexture = new THREE.CanvasTexture(cCanvas);
    this.cloudTexture.colorSpace = THREE.SRGBColorSpace;

    this.cloudTopMat = new THREE.SpriteMaterial({
      map: this.cloudTexture,
      color: new THREE.Color(initialPalette.cloudTop),
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });
    this.cloudShadeMat = new THREE.SpriteMaterial({
      map: this.cloudTexture,
      color: new THREE.Color(initialPalette.cloudShade),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    const cloudCenter = gridToWorld3D(5.5, 5.5, 0);
    const cloudCount = 18;
    for (let i = 0; i < cloudCount; i++) {
      const angle = (i / cloudCount) * Math.PI * 2 + 0.15;
      // Hug right up against the island edges (radius 220..275)
      const dist = 225 + (i % 3) * 24;
      const cx = cloudCenter.x + Math.cos(angle) * dist;
      const cz = cloudCenter.z + Math.sin(angle) * dist;
      const cy = -12 + Math.sin(i * 1.7) * 20;

      const isTop = i % 3 !== 2;
      const sprite = new THREE.Sprite(isTop ? this.cloudTopMat : this.cloudShadeMat);
      const w = 135 + (i % 3) * 28;
      const h = w * 0.72;
      sprite.scale.set(w, h, 1);
      sprite.position.set(cx, cy, cz);
      // Tuck slightly behind/around island edges
      sprite.renderOrder = -1;

      this.cloudGroup.add(sprite);
      this.cloudSprites.push({ sprite, x: cx, y: cy, z: cz, phase: i * 0.55 });
    }
    this.cloudGroup.visible = false;
    this.group.add(this.cloudGroup);

    this.setPalette(initialPalette);
  }

  public setPalette(pal: Palette): void {
    const isNight = pal.stars >= 0.5;
    this.sparkleMaterial.opacity = isNight ? 0.92 : 0.58;
    this.sparkleMaterial.color.set(isNight ? 0xffe885 : 0xfff8e0);

    if (this.cloudTopMat) {
      this.cloudTopMat.color.set(pal.cloudTop);
    }
    if (this.cloudShadeMat) {
      this.cloudShadeMat.color.set(pal.cloudShade);
    }
  }

  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    const isNight = timeOfDay === 'evening' || timeOfDay === 'midnight' || timeOfDay === 'dusk';
    this.campfireLight.intensity = isNight ? 520 : 300;
  }

  public setWeather(weather: WeatherMode): void {
    this.weather = weather;
    this.rainGroup.visible = weather === 'rain';
    this.snowPoints.visible = weather === 'snow';
  }

  public triggerFireworkVolley(): void {
    for (let i = 0; i < 3; i++) {
      this.spawnFirework();
    }
  }

  private spawnFirework(): void {
    const gx = 3 + this.rng() * 6;
    const gy = 3 + this.rng() * 6;
    const gz = 28;
    const targetZ = 78 + this.rng() * 32;
    const paletteHexes = [0xff8c55, 0xffd466, 0x85e6b8, 0xff6b8b, 0xfff6d6];
    const color = new THREE.Color(paletteHexes[Math.floor(this.rng() * paletteHexes.length)]);

    const mat = new THREE.MeshBasicMaterial({ color: 0xfff5cc });
    const rocketMesh = new THREE.Mesh(this.sparkGeometry, mat);
    rocketMesh.position.copy(gridToWorld3D(gx, gy, gz));
    this.group.add(rocketMesh);

    this.fireworks.push({
      phase: 'rocket',
      gx,
      gy,
      gz,
      targetZ,
      color,
      rocketMesh,
      sparks: [],
    });
  }

  public update(dt: number, elapsed: number, fireworksActive: boolean): void {
    // 1. Flicker Campfire PointLight
    const flicker = 1.0 + Math.sin(elapsed * 13) * 0.14 + Math.cos(elapsed * 23) * 0.08;
    this.campfireLight.intensity = 320 * flicker;
    this.campfireLight.position.y = this.campfireBasePos.y + 18 + Math.sin(elapsed * 9) * 1.2;

    // 1b. Gentle Floating Island 2D Cloud Drift
    for (const c of this.cloudSprites) {
      c.sprite.position.set(
        c.x + Math.sin(elapsed * 0.28 + c.phase) * 4.5,
        c.y + Math.cos(elapsed * 0.36 + c.phase) * 2.8,
        c.z + Math.cos(elapsed * 0.24 + c.phase) * 4.5
      );
    }

    // 2. Twinkle & Bob Sparkles / Fireflies
    const sAttr = this.sparklePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.sparklePhases.length; i++) {
      const phase = this.sparklePhases[i];
      sAttr.setY(i, this.sparkleBaseY[i] + Math.sin(elapsed * 1.6 + phase) * 4.5);
    }
    sAttr.needsUpdate = true;

    // 3. Update Drifting 3D Woodland Leaves
    for (const lf of this.leaves) {
      lf.gx += lf.vx * dt;
      lf.gy += lf.vy * dt;
      lf.gz += lf.vz * dt;

      if (lf.gx > 11.5 || lf.gy > 11.5 || lf.gz < 4) {
        lf.gx = 0.5 + this.rng() * 7.5;
        lf.gy = 0.5 + this.rng() * 7.5;
        lf.gz = 54 + this.rng() * 28;
      }

      lf.mesh.position.copy(gridToWorld3D(lf.gx, lf.gy, lf.gz));
      lf.mesh.rotation.x += lf.rx * dt;
      lf.mesh.rotation.y += lf.ry * dt;
      lf.mesh.rotation.z += lf.rz * dt;
    }

    // 4. Update Weather Particles
    if (this.weather !== 'clear') {
      const center3D = gridToWorld3D(5.5, 5.5, 35);
      const posAttr = this.snowPoints.geometry.getAttribute('position') as THREE.BufferAttribute;

      for (let i = 0; i < this.weatherCount; i++) {
        let px = this.weatherPositions[i * 3 + 0];
        let py = this.weatherPositions[i * 3 + 1];
        const pz = this.weatherPositions[i * 3 + 2];
        const spd = this.weatherSpeeds[i];

        if (this.weather === 'rain') {
          py -= 320 * dt * spd;
          px -= 80 * dt;
        } else {
          py -= 50 * dt * spd;
          px += Math.sin(elapsed * 2 + i) * 14 * dt;
        }

        if (py < -10) {
          py = 210;
          px = center3D.x + (this.rng() - 0.5) * 680;
        }

        this.weatherPositions[i * 3 + 0] = px;
        this.weatherPositions[i * 3 + 1] = py;

        if (this.weather === 'rain') {
          this.rainMeshes[i].position.set(px, py, pz);
        }
      }

      if (this.weather === 'snow') {
        posAttr.needsUpdate = true;
      }
    }

    // 5. Update Fireworks
    if (fireworksActive) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.spawnFirework();
        this.fireworkTimer = 0.7 + this.rng() * 0.75;
      }
    }

    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const fw = this.fireworks[i];
      if (fw.phase === 'rocket') {
        fw.gz += 62 * dt;
        fw.rocketMesh.position.copy(gridToWorld3D(fw.gx, fw.gy, fw.gz));
        if (fw.gz >= fw.targetZ) {
          fw.phase = 'burst';
          this.group.remove(fw.rocketMesh);
          (fw.rocketMesh.material as THREE.Material).dispose();

          const origin = gridToWorld3D(fw.gx, fw.gy, fw.gz);
          for (let s = 0; s < 24; s++) {
            const theta = (s / 24) * Math.PI * 2;
            const phi = (this.rng() - 0.5) * Math.PI;
            const speed = 28 + this.rng() * 42;
            const sparkMat = new THREE.MeshBasicMaterial({
              color: fw.color,
              transparent: true,
              opacity: 1.0,
            });
            const sparkMesh = new THREE.Mesh(this.sparkGeometry, sparkMat);
            sparkMesh.position.copy(origin);
            this.group.add(sparkMesh);

            fw.sparks.push({
              mesh: sparkMesh,
              vx: Math.cos(theta) * Math.cos(phi) * speed,
              vy: Math.sin(phi) * speed + 14,
              vz: Math.sin(theta) * Math.cos(phi) * speed,
              life: 1.0,
            });
          }
        }
      } else {
        let alive = 0;
        for (const sp of fw.sparks) {
          sp.life -= dt * 0.9;
          if (sp.life > 0) {
            alive++;
            sp.vy -= 38 * dt;
            sp.mesh.position.x += sp.vx * dt;
            sp.mesh.position.y += sp.vy * dt;
            sp.mesh.position.z += sp.vz * dt;
            (sp.mesh.material as THREE.MeshBasicMaterial).opacity = sp.life;
          } else {
            sp.mesh.visible = false;
          }
        }
        if (alive === 0) {
          for (const sp of fw.sparks) {
            this.group.remove(sp.mesh);
            (sp.mesh.material as THREE.Material).dispose();
          }
          this.fireworks.splice(i, 1);
        }
      }
    }
  }

  public dispose(): void {
    this.sparklePoints.geometry.dispose();
    this.sparkleMaterial.dispose();
    this.leafGeometry.dispose();
    this.leafMaterials.forEach((m) => m.dispose());
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
    this.snowPoints.geometry.dispose();
    this.snowMaterial.dispose();
    this.sparkGeometry.dispose();
    this.cloudTexture.dispose();
    this.cloudTopMat.dispose();
    this.cloudShadeMat.dispose();
    for (const fw of this.fireworks) {
      (fw.rocketMesh.material as THREE.Material).dispose();
      for (const sp of fw.sparks) {
        (sp.mesh.material as THREE.Material).dispose();
      }
    }
    this.group.clear();
  }
}
