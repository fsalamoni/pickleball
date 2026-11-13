/**
 * A LINHA DO TEMPO da carreira (aba `linha-do-tempo`, docs/54 §4.5): o que
 * vem acima do "Hoje", o histórico abaixo, por temporada (o ano civil), com
 * as temporadas fechadas recolhidas. Fontes: os torneios da plataforma,
 * as ligas, pontos de federação e os torneios de fora (dia de jogo só com "Incluir dias
 * de jogo", e sem medalha — dia de jogo não é torneio) — cada uma falhando
 * sozinha, e a que falhou é DITA (nunca "você ainda não jogou").
 *
 * Filtros na URL: `?podios=1`, `?federados=1`, `?origem=fora|plataforma`.
 *
 * Os registros guardados no aparelho (sem sinal) aparecem ANTES de tudo, mesmo
 * com a lista sem carregar: é sem conexão que a pessoa mais precisa vê-los.
 */
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, ChevronDown, ChevronRight, CloudOff, Medal, Route, Sparkles } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import {
  ORIGIN_FILTER, TIMELINE_SOURCE, filterTimeline, timelineFiltersFromParams,
} from '@/modules/career/domain/timeline.js';
import { registeredProgress } from '@/modules/career/domain/careerEvent.js';
import { buildSeasonRecap } from '@/modules/career/domain/seasonRecap.js';
import { todayLocal } from '@/modules/training/domain/dates.js';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton } from '@/v2/ui/primitives';
import { METAL } from '@/v2/components/trophies/MedalCard';
import { SealBadge, careerDateLabel, useCareerEstimate } from './careerUi';
import { fmtLista, t, tk, tn } from '@/core/i18n';

const MedalCardDialog = lazy(() => import('@/v2/components/trophies/MedalCardDialog'));

const FONTE_ROTULO = Object.freeze({
  [TIMELINE_SOURCE.CAREER]: tk('De fora'),
  [TIMELINE_SOURCE.TOURNAMENT]: tk('Torneio'),
  [TIMELINE_SOURCE.GAME_DAY]: tk('Dia de jogo'),
  [TIMELINE_SOURCE.FEDERATION]: tk('Federação'),
  [TIMELINE_SOURCE.LEAGUE]: tk('Liga'),
});

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink';
const CHIP = 'coarse:min-h-11';

