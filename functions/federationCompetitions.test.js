/**
 * Competições no SERVIDOR contra um Firestore falso: a conferência do pedido
 * de chancela (prazo, diretor credenciado, taxa por categoria), a taxa que se
 * reaproveita ou se cancela, o relatório que nasce com a aprovação, o
 * checklist e o relatório do diretor, e os convites da final do circuito
 * (enviar, aceitar, recusar, cancelar, vencer — e o suplente chamado).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const comp = require('./federationCompetitions.js');
const fed = require('./federations.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 22, 15, 0, 0); // 22/10/2026, meio-dia em Brasília
const DIA = 86400000;
const ORG = { uid: 'org', name: 'Organizador' };
const DIR = { uid: 'dir', name: 'Diretora' };
const COMP = { uid: 'comp', name: 'Competições' };
const TES = { uid: 'tes', name: 'Tesouraria' };
const ANA = { uid: 'ana', name: 'Ana' };

const TIERS = [{ id: 'g1', code: 'FPP 1000', group: 'G1', points_by_place: { 1: 1000, 2: 600 }, places: 2, participation: 10, active: true, sanction_fee_cents: 15000 }];

function cenario({ rules = {}, extra = {} } = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, modules: { tournaments: true, ranking: true }, rules, ranking_config: { tiers: TIERS } },
      'federation_staff/fpp_comp': { federation_id: 'fpp', user_id: 'comp', role: 'competitions' },
      'federation_staff/fpp_tes': { federation_id: 'fpp', user_id: 'tes', role: 'treasurer' },
      'federation_card_index/DIR12345': { kind: 'credential', federation_id: 'fpp', credential_id: 'cursoD_dir' },
      'federation_credentials/cursoD_dir': { federation_id: 'fpp', user_id: 'dir', user_name: 'Diretora Dina', kind: 'director', status: 'active', valid_until: '2027-12-31' },
      'federation_card_index/ARB12345': { kind: 'credential', federation_id: 'fpp', credential_id: 'cursoA_dir' },
      'federation_credentials/cursoA_dir': { federation_id: 'fpp', user_id: 'dir', kind: 'referee', status: 'active' },
      'federation_rankings/fpp_2026': {
        federation_id: 'fpp', season: 2026,
        categories: [{ key: 'female|open|doubles', gender_category: 'female', age_category: 'open', format: 'doubles', rows: [
          { uid: 'ana', name: 'Ana', position: 1, points: 900 }, { uid: 'bia', name: 'Bia', position: 2, points: 700 }, { uid: 'cris', name: 'Cris', position: 3, points: 500 },
        ] }],
      },
      ...extra,
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { increment: (n) => n }, logger: { info() {}, warn() {} } });
const doc = (c, path) => c.db.store.docs.get(path);
const docs = (c, prefix) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith(prefix)).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));
const avisos = (c, uid) => docs(c, 'notifications/').filter((d) => d.user_id === uid);

/** Grava o pedido do organizador e dispara o gatilho, como a função faria. */
async function pedir(c, sanction, tournament = {}, now = NOW) {
  const antes = c.db.store.docs.get('tournaments/t1') || null;
  const depois = {
    name: 'Open de Santos', creator_uid: 'org', federation_id: 'fpp', starts_at: '2026-12-05', ends_at: '2026-12-06', ...tournament,
    federation_sanction: { status: 'pending', tier: 'g1', requested_by: 'org', requested_by_name: 'Organizador', requested_at_ms: now, ...sanction },
  };
  c.db.store.docs.set('tournaments/t1', depois);
  await comp.onTournamentWritten(ctx(c, now), antes, depois, 't1');
  return doc(c, 'tournaments/t1');
}
async function mudar(c, patch, now = NOW) {
  const antes = doc(c, 'tournaments/t1');
  const depois = { ...antes, ...patch };
  c.db.store.docs.set('tournaments/t1', depois);
  await comp.onTournamentWritten(ctx(c, now), antes, depois, 't1');
  return doc(c, 'tournaments/t1');
}
const aprovar = (c, now) => mudar(c, { federation_sanction: { ...doc(c, 'tournaments/t1').federation_sanction, status: 'approved', decided_by: 'comp' } }, now);
const chamar = (c, actor, data, now) => comp.competition(ctx(c, now), actor, { federationId: 'fpp', ...data });

