/**
 * Progressão de fases eliminatórias e de sistema suíço.
 *
 * Estas funções são PURAS: recebem os jogos já persistidos (com resultados) e
 * calculam quais novos jogos devem ser criados para avançar a competição —
 * vencedores das chaves, próxima rodada do suíço, e o trânsito de
 * vencedores/perdedores na dupla eliminação. Nenhum I/O acontece aqui.
 *
 * O serviço (matchService.advanceStage) aplica o resultado destas funções,
 * persistindo e agendando os novos jogos.
 */

import { MATCH_STATUS } from './constants.js';
import { nextPowerOfTwo } from './draw.js';
import { pairSwissRound, recommendedSwissRounds } from './swiss.js';

/* ------------------------------ helpers --------------------------------- */

/** Ids do lado vencedor de um jogo decidido (ou null se indefinido). */
export function matchWinnerIds(m) {
  const a = m.side_a_ids || [];
  const b = m.side_b_ids || [];
  // Bye: apenas um lado preenchido → esse lado é o vencedor.
  if (a.length && !b.length) return a;
  if (b.length && !a.length) return b;
  if (m.winner_side === 'a') return a;
  if (m.winner_side === 'b') return b;
  return null;
}

/** Ids do lado perdedor de um jogo decidido (ou [] em bye, null se indefinido). */
export function matchLoserIds(m) {
  const a = m.side_a_ids || [];
  const b = m.side_b_ids || [];
  if (a.length && !b.length) return [];
  if (b.length && !a.length) return [];
  if (m.winner_side === 'a') return b;
  if (m.winner_side === 'b') return a;
  return null;
}

/** Um jogo está decidido quando tem vencedor e está concluído (ou é WO/bye). */
export function isMatchDecided(m) {
  if (matchWinnerIds(m) == null) return false;
  return m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER;
}

/** Converte uma lista de ids no formato de "lado" aceito pela persistência. */
function sideFromIds(ids) {
  if (!ids || ids.length === 0) return null;
  return ids.length === 1 ? ids[0] : ids;
}

function groupByRound(matches) {
  const map = new Map();
  matches.forEach((m) => {
    const r = m.round || 1;
    if (!map.has(r)) map.set(r, []);
    map.get(r).push(m);
  });
  return map;
}

/* ------------------------------ Knockout -------------------------------- */

/**
 * Calcula a próxima rodada de um mata-mata simples.
 *
 * @param {Array<object>} matches jogos da fase (com resultados)
 * @returns {{ pending: true } | { complete: true, championIds: string[] } | { matches: Array<object>, nextRound: number }}
 */
export function knockoutNextRound(matches) {
  if (!matches || matches.length === 0) return { pending: true };
  const rounds = groupByRound(matches);
  const maxRound = Math.max(...rounds.keys());
  const current = rounds.get(maxRound).slice().sort((a, b) => (a.position || 0) - (b.position || 0));

  if (current.length === 1 && isMatchDecided(current[0])) {
    return { complete: true, championIds: matchWinnerIds(current[0]) };
  }
  if (!current.every(isMatchDecided)) return { pending: true };

  const winners = current.map(matchWinnerIds);
  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i];
    const b = winners[i + 1] || null;
    next.push({
      round: maxRound + 1,
      position: i / 2 + 1,
      side_a: sideFromIds(a),
      side_b: sideFromIds(b),
      bye: !b || b.length === 0,
    });
  }
  return { matches: next, nextRound: maxRound + 1 };
}

/* ------------------------------ Swiss ----------------------------------- */

/**
 * Calcula a próxima rodada do sistema suíço, a partir da classificação atual.
 *
 * @param {Array<object>} matches jogos da fase (com resultados)
 * @param {string[]} participantIds todos os participantes ativos
 * @param {{ seed?: string, totalRounds?: number }} [options]
 * @returns {{ pending: true } | { complete: true } | { matches: Array<object>, nextRound: number }}
 */
