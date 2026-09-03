/**
 * referralCapture — guarda o código de convite entre o clique e o cadastro.
 *
 * O caminho de uma indicação é: o amigo abre `/r/CODIGO`, decide criar conta,
 * possivelmente sai para o Google/Apple e só volta autenticado alguns
 * segundos depois. O código precisa sobreviver a esse desvio — daí o
 * armazenamento local.
 *
 * Só guarda código com formato válido, e guarda por tempo limitado: um
 * código de meses atrás não deve creditar indicação a ninguém.
 */
import { normalizeReferralCode, isValidReferralCode } from './referrals.js';

const CHAVE = 'picklerush.referral.pending';

/** Convite capturado vale por 30 dias. */
export const REFERRAL_CAPTURE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function storage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Safari em navegação privada, cookies bloqueados etc.
    return null;
  }
}

/**
 * Guarda o código clicado. Retorna o código normalizado, ou null se inválido.
 *
 * @param {string} code
 * @param {number} [now]
 * @returns {string|null}
 */
export function capturePendingReferral(code, now = Date.now()) {
  const c = normalizeReferralCode(code);
  if (!c || !isValidReferralCode(c)) return null;
  const s = storage();
  if (!s) return c; // sem storage a indicação se perde, mas o link ainda abre
  try {
    s.setItem(CHAVE, JSON.stringify({ code: c, at: now }));
  } catch {
    // cota cheia: seguir sem travar o fluxo do usuário
  }
  return c;
}

/**
 * Lê o código pendente, se ainda estiver dentro do prazo.
 *
 * @param {number} [now]
 * @returns {string|null}
 */
export function readPendingReferral(now = Date.now()) {
  const s = storage();
  if (!s) return null;
  try {
    const bruto = s.getItem(CHAVE);
    if (!bruto) return null;
    const { code, at } = JSON.parse(bruto);
    if (!code || !isValidReferralCode(code)) return null;
    if (!Number.isFinite(at) || now - at > REFERRAL_CAPTURE_TTL_MS) {
      s.removeItem(CHAVE);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

/** Limpa o código pendente (após creditar, ou ao descartar). */
export function clearPendingReferral() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(CHAVE);
  } catch {
    // nada a fazer
  }
}
