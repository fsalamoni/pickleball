import { describe, it, expect } from 'vitest';
import {
  EXPORT_STATUS,
  EXPORT_STATUS_RANK,
  deterministicIdentifier,
  canonicalFingerprint,
  entryFingerprint,
  normalizeDuprHistoryRecord,
  parseDuprHistory,
  buildDuprIndex,
  classifyEntry,
  buildReconciliationView,
  summarizeSituations,
  filterBySituation,
  buildLedgerUpserts,
  latestExportInfo,
} from './duprReconcile.js';

/* -------------------------------------------------------------------------
 * Entry de exemplo (mesma forma de buildDuprRow): duplas u1/u2 × u3/u4.
 * ------------------------------------------------------------------------- */
function makeEntry(overrides = {}) {
  return {
    id: 'm1',
    source: 'tournament',
    match_type: 'D',
    at: 1000,
    ready: true,
    row: {
      matchType: 'D',
      event: 'Copa Verão',
      date: '2025-01-10',
      playerA1DuprId: 'AB12C3',
      playerA2DuprId: 'DE45F6',
      playerB1DuprId: 'GH78I9',
      playerB2DuprId: 'JK90L1',
      teamAGame1: 11, teamBGame1: 6,
      teamAGame2: 9, teamBGame2: 11,
      teamAGame3: 11, teamBGame3: 7,
      teamAGame4: '', teamBGame4: '',
      teamAGame5: '', teamBGame5: '',
    },
    ...overrides,
  };
}

describe('deterministicIdentifier', () => {
  it('gera um identifier estável com prefixo pr_', () => {
    expect(deterministicIdentifier('abc')).toBe('pr_abc');
    expect(deterministicIdentifier('abc')).toBe(deterministicIdentifier('abc'));
  });
  it('vazio para id ausente', () => {
    expect(deterministicIdentifier('')).toBe('');
    expect(deterministicIdentifier(null)).toBe('');
  });
});

describe('canonicalFingerprint', () => {
  it('independe da ordem dos times e dos jogadores', () => {
    const ab = canonicalFingerprint({
      date: '2025-01-10', type: 'D',
      teams: [{ ids: ['AB12C3', 'DE45F6'], points: [11, 9] }, { ids: ['GH78I9', 'JK90L1'], points: [6, 11] }],
    });
    const ba = canonicalFingerprint({
      date: '2025-01-10', type: 'D',
      teams: [{ ids: ['JK90L1', 'GH78I9'], points: [6, 11] }, { ids: ['DE45F6', 'AB12C3'], points: [11, 9] }],
    });
    expect(ab).toBeTruthy();
    expect(ab).toBe(ba);
  });

  it('normaliza caixa/espacos dos IDs', () => {
    const a = canonicalFingerprint({ date: '2025-01-10', type: 'S', teams: [{ ids: ['ab12c3'], points: [11] }, { ids: [' GH78I9 '], points: [7] }] });
    const b = canonicalFingerprint({ date: '2025-01-10', type: 'S', teams: [{ ids: ['AB12C3'], points: [11] }, { ids: ['GH78I9'], points: [7] }] });
    expect(a).toBe(b);
  });

  it("retorna '' se faltar id, data, tipo ou não houver 2 times", () => {
    expect(canonicalFingerprint({ date: '2025-01-10', type: 'D', teams: [{ ids: [], points: [11] }, { ids: ['X'], points: [6] }] })).toBe('');
    expect(canonicalFingerprint({ date: '', type: 'D', teams: [{ ids: ['A'], points: [1] }, { ids: ['B'], points: [2] }] })).toBe('');
    expect(canonicalFingerprint({ date: '2025-01-10', type: 'D', teams: [{ ids: ['A'], points: [1] }] })).toBe('');
  });
});

