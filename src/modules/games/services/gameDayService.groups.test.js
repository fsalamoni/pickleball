/**
 * GRUPOS no Play — a camada de serviço (flag `play_groups`).
 *
 * O domínio é o REAL; só o I/O (Firestore, auditoria, flags, nível) é
 * simulado. O que protege:
 *  1. ⭐ flag DESLIGADA = o Play de sempre, mesmo com grupos gravados no dia;
 *  2. ⭐ ligada, a partida sai do grupo certo (política), carrega o grupo e usa
 *     a formação dele para dividir as duplas;
 *  3. ⭐ quando nenhum grupo joga, o erro diz POR QUÊ (não o genérico);
 *  4. a regra de nível usa o nível unificado, buscado ANTES de escolher;
 *  5. a rodada e a partida à mão também levam o grupo;
 *  6. a substituição prefere quem é do mesmo grupo e nunca trava;
 *  7. as escritas novas: configurar, mover (com a dupla), distribuir e o grupo
 *     de quem chega.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  batchSet: vi.fn(),
  batchDelete: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  flags: {},
  levels: {},
  dados: { gameDay: {}, participants: [], games: [] },
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('@/core/services/notificationService', () => ({ notifyUsers: vi.fn(), NOTIFICATION_TYPE: {} }));
vi.mock('@/core/services/platformSettingsService', () => ({
  getPlatformSettings: async () => ({ feature_flags: h.flags }),
}));
vi.mock('@/modules/rating/services/unifiedLevelService', () => ({
  fetchUnifiedLevelsByParticipant: async () => h.levels,
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ path })),
  doc: vi.fn((_db, col, id, sub, subId) => ({ col, id: subId || id || 'novo', sub, subId })),
  getDoc: h.getDoc,
  getDocs: h.getDocs,
  setDoc: h.setDoc,
  updateDoc: h.updateDoc,
  deleteDoc: vi.fn(),
  query: vi.fn((c, ...rest) => ({ c, rest })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  serverTimestamp: vi.fn(() => 'ts'),
  arrayUnion: vi.fn((...v) => ({ arrayUnion: v })),
  arrayRemove: vi.fn((...v) => ({ arrayRemove: v })),
  writeBatch: vi.fn(() => ({
    set: h.batchSet, delete: h.batchDelete, update: h.batchUpdate, commit: h.batchCommit,
  })),
}));

const {
  createNextPlayGame, createPlayRoundForFreeCourts, createManualPlayGame, noShowSwapPlayGame,
  setPlayGroups, setPlayParticipantGroup, assignPlayGroups, addGameDayParticipant,
  buildGameDayParticipant, resolveEntryGroup,
} = await import('./gameDayService.js');

const ACTOR = { uid: 'dono' };
const snap = (arr) => ({ docs: arr.map((d) => ({ id: d.id, data: () => d })) });
const pessoa = (id, i, extra = {}) => ({
  id, name: id.toUpperCase(), user_id: `u_${id}`, available_since: 100 + i, available_tie: 0,
  created_at_ms: 1, ...extra,
});
const grupo = (gid, ids, extra = {}) => ids.map((id, i) => pessoa(id, extra.offset ?? 0 + i, { play_group_id: gid, ...extra }));

const GRUPOS = [
  { id: 'a', name: 'Alfa', color: 'rose' },
  { id: 'b', name: 'Beta', color: 'sky' },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.flags = { play_groups: true };
  h.levels = {};
  h.dados = {
    gameDay: {
      title: 'Sábado', format: 'play', play_courts: 2, play_groups: GRUPOS, play_groups_policy: 'queue',
    },
    participants: [],
    games: [],
  };
  h.getDoc.mockImplementation(async () => ({ exists: () => true, id: 'gd1', data: () => h.dados.gameDay }));
  h.getDocs.mockImplementation(async (arg) => {
    const path = arg?.path || arg?.c?.path || [];
    if (path.includes('games')) return snap(h.dados.games);
    if (path.includes('participants')) return snap(h.dados.participants);
    return snap([]);
  });
});

const jogosGravados = () => h.batchSet.mock.calls
  .filter(([ref]) => ref?.sub === 'games')
  .map(([, dados]) => dados);
const idsDe = (jogo) => [...jogo.side_a, ...jogo.side_b].map((p) => p.id).sort();

describe('⭐ flag desligada = o Play de sempre', () => {
  it('com grupos gravados no dia, ignora todos eles', async () => {
    h.flags = {};
    h.dados.participants = [
      ...['a1', 'a2'].map((id, i) => pessoa(id, i, { play_group_id: 'a' })),
      ...['b1', 'b2'].map((id, i) => pessoa(id, 2 + i, { play_group_id: 'b' })),
    ];
    const r = await createNextPlayGame('gd1', ACTOR, { court: 1 });
    expect(r.groupId).toBeUndefined();
    const [jogo] = jogosGravados();
    expect(idsDe(jogo)).toEqual(['a1', 'a2', 'b1', 'b2']); // grupos misturados, como antes
    expect('group_id' in jogo).toBe(false);
  });

  it('dia que não é Play também ignora', async () => {
    h.dados.gameDay.format = 'americano';
    h.dados.participants = [...grupo('a', ['a1', 'a2']), ...grupo('b', ['b1', 'b2'])]
      .map((p, i) => ({ ...p, available_since: 100 + i }));
    const [jogo] = (await createNextPlayGame('gd1', ACTOR, { court: 1 }), jogosGravados());
    expect('group_id' in jogo).toBe(false);
  });
});

describe('⭐ a partida sai do grupo', () => {
  beforeEach(() => {
    h.dados.participants = [
      ...['a1', 'a2', 'a3', 'a4'].map((id, i) => pessoa(id, i + 4, { play_group_id: 'a' })),
      ...['b1', 'b2', 'b3', 'b4'].map((id, i) => pessoa(id, i, { play_group_id: 'b' })),
    ];
  });

  it('pela política padrão, o grupo que espera há mais tempo; e a partida carrega o grupo', async () => {
    const r = await createNextPlayGame('gd1', ACTOR, { court: 1 });
    expect(r.groupId).toBe('b');
    const [jogo] = jogosGravados();
    expect(idsDe(jogo)).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(jogo).toMatchObject({ group_id: 'b', group_name: 'Beta', group_color: 'sky' });
  });

  it('o grupo escolhido à mão vence a política', async () => {
    const r = await createNextPlayGame('gd1', ACTOR, { court: 1, groupId: 'a' });
    expect(r.groupId).toBe('a');
    expect(idsDe(jogosGravados()[0])).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('revezamento: depois do grupo que jogou por último, o seguinte', async () => {
    h.dados.gameDay.play_groups_policy = 'rotate';
    h.dados.games = [{ id: 'g0', order: 9, group_id: 'b', status: 'finished', court: 1, side_a: [], side_b: [] }];
    const r = await createNextPlayGame('gd1', ACTOR, { court: 2 });
    expect(r.groupId).toBe('a');
  });

  it('a formação do grupo manda nas duplas: mista = homem + mulher de cada lado', async () => {
    h.dados.gameDay.play_groups = [{ id: 'm', name: 'Mistas', formation: 'mixed' }];
    h.dados.participants = [
      pessoa('h1', 0, { play_group_id: 'm', play_gender: 'male' }),
      pessoa('h2', 1, { play_group_id: 'm', play_gender: 'male' }),
      pessoa('f1', 2, { play_group_id: 'm', play_gender: 'female' }),
      pessoa('f2', 3, { play_group_id: 'm', play_gender: 'female' }),
    ];
    await createNextPlayGame('gd1', ACTOR, { court: 1 });
    const [jogo] = jogosGravados();
    const sexo = (p) => h.dados.participants.find((x) => x.id === p.id).play_gender;
    expect(new Set(jogo.side_a.map(sexo)).size).toBe(2);
    expect(new Set(jogo.side_b.map(sexo)).size).toBe(2);
  });

  it('mesmo sexo: cada dupla com o mesmo sexo', async () => {
    h.dados.gameDay.play_groups = [{ id: 's', name: 'Mesmo sexo', formation: 'same_sex' }];
    h.dados.participants = [
      pessoa('h1', 0, { play_group_id: 's', play_gender: 'male' }),
      pessoa('f1', 1, { play_group_id: 's', play_gender: 'female' }),
      pessoa('h2', 2, { play_group_id: 's', play_gender: 'male' }),
      pessoa('f2', 3, { play_group_id: 's', play_gender: 'female' }),
    ];
    await createNextPlayGame('gd1', ACTOR, { court: 1 });
    const [jogo] = jogosGravados();
    const sexo = (p) => h.dados.participants.find((x) => x.id === p.id).play_gender;
    expect(new Set(jogo.side_a.map(sexo)).size).toBe(1);
    expect(new Set(jogo.side_b.map(sexo)).size).toBe(1);
  });
});

describe('⭐ quando nenhum grupo joga, o erro diz por quê', () => {
  it('lista o motivo de cada grupo com gente esperando', async () => {
    h.dados.gameDay.play_groups = [
      { id: 'a', name: 'Alfa' },
      { id: 'm', name: 'Mistas', formation: 'mixed', strict: true },
    ];
    h.dados.participants = [
      pessoa('a1', 0, { play_group_id: 'a' }),
      ...['h1', 'h2', 'h3', 'h4'].map((id, i) => pessoa(id, 1 + i, { play_group_id: 'm', play_gender: 'male' })),
    ];
    await expect(createNextPlayGame('gd1', ACTOR, { court: 1 }))
      .rejects.toThrow(/Nenhum grupo tem partida pronta.*Alfa.*Mistas.*mulher/s);
    expect(h.batchCommit).not.toHaveBeenCalled();
  });

  it('o grupo escolhido à mão que não fecha partida diz o motivo dele (e não troca por outro)', async () => {
    h.dados.participants = [
      ...grupo('a', ['a1', 'a2']),
      ...['b1', 'b2', 'b3', 'b4'].map((id, i) => pessoa(id, 10 + i, { play_group_id: 'b' })),
    ];
    await expect(createNextPlayGame('gd1', ACTOR, { court: 1, groupId: 'a' })).rejects.toThrow(/Alfa.*Faltam 2/s);
    expect(h.batchCommit).not.toHaveBeenCalled();
  });
});

describe('a regra de nível usa o nível unificado', () => {
  it('só junta quem está dentro da diferença exigida (nível buscado antes de escolher)', async () => {
    h.dados.gameDay.play_groups = [{ id: 'n', name: 'Nível', max_level_gap: 0.5, strict: true }];
    h.dados.participants = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id, i) => pessoa(id, i, { play_group_id: 'n' }));
    h.levels = { p1: 3.0, p2: 5.0, p3: 3.2, p4: 3.4, p5: 3.3 };
    await createNextPlayGame('gd1', ACTOR, { court: 1 });
    expect(idsDe(jogosGravados()[0])).toEqual(['p1', 'p3', 'p4', 'p5']);
  });

  it('sem conseguir buscar o nível, cai no declarado e a criação segue', async () => {
    h.dados.gameDay.play_groups = [{ id: 'n', name: 'Nível', max_level_gap: 0.5, strict: true }];
    h.dados.participants = [
      pessoa('p1', 0, { play_group_id: 'n', play_level: 3.0 }),
      pessoa('p2', 1, { play_group_id: 'n', play_level: 3.1 }),
      pessoa('p3', 2, { play_group_id: 'n', play_level: 3.2 }),
      pessoa('p4', 3, { play_group_id: 'n', play_level: 3.3 }),
    ];
    await createNextPlayGame('gd1', ACTOR, { court: 1 });
    expect(jogosGravados()).toHaveLength(1);
  });
});

describe('a rodada com grupos', () => {
  beforeEach(() => {
    h.dados.participants = [
      ...['a1', 'a2', 'a3', 'a4'].map((id, i) => pessoa(id, i, { play_group_id: 'a' })),
      ...['b1', 'b2', 'b3', 'b4'].map((id, i) => pessoa(id, 10 + i, { play_group_id: 'b' })),
    ];
  });

  it('cada quadra livre recebe a partida de um grupo, num lote só', async () => {
    const r = await createPlayRoundForFreeCourts('gd1', ACTOR);
    expect(r.courts).toEqual([1, 2]);
    const jogos = jogosGravados();
    expect(jogos).toHaveLength(2);
    expect(jogos.map((j) => j.group_id).sort()).toEqual(['a', 'b']);
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
  });

  it('o grupo escolhido à mão para uma quadra vale na rodada', async () => {
    await createPlayRoundForFreeCourts('gd1', ACTOR, { courtGroups: { 1: 'b', 2: 'a' } });
    const q = (n) => jogosGravados().find((j) => j.court === n);
    expect(q(1).group_id).toBe('b');
    expect(q(2).group_id).toBe('a');
  });

  it('com a flag desligada a rodada não grava grupo nenhum', async () => {
    h.flags = {};
    await createPlayRoundForFreeCourts('gd1', ACTOR);
    jogosGravados().forEach((j) => expect('group_id' in j).toBe(false));
  });
});

describe('a partida montada à mão', () => {
  it('leva o grupo quando os quatro são dele', async () => {
    h.dados.participants = grupo('a', ['a1', 'a2', 'a3', 'a4']);
    await createManualPlayGame('gd1', { court: 1, sideAIds: ['a1', 'a2'], sideBIds: ['a3', 'a4'] }, ACTOR);
    expect(jogosGravados()[0]).toMatchObject({ group_id: 'a', group_name: 'Alfa' });
  });

  it('gente de grupos diferentes: sem grupo (é uma partida mista, no sentido de grupos)', async () => {
    h.dados.participants = [...grupo('a', ['a1', 'a2']), ...grupo('b', ['b1', 'b2'])];
    await createManualPlayGame('gd1', { court: 1, sideAIds: ['a1', 'b1'], sideBIds: ['a2', 'b2'] }, ACTOR);
    expect('group_id' in jogosGravados()[0]).toBe(false);
  });

  it('dia sem grupos: o jogo é gravado exatamente como antes', async () => {
    h.dados.gameDay = { title: 'x', format: 'play', play_courts: 1 };
    h.dados.participants = ['a1', 'a2', 'a3', 'a4'].map((id, i) => pessoa(id, i));
    await createManualPlayGame('gd1', { court: 1, sideAIds: ['a1', 'a2'], sideBIds: ['a3', 'a4'] }, ACTOR);
    expect('group_id' in jogosGravados()[0]).toBe(false);
  });
});

describe('⭐ substituição prefere o mesmo grupo e nunca trava', () => {
  const jogo = {
    id: 'g1', court: 1, status: 'open', group_id: 'a', order: 1,
    side_a: [{ id: 'a1' }, { id: 'a2' }], side_b: [{ id: 'a3' }, { id: 'a4' }],
  };
  const atualizacaoDoJogo = () => h.batchUpdate.mock.calls
    .find(([ref]) => ref?.sub === 'games')?.[1];

  it('entra o próximo DO GRUPO, mesmo havendo alguém de outro grupo esperando há mais tempo', async () => {
    h.dados.games = [jogo];
    h.dados.participants = [
      ...grupo('a', ['a1', 'a2', 'a3', 'a4']),
      pessoa('b1', 0, { play_group_id: 'b' }), // espera mais
      pessoa('a5', 5, { play_group_id: 'a' }),
    ];
    const r = await noShowSwapPlayGame('gd1', 'g1', 'a1', ACTOR);
    expect(r.replacedBy).toBe('a5');
    expect(atualizacaoDoJogo().side_a.map((p) => p.id)).toContain('a5');
  });

  it('sem ninguém do grupo esperando, entra o próximo da ordem (não trava)', async () => {
    h.dados.games = [jogo];
    h.dados.participants = [...grupo('a', ['a1', 'a2', 'a3', 'a4']), pessoa('b1', 0, { play_group_id: 'b' })];
    const r = await noShowSwapPlayGame('gd1', 'g1', 'a1', ACTOR);
    expect(r.replacedBy).toBe('b1');
  });

  it('partida sem grupo: o comportamento de sempre', async () => {
    h.dados.games = [{ ...jogo, group_id: undefined }];
    h.dados.participants = [
      ...grupo('a', ['a1', 'a2', 'a3', 'a4']),
      pessoa('b1', 0, { play_group_id: 'b' }),
      pessoa('a5', 5, { play_group_id: 'a' }),
    ];
    const r = await noShowSwapPlayGame('gd1', 'g1', 'a1', ACTOR);
    expect(r.replacedBy).toBe('b1');
  });
});

describe('setPlayGroups — configurar', () => {
  it('grava os grupos normalizados e a política, e audita', async () => {
    const r = await setPlayGroups('gd1', {
      groups: [{ id: 'a', name: '  Avançados ', level_min: 4 }], policy: 'rotate',
    }, ACTOR);
    expect(r.play_groups[0]).toMatchObject({ id: 'a', name: 'Avançados', level_min: 4 });
    expect(h.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ play_groups_policy: 'rotate', updated_at: 'ts' }),
    );
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'game_day_play_groups_set' }));
  });

  it('recusa configuração inválida sem escrever nada', async () => {
    await expect(setPlayGroups('gd1', { groups: [{ id: 'a', name: 'X' }, { id: 'b', name: 'x' }] }, ACTOR))
      .rejects.toThrow(/mesmo nome/);
    expect(h.updateDoc).not.toHaveBeenCalled();
  });

  it('limpa o grupo de quem estava num grupo removido (higiene; a leitura já tratava como "sem grupo")', async () => {
    h.dados.participants = [
      ...grupo('a', ['a1']), ...grupo('b', ['b1']), pessoa('u1', 5),
    ];
    await setPlayGroups('gd1', { groups: [{ id: 'a', name: 'Alfa' }] }, ACTOR);
    const limpos = h.batchUpdate.mock.calls
      .filter(([ref, dados]) => ref?.sub === 'participants' && dados.play_group_id === null)
      .map(([ref]) => ref.subId);
    expect(limpos).toEqual(['b1']);
  });

  it('lista vazia desliga os grupos do dia', async () => {
    await setPlayGroups('gd1', { groups: [] }, ACTOR);
    expect(h.updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ play_groups: [] }));
  });

  it('dia que não existe', async () => {
    h.getDoc.mockResolvedValue({ exists: () => false });
    await expect(setPlayGroups('nada', { groups: [] }, ACTOR)).rejects.toThrow(/não encontrado/);
  });
});

describe('setPlayParticipantGroup — mover alguém', () => {
  beforeEach(() => {
    h.dados.participants = [
      pessoa('p1', 0, { play_group_id: 'a', partner_id: 'p2' }),
      pessoa('p2', 1, { play_group_id: 'a', partner_id: 'p1' }),
      pessoa('p3', 2),
    ];
  });
  const gravados = () => h.batchUpdate.mock.calls
    .filter(([ref]) => ref?.sub === 'participants')
    .map(([ref, dados]) => [ref.subId, dados.play_group_id]);

  it('muda o grupo — e leva a dupla vinculada junto', async () => {
    const r = await setPlayParticipantGroup('gd1', 'p1', 'b', ACTOR);
    expect(r.moved.sort()).toEqual(['p1', 'p2']);
    expect(gravados().sort()).toEqual([['p1', 'b'], ['p2', 'b']]);
  });

  it('sem dupla, só a pessoa', async () => {
    const r = await setPlayParticipantGroup('gd1', 'p3', 'b', ACTOR);
    expect(r.moved).toEqual(['p3']);
  });

  it('null tira do grupo', async () => {
    await setPlayParticipantGroup('gd1', 'p3', null, ACTOR);
    expect(gravados()).toEqual([['p3', null]]);
  });

  it('grupo que não existe é recusado', async () => {
    await expect(setPlayParticipantGroup('gd1', 'p3', 'zzz', ACTOR)).rejects.toThrow(/não existe/);
    expect(h.batchCommit).not.toHaveBeenCalled();
  });

  it('participante que não existe', async () => {
    await expect(setPlayParticipantGroup('gd1', 'fantasma', 'a', ACTOR)).rejects.toThrow(/não encontrado/);
  });

  it('a própria pessoa não entra num grupo FECHADO', async () => {
    h.dados.gameDay.play_groups = [{ id: 'a', name: 'A' }, { id: 'f', name: 'Fechado', join: 'closed' }];
    await expect(setPlayParticipantGroup('gd1', 'p3', 'f', ACTOR, { self: true })).rejects.toThrow(/organização/);
    await expect(setPlayParticipantGroup('gd1', 'p3', 'f', ACTOR)).resolves.toBeTruthy(); // a organização pode
  });
});

describe('assignPlayGroups — distribuir', () => {
  it('grava todas as atribuições num lote e conta', async () => {
    h.dados.participants = ['p1', 'p2', 'p3'].map((id, i) => pessoa(id, i));
    const r = await assignPlayGroups('gd1', [
      { pid: 'p1', groupId: 'a' }, { pid: 'p2', groupId: 'b' }, { pid: 'p3', groupId: null },
    ], ACTOR);
    expect(r).toEqual({ updated: 3 });
    expect(h.batchUpdate).toHaveBeenCalledTimes(3);
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'game_day_play_groups_assigned' }));
  });

  it('um grupo que não existe derruba a operação inteira, sem gravar nada', async () => {
    await expect(assignPlayGroups('gd1', [{ pid: 'p1', groupId: 'a' }, { pid: 'p2', groupId: 'zzz' }], ACTOR))
      .rejects.toThrow(/não existe/);
    expect(h.batchCommit).not.toHaveBeenCalled();
  });

  it('lista vazia não escreve', async () => {
    expect(await assignPlayGroups('gd1', [], ACTOR)).toEqual({ updated: 0 });
    expect(h.batchCommit).not.toHaveBeenCalled();
  });
});

describe('o grupo de quem chega', () => {
  const dia = {
    format: 'play',
    play_groups: [
      { id: 'ini', name: 'Iniciantes', level_min: 2, level_max: 3.5 },
      { id: 'ava', name: 'Avançados', level_min: 3.5, level_max: 8, join: 'closed' },
    ],
  };

  it('buildGameDayParticipant só grava play_group_id quando ele foi informado', () => {
    expect('play_group_id' in buildGameDayParticipant('p', { name: 'X' })).toBe(false);
    expect(buildGameDayParticipant('p', { name: 'X', play_group_id: 'a' }).play_group_id).toBe('a');
    expect(buildGameDayParticipant('p', { name: 'X', play_group_id: null }).play_group_id).toBeNull();
  });

  it('resolveEntryGroup põe no grupo aberto do nível declarado', async () => {
    expect(await resolveEntryGroup(dia, { id: 'p', play_level: 3 })).toBe('ini');
  });

  it('usa o nível unificado de quem tem conta', async () => {
    h.levels = { p: 3 };
    expect(await resolveEntryGroup(dia, { id: 'p', user_id: 'u', play_level: 6 })).toBe('ini');
  });

  it('nunca põe sozinho num grupo fechado, e sem nível fica sem grupo', async () => {
    expect(await resolveEntryGroup(dia, { id: 'p', play_level: 6 })).toBeNull();
    expect(await resolveEntryGroup(dia, { id: 'p' })).toBeNull();
  });

  it('flag desligada ou dia que não é Play: nada', async () => {
    h.flags = {};
    expect(await resolveEntryGroup(dia, { id: 'p', play_level: 3 })).toBeNull();
    h.flags = { play_groups: true };
    expect(await resolveEntryGroup({ ...dia, format: 'americano' }, { id: 'p', play_level: 3 })).toBeNull();
  });

  it('addGameDayParticipant grava o grupo sozinho quando quem chama traz o dia COM grupos', async () => {
    await addGameDayParticipant('gd1', { name: 'Ana', play_level: 3 }, ACTOR, { gameDay: dia });
    const [, doc] = h.setDoc.mock.calls[0];
    expect(doc.play_group_id).toBe('ini');
  });

  it('o organizador escolheu "sem grupo" (null): respeita', async () => {
    await addGameDayParticipant('gd1', { name: 'Ana', play_level: 3, play_group_id: null }, ACTOR, { gameDay: dia });
    expect(h.setDoc.mock.calls[0][1].play_group_id).toBeNull();
  });

  it('dia sem grupos: o participante é gravado como sempre (sem o campo)', async () => {
    await addGameDayParticipant('gd1', { name: 'Ana', play_level: 3 }, ACTOR, { gameDay: { format: 'play' } });
    expect('play_group_id' in h.setDoc.mock.calls[0][1]).toBe(false);
  });

  it('⭐ o caminho de sempre NÃO lê nada a mais: sem o dia em mãos, nem o dia nem as flags são consultados', async () => {
    // Inserir 20 atletas não pode custar 40 leituras só porque os grupos existem.
    const lerFlags = vi.fn();
    h.getDoc.mockClear();
    Object.defineProperty(h.flags, 'play_groups', { get: () => { lerFlags(); return true; }, configurable: true });
    await addGameDayParticipant('gd1', { name: 'Ana', play_level: 3 }, ACTOR);
    // A única leitura é a do espelho do jogo aberto, que já existia antes dos
    // grupos: os grupos não acrescentaram nenhuma.
    expect(h.getDoc).toHaveBeenCalledTimes(1);
    expect(lerFlags).not.toHaveBeenCalled();
    expect('play_group_id' in h.setDoc.mock.calls[0][1]).toBe(false);
  });

  it('dia SEM grupos também não consulta as flags, mesmo com o dia em mãos', async () => {
    const lerFlags = vi.fn();
    Object.defineProperty(h.flags, 'play_groups', { get: () => { lerFlags(); return true; }, configurable: true });
    await addGameDayParticipant('gd1', { name: 'Ana', play_level: 3 }, ACTOR, { gameDay: { format: 'play' } });
    expect(lerFlags).not.toHaveBeenCalled();
  });

  it('falha ao descobrir o grupo não impede a entrada', async () => {
    Object.defineProperty(h.flags, 'play_groups', { get: () => { throw new Error('rede'); }, configurable: true });
    await expect(addGameDayParticipant('gd1', { name: 'Ana', play_level: 3 }, ACTOR, { gameDay: dia })).resolves.toBeTruthy();
    expect('play_group_id' in h.setDoc.mock.calls[0][1]).toBe(false);
  });
});
