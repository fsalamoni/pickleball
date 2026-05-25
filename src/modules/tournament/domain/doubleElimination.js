/**
 * Engine de chaveamento de dupla eliminação (double elimination).
 *
 * Inspirado em Drarig29/brackets-manager.js e evroon/bracket.
 *
 * Modelo:
 *   - WB (winners bracket): chave clássica de eliminação simples.
 *   - LB (losers bracket): perdedores caem aqui; rodadas alternam entre
 *     "minor" (perdedores de WB entram contra vencedores anteriores de LB)
 *     e "major" (vencedores de LB jogam entre si).
 *   - GF (grand final): campeão de WB vs campeão de LB.
 *     Se o campeão de LB vencer, ocorre o "bracket reset" (GF reset).
 *
 * Estrutura retornada é serializável e pode ser persistida diretamente.
 */

import { seededRng, shuffle, nextPowerOfTwo, seedSlot } from './draw.js';

/**
 * @param {string[]} participantIds
 * @param {{ seedCount?: number, seed?: string }} [options]
 * @returns {{
 *   size: number,
 *   wb: Array<{ round: number, position: number, side_a: string|null, side_b: string|null, bye?: boolean }>,
 *   lb: Array<{ round: number, position: number, side_a: string|null, side_b: string|null, kind: 'minor'|'major' }>,
 *   gf: Array<{ round: number, position: number, side_a: string|null, side_b: string|null, reset?: boolean }>,
 *   wbRounds: number,
 *   lbRounds: number,
 * }}
 */
export function buildDoubleEliminationBracket(participantIds, options = {}) {
  const { seedCount = 0, seed = 'double-elim' } = options;
  const size = nextPowerOfTwo(participantIds.length);
  const wbRounds = Math.log2(size);
  const rng = seededRng(seed);

  // ---- WB slots ----
  const slots = new Array(size).fill(null);
  const seeds = participantIds.slice(0, seedCount);
  seeds.forEach((p, idx) => {
    slots[seedSlot(idx + 1, size)] = p;
  });
  const rest = shuffle(participantIds.slice(seedCount), rng);
  for (let i = 0; i < slots.length && rest.length > 0; i += 1) {
    if (slots[i] === null) slots[i] = rest.shift();
  }

  // ---- WB: gera estrutura vazia rodada a rodada (round 1 preenchido) ----
  const wb = [];
  for (let i = 0; i < size; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    wb.push({
      round: 1,
      position: i / 2 + 1,
      side_a: a,
      side_b: b,
      bye: a === null || b === null,
    });
  }
  let matchesInRound = size / 4;
  for (let r = 2; r <= wbRounds; r += 1) {
    for (let p = 1; p <= matchesInRound; p += 1) {
      wb.push({ round: r, position: p, side_a: null, side_b: null });
    }
    matchesInRound = Math.max(1, matchesInRound / 2);
  }

  // ---- LB: 2*wbRounds - 1 rodadas; alterna minor/major ----
  // LB tamanho da rodada 1: size/4 jogos (os 2 piores de cada par WB-R1 não existe;
  // o padrão correto é: WB-R1 produz size/2 perdedores → LB-R1 tem size/4 jogos).
  const lb = [];
  const lbRounds = 2 * wbRounds - 1;
  let lbCount = size / 4;
  for (let r = 1; r <= lbRounds; r += 1) {
    const kind = r % 2 === 1 ? 'minor' : 'major';
    const count = Math.max(1, lbCount);
    for (let p = 1; p <= count; p += 1) {
      lb.push({ round: r, position: p, side_a: null, side_b: null, kind });
    }
    // Em rodadas "major" o número de jogos cai pela metade; em "minor" mantém.
    if (kind === 'major') lbCount = Math.max(1, lbCount / 2);
  }

  // ---- Grand Final + reset ----
  const gf = [
    { round: 1, position: 1, side_a: null, side_b: null },
    { round: 2, position: 1, side_a: null, side_b: null, reset: true },
  ];

  return { size, wb, lb, gf, wbRounds, lbRounds };
}

/**
 * Total de jogos máximos que serão disputados numa chave de dupla eliminação
 * (sem contar o reset, que é condicional).
 * Útil para estimativas de duração e número de quadras necessárias.
 *
 * @param {number} n número de participantes
 * @returns {number}
 */
export function doubleEliminationMaxMatches(n) {
  if (n <= 1) return 0;
  // single-elim: n-1 jogos; double-elim: 2n-2 (+1 se reset)
  return 2 * n - 2;
}
