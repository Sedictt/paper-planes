import * as THREE from 'three';
import type { PaperPlaneNote, PaperTint } from '../../types';
import { gridToWorld3D } from '../world/TerrainBuilder';

export interface ActivePlane3D {
  note: PaperPlaneNote;
  gx: number;
  gy: number;
  gz: number;
  vx: number;
  vy: number;
  turnRate: number;
  bobPhase: number;
  orbitAngle: number;
  rootGroup: THREE.Group;
  planeMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  trailMeshes: THREE.Mesh[];
  trailCoords: Array<{ gx: number; gy: number; gz: number }>;
  trailTimer: number;
}

const TINT_HEX: Record<PaperTint, { wing: number; keel: number }> = {
  cream: { wing: 0xfffdf7, keel: 0xd9cbb8 },
  rose: { wing: 0xfff0ee, keel: 0xdeb4ae },
  sky: { wing: 0xf0f8fc, keel: 0xb0c8d6 },
  sage: { wing: 0xf2faf0, keel: 0xb6cfb2 },
  gold: { wing: 0xfff8e3, keel: 0xdec290 },
};

const GRID = 12;

export class PaperPlaneSystem {
  public readonly group: THREE.Group;
  public planes: ActivePlane3D[] = [];
  public hoveredPlane: ActivePlane3D | null = null;

  private getElevation: (gx: number, gy: number) => number;
  private raycaster = new THREE.Raycaster();

  private wingGeometry: THREE.BufferGeometry;
  private haloGeometry: THREE.RingGeometry;
  private shadowGeometry: THREE.CircleGeometry;
  private trailGeometry: THREE.BoxGeometry;

  private tintMaterials: Map<PaperTint, THREE.MeshLambertMaterial> = new Map();
  private haloHoverMat: THREE.MeshBasicMaterial;
  private haloUserMat: THREE.MeshBasicMaterial;
  private shadowMat: THREE.MeshBasicMaterial;
  private trailMaterials: THREE.MeshBasicMaterial[] = [];

  constructor(getElevation: (gx: number, gy: number) => number) {
    this.group = new THREE.Group();
    this.group.name = 'PaperPlaneSystem';
    this.getElevation = getElevation;

    // 1. Build 3D Folded Origami Dart Geometry
    // Nose at +X (12, 0, 0), Left Wing Tip at (-10, 1.5, -8.5), Right Wing Tip at (-10, 1.5, 8.5), Keel at (-8, -3.5, 0)
    this.wingGeometry = this.createOrigamiGeometry();
    this.haloGeometry = new THREE.RingGeometry(9, 13.5, 16);
    this.shadowGeometry = new THREE.CircleGeometry(6.5, 12);
    this.trailGeometry = new THREE.BoxGeometry(2.2, 2.2, 2.2);

    // 2. Initialize Materials for 5 Paper Tints
    (Object.keys(TINT_HEX) as PaperTint[]).forEach((tint) => {
      const mat = new THREE.MeshLambertMaterial({
        color: TINT_HEX[tint].wing,
        flatShading: true,
        side: THREE.DoubleSide,
      });
      this.tintMaterials.set(tint, mat);
    });

    this.haloHoverMat = new THREE.MeshBasicMaterial({
      color: 0xffe482,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    });
    this.haloUserMat = new THREE.MeshBasicMaterial({
      color: 0xf3c663,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1a140e,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });

    for (let i = 0; i < 8; i++) {
      this.trailMaterials.push(
        new THREE.MeshBasicMaterial({
          color: 0xfff8eb,
          transparent: true,
          opacity: ((i + 1) / 8) * 0.36,
        })
      );
    }
  }

