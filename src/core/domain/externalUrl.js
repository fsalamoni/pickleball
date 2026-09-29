/**
 * Normalização defensiva para URLs externas clicáveis.
 *
 * React escapa texto, mas um `href="javascript:..."` vindo do banco continua
 * sendo executável se alguém clicar. Por isso qualquer link externo público
 * deve passar por este helper antes de virar `href`.
 */

function texto(value) {
  return String(value ?? '').trim();
}

function hasUnsafeWhitespaceOrControl(value) {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code <= 32 || code === 127) return true;
  }
  return false;
}

/**
 * Devolve uma URL http(s) segura para uso em `href` ou string vazia.
 *
 * @param {*} value
 * @param {{ maxLength?: number, requireHostWithDot?: boolean }} [opts]
 * @returns {string}
 */
export function safeHttpUrl(value, opts = {}) {
  const maxLength = opts.maxLength ?? 1000;
  const requireHostWithDot = opts.requireHostWithDot === true;
  const raw = texto(value);
  if (!raw || raw.length > maxLength) return '';
  if (hasUnsafeWhitespaceOrControl(raw)) return '';

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
  if (!parsed.hostname) return '';
  if (parsed.username || parsed.password) return '';
  if (requireHostWithDot && !parsed.hostname.includes('.')) return '';
  return raw;
}

export function isSafeHttpUrl(value, opts = {}) {
  return safeHttpUrl(value, opts) !== '';
}
