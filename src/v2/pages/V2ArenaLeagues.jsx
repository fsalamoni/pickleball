/**
 * V2ArenaLeagues — os TORNEIOS e o RANKING DA CASA de uma arena (Onda CB).
 *
 * Rotas: `/arenas/:arenaId/torneios` (atleta) ·
 *        `/arenas/:arenaId/gerir/torneios` (endereço antigo da gestão — leva
 *        à Central, seção Torneios; fica porque avisos e links antigos
 *        apontam para ele)
 *
 * ## O que mudou
 *
 * Esta página era a do "torneio da casa": uma competição paralela, com
 * inscrição, formato e ladder próprios. Só que começar esse torneio CRIAVA um
 * dia de jogo da arena — e desde a Onda CA todo jogo aberto já é um dia de
 * jogo. O torneio da casa virou uma segunda porta para a mesma sala, e saiu.
 *
 * Ficou o que ele tinha de bom, maior:
 *  - **Torneios da casa** = os torneios da PLATAFORMA sediados aqui, com as
 *    regras da plataforma (chaves, desempate, ranking nacional);
 *  - **Ranking da casa** = os jogos abertos com placar + os torneios da casa,
 *    somados por temporada (`HouseRankingPanel`, o mesmo da Central).
 *
 * Os torneios internos antigos NÃO foram apagados: os encerrados seguem
 * somando no ranking da casa (pelo ladder), e a arena fecha os que ficaram
 * abertos na Central, avisando os inscritos.
 */

import React, { useMemo } from 'react';
import { Link, Navigate, useMatch, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Settings2, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { useArenaTournaments } from '@/modules/tournament/hooks/useTournament';
import { sortHouseTournaments } from '@/modules/arenas/domain/houseTournaments';
import HouseRankingPanel from '@/v2/components/arenas/houseRanking/HouseRankingPanel';
import { HouseTournamentRow } from '@/v2/components/arenas/tournaments/HouseTournamentsSection';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

function TorneiosDaCasa({ arena, podeGerir }) {
  const q = useArenaTournaments(arena.id);
  const torneios = useMemo(() => sortHouseTournaments(q.data || []), [q.data]);
  return (
    <V2Surface>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Trophy className="h-5 w-5 shrink-0" /> Torneios da casa
        </h2>
        {podeGerir && (
          <V2Button asChild size="sm" variant="secondary">
            <Link to={`/torneios/criar?arena=${arena.id}`}><Plus className="h-4 w-4" /> Criar torneio aqui</Link>
          </V2Button>
        )}
      </div>
      <p className="-mt-1 mb-4 text-sm text-gray-500">
        Torneios da plataforma sediados nesta arena: inscrição, chaves e resultados pelas regras da plataforma.
      </p>
      {q.isLoading ? (
        <V2Skeleton lines={3} />
      ) : q.isError ? (
        <V2ErrorState
          inline
          title="Não foi possível carregar os torneios"
          description="A conexão falhou. Os torneios continuam lá."
          onRetry={() => q.refetch()}
        />
      ) : torneios.length === 0 ? (
        <p className="rounded-2xl bg-paper px-3 py-3 text-sm text-gray-500">
          Nenhum torneio sediado aqui por enquanto. Quando houver, ele aparece aqui e na página da arena.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {torneios.map((t) => <HouseTournamentRow key={t.id} t={t} />)}
        </div>
      )}
    </V2Surface>
  );
}

export default function V2ArenaLeagues() {
  const { arenaId } = useParams();
  const naGestao = useMatch('/arenas/:arenaId/gerir/torneios');
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading, isError, refetch } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);

  // A gestão dos torneios mora na Central. O endereço antigo continua valendo.
  if (naGestao) return <Navigate to={`/arenas/${arenaId}/gerir?aba=torneios`} replace />;

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[900px] rounded-4xl" />;
  }
  if (!arena && isError) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2ErrorState
          title="Não foi possível abrir os torneios da arena"
          description="A conexão falhou no meio do caminho. A arena continua lá — tente de novo."
          onRetry={() => refetch()}
        />
      </div>
    );
  }
  if (!arena) return <Navigate to="/arenas" replace />;

  const podeGerir = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;
  const comRanking = isOn(ARENA_MODULE_ID.LEAGUES);

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <div className="mb-2">
        <Link
          to={`/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {arena.name}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {comRanking ? 'Torneios e ranking da casa' : 'Torneios da casa'}
        </h1>
        <p className="mt-2 font-medium text-gray-500">
          {arena.name} · {comRanking
            ? 'os torneios sediados aqui e a classificação da comunidade da arena.'
            : 'os torneios da plataforma sediados aqui.'}
        </p>
        {podeGerir && (
          <V2Button asChild size="sm" variant="secondary" className="mt-3">
            <Link to={`/arenas/${arena.id}/gerir?aba=torneios`}>
              <Settings2 className="h-4 w-4" /> Gerir na Central
            </Link>
          </V2Button>
        )}
      </div>

      {comRanking && <div id="ranking" className="scroll-mt-4"><HouseRankingPanel arena={arena} audience="public" /></div>}
      <TorneiosDaCasa arena={arena} podeGerir={podeGerir} />
    </div>
  );
}
