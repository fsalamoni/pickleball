import { describe, it, expect, vi, beforeEach } from 'vitest';

// I/O mockado: verifica que a rotina de limpeza só escreve quando há marcadores
// obsoletos e registra auditoria. A decisão de QUAIS jogos limpar é pura
// (matchesWithStaleSingleGroup, testada em domain/phases.test.js) e roda real.
const h = vi.hoisted(() => ({
  getDocs: vi.fn(),
  createAuditLog: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(),
  batchSet: vi.fn(),
  getDoc: vi.fn(),
  serverTs: Symbol('ts'),
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn((_db, col, id) => ({ col, id })),
  getDoc: h.getDoc,
  getDocs: h.getDocs,
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => h.serverTs),
  writeBatch: vi.fn(() => ({
    update: h.batchUpdate, delete: h.batchDelete, commit: h.batchCommit, set: h.batchSet,
  })),
}));

const { clearStaleSingleGroupMarkers, autoAdvanceBracket } = await import('./matchService.js');

function snap(rows) {
  return { docs: rows.map((r) => ({ id: r.id, data: () => r })) };
}

const SINGLE_STAGE = { type: 'groups', division_mode: 'single' };

describe('clearStaleSingleGroupMarkers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('remove o marcador de grupo dos jogos numa fase de grupo único', async () => {
    h.getDocs
      .mockResolvedValueOnce(snap([
        { id: 'm1', stage_index: 0, group: 'A' },
        { id: 'm2', stage_index: 0, group: 'B' },
        { id: 'm3', stage_index: 0, group: null },
      ]))
      .mockResolvedValueOnce(snap([])); // sem docs de grupo

    const res = await clearStaleSingleGroupMarkers(
      'mod1',
      { stages: [SINGLE_STAGE] },
      { uid: 'admin' },
    );

    expect(res).toEqual({ cleared: 2, groupsRemoved: 0 });
    expect(h.batchUpdate).toHaveBeenCalledTimes(2);
    expect(h.batchUpdate).toHaveBeenCalledWith(
      { col: 'tournament_matches', id: 'm1' },
      { group: null, updated_at: h.serverTs },
    );
    expect(h.batchDelete).not.toHaveBeenCalled();
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tournament_group_markers_cleared',
      details: expect.objectContaining({ modality_id: 'mod1', cleared: 2 }),
    }));
    expect(h.createAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({
      action: 'tournament_group_metadata_cleared',
    }));
  });

  it('apaga os docs de grupo órfãos de uma fase de grupo único', async () => {
    h.getDocs
      .mockResolvedValueOnce(snap([{ id: 'm1', stage_index: 0, group: null }])) // sem marcadores
      .mockResolvedValueOnce(snap([{ id: 'g1', stage_index: 0, name: 'Grupo A' }]));

    const res = await clearStaleSingleGroupMarkers(
      'mod1',
      { stages: [SINGLE_STAGE] },
      { uid: 'admin' },
    );

    expect(res).toEqual({ cleared: 0, groupsRemoved: 1 });
    expect(h.batchUpdate).not.toHaveBeenCalled();
    expect(h.batchDelete).toHaveBeenCalledTimes(1);
    expect(h.batchDelete).toHaveBeenCalledWith({ col: 'tournament_groups', id: 'g1' });
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tournament_group_metadata_cleared',
      details: expect.objectContaining({ modality_id: 'mod1', groups_removed: 1 }),
    }));
    expect(h.createAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({
      action: 'tournament_group_markers_cleared',
    }));
  });

  it('limpa marcadores e metadados juntos, no mesmo lote', async () => {
    h.getDocs
      .mockResolvedValueOnce(snap([{ id: 'm1', stage_index: 0, group: 'A' }]))
      .mockResolvedValueOnce(snap([{ id: 'g1', stage_index: 0, name: 'Grupo A' }]));

    const res = await clearStaleSingleGroupMarkers(
      'mod1',
      { stages: [SINGLE_STAGE] },
      { uid: 'admin' },
    );

    expect(res).toEqual({ cleared: 1, groupsRemoved: 1 });
    expect(h.batchUpdate).toHaveBeenCalledTimes(1);
    expect(h.batchDelete).toHaveBeenCalledTimes(1);
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tournament_group_markers_cleared',
    }));
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tournament_group_metadata_cleared',
    }));
  });

  it('é idempotente: sem marcadores nem docs órfãos, não escreve nem audita', async () => {
    h.getDocs
      .mockResolvedValueOnce(snap([
        { id: 'm1', stage_index: 0, group: null },
        { id: 'm2', stage_index: 0, group: undefined },
      ]))
      .mockResolvedValueOnce(snap([]));

    const res = await clearStaleSingleGroupMarkers(
      'mod1',
      { stages: [SINGLE_STAGE] },
      { uid: 'admin' },
    );

    expect(res).toEqual({ cleared: 0, groupsRemoved: 0 });
    expect(h.batchCommit).not.toHaveBeenCalled();
    expect(h.createAuditLog).not.toHaveBeenCalled();
  });

  it('não mexe em fase de grupos legada (sem division_mode single)', async () => {
    h.getDocs
      .mockResolvedValueOnce(snap([
        { id: 'm1', stage_index: 0, group: 'A' },
        { id: 'm2', stage_index: 0, group: 'B' },
      ]))
      .mockResolvedValueOnce(snap([{ id: 'g1', stage_index: 0, name: 'Grupo A' }]));

    const res = await clearStaleSingleGroupMarkers(
      'mod1',
      { stages: [{ type: 'groups' }] }, // sem division_mode
      { uid: 'admin' },
    );

    expect(res).toEqual({ cleared: 0, groupsRemoved: 0 });
    expect(h.batchCommit).not.toHaveBeenCalled();
    expect(h.batchDelete).not.toHaveBeenCalled();
  });
});

