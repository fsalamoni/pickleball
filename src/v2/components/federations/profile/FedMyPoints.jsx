/**
 * "Meus pontos no ranking" (aba Minha filiação): o histórico de pontos da
 * pessoa nesta federação, ano a ano. Cada torneio chancelado LANÇA os pontos
 * (`federation_points`, gravado pelo servidor); o ano soma os melhores de cada
 * classe e, encerrado, não muda mais. A posição de cada ano vem do ranking
 * gravado; a soma é a mesma conta do servidor (`personPointsHistory`).
 * Só a própria pessoa vê esta aba.
 */
import React, { useMemo } from 'react';
import { Lock, Medal } from 'lucide-react';
import { useFederationRankings, useMyFederationPoints } from '@/modules/federations/hooks/useFederations';
import { personPointsHistory, seasonLastDay } from '@/modules/federations/domain/officialRanking';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { POINTS_CANCEL_REASON_LABELS, POINTS_STATUS } from '@/modules/federations/domain/constants';
import { V2Badge, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

const diaBR = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '—');

function Lancamento({ e }) {
  const cancelado = e.status !== POINTS_STATUS.AWARDED;
  return (
    <li className={`flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm ${cancelado ? 'text-gray-500' : ''}`}>
      <span className="min-w-0">
        <span className={`font-semibold ${cancelado ? 'line-through' : 'text-ink'}`}>{e.tournament_name || t('Torneio')}</span>
        <span className="block text-xs text-gray-500">
          {[diaBR(e.date), e.modality_name, e.position ? t('{n}º lugar', { n: e.position }) : t('participação')].filter(Boolean).join(' · ')}
          {cancelado ? ` · ${t('cancelado')}: ${t(POINTS_CANCEL_REASON_LABELS[e.cancel_reason] || POINTS_CANCEL_REASON_LABELS.result_deleted)}` : ''}
          {!cancelado && e.previous ? ` · ${t('revisto (antes {n})', { n: e.previous.points })}` : ''}
        </span>
      </span>
      <span className="tabular-nums font-semibold">
        {e.points}
        {!cancelado && !e.counts && <span className="ml-1 text-xs font-normal text-gray-500">{t('não conta')}</span>}
      </span>
    </li>
  );
}

export default function FedMyPoints({ federation, uid }) {
  const ligado = fedModuleOn(federation, 'ranking');
  const q = useMyFederationPoints({ enabled: ligado && Boolean(uid) });
  const meus = useMemo(() => (q.data || []).filter((e) => e.federation_id === federation.id), [q.data, federation.id]);
  const anos = useMemo(() => [...new Set(meus.map((e) => Number(e.season)).filter(Number.isFinite))].sort((a, b) => b - a), [meus]);
  const r = useFederationRankings(federation.id, anos, { enabled: ligado && anos.length > 0 });
  const historico = useMemo(() => personPointsHistory({ entries: meus, uid, rankings: r.porAno, config: federation.ranking_config }), [meus, uid, r.porAno, federation.ranking_config]);
  if (!ligado) return null;
  return (
    <section aria-labelledby="fed-meus-pontos" className="space-y-3 border-t border-gray-100 pt-4" data-dica="federacao-meus-pontos">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="fed-meus-pontos" className="font-bold text-ink">{t('Meus pontos no ranking')}</h3>
        {historico.seasons.length > 0 && <span className="text-sm text-gray-600">{t('Soma de todos os anos: {n} pontos', { n: historico.total })}</span>}
      </div>
      {q.isError && <V2ErrorState inline title={t('Não carregou os seus pontos')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {q.isSuccess && historico.seasons.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-gray-500"><Medal className="h-4 w-4" aria-hidden="true" />{t('Você ainda não pontuou no ranking oficial. Cada torneio chancelado em que você pontua lança os pontos aqui.')}</p>
      )}
      {r.isError && <V2ErrorState inline title={t('A posição de algum ano não carregou')} onRetry={r.retry} />}
      {historico.seasons.map((s) => (
        <div key={s.season} className="rounded-2xl border border-gray-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-ink">
              {s.season}
              {s.closed
                ? <V2Badge tone="neutral"><Lock className="h-3 w-3" aria-hidden="true" />{t('encerrado')}</V2Badge>
                : <V2Badge tone="green">{t('aberto até {data}', { data: diaBR(seasonLastDay(s.season)) })}</V2Badge>}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-display text-lg font-bold text-ink">{s.points}</span> {t('pontos')}
              {s.position ? ` · ${t('{n}º de {total} na geral', { n: s.position, total: s.field })}` : ''}
            </p>
          </div>
          <p className="text-xs text-gray-500">{tn(s.awarded, '{n} torneio lançado', '{n} torneios lançados')}{s.closed ? ` · ${t('resultado final, não muda mais')}` : ''}</p>
          <ul className="divide-y divide-gray-100">{s.entries.map((e) => <Lancamento key={e.id} e={e} />)}</ul>
        </div>
      ))}
    </section>
  );
}