export function swissNextRound(matches, participantIds, options = {}) {
  const seed = options.seed || 'swiss';
  const totalRounds = options.totalRounds || recommendedSwissRounds(participantIds.length);
  if (!matches || matches.length === 0) return { pending: true };

  const rounds = groupByRound(matches);
  const maxRound = Math.max(...rounds.keys());
  const current = rounds.get(maxRound);
  if (!current.every(isMatchDecided)) return { pending: true };
  if (maxRound >= totalRounds) return { complete: true };

  // Classificação acumulada (1 ponto por vitória/bye).
  const points = new Map(participantIds.map((id) => [id, 0]));
  const byes = new Map(participantIds.map((id) => [id, 0]));
  const past = [];
  matches.forEach((m) => {
    const a = (m.side_a_ids || [])[0];
    const b = (m.side_b_ids || [])[0];
    if (a && b) past.push([a, b]);
    if (!isMatchDecided(m)) return;
    const winnerIds = matchWinnerIds(m) || [];
    const w = winnerIds[0];
    const isBye = !(a && b);
    if (w != null && points.has(w)) points.set(w, points.get(w) + 1);
    if (isBye && w != null && byes.has(w)) byes.set(w, byes.get(w) + 1);
  });

  const standings = participantIds.map((id) => ({
    id,
    points: points.get(id) || 0,
    byesReceived: byes.get(id) || 0,
  }));

  const { pairings } = pairSwissRound(standings, past, { round: maxRound + 1, seed });
  const next = pairings.map((p, i) => ({
    round: maxRound + 1,
    position: i + 1,
    side_a: p.side_a,
    side_b: p.side_b ?? null,
    bye: Boolean(p.bye),
  }));
  return { matches: next, nextRound: maxRound + 1 };
}

/* ------------------------- Double elimination --------------------------- */

/**
 * Plano (puro, sem jogadores) da chave de dupla eliminação para `size` slots
 * (potência de 2). Cada nó descreve de onde vêm seus dois lados.
 *
 * Chaves dos nós: `wb-<r>-<p>`, `lb-<r>-<p>`, `gf-1`, `gf-2`.
 * Origem de um lado:
 *  - { type:'slot', index }    → posição inicial (WB rodada 1)
 *  - { type:'winner', key }    → vencedor de outro nó
 *  - { type:'loser', key }     → perdedor de outro nó
 *
 * @param {number} size potência de 2 (>= 2)
 * @returns {{ nodes: Array<object>, byKey: Map<string, object>, wbRounds: number, lbRounds: number, lbFinalKey: string|null, wbFinalKey: string }}
 */
export function doubleEliminationPlan(size) {
  const M = Math.log2(size);
  const nodes = [];
  const push = (n) => nodes.push(n);

  // Winners bracket
  for (let r = 1; r <= M; r += 1) {
    const count = size >> r;
    for (let p = 1; p <= count; p += 1) {
      if (r === 1) {
        push({
          key: `wb-1-${p}`, bracket: 'wb', round: 1, position: p,
          a: { type: 'slot', index: 2 * p - 2 },
          b: { type: 'slot', index: 2 * p - 1 },
        });
      } else {
        push({
          key: `wb-${r}-${p}`, bracket: 'wb', round: r, position: p,
          a: { type: 'winner', key: `wb-${r - 1}-${2 * p - 1}` },
          b: { type: 'winner', key: `wb-${r - 1}-${2 * p}` },
        });
      }
    }
  }
  const wbFinalKey = `wb-${M}-1`;

  // Losers bracket: 2M-2 rodadas (alterna consolidação/junção).
  const lbRounds = M > 1 ? 2 * M - 2 : 0;
  for (let r = 1; r <= lbRounds; r += 1) {
    if (r === 1) {
      const count = size >> 2; // S/4
      for (let p = 1; p <= count; p += 1) {
        push({
          key: `lb-1-${p}`, bracket: 'lb', round: 1, position: p,
          a: { type: 'loser', key: `wb-1-${2 * p - 1}` },
          b: { type: 'loser', key: `wb-1-${2 * p}` },
        });
      }
    } else if (r % 2 === 0) {
      // Junção: vencedor da LB anterior x perdedor de WB rodada (r/2 + 1).
      const wbRound = r / 2 + 1;
      const count = size >> wbRound;
      for (let p = 1; p <= count; p += 1) {
        push({
          key: `lb-${r}-${p}`, bracket: 'lb', round: r, position: p,
          a: { type: 'winner', key: `lb-${r - 1}-${p}` },
          b: { type: 'loser', key: `wb-${wbRound}-${p}` },
        });
      }
    } else {
      // Consolidação: vencedores da LB anterior entre si.
      const count = countLbWinners(size, r - 1) / 2;
      for (let p = 1; p <= count; p += 1) {
        push({
          key: `lb-${r}-${p}`, bracket: 'lb', round: r, position: p,
          a: { type: 'winner', key: `lb-${r - 1}-${2 * p - 1}` },
          b: { type: 'winner', key: `lb-${r - 1}-${2 * p}` },
        });
      }
    }
  }
  const lbFinalKey = lbRounds > 0 ? `lb-${lbRounds}-1` : null;

  // Grand final (e reset condicional).
  const lbChampSource = lbFinalKey
    ? { type: 'winner', key: lbFinalKey }
    : { type: 'loser', key: 'wb-1-1' }; // size===2
  push({
    key: 'gf-1', bracket: 'gf', round: 1, position: 1,
    a: { type: 'winner', key: wbFinalKey },
    b: lbChampSource,
  });
  push({
    key: 'gf-2', bracket: 'gf', round: 2, position: 1, reset: true,
    a: { type: 'winner', key: wbFinalKey },
    b: lbChampSource,
  });

  const byKey = new Map(nodes.map((n) => [n.key, n]));
  return { nodes, byKey, wbRounds: M, lbRounds, lbFinalKey, wbFinalKey };
}

