/**
 * Hooks dos relatórios do mercado (flag arena_market_reports).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listSavedReports, saveReportSnapshot, saveReportEdits, deleteSavedReport,
} from '../services/marketReportService.js';

const key = (arenaId) => ['market-reports', arenaId];

/** Snapshots salvos (fechados/editados) da arena. */
export function useSavedReports(arenaId) {
  return useQuery({
    queryKey: key(arenaId),
    queryFn: () => listSavedReports(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

/** Fecha/regera o snapshot de um período a partir do relatório automático. */
export function useSaveReportSnapshot(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (report) => saveReportSnapshot(arenaId, report, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(arenaId) }),
  });
}

/** Salva edições manuais das linhas do snapshot. */
export function useSaveReportEdits(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lines, note }) => saveReportEdits(arenaId, id, lines, user, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(arenaId) }),
  });
}

/** Exclui um snapshot salvo. */
export function useDeleteSavedReport(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteSavedReport(arenaId, id, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(arenaId) }),
  });
}