describe('chancela: a conferência do pedido', () => {
  it('sem prazo nem exigência: confere, cria a taxa da categoria e avisa quem pediu', async () => {
    const c = cenario();
    const t = await pedir(c, {});
    expect(t.federation_sanction.status).toBe('pending');
    expect(t.federation_sanction.checked_at_ms).toBe(NOW);
    expect(t.federation_sanction.fee_cents).toBe(15000);
    expect(t.federation_sanction.director_uid).toBe('org');
    expect(t.federation_sanction.director_verified).toBe(false);
    const [ch] = docs(c, 'federation_charges/');
    expect(ch).toMatchObject({ origin: 'sanction', amount_cents: 15000, status: 'open', payer_uid: 'org', tournament_id: 't1', tier: 'g1', federation_id: 'fpp' });
    expect(t.federation_sanction.fee_charge_id).toBe(ch.id);
    expect(avisos(c, 'org').some((a) => /Taxa de chancela/.test(a.title))).toBe(true);
  });

  it('o gatilho não confere duas vezes o mesmo pedido (nem cria outra taxa)', async () => {
    const c = cenario();
    await pedir(c, {});
    await mudar(c, { updated_by: 'x' });
    expect(docs(c, 'federation_charges/')).toHaveLength(1);
  });

  it('fora da antecedência mínima: recusado sozinho, com o motivo, e sem taxa', async () => {
    const c = cenario({ rules: { sanction_min_days: 60 } });
    const t = await pedir(c, {});
    expect(t.federation_sanction.status).toBe('rejected');
    expect(t.federation_sanction.decided_by).toBe('system');
    expect(t.federation_sanction.reason).toMatch(/60 dias/);
    expect(docs(c, 'federation_charges/')).toHaveLength(0);
    expect(avisos(c, 'org').some((a) => /recusada/.test(a.title))).toBe(true);
  });

  it('com prazo e sem data de início: recusado', async () => {
    const c = cenario({ rules: { sanction_min_days: 10 } });
    const t = await pedir(c, {}, { starts_at: '' });
    expect(t.federation_sanction.status).toBe('rejected');
    expect(t.federation_sanction.reason).toMatch(/data de início/);
  });

  it('dentro do prazo: grava os dias de antecedência', async () => {
    const c = cenario({ rules: { sanction_min_days: 30 } });
    const t = await pedir(c, {});
    expect(t.federation_sanction.status).toBe('pending');
    expect(t.federation_sanction.days_ahead).toBe(44);
  });

  it('diretor exigido: sem código, ou com credencial de outro tipo, recusa; com a de diretor, confere o nome', async () => {
    const sem = cenario({ rules: { sanction_requires_director: true } });
    expect((await pedir(sem, {})).federation_sanction.status).toBe('rejected');
    const arbitro = cenario({ rules: { sanction_requires_director: true } });
    expect((await pedir(arbitro, { director_code: 'ARB12345' })).federation_sanction.status).toBe('rejected');
    const ok = cenario({ rules: { sanction_requires_director: true } });
    const t = await pedir(ok, { director_code: 'dir 1234-5' });
    expect(t.federation_sanction.status).toBe('pending');
    expect(t.federation_sanction).toMatchObject({ director_uid: 'dir', director_name: 'Diretora Dina', director_verified: true, director_credential_id: 'cursoD_dir' });
  });

  it('credencial vencida ou de outra federação não vale', async () => {
    const vencida = cenario({ rules: { sanction_requires_director: true }, extra: { 'federation_credentials/cursoD_dir': { federation_id: 'fpp', user_id: 'dir', kind: 'director', status: 'active', valid_until: '2026-01-01' } } });
    expect((await pedir(vencida, { director_code: 'DIR12345' })).federation_sanction.status).toBe('rejected');
    const outra = cenario({ rules: { sanction_requires_director: true }, extra: { 'federation_card_index/DIR12345': { kind: 'credential', federation_id: 'fgp', credential_id: 'cursoD_dir' } } });
    expect((await pedir(outra, { director_code: 'DIR12345' })).federation_sanction.status).toBe('rejected');
  });

  it('a equipe de competições pedindo (torneio da federação) não passa por prazo nem taxa', async () => {
    const c = cenario({ rules: { sanction_min_days: 90 } });
    const t = await pedir(c, { requested_by: 'comp', requested_by_name: 'Competições' });
    expect(t.federation_sanction.status).toBe('pending');
    expect(t.federation_sanction.fee_cents).toBe(0);
    expect(docs(c, 'federation_charges/')).toHaveLength(0);
  });

  it('pedido refeito: a taxa paga que cobre é reaproveitada; a aberta de outro valor é cancelada', async () => {
    const paga = cenario({ extra: { 'federation_charges/c0': { federation_id: 'fpp', origin: 'sanction', tournament_id: 't1', amount_cents: 15000, status: 'paid', paid_at_ms: NOW - DIA } } });
    const t = await pedir(paga, {});
    expect(t.federation_sanction.fee_charge_id).toBe('c0');
    expect(t.federation_sanction.fee_paid_at_ms).toBe(NOW - DIA);
    expect(docs(paga, 'federation_charges/')).toHaveLength(1);

    const outra = cenario({ extra: { 'federation_charges/c0': { federation_id: 'fpp', origin: 'sanction', tournament_id: 't1', amount_cents: 5000, status: 'open' } } });
    const t2 = await pedir(outra, {});
    expect(doc(outra, 'federation_charges/c0').status).toBe('cancelled');
    expect(t2.federation_sanction.fee_charge_id).not.toBe('c0');
    expect(docs(outra, 'federation_charges/').filter((x) => x.status === 'open')).toHaveLength(1);
  });

  it('pedido retirado ou recusado: a taxa ainda aberta é cancelada', async () => {
    const c = cenario();
    await pedir(c, {});
    await mudar(c, { federation_id: null, federation_sanction: null });
    expect(docs(c, 'federation_charges/')[0].status).toBe('cancelled');
    const r = cenario();
    await pedir(r, {});
    await mudar(r, { federation_sanction: { ...doc(r, 'tournaments/t1').federation_sanction, status: 'rejected', reason: 'Quadras insuficientes.' } });
    expect(docs(r, 'federation_charges/')[0]).toMatchObject({ status: 'cancelled', cancel_note: 'Quadras insuficientes.' });
  });

  it('o financeiro confirma a taxa: o pedido fica sabendo e competições é avisada', async () => {
    const c = cenario();
    await pedir(c, {});
    const [ch] = docs(c, 'federation_charges/');
    await fed.chargeConfirm(ctx(c), TES, { chargeId: ch.id, action: 'confirm' });
    expect(doc(c, `federation_charges/${ch.id}`).status).toBe('paid');
    expect(doc(c, 'tournaments/t1').federation_sanction.fee_paid_at_ms).toBe(NOW);
    expect(avisos(c, 'comp').some((a) => /Taxa de chancela paga/.test(a.title))).toBe(true);
    expect(avisos(c, 'org').some((a) => /Pagamento confirmado/.test(a.title))).toBe(true);
  });

  it('o financeiro cancela (dispensa) a taxa: o pedido registra a dispensa', async () => {
    const c = cenario();
    await pedir(c, {});
    const [ch] = docs(c, 'federation_charges/');
    await fed.chargeConfirm(ctx(c), TES, { chargeId: ch.id, action: 'cancel', note: 'Dispensada' });
    expect(doc(c, 'tournaments/t1').federation_sanction.fee_cancelled_at_ms).toBe(NOW);
  });
});

