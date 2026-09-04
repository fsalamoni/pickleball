/**
 * Kudos (lógica pura, sem I/O).
 *
 * Kudos = um "👏" dado por um user a outro, ou a um recurso (post, jogo,
 * conquista, etc). É o "like" universal da plataforma.
 *
 * **Regras**:
 *  - 1 user pode dar 1 kudos por item (target).
 *  - Quem recebe: +1 XP (cap 100/dia).
 *  - Quem dá: +0,5 XP (cap 50/dia). Não há contagem em kudos
 *    individuais — vale o gesto.
 *  - Auto-farming: detector de padrão suspeito (mesmo user dando kudos
 *    pro mesmo target repetido).
 *
 * Aditivo. Sem I/O. Sem breaking change.
 */

const str = (v) => String(v ?? '').trim();

/**
 * Tipos de recurso que podem receber kudos.
 */
export const KUDOS_TARGET_TYPE = Object.freeze({
  PROFILE: 'profile',
  GAME: 'game',
  TOURNAMENT: 'tournament',
  POST: 'post',
  PHOTO: 'photo',
  ACHIEVEMENT: 'achievement',
  REVIEW: 'review',
});

/**
 * Recompensas de XP.
 */
export const KUDOS_XP = Object.freeze({
  RECEIVE_PER_KUDO: 1,
  RECEIVE_DAILY_CAP: 100,
  GIVE_PER_KUDO: 1,        // arredondado de 0.5
  GIVE_DAILY_CAP: 50,
});

/**
 * Janela para "spam" do mesmo target (em horas).
 */
const KUDOS_WINDOW_HOURS = 24;

/**
 * ID determinístico de um kudos.
 * Formato: `{fromUid}_{toUid}_{targetType}_{targetId}`.
 */
export function kudosId(fromUid, toUid, targetType, targetId) {
  return `${str(fromUid)}_${str(toUid)}_${str(targetType)}_${str(targetId)}`;
}

/**
 * Valida o input de um kudos.
 *
 * @param {object} input
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function validateKudosInput(input = {}) {
  const fromUid = str(input.fromUid);
  const toUid = str(input.toUid);
  const targetType = str(input.targetType);
  const targetId = str(input.targetId);

  if (!fromUid) return { valid: false, error: 'fromUid é obrigatório.', value: {} };
  if (!toUid) return { valid: false, error: 'toUid é obrigatório.', value: {} };
  if (fromUid === toUid) return { valid: false, error: 'Não pode dar kudos a si mesmo.', value: {} };
  if (!Object.values(KUDOS_TARGET_TYPE).includes(targetType)) {
    return { valid: false, error: 'targetType inválido.', value: {} };
  }
  if (!targetId) return { valid: false, error: 'targetId é obrigatório.', value: {} };

  return {
    valid: true,
    error: null,
    value: {
      id: kudosId(fromUid, toUid, targetType, targetId),
      fromUid,
      toUid,
      targetType,
      targetId,
      ts: Number(input.ts) || Date.now(),
    },
  };
}

/**
 * XP que o receptor ganha por kudos (com cap diário).
 *
 * @param {number} totalKudosReceived — kudos recebidos no dia
 * @param {number} delta — quantos kudos foram dados agora
 * @returns {{ xpGained: number, capped: boolean, newTotal: number }}
 */
export function receiveKudosXp(totalKudosReceived, delta = 1) {
  const current = Math.max(0, Number(totalKudosReceived) || 0);
  const d = Math.max(0, Number(delta) || 0);
  const xpGainedRaw = d * KUDOS_XP.RECEIVE_PER_KUDO;
  const room = Math.max(0, KUDOS_XP.RECEIVE_DAILY_CAP - current);
  const xpGained = Math.min(xpGainedRaw, room);
  return {
    xpGained,
    capped: xpGained < xpGainedRaw,
    newTotal: current + xpGained,
  };
}

/**
 * XP que o doador ganha (com cap diário).
 *
 * @param {number} totalKudosGiven
 * @param {number} delta
 * @returns {{ xpGained: number, capped: boolean, newTotal: number }}
 */
export function giveKudosXp(totalKudosGiven, delta = 1) {
  const current = Math.max(0, Number(totalKudosGiven) || 0);
  const d = Math.max(0, Number(delta) || 0);
  const xpGainedRaw = d * KUDOS_XP.GIVE_PER_KUDO;
  const room = Math.max(0, KUDOS_XP.GIVE_DAILY_CAP - current);
  const xpGained = Math.min(xpGainedRaw, room);
  return {
    xpGained,
    capped: xpGained < xpGainedRaw,
    newTotal: current + xpGained,
  };
}

/**
 * Detecta "spam" — múltiplos kudos do mesmo user pro mesmo target dentro
 * de uma janela de horas.
 *
 * @param {Array<{ fromUid: string, targetId: string, ts: number }>} kudos
 * @param {{ windowHours?: number, threshold?: number }} [options]
 * @returns {boolean}
 */
export function detectKudosSpam(kudos, options = {}) {
  const windowHours = options.windowHours || KUDOS_WINDOW_HOURS;
  const threshold = options.threshold || 3;
  const windowMs = windowHours * 60 * 60 * 1000;
  const now = Date.now();
  const fromByTarget = new Map();
  for (const k of kudos || []) {
    if (!k || !k.fromUid || !k.targetId) continue;
    const ts = Number(k.ts) || 0;
    if (now - ts > windowMs) continue;
    const key = `${k.fromUid}::${k.targetId}`;
    fromByTarget.set(key, (fromByTarget.get(key) || 0) + 1);
  }
  for (const count of fromByTarget.values()) {
    if (count >= threshold) return true;
  }
  return false;
}

/**
 * Resumo de kudos (para UI).
 *
 * @param {Array} kudos
 * @returns {{ total: number, today: number, byTargetType: object }}
 */
export function summarizeKudos(kudos = [], now = Date.now()) {
  const list = kudos || [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const byTargetType = {};
  let todayCount = 0;
  for (const k of list) {
    if (!k) continue;
    byTargetType[k.targetType] = (byTargetType[k.targetType] || 0) + 1;
    if (Number(k.ts) >= todayMs) todayCount += 1;
  }
  return { total: list.length, today: todayCount, byTargetType };
}
