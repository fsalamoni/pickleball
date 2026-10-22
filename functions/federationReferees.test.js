/**
 * Arbitragem no SERVIDOR contra um Firestore falso: quem escala (só
 * `courses`/`admin`), os alertas da convocação, a resposta do árbitro
 * (conflito declarado obriga a recusar), fechar o evento, avaliar, pagar a
 * diária, a súmula, o lembrete da varredura e o que o público vê (nunca
 * valor, nota nem conflito).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rf = require('./federationReferees.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 22, 15, 0, 0); // 22/10/2026, meio-dia em Brasília
const ARB = { uid: 'arb', name: 'Diretoria de arbitragem' };
const PRES = { uid: 'pres', name: 'Presidente' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };

function cenario(mods = { referees: true, tournaments: true, calendar: true }, extra = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, modules: mods, referee_rules: { needs: { referee: 2 }, fee_default_cents: { referee: 15000 }, min_level_by_function: { head_referee: 'certified' } } },
      'federation_staff/fpp_arb': { federation_id: 'fpp', user_id: 'arb', role: 'referees' },
      'federation_staff/fpp_pres': { federation_id: 'fpp', user_id: 'pres', role: 'president' },
      'federation_staff/fpp_fin': { federation_id: 'fpp', user_id: 'fin', role: 'treasurer' },
      'users/ana': { platform_name: 'Ana Árbitra', city: 'Santos', state: 'sp', email: 'ana@x.com' },
      'users/bia': { full_name: 'Bia Juíza', city: 'Campinas', state: 'SP' },
      'users/caio': { full_name: 'Caio' },
      'federation_credentials/curso1_caio': { federation_id: 'fpp', user_id: 'caio', kind: 'referee', level: 'l1', status: 'active' },
      'federation_credentials/curso1_x': { federation_id: 'outra', user_id: 'x', kind: 'referee', status: 'active' },
      'tournaments/t1': { name: 'Open FPP', federation_id: 'fpp', federation_sanction: { status: 'approved' }, visibility: 'public', status: 'open', starts_at: '2026-11-07', ends_at: '2026-11-08', city: 'São Paulo' },
      'tournaments/t2': { name: 'Sem chancela', federation_id: 'fpp', federation_sanction: { status: 'pending' }, visibility: 'public', status: 'open', starts_at: '2026-11-07' },
      'tournaments/tp': { name: 'Passado', federation_id: 'fpp', federation_sanction: { status: 'approved' }, visibility: 'public', status: 'open', starts_at: '2026-10-20', ends_at: '2026-10-21' },
      'tournaments/tq': { name: 'Outro open', federation_id: 'fpp', federation_sanction: { status: 'approved' }, visibility: 'public', status: 'open', starts_at: '2026-11-08' },
      'tournament_registrations/r1': { tournament_id: 't1', player_a_user_id: 'bia', player_b_user_id: 'zeca', status: 'confirmed' },
      'federation_events/e1': { federation_id: 'fpp', kind: 'competition', title: 'Etapa 3', date: '2026-11-14', status: 'scheduled', visibility: 'public', place: { city: 'Santos' } },
      'federation_events/e2': { federation_id: 'fpp', kind: 'assembly_ordinary', title: 'AGO', date: '2026-11-20', status: 'scheduled', visibility: 'public' },
      ...extra,
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => rf.referees(ctx(c, now), actor, { federationId: 'fpp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && (!uid || d.user_id === uid)).map(([, d]) => d);
const escalas = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('federation_assignments/')).map(([p, d]) => ({ id: p.split('/')[1], ...d }));
const T1 = { kind: 'tournament', id: 't1' };

async function quadro(c) {
  await chamar(c, ARB, { action: 'roster_add', userId: 'ana', referee: { level: 'certified', functions: ['referee', 'head_referee'] }, notes: 'Boa em final.' });
  await chamar(c, ARB, { action: 'roster_add', userId: 'bia', referee: { level: 'l1', functions: ['referee', 'line_judge'] } });
}

describe('arbitragem: o quadro', () => {
  it('só courses/admin mexe; o quadro copia nome e cidade, a nota vai para private/staff', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'roster_add', userId: 'ana', referee: { level: 'l1', functions: ['referee'] } })).rejects.toMatchObject({ code: 'permission-denied' });
    await quadro(c);
    expect(doc(c, 'federation_referees/fpp_ana')).toMatchObject({ federation_id: 'fpp', user_id: 'ana', name: 'Ana Árbitra', city: 'Santos', state: 'SP', level: 'certified', status: 'active', public_listing: false, since: '2026-10-22' });
    expect(doc(c, 'federation_referees/fpp_ana').email).toBeUndefined();
    expect(doc(c, 'federation_referees/fpp_ana/private/staff')).toMatchObject({ notes: 'Boa em final.' });
    expect(avisos(c, 'ana')).toHaveLength(1);
    await expect(chamar(c, PRES, { action: 'roster_add', userId: 'ana', referee: { level: 'l1', functions: ['referee'] } })).rejects.toMatchObject({ code: 'already-exists' });
    await expect(chamar(c, ARB, { action: 'roster_add', userId: 'caio', referee: { level: 'xx', functions: ['referee'] } })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('entra pela credencial ativa da federação (não de outra)', async () => {
    const c = cenario();
    await expect(chamar(c, ARB, { action: 'roster_add', credentialId: 'curso1_x', referee: { level: 'l1', functions: ['referee'] } })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, ARB, { action: 'roster_add', credentialId: 'curso1_caio', referee: { level: 'l1', functions: ['referee'] } });
    expect(doc(c, 'federation_referees/fpp_caio')).toMatchObject({ user_id: 'caio', credential_ids: ['curso1_caio'] });
  });

  it('módulo desligado é recusado', async () => {
    await expect(chamar(cenario({ tournaments: true }), ARB, { action: 'roster_add', userId: 'ana', referee: { level: 'l1', functions: ['referee'] } })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('o árbitro marca as datas em que não pode e se aparece no quadro público', async () => {
    const c = cenario();
    await quadro(c);
    await expect(chamar(c, { uid: 'caio' }, { action: 'self', unavailable: [] })).rejects.toMatchObject({ code: 'not-found' });
    await chamar(c, ANA, { action: 'self', unavailable: ['2026-11-07', '2026-10-01', 'lixo', '2026-11-07'], publicListing: true });
    expect(doc(c, 'federation_referees/fpp_ana')).toMatchObject({ unavailable: ['2026-11-07'], public_listing: true });
  });
});

describe('arbitragem: escalas', () => {
  it('convoca com os alertas (indisponível, inscrito como atleta, nível) e avisa cada um', async () => {
    const c = cenario();
    await quadro(c);
    await chamar(c, ANA, { action: 'self', unavailable: ['2026-11-08'] });
    const r = await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['ana', 'bia', 'caio'] });
    expect(r.created).toHaveLength(2);
    expect(r.skipped).toEqual([{ uid: 'caio', reason: 'Esta pessoa não está no quadro de arbitragem.' }]);
    const ana = escalas(c).find((a) => a.referee_uid === 'ana');
    const bia = escalas(c).find((a) => a.referee_uid === 'bia');
    expect(ana).toMatchObject({ status: 'invited', fee_cents: 15000, travel_cents: 0, event_key: 'tournament_t1', respond_by: '2026-10-25', event: { name: 'Open FPP', date: '2026-11-07', end_date: '2026-11-08', city: 'São Paulo', public: true } });
    expect(ana.warnings.map((w) => w.kind)).toEqual(['unavailable']);
    expect(bia.warnings.map((w) => w.kind)).toEqual(['athlete']);
    expect(avisos(c, 'bia').some((n) => /convocou/.test(n.title))).toBe(true);
    // mesma pessoa no mesmo evento: bloqueia
    await expect(chamar(c, ARB, { action: 'assign', event: T1, function: 'line_judge', userIds: ['bia'] })).rejects.toMatchObject({ code: 'failed-precondition' });
    // outra escala no mesmo dia e nível abaixo do mínimo
    const r2 = await chamar(c, ARB, { action: 'assign', event: { kind: 'tournament', id: 'tq' }, function: 'referee', userIds: ['ana'] });
    expect(r2.created[0].warnings.map((w) => w.kind)).toEqual(['unavailable', 'same_day']);
  });

  it('só evento escalável: torneio chancelado, futuro; evento esportivo da agenda', async () => {
    const c = cenario();
    await quadro(c);
    await expect(chamar(c, ARB, { action: 'assign', event: { kind: 'tournament', id: 't2' }, function: 'referee', userIds: ['ana'] })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, ARB, { action: 'assign', event: { kind: 'tournament', id: 'tp' }, function: 'referee', userIds: ['ana'] })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, ARB, { action: 'assign', event: { kind: 'event', id: 'e2' }, function: 'referee', userIds: ['ana'] })).rejects.toMatchObject({ code: 'failed-precondition' });
    const r = await chamar(c, ARB, { action: 'assign', event: { kind: 'event', id: 'e1' }, function: 'referee', userIds: ['ana'], feeCents: 20000, travelCents: 5000 });
    expect(escalas(c).find((a) => a.id === r.created[0].assignmentId)).toMatchObject({ fee_cents: 20000, travel_cents: 5000, event: { kind: 'event', city: 'Santos' } });
    await expect(chamar(c, ARB, { action: 'assign', event: { kind: 'event', id: 'e1' }, function: 'referee', userIds: ['bia'], feeCents: 1.5 })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('o árbitro responde: conflito declarado obriga a recusar e avisa a equipe', async () => {
    const c = cenario();
    await quadro(c);
    await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['ana', 'bia'] });
    const [ana, bia] = ['ana', 'bia'].map((u) => escalas(c).find((a) => a.referee_uid === u));
    await expect(chamar(c, BIA, { action: 'respond', assignmentId: ana.id, accept: true })).rejects.toMatchObject({ code: 'not-found' });
    await expect(chamar(c, BIA, { action: 'respond', assignmentId: bia.id, accept: true, conflict: { declared: true, reason: 'Meu irmão joga' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, BIA, { action: 'respond', assignmentId: bia.id, accept: false, conflict: { declared: true, reason: 'Meu irmão joga' } });
    expect(doc(c, `federation_assignments/${bia.id}`)).toMatchObject({ status: 'declined', conflict: { declared: true, reason: 'Meu irmão joga' } });
    expect(avisos(c, 'arb').some((n) => /conflito/.test(n.title))).toBe(true);
    expect(avisos(c, 'fin')).toHaveLength(0);
    await chamar(c, ANA, { action: 'respond', assignmentId: ana.id, accept: true });
    expect(doc(c, `federation_assignments/${ana.id}`).status).toBe('confirmed');
    // substituir a recusada
    await chamar(c, ARB, { action: 'roster_add', credentialId: 'curso1_caio', referee: { level: 'l1', functions: ['referee'] } });
    const rr = await chamar(c, ARB, { action: 'reassign', assignmentId: bia.id, userId: 'caio' });
    expect(doc(c, `federation_assignments/${bia.id}`)).toMatchObject({ status: 'replaced', replaced_by: rr.assignmentId });
    expect(doc(c, `federation_assignments/${rr.assignmentId}`)).toMatchObject({ status: 'invited', referee_uid: 'caio', replaces: bia.id });
  });

  it('cancelar exige motivo; tirar do quadro com escala aberta é recusado', async () => {
    const c = cenario();
    await quadro(c);
    const r = await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['ana'] });
    const id = r.created[0].assignmentId;
    await expect(chamar(c, ARB, { action: 'roster_remove', userId: 'ana' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, ARB, { action: 'cancel', assignmentId: id, reason: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, ARB, { action: 'cancel', assignmentId: id, reason: 'Torneio menor' });
    expect(doc(c, `federation_assignments/${id}`).status).toBe('cancelled');
    await chamar(c, ARB, { action: 'roster_remove', userId: 'ana' });
    expect(doc(c, 'federation_referees/fpp_ana')).toBeUndefined();
    expect(doc(c, 'federation_referees/fpp_ana/private/staff')).toBeUndefined();
    expect(doc(c, `federation_assignments/${id}`)).toBeDefined();
  });
});

describe('arbitragem: depois do evento', () => {
  async function evento() {
    const c = cenario();
    await quadro(c);
    await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['ana', 'bia'] });
    const [ana, bia] = ['ana', 'bia'].map((u) => escalas(c).find((a) => a.referee_uid === u));
    await chamar(c, ANA, { action: 'respond', assignmentId: ana.id, accept: true });
    return { c, ana, bia };
  }
  const DEPOIS = Date.UTC(2026, 10, 9, 15, 0, 0);

  it('fecha o evento: confirmado atuou, sem resposta cancelado; recontagem', async () => {
    const { c, ana, bia } = await evento();
    await expect(chamar(c, ARB, { action: 'close_event', event: T1 })).rejects.toMatchObject({ code: 'failed-precondition' });
    const r = await chamar(c, ARB, { action: 'close_event', event: T1 }, DEPOIS);
    expect(r).toMatchObject({ done: 1, no_show: 0, cancelled: 1 });
    expect(doc(c, `federation_assignments/${ana.id}`).status).toBe('done');
    expect(doc(c, `federation_assignments/${bia.id}`).status).toBe('cancelled');
    expect(doc(c, 'federation_referees/fpp_ana').stats).toMatchObject({ acts: 1, no_show: 0 });
  });

  it('súmula só de quem foi confirmado, a partir do evento; avisa a equipe uma vez', async () => {
    const { c, ana } = await evento();
    await expect(chamar(c, ANA, { action: 'report', assignmentId: ana.id, text: 'Tudo certo no evento.' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, ANA, { action: 'report', assignmentId: ana.id, text: 'Tudo certo no evento.' }, DEPOIS);
    await chamar(c, ANA, { action: 'report', assignmentId: ana.id, text: 'Tudo certo no evento, corrigido.' }, DEPOIS);
    expect(doc(c, `federation_assignments/${ana.id}`).report).toMatchObject({ text: 'Tudo certo no evento, corrigido.' });
    expect(avisos(c, 'arb').filter((n) => /Súmula/.test(n.title))).toHaveLength(1);
  });

  it('avalia quem atuou e paga a diária (e desfaz); o aviso não traz a nota', async () => {
    const { c, ana, bia } = await evento();
    const notas = { rules: 5, positioning: 4, communication: 4, punctuality: 5, presentation: 4 };
    await expect(chamar(c, ARB, { action: 'evaluate', assignmentId: ana.id, scores: notas }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, ARB, { action: 'close_event', event: T1 }, DEPOIS);
    const r = await chamar(c, ARB, { action: 'evaluate', assignmentId: ana.id, scores: notas, comment: 'Ótima' }, DEPOIS);
    expect(r.avg).toBe(4.4);
    expect(doc(c, 'federation_referees/fpp_ana').stats).toMatchObject({ evaluations: 1, avg: 4.4 });
    expect(avisos(c, 'ana').find((n) => /Avaliação/.test(n.title)).message).not.toMatch(/4,4|4\.4/);
    await expect(chamar(c, ARB, { action: 'mark_paid', assignmentIds: [bia.id] }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, ARB, { action: 'mark_paid', assignmentIds: [ana.id] }, DEPOIS);
    expect(doc(c, `federation_assignments/${ana.id}`)).toMatchObject({ paid_at_ms: DEPOIS, paid_by: 'arb' });
    expect(avisos(c, 'ana').some((n) => /R\$ 150,00/.test(n.message))).toBe(true);
    await chamar(c, ARB, { action: 'mark_paid', assignmentIds: [ana.id], paid: false }, DEPOIS);
    expect(doc(c, `federation_assignments/${ana.id}`).paid_at_ms).toBeNull();
  });

  it('regras e níveis: só a equipe grava, validado', async () => {
    const c = cenario();
    await expect(chamar(c, ANA, { action: 'rules', rules: {} })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(c, ARB, { action: 'rules', rules: { levels: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], respond_days: 5, crew_visible: true } });
    expect(doc(c, 'federations/fpp').referee_rules).toMatchObject({ levels: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], respond_days: 5, crew_visible: true });
    expect(r.ok).toBe(true);
  });
});

describe('arbitragem: público e varredura', () => {
  it('o público vê o quadro (só quem aceitou) e quem apita (só confirmados), sem valores', async () => {
    const c = cenario();
    await quadro(c);
    await chamar(c, ANA, { action: 'self', publicListing: true });
    await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['ana', 'bia'] });
    const ana = escalas(c).find((a) => a.referee_uid === 'ana');
    await chamar(c, ANA, { action: 'respond', assignmentId: ana.id, accept: true });
    const p = await rf.publico(ctx(c), null, { federationId: 'fpp' });
    expect(p.available).toBe(true);
    expect(p.board).toEqual([{ name: 'Ana Árbitra', level: 'certified', level_label: 'Certificado', city: 'Santos', state: 'SP', photo_url: '' }]);
    expect(p.crews).toEqual([{ event: { kind: 'tournament', id: 't1', name: 'Open FPP', date: '2026-11-07', end_date: '2026-11-08', city: 'São Paulo' }, people: [{ name: 'Ana Árbitra', function: 'referee' }] }]);
    expect(JSON.stringify(p)).not.toMatch(/fee|cents|warnings|conflict|stats/);
    const t = await rf.publico(ctx(c), null, { federationId: 'fpp', tournamentId: 't1' });
    expect(t.crew).toEqual([{ name: 'Ana Árbitra', function: 'referee' }]);
    expect((await rf.publico(ctx(c), null, { federationId: 'fpp', tournamentId: 't2' })).available).toBe(false);
  });

  it('federação oculta ou módulo desligado: o público não vê nada', async () => {
    const c = cenario({ tournaments: true });
    expect((await rf.publico(ctx(c), null, { federationId: 'fpp' })).available).toBe(false);
  });

  it('a varredura lembra um dia antes do prazo, uma vez', async () => {
    const c = cenario();
    await quadro(c);
    await chamar(c, ARB, { action: 'assign', event: T1, function: 'referee', userIds: ['ana'], respondBy: '2026-10-23' });
    const antes = avisos(c, 'ana').length;
    expect((await rf.sweep(ctx(c))).lembretes).toBe(1);
    expect((await rf.sweep(ctx(c))).lembretes).toBe(0);
    expect(avisos(c, 'ana')).toHaveLength(antes + 1);
  });
});
