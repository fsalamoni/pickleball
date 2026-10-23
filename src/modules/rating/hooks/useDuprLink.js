import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  getDuprConfig, getDuprStatus, linkDuprAccount, unlinkDuprAccount,
} from '@/modules/rating/services/duprOfficial';

const keys = {
  config: (uid) => ['dupr', 'config', uid],
  status: (uid) => ['dupr', 'status', uid],
};

/**
 * Estado da conexão com o DUPR de quem está logado. `config` diz se a conexão
 * está disponível e se já há vínculo; `status` (só com vínculo) renova as
 * assinaturas do DUPR no servidor quando passou de 24 h.
 */
export function useDuprLink({ enabled = true } = {}) {
  const { user, refreshUserProfile } = useAuth();
  const uid = user?.uid;
  const qc = useQueryClient();

  const config = useQuery({
    queryKey: keys.config(uid),
    queryFn: getDuprConfig,
    enabled: Boolean(uid) && enabled,
    staleTime: 60_000,
  });
  const linked = config.data?.linked || null;
  const status = useQuery({
    queryKey: keys.status(uid),
    queryFn: getDuprStatus,
    enabled: Boolean(uid) && enabled && Boolean(linked),
    staleTime: 60 * 60_000,
  });

  const depois = async () => {
    await qc.invalidateQueries({ queryKey: ['dupr'] });
    await refreshUserProfile?.();
  };
  const link = useMutation({ mutationFn: linkDuprAccount, onSuccess: depois });
  const unlink = useMutation({ mutationFn: unlinkDuprAccount, onSuccess: depois });

  return {
    config,
    // O resumo mais novo: o do `status` (com assinaturas renovadas) ou o do `config`.
    linked: status.data?.linked || linked,
    link,
    unlink,
  };
}
