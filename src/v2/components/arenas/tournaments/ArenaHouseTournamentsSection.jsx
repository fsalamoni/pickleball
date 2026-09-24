/**
 * "Torneios da casa" — a seção da página da arena (módulo `leagues`).
 *
 * Antes, o torneio da casa era um BOTÃO de atalho no topo da página, que
 * levava a outra tela. Agora está no fluxo da página, ao lado dos torneios da
 * plataforma: os próximos com inscrição aberta (e a inscrição ali mesmo), o
 * que está rolando (com o caminho para o jogo) e o topo da classificação da
 * casa — que é o que faz a turma voltar.
 *
 * Sem nada para mostrar, a seção não aparece. Sem login, não consulta (a
 * leitura exige conta — a falha viraria "nenhum torneio").
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Crown, Play, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useArenaInternalTournaments, useArenaLadder, useJoinTournament,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  INTERNAL_TOURNAMENT_FORMAT_META, INTERNAL_TOURNAMENT_STATUS, isTournamentOpen, tournamentSeatsLeft,
} from '@/modules/arenas/domain/leagues';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';

function LinhaDoTorneio({ torneio, arenaId, souInscrito }) {
  const entrar = useJoinTournament();
  const aberto = isTournamentOpen(torneio);
  const rolando = torneio.status === INTERNAL_TOURNAMENT_STATUS.RUNNING;
  const vagas = tournamentSeatsLeft(torneio);
  const formato = INTERNAL_TOURNAMENT_FORMAT_META[torneio.format];
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{torneio.name}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {formatDateShortBR(torneio.date)}
          {torneio.start_time ? ` · ${torneio.start_time}` : ''}
          {formato ? ` · ${formato.label}` : ''}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Users className="h-3 w-3" /> {torneio.enrolled || 0}/{torneio.max_participants}
          {' · '}{Number(torneio.entry_fee) > 0 ? formatPrice(torneio.entry_fee) : 'gratuito'}
        </p>
      </div>
      {rolando && torneio.game_day_id ? (
        <V2Button asChild size="sm">
          <Link to={`/dia-de-jogo/${torneio.game_day_id}`}><Play className="mr-1 h-3.5 w-3.5" /> Acompanhar</Link>
        </V2Button>
      ) : souInscrito ? (
        <V2Badge tone="green">Você está inscrito</V2Badge>
      ) : aberto ? (
        <V2Button
          size="sm"
          disabled={vagas === 0 || entrar.isPending}
          onClick={() => entrar.mutateAsync({ arenaId, tid: torneio.id })
            .then(() => toast.success('Inscrição feita!'))
            .catch((e) => toast.error(e?.message || 'Não foi possível inscrever.'))}
        >
          {vagas === 0 ? 'Lotado' : 'Quero jogar'}
        </V2Button>
      ) : null}
    </li>
  );
}

export default function ArenaHouseTournamentsSection({ arena }) {
  const arenaId = arena.id;
  const { user, isAuthenticated } = useAuth();
  const { isOn } = useArenaModules(arenaId);
  const paraQuem = isAuthenticated ? arenaId : null;
  const { data: torneios = [] } = useArenaInternalTournaments(paraQuem);
  const temLadder = isOn(ARENA_MODULE_ID.LEAGUES_LADDER);
  const { data: ladder = [] } = useArenaLadder(temLadder ? paraQuem : null);

  const hoje = todayISO();
  const vitrine = useMemo(() => torneios
    .filter((t) => t.status === INTERNAL_TOURNAMENT_STATUS.RUNNING
      || (isTournamentOpen(t) && String(t.date || '') >= hoje))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .slice(0, 3), [torneios, hoje]);
  const topo = ladder.slice(0, 3);

  if (vitrine.length === 0 && topo.length === 0) return null;

  return (
    <V2Surface>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <Trophy className="h-4 w-4" /> Torneios da casa
        </h3>
        <Link to={`/arenas/${arenaId}/torneios`} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
          Ver todos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {vitrine.length > 0 && (
        <ul className="mt-3 space-y-2">
          {vitrine.map((t) => (
            <LinhaDoTorneio key={t.id} torneio={t} arenaId={arenaId}
              souInscrito={(t.participants || []).includes(user?.uid)} />
          ))}
        </ul>
      )}

      {topo.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gray-500">
            <Crown className="h-3.5 w-3.5" /> Classificação da casa
          </p>
          <ol className="mt-2 flex flex-wrap gap-1.5">
            {topo.map((l, i) => (
              <li key={l.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs text-ink">
                <strong>{l.ladder_position || i + 1}º</strong> {l.name} · {l.points || 0} pts
              </li>
            ))}
          </ol>
        </div>
      )}
    </V2Surface>
  );
}
