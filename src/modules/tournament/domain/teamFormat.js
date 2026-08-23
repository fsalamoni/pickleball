/**
 * Domínio puro do FORMATO DE EQUIPES em torneios (flag team_tournaments).
 *
 * Uma modalidade "de equipes" é disputada por EQUIPES (cada equipe é uma
 * inscrição com vários atletas). Duas equipes se enfrentam num CONFRONTO, que é
 * decidido por várias ETAPAS (sub-jogos): dupla masculina, dupla feminina, dupla
 * mista e/ou simples. O criador do torneio define livremente quantas e quais
 * etapas compõem um confronto e se todas são disputadas ("todas") ou se vale o
 * "melhor de X" (primeira equipe a vencer X etapas).
 *
 * As FASES (pontos corridos, grupos, chaves, mata-mata…) reaproveitam o motor
 * existente — a única diferença é que o "participante" é uma equipe e cada
 * "jogo" da fase é um CONFRONTO de equipes.
 *
 * Este módulo é 100% puro (sem Firebase/React): valida configuração, elencos e
 * escalações, apura o resultado de um confronto e monta a classificação de
 * equipes com os critérios de desempate pedidos. Nada aqui escreve no banco.
 */

import { GENDER_CATEGORY, COMPETITION_GENDER } from './constants.js';

/** Gênero da equipe (composição do elenco). Reaproveita os valores de categoria. */
export const TEAM_GENDER = Object.freeze({
  MALE: GENDER_CATEGORY.MALE, // 'male'
  FEMALE: GENDER_CATEGORY.FEMALE, // 'female'
  MIXED: GENDER_CATEGORY.MIXED, // 'mixed'
});

export const TEAM_GENDER_LABELS = Object.freeze({
  [TEAM_GENDER.MALE]: 'Masculina',
  [TEAM_GENDER.FEMALE]: 'Feminina',
  [TEAM_GENDER.MIXED]: 'Mista',
});

/** Tipo de cada ETAPA (sub-jogo) de um confronto de equipes. */
export const TEAM_ETAPA_TYPE = Object.freeze({
  MENS_DOUBLES: 'mens_doubles', // dupla masculina (2 homens por lado)
  WOMENS_DOUBLES: 'womens_doubles', // dupla feminina (2 mulheres por lado)
  MIXED_DOUBLES: 'mixed_doubles', // dupla mista (1 homem + 1 mulher por lado)
  SINGLES: 'singles', // simples (1 jogador por lado)
});

export const TEAM_ETAPA_TYPE_LABELS = Object.freeze({
  [TEAM_ETAPA_TYPE.MENS_DOUBLES]: 'Dupla masculina',
  [TEAM_ETAPA_TYPE.WOMENS_DOUBLES]: 'Dupla feminina',
  [TEAM_ETAPA_TYPE.MIXED_DOUBLES]: 'Dupla mista',
  [TEAM_ETAPA_TYPE.SINGLES]: 'Simples',
});

/** Como o confronto é decidido. */
export const TEAM_WIN_RULE = Object.freeze({
  ALL: 'all', // disputam-se TODAS as etapas; vence quem ganhar mais
  BEST_OF: 'best_of', // primeira equipe a vencer `win_target` etapas
});

export const TEAM_WIN_RULE_LABELS = Object.freeze({
  [TEAM_WIN_RULE.ALL]: 'Disputar todas as etapas',
  [TEAM_WIN_RULE.BEST_OF]: 'Melhor de X (primeira a atingir o alvo)',
});

/** Modo do SIMPLES dentro do confronto de equipes. */
export const TEAM_SINGLES_MODE = Object.freeze({
  SINGLE: 'single_player', // um único jogador de cada equipe disputa
  ROTATING: 'rotating_points', // todos jogam, trocando a cada X pontos
});

export const TEAM_SINGLES_MODE_LABELS = Object.freeze({
  [TEAM_SINGLES_MODE.SINGLE]: 'Um jogador por equipe',
  [TEAM_SINGLES_MODE.ROTATING]: 'Todos jogam (rodízio por pontos)',
});

