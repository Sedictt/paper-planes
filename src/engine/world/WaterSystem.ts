import * as THREE from 'three';
import type { Palette } from '../ThreeWorldEngine';
import type { WeatherMode } from '../../types';
import { TILE_SPACING, ELEV_UNIT } from './TerrainBuilder';

export interface WaterSystemConfig {
  streamElevation?: number; // default 14
  waterfallDrop?: number;   // default -35
}

export class WaterSystem {
  public readonly group: THREE.Group;

  private streamMesh: THREE.Mesh;
  private streamMaterial: THREE.ShaderMaterial;

  private waterfallMesh: THREE.Mesh;
  private waterfallMaterial: THREE.ShaderMaterial;

  private lipFrothMesh: THREE.Mesh;
  private mistParticles: THREE.Points;
  private mistGeometry: THREE.BufferGeometry;
  private mistMaterial: THREE.PointsMaterial;

  private mistData: Array<{
    basePos: THREE.Vector3;
    lifetime: number;
    age: number;
    speed: number;
    wobblePhase: number;
  }> = [];

  constructor(palette: Palette, config: WaterSystemConfig = {}) {
    this.group = new THREE.Group();
    this.group.name = 'WaterSystemGroup';

    const elev = (config.streamElevation ?? 14) * ELEV_UNIT;
    const dropY = (config.waterfallDrop ?? -35) * ELEV_UNIT;

    // 1. Build Stream Geometry & Shader
    const streamGeo = this.buildStreamGeometry(elev - 0.1);
    this.streamMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWaterColor: { value: new THREE.Color(palette.river) },
        uWaterDeepColor: { value: new THREE.Color(palette.seaDeep) },
        uFoamColor: { value: new THREE.Color(palette.seaFoam) },
        uOpacity: { value: 0.85 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPosition;
        void main() {
          vec3 pos = position;
          // Organic undulating wave
          float wave = sin(uTime * 2.2 + position.x * 0.05 + position.z * 0.05) * 0.4;
          pos.y += wave;
          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uWaterColor;
        uniform vec3 uWaterDeepColor;
        uniform vec3 uFoamColor;
        uniform float uOpacity;
        varying vec3 vWorldPosition;

        vec2 hash22(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453);
        }

        // Returns (minDist, secondMinDist) for crisp Voronoi cellular caustics
        vec2 voronoi(vec2 x, float time) {
          vec2 n = floor(x);
          vec2 f = fract(x);
          float d1 = 8.0;
          float d2 = 8.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash22(n + g);
              o = 0.5 + 0.42 * sin(time * 1.4 + 6.2831 * o);
              vec2 r = g + o - f;
              float d = dot(r, r);
              if (d < d1) {
                d2 = d1;
                d1 = d;
              } else if (d < d2) {
                d2 = d;
              }
            }
          }
          return vec2(sqrt(d1), sqrt(d2));
        }

