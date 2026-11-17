import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from '../src/App';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { WorldFallback } from '../src/components/WorldFallback';

vi.mock('../src/lib/webgl', () => ({
  detectWebGLSupport: () => ({
    supported: false,
    reason: 'Mocked: this browser has no WebGL 2 context.',
  }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  vi.restoreAllMocks();
});

describe('WebGL fallback', () => {
  it('renders the fallback instead of a blank page when WebGL 2 is missing', () => {
    render(<App />);

    expect(container.textContent).toContain('This sky needs WebGL 2');
    expect(container.textContent).toContain('Mocked: this browser has no WebGL 2 context.');
    expect(container.querySelector('.world-canvas-container')).not.toBeNull();
  });

  it('shows the recovery steps and a retry action', () => {
    const onRetry = vi.fn();
    render(<WorldFallback message="No graphics context." onRetry={onRetry} />);

    expect(container.textContent).toContain('hardware acceleration');
    const button = container.querySelector<HTMLButtonElement>('.world-fallback-btn');
    expect(button).not.toBeNull();

    act(() => {
      button?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('catches render crashes in the error boundary', () => {
    const Boom = () => {
      throw new Error('kaboom');
    };

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(container.textContent).toContain('The sky folded on itself');
    expect(container.textContent).toContain('kaboom');
  });
});