/** Limites de segurança (evitam configurações abusivas). */
export const TEAM_LIMITS = Object.freeze({
  MIN_TEAM_SIZE: 2,
  MAX_TEAM_SIZE: 20,
  MIN_ETAPAS: 1,
  MAX_ETAPAS: 15,
  MIN_ROTATION_POINTS: 1,
  MAX_ROTATION_POINTS: 99,
});

const ETAPA_TYPES = new Set(Object.values(TEAM_ETAPA_TYPE));

/** Nº de jogadores por lado numa etapa (2 para duplas, 1 para simples). */
export function etapaPlayersPerSide(type) {
  return type === TEAM_ETAPA_TYPE.SINGLES ? 1 : 2;
}

/**
 * Gêneros exigidos por lado numa etapa, quando aplicável. `null` = sem
 * restrição de gênero (simples é livre; mistas exigem 1 de cada).
 * @returns {{ male: number, female: number }|null}
 */
export function etapaGenderNeeds(type) {
  switch (type) {
    case TEAM_ETAPA_TYPE.MENS_DOUBLES:
      return { male: 2, female: 0 };
    case TEAM_ETAPA_TYPE.WOMENS_DOUBLES:
      return { male: 0, female: 2 };
    case TEAM_ETAPA_TYPE.MIXED_DOUBLES:
      return { male: 1, female: 1 };
    case TEAM_ETAPA_TYPE.SINGLES:
    default:
      return null;
  }
}

function trimmed(v) {
  return String(v ?? '').trim();
}

