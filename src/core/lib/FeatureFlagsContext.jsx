import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_FEATURE_FLAGS } from '@/core/featureFlags';
import { DEFAULT_PLATFORM_HOME, subscribePlatformSettings } from '@/core/services/platformSettingsService';

const FeatureFlagsContext = createContext({
  flags: DEFAULT_FEATURE_FLAGS,
  inicio: DEFAULT_PLATFORM_HOME,
  isLoading: true,
});

/**
 * Provider global das feature flags. Observa o documento de configurações da
 * plataforma e expõe o mapa de flags para toda a árvore. Falha graciosamente
 * para os padrões (todas off) — nunca quebra a aplicação.
 */
export function FeatureFlagsProvider({ children }) {
  const [flags, setFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [inicio, setInicio] = useState(DEFAULT_PLATFORM_HOME);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribePlatformSettings((settings) => {
      setFlags(settings.feature_flags);
      setInicio(settings.inicio || DEFAULT_PLATFORM_HOME);
      setIsLoading(false);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ flags, inicio, isLoading }), [flags, inicio, isLoading]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/** Mapa completo de flags + estado de carregamento. */
export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

/**
 * Conveniência: retorna o booleano de uma flag específica.
 * @param {string} flagKey
 * @returns {boolean}
 */
export function useFeatureFlag(flagKey) {
  const { flags } = useContext(FeatureFlagsContext);
  return Boolean(flags?.[flagKey]);
}

/**
 * O que o admin decidiu mostrar a todo mundo no início (`{ promocoes }`).
 * Vem do MESMO documento das flags — nenhuma assinatura a mais.
 */
export function usePlatformHome() {
  const { inicio } = useContext(FeatureFlagsContext);
  return inicio || DEFAULT_PLATFORM_HOME;
}
