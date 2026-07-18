/**
 * Progressão ENTRE fases de uma modalidade multi-fase.
 *
 * Dadas as fases anteriores (já jogadas) com seus grupos e resultados, estas
 * funções puras calculam:
 *  1. a classificação de cada grupo (quem ficou em 1º, 2º, …);
 *  2. quem se CLASSIFICA (geral ou por gênero, N por grupo);
 *  3. como esses classificados formam os ENTRANTS da próxima fase — avançando
 *     individualmente, fundindo grupos (A+B → AB), juntando todos, ou formando
 *     duplas (mista por grupo, ou os 2 melhores do grupo).
 *
 * Um "entrant" é a unidade que entra na fase: { id, members[], gender, strength,
 * label }. `members` são ids de inscrição (1 para individual/dupla-fixa; 2+ para
 * duplas formadas por classificação). Tudo aqui é puro (sem I/O).
 */

import { buildStandings } from './ranking.js';
import { groupLetter, computeGroupSizes, assignBalancedGroups } from './grouping.js';
import {
  PHASE_QUALIFIER_MODE,
  PHASE_FEED_MODE,
  PHASE_PAIRING_MODE,
  PHASE_DIVISION_MODE,
  PHASE_BRACKET_SEEDING,
  TOURNAMENT_STAGE_TYPE,
} from './constants.js';
import { supportsGroups, BRACKET_FORMATS } from './phases.js';

/** Formatos de ROTAÇÃO de parceiros (jogam com duplas montadas por rodada). */
const ROTATION_FORMATS = new Set([
  TOURNAMENT_STAGE_TYPE.AMERICANO,
  TOURNAMENT_STAGE_TYPE.MEXICANO,
]);

/** Comparador oficial de classificação (mesmos critérios de ranking.js). */
function compareStats(x, y) {
  if (y.wins !== x.wins) return y.wins - x.wins;
  const xb = (x.points_for || 0) - (x.points_against || 0);
  const yb = (y.points_for || 0) - (y.points_against || 0);
  if (yb !== xb) return yb - xb;
  if ((y.points_for || 0) !== (x.points_for || 0)) return (y.points_for || 0) - (x.points_for || 0);
  if ((x.points_against || 0) !== (y.points_against || 0)) {
    return (x.points_against || 0) - (y.points_against || 0);
  }
  return 0;
}

/**
 * Classifica os entrants de um grupo a partir dos jogos do grupo.
 *
 * @param {Array<{ id: string, members: string[], gender?: any, strength?: number }>} entrants
 * @param {Array<object>} matches jogos (apenas os do grupo)
 * @param {object} scoringConfig
 * @returns {Array<object>} entrants em ordem de classificação (1º primeiro),
 *   cada um anotado com `{ stats, rank }`.
 */
export function rankEntrantsInGroup(entrants, matches, scoringConfig) {
  const memberIds = entrants.flatMap((e) => e.members || []);
  const standings = buildStandings(matches, memberIds, scoringConfig);
  const byId = new Map(standings.map((s) => [String(s.participant_id), s]));

  const withStats = entrants.map((e, index) => {
    // Agrega as estatísticas dos membros do entrant (some quando há mais de um).
    const agg = { wins: 0, losses: 0, played: 0, sets_won: 0, sets_lost: 0, points_for: 0, points_against: 0 };
    (e.members || []).forEach((m) => {
      const s = byId.get(String(m));
      if (!s) return;
      agg.wins += s.wins;
      agg.losses += s.losses;
      agg.played += s.played;
      agg.sets_won += s.sets_won;
      agg.sets_lost += s.sets_lost;
      agg.points_for += s.points_for;
      agg.points_against += s.points_against;
    });
    // Para duplas formadas (2 membros) as estatísticas somam o dobro; normaliza
    // dividindo pelo nº de membros para manter a escala comparável.
    const divisor = Math.max(1, (e.members || []).length);
    const stats = {
      wins: agg.wins / divisor,
      losses: agg.losses / divisor,
      played: agg.played / divisor,
      sets_won: agg.sets_won / divisor,
      sets_lost: agg.sets_lost / divisor,
      points_for: agg.points_for / divisor,
      points_against: agg.points_against / divisor,
    };
    return { entrant: e, stats, index };
  });

  withStats.sort((a, b) => {
    const c = compareStats(a.stats, b.stats);
    if (c !== 0) return c;
    return a.index - b.index; // estável
  });

  return withStats.map((w, i) => ({ ...w.entrant, stats: w.stats, rank: i + 1 }));
}

