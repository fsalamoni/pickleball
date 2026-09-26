/**
 * As peças comuns das seções da tela inicial personalizada.
 *
 * - `HomeSection`: o cartão da seção — ícone, o MOTIVO de ela estar ali ("Porque
 *   está nos seus interesses"), o título e o "ver tudo". O motivo é o que
 *   transforma uma tela personalizada numa tela explicável: a pessoa sabe por
 *   que está vendo aquilo e sabe onde mudar.
 * - `HomeSectionBoundary`: um erro numa seção vira um aviso no lugar DELA — a
 *   agenda, os atalhos e o resto da tela continuam de pé (a tela inicial não é
 *   isolada por rota; sem isto, um defeito numa seção derrubaria o app).
 * - `HomeRow`: a linha clicável (um alvo grande, um link só).
 * - `HomeEmpty`: o "não há" que sempre oferece o próximo passo.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ChevronRight, RotateCw } from 'lucide-react';
import { recordClientError } from '@/core/services/observabilityService';
import { cn } from '@/core/lib/utils';

export function HomeSection({
  id, icon: Icon, title, reason, action, children, className, wide = false,
}) {
  const tituloId = id ? `home-secao-${id}-titulo` : undefined;
  return (
    <section
      aria-labelledby={tituloId}
      data-secao-inicio={id}
      className={cn(
        'flex min-w-0 flex-col rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm sm:p-6',
        wide && 'xl:col-span-2',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid" aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {reason && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{reason}</p>
            )}
            <h2 id={tituloId} className="font-display text-lg font-bold leading-tight text-ink sm:text-xl">{title}</h2>
          </div>
        </div>
        {action && (
          <Link
            to={action.to}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-gray-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
          >
            {action.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

/** Uma linha clicável: ícone, título, apoio e o selo à direita. */
export function HomeRow({ to, icon: Icon, title, subtitle, badge, badgeTone = 'neutral', highlight = false }) {
  const tones = {
    neutral: 'bg-paper text-gray-600',
    acid: 'bg-acid/25 text-ink',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    ink: 'bg-ink text-acid',
  };
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border p-3 transition-all hover:border-gray-200 hover:bg-paper focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30',
        highlight ? 'border-amber-200 bg-amber-50/40' : 'border-transparent',
      )}
    >
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper text-ink" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        {subtitle && <span className="block truncate text-xs text-gray-500">{subtitle}</span>}
      </span>
      {badge && (
        <span className={cn('hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-block', tones[badgeTone] || tones.neutral)}>
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
    </Link>
  );
}

/** O "não há" com o próximo passo ao lado — nunca uma parede. */
export function HomeEmpty({ icon: Icon, children, actions }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm font-medium text-gray-600">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />}
        <span>{children}</span>
      </p>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Um botão-link pequeno, usado nos "não há". */
export function HomeAction({ to, children, primary = false }) {
  return (
    <Link
      to={to}
      className={cn(
        'btn-press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30',
        primary ? 'bg-acid text-ink hover:bg-acid-light' : 'border border-gray-200 bg-paper-pure text-ink hover:border-ink',
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Isola UMA seção da tela inicial. Um erro vira um aviso pequeno no lugar da
 * seção, com "Tentar de novo" (que remonta só ela).
 */
export class HomeSectionBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, key: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    recordClientError(error, { source: `HomeSection:${this.props.name || 'secao'}`, info, fatal: false });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-4xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900',
            this.props.wide && 'xl:col-span-2',
          )}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Esta parte da tela inicial não abriu. O resto continua funcionando.
          </span>
          <button
            type="button"
            onClick={() => this.setState((s) => ({ error: null, key: s.key + 1 }))}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-paper-pure px-4 py-2 text-xs font-bold text-amber-900 hover:border-amber-500"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      );
    }
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}
