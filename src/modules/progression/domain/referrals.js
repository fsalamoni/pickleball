/**
 * Sistema de Referral (lógica pura, sem I/O).
 *
 * Cada user tem um código único de 8 chars (A-Z, 0-9) que serve como link
 * de convite. Quem entra pelo link ganha XP, e quem indicou também.
 *
 * **Recompensas**:
 *  - Indicado (quem entra): +200 XP no cadastro.
 *  - Indicador: +50 XP quando o signup é confirmado (email verificado).
 *  - Indicador: +200 XP quando o indicado joga 5+ jogos.
 *  - Indicador: +500 XP quando o indicado organiza 1 torneio.
 *  - Cap: 50 referrals válidos/mês (anti-farming).
 *
 * Aditivo. Sem I/O. Sem breaking change.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I/L
const CODE_LENGTH = 8;

const str = (v) => String(v ?? '').trim();

/**
 * Gera código de referral de 8 chars (sem chars ambíguos).
 *
 * @param {() => number} [rand] — PRNG (default Math.random)
 * @returns {string}
 */
export function generateReferralCode(rand = Math.random) {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  }
  return out;
}

/**
 * Valida formato de código de referral.
 *
 * @param {string} code
 * @returns {boolean}
 */
export function isValidReferralCode(code) {
  const c = str(code).toUpperCase();
  if (c.length !== CODE_LENGTH) return false;
  for (const ch of c) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

/**
 * Normaliza código (uppercase, trim).
 */
export function normalizeReferralCode(code) {
  return str(code).toUpperCase();
}

/**
 * Constrói a URL pública do referral.
 *
 * @param {string} origin — ex.: 'https://picklerush.web.app'
 * @param {string} code
 * @returns {string} URL `/r/:code`
 */
export function buildReferralUrl(origin, code) {
  const c = normalizeReferralCode(code);
  if (!c || !isValidReferralCode(c)) return '';
  const base = String(origin || '').replace(/\/+$/, '');
  if (!base) return `/r/${c}`;
  return `${base}/r/${c}`;
}

/**
 * Texto de compartilhamento (WhatsApp/Instagram/etc).
 *
 * @param {string} code
 * @param {string} url
 * @param {{ userName?: string, customMessage?: string }} [options]
 * @returns {string}
 */
export function buildReferralShareText(code, url, options = {}) {
  const c = normalizeReferralCode(code);
  if (!c) return '';
  const name = options.userName ? str(options.userName) : 'Eu';
  const custom = options.customMessage ? str(options.customMessage) : null;

  const lines = [
    `🏓 ${name} te convidou para o PickleRush!`,
    custom || 'Junte-se à maior plataforma de pickleball amador do Brasil.',
    '',
    `Use meu código: ${c}`,
  ];
  if (url) lines.push(url);
  lines.push('via PickleRush');
  return lines.filter(Boolean).join('\n');
}

/**
 * Status de um referral.
 */
export const REFERRAL_STATUS = Object.freeze({
  PENDING: 'pending',
  SIGNED_UP: 'signed_up',
  ACTIVATED: 'activated', // 5+ jogos
  ORGANIZER: 'organizer',  // organizou 1 torneio
  CONVERTED: 'converted',  // todas as recompensas pagas
  FRAUD: 'fraud',
});

/**
 * Recompensas por status de referral.
 */
export const REFERRAL_REWARDS = Object.freeze({
  [REFERRAL_STATUS.SIGNED_UP]: {
    referrerXp: 50,
    refereeXp: 200,
  },
  [REFERRAL_STATUS.ACTIVATED]: {
    referrerXp: 200,
    refereeXp: 0,
  },
  [REFERRAL_STATUS.ORGANIZER]: {
    referrerXp: 500,
    refereeXp: 0,
  },
});

/**
 * Cap mensal de referrals válidos (anti-farm).
 */
export const REFERRAL_MONTHLY_CAP = 50;

/**
 * Calcula status de um referral baseado em métricas do indicado.
 *
 * @param {{ games_played?: number, tournaments_organized?: number }} metrics
 * @returns {string} REFERRAL_STATUS
 */
export function computeReferralStatus(metrics = {}) {
  const games = Number(metrics.games_played) || 0;
  const tournaments = Number(metrics.tournaments_organized) || 0;
  if (tournaments >= 1) return REFERRAL_STATUS.ORGANIZER;
  if (games >= 5) return REFERRAL_STATUS.ACTIVATED;
  if (games >= 1) return REFERRAL_STATUS.SIGNED_UP;
  return REFERRAL_STATUS.PENDING;
}

/**
 * Valida input de referral.
 *
 * @param {object} input
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function validateReferralInput(input = {}) {
  const referrerUid = str(input.referrerUid);
  const refereeUid = str(input.refereeUid);
  const code = normalizeReferralCode(input.code);

  if (!code) return { valid: false, error: 'Código é obrigatório.', value: {} };
  if (!isValidReferralCode(code)) return { valid: false, error: 'Código inválido.', value: {} };
  if (referrerUid && refereeUid && referrerUid === refereeUid) {
    return { valid: false, error: 'Não pode indicar a si mesmo.', value: {} };
  }
  return {
    valid: true,
    error: null,
    value: { referrerUid, refereeUid, code },
  };
}

/**
 * Total de XP a pagar ao indicador baseado em todos os status.
 *
 * @param {Array<string>} statuses — status dos referrals
 * @returns {number}
 */
export function totalReferrerXp(statuses = []) {
  return (statuses || []).reduce((s, st) => {
    const r = REFERRAL_REWARDS[st];
    return s + (r?.referrerXp || 0);
  }, 0);
}

/**
 * Conta referrals válidos no mês (para o cap).
 *
 * @param {Array<{ created_at_ms: number, status: string }>} referrals
 * @param {Date} [now]
 * @returns {number}
 */
export function monthlyValidReferrals(referrals = [], now = new Date()) {
  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startMs = startOfMonth.getTime();
  const validStatuses = new Set([
    REFERRAL_STATUS.SIGNED_UP,
    REFERRAL_STATUS.ACTIVATED,
    REFERRAL_STATUS.ORGANIZER,
  ]);
  return (referrals || []).filter((r) => {
    if (!validStatuses.has(r.status)) return false;
    const ts = Number(r.created_at_ms) || 0;
    return ts >= startMs;
  }).length;
}

/**
 * Sugere o status final baseado no histórico.
 */
export function suggestNextReferralStatus(currentStatus, metrics) {
  return computeReferralStatus(metrics);
}
