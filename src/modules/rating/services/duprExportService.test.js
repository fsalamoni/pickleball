import { describe, it, expect, vi, beforeEach } from 'vitest';

// I/O mockado: valida a persistência do LEDGER de exportação DUPR
// (`dupr_export_log`). A decisão de QUAIS upserts gravar é pura
// (buildLedgerUpserts, testada em domain/duprReconcile.test.js) e roda real.
const h = vi.hoisted(() => ({
  getDocs: vi.fn(),
  createAuditLog: vi.fn(),
  batchSet: vi.fn(),
  batchCommit: vi.fn(),
  serverTs: Symbol('ts'),
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn((_db, col, id) => ({ col, id })),
  getDocs: h.getDocs,
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => h.serverTs),
  writeBatch: vi.fn(() => ({ set: h.batchSet, commit: h.batchCommit })),
}));

const { loadDuprLedger, recordDuprLedger } = await import('./duprExportService.js');
const { EXPORT_STATUS } = await import('../domain/duprReconcile.js');

function snap(rows) {
  return { docs: rows.map((r) => ({ id: r.id, data: () => r })) };
}

/** Entry mínima válida (dupla pronta) para o ledger. */
function entry(id, extra = {}) {
  return {
    id,
    source: 'tournament_matches',
    matchType: 'D',
    eventName: 'Copa X',
    at: 1_700_000_000_000,
    row: {
      date: '2026-01-10',
      matchType: 'D',
      playerA1DuprId: 'AAA', playerA2DuprId: 'BBB',
      playerB1DuprId: 'CCC', playerB2DuprId: 'DDD',
      teamAGame1: 11, teamBGame1: 5,
    },
    ...extra,
  };
}

describe('loadDuprLedger', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve Map por id de partida', async () => {
    h.getDocs.mockResolvedValueOnce(snap([
      { id: 'm1', status: 'exported', exported_at: 111 },
      { id: 'm2', status: 'submitted', submitted_at: 222 },
    ]));
    const map = await loadDuprLedger();
    expect(map).toBeInstanceOf(Map);
    expect(map.get('m1')).toMatchObject({ match_id: 'm1', status: 'exported' });
    expect(map.get('m2')).toMatchObject({ match_id: 'm2', status: 'submitted' });
  });
});

describe('recordDuprLedger', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grava upserts com merge + updated_at e audita a exportação', async () => {
    const res = await recordDuprLedger({ uid: 'admin', email: 'a@x.com' }, [entry('m1'), entry('m2')], {
      status: EXPORT_STATUS.EXPORTED,
    });

    expect(res).toEqual({ written: 2 });
    expect(h.batchSet).toHaveBeenCalledTimes(2);
    // merge:true e carimbo de servidor presentes
    const [, data, options] = h.batchSet.mock.calls[0];
    expect(options).toEqual({ merge: true });
    expect(data.updated_at).toBe(h.serverTs);
    expect(data.status).toBe(EXPORT_STATUS.EXPORTED);
    expect(data.match_id).toBe('m1');
    expect(data).toHaveProperty('exported_at');
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'dupr_matches_exported',
    }));
  });

  it('usa a ação de auditoria de submissão quando status=submitted', async () => {
    await recordDuprLedger({ uid: 'admin' }, [entry('m1')], { status: EXPORT_STATUS.SUBMITTED });
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'dupr_matches_submitted',
    }));
  });

  it('não grava nem audita quando não há upserts', async () => {
    const res = await recordDuprLedger({ uid: 'admin' }, [], { status: EXPORT_STATUS.EXPORTED });
    expect(res).toEqual({ written: 0 });
    expect(h.batchCommit).not.toHaveBeenCalled();
    expect(h.createAuditLog).not.toHaveBeenCalled();
  });

  it('não rebaixa uma partida já submetida (situação monotônica)', async () => {
    // ledger atual diz "submitted"; nova ação "exported" NÃO deve regredir.
    const ledgerByKey = new Map([['m1', { status: 'submitted', submitted_at: 999 }]]);
    await recordDuprLedger({ uid: 'admin' }, [entry('m1')], {
      status: EXPORT_STATUS.EXPORTED,
      ledgerByKey,
    });
    const [, data] = h.batchSet.mock.calls[0];
    expect(data.status).toBe('submitted');
    // mas ainda registra o carimbo de exportação desta ação
    expect(data).toHaveProperty('exported_at');
  });
});
