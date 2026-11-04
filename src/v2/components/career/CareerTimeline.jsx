/**
 * A LINHA DO TEMPO da carreira (aba `linha-do-tempo`, docs/54 §4.5): o que
 * vem acima do "Hoje", o histórico abaixo, por temporada (o ano civil), com
 * as temporadas fechadas recolhidas. Fontes: torneios e dias de jogo da
 * plataforma, pontos de federação e os torneios de fora — cada uma falhando
 * sozinha, e a que falhou é DITA (nunca "você ainda não jogou").
 *
 * Filtros na URL: `?podios=1`, `?federados=1`, `?origem=fora|plataforma`.
 */
import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarClock, ChevronRight, CloudOff, Medal, Route } from 'lucide-react';
import {
  ORIGIN_FILTER, TIMELINE_SOURCE, filterTimeline, timelineFiltersFromParams,
} from '@/modules/career/domain/timeline.js';
import { registeredProgress } from '@/modules/career/domain/careerEvent.js';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton } from '@/v2/ui/primitives';
import { METAL } from '@/v2/components/trophies/MedalCard';
import { SealBadge, careerDateLabel } from './careerUi';
import { useCareerEstimate } from './CareerListMode';
import { fmtLista, t, tk } from '@/core/i18n';

const FONTE_ROTULO = Object.freeze({
  [TIMELINE_SOURCE.CAREER]: tk('De fora'),
  [TIMELINE_SOURCE.TOURNAMENT]: tk('Torneio'),
  [TIMELINE_SOURCE.GAME_DAY]: tk('Dia de jogo'),
  [TIMELINE_SOURCE.FEDERATION]: tk('Federação'),
});

