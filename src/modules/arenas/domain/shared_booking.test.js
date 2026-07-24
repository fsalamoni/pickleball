import { describe, it, expect } from 'vitest';
import {
  BOOKING_TYPE,
  PARTICIPANT_STATUS,
  normalizeParticipant,
  acceptedParticipants,
  ownerIds,
  invitedIds,
  isOwner,
  isInvited,
  occupiedCount,
  isFull,
  remainingSlots,
  canJoin,
  buildParticipants,
  addInvite,
  acceptInvite,
  declineInvite,
  joinOpen,
  removeParticipant,
  removeParticipantAt,
  seedParticipantsFromOwner,
  addManualParticipant,
  computeSplit,
} from './shared_booking.js';

const P = (id, status = 'accepted', slot = null) => ({ athlete_id: id, name: id, status, slot });

describe('buildParticipants', () => {
  it('solicitante vira aceito+iniciador; convidados ficam convidados', () => {
    const list = buildParticipants({ athlete_id: 'a', name: 'A' }, [{ athlete_id: 'b', name: 'B' }, { athlete_id: 'c', name: 'C' }]);
    expect(list).toHaveLength(3);
    expect(list[0].status).toBe(PARTICIPANT_STATUS.ACCEPTED);
    expect(list[0].is_initiator).toBe(true);
    expect(list[1].status).toBe(PARTICIPANT_STATUS.INVITED);
    expect(list[1].invited_by).toBe('a');
  });
  it('ignora convidado igual ao solicitante e duplicados', () => {
    const list = buildParticipants({ athlete_id: 'a', name: 'A' }, [{ athlete_id: 'a' }, { athlete_id: 'b' }, { athlete_id: 'b' }]);
    expect(list.map((p) => p.athlete_id)).toEqual(['a', 'b']);
  });
});

describe('owners / invited / status', () => {
  const participants = [P('a'), P('b', 'invited'), P('c', 'declined'), P('d')];
  it('ownerIds retorna aceitos', () => {
    expect(ownerIds(participants).sort()).toEqual(['a', 'd']);
  });
  it('invitedIds retorna convidados', () => {
    expect(invitedIds(participants)).toEqual(['b']);
  });
  it('isOwner considera athlete_id original e aceitos', () => {
    expect(isOwner({ athlete_id: 'x', participants }, 'x')).toBe(true);
    expect(isOwner({ participants }, 'a')).toBe(true);
    expect(isOwner({ participants }, 'b')).toBe(false);
  });
  it('isInvited', () => {
    expect(isInvited({ participants }, 'b')).toBe(true);
    expect(isInvited({ participants }, 'a')).toBe(false);
  });
});

describe('capacidade e ingresso', () => {
  it('occupiedCount conta aceitos', () => {
    expect(occupiedCount({ participants: [P('a'), P('b', 'invited'), P('c')] })).toBe(2);
  });
  it('isFull respeita max_participants', () => {
    expect(isFull({ max_participants: 2, participants: [P('a'), P('b')] })).toBe(true);
    expect(isFull({ max_participants: 3, participants: [P('a'), P('b')] })).toBe(false);
    expect(isFull({ max_participants: null, participants: [P('a')] })).toBe(false);
  });
  it('remainingSlots', () => {
    expect(remainingSlots({ max_participants: 4, participants: [P('a'), P('b')] })).toBe(2);
    expect(remainingSlots({ max_participants: null })).toBeNull();
  });
  it('canJoin exige aberta, não-cheia, não-membro', () => {
    const b = { open_join: true, max_participants: 3, participants: [P('a')] };
    expect(canJoin(b, 'z')).toBe(true);
    expect(canJoin(b, 'a')).toBe(false); // já é dono
    expect(canJoin({ ...b, open_join: false }, 'z')).toBe(false);
    expect(canJoin({ open_join: true, max_participants: 1, participants: [P('a')] }, 'z')).toBe(false); // cheia
  });
});

describe('convite: aceitar/recusar/ingressar/sair', () => {
  it('addInvite é idempotente', () => {
    let list = [P('a')];
    list = addInvite(list, { athlete_id: 'b', name: 'B' }, 'a');
    list = addInvite(list, { athlete_id: 'b', name: 'B' }, 'a');
    expect(list.filter((p) => p.athlete_id === 'b')).toHaveLength(1);
  });
  it('acceptInvite muda status e aplica sub-horário', () => {
    const list = acceptInvite([P('b', 'invited')], 'b', { start: '08:00', end: '09:00' });
    expect(list[0].status).toBe(PARTICIPANT_STATUS.ACCEPTED);
    expect(list[0].slot).toEqual({ start: '08:00', end: '09:00' });
  });
  it('declineInvite marca recusado', () => {
    expect(declineInvite([P('b', 'invited')], 'b')[0].status).toBe(PARTICIPANT_STATUS.DECLINED);
  });
  it('joinOpen adiciona como aceito', () => {
    const list = joinOpen([P('a')], { athlete_id: 'z', name: 'Z' });
    expect(list).toHaveLength(2);
    expect(list[1].status).toBe(PARTICIPANT_STATUS.ACCEPTED);
  });
  it('removeParticipant remove', () => {
    expect(removeParticipant([P('a'), P('b')], 'b').map((p) => p.athlete_id)).toEqual(['a']);
  });
});