        void main() {
          // Stream flows downstream along +gy (which is -x in world space)
          vec2 uv = vec2(-vWorldPosition.x, vWorldPosition.z) / 36.0;
          uv.x -= uTime * 0.42;
          uv.y += sin(uv.x * 1.3 + uTime * 0.7) * 0.14;

          vec2 v1 = voronoi(uv, uTime);
          float edge1 = v1.y - v1.x;
          float causticWeb = 1.0 - smoothstep(0.035, 0.11, edge1);

          // Secondary subtle depth layer for cel-shaded turquoise patches
          vec2 v2 = voronoi(uv * 0.75 + vec2(3.1, 1.7) - vec2(uTime * 0.15, 0.0), uTime * 0.8);
          float cellShade = smoothstep(0.15, 0.55, v2.x);

          vec3 col = mix(uWaterDeepColor, uWaterColor, 0.45 + 0.55 * cellShade);
          col = mix(col, uFoamColor, causticWeb * 0.78);
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });
    this.streamMesh = new THREE.Mesh(streamGeo, this.streamMaterial);
    this.streamMesh.renderOrder = 1;
    this.streamMesh.name = 'StreamWaterMesh';
    this.group.add(this.streamMesh);

    // 2. Build Waterfall Cascade Geometry & Shader
    const waterfallGeo = this.buildWaterfallGeometry(elev, dropY);
    this.waterfallMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uWaterColor: { value: new THREE.Color(palette.river) },
        uFoamColor: { value: new THREE.Color(palette.seaFoam) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uWaterColor;
        uniform vec3 uFoamColor;
        varying vec2 vUv;
        void main() {
          float vScroll = vUv.y * 2.5 - uTime * 3.2;
          float ribbons = sin(vUv.x * 18.0 + sin(vScroll * 3.0) * 1.1);
          float foamStreak = smoothstep(-0.1, 0.65, ribbons);

          float lipFroth = smoothstep(0.82, 1.0, vUv.y);
          float baseSpray = smoothstep(0.32, 0.0, vUv.y);
          float bottomFade = smoothstep(0.0, 0.26, vUv.y);

          vec3 col = mix(uWaterColor, uFoamColor, 0.28 + 0.52 * foamStreak);
          col = mix(col, uFoamColor, lipFroth * 0.75 + baseSpray * 0.65);
          float alpha = (0.85 + 0.12 * lipFroth) * bottomFade;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.waterfallMesh = new THREE.Mesh(waterfallGeo, this.waterfallMaterial);
    this.waterfallMesh.renderOrder = 2;
    this.waterfallMesh.visible = false;
    this.waterfallMesh.name = 'WaterfallCascadeMesh';
    this.group.add(this.waterfallMesh);

    // 3. Build Lip Froth Bar (hidden)
    const lipGeo = new THREE.CylinderGeometry(2.4, 2.4, 52, 8);
    lipGeo.rotateX(Math.PI / 2);
    const lipMat = new THREE.MeshBasicMaterial({ color: palette.seaFoam });
    this.lipFrothMesh = new THREE.Mesh(lipGeo, lipMat);
    this.lipFrothMesh.position.set(-11 * TILE_SPACING, elev, 4.5 * TILE_SPACING);
    this.lipFrothMesh.visible = false;
    this.lipFrothMesh.name = 'WaterfallLipFroth';
    this.group.add(this.lipFrothMesh);

    // 4. Build Waterfall Mist System (24 particles)
    const particleCount = 24;
    this.mistGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const baseWaterfallPos = new THREE.Vector3(-11 * TILE_SPACING - 6, dropY + 2, 4.5 * TILE_SPACING);

    for (let i = 0; i < particleCount; i++) {
      this.mistData.push({
        basePos: baseWaterfallPos.clone(),
        lifetime: 1.5 + (i % 5) * 0.25,
        age: (i / particleCount) * 2.0,
        speed: 8.0 + (i % 4) * 2.5,
        wobblePhase: i * 0.7,
      });
      positions[i * 3 + 0] = baseWaterfallPos.x;
      positions[i * 3 + 1] = baseWaterfallPos.y;
      positions[i * 3 + 2] = baseWaterfallPos.z;
    }
    this.mistGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mistMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(palette.seaFoam),
      size: 6.5,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.mistParticles = new THREE.Points(this.mistGeometry, this.mistMaterial);
    this.mistParticles.renderOrder = 3;
    this.mistParticles.visible = false;
    this.mistParticles.name = 'WaterfallMistParticles';
    this.group.add(this.mistParticles);
  }

  private buildStreamGeometry(y: number): THREE.BufferGeometry {
    // 8 stream cells: (5,5), (5,6), (5,7), (5,8), (4,7), (4,8), (4,9), (4,10)
    const streamCells = [
      [5, 5], [5, 6], [5, 7], [5, 8],
      [4, 7], [4, 8], [4, 9], [4, 10],
    ];
    const vertices: number[] = [];
    const uvs: number[] = [];
    const S = TILE_SPACING;

    for (const [gx, gy] of streamCells) {
      const x0 = -gy * S, z0 = gx * S;
      const x1 = -gy * S, z1 = (gx + 1) * S;
      const x2 = -(gy + 1) * S, z2 = (gx + 1) * S;
      const x3 = -(gy + 1) * S, z3 = gx * S;

      // Triangle 1: p0, p1, p2
      vertices.push(x0, y, z0,  x1, y, z1,  x2, y, z2);
      uvs.push(0, 0,  1, 0,  1, 1);

      // Triangle 2: p0, p2, p3
      vertices.push(x0, y, z0,  x2, y, z2,  x3, y, z3);
      uvs.push(0, 0,  1, 1,  0, 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  private buildWaterfallGeometry(yTop: number, yBottom: number): THREE.BufferGeometry {
    const S = TILE_SPACING;
    const width = 52;
    const segmentsY = 16;
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Flush with front-left (-X) cliff face of waterfall tile (gx=4, gy=10)
    const cx = -11 * S;
    const cz = 4.5 * S;
    const nx = -1;
    const nz = 0;
    const tx = 0;
    const tz = 1;

    for (let iy = 0; iy <= segmentsY; iy++) {
      const v = iy / segmentsY; // 0 (bottom) to 1 (top)
      const y = yBottom + v * (yTop - yBottom);
      // Flush at top lip (v=1 -> curl=0), arcing smoothly outward as it falls (v=0 -> curl=9)
      const curl = Math.pow(1.0 - v, 1.4) * 9.0;

      for (let ix = 0; ix <= 1; ix++) {
        const u = ix;
        const wOffset = (u - 0.5) * width;
        const vx = cx + tx * wOffset + nx * curl;
        const vz = cz + tz * wOffset + nz * curl;

        vertices.push(vx, y, vz);
        uvs.push(u, v);
      }
    }

    for (let iy = 0; iy < segmentsY; iy++) {
      const row1 = iy * 2;
      const row2 = (iy + 1) * 2;
      indices.push(row1, row1 + 1, row2);
      indices.push(row1 + 1, row2 + 1, row2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  public update(dt: number, elapsed: number): void {
    // 1. Update Shaders
    this.streamMaterial.uniforms.uTime.value = elapsed;
    this.waterfallMaterial.uniforms.uTime.value = elapsed;

    // 2. Animate Lip Froth Pulse
    const scale = 1.0 + Math.sin(elapsed * 6.0) * 0.12;
    this.lipFrothMesh.scale.set(1.0, scale, scale);

    // 3. Update Mist Particles
    const posAttr = this.mistGeometry.getAttribute('position') as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < this.mistData.length; i++) {
      const p = this.mistData[i];
      p.age += dt;
      if (p.age > p.lifetime) {
        p.age = 0;
      }
      const progress = p.age / p.lifetime;
      const wobbleX = Math.sin(elapsed * 3.0 + p.wobblePhase) * 4.0;
      const wobbleZ = Math.cos(elapsed * 2.5 + p.wobblePhase) * 4.0;

      array[i * 3 + 0] = p.basePos.x + wobbleX;
      array[i * 3 + 1] = p.basePos.y + progress * 20.0;
      array[i * 3 + 2] = p.basePos.z + wobbleZ;
    }
    posAttr.needsUpdate = true;
  }

  public setPalette(pal: Palette): void {
    this.streamMaterial.uniforms.uWaterColor.value.set(pal.river);
    this.streamMaterial.uniforms.uWaterDeepColor.value.set(pal.seaDeep);
    this.streamMaterial.uniforms.uFoamColor.value.set(pal.seaFoam);

    this.waterfallMaterial.uniforms.uWaterColor.value.set(pal.river);
    this.waterfallMaterial.uniforms.uFoamColor.value.set(pal.seaFoam);

    (this.lipFrothMesh.material as THREE.MeshBasicMaterial).color.set(pal.seaFoam);
    this.mistMaterial.color.set(pal.seaFoam);
  }

  public setWeather(weather: WeatherMode): void {
    if (weather === 'snow') {
      this.streamMaterial.uniforms.uOpacity.value = 0.95; // Slushy ice
    } else {
      this.streamMaterial.uniforms.uOpacity.value = 0.85;
    }
  }

  public getWaterMesh(): THREE.Mesh {
    return this.streamMesh;
  }

  public getWaterfallMesh(): THREE.Mesh {
    return this.waterfallMesh;
  }

  public getMistParticles(): THREE.Points {
    return this.mistParticles;
  }

  public dispose(): void {
    this.streamMesh.geometry.dispose();
    this.streamMaterial.dispose();

    this.waterfallMesh.geometry.dispose();
    this.waterfallMaterial.dispose();

    this.lipFrothMesh.geometry.dispose();
    (this.lipFrothMesh.material as THREE.Material).dispose();

    this.mistGeometry.dispose();
    this.mistMaterial.dispose();

    this.group.clear();
  }
}
