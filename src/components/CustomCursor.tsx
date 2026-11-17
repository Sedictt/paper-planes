import { useEffect, useRef, useState } from 'react';

type CursorMode = 'default' | 'button' | 'plane' | 'grabbing' | 'disabled' | 'text';

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const pointerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia('(pointer: fine)');
    const updateEnabled = () => setEnabled(mq.matches);
    updateEnabled();
    mq.addEventListener?.('change', updateEnabled);

    return () => {
      mq.removeEventListener?.('change', updateEnabled);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    root.classList.add('custom-cursor-active');

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let visible = false;
    let isDown = false;
    let isCanvasDrag = false;
    let rafId = 0;

    const resolveMode = (target: EventTarget | null): CursorMode => {
      const el = target instanceof Element ? target : null;
      if (!el) return 'default';

      if (el.closest('input, textarea, select, [contenteditable="true"]')) {
        return 'text';
      }

      const disabledBtn = el.closest('button:disabled, [aria-disabled="true"]');
      if (disabledBtn) {
        return 'disabled';
      }

      if (el instanceof HTMLCanvasElement && el.style.cursor === 'pointer') {
        return el.dataset.hoverTarget === 'plane' ? 'plane' : 'button';
      }

      if (isDown && (isCanvasDrag || el instanceof HTMLCanvasElement)) {
        return 'grabbing';
      }

      if (el.closest('button, a, [role="button"], label[for]')) {
        return 'button';
      }

      return 'default';
    };

    const applyMode = (target: EventTarget | null) => {
      const pointerEl = pointerRef.current;
      const ringEl = ringRef.current;
      if (!pointerEl || !ringEl) return;

      const mode = resolveMode(target);
      pointerEl.dataset.mode = mode;
      ringEl.dataset.mode = mode;
      pointerEl.dataset.down = isDown ? '1' : '0';
      ringEl.dataset.down = isDown ? '1' : '0';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      targetX = e.clientX;
      targetY = e.clientY;

      if (!visible) {
        visible = true;
        ringX = targetX;
        ringY = targetY;
      }

      if (pointerRef.current) {
        pointerRef.current.style.opacity = '1';
        pointerRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.opacity = '1';
      }

      applyMode(e.target);
    };

    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      isCanvasDrag =
        e.target instanceof HTMLCanvasElement && e.target.style.cursor !== 'pointer';
      applyMode(e.target);
    };

    const onPointerUp = (e: PointerEvent) => {
      isDown = false;
      isCanvasDrag = false;
      applyMode(e.target);
    };

    const onPointerLeave = () => {
      visible = false;
      isDown = false;
      isCanvasDrag = false;
      if (pointerRef.current) pointerRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!ringRef.current || !visible) return;
      const ease = reducedMotion ? 1 : 0.24;
      ringX += (targetX - ringX) * ease;
      ringY += (targetY - ringY) * ease;
      ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      root.classList.remove('custom-cursor-active');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* Trailing State-Aware Halo / Reticle */}
      <div ref={ringRef} className="custom-cursor-ring" data-mode="default" aria-hidden="true">
        <div className="custom-cursor-ring-inner" />
        <span className="custom-cursor-catch-tag">Catch</span>
      </div>

      {/* Crisp Origami Paper-Plane Pointer */}
      <div ref={pointerRef} className="custom-cursor-pointer" data-mode="default" aria-hidden="true">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="custom-cursor-svg"
        >
          <path
            d="M1.5 1.5L21.5 9.8L12.6 12.8L9.6 21.5L1.5 1.5Z"
            className="custom-cursor-wing"
            stroke="#2B2118"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M1.5 1.5L12.6 12.8L9.6 21.5L8.4 13.4L1.5 1.5Z"
            className="custom-cursor-fold"
          />
        </svg>
      </div>
    </>
  );
}
