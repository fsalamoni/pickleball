/**
 * @typedef {'group' | 'r16' | 'qf' | 'sf' | 'third' | 'final'} StageCode
 *
 * @typedef {Object} ScoringTier
 * @property {StageCode} stage_code
 * @property {number} exact_score              - Bucha (placar exato)
 * @property {number} winner_plus_diff         - Vencedor + diferença de gols, ou empate sem bucha
 * @property {number} winner_plus_team_goals   - Vencedor + nº de gols de um time
 * @property {number} winner_only              - Apenas o vencedor
 * @property {number} team_goals_only          - Apenas nº de gols de um time
 * @property {number} penalty_winner           - Vencedor dos pênaltis (extra)
 *
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {string=} flag_url
 *
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} tournament_id
 * @property {string} stage_id
 * @property {StageCode} stage_code
 * @property {string=} group_id
 * @property {number} sequence_in_stage
 * @property {string} home_team_id
 * @property {string} away_team_id
 * @property {Date|FirebaseTimestamp} kickoff_at
 * @property {Date|FirebaseTimestamp} bet_lock_at
 * @property {string=} zebra_team_id
 * @property {2|3|4=} zebra_multiplier
 * @property {number=} official_home_score
 * @property {number=} official_away_score
 * @property {string=} penalty_winner_team_id
 * @property {'scheduled'|'live'|'finished'} status
 *
 * @typedef {Object} Bet
 * @property {string} id
 * @property {string} user_id
 * @property {string} pool_id
 * @property {string} match_id
 * @property {number} predicted_home
 * @property {number} predicted_away
 * @property {string=} penalty_winner_team_id
 * @property {boolean} revealed
 *
 * @typedef {Object} ScoreBreakdown
 * @property {number} base_points
 * @property {number} penalty_points
 * @property {number} multiplier
 * @property {number} total_points
 * @property {boolean} is_bucha
 * @property {boolean} is_super_bucha
 * @property {boolean} zebra_applied
 * @property {string} reason - Tipo de acerto que pontuou (exact_score | winner_plus_diff | winner_plus_team_goals | winner_only | team_goals_only | none)
 */

export const STAGE_CODES = ['group', 'r16', 'qf', 'sf', 'third', 'final'];

export const STAGE_LABELS = {
  group: 'Fase de Grupos',
  r16: '16-avos de Final',
  qf: 'Oitavas de Final',
  sf: 'Quartas de Final',
  // The spreadsheet uses "Semi+3º" as a shared tier; we expose them as separate stage labels
  // but they share the same scoring tier (see scoring_tiers seed).
  semi: 'Semifinais',
  third: 'Disputa de 3º Lugar',
  final: 'Final',
};

export const POOL_ROLES = ['owner', 'admin', 'participant'];
export const PLATFORM_ROLES = ['user', 'platform_admin'];