function genderBucket(entrant) {
  const g = entrant?.gender;
  if (g === 'male' || g === 1) return 'male';
  if (g === 'female' || g === 0) return 'female';
  return 'unknown';
}

/**
 * Seleciona os classificados de um grupo já ordenado.
 *
 * @param {Array<object>} ranked entrants ordenados (de rankEntrantsInGroup)
 * @param {{ qualifier_mode: string, qualifiers_per_group: number }} phase
 * @returns {Array<object>} classificados, na ordem de classificação
 */
export function selectQualifiers(ranked, phase) {
  const per = Math.max(0, Math.floor(phase.qualifiers_per_group) || 0);
  if (per === 0) return [];
  if (phase.qualifier_mode === PHASE_QUALIFIER_MODE.BY_GENDER) {
    const males = ranked.filter((e) => genderBucket(e) === 'male').slice(0, per);
    const females = ranked.filter((e) => genderBucket(e) === 'female').slice(0, per);
    // Mantém a ordem de classificação global entre os escolhidos.
    const chosen = new Set([...males, ...females]);
    return ranked.filter((e) => chosen.has(e));
  }
  return ranked.slice(0, per);
}

/** Combina vários entrants num único entrant-dupla (para chaves/finais). */
function mergeEntrants(members, label) {
  const memberIds = members.flatMap((m) => m.members || []);
  const strengths = members.map((m) => Number(m.strength)).filter((s) => Number.isFinite(s) && s >= 0);
  const genders = new Set(members.map(genderBucket).filter((g) => g !== 'unknown'));
  return {
    id: memberIds.join('+'),
    members: memberIds,
    label: label || members.map((m) => m.label).filter(Boolean).join(' / '),
    gender: genders.size === 1 ? [...genders][0] : null,
    strength: strengths.length ? strengths.reduce((a, b) => a + b, 0) / strengths.length : -1,
  };
}

/**
 * Aplica a formação de duplas (pairing) sobre os classificados de UM grupo.
 *
 * @param {Array<object>} qualifiers classificados do grupo (ordenados)
 * @param {string} pairingMode
 * @param {string} groupLabel
 * @returns {Array<object>} entrants resultantes do grupo
 */
function applyPairing(qualifiers, pairingMode, groupLabel) {
  if (pairingMode === PHASE_PAIRING_MODE.MIXED_BY_GROUP) {
    const males = qualifiers.filter((e) => genderBucket(e) === 'male');
    const females = qualifiers.filter((e) => genderBucket(e) === 'female');
    const pairs = [];
    const n = Math.min(males.length, females.length);
    for (let i = 0; i < n; i += 1) {
      pairs.push(mergeEntrants([males[i], females[i]], `Mista ${groupLabel}`));
    }
    // Sobras (sem par do gênero oposto) avançam individualmente.
    const paired = new Set(pairs.flatMap((p) => p.members));
    qualifiers.forEach((e) => {
      if (!e.members.some((m) => paired.has(m))) pairs.push(e);
    });
    return pairs;
  }
  if (pairingMode === PHASE_PAIRING_MODE.PAIR_TOP_TWO) {
    const out = [];
    for (let i = 0; i < qualifiers.length; i += 2) {
      const pair = qualifiers.slice(i, i + 2);
      out.push(pair.length === 2 ? mergeEntrants(pair, groupLabel) : pair[0]);
    }
    return out;
  }
  return qualifiers;
}

/**
 * Constrói os grupos/entrants da PRÓXIMA fase a partir das fases anteriores.
 *
 * @param {Array<{ index: number, name: string, ranked: object[] }>} sourceGroups
 *   grupos da fase anterior, já classificados (rankEntrantsInGroup).
 * @param {object} prevPhase fase anterior (normalizada) — define a classificação.
 * @param {object} nextPhase próxima fase (normalizada) — define divisão/feed.
 * @param {{ seed?: string }} [options]
 * @returns {{ entrants: object[], groups: Array<{ name: string, index: number, entrants: object[] }>, bracketOrder: object[] }}
 *   `groups` é como a próxima fase fica dividida; `bracketOrder` é a ordem
 *   linear dos entrants para chaves (A enfrenta B, C enfrenta D…).
 */
