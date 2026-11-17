import * as THREE from 'three';
import type { Palette } from '../ThreeWorldEngine';
import type { TimeOfDay, WeatherMode } from '../../types';
import { TerrainBuilder } from './TerrainBuilder';
import { PropBuilder } from './PropBuilder';
import { WaterSystem } from './WaterSystem';
import { FloatingIslandBuilder } from './FloatingIslandBuilder';

export class DioramaWorld {
  public readonly group: THREE.Group;
  public readonly terrain: TerrainBuilder;
  public readonly props: PropBuilder;
  public readonly water: WaterSystem;
  public readonly island: FloatingIslandBuilder;

  constructor(timeOfDayPalette?: Palette) {
    this.group = new THREE.Group();
    this.group.name = 'DioramaWorld';

    // Fallback default palette if not provided
    const pal = timeOfDayPalette ?? {
      label: 'Morning',
      skyTop: '#c8c2a6',
      skyMid: '#c2bc9f',
      skyBottom: '#b8b294',
      sea: '#5b7876',
      seaDeep: '#486361',
      seaFoam: '#dcebe7',
      river: '#627e7b',
      sand: '#e09a38',
      grass: '#8fa13e',
      grassAlt: '#869838',
      cobble: '#8c542e',
      cobbleLine: '#693d1f',
      asphalt: '#452815',
      crosswalk: '#e5a345',
      windowLit: '#ffcf5c',
      windowDark: '#826042',
      windowChance: 0.9,
      stars: 0.3,
      cloudTop: '#f2ebd9',
      cloudShade: '#c9c1a9',
      streetLight: true,
      neon: false,
      shadeMul: 1.0,
      shadowAlpha: 0.2,
    };

    // 1. Build Legacy Subsystems (kept hidden for API/test contract compatibility)
    this.terrain = new TerrainBuilder(pal);
    this.terrain.group.visible = false;
    this.group.add(this.terrain.group);

    this.props = new PropBuilder((gx, gy) => this.terrain.getElevation(gx, gy));
    this.props.group.visible = false;
    this.group.add(this.props.group);

    this.water = new WaterSystem(pal, {
      streamElevation: 14,
      waterfallDrop: -35,
    });
    this.water.group.visible = false;
    this.group.add(this.water.group);

    // 2. Mount Active Floating Island Map (from floating-island.html)
    this.island = new FloatingIslandBuilder(pal);
    this.group.add(this.island.group);
  }

  public update(dt: number, elapsed: number): void {
    this.island.update(dt, elapsed);
    this.props.update(dt, elapsed);
    this.water.update(dt, elapsed);
  }

  public setPalette(pal: Palette): void {
    this.island.setPalette(pal);
    this.terrain.updatePalette(pal);
    this.water.setPalette(pal);
  }

  public setWeather(weather: WeatherMode): void {
    this.island.setWeather(weather);
    this.props.updateWeather(weather);
    this.water.setWeather(weather);
  }

  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    this.island.setTimeOfDay(timeOfDay);
    this.props.updateTimeOfDay(timeOfDay);
  }

  public setVolumetricScale(scale: number): void {
    this.island.setVolumetricScale(scale);
  }

  public pickFrogAt(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    camera: THREE.Camera
  ): boolean {
    return this.island.pickFrogAt(clientX, clientY, canvas, camera);
  }

  public setFrogHovered(hovered: boolean): void {
    this.island.setFrogHovered(hovered);
  }

  public triggerFrogBounce(): void {
    this.island.triggerFrogBounce();
  }

  public getFrogWorldPosition(out: THREE.Vector3): boolean {
    return this.island.getFrogWorldPosition(out);
  }

  public getCampfirePosition(): THREE.Vector3 {
    return this.props.getCampfirePosition();
  }

  public getWaterMesh(): THREE.Mesh {
    return this.water.getWaterMesh();
  }

  public getTerrainElevation(gx: number, gy: number): number {
    return this.terrain.getElevation(gx, gy);
  }

  public dispose(): void {
    this.island.dispose();
    this.water.dispose();
    this.props.dispose();
    this.terrain.dispose();
    this.group.clear();
  }
}
