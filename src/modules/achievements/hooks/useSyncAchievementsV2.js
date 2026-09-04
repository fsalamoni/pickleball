/**
 * useSyncAchievementsV2 — persiste as conquistas que o atleta já ganhou.
 *
 * Por que existe: as conquistas eram CALCULADAS a cada render
 * (`computeAchievementsV2`) e nada nunca gravava em `user_achievements_v2`.
 * Consequências: o perfil público mostrava 0 conquistas para todo mundo, o
 * Hall da Fama mostrava 0, o toast de desbloqueio nunca podia disparar e a
 * data de conquista não existia — reconquistar era indistinguível de manter.
 *
 * Aqui o cálculo vira registro: toda conquista avaliada como ganha e que
 * ainda não tem documento é gravada uma única vez (o service é idempotente).
 *
 * A gravação é do PRÓPRIO usuário (as regras exigem `uid == request.auth.uid`),
 * então roda no cliente do dono — nunca ao visitar o perfil de outra pessoa.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { unlockAchievementV2 } from '@/modules/achievements/services/achievementsV2Service';
import { logger } from '@/core/lib/logger';

/** Trava de segurança: no máximo N gravações por passada. */
const MAX_POR_RODADA = 25;

/**
 * @param {string} uid dono da sessão
 * @param {Array<{id: string, family: string, rarity: string}>} earned conquistas
 *        avaliadas como ganhas (saída de `computeAchievementsV2().unlocked`)
 * @param {Set<string>} persistedIds ids já gravados (de `useUserAchievementsV2`)
 * @param {boolean} enabled
 */
export function useSyncAchievementsV2(uid, earned, persistedIds, enabled = true) {
  const qc = useQueryClient();
  const emVoo = useRef(false);

  useEffect(() => {
    if (!uid || !enabled) return;
    if (!Array.isArray(earned) || earned.length === 0) return;
    if (!persistedIds) return;
    if (emVoo.current) return;

    const faltando = earned.filter((a) => a?.id && !persistedIds.has(a.id));
    if (faltando.length === 0) return;

    emVoo.current = true;
    (async () => {
      try {
        // Sequencial de propósito: são escritas raras (só na primeira vez que
        // a conquista é ganha) e em rajada elas competiriam entre si.
        for (const a of faltando.slice(0, MAX_POR_RODADA)) {
          await unlockAchievementV2(uid, a.id, a.family, a.rarity);
        }
        qc.invalidateQueries({ queryKey: ['user-achievements-v2', uid] });
      } catch (err) {
        logger.warn('[useSyncAchievementsV2] falha ao registrar conquista', err);
      } finally {
        emVoo.current = false;
      }
    })();
  }, [uid, enabled, earned, persistedIds, qc]);
}
