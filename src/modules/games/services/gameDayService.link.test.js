import { describe, it, expect, vi, beforeEach } from 'vitest';

// VÍNCULO do dia de jogo a clube/arena (`domain/gameDayLink.js`): o serviço
// valida, força público, audita e regrava o espelho do ranking. Só o I/O é
// mockado; o domínio roda de verdade.
const h = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  batches: [],
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  serverTs: Symbol('ts'),
}));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('@/core/services/notificationService', () => ({ notifyUsers: vi.fn(), NOTIFICATION_TYPE: {} }));
vi.mock('@/modules/rating/services/ratingService', () => ({ maybeAutoRecomputeRatings: vi.fn() }));
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
  writeBatch: vi.fn(() => {
    const ops = [];
    const b = {
      set: (ref, data) => ops.push(['set', ref.id, data]),
      delete: (ref) => ops.push(['delete', ref.id]),
      update: (ref, data) => ops.push(['update', ref.id, data]),
      commit: vi.fn(async () => {}),
      ops,
    };
    h.batches.push(b);
    return b;
  }),
}));

const {
  updateGameDay, syncGameDayRankingIfPublished, listClubLinkedGameDays, listArenaLinkedGameDays,
} = await import('./gameDayService.js');

const ACTOR = { uid: 'owner1' };
const diaDoAtleta = (extra = {}) => ({
  title: 'Sábado', visibility: 'public', created_by: 'owner1', open_game_id: 'og1', date: '2026-11-01', ...extra,
});
const existe = (id, data) => ({ exists: () => true, id, data: () => data });
const patchGravado = () => h.updateDoc.mock.calls.find((c) => c[0].col === 'game_days')?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  h.batches.length = 0;
  h.updateDoc.mockResolvedValue(undefined);
});

describe('updateGameDay — vínculo', () => {
  it('⭐ vincula: grava os quatro campos, força público e audita', async () => {
    h.getDoc.mockResolvedValue(existe('gd1', diaDoAtleta({ visibility: 'private', open_game_id: null })));
    h.getDocs.mockResolvedValue({ docs: [] });
    // (privado → público cria o convite; este teste só olha o dia)
    await updateGameDay('gd1', {
      link_club_id: 'c1', link_club_name: 'Clube Norte', link_arena_id: null, link_arena_name: null,
    }, ACTOR).catch(() => {});

    const patch = patchGravado();
    expect(patch).toMatchObject({
      link_club_id: 'c1', link_club_name: 'Clube Norte', link_arena_id: null, link_arena_name: null,
      visibility: 'public',
    });
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'game_day_linked',
      details: expect.objectContaining({ game_day_id: 'gd1', club_id: 'c1', previous_club_id: null }),
    }));
  });

  it('dia que já é de uma arena (ou clube) não aceita vínculo', async () => {
    h.getDoc.mockResolvedValue(existe('gd1', diaDoAtleta({ arena_id: 'a1' })));
    await expect(updateGameDay('gd1', { link_club_id: 'c1' }, ACTOR)).rejects.toThrow(/não aceita vínculo/);
    expect(h.updateDoc).not.toHaveBeenCalled();

    h.getDoc.mockResolvedValue(existe('gd1', diaDoAtleta({ club_id: 'c9' })));
    await expect(updateGameDay('gd1', { link_arena_id: 'a1' }, ACTOR)).rejects.toThrow(/não aceita vínculo/);
  });

  it('⭐ dia vinculado nunca vira privado enquanto durar o vínculo', async () => {
    h.getDoc.mockResolvedValue(existe('gd1', diaDoAtleta({ link_club_id: 'c1', link_club_name: 'Clube Norte' })));
    await updateGameDay('gd1', { title: 'Novo nome', visibility: 'private' }, ACTOR);
    const patch = patchGravado();
    expect(patch.title).toBe('Novo nome');
    expect('visibility' in patch).toBe(false);
  });

  it('desvincular audita e volta a permitir privado', async () => {
    h.getDoc.mockResolvedValue(existe('gd1', diaDoAtleta({ link_club_id: 'c1', link_club_name: 'Clube Norte' })));
    await updateGameDay('gd1', {
      link_club_id: null, link_club_name: null, link_arena_id: null, link_arena_name: null,
    }, ACTOR);
    expect(h.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'game_day_unlinked' }));
    expect(patchGravado()).toMatchObject({ link_club_id: null });
  });

  it('editar outra coisa não audita vínculo', async () => {
    h.getDoc.mockResolvedValue(existe('gd1', diaDoAtleta()));
    await updateGameDay('gd1', { title: 'Outro' }, ACTOR);
    expect(h.createAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'game_day_linked' }));
  });
});

