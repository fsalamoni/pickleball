/**
 * GRUPOS DO AMERICANO — o que o torneio (Americano em etapas) e a liga (escada
 * individual, o "King of the Court") dividem. Mora no núcleo porque a liga é
 * um módulo à parte e não importa o torneio, nem o contrário.
 *
 * - `splitIntoGroups`: em quantos grupos dividir `n` pessoas, só com os
 *   tamanhos permitidos e o mais perto possível do tamanho escolhido. É a conta
 *   que o Americano em etapas sempre usou (programação dinâmica: menor soma de
 *   `(tamanho − alvo)²`; no empate, menos grupos — uma quadra a menos ocupada).
 * - `americanoFecha` / `americanoGroupSizes`: os tamanhos que fecham um
 *   Americano exato (cada dupla uma vez): N ≡ 0 ou 1 mod 4.
 * - `AMERICANO_COURT_ROUNDS` / `americanoCourtMatches`: a rodada de uma QUADRA
 *   de 4 ou 5 — cada um joga com cada outro uma vez. Com 4, três jogos para
 *   cada um; com 5, quatro jogos e uma folga.
 *
 * A liga tem a cópia no servidor (`functions/leagueLadder.js`, paridade).
 * Puro — sem React, sem Firebase.
 */

/** O Americano fecha com este número de atletas? (N ≡ 0 ou 1 mod 4, N ≥ 4) */
export function americanoFecha(n) {
  return n >= 4 && (n % 4 === 0 || n % 4 === 1);
}

/**
 * Os tamanhos dos grupos para `n` pessoas, maiores primeiro, ou `null` quando
 * não há divisão possível com os tamanhos permitidos.
 *
 * @param {number} n
 * @param {{ sizes: number[], target: number }} opts
 * @returns {number[]|null}
 */
export function splitIntoGroups(n, { sizes, target }) {
  const total = Math.floor(Number(n));
  const permitidos = [...new Set((sizes || []).map(Number).filter((s) => Number.isInteger(s) && s > 0))].sort((a, b) => a - b);
  if (!Number.isFinite(total) || total < 1 || !permitidos.length || total < permitidos[0]) return null;
  const melhor = new Array(total + 1).fill(null);
  melhor[0] = { custo: 0, grupos: [] };
  for (let k = 1; k <= total; k += 1) {
    permitidos.forEach((s) => {
      if (s > k || !melhor[k - s]) return;
      const anterior = melhor[k - s];
      const custo = anterior.custo + (s - target) ** 2;
      const grupos = [...anterior.grupos, s];
      const atual = melhor[k];
      if (!atual || custo < atual.custo || (custo === atual.custo && grupos.length < atual.grupos.length)) {
        melhor[k] = { custo, grupos };
      }
    });
  }
  const r = melhor[total];
  return r ? r.grupos.slice().sort((a, b) => b - a) : null;
}

/** Os tamanhos que fecham o Americano, até `2 × alvo + 1`, para `n` atletas. */
export function americanoGroupSizes(n, target = 4) {
  if (Math.floor(Number(n)) < 4) return null;
  const sizes = [];
  for (let s = 4; s <= 2 * target + 1; s += 1) if (americanoFecha(s)) sizes.push(s);
  return splitIntoGroups(n, { sizes, target });
}

/**
 * A rodada de uma quadra, por POSIÇÃO (0 = quem está mais acima): cada jogo é
 * `[[a, b], [c, d]]`. Com 5, em cada jogo um folga (o de índice igual ao jogo).
 */
export const AMERICANO_COURT_ROUNDS = Object.freeze({
  4: [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]],
  5: [0, 1, 2, 3, 4].map((i) => [[(i + 1) % 5, (i + 4) % 5], [(i + 2) % 5, (i + 3) % 5]]),
});

/** Os jogos de uma quadra de 4 ou 5: `[{ round, team_a, team_b }]` (ids). */
export function americanoCourtMatches(ids) {
  const plano = AMERICANO_COURT_ROUNDS[ids.length];
  if (!plano) return [];
  return plano.map(([a, b], i) => ({ round: i + 1, team_a: a.map((k) => ids[k]), team_b: b.map((k) => ids[k]) }));
}
