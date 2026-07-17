/**
 * Lógica pura de compartilhamento (sem I/O nem DOM).
 *
 * Monta as URLs públicas, o texto de divulgação e os links de
 * compartilhamento (WhatsApp / Web Share) usados pelos cards de UGC.
 * Mantida pura para ser testável e reaproveitável por qualquer tela.
 */

/** Remove barras finais para evitar `//` ao concatenar caminhos. */
function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

/**
 * URL pública (visão de espectador) de um torneio: `<origin>/p/<id>`.
 * @param {string} origin — ex.: `https://picklerush.web.app`
 * @param {string} tournamentId
 * @returns {string} URL absoluta, ou '' se faltar dado.
 */
export function buildPublicTournamentUrl(origin, tournamentId) {
  const base = trimTrailingSlash(origin);
  const id = String(tournamentId || '').trim();
  if (!base || !id) return '';
  return `${base}/p/${id}`;
}

/**
 * Texto de divulgação de um torneio, pronto para WhatsApp/Stories.
 * Inclui nome, local e código de convite quando disponíveis, e a URL pública.
 * @param {object} tournament — `{ name, city, state, invite_code }`
 * @param {string} url — URL pública já montada
 * @returns {string}
 */
export function buildTournamentShareText(tournament, url) {
  const t = tournament || {};
  const lines = [];
  lines.push(`🏓 ${String(t.name || 'Torneio de Pickleball').trim()}`);

  const place = [t.city, t.state].map((v) => String(v || '').trim()).filter(Boolean).join(' / ');
  if (place) lines.push(`📍 ${place}`);

  if (t.invite_code) lines.push(`🔑 Código de convite: ${t.invite_code}`);

  if (url) lines.push(`\nAcompanhe ao vivo: ${url}`);
  lines.push('\nvia Pickleholics');
  return lines.join('\n');
}

/**
 * Link de compartilhamento do WhatsApp com o texto pré-preenchido.
 * @param {string} text
 * @returns {string} `https://wa.me/?text=...` (ou '' se texto vazio).
 */
export function buildWhatsAppShareUrl(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  return `https://wa.me/?text=${encodeURIComponent(t)}`;
}

/**
 * Conveniência: monta de uma vez a URL pública, o texto e o link do WhatsApp
 * de um torneio. Usado pelos componentes de card.
 * @param {{ origin: string, tournament: object }} params
 * @returns {{ url: string, text: string, whatsappUrl: string }}
 */
export function buildTournamentSharePayload({ origin, tournament }) {
  const url = buildPublicTournamentUrl(origin, tournament?.id);
  const text = buildTournamentShareText(tournament, url);
  return { url, text, whatsappUrl: buildWhatsAppShareUrl(text) };
}
