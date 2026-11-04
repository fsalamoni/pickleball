/**
 * useGamificationGuide — os textos da gamificação, já com os números da
 * configuração que o admin ajustou (prêmios, prazos, mínimos). Um objeto só,
 * memorizado: refaz quando a configuração muda. Com a flag `athlete_career`
 * entra o termo "Ficha completa".
 */
import { useMemo } from 'react';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { buildGamificationGuide } from '@/modules/progression/domain/gamificationGuide';
import { useGamificationConfig } from './useGamificationConfig';

export function useGamificationGuide() {
  const { config, isModuleOn } = useGamificationConfig();
  const career = useFeatureFlag(FEATURE_FLAG.ATHLETE_CAREER) === true;
  const guide = useMemo(() => buildGamificationGuide(config, { career }), [config, career]);
  return { guide, isModuleOn };
}
