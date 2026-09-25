/**
 * O jogo aberto que é um dia de jogo (Onda CA) — o serviço, contra um banco
 * falso em memória.
 *
 * O que protege:
 *  1. ⭐ publicar grava a vitrine E o dia de jogo no MESMO lote, apontando um
 *     para o outro, e o dia de jogo fecha as quadras no calendário;
 *  2. ⭐ entrar grava vitrine, participante e membro num lote só; sair desfaz
 *     os três — a arena nunca vê 4 inscritos numa tela e 3 na outra;
 *  3. ⭐ o convidado que a arena inseriu ocupa lugar: ninguém entra além do teto;
 *  4. editar: vagas abaixo de quem já entrou, não; formato depois de partida,
 *     não; o resto muda nos dois;
 *  5. ⭐ cancelar arquiva o dia de jogo, libera as quadras e AVISA quem estava
 *     dentro (antes o diálogo dizia "serão avisados" e ninguém era);
 *  6. ⭐ marcar presença pelo lado do dia de jogo é entrar no jogo aberto;
 *  7. a arena inserindo alguém pela tela do dia de jogo: a vitrine espelha.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const banco = new Map();
const lotes = [];
let seq = 0;

function aplicar(atual = {}, patch = {}) {
  const novo = { ...atual };
  Object.entries(patch).forEach(([k, v]) => {
    if (v && v._union) novo[k] = [...new Set([...(atual[k] || []), ...v._union])];
    else if (v && v._remove) novo[k] = (atual[k] || []).filter((x) => !v._remove.includes(x));
    else novo[k] = v;
  });
  return novo;
}
const ref = (path) => ({ _path: path, id: path.split('/').pop() });
const filhos = (col) => [...banco.entries()]
  .filter(([k]) => k.startsWith(`${col}/`) && !k.slice(col.length + 1).includes('/'))
  .map(([k, v]) => ({ id: k.split('/').pop(), ref: ref(k), data: () => v }));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
const avisos = [];
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn((uids, msg) => { avisos.push({ uids, msg }); return Promise.resolve(); }),
  NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));
vi.mock('@/modules/rating/services/unifiedLevelService.js', () => ({
  fetchUnifiedLevelValues: vi.fn(async () => ({})),
  fetchUnifiedLevelsByParticipant: vi.fn(async () => ({})),
}));
vi.mock('@/modules/rating/services/unifiedLevelService', () => ({
  fetchUnifiedLevelValues: vi.fn(async () => ({})),
  fetchUnifiedLevelsByParticipant: vi.fn(async () => ({})),
}));
vi.mock('./arenaService.js', () => ({
  getArena: vi.fn(async (id) => ({ id, name: 'Arena Sol', city: 'Porto Alegre', state: 'RS' })),
  listArenaManagerIds: vi.fn(async () => ['gestor']),
}));
vi.mock('./arenaOccupancy.js', () => ({ arenaOccupancy: vi.fn(async () => []) }));

vi.mock('firebase/firestore', () => ({
  collection: (_db, ...segs) => ({ _col: segs.join('/') }),
  doc: (a, ...segs) => {
    if (a && a._col && segs.length === 0) { seq += 1; return ref(`${a._col}/auto${seq}`); }
    if (a && a._col) return ref(`${a._col}/${segs[0]}`);
    return ref(segs.join('/'));
  },
  getDoc: async (r) => ({ id: r.id, exists: () => banco.has(r._path), data: () => banco.get(r._path) }),
  getDocs: async (q) => {
    const col = q._col || q.col?._col;
    const filtros = (q.filtros || []).filter(Boolean);
    const docs = filhos(col).filter((d) => filtros.every((f) => (
      f.op === 'array-contains' ? (d.data()[f.f] || []).includes(f.v) : d.data()[f.f] === f.v
    )));
    return { docs, empty: docs.length === 0, size: docs.length };
  },
  query: (col, ...filtros) => ({ col, filtros }),
  where: (f, op, v) => ({ f, op, v }),
  limit: () => null,
  orderBy: () => null,
  setDoc: async (r, data) => { banco.set(r._path, data); },
  updateDoc: async (r, patch) => {
    if (!banco.has(r._path)) throw new Error(`não existe: ${r._path}`);
    banco.set(r._path, aplicar(banco.get(r._path), patch));
  },
  deleteDoc: async (r) => { banco.delete(r._path); },
  writeBatch: () => {
    const ops = [];
    return {
      set: (r, data) => ops.push(['set', r._path, data]),
      update: (r, patch) => ops.push(['update', r._path, patch]),
      delete: (r) => ops.push(['delete', r._path]),
      commit: async () => {
        lotes.push(ops.map(([t, p]) => `${t}:${p}`));
        ops.forEach(([t, p, d]) => {
          if (t === 'set') banco.set(p, d);
          else if (t === 'delete') banco.delete(p);
          else banco.set(p, aplicar(banco.get(p), d));
        });
      },
    };
  },
  serverTimestamp: () => 'agora',
  arrayUnion: (...v) => ({ _union: v }),
  arrayRemove: (...v) => ({ _remove: v }),
  increment: (n) => n,
}));

const svc = await import('./openMatchService.js');
const { signUpToArenaGameDay } = await import('@/modules/games/services/arenaGameDayService.js');
const { addGameDayParticipant } = await import('@/modules/games/services/gameDayService.js');

const GESTOR = { uid: 'gestor', displayName: 'Gestora' };
const ANA = { uid: 'ana', displayName: 'Ana' };
const COURTS = [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }];
const AMANHA = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const INPUT = {
  date: AMANHA, start: '19:00', end: '21:00', total_spots: 4, format: 'duplas',
  court_ids: ['q1', 'q2'], game_format: 'americano', price: 20,
};

async function publicar(over = {}) {
  return svc.createOpenMatch('A', { ...INPUT, ...over }, GESTOR, { courts: COURTS });
}
const participantes = (gdId) => filhos(`game_days/${gdId}/participants`).map((d) => d.data());
const bloqueios = (gdId) => filhos('arena_unavailabilities').map((d) => d.data()).filter((b) => b.game_day_id === gdId);

beforeEach(() => {
  banco.clear();
  lotes.length = 0;
  avisos.length = 0;
  seq = 0;
});

describe('⭐ publicar: vitrine + dia de jogo, num lote', () => {
  it('os dois nascem juntos e apontam um para o outro', async () => {
    const { slotId, gameDayId } = await publicar();
    expect(lotes[0]).toEqual([`set:game_days/${gameDayId}`, `set:arena_open_slots/${slotId}`]);
    const gd = banco.get(`game_days/${gameDayId}`);
    const slot = banco.get(`arena_open_slots/${slotId}`);
    expect(gd).toMatchObject({
      open_slot_id: slotId, arena_id: 'A', visibility: 'public', format: 'americano',
      capacity: 4, signup_mode: 'day', play_courts: 2, created_by: 'gestor', member_uids: ['gestor'],
    });
    expect(slot).toMatchObject({
      game_day_id: gameDayId, game_format: 'americano', court_ids: ['q1', 'q2'], court_id: 'q1',
      total_spots: 4, participants: [], status: 'open',
    });
  });

  it('o dia de jogo fecha as DUAS quadras no calendário', async () => {
    const { gameDayId } = await publicar();
    expect(bloqueios(gameDayId).map((b) => b.court_id).sort()).toEqual(['q1', 'q2']);
  });

  it('em cima de uma reserva que a tela conhece, recusa dizendo o horário', async () => {
    await expect(svc.createOpenMatch('A', INPUT, GESTOR, {
      courts: COURTS,
      bookings: [{ status: 'confirmed', court_id: 'q2', slots: [{ date: AMANHA, start: '20:00', end: '21:00' }] }],
    })).rejects.toThrow(/Já existe uma reserva nessa quadra das 20:00 às 21:00/);
    expect(banco.size).toBe(0);
  });

  it('sem quadra, não publica', async () => {
    await expect(publicar({ court_ids: [] })).rejects.toThrow(/pelo menos uma quadra/);
  });
});

describe('⭐ entrar e sair: as duas listas no mesmo lote', () => {
  it('entrar grava vitrine, participante e membro juntos', async () => {
    const { slotId, gameDayId } = await publicar();
    lotes.length = 0;
    await svc.joinOpenSlot(slotId, ANA, { platform_name: 'Ana Souza' });
    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toHaveLength(3);
    expect(banco.get(`arena_open_slots/${slotId}`)).toMatchObject({ participants: ['ana'], filled_spots: 1, status: 'open' });
    expect(participantes(gameDayId)).toEqual([expect.objectContaining({ user_id: 'ana', name: 'Ana Souza', source: 'joined' })]);
    expect(banco.get(`game_days/${gameDayId}`).member_uids).toEqual(['gestor', 'ana']);
  });

  it('sair desfaz os três — e a arena continua membro do próprio dia', async () => {
    const { slotId, gameDayId } = await publicar();
    await svc.joinOpenSlot(slotId, ANA, {});
    lotes.length = 0;
    await svc.leaveOpenSlot(slotId, 'ana');
    expect(lotes).toHaveLength(1);
    expect(banco.get(`arena_open_slots/${slotId}`)).toMatchObject({ participants: [], filled_spots: 0 });
    expect(participantes(gameDayId)).toEqual([]);
    expect(banco.get(`game_days/${gameDayId}`).member_uids).toEqual(['gestor']);
  });

  it('⭐ o convidado da arena ocupa lugar: ninguém entra além do teto', async () => {
    const { slotId, gameDayId } = await publicar({ total_spots: 2 });
    await svc.joinOpenSlot(slotId, ANA, {});
    banco.set(`game_days/${gameDayId}/participants/conv`, { id: 'conv', user_id: null, name: 'Convidado' });
    await expect(svc.joinOpenSlot(slotId, { uid: 'bia' }, {})).rejects.toThrow(/vagas deste jogo acabaram/);
  });

  it('dia de jogo encerrado não recebe ninguém', async () => {
    const { slotId, gameDayId } = await publicar();
    banco.set(`game_days/${gameDayId}`, { ...banco.get(`game_days/${gameDayId}`), status: 'archived' });
    await expect(svc.joinOpenSlot(slotId, ANA, {})).rejects.toThrow(/encerrado/);
  });
});

describe('editar', () => {
  it('muda a vitrine e o dia de jogo juntos', async () => {
    const { slotId, gameDayId } = await publicar();
    await svc.updateOpenMatch(slotId, { ...INPUT, start: '20:00', end: '22:00', court_ids: ['q1'], total_spots: 6, game_format: 'play' }, GESTOR, { courts: COURTS });
    expect(banco.get(`arena_open_slots/${slotId}`)).toMatchObject({ start: '20:00', end: '22:00', court_ids: ['q1'], total_spots: 6, game_format: 'play' });
    expect(banco.get(`game_days/${gameDayId}`)).toMatchObject({ format: 'play', capacity: 6, play_courts: 1 });
    expect(bloqueios(gameDayId)).toEqual([expect.objectContaining({ court_id: 'q1', start_time: '20:00', end_time: '22:00' })]);
  });

  it('vagas abaixo de quem já entrou, não', async () => {
    const { slotId } = await publicar({ total_spots: 4 });
    await svc.joinOpenSlot(slotId, ANA, {});
    await svc.joinOpenSlot(slotId, { uid: 'bia' }, {});
    await svc.joinOpenSlot(slotId, { uid: 'caio' }, {});
    await expect(svc.updateOpenMatch(slotId, { ...INPUT, total_spots: 2 }, GESTOR, { courts: COURTS }))
      .rejects.toThrow(/Já há 3 inscrito/);
  });

  it('o formato não muda depois que há partida', async () => {
    const { slotId, gameDayId } = await publicar();
    banco.set(`game_days/${gameDayId}/games/g1`, { id: 'g1', side_a: [], side_b: [] });
    await expect(svc.updateOpenMatch(slotId, { ...INPUT, game_format: 'mexicano' }, GESTOR, { courts: COURTS }))
      .rejects.toThrow(/formato não muda mais/);
  });
});

describe('⭐ cancelar', () => {
  it('arquiva o dia de jogo, libera as quadras e avisa quem estava dentro', async () => {
    const { slotId, gameDayId } = await publicar();
    await svc.joinOpenSlot(slotId, ANA, {});
    avisos.length = 0;
    await svc.cancelOpenSlot(slotId, 'chuva', GESTOR);
    expect(banco.get(`arena_open_slots/${slotId}`).status).toBe('cancelled');
    expect(banco.get(`game_days/${gameDayId}`).status).toBe('archived');
    expect(bloqueios(gameDayId)).toEqual([]);
    expect(avisos).toEqual([expect.objectContaining({ uids: ['ana'] })]);
    expect(avisos[0].msg.title).toBe('Jogo aberto cancelado');
  });
});

describe('o outro lado: o dia de jogo', () => {
  it('⭐ marcar presença no dia de jogo é entrar no jogo aberto', async () => {
    const { slotId, gameDayId } = await publicar();
    await signUpToArenaGameDay({ id: gameDayId }, ANA, {});
    expect(banco.get(`arena_open_slots/${slotId}`).participants).toEqual(['ana']);
    expect(participantes(gameDayId)).toHaveLength(1);
  });

  it('a arena inserindo alguém pela tela do dia de jogo: a vitrine espelha', async () => {
    const { slotId, gameDayId } = await publicar({ total_spots: 2 });
    await addGameDayParticipant(gameDayId, { user_id: 'bia', name: 'Bia' }, GESTOR);
    expect(banco.get(`arena_open_slots/${slotId}`)).toMatchObject({ participants: ['bia'], filled_spots: 1, status: 'open' });
    await addGameDayParticipant(gameDayId, { name: 'Convidado' }, GESTOR);
    // O convidado não vira uid na vitrine, mas ocupa o último lugar: lotado.
    expect(banco.get(`arena_open_slots/${slotId}`)).toMatchObject({ participants: ['bia'], status: 'full' });
  });
});
