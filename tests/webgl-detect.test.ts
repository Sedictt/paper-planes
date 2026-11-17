import { describe, it, expect } from 'vitest';
import { detectWebGLSupport } from '../src/lib/webgl';

describe('detectWebGLSupport', () => {
  it('reports support when a WebGL 2 context can be created', () => {
    expect(detectWebGLSupport()).toEqual({ supported: true });
  });

  it('reports a readable reason when the browser returns no WebGL 2 context', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    } as unknown as HTMLCanvasElement['getContext'];

    try {
      const result = detectWebGLSupport();
      expect(result.supported).toBe(false);
      if (!result.supported) {
        expect(result.reason).toMatch(/WebGL 2/i);
      }
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  it('never throws when context creation itself throws', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function () {
      throw new Error('GPU process crashed');
    } as unknown as HTMLCanvasElement['getContext'];

    try {
      const result = detectWebGLSupport();
      expect(result.supported).toBe(false);
      if (!result.supported) {
        expect(result.reason).toContain('GPU process crashed');
      }
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  it('rejects a context that reports no shader precision support', () => {
    const restore = stubContext({
      VERTEX_SHADER: 0x8b31,
      FRAGMENT_SHADER: 0x8b30,
      HIGH_FLOAT: 0x8dfa,
      isContextLost: () => false,
      getShaderPrecisionFormat: () => null,
      getExtension: () => null,
      getParameter: () => null,
    });

    try {
      const result = detectWebGLSupport();
      expect(result.supported).toBe(false);
      if (!result.supported) {
        expect(result.reason).toMatch(/precision/i);
      }
    } finally {
      restore();
    }
  });

  it('rejects a context that was lost immediately', () => {
    const restore = stubContext({
      VERTEX_SHADER: 0x8b31,
      FRAGMENT_SHADER: 0x8b30,
      HIGH_FLOAT: 0x8dfa,
      isContextLost: () => true,
      getShaderPrecisionFormat: () => ({ precision: 23 }),
      getExtension: () => null,
      getParameter: () => null,
    });

    try {
      const result = detectWebGLSupport();
      expect(result.supported).toBe(false);
      if (!result.supported) {
        expect(result.reason).toMatch(/lost/i);
      }
    } finally {
      restore();
    }
  });
});

function stubContext(fake: unknown): () => void {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function () {
    return fake;
  } as unknown as HTMLCanvasElement['getContext'];

  return () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
}