  private createOrigamiGeometry(): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    // Nose: (11, 0, 0)
    // Inner Left Spine: (-8, 0.8, -1.8)
    // Inner Right Spine: (-8, 0.8, 1.8)
    // Outer Left Wing: (-10, 2.2, -8.5)
    // Outer Right Wing: (-10, 2.2, 8.5)
    // Bottom Keel Ridge: (-7.5, -3.6, 0)
    const positions = new Float32Array([
      // Left outer wing
      11, 0, 0, -10, 2.2, -8.5, -8, 0.8, -1.8,
      // Left valley fold to keel
      11, 0, 0, -8, 0.8, -1.8, -7.5, -3.6, 0,
      // Right valley fold from keel
      11, 0, 0, -7.5, -3.6, 0, -8, 0.8, 1.8,
      // Right outer wing
      11, 0, 0, -8, 0.8, 1.8, -10, 2.2, 8.5,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }

  public syncPlanes(notes: PaperPlaneNote[]): void {
    const existingById = new Map(this.planes.map((p) => [p.note.id, p]));
    const nextPlanes: ActivePlane3D[] = [];
    const seenIds = new Set<string>();

    notes.forEach((n, idx) => {
      seenIds.add(n.id);
      const existing = existingById.get(n.id);
      if (existing) {
        existing.note = n;
        const tintMat = this.tintMaterials.get(n.paperTint) ?? this.tintMaterials.get('cream')!;
        existing.planeMesh.material = tintMat;
        nextPlanes.push(existing);
      } else {
        const angle = ((idx * 137.5) % 360) * (Math.PI / 180);
        const speed = 0.48 + (idx % 5) * 0.07;
        const isJustLaunched = n.createdAt === 'Just now';
        const gx = isJustLaunched ? 5.5 : 2 + ((idx * 1.9) % (GRID - 4));
        const gy = isJustLaunched ? 5.5 : 2 + ((idx * 2.7) % (GRID - 4));
        const gz = isJustLaunched ? 84 : 58 + ((idx * 6) % 32);

        const rootGroup = new THREE.Group();
        rootGroup.name = `PlaneEntity_${n.id}`;

        const tintMat = this.tintMaterials.get(n.paperTint) ?? this.tintMaterials.get('cream')!;
        const planeMesh = new THREE.Mesh(this.wingGeometry, tintMat);
        planeMesh.castShadow = true;
        planeMesh.userData = { planeId: n.id };
        rootGroup.add(planeMesh);

        const haloMesh = new THREE.Mesh(this.haloGeometry, this.haloUserMat);
        haloMesh.rotation.x = -Math.PI / 2;
        haloMesh.position.y = -1.5;
        haloMesh.visible = Boolean(n.isUserCreated);
        rootGroup.add(haloMesh);

        const shadowMesh = new THREE.Mesh(this.shadowGeometry, this.shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        this.group.add(shadowMesh);

        const trailMeshes: THREE.Mesh[] = [];
        for (let t = 0; t < 8; t++) {
          const tm = new THREE.Mesh(this.trailGeometry, this.trailMaterials[t]);
          tm.visible = false;
          this.group.add(tm);
          trailMeshes.push(tm);
        }

        this.group.add(rootGroup);

        const entity: ActivePlane3D = {
          note: n,
          gx,
          gy,
          gz,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          turnRate: (idx % 2 === 0 ? 1 : -1) * (0.15 + (idx % 4) * 0.05),
          bobPhase: idx * 0.9,
          orbitAngle: idx * 0.9,
          rootGroup,
          planeMesh,
          haloMesh,
          shadowMesh,
          trailMeshes,
          trailCoords: [],
          trailTimer: 0,
        };

        this.updateEntityTransform(entity, 0);
        nextPlanes.push(entity);
      }
    });

    // Remove planes no longer in the pool
    for (const old of this.planes) {
      if (!seenIds.has(old.note.id)) {
        this.group.remove(old.rootGroup);
        this.group.remove(old.shadowMesh);
        old.trailMeshes.forEach((tm) => this.group.remove(tm));
        if (this.hoveredPlane === old) {
          this.hoveredPlane = null;
        }
      }
    }

    this.planes = nextPlanes;
  }

  private updateEntityTransform(p: ActivePlane3D, elapsed: number): void {
    const bob = Math.sin(elapsed * 2.4 + p.bobPhase) * 2.8;
    const worldPos = gridToWorld3D(p.gx, p.gy, p.gz + bob);
    p.rootGroup.position.copy(worldPos);

    // Compute 3D velocity heading in world space:
    // worldX = -gy * TILE_SPACING, worldZ = gx * TILE_SPACING
    const vWorldX = -p.vy;
    const vWorldZ = p.vx;
    const yaw = Math.atan2(-vWorldZ, vWorldX);
    const bankRoll = p.turnRate * 0.65;
    const pitch = Math.cos(elapsed * 2.4 + p.bobPhase) * 0.08;

    p.planeMesh.rotation.order = 'YXZ';
    p.planeMesh.rotation.y = yaw;
    p.planeMesh.rotation.z = pitch;
    p.planeMesh.rotation.x = bankRoll;

    // Update ground shadow directly on surface below
    const surfElev = this.getElevation(p.gx, p.gy);
    const shadowPos = gridToWorld3D(p.gx, p.gy, surfElev + 0.5);
    p.shadowMesh.position.copy(shadowPos);

    // Update hover / user halo visibility
    const isHovered = p === this.hoveredPlane;
    if (isHovered) {
      p.haloMesh.visible = true;
      p.haloMesh.material = this.haloHoverMat;
      p.planeMesh.scale.setScalar(1.22);
    } else if (p.note.isUserCreated) {
      p.haloMesh.visible = true;
      p.haloMesh.material = this.haloUserMat;
      p.planeMesh.scale.setScalar(1.05);
    } else {
      p.haloMesh.visible = false;
      p.planeMesh.scale.setScalar(1.0);
    }

    // Update contrail meshes
    for (let i = 0; i < p.trailMeshes.length; i++) {
      const tm = p.trailMeshes[i];
      if (i < p.trailCoords.length) {
        const tc = p.trailCoords[i];
        tm.position.copy(gridToWorld3D(tc.gx, tc.gy, tc.gz));
        tm.visible = true;
      } else {
        tm.visible = false;
      }
    }
  }

  public update(dt: number, elapsed: number): void {
    for (let idx = 0; idx < this.planes.length; idx++) {
      const p = this.planes[idx];
      const isHovered = p === this.hoveredPlane;
      const speedMul = isHovered ? 0.2 : 1.0;

      if (idx < 2) {
        // Orbit the first 2 planes gracefully around the central Lantern Shrine pagoda eaves
        const shrineCx = 5.5;
        const shrineCy = 5.0;
        const radius = idx === 0 ? 1.45 : 1.95;
        const omega = (idx === 0 ? 0.55 : -0.42) * speedMul;
        p.orbitAngle += dt * omega;
        const nextGx = shrineCx + Math.cos(p.orbitAngle) * radius;
        const nextGy = shrineCy + Math.sin(p.orbitAngle) * radius;
        p.vx = (nextGx - p.gx) / Math.max(0.001, dt);
        p.vy = (nextGy - p.gy) / Math.max(0.001, dt);
        p.gx = nextGx;
        p.gy = nextGy;
        p.gz = idx === 0 ? 86 : 72;
      } else {
        const speed = Math.hypot(p.vx, p.vy);
        let ang = Math.atan2(p.vy, p.vx) + p.turnRate * dt * speedMul;

        const cx = 5.5;
        const cy = 5.5;
        if (p.gx < 1.2 || p.gx > GRID - 2.2 || p.gy < 1.2 || p.gy > GRID - 2.2) {
          const toCenter = Math.atan2(cy - p.gy, cx - p.gx);
          const diff = Math.atan2(Math.sin(toCenter - ang), Math.cos(toCenter - ang));
          ang += diff * 1.9 * dt;
        }

        p.vx = Math.cos(ang) * speed;
        p.vy = Math.sin(ang) * speed;
        p.gx += p.vx * dt * speedMul;
        p.gy += p.vy * dt * speedMul;
      }

      p.trailTimer += dt;
      if (p.trailTimer >= 0.11) {
        p.trailTimer = 0;
        const bob = Math.sin(elapsed * 2.4 + p.bobPhase) * 2.8;
        p.trailCoords.push({ gx: p.gx, gy: p.gy, gz: p.gz + bob });
        if (p.trailCoords.length > 8) {
          p.trailCoords.shift();
        }
      }

      this.updateEntityTransform(p, elapsed);
    }
  }

  public pickPlaneAt(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    isTouch = false
  ): ActivePlane3D | null {
    if (this.planes.length === 0) return null;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || canvas.width || 1280);
    const height = Math.max(1, rect.height || canvas.height || 740);
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    // 1. 3D Raycaster check against plane meshes
    const ndcX = (localX / width) * 2 - 1;
    const ndcY = -(localY / height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const meshes = this.planes.map((p) => p.planeMesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const hitId = hits[0].object.userData?.planeId;
      const match = this.planes.find((p) => p.note.id === hitId);
      if (match) return match;
    }

    // 2. Generous Screen-Space Projection Hit Radius (Fitts's Law for fast/touch catching)
    const hitRadiusPx = isTouch ? 38 : 26;
    let best: ActivePlane3D | null = null;
    let bestDist = hitRadiusPx;
    const proj = new THREE.Vector3();

    for (const p of this.planes) {
      proj.copy(p.rootGroup.position).project(camera);
      const sx = ((proj.x + 1) * 0.5) * width;
      const sy = ((-proj.y + 1) * 0.5) * height;
      const dist = Math.hypot(localX - sx, localY - sy);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }

    return best;
  }

  public dispose(): void {
    this.wingGeometry.dispose();
    this.haloGeometry.dispose();
    this.shadowGeometry.dispose();
    this.trailGeometry.dispose();
    this.tintMaterials.forEach((m) => m.dispose());
    this.haloHoverMat.dispose();
    this.haloUserMat.dispose();
    this.shadowMat.dispose();
    this.trailMaterials.forEach((m) => m.dispose());
    this.group.clear();
    this.planes = [];
    this.hoveredPlane = null;
  }
}