function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Normaliza e valida a configuração de uma modalidade de equipes.
 *
 * @param {object} input
 * @param {number} input.team_size          atletas por equipe (elenco)
 * @param {string} input.gender             'male' | 'female' | 'mixed'
 * @param {Array}  input.etapas             etapas do confronto (ordem importa)
 * @param {string} input.win_rule           'all' | 'best_of'
 * @param {number} [input.win_target]       para best_of: etapas para vencer
 * @param {string} [input.singles_mode]     'single_player' | 'rotating_points'
 * @param {number} [input.singles_rotation_points] para rotating: troca a cada X
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function normalizeTeamConfig(input = {}) {
  const errors = {};

  const gender = Object.values(TEAM_GENDER).includes(input.gender)
    ? input.gender
    : TEAM_GENDER.MIXED;

  const teamSize = clampInt(input.team_size, TEAM_LIMITS.MIN_TEAM_SIZE, TEAM_LIMITS.MAX_TEAM_SIZE, 4);

  // Mistas: metade masculina, metade feminina (mesmo nº de vagas).
  let maleSlots = 0;
  let femaleSlots = 0;
  if (gender === TEAM_GENDER.MALE) {
    maleSlots = teamSize;
  } else if (gender === TEAM_GENDER.FEMALE) {
    femaleSlots = teamSize;
  } else {
    if (teamSize % 2 !== 0) {
      errors.team_size = 'Equipes mistas precisam de um número par de atletas (metade masculina, metade feminina).';
    }
    maleSlots = Math.floor(teamSize / 2);
    femaleSlots = teamSize - maleSlots;
  }

  // Etapas (sub-jogos do confronto).
  const rawEtapas = Array.isArray(input.etapas) ? input.etapas : [];
  const etapas = rawEtapas
    .slice(0, TEAM_LIMITS.MAX_ETAPAS)
    .map((e, i) => normalizeEtapaSpec(e, i))
    .filter(Boolean);

  if (etapas.length < TEAM_LIMITS.MIN_ETAPAS) {
    errors.etapas = 'Defina ao menos uma etapa (sub-jogo) para o confronto.';
  }

  // Coerência de gênero: uma equipe só masculina não pode ter etapa feminina/mista.
  const usesFemale = etapas.some((e) => e.type === TEAM_ETAPA_TYPE.WOMENS_DOUBLES || e.type === TEAM_ETAPA_TYPE.MIXED_DOUBLES);
  const usesMale = etapas.some((e) => e.type === TEAM_ETAPA_TYPE.MENS_DOUBLES || e.type === TEAM_ETAPA_TYPE.MIXED_DOUBLES);
  if (gender === TEAM_GENDER.MALE && usesFemale) {
    errors.etapas = 'Equipe masculina não pode ter etapa feminina ou mista.';
  }
  if (gender === TEAM_GENDER.FEMALE && usesMale) {
    errors.etapas = 'Equipe feminina não pode ter etapa masculina ou mista.';
  }

  const winRule = Object.values(TEAM_WIN_RULE).includes(input.win_rule)
    ? input.win_rule
    : TEAM_WIN_RULE.ALL;

  // Alvo do "melhor de X": por padrão a maioria simples das etapas.
  const majority = Math.floor(etapas.length / 2) + 1;
  let winTarget = winRule === TEAM_WIN_RULE.BEST_OF
    ? clampInt(input.win_target, 1, Math.max(1, etapas.length), majority)
    : etapas.length;
  if (winRule === TEAM_WIN_RULE.BEST_OF && etapas.length > 0 && winTarget > etapas.length) {
    winTarget = etapas.length;
  }

  const singlesMode = Object.values(TEAM_SINGLES_MODE).includes(input.singles_mode)
    ? input.singles_mode
    : TEAM_SINGLES_MODE.SINGLE;
  const singlesRotationPoints = clampInt(
    input.singles_rotation_points,
    TEAM_LIMITS.MIN_ROTATION_POINTS,
    TEAM_LIMITS.MAX_ROTATION_POINTS,
    5,
  );

  const value = {
    team_size: teamSize,
    gender,
    male_slots: maleSlots,
    female_slots: femaleSlots,
    etapas,
    win_rule: winRule,
    win_target: winTarget,
    singles_mode: singlesMode,
    singles_rotation_points: singlesRotationPoints,
  };

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** Normaliza a especificação de UMA etapa (na configuração da modalidade). */
function normalizeEtapaSpec(e, index) {
  const type = ETAPA_TYPES.has(e?.type) ? e.type : null;
  if (!type) return null;
  return {
    id: trimmed(e?.id) || `etapa_${index + 1}`,
    type,
    label: trimmed(e?.label).slice(0, 60) || TEAM_ETAPA_TYPE_LABELS[type],
  };
}

/**
 * Valida o ELENCO (roster) de uma equipe contra a configuração da modalidade.
 * @param {Array<{user_id?:string,name?:string,gender?:string}>} members
 * @param {object} config  saída de normalizeTeamConfig().value
 * @returns {{ valid: boolean, errors: string[], males: number, females: number }}
 */
export function validateTeamRoster(members = [], config = {}) {
  const errors = [];
  const list = Array.isArray(members) ? members.filter(Boolean) : [];
  const males = list.filter((m) => m.gender === COMPETITION_GENDER.MALE).length;
  const females = list.filter((m) => m.gender === COMPETITION_GENDER.FEMALE).length;

  if (list.length !== config.team_size) {
    errors.push(`A equipe precisa de exatamente ${config.team_size} atleta(s).`);
  }
  if (config.gender === TEAM_GENDER.MIXED) {
    if (males !== config.male_slots || females !== config.female_slots) {
      errors.push(`Equipe mista: ${config.male_slots} masculino(s) e ${config.female_slots} feminino(s).`);
    }
  } else if (config.gender === TEAM_GENDER.MALE && females > 0) {
    errors.push('Equipe masculina só aceita atletas masculinos.');
  } else if (config.gender === TEAM_GENDER.FEMALE && males > 0) {
    errors.push('Equipe feminina só aceita atletas femininas.');
  }
  // Sem repetição de atleta no mesmo elenco.
  const ids = list.map((m) => m.user_id).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    errors.push('Há atleta repetido no elenco.');
  }

  return { valid: errors.length === 0, errors, males, females };
}

