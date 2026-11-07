/**
 * Prazos do torneio no SERVIDOR (Firestore falso): a passada vira só o que as
 * datas mandam, e o aviso à comunidade sai uma vez só, de torneio público.
 * E a PARIDADE com a conta da tela (`registrationWindow.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { dueScheduleChange as daTela } from '@/modules/tournament/domain/registrationWindow.js';

const require = createRequire(import.meta.url);
const s = require('./tournamentSchedule.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 7, 15, 0);
const ctx = (db, now = NOW) => ({ db, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const avisos = (db) => [...db.store.docs.entries()].filter(([k]) => k.startsWith('notifications/')).map(([, v]) => v);

describe('paridade com a tela', () => {
  const CASOS = [
    null, {}, { status: 'draft', registration_opens_ms: NOW - H },
    { status: 'published' }, { status: 'published', registration_opens_ms: NOW }, { status: 'published', registration_opens_ms: NOW + 1 },
    { status: 'published', registration_closes_ms: NOW }, { status: 'registrations_open', registration_closes_ms: NOW - 1 },
    { status: 'registrations_open', registration_closes_ms: NOW + 1 }, { status: 'registrations_closed', registration_opens_ms: NOW - H },
    { status: 'registrations_open', registration_closes_ms: NOW - H, archived: true }, { status: 'in_progress', registration_closes_ms: NOW - H },
    { status: 'published', registration_opens_ms: '2026-11-07' },
  ];
  it('dueScheduleChange decide igual nos dois lados', () => {
    for (const c of CASOS) expect(s.dueScheduleChange(c, NOW)).toBe(daTela(c, NOW));
  });
});

describe('runScheduleWorker', () => {
  it('abre e encerra pela data e não toca no resto', async () => {
    const db = createFakeDb({
      'tournaments/abre': { status: 'published', registration_opens_ms: NOW - 1 },
      'tournaments/espera': { status: 'published', registration_opens_ms: NOW + H },
      'tournaments/fecha': { status: 'registrations_open', registration_closes_ms: NOW - 1 },
      'tournaments/manual': { status: 'registrations_closed', registration_closes_ms: NOW + H },
      'tournaments/rasc': { status: 'draft', registration_opens_ms: NOW - H },
    });
    expect(await s.runScheduleWorker(ctx(db))).toBe(2);
    const st = (id) => db.store.docs.get(`tournaments/${id}`);
    expect(st('abre')).toMatchObject({ status: 'registrations_open', schedule_change: 'open', schedule_changed_ms: NOW });
    expect(st('fecha')).toMatchObject({ status: 'registrations_closed', schedule_change: 'close' });
    expect(st('espera').status).toBe('published');
    expect(st('manual').status).toBe('registrations_closed');
    expect(st('rasc').status).toBe('draft');
  });
});

describe('onTournamentUpdated', () => {
  const seed = () => createFakeDb({
    'tournaments/t1': { status: 'registrations_open', visibility: 'public', name: 'Copa', creator_uid: 'dono' },
    'athlete_profiles/ana': { directory_listed: true },
    'athlete_profiles/oculta': { directory_listed: true, hidden: true },
    'tournament_admins/t1_coadm': { tournament_id: 't1', user_id: 'coadm' },
  });

  it('avisa a comunidade uma vez quando o público abre', async () => {
    const db = seed();
    const antes = { status: 'published', visibility: 'public', name: 'Copa' };
    await s.onTournamentUpdated(ctx(db), antes, { ...antes, status: 'registrations_open' }, 't1');
    expect(avisos(db).map((a) => a.user_id)).toEqual(['ana']);
    expect(avisos(db)[0]).toMatchObject({ type: 'tournament_open', origin: 'server', link: '/torneios/t1' });
    expect(db.store.docs.get('tournaments/t1').registrations_open_notified).toBe(true);
    await s.onTournamentUpdated(ctx(db), antes, { ...antes, status: 'registrations_open', registrations_open_notified: true }, 't1');
    expect(avisos(db)).toHaveLength(1);
  });

  it('privado não avisa a comunidade', async () => {
    const db = seed();
    await s.onTournamentUpdated(ctx(db), { status: 'published', visibility: 'private' }, { status: 'registrations_open', visibility: 'private' }, 't1');
    expect(avisos(db)).toHaveLength(0);
  });

  it('a virada pela data avisa a organização', async () => {
    const db = seed();
    const antes = { status: 'registrations_open', visibility: 'private', creator_uid: 'dono', name: 'Copa' };
    await s.onTournamentUpdated(ctx(db), antes, { ...antes, status: 'registrations_closed', schedule_change: 'close', schedule_changed_ms: NOW }, 't1');
    expect(avisos(db).map((a) => a.user_id).sort()).toEqual(['coadm', 'dono']);
  });
});
