/**
 * useGamificationGuide — os textos da gamificação, já com os números da
 * configuração que o admin ajustou (prêmios, prazos, mínimos). Um objeto só,
 * memorizado: refaz quando a configuração muda.
 */
import { useMemo } from 'react';
import { buildGamificationGuide } from '@/modules/progression/domain/gamificationGuide';
import { useGamificationConfig } from './useGamificationConfig';

export function useGamificationGuide() {
  const { config, isModuleOn } = useGamificationConfig();
  const guide = useMemo(() => buildGamificationGuide(config), [config]);
  return { guide, isModuleOn };
}
