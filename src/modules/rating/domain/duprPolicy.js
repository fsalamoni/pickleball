/**
 * Política de envio de partidas ao DUPR — QUANDO uma partida pode (ou deve) ir.
 *
 * Domínio puro (sem React/Firebase). Tem cópia no servidor
 * (`functions/duprPolicy.js`) e teste de paridade: mexer num lado só quebra o
 * teste (`functions/duprPolicy.parity.test.js`).
 *
 * A regra que o dono pediu, em três camadas:
 *  1. A PLATAFORMA (admin) liga o envio e ajusta as regras (`platform_settings/dupr_policy`).
 *  2. Torneio de simples, duplas e equipes lança SEMPRE (obrigatório); as
 *     modalidades de rotação (Americano, Mexicano, Americano em etapas) e os
 *     dias de jogo de rotação ficam a critério de QUEM CRIA (opcional,
 *     desligado por padrão). O Play não tem placar e nunca é elegível.
 *  3. Só vai ao DUPR a partida que está inteira: placar, sem empate de game,
 *     jogadores distintos e TODOS com conta DUPR habilitada (BASIC_L1).
 *
 * Aqui vive só a DECISÃO. Enviar, repetir e corrigir é do servidor.
 */

/** Chave geral do envio. `off` = nada é enviado; `manual` = vai para a fila e o admin libera; `rules` = pelas regras. */
export const DUPR_MODE = Object.freeze({ OFF: 'off', MANUAL: 'manual', RULES: 'rules' });

/** Quem enxerga a integração enquanto ela está em teste: só administradores ou todos. */
export const DUPR_AUDIENCE = Object.freeze({ ADMINS: 'admins', ALL: 'all' });

/** O que a regra de um grupo de partidas diz. */
export const DUPR_LEVEL = Object.freeze({
  REQUIRED: 'required', // lança sempre
  OPTIONAL: 'optional', // quem cria decide (ou vale o padrão)
  EXCLUDED: 'excluded', // nunca lança
  OFF: 'off',           // chave geral desligada
});

/** Os grupos de partida a que a regra se aplica. */
export const DUPR_BUCKET = Object.freeze({
  TOURNAMENT_FIXED: 'tournament_fixed',       // simples/duplas: pontos corridos, grupos, chaves, suíço
  TOURNAMENT_TEAM: 'tournament_team',         // confrontos de equipes
  TOURNAMENT_ROTATION: 'tournament_rotation', // fase Americano / Mexicano / Americano em etapas
  GAME_DAY_ROTATION: 'game_day_rotation',     // dia de jogo Americano, aprimorado, Mexicano, Rei da Quadra
  GAME_DAY_PLAY: 'game_day_play',             // Play (sem placar): nunca elegível
});

/** Grupos cuja regra o admin pode mudar (o Play é fixo: não tem placar). */
export const DUPR_CONFIGURABLE_BUCKETS = Object.freeze([
  DUPR_BUCKET.TOURNAMENT_FIXED,
  DUPR_BUCKET.TOURNAMENT_TEAM,
  DUPR_BUCKET.TOURNAMENT_ROTATION,
  DUPR_BUCKET.GAME_DAY_ROTATION,
]);

/** Fases de torneio de rotação (as duplas se formam a cada rodada). */
const ROTATION_STAGE_TYPES = Object.freeze(['americano', 'mexicano', 'americano_etapas']);

export const GRACE_MIN = 0;
export const GRACE_MAX = 24 * 60;

/** Política de fábrica — a que vale enquanto o admin não escolher nada. */
export const DEFAULT_DUPR_POLICY = Object.freeze({
  mode: DUPR_MODE.OFF,
  audience: DUPR_AUDIENCE.ADMINS,
  optional_default_on: false,
  grace_minutes: 30,
  rules: Object.freeze({
    [DUPR_BUCKET.TOURNAMENT_FIXED]: DUPR_LEVEL.REQUIRED,
    [DUPR_BUCKET.TOURNAMENT_TEAM]: DUPR_LEVEL.REQUIRED,
    [DUPR_BUCKET.TOURNAMENT_ROTATION]: DUPR_LEVEL.OPTIONAL,
    [DUPR_BUCKET.GAME_DAY_ROTATION]: DUPR_LEVEL.OPTIONAL,
  }),
});

