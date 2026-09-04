/**
 * Testes para `xpLedger.js`.
 */

import { describe, it, expect } from 'vitest';
import {
  validateXpEvent,
  eventsToXpBySource,
  computeXpFromEvents,
  eventsForUser,
  eventsInRange,
  detectFarming,
  xpEventId,
  XP_REF_TYPE,
} from './xpLedger.js';

describe('xpLedger · validateXpEvent', () => {
  it('valida um evento simples', () => {
    const r = validateXpEvent({
      uid: 'u1',
      source: 'tournament_attended',
      count: 1,
    });
    expect(r.valid).toBe(true);
    expect(r.value.amount).toBe(30);
    expect(r.value.id).toBeTruthy();
  });

  it('rejeita sem uid', () => {
    const r = validateXpEvent({ source: 'tournament_attended', count: 1 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/uid/);
  });

  it('rejeita source desconhecido', () => {
    const r = validateXpEvent({ uid: 'u1', source: 'nao_existe', count: 1 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/desconhecido/);
  });

  it('rejeita count zero', () => {
    const r = validateXpEvent({ uid: 'u1', source: 'tournament_attended', count: 0 });
    expect(r.valid).toBe(false);
  });

  it('rejeita count NaN', () => {
    const r = validateXpEvent({ uid: 'u1', source: 'tournament_attended', count: 'abc' });
    expect(r.valid).toBe(false);
  });

  it('lida com source negativo (punição)', () => {
    const r = validateXpEvent({
      uid: 'u1',
      source: 'booking_no_show',
      count: 1,
    });
    expect(r.valid).toBe(true);
    expect(r.value.amount).toBe(-30);
  });

  it('preserva id customizado', () => {
    const r = validateXpEvent({
      uid: 'u1',
      source: 'tournament_attended',
      count: 1,
      id: 'meu-id-custom',
    });
    expect(r.value.id).toBe('meu-id-custom');
  });

  it('valida refType conhecido', () => {
    const r = validateXpEvent({
      uid: 'u1',
      source: 'tournament_attended',
      count: 1,
      refType: 'tournament',
      refId: 't1',
    });
    expect(r.valid).toBe(true);
    expect(r.value.refType).toBe('tournament');
    expect(r.value.refId).toBe('t1');
  });

  it('rejeita refType desconhecido', () => {
    const r = validateXpEvent({
      uid: 'u1',
      source: 'tournament_attended',
      count: 1,
      refType: 'nope',
    });
    expect(r.value.refType).toBe(null);
  });
});

describe('xpLedger · eventsToXpBySource', () => {
  it('converte lista em mapa', () => {
    const events = [
      { source: 'tournament_attended', count: 1 },
      { source: 'tournament_attended', count: 1 },
      { source: 'kudos_given', count: 5 },
    ];
    expect(eventsToXpBySource(events)).toEqual({
      tournament_attended: 2,
      kudos_given: 5,
    });
  });

  it('filtra eventos inválidos', () => {
    const events = [
      { source: 'tournament_attended', count: 1 },
      null,
      { source: null },
      { source: 'tournament_attended', count: 0 },
      { source: 'tournament_attended' },
    ];
    expect(eventsToXpBySource(events)).toEqual({ tournament_attended: 1 });
  });

  it('lida com lista vazia', () => {
    expect(eventsToXpBySource([])).toEqual({});
    expect(eventsToXpBySource(null)).toEqual({});
  });
});

describe('xpLedger · computeXpFromEvents', () => {
  it('Flavio replay (mesmo cálculo V1)', () => {
    const events = [
      { source: 'tournament_attended', count: 8 },
      { source: 'tournament_podium', count: 1 },
      { source: 'tournament_title', count: 0 },
      { source: 'game_played', count: 142 },
      { source: 'game_won', count: 66 },
    ];
    const r = computeXpFromEvents(events);
    expect(r.xpTotal).toBe(3020);
  });

  it('lida com eventos vazios', () => {
    expect(computeXpFromEvents([]).xpTotal).toBe(0);
  });
});

describe('xpLedger · eventsForUser / eventsInRange', () => {
  const events = [
    { uid: 'u1', source: 'tournament_attended', count: 1, ts: 1000 },
    { uid: 'u2', source: 'tournament_attended', count: 1, ts: 2000 },
    { uid: 'u1', source: 'kudos_given', count: 5, ts: 3000 },
    { uid: 'u3', source: 'tournament_attended', count: 1, ts: 4000 },
  ];

  it('filtra por usuário', () => {
    const r = eventsForUser(events, 'u1');
    expect(r).toHaveLength(2);
    expect(r.every((e) => e.uid === 'u1')).toBe(true);
  });

  it('retorna [] para uid inexistente', () => {
    expect(eventsForUser(events, 'nope')).toEqual([]);
  });

  it('filtra por range', () => {
    const r = eventsInRange(events, 1500, 3500);
    expect(r).toHaveLength(2);
  });
});

describe('xpLedger · detectFarming', () => {
  it('detecta muitos eventos do mesmo source em pouco tempo', () => {
    const events = [];
    for (let i = 0; i < 20; i += 1) {
      events.push({ source: 'kudos_given', ts: 1000 + i * 100 });
    }
    const flags = detectFarming(events, { windowMs: 5000, threshold: 10 });
    expect(flags).toHaveLength(1);
    expect(flags[0].source).toBe('kudos_given');
    expect(flags[0].count).toBeGreaterThanOrEqual(10);
  });

  it('NÃO detecta eventos espaçados', () => {
    const events = [];
    for (let i = 0; i < 20; i += 1) {
      events.push({ source: 'kudos_given', ts: 1000 + i * 60000 }); // 1 min
    }
    const flags = detectFarming(events, { windowMs: 5000, threshold: 10 });
    expect(flags).toEqual([]);
  });

  it('lida com array vazio', () => {
    expect(detectFarming([])).toEqual([]);
  });
});

describe('xpLedger · xpEventId', () => {
  it('gera ID determinístico', () => {
    expect(xpEventId('u1', 1000, 'tournament_attended')).toBe('u1_1000_tournament_attended');
  });

  it('inclui refId se fornecido', () => {
    expect(xpEventId('u1', 1000, 'tournament_attended', 't1'))
      .toBe('u1_1000_tournament_attended_t1');
  });
});

describe('xpLedger · XP_REF_TYPE', () => {
  it('tem os tipos esperados', () => {
    expect(Object.values(XP_REF_TYPE)).toContain('game');
    expect(Object.values(XP_REF_TYPE)).toContain('tournament');
    expect(Object.values(XP_REF_TYPE)).toContain('kudos');
  });
});
