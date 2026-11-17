import { RotateCcw, Send } from 'lucide-react';

const DEFAULT_STEPS = [
  'Turn on hardware acceleration in your browser settings, then fully restart the browser.',
  'Open chrome://gpu and confirm WebGL2 is not listed as "Disabled" or "Software only".',
  'Update your graphics driver, or try a different browser.',
];

interface WorldFallbackProps {
  title?: string;
  message: string;
  detail?: string;
  steps?: string[];
  retryLabel?: string;
  onRetry?: () => void;
}

/**
 * Rendered whenever the 3D world cannot start (missing WebGL 2) or a render
 * crash is caught by the ErrorBoundary. Keeps the page readable instead of
 * leaving an empty, blank canvas.
 */
export function WorldFallback({
  title = 'This sky needs WebGL 2',
  message,
  detail,
  steps = DEFAULT_STEPS,
  retryLabel = 'Try again',
  onRetry,
}: WorldFallbackProps) {
  return (
    <div className="world-fallback" role="alert">
      <div className="world-fallback-card">
        <div className="world-fallback-icon" aria-hidden="true">
          <Send size={18} />
        </div>
        <h2 className="world-fallback-title">{title}</h2>
        <p className="world-fallback-message">{message}</p>

        {steps.length > 0 && (
          <ul className="world-fallback-steps">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        )}

        {detail && <p className="world-fallback-detail">{detail}</p>}

        {onRetry && (
          <button type="button" className="primary-cta-btn world-fallback-btn" onClick={onRetry}>
            <RotateCcw size={15} />
            <span>{retryLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
