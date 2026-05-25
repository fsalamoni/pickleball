/**
 * Converte os arquivos `src/data/seed*.js` no formato esperado pela
 * Cloud Function `seedTournament`. Este módulo é importado pela tela
 * de admin (ou rodado por script) e empacota a estrutura completa.
 */
import { SEED_TEAMS, SEED_GROUPS } from '@/modules/tournament/data/seedTeams';
import { SEED_SCORING_TIERS } from '@/modules/tournament/data/seedScoringTiers';
import { SEED_DEADLINES_BRT, TOURNAMENT_START_BRT, TOURNAMENT_END_BRT } from '@/modules/tournament/data/seedDeadlines';
import { SEED_MATCHES } from '@/modules/tournament/data/seedMatches';

const STAGE_ORDER = ['group', 'r16', 'qf', 'sf', 'semi', 'third', 'final'];

const STAGE_LABELS = {
  group: 'Fase de Grupos',
  r16: '16-avos de Final',
  qf: 'Oitavas de Final',
  sf: 'Quartas de Final',
  semi: 'Semifinais',
  third: 'Disputa de 3º Lugar',
  final: 'Final',
};

export function buildSeedPayload() {
  const stages = STAGE_ORDER.map((code, i) => ({
    code,
    label: STAGE_LABELS[code],
    sort_order: i,
    bet_lock_at: SEED_DEADLINES_BRT[code],
  }));

  const matches = SEED_MATCHES.map((m) => ({
    stage_code: m.stage_code,
    group_code: m.group_code || null,
    sequence: m.sequence,
    home_team_code: m.home || null,
    away_team_code: m.away || null,
    home_placeholder: m.home_placeholder || null,
    away_placeholder: m.away_placeholder || null,
    kickoff_at: m.kickoff,
    zebra_team_code: m.zebra || null,
    zebra_multiplier: m.zebra_mult || null,
  }));

  return {
    tournament: {
      name: 'Copa do Mundo FIFA 2026',
      starts_at: TOURNAMENT_START_BRT,
      ends_at: TOURNAMENT_END_BRT,
    },
    groups: SEED_GROUPS,
    teams: SEED_TEAMS,
    scoring_tiers: SEED_SCORING_TIERS,
    stages,
    matches,
  };
}
