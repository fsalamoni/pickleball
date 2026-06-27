/**
 * Catálogo de eventos de funil (lógica pura, sem I/O).
 *
 * Nomes estáveis e snake_case para o Firebase Analytics. Mantidos em um único
 * lugar para evitar divergência entre os pontos de instrumentação.
 */

export const FUNNEL_EVENT = Object.freeze({
  LOGIN: 'funnel_login',
  PROFILE_COMPLETED: 'funnel_profile_completed',
  TOURNAMENT_CREATED: 'funnel_tournament_created',
  REGISTRATION_CREATED: 'funnel_registration_created',
  OPEN_GAME_CREATED: 'funnel_open_game_created',
});

/**
 * Sanitiza os parâmetros de um evento: mantém só valores primitivos (string,
 * number, boolean), descarta nulos/objetos e limita strings. Evita enviar
 * dados pesados ou indefinidos ao Analytics.
 * @param {Record<string, unknown>} [params]
 * @returns {Record<string, string|number|boolean>}
 */
export function sanitizeFunnelParams(params = {}) {
  const out = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (typeof value === 'string') out[key] = value.slice(0, 100);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
  });
  return out;
}
