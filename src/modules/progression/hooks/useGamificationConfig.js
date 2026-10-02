/**
 * useGamificationConfig — a configuração do admin, em tempo real.
 *
 * Sempre devolve uma configuração utilizável: antes de carregar, ou se a
 * leitura falhar, são os padrões (tudo ligado, valores de fábrica) — a
 * gamificação não pode parar porque o painel do admin não respondeu.
 */
import { useEffect, useState } from 'react';
import {
  subscribeGamificationConfig,
} from '@/modules/progression/services/gamificationConfigService';
import {
  normalizeGamificationConfig, isModuleOn,
} from '@/modules/progression/domain/gamificationConfig';

const PADRAO = normalizeGamificationConfig(null);

/** @returns {{ config: object, isModuleOn: (id: string) => boolean, isLoading: boolean }} */
export function useGamificationConfig() {
  const [state, setState] = useState({ config: PADRAO, isLoading: true });
  useEffect(() => {
    let vivo = true;
    let unsub = () => {};
    try {
      unsub = subscribeGamificationConfig((config) => {
        if (vivo) setState({ config, isLoading: false });
      });
    } catch {
      setState({ config: PADRAO, isLoading: false });
    }
    return () => { vivo = false; unsub(); };
  }, []);
  return {
    config: state.config,
    isLoading: state.isLoading,
    isModuleOn: (id) => isModuleOn(state.config, id),
  };
}