function Item({ item, onOpenEvent }) {
  const conteudo = (
    <>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-black text-ink"
        style={{ background: item.position ? METAL[item.position].cor : undefined }}
        aria-hidden="true"
      >
        {item.position ? `${item.position}º` : <Route className="h-4 w-4 text-gray-500" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{item.title}</span>
        <span className="block text-xs text-gray-500">
          {[careerDateLabel(item.date, item.datePrecision), item.subtitle, item.where].filter(Boolean).join(' · ')}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <V2Badge tone="neutral">{t(FONTE_ROTULO[item.source])}</V2Badge>
          <SealBadge seal={item.seal} />
          {item.federated && <V2Badge tone="blue">{item.federation || t('Federado')}</V2Badge>}
          {item.cancelled && <V2Badge tone="red">{t('Cancelado')}</V2Badge>}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
    </>
  );
  const cls = 'flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-left transition-colors hover:border-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink';
  if (item.eventId) return <button type="button" className={cls} onClick={() => onOpenEvent(item.eventId)}>{conteudo}</button>;
  if (item.link) return <Link to={item.link} className={cls}>{conteudo}</Link>;
  return <div className={cls}>{conteudo}</div>;
}

function Resumo({ s }) {
  return (
    <span className="text-xs font-normal text-gray-500">
      {t('{n} eventos · {p} pódios', { n: s.events, p: s.podiums })}
      {s.gold + s.silver + s.bronze > 0 && ` · 🥇${s.gold} 🥈${s.silver} 🥉${s.bronze}`}
    </span>
  );
}

/**
 * @param {{ data: ReturnType<import('@/modules/career/hooks/useCareer').useCareerTimeline>,
 *   pending?: object[], onFlush?: Function, onOpenEvent: Function, onRegister: Function }} props
 */
export default function CareerTimeline({ data, pending = [], onFlush, onOpenEvent, onRegister }) {
  const [params, setParams] = useSearchParams();
  const filtros = timelineFiltersFromParams(params);
  const estimativa = useCareerEstimate();
  const vista = useMemo(() => filterTimeline(data.timeline, filtros), [data.timeline, filtros.podios, filtros.federados, filtros.origem]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  if (data.isPending) return <V2Skeleton lines={6} />;
  if (data.isError || !vista) {
    return <V2ErrorState title={t('Não carregou a sua carreira')} description={t('Os seus torneios continuam lá — a conexão é que falhou.')} onRetry={data.retry} />;
  }

  const progresso = registeredProgress(data.events, estimativa.valor);
  const filtrado = filtros.podios || filtros.federados || filtros.origem;
  const vazio = vista.upcoming.length === 0 && vista.seasons.length === 0;

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="inline-flex items-center gap-2"><CloudOff className="h-4 w-4" aria-hidden="true" /> {t('{n} registro(s) guardado(s) neste aparelho, esperando a conexão.', { n: pending.length })}</span>
          {onFlush && <V2Button type="button" size="sm" variant="ghost" onClick={onFlush}>{t('Enviar agora')}</V2Button>}
        </div>
      )}
      {vista.faltou.length > 0 && (
        <V2ErrorState inline title={t('Não deu para carregar {fontes}', { fontes: fmtLista(vista.faltou) })} description={t('A linha do tempo está incompleta até a conexão voltar.')} onRetry={data.retry} />
      )}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('Filtros da linha do tempo')}>
        <V2FilterChip active={filtros.podios} onClick={() => alternar('podios', filtros.podios ? null : '1')}><Medal className="h-3.5 w-3.5" /> {t('Só pódios')}</V2FilterChip>
        <V2FilterChip active={filtros.federados} onClick={() => alternar('federados', filtros.federados ? null : '1')}>{t('Só federados')}</V2FilterChip>
        <V2FilterChip active={filtros.origem === ORIGIN_FILTER.PLATFORM} onClick={() => alternar('origem', filtros.origem === ORIGIN_FILTER.PLATFORM ? null : ORIGIN_FILTER.PLATFORM)}>{t('Da plataforma')}</V2FilterChip>
        <V2FilterChip active={filtros.origem === ORIGIN_FILTER.OUTSIDE} onClick={() => alternar('origem', filtros.origem === ORIGIN_FILTER.OUTSIDE ? null : ORIGIN_FILTER.OUTSIDE)}>{t('De fora')}</V2FilterChip>
        {progresso && <span className="ml-auto text-sm font-semibold text-ink">{t('{feitos} de ~{total} registrados', { feitos: progresso.done, total: progresso.estimate })}</span>}
      </div>

      {vazio ? (
        filtrado ? (
          <p className="text-sm text-gray-500">{t('Nada com estes filtros.')}</p>
        ) : vista.faltou.length === 0 ? (
          <V2EmptyState
            icon={Route}
            title={t('Sua carreira começa aqui')}
            description={t('Registre os torneios que você jogou fora do PickleRush. Os torneios e dias de jogo daqui aparecem sozinhos.')}
            action={<V2Button type="button" variant="primary" onClick={onRegister}>{t('Registrar torneio')}</V2Button>}
          />
        ) : null
      ) : (
        <>
          {vista.upcoming.length > 0 && (
            <section aria-labelledby="carreira-proximos" className="space-y-2">
              <h2 id="carreira-proximos" className="flex items-center gap-2 font-display text-lg font-bold text-ink"><CalendarClock className="h-5 w-5" aria-hidden="true" /> {t('O que vem')}</h2>
              <ul className="space-y-2">{vista.upcoming.map((i) => <li key={i.id}><Item item={i} onOpenEvent={onOpenEvent} /></li>)}</ul>
            </section>
          )}
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-ink/20" />
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-widest text-acid">{t('Hoje')}</span>
            <span className="h-px flex-1 bg-ink/20" />
          </div>
          {vista.seasons.map((s) => (
            <details key={s.year} open={!s.closed} className="group rounded-2xl border border-gray-100 bg-paper p-4">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-xl font-bold text-ink">{t('Temporada {ano}', { ano: s.year })}</span>
                <Resumo s={s.summary} />
              </summary>
              <ul className="mt-3 space-y-2">{s.items.map((i) => <li key={i.id}><Item item={i} onOpenEvent={onOpenEvent} /></li>)}</ul>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
