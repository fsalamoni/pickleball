/**
 * CAMADA NACIONAL — ganchos do React Query, sob `['federacoes', …]` para
 * `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/nationalService';
import { transferAction } from '../services/federationService';
import { fedKeys, useFederationMutation } from './useFederations';

export const nationalKeys = {
  myLinks: (id) => [...fedKeys.all, 'federacao', id, 'vinculo-nacional'],
  confLinks: (id) => [...fedKeys.all, 'federacao', id, 'rede-filiadas'],
  duesOwed: (id) => [...fedKeys.all, 'federacao', id, 'anuidades-devidas'],
  duesReceivable: (id) => [...fedKeys.all, 'federacao', id, 'anuidades-a-receber'],
  homologations: (id) => [...fedKeys.all, 'federacao', id, 'homologacoes'],
  affiliated: (id) => [...fedKeys.all, 'federacao', id, 'filiadas-publicas'],
  ranking: (id, season) => [...fedKeys.all, 'federacao', id, 'ranking-nacional', season],
  repassesOut: (id) => [...fedKeys.all, 'federacao', id, 'repasses-feitos'],
  repassesIn: (id) => [...fedKeys.all, 'federacao', id, 'repasses-recebidos'],
};

const q = (key, fn, id, enabled) => ({ queryKey: key(id), queryFn: () => fn(id), enabled: !!id && enabled });
export const useMyNationalLinks = (id, { enabled = true } = {}) => useQuery(q(nationalKeys.myLinks, svc.listMyNationalLinks, id, enabled));
export const useConfederationLinks = (id, { enabled = true } = {}) => useQuery(q(nationalKeys.confLinks, svc.listConfederationLinks, id, enabled));
export const useDuesOwed = (id, { enabled = true } = {}) => useQuery(q(nationalKeys.duesOwed, svc.listDuesOwed, id, enabled));
export const useDuesReceivable = (id, { enabled = true } = {}) => useQuery(q(nationalKeys.duesReceivable, svc.listDuesReceivable, id, enabled));
export const useRepassesOut = (id, { enabled = true } = {}) => useQuery(q(nationalKeys.repassesOut, svc.listRepassesOut, id, enabled));
export const useRepassesIn = (id, { enabled = true } = {}) => useQuery(q(nationalKeys.repassesIn, svc.listRepassesIn, id, enabled));
/** `mutate({ repasseId, action, reason })`: marcar repassado ou desfazer. */
export const useSplitAction = () => useFederationMutation(({ repasseId, action, reason }) => svc.splitAction(repasseId, action, reason));
export const useHomologations =(id, { enabled = true } = {}) => useQuery(q(nationalKeys.homologations, svc.listHomologations, id, enabled));
export const useAffiliatedFederations = (id, { enabled = true } = {}) => useQuery({ ...q(nationalKeys.affiliated, svc.listAffiliatedFederations, id, enabled), staleTime: 60_000 });

/** O ranking nacional de um ano (público). */
export const useNationalRanking = (id, season, { enabled = true } = {}) => useQuery({ queryKey: nationalKeys.ranking(id, season), queryFn: () => svc.getNationalRanking(id, season), enabled: !!id && !!season && enabled, staleTime: 60_000 });

/** `mutate({ action, ...payload })` numa federação (o lado de quem age). */
export const useNationalAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.nationalAction(federationId, action, payload));
/** Homologar ou negar uma transferência (`action: 'homologate' | 'deny'`). */
export const useHomologationAction = () => useFederationMutation(({ transferId, action, reason }) => transferAction({ transferId, action, reason }));