describe('entryFingerprint', () => {
  it('casa com o canonicalFingerprint equivalente', () => {
    const fp = entryFingerprint(makeEntry());
    const expected = canonicalFingerprint({
      date: '2025-01-10', type: 'D',
      teams: [{ ids: ['AB12C3', 'DE45F6'], points: [11, 9, 11] }, { ids: ['GH78I9', 'JK90L1'], points: [6, 11, 7] }],
    });
    expect(fp).toBe(expected);
    expect(fp).toBeTruthy();
  });

  it("retorna '' quando falta ID DUPR de um jogador", () => {
    const e = makeEntry();
    e.row.playerB2DuprId = '';
    expect(entryFingerprint(e)).toBe('');
  });
});

describe('normalizeDuprHistoryRecord / parseDuprHistory', () => {
  it('normaliza registro Partner API (teams com player1/player2 + game1..)', () => {
    const rec = normalizeDuprHistoryRecord({
      matchDate: '2025-01-10', matchFormat: 'DOUBLES', identifier: 'pr_m1', matchCode: 'MC123',
      teams: [
        { player1: 'AB12C3', player2: 'DE45F6', game1: 11, game2: 9, game3: 11 },
        { player1: 'GH78I9', player2: 'JK90L1', game1: 6, game2: 11, game3: 7 },
      ],
    });
    expect(rec.type).toBe('D');
    expect(rec.identifier).toBe('pr_m1');
    expect(rec.matchCode).toBe('MC123');
    expect(rec.fingerprint).toBe(entryFingerprint(makeEntry()));
  });

  it('infere o tipo pelo tamanho do time quando não vem formato', () => {
    const rec = normalizeDuprHistoryRecord({
      date: '2025-02-01T12:00:00Z',
      teams: [{ players: ['AAA'], games: [11] }, { players: ['BBB'], games: [5] }],
    });
    expect(rec.type).toBe('S');
    expect(rec.date).toBe('2025-02-01');
  });

  it('descarta registros sem 2 times com IDs', () => {
    expect(normalizeDuprHistoryRecord({ teams: [{ player1: 'A' }] })).toBeNull();
    expect(normalizeDuprHistoryRecord(null)).toBeNull();
  });

  it('parseDuprHistory aceita array, {result:{hits}}, string JSON e nunca lança', () => {
    const arr = [{ teams: [{ player1: 'A', game1: 11 }, { player1: 'B', game1: 3 }] }];
    expect(parseDuprHistory(arr)).toHaveLength(1);
    expect(parseDuprHistory({ result: { hits: arr } })).toHaveLength(1);
    expect(parseDuprHistory(JSON.stringify({ matches: arr }))).toHaveLength(1);
    expect(parseDuprHistory('not json')).toEqual([]);
    expect(parseDuprHistory('')).toEqual([]);
  });
});

describe('classifyEntry / buildReconciliationView', () => {
  it('PENDING sem ledger e sem conferência', () => {
    const s = classifyEntry(makeEntry(), {});
    expect(s.status).toBe(EXPORT_STATUS.PENDING);
    expect(s.confirmed).toBe(false);
  });

  it('EXPORTED quando o ledger registra exported_at', () => {
    const ledgerByKey = new Map([['m1', { status: 'exported', exported_at: 1700000000000 }]]);
    const s = classifyEntry(makeEntry(), { ledgerByKey });
    expect(s.status).toBe(EXPORT_STATUS.EXPORTED);
    expect(s.exportedAt).toBe(1700000000000);
  });

  it('SUBMITTED quando o ledger marca submitted', () => {
    const ledgerByKey = new Map([['m1', { status: 'submitted', submitted_at: 1700000000001 }]]);
    expect(classifyEntry(makeEntry(), { ledgerByKey }).status).toBe(EXPORT_STATUS.SUBMITTED);
  });

  it('CONFIRMED por identifier tem precedência sobre o ledger', () => {
    const ledgerByKey = new Map([['m1', { status: 'submitted' }]]);
    const duprIndex = buildDuprIndex([{ identifier: 'pr_m1' }]);
    const s = classifyEntry(makeEntry(), { ledgerByKey, duprIndex });
    expect(s.status).toBe(EXPORT_STATUS.CONFIRMED);
    expect(s.confirmed).toBe(true);
  });

  it('CONFIRMED por impressão digital (sem identifier)', () => {
    const duprIndex = buildDuprIndex(parseDuprHistory([{
      matchFormat: 'DOUBLES', matchDate: '2025-01-10',
      teams: [
        { player1: 'GH78I9', player2: 'JK90L1', game1: 6, game2: 11, game3: 7 },
        { player1: 'AB12C3', player2: 'DE45F6', game1: 11, game2: 9, game3: 11 },
      ],
    }]));
    expect(classifyEntry(makeEntry(), { duprIndex }).status).toBe(EXPORT_STATUS.CONFIRMED);
  });

  it('buildReconciliationView anexa situation sem mutar as entries', () => {
    const entries = [makeEntry()];
    const view = buildReconciliationView(entries, {});
    expect(view[0].situation.status).toBe(EXPORT_STATUS.PENDING);
    expect(view[0].situationRank).toBe(EXPORT_STATUS_RANK.pending);
    expect(entries[0].situation).toBeUndefined();
  });
});

