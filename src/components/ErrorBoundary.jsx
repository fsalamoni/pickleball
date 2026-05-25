import React from 'react';
import { recordClientError } from '@/core/services/observabilityService';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    recordClientError(error, { source: 'ErrorBoundary', info, fatal: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6 border">
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Algo deu errado</h1>
            <p className="text-sm text-slate-600 mb-4">
              Ocorreu um erro inesperado. Recarregue a página para tentar novamente.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Recarregar
            </button>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 p-3 bg-slate-100 rounded text-xs overflow-auto max-h-64">
                {String(this.state.error?.stack || this.state.error)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
