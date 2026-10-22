/**
 * CONTAS DA FEDERAÇÃO — ganchos do React Query. As chaves começam por
 * `fedKeys.all` (`['federacoes']`), então `useFederationMutation` invalida
 * tudo depois de cada ação do servidor.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/accountsService';
import { fedModuleOn } from '../domain/federation.js';
import { fedKeys, useFederationMutation } from './useFederations';

export const accKeys = {
  budgets: (id) => [...fedKeys.all, 'federacao', id, 'contas', 'orcamentos'],
  ledger: (id) => [...fedKeys.all, 'federacao', id, 'contas', 'lancamentos'],
  reports: (id) => [...fedKeys.all, 'federacao', id, 'contas', 'prestacoes'],
  publicBudgets: (id) => [...fedKeys.all, 'federacao', id, 'contas', 'orcamentos', 'publicos'],
  publicReports: (id) => [...fedKeys.all, 'federacao', id, 'contas', 'prestacoes', 'publicas'],
};

export function useFederationBudgets(id, { enabled = true } = {}) {
  return useQuery({ queryKey: accKeys.budgets(id), queryFn: () => svc.listBudgets(id), enabled: !!id && enabled });
}
export function useFederationLedger(id, { enabled = true } = {}) {
  return useQuery({ queryKey: accKeys.ledger(id), queryFn: () => svc.listLedger(id), enabled: !!id && enabled });
}
export function useFederationAccountReports(id, { enabled = true } = {}) {
  return useQuery({ queryKey: accKeys.reports(id), queryFn: () => svc.listAccountReports(id), enabled: !!id && enabled });
}

/** A transparência das contas na página pública: só o publicado, só com o módulo ligado. */
export function usePublicAccounts(federation, { enabled = true } = {}) {
  const id = federation?.id;
  const on = enabled && !!id && fedModuleOn(federation, 'accounts');
  const b = useQuery({ queryKey: accKeys.publicBudgets(id), queryFn: () => svc.listPublicBudgets(id), enabled: on, staleTime: 5 * 60_000 });
  const r = useQuery({ queryKey: accKeys.publicReports(id), queryFn: () => svc.listPublicAccountReports(id), enabled: on, staleTime: 5 * 60_000 });
  return { on, budgets: b, reports: r };
}

export const useAccountsAction = () => useFederationMutation(svc.accountsAction);