/** Quantos vencedores saem da rodada LB `r` (auxiliar para dimensionar). */
function countLbWinners(size, r) {
  if (r <= 0) return size >> 1; // não usado
  let winners = size >> 2; // após LB R1
  for (let k = 2; k <= r; k += 1) {
    if (k % 2 === 1) winners = winners / 2; // consolidação
    // junção (k par) mantém a quantidade
  }
  return winners;
}

/** Chave do nó de plano correspondente a um jogo persistido de dupla elim. */
function deKeyOf(m) {
  const bracket = m.bracket || 'wb';
  if (bracket === 'gf') return `gf-${m.round || 1}`;
  return `${bracket}-${m.round || 1}-${m.position || 1}`;
}

/**
 * Resolve os lados (ids) e o estado de cada nó do plano, a partir dos jogos
 * persistidos. Lida com byes (lado vazio → o outro avança).
 *
 * @returns {Map<string, { winner: string[]|null, loser: string[]|null, sideA: string[], sideB: string[], decided: boolean }>}
 */
function resolveDoubleElimination(plan, persistedByKey) {
  const state = new Map();

  const idsFromSource = (src) => {
    if (src.type === 'slot') return null; // resolvido a partir do jogo persistido WB R1
    const s = state.get(src.key);
    if (!s || !s.decided) return undefined; // ainda indefinido
    return src.type === 'winner' ? s.winner || [] : s.loser || [];
  };

  for (const node of plan.nodes) {
    const persisted = persistedByKey.get(node.key);

    let sideA;
    let sideB;
    if (node.a.type === 'slot') {
      sideA = persisted ? persisted.side_a_ids || [] : undefined;
      sideB = persisted ? persisted.side_b_ids || [] : undefined;
    } else {
      sideA = idsFromSource(node.a);
      sideB = idsFromSource(node.b);
    }

    // Reset da grand final só existe se a GF-1 foi para o lado da LB.
    if (node.key === 'gf-2') {
      const gf1 = state.get('gf-1');
      const gf1Persisted = persistedByKey.get('gf-1');
      const lbWon = gf1 && gf1.decided && gf1Persisted && gf1Persisted.winner_side === 'b';
      if (!lbWon) {
        state.set(node.key, { winner: null, loser: null, sideA: [], sideB: [], decided: false, skip: true });
        continue;
      }
    }

    if (sideA === undefined || sideB === undefined) {
      state.set(node.key, { winner: null, loser: null, sideA: [], sideB: [], decided: false });
      continue;
    }

    const a = sideA || [];
    const b = sideB || [];

    if (persisted && isMatchDecided(persisted)) {
      state.set(node.key, {
        winner: matchWinnerIds(persisted) || [],
        loser: matchLoserIds(persisted) || [],
        sideA: a, sideB: b, decided: true,
      });
      continue;
    }

    // Resolução automática por bye (sem necessidade de jogo).
    if (a.length === 0 && b.length === 0) {
      state.set(node.key, { winner: [], loser: [], sideA: a, sideB: b, decided: true });
    } else if (a.length === 0) {
      state.set(node.key, { winner: b, loser: [], sideA: a, sideB: b, decided: true, bye: true });
    } else if (b.length === 0) {
      state.set(node.key, { winner: a, loser: [], sideA: a, sideB: b, decided: true, bye: true });
    } else {
      // Ambos presentes e ainda não jogado → precisa ser disputado.
      state.set(node.key, { winner: null, loser: null, sideA: a, sideB: b, decided: false, playable: true });
    }
  }
  return state;
}

