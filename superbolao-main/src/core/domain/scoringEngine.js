/**
 * Engine de pontuação do Bolão da Copa 2026.
 *
 * Implementa a tabela de pontuação por fase, multiplicadores de Zebra,
 * bônus de pênaltis e detecção de Super Bucha, conforme especificado na
 * planilha "Spoiler Bolão 2026.ods".
 *
 * Esta função é PURA — não depende de Firestore nem de network.
 * Toda a lógica está coberta por testes unitários em scoringEngine.test.js.
 */

/**
 * Tipos de acerto possíveis para uma partida.
 */
export const HIT_TYPES = Object.freeze({
  EXACT_SCORE: 'exact_score', // bucha (placar exato)
  WINNER_PLUS_DIFF: 'winner_plus_diff', // vencedor + diferença de gols, ou empate sem bucha
  WINNER_PLUS_TEAM_GOALS: 'winner_plus_team_goals', // vencedor + nº de gols de um time
  WINNER_ONLY: 'winner_only', // apenas o vencedor
  TEAM_GOALS_ONLY: 'team_goals_only', // apenas nº de gols de um time
  NONE: 'none',
});

/**
 * Resultado canônico (vencedor) de uma partida.
 */
function resultWinner(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home';
  if (homeScore < awayScore) return 'away';
  return 'draw';
}

function hasShootoutScore(homeScore, awayScore) {
  return (
    typeof homeScore === 'number' &&
    Number.isFinite(homeScore) &&
    typeof awayScore === 'number' &&
    Number.isFinite(awayScore) &&
    homeScore !== awayScore
  );
}

function teamIdForSide(match, side) {
  if (side === 'home') return match.home_team_id;
  if (side === 'away') return match.away_team_id;
  return null;
}

/**
 * Determina o tipo de acerto comparando palpite vs resultado oficial.
 *
 * @param {{predicted_home:number, predicted_away:number}} bet
 * @param {{official_home_score:number, official_away_score:number}} match
 * @returns {string} um valor de HIT_TYPES
 */
export function classifyHit(bet, match) {
  const ph = bet.predicted_home;
  const pa = bet.predicted_away;
  const ah = match.official_home_score;
  const aw = match.official_away_score;

  if (ph === ah && pa === aw) return HIT_TYPES.EXACT_SCORE;

  const betWinner = resultWinner(ph, pa);
  const actualWinner = resultWinner(ah, aw);

  if (betWinner === actualWinner) {
    // empate sem bucha => winner_plus_diff (regra explícita da planilha)
    if (actualWinner === 'draw') return HIT_TYPES.WINNER_PLUS_DIFF;

    const betDiff = Math.abs(ph - pa);
    const actualDiff = Math.abs(ah - aw);

    if (betDiff === actualDiff) return HIT_TYPES.WINNER_PLUS_DIFF;
    if (ph === ah || pa === aw) return HIT_TYPES.WINNER_PLUS_TEAM_GOALS;
    return HIT_TYPES.WINNER_ONLY;
  }

  // Vencedor errado — verifica se acertou nº de gols de um time
  if (ph === ah || pa === aw) return HIT_TYPES.TEAM_GOALS_ONLY;
  return HIT_TYPES.NONE;
}

/**
 * Pontos base do tier para o tipo de acerto.
 */
function pointsForHit(tier, hitType) {
  switch (hitType) {
    case HIT_TYPES.EXACT_SCORE:
      return tier.exact_score;
    case HIT_TYPES.WINNER_PLUS_DIFF:
      return tier.winner_plus_diff;
    case HIT_TYPES.WINNER_PLUS_TEAM_GOALS:
      return tier.winner_plus_team_goals;
    case HIT_TYPES.WINNER_ONLY:
      return tier.winner_only;
    case HIT_TYPES.TEAM_GOALS_ONLY:
      return tier.team_goals_only;
    default:
      return 0;
  }
}

/**
 * Verifica se o palpite apontou a vitória da ZEBRA da partida.
 */
