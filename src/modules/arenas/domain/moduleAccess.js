/**
 * Gate dos módulos adicionais da arena — três camadas, uma resposta.
 *
 * PURO — sem I/O, sem React.
 *
 * As camadas, na ordem em que são conferidas:
 *
 *   1. CHAVE-MESTRA  a feature flag `arena_modules`. Desligada, nada existe.
 *   2. PLATAFORMA    o admin da plataforma LIBEROU aquele módulo?
 *                    (documento `platform_settings/arena_modules`)
 *   3. ARENA         a arena LIGOU o módulo para si?
 *                    (`arena_module_states/{arenaId}_{moduleId}`)
 *
 * Mais duas conferências que atravessam as camadas:
 *
 *   - FAMÍLIA        um filho só vale se a família dele também valer.
 *   - DEPENDÊNCIA    `requires` do catálogo (ex.: carteira exige membros).
 *
 * A resposta nunca é só `true`/`false`: vem com o MOTIVO, porque a tela
 * precisa dizer à pessoa por que o módulo não está disponível — e o motivo
 * é diferente para o admin da plataforma e para o dono da arena.
 */

import {
  getArenaModule,
  listArenaModuleIds,
  isModuleReleasable,
  moduleConfigWithDefaults,
} from './moduleCatalog.js';

/** Como a plataforma libera um módulo. */
export const MODULE_RELEASE_MODE = Object.freeze({
  /** A arena escolhe se liga (o padrão). */
  OPT_IN: 'opt_in',
  /** Liga para todas as arenas, sem escolha. Use com muita parcimônia. */
  FORCED: 'forced',
});

/** Motivos de um módulo não estar valendo. */
export const MODULE_OFF_REASON = Object.freeze({
  OK: 'ok',
  UNKNOWN: 'unknown',
  MASTER_OFF: 'master_off',
  NOT_RELEASED: 'not_released',
  NOT_IMPLEMENTED: 'not_implemented',
  FAMILY_OFF: 'family_off',
  REQUIRES: 'requires',
  ARENA_OFF: 'arena_off',
});

/**
 * Texto do motivo, na voz de quem lê.
 * @param {string} reason
 * @param {{ audience?: 'platform'|'arena'|'user', missing?: string[] }} [opts]
 * @returns {string}
 */
