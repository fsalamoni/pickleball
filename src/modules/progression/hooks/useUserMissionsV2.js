/**
 * useUserMissionsV2 — missões diárias do atleta.
 *
 * Cria o documento do dia se não existir e mantém o progresso sincronizado
 * com a ATIVIDADE REAL (partidas, torneios, kudos, indicações). A UI não
 * informa progresso: antes havia um botão "+1" que o próprio usuário clicava,
 * o que permitia concluir "Jogue 3 partidas" sem entrar em quadra.
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import {
  getOrCreateDailyMissions,
  syncMissionProgress,
  claimDailyBonus,
  watchDailyMissions,
  getMissionsForDate,
} from '@/modules/progression/services/missionService';
import { computeMissionMetrics } from '@/modules/progression/domain/missionMetrics';
import { missionDateKey } from '@/modules/progression/domain/missionDay';
import { logger } from '@/core/lib/logger';

// A chave inclui o dia: sem isso, na virada da meia-noite o cache continuava
// servindo as missões de ontem.
const KEY = (uid, dia) => ['user-missions-daily', uid, dia];

/**
 * @param {string} uid
 * @param {string} currentTierName tier atual (define o pool de missões)
 * @param {boolean} enabled
 * @param {{
 *   matchDates?: Array<number|Date>,
 *   gameDayDates?: Array<number|Date>,
 *   tournamentDates?: Array<number|Date>,
 *   kudoIndex?: object|null,
 *   referralCode?: object|null,
 * }} [activity] fontes de atividade real do atleta
 */
export function useUserMissionsV2(uid, currentTierName = 'Calouro', enabled = true, activity = {}) {
  const qc = useQueryClient();
  const dia = missionDateKey();

  const query = useQuery({
    queryKey: KEY(uid, dia),
    queryFn: async () => {
      if (!uid) return null;
      const existing = await getMissionsForDate(uid, new Date());
      if (existing) return existing;
      return getOrCreateDailyMissions(uid, currentTierName, new Date());
    },
    enabled: !!uid && enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const unsub = watchDailyMissions(uid, (data) => {
      if (data) qc.setQueryData(KEY(uid, dia), data);
    });
    return unsub;
  }, [uid, enabled, qc, dia]);

  const {
    matchDates, gameDayDates, tournamentDates, kudoIndex, referralCode,
  } = activity;

  const metricas = useMemo(
    () => computeMissionMetrics(
      { matchDates, gameDayDates, tournamentDates, kudoIndex, referralCode },
      { scope: 'daily' },
    ),
    [matchDates, gameDayDates, tournamentDates, kudoIndex, referralCode],
  );

  // Sincroniza o progresso real assim que o documento do dia existe e sempre
  // que os contadores mudam. `syncMissionProgress` não grava se nada mudou.
  const ultimaSync = useRef('');
  const temDoc = !!query.data;
  useEffect(() => {
    if (!uid || !enabled || !temDoc) return;
    const assinatura = `${dia}|${JSON.stringify(metricas)}`;
    if (ultimaSync.current === assinatura) return;
    ultimaSync.current = assinatura;
    (async () => {
      try {
        const atualizado = await syncMissionProgress(uid, metricas, new Date());
        if (atualizado) qc.setQueryData(KEY(uid, dia), atualizado);
      } catch (err) {
        logger.warn('[useUserMissionsV2] falha ao sincronizar progresso', err);
      }
    })();
  }, [uid, enabled, temDoc, metricas, dia, qc]);

  const claimMut = useMutation({
    mutationFn: async () => {
      const updated = await claimDailyBonus(uid, new Date());
      qc.setQueryData(KEY(uid, dia), updated);
      return updated;
    },
  });

  return {
    missions: query.data?.missions || [],
    doc: query.data || null,
    metrics: metricas,
    isLoading: query.isLoading,
    error: query.error,
    claimBonus: claimMut.mutate,
    isClaiming: claimMut.isPending,
  };
}
