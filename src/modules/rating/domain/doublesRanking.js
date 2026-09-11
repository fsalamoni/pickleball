/**
 * Domínio puro do ranking de duplas (flag doubles_ranking).
 *
 * Agrega os jogos de duplas finalizados por PARCERIA (os dois atletas que
 * jogaram juntos no mesmo lado), contando vitórias, derrotas, saldo de pontos e
 * aproveitamento. Sem I/O — recebe os jogos já normalizados.
 *
 * ## A CLASSIFICAÇÃO (ordem definida pelo produto)
 *
 *   1. APROVEITAMENTO (vitórias / jogos), do maior para o menor;
 *   2. maior número de VITÓRIAS;
 *   3. menor número de DERROTAS;
 *   4. maior SALDO DE PONTOS.
 *
 * O aproveitamento vem PRIMEIRO de propósito. A consequência a conhecer: uma
 * dupla com 1 jogo e 1 vitória (100%) fica à frente de uma com 50 jogos e 45
 * vitórias (90%). Quem quiser exigir uma amostra mínima usa `minGames` — o
 * filtro existe para isso e não altera a ordem, só quem entra nela.
 *
 * Formato de jogo esperado (mesmo do motor de rating):
 *   { side_a: [uidA1, uidA2], side_b: [uidB1, uidB2], winner: 'a'|'b',
 *     points_a?, points_b? }
 * Só consideram-se lados com exatamente 2 atletas (duplas).
 */

/** Chave estável de uma parceria (par de ids ordenado). */
export function pairKey(id1, id2) {
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
 * Comparador da classificação de duplas — a ordem oficial, num lugar só.
 *
 * Exportado porque quem materializa o ranking (cliente e Cloud Function)
 * precisa gravar a MESMA posição que a tela mostraria. Duas implementações da
 * mesma regra seria a forma mais fácil de as duas divergirem.
 *
 * O último critério é a própria chave da parceria: não é um desempate de
 * mérito, é o que torna a ordenação ESTÁVEL — sem ele, duas duplas idênticas
 * em tudo poderiam trocar de posição entre um recálculo e outro, e a tela
 * mostraria mudanças que não aconteceram.
 */
export function compareDoublesRows(x, y) {
  return (
    y.win_rate - x.win_rate            // 1. aproveitamento
    || y.wins - x.wins                 // 2. mais vitórias
    || x.losses - y.losses             // 3. menos derrotas
    || y.points_balance - x.points_balance // 4. saldo de pontos
    || String(x.pair_key).localeCompare(String(y.pair_key)) // estabilidade
  );
}

/**
 * Calcula o ranking de duplas, já classificado.
 * @param {Array} matches jogos normalizados
 * @param {{ minGames?: number }} [opts]
 * @returns {Array<{pair_key, player_ids, games, wins, losses, win_rate,
 *   points_for, points_against, points_balance, position}>}
 */
export function computeDoublesRanking(matches = [], opts = {}) {
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
    // A posição é gravada junto: é ela que a tela numera e por ela que o banco
    // ordena (um campo só, sem índice composto).
    .map((r, i) => ({ ...r, position: i + 1 }));
}

/* ---------------------------------------------------------------------------
 * AMOSTRA MÍNIMA — o recorte que cada pessoa escolhe para a SUA visualização
 * ------------------------------------------------------------------------- */

/**
 * Mínimos de jogos oferecidos na tela. `1` significa "todas as duplas".
 *
 * A lista é fechada de propósito: um campo numérico livre convidaria a
 * `?min=999` (tabela vazia sem explicação) e faria a preferência salva de
 * ontem virar um valor que a tela de hoje não sabe desenhar.
 */
export const DOUBLES_MIN_GAMES_OPTIONS = Object.freeze([1, 3, 5, 10, 20]);

/** Padrão: todas as duplas entram. É o comportamento que sempre existiu. */
export const DEFAULT_DOUBLES_MIN_GAMES = 1;

/**
 * Recorta o ranking pelas duplas com pelo menos `minGames` jogos e
 * **RENUMERA** as posições dentro do recorte.
 *
 * ## Por que renumerar
 *
 * A amostra mínima não é uma busca: ela redefine QUEM disputa o ranking. Quem
 * pede "só duplas com 10+ jogos" quer saber quem é a primeira ENTRE ELAS — ver
 * "#37" no topo da própria tela pareceria defeito. A ordem relativa não muda
 * em nada; só a numeração acompanha o recorte.
 *
 * A posição no ranking geral não se perde: vai em `overall_position`, para a
 * tela poder mostrá-la quando houver recorte ativo. Esconder essa informação
 * seria trocar um mal-entendido por outro.
 *
 * É a diferença entre este filtro e a BUSCA por nome: buscar é "encontre esta
 * dupla no ranking", e ali a posição geral é justamente a resposta.
 *
 * @param {Array<object>} rows linhas já classificadas (com `position` e `games`)
 * @param {number} minGames mínimo de jogos; `1` ou menos devolve tudo
 * @returns {Array<object>} com `position` recortada e `overall_position` original
 */
export function filterByMinGames(rows, minGames) {
  const lista = Array.isArray(rows) ? rows : [];
  const min = Math.max(1, Math.trunc(Number(minGames)) || 1);
  const comOriginal = lista.map((r) => ({ ...r, overall_position: r.position }));
  if (min <= 1) return comOriginal;
  return comOriginal
    .filter((r) => (Number(r.games) || 0) >= min)
    .map((r, i) => ({ ...r, position: i + 1 }));
}