function Item({ item, onOpenEvent }) {
  // Sem ficha nem link (ponto de federação sem torneio aqui): não pode parecer clicável.
  const clicavel = Boolean(item.eventId || item.link);
  const conteudo = (
    <>
      {/* `tema-claro`: a cor do metal vem em `style` e não troca no modo escuro — o número fica escuro sobre ela. */}
      <span
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-black text-ink', item.position && 'tema-claro')}
        style={{ background: item.position ? METAL[item.position].cor : undefined }}
        aria-hidden="true"
      >
        {item.position ? t('{n}º', { n: item.position }) : <Route className="h-4 w-4 text-gray-500" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{item.title}</span>
        <span className="block text-xs text-gray-500">
          {[careerDateLabel(item.date, item.datePrecision), item.subtitle, item.where].filter(Boolean).join(' · ')}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <V2Badge tone="neutral">{t(FONTE_ROTULO[item.source])}</V2Badge>
          <SealBadge seal={item.seal} awaiting={item.partnerState === 'awaiting'} />
          {item.federated && <V2Badge tone="blue">{item.federation || t('Federado')}</V2Badge>}
          {item.cancelled && <V2Badge tone="red">{t('Não fui')}</V2Badge>}
          {/* O plano que passou sem resposta: está na lista, mas fora das contas até a pessoa dizer. */}
          {item.pending && !item.cancelled && <V2Badge tone="amber">{t('Como foi?')}</V2Badge>}
        </span>
      </span>
      {clicavel && <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />}
    </>
  );
  const base = 'flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-left';
  const interativo = cn(base, 'transition-colors hover:border-ink/30', FOCO);
  if (item.eventId) return <button type="button" className={interativo} onClick={() => onOpenEvent(item.eventId)}>{conteudo}</button>;
  if (item.link) return <Link to={item.link} className={interativo}>{conteudo}</Link>;
  return <div className={base}>{conteudo}</div>;
}

function Resumo({ s }) {
  return (
    <span className="text-xs font-normal text-gray-500">
      {[tn(s.tournaments, '{n} torneio', '{n} torneios'), s.leagues > 0 ? tn(s.leagues, '{n} liga', '{n} ligas') : '', tn(s.podiums, '{n} pódio', '{n} pódios')].filter(Boolean).join(' · ')}
      {s.gameDays > 0 && ` · ${tn(s.gameDays, '{n} dia de jogo', '{n} dias de jogo')}`}
      {s.gold + s.silver + s.bronze > 0 && ` · 🥇${s.gold} 🥈${s.silver} 🥉${s.bronze}`}
    </span>
  );
}

/**
 * A fila do aparelho: quantos esperam a conexão, cada um como botão que abre a
 * ficha, e o recusado pelo servidor dito (abrir para corrigir ou descartar).
 */
function Pendentes({ pending, onFlush, flushing, onOpenEvent }) {
  const esperando = pending.filter((p) => !p.refused).length;
  async function enviar() {
    const r = await onFlush();
    if (!r) return;
    if (r.enviados > 0) toast.success(tn(r.enviados, '{n} registro enviado.', '{n} registros enviados.'));
    if (r.recusados?.length) {
      toast.error(t('O servidor recusou: {nomes}. Abra para corrigir ou descartar.', { nomes: fmtLista(r.recusados.map((x) => x.name || t('Torneio'))) }));
    } else if (!r.enviados && r.esperando > 0) {
      toast.message(t('Ainda sem conexão. Os registros continuam guardados neste aparelho.'));
    }
  }
  return (
    <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span role="status" className="inline-flex items-center gap-2">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          {esperando > 0
            ? tn(esperando, '{n} registro guardado neste aparelho, esperando a conexão.', '{n} registros guardados neste aparelho, esperando a conexão.')
            : t('Há registros neste aparelho que o servidor recusou.')}
        </span>
        {onFlush && esperando > 0 && (
          <V2Button type="button" size="sm" variant="ghost" onClick={enviar} disabled={flushing} aria-busy={flushing || undefined}>
            {flushing ? t('Enviando…') : t('Enviar agora')}
          </V2Button>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {pending.map((p) => (
          <li key={p.id} className="max-w-full">
            <button type="button"
              onClick={() => onOpenEvent(p.id)}
              className={cn('inline-flex min-h-11 max-w-full items-center gap-1 rounded-xl border border-amber-300 bg-paper-pure px-3 py-1.5 text-left text-xs font-semibold text-ink', FOCO)}
            >
              <span className="truncate">{p.name || t('Torneio')}</span>
              {p.refused && <span className="shrink-0 font-normal text-red-700">— {t('recusado: abra para corrigir ou descartar')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * @param {{ data: ReturnType<import('@/modules/career/hooks/useCareerTimeline').useCareerTimeline>,
 *   pending?: object[], onFlush?: Function, flushing?: boolean, onOpenEvent: Function,
 *   onRegister: Function, onList?: Function }} props
 */
export default function CareerTimeline({ data, pending = [], onFlush, flushing = false, onOpenEvent, onRegister, onList }) {
  const { user, userProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const filtros = timelineFiltersFromParams(params);
  const estimativa = useCareerEstimate();
  const vista = useMemo(() => filterTimeline(data.timeline, filtros), [data.timeline, filtros.podios, filtros.federados, filtros.origem]); // eslint-disable-line react-hooks/exhaustive-deps
  // A retrospectiva sai da linha do tempo SEM filtro (o filtro é da tela, não da temporada). Zero banco.
  const retros = useMemo(() => {
    const m = new Map();
    const me = { uid: user?.uid || null, name: userProfile?.platform_name || user?.displayName || '' };
    (data.timeline?.seasons || []).forEach((s) => {
      const r = buildSeasonRecap({
        season: s, faltou: data.timeline.faltou, career: data.events, trophies: data.trophies?.torneios, me, today: todayLocal(),
      });
      if (r) m.set(s.year, { ...r, name: me.name });
    });
    return m;
  }, [data.timeline, data.events, data.trophies, user, userProfile]);
  const [retro, setRetro] = useState(null);
  const ultimaRetro = retros.size ? retros.get(Math.max(...retros.keys())) : null;

  const alternar = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const limpar = () => {
    const p = new URLSearchParams(params);
    ['podios', 'federados', 'origem'].forEach((k) => p.delete(k));
    setParams(p, { replace: true });
  };

  const faixa = pending.length > 0 && <Pendentes pending={pending} onFlush={onFlush} flushing={flushing} onOpenEvent={onOpenEvent} />;

  if (data.isPending) {
    return (
      <div className="space-y-5">
        {faixa}
        {/* Sem conexão a consulta fica PAUSADA: o esqueleto giraria para sempre. */}
        {data.isPaused
          ? <p role="status" className="rounded-2xl border border-gray-100 bg-paper p-4 text-sm text-gray-600">{t('Sem conexão. A sua carreira aparece aqui quando ela voltar.')}</p>
          : <V2Skeleton lines={6} />}
      </div>
    );
  }
  if (data.isError || !vista) {
    return (
      <div className="space-y-5">
        {faixa}
        <V2ErrorState title={t('Não carregou a sua carreira')} description={t('Os seus torneios continuam lá — a conexão é que falhou.')} onRetry={data.retry} />
      </div>
    );
  }

  const progresso = registeredProgress(data.events, estimativa.valor);
  const filtrado = filtros.podios || filtros.federados || filtros.origem;
  const vazio = vista.upcoming.length === 0 && vista.seasons.length === 0;

  return (
    <div className="space-y-5">
      {faixa}
      {vista.faltou.length > 0 && (
        <V2ErrorState inline title={t('Não deu para carregar {fontes}', { fontes: fmtLista(vista.faltou) })} description={t('A linha do tempo está incompleta até a conexão voltar.')} onRetry={data.retry} />
      )}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('Filtros da linha do tempo')}>
        <V2FilterChip className={CHIP} active={filtros.podios} onClick={() => alternar('podios', filtros.podios ? null : '1')}><Medal className="h-3.5 w-3.5" aria-hidden="true" /> {t('Só pódios')}</V2FilterChip>
        <V2FilterChip className={CHIP} active={filtros.federados} onClick={() => alternar('federados', filtros.federados ? null : '1')}>{t('Só federados')}</V2FilterChip>
        <V2FilterChip className={CHIP} active={filtros.origem === ORIGIN_FILTER.PLATFORM} onClick={() => alternar('origem', filtros.origem === ORIGIN_FILTER.PLATFORM ? null : ORIGIN_FILTER.PLATFORM)}>{t('Da plataforma')}</V2FilterChip>
        <V2FilterChip className={CHIP} active={filtros.origem === ORIGIN_FILTER.OUTSIDE} onClick={() => alternar('origem', filtros.origem === ORIGIN_FILTER.OUTSIDE ? null : ORIGIN_FILTER.OUTSIDE)}>{t('De fora')}</V2FilterChip>
        {data.setIncludeGameDays && (
          <V2FilterChip className={CHIP} active={data.includeGameDays} onClick={() => data.setIncludeGameDays(!data.includeGameDays)} title={t('Dia de jogo não é torneio: entra sem medalha e sem pódio.')}>
            {t('Incluir dias de jogo')}
          </V2FilterChip>
        )}
        {progresso && <span className="ml-auto text-sm font-semibold text-ink">{t('{feitos} de ~{total} registrados', { feitos: progresso.done, total: progresso.estimate })}</span>}
      </div>

      {vazio ? (
        filtrado ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-500">{t('Nada com estes filtros.')}</p>
            <V2Button type="button" size="sm" variant="secondary" onClick={limpar}>{t('Limpar filtros')}</V2Button>
          </div>
        ) : vista.faltou.length === 0 ? (
          <V2EmptyState
            icon={Route}
            title={t('Sua carreira começa aqui')}
            description={t('Registre os torneios que você jogou fora do PickleRush. Os torneios daqui aparecem sozinhos. Tem anos de torneio para trás? "Vários de uma vez" lança um por linha.')}
            action={(
              <>
                <V2Button type="button" variant="primary" onClick={onRegister}>{t('Registrar torneio')}</V2Button>
                {onList && <V2Button type="button" variant="secondary" onClick={onList}>{t('Vários de uma vez')}</V2Button>}
              </>
            )}
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
          {ultimaRetro && ultimaRetro.year >= Number(todayLocal().slice(0, 4)) - 1 && (
            <div data-dica="carreira-retrospectiva" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-acid/40 bg-acid/10 p-4">
              <span className="min-w-0">
                <span className="block font-display text-base font-bold text-ink">{t('Sua temporada {ano} num cartão', { ano: ultimaRetro.year })}</span>
                <span className="block text-sm text-gray-600">{t('Torneios, medalhas e a parceria do ano, para compartilhar.')}</span>
              </span>
              <V2Button type="button" variant="primary" size="sm" onClick={() => setRetro(ultimaRetro)}><Sparkles className="h-4 w-4" /> {t('Ver a retrospectiva')}</V2Button>
            </div>
          )}
          {vista.seasons.map((s) => (
            <details key={s.year} open={!s.closed} className="group rounded-2xl border border-gray-100 bg-paper p-4">
              {/* Sem o marcador nativo (`list-none`), a seta é o que diz que a temporada abre. */}
              <summary className={cn('flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl [&::-webkit-details-marker]:hidden', FOCO)}>
                <h2 className="font-display text-xl font-bold text-ink">{t('Temporada {ano}', { ano: s.year })}</h2>
                <Resumo s={s.summary} />
                <ChevronDown className="ml-auto h-5 w-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              {retros.has(s.year) && (
                <V2Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setRetro(retros.get(s.year))}>
                  <Sparkles className="h-4 w-4" /> {t('Retrospectiva {ano}', { ano: s.year })}
                </V2Button>
              )}
              <ul className="mt-3 space-y-2">{s.items.map((i) => <li key={i.id}><Item item={i} onOpenEvent={onOpenEvent} /></li>)}</ul>
            </details>
          ))}
        </>
      )}

      {retro && (
        <Suspense fallback={null}>
          <MedalCardDialog open onOpenChange={(v) => { if (!v) setRetro(null); }} season={retro} />
        </Suspense>
      )}
    </div>
  );
}
