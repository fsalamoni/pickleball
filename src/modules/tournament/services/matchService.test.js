import { describe, it, expect, vi, beforeEach } from 'vitest';

// I/O mockado: verifica que a rotina de limpeza só escreve quando há marcadores
// obsoletos e registra auditoria. A decisão de QUAIS jogos limpar é pura
// (matchesWithStaleSingleGroup, testada em domain/phases.test.js) e roda real.
const h = vi.hoisted(() => ({
  getDocs: vi.fn(),
  createAuditLog: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(),
  serverTs: Symbol('ts'),
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn((_db, col, id) => ({ col, id })),
  getDoc: vi.fn(),
  getDocs: h.getDocs,
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => h.serverTs),
  writeBatch: vi.fn(() => ({ update: h.batchUpdate, commit: h.batchCommit })),
}));

const { clearStaleSingleGroupMarkers } = await import('./matchService.js');

function snap(matches) {
  return { docs: matches.map((m) => ({ id: m.id, data: () => m })) };
}

const SINGLE_STAGE = { type: 'groups', division_mode: 'single' };

describe('clearStaleSingleGroupMarkers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('remove o marcador de grupo dos jogos numa fase de grupo único', async () => {
    h.getDocs.mockResolvedValue(snap([
      { id: 'm1', stage_index: 0, group: 'A' },
      { id: 'm2', stage_index: 0, group: 'B' },
      { id: 'm3', stage_index: 0, group: null },
    ]));

    const res = await clearStaleSingleGroupMarkers(
      'mod1',
      { stages: [SINGLE_STAGE] },
      { uid: 'admin' },
    );

    expect(res).toEqual({ cleared: 2 });
    expect(h.batchUpdate).toHaveBeenCalledTimes(2);
    expect(h.batchUpdate).toHaveBeenCalledWith(
      { col: 'tournament_matches', id: 'm1' },
      { group: null, updated_at: h.serverTs },
    );
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tournament_group_markers_cleared',
      details: expect.objectContaining({ modality_id: 'mod1', cleared: 2 }),
    }));
  });

  it('é idempotente: sem marcadores obsoletos, não escreve nem audita', async () => {
    h.getDocs.mockResolvedValue(snap([
      { id: 'm1', stage_index: 0, group: null },
      { id: 'm2', stage_index: 0, group: undefined },
    ]));

    const res = await clearStaleSingleGroupMarkers(
      'mod1',
      { stages: [SINGLE_STAGE] },
      { uid: 'admin' },
    );

    expect(res).toEqual({ cleared: 0 });
    expect(h.batchCommit).not.toHaveBeenCalled();
    expect(h.createAuditLog).not.toHaveBeenCalled();
  });

  it('não mexe em fase de grupos legada (sem division_mode single)', async () => {
    h.getDocs.mockResolvedValue(snap([
      { id: 'm1', stage_index: 0, group: 'A' },
      { id: 'm2', stage_index: 0, group: 'B' },
    ]));

    const res = await clearStaleSingleGroupMarkers(
      'mod1',
      { stages: [{ type: 'groups' }] }, // sem division_mode
      { uid: 'admin' },
    );

    expect(res).toEqual({ cleared: 0 });
    expect(h.batchCommit).not.toHaveBeenCalled();
  });
});