describe('summarizeSituations / filterBySituation', () => {
  const view = [
    { id: 'a', situation: { status: EXPORT_STATUS.PENDING } },
    { id: 'b', situation: { status: EXPORT_STATUS.EXPORTED } },
    { id: 'c', situation: { status: EXPORT_STATUS.CONFIRMED } },
    { id: 'd', situation: { status: EXPORT_STATUS.CONFIRMED } },
  ];

  it('conta por situação', () => {
    expect(summarizeSituations(view)).toEqual({ total: 4, pending: 1, exported: 1, submitted: 0, confirmed: 2 });
  });

  it('filtra por situação', () => {
    expect(filterBySituation(view, EXPORT_STATUS.CONFIRMED).map((e) => e.id)).toEqual(['c', 'd']);
    expect(filterBySituation(view, '').map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('buildLedgerUpserts', () => {
  it('monta upsert de exportação com carimbo e identificadores', () => {
    const ups = buildLedgerUpserts([makeEntry()], { status: EXPORT_STATUS.EXPORTED, at: 1700000000000 });
    expect(ups).toHaveLength(1);
    expect(ups[0].id).toBe('m1');
    expect(ups[0].data).toMatchObject({
      match_id: 'm1', status: 'exported', exported_at: 1700000000000,
      identifier: 'pr_m1', event_name: 'Copa Verão', match_date: '2025-01-10',
    });
    expect(ups[0].data.fingerprint).toBeTruthy();
  });

  it('não rebaixa submitted → exported (monotônico)', () => {
    const ledgerByKey = new Map([['m1', { status: 'submitted' }]]);
    const ups = buildLedgerUpserts([makeEntry()], { status: EXPORT_STATUS.EXPORTED, at: 5, ledgerByKey });
    expect(ups[0].data.status).toBe('submitted'); // mantém o mais avançado
    expect(ups[0].data.exported_at).toBe(5); // mas registra a atividade
  });

  it('ignora entries sem id', () => {
    expect(buildLedgerUpserts([{ row: {} }], { status: EXPORT_STATUS.EXPORTED })).toEqual([]);
  });
});

describe('latestExportInfo', () => {
  it('resume a atividade mais recente e as contagens', () => {
    const ledger = new Map([
      ['a', { status: 'exported', exported_at: 100 }],
      ['b', { status: 'submitted', submitted_at: 300 }],
      ['c', { status: 'exported', exported_at: 200 }],
    ]);
    expect(latestExportInfo(ledger)).toEqual({
      lastActivityAt: 300, exportedCount: 2, submittedCount: 1, total: 3,
    });
  });

  it('aceita objeto simples e vazio', () => {
    expect(latestExportInfo({})).toEqual({ lastActivityAt: 0, exportedCount: 0, submittedCount: 0, total: 0 });
  });
});
