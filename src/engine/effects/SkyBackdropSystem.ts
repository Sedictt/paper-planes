import * as THREE from 'three';
import type { Palette } from '../ThreeWorldEngine';

interface BackdropSprite {
  sprite: THREE.Sprite;
  baseX: number;
  baseY: number;
  parallax: number;
  driftSpeed: number;
  bobPhase: number;
  bobAmp: number;
}

/**
 * Atmospheric 2D parallax sky layer with 3 distinct painted distant voxel islands,
 * stylized two-tone cloud banks, a soft sun halo, and subtle horizon mist.
 */
export class SkyBackdropSystem {
  public readonly group: THREE.Group;

  private textures: THREE.Texture[] = [];
  private materials: THREE.Material[] = [];

  private bgIslandMat: THREE.SpriteMaterial;
  private bgCloudMat: THREE.SpriteMaterial;
  private bgCloudPuffMat: THREE.SpriteMaterial;
  private sunGlowMat: THREE.SpriteMaterial;
  private fgCloudMat: THREE.SpriteMaterial;
  private fgBaseOpacity = 0.16;

  private sprites: BackdropSprite[] = [];

  constructor(initialPalette: Palette) {
    this.group = new THREE.Group();
    this.group.name = 'SkyBackdropParallax';

    const islandTexA = this.createDistantIslandTexture('ridge');
    const islandTexB = this.createDistantIslandTexture('spire');
    const islandTexC = this.createDistantIslandTexture('archipelago');
    const cloudWideTex = this.createStylizedCloudTexture(256, 96, 'wide');
    const cloudPuffTex = this.createStylizedCloudTexture(192, 96, 'puff');
    const sunGlowTex = this.createSunGlowTexture();

    this.textures.push(islandTexA, islandTexB, islandTexC, cloudWideTex, cloudPuffTex, sunGlowTex);

    this.bgIslandMat = new THREE.SpriteMaterial({
      map: islandTexA,
      color: new THREE.Color('#d4ecff'),
      transparent: true,
      opacity: 0.82,
      depthTest: true,
      depthWrite: false,
    });

    const islandMatB = new THREE.SpriteMaterial({
      map: islandTexB,
      color: new THREE.Color('#d4ecff'),
      transparent: true,
      opacity: 0.78,
      depthTest: true,
      depthWrite: false,
    });

    const islandMatC = new THREE.SpriteMaterial({
      map: islandTexC,
      color: new THREE.Color('#cce6ff'),
      transparent: true,
      opacity: 0.68,
      depthTest: true,
      depthWrite: false,
    });

    this.bgCloudMat = new THREE.SpriteMaterial({
      map: cloudWideTex,
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.72,
      depthTest: true,
      depthWrite: false,
    });

    this.bgCloudPuffMat = new THREE.SpriteMaterial({
      map: cloudPuffTex,
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.64,
      depthTest: true,
      depthWrite: false,
    });

    this.sunGlowMat = new THREE.SpriteMaterial({
      map: sunGlowTex,
      color: new THREE.Color('#fff4d6'),
      transparent: true,
      opacity: 0.52,
      depthTest: false,
      depthWrite: false,
    });

    this.fgCloudMat = new THREE.SpriteMaterial({
      map: cloudWideTex,
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: this.fgBaseOpacity,
      depthTest: true,
      depthWrite: false,
    });

    this.materials.push(
      this.bgIslandMat,
      islandMatB,
      islandMatC,
      this.bgCloudMat,
      this.bgCloudPuffMat,
      this.sunGlowMat,
      this.fgCloudMat
    );

    // 1. Soft Sun Glow Halo in upper-left sky
    const sunSprite = new THREE.Sprite(this.sunGlowMat);
    sunSprite.position.set(-460, 230, -2400);
    sunSprite.scale.set(520, 520, 1);
    sunSprite.renderOrder = -950;
    this.group.add(sunSprite);
    this.sprites.push({
      sprite: sunSprite,
      baseX: -460,
      baseY: 230,
      parallax: 0.02,
      driftSpeed: 0,
      bobPhase: 0,
      bobAmp: 0,
    });

    // 2. Three Distinct Distant Floating Islands along the horizon (with aerial perspective haze)
    const distantIslands = [
      { mat: this.bgIslandMat, x: -490, y: 75, w: 220, h: 220, p: 0.06, bob: 3.5, phase: 0.4 },
      { mat: islandMatB, x: 510, y: 110, w: 185, h: 185, p: 0.05, bob: 3.0, phase: 2.1 },
      { mat: islandMatC, x: -430, y: -155, w: 165, h: 165, p: 0.07, bob: 2.8, phase: 4.0 },
    ];
    for (const d of distantIslands) {
      const sp = new THREE.Sprite(d.mat);
      sp.position.set(d.x, d.y, -2200);
      sp.scale.set(d.w, d.h, 1);
      sp.renderOrder = -900;
      this.group.add(sp);
      this.sprites.push({
        sprite: sp,
        baseX: d.x,
        baseY: d.y,
        parallax: d.p,
        driftSpeed: 0,
        bobPhase: d.phase,
        bobAmp: d.bob,
      });
    }

    // 3. Layered Stylized Two-Tone Cloud Banks across sky & lower horizon
    const bgClouds = [
      { mat: this.bgCloudMat, x: -420, y: -215, w: 460, h: 145, speed: 2.2, p: 0.08, phase: 0.2 },
      { mat: this.bgCloudMat, x: 120, y: -235, w: 520, h: 155, speed: 1.8, p: 0.07, phase: 1.8 },
      { mat: this.bgCloudMat, x: 540, y: -205, w: 440, h: 140, speed: 2.5, p: 0.08, phase: 3.1 },
      { mat: this.bgCloudPuffMat, x: -240, y: 215, w: 270, h: 125, speed: 3.6, p: 0.09, phase: 0.9 },
      { mat: this.bgCloudPuffMat, x: 340, y: 235, w: 290, h: 130, speed: 2.9, p: 0.08, phase: 2.6 },
      { mat: this.bgCloudPuffMat, x: 590, y: 15, w: 250, h: 115, speed: 3.4, p: 0.09, phase: 4.3 },
    ];
    for (const c of bgClouds) {
      const sp = new THREE.Sprite(c.mat);
      sp.position.set(c.x, c.y, -2100);
      sp.scale.set(c.w, c.h, 1);
      sp.renderOrder = -880;
      this.group.add(sp);
      this.sprites.push({
        sprite: sp,
        baseX: c.x,
        baseY: c.y,
        parallax: c.p,
        driftSpeed: c.speed,
        bobPhase: c.phase,
        bobAmp: 1.8,
      });
    }

    // 4. Subtle Foreground Cloud Wisps at outer bottom corners (fade out on zoom)
    const fgClouds = [
      { x: -580, y: -290, w: 380, h: 140, speed: 6.5, p: 0.18, phase: 0.7 },
      { x: 570, y: -285, w: 360, h: 135, speed: 5.8, p: 0.16, phase: 2.4 },
    ];
    for (const f of fgClouds) {
      const sp = new THREE.Sprite(this.fgCloudMat);
      sp.position.set(f.x, f.y, -150);
      sp.scale.set(f.w, f.h, 1);
      sp.renderOrder = 50;
      this.group.add(sp);
      this.sprites.push({
        sprite: sp,
        baseX: f.x,
        baseY: f.y,
        parallax: f.p,
        driftSpeed: f.speed,
        bobPhase: f.phase,
        bobAmp: 2.5,
      });
    }
  }

