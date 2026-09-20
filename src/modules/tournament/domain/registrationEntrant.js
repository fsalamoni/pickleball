/**
 * Inscrição → "entrant", o formato que os motores de fase consomem.
 *
 * Existia uma cópia disto em cada lugar que precisava traduzir uma inscrição
 * fora do serviço (o painel de entrada direta, a prévia da próxima fase). Cópia
 * que diverge aqui é grave e silenciosa: o `strength` é o que ordena os cabeças,
 * então uma tela ordenaria diferente da outra sem erro nenhum na tela.
 */

import { combinedStrength } from './seeding.js';

/**
 * @param {object} reg inscrição
 * @param {{ isTeam?: boolean }} [options]
 * @returns {{ id: string, members: string[], label: string, strength: number }}
 */
export function registrationToEntrant(reg, { isTeam = false } = {}) {
  if (isTeam || reg?.kind === 'team') {
    return {
      id: reg.id,
      members: [reg.id],
      label: reg.team_name || reg.label || reg.id,
      strength: -1,
    };
  }
  return {
    id: reg.id,
    members: [reg.id],
    label: reg.label || reg.player_a_name || reg.id,
    strength: combinedStrength({
      level: reg.player_a_level || null,
      partner_level: reg.player_b_level || null,
    }),
  };
}

/** Lista de inscrições → entrants, na mesma ordem. */
export function registrationsToEntrants(registrations = [], options = {}) {
  return registrations.map((r) => registrationToEntrant(r, options));
}
