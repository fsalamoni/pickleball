import { describe, it, expect } from 'vitest';
import {
  isUpcomingSlot, sortSlotsBySchedule, openMatchSectionModel, myUpcomingOpenSlots,
  pendingWaitlistCalls, waitlistBySlot, openSlotsForDiscovery, slotActionState,
} from './openMatchView.js';

// Meio-dia de 15/09/2026, hora local — o relógio dos testes.
const AGORA = new Date(2026, 8, 15, 12, 0).getTime();

const vaga = (id, over = {}) => ({
  id, arena_id: 'a1', date: '2026-09-16', start: '19:00', end: '21:00',
  total_spots: 4, participants: [], status: 'open', ...over,
});

describe('isUpcomingSlot', () => {
  it('vaga futura conta; cancelada e já começada não', () => {
    expect(isUpcomingSlot(vaga('1'), AGORA)).toBe(true);
    expect(isUpcomingSlot(vaga('2', { status: 'cancelled' }), AGORA)).toBe(false);
    expect(isUpcomingSlot(vaga('3', { date: '2026-09-15', start: '10:00' }), AGORA)).toBe(false);
  });

  it('sem hora, vale a data LOCAL — o jogo de hoje ainda conta à noite', () => {
    const noite = new Date(2026, 8, 15, 22, 30).getTime();
    expect(isUpcomingSlot({ id: 'x', date: '2026-09-15', status: 'open' }, noite)).toBe(true);
    expect(isUpcomingSlot({ id: 'y', date: '2026-09-14', status: 'open' }, noite)).toBe(false);
  });
});

describe('sortSlotsBySchedule', () => {
  it('data e hora, do mais cedo ao mais tarde; sem data no fim', () => {
    const ordem = sortSlotsBySchedule([
      vaga('b', { date: '2026-09-17' }), { id: 'z' }, vaga('a', { start: '08:00' }),
    ]).map((s) => s.id);
    expect(ordem).toEqual(['a', 'b', 'z']);
  });
});

describe('openMatchSectionModel — a seção da página da arena', () => {
  it('⭐ separa os meus jogos dos outros', () => {
    const m = openMatchSectionModel({
      slots: [vaga('meu', { participants: ['eu'] }), vaga('outro')], uid: 'eu', now: AGORA,
    });
    expect(m.meus.map((s) => s.id)).toEqual(['meu']);
    expect(m.destaque.map((s) => s.id)).toEqual(['outro']);
    expect(m.total).toBe(2);
    expect(m.disponiveis).toBe(1);
  });

  it('⭐ quem cabe no meu nível vem primeiro, mesmo sendo mais tarde', () => {
    const m = openMatchSectionModel({
      slots: [
        vaga('cedo-fora', { start: '08:00', min_level: 5 }),
        vaga('tarde-dentro', { start: '20:00', min_level: 3, max_level: 4 }),
      ],
      level: 3.5, now: AGORA,
    });
    expect(m.destaque.map((s) => s.id)).toEqual(['tarde-dentro', 'cedo-fora']);
  });

  it('jogo lotado vem depois dos com vaga (é onde se oferece a fila)', () => {
    const m = openMatchSectionModel({
      slots: [
        vaga('cheio', { start: '08:00', participants: ['a', 'b', 'c', 'd'] }),
        vaga('com-vaga', { start: '20:00' }),
      ],
      now: AGORA,
    });
    expect(m.destaque.map((s) => s.id)).toEqual(['com-vaga', 'cheio']);
  });

  it('nível desconhecido não tira ninguém do destaque', () => {
    const m = openMatchSectionModel({ slots: [vaga('x', { min_level: 5 })], level: null, now: AGORA });
    expect(m.destaque).toHaveLength(1);
  });

  it('respeita o limite do destaque', () => {
    const slots = ['a', 'b', 'c', 'd', 'e'].map((id, i) => vaga(id, { start: `1${i}:00` }));
    expect(openMatchSectionModel({ slots, limite: 3, now: AGORA }).destaque).toHaveLength(3);
  });

  it('⭐ chamada da fila só vale para vaga DESTA lista e ainda futura', () => {
    const m = openMatchSectionModel({
      slots: [vaga('s1')],
      waitlist: [
        { slot_id: 's1', status: 'notified' },
        { slot_id: 'outra-arena', status: 'notified' },
        { slot_id: 's1', status: 'waiting' },
      ],
      now: AGORA,
    });
    expect(m.chamadas).toHaveLength(1);
    expect(m.chamadas[0].slot.id).toBe('s1');
  });

  it('entrada vazia não quebra', () => {
    expect(openMatchSectionModel()).toEqual({ chamadas: [], meus: [], destaque: [], total: 0, disponiveis: 0 });
  });
});

