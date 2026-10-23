/**
 * Arbitragem no SERVIDOR (rodada 3, Bloco 4): a credencial vencida barra a
 * convocação e, com `block_and_release`, a varredura tira das escalas
 * futuras; o AVALIADOR escalado avalia os outros do evento; o pedido de
 * promoção e a mudança de nível com histórico.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rf = require('./federationReferees.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 22, 15, 0, 0); // 22/10/2026
const DEPOIS = Date.UTC(2026, 10, 9, 15, 0, 0); // 09/11/2026, depois do Open
const ARB = { uid: 'arb', name: 'Diretoria de arbitragem' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };
const CAIO = { uid: 'caio', name: 'Caio' };
const T1 = { kind: 'tournament', id: 't1' };
const REGRA = { credential_policy: { required: true, grace_days: 5, warn_days: 20, on_expire: 'block_and_release' }, promotion: { l2: { events: 1, avg: 4 } } };
const NOTAS = { rules: 5, positioning: 4, communication: 4, punctuality: 5, presentation: 4 };

function cenario(regra = REGRA, extra = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, modules: { referees: true, tournaments: true, calendar: true }, referee_rules: regra },
      'federation_staff/fpp_arb': { federation_id: 'fpp', user_id: 'arb', role: 'referees' },
      'users/ana': { platform_name: 'Ana Árbitra' },
      'users/bia': { full_name: 'Bia Juíza' },
      'users/caio': { full_name: 'Caio Avaliador' },
      'tournaments/t1': { name: 'Open FPP', federation_id: 'fpp', federation_sanction: { status: 'approved' }, visibility: 'public', status: 'open', starts_at: '2026-11-07', ends_at: '2026-11-08' },
      'federation_events/e1': { federation_id: 'fpp', kind: 'competition', title: 'Etapa 3', date: '2026-11-14', status: 'scheduled', visibility: 'public' },
      ...extra,
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => rf.referees(ctx(c, now), actor, { federationId: 'fpp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);
const escalas = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('federation_assignments/')).map(([p, d]) => ({ id: p.split('/')[1], ...d }));
const cred = (uid, validUntil) => ({ [`federation_credentials/c_${uid}`]: { federation_id: 'fpp', user_id: uid, kind: 'referee', status: 'active', ...(validUntil ? { valid_until: validUntil } : {}) } });

describe('arbitragem: credencial', () => {
  it('vencida (passada a carência) barra a convocação; em dia passa; diretor não precisa', async () => {
    const c = cenario(REGRA, { ...cred('ana', '2027-01-01'), ...cred('bia', '2026-10-10') });
    await chamar(c, ARB, { action: 'roster_add', userId: 'ana', referee: { level: 'l1', functions: ['referee'] } });
    await chamar(c, ARB, { action: 'roster_add', userId: 'bia', referee: { level: 'l1', functions: ['referee', 'tournament_director'] } });
    expect(doc(c, 'federation_referees/fpp_bia')).toMatchObject({ credential_until: '2026-10-10', credential_policy: REGRA.credential_policy });
    const r = await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['ana', 'bia'] });
    expect(r.created.map((x) => x.uid)).toEqual(['ana']);
    expect(r.skipped[0].uid).toBe('bia');
    expect(r.skipped[0].reason).toMatch(/venceu/);
    expect((await chamar(c, ARB, { action: 'assign', event: T1, function: 'tournament_director', userIds: ['bia'] })).created).toHaveLength(1);
  });

  it('sem a exigência ligada, nada muda', async () => {
    const c = cenario({}, cred('bia', '2026-01-01'));
    await chamar(c, ARB, { action: 'roster_add', userId: 'bia', referee: { level: 'l1', functions: ['referee'] } });
    expect((await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['bia'] })).created).toHaveLength(1);
  });

  it('a varredura avisa a que vai vencer uma vez e tira a vencida das escalas futuras', async () => {
    const c = cenario(REGRA, cred('ana', '2026-11-01'));
    await chamar(c, ARB, { action: 'roster_add', userId: 'ana', referee: { level: 'l1', functions: ['referee'] } });
    await chamar(c, ARB, { action: 'assign', event: { kind: 'event', id: 'e1' }, function: 'referee', userIds: ['ana'] });
    expect((await rf.sweep(ctx(c))).credencial_avisos).toBe(1);
    expect((await rf.sweep(ctx(c))).credencial_avisos).toBe(0);
    const venceu = Date.UTC(2026, 10, 7, 15, 0, 0); // 07/11: venceu em 01/11, carência até 06/11
    expect((await rf.sweep(ctx(c, venceu))).escalas_liberadas).toBe(1);
    expect(escalas(c)[0]).toMatchObject({ status: 'cancelled', cancel_reason: 'Credencial de árbitro vencida.' });
    expect(avisos(c, 'arb').some((n) => /credencial vencida/.test(n.title))).toBe(true);
    expect((await rf.sweep(ctx(c, venceu))).escalas_liberadas).toBe(0);
  });
});

describe('arbitragem: avaliador e progressão', () => {
  it('o avaliador escalado avalia os outros do evento, não a si; depois da equipe, não corrige', async () => {
    const c = cenario({});
    await chamar(c, ARB, { action: 'roster_add', userId: 'ana', referee: { level: 'l1', functions: ['referee'] } });
    await chamar(c, ARB, { action: 'roster_add', userId: 'caio', referee: { level: 'certified', functions: ['evaluator'] } });
    await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['ana'] });
    await chamar(c, ARB, { action: 'assign', event: T1, function: 'evaluator', userIds: ['caio'] });
    const ana = escalas(c).find((a) => a.referee_uid === 'ana');
    const caio = escalas(c).find((a) => a.referee_uid === 'caio');
    await chamar(c, ANA, { action: 'respond', assignmentId: ana.id, accept: true });
    await chamar(c, CAIO, { action: 'respond', assignmentId: caio.id, accept: true });
    await chamar(c, ARB, { action: 'close_event', event: T1 }, DEPOIS);
    const lista = await chamar(c, CAIO, { action: 'evaluator_crew', assignmentId: caio.id }, DEPOIS);
    expect(lista.crew).toEqual([expect.objectContaining({ id: ana.id, function: 'referee', evaluation: null })]);
    await expect(chamar(c, BIA, { action: 'evaluate', assignmentId: ana.id, scores: NOTAS }, DEPOIS)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, CAIO, { action: 'evaluate', assignmentId: caio.id, scores: NOTAS }, DEPOIS)).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, CAIO, { action: 'evaluate', assignmentId: ana.id, scores: NOTAS }, DEPOIS);
    expect(doc(c, `federation_assignments/${ana.id}`).evaluation).toMatchObject({ by: 'caio', by_role: 'evaluator', avg: 4.4 });
    await chamar(c, ARB, { action: 'evaluate', assignmentId: ana.id, scores: { ...NOTAS, rules: 3 } }, DEPOIS);
    expect(doc(c, `federation_assignments/${ana.id}`).evaluation).toMatchObject({ by: 'arb', by_role: 'staff' });
    await expect(chamar(c, CAIO, { action: 'evaluate', assignmentId: ana.id, scores: NOTAS }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('pedido de promoção só com os requisitos; recusar exige motivo; mudar o nível guarda o histórico', async () => {
    const c = cenario(REGRA, cred('bia'));
    await chamar(c, ARB, { action: 'roster_add', userId: 'bia', referee: { level: 'l1', functions: ['referee'] } });
    await expect(chamar(c, BIA, { action: 'promotion_request' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['bia'] });
    const a = escalas(c)[0];
    await chamar(c, BIA, { action: 'respond', assignmentId: a.id, accept: true });
    await chamar(c, ARB, { action: 'close_event', event: T1 }, DEPOIS);
    await chamar(c, ARB, { action: 'evaluate', assignmentId: a.id, scores: NOTAS }, DEPOIS);
    expect(doc(c, 'federation_referees/fpp_bia').promotion_progress).toMatchObject({ next: { id: 'l2' }, met: true });
    await chamar(c, BIA, { action: 'promotion_request', note: 'Pronta.' }, DEPOIS);
    expect(doc(c, 'federation_referees/fpp_bia').promotion_request).toMatchObject({ to: 'l2', met: true, note: 'Pronta.' });
    expect(avisos(c, 'arb').some((n) => /pediu promoção/.test(n.title))).toBe(true);
    await expect(chamar(c, BIA, { action: 'promotion_request' }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, ARB, { action: 'promotion_decline', userId: 'bia', reason: '' }, DEPOIS)).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, ARB, { action: 'roster_update', userId: 'bia', referee: { level: 'l2' }, levelReason: 'Ótima temporada.' }, DEPOIS);
    const b = doc(c, 'federation_referees/fpp_bia');
    expect(b).toMatchObject({ level: 'l2', level_since: '2026-11-09', promotion_request: null });
    expect(b.level_history).toEqual([expect.objectContaining({ from: 'l1', to: 'l2', reason: 'Ótima temporada.', met: true })]);
    expect(avisos(c, 'bia').some((n) => /subiu de nível/.test(n.title))).toBe(true);
  });

  it('recusar o pedido avisa com o motivo e libera pedir de novo', async () => {
    const c = cenario({});
    await chamar(c, ARB, { action: 'roster_add', userId: 'bia', referee: { level: 'l1', functions: ['referee'] } });
    await chamar(c, BIA, { action: 'promotion_request' });
    await chamar(c, ARB, { action: 'promotion_decline', userId: 'bia', reason: 'Falta experiência em finais.' });
    const b = doc(c, 'federation_referees/fpp_bia');
    expect(b.promotion_request).toBeNull();
    expect(b.level_history[0]).toMatchObject({ declined: true, to: 'l2' });
    expect(avisos(c, 'bia').some((n) => /Falta experiência/.test(n.message))).toBe(true);
    await chamar(c, BIA, { action: 'promotion_request' });
  });
});
