/**
 * Agrupamento das feature flags por assunto/matéria, para o painel admin
 * exibir as funcionalidades de forma organizada. Puro (sem I/O) — os grupos
 * apenas definem rótulo e ordem; a completude (renderizar TODAS as flags) é
 * garantida iterando `FEATURE_FLAG` e caindo em `other` o que não foi mapeado.
 *
 * NOTA: a maioria das flags virou código permanente; resta apenas a flag
 * reservada abaixo. Os helpers de família da Arena V3 permanecem por
 * compatibilidade do painel (não classificam mais nada por ora).
 */

import { FEATURE_FLAG } from './featureFlags.js';

/** Grupos "normais" (fora Arena V3), na ordem de exibição. */
export const FLAG_GROUPS = Object.freeze([
  {
    id: 'engagement',
    label: 'Engajamento e retenção',
    keys: [
      FEATURE_FLAG.ACTION_HOME, FEATURE_FLAG.SMART_MATCHMAKING,
      FEATURE_FLAG.POST_GAME_FLOW, FEATURE_FLAG.PUSH_NOTIFICATIONS,
    ],
  },
  {
    id: 'athlete',
    label: 'Atleta, rating e social',
    keys: [FEATURE_FLAG.DUPR_OFFICIAL_SYNC],
  },
]);

export const FLAG_GROUP_OTHER = Object.freeze({ id: 'other', label: 'Outras' });
export const FLAG_GROUP_ARENA_V3 = Object.freeze({ id: 'arena_v3', label: 'Arena V3 (módulos)' });

/** Famílias das flags da Arena V3, para subdividir o grupo na página. */
export const ARENA_FAMILY_LABEL = Object.freeze({
  master: 'Master (chave geral)', matchmaking: 'Matchmaking', members: 'Membros',
  pdv: 'PDV / vendas', classes: 'Aulas', leagues: 'Torneios e ligas',
  marketing: 'Marketing', operations: 'Operações', iot: 'IoT / sensores',
  multi: 'Multi-unidade', white: 'White label', ai: 'IA', other: 'Outros',
});

/** Retorna a família de uma flag de arena (ex.: 'matchmaking'), ou null. */
export function arenaFlagFamily(key) {
  const k = String(key);
  if (k === 'arena_modules') return 'master';
  const m = k.match(/^arena_module_([a-z]+)/);
  return m ? m[1] : null;
}

/**
 * Rótulo legível para qualquer flag, para exibir no painel: usa a família +
 * o restante do nome quando for flag de arena (ex.: `arena_module_pdv_split`
 * → "PDV / vendas · split"). Para flags comuns, humaniza a chave.
 */
export function humanizeFlagKey(key) {
  const family = arenaFlagFamily(key);
  if (family) {
    if (key === 'arena_modules') return 'Arena V3 — chave geral (master)';
    const rest = String(key).replace(/^arena_module_[a-z]+_?/, '').replace(/_/g, ' ').trim();
    const fam = ARENA_FAMILY_LABEL[family] || family;
    return rest ? `${fam} · ${rest}` : fam;
  }
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Retorna o id do grupo de uma flag. Arena V3 e desconhecidas têm tratamento próprio. */
export function flagGroupId(key) {
  if (key === 'arena_modules' || String(key).startsWith('arena_module_')) return FLAG_GROUP_ARENA_V3.id;
  for (const g of FLAG_GROUPS) {
    if (g.keys.includes(key)) return g.id;
  }
  return FLAG_GROUP_OTHER.id;
}

/**
 * Agrupa TODAS as flags (valores de FEATURE_FLAG) por grupo, garantindo que
 * nenhuma fique de fora. Retorna { groupId: [flagKey, ...] }.
 */
export function bucketAllFlags() {
  const buckets = {};
  Object.values(FEATURE_FLAG).forEach((key) => {
    const g = flagGroupId(key);
    (buckets[g] ||= []).push(key);
  });
  return buckets;
}