describe('espelho do ranking quando o clube muda', () => {
  const jogo = {
    id: 'g1', round: 1, kind: 'doubles',
    side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }, { id: 'p2', name: 'Bia', user_id: 'u2' }],
    side_b: [{ id: 'p3', name: 'Caio', user_id: 'u3' }, { id: 'p4', name: 'Duda', user_id: 'u4' }],
    score_a: 11, score_b: 7,
  };
  const dia = (extra = {}) => ({ title: 'Sábado', publish_to_ranking: true, ...extra });
  const mirrorId = 'gd_gd1_g1';

  function bancoCom(espelhoClubId) {
    h.getDocs.mockImplementation((arg) => {
      const path = arg?.path || arg?.c?.path || [];
      if (path[0] === 'club_event_games') {
        return { docs: [{ id: mirrorId, data: () => ({ id: mirrorId, club_id: espelhoClubId, score_a: 11, score_b: 7, winner_side: 'a', kind: 'doubles', side_a_ids: ['u1', 'u2'], side_b_ids: ['u3', 'u4'] }) }] };
      }
      if (path.includes('games')) return { docs: [{ id: jogo.id, data: () => jogo }] };
      return { docs: [] };
    });
  }

  it('⭐ vincular a dia já publicado apaga o espelho antigo e recria com o clube vinculado', async () => {
    bancoCom(null);
    h.getDoc.mockResolvedValue(existe('gd1', dia({ link_club_id: 'c1', link_club_name: 'Clube Norte' })));
    const res = await syncGameDayRankingIfPublished('gd1', ACTOR);

    expect(res.synced).toBe(true);
    const todas = h.batches.flatMap((b) => b.ops);
    const apagou = todas.findIndex((o) => o[0] === 'delete' && o[1] === mirrorId);
    const gravou = todas.findIndex((o) => o[0] === 'set' && o[1] === mirrorId);
    expect(apagou).toBeGreaterThanOrEqual(0);
    expect(gravou).toBeGreaterThan(apagou);
    expect(todas[gravou][2].club_id).toBe('c1');
    // Dois lotes em sequência: o apagar precisa estar gravado antes do recriar.
    expect(h.batches.length).toBe(2);
  });

  it('espelho que já está no clube certo não é apagado (só atualiza o que mudou)', async () => {
    bancoCom('c1');
    h.getDoc.mockResolvedValue(existe('gd1', dia({ link_club_id: 'c1' })));
    const res = await syncGameDayRankingIfPublished('gd1', ACTOR);
    expect(res.synced).toBe(false); // nada mudou
    expect(h.batches.length).toBe(0);
  });

  it('desvincular volta o espelho para a inferência de sempre (apaga e recria sem clube)', async () => {
    bancoCom('c1');
    h.getDoc.mockResolvedValue(existe('gd1', dia()));
    await syncGameDayRankingIfPublished('gd1', ACTOR);
    const todas = h.batches.flatMap((b) => b.ops);
    expect(todas.some((o) => o[0] === 'delete' && o[1] === mirrorId)).toBe(true);
    expect(todas.find((o) => o[0] === 'set' && o[1] === mirrorId)[2].club_id).toBeNull();
  });
});

describe('listClubLinkedGameDays', () => {
  it('filtra o vínculo E a visibilidade pública (senão a regra recusa a consulta)', async () => {
    h.getDocs.mockResolvedValue({ docs: [] });
    await listClubLinkedGameDays('c1');
    const consulta = h.getDocs.mock.calls[0][0];
    const campos = consulta.rest.map((w) => `${w.field}${w.op}${w.value}`);
    expect(campos).toContain('link_club_id==c1');
    expect(campos).toContain('visibility==public');
  });

  it('arena: mesmos dois filtros, e o dia arquivado fica fora', async () => {
    h.getDocs.mockResolvedValue({
      docs: [
        { id: 'a', data: () => ({ date: '2026-11-01', status: 'active' }) },
        { id: 'b', data: () => ({ date: '2026-11-02', status: 'archived' }) },
      ],
    });
    const dias = await listArenaLinkedGameDays('a1');
    const campos = h.getDocs.mock.calls[0][0].rest.map((w) => `${w.field}${w.op}${w.value}`);
    expect(campos).toContain('link_arena_id==a1');
    expect(campos).toContain('visibility==public');
    expect(dias.map((d) => d.id)).toEqual(['a']);
  });

  it('sem id não consulta', async () => {
    expect(await listClubLinkedGameDays(null)).toEqual([]);
    expect(h.getDocs).not.toHaveBeenCalled();
  });
});
