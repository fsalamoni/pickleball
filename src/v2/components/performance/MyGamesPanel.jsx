/**
 * Painel "Meus jogos" — próximos jogos + histórico de partidas do atleta.
 * Extraído de V2MyGames para virar sub-aba de "Meu desempenho".
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Trophy, MapPin, History, CheckCircle2, XCircle, Dices, Swords, TrendingUp } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { getMyUpcomingMatches, getMyFinishedMatches } from '@/modules/tournament/services/upcomingService';
import { useMyGameDayGames } from '@/modules/games/hooks/useGameDays';
import {
  V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function formatDateTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Rótulo do MEU lado: "Você / Parceiro" nas duplas, "Você" no individual. */
function mySideLabel(partner) {
  const p = String(partner || '').trim();
  return p ? `Você / ${p}` : 'Você';
}

/** Confronto no formato "minha dupla vs dupla adversária". */
function MatchupLine({ partner, opponent }) {
  return (
    <div className="mt-1 font-bold text-ink">
      <span>{mySideLabel(partner)}</span>
      <span className="mx-1.5 font-normal text-gray-400">vs</span>
      <span>{opponent}</span>
    </div>
  );
}

/**
 * Faixa "pós-jogo" (flag post_game_flow): fecha o ciclo com menos atrito —
 * marcar o próximo jogo e acompanhar a evolução do rating. Aditiva.
 */
function PostGameStrip() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-4xl border border-acid/30 bg-acid/10 p-5">
      <div className="min-w-0">
        <p className="font-display text-base font-bold text-ink">Fechou mais um jogo? Mantenha o ritmo 🔥</p>
        <p className="text-sm text-gray-600">Marque o próximo jogo ou veja como seu rating evoluiu.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <V2Button asChild size="sm">
          <Link to="/encontrar-jogadores"><Swords className="h-4 w-4" /> Jogar de novo</Link>
        </V2Button>
        <V2Button asChild variant="subtle" size="sm">
          <Link to="/ranking"><TrendingUp className="h-4 w-4" /> Ver minha evolução</Link>
        </V2Button>
      </div>
    </div>
  );
}

export default function MyGamesPanel() {
  const { user } = useAuth();
  const uid = user?.uid;
  const postGameOn = useFeatureFlag(FEATURE_FLAG.POST_GAME_FLOW);
  const [tab, setTab] = useState('proximos');

  const { data: upcoming = [], isLoading: loadingUp } = useQuery({
    queryKey: ['my-games-upcoming', uid],
    queryFn: () => getMyUpcomingMatches(uid, { limit: 50 }),
    enabled: !!uid,
    staleTime: 30_000,
  });
  const { data: history = [], isLoading: loadingHist } = useQuery({
    queryKey: ['my-games-history', uid],
    queryFn: () => getMyFinishedMatches(uid, { limit: 100 }),
    enabled: !!uid,
    staleTime: 30_000,
  });
  const { data: gameDayGames = [], isLoading: loadingGd } = useMyGameDayGames();

  // Histórico unificado: torneios + dias de jogo (todos os jogos, sempre).
  const mergedHistory = useMemo(() => {
    const tour = history.map((m) => ({
      key: m.matchId,
      at: m.at,
      title: m.tournamentName,
      to: `/torneios/${m.tournamentId}`,
      partner: m.partner || '',
      opponent: m.opponent,
      myScore: m.myScore,
      oppScore: m.oppScore,
      won: m.won,
      walkover: m.walkover,
      isGameDay: false,
    }));
    const gd = gameDayGames.map((g) => ({
      key: g.id,
      at: g.at,
      title: g.label,
      to: '/dia-de-jogo',
      partner: g.partner || '',
      opponent: g.opponent,
      myScore: g.myScore,
      oppScore: g.oppScore,
      won: g.won,
      walkover: g.walkover,
      isGameDay: true,
    }));
    return [...tour, ...gd].sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  }, [history, gameDayGames]);

  const record = useMemo(() => {
    const wins = mergedHistory.filter((m) => m.won).length;
    return { wins, losses: mergedHistory.length - wins, total: mergedHistory.length };
  }, [mergedHistory]);

  const isUpcoming = tab === 'proximos';
  const loading = isUpcoming ? loadingUp : (loadingHist || loadingGd);

  return (
    <div>
      {mergedHistory.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <V2Badge tone="green">{record.wins} vitória{record.wins === 1 ? '' : 's'}</V2Badge>
          <V2Badge tone="red">{record.losses} derrota{record.losses === 1 ? '' : 's'}</V2Badge>
          <V2Badge tone="neutral">{record.total} jogo{record.total === 1 ? '' : 's'}</V2Badge>
        </div>
      )}

      <div className="mb-4 inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5">
        <button type="button" onClick={() => setTab('proximos')}
          className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            isUpcoming ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink')}>
          <CalendarClock className="h-4 w-4" /> Próximos ({upcoming.length})
        </button>
        <button type="button" onClick={() => setTab('historico')}
          className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            !isUpcoming ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink')}>
          <History className="h-4 w-4" /> Histórico ({mergedHistory.length})
        </button>
      </div>

      {loading ? (
        <V2Skeleton className="h-48 rounded-4xl" />
      ) : isUpcoming ? (
        upcoming.length === 0 ? (
          <V2Surface>
            <V2EmptyState icon={CalendarClock} title="Nenhum jogo agendado"
              description="Quando você tiver jogos marcados nos torneios, eles aparecem aqui."
              action={<V2Button asChild><Link to="/torneios">Ver torneios</Link></V2Button>} />
          </V2Surface>
        ) : (
          <div className="space-y-3">
            {upcoming.map((m) => (
              <V2Surface key={m.matchId} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Trophy className="h-3.5 w-3.5" />
                    <Link to={`/torneios/${m.tournamentId}`} className="hover:underline">{m.tournamentName}</Link>
                  </div>
                  <MatchupLine partner={m.partner} opponent={m.opponent} />
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {formatDateTime(m.scheduledAt)}</span>
                    {m.court && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.court}</span>}
                  </div>
                </div>
                <V2Badge tone="amber">Agendado</V2Badge>
              </V2Surface>
            ))}
          </div>
        )
      ) : mergedHistory.length === 0 ? (
        <V2Surface>
          <V2EmptyState icon={History} title="Sem histórico ainda"
            description="Seus jogos finalizados (torneios e dias de jogo) aparecerão aqui com placar e resultado." />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {postGameOn && <PostGameStrip />}
          {mergedHistory.map((m) => (
            <V2Surface key={m.key} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  {m.isGameDay ? <Dices className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
                  <Link to={m.to} className="hover:underline">{m.title}</Link>
                </div>
                <MatchupLine partner={m.partner} opponent={m.opponent} />
                <div className="mt-1 text-xs text-gray-500">{formatDateTime(m.at)}</div>
              </div>
              <div className="flex items-center gap-3">
                {!m.walkover && (
                  <span className="font-display text-lg font-bold tabular-nums text-ink">{m.myScore} × {m.oppScore}</span>
                )}
                {m.won ? (
                  <V2Badge tone="green"><CheckCircle2 className="mr-1 inline h-3 w-3" />{m.walkover ? 'W.O. a favor' : 'Vitória'}</V2Badge>
                ) : (
                  <V2Badge tone="red"><XCircle className="mr-1 inline h-3 w-3" />{m.walkover ? 'W.O.' : 'Derrota'}</V2Badge>
                )}
              </div>
            </V2Surface>
          ))}
        </div>
      )}
    </div>
  );
}