/**
 * Valida a ESCALAÇÃO de um confronto (quem joga cada etapa, por lado),
 * informada pelo admin no momento do jogo.
 *
 * Regras:
 *  - cada etapa precisa do nº certo de jogadores por lado e do gênero correto;
 *  - todos os jogadores escalados precisam pertencer ao elenco daquela equipe;
 *  - AS DUPLAS MISTAS NÃO REPETEM JOGADORES entre si (dentro do mesmo lado);
 *  - no simples "um jogador", um por lado; no rodízio, uma ORDEM de jogadores.
 *
 * @param {Array<{type:string, side_a:string[], side_b:string[]}>} lineup
 * @param {object} config       saída de normalizeTeamConfig().value
 * @param {string[]} rosterAIds ids do elenco da equipe A
 * @param {string[]} rosterBIds ids do elenco da equipe B
 * @param {Map<string,string>} [genderById] id -> 'male'|'female' (p/ checar gênero)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfrontationLineup(lineup = [], config = {}, rosterAIds = [], rosterBIds = [], genderById = new Map()) {
  const errors = [];
  const rosterA = new Set(rosterAIds.filter(Boolean));
  const rosterB = new Set(rosterBIds.filter(Boolean));
  const mixedA = []; // jogadores usados em mistas (lado A) — não podem repetir
  const mixedB = [];

  (Array.isArray(lineup) ? lineup : []).forEach((etapa, i) => {
    const type = etapa?.type;
    const label = TEAM_ETAPA_TYPE_LABELS[type] || `Etapa ${i + 1}`;
    const a = (etapa?.side_a || []).filter(Boolean);
    const b = (etapa?.side_b || []).filter(Boolean);

    // Pertencimento ao elenco.
    if (a.some((id) => !rosterA.has(id))) errors.push(`${label}: jogador do lado A fora do elenco.`);
    if (b.some((id) => !rosterB.has(id))) errors.push(`${label}: jogador do lado B fora do elenco.`);

    // Sem repetir o mesmo jogador dentro do mesmo lado da etapa.
    if (new Set(a).size !== a.length || new Set(b).size !== b.length) {
      errors.push(`${label}: jogador repetido na mesma dupla.`);
    }

    if (type === TEAM_ETAPA_TYPE.SINGLES) {
      // Um jogador (modo single) ou uma ordem (rodízio) — exige ao menos 1.
      if (config.singles_mode === TEAM_SINGLES_MODE.SINGLE) {
        if (a.length !== 1) errors.push(`${label}: escale 1 jogador no lado A.`);
        if (b.length !== 1) errors.push(`${label}: escale 1 jogador no lado B.`);
      } else {
        if (a.length < 1) errors.push(`${label}: defina a ordem do lado A.`);
        if (b.length < 1) errors.push(`${label}: defina a ordem do lado B.`);
      }
      return;
    }

    const perSide = etapaPlayersPerSide(type);
    if (a.length !== perSide) errors.push(`${label}: o lado A precisa de ${perSide} jogador(es).`);
    if (b.length !== perSide) errors.push(`${label}: o lado B precisa de ${perSide} jogador(es).`);

    // Checagem de gênero por etapa (quando o mapa de gênero é fornecido).
    const needs = etapaGenderNeeds(type);
    if (needs && genderById && genderById.size > 0) {
      const countGender = (ids, g) => ids.filter((id) => genderById.get(id) === g).length;
      [['A', a], ['B', b]].forEach(([sideLabel, ids]) => {
        if (countGender(ids, COMPETITION_GENDER.MALE) !== needs.male
          || countGender(ids, COMPETITION_GENDER.FEMALE) !== needs.female) {
          errors.push(`${label}: composição de gênero inválida no lado ${sideLabel}.`);
        }
      });
    }

    if (type === TEAM_ETAPA_TYPE.MIXED_DOUBLES) {
      mixedA.push(...a);
      mixedB.push(...b);
    }
  });

  // Duplas mistas não repetem jogadores (entre as mistas do mesmo lado).
  if (new Set(mixedA).size !== mixedA.length) errors.push('As duplas mistas do lado A repetem jogador(es).');
  if (new Set(mixedB).size !== mixedB.length) errors.push('As duplas mistas do lado B repetem jogador(es).');

  return { valid: errors.length === 0, errors };
}

/** Uma etapa está decidida? (ambos os placares e sem empate) */
export function etapaDecided(etapa) {
  return !!etapa && etapa.score_a != null && etapa.score_b != null && Number(etapa.score_a) !== Number(etapa.score_b);
}

