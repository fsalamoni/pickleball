import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

import { useGamificationConfig } from '@/modules/progression/hooks/useGamificationConfig';
import GamificationPreferences from '@/v2/components/gamification/GamificationPreferences';
import { V2EmptyState, V2PageIntro, V2Surface, V2BackLink } from '@/v2/ui/primitives';
import { useHashScroll } from '@/v2/ui/useHashScroll';
import { t } from '@/core/i18n';

/** Preferências da gamificação (privacidade, interação, avisos, exibição). */
export default function V2GamificationSettings() {
  const on = true;
  const { user } = useAuth();
  const { isModuleOn } = useGamificationConfig();
  useHashScroll();
  if (!on) {
    return (
      <div className="mx-auto max-w-[760px]">
        <V2PageIntro title={t('Preferências da gamificação')} subtitle={t('Privacidade, avisos e como você aparece.')} />
        <V2Surface><V2EmptyState icon={Sparkles} title={t('Disponível em breve')} description={t('Estas preferências chegam junto com a gamificação.')} /></V2Surface>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <V2BackLink to="/gamification">{t('Gamificação')}</V2BackLink>
      <V2PageIntro title={t('Preferências da gamificação')} subtitle={t('Você manda: o que aparece, o que chega e como você é visto.')} />
      <GamificationPreferences uid={user?.uid} isModuleOn={isModuleOn} />
    </div>
  );
}
