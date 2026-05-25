/**
 * Calendário de 104 partidas da Copa do Mundo 2026, extraído da planilha
 * "Spoiler Bolão 2026.ods" (aba "Resultados Oficiais").
 *
 * Os jogos da fase de grupos referem-se a confrontos diretos entre seleções.
 * Os jogos do mata-mata referem-se a posições (1º do Grupo X, vencedor de Y).
 *
 * Datas no formato BRT (UTC-3), conferidas contra a tabela pública da FIFA
 * replicada no artigo da Copa 2026 da Wikipedia, com horários locais oficiais
 * convertidos para America/Sao_Paulo.
 *
 * Cada match inclui o stage_code para ligação com scoring_tiers.
 * Zebras conforme planilha: vitória do time-zebra multiplica todos os pontos.
 */

const T = (dateBRT, timeBRT = '16:00:00') => `${dateBRT}T${timeBRT}-03:00`;

export const SEED_MATCHES = [
  // ==================== GROUP STAGE (72) ====================
  // Group A
  { stage_code: 'group', group_code: 'A', sequence: 1, home: 'MEX', away: 'RSA', kickoff: T('2026-06-11'), zebra: 'RSA', zebra_mult: 2 },
  { stage_code: 'group', group_code: 'A', sequence: 2, home: 'KOR', away: 'CZE', kickoff: T('2026-06-11', '23:00:00') },
  { stage_code: 'group', group_code: 'A', sequence: 3, home: 'CZE', away: 'RSA', kickoff: T('2026-06-18', '13:00:00') },
  { stage_code: 'group', group_code: 'A', sequence: 4, home: 'MEX', away: 'KOR', kickoff: T('2026-06-18', '22:00:00') },
  { stage_code: 'group', group_code: 'A', sequence: 5, home: 'CZE', away: 'MEX', kickoff: T('2026-06-24', '22:00:00') },
  { stage_code: 'group', group_code: 'A', sequence: 6, home: 'RSA', away: 'KOR', kickoff: T('2026-06-24', '22:00:00') },

  // Group B
  { stage_code: 'group', group_code: 'B', sequence: 1, home: 'CAN', away: 'BIH', kickoff: T('2026-06-12') },
  { stage_code: 'group', group_code: 'B', sequence: 2, home: 'QAT', away: 'SUI', kickoff: T('2026-06-13'), zebra: 'QAT', zebra_mult: 3 },
  { stage_code: 'group', group_code: 'B', sequence: 3, home: 'SUI', away: 'BIH', kickoff: T('2026-06-18') },
  { stage_code: 'group', group_code: 'B', sequence: 4, home: 'CAN', away: 'QAT', kickoff: T('2026-06-18', '19:00:00') },
  { stage_code: 'group', group_code: 'B', sequence: 5, home: 'SUI', away: 'CAN', kickoff: T('2026-06-24') },
  { stage_code: 'group', group_code: 'B', sequence: 6, home: 'BIH', away: 'QAT', kickoff: T('2026-06-24') },

  // Group C
  { stage_code: 'group', group_code: 'C', sequence: 1, home: 'BRA', away: 'MAR', kickoff: T('2026-06-13', '19:00:00') },
  { stage_code: 'group', group_code: 'C', sequence: 2, home: 'HAI', away: 'SCO', kickoff: T('2026-06-13', '22:00:00') },
  { stage_code: 'group', group_code: 'C', sequence: 3, home: 'SCO', away: 'MAR', kickoff: T('2026-06-19', '19:00:00') },
  { stage_code: 'group', group_code: 'C', sequence: 4, home: 'BRA', away: 'HAI', kickoff: T('2026-06-19', '21:30:00'), zebra: 'HAI', zebra_mult: 4 },
  { stage_code: 'group', group_code: 'C', sequence: 5, home: 'SCO', away: 'BRA', kickoff: T('2026-06-24', '19:00:00') },
  { stage_code: 'group', group_code: 'C', sequence: 6, home: 'MAR', away: 'HAI', kickoff: T('2026-06-24', '22:00:00') },

  // Group D
  { stage_code: 'group', group_code: 'D', sequence: 1, home: 'USA', away: 'PAR', kickoff: T('2026-06-12', '22:00:00') },
  { stage_code: 'group', group_code: 'D', sequence: 2, home: 'AUS', away: 'TUR', kickoff: T('2026-06-14', '01:00:00'), zebra: 'AUS', zebra_mult: 2 },
  { stage_code: 'group', group_code: 'D', sequence: 3, home: 'TUR', away: 'PAR', kickoff: T('2026-06-20', '00:00:00') },
  { stage_code: 'group', group_code: 'D', sequence: 4, home: 'USA', away: 'AUS', kickoff: T('2026-06-19') },
  { stage_code: 'group', group_code: 'D', sequence: 5, home: 'TUR', away: 'USA', kickoff: T('2026-06-25', '23:00:00') },
  { stage_code: 'group', group_code: 'D', sequence: 6, home: 'PAR', away: 'AUS', kickoff: T('2026-06-25', '23:00:00') },

  // Group E
  { stage_code: 'group', group_code: 'E', sequence: 1, home: 'GER', away: 'CUW', kickoff: T('2026-06-14', '14:00:00'), zebra: 'CUW', zebra_mult: 4 },
  { stage_code: 'group', group_code: 'E', sequence: 2, home: 'CIV', away: 'ECU', kickoff: T('2026-06-14', '20:00:00') },
  { stage_code: 'group', group_code: 'E', sequence: 3, home: 'GER', away: 'CIV', kickoff: T('2026-06-20', '17:00:00') },
  { stage_code: 'group', group_code: 'E', sequence: 4, home: 'ECU', away: 'CUW', kickoff: T('2026-06-20', '21:00:00') },
  { stage_code: 'group', group_code: 'E', sequence: 5, home: 'ECU', away: 'GER', kickoff: T('2026-06-25', '17:00:00') },
  { stage_code: 'group', group_code: 'E', sequence: 6, home: 'CUW', away: 'CIV', kickoff: T('2026-06-25', '17:00:00') },

  // Group F
  { stage_code: 'group', group_code: 'F', sequence: 1, home: 'NED', away: 'JPN', kickoff: T('2026-06-14', '17:00:00') },
  { stage_code: 'group', group_code: 'F', sequence: 2, home: 'SWE', away: 'TUN', kickoff: T('2026-06-14', '23:00:00') },
  { stage_code: 'group', group_code: 'F', sequence: 3, home: 'NED', away: 'SWE', kickoff: T('2026-06-20', '14:00:00') },
  { stage_code: 'group', group_code: 'F', sequence: 4, home: 'TUN', away: 'JPN', kickoff: T('2026-06-21', '01:00:00') },
  { stage_code: 'group', group_code: 'F', sequence: 5, home: 'TUN', away: 'NED', kickoff: T('2026-06-25', '20:00:00'), zebra: 'TUN', zebra_mult: 2 },
  { stage_code: 'group', group_code: 'F', sequence: 6, home: 'JPN', away: 'SWE', kickoff: T('2026-06-25', '20:00:00') },

  // Group G
  { stage_code: 'group', group_code: 'G', sequence: 1, home: 'BEL', away: 'EGY', kickoff: T('2026-06-15') },
  { stage_code: 'group', group_code: 'G', sequence: 2, home: 'IRN', away: 'NZL', kickoff: T('2026-06-15', '22:00:00') },
  { stage_code: 'group', group_code: 'G', sequence: 3, home: 'BEL', away: 'IRN', kickoff: T('2026-06-21') },
  { stage_code: 'group', group_code: 'G', sequence: 4, home: 'NZL', away: 'EGY', kickoff: T('2026-06-21', '22:00:00') },
  { stage_code: 'group', group_code: 'G', sequence: 5, home: 'NZL', away: 'BEL', kickoff: T('2026-06-27', '00:00:00'), zebra: 'NZL', zebra_mult: 3 },
  { stage_code: 'group', group_code: 'G', sequence: 6, home: 'EGY', away: 'IRN', kickoff: T('2026-06-27', '00:00:00') },

  // Group H
  { stage_code: 'group', group_code: 'H', sequence: 1, home: 'ESP', away: 'CPV', kickoff: T('2026-06-15', '13:00:00') },
  { stage_code: 'group', group_code: 'H', sequence: 2, home: 'KSA', away: 'URU', kickoff: T('2026-06-15', '19:00:00') },
  { stage_code: 'group', group_code: 'H', sequence: 3, home: 'ESP', away: 'KSA', kickoff: T('2026-06-21', '13:00:00'), zebra: 'KSA', zebra_mult: 3 },
  { stage_code: 'group', group_code: 'H', sequence: 4, home: 'URU', away: 'CPV', kickoff: T('2026-06-21', '19:00:00') },
  { stage_code: 'group', group_code: 'H', sequence: 5, home: 'URU', away: 'ESP', kickoff: T('2026-06-26', '21:00:00') },
  { stage_code: 'group', group_code: 'H', sequence: 6, home: 'CPV', away: 'KSA', kickoff: T('2026-06-26', '21:00:00') },

  // Group I
  { stage_code: 'group', group_code: 'I', sequence: 1, home: 'FRA', away: 'SEN', kickoff: T('2026-06-16') },
  { stage_code: 'group', group_code: 'I', sequence: 2, home: 'IRQ', away: 'NOR', kickoff: T('2026-06-16', '19:00:00') },
  { stage_code: 'group', group_code: 'I', sequence: 3, home: 'FRA', away: 'IRQ', kickoff: T('2026-06-22', '18:00:00'), zebra: 'IRQ', zebra_mult: 4 },
  { stage_code: 'group', group_code: 'I', sequence: 4, home: 'NOR', away: 'SEN', kickoff: T('2026-06-22', '21:00:00') },
  { stage_code: 'group', group_code: 'I', sequence: 5, home: 'NOR', away: 'FRA', kickoff: T('2026-06-26') },
  { stage_code: 'group', group_code: 'I', sequence: 6, home: 'SEN', away: 'IRQ', kickoff: T('2026-06-26') },

  // Group J
  { stage_code: 'group', group_code: 'J', sequence: 1, home: 'ARG', away: 'ALG', kickoff: T('2026-06-16', '22:00:00') },
  { stage_code: 'group', group_code: 'J', sequence: 2, home: 'AUT', away: 'JOR', kickoff: T('2026-06-17', '01:00:00') },
  { stage_code: 'group', group_code: 'J', sequence: 3, home: 'ARG', away: 'AUT', kickoff: T('2026-06-22', '14:00:00') },
  { stage_code: 'group', group_code: 'J', sequence: 4, home: 'JOR', away: 'ALG', kickoff: T('2026-06-23', '00:00:00') },
  { stage_code: 'group', group_code: 'J', sequence: 5, home: 'JOR', away: 'ARG', kickoff: T('2026-06-27', '23:00:00'), zebra: 'JOR', zebra_mult: 4 },
  { stage_code: 'group', group_code: 'J', sequence: 6, home: 'ALG', away: 'AUT', kickoff: T('2026-06-27', '23:00:00') },

  // Group K
  { stage_code: 'group', group_code: 'K', sequence: 1, home: 'POR', away: 'COD', kickoff: T('2026-06-17', '14:00:00') },
  { stage_code: 'group', group_code: 'K', sequence: 2, home: 'UZB', away: 'COL', kickoff: T('2026-06-17', '23:00:00') },
  { stage_code: 'group', group_code: 'K', sequence: 3, home: 'POR', away: 'UZB', kickoff: T('2026-06-23', '14:00:00'), zebra: 'UZB', zebra_mult: 2 },
  { stage_code: 'group', group_code: 'K', sequence: 4, home: 'COL', away: 'COD', kickoff: T('2026-06-23', '23:00:00') },
  { stage_code: 'group', group_code: 'K', sequence: 5, home: 'COL', away: 'POR', kickoff: T('2026-06-27', '20:30:00') },
  { stage_code: 'group', group_code: 'K', sequence: 6, home: 'COD', away: 'UZB', kickoff: T('2026-06-27', '20:30:00') },

  // Group L
  { stage_code: 'group', group_code: 'L', sequence: 1, home: 'ENG', away: 'CRO', kickoff: T('2026-06-17', '17:00:00') },
  { stage_code: 'group', group_code: 'L', sequence: 2, home: 'GHA', away: 'PAN', kickoff: T('2026-06-17', '20:00:00') },
  { stage_code: 'group', group_code: 'L', sequence: 3, home: 'ENG', away: 'GHA', kickoff: T('2026-06-23', '17:00:00') },
  { stage_code: 'group', group_code: 'L', sequence: 4, home: 'PAN', away: 'CRO', kickoff: T('2026-06-23', '20:00:00') },
  { stage_code: 'group', group_code: 'L', sequence: 5, home: 'PAN', away: 'ENG', kickoff: T('2026-06-27', '18:00:00'), zebra: 'PAN', zebra_mult: 3 },
  { stage_code: 'group', group_code: 'L', sequence: 6, home: 'CRO', away: 'GHA', kickoff: T('2026-06-27', '18:00:00') },

  // ==================== ROUND OF 32 (16) — bracket placeholders ====================
  // home_placeholder / away_placeholder até o final da fase de grupos.
  { stage_code: 'r16', sequence: 1, home_placeholder: '1º Grupo E', away_placeholder: '3º ABCDF', kickoff: T('2026-06-29', '17:30:00') },
  { stage_code: 'r16', sequence: 2, home_placeholder: '1º Grupo I', away_placeholder: '3º CDFGH', kickoff: T('2026-06-30', '18:00:00') },
  { stage_code: 'r16', sequence: 3, home_placeholder: '2º Grupo A', away_placeholder: '2º Grupo B', kickoff: T('2026-06-28') },
  { stage_code: 'r16', sequence: 4, home_placeholder: '1º Grupo F', away_placeholder: '2º Grupo C', kickoff: T('2026-06-29', '22:00:00') },
  { stage_code: 'r16', sequence: 5, home_placeholder: '2º Grupo K', away_placeholder: '2º Grupo L', kickoff: T('2026-07-02', '20:00:00') },
  { stage_code: 'r16', sequence: 6, home_placeholder: '1º Grupo H', away_placeholder: '2º Grupo J', kickoff: T('2026-07-02') },
  { stage_code: 'r16', sequence: 7, home_placeholder: '1º Grupo D', away_placeholder: '3º BEFIJ', kickoff: T('2026-07-01', '21:00:00') },
  { stage_code: 'r16', sequence: 8, home_placeholder: '1º Grupo G', away_placeholder: '3º AEHIJ', kickoff: T('2026-07-01', '17:00:00') },
  { stage_code: 'r16', sequence: 9, home_placeholder: '1º Grupo C', away_placeholder: '2º Grupo F', kickoff: T('2026-06-29', '14:00:00') },
  { stage_code: 'r16', sequence: 10, home_placeholder: '2º Grupo E', away_placeholder: '2º Grupo I', kickoff: T('2026-06-30', '14:00:00') },
  { stage_code: 'r16', sequence: 11, home_placeholder: '1º Grupo A', away_placeholder: '3º CEFHI', kickoff: T('2026-06-30', '22:00:00') },
  { stage_code: 'r16', sequence: 12, home_placeholder: '1º Grupo L', away_placeholder: '3º EHIJK', kickoff: T('2026-07-01', '13:00:00') },
  { stage_code: 'r16', sequence: 13, home_placeholder: '1º Grupo J', away_placeholder: '2º Grupo H', kickoff: T('2026-07-03', '19:00:00') },
  { stage_code: 'r16', sequence: 14, home_placeholder: '2º Grupo D', away_placeholder: '2º Grupo G', kickoff: T('2026-07-03', '15:00:00') },
  { stage_code: 'r16', sequence: 15, home_placeholder: '1º Grupo B', away_placeholder: '3º EFGIJ', kickoff: T('2026-07-03', '00:00:00') },
  { stage_code: 'r16', sequence: 16, home_placeholder: '1º Grupo K', away_placeholder: '3º DEIJL', kickoff: T('2026-07-03', '22:30:00') },

  // ==================== ROUND OF 16 (8) ====================
  { stage_code: 'qf', sequence: 1, home_placeholder: 'Vencedor R16-1', away_placeholder: 'Vencedor R16-2', kickoff: T('2026-07-04', '18:00:00') },
  { stage_code: 'qf', sequence: 2, home_placeholder: 'Vencedor R16-3', away_placeholder: 'Vencedor R16-4', kickoff: T('2026-07-04', '14:00:00') },
  { stage_code: 'qf', sequence: 3, home_placeholder: 'Vencedor R16-5', away_placeholder: 'Vencedor R16-6', kickoff: T('2026-07-06') },
  { stage_code: 'qf', sequence: 4, home_placeholder: 'Vencedor R16-7', away_placeholder: 'Vencedor R16-8', kickoff: T('2026-07-06', '21:00:00') },
  { stage_code: 'qf', sequence: 5, home_placeholder: 'Vencedor R16-9', away_placeholder: 'Vencedor R16-10', kickoff: T('2026-07-05', '17:00:00') },
  { stage_code: 'qf', sequence: 6, home_placeholder: 'Vencedor R16-11', away_placeholder: 'Vencedor R16-12', kickoff: T('2026-07-05', '21:00:00') },
  { stage_code: 'qf', sequence: 7, home_placeholder: 'Vencedor R16-13', away_placeholder: 'Vencedor R16-14', kickoff: T('2026-07-07', '13:00:00') },
  { stage_code: 'qf', sequence: 8, home_placeholder: 'Vencedor R16-15', away_placeholder: 'Vencedor R16-16', kickoff: T('2026-07-07', '17:00:00') },

  // ==================== QUARTERFINALS (4) — note: tier label "sf" matches spreadsheet "Quartas" tier ====================
  { stage_code: 'sf', sequence: 1, home_placeholder: 'Vencedor QF-1', away_placeholder: 'Vencedor QF-2', kickoff: T('2026-07-09', '17:00:00') },
  { stage_code: 'sf', sequence: 2, home_placeholder: 'Vencedor QF-3', away_placeholder: 'Vencedor QF-4', kickoff: T('2026-07-10') },
  { stage_code: 'sf', sequence: 3, home_placeholder: 'Vencedor QF-5', away_placeholder: 'Vencedor QF-6', kickoff: T('2026-07-11', '18:00:00') },
  { stage_code: 'sf', sequence: 4, home_placeholder: 'Vencedor QF-7', away_placeholder: 'Vencedor QF-8', kickoff: T('2026-07-11', '22:00:00') },

  // ==================== SEMIFINALS (2) ====================
  { stage_code: 'semi', sequence: 1, home_placeholder: 'Vencedor SF-1', away_placeholder: 'Vencedor SF-2', kickoff: T('2026-07-14') },
  { stage_code: 'semi', sequence: 2, home_placeholder: 'Vencedor SF-3', away_placeholder: 'Vencedor SF-4', kickoff: T('2026-07-15') },

  // ==================== THIRD-PLACE (1) ====================
  { stage_code: 'third', sequence: 1, home_placeholder: 'Perdedor Semi-1', away_placeholder: 'Perdedor Semi-2', kickoff: T('2026-07-18', '18:00:00') },

  // ==================== FINAL (1) ====================
  { stage_code: 'final', sequence: 1, home_placeholder: 'Vencedor Semi-1', away_placeholder: 'Vencedor Semi-2', kickoff: T('2026-07-19') },
];

// Sanity: 72 group matches + 16 R16 + 8 QF + 4 "sf" (quartas) + 2 semi + 1 third + 1 final = 104
