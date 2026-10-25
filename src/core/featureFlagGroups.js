/**
 * Agrupamento das feature flags por assunto/matéria, para o painel admin
 * exibir as funcionalidades de forma organizada. Puro (sem I/O) — os grupos
 * apenas definem rótulo e ordem; a completude (renderizar TODAS as flags) é
 * garantida iterando `FEATURE_FLAG` e caindo em `other` o que não foi mapeado.
 *
 * NOTA: em 2026-10-10 as 33 flags que estavam ligadas em produção viraram
 * código permanente (`PERMANENT_FEATURE`); restam as 3 abaixo. Os helpers de
 * família da Arena V3 permanecem por compatibilidade do painel.
 */

import { FEATURE_FLAG, PERMANENT_FEATURE } from './featureFlags.js';
import { tk } from './i18n/engine.js';

/** Grupos "normais" (fora Arena V3), na ordem de exibição. */
export const FLAG_GROUPS = Object.freeze([
  {
    // O painel do grupo traz também a política do DUPR (público e envio de
    // partidas), que mora em `platform_settings/dupr_policy`.
    id: 'dupr',
    label: tk('DUPR'),
    keys: [FEATURE_FLAG.DUPR_OFFICIAL_SYNC],
  },
  {
    id: 'game_day',
    label: tk('Dia de jogo'),
    // Os formatos opcionais do dia de jogo ficam juntos, no grupo em que o
    // admin procura por eles.
    keys: [FEATURE_FLAG.GAMEDAY_MEXICANO, FEATURE_FLAG.GAMEDAY_KING_OF_COURT],
  },
  {
    id: 'marketplace',
    label: tk('Mercado'),
    keys: [FEATURE_FLAG.MARKETPLACE],
  },
  {
    id: 'federations',
    label: tk('Federações'),
    keys: [FEATURE_FLAG.FEDERATIONS, FEATURE_FLAG.CLUB_ASSOCIATION],
  },
  {
    id: 'languages',
    label: tk('Idiomas'),
    keys: [FEATURE_FLAG.MULTI_LANGUAGE],
  },
  {
    id: 'messaging',
    label: tk('Comunicações'),
    keys: [FEATURE_FLAG.EXTERNAL_MESSAGING],
  },
]);

export const FLAG_GROUP_OTHER = Object.freeze({ id: 'other', label: tk('Outras') });
export const FLAG_GROUP_ARENA_V3 = Object.freeze({ id: 'arena_v3', label: tk('Arena V3 (módulos)') });

/** Famílias das flags da Arena V3, para subdividir o grupo na página. */
export const ARENA_FAMILY_LABEL = Object.freeze({
  master: tk('Master (chave geral)'), matchmaking: tk('Matchmaking'), members: tk('Membros'),
  pdv: tk('PDV / vendas'), classes: tk('Aulas'), leagues: tk('Torneios e ligas'),
  marketing: tk('Marketing'), operations: tk('Operações'), iot: tk('IoT / sensores'),
  multi: tk('Multi-unidade'), white: tk('White label'), ai: tk('IA'), other: tk('Outros'),
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
