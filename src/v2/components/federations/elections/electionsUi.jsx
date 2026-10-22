/**
 * Peças comuns das ELEIÇÕES: situação, linha do tempo do calendário, cartão
 * da chapa e o gráfico do resultado (barras em CSS, com o número escrito ao
 * lado — o gráfico nunca é a única forma de ler o resultado).
 */
import React from 'react';
import { Check, Circle, Users } from 'lucide-react';
import {
  CANDIDACY_STATUS_LABEL, CANDIDACY_TONE, ORGAN_LABEL, POSITION_KIND_LABEL, STATUS_LABEL, STATUS_TONE, electionPhase, electionTimeline, todayBr,
} from '@/modules/federations/domain/elections';
import { V2Badge } from '@/v2/ui/primitives';
import { fmtNumero, t } from '@/core/i18n';
import { dataCurta } from '../agenda/agendaUi';

export const hojeBr = () => todayBr(Date.now());
export const pct = (n, total) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

export function ElectionStatusBadge({ e, hoje = hojeBr() }) {
  const fase = electionPhase(e, hoje);
  return <V2Badge tone={STATUS_TONE[fase] || 'neutral'}>{t(STATUS_LABEL[fase] || fase)}</V2Badge>;
}

export function CandidacyStatusBadge({ c }) {
  return <V2Badge tone={CANDIDACY_TONE[c.status] || 'neutral'}>{t(CANDIDACY_STATUS_LABEL[c.status] || c.status)}</V2Badge>;
}

/** O calendário como linha do tempo: o que passou, o passo de agora e o que vem. */
export function ElectionTimeline({ e, hoje = hojeBr() }) {
  const itens = electionTimeline(e, hoje);
  if (!itens.length) return null;
  return (
    <ol className="relative space-y-3 border-l border-gray-200 pl-5" aria-label={t('Calendário da eleição')}>
      {itens.map((i) => (
        <li key={i.key} className="relative" aria-current={i.current ? 'step' : undefined}>
          <span className={`absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ${i.done ? 'bg-ink text-white' : i.current ? 'bg-acid text-ink ring-4 ring-acid/30' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`} aria-hidden="true">
            {i.done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
          </span>
          <p className={`text-sm ${i.current ? 'font-semibold text-ink' : i.done ? 'text-gray-500' : 'text-ink'}`}>
            {t(i.label)} <span className="text-gray-500">· {dataCurta(i.date)}</span>
            {i.current && <span className="sr-only"> {t('(próximo passo)')}</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function PositionLine({ p }) {
  return (
    <p className="text-sm text-gray-500">
      {t(ORGAN_LABEL[p.organ] || '')} · {t(POSITION_KIND_LABEL[p.kind] || '')}
      {p.kind === 'individual' ? ` · ${t('{n} vaga(s)', { n: p.seats })}` : ''}
      {p.gender_min > 0 ? ` · ${t('mínimo de {n} de cada sexo', { n: p.gender_min })}` : ''}
    </p>
  );
}

/** A chapa: nome, composição e a proposta. `children`: as ações de quem vê. */
export function CandidacyCard({ c, position, showStatus = false, children = null }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-ink">{c.name}</h4>
          {position && <p className="text-xs text-gray-500">{position.label}</p>}
        </div>
        {showStatus && <CandidacyStatusBadge c={c} />}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink" aria-label={t('Composição')}>
        {(c.members || []).map((m, i) => (
          <li key={`${m.uid || i}`} className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />{m.name}{m.role ? <span className="text-gray-500"> · {m.role}</span> : null}</li>
        ))}
      </ul>
      {c.platform && <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{c.platform}</p>}
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </article>
  );
}

/**
 * O resultado de cada cargo, em barras. Só PESOS (nunca o número de
 * cédulas, que deixaria deduzir a categoria de quem votou).
 */
export function ResultChart({ results = [] }) {
  return (
    <div className="space-y-5">
      {results.map((r) => {
        const linhas = [
          ...r.items.map((i) => ({ key: i.candidacy_id, label: i.name, weight: i.weight, elected: i.elected })),
          { key: 'blank', label: t('Em branco'), weight: r.blank, muted: true },
          { key: 'null', label: t('Nulo'), weight: r.null, muted: true },
        ];
        return (
          <section key={r.position_id} aria-labelledby={`res-${r.position_id}`}>
            <h4 id={`res-${r.position_id}`} className="font-semibold text-ink">{r.label}</h4>
            <p className="text-xs text-gray-500">{t('Votos válidos (peso): {v} de {total}', { v: fmtNumero(r.valid), total: fmtNumero(r.total) })}</p>
            {r.tie && <p className="mt-1 text-sm font-semibold text-amber-800">{t('Empate no corte: haverá novo turno, como manda o edital.')}</p>}
            <ul className="mt-2 space-y-2">
              {linhas.map((l) => {
                const p = pct(l.weight, r.total);
                return (
                  <li key={l.key}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className={l.muted ? 'text-gray-500' : 'font-medium text-ink'}>{l.label}{l.elected && <V2Badge tone="green" className="ml-2">{t('Eleita')}</V2Badge>}</span>
                      <span className="tabular-nums text-gray-500">{fmtNumero(l.weight)} · {fmtNumero(p)}%</span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                      <div className={`h-full rounded-full ${l.elected ? 'bg-ink' : l.muted ? 'bg-gray-300' : 'bg-acid'}`} style={{ width: `${p}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** A participação da votação: só o percentual (nunca quem votou em quem). */
export function Participation({ e }) {
  const voters = e.college_frozen?.voters;
  const weight = e.college_frozen?.total_weight;
  const pv = voters ? pct(Number(e.voted_count) || 0, voters) : null;
  const pw = weight ? pct(Number(e.voted_weight) || 0, weight) : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[[t('Eleitores que votaram'), pv], [t('Peso já depositado'), pw]].map(([rotulo, v]) => (
        <div key={rotulo} className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{rotulo}</p>
          <p className="font-display text-3xl text-ink">{v == null ? '—' : `${fmtNumero(v)}%`}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v ?? undefined}>
            <div className="h-full rounded-full bg-ink" style={{ width: `${v || 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
