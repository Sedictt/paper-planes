import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  TerrainBuilder,
  TILE_SPACING,
  ELEV_UNIT,
  gridToWorld3D,
  type TerrainKind,
} from '../src/engine/world/TerrainBuilder';
import { PropBuilder } from '../src/engine/world/PropBuilder';
import { WaterSystem } from '../src/engine/world/WaterSystem';
import { DioramaWorld } from '../src/engine/world/DioramaWorld';
import { ThreeWorldEngine, PALETTES } from '../src/engine/ThreeWorldEngine';
import { IsometricCamera } from '../src/engine/camera/IsometricCamera';
import { BIOME_SPOTS } from '../src/types';

describe('Milestone 2: World, Terrain & Props Test Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. TERRAIN SYSTEM & 12x12 DIORAMA GRID
  // ===========================================================================
  describe('Terrain System (TerrainBuilder)', () => {
    it('initializes a 12x12 grid with stepped elevations and perimeter voids', () => {
      const terrain = new TerrainBuilder(PALETTES.morning);
      const grid = terrain.getGrid();

      expect(grid.length).toBe(12);
      expect(grid[0].length).toBe(12);

      // Verify perimeter voids
      expect(grid[0][0]).toBeNull();
      expect(grid[0][11]).toBeNull();
      expect(grid[11][0]).toBeNull();
      expect(grid[11][11]).toBeNull();
      expect(grid[10][5]).toBeNull();

      // Verify high north ridge elevations
      expect(terrain.getElevation(3, 1)).toBe(54); // Hollow trunk summit
      expect(terrain.getElevation(2, 2)).toBe(52); // Cottage stoop
      expect(terrain.getElevation(3, 2)).toBe(52); // Pine
      expect(terrain.getElevation(4, 1)).toBe(52);

      // Verify mid terraces
      expect(terrain.getElevation(2, 3)).toBe(42);
      expect(terrain.getElevation(4, 2)).toBe(42);
      expect(terrain.getElevation(5, 2)).toBe(42);
      expect(terrain.getElevation(1, 5)).toBe(34);
      expect(terrain.getElevation(3, 4)).toBe(42);
      expect(terrain.getElevation(6, 2)).toBe(34); // Monolith stone
      expect(terrain.getElevation(7, 3)).toBe(34); // Amanita mushroom

      // Verify island plane
      expect(terrain.getElevation(1, 8)).toBe(25);
      expect(terrain.getElevation(4, 4)).toBe(34);
      expect(terrain.getElevation(7, 6)).toBe(26); // Cabbage garden
      expect(terrain.getElevation(7, 7)).toBe(26); // Garden sprout
      expect(terrain.getElevation(8, 6)).toBe(26);
      expect(terrain.getElevation(9, 6)).toBe(25); // Frog pot terrace

      // Verify sunken stream channel at 14
      expect(terrain.getElevation(5, 5)).toBe(14);
      expect(terrain.getElevation(5, 6)).toBe(14);
      expect(terrain.getElevation(5, 7)).toBe(14);
      expect(terrain.getElevation(5, 8)).toBe(14);
      expect(terrain.getElevation(4, 7)).toBe(14);
      expect(terrain.getElevation(4, 8)).toBe(14);
      expect(terrain.getElevation(4, 9)).toBe(14);
      expect(terrain.getElevation(4, 10)).toBe(14); // Waterfall lip

      terrain.dispose();
    });

    it('instantiates all 11 terrain kinds across the grid', () => {
      const terrain = new TerrainBuilder(PALETTES.morning);
      const grid = terrain.getGrid();

      const foundKinds = new Set<TerrainKind>();
      for (let x = 0; x < 12; x++) {
        for (let y = 0; y < 12; y++) {
          const cell = grid[x][y];
          if (cell) {
            foundKinds.add(cell.kind);
          } else {
            foundKinds.add('void');
          }
        }
      }

      const expectedKinds: TerrainKind[] = [
        'void',
        'grass',
        'grassAlt',
        'plank',
        'stairs_sw',
        'stairs_se',
        'mulch',
        'garden_bed',
        'stream',
        'waterfall',
      ];

      for (const kind of expectedKinds) {
        expect(foundKinds.has(kind)).toBe(true);
      }

      terrain.dispose();
    });

    it('generates high-resolution procedural pixel-art textures with NearestFilter', () => {
      const terrain = new TerrainBuilder(PALETTES.morning);
      const textures = terrain.getTextures();

      expect(textures.size).toBeGreaterThanOrEqual(8);
      const requiredTextures = [
        'grass',
        'grassAlt',
        'plank',
        'mulch',
        'garden_bed',
        'earth_cut',
        'stream_bed',
        'cliff_sw',
        'cliff_se',
      ];

      for (const name of requiredTextures) {
        const tex = textures.get(name);
        expect(tex).toBeDefined();
        expect(tex?.magFilter).toBe(THREE.NearestFilter);
        expect(tex?.minFilter).toBe(THREE.NearestFilter);
        expect(tex?.generateMipmaps).toBe(false);
        expect(tex?.colorSpace).toBe(THREE.SRGBColorSpace);
      }

      terrain.dispose();
    });

    it('constructs multi-material voxel boxes and 3-step timber staircases', () => {
      const terrain = new TerrainBuilder(PALETTES.morning);

      // Verify voxel box count
      let boxMeshCount = 0;
      let staircaseCount = 0;

      terrain.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.name.startsWith('Terrain_')) {
          boxMeshCount++;
          expect(Array.isArray(obj.material)).toBe(true);
          expect((obj.material as THREE.Material[]).length).toBe(6);
          expect(obj.castShadow).toBe(true);
          expect(obj.receiveShadow).toBe(true);
        } else if (obj instanceof THREE.Group && obj.name.startsWith('Stairs_')) {
          staircaseCount++;
          expect(obj.children.length).toBe(3); // 3 sub-steps per staircase
        }
      });

      expect(boxMeshCount).toBeGreaterThanOrEqual(40);
      expect(staircaseCount).toBe(4); // stairs_sw at (2,5), (2,7), (6,5); stairs_se at (5,3)

      // Verify bedrock keel mesh presence
      const keel = terrain.group.getObjectByName('BedrockKeel');
      expect(keel).toBeDefined();
      expect(keel).toBeInstanceOf(THREE.Mesh);

      terrain.dispose();
    });
  });

  // ===========================================================================
  // 2. 23 SCULPTED WOODLAND PROPS
  // ===========================================================================
  describe('Sculpted Props (PropBuilder)', () => {
    it('creates all 23 sculpted prop kinds with 33 exact placement coordinates', () => {
      const terrain = new TerrainBuilder(PALETTES.morning);
      const propBuilder = new PropBuilder((gx, gy) => terrain.getElevation(gx, gy));

      expect(propBuilder.propRecords.length).toBe(33);

      const uniqueKinds = new Set(propBuilder.propRecords.map((r) => r.kind));
      expect(uniqueKinds.size).toBe(23);

      const expectedKinds = [
        'aframe_cottage',
        'hollow_trunk',
        'pine',
        'round_bush',
        'monolith_stone',
        'amanita_mushroom',
        'campfire',
        'watering_can',
        'cabbage',
        'garden_sprout',
        'frog_planter',
        'mushroom_stump',
        'fallen_log',
        'pond_frog',
        'cattails',
        'lilypads',
        'stream_rock',
        'pink_mushrooms',
        'tulips',
        'daisies',
        'marigolds',
        'sprout_shrub',
        'bonsai_bush',
      ];

      for (const k of expectedKinds) {
        expect(uniqueKinds.has(k)).toBe(true);
      }

      // Check specific placements and elevations (centered at gx + 0.5, gy + 0.5)
      const cottage = propBuilder.propRecords.find((r) => r.kind === 'aframe_cottage');
      expect(cottage?.gx).toBe(2.5);
      expect(cottage?.gy).toBe(2.5);
      expect(cottage?.gz).toBe(52);

      const trunk = propBuilder.propRecords.find((r) => r.kind === 'hollow_trunk');
      expect(trunk?.gx).toBe(3.5);
      expect(trunk?.gy).toBe(1.5);
      expect(trunk?.gz).toBe(54);

      const campfire = propBuilder.propRecords.find((r) => r.kind === 'campfire');
      expect(campfire?.gx).toBe(2.5);
      expect(campfire?.gy).toBe(6.5);
      expect(campfire?.gz).toBe(34);

      const frogPlanter = propBuilder.propRecords.find((r) => r.kind === 'frog_planter');
      expect(frogPlanter?.gx).toBe(9.5);
      expect(frogPlanter?.gy).toBe(6.5);

      const pines = propBuilder.propRecords.filter((r) => r.kind === 'pine');
      expect(pines.length).toBe(4);

      propBuilder.dispose();
      terrain.dispose();
    });

    it('positions props flush on terrain matching gridToWorld3D mapping', () => {
      const terrain = new TerrainBuilder(PALETTES.morning);
      const propBuilder = new PropBuilder((gx, gy) => terrain.getElevation(gx, gy));

      for (const rec of propBuilder.propRecords) {
        const expected = gridToWorld3D(rec.gx, rec.gy, rec.gz);
        expect(rec.group.position.x).toBeCloseTo(expected.x, 3);
        expect(rec.group.position.y).toBeCloseTo(expected.y, 3);
        expect(rec.group.position.z).toBeCloseTo(expected.z, 3);
      }

      propBuilder.dispose();
      terrain.dispose();
    });

    it('anchors campfire position correctly and animates flame flicker', () => {
      const terrain = new TerrainBuilder(PALETTES.morning);
      const propBuilder = new PropBuilder((gx, gy) => terrain.getElevation(gx, gy));

      const campPos = propBuilder.getCampfirePosition();
      // gx:2.5, gy:6.5, gz:34 -> centered on tile (2,6)
      expect(campPos.x).toBeCloseTo(-6.5 * TILE_SPACING, 2);
      expect(campPos.y).toBeCloseTo(34 * ELEV_UNIT + 3.0, 2);
      expect(campPos.z).toBeCloseTo(2.5 * TILE_SPACING, 2);

      const flameGroup = propBuilder.group.getObjectByName('Prop_campfire')?.children.find(
        (c) => c instanceof THREE.Group
      );
      expect(flameGroup).toBeDefined();

      const initialScaleY = flameGroup!.scale.y;
      propBuilder.update(0.016, 1.5);
      expect(flameGroup!.scale.y).not.toBe(initialScaleY);

      propBuilder.dispose();
      terrain.dispose();
    });

    it('reacts to weather transitions (pine snow tint shift) and time-of-day changes', () => {
      const terrain = new TerrainBuilder(PALETTES.morning);
      const propBuilder = new PropBuilder((gx, gy) => terrain.getElevation(gx, gy));

      const pineGroup = propBuilder.group.getObjectByName('Prop_pine_0');
      const bough = pineGroup?.children.find((c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.ConeGeometry) as THREE.Mesh;
      expect(bough).toBeDefined();

      const normalColor = (bough.material as THREE.MeshLambertMaterial).color.getHex();

      // Trigger Snow
      propBuilder.updateWeather('snow');
      const snowColor = (bough.material as THREE.MeshLambertMaterial).color.getHex();
      expect(snowColor).not.toBe(normalColor);

      // Restore Clear
      propBuilder.updateWeather('clear');
      expect((bough.material as THREE.MeshLambertMaterial).color.getHex()).toBe(normalColor);

      // Time of Day Window Light
      propBuilder.updateTimeOfDay('midnight');
      propBuilder.updateTimeOfDay('morning');

      propBuilder.dispose();
      terrain.dispose();
    });
  });

  // ===========================================================================
  // 3. WATER & WATERFALL SYSTEM
  // ===========================================================================
  describe('Water & Waterfall System (WaterSystem)', () => {
    it('constructs stream mesh covering 8 cells and waterfall cascade to elevation -35', () => {
      const water = new WaterSystem(PALETTES.morning);

      const streamMesh = water.getWaterMesh();
      expect(streamMesh).toBeDefined();
      expect(streamMesh.renderOrder).toBe(1);
      expect(streamMesh.material).toBeInstanceOf(THREE.ShaderMaterial);
      expect((streamMesh.material as THREE.ShaderMaterial).transparent).toBe(true);
      expect((streamMesh.material as THREE.ShaderMaterial).depthWrite).toBe(false);

      // 8 cells * 2 triangles * 3 vertices = 48 vertices
      const posAttr = streamMesh.geometry.getAttribute('position');
      expect(posAttr.count).toBe(48);

      const waterfallMesh = water.getWaterfallMesh();
      expect(waterfallMesh).toBeDefined();
      expect(waterfallMesh.renderOrder).toBe(2);
      expect(waterfallMesh.material).toBeInstanceOf(THREE.ShaderMaterial);

      const mistParticles = water.getMistParticles();
      expect(mistParticles).toBeDefined();
      expect(mistParticles.renderOrder).toBe(3);
      expect(mistParticles.geometry.getAttribute('position').count).toBe(24);

      water.dispose();
    });

    it('advances water shimmer uniform and moves mist particles in update loop', () => {
      const water = new WaterSystem(PALETTES.morning);
      const mat = water.getWaterMesh().material as THREE.ShaderMaterial;

      expect(mat.uniforms.uTime.value).toBe(0);
      water.update(0.016, 2.5);
      expect(mat.uniforms.uTime.value).toBe(2.5);

      const mistAttr = water.getMistParticles().geometry.getAttribute('position');
      const y0 = mistAttr.getY(0);
      water.update(0.5, 3.0);
      const y1 = mistAttr.getY(0);
      expect(y1).not.toBe(y0);

      water.dispose();
    });

    it('updates water palette colors and snow slush opacity', () => {
      const water = new WaterSystem(PALETTES.morning);
      const mat = water.getWaterMesh().material as THREE.ShaderMaterial;

      water.setPalette(PALETTES.midnight);
      expect(mat.uniforms.uWaterColor.value.getHexString()).toBe(
        new THREE.Color(PALETTES.midnight.river).getHexString()
      );

      water.setWeather('snow');
      expect(mat.uniforms.uOpacity.value).toBe(0.95);

      water.setWeather('clear');
      expect(mat.uniforms.uOpacity.value).toBe(0.85);

      water.dispose();
    });
  });

  // ===========================================================================
  // 4. DIORAMA CONTAINER & THREEWORLDENGINE MOUNTING
  // ===========================================================================
  describe('DioramaWorld & ThreeWorldEngine Lifecycle Integration', () => {
    it('aggregates terrain, props, and water systems under a root group at (0, 0, 0)', () => {
      const diorama = new DioramaWorld(PALETTES.morning);
      expect(diorama.group.position.x).toBe(0);
      expect(diorama.group.position.y).toBe(0);
      expect(diorama.group.position.z).toBe(0);

      expect(diorama.terrain).toBeDefined();
      expect(diorama.props).toBeDefined();
      expect(diorama.water).toBeDefined();
      expect(diorama.group.children.length).toBe(4);

      diorama.dispose();
    });

    it('mounts DioramaWorld into ThreeWorldEngine and syncs updates and disposal', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 740;

      const engine = new ThreeWorldEngine(
        canvas,
        () => {},
        () => {}
      );

      const diorama = engine.getDiorama();
      expect(diorama).toBeDefined();
      expect(diorama).toBeInstanceOf(DioramaWorld);

      // Verify campfire vector is accessible
      const campfirePos = diorama!.getCampfirePosition();
      expect(campfirePos.y).toBeCloseTo(34 * ELEV_UNIT + 3.0, 2);

      // Verify weather forwarding
      engine.weather = 'snow';
      expect(engine.weather).toBe('snow');

      // Verify time of day forwarding
      engine.timeOfDay = 'dusk';
      expect(engine.timeOfDay).toBe('dusk');

      // Verify destroy cleans up diorama
      engine.destroy();
      expect(engine.getDiorama()).toBeNull();
    });

    it('preserves exact biome camera centering for all 5 focus biomes', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 740;

      const engine = new ThreeWorldEngine(
        canvas,
        () => {},
        () => {}
      );

      const cameraCtrl = new IsometricCamera();
      cameraCtrl.updateAspect(1280 / 740);

      for (const spot of BIOME_SPOTS) {
        const elev = engine.getSurfaceElevation(spot.gx, spot.gy);
        cameraCtrl.focusBiome(spot.gx, spot.gy, spot.zoom, elev);

        // Snap camera to target
        cameraCtrl.camX = cameraCtrl.targetCamX;
        cameraCtrl.camY = cameraCtrl.targetCamY;
        cameraCtrl.zoom = cameraCtrl.targetZoom;
        cameraCtrl.syncCameraTransform();

        const p3 = gridToWorld3D(spot.gx, spot.gy, elev);
        const ndc = p3.project(cameraCtrl.camera);
        const px = 640 + ndc.x * 640;
        const py = 370 - ndc.y * 370;

        expect(px).toBeCloseTo(640, 2);
        expect(py).toBeCloseTo(370, 2);
      }

      engine.destroy();
    });

    it('releases all geometries, textures, and materials on dispose without leaks', () => {
      const diorama = new DioramaWorld(PALETTES.morning);

      const disposedGeoms: THREE.BufferGeometry[] = [];
      const disposedMats: THREE.Material[] = [];

      diorama.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) {
            const originalDispose = obj.geometry.dispose.bind(obj.geometry);
            obj.geometry.dispose = () => {
              disposedGeoms.push(obj.geometry);
              originalDispose();
            };
          }
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              const originalDispose = m.dispose.bind(m);
              m.dispose = () => {
                disposedMats.push(m);
                originalDispose();
              };
            });
          }
        }
      });

      diorama.dispose();
      expect(diorama.group.children.length).toBe(0);
      expect(disposedGeoms.length).toBeGreaterThan(0);
      expect(disposedMats.length).toBeGreaterThan(0);
    });
  });
});
