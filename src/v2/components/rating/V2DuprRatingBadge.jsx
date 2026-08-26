import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDuprRatingForUid } from '@/modules/rating/hooks/useDuprRating';
import { cn } from '@/core/lib/utils';

function fmt(rating) {
  const n = Number(rating);
  return Number.isFinite(n) ? n.toFixed(3) : '—';
}

/**
 * Selo "Nível 2.0–8.0" (ranking estilo DUPR) de um atleta. AUTO-GATED: se a flag
 * `skill_rating_dupr` estiver desligada, ou o atleta ainda não tiver rating
 * calculado, retorna null — sem poluir a tela. Leva para a aba do ranking.
 *
 * @param {{ uid: string, className?: string }} props
 */
export default function V2DuprRatingBadge({ uid, className }) {
  const on = useFeatureFlag(FEATURE_FLAG.SKILL_RATING_DUPR);
  const { data } = useDuprRatingForUid(uid, on);

  if (!on || !uid || !data) return null;
  const dGames = data.doubles_games || 0;
  const sGames = data.singles_games || 0;
  if (dGames === 0 && sGames === 0) return null;

  const parts = [];
  if (dGames > 0) parts.push(`D ${fmt(data.doubles_rating)}`);
  if (sGames > 0) parts.push(`S ${fmt(data.singles_rating)}`);

  return (
    <Link
      to="/ranking?tab=dupr"
      title="Ranking estilo DUPR (escala 2.0–8.0)"
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl border border-acid/40 bg-acid/15 px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-95',
        className,
      )}
    >
      <Sparkles className="h-4 w-4 text-acid" />
      Nível 2.0–8.0 · {parts.join(' · ')}
    </Link>
  );
}
