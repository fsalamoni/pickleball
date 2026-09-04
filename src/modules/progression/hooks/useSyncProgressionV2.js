/**
 * useSyncProgressionV2 — mantém `user_progression_v2/{uid}` em dia.
 *
 * Recalcula do zero e grava quando o resultado muda. Como todo o XP é
 * DERIVADO (atividade + conquistas registradas + missões concluídas), o
 * recálculo é idempotente: rodar duas vezes dá o mesmo número.
 *
 * Também sincroniza as conquistas: `achievementsUnlocked` no snapshot é o que
 * o Hall da Fama exibe, e ficava eternamente em 0.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserProgressionV2 } from './useUserProgressionV2';
import { setUserProgressionV2 } from '@/modules/progression/services/progressionV2Service';
import { listUserMissions } from '@/modules/progression/services/missionService';
import { makeEmptyProgressionV2 } from '@/modules/progression/domain/progressionV2Schema';
import { levelFromXpV2, XP_WEIGHTS_V2 } from '@/modules/progression/domain/progressionV2';
import { computeTotalXpV2 } from '@/modules/progression/domain/xpTotal';
import { tierFromXp } from '@/modules/progression/domain/tiers';
import { buildSkillTrees, toSkillTreeSnapshots } from '@/modules/progression/domain/skillTrees';
import { ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2';
import { logger } from '@/core/lib/logger';

const PROGRESSION_V2_KEY = (uid) => ['user-progression-v2', uid];
const MISSION_HISTORY_KEY = (uid) => ['user-missions-history', uid];

/** Quantos dias de missão entram na conta do XP. */
const DIAS_DE_MISSAO = 120;

/**
 * @param {string} uid
 * @param {object} stats saída de `usePlayerStats`
 * @param {boolean} enabled
 * @param {Set<string>|Iterable<string>} [unlockedAchievementIds] ids já
 *        registrados em `user_achievements_v2`
 */
export function useSyncProgressionV2(uid, stats, enabled = true, unlockedAchievementIds = null) {
  const qc = useQueryClient();
  const { progression } = useUserProgressionV2(uid, enabled);
  const ultimoGravado = useRef('');

  // Histórico de missões: entra na soma de XP. Consulta limitada e com cache
  // longo — é histórico, não muda a toda hora.
  const { data: missionDocs = [] } = useQuery({
    queryKey: MISSION_HISTORY_KEY(uid),
    queryFn: () => listUserMissions(uid, DIAS_DE_MISSAO),
    enabled: !!uid && enabled,
    staleTime: 5 * 60_000,
  });

  const calculado = useMemo(() => {
    if (!stats) return null;
    const statsSources = {
      tournament_attended: stats.tournaments || 0,
      tournament_podium: stats.podiums || 0,
      tournament_title: stats.titles || 0,
      game_played: stats.played || 0,
      game_won: stats.wins || 0,
    };
    const { xpTotal, breakdown } = computeTotalXpV2({
      statsSources,
      unlockedAchievementIds,
      missionDocs,
    });
    const { trees } = buildSkillTrees(statsSources, XP_WEIGHTS_V2);
    return {
      xpTotal,
      breakdown,
      level: levelFromXpV2(xpTotal).level,
      tier: tierFromXp(xpTotal).name,
      skillTrees: toSkillTreeSnapshots(trees),
      achievementsUnlocked: unlockedAchievementIds
        ? [...new Set(unlockedAchievementIds)].length
        : (progression?.achievementsUnlocked || 0),
    };
  }, [stats, unlockedAchievementIds, missionDocs, progression?.achievementsUnlocked]);

  useEffect(() => {
    if (!uid || !enabled || !calculado) return;

    // Grava só quando o resultado muda de fato. A assinatura evita reescrever
    // o mesmo documento a cada render (e a cada centavo de escrita).
    const assinatura = [
      uid, calculado.xpTotal, calculado.level, calculado.tier,
      calculado.achievementsUnlocked,
    ].join('|');
    if (ultimoGravado.current === assinatura) return;

    const semMudanca = progression
      && progression.xpTotal === calculado.xpTotal
      && progression.level === calculado.level
      && progression.tier === calculado.tier
      && progression.achievementsUnlocked === calculado.achievementsUnlocked;
    if (semMudanca) {
      ultimoGravado.current = assinatura;
      return;
    }

    ultimoGravado.current = assinatura;
    (async () => {
      try {
        const now = Date.now();
        const base = progression || makeEmptyProgressionV2(uid);
        const next = {
          ...base,
          uid,
          xpTotal: calculado.xpTotal,
          level: calculado.level,
          tier: calculado.tier,
          skillTrees: calculado.skillTrees,
          achievementsUnlocked: calculado.achievementsUnlocked,
          achievementsTotal: ACHIEVEMENTS_V2.length,
          source: progression ? 'recomputed' : 'seed',
          updatedAt: now,
          createdAt: base.createdAt || now,
        };
        await setUserProgressionV2(uid, next);
        qc.setQueryData(PROGRESSION_V2_KEY(uid), next);
      } catch (err) {
        // Reabre para nova tentativa: uma falha de rede não pode congelar a
        // progressão do atleta até ele recarregar a página.
        ultimoGravado.current = '';
        logger.warn('[useSyncProgressionV2] falha ao sincronizar', err);
      }
    })();
  }, [uid, enabled, calculado, progression, qc]);

  return { progression, breakdown: calculado?.breakdown || null };
}
