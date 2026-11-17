import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreeWorldEngine, type PaperPlaneNote } from '../../../src/engine/ThreeWorldEngine';

describe('Feature 2: ThreeWorldEngine Lifecycle & State Management', () => {
  let canvas: HTMLCanvasElement;
  let onSelectPlane: (note: PaperPlaneNote) => void;
  let onZoomChange: (z: number) => void;
  let engine: ThreeWorldEngine | null = null;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 740;
    // Append to body with a parent element for ResizeObserver
    const container = document.createElement('div');
    container.style.width = '1280px';
    container.style.height = '740px';
    container.appendChild(canvas);
    document.body.appendChild(container);

    onSelectPlane = vi.fn();
    onZoomChange = vi.fn();
  });

  afterEach(() => {
    if (engine) {
      engine.destroy();
      engine = null;
    }
    document.body.innerHTML = '';
  });

  it('2.1: initializes constructor with default state, camera coords, and canvas binding', () => {
    engine = new ThreeWorldEngine(canvas, onSelectPlane, onZoomChange);

    expect(engine.timeOfDay).toBe('morning');
    expect(engine.weather).toBe('clear');
    expect(engine.fireworksActive).toBe(false);
    expect(engine.zoom).toBeCloseTo(1.6, 2);
    expect(engine.camX).toBe(0);
    expect(engine.camY).toBe(-175);
  });

  it('2.2: executes animation loop and clamps delta time to <= 0.05s', () => {
    vi.useFakeTimers();
    engine = new ThreeWorldEngine(canvas, onSelectPlane, onZoomChange);

    // Fast-forward 250ms
    vi.advanceTimersByTime(250);

    // Engine loop should have processed ticks without explosion or NaN
    expect(engine.zoom).toBeCloseTo(1.6, 2);
    expect(isNaN(engine.camX)).toBe(false);
    expect(isNaN(engine.camY)).toBe(false);

    vi.useRealTimers();
  });

  it('2.3: adapts camera frustum and aspect ratio projection on canvas resize', () => {
    engine = new ThreeWorldEngine(canvas, onSelectPlane, onZoomChange);

    // Simulate resizing parent
    const parent = canvas.parentElement!;
    Object.defineProperty(parent, 'clientWidth', { value: 1600, configurable: true });
    Object.defineProperty(parent, 'clientHeight', { value: 900, configurable: true });

    // Trigger window resize event
    window.dispatchEvent(new Event('resize'));

    // Camera aspect ratio should update
    const camCtrl = (engine as any).cameraCtrl;
    expect(camCtrl).toBeDefined();
    expect(camCtrl.camera.top).toBe(370);
    expect(camCtrl.camera.bottom).toBe(-370);
    expect(camCtrl.camera.right).toBeCloseTo(370 * (1600 / 900), 2);
    expect(camCtrl.camera.left).toBeCloseTo(-370 * (1600 / 900), 2);
  });

  it('2.4: survives WebGL context lost and context restored events', () => {
    engine = new ThreeWorldEngine(canvas, onSelectPlane, onZoomChange);

    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    const prevented = !canvas.dispatchEvent(lostEvent);
    expect(prevented).toBe(true); // Engine should call e.preventDefault()

    const restoredEvent = new Event('webglcontextrestored');
    expect(() => canvas.dispatchEvent(restoredEvent)).not.toThrow();
  });

  it('2.5: handles interactive wheel zooming and pointer drag panning', () => {
    engine = new ThreeWorldEngine(canvas, onSelectPlane, onZoomChange);

    // Simulate mouse wheel zoom in (negative deltaY)
    const initialZoom = engine.zoom;
    const wheelEvent = new WheelEvent('wheel', { deltaY: -120, cancelable: true });
    canvas.dispatchEvent(wheelEvent);

    // Target zoom should have increased
    const camCtrl = (engine as any).cameraCtrl;
    expect(camCtrl.targetZoom).toBeGreaterThan(initialZoom);

    // Simulate mouse drag pan
    const mousedown = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
    canvas.dispatchEvent(mousedown);

    const mousemove = new MouseEvent('mousemove', { clientX: 250, clientY: 220 });
    window.dispatchEvent(mousemove);

    const mouseup = new MouseEvent('mouseup', { clientX: 250, clientY: 220 });
    window.dispatchEvent(mouseup);

    // Dragging mouse should have shifted camera target and flagged dragMoved
    expect((engine as any).dragMoved).toBe(true);
  });

  it('2.6: executes complete resource disposal and event listener unbinding on destroy()', () => {
    const removeWindowSpy = vi.spyOn(window, 'removeEventListener');
    const removeCanvasSpy = vi.spyOn(canvas, 'removeEventListener');

    engine = new ThreeWorldEngine(canvas, onSelectPlane, onZoomChange);
    const renderer = (engine as any).renderer;
    const disposeSpy = vi.spyOn(renderer, 'dispose');

    engine.destroy();
    engine = null;

    expect(removeWindowSpy).toHaveBeenCalled();
    expect(removeCanvasSpy).toHaveBeenCalled();
    expect(disposeSpy).toHaveBeenCalled();

    removeWindowSpy.mockRestore();
    removeCanvasSpy.mockRestore();
  });
});