/**
 * Calcula os novos jogos da dupla eliminação a serem criados (vencedores e
 * perdedores roteados para WB/LB/GF), além de byes auto-resolvidos.
 *
 * @param {Array<object>} matches jogos persistidos da fase
 * @param {number} participantCount nº de participantes (para o tamanho da chave)
 * @returns {{ pending: true } | { complete: true, championIds: string[] } | { matches: Array<object> }}
 */
export function doubleEliminationNextMatches(matches, participantCount) {
  if (!matches || matches.length === 0) return { pending: true };
  const size = nextPowerOfTwo(participantCount);
  if (size < 2) return { complete: true, championIds: [] };
  const plan = doubleEliminationPlan(size);
  const persistedByKey = new Map(matches.map((m) => [deKeyOf(m), m]));
  const state = resolveDoubleElimination(plan, persistedByKey);

  // Campeão?
  const gf1 = state.get('gf-1');
  const gf1Persisted = persistedByKey.get('gf-1');
  if (gf1 && gf1.decided) {
    if (gf1Persisted && gf1Persisted.winner_side === 'b') {
      const gf2 = state.get('gf-2');
      if (gf2 && gf2.decided && persistedByKey.has('gf-2')) {
        return { complete: true, championIds: gf2.winner || [] };
      }
    } else {
      return { complete: true, championIds: gf1.winner || [] };
    }
  }

  // Cria os nós jogáveis ainda não persistidos cujos lados já estão definidos
  // (e que tenham pelo menos um jogador real).
  const toCreate = [];
  for (const node of plan.nodes) {
    if (persistedByKey.has(node.key)) continue;
    if (node.a.type === 'slot') continue; // WB R1 já vem do sorteio
    const s = state.get(node.key);
    if (!s || s.skip) continue;
    const a = s.sideA || [];
    const b = s.sideB || [];
    const bothKnown = s.decided || s.playable;
    if (!bothKnown) continue;
    if (a.length === 0 && b.length === 0) continue; // nó fantasma (byes em cascata)

    toCreate.push({
      bracket: node.bracket,
      round: node.round,
      position: node.position,
      side_a: sideFromIds(a),
      side_b: sideFromIds(b),
      bye: a.length === 0 || b.length === 0,
      reset: Boolean(node.reset),
    });
  }

  if (toCreate.length === 0) return { pending: true };
  return { matches: toCreate };
}

/* ------------------------------ Dispatch -------------------------------- */

/**
 * Decide a progressão de uma fase conforme o tipo de estrutura.
 *
 * @param {string} stageType
 * @param {Array<object>} matches
 * @param {{ participantIds?: string[], participantCount?: number, seed?: string, totalRounds?: number }} ctx
 */
export function computeStageAdvance(stageType, matches, ctx = {}) {
  if (stageType === 'knockout') return knockoutNextRound(matches);
  if (stageType === 'swiss') {
    return swissNextRound(matches, ctx.participantIds || [], {
      seed: ctx.seed,
      totalRounds: ctx.totalRounds,
    });
  }
  if (stageType === 'double_knockout') {
    return doubleEliminationNextMatches(
      matches,
      ctx.participantCount ?? (ctx.participantIds || []).length,
    );
  }
  // Estruturas "completas" (todos os jogos saem no sorteio) não avançam.
  return { notApplicable: true };
}

/** Tipos de estrutura que suportam avanço de fase. */
export function stageSupportsAdvance(stageType) {
  return stageType === 'knockout' || stageType === 'swiss' || stageType === 'double_knockout';
}
