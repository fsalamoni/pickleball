import React from 'react';
import { AlertTriangle, RefreshCw, RotateCw } from 'lucide-react';
import { recordClientError } from '@/core/services/observabilityService';
import { planErrorRecovery } from '@/core/domain/errorRecovery';

/**
 * Isola UMA tela: um erro dentro dela não derruba o aplicativo.
 *
 * ## Por que existe
 *
 * O `ErrorBoundary` global fica **acima do Router** (`main.jsx`) e **nunca
 * reseta**. Então um defeito numa aba de torneio ou no organizador do dia de
 * jogo substituía o aplicativo INTEIRO por "Algo deu errado" — sem barra
 * lateral, sem navegação, sem volta a não ser recarregar a página. Quem estava
 * conduzindo um torneio perdia o lugar onde estava por causa de um erro numa
 * aba.
 *
 * O padrão certo já existia (`GamificationErrorBoundary`), mas só a
 * gamificação o usava — e ela está atrás de uma flag desligada. O mecanismo
 * estava exatamente onde não fazia falta.
 *
 * Este boundary fica DENTRO do layout: a falha vira um cartão no lugar do
 * conteúdo, e o resto da plataforma continua de pé.
 *
 * ## `unattended`
 *
 * O telão fica horas sozinho numa TV. Ali "clique para tentar de novo" não
 * serve — **não há ninguém para clicar** —, então a recuperação é automática,
 * com espera crescente e um limite: tentar para sempre sobre um defeito real
 * é um laço de falha que ninguém vê.
 *
 * ## Versão velha depois de um deploy
 *
 * A plataforma publica a cada push. Quem está com a aba aberta pode pedir uma
 * tela cujo pedaço de código já não existe: isso não é defeito de programação,
 * e a saída não é "tentar de novo" (o arquivo continua não existindo) — é
 * recarregar. O texto diz isso. Ver `core/domain/errorRecovery.js`.
 */
export default class V2RouteBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0, resetKey: 0 };
    this.timer = null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // `fatal: false`: o aplicativo sobreviveu — quem morreu foi uma tela.
    // Marcar tudo como fatal esconde, na telemetria, a diferença entre "o app
    // caiu" e "uma aba falhou e a pessoa seguiu usando".
    recordClientError(error, {
      source: `V2RouteBoundary:${this.props.name || 'tela'}`,
      info,
      fatal: false,
    });

    const plano = planErrorRecovery({
      error,
      attempt: this.state.attempt,
      unattended: this.props.unattended === true,
    });
    if (plano.autoRetry) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.setState((s) => ({ error: null, attempt: s.attempt + 1, resetKey: s.resetKey + 1 }));
      }, plano.delayMs);
    }
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  tentarDeNovo = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // `resetKey` remonta os filhos: sem isso o mesmo estado quebrado
    // renderizaria de novo e cairia no mesmo erro na hora.
    this.setState((s) => ({ error: null, attempt: 0, resetKey: s.resetKey + 1 }));
  };

  render() {
    const { error, resetKey } = this.state;
    const { children, unattended = false, onBack = null } = this.props;
    if (!error) return <React.Fragment key={resetKey}>{children}</React.Fragment>;

    const plano = planErrorRecovery({ error, attempt: this.state.attempt, unattended });
    const escuro = unattended;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className={escuro
          ? 'mx-auto flex min-h-[60dvh] max-w-[900px] flex-col items-center justify-center gap-4 px-6 text-center text-white'
          : 'mx-auto max-w-[800px] rounded-4xl border border-amber-200 bg-amber-50 p-6'}
      >
        <div className={escuro ? 'flex flex-col items-center gap-3' : 'flex items-start gap-3'}>
          <div className={escuro
            ? 'flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400/15 text-amber-300'
            : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700'}
          >
            <AlertTriangle className={escuro ? 'h-8 w-8' : 'h-5 w-5'} />
          </div>
          <div className={escuro ? '' : 'flex-1'}>
            <h2 className={escuro
              ? 'font-display text-3xl font-black text-white'
              : 'font-display text-lg font-bold text-amber-900'}
            >
              {plano.title}
            </h2>
            <p className={escuro ? 'mt-2 text-lg text-white/60' : 'mt-1 text-sm text-amber-800'}>
              {plano.description}
            </p>

            {/* O detalhe técnico só em desenvolvimento: em produção a mensagem
                crua não ajuda ninguém e pode vazar informação interna. */}
            {import.meta.env.DEV && error?.message && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-2xl bg-black/20 p-2 text-left text-xs">
                {String(error.message)}
              </pre>
            )}

            <div className={`mt-4 flex flex-wrap gap-2 ${escuro ? 'justify-center' : ''}`}>
              {plano.reload ? (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-ink px-4 py-2 text-sm font-bold text-white"
                >
                  <RotateCw className="h-4 w-4" /> Recarregar
                </button>
              ) : (
                !plano.autoRetry && (
                  <button
                    type="button"
                    onClick={this.tentarDeNovo}
                    className={escuro
                      ? 'inline-flex items-center gap-1.5 rounded-2xl bg-acid px-5 py-2.5 text-base font-bold text-ink'
                      : 'inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700'}
                  >
                    <RefreshCw className="h-4 w-4" /> Tentar de novo
                  </button>
                )
              )}
              {onBack && !escuro && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center rounded-2xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-900"
                >
                  Voltar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
