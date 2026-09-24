/**
 * V2ArenaLeagues — a competição da casa.
 *
 * Rotas: `/arenas/:arenaId/torneios` (atleta) ·
 *        `/arenas/:arenaId/gerir/torneios` (antiga tela da arena — agora leva
 *        à Central, seção Torneios; a rota fica porque notificação e link
 *        antigos apontam para ela)
 * Módulos: `leagues` (+ `leagues_internal`, `leagues_ladder`,
 * `leagues_open_play`, `leagues_prizing`).
 *
 * ## O que a versão anterior não fazia
 *
 * **O torneio não gerava partida nenhuma.** Guardava `format:
 * 'single_elimination'` e nada no projeto sorteava nada: o atleta se inscrevia
 * e acabava ali. Um torneio que não vira jogo é uma lista de nomes.
 *
 * **O ladder era lido e nunca escrito** — a classificação da arena estava
 * vazia desde sempre, para todo mundo.
 *
 * **O torneio não ocupava a quadra**, e **não dava para sair** dele.
 *
 * ## A decisão que evitou reescrever a plataforma
 *
 * A arena já tem uma máquina completa de dia de jogo: sorteio equilibrado pela
 * régua 2.0–8.0, Play, Americano, Americano aprimorado, placar, ranking do
 * dia, telão e tutoriais. Um torneio interno é exatamente isso, com inscrição
 * antecipada e prêmio.
 *
 * Então **Começar o torneio** cria um dia de jogo da arena com os inscritos, e
 * a partir dali o botão leva para lá. O ambiente do atleta não precisou de
 * nada novo.
 *
 * O corpo é `ArenaLeaguesPanel`, o MESMO da Central: a arena e o atleta olham
 * para a mesma coisa, cada um com os poderes que tem.
 */

import React from 'react';
import { Link, Navigate, useMatch, useParams } from 'react-router-dom';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import ArenaLeaguesPanel from '@/v2/components/arenas/tournaments/ArenaLeaguesPanel';
import { V2Button, V2Skeleton } from '@/v2/ui/primitives';

export default function V2ArenaLeagues() {
  const { arenaId } = useParams();
  const naGestao = useMatch('/arenas/:arenaId/gerir/torneios');
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);

  // A gestão dos torneios mora na Central. O endereço antigo continua valendo.
  if (naGestao) return <Navigate to={`/arenas/${arenaId}/gerir?aba=torneios`} replace />;

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[900px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.LEAGUES)) return <Navigate to={`/arenas/${arenaId}`} replace />;

  const podeGerir = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6">
        <Link
          to={`/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {arena.name}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Torneios da casa
        </h1>
        <p className="mt-2 font-medium text-gray-500">
          {arena.name} · a competição da comunidade da arena.
        </p>
        {podeGerir && (
          <V2Button asChild size="sm" variant="secondary" className="mt-3">
            <Link to={`/arenas/${arena.id}/gerir?aba=torneios`}>
              <Settings2 className="h-4 w-4" /> Gerir torneios na Central
            </Link>
          </V2Button>
        )}
      </div>

      <ArenaLeaguesPanel arena={arena} podeGerir={podeGerir} />
    </div>
  );
}
