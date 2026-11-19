import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected rendering error.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f4f6f9] text-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-4">
            <h1 className="text-base font-semibold text-slate-900">
              RigTally failed to load the current workspace
            </h1>
            <p className="text-xs text-slate-600 font-mono bg-slate-50 border border-slate-200 rounded p-2.5 break-words">
              {this.state.message}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('rigtally_workspace_v2');
                  } catch {
                    // ignore storage errors
                  }
                  window.location.reload();
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 cursor-pointer"
              >
                Reset Local Draft &amp; Reload
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-700 rounded hover:bg-slate-50 cursor-pointer"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
