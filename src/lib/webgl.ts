/**
 * WebGL capability detection.
 *
 * Three.js r160+ (and r187 here) is WebGL 2 only. It calls
 * `getShaderPrecisionFormat()` while building its capabilities, and crashes
 * (`Cannot read properties of null (reading 'precision')`) when the context is
 * missing, lost, or backed by a broken/software renderer. Check up front so the
 * page can explain itself instead of unmounting to a blank screen.
 */

export type WebGLSupport =
  | { supported: true }
  | { supported: false; reason: string; detail?: string };

/** Best-effort human-readable GPU description, for diagnosing the failure. */
function describeRenderer(context: WebGL2RenderingContext): string | undefined {
  try {
    const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return undefined;

    const renderer = context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    if (typeof renderer !== 'string' || renderer.length === 0) return undefined;

    return typeof vendor === 'string' && vendor.length > 0
      ? `${renderer} (${vendor})`
      : renderer;
  } catch {
    return undefined;
  }
}

export function detectWebGLSupport(): WebGLSupport {
  if (typeof document === 'undefined') {
    return { supported: false, reason: 'WebGL 2 cannot be checked outside a browser.' };
  }

  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');

    if (!context) {
      return {
        supported: false,
        reason:
          'Your browser could not create a WebGL 2 graphics context, so the 3D sky cannot start.',
      };
    }

    const detail = describeRenderer(context);
    const contextLost = context.isContextLost();
    const vertexHighp = context.getShaderPrecisionFormat(
      context.VERTEX_SHADER,
      context.HIGH_FLOAT
    );
    const fragmentHighp = context.getShaderPrecisionFormat(
      context.FRAGMENT_SHADER,
      context.HIGH_FLOAT
    );

    // Release the probe context immediately; browsers cap live WebGL contexts.
    context.getExtension('WEBGL_lose_context')?.loseContext();

    if (contextLost) {
      return {
        supported: false,
        reason:
          'The browser created a WebGL 2 context but immediately lost it. This usually means the GPU process crashed or a previous canvas is holding a dead context.',
        detail,
      };
    }

    if (!vertexHighp || !fragmentHighp) {
      return {
        supported: false,
        reason:
          'The browser created a WebGL 2 context but reports no shader precision support, which three.js requires. This is typical of a broken or software-only graphics backend.',
        detail,
      };
    }

    return { supported: true };
  } catch (error) {
    return {
      supported: false,
      reason:
        error instanceof Error
          ? `WebGL 2 is unavailable: ${error.message}`
          : 'WebGL 2 is unavailable in this browser.',
    };
  } finally {
    canvas = null;
  }
}