export function moduleOffReasonText(reason, { audience = 'arena', missing = [] } = {}) {
  const names = missing
    .map((id) => getArenaModule(id)?.label)
    .filter(Boolean)
    .join(', ');
  switch (reason) {
    case MODULE_OFF_REASON.MASTER_OFF:
      return audience === 'platform'
        ? 'A chave geral dos módulos de arena está desligada. Ligue-a em Funcionalidades → Flags por assunto.'
        : 'Os módulos adicionais estão desativados na plataforma no momento.';
    case MODULE_OFF_REASON.NOT_RELEASED:
      return audience === 'arena'
        ? 'A plataforma ainda não liberou este módulo.'
        : 'Módulo não liberado às arenas.';
    case MODULE_OFF_REASON.NOT_IMPLEMENTED:
      return 'Este módulo ainda está em construção.';
    case MODULE_OFF_REASON.FAMILY_OFF:
      return names
        ? `Depende de ${names}, que não está ativo.`
        : 'A família deste módulo não está ativa.';
    case MODULE_OFF_REASON.REQUIRES:
      return names
        ? `Precisa de ${names} ativo primeiro.`
        : 'Precisa de outro módulo ativo primeiro.';
    case MODULE_OFF_REASON.ARENA_OFF:
      return 'A arena ainda não ativou este módulo.';
    case MODULE_OFF_REASON.UNKNOWN:
      return 'Módulo desconhecido.';
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/*  Camada 1/2 — o que a PLATAFORMA liberou                            */
/* ------------------------------------------------------------------ */

/**
 * Normaliza o mapa de liberação vindo de `platform_settings/arena_modules`.
 * Ignora chaves que não estão no catálogo (documento antigo não contamina) e
 * garante o formato de cada entrada.
 *
 * @param {unknown} raw — o campo `modules` do documento
 * @returns {Record<string, { released: boolean, mode: string, note: string }>}
 */
export function normalizePlatformModules(raw) {
  const out = {};
  const src = raw && typeof raw === 'object' ? raw : {};
  listArenaModuleIds().forEach((id) => {
    const entry = src[id];
    const released = Boolean(entry && typeof entry === 'object' ? entry.released : entry);
    const mode = entry?.mode === MODULE_RELEASE_MODE.FORCED
      ? MODULE_RELEASE_MODE.FORCED
      : MODULE_RELEASE_MODE.OPT_IN;
    out[id] = {
      released: released && isModuleReleasable(id),
      mode,
      note: typeof entry?.note === 'string' ? entry.note : '',
    };
  });
  return out;
}

/** Ids liberados pela plataforma, na ordem do catálogo. */
export function listReleasedModuleIds(platformModules) {
  const map = platformModules || {};
  return listArenaModuleIds().filter((id) => map[id]?.released);
}

/* ------------------------------------------------------------------ */
/*  Camada 3 — o que a ARENA ligou                                     */
/* ------------------------------------------------------------------ */

/**
 * Indexa os documentos de `arena_module_states` por `module_id`.
 * @param {Array<{ module_id?: string, enabled?: boolean, config?: Object }>} states
 * @returns {Record<string, { enabled: boolean, config: Object }>}
 */
export function indexArenaModuleStates(states) {
  const out = {};
  if (!Array.isArray(states)) return out;
  states.forEach((s) => {
    if (s?.module_id) out[s.module_id] = { enabled: Boolean(s.enabled), config: s.config || {} };
  });
  return out;
}

/* ------------------------------------------------------------------ */
/*  O gate                                                             */
/* ------------------------------------------------------------------ */

/**
 * A arena LIGOU o módulo? (camada 3 isolada — sem olhar plataforma nem
 * dependências). `forced` conta como ligado.
 */
function arenaTurnedOn(moduleId, { platformModules, arenaStates }) {
  if (platformModules?.[moduleId]?.mode === MODULE_RELEASE_MODE.FORCED) return true;
  return Boolean(arenaStates?.[moduleId]?.enabled);
}

/**
 * Resolve um módulo para uma arena. Esta é a função que decide TUDO.
 *
 * @param {Object} args
 * @param {boolean} args.masterOn — a feature flag `arena_modules`
 * @param {Record<string, {released:boolean, mode:string}>} args.platformModules
 * @param {Record<string, {enabled:boolean, config:Object}>} args.arenaStates
 * @param {string} args.moduleId
 * @param {number} [args._depth] — proteção contra ciclo em `requires`
 * @returns {{ on: boolean, reason: string, mode: string, config: Object, missing: string[] }}
 */
export function resolveArenaModule({
  masterOn,
  platformModules,
  arenaStates,
  moduleId,
  _depth = 0,
}) {
  const mod = getArenaModule(moduleId);
  const config = moduleConfigWithDefaults(moduleId, arenaStates?.[moduleId]?.config);
  const mode = platformModules?.[moduleId]?.mode || MODULE_RELEASE_MODE.OPT_IN;
  const off = (reason, missing = []) => ({ on: false, reason, mode, config, missing });

  if (!mod) return off(MODULE_OFF_REASON.UNKNOWN);
  if (!masterOn) return off(MODULE_OFF_REASON.MASTER_OFF);
  if (!isModuleReleasable(moduleId)) return off(MODULE_OFF_REASON.NOT_IMPLEMENTED);
  if (!platformModules?.[moduleId]?.released) return off(MODULE_OFF_REASON.NOT_RELEASED);

  // Ciclo em `requires` seria um erro de catálogo; em vez de estourar a pilha,
  // paramos e tratamos como dependência não satisfeita.
  if (_depth > 8) return off(MODULE_OFF_REASON.REQUIRES);

  // Família: o filho não vale sem o pai.
  if (mod.parent) {
    const parent = resolveArenaModule({
      masterOn, platformModules, arenaStates, moduleId: mod.parent, _depth: _depth + 1,
    });
    if (!parent.on) return off(MODULE_OFF_REASON.FAMILY_OFF, [mod.parent]);
  }

  // Dependências declaradas no catálogo (além do pai).
  const missing = (mod.requires || [])
    .filter((dep) => dep !== mod.parent && dep !== moduleId)
    .filter((dep) => !resolveArenaModule({
      masterOn, platformModules, arenaStates, moduleId: dep, _depth: _depth + 1,
    }).on);
  if (missing.length > 0) return off(MODULE_OFF_REASON.REQUIRES, missing);

  if (!arenaTurnedOn(moduleId, { platformModules, arenaStates })) {
    return off(MODULE_OFF_REASON.ARENA_OFF);
  }

  return { on: true, reason: MODULE_OFF_REASON.OK, mode, config, missing: [] };
}

/**
 * Monta o acesso completo de uma arena, resolvendo TODOS os módulos de uma vez.
 * É o que o hook entrega à interface: nada de resolver módulo a módulo dentro
 * de um `map` (isso multiplicaria trabalho por 45).
 *
 * @param {Object} args — mesmos de `resolveArenaModule`, sem `moduleId`
 * @returns {{
 *   isOn: (id: string) => boolean,
 *   reasonFor: (id: string) => string,
 *   configOf: (id: string) => Object,
 *   missingFor: (id: string) => string[],
 *   enabledIds: string[],
 *   releasedIds: string[],
 *   byId: Record<string, { on: boolean, reason: string, mode: string, config: Object, missing: string[] }>,
 * }}
 */
export function buildArenaModuleAccess({ masterOn, platformModules, arenaStates }) {
  const byId = {};
  listArenaModuleIds().forEach((id) => {
    byId[id] = resolveArenaModule({ masterOn, platformModules, arenaStates, moduleId: id });
  });
  const enabledIds = listArenaModuleIds().filter((id) => byId[id].on);
  return {
    byId,
    enabledIds,
    releasedIds: masterOn ? listReleasedModuleIds(platformModules) : [],
    isOn: (id) => Boolean(byId[id]?.on),
    reasonFor: (id) => byId[id]?.reason || MODULE_OFF_REASON.UNKNOWN,
    configOf: (id) => byId[id]?.config || {},
    missingFor: (id) => byId[id]?.missing || [],
  };
}

/* ------------------------------------------------------------------ */
/*  Ajudantes para a tela da ARENA (ligar/desligar com consequência)   */
/* ------------------------------------------------------------------ */

/**
 * O que precisa ser LIGADO junto quando a arena liga `moduleId`: o pai e as
 * dependências que ainda não estão ligadas, na ordem em que devem ser gravadas
 * (dependência antes de dependente).
 *
 * Não inclui o próprio módulo.
 *
 * @returns {string[]}
 */
export function modulesToEnableWith(moduleId, { platformModules, arenaStates }) {
  const seen = new Set();
  const order = [];

  const visit = (id, depth) => {
    if (depth > 8 || seen.has(id)) return;
    seen.add(id);
    const mod = getArenaModule(id);
    if (!mod) return;
    const deps = [mod.parent, ...(mod.requires || [])].filter(Boolean);
    deps.forEach((dep) => visit(dep, depth + 1));
    if (id !== moduleId && !arenaTurnedOn(id, { platformModules, arenaStates })) {
      order.push(id);
    }
  };

  visit(moduleId, 0);
  return order;
}

/**
 * O que será DESLIGADO junto quando a arena desliga `moduleId`: os filhos e
 * quem depende dele, direta ou indiretamente — mas só os que estão ligados
 * hoje (a tela precisa avisar exatamente o que vai apagar da vista).
 *
 * Não inclui o próprio módulo.
 *
 * @returns {string[]}
 */
export function modulesToDisableWith(moduleId, { platformModules, arenaStates }) {
  const dropped = new Set([moduleId]);
  // Ponto fixo: repete até nada mais cair (a cadeia é curta, no máximo 3 níveis).
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    listArenaModuleIds().forEach((id) => {
      if (dropped.has(id)) return;
      const mod = getArenaModule(id);
      const deps = [mod?.parent, ...(mod?.requires || [])].filter(Boolean);
      if (deps.some((dep) => dropped.has(dep))) {
        dropped.add(id);
        changed = true;
      }
    });
    if (!changed) break;
  }
  return listArenaModuleIds().filter(
    (id) => id !== moduleId
      && dropped.has(id)
      && Boolean(arenaStates?.[id]?.enabled),
  );
}

/**
 * Resumo para o cabeçalho das telas: quantos módulos existem, quantos a
 * plataforma liberou e quantos esta arena ligou.
 *
 * @returns {{ total: number, released: number, enabled: number, forced: number }}
 */
export function arenaModuleSummary({ masterOn, platformModules, arenaStates }) {
  const access = buildArenaModuleAccess({ masterOn, platformModules, arenaStates });
  const released = access.releasedIds;
  return {
    total: listArenaModuleIds().length,
    released: released.length,
    enabled: access.enabledIds.length,
    forced: released.filter(
      (id) => platformModules?.[id]?.mode === MODULE_RELEASE_MODE.FORCED,
    ).length,
  };
}