/** Vencedor de uma etapa: 'a' | 'b' | null. */
export function etapaWinner(etapa) {
  if (!etapaDecided(etapa)) return null;
  return Number(etapa.score_a) > Number(etapa.score_b) ? 'a' : 'b';
}

/**
 * Apura o resultado de UM confronto de equipes a partir dos resultados das
 * etapas e da configuração da modalidade.
 *
 * @param {{ etapas?: Array }} confrontation  etapas com score_a/score_b
 * @param {object} config                     saída de normalizeTeamConfig().value
 * @returns {{
 *   decided: boolean, winner: ('a'|'b'|null),
 *   etapaWins: { a: number, b: number },
 *   points: { a: number, b: number },
 *   etapasDecided: number, etapasTotal: number, target: number,
 * }}
 */
export function computeConfrontationResult(confrontation = {}, config = {}) {
  const etapas = Array.isArray(confrontation.etapas) ? confrontation.etapas : [];
  const etapaWins = { a: 0, b: 0 };
  const points = { a: 0, b: 0 };
  let decidedCount = 0;

  etapas.forEach((e) => {
    points.a += Number(e?.score_a) || 0;
    points.b += Number(e?.score_b) || 0;
    const w = etapaWinner(e);
    if (w) {
      decidedCount += 1;
      etapaWins[w] += 1;
    }
  });

  const total = etapas.length;
  const winRule = config.win_rule || TEAM_WIN_RULE.ALL;
  const target = winRule === TEAM_WIN_RULE.BEST_OF
    ? (Number(config.win_target) || (Math.floor(total / 2) + 1))
    : total;

  let decided = false;
  let winner = null;

  if (winRule === TEAM_WIN_RULE.BEST_OF) {
    // Primeira equipe a atingir o alvo vence — não precisa jogar as demais.
    if (etapaWins.a >= target) { decided = true; winner = 'a'; }
    else if (etapaWins.b >= target) { decided = true; winner = 'b'; }
  } else {
    // Todas as etapas: decidido quando todas têm vencedor.
    if (total > 0 && decidedCount === total) {
      decided = true;
      if (etapaWins.a > etapaWins.b) winner = 'a';
      else if (etapaWins.b > etapaWins.a) winner = 'b';
      else winner = null; // empate em nº de etapas (raro em nº ímpar)
    }
  }

  return {
    decided,
    winner,
    etapaWins,
    points,
    etapasDecided: decidedCount,
    etapasTotal: total,
    target,
  };
}

function emptyTeamStat(id) {
  return {
    team_id: id,
    confrontations_played: 0,
    confrontation_wins: 0,
    confrontation_losses: 0,
    confrontation_draws: 0,
    etapa_wins: 0,
    etapa_losses: 0,
    points_for: 0,
    points_against: 0,
  };
}

/**
 * Monta as estatísticas brutas por equipe a partir de uma lista de confrontos.
 * Cada confronto: { team_a_id, team_b_id, etapas:[...] } (resultados). Só os
 * confrontos DECIDIDOS contam vitória/derrota; etapas e pontos somam sempre.
 *
 * @param {Array} confrontations
 * @param {string[]} teamIds
 * @param {object} config
 * @returns {Array} stats por equipe
 */