const LEVELS_VALIDOS = [DUPR_LEVEL.REQUIRED, DUPR_LEVEL.OPTIONAL, DUPR_LEVEL.EXCLUDED];

/**
 * Lê o documento da política com tolerância: valor desconhecido cai no padrão,
 * nunca estoura. Documento ausente = padrão (envio desligado, só admin vê).
 * @param {object|null|undefined} raw
 */
export function normalizeDuprPolicy(raw) {
  const d = DEFAULT_DUPR_POLICY;
  const r = raw && typeof raw === 'object' ? raw : {};
  const rules = {};
  DUPR_CONFIGURABLE_BUCKETS.forEach((b) => {
    const v = r.rules && r.rules[b];
    rules[b] = LEVELS_VALIDOS.includes(v) ? v : d.rules[b];
  });
  const grace = Number(r.grace_minutes);
  return {
    mode: Object.values(DUPR_MODE).includes(r.mode) ? r.mode : d.mode,
    audience: r.audience === DUPR_AUDIENCE.ALL ? DUPR_AUDIENCE.ALL : DUPR_AUDIENCE.ADMINS,
    optional_default_on: r.optional_default_on === true,
    grace_minutes: Number.isFinite(grace) ? Math.min(GRACE_MAX, Math.max(GRACE_MIN, Math.round(grace))) : d.grace_minutes,
    rules,
  };
}

/**
 * A qual grupo a partida pertence. Desconhecido cai no mais cauteloso
 * (rotação = opcional), nunca no obrigatório.
 * @param {{ origin: 'tournament'|'game_day', stageType?: string, gameDayFormat?: string, teamConfrontation?: boolean }} p
 */
export function duprBucket({ origin, stageType, gameDayFormat, teamConfrontation } = {}) {
  if (origin === 'tournament') {
    if (teamConfrontation) return DUPR_BUCKET.TOURNAMENT_TEAM;
    if (ROTATION_STAGE_TYPES.includes(stageType)) return DUPR_BUCKET.TOURNAMENT_ROTATION;
    return DUPR_BUCKET.TOURNAMENT_FIXED;
  }
  if (gameDayFormat === 'play') return DUPR_BUCKET.GAME_DAY_PLAY;
  return DUPR_BUCKET.GAME_DAY_ROTATION;
}

/**
 * Decide se a partida vai ao DUPR, e por quê.
 *
 * @param {{ bucket: string, creatorChoice?: boolean|null }} partida
 *   `creatorChoice`: o que quem criou o dia/modalidade escolheu (true/false) ou
 *   `null`/ausente (não escolheu → vale o padrão do admin).
 * @param {object} policy documento bruto ou já normalizado
 * @returns {{ level: string, submit: boolean, needsApproval: boolean, reason: string }}
 */
export function duprSubmissionDecision({ bucket, creatorChoice = null } = {}, policy = null) {
  const p = normalizeDuprPolicy(policy);
  if (p.mode === DUPR_MODE.OFF) {
    return { level: DUPR_LEVEL.OFF, submit: false, needsApproval: false, reason: 'policy_off' };
  }
  if (bucket === DUPR_BUCKET.GAME_DAY_PLAY) {
    return { level: DUPR_LEVEL.EXCLUDED, submit: false, needsApproval: false, reason: 'play_no_score' };
  }
  const level = p.rules[bucket] || DUPR_LEVEL.EXCLUDED;
  let submit = false;
  let reason = 'excluded_by_rule';
  if (level === DUPR_LEVEL.REQUIRED) {
    submit = true;
    reason = 'required';
  } else if (level === DUPR_LEVEL.OPTIONAL) {
    if (creatorChoice === true) { submit = true; reason = 'creator_on'; }
    else if (creatorChoice === false) { submit = false; reason = 'creator_off'; }
    else if (p.optional_default_on) { submit = true; reason = 'default_on'; }
    else { submit = false; reason = 'default_off'; }
  }
  return { level, submit, needsApproval: submit && p.mode === DUPR_MODE.MANUAL, reason };
}

