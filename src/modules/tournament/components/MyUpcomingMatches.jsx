import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, MapPin, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { getMyUpcomingMatches } from '../services/upcomingService.js';

function formatWhen(ms) {
  const d = new Date(ms);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Seção "Meus próximos jogos" no painel inicial. Fechada pela flag
 * `tournament_ux`. Renderiza `null` quando não há jogos agendados futuros.
 */
export default function MyUpcomingMatches() {
  const enabled = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_UX);
  const { user } = useAuth();
  const { data: matches = [] } = useQuery({
    queryKey: ['my-upcoming-matches', user?.uid],
    queryFn: () => getMyUpcomingMatches(user.uid),
    enabled: !!user?.uid && enabled,
    staleTime: 60_000,
  });

  if (!enabled || matches.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/75">Sua agenda</div>
        <h3 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <CalendarClock className="h-5 w-5 text-emerald-700" /> Meus próximos jogos
        </h3>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {matches.map((m) => (
          <Link key={m.matchId} to={`/torneios/${m.tournamentId}/jogos`} className="block h-full">
            <Card className="match-surface h-full rounded-[1.5rem] border-white/80 bg-white/85 transition-transform hover:-translate-y-0.5">
              <CardContent className="flex h-full flex-col p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700/75">{m.tournamentName}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">vs {m.opponent}</div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {formatWhen(m.scheduledAt)}</span>
                  {m.court && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.court}</span>}
                </div>
                <div className="mt-auto flex items-center justify-end pt-3 text-emerald-800">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
