import { Component, type ErrorInfo, type ReactNode } from 'react';
import { WorldFallback } from './WorldFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence: a crash anywhere in the tree (including engine setup)
 * renders a readable message instead of an empty document.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Paper Planes] Render crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <WorldFallback
          title="The sky folded on itself"
          message="Something broke while drawing the world. A reload usually brings it back."
          detail={this.state.error.message}
          steps={[]}
          retryLabel="Reload"
          onRetry={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}
