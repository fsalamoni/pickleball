/**
 * Ranking de DUPLAS no servidor — porta fiel de
 * `src/modules/rating/domain/doublesRanking.js`.
 *
 * Por que existe uma cópia: o pacote de Functions é publicado isolado e não
 * pode importar de `../src`. Para que a cópia nunca divirja do original há um
 * TESTE DE PARIDADE (`functions/engines/parity.test.js`) que roda as duas
 * implementações sobre as mesmas partidas e exige resultado idêntico. Se
 * alguém mexer num lado só, o teste quebra — é essa a garantia, não a
 * disciplina de quem edita.
 *
 * Qualquer mudança de regra aqui tem de ser feita nos DOIS arquivos.
 */

/** Chave estável de uma parceria (par de ids ordenado). */
function pairKey(id1, id2) {
  return [String(id1), String(id2)].sort().join('__');
}

function ensure(map, ids) {
  const key = pairKey(ids[0], ids[1]);
  if (!map.has(key)) {
    map.set(key, {
      pair_key: key,
      player_ids: [ids[0], ids[1]].slice().sort(),
      games: 0, wins: 0, losses: 0,
      points_for: 0, points_against: 0,
    });
  }
  return map.get(key);
}

/**
 * A ORDEM OFICIAL da classificação de duplas:
 *   1. aproveitamento · 2. mais vitórias · 3. menos derrotas · 4. saldo.
 * O último critério (a chave) só existe para a ordenação ser ESTÁVEL.
 */
function compareDoublesRows(x, y) {
  return (
    y.win_rate - x.win_rate
    || y.wins - x.wins
    || x.losses - y.losses
    || y.points_balance - x.points_balance
    || String(x.pair_key).localeCompare(String(y.pair_key))
  );
}

/**
 * Agrega os jogos de duplas por parceria e classifica.
 * @param {Array} matches jogos normalizados
 * @param {{ minGames?: number }} [opts]
 * @returns {Array<object>} com `position` já preenchida
 */
function computeDoublesRanking(matches = [], opts = {}) {
  const minGames = Number.isFinite(opts.minGames) ? opts.minGames : 1;
  const map = new Map();

  (matches || []).forEach((m) => {
    const a = (m.side_a || []).filter(Boolean);
    const b = (m.side_b || []).filter(Boolean);
    if (a.length !== 2 || b.length !== 2) return; // só duplas
    if (m.winner !== 'a' && m.winner !== 'b') return;
    const pa = Number(m.points_a) || 0;
    const pb = Number(m.points_b) || 0;

    const rowA = ensure(map, a);
    const rowB = ensure(map, b);
    rowA.games += 1; rowB.games += 1;
    rowA.points_for += pa; rowA.points_against += pb;
    rowB.points_for += pb; rowB.points_against += pa;
    if (m.winner === 'a') { rowA.wins += 1; rowB.losses += 1; } else { rowB.wins += 1; rowA.losses += 1; }
  });

  return Array.from(map.values())
    .filter((r) => r.games >= minGames)
    .map((r) => ({
      ...r,
      win_rate: r.games > 0 ? r.wins / r.games : 0,
      points_balance: r.points_for - r.points_against,
    }))
    .sort(compareDoublesRows)
    .map((r, i) => ({ ...r, position: i + 1 }));
}

module.exports = { pairKey, compareDoublesRows, computeDoublesRanking };
