import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/core/lib/logger';

/**
 * GamificationErrorBoundary — captura erros em componentes V2 de gamificação.
 * Mostra fallback amigável + botão de retry.
 *
 * Isolado do resto da app: se /gamification crashar, o resto funciona.
 */
export default class GamificationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    logger.error('[GamificationErrorBoundary] erro capturado:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="gamification-error-boundary"
          role="alert"
          aria-live="assertive"
          className="mx-auto max-w-[800px] rounded-4xl border border-red-200 bg-red-50 p-6"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-bold text-red-900">
                Ops, algo deu errado
              </h2>
              <p className="mt-1 text-sm text-red-700">
                A seção de gamificação encontrou um erro inesperado. O resto da plataforma continua funcionando.
              </p>
              {/* Detalhe técnico só em desenvolvimento — em produção a
                  mensagem crua do erro não ajuda o atleta e pode vazar
                  informação interna. */}
              {import.meta.env.DEV && this.state.error?.message && (
                <pre className="mt-2 overflow-x-auto rounded-2xl bg-red-100 p-2 text-xs text-red-900">
                  {this.state.error.message}
                </pre>
              )}
              <button
                type="button"
                onClick={this.handleReset}
                className="mt-3 inline-flex items-center gap-1 rounded-2xl bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700"
                data-testid="gamification-retry-btn"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