  private createSunGlowTexture(): THREE.CanvasTexture {
    const canvas =
      typeof document !== 'undefined' && document.createElement
        ? document.createElement('canvas')
        : ({ width: 128, height: 128, getContext: () => null } as unknown as HTMLCanvasElement);
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, 'rgba(255, 250, 230, 0.9)');
      g.addColorStop(0.3, 'rgba(255, 240, 200, 0.4)');
      g.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createDistantIslandTexture(variant: 'ridge' | 'spire' | 'archipelago'): THREE.CanvasTexture {
    const canvas =
      typeof document !== 'undefined' && document.createElement
        ? document.createElement('canvas')
        : ({ width: 256, height: 256, getContext: () => null } as unknown as HTMLCanvasElement);
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);

      const drawIsoBlock = (cx: number, cy: number, rx: number, ry: number, h: number, topCol: string, leftCol: string, rightCol: string) => {
        // Left shaded face
        ctx.fillStyle = leftCol;
        ctx.beginPath();
        ctx.moveTo(cx - rx, cy);
        ctx.lineTo(cx, cy + ry);
        ctx.lineTo(cx, cy + ry + h);
        ctx.lineTo(cx - rx * 0.72, cy + h * 0.85);
        ctx.closePath();
        ctx.fill();

        // Right sunlit face
        ctx.fillStyle = rightCol;
        ctx.beginPath();
        ctx.moveTo(cx + rx, cy);
        ctx.lineTo(cx, cy + ry);
        ctx.lineTo(cx, cy + ry + h);
        ctx.lineTo(cx + rx * 0.72, cy + h * 0.85);
        ctx.closePath();
        ctx.fill();

        // Top grass diamond
        ctx.fillStyle = topCol;
        ctx.beginPath();
        ctx.moveTo(cx, cy - ry);
        ctx.lineTo(cx + rx, cy);
        ctx.lineTo(cx, cy + ry);
        ctx.lineTo(cx - rx, cy);
        ctx.closePath();
        ctx.fill();
      };