describe('myUpcomingOpenSlots', () => {
  it('só os futuros, em ordem', () => {
    const r = myUpcomingOpenSlots([
      vaga('b', { date: '2026-09-18' }), vaga('passado', { date: '2026-09-10' }), vaga('a'),
    ], AGORA);
    expect(r.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('pendingWaitlistCalls', () => {
  it('⭐ chamada sem vaga conhecida não aparece (não há o que confirmar)', () => {
    const r = pendingWaitlistCalls(
      [{ slot_id: 's1', status: 'notified' }, { slot_id: 'sumiu', status: 'notified' }],
      [vaga('s1')], AGORA,
    );
    expect(r.map((c) => c.slot.id)).toEqual(['s1']);
  });

  it('aceita um Map de vagas', () => {
    const r = pendingWaitlistCalls([{ slot_id: 's1', status: 'notified' }], new Map([['s1', vaga('s1')]]), AGORA);
    expect(r).toHaveLength(1);
  });

  it('chamada de jogo que já começou não aparece', () => {
    const r = pendingWaitlistCalls(
      [{ slot_id: 's1', status: 'notified' }],
      [vaga('s1', { date: '2026-09-15', start: '09:00' })], AGORA,
    );
    expect(r).toEqual([]);
  });
});

describe('waitlistBySlot — a fila na Central', () => {
  it('conta quem espera e guarda quem foi chamado', () => {
    const m = waitlistBySlot([
      { slot_id: 's1', status: 'waiting', athlete_name: 'Ana' },
      { slot_id: 's1', status: 'waiting', athlete_name: 'Bia' },
      { slot_id: 's1', status: 'notified', athlete_name: 'Caio' },
      { slot_id: 's2', status: 'declined' },
      { status: 'waiting' },
    ]);
    expect(m.get('s1').esperando).toBe(2);
    expect(m.get('s1').nomes).toEqual(['Ana', 'Bia']);
    expect(m.get('s1').chamado.athlete_name).toBe('Caio');
    expect(m.get('s2').esperando).toBe(0);
    expect(m.size).toBe(2);
  });
});

describe('openSlotsForDiscovery — Procura-se jogo', () => {
  it('⭐ só futuras, com vaga e de arena que mantém o módulo ligado', () => {
    const r = openSlotsForDiscovery([
      vaga('ok'),
      vaga('cheia', { participants: ['a', 'b', 'c', 'd'] }),
      vaga('passada', { date: '2026-09-01' }),
      vaga('desligada', { arena_id: 'a2' }),
    ], (id) => id === 'a1', AGORA);
    expect(r.map((s) => s.id)).toEqual(['ok']);
  });
});

describe('slotActionState — o botão da vaga', () => {
  const cheia = vaga('c', { participants: ['a', 'b', 'c', 'd'] });
  it('já estou dentro → sair (mesmo se lotou ou começou)', () => {
    expect(slotActionState(cheia, { jaEstou: true, now: AGORA }).estado).toBe('sair');
  });
  it('⭐ lotado oferece a FILA, não "encerrado"', () => {
    expect(slotActionState(cheia, { now: AGORA }).estado).toBe('fila');
    expect(slotActionState(cheia, { naFila: true, now: AGORA }).estado).toBe('na-fila');
  });
  it('começou → encerrado', () => {
    expect(slotActionState(vaga('x', { date: '2026-09-15', start: '09:00' }), { now: AGORA }).estado).toBe('encerrado');
  });
  it('fora da faixa diz o motivo; nível desconhecido entra', () => {
    const r = slotActionState(vaga('x', { min_level: 5 }), { level: 3, now: AGORA });
    expect(r.estado).toBe('fora-da-faixa');
    expect(r.motivo).toMatch(/nível 5/);
    expect(slotActionState(vaga('x', { min_level: 5 }), { level: null, now: AGORA }).estado).toBe('entrar');
  });
  it('conta as vagas', () => {
    expect(slotActionState(vaga('x', { participants: ['a'] }), { now: AGORA })).toEqual({ estado: 'entrar', vagas: 3 });
  });
});
