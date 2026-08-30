import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeTeamConfig,
  etapaMirrorId,
  TEAM_GENDER,
  TEAM_ETAPA_TYPE,
  TEAM_SINGLES_MODE,
} from '../domain/teamFormat.js';

// Teste de INTEGRAÇÃO da camada de serviço: `recordConfrontation` roda o domínio
// REAL (computeConfrontationResult + buildConfrontationRankingMirror) e só o I/O
// (Firestore + auditoria) é mockado. Trava, ponta-a-ponta, a regra do espelho no
// ranking da plataforma (`club_event_games`):
//   - DUPLAS (2×2) sempre contam, como duplas autônomas por jogador;
//   - SIMPLES só conta com responsável único (`singles_mode: 'single_player'`);
//   - SIMPLES em rodízio por pontos (`rotating_points`) NÃO conta.
const h = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  batchUpdate: vi.fn(),
  batchSet: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(),
  serverTs: Symbol('ts'),
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn((_db, col, id) => ({ col, id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: h.batchUpdate,
    set: h.batchSet,
    delete: h.batchDelete,
    commit: h.batchCommit,
  })),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => h.serverTs),
}));

const { recordConfrontation } = await import('./teamService.js');

const MID = 'mod1';
const TID = 't1';
const MATCH = 'mtc1';

/** IDs dos docs espelhados gravados no ranking (RANKING_COL). */
function writtenIds() {
  return h.batchSet.mock.calls.map((c) => c[0].id);
}
/** IDs dos docs espelhados removidos do ranking (idempotência). */
function removedIds() {
  return h.batchDelete.mock.calls.map((c) => c[0].id);
}
/** Payload gravado para um dado id espelhado. */
function payloadFor(id) {
  const call = h.batchSet.mock.calls.find((c) => c[0].id === id);
  return call?.[1];
}

function singleConfig(mode) {
  return normalizeTeamConfig({
    team_size: 2,
    gender: TEAM_GENDER.MALE,
    singles_mode: mode,
    etapas: [
      { type: TEAM_ETAPA_TYPE.MENS_DOUBLES },
      { type: TEAM_ETAPA_TYPE.SINGLES },
    ],
  }).value;
}

// Escalação de um confronto: dupla (u1,u2 × u3,u4) + simples (u1 × u3).
function etapasDuplaMaisSimples() {
  return [
    { id: 'd1', type: TEAM_ETAPA_TYPE.MENS_DOUBLES, side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], score_a: 11, score_b: 8 },
    { id: 's1', type: TEAM_ETAPA_TYPE.SINGLES, side_a: ['u1'], side_b: ['u3'], score_a: 11, score_b: 6 },
  ];
}

const VALID_UIDS = ['u1', 'u2', 'u3', 'u4'];

describe('recordConfrontation → espelho no ranking da plataforma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responsável único: espelha a DUPLA e o SIMPLES (duplas/simples autônomos por jogador)', async () => {
    await recordConfrontation(MATCH, {
      etapas: etapasDuplaMaisSimples(),
      config: singleConfig(TEAM_SINGLES_MODE.SINGLE),
      tournamentId: TID,
      modalityId: MID,
      eventTitle: 'Torneio X',
      validUids: VALID_UIDS,
    }, { uid: 'admin' });

    const dId = etapaMirrorId(MATCH, 'd1');
    const sId = etapaMirrorId(MATCH, 's1');

    // Dupla e simples espelhados (nada removido).
    expect(writtenIds()).toEqual([dId, sId]);
    expect(removedIds()).toEqual([]);

    expect(payloadFor(dId).kind).toBe('doubles');
    expect(payloadFor(dId).side_a_ids).toEqual(['u1', 'u2']);
    expect(payloadFor(sId).kind).toBe('singles');
    expect(payloadFor(sId).side_a_ids).toEqual(['u1']);

    // Grava tudo num único lote + auditoria do confronto.
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'team_confrontation_recorded',
    }));
  });

  it('rodízio por pontos: espelha só a DUPLA; o SIMPLES fica de fora do ranking', async () => {
    await recordConfrontation(MATCH, {
      etapas: etapasDuplaMaisSimples(),
      config: singleConfig(TEAM_SINGLES_MODE.ROTATING),
      tournamentId: TID,
      modalityId: MID,
      validUids: VALID_UIDS,
    }, { uid: 'admin' });

    const dId = etapaMirrorId(MATCH, 'd1');
    const sId = etapaMirrorId(MATCH, 's1');

    // Só a dupla é espelhada; o simples em rodízio é removido (idempotência).
    expect(writtenIds()).toEqual([dId]);
    expect(payloadFor(dId).kind).toBe('doubles');
    expect(removedIds()).toContain(sId);
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
  });

  it('jogador sem conta na dupla: a etapa não conta para o ranking individual', async () => {
    const etapas = [
      // g0 é convidado (sem conta) — a dupla inteira não é espelhada.
      { id: 'd1', type: TEAM_ETAPA_TYPE.MENS_DOUBLES, side_a: ['u1', 'g0'], side_b: ['u3', 'u4'], score_a: 11, score_b: 5 },
      { id: 's1', type: TEAM_ETAPA_TYPE.SINGLES, side_a: ['u1'], side_b: ['u3'], score_a: 11, score_b: 9 },
    ];
    await recordConfrontation(MATCH, {
      etapas,
      config: singleConfig(TEAM_SINGLES_MODE.SINGLE),
      tournamentId: TID,
      modalityId: MID,
      validUids: VALID_UIDS, // g0 fora
    }, { uid: 'admin' });

    const dId = etapaMirrorId(MATCH, 'd1');
    const sId = etapaMirrorId(MATCH, 's1');

    // Só o simples (responsável único, ambos com conta) entra; a dupla com
    // convidado é removida.
    expect(writtenIds()).toEqual([sId]);
    expect(removedIds()).toContain(dId);
  });
});