      const drawVoxelTree = (tx: number, ty: number, s: number) => {
        ctx.fillStyle = '#6c5856';
        ctx.fillRect(tx - 3 * s, ty - 10 * s, 6 * s, 12 * s);
        ctx.fillStyle = '#75b864';
        ctx.fillRect(tx - 12 * s, ty - 24 * s, 24 * s, 15 * s);
        ctx.fillStyle = '#8ccf72';
        ctx.fillRect(tx - 9 * s, ty - 35 * s, 18 * s, 13 * s);
        ctx.fillStyle = '#9fe084';
        ctx.fillRect(tx - 5 * s, ty - 43 * s, 10 * s, 9 * s);
      };

      if (variant === 'ridge') {
        drawIsoBlock(128, 122, 82, 34, 62, '#86c972', '#6a6572', '#837882');
        drawIsoBlock(104, 104, 48, 20, 26, '#94d67c', '#6e6875', '#877d88');
        drawVoxelTree(92, 98, 1.0);
        drawVoxelTree(116, 104, 0.8);
        drawVoxelTree(166, 118, 0.85);
      } else if (variant === 'spire') {
        drawIsoBlock(128, 114, 68, 28, 92, '#86c972', '#686270', '#807680');
        drawIsoBlock(146, 98, 34, 14, 24, '#95d97e', '#6f6976', '#8a7f8a');
        drawVoxelTree(146, 94, 0.95);
        drawVoxelTree(106, 112, 0.78);
      } else {
        drawIsoBlock(108, 126, 62, 26, 54, '#86c972', '#6a6572', '#837882');
        drawIsoBlock(176, 142, 34, 14, 34, '#91d179', '#6a6572', '#837882');
        drawVoxelTree(98, 118, 0.85);
        drawVoxelTree(122, 126, 0.65);
        drawVoxelTree(176, 136, 0.6);
      }

