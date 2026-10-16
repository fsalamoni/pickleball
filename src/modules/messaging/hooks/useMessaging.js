/**
 * AVISOS POR E-MAIL E CELULAR — ganchos do React Query. Chaves em
 * `messagingKeys` (fonte única).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import * as svc from '../services/messagingService';

export const messagingKeys = {
  all: ['mensagens'],
  settings: ['mensagens', 'config'],
  adminStatus: ['mensagens', 'admin', 'estado'],
  adminList: (action, extra) => ['mensagens', 'admin', action, JSON.stringify(extra || {})],
  myStatus: (uid) => ['mensagens', 'eu', uid],
  names: (uids) => ['mensagens', 'nomes', uids.join(',')],
};

/** A configuração do admin (leitura pública): `{ raw, settings }`. */
export function useMessagingSettings({ enabled = true } = {}) {
  return useQuery({ queryKey: messagingKeys.settings, queryFn: svc.getMessagingSettings, staleTime: 60_000, enabled });
}

/** Painel: o estado completo (só o admin — a função confere). */
export function useMessagingAdminStatus({ enabled = true } = {}) {
  return useQuery({
    queryKey: messagingKeys.adminStatus,
    queryFn: () => svc.messagingAdmin('status'),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Painel: listas sob demanda (`suppression_list`, `reports_list`, `outbox_list`). */
export function useMessagingAdminList(action, extra, { enabled = true } = {}) {
  return useQuery({
    queryKey: messagingKeys.adminList(action, extra),
    queryFn: () => svc.messagingAdmin(action, extra || {}),
    enabled,
    staleTime: 15_000,
    retry: 1,
  });
}

/** Ação do painel que muda algo: ao terminar, o estado é lido de novo. */
export function useMessagingAdminAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, ...extra }) => svc.messagingAdmin(action, extra),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.adminStatus });
      qc.invalidateQueries({ queryKey: ['mensagens', 'admin'] });
    },
  });
}

/** Grava uma parte da configuração do admin. */
export function useSaveMessagingSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ patch, section }) => svc.saveMessagingSettings(patch, { actor: user, section }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: messagingKeys.settings });
      qc.invalidateQueries({ queryKey: messagingKeys.adminStatus });
    },
  });
}

/** A funcionalidade está ligada (flag `external_messaging`)? */
export function useExternalMessagingOn() {
  return useFeatureFlag(FEATURE_FLAG.EXTERNAL_MESSAGING);
}

/** Configurações da pessoa: e-mail confirmado, celular, código pendente, canais prontos. */
export function useMyMessagingStatus({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  return useQuery({
    queryKey: messagingKeys.myStatus(uid),
    queryFn: () => svc.messagingUser('status'),
    enabled: enabled && Boolean(uid),
    staleTime: 30_000,
    retry: 1,
  });
}

/** Ação da pessoa (código, confirmar, esquecer, teste); relê o estado ao fim. */
export function useMyMessagingAction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ action, ...extra }) => svc.messagingUser(action, extra),
    onSettled: () => qc.invalidateQueries({ queryKey: messagingKeys.myStatus(user?.uid || null) }),
  });
}

/** Nomes públicos de uma lista de contas (os remetentes bloqueados). */
export function usePublicNames(uids) {
  const lista = [...new Set((uids || []).filter(Boolean))].sort();
  return useQuery({
    queryKey: messagingKeys.names(lista),
    queryFn: () => svc.listPublicNames(lista),
    enabled: lista.length > 0,
    staleTime: 5 * 60_000,
  });
}
