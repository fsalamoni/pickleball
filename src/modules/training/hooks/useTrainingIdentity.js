/**
 * Quem está usando o Centro de Treino: o que a tela e os serviços precisam
 * saber da pessoa (papel de autoria, professores ativos, idade para as travas
 * de menor). Uma fonte só — nenhuma tela monta isso por conta própria.
 */

import { useMemo } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { calculateAge } from '@/core/lib/profileValidation';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useStudentCoaches } from '@/modules/coaches/hooks/useStudents';

/**
 * @returns {{ uid: string|null, name: string, photo: string|null, isAdmin: boolean,
 *   isCoach: boolean, coachReady: boolean, activeCoachIds: string[], coachLinks: object[],
 *   coachLinksError: boolean, ageYears: number|null, actor: object|null }}
 */
export function useTrainingIdentity() {
  const { user, userProfile, isPlatformAdmin } = useAuth();
  const uid = user?.uid || null;
  const coach = useCoach(uid);
  const vinculos = useStudentCoaches(uid);

  return useMemo(() => {
    const links = (vinculos.data || []).filter((v) => v.status === 'active');
    const age = userProfile?.birth_date ? calculateAge(userProfile.birth_date) : null;
    return {
      uid,
      name: userProfile?.platform_name || userProfile?.full_name || user?.displayName || '',
      photo: userProfile?.photo_url || user?.photoURL || null,
      isAdmin: !!isPlatformAdmin,
      isCoach: !!coach.data,
      coachReady: !uid || coach.isSuccess,
      activeCoachIds: links.map((v) => v.coach_id),
      coachLinks: links,
      coachLinksError: vinculos.isError,
      ageYears: Number.isFinite(age) ? age : null,
      actor: user || null,
    };
  }, [uid, user, userProfile, isPlatformAdmin, coach.data, coach.isSuccess, vinculos.data, vinculos.isError]);
}