      // Soft atmospheric mist fade at bottom so islands melt into the sky
      ctx.globalCompositeOperation = 'source-atop';
      const mist = ctx.createLinearGradient(0, 120, 0, 235);
      mist.addColorStop(0, 'rgba(195, 230, 255, 0)');
      mist.addColorStop(1, 'rgba(210, 235, 255, 0.78)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, 256, 256);
      ctx.globalCompositeOperation = 'source-over';
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createStylizedCloudTexture(w: number, h: number, style: 'wide' | 'puff'): THREE.CanvasTexture {
    const canvas =
      typeof document !== 'undefined' && document.createElement
        ? document.createElement('canvas')
        : ({ width: w, height: h, getContext: () => null } as unknown as HTMLCanvasElement);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);

      // Crisp two-tone stylized cloud (cool periwinkle base + bright white sunlit puffs)
      const basePuffs =
        style === 'wide'
          ? [
              [w * 0.22, h * 0.66, 22],
              [w * 0.38, h * 0.58, 28],
              [w * 0.55, h * 0.56, 30],
              [w * 0.72, h * 0.62, 26],
              [w * 0.84, h * 0.68, 20],
            ]
          : [
              [w * 0.28, h * 0.62, 22],
              [w * 0.50, h * 0.52, 28],
              [w * 0.72, h * 0.62, 22],
            ];

      // Cool underside shadow silhouette
      ctx.fillStyle = 'rgba(195, 220, 245, 0.88)';
      ctx.beginPath();
      for (const [px, py, pr] of basePuffs) {
        ctx.moveTo(px + pr, py + 4);
        ctx.arc(px, py + 4, pr, 0, Math.PI * 2);
      }
      ctx.fill();

      // Sunlit creamy-white top puffs
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.beginPath();
      for (const [px, py, pr] of basePuffs) {
        ctx.moveTo(px + pr * 0.92, py - 3);
        ctx.arc(px, py - 3, pr * 0.92, 0, Math.PI * 2);
      }
      ctx.fill();

      // Soft bottom horizon fade
      ctx.globalCompositeOperation = 'destination-out';
      const fade = ctx.createLinearGradient(0, h * 0.68, 0, h);
      fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
      fade.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, h * 0.68, w, h * 0.32);
      ctx.globalCompositeOperation = 'source-over';
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public update(elapsed: number, camX: number, camY: number, zoom: number): void {
    const invZ = 1 / Math.max(0.25, zoom);
    this.group.scale.set(invZ, invZ, 1);

    const zoomFade = Math.max(0, Math.min(1, 1 - (zoom - 1.05) / 0.6));
    this.fgCloudMat.opacity = this.fgBaseOpacity * zoomFade;

    for (const item of this.sprites) {
      let x = item.baseX - camX * item.parallax;
      if (item.driftSpeed > 0) {
        const span = 1560;
        x = ((((x + elapsed * item.driftSpeed + span / 2) % span) + span) % span) - span / 2;
      }
      const y = item.baseY - camY * item.parallax + Math.sin(elapsed * 0.5 + item.bobPhase) * item.bobAmp;
      item.sprite.position.x = x;
      item.sprite.position.y = y;
    }
  }

  public setPalette(pal: Palette): void {
    const isNight = pal.stars >= 0.5;
    const isDuskOrDawn = pal.label === 'Dawn' || pal.label === 'Dusk';

    const islandTint = isNight ? '#586c94' : isDuskOrDawn ? '#f2d9e8' : '#d4ecff';
    const cloudTint = isNight ? '#46587d' : isDuskOrDawn ? '#ffe4d9' : '#ffffff';

    for (const m of this.materials) {
      if (m === this.sunGlowMat) {
        (m as THREE.SpriteMaterial).opacity = isNight ? 0.12 : 0.52;
      } else if (m === this.fgCloudMat) {
        (m as THREE.SpriteMaterial).color.set(cloudTint);
        this.fgBaseOpacity = isNight ? 0.10 : 0.16;
      } else if (m === this.bgCloudMat || m === this.bgCloudPuffMat) {
        (m as THREE.SpriteMaterial).color.set(cloudTint);
        (m as THREE.SpriteMaterial).opacity = isNight ? 0.34 : 0.72;
      } else {
        (m as THREE.SpriteMaterial).color.set(islandTint);
      }
    }
  }

  public dispose(): void {
    this.textures.forEach((t) => t.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.length = 0;
    this.materials.length = 0;
    this.sprites.length = 0;
    this.group.clear();
  }
}
