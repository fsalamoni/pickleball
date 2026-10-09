import React, { Suspense, lazy, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ProfileProgressionSection from '@/v2/components/profile/ProfileProgressionSection';
import { V2Skeleton } from '@/v2/ui/primitives';
import MyReferralCodes from '@/v2/components/arenas/marketing/MyReferralCodes';
import ProfileShowcase from '@/v2/components/userArea/ProfileShowcase';

// A Minha área (flag `user_hub`) só baixa para quem a tem ligada.
const UserArea = lazy(() => import('@/v2/components/userArea/UserArea'));

/**
 * `/perfil`. Com a flag `user_hub` ligada, vira a MINHA ÁREA (a central da
 * pessoa); desligada, é o perfil de sempre, sem mudança nenhuma.
 */
export default function V2Profile() {
  const hubOn = useFeatureFlag(FEATURE_FLAG.USER_HUB);
  if (hubOn) {
    return (
      <Suspense fallback={<div className="mx-auto max-w-[1000px]"><V2Skeleton className="h-64 rounded-4xl" /></div>}>
        <UserArea />
      </Suspense>
    );
  }
  return <ClassicProfile />;
}

function ClassicProfile() {
  const { user } = useAuth();
  const { data: ranking = [] } = useNationalRanking();
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  // Os códigos de indicação vivem nos módulos de arena (chave-mestra).
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);

  const me = useMemo(
    () => ranking.find((p) => p.id === user?.uid || p.uid === user?.uid) || null,
    [ranking, user?.uid],
  );

  return (
    <div className="mx-auto max-w-[1000px]">
      <ProfileShowcase me={me} editDica="perfil-editar" />

      {/* Quem joga e ainda não está no ranking via só o perfil vazio, sem saber
          por quê. Todos os jogos (e o porquê de cada um fora do ranking) moram
          em "Meu desempenho". */}
      <div className="mt-4 text-center text-sm text-gray-500 sm:text-left">
        Todos os seus jogos — e, se algum não contar no ranking, o porquê — estão em{' '}
        <Link to="/meu-desempenho" className="font-bold text-ink underline">Meu desempenho</Link>.
      </div>

      {arenaModulesOn && user && <MyReferralCodes />}

      <div className="mt-8 rounded-4xl border border-dashed border-gray-200 bg-paper p-6 text-sm text-gray-500">
        Edite seus dados, nivelamento e privacidade no editor de perfil.{' '}
        <Link to="/perfil/editar" className="font-bold text-ink underline">Abrir editor de perfil</Link>
      </div>

      {gamificationOn && user && <ProfileProgressionSection uid={user.uid} />}
    </div>
  );
}