export function buildNextPhaseEntrants(sourceGroups, prevPhase, nextPhase, options = {}) {
  const seed = options.seed || 'phase';

  // Formar duplas FIXAS (mista/2 melhores) não faz sentido quando a próxima
  // fase é de ROTAÇÃO (Americano/Mexicano), que monta as duplas a cada rodada.
  // Nesse caso os classificados avançam individualmente.
  const effectivePairing = ROTATION_FORMATS.has(nextPhase.type)
    ? PHASE_PAIRING_MODE.NONE
    : prevPhase.pairing_mode;

  // 1) Classificados (com pairing) por grupo de origem, preservando a ordem.
  const advancersByGroup = sourceGroups.map((g) => {
    const quals = selectQualifiers(g.ranked, prevPhase);
    const letter = (g.name || '').replace(/^Grupo\s+/i, '') || groupLetter(g.index || 0);
    const entrants = applyPairing(quals, effectivePairing, letter).map((e, j) => ({
      ...e,
      _groupIndex: g.index || 0,
      _seedRank: j + 1, // 1º, 2º… classificado do grupo
    }));
    return { index: g.index || 0, letter, entrants };
  });

  const allAdvancers = advancersByGroup.flatMap((g) => g.entrants);
  const nextIsBracket = BRACKET_FORMATS.has(nextPhase.type);
  const nextIsGrouped = supportsGroups(nextPhase.type);

  // Ordem da chave: "adjacente" (A×B, C×D) usa a ordem dos grupos; "clássica"
  // espalha por colocação (todos os 1ºs, depois os 2ºs…) para cabeças-de-chave.
  const bracketOrder =
    nextIsBracket && nextPhase.bracket_seeding === PHASE_BRACKET_SEEDING.STANDARD
      ? allAdvancers
          .slice()
          .sort((a, b) => (a._seedRank - b._seedRank) || (a._groupIndex - b._groupIndex))
      : allAdvancers;

  // 2) Monta os grupos da próxima fase conforme o modo de alimentação.
  let groups;
  if (nextIsBracket || nextPhase.feed_mode === PHASE_FEED_MODE.INHERIT_GROUPS) {
    // Em chaves, a ordem dos entrants define os confrontos (ver bracketOrder).
    if (nextIsBracket) {
      groups = [{ name: 'Chave', index: 0, entrants: bracketOrder }];
    } else {
      // Cada grupo de origem segue como um grupo próprio na próxima fase.
      groups = advancersByGroup.map((g, i) => ({
        name: `Grupo ${g.letter}`,
        index: i,
        entrants: g.entrants,
      }));
    }
  } else if (nextPhase.feed_mode === PHASE_FEED_MODE.MERGE_GROUPS) {
    const k = Math.max(2, Math.floor(nextPhase.merge_size) || 2);
    groups = [];
    for (let i = 0; i < advancersByGroup.length; i += k) {
      const chunk = advancersByGroup.slice(i, i + k);
      groups.push({
        name: `Grupo ${chunk.map((c) => c.letter).join('')}`,
        index: groups.length,
        entrants: chunk.flatMap((c) => c.entrants),
      });
    }
  } else {
    // POOL_ALL: junta todos e redistribui conforme a divisão da próxima fase.
    if (nextIsGrouped && nextPhase.division_mode !== PHASE_DIVISION_MODE.SINGLE) {
      groups = assignBalancedGroups(
        allAdvancers,
        computeGroupSizes(allAdvancers.length, {
          mode: nextPhase.division_mode,
          groupCount: nextPhase.group_count,
          maxPerGroup: nextPhase.max_per_group,
        }).sizes,
        { seed: `${seed}:pool` },
      );
    } else {
      groups = [{ name: 'Grupo único', index: 0, entrants: allAdvancers }];
    }
  }

  return {
    entrants: allAdvancers,
    groups,
    bracketOrder,
    bracketSeeding: nextPhase.bracket_seeding,
  };
}