describe('computeSplit — rateio por tempo', () => {
  const window = { start: '08:00', end: '10:00' }; // 120 min

  it('divide igualmente quando todos ocupam a janela toda', () => {
    const { perParticipant } = computeSplit(window, [P('a'), P('b')], 120);
    expect(perParticipant).toEqual({ a: 60, b: 60 });
  });

  it('três participantes → terços', () => {
    const { perParticipant } = computeSplit(window, [P('a'), P('b'), P('c')], 120);
    expect(perParticipant.a).toBeCloseTo(40, 1);
    expect(perParticipant.b).toBeCloseTo(40, 1);
    expect(perParticipant.c).toBeCloseTo(40, 1);
  });

  it('sub-horários parciais rateiam proporcional ao tempo', () => {
    // A: janela toda; B: só 08:00-09:00. 08-09 dividido (2), 09-10 só A.
    const { perParticipant } = computeSplit(window, [
      P('a'),
      P('b', 'accepted', { start: '08:00', end: '09:00' }),
    ], 120);
    expect(perParticipant.a).toBeCloseTo(90, 1);
    expect(perParticipant.b).toBeCloseTo(30, 1);
  });

  it('sem participantes aceitos: total fica sem rateio', () => {
    const r = computeSplit(window, [P('a', 'invited')], 120);
    expect(r.perParticipant).toEqual({});
    expect(r.total).toBe(120);
  });

  it('preço inválido retorna vazio', () => {
    expect(computeSplit(window, [P('a')], null).total).toBe(0);
  });

  it('a soma do rateio fecha com o total', () => {
    const { perParticipant } = computeSplit(window, [
      P('a'),
      P('b', 'accepted', { start: '08:30', end: '09:30' }),
      P('c', 'accepted', { start: '09:00', end: '10:00' }),
    ], 120);
    const sum = Object.values(perParticipant).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(120, 0);
  });

  it('inclui responsáveis avulsos (sem conta) no rateio', () => {
    // A (atleta) + 1 avulso sem id → dividem meio a meio.
    const avulso = { athlete_id: null, name: 'João', status: 'accepted', slot: null };
    const { perParticipant } = computeSplit(window, [P('a'), avulso], 120);
    expect(perParticipant.a).toBeCloseTo(60, 1);
    expect(perParticipant['manual:1']).toBeCloseTo(60, 1);
    const sum = Object.values(perParticipant).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(120, 0);
  });
});

describe('normalizeParticipant', () => {
  it('default é convidado; sub-horário inválido vira null', () => {
    const p = normalizeParticipant({ athlete_id: 'a', name: 'A', slot: { start: '10:00', end: '09:00' } });
    expect(p.status).toBe(PARTICIPANT_STATUS.INVITED);
    expect(p.slot).toBeNull();
  });
});

describe('BOOKING_TYPE', () => {
  it('expõe os tipos', () => {
    expect(BOOKING_TYPE.COURT).toBe('court');
    expect(BOOKING_TYPE.COACH_LESSON).toBe('coach_lesson');
  });
});

describe('múltiplos responsáveis (manager)', () => {
  it('seedParticipantsFromOwner cria o titular como aceito quando não há participantes', () => {
    const seed = seedParticipantsFromOwner({ athlete_id: 'a', athlete_name: 'Ana', athlete_photo: 'x' });
    expect(seed).toHaveLength(1);
    expect(seed[0].athlete_id).toBe('a');
    expect(seed[0].status).toBe(PARTICIPANT_STATUS.ACCEPTED);
    expect(seed[0].is_initiator).toBe(true);
  });

  it('seedParticipantsFromOwner mantém participantes já existentes', () => {
    const existing = [P('a'), P('b', 'invited')];
    expect(seedParticipantsFromOwner({ athlete_id: 'a', participants: existing })).toBe(existing);
  });

  it('seedParticipantsFromOwner retorna vazio sem dono', () => {
    expect(seedParticipantsFromOwner({})).toEqual([]);
  });

  it('addManualParticipant adiciona avulso aceito e ignora nome vazio', () => {
    let list = seedParticipantsFromOwner({ athlete_id: 'a', athlete_name: 'Ana' });
    list = addManualParticipant(list, 'João (11) 99999', 'a');
    expect(list).toHaveLength(2);
    expect(list[1].athlete_id).toBeNull();
    expect(list[1].name).toBe('João (11) 99999');
    expect(list[1].status).toBe(PARTICIPANT_STATUS.ACCEPTED);
    expect(addManualParticipant(list, '   ')).toHaveLength(2);
  });

  it('manager adiciona vários responsáveis: convites + avulso', () => {
    let list = seedParticipantsFromOwner({ athlete_id: 'a', athlete_name: 'Ana' });
    list = addInvite(list, { athlete_id: 'b', name: 'Bia' }, 'a');
    list = addInvite(list, { athlete_id: 'c', name: 'Caio' }, 'a');
    list = addManualParticipant(list, 'Davi', 'a');
    expect(ownerIds(list)).toEqual(['a']); // só aceitos com id (Ana)
    expect(invitedIds(list)).toEqual(['b', 'c']);
    expect(acceptedParticipants(list)).toHaveLength(2); // Ana + Davi (avulso)
  });

  it('removeParticipantAt remove por índice (útil p/ avulsos)', () => {
    const list = [P('a'), addManualParticipant([], 'Avulso')[0]];
    expect(removeParticipantAt(list, 1)).toHaveLength(1);
    expect(removeParticipantAt(list, 1)[0].athlete_id).toBe('a');
  });
});
