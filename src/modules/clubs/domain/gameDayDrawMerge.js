/**
 * Utilitários puros para o novo sorteio ADITIVO do "Dia de jogo".
 *
 * Antes, "Sortear jogos" substituía TODOS os jogos do dia. Agora o sorteio
 * ADICIONA novos jogos sem apagar os que já têm resultado lançado, e apenas
 * (opcionalmente) substitui os jogos SEM resultado. Estas funções isolam a
 * lógica de decisão para que fique testável e reutilizável pelos dois
 * organizadores (dia de jogo do atleta e dia de jogo do clube).
 *
 * Sem I/O e sem React.
 */

/** Um jogo tem resultado lançado quando AMBOS os placares estão preenchidos. */
export function hasResult(game) {
  return !!game && game.score_a != null && game.score_b != null;
}

/**
 * Separa os jogos em "com resultado" (decididos/lançados) e "sem resultado".
 * @param {Array} games
 * @returns {{ scored: Array, unscored: Array }}
 */
export function splitGamesByResult(games) {
  const scored = [];
  const unscored = [];
  (games || []).forEach((g) => {
    if (hasResult(g)) scored.push(g);
    else unscored.push(g);
  });
  return { scored, unscored };
}

/**
 * Maior número de rodada entre os jogos mantidos (0 se nenhum tem rodada).
 * Serve de base para NUMERAR as rodadas dos jogos recém-sorteados, de modo que
 * apareçam DEPOIS das rodadas já existentes (sem colidir na exibição).
 * @param {Array} keptGames
 * @returns {number}
 */
export function nextRoundBase(keptGames) {
  const nums = (keptGames || [])
    .map((g) => g.round)
    .filter((r) => Number.isFinite(r));
  return nums.length ? Math.max(...nums) : 0;
}

/**
 * Desloca a numeração de rodada dos jogos novos, somando `base`. Jogos sem
 * rodada (avulsos) permanecem sem rodada.
 * @param {Array} newGames  jogos gerados pelo sorteio (rodada 1..N)
 * @param {number} base      offset (ex.: maior rodada já existente)
 * @returns {Array}
 */
export function offsetRounds(newGames, base) {
  const b = Number(base) || 0;
  if (b === 0) return (newGames || []).slice();
  return (newGames || []).map((g) => ({
    ...g,
    round: Number.isFinite(g.round) ? g.round + b : g.round,
  }));
}

/**
 * Maior valor de `order` entre os jogos mantidos (−1 se nenhum), para que os
 * jogos novos entrem depois na ordenação por `order`.
 * @param {Array} keptGames
 * @returns {number}
 */
export function maxOrderOf(keptGames) {
  return (keptGames || []).reduce((max, g) => {
    const o = g?.order;
    return Number.isFinite(o) && o > max ? o : max;
  }, -1);
}

/**
 * Decide o plano de gravação do sorteio aditivo.
 *
 * @param {object} args
 * @param {Array}  args.existingGames    jogos atuais do dia
 * @param {boolean} args.replaceUnscored se true, remove os jogos sem resultado
 * @returns {{ keptGames: Array, removeIds: string[], roundBase: number, orderBase: number }}
 */
export function planAdditiveDraw({ existingGames = [], replaceUnscored = false } = {}) {
  const { scored, unscored } = splitGamesByResult(existingGames);
  const keptGames = replaceUnscored ? scored : [...scored, ...unscored];
  const removeIds = replaceUnscored
    ? unscored.map((g) => g.id).filter(Boolean)
    : [];
  return {
    keptGames,
    removeIds,
    roundBase: nextRoundBase(keptGames),
    orderBase: maxOrderOf(keptGames) + 1,
  };
}
