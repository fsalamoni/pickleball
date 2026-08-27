import React from 'react';
import { useDuprRatingHistory } from '@/modules/rating/hooks/useDuprRating';
import RatingSparkline from '@/modules/rating/components/RatingSparkline';

/**
 * Evolução do "Nível 2.0–8.0" (ranking estilo DUPR) de um atleta — mesmo formato
 * da "Evolução do rating" (RatingSparkline), separada por Duplas e Simples. A
 * curva é a trajetória do rating APÓS cada jogo (aparece já no 1º recálculo).
 * AUTO-GATED: some se a flag estiver off ou não houver ≥2 jogos no formato.
 *
 * @param {{ uid: string }} props
 */
export default function V2DuprEvolution({ uid }) {
  const { data: history } = useDuprRatingHistory(uid, true);

  if (!uid) return null;

  const doublesPoints = (history?.doubles || []).filter((p) => Number.isFinite(p?.rating));
  const singlesPoints = (history?.singles || []).filter((p) => Number.isFinite(p?.rating));

  if (doublesPoints.length < 2 && singlesPoints.length < 2) return null;

  return (
    <>
      {doublesPoints.length >= 2 && (
        <div className="mt-8">
          <RatingSparkline points={doublesPoints} title="Evolução do Nível 2.0–8.0 · Duplas" />
        </div>
      )}
      {singlesPoints.length >= 2 && (
        <div className="mt-8">
          <RatingSparkline points={singlesPoints} title="Evolução do Nível 2.0–8.0 · Simples" />
        </div>
      )}
    </>
  );
}