describe('chancela aprovada: o relatório do diretor', () => {
  async function aprovado(now = NOW) {
    const c = cenario();
    await pedir(c, { director_code: 'DIR12345' });
    await aprovar(c, now);
    return c;
  }

  it('a aprovação cria o relatório e avisa o diretor', async () => {
    const c = await aprovado();
    expect(doc(c, 'federation_tournament_reports/t1')).toMatchObject({ federation_id: 'fpp', director_uid: 'dir', organizer_uid: 'org', director_verified: true, checklist: null, report: null, starts_at: '2026-12-05' });
    expect(avisos(c, 'dir').some((a) => /diretor do torneio/.test(a.title))).toBe(true);
  });

  it('checklist: só o diretor, quem organiza ou a equipe; completo quando tudo marcado', async () => {
    const c = await aprovado();
    await expect(chamar(c, ANA, { action: 'checklist', tournamentId: 't1', items: {} })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(c, DIR, { action: 'checklist', tournamentId: 't1', items: { insurance: true, referees: true, venue: true, medical: true, schedule: true } });
    expect(r.complete).toBe(true);
    expect(doc(c, 'federation_tournament_reports/t1').checklist).toMatchObject({ complete: true, by: 'dir' });
  });

  it('relatório: só a partir do início, lesão contada pede descrição, e a primeira entrega avisa competições', async () => {
    const c = await aprovado();
    await expect(chamar(c, DIR, { action: 'report', tournamentId: 't1', entrants: 30 })).rejects.toMatchObject({ code: 'failed-precondition' });
    const depois = Date.UTC(2026, 11, 6, 15);
    await expect(chamar(c, DIR, { action: 'report', tournamentId: 't1', injuries: 1 }, depois)).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, DIR, { action: 'report', tournamentId: 't1', entrants: 30, walkovers: 2, injuries: 1, injuries_text: 'Torção no tornozelo.' }, depois);
    expect(doc(c, 'federation_tournament_reports/t1').report).toMatchObject({ entrants: 30, walkovers: 2, injuries: 1, revisions: 0, by: 'dir' });
    expect(avisos(c, 'comp').filter((a) => /Relatório do torneio/.test(a.title))).toHaveLength(1);
    await chamar(c, DIR, { action: 'report', tournamentId: 't1', entrants: 31 }, depois);
    expect(doc(c, 'federation_tournament_reports/t1').report.revisions).toBe(1);
    expect(avisos(c, 'comp').filter((a) => /Relatório do torneio/.test(a.title))).toHaveLength(1);
  });
});

