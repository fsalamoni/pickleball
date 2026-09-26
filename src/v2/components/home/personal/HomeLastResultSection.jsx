/**
 * "Seu último torneio" — o resultado, sem abrir o torneio.
 *
 * Vem do histórico de participação (o mesmo de "Meu desempenho", mesma chave
 * de cache). Some quando a pessoa ainda não disputou torneio nenhum: não há o
 * que mostrar, e uma caixa dizendo isso não ajuda ninguém a agir.
 *
 * ⚠️ A colocação é a da CLASSIFICAÇÃO da modalidade (a aba Ranking do
 * torneio), e o texto diz isso — não promete pódio de chave.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Medal, Users } from 'lucide-react';
import { useMyTournamentHistory } from '@/modules/tournament/hooks/useTournament';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { colocacaoTexto, lastTournamentResult } from '@/modules/home/domain/homeTournaments';
import { TOURNAMENT_PHASE_LABEL } from '@/modules/home/domain/freshness';
import { cn } from '@/core/lib/utils';
import { HomeSection } from './HomeSection';

const MEDALHA = { 1: 'bg-acid text-ink', 2: 'bg-gray-200 text-ink', 3: 'bg-amber-200 text-ink' };

export default function HomeLastResultSection({ reason, hoje }) {
  const historico = useMyTournamentHistory();
  const ultimo = useMemo(() => lastTournamentResult(historico.data || [], hoje), [historico.data, hoje]);

  if (historico.isLoading) {
    return (
      <HomeSection id="resultado" icon={Medal} title="Seu último torneio" reason={reason}>
        <V2Skeleton className="h-28 rounded-3xl" />
      </HomeSection>
    );
  }
  if (historico.isError) {
    return (
      <HomeSection id="resultado" icon={Medal} title="Seu último torneio" reason={reason}>
        <V2ErrorState inline title="Não carregou o seu histórico" description="Os seus resultados continuam lá." onRetry={historico.refetch} />
      </HomeSection>
    );
  }
  if (!ultimo) return null;

  const { best } = ultimo;
  const outras = ultimo.entries.slice(1, 3);
  return (
    <HomeSection
      id="resultado"
      icon={Medal}
      title="Seu último torneio"
      reason={reason}
      action={{ to: `/torneios/${ultimo.tournamentId}/ranking`, label: 'Classificação' }}
    >
      <Link
        to={`/torneios/${ultimo.tournamentId}/ranking`}
        className="group flex items-center gap-4 rounded-3xl bg-mesh p-5 text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40"
      >
        <span
          className={cn(
            'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl font-display font-black',
            MEDALHA[best.position] || 'bg-white/10 text-white',
          )}
          aria-hidden="true"
        >
          <span className="text-2xl leading-none">{best.position}º</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold">{ultimo.name}</span>
          <span className="mt-0.5 block text-sm text-gray-300">
            {colocacaoTexto(best)} na classificação · {best.modality}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span>{best.wins}V – {best.losses}D</span>
            {best.partnerName && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" /> com {best.partnerName}</span>}
            <span>{ultimo.encerrado ? 'Encerrado' : TOURNAMENT_PHASE_LABEL[ultimo.phase]}{ultimo.when ? ` · ${ultimo.when}` : ''}</span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-acid transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </Link>
      {outras.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          {outras.map((e) => (
            <li key={`${e.modality}-${e.position}`} className="flex justify-between gap-2 rounded-2xl bg-paper px-3 py-2">
              <span className="truncate">{e.modality}</span>
              <span className="shrink-0 font-semibold text-ink">{colocacaoTexto(e)}</span>
            </li>
          ))}
        </ul>
      )}
    </HomeSection>
  );
}
