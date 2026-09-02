/**
 * useSyncProgressionV2 — sincroniza stats V1 → doc materializado V2.
 *
 * Roda em background: ao montar, lê o doc V2 e, se estiver desatualizado ou
 * ausente, recalcula do V1 e grava.
 *
 * Garante que `useUserProgressionV2` sempre tem dados frescos sem o caller
 * precisar orquestrar.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserProgressionV2 } from './useUserProgressionV2';
import { setUserProgressionV2 } from '@/modules/progression/services/progressionV2Service';
import { makeEmptyProgressionV2 } from '@/modules/progression/domain/progressionV2Schema';
import { computeXpV2, levelFromXpV2, XP_WEIGHTS_V2 } from '@/modules/progression/domain/progressionV2';
import { tierFromXp } from '@/modules/progression/domain/tiers';
import { buildSkillTrees } from '@/modules/progression/domain/skillTrees';

const PROGRESSION_V2_KEY = (uid) => ['user-progression-v2', uid];

export function useSyncProgressionV2(uid, stats, enabled = true) {
  const qc = useQueryClient();
  const { progression } = useUserProgressionV2(uid, enabled);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!uid || !enabled) return;
    if (syncedRef.current) return;
    if (!stats) return; // sem stats ainda
    // recálculo é assíncrono; não bloqueia a UI
    (async () => {
      try {
        const xpBySource = {
          tournament_attended: stats.tournaments || 0,
          tournament_podium: stats.podiums || 0,
          tournament_title: stats.titles || 0,
          game_played: stats.played || 0,
          game_won: stats.wins || 0,
        };
        const { xpTotal } = computeXpV2(xpBySource);
        const levelInfo = levelFromXpV2(xpTotal);
        const tier = tierFromXp(xpTotal);
        const { trees } = buildSkillTrees(xpBySource, XP_WEIGHTS_V2);
        const now = Date.now();
        // se já tem doc e tá atualizado, não sobrescreve
        if (progression && progression.xpTotal === xpTotal) {
          syncedRef.current = true;
          return;
        }
        const next = progression
          ? {
            ...progression,
            xpTotal,
            level: levelInfo.level,
            tier: tier.name,
            skillTrees: trees,
            source: 'recomputed',
            updatedAt: now,
          }
          : {
            ...makeEmptyProgressionV2(uid),
            xpTotal,
            level: levelInfo.level,
            tier: tier.name,
            skillTrees: trees,
            source: 'seed',
            updatedAt: now,
            createdAt: now,
          };
        await setUserProgressionV2(uid, next);
        qc.setQueryData(PROGRESSION_V2_KEY(uid), next);
        syncedRef.current = true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[useSyncProgressionV2] falha ao sincronizar', err);
      }
    })();
  }, [uid, stats, enabled, progression, qc]);

  return { progression };
}
