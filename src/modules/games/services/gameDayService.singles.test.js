/**
 * Jogo SIMPLES no dia de jogo — a camada de serviço (Onda CF).
 *
 * O domínio é o REAL; só o I/O (Firestore, auditoria, flags, nível) é
 * simulado. O que protege:
 *  1. ⭐ pedir simples grava `kind: 'singles'` com 1 × 1, e os DOIS primeiros
 *     da fila entram;
 *  2. ⭐ sem pedir tipo, a quadra mantém o tipo do último jogo dela — e a
 *     quadra nova é de duplas (o comportamento de sempre);
 *  3. ⭐ a partida montada à mão é conferida no serviço: 1 × 1 ou 2 × 2, sem
 *     repetidos;
 *  4. o Americano aprimorado sorteia simples 1 × 1;
 *  5. ⭐ publicado, o jogo simples vai ao ranking como `singles`, 1 uid por
 *     lado — que é o que a regra aceita e o que o servidor manda para o
 *     rating de simples.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  batchSet: vi.fn(),
  batchDelete: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  dados: { gameDay: {}, participants: [], games: [], published: [] },
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('@/core/services/notificationService', () => ({ notifyUsers: vi.fn(), NOTIFICATION_TYPE: {} }));
vi.mock('@/core/services/platformSettingsService', () => ({ getPlatformSettings: async () => ({ feature_flags: {} }) }));
vi.mock('@/modules/rating/services/unifiedLevelService', () => ({ fetchUnifiedLevelsByParticipant: async () => ({}) }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ path })),
  doc: vi.fn((_db, col, id, sub, subId) => ({ col, id: subId || id || 'novo', sub, subId })),
  getDoc: h.getDoc,
  getDocs: h.getDocs,
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((c, ...rest) => ({ c, rest })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  serverTimestamp: vi.fn(() => 'ts'),
  arrayUnion: vi.fn((...v) => ({ arrayUnion: v })),
  writeBatch: vi.fn(() => ({
    set: h.batchSet, delete: h.batchDelete, update: h.batchUpdate, commit: h.batchCommit,
  })),
}));

const {
  createNextPlayGame, createManualPlayGame, createNextAmericanoLiveGame,
  createManualAmericanoLiveGame, syncGameDayRankingIfPublished, createPlayRoundForFreeCourts,
} = await import('./gameDayService.js');

const ACTOR = { uid: 'dono' };
const snap = (arr) => ({ docs: arr.map((d) => ({ id: d.id, data: () => d })) });
const pessoa = (id, i) => ({ id, name: id.toUpperCase(), user_id: `u_${id}`, available_since: 100 + i, available_tie: 0, created_at_ms: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  h.dados = {
    gameDay: { title: 'Sábado', format: 'play', play_courts: 2, publish_to_ranking: false },
    participants: ['a', 'b', 'c', 'd', 'e', 'f'].map(pessoa),
    games: [],
    published: [],
  };
  h.getDoc.mockImplementation(async () => ({ exists: () => true, id: 'gd1', data: () => h.dados.gameDay }));
  h.getDocs.mockImplementation(async (arg) => {
    const path = arg?.path || arg?.c?.path || [];
    if (path[0] === 'club_event_games') return snap(h.dados.published);
    if (path.includes('games')) return snap(h.dados.games);
    if (path.includes('participants')) return snap(h.dados.participants);
    return snap([]);
  });
});

/** Os jogos gravados no lote (o `set` em `games/{id}`). */
const jogosGravados = () => h.batchSet.mock.calls
  .filter(([ref]) => ref?.sub === 'games')
  .map(([, dados]) => dados);

describe('⭐ Play: a próxima partida', () => {
  it('⭐ pedindo simples: grava `singles`, 1 × 1, com os dois primeiros da fila', async () => {
    const r = await createNextPlayGame('gd1', ACTOR, { court: 1, kind: 'singles' });
    expect(r.kind).toBe('singles');
    const [jogo] = jogosGravados();
    expect(jogo.kind).toBe('singles');
    expect(jogo.side_a.map((p) => p.id)).toEqual(['a']);
    expect(jogo.side_b.map((p) => p.id)).toEqual(['b']);
    expect(jogo.side_a[0].user_id).toBe('u_a');
  });

  it('⭐ sem pedir tipo, quadra nova é de duplas — como sempre', async () => {
    await createNextPlayGame('gd1', ACTOR, { court: 1 });
    const [jogo] = jogosGravados();
    expect(jogo.kind).toBe('doubles');
    expect(jogo.side_a).toHaveLength(2);
    expect(jogo.side_b).toHaveLength(2);
  });

  it('⭐ sem pedir tipo, a quadra mantém o tipo do último jogo dela', async () => {
    h.dados.games = [{
      id: 'g0', court: 2, kind: 'singles', status: 'finished', created_at_ms: 5,
      side_a: [{ id: 'x' }], side_b: [{ id: 'y' }],
    }];
    const r = await createNextPlayGame('gd1', ACTOR, { court: 2 });
    expect(r.kind).toBe('singles');
    expect(jogosGravados()[0].side_a).toHaveLength(1);
  });

  it('com um só na fila, o simples diz que faltam 2 (não 4)', async () => {
    h.dados.participants = [pessoa('a', 0)];
    await expect(createNextPlayGame('gd1', ACTOR, { court: 1, kind: 'singles' })).rejects.toThrow(/mínimo 2/);
  });

  it('⭐ a rodada respeita o tipo que a tela escolheu para cada quadra', async () => {
    const r = await createPlayRoundForFreeCourts('gd1', ACTOR, { courtKinds: { 2: 'singles' } });
    expect(r.courts).toEqual([1, 2]);
    const gravados = jogosGravados();
    const q1 = gravados.find((g) => g.court === 1);
    const q2 = gravados.find((g) => g.court === 2);
    expect(q1.kind).toBe('doubles');
    expect(q1.side_a).toHaveLength(2);
    expect(q2.kind).toBe('singles');
    expect(q2.side_a).toHaveLength(1);
  });
});

