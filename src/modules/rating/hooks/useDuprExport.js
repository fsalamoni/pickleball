/**
 * Hook da exportação de partidas para o DUPR (flag `dupr_match_export`).
 *
 * `useDuprExportData` carrega, sob demanda (só quando a aba está ativa), a base
 * completa de partidas decididas + mapas de referência. Toda a filtragem e a
 * montagem do CSV acontecem no cliente via domínio puro, então NÃO há mutação
 * de dados — o carregamento é uma leitura única, cacheada pelo React Query.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { loadDuprExportData, recordDuprExportAudit } from '../services/duprExportService.js';

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
