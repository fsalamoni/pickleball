/**
 * Mensagem do login (SSO) do DUPR. O iframe avisa o navegador com `postMessage`
 * e a mensagem carrega os tokens da pessoa — por isso SÓ vale se vier do
 * endereço do DUPR e da janela do nosso iframe. Qualquer outra página que
 * consiga postar mensagem aqui não pode passar por login do DUPR.
 */

/** Origem (esquema + domínio) de uma URL; '' se não for URL. */
export function originOf(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

/**
 * Lê a mensagem do SSO. Devolve `{ accessToken, refreshToken, duprId }` ou null.
 * @param {{ origin?: string, source?: unknown, data?: unknown }} event
 * @param {{ ssoOrigin: string, frameWindow: unknown }} esperado
 */
export function parseSsoMessage(event, { ssoOrigin, frameWindow }) {
  if (!event || !ssoOrigin || event.origin !== ssoOrigin) return null;
  if (!frameWindow || event.source !== frameWindow) return null;
  let data = event.data;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return null; } }
  if (!data || typeof data !== 'object') return null;
  const accessToken = typeof data.userToken === 'string' ? data.userToken.trim() : '';
  const refreshToken = typeof data.refreshToken === 'string' ? data.refreshToken.trim() : '';
  if (!accessToken || !refreshToken) return null;
  // O ID que o navegador "informa" é só dica de tela: o servidor confirma pelo DUPR.
  const duprId = data.duprId != null ? String(data.duprId).trim().toUpperCase() : '';
  return { accessToken, refreshToken, duprId };
}
