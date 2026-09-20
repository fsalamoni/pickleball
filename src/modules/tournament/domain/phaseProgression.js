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

import { buildStandings, headToHeadFromMatches } from './ranking.js';
import { rankByOfficialCriteria } from './tiebreak.js';
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
import { selectWildcards, rankAcrossGroups, withoutLastPlaced, CROSS_GROUP_METHOD } from './crossGroup.js';
import { normalizeDirectEntry, hasDirectEntry } from './directEntry.js';
import { buildTeamRanking, matchToConfrontation, isTeamConfrontation } from './teamFormat.js';

/** Formatos de ROTAÇÃO de parceiros (jogam com duplas montadas por rodada). */
const ROTATION_FORMATS = new Set([
  TOURNAMENT_STAGE_TYPE.AMERICANO,
  TOURNAMENT_STAGE_TYPE.MEXICANO,
]);

/*
 * O comparador de classificação NÃO mora aqui. Ele é um só, em `tiebreak.js`,
 * e vale igual na classificação do grupo, no ranking da modalidade e na
 * progressão entre fases.
 *
 * 🐞 Antes eram duas cópias da mesma regra (aqui e em `ranking.js`), e nenhuma
 * das duas tinha o CONFRONTO DIRETO — o critério que o regulamento coloca
 * logo depois das vitórias. Duas cópias da mesma regra divergem um dia; duas
 * cópias ERRADAS da mesma regra já nascem divergindo do regulamento.
 */

/**
 * Classifica os entrants de um grupo a partir dos jogos do grupo.
 *
 * @param {Array<{ id: string, members: string[], gender?: any, strength?: number }>} entrants
 * @param {Array<object>} matches jogos (apenas os do grupo)
 * @param {object} scoringConfig
 * @returns {Array<object>} entrants em ordem de classificação (1º primeiro),
 *   cada um anotado com `{ stats, rank }`.
 */
export function rankEntrantsInGroup(entrants, matches, scoringConfig, options = {}) {
  // Modalidade de EQUIPES: a classificação segue os critérios do formato de
  // equipes (vitórias de confronto → saldo de etapas → saldo de pontos →
  // confronto direto), e não os critérios de jogo individual.
  if (options.teamConfig) {
    return rankTeamEntrantsInGroup(entrants, matches, options.teamConfig);
  }
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

  // Confronto direto: o índice sai dos jogos DO GRUPO, e a chave é o id de
  // INSCRIÇÃO (o que aparece no jogo). Um entrant pode ter mais de um membro
  // (dupla formada por classificação), então o confronto do entrant é o
  // confronto de qualquer um dos seus membros.
  const headToHead = headToHeadFromMatches(matches, scoringConfig);
  const ordenados = rankByOfficialCriteria(
    withStats.map((w) => ({ ...w.stats, __w: w })),
    {
      headToHead,
      // A ORDEM dos critérios é da fase — o organizador monta a dele.
      order: options.tiebreakOrder || null,
      // Um entrant com vários membros não tem um id só; usamos o primeiro
      // membro, que é quem aparece no jogo daquele lado.
      idOf: (r) => String((r.__w.entrant.members || [])[0] ?? r.__w.entrant.id ?? ''),
    },
  );

  return ordenados.map((r, i) => ({ ...r.__w.entrant, stats: r.__w.stats, rank: i + 1 }));
}

/**
 * Classificação de um grupo de EQUIPES: usa o ranking de equipes e devolve os
 * entrants na mesma forma (`stats` + `rank`) que o resto do motor de fases
 * espera — `wins` = confrontos vencidos, `sets` = etapas, `points` = pontos das
 * etapas. Assim a progressão entre fases funciona sem nenhum caso especial.
 */
