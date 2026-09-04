/**
 * Social Bonds (lógica pura, sem I/O).
 *
 * Inclui:
 *  - **Rivals**: até 5 rivais por user, comparação por rating.
 *  - **Crews**: até 8 atletas por crew, estatísticas agregadas.
 *  - **Mentorias**: 1 mentor + até 2 aprendizes, metas semanais.
 *
 * Aditivo. Sem I/O. Sem breaking change.
 */

const str = (v) => String(v ?? '').trim();

// ────────────────────────────────────────────────────────────────────────────
// RIVALS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Limites do sistema de Rivals.
 */
export const RIVALS_MAX = 5;
export const RIVALS_DEFAULT_RATING_DIFF = 200;

/**
 * ID determinístico de um rival.
 */
export function rivalId(uid, rivalUid) {
  return `${str(uid)}_${str(rivalUid)}`;
}

/**
 * Sugere rivais baseado em proximidade de rating e cidade/região.
 *
 * @param {{
 *   me: { uid, rating, city, state },
 *   candidates: Array<{ uid, rating, city, state }>,
 *   options?: { max?: number, maxRatingDiff?: number }
 * }} params
 * @returns {Array<{ uid, rating, ratingDiff, sameCity, sameState }>}
 */
export function suggestRivals({ me, candidates, options = {} }) {
  const max = options.max || RIVALS_MAX;
  const maxDiff = options.maxRatingDiff || RIVALS_DEFAULT_RATING_DIFF;
  const myRating = Number(me?.rating) || 0;
  const myCity = str(me?.city).toLowerCase();
  const myState = str(me?.state).toLowerCase();
  return (candidates || [])
    .filter((c) => c && c.uid && c.uid !== me?.uid)
    .map((c) => {
      const diff = Math.abs((Number(c.rating) || 0) - myRating);
      const sameCity = !!myCity && str(c.city).toLowerCase() === myCity;
      const sameState = !!myState && str(c.state).toLowerCase() === myState;
      return { ...c, ratingDiff: diff, sameCity, sameState };
    })
    .filter((c) => c.ratingDiff <= maxDiff)
    .sort((a, b) => {
      if (a.sameCity !== b.sameCity) return a.sameCity ? -1 : 1;
      if (a.sameState !== b.sameState) return a.sameState ? -1 : 1;
      return a.ratingDiff - b.ratingDiff;
    })
    .slice(0, max);
}

/**
 * H2H resumido entre eu e um rival.
 */
export function summarizeH2H(myRecord, rivalRecord) {
  const myWins = Number(myRecord?.wins) || 0;
  const rivalWins = Number(rivalRecord?.wins) || 0;
  return {
    myWins,
    rivalWins,
    total: myWins + rivalWins,
    myWinRate: myWins + rivalWins > 0 ? myWins / (myWins + rivalWins) : null,
    leader: myWins > rivalWins ? 'me' : (rivalWins > myWins ? 'rival' : 'tied'),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// CREWS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Limites de Crew.
 */
export const CREW_MAX_MEMBERS = 8;
export const CREW_MAX_CREWS_PER_USER = 3;

/**
 * ID determinístico de crew.
 */
export function crewId(name) {
  return 'crew_' + str(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

/**
 * Stats agregadas de uma crew a partir dos jogos de cada membro.
 *
 * @param {Array<{ uid, games: Array<{ won: boolean, pointsFor: number, pointsAgainst: number }> }>} memberGames
 * @returns {{
 *   totalGames: number, totalWins: number, totalLosses: number,
 *   winRate: number|null, pointsFor: number, pointsAgainst: number, diff: number
 * }}
 */
export function aggregateCrewStats(memberGames = []) {
  const list = memberGames || [];
  let totalGames = 0, totalWins = 0, pointsFor = 0, pointsAgainst = 0;
  for (const m of list) {
    if (!m || !Array.isArray(m.games)) continue;
    for (const g of m.games) {
      if (!g) continue;
      totalGames += 1;
      if (g.won) totalWins += 1;
      pointsFor += Number(g.pointsFor) || 0;
      pointsAgainst += Number(g.pointsAgainst) || 0;
    }
  }
  const totalLosses = totalGames - totalWins;
  return {
    totalGames,
    totalWins,
    totalLosses,
    winRate: totalGames > 0 ? totalWins / totalGames : null,
    pointsFor,
    pointsAgainst,
    diff: pointsFor - pointsAgainst,
  };
}

/**
 * Valida input de crew.
 */
export function validateCrewInput(input = {}) {
  const name = str(input.name);
  if (!name || name.length < 3 || name.length > 40) {
    return { valid: false, error: 'Nome deve ter entre 3 e 40 caracteres.', value: {} };
  }
  const members = Array.isArray(input.members) ? input.members.filter(Boolean) : [];
  if (members.length > CREW_MAX_MEMBERS) {
    return { valid: false, error: `Crew suporta no máximo ${CREW_MAX_MEMBERS} membros.`, value: {} };
  }
  return {
    valid: true,
    error: null,
    value: { name, members, owner: str(input.owner), id: crewId(name) },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// MENTORSHIP
// ────────────────────────────────────────────────────────────────────────────

/**
 * Limites de Mentoria.
 */
export const MENTOR_MAX_APPRENTICES = 2;
export const MENTOR_MIN_LEVEL = 'intermediario'; // 3.0+

/**
 * ID determinístico de mentoria.
 */
export function mentorshipId(mentorId, apprenticeId) {
  return `${str(mentorId)}_${str(apprenticeId)}`;
}

/**
 * Valida input de mentoria.
 */
export function validateMentorshipInput(input = {}) {
  const mentorUid = str(input.mentorUid);
  const apprenticeUid = str(input.apprenticeUid);
  if (!mentorUid || !apprenticeUid) {
    return { valid: false, error: 'Mentor e aprendiz são obrigatórios.', value: {} };
  }
  if (mentorUid === apprenticeUid) {
    return { valid: false, error: 'Não pode ser mentor de si mesmo.', value: {} };
  }
  return {
    valid: true,
    error: null,
    value: {
      id: mentorshipId(mentorUid, apprenticeUid),
      mentorUid,
      apprenticeUid,
      startedAt: Number(input.startedAt) || Date.now(),
      active: input.active !== false,
    },
  };
}

/**
 * Progresso das metas semanais do aprendiz.
 *
 * @param {Array<{ metric: string, target: number, current: number }>} goals
 * @returns {{ done: number, total: number, ratio: number }}
 */
export function apprenticeshipProgress(goals = []) {
  const list = goals || [];
  const total = list.length;
  const done = list.filter((g) => (Number(g.current) || 0) >= (Number(g.target) || 0)).length;
  return { done, total, ratio: total > 0 ? done / total : 0 };
}

/**
 * XP bônus pago ao mentor quando o aprendiz atinge meta.
 */
export const MENTOR_XP_BONUS_PER_GOAL = 100;

/**
 * XP bônus pago ao aprendiz quando atinge meta.
 */
export const APPRENTICE_XP_BONUS_PER_GOAL = 200;
