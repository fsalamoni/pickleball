import { useMemo } from 'react';
import { useAllTrainingItems, useTrainingReports } from '@/modules/training/hooks/useTrainingAdmin';
import { useAdminFlags, useReportedLetters } from '@/modules/progression/hooks/useGamificationAdmin';
import { useRankingWorkerStatus } from '@/modules/rating/hooks/useRating';
import { describeRankingWorker } from '@/modules/rating/domain/rankingWorkerStatus';
import { isPendingReview } from '@/v2/components/admin/training/adminTrainingView';
import { buildInbox, inboxBadges, inboxTotals } from '@/modules/admin/domain/adminInbox';
import { useAllPlatformUsers } from '@/modules/admin/hooks/usePlatformUsers';
import { expiredSuspensions } from '@/modules/admin/domain/accountStatus';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAdminStores } from '@/modules/marketplace/hooks/useMarket';

/** Uma fonte só vale quando a consulta respondeu; carregando ou falha = desconhecida. */
const fonte = (ok, count) => (ok ? { ok: true, count } : { ok: false });

/**
 * "Precisa de você": junta as filas que já existem (treino, gamificação,
 * ranking) sem consulta nova — as mesmas chaves do React Query das telas de cada
 * fila, então abrir a fila depois não busca de novo.
 */
export function useAdminInbox(enabled = true) {
  const itens = useAllTrainingItems({ enabled });
  const denuncias = useTrainingReports({ enabled });
  const sinais = useAdminFlags(enabled);
  const cartas = useReportedLetters(enabled);
  const ranking = useRankingWorkerStatus(enabled);
  const usuarios = useAllPlatformUsers({ enabled });
  const mercadoOn = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  const lojas = useAdminStores({ enabled: enabled && mercadoOn });

  const lista = useMemo(() => buildInbox({
    revisao: fonte(itens.isSuccess, (itens.data || []).filter(isPendingReview).length),
    denuncias: fonte(denuncias.isSuccess, (denuncias.data || []).filter((r) => r.status === 'aberta').length),
    sinais: fonte(!sinais.isLoading && !sinais.isError, sinais.flags.filter((f) => f.status === 'open').length),
    cartas: fonte(!cartas.isLoading && !cartas.isError, cartas.letters.length),
    ranking: fonte(ranking.isSuccess, describeRankingWorker(ranking.data).erro ? 1 : 0),
    suspensoes: fonte(usuarios.isSuccess, expiredSuspensions(usuarios.data || []).length),
    ...(mercadoOn ? { lojas: fonte(lojas.isSuccess, (lojas.data || []).filter((s) => s.status === 'pending').length) } : {}),
  }), [usuarios.isSuccess, usuarios.data, itens.isSuccess, itens.data, denuncias.isSuccess, denuncias.data, sinais.isLoading, sinais.isError, sinais.flags,
    cartas.isLoading, cartas.isError, cartas.letters, ranking.isSuccess, ranking.data, mercadoOn, lojas.isSuccess, lojas.data]);

  return { itens: lista, badges: inboxBadges(lista), ...inboxTotals(lista) };
}
