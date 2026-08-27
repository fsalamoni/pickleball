/**
 * V2DoublesRanking — Ranking de duplas (flag doubles_ranking).
 *
 * Classifica as parcerias (dois atletas juntos) por vitórias e aproveitamento,
 * a partir dos jogos de duplas finalizados. Rota /ranking/duplas. Aditivo.
 */

import React, { useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Users2, Search } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDoublesRanking } from '@/modules/rating/hooks/useRating';
import {
  V2Avatar, V2EmptyState, V2PageIntro, V2SearchInput, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

export default function V2DoublesRanking() {
  const enabled = useFeatureFlag(FEATURE_FLAG.DOUBLES_RANKING);
  const ratingOn = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const { data: ranking = [], isLoading } = useDoublesRanking(enabled);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ranking;
    return ranking.filter((row) => row.players.some((p) => p.name.toLowerCase().includes(term)));
  }, [ranking, q]);

  if (!enabled) return <Navigate to="/ranking" replace />;

  return (
    <div className="mx-auto max-w-[900px]">
      <V2PageIntro
        title="Ranking de duplas"
        subtitle="Parcerias classificadas por vitórias e aproveitamento nos jogos de duplas."
        action={ratingOn ? (
          <Link to="/ranking" className="text-sm font-semibold text-green-700 underline">Ver ranking individual</Link>
        ) : null}
      />

      <div className="mb-4 max-w-sm">
        <V2SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar atleta na dupla…" icon={Search} />
      </div>

      {isLoading ? (
        <V2Skeleton className="h-64 rounded-4xl" />
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Users2}
            title="Sem duplas ranqueadas ainda"
            description="Assim que houver jogos de duplas finalizados, as parcerias aparecem aqui."
          />
        </V2Surface>
      ) : (
        <V2Surface className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Dupla</th>
                  <th className="px-4 py-3 text-center">J</th>
                  <th className="px-4 py-3 text-center">V</th>
                  <th className="px-4 py-3 text-center">D</th>
                  <th className="px-4 py-3 text-center">Aprov.</th>
                  <th className="px-4 py-3 text-center">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const pos = i + 1;
                  const medal = medalEmoji(pos);
                  return (
                    <tr key={row.pair_key} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-bold text-ink">{medal || pos}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {row.players.map((p) => (
                              <V2Avatar key={p.id} name={p.name} photoUrl={p.photo} size="sm" />
                            ))}
                          </div>
                          <span className="font-semibold text-ink">
                            {row.players.map((p) => p.name).join(' & ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-600">{row.games}</td>
                      <td className="px-4 py-3 text-center tabular-nums font-bold text-green-700">{row.wins}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-500">{row.losses}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{Math.round(row.win_rate * 100)}%</td>
                      <td className={cn('px-4 py-3 text-center tabular-nums', row.points_balance > 0 ? 'text-green-700' : row.points_balance < 0 ? 'text-red-600' : 'text-gray-500')}>
                        {row.points_balance > 0 ? `+${row.points_balance}` : row.points_balance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </V2Surface>
      )}
    </div>
  );
}