export function buildTeamStandings(confrontations = [], teamIds = [], config = {}) {
  const stats = new Map();
  teamIds.forEach((id) => stats.set(String(id), emptyTeamStat(String(id))));
  const ensure = (id) => {
    const key = String(id);
    if (!stats.has(key)) stats.set(key, emptyTeamStat(key));
    return stats.get(key);
  };

  (confrontations || []).forEach((c) => {
    const aId = c?.team_a_id;
    const bId = c?.team_b_id;
    if (!aId || !bId) return;
    const res = computeConfrontationResult(c, config);
    const sa = ensure(aId);
    const sb = ensure(bId);

    // Etapas e pontos somam mesmo com o confronto em andamento.
    sa.etapa_wins += res.etapaWins.a;
    sa.etapa_losses += res.etapaWins.b;
    sb.etapa_wins += res.etapaWins.b;
    sb.etapa_losses += res.etapaWins.a;
    sa.points_for += res.points.a;
    sa.points_against += res.points.b;
    sb.points_for += res.points.b;
    sb.points_against += res.points.a;

    if (!res.decided) return;
    sa.confrontations_played += 1;
    sb.confrontations_played += 1;
    if (res.winner === 'a') {
      sa.confrontation_wins += 1;
      sb.confrontation_losses += 1;
    } else if (res.winner === 'b') {
      sb.confrontation_wins += 1;
      sa.confrontation_losses += 1;
    } else {
      sa.confrontation_draws += 1;
      sb.confrontation_draws += 1;
    }
  });

  return Array.from(stats.values());
}

/**
 * Vencedor do confronto direto entre DUAS equipes (para desempate). Retorna o
 * team_id vencedor, ou null se não há confronto decidido entre elas.
 */
export function headToHeadWinner(confrontations, xId, yId, config) {
  for (const c of confrontations || []) {
    const pair = [c?.team_a_id, c?.team_b_id];
    if (!pair.includes(xId) || !pair.includes(yId)) continue;
    const res = computeConfrontationResult(c, config);
    if (!res.decided || !res.winner) continue;
    const winnerId = res.winner === 'a' ? c.team_a_id : c.team_b_id;
    return winnerId;
  }
  return null;
}

/**
 * Ordena a classificação de equipes com os critérios pedidos, nesta ordem:
 *   1. mais VITÓRIAS DE CONFRONTO (equipe × equipe);
 *   2. melhor SALDO DE ETAPAS (vitórias − derrotas de etapas de confronto);
 *   3. melhor SALDO DE PONTOS (pontos a favor − contra);
 *   4. CONFRONTO DIRETO entre as empatadas.
 *
 * @param {Array} standings   saída de buildTeamStandings
 * @param {Array} confrontations  para o confronto direto
 * @param {object} config
 * @returns {Array} standings ordenados com `position`
 */
export function rankTeamStandings(standings = [], confrontations = [], config = {}) {
  const etapaBalance = (s) => (s.etapa_wins || 0) - (s.etapa_losses || 0);
  const pointBalance = (s) => (s.points_for || 0) - (s.points_against || 0);
  const base = (standings || []).slice().sort((x, y) => {
    // 1) vitórias de confronto
    if (y.confrontation_wins !== x.confrontation_wins) return y.confrontation_wins - x.confrontation_wins;
    // 2) saldo de etapas (vitórias − derrotas)
    if (etapaBalance(y) !== etapaBalance(x)) return etapaBalance(y) - etapaBalance(x);
    // 3) saldo de pontos
    if (pointBalance(y) !== pointBalance(x)) return pointBalance(y) - pointBalance(x);
    return 0;
  });

  // 4) confronto direto: só reordena PARES ainda empatados nos critérios acima.
  const tiedEqual = (a, b) => a.confrontation_wins === b.confrontation_wins
    && etapaBalance(a) === etapaBalance(b)
    && pointBalance(a) === pointBalance(b);

  for (let i = 0; i < base.length - 1; i += 1) {
    const cur = base[i];
    const nxt = base[i + 1];
    if (tiedEqual(cur, nxt)) {
      const h2h = headToHeadWinner(confrontations, cur.team_id, nxt.team_id, config);
      if (h2h === nxt.team_id) {
        base[i] = nxt;
        base[i + 1] = cur;
      }
    }
  }

  return base.map((s, i) => ({ ...s, position: i + 1 }));
}

/** Classificação de equipes pronta (stats + ordenação). */
export function buildTeamRanking(confrontations, teamIds, config) {
  const standings = buildTeamStandings(confrontations, teamIds, config);
  return rankTeamStandings(standings, confrontations, config);
}
