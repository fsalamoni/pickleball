import React from 'react';
import { Sparkles } from 'lucide-react';
import { useDuprRatingForUid } from '@/modules/rating/hooks/useDuprRating';
import { cn } from '@/core/lib/utils';

function fmt(rating) {
  const n = Number(rating);
  return Number.isFinite(n) ? n.toFixed(3) : '—';
}

/**
 * Selo "Nível 2.0–8.0" (ranking estilo DUPR) de um atleta — apenas EXIBE o
 * nível (não é link). AUTO-GATED: some se a flag `skill_rating_dupr` estiver
 * off, ou se o atleta ainda não tiver rating calculado.
 *
 * @param {{ uid: string, className?: string }} props
 */
export default function V2DuprRatingBadge({ uid, className }) {
  const { data } = useDuprRatingForUid(uid, true);

  if (!uid || !data) return null;
  const dGames = data.doubles_games || 0;
  const sGames = data.singles_games || 0;
  if (dGames === 0 && sGames === 0) return null;

  const parts = [];
  if (dGames > 0) parts.push(`D ${fmt(data.doubles_rating)}`);
  if (sGames > 0) parts.push(`S ${fmt(data.singles_rating)}`);

  return (
    <span
      title="Nível de habilidade (escala 2.0–8.0)"
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl border border-acid/40 bg-acid/15 px-4 py-2 text-sm font-semibold text-ink',
        className,
      )}
    >
      <Sparkles className="h-4 w-4 text-acid" />
      Nível 2.0–8.0 · {parts.join(' · ')}
    </span>
  );
}
