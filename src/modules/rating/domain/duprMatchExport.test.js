import { describe, it, expect } from 'vitest';
import {
  DUPR_CSV_HEADERS,
  DUPR_MATCH_TYPE,
  DUPR_SCORE_TYPE,
  DUPR_EXPORT_SOURCE,
  formatDuprDate,
  normalizeExportMatches,
  filterExportMatches,
  buildDuprRow,
  buildDuprEntries,
  summarizeEntries,
  buildFilterOptions,
  buildDuprCsv,
  entriesToRows,
  csvField,
  duprCsvFilename,
} from './duprMatchExport.js';

/* -------------------------------------------------------------------------
 * Fixtures compartilhadas
 * ------------------------------------------------------------------------- */

const regById = new Map([
  ['regA', { id: 'regA', format: 'doubles', player_a_user_id: 'u1', player_b_user_id: 'u2' }],
  ['regB', { id: 'regB', format: 'doubles', player_a_user_id: 'u3', player_b_user_id: 'u4' }],
  ['regS1', { id: 'regS1', format: 'singles', player_a_user_id: 'u1' }],
  ['regS2', { id: 'regS2', format: 'singles', player_a_user_id: 'u3' }],
  ['regNoAcc', { id: 'regNoAcc', format: 'singles', player_a_user_id: null }],
]);

const tournamentById = new Map([
  ['t1', { id: 't1', name: 'Copa Verão', venue: 'Arena Central', city: 'São Paulo', state: 'SP', starts_at: '2025-01-10T00:00:00Z' }],
  ['tteam', { id: 'tteam', name: 'Liga por Equipes', city: 'Rio', state: 'RJ', starts_at: '2025-03-01T00:00:00Z' }],
]);

const gameDayById = new Map([
  ['gd1', { id: 'gd1', title: 'Sábado no Parque', date: '2025-02-15', location: 'Quadra Municipal', city: 'Campinas', state: 'SP' }],
]);

const clubEventById = new Map([
  ['ev1', { id: 'ev1', title: 'Noite do Clube', club_id: 'c1', location: 'Sede', starts_at: '2025-04-20T00:00:00Z' }],
]);

const clubById = new Map([
  ['c1', { id: 'c1', name: 'Clube A', home_venue: 'Ginásio A', city: 'Santos', state: 'SP' }],
]);

const profileById = new Map([
  ['u1', { uid: 'u1', name: 'Jane Doe', dupr_id: 'AB12C3' }],
  ['u2', { uid: 'u2', name: 'Alex Smith', dupr_id: 'DE45F6' }],
  ['u3', { uid: 'u3', name: 'Sam Lee', dupr_id: 'GH78I9' }],
  ['u4', { uid: 'u4', name: 'Chris Park', dupr_id: '' }], // sem ID DUPR
]);

/* -------------------------------------------------------------------------
 * formatDuprDate
 * ------------------------------------------------------------------------- */

describe('formatDuprDate', () => {
  it('formata ms como YYYY-MM-DD em UTC', () => {
    expect(formatDuprDate(Date.parse('2025-01-15T12:00:00Z'))).toBe('2025-01-15');
  });
  it('retorna vazio para valores inválidos', () => {
    expect(formatDuprDate(0)).toBe('');
    expect(formatDuprDate(null)).toBe('');
    expect(formatDuprDate(NaN)).toBe('');
  });
});

/* -------------------------------------------------------------------------
 * normalizeExportMatches
 * ------------------------------------------------------------------------- */

