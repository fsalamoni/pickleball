import { describe, it, expect } from 'vitest';
import {
  GAME_DAY_LINK_FIELDS, LINKED_VISIBILITY, buildLinkPatch, canLinkGameDay, gameDayLinks, isGuest,
  isLinkedGameDay, linkLabel, linkOptions, linkedArenaId, linkedClubId, splitGuests,
} from './gameDayLink.js';
import { buildGameDayMatch } from './gameDayRanking.js';

describe('gameDayLinks / isLinkedGameDay', () => {
  it('dia sem campos de vínculo não tem vínculo', () => {
    expect(isLinkedGameDay({ id: 'g1' })).toBe(false);
    expect(isLinkedGameDay(null)).toBe(false);
    expect(linkLabel({ id: 'g1' })).toBeNull();
  });

  it('nome solto sem id não vale vínculo', () => {
    expect(isLinkedGameDay({ link_club_name: 'Clube Norte' })).toBe(false);
  });

  it('lê clube, arena ou os dois', () => {
    const gd = { link_club_id: 'c1', link_club_name: 'Clube Norte', link_arena_id: 'a1', link_arena_name: 'Arena Sol' };
    expect(gameDayLinks(gd).club).toEqual({ id: 'c1', name: 'Clube Norte' });
    expect(linkedClubId(gd)).toBe('c1');
    expect(linkedArenaId(gd)).toBe('a1');
    expect(linkLabel(gd)).toBe('Clube Norte · Arena Sol');
  });

  it('id sem nome ganha um rótulo genérico', () => {
    expect(gameDayLinks({ link_club_id: 'c1' }).club.name).toBeTruthy();
  });
});

describe('canLinkGameDay', () => {
  it('só o dia do atleta aceita vínculo', () => {
    expect(canLinkGameDay({ id: 'g1', created_by: 'u1' })).toBe(true);
    expect(canLinkGameDay({ id: 'g1', arena_id: 'a1' })).toBe(false);
    expect(canLinkGameDay({ id: 'g1', club_id: 'c1' })).toBe(false);
    expect(canLinkGameDay({ id: 'g1', open_slot_id: 's1' })).toBe(false);
    expect(canLinkGameDay(null)).toBe(false);
  });
});

describe('buildLinkPatch', () => {
  it('sempre devolve os quatro campos (o lado não escolhido é apagado)', () => {
    const patch = buildLinkPatch({ club: { id: 'c1', name: 'Clube Norte' } });
    expect(Object.keys(patch).sort()).toEqual([...GAME_DAY_LINK_FIELDS].sort());
    expect(patch).toEqual({
      link_club_id: 'c1', link_club_name: 'Clube Norte', link_arena_id: null, link_arena_name: null,
    });
  });

  it('desvincular tudo zera os quatro', () => {
    expect(Object.values(buildLinkPatch())).toEqual([null, null, null, null]);
  });

  it('o dia vinculado é sempre público', () => {
    expect(LINKED_VISIBILITY).toBe('public');
  });
});

describe('convidados', () => {
  const participantes = [
    { id: 'p1', user_id: 'u1' }, { id: 'p2', user_id: 'u2' }, { id: 'p3', user_id: null }, { id: 'p4', user_id: 'u9' },
  ];

  it('quem não é membro, e quem não tem conta, é convidado', () => {
    const r = splitGuests(participantes, ['u1', 'u2']);
    expect(r.known).toBe(true);
    expect(r.members).toBe(2);
    expect([...r.guestIds].sort()).toEqual(['p3', 'p4']);
  });

  it('lista de membros desconhecida: ninguém é marcado', () => {
    const r = splitGuests(participantes, undefined);
    expect(r.known).toBe(false);
    expect(r.guests).toEqual([]);
    expect(isGuest(participantes[0], null)).toBeNull();
  });

  it('isGuest responde por participante', () => {
    expect(isGuest({ id: 'p1', user_id: 'u1' }, new Set(['u1']))).toBe(false);
    expect(isGuest({ id: 'p9', user_id: 'u7' }, new Set(['u1']))).toBe(true);
  });
});

describe('linkOptions', () => {
  it('clubes só os que a pessoa ADMINISTRA; arenas as que gere; ordenado e sem repetição', () => {
    const r = linkOptions({
      clubs: [
        { id: 'c2', name: 'Zeta', my_role: 'admin' },
        { id: 'c1', name: 'Alfa', my_role: 'admin' },
        { id: 'c3', name: 'Só membro', my_role: 'member' },
        { id: 'c1', name: 'Alfa', my_role: 'admin' },
      ],
      arenas: [{ id: 'a1', name: 'Arena' }, { id: 'a1', name: 'Arena' }],
    });
    expect(r.clubs.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(r.arenas).toEqual([{ id: 'a1', name: 'Arena' }]);
  });

  it('entrada inválida não quebra', () => {
    expect(linkOptions({ clubs: null, arenas: undefined })).toEqual({ clubs: [], arenas: [] });
  });
});

describe('o espelho do ranking leva o clube vinculado', () => {
  const participants = [
    { id: 'p1', user_id: 'u1' }, { id: 'p2', user_id: 'u2' }, { id: 'p3', user_id: 'u3' }, { id: 'p4', user_id: 'u4' },
  ];
  const game = {
    id: 'j1', side_a: [{ id: 'p1' }, { id: 'p2' }], side_b: [{ id: 'p3' }, { id: 'p4' }], score_a: 11, score_b: 7,
  };
  const monta = (gameDay, clubIdsByUid = new Map()) => buildGameDayMatch({
    gameDay: { id: 'g1', title: 'Dia', ...gameDay }, gameId: 'j1', game, participants, clubIdsByUid, publishedBy: 'u1',
  });

  it('dia vinculado: club_id é o clube vinculado, mesmo com convidados de fora', () => {
    const r = monta({ link_club_id: 'cV' });
    expect(r.payload.club_id).toBe('cV');
  });

  it('o vínculo vence a inferência pelos atletas', () => {
    const clubIdsByUid = new Map(['u1', 'u2', 'u3', 'u4'].map((u) => [u, ['cOutro']]));
    expect(monta({ link_club_id: 'cV' }, clubIdsByUid).payload.club_id).toBe('cV');
  });

  it('sem vínculo, nada muda (inferência de sempre)', () => {
    expect(monta({}).payload.club_id).toBeNull();
  });

  it('dia que já é de um clube mantém o clube dono', () => {
    expect(monta({ club_id: 'cDono', link_club_id: 'cV' }).payload.club_id).toBe('cDono');
  });

  it('vínculo só com arena não atribui clube', () => {
    expect(monta({ link_arena_id: 'a1' }).payload.club_id).toBeNull();
  });
});
