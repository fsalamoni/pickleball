import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { avatarAiAction } from '../services/avatarAiService.js';

export const avatarAiKeys = Object.freeze({
  status: (uid) => ['avatar', 'ai', 'status', uid],
  config: ['avatar', 'ai', 'config'],
});

/**
 * Dá para criar agora? Quantos restam? (o servidor responde; falha é `isError`,
 * nunca "indisponível").
 */
export function useAvatarAiStatus(uid, { enabled = true } = {}) {
  return useQuery({
    queryKey: avatarAiKeys.status(uid),
    queryFn: () => avatarAiAction('status'),
    enabled: enabled && Boolean(uid),
    staleTime: 60 * 1000,
  });
}

/** Cria o avatar; a resposta já traz a contagem nova. */
export function useGenerateAvatar(uid) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recipe, keep = false }) => avatarAiAction('generate', { recipe, keep }),
    onSuccess: (data) => { if (data?.status) qc.setQueryData(avatarAiKeys.status(uid), data.status); },
    // Recusado por limite ou trava: a contagem da tela pode estar velha.
    onError: () => qc.invalidateQueries({ queryKey: avatarAiKeys.status(uid) }),
  });
}

/** Admin: a configuração (sem a chave — ela nunca volta do servidor). */
export function useAvatarAiConfig() {
  return useQuery({ queryKey: avatarAiKeys.config, queryFn: () => avatarAiAction('config'), staleTime: 60 * 1000 });
}

export function useSaveAvatarAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => avatarAiAction('config_save', payload),
    onSuccess: (data) => qc.setQueryData(avatarAiKeys.config, data),
  });
}
