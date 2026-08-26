import React from 'react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDuprRatingForUid, useDuprRatingHistory } from '@/modules/rating/hooks/useDuprRating';
import RatingSparkline from '@/modules/rating/components/RatingSparkline';

/**
 * Evolução do "Nível 2.0–8.0" (ranking estilo DUPR) de um atleta — mesmo formato
 * da "Evolução do rating" (RatingSparkline), separado por Duplas e Simples.
 * AUTO-GATED: some se a flag estiver off ou não houver histórico suficiente.
 *
 * @param {{ uid: string }} props
 */
export default function V2DuprEvolution({ uid }) {
  const on = useFeatureFlag(FEATURE_FLAG.SKILL_RATING_DUPR);
  const { data: history = [] } = useDuprRatingHistory(uid, on);
  const { data: current } = useDuprRatingForUid(uid, on);

  if (!on || !uid) return null;

  const doublesPoints = (history || []).map((p) => ({ at: p.at, rating: p.doubles }));
  const singlesPoints = (history || []).map((p) => ({ at: p.at, rating: p.singles }));

  const showDoubles = (current?.doubles_games || 0) > 0
    && doublesPoints.filter((p) => Number.isFinite(p.rating)).length >= 2;
  const showSingles = (current?.singles_games || 0) > 0
    && singlesPoints.filter((p) => Number.isFinite(p.rating)).length >= 2;

  if (!showDoubles && !showSingles) return null;

  return (
    <>
      {showDoubles && (
        <div className="mt-8">
          <RatingSparkline points={doublesPoints} title="Evolução do Nível 2.0–8.0 · Duplas" />
        </div>
      )}
      {showSingles && (
        <div className="mt-8">
          <RatingSparkline points={singlesPoints} title="Evolução do Nível 2.0–8.0 · Simples" />
        </div>
      )}
    </>
  );
}