/** Por que a partida NÃO está inteira para ir ao DUPR (lista vazia = pode). */
export const DUPR_MATCH_PROBLEM = Object.freeze({
  NO_PLAYERS: 'no_players',
  UNEVEN_SIDES: 'uneven_sides',
  TOO_MANY_PLAYERS: 'too_many_players',
  REPEATED_PLAYER: 'repeated_player',
  NO_SCORE: 'no_score',
  TIED_GAME: 'tied_game',
  WINNER_MISMATCH: 'winner_mismatch',
});

/**
 * A partida tem o que o DUPR exige? Só estrutura e placar — a situação das
 * contas DUPR dos jogadores é `duprReadiness`.
 *
 * @param {{ side_a: string[], side_b: string[], games: Array<{a:number,b:number}>, winner?: 'a'|'b'|null }} m
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function duprMatchEligibility(m) {
  const problems = [];
  const a = Array.isArray(m?.side_a) ? m.side_a : [];
  const b = Array.isArray(m?.side_b) ? m.side_b : [];
  if (a.length === 0 || b.length === 0 || a.some((u) => !u) || b.some((u) => !u)) problems.push(DUPR_MATCH_PROBLEM.NO_PLAYERS);
  else {
    if (a.length !== b.length) problems.push(DUPR_MATCH_PROBLEM.UNEVEN_SIDES);
    if (a.length > 2 || b.length > 2) problems.push(DUPR_MATCH_PROBLEM.TOO_MANY_PLAYERS);
    if (new Set([...a, ...b]).size !== a.length + b.length) problems.push(DUPR_MATCH_PROBLEM.REPEATED_PLAYER);
  }
  const games = (Array.isArray(m?.games) ? m.games : [])
    .map((g) => ({ a: Number(g?.a), b: Number(g?.b) }))
    .filter((g) => Number.isFinite(g.a) && Number.isFinite(g.b));
  if (games.length === 0 || games.every((g) => g.a === 0 && g.b === 0)) problems.push(DUPR_MATCH_PROBLEM.NO_SCORE);
  else {
    if (games.some((g) => g.a === g.b)) problems.push(DUPR_MATCH_PROBLEM.TIED_GAME);
    const wa = games.filter((g) => g.a > g.b).length;
    const wb = games.filter((g) => g.b > g.a).length;
    if ((m.winner === 'a' && wa <= wb) || (m.winner === 'b' && wb <= wa)) problems.push(DUPR_MATCH_PROBLEM.WINNER_MISMATCH);
  }
  return { ok: problems.length === 0, problems };
}

/** A assinatura que o DUPR exige para enviar partida. */
export const DUPR_REQUIRED_ENTITLEMENT = 'BASIC_L1';

/**
 * Quem ainda não pode ser enviado: sem conta DUPR vinculada, ou com ela mas
 * sem a assinatura básica. `links` é um mapa uid → vínculo (`dupr_links`).
 *
 * @param {string[]} uids
 * @param {Record<string, { dupr_id?: string, entitlements?: string[] }>} links
 * @returns {{ ok: boolean, missing: string[], noEntitlement: string[] }}
 */
export function duprReadiness(uids, links) {
  const map = links && typeof links === 'object' ? links : {};
  const missing = [];
  const noEntitlement = [];
  (Array.isArray(uids) ? uids : []).forEach((uid) => {
    const l = map[uid];
    if (!l || !l.dupr_id) { missing.push(uid); return; }
    const ents = (Array.isArray(l.entitlements) ? l.entitlements : []).map((e) => String(e).toUpperCase());
    if (!ents.includes(DUPR_REQUIRED_ENTITLEMENT)) noEntitlement.push(uid);
  });
  return { ok: missing.length === 0 && noEntitlement.length === 0, missing, noEntitlement };
}

/** Origens do identificador (curtas: o DUPR guarda o texto). */
export const DUPR_ID_KIND = Object.freeze({ TOURNAMENT_MATCH: 'tm', GAME_DAY_GAME: 'gd' });

/**
 * Identificador ÚNICO e determinístico da partida no DUPR: o mesmo jogo sempre
 * gera o mesmo texto, e é isso que impede duplicar um envio.
 */
export function duprIdentifier(kind, id) {
  const limpo = String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  if (!limpo || !Object.values(DUPR_ID_KIND).includes(kind)) return null;
  return `pr:${kind}:${limpo}`;
}