describe('⭐ a partida montada à mão', () => {
  it('1 × 1 vira simples', async () => {
    await createManualPlayGame('gd1', { court: 1, sideAIds: ['a'], sideBIds: ['c'] }, ACTOR);
    const [jogo] = jogosGravados();
    expect(jogo.kind).toBe('singles');
  });

  it('2 × 2 continua duplas', async () => {
    await createManualPlayGame('gd1', { court: 1, sideAIds: ['a', 'b'], sideBIds: ['c', 'd'] }, ACTOR);
    expect(jogosGravados()[0].kind).toBe('doubles');
  });

  it('⭐ o serviço recusa 2 × 1 e repetidos, mesmo que a tela deixe', async () => {
    await expect(createManualPlayGame('gd1', { sideAIds: ['a', 'b'], sideBIds: ['c'] }, ACTOR)).rejects.toThrow(/1 jogador de cada lado/);
    await expect(createManualPlayGame('gd1', { sideAIds: ['a'], sideBIds: ['a'] }, ACTOR)).rejects.toThrow(/repetidos/);
    expect(h.batchCommit).not.toHaveBeenCalled();
  });

  it('Americano aprimorado: 1 × 1 com placar vira simples concluído', async () => {
    h.dados.gameDay.format = 'americano_live';
    await createManualAmericanoLiveGame('gd1', {
      court: null, sideAIds: ['a'], sideBIds: ['b'], scoreA: 11, scoreB: 6,
    }, ACTOR);
    expect(jogosGravados()[0].kind).toBe('singles');
    expect(h.batchUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ score_a: 11, score_b: 6 }));
  });
});

describe('Americano aprimorado: a próxima partida simples', () => {
  it('1 × 1, com o primeiro da fila', async () => {
    h.dados.gameDay.format = 'americano_live';
    const r = await createNextAmericanoLiveGame('gd1', ACTOR, { court: 1, kind: 'singles' });
    expect(r.kind).toBe('singles');
    const [jogo] = jogosGravados();
    expect(jogo.kind).toBe('singles');
    expect(jogo.format).toBe('americano_live');
    expect(jogo.side_a.map((p) => p.id)).toEqual(['a']);
    expect(jogo.side_b).toHaveLength(1);
  });
});

describe('⭐ publicação: o simples vai ao ranking como simples', () => {
  it('um jogo 1 × 1 decidido vira `kind: singles` com um uid por lado', async () => {
    h.dados.gameDay.publish_to_ranking = true;
    h.dados.games = [{
      id: 'g1', kind: 'singles', status: 'finished', score_a: 11, score_b: 4,
      side_a: [{ id: 'a', name: 'A', user_id: 'u_a' }],
      side_b: [{ id: 'b', name: 'B', user_id: 'u_b' }],
    }];
    const r = await syncGameDayRankingIfPublished('gd1', ACTOR);
    expect(r.synced).toBe(true);
    const espelho = h.batchSet.mock.calls.map(([, d]) => d).find((d) => d?.source === 'athlete_game_day');
    expect(espelho).toMatchObject({ kind: 'singles', side_a_ids: ['u_a'], side_b_ids: ['u_b'], winner_side: 'a' });
  });
});

describe('a mensagem de "falta gente" da rodada', () => {
  it('num dia só de duplas, cita 4 — como sempre', async () => {
    h.dados.participants = ['a', 'b', 'c'].map(pessoa);
    await expect(createPlayRoundForFreeCourts('gd1', ACTOR)).rejects.toThrow(/mínimo 4/);
  });

  it('com uma quadra de simples livre, cita 2', async () => {
    h.dados.participants = [pessoa('a', 0)];
    await expect(createPlayRoundForFreeCourts('gd1', ACTOR, { courtKinds: { 2: 'singles' } })).rejects.toThrow(/mínimo 2/);
  });
});
