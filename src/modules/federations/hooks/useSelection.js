/**
 * SELEÇÃO E EDITAIS — ganchos do React Query. As chaves moram sob
 * `['federacoes', …]` para `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import * as svc from '../services/selectionService';
import { fedModuleOn } from '../domain/federation.js';
import { fedKeys, useFederationMutation } from './useFederations';

export const selKeys = {
  callups: (id) => [...fedKeys.all, 'federacao', id, 'convocacoes'],
  publicCallups: (id) => [...fedKeys.all, 'federacao', id, 'convocacoes', 'publicas'],
  callupMembers: (id, cid) => [...fedKeys.all, 'federacao', id, 'convocacoes', cid, 'convocados'],
  myCallups: (uid) => [...fedKeys.all, 'convocacoes', 'minhas', uid],
  grants: (id) => [...fedKeys.all, 'federacao', id, 'editais'],
  publicGrants: (id) => [...fedKeys.all, 'federacao', id, 'editais', 'publicos'],
  applications: (id, gid) => [...fedKeys.all, 'federacao', id, 'editais', gid, 'inscricoes'],
  myApplications: (uid) => [...fedKeys.all, 'editais', 'minhas', uid],
};

export const useCallups = (id, { enabled = true } = {}) => useQuery({ queryKey: selKeys.callups(id), queryFn: () => svc.listCallups(id), enabled: !!id && enabled });
export const useCallupMembers = (id, cid, { enabled = true } = {}) => useQuery({ queryKey: selKeys.callupMembers(id, cid), queryFn: () => svc.listCallupMembers(id, cid), enabled: !!id && !!cid && enabled });
export const useGrants = (id, { enabled = true } = {}) => useQuery({ queryKey: selKeys.grants(id), queryFn: () => svc.listGrants(id), enabled: !!id && enabled });
export const useGrantApplications = (id, gid, { enabled = true } = {}) => useQuery({ queryKey: selKeys.applications(id, gid), queryFn: () => svc.listGrantApplications(id, gid), enabled: !!id && !!gid && enabled });

/** Página pública: só o publicado, só com o módulo ligado. */
export function usePublicCallups(federation, { enabled = true } = {}) {
  const id = federation?.id;
  return useQuery({ queryKey: selKeys.publicCallups(id), queryFn: () => svc.listPublicCallups(id), enabled: !!id && enabled && fedModuleOn(federation, 'selection'), staleTime: 60_000 });
}
export function usePublicGrants(federation, { enabled = true } = {}) {
  const id = federation?.id;
  return useQuery({ queryKey: selKeys.publicGrants(id), queryFn: () => svc.listPublicGrants(id), enabled: !!id && enabled && fedModuleOn(federation, 'grants'), staleTime: 60_000 });
}

export function useMyCallupInvites({ enabled = true } = {}) {
  const uid = useAuth().user?.uid;
  return useQuery({ queryKey: selKeys.myCallups(uid), queryFn: () => svc.listMyCallupInvites(uid), enabled: !!uid && enabled });
}
export function useMyGrantApplications({ enabled = true } = {}) {
  const uid = useAuth().user?.uid;
  return useQuery({ queryKey: selKeys.myApplications(uid), queryFn: () => svc.listMyGrantApplications(uid), enabled: !!uid && enabled });
}

export const useCallup = (id, { enabled = true } = {}) => useQuery({ queryKey: [...fedKeys.all, 'convocacao', id], queryFn: () => svc.getCallup(id), enabled: !!id && enabled, staleTime: 60_000 });
export const useGrant = (id, { enabled = true } = {}) => useQuery({ queryKey: [...fedKeys.all, 'edital', id], queryFn: () => svc.getGrant(id), enabled: !!id && enabled, staleTime: 60_000 });

/** `mutate({ action, ...payload })` numa federação. */
export const useSelectionAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.selectionAction(federationId, action, payload));
