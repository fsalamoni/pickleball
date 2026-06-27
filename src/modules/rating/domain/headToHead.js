/**
 * Agregação pura de confrontos diretos (head-to-head) — sem I/O.
 *
 * Recebe os registros de jogos do atleta já normalizados (um por jogo, com o
 * rótulo do adversário e se o atleta venceu) e consolida por adversário.
 */

/**
 * @param {Array<{ opponent: string, won: boolean }>} records
 * @returns {Array<{ opponent: string, played: number, wins: number, losses: number }>}
 *   ordenado por nº de confrontos (desc) e depois vitórias (desc).
 */
export function buildHeadToHead(records) {
  const byOpponent = new Map();
  (records || []).forEach((r) => {
    const key = String(r?.opponent || '').trim();
    if (!key) return;
    if (!byOpponent.has(key)) byOpponent.set(key, { opponent: key, played: 0, wins: 0, losses: 0 });
    const agg = byOpponent.get(key);
    agg.played += 1;
    if (r.won) agg.wins += 1;
    else agg.losses += 1;
  });
  return Array.from(byOpponent.values()).sort(
    (a, b) => b.played - a.played || b.wins - a.wins || a.opponent.localeCompare(b.opponent, 'pt-BR'),
  );
}

/**
 * Destaca os rivais mais frequentes (pelo menos 2 confrontos).
 * @param {Array<object>} headToHead saída de `buildHeadToHead`
 * @param {number} [limit]
 */
export function topRivals(headToHead, limit = 5) {
  return (headToHead || []).filter((h) => h.played >= 2).slice(0, limit);
}
