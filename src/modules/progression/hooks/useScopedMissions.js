/**
 * useScopedMissions — as missões de UM escopo (dia, semana ou mês).
 *
 * Cria o documento do período se não existir e o mantém sincronizado com a
 * ATIVIDADE REAL (partidas, torneios, kudos, reservas, aulas, avaliações...).
 * A UI nunca informa progresso: antes havia um botão "+1" que o próprio usuário
 * clicava, o que permitia concluir "Jogue 3 partidas" sem entrar em quadra.
 *
 * O período vira sozinho: a chave de cache inclui a chave do escopo (dia,
 * segunda-feira, dia 1), então na virada da meia-noite, da segunda ou do mês o
 * hook busca o documento novo em vez de servir o de ontem.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrCreateScopedMissions, syncScopedProgress, claimScopedBonus,
} from '@/modules/progression/services/missionService';
import { computeMissionMetrics } from '@/modules/progression/domain/missionMetrics';
import { scopeKey } from '@/modules/progression/domain/missionDay';
import { logger } from '@/core/lib/logger';

export const SCOPED_MISSIONS_KEY = (uid, scope, key) => ['user-missions', scope, uid, key];

/**
 * @param {string} uid
 * @param {'daily'|'weekly'|'monthly'} scope
 * @param {{ tier?: string, enabled?: boolean, activity?: object, modules?: object|null }} [opts]
 */
export function useScopedMissions(uid, scope, { tier = 'Calouro', enabled = true, activity = {}, modules = null } = {}) {
  const qc = useQueryClient();
  const key = scopeKey(scope);

  const query = useQuery({
    queryKey: SCOPED_MISSIONS_KEY(uid, scope, key),
    queryFn: () => getOrCreateScopedMissions(uid, scope, tier, new Date(), { modules }),
    enabled: !!uid && enabled,
    staleTime: 30_000,
  });

  const metricas = useMemo(
    () => computeMissionMetrics(activity, { scope }),
    [activity, scope],
  );

  const ultimaSync = useRef('');
  const temDoc = !!query.data;
  useEffect(() => {
    if (!uid || !enabled || !temDoc) return;
    const assinatura = `${key}|${JSON.stringify(metricas)}`;
    if (ultimaSync.current === assinatura) return;
    ultimaSync.current = assinatura;
    (async () => {
      try {
        const atualizado = await syncScopedProgress(uid, scope, metricas, new Date());
        if (atualizado) qc.setQueryData(SCOPED_MISSIONS_KEY(uid, scope, key), atualizado);
      } catch (err) {
        // Reabre para nova tentativa: uma falha de rede não congela o progresso.
        ultimaSync.current = '';
        logger.warn(`[useScopedMissions] falha ao sincronizar (${scope})`, err);
      }
    })();
  }, [uid, enabled, temDoc, metricas, key, scope, qc]);

  const claim = useMutation({
    mutationFn: () => claimScopedBonus(uid, scope, new Date()),
    onSuccess: (atualizado) => {
      if (atualizado) qc.setQueryData(SCOPED_MISSIONS_KEY(uid, scope, key), atualizado);
      // o bônus entra no XP total
      qc.invalidateQueries({ queryKey: ['user-missions-history', uid] });
    },
  });

  return {
    scope,
    key,
    missions: query.data?.missions || [],
    doc: query.data || null,
    metrics: metricas,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    claimBonus: claim.mutate,
    isClaiming: claim.isPending,
    claimError: claim.error,
  };
}
