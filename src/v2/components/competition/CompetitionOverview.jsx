/**
 * As peças da VISÃO GERAL de uma competição (torneio e liga): o cartão
 * escuro do panorama (`SummaryTile`, `InfoSurface`), o cartão do critério de
 * classificação (`RankingRule`) e a barra de ocupação das vagas. O desenho é
 * o da visão geral do torneio — o torneio e a liga usam AS MESMAS peças
 * (nenhum dos dois guarda cópia local), para as duas telas serem uma só
 * família. Nada aqui consulta o banco.
 */
import React from 'react';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';

export function InfoSurface({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Icon className="h-4 w-4 text-acid" aria-hidden="true" /> {title}
      </div>
      {description && <p className="mt-2 text-sm leading-6 text-white/70">{description}</p>}
      {children}
    </div>
  );
}

export function RankingRule({ order, title, description }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="font-display text-xs font-bold uppercase tracking-widest text-acid">{order}</div>
      <div className="mt-2 font-display text-lg font-bold text-white">{title}</div>
      {description && <p className="mt-1 text-sm leading-6 text-white/60">{description}</p>}
    </div>
  );
}

/**
 * O cartão escuro "Critério de classificação" — a moldura é a mesma no torneio
 * e na liga; o conteúdo (a ordem que vale) vem de quem chama, já resolvido.
 */
export function CriteriaCard({ title, description, dica, children }) {
  return (
    <div className="rounded-4xl bg-ink p-6 text-white shadow-organic sm:p-8" data-dica={dica}>
      <div className="font-display text-xs font-bold uppercase tracking-widest text-acid">{t('Critério de classificação')}</div>
      <h3 className="mt-4 font-display text-3xl font-bold leading-tight text-white">{title}</h3>
      {description && <p className="mt-3 text-sm leading-7 text-white/60 sm:text-base">{description}</p>}
      {children}
    </div>
  );
}

export function SummaryTile({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xs font-bold uppercase tracking-widest text-white/50">{label}</div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acid text-ink">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-3 font-display text-xl font-bold text-white">{value}</div>
      {description && <p className="mt-1 text-xs leading-5 text-white/60">{description}</p>}
    </div>
  );
}

/** "01", "02"… — a numeração do cartão do critério. */
export const ruleOrder = (i) => String(i + 1).padStart(2, '0');

/** Ocupação em % (sem teto = `null`). */
export function capacityPct(n, max) {
  if (!(Number(max) > 0)) return null;
  return Math.min(100, Math.round((Number(n || 0) / Number(max)) * 100));
}

/** A barra de vagas do card de modalidade / divisão. */
export function CapacityBar({ value, max, full }) {
  const pct = capacityPct(value, max);
  if (pct === null) return null;
  const tone = full ? 'bg-amber-500' : pct >= 80 ? 'bg-amber-400' : 'bg-acid';
  return (
    <>
      <div className="mb-1 flex items-center justify-between text-2xs text-gray-500">
        <span>{full ? t('Capacidade esgotada') : t('Leitura atual da ocupação')}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn('h-full transition-all duration-300', tone)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Number(value || 0)}
          aria-valuemin={0}
          aria-valuemax={Number(max)}
        />
      </div>
    </>
  );
}
