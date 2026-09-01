/**
 * XP Ledger (lógica pura, sem I/O).
 *
 * **O QUE É**:
 * Sistema de log de eventos de XP. Cada vez que algo acontece (jogo,
 * torneio, follow, kudos, etc), um evento é gerado com a fonte e a
 * quantidade. O ledger é a fonte de verdade para calcular XP total,
 * XP por trilha (skill tree) e detectar padrões.
 *
 * **POR QUÊ**:
 *  - O cálculo atual (`buildPlayerStats` → `computeXp`) é agregado e
 *    não rastreável. Não dá pra saber "quando" ou "por que" o XP
 *    mudou.
 *  - O ledger permite: reverter (refund), auditoria, anti-cheat
 *    (detectar farming), analytics.
 *
 * **NÃO MUDA**:
 *  - O `summary` V1 continua sendo a fonte de verdade para a UI V1.
 *  - O ledger é **aditivo**: novos documentos, nova coleção.
 *
 * Aditivo. Sem I/O. Sem breaking change.
 */

import { XP_WEIGHTS_V2, computeXpV2 } from './progressionV2.js';

const str = (v) => String(v ?? '').trim();

/**
 * @typedef {Object} XpEvent
 * @property {string} id         — ID determinístico `{uid}_{ts}_{source}`
 * @property {string} uid        — user id
 * @property {string} source     — chave em XP_WEIGHTS_V2
 * @property {number} count      — unidades (ex: 1 jogo, 10 kudos)
 * @property {number} amount     — XP (count * weight)
 * @property {number} ts         — ms
 * @property {string} [refType]  — tipo de referência ('game'|'tournament'|...)
 * @property {string} [refId]    — id do documento referenciado
 * @property {object} [meta]     — dados extras
 */

/** Tipos de referência aceitos. */
export const XP_REF_TYPE = Object.freeze({
  GAME: 'game',
  TOURNAMENT: 'tournament',
  REGISTRATION: 'tournament_registration',
  CLUB: 'club',
  CLUB_EVENT: 'club_event',
  ARENA_BOOKING: 'arena_booking',
  ARENA_REVIEW: 'arena_review',
  COACH_LESSON: 'coach_lesson',
  COACH_CLINIC: 'coach_clinic',
  COACH_PACKAGE: 'coach_package',
  FOLLOW: 'follow',
  KUDOS: 'kudos',
  POST: 'post',
  PROFILE: 'profile',
  REFERRAL: 'referral',
  ONBOARDING: 'onboarding',
  MISSION: 'mission',
  STREAK: 'streak',
  MISC: 'misc',
});

/**
 * Valida um evento de XP.
 *
 * @param {object} input
 * @returns {{ valid: boolean, error: string|null, value: XpEvent|null }}
 */
export function validateXpEvent(input = {}) {
  const uid = str(input.uid);
  if (!uid) return { valid: false, error: 'uid é obrigatório.', value: null };

  const source = str(input.source);
  if (!source) return { valid: false, error: 'source é obrigatório.', value: null };
  if (XP_WEIGHTS_V2[source] === undefined) {
    return { valid: false, error: `source desconhecido: ${source}`, value: null };
  }

  const count = Number(input.count);
  if (!Number.isFinite(count) || count === 0) {
    return { valid: false, error: 'count deve ser número não-zero.', value: null };
  }

  const weight = XP_WEIGHTS_V2[source];
  const amount = count * weight;
  const ts = Number(input.ts) || Date.now();

  const id = str(input.id) || `${uid}_${ts}_${source}`;

  const refType = input.refType && Object.values(XP_REF_TYPE).includes(input.refType)
    ? input.refType
    : null;
  const refId = refType ? str(input.refId) : null;

  return {
    valid: true,
    error: null,
    value: {
      id,
      uid,
      source,
      count,
      amount,
      ts,
      refType,
      refId,
      meta: input.meta && typeof input.meta === 'object' ? input.meta : null,
    },
  };
}

/**
 * Agrega uma lista de eventos por fonte.
 *
 * @param {XpEvent[]} events
 * @returns {Record<string, number>} xpBySource (em unidades, não XP)
 */
export function eventsToXpBySource(events = []) {
  const out = {};
  for (const e of events || []) {
    if (!e || !e.source) continue;
    const source = String(e.source);
    const count = Number(e.count) || 0;
    if (count === 0) continue;
    out[source] = (out[source] || 0) + count;
  }
  return out;
}

/**
 * Converte lista de eventos em XP total + breakdown por source (em XP, não unidades).
 *
 * @param {XpEvent[]} events
 * @param {{ applyCaps?: boolean, now?: Date }} [options]
 * @returns {{ xpTotal: number, xpBySource: object, capped?: object }}
 */
export function computeXpFromEvents(events, options = {}) {
  const map = eventsToXpBySource(events);
  return computeXpV2(map, options);
}

/**
 * Filtra eventos por usuário.
 *
 * @param {XpEvent[]} events
 * @param {string} uid
 * @returns {XpEvent[]}
 */
export function eventsForUser(events, uid) {
  const target = str(uid);
  if (!target) return [];
  return (events || []).filter((e) => e && e.uid === target);
}

/**
 * Filtra eventos por janela de tempo.
 *
 * @param {XpEvent[]} events
 * @param {number} fromMs
 * @param {number} toMs
 * @returns {XpEvent[]}
 */
export function eventsInRange(events, fromMs, toMs) {
  return (events || []).filter((e) => {
    const t = Number(e?.ts) || 0;
    return t >= fromMs && t <= toMs;
  });
}

/**
 * Detecta farming: muitos eventos do mesmo source em pouco tempo.
 *
 * @param {XpEvent[]} events
 * @param {{ windowMs?: number, threshold?: number }} [options]
 * @returns {Array<{ source: string, count: number, windowMs: number }>}
 */
export function detectFarming(events = [], options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 min default
  const threshold = options.threshold || 10;     // 10 eventos
  const flags = [];

  const bySource = {};
  for (const e of events || []) {
    if (!e || !e.source) continue;
    if (!bySource[e.source]) bySource[e.source] = [];
    bySource[e.source].push(Number(e.ts) || 0);
  }

  for (const [source, times] of Object.entries(bySource)) {
    times.sort((a, b) => a - b);
    let i = 0;
    let maxCount = 0;
    for (let j = 0; j < times.length; j += 1) {
      while (times[j] - times[i] > windowMs) i += 1;
      maxCount = Math.max(maxCount, j - i + 1);
    }
    if (maxCount >= threshold) {
      flags.push({ source, count: maxCount, windowMs });
    }
  }

  return flags;
}

/**
 * Constrói ID determinístico para um evento de XP.
 *
 * @param {string} uid
 * @param {number} ts
 * @param {string} source
 * @param {string} [refId] — opcional, para evitar duplicatas
 * @returns {string}
 */
export function xpEventId(uid, ts, source, refId = '') {
  const u = str(uid);
  const s = str(source);
  const t = Number(ts) || Date.now();
  const r = str(refId);
  return r ? `${u}_${t}_${s}_${r}` : `${u}_${t}_${s}`;
}
