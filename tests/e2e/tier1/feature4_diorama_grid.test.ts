import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  TerrainBuilder,
  TILE_SPACING,
  ELEV_UNIT,
  gridToWorld3D,
} from '../../../src/engine/world/TerrainBuilder';
import { DioramaWorld } from '../../../src/engine/world/DioramaWorld';

describe('Feature 4: Diorama Grid & Stepped Elevations', () => {
  let diorama: DioramaWorld | null = null;
  let terrain: TerrainBuilder | null = null;

  afterEach(() => {
    if (diorama) {
      diorama.dispose();
      diorama = null;
    }
    if (terrain) {
      terrain.dispose();
      terrain = null;
    }
  });

  it('4.1: verifies 12x12 grid boundary coordinates and root origin alignment', () => {
    diorama = new DioramaWorld();
    expect(diorama.group.position.x).toBe(0);
    expect(diorama.group.position.y).toBe(0);
    expect(diorama.group.position.z).toBe(0);

    const grid = diorama.terrain.getGrid();
    expect(grid.length).toBe(12);
    for (let x = 0; x < 12; x++) {
      expect(grid[x].length).toBe(12);
    }
  });

  it('4.2: verifies stepped elevation heights across diorama plateaus and stream bed', () => {
    terrain = new TerrainBuilder();

    // Highland CottageStoop / Trunk
    expect(terrain.getElevation(2, 2)).toBe(52);
    expect(terrain.getElevation(3, 1)).toBe(54);

    // Pine Forest Terrace
    expect(terrain.getElevation(4, 3)).toBe(42);

    // Campfire Terrace & Stairs
    expect(terrain.getElevation(2, 6)).toBe(34);
    expect(terrain.getElevation(2, 5)).toBe(34);

    // Meadow / Garden Terrace
    expect(terrain.getElevation(2, 9)).toBe(26);
    expect(terrain.getElevation(4, 5)).toBe(25);

    // Sunken Stream Bed & Waterfall Lip
    expect(terrain.getElevation(4, 8)).toBe(14);
    expect(terrain.getElevation(4, 10)).toBe(14);
  });

  it('4.3: validates tile spacing, elevation scale constants, and 3D coordinate conversion', () => {
    expect(TILE_SPACING).toBeCloseTo(39 * Math.SQRT2, 6);
    expect(ELEV_UNIT).toBeCloseTo(2 / Math.sqrt(3), 6);

    // Isometric diamond width = TILE_SPACING * sqrt(2) = 39 * 2 = 78
    const tileDiagonal = TILE_SPACING * Math.SQRT2;
    expect(tileDiagonal).toBeCloseTo(78, 4);

    // Test gridToWorld3D vector
    const gx = 4;
    const gy = 6;
    const gz = 34;
    const worldPos = gridToWorld3D(gx, gy, gz);

    expect(worldPos.x).toBeCloseTo(-gy * TILE_SPACING, 4);
    expect(worldPos.y).toBeCloseTo(gz * ELEV_UNIT, 4);
    expect(worldPos.z).toBeCloseTo(gx * TILE_SPACING, 4);
  });

  it('4.4: validates floating island perimeter cutoffs and void determination', () => {
    terrain = new TerrainBuilder();

    // Out-of-bounds queries return 0
    expect(terrain.getElevation(-1, 0)).toBe(0);
    expect(terrain.getElevation(12, 12)).toBe(0);
    expect(terrain.getCell(-1, 5)).toBeNull();

    // Exterior void cells around island corners
    expect(terrain.getCell(0, 0)).toBeNull();
    expect(terrain.getCell(0, 11)).toBeNull();
    expect(terrain.getCell(11, 0)).toBeNull();
    expect(terrain.getCell(11, 11)).toBeNull();

    // Interior active diorama cells must have valid kinds
    const activeCottage = terrain.getCell(2, 2);
    expect(activeCottage).not.toBeNull();
    expect(activeCottage?.kind).toBe('plank');

    const activeStream = terrain.getCell(4, 8);
    expect(activeStream).not.toBeNull();
    expect(activeStream?.kind).toBe('stream');
  });

  it('4.5: verifies staircase 3-step descent geometry math and orientation', () => {
    terrain = new TerrainBuilder();

    // Locate stairs in grid
    const stairCellSW = terrain.getCell(2, 5);
    expect(stairCellSW).not.toBeNull();
    expect(stairCellSW?.kind).toBe('stairs_sw');

    const stairCellSE = terrain.getCell(5, 3);
    expect(stairCellSE).not.toBeNull();
    expect(stairCellSE?.kind).toBe('stairs_se');

    // Find stair groups in terrain hierarchy
    const stairGroups = terrain.group.children.filter((c) => c.name.startsWith('Stairs_'));
    expect(stairGroups.length).toBeGreaterThanOrEqual(4);

    // Each stair group should contain 3 sub-step meshes
    for (const sg of stairGroups) {
      expect(sg.children.length).toBe(3);
      for (const stepMesh of sg.children) {
        expect(stepMesh).toBeInstanceOf(THREE.Mesh);
        const mesh = stepMesh as THREE.Mesh;
        expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
        expect(mesh.castShadow).toBe(true);
      }
    }
  });

  it('4.6: verifies inverted bedrock keel profile beneath the diorama island', () => {
    terrain = new TerrainBuilder();

    const keel = terrain.group.getObjectByName('BedrockKeel') as THREE.Mesh;
    expect(keel).toBeDefined();
    expect(keel).toBeInstanceOf(THREE.Mesh);
    expect(keel.receiveShadow).toBe(true);

    const geo = keel.geometry as THREE.BufferGeometry;
    expect(geo).toBeDefined();
    const posAttr = geo.getAttribute('position');
    expect(posAttr).toBeDefined();

    // Multi-tiered craggy floating-island keel tapers deep below Y = 0
    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    expect(bbox.min.y).toBeLessThan(-100);
    expect(bbox.max.y).toBeGreaterThanOrEqual(0);
    expect(posAttr.count).toBeGreaterThanOrEqual(30);
  });
});
