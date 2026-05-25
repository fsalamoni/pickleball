/**
 * Tabela de pontuação por fase, extraída diretamente da planilha
 * "Spoiler Bolão 2026.ods" (aba Regras).
 *
 * Observação: na planilha "Semifinais", "3º Lugar" e "Disputa de 3º"
 * compartilham o mesmo tier de pontuação. Modelamos como dois stages
 * distintos (`sf` e `third`) que apontam para o mesmo `scoring_tier`.
 */
export const SEED_SCORING_TIERS = [
  {
    stage_code: 'group',
    label: 'Fase de Grupos',
    exact_score: 25,
    winner_plus_diff: 18,
    winner_plus_team_goals: 15,
    winner_only: 12,
    team_goals_only: 5,
    penalty_winner: 0, // não há pênaltis na fase de grupos
  },
  {
    stage_code: 'r16',
    label: '16-avos de Final',
    exact_score: 50,
    winner_plus_diff: 35,
    winner_plus_team_goals: 30,
    winner_only: 25,
    team_goals_only: 10,
    penalty_winner: 25,
  },
  {
    stage_code: 'qf',
    label: 'Oitavas de Final',
    exact_score: 100,
    winner_plus_diff: 70,
    winner_plus_team_goals: 60,
    winner_only: 50,
    team_goals_only: 20,
    penalty_winner: 50,
  },
  {
    stage_code: 'sf',
    label: 'Quartas de Final',
    exact_score: 200,
    winner_plus_diff: 140,
    winner_plus_team_goals: 120,
    winner_only: 100,
    team_goals_only: 40,
    penalty_winner: 100,
  },
  {
    stage_code: 'semi',
    label: 'Semifinais',
    exact_score: 300,
    winner_plus_diff: 210,
    winner_plus_team_goals: 180,
    winner_only: 150,
    team_goals_only: 60,
    penalty_winner: 150,
  },
  {
    stage_code: 'third',
    label: 'Disputa de 3º Lugar',
    exact_score: 300,
    winner_plus_diff: 210,
    winner_plus_team_goals: 180,
    winner_only: 150,
    team_goals_only: 60,
    penalty_winner: 150,
  },
  {
    stage_code: 'final',
    label: 'Final',
    exact_score: 500,
    winner_plus_diff: 350,
    winner_plus_team_goals: 300,
    winner_only: 250,
    team_goals_only: 100,
    penalty_winner: 250,
  },
];

/** Pontuação dos quizzes (palpites especiais) — extraído da planilha */
export const SPECIAL_BET_POINTS = {
  champion: 300,
  top_scorer: 150,
};

export const MAX_POSSIBLE_POINTS = 8550;
