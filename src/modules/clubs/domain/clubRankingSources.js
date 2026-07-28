/**
 * Domínio puro — agregação de fontes para o ranking interno do clube
 * (Wave C.2). Dado um conjunto de UIDs de atletas do clube e listas
 * materializadas de jogos de várias origens, devolve a lista unificada
 * (e deduplicada) de jogos que envolvem pelo menos um atleta do clube.
 *
 * Fontes suportadas (todas opcionais):
 *  1. **Jogos do próprio clube** (`club_games`) — sempre do clube.
 *  2. **`club_event_games` publicados em outros clubes** (Wave C) —
 *     jogos decididos de dias de jogo de outros clubes onde um atleta
 *     do clube participou.
 *  3. **`tournament_matches`** — jogos de torneios em que um atleta
 *     do clube participou (qualquer torneio da plataforma).
 *
 * Formato normalizado esperado em todas as fontes:
 *   { side_a: [uid, ...], side_b: [uid, ...], winner: 'a'|'b',
 *     points_a, points_b, source?, id?, at? }
 *
 * Sem I/O. Para os casos onde os lados estão como **objetos**
 * `{ id, name, user_id }` (formato do `gameDayOrganizer`),
 * o utilitário `flattenSideToUids` converte para uma lista de uids.
 */

const TOURNAMENT_SIDE_KEYS = ['side_a_ids', 'side_b_ids'];

/**
 * Converte um lado de jogo (lista de objetos com `user_id`/`id`, ou já
 * uma lista de strings) numa lista de uids limpos.
 * @param {Array} side
 * @returns {string[]}
 */
export function flattenSideToUids(side) {
  if (!Array.isArray(side)) return [];
  return side
    .map((p) => {
      if (p == null) return null;
      if (typeof p === 'string') return p;
      return p.user_id || p.id || null;
    })
    .filter(Boolean);
}

/** Normaliza um jogo para o formato padrão (uids, winner, points). */
export function normalizeMatch(match) {
  if (!match) return null;
  const points_a = Number(match.score_a ?? match.points_a) || 0;
  const points_b = Number(match.score_b ?? match.points_b) || 0;
  // Winner: prefere winner_side/winner explícito; senão infere pelo placar.
  let winner = match.winner_side || match.winner || null;
  if (winner !== 'a' && winner !== 'b' && points_a !== points_b) {
    winner = points_a > points_b ? 'a' : 'b';
  }
  // Lados já como uids (side_a_ids/side_b_ids) — formato de
  // tournament_matches e club_event_games.
  if (Array.isArray(match.side_a_ids) || Array.isArray(match.side_b_ids)) {
    return {
      id: match.id || null,
      source: match.source || 'tournament_match',
      side_a: flattenSideToUids(match.side_a_ids),
      side_b: flattenSideToUids(match.side_b_ids),
      winner,
      points_a,
      points_b,
      at: match.at || null,
    };
  }
  // Lados como objetos (formato do gameDayOrganizer / useClubGameResults).
  if (Array.isArray(match.side_a) || Array.isArray(match.side_b)) {
    return {
      id: match.id || null,
      source: match.source || 'club_event_game',
      side_a: flattenSideToUids(match.side_a),
      side_b: flattenSideToUids(match.side_b),
      winner,
      points_a,
      points_b,
      at: match.at || null,
    };
  }
  return null;
}

/** Conjunto rápido de uids. */
function uidSet(list) {
  return new Set((list || []).filter(Boolean));
}

/** Verifica se um jogo normalizado envolve pelo menos um uid do clube. */
function matchInvolvesAny(match, clubUids) {
  if (!match) return false;
  for (const uid of match.side_a) if (clubUids.has(uid)) return true;
  for (const uid of match.side_b) if (clubUids.has(uid)) return true;
  return false;
}

/** Filtra matches: só os que têm vencedor decidido (winner 'a'|'b'). */
function onlyDecided(matches) {
  return (matches || []).filter((m) => m.winner === 'a' || m.winner === 'b');
}

/** Deduplica jogos por id dentro da mesma fonte (defensivo). */
function dedupById(matches) {
  const seen = new Set();
  const out = [];
  (matches || []).forEach((m) => {
    const key = m.id || `${m.source}__${m.at || 0}__${m.side_a.join('+')}__${m.side_b.join('+')}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(m);
  });
  return out;
}

/**
 * Normaliza uma lista mista de fontes em um array plano de matches.
 * @param {object} sources
 * @param {Array} [sources.clubGames] jogos do próprio clube (formato organizer)
 * @param {Array} [sources.clubEventGames] jogos espelhados (Wave C) — clube atual + outros
 * @param {Array} [sources.tournamentMatches] jogos de torneio (lado a_ids/b_ids)
 * @returns {Array} matches normalizados (todos com side_a/side_b como uids)
 */
export function normalizeAllSources(sources = {}) {
  const out = [];
  (sources.clubGames || []).forEach((g) => {
    const n = normalizeMatch({ ...g, source: g.source || 'club_event_game' });
    if (n) out.push(n);
  });
  (sources.clubEventGames || []).forEach((g) => {
    const n = normalizeMatch({ ...g, source: g.source || 'club_event_game' });
    if (n) out.push(n);
  });
  (sources.tournamentMatches || []).forEach((g) => {
    const n = normalizeMatch({ ...g, source: g.source || 'tournament_match' });
    if (n) out.push(n);
  });
  return out;
}

/**
 * Filtra os matches para manter só os que envolvem pelo menos um uid
 * do clube. **Sempre** inclui o próprio clube (parâmetro `includeClub`
 * controla se o clube é incluído; se `false`, só fontes externas).
 *
 * @param {Array} normalizedMatches saída de `normalizeAllSources`
 * @param {string[]} clubUids lista de uids dos atletas do clube
 * @param {object} [opts]
 * @param {boolean} [opts.includeClub=true] mantém jogos do próprio clube
 * @param {boolean} [opts.includeExternal=true] mantém jogos de fontes externas
 * @returns {Array} matches filtrados e deduplicados
 */
export function filterMatchesForClub(normalizedMatches, clubUids, opts = {}) {
  const { includeClub = true, includeExternal = true } = opts;
  const set = uidSet(clubUids);
  const filtered = normalizedMatches.filter((m) => {
    if (!matchInvolvesAny(m, set)) return false;
    const isClub = m.source === 'club_event_game' || m.source === 'club_game';
    if (isClub && !includeClub) return false;
    if (!isClub && !includeExternal) return false;
    return true;
  });
  return dedupById(onlyDecided(filtered));
}

/** Resumo legível das fontes usadas (para UI/badges). */
export function summarizeSources(filteredMatches) {
  const summary = { club: 0, external: 0, doubles: 0, singles: 0 };
  (filteredMatches || []).forEach((m) => {
    const isExternal = !(m.source === 'club_event_game' || m.source === 'club_game');
    if (isExternal) summary.external += 1; else summary.club += 1;
    if (m.side_a.length === 2 && m.side_b.length === 2) summary.doubles += 1;
    else if (m.side_a.length === 1 && m.side_b.length === 1) summary.singles += 1;
  });
  return summary;
}