function betPredictsZebraWin(bet, match) {
  if (!match.zebra_team_id) return false;
  const penaltyWinner = hasShootoutScore(bet.predicted_home_penalties, bet.predicted_away_penalties)
    ? teamIdForSide(match, resultWinner(bet.predicted_home_penalties, bet.predicted_away_penalties))
    : bet.penalty_winner_team_id;
  if (match.zebra_team_id === match.home_team_id) {
    return bet.predicted_home > bet.predicted_away || penaltyWinner === match.zebra_team_id;
  }
  if (match.zebra_team_id === match.away_team_id) {
    return bet.predicted_away > bet.predicted_home || penaltyWinner === match.zebra_team_id;
  }
  return false;
}

/**
 * Verifica se o resultado oficial foi VITÓRIA da ZEBRA da partida.
 */
function actualIsZebraWin(match) {
  if (!match.zebra_team_id) return false;
  const winner = resultWinner(match.official_home_score, match.official_away_score);
  if (winner === 'draw') {
    const penaltyWinner = hasShootoutScore(match.official_home_penalties, match.official_away_penalties)
      ? teamIdForSide(match, resultWinner(match.official_home_penalties, match.official_away_penalties))
      : match.penalty_winner_team_id;
    return penaltyWinner === match.zebra_team_id;
  }
  if (match.zebra_team_id === match.home_team_id) return winner === 'home';
  if (match.zebra_team_id === match.away_team_id) return winner === 'away';
  return false;
}

/**
 * Pontos extras de pênaltis — quando houver placar de pênaltis oficial,
 * trata o desempate como um jogo extra sem empate possível.
 *
 * Aplica-se somente em fases de mata-mata (tier.penalty_winner > 0).
 */
function computePenaltyResult(bet, match, tier) {
  if (!tier.penalty_winner) return { points: 0, hitType: null };
  if (hasShootoutScore(match.official_home_penalties, match.official_away_penalties)) {
    if (!hasShootoutScore(bet.predicted_home_penalties, bet.predicted_away_penalties)) return { points: 0, hitType: null };
    const hitType = classifyHit(
      { predicted_home: bet.predicted_home_penalties, predicted_away: bet.predicted_away_penalties },
      { ...match, official_home_score: match.official_home_penalties, official_away_score: match.official_away_penalties },
    );
    const points = hitType === HIT_TYPES.WINNER_ONLY ? tier.penalty_winner : pointsForHit(tier, hitType);
    return { points, hitType };
  }
  if (!match.penalty_winner_team_id) return { points: 0, hitType: null };
  if (!bet.penalty_winner_team_id) return { points: 0, hitType: null };
  return bet.penalty_winner_team_id === match.penalty_winner_team_id
    ? { points: tier.penalty_winner, hitType: HIT_TYPES.WINNER_ONLY }
    : { points: 0, hitType: HIT_TYPES.NONE };
}

/**
 * Calcula a pontuação total e o detalhamento de um palpite para uma partida.
 *
 * @param {Object} bet - {predicted_home, predicted_away, predicted_home_penalties?, predicted_away_penalties?, penalty_winner_team_id?}
 * @param {Object} match - {official_home_score, official_away_score, official_home_penalties?, official_away_penalties?, home_team_id, away_team_id, zebra_team_id?, zebra_multiplier?, penalty_winner_team_id?}
 * @param {Object} tier - {exact_score, winner_plus_diff, winner_plus_team_goals, winner_only, team_goals_only, penalty_winner}
 * @returns {{total_points:number, base_points:number, penalty_points:number, penalty_hit_type:string|null, multiplier:number, hit_type:string, bucha_count:number, super_bucha_count:number, is_bucha:boolean, is_super_bucha:boolean, zebra_applied:boolean}}
 */
