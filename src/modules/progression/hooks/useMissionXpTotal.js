/**
 * useMissionXpTotal — o XP de missões de TODA a história.
 *
 * A soma é feita pelo banco (agregação, 1 leitura a cada 1.000 documentos). Se a
 * agregação falhar (índice ainda sendo construído, por exemplo), cai para a
 * lista recente — `total` fica `null` e `docs` traz os documentos. Nunca
 * inventa zero: quem consome distingue "ainda não sei" de "é zero".
 */
import { useQuery } from '@tanstack/react-query';
import { listUserMissions, sumMissionXp } from '@/modules/progression/services/missionService';

export const MISSION_XP_KEY = (uid) => ['gamification-mission-xp', uid];
const DIAS_FALLBACK = 120;

export function useMissionXpTotal(uid, enabled = true) {
  const q = useQuery({
    queryKey: MISSION_XP_KEY(uid),
    enabled: !!uid && enabled,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      try {
        return { total: await sumMissionXp(uid), docs: null };
      } catch {
        return { total: null, docs: await listUserMissions(uid, DIAS_FALLBACK) };
      }
    },
  });
  return {
    total: q.data ? q.data.total : null,
    docs: q.data?.docs || null,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}
