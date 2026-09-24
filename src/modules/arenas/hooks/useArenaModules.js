/**
 * O hook dos módulos adicionais da arena.
 *
 * É o ÚNICO ponto de consumo das três camadas. Toda tela que precisa saber se
 * um módulo vale para uma arena passa por aqui — e por aqui só.
 *
 * Por que um hook só, e não um por módulo: uma arena tem 45 módulos. Um hook
 * por módulo dentro de um `map` viraria 45 consultas (ou 45 assinaturas de
 * cache) por tela. Aqui são DUAS consultas — a liberação da plataforma
 * (global, compartilhada por toda a aplicação) e os estados desta arena — e o
 * resto é conta em memória.
 *
 * Uso típico:
 *
 *   const { isOn } = useArenaModules(arenaId);
 *   if (!isOn(ARENA_MODULE_ID.MEMBERS)) return null;
 *
 * Para gatear um trecho de tela, prefira `<ArenaModuleGuard>`.
 */

import { useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { arenaKeys } from './arenaKeys.js';
import {
  buildArenaModuleAccess,
  indexArenaModuleStates,
  arenaModuleSummary,
  modulesToDisableWith,
  modulesToEnableWith,
  normalizePlatformModules,
} from '../domain/moduleAccess.js';
import { getPlatformArenaModules } from '../services/platformModulesService.js';
import {
  listArenaModuleStates,
  setArenaModuleStates,
} from '../services/moduleStateService.js';

/** Um acesso "tudo desligado", para quando ainda não há dado. */
const EMPTY_ACCESS = buildArenaModuleAccess({
  masterOn: false, platformModules: {}, arenaStates: {},
});

/**
 * Camada 1 — o que a plataforma liberou. Global: uma consulta para toda a
 * aplicação, independentemente de quantas arenas estejam em tela.
 */
export function usePlatformArenaModules() {
  return useQuery({
    queryKey: arenaKeys.modulosPlataforma(),
    queryFn: getPlatformArenaModules,
    // Muda raríssimo (só o admin da plataforma mexe) e é lido em toda tela de
    // arena: vale manter fresco por bastante tempo.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/** Camada 2 — o que ESTA arena ligou. */
export function useArenaModuleStates(arenaId) {
  return useQuery({
    queryKey: arenaKeys.modulos(arenaId),
    queryFn: () => listArenaModuleStates(arenaId),
    enabled: Boolean(arenaId),
    staleTime: 60_000,
  });
}

/**
 * As três camadas resolvidas.
 *
 * @param {string} arenaId
 * @returns {{
 *   isOn: (moduleId: string) => boolean,
 *   configOf: (moduleId: string) => Object,
 *   reasonFor: (moduleId: string) => string,
 *   missingFor: (moduleId: string) => string[],
 *   enabledIds: string[],
 *   releasedIds: string[],
 *   summary: { total: number, released: number, enabled: number, forced: number },
 *   masterOn: boolean,
 *   platformModules: Object,
 *   arenaStates: Object,
 *   isLoading: boolean,
 *   isError: boolean,
 * }}
 */
export function useArenaModules(arenaId) {
  const masterOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const platformQuery = usePlatformArenaModules();
  const statesQuery = useArenaModuleStates(arenaId);

  const platformModules = platformQuery.data || normalizePlatformModules(null);
  const arenaStates = useMemo(
    () => indexArenaModuleStates(statesQuery.data || []),
    [statesQuery.data],
  );

  const access = useMemo(
    () => buildArenaModuleAccess({ masterOn, platformModules, arenaStates }),
    [masterOn, platformModules, arenaStates],
  );
  const summary = useMemo(
    () => arenaModuleSummary({ masterOn, platformModules, arenaStates }),
    [masterOn, platformModules, arenaStates],
  );

  return {
    ...access,
    summary,
    masterOn,
    platformModules,
    arenaStates,
    isLoading: platformQuery.isLoading || statesQuery.isLoading,
    isError: platformQuery.isError || statesQuery.isError,
  };
}

/**
 * Um módulo, em VÁRIAS arenas de uma vez — para listas que atravessam arenas
 * (os jogos abertos em Procura-se jogo). Cada arena custa a MESMA consulta que
 * a página dela já faz (mesma chave de cache), e a liberação da plataforma é
 * uma só.
 *
 * Enquanto uma arena ainda carrega, ela responde `false`: é melhor um jogo
 * aparecer meio segundo depois do que aparecer e sumir.
 *
 * @param {string[]} arenaIds
 * @param {string} moduleId
 * @returns {{ isOnIn: (arenaId: string) => boolean, isLoading: boolean }}
 */
export function useModuleOnInArenas(arenaIds = [], moduleId) {
  const masterOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const platformQuery = usePlatformArenaModules();
  const ids = useMemo(() => [...new Set((arenaIds || []).filter(Boolean))].sort(), [arenaIds]);
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: arenaKeys.modulos(id),
      queryFn: () => listArenaModuleStates(id),
      staleTime: 60_000,
    })),
  });
  const platformModules = platformQuery.data || normalizePlatformModules(null);
  const dataKey = results.map((r) => r.dataUpdatedAt).join(',');
  const porArena = useMemo(() => {
    const mapa = new Map();
    ids.forEach((id, i) => {
      const r = results[i];
      if (!r?.data) { mapa.set(id, false); return; }
      const acesso = buildArenaModuleAccess({
        masterOn, platformModules, arenaStates: indexArenaModuleStates(r.data),
      });
      mapa.set(id, acesso.isOn(moduleId));
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, dataKey, masterOn, platformModules, moduleId]);
  return {
    isOnIn: (arenaId) => porArena.get(arenaId) === true,
    isLoading: platformQuery.isLoading || results.some((r) => r.isLoading),
  };
}

/**
 * Conveniência: um módulo só. Continua custando as MESMAS duas consultas
 * (React Query compartilha o cache), então pode ser usado à vontade.
 * @param {string} arenaId
 * @param {string} moduleId
 * @returns {boolean}
 */
export function useArenaModuleOn(arenaId, moduleId) {
  const { isOn } = useArenaModules(arenaId);
  return isOn(moduleId);
}

/**
 * Conveniência: a configuração de um módulo, já com os padrões do catálogo.
 * @param {string} arenaId
 * @param {string} moduleId
 * @returns {Object}
 */
export function useArenaModuleConfig(arenaId, moduleId) {
  const { configOf } = useArenaModules(arenaId);
  return configOf(moduleId);
}

/**
 * Liga ou desliga um módulo na arena, **com a cascata**: ligar arrasta as
 * dependências, desligar derruba quem dependia. Uma escrita em lote só.
 *
 * A tela deve mostrar antes o que vai acontecer — use `useArenaModuleImpact`.
 */
export function useSetArenaModule() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ arenaId, moduleId, enabled, platformModules, arenaStates, config }) => {
      const ctx = { platformModules, arenaStates };
      const together = enabled
        ? modulesToEnableWith(moduleId, ctx)
        : modulesToDisableWith(moduleId, ctx);
      const entries = [
        ...together.map((id) => ({ moduleId: id, enabled })),
        { moduleId, enabled, ...(config ? { config } : {}) },
      ];
      await setArenaModuleStates(arenaId, entries, user, {
        reason: enabled ? 'ativado pela arena' : 'desativado pela arena',
      });
      return { moduleId, enabled, together };
    },
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: arenaKeys.modulos(arenaId) });
    },
  });
}

/** Salva só a configuração de um módulo já ligado (não mexe no liga/desliga). */
export function useSetArenaModuleConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, moduleId, config }) => setArenaModuleStates(
      arenaId,
      [{ moduleId, enabled: true, config }],
      user,
      { reason: 'configuração ajustada' },
    ),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: arenaKeys.modulos(arenaId) });
    },
  });
}

/**
 * O que muda se a arena mexer neste módulo agora. Serve para a tela AVISAR
 * antes de gravar — ninguém deve descobrir que perdeu a carteira ao desligar
 * membros.
 *
 * @returns {{ willEnable: string[], willDisable: string[] }}
 */
export function useArenaModuleImpact(arenaId, moduleId) {
  const { platformModules, arenaStates } = useArenaModules(arenaId);
  return useMemo(() => {
    const ctx = { platformModules, arenaStates };
    return {
      willEnable: moduleId ? modulesToEnableWith(moduleId, ctx) : [],
      willDisable: moduleId ? modulesToDisableWith(moduleId, ctx) : [],
    };
  }, [platformModules, arenaStates, moduleId]);
}

export { EMPTY_ACCESS };