export function computeMatchPoints(bet, match, tier) {
  if (
    typeof match.official_home_score !== 'number' ||
    typeof match.official_away_score !== 'number'
  ) {
    throw new Error('Match must have official scores set before computing points.');
  }

  const hitType = classifyHit(bet, match);
  const baseRaw = pointsForHit(tier, hitType);

  // Zebra: precisa palpitar em vitória da zebra E zebra ter vencido de fato
  const zebraApplied =
    !!match.zebra_team_id &&
    !!match.zebra_multiplier &&
    betPredictsZebraWin(bet, match) &&
    actualIsZebraWin(match);

  const multiplier = zebraApplied ? match.zebra_multiplier : 1;
  const basePoints = baseRaw * multiplier;

  const penaltyResult = computePenaltyResult(bet, match, tier);
  const penaltyPoints = penaltyResult.points * multiplier;
  const totalPoints = basePoints + penaltyPoints;

  const buchaCount = (hitType === HIT_TYPES.EXACT_SCORE ? 1 : 0) + (penaltyResult.hitType === HIT_TYPES.EXACT_SCORE ? 1 : 0);
  const isBucha = buchaCount > 0;

  // Super Bucha (critério de desempate, NÃO cumulativa em pontos):
  //  1) Bucha + Vencedor dos pênaltis
  //  2) Bucha + Zebra aplicada
  //  3) (3) Acertar Campeão — tratado em special bets, não aqui.
  const isSuperBucha = isBucha && (penaltyPoints > 0 || zebraApplied);
  const superBuchaCount = isSuperBucha ? 1 : 0;

  return {
    total_points: totalPoints,
    base_points: basePoints,
    penalty_points: penaltyPoints,
    penalty_hit_type: penaltyResult.hitType,
    bucha_count: buchaCount,
    super_bucha_count: superBuchaCount,
    multiplier,
    hit_type: hitType,
    is_bucha: isBucha,
    is_super_bucha: isSuperBucha,
    zebra_applied: zebraApplied,
  };
}

/**
 * Palpite-padrão para usuários que não palpitaram — placar 0×0 sem pênaltis.
 * Regra explícita da planilha: jogos não palpitados pontuam como 0×0.
 */
export function defaultBet() {
  return {
    predicted_home: 0,
    predicted_away: 0,
    penalty_winner_team_id: null,
    predicted_home_penalties: null,
    predicted_away_penalties: null,
  };
}

/**
 * Calcula pontos para um palpite especial (campeão ou artilheiro).
 *
 * @param {{type:'champion'|'top_scorer', team_id?:string, player_name?:string}} specialBet
 * @param {{champion_team_id?:string, top_scorer_player_name?:string}} tournament
 * @param {{champion:number, top_scorer:number}} pointsTable
 * @returns {{points:number, hit:boolean, is_super_bucha:boolean}}
 */
export function computeSpecialBetPoints(specialBet, tournament, pointsTable) {
  if (specialBet.type === 'champion') {
    const hit =
      tournament.champion_team_id &&
      specialBet.team_id &&
      specialBet.team_id === tournament.champion_team_id;
    return {
      points: hit ? pointsTable.champion : 0,
      hit: !!hit,
      // acertar campeão é uma das condições de Super Bucha (planilha)
      is_super_bucha: !!hit,
    };
  }
  if (specialBet.type === 'top_scorer') {
    const hit =
      tournament.top_scorer_player_name &&
      specialBet.player_name &&
      normalizeName(specialBet.player_name) === normalizeName(tournament.top_scorer_player_name);
    return {
      points: hit ? pointsTable.top_scorer : 0,
      hit: !!hit,
      is_super_bucha: false,
    };
  }
  return { points: 0, hit: false, is_super_bucha: false };
}

function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Compara dois jogadores no Ranking Geral aplicando os critérios de desempate
 * extraídos da planilha:
 *   1) Pontos (desc)
 *   2) Nº de buchas (desc)
 *   3) Nº de super buchas (desc)
 *   4) Melhor colocação na 1ª fase (asc — menor é melhor)
 *
 * @returns negativo se a vem antes de b; positivo se b antes de a.
 */
export function compareForGeneralRanking(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.buchas !== a.buchas) return b.buchas - a.buchas;
  if (b.super_buchas !== a.super_buchas) return b.super_buchas - a.super_buchas;

  const ag = a.group_stage_position ?? Number.POSITIVE_INFINITY;
  const bg = b.group_stage_position ?? Number.POSITIVE_INFINITY;
  return ag - bg;
}

/**
 * Compara dois jogadores no Ranking de Buchas:
 *   1) Nº de buchas (desc)
 *   2) Nº de super buchas (desc)
 *   3) Pior colocação no ranking geral (desc — maior posição = pior = vence o desempate)
 */
export function compareForBuchaRanking(a, b) {
  if (b.buchas !== a.buchas) return b.buchas - a.buchas;
  if (b.super_buchas !== a.super_buchas) return b.super_buchas - a.super_buchas;
  const ag = a.general_ranking_position ?? 0;
  const bg = b.general_ranking_position ?? 0;
  return bg - ag;
}
