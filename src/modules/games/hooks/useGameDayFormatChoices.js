/**
 * useGameDayFormatChoices — os formatos de dia de jogo que ESTA tela oferece.
 *
 * Lê as três flags de formato opcional (Americano aprimorado, Mexicano, Rei
 * da Quadra) num lugar só e devolve a lista de `gameDayFormatChoices`. Toda
 * tela que deixa escolher formato passa por aqui — criação, troca de formato,
 * sorteio de grade, jogo aberto, data de clube —, e um guarda de fonte
 * (`diaDeJogoUniforme.test.js`) reprova quem montar a lista à mão.
 *
 * `current` é o formato que o dia JÁ TEM: ele entra sempre, mesmo com a flag
 * desligada (desligar tira a opção de escolher, nunca a de manter).
 */

import { useMemo } from 'react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { gameDayFormatChoices } from '@/modules/clubs/domain/gameDayFormats';

/**
 * @param {{ current?: string|null, scope?: 'all'|'draw' }} [opts]
 * @returns {string[]}
 */
export function useGameDayFormatChoices({ current = null, scope = 'all' } = {}) {
  const americanoLive = useFeatureFlag(FEATURE_FLAG.GAMEDAY_AMERICANO_LIVE);
  const mexicano = useFeatureFlag(FEATURE_FLAG.GAMEDAY_MEXICANO);
  const kingOfCourt = useFeatureFlag(FEATURE_FLAG.GAMEDAY_KING_OF_COURT);
  return useMemo(
    () => gameDayFormatChoices({ current, scope, flags: { americanoLive, mexicano, kingOfCourt } }),
    [current, scope, americanoLive, mexicano, kingOfCourt],
  );
}
