import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const MilestoneStudio = lazy(() =>
  import('./components/MilestoneStudio').then((m) => ({ default: m.MilestoneStudio }))
);

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isMilestoneRoute = normalizedPath === '/milestones';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isMilestoneRoute ? (
        <Suspense fallback={<div className="milestone-page" />}>
          <MilestoneStudio />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </React.StrictMode>
);
