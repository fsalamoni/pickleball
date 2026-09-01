import { describe, it, expect, vi, beforeEach } from 'vitest';

// Teste de INTEGRAÇÃO da camada de serviço: `syncEventDateRankingIfPublished`
// roda o domínio REAL (`buildPublishableMatches`) e só o I/O (Firestore +
// auditoria + recálculo do rating) é mockado. Trava o comportamento da
// sincronização automática de partidas AVULSAS de um dia de jogo já publicado:
//   - NÃO age (no-op) quando o dia não está publicado;
//   - espelha as partidas novas (inclusive avulsas com user_id embutido) quando
//     o dia está publicado, dispara recálculo e registra auditoria.
const h = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  maybeAutoRecomputeRatings: vi.fn(),
  batchSet: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  serverTs: Symbol('ts'),
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('@/modules/rating/services/ratingService', () => ({
  maybeAutoRecomputeRatings: h.maybeAutoRecomputeRatings,
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ path })),
  doc: vi.fn((_db, col, id, sub, subId) => ({ col, id, sub, subId })),
  getDoc: h.getDoc,
  getDocs: h.getDocs,
  setDoc: h.setDoc,
  deleteDoc: vi.fn(),
  query: vi.fn((c, ...rest) => ({ c, rest })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  serverTimestamp: vi.fn(() => h.serverTs),
  writeBatch: vi.fn(() => ({ set: h.batchSet, delete: h.batchDelete, commit: h.batchCommit })),
}));

const { syncEventDateRankingIfPublished } = await import('./rankingPublishingService.js');

const EVENT_ID = 'ev1';
const DATE_ID = 'date1';
const ACTOR = { uid: 'owner1' };

/** Cria um snapshot fake com docs `{ id, data() }`. */
function snap(arr) {
  return { docs: arr.map((d) => ({ id: d.id, data: () => d })) };
}

