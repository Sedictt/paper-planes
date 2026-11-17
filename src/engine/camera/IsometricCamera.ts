import * as THREE from 'three';

export interface CameraConfig {
  virtualHeight?: number;
  initialZoom?: number;
  initialCamX?: number;
  initialCamY?: number;
  minZoom?: number;
  maxZoom?: number;
  panLimitX?: number;
  panMinY?: number;
  panMaxY?: number;
  lerpSpeed?: number;
}

const TILE_W = 78;
const TILE_H = 39;

export class IsometricCamera {
  public readonly camera: THREE.OrthographicCamera;

  // Camera metrics & state
  public zoom: number;
  public camX: number;
  public camY: number;

  public targetCamX: number;
  public targetCamY: number;
  public targetZoom: number;

  public readonly virtualHeight: number;
  public readonly minZoom: number;
  public readonly maxZoom: number;
  public readonly panLimitX: number;
  public readonly panMinY: number;
  public readonly panMaxY: number;
  public readonly lerpSpeed: number;

  private velX = 0;
  private velY = 0;
  private onZoomChange?: (z: number) => void;

  constructor(config: CameraConfig = {}, onZoomChange?: (z: number) => void) {
    this.virtualHeight = config.virtualHeight ?? 740;
    this.zoom = config.initialZoom ?? 1.05;
    this.camX = config.initialCamX ?? 0;
    this.camY = config.initialCamY ?? -175;
    this.targetCamX = this.camX;
    this.targetCamY = this.camY;
    this.targetZoom = this.zoom;

    this.minZoom = config.minZoom ?? 0.65;
    this.maxZoom = config.maxZoom ?? 2.3;
    this.panLimitX = config.panLimitX ?? 650;
    this.panMinY = config.panMinY ?? -600;
    this.panMaxY = config.panMaxY ?? 200;
    this.lerpSpeed = config.lerpSpeed ?? 9;

    this.onZoomChange = onZoomChange;

    // Initialize Three.js OrthographicCamera with virtual height 740
    const halfH = this.virtualHeight / 2;
    const initialAspect = 1280 / 740;
    const halfW = halfH * initialAspect;

    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -2000, 3000);

    // Exact 2:1 Dimetric Isometric Orientation:
    // Pitch: 30° elevation (sin 30° = 0.5, exact 2:1 dimetric ratio)
    // Yaw: -45° (Math.PI / 4)
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = -Math.PI / 4;
    this.camera.rotation.x = -Math.PI / 6;

    this.syncCameraTransform();
  }

  public updateAspect(aspect: number): void {
    const halfH = this.virtualHeight / 2;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  public focusBiome(gx: number, gy: number, targetZoom: number, elev = 25): void {
    this.velX = 0;
    this.velY = 0;
    const worldX = (gx - gy) * (TILE_W / 2);
    const worldY = (gx + gy) * (TILE_H / 2) - elev;

    this.targetCamX = this.clampCamX(-worldX);
    this.targetCamY = this.clampCamY(-worldY);
    this.targetZoom = this.clampZoom(targetZoom);

    this.onZoomChange?.(this.targetZoom);
  }

  /** Center camera on an exact 3D world position with an optional un-clamped cutscene zoom. */
  public focusWorldPoint(worldPos: THREE.Vector3, targetZoom: number, worldYOffset = 0): void {
    this.velX = 0;
    this.velY = 0;
    const local = worldPos.clone().applyQuaternion(this.camera.quaternion.clone().invert());
    this.targetCamX = -local.x;
    this.targetCamY = local.y + worldYOffset;
    this.targetZoom = Math.max(this.minZoom, targetZoom);

    this.onZoomChange?.(this.targetZoom);
  }

  public adjustZoom(delta: number): void {
    const nextZoom = Number((this.targetZoom + delta).toFixed(2));
    this.targetZoom = this.clampZoom(nextZoom);

    this.onZoomChange?.(this.targetZoom);
  }

  public panByScreenDelta(
    dx: number,
    dy: number,
    viewportWidth: number,
    viewportHeight: number
  ): void {
    const aspect = viewportWidth / Math.max(1, viewportHeight);
    const pixW = Math.round(this.virtualHeight * aspect);
    const pixH = this.virtualHeight;

    const deltaX = ((dx / Math.max(1, viewportWidth)) * pixW) / this.zoom;
    const deltaY = ((dy / Math.max(1, viewportHeight)) * pixH) / this.zoom;

    this.velX = 0;
    this.velY = 0;
    this.targetCamX = this.clampCamX(this.targetCamX + deltaX);
    this.targetCamY = this.clampCamY(this.targetCamY + deltaY);

    // Direct update for 0ms drag latency
    this.camX = this.targetCamX;
    this.camY = this.targetCamY;

    this.syncCameraTransform();
  }

  public stopMomentum(): void {
    this.velX = 0;
    this.velY = 0;
  }

  /** Apply release velocity (screen px/sec) for smooth mobile inertia panning. */
  public setPanVelocity(
    vxScreen: number,
    vyScreen: number,
    viewportWidth: number,
    viewportHeight: number
  ): void {
    const aspect = viewportWidth / Math.max(1, viewportHeight);
    const pixW = Math.round(this.virtualHeight * aspect);
    const pixH = this.virtualHeight;

    const maxWorldSpeed = 1400 / Math.max(0.5, this.zoom);
    const rawVx = ((vxScreen / Math.max(1, viewportWidth)) * pixW) / this.zoom;
    const rawVy = ((vyScreen / Math.max(1, viewportHeight)) * pixH) / this.zoom;

    const speed = Math.hypot(rawVx, rawVy);
    if (speed < 35) {
      this.velX = 0;
      this.velY = 0;
      return;
    }
    const scale = speed > maxWorldSpeed ? maxWorldSpeed / speed : 1;
    this.velX = rawVx * scale;
    this.velY = rawVy * scale;
  }

  public update(dt: number): void {
    if (Math.abs(this.velX) > 1 || Math.abs(this.velY) > 1) {
      this.targetCamX = this.clampCamX(this.targetCamX + this.velX * dt);
      this.targetCamY = this.clampCamY(this.targetCamY + this.velY * dt);
      const decay = Math.exp(-7.5 * dt);
      this.velX *= decay;
      this.velY *= decay;
    } else {
      this.velX = 0;
      this.velY = 0;
    }

    const lerpFactor = Math.min(1, dt * this.lerpSpeed);

    this.camX += (this.targetCamX - this.camX) * lerpFactor;
    this.camY += (this.targetCamY - this.camY) * lerpFactor;
    this.zoom += (this.targetZoom - this.zoom) * lerpFactor;

    this.syncCameraTransform();
  }

  public syncCameraTransform(): void {
    this.camera.zoom = this.zoom;
    this.camera.position.set(0, 0, 0);
    this.camera.translateX(-this.camX);
    this.camera.translateY(this.camY);
    this.camera.translateZ(1000);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  public clampZoom(z: number): number {
    return Math.max(this.minZoom, Math.min(this.maxZoom, z));
  }

  public clampCamX(x: number): number {
    return Math.max(-this.panLimitX, Math.min(this.panLimitX, x));
  }

  public clampCamY(y: number): number {
    return Math.max(this.panMinY, Math.min(this.panMaxY, y));
  }
}
