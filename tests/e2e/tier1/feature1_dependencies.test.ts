import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';

describe('Feature 1: Dependency Modernization & Configuration', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const pkgPath = path.join(rootDir, 'package.json');
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');

  it('1.1: validates Three.js core and type definitions presence in package.json', () => {
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies.three).toBeDefined();
    expect(pkg.dependencies.three).toMatch(/^\^?0\.(1[6-9][0-9]|[2-9][0-9]{2})\./);

    expect(pkg.devDependencies).toBeDefined();
    expect(pkg.devDependencies['@types/three']).toBeDefined();
  });

  it('1.2: confirms strict elimination of legacy rendering and audio packages', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    expect(allDeps['pixi.js']).toBeUndefined();
    expect(allDeps['pixi-viewport']).toBeUndefined();
    expect(allDeps['howler']).toBeUndefined();
    expect(allDeps['@types/howler']).toBeUndefined();
  });

  it('1.3: verifies npm script entrypoints for build, dev, and test workflows', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toContain('tsc -b');
    expect(pkg.scripts.build).toContain('vite build');
    expect(pkg.scripts.dev).toContain('vite');
    expect(pkg.scripts.test).toContain('vitest');
    expect(pkg.scripts['test:coverage']).toBeDefined();
  });

  it('1.4: verifies TypeScript compiler options and test directory inclusion in tsconfig.json', () => {
    expect(fs.existsSync(tsconfigPath)).toBe(true);
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

    expect(tsconfig.compilerOptions).toBeDefined();
    expect(tsconfig.compilerOptions.target).toBe('ES2022');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noEmit).toBe(true);

    expect(Array.isArray(tsconfig.include)).toBe(true);
    expect(tsconfig.include).toContain('src');
    expect(tsconfig.include).toContain('tests');
    expect(tsconfig.include).toContain('vitest.config.ts');
  });

  it('1.5: verifies ESM module configuration and Vitest test runner setup', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.type).toBe('module');
    expect(pkg.private).toBe(true);

    const vitestConfigPath = path.join(rootDir, 'vitest.config.ts');
    expect(fs.existsSync(vitestConfigPath)).toBe(true);
    const vitestContent = fs.readFileSync(vitestConfigPath, 'utf8');
    expect(vitestContent).toContain('happy-dom');
    expect(vitestContent).toContain('setup.ts');
  });

  it('1.6: verifies Three.js runtime import sanity, constructors, and constant values', () => {
    expect(typeof THREE.WebGLRenderer).toBe('function');
    expect(typeof THREE.Scene).toBe('function');
    expect(typeof THREE.OrthographicCamera).toBe('function');
    expect(typeof THREE.Vector3).toBe('function');
    expect(typeof THREE.BoxGeometry).toBe('function');
    expect(typeof THREE.MeshLambertMaterial).toBe('function');

    // Verify key Three.js constants used across diorama engine
    expect(THREE.NearestFilter).toBe(1003);
    expect(THREE.PCFSoftShadowMap).toBe(2);
    expect(THREE.DoubleSide).toBe(2);
    expect(THREE.SRGBColorSpace).toBe('srgb');
  });
});