describe('final do circuito', () => {
  async function comFinal() {
    const c = cenario();
    await pedir(c, {});
    await aprovar(c);
    return c;
  }
  const convites = (c) => docs(c, 'federation_final_invites/');

  it('só competições envia, e só para torneio chancelado por esta federação', async () => {
    const c = await comFinal();
    await expect(chamar(c, ORG, { action: 'final_send', tournamentId: 't1', season: 2026, per_category: 2 })).rejects.toMatchObject({ code: 'permission-denied' });
    const sem = cenario();
    await pedir(sem, {});
    await expect(chamar(sem, COMP, { action: 'final_send', tournamentId: 't1', season: 2026 })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('convida os N melhores do ranking do ano, com prazo, e avisa cada um', async () => {
    const c = await comFinal();
    const r = await chamar(c, COMP, { action: 'final_send', tournamentId: 't1', season: 2026, per_category: 2, accept_days: 5 });
    expect(r.invited).toBe(2);
    const cs = convites(c);
    expect(cs.map((x) => x.user_id).sort()).toEqual(['ana', 'bia']);
    expect(cs[0]).toMatchObject({ status: 'invited', season: 2026, federation_acronym: 'FPP', tournament_name: 'Open de Santos', expires_at_ms: NOW + 5 * DIA, substitute: false });
    expect(avisos(c, 'ana').some((a) => /Convite para a final/.test(a.title))).toBe(true);
    expect(doc(c, 'federation_tournament_reports/t1').final).toMatchObject({ per_category: 2, season: 2026 });
    // Reenviar não duplica.
    expect((await chamar(c, COMP, { action: 'final_send', tournamentId: 't1', season: 2026, per_category: 2 })).invited).toBe(0);
  });

  it('aceitar fecha a vaga; recusar chama o suplente; só o próprio convidado responde', async () => {
    const c = await comFinal();
    await chamar(c, COMP, { action: 'final_send', tournamentId: 't1', season: 2026, per_category: 2 });
    const id = (uid) => convites(c).find((x) => x.user_id === uid).id;
    await expect(chamar(c, ANA, { action: 'final_answer', inviteId: id('bia'), accept: true })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, ANA, { action: 'final_answer', inviteId: id('ana'), accept: true });
    expect(doc(c, `federation_final_invites/${id('ana')}`).status).toBe('accepted');
    await expect(chamar(c, ANA, { action: 'final_answer', inviteId: id('ana'), accept: false })).rejects.toMatchObject({ code: 'failed-precondition' });
    const r = await chamar(c, { uid: 'bia', name: 'Bia' }, { action: 'final_answer', inviteId: id('bia'), accept: false });
    expect(r.substitutes).toBe(1);
    expect(convites(c).find((x) => x.user_id === 'cris')).toMatchObject({ status: 'invited', substitute: true });
  });

  it('cancelar exige motivo, avisa e chama o próximo', async () => {
    const c = await comFinal();
    await chamar(c, COMP, { action: 'final_send', tournamentId: 't1', season: 2026, per_category: 1 });
    const [inv] = convites(c);
    await expect(chamar(c, COMP, { action: 'final_cancel', inviteId: inv.id, reason: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(c, COMP, { action: 'final_cancel', inviteId: inv.id, reason: 'Suspensão disciplinar.' });
    expect(r.substitutes).toBe(1);
    expect(doc(c, `federation_final_invites/${inv.id}`).status).toBe('cancelled');
    expect(avisos(c, 'ana').some((a) => /cancelado/.test(a.title))).toBe(true);
  });

  it('varredura: convite sem resposta vence e o próximo do ranking é chamado; depois do início, ninguém mais', async () => {
    const c = await comFinal();
    await chamar(c, COMP, { action: 'final_send', tournamentId: 't1', season: 2026, per_category: 1, accept_days: 3 });
    const r = await comp.sweep(ctx(c, NOW + 4 * DIA));
    expect(r).toEqual({ expired: 1, substitutes: 1 });
    expect(convites(c).find((x) => x.user_id === 'ana').status).toBe('expired');
    expect(convites(c).find((x) => x.user_id === 'bia').status).toBe('invited');
    const tarde = await comp.sweep(ctx(c, Date.UTC(2026, 11, 5, 15) + 3 * DIA));
    expect(tarde.substitutes).toBe(0);
  });
});
