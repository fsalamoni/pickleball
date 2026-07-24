/**
 * V2MyGames — Agenda "Meus jogos" (flag athlete_agenda).
 *
 * Reúne os próximos jogos agendados do atleta e o histórico de partidas
 * finalizadas (com placar e resultado), com filtro por aba. Rota /meus-jogos.
 * Aditivo — desligada a flag, a rota redireciona para o painel.
 */

import React, { useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Trophy, MapPin, History, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { getMyUpcomingMatches, getMyFinishedMatches } from '@/modules/tournament/services/upcomingService';
import {
  V2Badge, V2Button, V2EmptyState, V2PageIntro, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function formatDateTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function V2MyGames() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ATHLETE_AGENDA);
  const { user } = useAuth();
  const uid = user?.uid;
  const [tab, setTab] = useState('proximos');

  const { data: upcoming = [], isLoading: loadingUp } = useQuery({
    queryKey: ['my-games-upcoming', uid],
    queryFn: () => getMyUpcomingMatches(uid, { limit: 50 }),
    enabled: enabled && !!uid,
    staleTime: 30_000,
  });
  const { data: history = [], isLoading: loadingHist } = useQuery({
    queryKey: ['my-games-history', uid],
    queryFn: () => getMyFinishedMatches(uid, { limit: 100 }),
    enabled: enabled && !!uid,
    staleTime: 30_000,
  });

  const record = useMemo(() => {
    const wins = history.filter((m) => m.won).length;
    return { wins, losses: history.length - wins, total: history.length };
  }, [history]);

  if (!enabled) return <Navigate to="/inicio" replace />;

  const isUpcoming = tab === 'proximos';
  const loading = isUpcoming ? loadingUp : loadingHist;

  return (
    <div className="mx-auto max-w-[820px]">
      <V2PageIntro title="Meus jogos" subtitle="Seus próximos jogos e o histórico de partidas nos torneios." />

      {history.length > 0 && (
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
          <History className="h-4 w-4" /> Histórico ({history.length})
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
                  <div className="mt-1 font-bold text-ink">vs {m.opponent}</div>
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
      ) : history.length === 0 ? (
        <V2Surface>
          <V2EmptyState icon={History} title="Sem histórico ainda"
            description="Seus jogos finalizados aparecerão aqui com placar e resultado." />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {history.map((m) => (
            <V2Surface key={m.matchId} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Trophy className="h-3.5 w-3.5" />
                  <Link to={`/torneios/${m.tournamentId}`} className="hover:underline">{m.tournamentName}</Link>
                </div>
                <div className="mt-1 font-bold text-ink">vs {m.opponent}</div>
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
