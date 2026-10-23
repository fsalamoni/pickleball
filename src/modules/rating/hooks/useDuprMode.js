import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { DUPR_AUDIENCE, normalizeDuprPolicy } from '@/modules/rating/domain/duprPolicy';
import {
  getDuprMirror, getDuprPolicy, listVerifiedDuprProfiles, saveDuprPolicy,
} from '@/modules/rating/services/duprPolicyService';

/** O rating DUPR (espelho do perfil) de uma pessoa. */
export function useDuprMirror(uid, { enabled = true } = {}) {
  return useQuery({ queryKey: ['dupr', 'mirror', uid], queryFn: () => getDuprMirror(uid), enabled: Boolean(uid) && enabled, staleTime: 5 * 60_000 });
}

/** Perfis com a conta DUPR conectada (para o ranking oficial). */
export function useVerifiedDuprProfiles({ enabled = true } = {}) {
  return useQuery({ queryKey: ['dupr', 'verified-profiles'], queryFn: listVerifiedDuprProfiles, enabled, staleTime: 5 * 60_000 });
}

const POLICY_KEY = ['dupr', 'policy'];

/** A política do DUPR (público e envio). Falhando a leitura, `data` fica indefinido. */
export function useDuprPolicy({ enabled = true } = {}) {
  return useQuery({ queryKey: POLICY_KEY, queryFn: getDuprPolicy, enabled, staleTime: 5 * 60_000 });
}

export function useSaveDuprPolicy() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (policy) => saveDuprPolicy(policy, user),
    onSuccess: (p) => qc.setQueryData(POLICY_KEY, p),
  });
}

/**
 * O DUPR vale para QUEM está vendo? Fonte única das telas.
 *  · `official`: a flag `dupr_official_sync` ligada e a pessoa no público da
 *    política (no piloto, só o admin da plataforma). Sem a política carregada
 *    vale o piloto — o lado mais restrito.
 *  · `ownRatingOff`: o rating PRÓPRIO (ELO "Nacional" e "Nível 2.0–8.0") sai
 *    da tela — o contrato faz do DUPR o rating da plataforma. Hoje é o mesmo
 *    que `official`; fica separado para as telas dizerem o que perguntam.
 */
export function useDuprMode() {
  const flag = useFeatureFlag(FEATURE_FLAG.DUPR_OFFICIAL_SYNC);
  const { isPlatformAdmin } = useAuth();
  const { data } = useDuprPolicy({ enabled: flag });
  const policy = data || normalizeDuprPolicy(null);
  const official = Boolean(flag) && (policy.audience === DUPR_AUDIENCE.ALL || Boolean(isPlatformAdmin));
  return { official, ownRatingOff: official, pilot: Boolean(flag) && policy.audience !== DUPR_AUDIENCE.ALL };
}
