import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useGamificationConfig } from '@/modules/progression/hooks/useGamificationConfig';
import GamificationPreferences from '@/v2/components/gamification/GamificationPreferences';
import { V2EmptyState, V2PageIntro, V2Surface } from '@/v2/ui/primitives';
import { useHashScroll } from '@/v2/ui/useHashScroll';

/** Preferências da gamificação (privacidade, interação, avisos, exibição). */
export default function V2GamificationSettings() {
  const on = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  const { user } = useAuth();
  const { isModuleOn } = useGamificationConfig();
  useHashScroll();
  if (!on) {
    return (
      <div className="mx-auto max-w-[760px]">
        <V2PageIntro title="Preferências da gamificação" subtitle="Privacidade, avisos e como você aparece." />
        <V2Surface><V2EmptyState icon={Sparkles} title="Disponível em breve" description="Estas preferências chegam junto com a gamificação." /></V2Surface>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <Link to="/gamification" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Gamificação
      </Link>
      <V2PageIntro title="Preferências da gamificação" subtitle="Você manda: o que aparece, o que chega e como você é visto." />
      <GamificationPreferences uid={user?.uid} isModuleOn={isModuleOn} />
    </div>
  );
}
