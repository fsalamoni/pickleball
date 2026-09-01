import { describe, it, expect, vi, beforeEach } from 'vitest';

// Teste de INTEGRAÇÃO da camada de serviço: `syncGameDayRankingIfPublished`
// roda o domínio REAL (`buildGameDayRankingMatches`) e só o I/O (Firestore +
// auditoria + recálculo) é mockado. Trava a sincronização automática de
// partidas AVULSAS de um dia de jogo do ATLETA já publicado.
const h = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  maybeAutoRecomputeRatings: vi.fn(),
  batchSet: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  serverTs: Symbol('ts'),
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn(),
  NOTIFICATION_TYPE: {},
}));
vi.mock('@/modules/rating/services/ratingService', () => ({
  maybeAutoRecomputeRatings: h.maybeAutoRecomputeRatings,
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ path })),
  doc: vi.fn((_db, col, id, sub, subId) => ({ col, id, sub, subId })),
  getDoc: h.getDoc,
  getDocs: h.getDocs,
  setDoc: vi.fn(),
  updateDoc: h.updateDoc,
  deleteDoc: vi.fn(),
  query: vi.fn((c, ...rest) => ({ c, rest })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  serverTimestamp: vi.fn(() => h.serverTs),
  arrayUnion: vi.fn((...v) => ({ arrayUnion: v })),
  writeBatch: vi.fn(() => ({ set: h.batchSet, delete: h.batchDelete, commit: h.batchCommit })),
}));

const { syncGameDayRankingIfPublished } = await import('./gameDayService.js');

const GD_ID = 'gd1';
const ACTOR = { uid: 'owner1' };

function snap(arr) {
  return { docs: arr.map((d) => ({ id: d.id, data: () => d })) };
}
function writtenIds() {
  return h.batchSet.mock.calls.map((c) => c[0].id);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncGameDayRankingIfPublished', () => {
  it('no-op quando o dia de jogo NÃO está publicado', async () => {
    h.getDoc.mockResolvedValue({ exists: () => true, id: GD_ID, data: () => ({ title: 'Sábado', publish_to_ranking: false }) });

    const res = await syncGameDayRankingIfPublished(GD_ID, ACTOR);

    expect(res).toEqual({ synced: false, reason: 'not-published' });
    expect(h.getDocs).not.toHaveBeenCalled();
    expect(h.batchSet).not.toHaveBeenCalled();
    expect(h.createAuditLog).not.toHaveBeenCalled();
    expect(h.maybeAutoRecomputeRatings).not.toHaveBeenCalled();
  });

  it('espelha uma partida AVULSA nova (round null, user_id embutido) quando publicado', async () => {
    h.getDoc.mockResolvedValue({ exists: () => true, id: GD_ID, data: () => ({ title: 'Sábado', publish_to_ranking: true }) });

    const avulsa = {
      id: 'gAvulsa',
      round: null,
      kind: 'doubles',
      side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }, { id: 'p2', name: 'Bia', user_id: 'u2' }],
      side_b: [{ id: 'p3', name: 'Caio', user_id: 'u3' }, { id: 'p4', name: 'Duda', user_id: 'u4' }],
      score_a: 11, score_b: 7,
    };

    h.getDocs.mockImplementation((arg) => {
      const path = arg?.path || arg?.c?.path || [];
      if (path[0] === 'club_event_games') return snap([]); // nada publicado ainda
      if (path.includes('games')) return snap([avulsa]);
      if (path.includes('participants')) return snap([]); // lookup por participante FALHA
      return snap([]);
    });

    const res = await syncGameDayRankingIfPublished(GD_ID, ACTOR);

    expect(res.synced).toBe(true);
    // Espelhada mesmo sem participantes, graças ao user_id embutido na avulsa.
    expect(writtenIds()).toHaveLength(1);
    const payload = h.batchSet.mock.calls[0][1];
    expect(payload.side_a_ids).toEqual(['u1', 'u2']);
    expect(payload.side_b_ids).toEqual(['u3', 'u4']);
    expect(h.maybeAutoRecomputeRatings).toHaveBeenCalledWith(ACTOR, { force: true });
    expect(h.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'game_day_ranking_synced' }),
    );
  });

  it('re-espelha um jogo JÁ publicado quando o placar é corrigido', async () => {
    h.getDoc.mockResolvedValue({ exists: () => true, id: GD_ID, data: () => ({ title: 'Sábado', publish_to_ranking: true }) });

    // Jogo atual com placar CORRIGIDO (7x11 → vencedor B).
    const g = {
      id: 'g1', round: 1, kind: 'doubles',
      side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }, { id: 'p2', name: 'Bia', user_id: 'u2' }],
      side_b: [{ id: 'p3', name: 'Caio', user_id: 'u3' }, { id: 'p4', name: 'Duda', user_id: 'u4' }],
      score_a: 7, score_b: 11,
    };
    h.getDocs.mockImplementation((arg) => {
      const path = arg?.path || arg?.c?.path || [];
      // Espelho antigo tinha o placar ANTERIOR (11x7 → vencedor A).
      if (path[0] === 'club_event_games') {
        return snap([{
          id: `gd_${GD_ID}_g1`,
          score_a: 11, score_b: 7, winner_side: 'a', kind: 'doubles', club_id: null,
          side_a_ids: ['u1', 'u2'], side_b_ids: ['u3', 'u4'],
          created_at: '2020-01-01T00:00:00.000Z',
        }]);
      }
      if (path.includes('games')) return snap([g]);
      if (path.includes('participants')) return snap([]);
      return snap([]);
    });

    const res = await syncGameDayRankingIfPublished(GD_ID, ACTOR);

    expect(res.synced).toBe(true);
    expect(writtenIds()).toEqual([`gd_${GD_ID}_g1`]);
    const payload = h.batchSet.mock.calls[0][1];
    expect(payload.winner_side).toBe('b');
    expect(payload.score_a).toBe(7);
    expect(payload.score_b).toBe(11);
    // created_at do documento original é preservado ao regravar a correção.
    expect(payload.created_at).toBe('2020-01-01T00:00:00.000Z');
    expect(h.maybeAutoRecomputeRatings).toHaveBeenCalledWith(ACTOR, { force: true });
  });
});
