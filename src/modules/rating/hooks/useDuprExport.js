/**
 * Hook da exportação de partidas para o DUPR (flag `dupr_match_export`).
 *
 * `useDuprExportData` carrega, sob demanda (só quando a aba está ativa), a base
 * completa de partidas decididas + mapas de referência. Toda a filtragem e a
 * montagem do CSV acontecem no cliente via domínio puro, então NÃO há mutação
 * de dados — o carregamento é uma leitura única, cacheada pelo React Query.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  loadDuprExportData,
  recordDuprExportAudit,
  loadDuprLedger,
  recordDuprLedger,
  updateDuprExportQueue,
} from '../services/duprExportService.js';
import { EXPORT_STATUS } from '../domain/duprReconcile.js';

/**
 * Carrega a base de exportação DUPR (partidas normalizadas + mapas).
 * @param {boolean} enabled  só busca quando `true` (aba aberta + flag on + admin)
 */
export function useDuprExportData(enabled = true) {
  return useQuery({
    queryKey: ['dupr-export-data'],
    queryFn: loadDuprExportData,
    enabled,
    staleTime: 60_000,
  });
}

/** Registra em auditoria uma exportação de CSV feita pelo admin (best-effort). */
export function useRecordDuprExport() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: (summary) => recordDuprExportAudit(
      { uid: user?.uid, email: user?.email, displayName: user?.displayName },
      summary,
    ),
  });
}

/**
 * Carrega o LEDGER de exportação DUPR (situação por partida).
 * @param {boolean} enabled  só busca quando `true` (aba aberta + flag on + admin)
 */
export function useDuprLedger(enabled = true) {
  return useQuery({
    queryKey: ['dupr-export-ledger'],
    queryFn: loadDuprLedger,
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Registra no ledger uma ação sobre partidas (`exported` ao baixar o CSV,
 * `submitted`/`pending`/`excluded` quando o admin muda a situação na tabela).
 * Passe `force: true` nas ações manuais — só elas podem rebaixar a situação.
 * Invalida o cache do ledger.
 */
export function useRecordDuprLedger() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entries, status = EXPORT_STATUS.EXPORTED, ledgerByKey, force = false,
    }) => recordDuprLedger(
      { uid: user?.uid, email: user?.email, displayName: user?.displayName },
      entries,
      { status, ledgerByKey, force },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dupr-export-ledger'] });
    },
  });
}

/**
 * Tira (ou devolve) partidas da LISTA DE EXPORTAÇÃO, sem mexer na situação
 * DUPR delas. Invalida o cache do ledger para a lista se refazer na hora.
 */
export function useUpdateDuprQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entries, removed = true }) => updateDuprExportQueue(
      { uid: user?.uid, email: user?.email, displayName: user?.displayName },
      entries,
      { removed },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dupr-export-ledger'] });
    },
  });
}
