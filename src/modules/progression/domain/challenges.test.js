import { describe, it, expect } from 'vitest';
import {
  challengeTimeState, canJoinChallenge, validateChallenge, rankEntries, myStanding, prizeFor,
  challengeTimeLabel, CHALLENGE_METRICS,
} from './challenges.js';

const dia = 86_400_000;
const NOW = new Date('2026-10-02T15:00:00Z').getTime();
const def = (extra = {}) => ({ status: 'active', startsAt: NOW - dia, endsAt: NOW + 5 * dia, ...extra });

describe('estado temporal', () => {
  it('antes, durante e depois', () => {
    expect(challengeTimeState(def({ startsAt: NOW + dia }), NOW)).toBe('upcoming');
    expect(challengeTimeState(def(), NOW)).toBe('live');
    expect(challengeTimeState(def({ endsAt: NOW - 1 }), NOW)).toBe('ended');
    expect(challengeTimeState(def({ status: 'cancelled' }), NOW)).toBe('cancelled');
    expect(challengeTimeState(def({ status: 'draft' }), NOW)).toBe('draft');
  });

  it('inscrição fecha perto do fim e depois dele', () => {
    expect(canJoinChallenge(def(), NOW).ok).toBe(true);
    expect(canJoinChallenge(def({ endsAt: NOW + 3600_000 }), NOW).ok).toBe(false);
    expect(canJoinChallenge(def({ endsAt: NOW - 1 }), NOW).ok).toBe(false);
    expect(canJoinChallenge(def({ startsAt: NOW + dia }), NOW).ok).toBe(true);
  });

  it('o prazo em palavras', () => {
    expect(challengeTimeLabel(def(), NOW)).toBe('termina em 5 dias');
    expect(challengeTimeLabel(def({ startsAt: NOW + 3 * dia }), NOW)).toBe('começa em 3 dias');
    expect(challengeTimeLabel(def({ endsAt: NOW - 1 }), NOW)).toBe('terminou');
  });
});

describe('validateChallenge', () => {
  const base = { title: 'Mês do Iniciante', metric: 'games_played', startsAt: NOW, endsAt: NOW + 30 * dia };

  it('aceita um desafio completo e normaliza', () => {
    const r = validateChallenge({ ...base, prizes: [{ label: 'Troféu', xp: 500 }] }, { type: 'platform', id: 'platform', uid: 'admin' });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ issuerType: 'platform', subject: 'athlete', status: 'active', createdBy: 'admin' });
    expect(r.value.prizes[0]).toEqual({ place: 1, label: 'Troféu', xp: 500 });
  });

  it('XP de prêmio só existe em desafio da plataforma', () => {
    const r = validateChallenge({ ...base, prizes: [{ label: 'Camiseta', xp: 5000 }] }, { type: 'club', id: 'c1', uid: 'u' });
    expect(r.value.prizes[0].xp).toBe(0);
  });

  it('medida de reserva só serve à arena; de aula, ao professor; entre clubes, só à plataforma', () => {
    expect(validateChallenge({ ...base, metric: 'arena_bookings' }, { type: 'club', id: 'c', uid: 'u' }).ok).toBe(false);
    expect(validateChallenge({ ...base, metric: 'arena_bookings' }, { type: 'arena', id: 'a', uid: 'u' }).ok).toBe(true);
    expect(validateChallenge({ ...base, metric: 'coach_lessons' }, { type: 'coach', id: 'u', uid: 'u' }).ok).toBe(true);
    expect(validateChallenge({ ...base, subject: 'club' }, { type: 'arena', id: 'a', uid: 'u' }).ok).toBe(false);
  });

  it('rejeita nome curto e período fora do limite', () => {
    const r = validateChallenge({ ...base, title: 'ab', endsAt: NOW + 400 * dia }, { type: 'platform', id: 'platform', uid: 'a' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['period', 'title']);
  });

  it('toda métrica declara quem pode usar', () => {
    Object.values(CHALLENGE_METRICS).forEach((m) => expect(m.issuers.length).toBeGreaterThan(0));
  });
});

describe('placar', () => {
  const entradas = [
    { subjectId: 'a', value: 10, joinedAt: 3 },
    { subjectId: 'b', value: 12, joinedAt: 2 },
    { subjectId: 'c', value: 10, joinedAt: 1 },
    { subjectId: 'd', value: 4, joinedAt: 4 },
    { subjectId: 'e', value: 99, eligible: false },
  ];

  it('empate de valor = mesma posição; inelegível fica de fora', () => {
    const r = rankEntries(entradas);
    expect(r.map((e) => [e.subjectId, e.position])).toEqual([['b', 1], ['c', 2], ['a', 2], ['d', 4]]);
  });

  it('quanto falta para subir e para o pódio', () => {
    const eu = myStanding(entradas, 'd');
    expect(eu).toMatchObject({ position: 4, value: 4, total: 4, inPodium: false });
    expect(eu.toNext).toBe(7); // 10 - 4 + 1
    expect(eu.toPodium).toBe(7);
    expect(myStanding(entradas, 'b')).toMatchObject({ position: 1, toNext: null, inPodium: true });
    expect(myStanding(entradas, 'fantasma')).toBeNull();
  });

  it('prêmio por posição', () => {
    expect(prizeFor({ prizes: [{ place: 1, label: 'A', xp: 1 }] }, 1).label).toBe('A');
    expect(prizeFor({ prizes: [] }, 2)).toBeNull();
  });
});
