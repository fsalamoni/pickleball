import React from 'react';
import { Sparkles, Trophy, Calendar } from 'lucide-react';
import { useUserCurrentSeason, useSeasonTop } from '@/modules/progression/hooks/useUserSeasonRanking';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { MONTHLY_SEASON_PRIZES } from '@/modules/progression/domain/seasons';

/**
 * SeasonBanner — banner da season atual.
 * Mostra:
 *  - Mês da temporada corrente (ex.: "setembro de 2026")
 *  - Sua posição se estiver no top
 *  - Prêmios disponíveis
 *
 * Aparece no topo de /gamification (e futuramente em outras páginas).
 * Gated por GAMIFICATION_V2.
 */
export default function SeasonBanner({ className }) {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  const { user } = useAuth();
  const { season, seasonId } = useUserCurrentSeason(user?.uid, gamificationOn && !!user);
  const { data: top = [] } = useSeasonTop({ seasonId, limit: 3, enabled: gamificationOn });

  if (!gamificationOn) return null;
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div
      data-testid="season-banner"
      className={`flex flex-wrap items-center gap-3 rounded-3xl border border-purple-200 bg-gradient-to-r from-purple-50 to-amber-50 p-4 ${className || ''}`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-purple-200 text-purple-800">
        <Trophy className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-purple-700">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Temporada
        </p>
        <p className="mt-0.5 text-sm font-bold text-ink capitalize">{currentMonth}</p>
        {season && (
          <p className="mt-0.5 text-xs text-gray-600">
            Você está em #{season.position} · {season.xp.toLocaleString('pt-BR')} XP
            {season.prizeXp > 0 && ` · +${season.prizeXp} XP prêmio`}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          <Calendar className="h-3 w-3" aria-hidden="true" /> Top 3
        </p>
        {top.slice(0, 3).map((t) => (
          <p key={t.uid} className="text-xs text-gray-700">
            #{t.position} · {t.tier}
          </p>
        ))}
        {top.length === 0 && (
          <p className="text-xs text-gray-500">Ranking ainda em formação</p>
        )}
      </div>

      <div className="w-full border-t border-purple-100 pt-2 text-[10px] text-gray-500">
        Prêmios: {Object.values(MONTHLY_SEASON_PRIZES).slice(0, 3).map((p) => p.label).join(' · ')}
      </div>
    </div>
  );
}