function rankTeamEntrantsInGroup(entrants, matches, teamConfig) {
  const confrontations = (matches || []).filter(isTeamConfrontation).map(matchToConfrontation);
  const teamIdOf = (e) => (e.members && e.members[0]) || e.id;
  const ranking = buildTeamRanking(confrontations, entrants.map(teamIdOf), teamConfig);
  const byId = new Map(ranking.map((r) => [String(r.team_id), r]));

  return entrants
    .map((e, index) => {
      const r = byId.get(String(teamIdOf(e)));
      return {
        entrant: e,
        index,
        position: r ? r.position : entrants.length + index + 1,
        stats: {
          wins: r ? r.confrontation_wins : 0,
          losses: r ? r.confrontation_losses : 0,
          played: r ? r.confrontations_played : 0,
          sets_won: r ? r.etapa_wins : 0,
          sets_lost: r ? r.etapa_losses : 0,
          points_for: r ? r.points_for : 0,
          points_against: r ? r.points_against : 0,
        },
      };
    })
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map((w, i) => ({ ...w.entrant, stats: w.stats, rank: i + 1 }));
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
export function selectQualifiers(ranked, phase, groupIndex = null) {
  // Classificados POR GRUPO: com grupos de tamanhos diferentes é comum passar
  // 2 do grupo de 5 e 1 do de 3. A lista, quando existe, manda no número
  // daquele grupo; sem ela, vale o mesmo número para todos.
  const porGrupo = Array.isArray(phase?.qualifiers_by_group) ? phase.qualifiers_by_group : [];
  const especifico = groupIndex != null && Number.isFinite(Number(porGrupo[groupIndex]))
    ? Math.max(0, Math.floor(Number(porGrupo[groupIndex])))
    : null;
  const per = especifico ?? Math.max(0, Math.floor(phase.qualifiers_per_group) || 0);
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

  // REPESCAGEM: as vagas extras vão para os melhores da colocação seguinte ao
  // corte, comparados por TAXA (aproveitamento e saldo por partida) — nunca por
  // número absoluto, que favoreceria quem calhou de estar num grupo maior.
  // Campo aditivo: sem `wildcard_slots`, nada disto roda.
  const metodo = prevPhase.cross_group_method || CROSS_GROUP_METHOD.RATE;
  const repescados = selectWildcards(sourceGroups, {
    qualifiersPerGroup: prevPhase.qualifiers_per_group,
    qualifiersByGroup: prevPhase.qualifiers_by_group,
    fromPosition: prevPhase.wildcard_from_position,
    slots: prevPhase.wildcard_slots || 0,
    method: metodo,
  }).chosen;
  const repescadosPorGrupo = new Map();
  repescados.forEach((e) => {
    const g = e._groupIndex ?? 0;
    if (!repescadosPorGrupo.has(g)) repescadosPorGrupo.set(g, []);
    repescadosPorGrupo.get(g).push(e);
  });

  // 1) Classificados (com pairing) por grupo de origem, preservando a ordem.
  const advancersByGroup = sourceGroups.map((g) => {
    const idx = g.index || 0;
    const quals = selectQualifiers(g.ranked, prevPhase, idx);
    const extras = repescadosPorGrupo.get(idx) || [];
    const letter = (g.name || '').replace(/^Grupo\s+/i, '') || groupLetter(idx);
    const entrants = applyPairing([...quals, ...extras], effectivePairing, letter)
      .map((e, j) => {
        const base = { ...e, _groupIndex: idx, _seedRank: j + 1 }; // 1º, 2º… do grupo
        // Marca só quando é verdade: `undefined` num campo é recusado pelo
        // Firestore, e estes entrants são gravados em `tournament_groups`.
        if (extras.includes(e)) base._wildcard = true;
        return base;
      });
    return { index: idx, letter, entrants };
  });

  const allAdvancers = advancersByGroup.flatMap((g) => g.entrants);
  const nextIsBracket = BRACKET_FORMATS.has(nextPhase.type);
  const nextIsGrouped = supportsGroups(nextPhase.type);

  // Ordem da chave: "adjacente" (A×B, C×D) usa a ordem dos grupos; "clássica"
  // espalha por colocação (todos os 1ºs, depois os 2ºs…) para cabeças-de-chave.
  // Ordem "clássica": primeiro a COLOCAÇÃO (todos os 1ºs, depois os 2ºs…) e,
  // dentro dela, o MÉRITO — aproveitamento e saldo POR PARTIDA. Antes o
  // desempate dentro da colocação era a letra do grupo, o que fazia o 1º do
  // grupo A ser sempre cabeça sobre o 1º do grupo D mesmo tendo ido pior.
  // Com grupos de tamanhos diferentes, comparar por taxa é a única forma
  // honesta: 3 vitórias em 3 é mais do que 3 em 4.
  const paraComparar = (e) => {
    const base = { ...e, rank: e._seedRank };
    if (metodo !== CROSS_GROUP_METHOD.DROP_LAST) return base;
    const grupo = sourceGroups.find((g) => (g.index || 0) === e._groupIndex);
    return grupo ? withoutLastPlaced(base, grupo) : base;
  };
  const bracketOrder =
    nextIsBracket && nextPhase.bracket_seeding === PHASE_BRACKET_SEEDING.STANDARD
      ? rankAcrossGroups(allAdvancers.map(paraComparar), { byPosition: true, method: metodo })
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

  // ENTRADA DIRETA: quem pulou as fases anteriores entra AQUI, como cabeça —
  // `_seedRank: 0` o coloca à frente de todos os classificados na ordem da
  // chave, que é o ponto de ter esperado. Quem chama passa a lista já
  // resolvida (`options.directEntrants`), porque quem sabe quem está inscrito
  // é o serviço, não este arquivo puro.
  const diretos = (options.directEntrants || []).map((e, i) => ({
    ...e,
    _groupIndex: -1,
    _seedRank: 0,
    _directEntry: true,
    _directOrder: i,
  }));

  if (diretos.length > 0) {
    const comDiretos = [...diretos, ...allAdvancers];
    const ordemChave = nextIsBracket
      && nextPhase.bracket_seeding === PHASE_BRACKET_SEEDING.STANDARD
      ? [...diretos, ...bracketOrder]
      : comDiretos;
    return {
      entrants: comDiretos,
      groups: nextIsBracket
        ? [{ name: 'Chave', index: 0, entrants: ordemChave }]
        : redistribuirComDiretos(groups, diretos, nextPhase, seed),
      bracketOrder: ordemChave,
      bracketSeeding: nextPhase.bracket_seeding,
      directEntrants: diretos,
    };
  }

  return {
    entrants: allAdvancers,
    groups,
    bracketOrder,
    bracketSeeding: nextPhase.bracket_seeding,
    directEntrants: [],
  };
}

/**
 * Distribui quem entrou direto nos grupos da próxima fase (quando ela é de
 * grupos, não de chave).
 *
 * Um por grupo, começando pelo primeiro: é o que espalha os cabeças em vez de
 * juntá-los num grupo da morte. Sobrando mais diretos do que grupos, a volta
 * recomeça — o mesmo efeito de uma serpentina, sem precisar re-sortear o que
 * já foi decidido pela classificação.
 */
function redistribuirComDiretos(groups, diretos, nextPhase, seed) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return [{ name: 'Grupo único', index: 0, entrants: diretos }];
  }
  const copia = groups.map((g) => ({ ...g, entrants: [...g.entrants] }));
  diretos.forEach((e, i) => copia[i % copia.length].entrants.push(e));
  return copia;
}