describe('normalizeExportMatches', () => {
  it('normaliza jogo de torneio de duplas resolvendo inscrições → uids', () => {
    const out = normalizeExportMatches({
      tournamentMatches: [{
        id: 'm1', tournament_id: 't1', modality_id: 'mod1',
        side_a_ids: ['regA'], side_b_ids: ['regB'],
        winner_side: 'a', games: [{ a: 11, b: 5 }, { a: 11, b: 7 }],
        result_recorded_at: '2025-01-15T00:00:00Z',
      }],
      regById, tournamentById,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: DUPR_EXPORT_SOURCE.TOURNAMENT,
      match_type: DUPR_MATCH_TYPE.DOUBLES,
      event_name: 'Copa Verão',
      location: 'Arena Central, São Paulo, SP',
      date: '2025-01-15',
      side_a_uids: ['u1', 'u2'],
      side_b_uids: ['u3', 'u4'],
      games: [{ a: 11, b: 5 }, { a: 11, b: 7 }],
      tournament_id: 't1',
    });
  });

  it('normaliza jogo de torneio de simples (matchType S)', () => {
    const out = normalizeExportMatches({
      tournamentMatches: [{
        id: 'm2', tournament_id: 't1',
        side_a_ids: ['regS1'], side_b_ids: ['regS2'],
        winner_side: 'b', games: [{ a: 9, b: 11 }],
        result_recorded_at: '2025-01-16T00:00:00Z',
      }],
      regById, tournamentById,
    });
    expect(out).toHaveLength(1);
    expect(out[0].match_type).toBe(DUPR_MATCH_TYPE.SINGLES);
    expect(out[0].side_a_uids).toEqual(['u1']);
    expect(out[0].side_b_uids).toEqual(['u3']);
  });

  it('exclui confronto-pai de equipes (team_confrontation) de tournament_matches', () => {
    const out = normalizeExportMatches({
      tournamentMatches: [{
        id: 'mteam', tournament_id: 'tteam', team_confrontation: true,
        side_a_ids: ['regA'], side_b_ids: ['regB'], winner_side: 'a',
        games: [{ a: 11, b: 3 }],
      }],
      regById, tournamentById,
    });
    expect(out).toHaveLength(0);
  });

  it('exclui W.O./jogo sem placar por game', () => {
    const out = normalizeExportMatches({
      tournamentMatches: [{
        id: 'mwo', tournament_id: 't1',
        side_a_ids: ['regS1'], side_b_ids: ['regS2'],
        winner_side: 'a', games: [],
      }],
      regById, tournamentById,
    });
    expect(out).toHaveLength(0);
  });

  it('exclui jogo com jogador sem conta (inscrição não resolvida)', () => {
    const out = normalizeExportMatches({
      tournamentMatches: [{
        id: 'mno', tournament_id: 't1',
        side_a_ids: ['regS1'], side_b_ids: ['regNoAcc'],
        winner_side: 'a', games: [{ a: 11, b: 4 }],
      }],
      regById, tournamentById,
    });
    expect(out).toHaveLength(0);
  });

  it('normaliza dia de jogo (club_event_games source=athlete_game_day) usando a data explícita', () => {
    const out = normalizeExportMatches({
      clubEventMatches: [{
        id: 'ceg1', source: 'athlete_game_day', event_id: 'gd1', event_title: 'Sábado no Parque',
        side_a_ids: ['u1', 'u2'], side_b_ids: ['u3', 'u4'], kind: 'doubles',
        score_a: 11, score_b: 9, winner_side: 'a',
        result_recorded_at: '2025-02-15T10:00:00Z',
      }],
      gameDayById,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: DUPR_EXPORT_SOURCE.GAME_DAY,
      match_type: DUPR_MATCH_TYPE.DOUBLES,
      event_name: 'Sábado no Parque',
      location: 'Quadra Municipal, Campinas, SP',
      date: '2025-02-15',
      game_day_id: 'gd1',
      games: [{ a: 11, b: 9 }],
    });
  });

  it('normaliza confronto de equipes (source=team_confrontation) com games do espelho', () => {
    const out = normalizeExportMatches({
      clubEventMatches: [{
        id: 'ceg2', source: 'team_confrontation', event_id: 'mod1', tournament_id: 'tteam',
        side_a_ids: ['u1'], side_b_ids: ['u3'], kind: 'singles',
        score_a: 11, score_b: 6, winner_side: 'a',
        games: [{ a: 11, b: 6 }],
      }],
      tournamentById,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: DUPR_EXPORT_SOURCE.TEAM,
      match_type: DUPR_MATCH_TYPE.SINGLES,
      event_name: 'Liga por Equipes',
      tournament_id: 'tteam',
      date: '2025-03-01',
    });
  });

  it('normaliza evento de clube (source=club_event_game) usando starts_at do evento', () => {
    const out = normalizeExportMatches({
      clubEventMatches: [{
        id: 'ceg3', source: 'club_event_game', event_id: 'ev1', club_id: 'c1',
        side_a_ids: ['u1'], side_b_ids: ['u3'], kind: 'singles',
        score_a: 11, score_b: 8, winner_side: 'a',
      }],
      clubEventById, clubById,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: DUPR_EXPORT_SOURCE.CLUB_EVENT,
      event_name: 'Noite do Clube',
      location: 'Sede, Ginásio A, Santos, SP',
      date: '2025-04-20',
      event_id: 'ev1',
      club_id: 'c1',
    });
  });

  it('exclui club_event_games sem vencedor definido', () => {
    const out = normalizeExportMatches({
      clubEventMatches: [{
        id: 'cegx', source: 'club_event_game', event_id: 'ev1',
        side_a_ids: ['u1'], side_b_ids: ['u3'], winner_side: null,
        score_a: 0, score_b: 0,
      }],
      clubEventById,
    });
    expect(out).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------
 * filterExportMatches
 * ------------------------------------------------------------------------- */

describe('filterExportMatches', () => {
  const matches = [
    { id: 'a', date: '2025-01-15', tournament_id: 't1', club_id: null, game_day_id: null, event_id: null, match_type: 'D', source: DUPR_EXPORT_SOURCE.TOURNAMENT, side_a_uids: ['u1', 'u2'], side_b_uids: ['u3', 'u4'] },
    { id: 'b', date: '2025-02-15', tournament_id: null, club_id: null, game_day_id: 'gd1', event_id: null, match_type: 'S', source: DUPR_EXPORT_SOURCE.GAME_DAY, side_a_uids: ['u1'], side_b_uids: ['u3'] },
    { id: 'c', date: '2025-03-20', tournament_id: null, club_id: 'c1', game_day_id: null, event_id: 'ev1', match_type: 'S', source: DUPR_EXPORT_SOURCE.CLUB_EVENT, side_a_uids: ['u5'], side_b_uids: ['u6'] },
  ];

  it('filtra por intervalo de datas (inclusive)', () => {
    expect(filterExportMatches(matches, { dateFrom: '2025-02-01', dateTo: '2025-02-28' }).map((m) => m.id)).toEqual(['b']);
    expect(filterExportMatches(matches, { dateFrom: '2025-02-15' }).map((m) => m.id)).toEqual(['b', 'c']);
    expect(filterExportMatches(matches, { dateTo: '2025-02-15' }).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('filtra por torneio, clube, dia de jogo e evento', () => {
    expect(filterExportMatches(matches, { tournamentId: 't1' }).map((m) => m.id)).toEqual(['a']);
    expect(filterExportMatches(matches, { clubId: 'c1' }).map((m) => m.id)).toEqual(['c']);
    expect(filterExportMatches(matches, { gameDayId: 'gd1' }).map((m) => m.id)).toEqual(['b']);
    expect(filterExportMatches(matches, { eventId: 'ev1' }).map((m) => m.id)).toEqual(['c']);
  });

  it('filtra por tipo de partida e origem', () => {
    expect(filterExportMatches(matches, { matchType: 'S' }).map((m) => m.id)).toEqual(['b', 'c']);
    expect(filterExportMatches(matches, { source: DUPR_EXPORT_SOURCE.TOURNAMENT }).map((m) => m.id)).toEqual(['a']);
  });

  it('filtra por atleta (em qualquer lado)', () => {
    expect(filterExportMatches(matches, { athleteUid: 'u1' }).map((m) => m.id)).toEqual(['a', 'b']);
    expect(filterExportMatches(matches, { athleteUid: 'u4' }).map((m) => m.id)).toEqual(['a']);
  });

  it('sem filtros retorna tudo', () => {
    expect(filterExportMatches(matches, {})).toHaveLength(3);
  });
});

/* -------------------------------------------------------------------------
 * buildDuprRow / buildDuprEntries
 * ------------------------------------------------------------------------- */

describe('buildDuprRow', () => {
  const doublesMatch = {
    id: 'a', source: DUPR_EXPORT_SOURCE.TOURNAMENT, match_type: DUPR_MATCH_TYPE.DOUBLES,
    event_name: 'Copa Verão', location: 'Arena Central', at: 100, date: '2025-01-15',
    side_a_uids: ['u1', 'u2'], side_b_uids: ['u3', 'u4'],
    games: [{ a: 11, b: 5 }, { a: 11, b: 7 }],
  };

  it('monta as 27 colunas com nomes e IDs DUPR (duplas)', () => {
    const { row, ready, missing } = buildDuprRow(doublesMatch, profileById);
    expect(row.matchType).toBe('D');
    expect(row.event).toBe('Copa Verão');
    expect(row.date).toBe('2025-01-15');
    expect(row.playerA1).toBe('Jane Doe');
    expect(row.playerA1DuprId).toBe('AB12C3');
    expect(row.playerA2).toBe('Alex Smith');
    expect(row.playerA2DuprId).toBe('DE45F6');
    expect(row.playerB1).toBe('Sam Lee');
    expect(row.playerB1DuprId).toBe('GH78I9');
    expect(row.playerB2).toBe('Chris Park');
    expect(row.playerB2DuprId).toBe(''); // u4 sem ID
    expect(row.teamAGame1).toBe(11);
    expect(row.teamBGame1).toBe(5);
    expect(row.teamAGame2).toBe(11);
    expect(row.teamBGame2).toBe(7);
    expect(row.teamAGame3).toBe('');
    expect(row.scoreType).toBe('SIDEOUT');
    // Chris Park (u4) não tem ID DUPR → linha não está pronta.
    expect(ready).toBe(false);
    expect(missing).toContain('Chris Park');
  });

  it('inclui o uid interno como externalId por padrão e o omite quando desligado', () => {
    const withExt = buildDuprRow(doublesMatch, profileById).row;
    expect(withExt.playerA1ExternalId).toBe('u1');
    expect(withExt.playerB2ExternalId).toBe('u4');
    const noExt = buildDuprRow(doublesMatch, profileById, { includeExternalId: false }).row;
    expect(noExt.playerA1ExternalId).toBe('');
    expect(noExt.playerB2ExternalId).toBe('');
  });

  it('deixa campos do 2º jogador em branco para simples', () => {
    const singlesMatch = {
      id: 'b', source: DUPR_EXPORT_SOURCE.GAME_DAY, match_type: DUPR_MATCH_TYPE.SINGLES,
      event_name: 'Dia', location: '', at: 50, date: '2025-02-15',
      side_a_uids: ['u1'], side_b_uids: ['u3'], games: [{ a: 11, b: 4 }],
    };
    const { row, ready } = buildDuprRow(singlesMatch, profileById);
    expect(row.matchType).toBe('S');
    expect(row.playerA2).toBe('');
    expect(row.playerA2DuprId).toBe('');
    expect(row.playerA2ExternalId).toBe('');
    expect(row.playerB2).toBe('');
    expect(ready).toBe(true); // ambos têm ID DUPR
  });

  it('respeita scoreType RALLY', () => {
    const { row } = buildDuprRow(doublesMatch, profileById, { scoreType: DUPR_SCORE_TYPE.RALLY });
    expect(row.scoreType).toBe('RALLY');
  });
});

describe('buildDuprEntries', () => {
  it('ordena por data (mais antigas primeiro)', () => {
    const matches = [
      { match_type: 'S', at: 300, date: '2025-03-01', event_name: 'C', location: '', side_a_uids: ['u1'], side_b_uids: ['u3'], games: [{ a: 11, b: 1 }], source: 't' },
      { match_type: 'S', at: 100, date: '2025-01-01', event_name: 'A', location: '', side_a_uids: ['u1'], side_b_uids: ['u3'], games: [{ a: 11, b: 2 }], source: 't' },
    ];
    const entries = buildDuprEntries(matches, profileById);
    expect(entries.map((e) => e.row.event)).toEqual(['A', 'C']);
  });
});

/* -------------------------------------------------------------------------
 * summarizeEntries
 * ------------------------------------------------------------------------- */

describe('summarizeEntries', () => {
  it('conta total, prontas, incompletas, simples e duplas', () => {
    const entries = [
      { ready: true, match_type: 'S' },
      { ready: false, match_type: 'D' },
      { ready: true, match_type: 'D' },
    ];
    expect(summarizeEntries(entries)).toEqual({ total: 3, ready: 2, incomplete: 1, singles: 1, doubles: 2 });
  });
});

/* -------------------------------------------------------------------------
 * buildFilterOptions
 * ------------------------------------------------------------------------- */

describe('buildFilterOptions', () => {
  it('deriva listas de filtro com rótulos e contagem, só de quem tem partidas', () => {
    const matches = [
      { tournament_id: 't1', club_id: null, game_day_id: null, event_id: null, side_a_uids: ['u1'], side_b_uids: ['u3'] },
      { tournament_id: 't1', club_id: null, game_day_id: null, event_id: null, side_a_uids: ['u1'], side_b_uids: ['u2'] },
      { tournament_id: null, club_id: 'c1', game_day_id: null, event_id: 'ev1', side_a_uids: ['u3'], side_b_uids: ['u4'] },
    ];
    const opts = buildFilterOptions(matches, {
      profileById, tournamentById, clubById, gameDayById, clubEventById,
    });
    expect(opts.tournaments).toEqual([{ value: 't1', label: 'Copa Verão', count: 2 }]);
    expect(opts.clubs).toEqual([{ value: 'c1', label: 'Clube A', count: 1 }]);
    expect(opts.events).toEqual([{ value: 'ev1', label: 'Noite do Clube', count: 1 }]);
    const u1 = opts.athletes.find((a) => a.value === 'u1');
    expect(u1).toEqual({ value: 'u1', label: 'Jane Doe', count: 2 });
  });
});

/* -------------------------------------------------------------------------
 * CSV
 * ------------------------------------------------------------------------- */

describe('csvField', () => {
  it('escapa vírgulas, aspas e quebras de linha', () => {
    expect(csvField('simples')).toBe('simples');
    expect(csvField('Madison, NY')).toBe('"Madison, NY"');
    expect(csvField('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvField(null)).toBe('');
    expect(csvField(11)).toBe('11');
  });
});

describe('buildDuprCsv', () => {
  it('gera cabeçalho com as 27 colunas na ordem exata do DUPR', () => {
    const csv = buildDuprCsv([]);
    const header = csv.split('\r\n')[0];
    expect(header).toBe([
      'matchType', 'event', 'date',
      'playerA1', 'playerA1DuprId', 'playerA1ExternalId',
      'playerA2', 'playerA2DuprId', 'playerA2ExternalId',
      'playerB1', 'playerB1DuprId', 'playerB1ExternalId',
      'playerB2', 'playerB2DuprId', 'playerB2ExternalId',
      'teamAGame1', 'teamBGame1', 'teamAGame2', 'teamBGame2', 'teamAGame3', 'teamBGame3',
      'teamAGame4', 'teamBGame4', 'teamAGame5', 'teamBGame5',
      'location', 'scoreType',
    ].join(','));
    expect(DUPR_CSV_HEADERS).toHaveLength(27);
  });

  it('não inicia com BOM e usa quebras CRLF e separador vírgula', () => {
    const rows = [{
      matchType: 'S', event: 'Liga', date: '2025-01-15',
      playerA1: 'Jane Doe', playerA1DuprId: 'AB12C3', playerA1ExternalId: 'u1',
      playerA2: '', playerA2DuprId: '', playerA2ExternalId: '',
      playerB1: 'Sam Lee', playerB1DuprId: 'GH78I9', playerB1ExternalId: 'u3',
      playerB2: '', playerB2DuprId: '', playerB2ExternalId: '',
      teamAGame1: 11, teamBGame1: 5, teamAGame2: '', teamBGame2: '', teamAGame3: '', teamBGame3: '',
      teamAGame4: '', teamBGame4: '', teamAGame5: '', teamBGame5: '',
      location: 'Madison, NY', scoreType: 'SIDEOUT',
    }];
    const csv = buildDuprCsv(rows);
    expect(csv.charCodeAt(0)).not.toBe(0xFEFF);
    expect(csv.startsWith('matchType,')).toBe(true);
    expect(csv).toContain('\r\n');
    // vírgula no location é escapada com aspas
    expect(csv.split('\r\n')[1]).toContain('"Madison, NY"');
  });
});

describe('entriesToRows', () => {
  it('opcionalmente filtra só as linhas prontas', () => {
    const entries = [
      { ready: true, row: { matchType: 'S' } },
      { ready: false, row: { matchType: 'D' } },
    ];
    expect(entriesToRows(entries)).toHaveLength(2);
    expect(entriesToRows(entries, { readyOnly: true })).toHaveLength(1);
  });
});

describe('duprCsvFilename', () => {
  it('inclui o intervalo de datas quando informado', () => {
    expect(duprCsvFilename({ dateFrom: '2025-01-01', dateTo: '2025-01-31' })).toBe('dupr-partidas-20250101-20250131.csv');
    expect(duprCsvFilename({})).toBe('dupr-partidas.csv');
  });
});
