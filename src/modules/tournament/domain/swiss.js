/**
 * Sistema Suíço (Swiss pairing).
 *
 * Inspirado em Drarig29/brackets-manager.js e bracketmaker.app.
 *
 * Cada rodada pareia participantes com pontuação similar, evitando repetir
 * confrontos anteriores. O número de rodadas é tipicamente ceil(log2(N)).
 * Em caso de número ímpar, um participante recebe BYE (1 ponto) por rodada
 * — preferencialmente um diferente a cada vez.
 */

import { seededRng, shuffle } from './draw.js';

/**
 * Calcula o número recomendado de rodadas para N participantes.
 * @param {number} n
 * @returns {number}
 */
export function recommendedSwissRounds(n) {
  if (n <= 1) return 0;
  return Math.ceil(Math.log2(n));
}

/**
 * Gera o pareamento de UMA rodada de sistema suíço, dado o estado atual.
 *
 * @param {Array<{ id: string, points: number, byesReceived?: number }>} standings
 *   participantes com pontuação acumulada (ordenado ou não — a função reordena).
 * @param {Set<string>|string[][]} pastPairings
 *   conjunto de confrontos já realizados, em formato "a|b" (a<b lexicograficamente),
 *   ou lista de pares. Usado para evitar repetições.
 * @param {{ round: number, seed?: string }} options
 * @returns {{ pairings: Array<{ side_a: string, side_b: string|null, bye?: boolean }>, byeId: string|null }}
 */
export function pairSwissRound(standings, pastPairings, options) {
  const { round, seed = 'swiss' } = options;
  const rng = seededRng(`${seed}:${round}`);

  const past = normalizePast(pastPairings);
  const sorted = standings
    .slice()
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  // Em rodada 1 a "ordem" é aleatória (sem pontos), mas mantemos seed estável.
  if (round === 1 || sorted.every((s) => !s.points)) {
    const shuffled = shuffle(sorted, rng);
    return assignPairings(shuffled, past);
  }

  // Agrupar por pontuação ("score groups"), depois embaralhar dentro de cada grupo.
  const groups = new Map();
  sorted.forEach((p) => {
    const k = p.points || 0;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  });

  const orderedKeys = Array.from(groups.keys()).sort((a, b) => b - a);
  const ordered = [];
  orderedKeys.forEach((k) => {
    shuffle(groups.get(k), rng).forEach((p) => ordered.push(p));
  });

  return assignPairings(ordered, past);
}

/* --------------------------------- helpers --------------------------------- */

function normalizePast(pastPairings) {
  if (pastPairings instanceof Set) return pastPairings;
  const s = new Set();
  (pastPairings || []).forEach(([a, b]) => s.add(pairKey(a, b)));
  return s;
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

/**
 * Algoritmo guloso: percorre lista ordenada por pontuação; para cada participante,
 * tenta parear com o próximo cujo confronto ainda não tenha ocorrido. Se nenhum
 * candidato válido for encontrado, faz fallback com o próximo disponível
 * (repetição permitida apenas como último recurso, conforme prática usual).
 *
 * BYE: se número ímpar, o participante de menor pontuação que ainda não recebeu
 * BYE recebe — para garantir distribuição equitativa.
 */
function assignPairings(ordered, past) {
  const list = ordered.slice();
  let byeId = null;

  if (list.length % 2 === 1) {
    // Pega o de menor pontuação que ainda não recebeu BYE.
    let candidateIdx = -1;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (!list[i].byesReceived) { candidateIdx = i; break; }
    }
    if (candidateIdx === -1) candidateIdx = list.length - 1;
    byeId = list[candidateIdx].id;
    list.splice(candidateIdx, 1);
  }

  const pairings = [];
  const used = new Set();

  for (let i = 0; i < list.length; i += 1) {
    if (used.has(list[i].id)) continue;
    let partnerIdx = -1;
    for (let j = i + 1; j < list.length; j += 1) {
      if (used.has(list[j].id)) continue;
      if (!past.has(pairKey(list[i].id, list[j].id))) { partnerIdx = j; break; }
    }
    if (partnerIdx === -1) {
      // fallback: primeiro disponível (mesmo que já tenha jogado)
      for (let j = i + 1; j < list.length; j += 1) {
        if (!used.has(list[j].id)) { partnerIdx = j; break; }
      }
    }
    if (partnerIdx === -1) break;
    used.add(list[i].id);
    used.add(list[partnerIdx].id);
    pairings.push({ side_a: list[i].id, side_b: list[partnerIdx].id });
  }

  if (byeId) pairings.push({ side_a: byeId, side_b: null, bye: true });
  return { pairings, byeId };
}