/** Ids gravados no espelho (club_event_games). */
function writtenIds() {
  return h.batchSet.mock.calls.map((c) => c[0].id);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncEventDateRankingIfPublished', () => {
  it('no-op quando o dia de jogo NÃO está publicado', async () => {
    h.getDoc.mockImplementation((ref) => {
      if (ref.sub === 'dates') return { exists: () => true, data: () => ({ publish_to_ranking: false }) };
      return { exists: () => false };
    });

    const res = await syncEventDateRankingIfPublished(EVENT_ID, DATE_ID, ACTOR);

    expect(res).toEqual({ synced: false, reason: 'not-published' });
    expect(h.getDocs).not.toHaveBeenCalled();
    expect(h.batchSet).not.toHaveBeenCalled();
    expect(h.createAuditLog).not.toHaveBeenCalled();
    expect(h.maybeAutoRecomputeRatings).not.toHaveBeenCalled();
  });

  it('espelha uma partida AVULSA nova (round null, user_id embutido) quando o dia está publicado', async () => {
    h.getDoc.mockImplementation((ref) => {
      if (ref.sub === 'dates') return { exists: () => true, data: () => ({ publish_to_ranking: true }) };
      // doc do evento
      return { exists: () => true, id: EVENT_ID, data: () => ({ club_id: 'club1', title: 'Dia de jogo' }) };
    });

    const avulsa = {
      id: 'gAvulsa',
      event_id: EVENT_ID,
      date_id: DATE_ID,
      round: null,
      kind: 'doubles',
      side_a: [{ id: 'pa1', name: 'Ana', user_id: 'u_ana' }, { id: 'pa2', name: 'Beto', user_id: 'u_beto' }],
      side_b: [{ id: 'pa3', name: 'Caio', user_id: 'u_caio' }, { id: 'pa4', name: 'Duda', user_id: 'u_duda' }],
      score_a: 11,
      score_b: 6,
    };

    h.getDocs.mockImplementation((arg) => {
      const path = arg?.path || arg?.c?.path || [];
      if (path[0] === 'club_event_games') return snap([]); // nada publicado ainda
      if (path.includes('games')) return snap([avulsa]);
      if (path.includes('participants')) return snap([]); // lookup por participante FALHA
      return snap([]);
    });

    const res = await syncEventDateRankingIfPublished(EVENT_ID, DATE_ID, ACTOR);

    expect(res.synced).toBe(true);
    // A avulsa foi espelhada mesmo sem participantes, graças ao user_id embutido.
    expect(writtenIds()).toEqual([`${EVENT_ID}_${DATE_ID}_gAvulsa`]);
    const payload = h.batchSet.mock.calls[0][1];
    expect(payload.side_a_ids).toEqual(['u_ana', 'u_beto']);
    expect(payload.side_b_ids).toEqual(['u_caio', 'u_duda']);
    expect(payload.club_id).toBe('club1');
    // Recálculo forçado do rating nacional + auditoria da sincronização.
    expect(h.maybeAutoRecomputeRatings).toHaveBeenCalledWith(ACTOR, { force: true });
    expect(h.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'club_event_date_ranking_synced' }),
    );
  });

  it('no-op (synced false) quando publicado mas nada mudou', async () => {
    h.getDoc.mockImplementation((ref) => {
      if (ref.sub === 'dates') return { exists: () => true, data: () => ({ publish_to_ranking: true }) };
      return { exists: () => true, id: EVENT_ID, data: () => ({ club_id: 'club1', title: 'Dia' }) };
    });
    // O único jogo do dia já está publicado (mesmo id) → nada a gravar/remover.
    const g = {
      id: 'g1', event_id: EVENT_ID, date_id: DATE_ID, kind: 'doubles',
      side_a: [{ id: 'pa1', user_id: 'u_ana' }, { id: 'pa2', user_id: 'u_beto' }],
      side_b: [{ id: 'pa3', user_id: 'u_caio' }, { id: 'pa4', user_id: 'u_duda' }],
      score_a: 11, score_b: 3,
    };
    h.getDocs.mockImplementation((arg) => {
      const path = arg?.path || arg?.c?.path || [];
      // Documento já espelhado carrega o payload COMPLETO (como em produção), para
      // que a detecção de edição (mirrorDecisionChanged) veja "nada mudou".
      if (path[0] === 'club_event_games') {
        return snap([{
          id: `${EVENT_ID}_${DATE_ID}_g1`,
          score_a: 11, score_b: 3, winner_side: 'a', kind: 'doubles', club_id: 'club1',
          side_a_ids: ['u_ana', 'u_beto'], side_b_ids: ['u_caio', 'u_duda'],
        }]);
      }
      if (path.includes('games')) return snap([g]);
      if (path.includes('participants')) return snap([]);
      return snap([]);
    });

    const res = await syncEventDateRankingIfPublished(EVENT_ID, DATE_ID, ACTOR);

    expect(res).toEqual({ synced: false, reason: 'up-to-date' });
    expect(h.batchSet).not.toHaveBeenCalled();
    expect(h.createAuditLog).not.toHaveBeenCalled();
    expect(h.maybeAutoRecomputeRatings).not.toHaveBeenCalled();
  });

  it('re-espelha um jogo JÁ publicado quando o placar é corrigido', async () => {
    h.getDoc.mockImplementation((ref) => {
      if (ref.sub === 'dates') return { exists: () => true, data: () => ({ publish_to_ranking: true }) };
      return { exists: () => true, id: EVENT_ID, data: () => ({ club_id: 'club1', title: 'Dia' }) };
    });
    // Jogo atual com placar CORRIGIDO (3x11 → vencedor B).
    const g = {
      id: 'g1', event_id: EVENT_ID, date_id: DATE_ID, kind: 'doubles',
      side_a: [{ id: 'pa1', user_id: 'u_ana' }, { id: 'pa2', user_id: 'u_beto' }],
      side_b: [{ id: 'pa3', user_id: 'u_caio' }, { id: 'pa4', user_id: 'u_duda' }],
      score_a: 3, score_b: 11,
    };
    h.getDocs.mockImplementation((arg) => {
      const path = arg?.path || arg?.c?.path || [];
      // Espelho antigo tinha o placar ANTERIOR (11x3 → vencedor A).
      if (path[0] === 'club_event_games') {
        return snap([{
          id: `${EVENT_ID}_${DATE_ID}_g1`,
          score_a: 11, score_b: 3, winner_side: 'a', kind: 'doubles', club_id: 'club1',
          side_a_ids: ['u_ana', 'u_beto'], side_b_ids: ['u_caio', 'u_duda'],
          created_at: '2020-01-01T00:00:00.000Z',
        }]);
      }
      if (path.includes('games')) return snap([g]);
      if (path.includes('participants')) return snap([]);
      return snap([]);
    });

    const res = await syncEventDateRankingIfPublished(EVENT_ID, DATE_ID, ACTOR);

    expect(res.synced).toBe(true);
    expect(writtenIds()).toEqual([`${EVENT_ID}_${DATE_ID}_g1`]);
    const payload = h.batchSet.mock.calls[0][1];
    expect(payload.winner_side).toBe('b');
    expect(payload.score_a).toBe(3);
    expect(payload.score_b).toBe(11);
    // created_at do documento original é preservado ao regravar a correção.
    expect(payload.created_at).toBe('2020-01-01T00:00:00.000Z');
    expect(h.maybeAutoRecomputeRatings).toHaveBeenCalledWith(ACTOR, { force: true });
    expect(h.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'club_event_date_ranking_synced' }),
    );
  });
});