describe('autoAdvanceBracket — a chave anda sozinha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const exists = (data) => ({ exists: () => Boolean(data), data: () => data });
  const jogo = (id, round, position, a, b, winner) => ({
    id, round, position, stage_index: 0, stage_type: 'knockout',
    side_a_ids: [a], side_b_ids: [b],
    status: winner ? 'finished' : 'scheduled', winner_side: winner || null,
  });

  it('cria o confronto seguinte quando os dois jogos de origem terminaram', async () => {
    h.getDoc
      .mockResolvedValueOnce(exists({ id: 'mod1', stages: [{ type: 'knockout' }] }))
      .mockResolvedValueOnce(exists({ id: 't1' }));
    const rodada1 = [
      jogo('m1', 1, 1, 'a', 'b', 'a'),
      jogo('m2', 1, 2, 'c', 'd', 'b'),
      jogo('m3', 1, 3, 'e', 'f'),
      jogo('m4', 1, 4, 'g', 'h'),
    ];
    h.getDocs
      .mockResolvedValueOnce(snap(rodada1))
      .mockResolvedValueOnce(snap([...rodada1, jogo('x', 2, 1, 'a', 'd')]));

    const res = await autoAdvanceBracket(
      { tournamentId: 't1', modalityId: 'mod1', stageIndex: 0 },
      { uid: 'admin' },
    );

    expect(res).toEqual({ created: 1, updated: 0 });
    expect(h.batchSet).toHaveBeenCalledTimes(1);
    expect(h.batchSet.mock.calls[0][1]).toMatchObject({
      round: 2, position: 1, side_a_ids: ['a'], side_b_ids: ['d'], status: 'scheduled',
    });
  });

  it('não faz nada fora do mata-mata', async () => {
    const res = await autoAdvanceBracket(
      { tournamentId: 't1', modalityId: 'mod1', stageIndex: 0, stageType: 'groups' },
      { uid: 'admin' },
    );
    expect(res).toEqual({ created: 0, updated: 0 });
    expect(h.getDoc).not.toHaveBeenCalled();
  });
});
