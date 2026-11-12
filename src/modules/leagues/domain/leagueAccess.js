/**
 * QUEM vê e QUEM cria liga — uma flag por grupo (fonte única).
 *
 * O admin da plataforma libera a criação a cada grupo com uma flag própria
 * (atletas, clubes, arenas, professores, federações). Com qualquer uma ligada a
 * área Ligas aparece para todos: uma liga de clube precisa de atletas para se
 * inscrever. O admin da plataforma vê e cria sempre.
 *
 * Aqui é o que a TELA oferece. A barreira de verdade é o servidor: toda
 * escrita da liga passa pela função `leagues` (`functions/leagues.js`), que
 * relê a flag e confere se a pessoa responde pelo clube, pela arena, pela
 * federação ou pelo perfil de professor. A cópia da tabela grupo → flag mora
 * em `functions/leaguePolicy.js`, com teste de paridade.
 */
import { tk } from '@/core/i18n';
import { staffHas } from '@/modules/federations/domain/staff';
import { LEAGUE_FLAG_BY_ORGANIZER, LEAGUE_ORGANIZER } from './leagueFlags.js';

export { LEAGUE_FLAG_BY_ORGANIZER, LEAGUE_FLAGS, LEAGUE_ORGANIZER, leaguesVisible } from './leagueFlags.js';

/** Rótulos (chaves de `t()`; a tela traduz no render). */
export const LEAGUE_ORGANIZER_LABELS = Object.freeze({
  [LEAGUE_ORGANIZER.ATHLETE]: tk('Atleta'),
  [LEAGUE_ORGANIZER.CLUB]: tk('Clube'),
  [LEAGUE_ORGANIZER.ARENA]: tk('Arena'),
  [LEAGUE_ORGANIZER.COACH]: tk('Professor'),
  [LEAGUE_ORGANIZER.FEDERATION]: tk('Federação'),
});

/** O grupo pode criar? */
export function groupCanCreate(type, flags, { isPlatformAdmin = false } = {}) {
  if (isPlatformAdmin) return Object.hasOwn(LEAGUE_FLAG_BY_ORGANIZER, type);
  const flag = LEAGUE_FLAG_BY_ORGANIZER[type];
  return Boolean(flag) && flags?.[flag] === true;
}

/**
 * Em nome de quem ESTA pessoa pode criar uma liga, já filtrado pelas flags.
 *
 * @param {object} p
 * @param {Record<string, boolean>} p.flags
 * @param {boolean} [p.isPlatformAdmin]
 * @param {{ uid: string, name?: string }} p.user
 * @param {Array<{ id: string, name?: string, my_role?: string }>} [p.clubs]  os clubes da pessoa (`listMyClubs`)
 * @param {Array<{ id: string, name?: string }>} [p.arenas]  as arenas que ela gere
 * @param {boolean} [p.isCoach]  tem perfil de professor
 * @param {Array<object>} [p.federationRoles]  os cargos dela nas federações (`listMyStaffRoles`)
 * @param {number} [p.nowMs]
 * @returns {Array<{ type: string, id: string, name: string }>}
 */
export function leagueOrganizerOptions({
  flags, isPlatformAdmin = false, user, clubs = [], arenas = [], isCoach = false, federationRoles = [], nowMs = Date.now(),
} = {}) {
  if (!user?.uid) return [];
  const pode = (type) => groupCanCreate(type, flags, { isPlatformAdmin });
  const out = [];
  if (pode(LEAGUE_ORGANIZER.ATHLETE)) out.push({ type: LEAGUE_ORGANIZER.ATHLETE, id: user.uid, name: user.name || '' });
  if (pode(LEAGUE_ORGANIZER.COACH) && isCoach) out.push({ type: LEAGUE_ORGANIZER.COACH, id: user.uid, name: user.name || '' });
  if (pode(LEAGUE_ORGANIZER.CLUB)) {
    (clubs || []).filter((c) => c?.id && c.my_role === 'admin')
      .forEach((c) => out.push({ type: LEAGUE_ORGANIZER.CLUB, id: c.id, name: c.name || '' }));
  }
  if (pode(LEAGUE_ORGANIZER.ARENA)) {
    (arenas || []).filter((a) => a?.id).forEach((a) => out.push({ type: LEAGUE_ORGANIZER.ARENA, id: a.id, name: a.name || '' }));
  }
  if (pode(LEAGUE_ORGANIZER.FEDERATION)) {
    const vistos = new Set();
    (federationRoles || [])
      .filter((r) => r?.federation_id && staffHas(r, 'competitions', nowMs))
      .forEach((r) => {
        if (vistos.has(r.federation_id)) return;
        vistos.add(r.federation_id);
        out.push({ type: LEAGUE_ORGANIZER.FEDERATION, id: r.federation_id, name: r.federation_name || r.federation_acronym || '' });
      });
  }
  return out;
}

/**
 * Esta pessoa gere a liga? Mostra a aba "Gerir". O servidor (`podeGerir`)
 * confere de novo: lista de organizadores da liga, admin da plataforma ou
 * quem responde por quem organiza (admin do clube, gestor da arena, o próprio
 * professor/atleta, a equipe de competições da federação).
 */
export function canManageLeague(league, {
  uid, isPlatformAdmin = false, clubs = [], arenas = [], federationRoles = [], nowMs = Date.now(),
} = {}) {
  if (!league || !uid) return false;
  if (isPlatformAdmin || (league.admins || []).includes(uid)) return true;
  const { type, id } = league.organizer || {};
  if (type === LEAGUE_ORGANIZER.CLUB) return (clubs || []).some((c) => c?.id === id && c.my_role === 'admin');
  if (type === LEAGUE_ORGANIZER.ARENA) return (arenas || []).some((a) => a?.id === id);
  if (type === LEAGUE_ORGANIZER.FEDERATION) {
    return (federationRoles || []).some((r) => r?.federation_id === id && staffHas(r, 'competitions', nowMs));
  }
  return false;
}
