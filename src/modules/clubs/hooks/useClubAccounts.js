/**
 * CONTAS DO CLUBE-ASSOCIAÇÃO (Bloco D1) — ganchos do React Query. As chaves
 * moram sob `assocKeys.all(clubId)`, então toda ação da associação e toda ação
 * das contas invalidam a árvore do clube inteira. Fonte que falha é `isError`:
 * a tela nunca afirma "sem lançamentos" sem a consulta ter dado certo.
 */
import { useQuery } from '@tanstack/react-query';
import { assocKeys } from './useClubAssociation.js';
import {
  listClubAccountReports, listClubBudgets, listClubLedger, listClubPublicAccountReports, listClubPublicBudgets,
} from '../services/clubAccountsService.js';

export const clubAccKeys = {
  budgets: (clubId) => [...assocKeys.all(clubId), 'contas', 'orcamentos'],
  ledger: (clubId) => [...assocKeys.all(clubId), 'contas', 'lancamentos'],
  reports: (clubId) => [...assocKeys.all(clubId), 'contas', 'prestacoes'],
  publicBudgets: (clubId) => [...assocKeys.all(clubId), 'contas', 'orcamentos', 'publicos'],
  publicReports: (clubId) => [...assocKeys.all(clubId), 'contas', 'prestacoes', 'publicas'],
};

export function useClubBudgets(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubAccKeys.budgets(clubId), queryFn: () => listClubBudgets(clubId), enabled: !!clubId && enabled });
}
export function useClubLedger(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubAccKeys.ledger(clubId), queryFn: () => listClubLedger(clubId), enabled: !!clubId && enabled });
}
export function useClubAccountReports(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubAccKeys.reports(clubId), queryFn: () => listClubAccountReports(clubId), enabled: !!clubId && enabled });
}

/** A transparência das contas na página do clube: só o publicado (a regra confere a associação aberta). */
export function usePublicClubAccounts(clubId, { enabled = true } = {}) {
  const b = useQuery({ queryKey: clubAccKeys.publicBudgets(clubId), queryFn: () => listClubPublicBudgets(clubId), enabled: !!clubId && enabled, staleTime: 5 * 60_000 });
  const r = useQuery({ queryKey: clubAccKeys.publicReports(clubId), queryFn: () => listClubPublicAccountReports(clubId), enabled: !!clubId && enabled, staleTime: 5 * 60_000 });
  return { budgets: b, reports: r };
}
