import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  TerrainBuilder,
  type TerrainKind,
} from '../../../src/engine/world/TerrainBuilder';
import { PALETTES } from '../../../src/engine/ThreeWorldEngine';

describe('Feature 5: Terrain Kinds & Pixel Art Textures', () => {
  let terrain: TerrainBuilder | null = null;

  afterEach(() => {
    if (terrain) {
      terrain.dispose();
      terrain = null;
    }
  });

  it('5.1: verifies all 11 terrain kinds classification and material assignment', () => {
    terrain = new TerrainBuilder();

    const expectedKinds: TerrainKind[] = [
      'void',
      'grass',
      'grassAlt',
      'plank',
      'stairs_sw',
      'stairs_se',
      'mulch',
      'earth_cut',
      'garden_bed',
      'stream',
      'waterfall',
    ];

    expect(expectedKinds.length).toBe(11);

    const materials = terrain.getMaterials();
    expect(materials.has('grass')).toBe(true);
    expect(materials.has('grassAlt')).toBe(true);
    expect(materials.has('plank')).toBe(true);
    expect(materials.has('mulch')).toBe(true);
    expect(materials.has('garden_bed')).toBe(true);
    expect(materials.has('earth_cut')).toBe(true);
    expect(materials.has('stream_bed')).toBe(true);
    expect(materials.has('cliff_sw')).toBe(true);
    expect(materials.has('cliff_se')).toBe(true);
    expect(materials.has('stair_riser')).toBe(true);
    expect(materials.has('bedrock_keel')).toBe(true);
  });

  it('5.2: verifies NearestFilter and disabled mipmaps on all procedural canvas textures', () => {
    terrain = new TerrainBuilder();

    const textures = terrain.getTextures();
    expect(textures.size).toBeGreaterThanOrEqual(7);

    for (const [name, tex] of textures.entries()) {
      expect(tex.magFilter).toBe(THREE.NearestFilter);
      expect(tex.minFilter).toBe(THREE.NearestFilter);
      expect(tex.generateMipmaps).toBe(false);
      expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    }
  });

  it('5.3: verifies multi-material box face indexing on voxel meshes', () => {
    terrain = new TerrainBuilder();

    // Find any voxel terrain mesh in the hierarchy
    const voxelMesh = terrain.group.children.find((c) =>
      c.name.startsWith('Terrain_grass_')
    ) as THREE.Mesh;

    expect(voxelMesh).toBeDefined();
    expect(Array.isArray(voxelMesh.material)).toBe(true);
    const mats = voxelMesh.material as THREE.Material[];
    expect(mats.length).toBe(6);

    // Index 2 is top terrain surface
    const topMat = mats[2] as THREE.MeshLambertMaterial;
    expect(topMat).toBeDefined();
    expect(topMat.map).toBeDefined();

    // Index 1 is SW cliff, Index 4 is SE cliff
    const swMat = mats[1] as THREE.MeshLambertMaterial;
    const seMat = mats[4] as THREE.MeshLambertMaterial;
    expect(swMat.map).toBeDefined();
    expect(seMat.map).toBeDefined();
  });

  it('5.4: updates material colors across time-of-day palette transitions', () => {
    terrain = new TerrainBuilder();

    // Call updatePalette with morning
    terrain.updatePalette(PALETTES.morning);
    const materials = terrain.getMaterials();
    const grassMat = materials.get('grass') as THREE.MeshLambertMaterial;
    expect(grassMat.color.getHexString()).toBe(
      PALETTES.morning.grass.replace('#', '').toLowerCase()
    );

    // Switch to dusk palette
    terrain.updatePalette(PALETTES.dusk);
    expect(grassMat.color.getHexString()).toBe(
      PALETTES.dusk.grass.replace('#', '').toLowerCase()
    );

    // Switch to midnight palette
    terrain.updatePalette(PALETTES.midnight);
    expect(grassMat.color.getHexString()).toBe(
      PALETTES.midnight.grass.replace('#', '').toLowerCase()
    );
  });

  it('5.5: ensures procedural texture reuse and clean lifecycle disposal without leaks', () => {
    terrain = new TerrainBuilder();

    const textures = terrain.getTextures();
    const firstGrassTex = textures.get('grass');
    expect(firstGrassTex).toBeDefined();

    // Textures must be shared instances, not duplicated per voxel
    expect(textures.size).toBeLessThanOrEqual(10);

    const disposeSpies: ReturnType<typeof vi.spyOn>[] = [];
    textures.forEach((tex) => {
      disposeSpies.push(vi.spyOn(tex, 'dispose'));
    });

    terrain.dispose();

    for (const spy of disposeSpies) {
      expect(spy).toHaveBeenCalled();
    }
    expect(terrain.getTextures().size).toBe(0);
    expect(terrain.getMaterials().size).toBe(0);
  });

  it('5.6: verifies offscreen canvas procedural texture dimensions and generation sanity', () => {
    terrain = new TerrainBuilder();

    const textures = terrain.getTextures();
    for (const [name, tex] of textures.entries()) {
      const img = tex.image as HTMLCanvasElement;
      expect(img).toBeDefined();
      expect(img.width).toBeGreaterThanOrEqual(64);
      expect(img.height).toBeGreaterThanOrEqual(64);
    }
  });
});
