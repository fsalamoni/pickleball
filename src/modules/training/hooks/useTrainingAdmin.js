/** Painel admin → Treino: todos os itens, revisão, denúncias, semente, importação. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAllItems, reviewItem, setItemFeatured, setItemHidden } from '../services/trainingItemService';
import { createReport, deleteReport, listReports, resolveReport } from '../services/reportService';
import { importItems, installSeed, planSeedInstall } from '../services/seedService';
import { trainingKeys } from './trainingKeys';

export function useAllTrainingItems({ enabled = true } = {}) {
  return useQuery({ queryKey: trainingKeys.allItems, queryFn: listAllItems, enabled });
}

export function useTrainingReports({ enabled = true } = {}) {
  return useQuery({ queryKey: trainingKeys.reports, queryFn: listReports, enabled });
}

/** Prévia da instalação da biblioteca inicial (só quando pedida). */
export function useSeedPlan(settings, { enabled = false } = {}) {
  return useQuery({ queryKey: trainingKeys.seedPlan, queryFn: () => planSeedInstall(settings), enabled });
}

export function useTrainingAdminActions(identity, settings) {
  const qc = useQueryClient();
  const invItems = () => qc.invalidateQueries({ queryKey: trainingKeys.items });
  const invAll = () => qc.invalidateQueries({ queryKey: trainingKeys.all });
  return {
    review: useMutation({ mutationFn: ({ item, decision, note }) => reviewItem(item, decision, note, { identity }), onSuccess: invItems }),
    hide: useMutation({ mutationFn: ({ item, hidden, reason }) => setItemHidden(item, hidden, reason, { identity }), onSuccess: invItems }),
    feature: useMutation({ mutationFn: ({ item, featured }) => setItemFeatured(item, featured, { identity }), onSuccess: invItems }),
    resolveReport: useMutation({
      mutationFn: ({ report, status, resolution }) => resolveReport(report, status, resolution, { identity }),
      onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.reports }),
    }),
    deleteReport: useMutation({ mutationFn: (report) => deleteReport(report, { identity }), onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.reports }) }),
    installSeed: useMutation({ mutationFn: (opts = {}) => installSeed({ identity, settings, ...opts }), onSuccess: invAll }),
    importItems: useMutation({
      mutationFn: ({ values, asPlatform, visibility, aiAssisted }) => importItems(values, { identity, settings, asPlatform, visibility, aiAssisted }),
      onSuccess: invItems,
    }),
  };
}

/** Denunciar (qualquer conta). `mutate({ item, reason, text })`. */
export function useReportTrainingItem(identity) {
  return useMutation({ mutationFn: ({ item, reason, text }) => createReport(item, { reason, text }, { identity }) });
}
