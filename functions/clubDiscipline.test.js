/**
 * Disciplina e ouvidoria do clube no SERVIDOR (Firestore falso): só o cargo `discipline` (ou a
 * administração) aplica; a suspensão grava o fim na filiação e a carteirinha mostra "Suspensa";
 * a multa vira cobrança que NÃO renova a filiação; a exclusão encerra a filiação e o recurso
 * aceito a devolve com código novo; o recurso é de uma vez só e da própria pessoa; a ouvidoria
 * anônima não guarda quem enviou e o protocolo só diz o estado.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cd = require('./clubDiscipline.js');
const ca = require('./clubAssociation.js');
const m = require('./federationMembership.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0);
const PRES = { uid: 'pres', name: 'Presidente' };
const DISC = { uid: 'disc', name: 'Conselho de ética' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };

function cenario({ flag = true, associacao = true, publicado = true } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: associacao, published: publicado } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_disc': { club_id: 'c1', user_id: 'disc', role: 'member' },
    'club_members/c1_fin': { club_id: 'c1', user_id: 'fin', role: 'member' },
    'club_members/c1_ana': { club_id: 'c1', user_id: 'ana', role: 'member' },
    'club_members/c1_bia': { club_id: 'c1', user_id: 'bia', role: 'member' },
    'club_x/c1/staff/disc': { club_id: 'c1', user_id: 'disc', perms: ['discipline'], term_end_ms: 0 },
    'club_x/c1/staff/fin': { club_id: 'c1', user_id: 'fin', perms: ['finance'], term_end_ms: 0 },
    'club_x/c1/aff/ana': { club_id: 'c1', user_id: 'ana', user_name: 'Ana', status: 'active', plan_id: 'anual', valid_until: '2028-01-01', card_code: 'CDEANA2345' },
    'club_x/c1/aff/bia': { club_id: 'c1', user_id: 'bia', user_name: 'Bia', status: 'active', plan_id: 'anual', valid_until: '2028-01-01', card_code: 'CDEBBA2345' },
    'club_card_index/CDEANA2345': { club_id: 'c1', user_id: 'ana' },
    'club_card_index/CDEBBA2345': { club_id: 'c1', user_id: 'bia' },
  });
}
const ctx = (db, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (db, actor, data, now) => cd.discipline(ctx(db, now), actor, { clubId: 'c1', ...data });
const doc = (db, path) => db.store.docs.get(path);
const aff = (db, uid) => doc(db, `club_x/c1/aff/${uid}`);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);
const cobrancas = (db) => [...db.store.docs.entries()].filter(([p]) => p.startsWith('club_x/c1/charges/')).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));
const hoje = m.isoDateBR(NOW);

describe('disciplina do clube: quem pode e o que vale', () => {
  it('flag desligada, associação fechada, sem cargo e ação desconhecida são recusados', async () => {
    await expect(chamar(cenario({ flag: false }), DISC, { action: 'apply', userId: 'ana', kind: 'warning', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ associacao: false }), DISC, { action: 'apply', userId: 'ana', kind: 'warning', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const db = cenario();
    await expect(chamar(db, FIN, { action: 'apply', userId: 'ana', kind: 'warning', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ANA, { action: 'apply', userId: 'bia', kind: 'warning', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, DISC, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('valida a sanção: tipo, motivo, fim da suspensão, valor da multa; ninguém sanciona a si mesmo', async () => {
    const db = cenario();
    await expect(chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'prisao', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'warning', reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'suspension', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'suspension', reason: 'Conduta em quadra', ends_at: '2027-03-01' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'fine', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, DISC, { action: 'apply', userId: 'naoexiste', kind: 'warning', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'not-found' });
    await expect(chamar(cenario(), PRES, { action: 'apply', userId: 'pres', kind: 'warning', reason: 'Conduta em quadra' })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('advertência: registra, avisa a pessoa e não mexe na filiação', async () => {
    const db = cenario();
    const r = await chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'warning', reason: 'Palavrões em quadra' });
    expect(doc(db, `club_x/c1/cases/${r.sanctionId}`)).toMatchObject({ club_id: 'c1', user_id: 'ana', kind: 'warning', status: 'active', applied_by: 'disc', appeal: null });
    expect(aff(db, 'ana').discipline_until_ms).toBeUndefined();
    expect(avisosPara(db, 'ana')).toHaveLength(1);
  });

  it('suspensão: grava o fim na filiação e a conta do estado passa a dizer "suspensa"', async () => {
    const db = cenario();
    const r = await chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'suspension', reason: 'Agressão verbal', ends_at: '2027-04-10' });
    const fim = m.endOfDayBrMs('2027-04-10');
    expect(aff(db, 'ana')).toMatchObject({ discipline_until_ms: fim, discipline_sanction_id: r.sanctionId });
    expect(m.membershipState(aff(db, 'ana'), hoje, NOW).status).toBe('suspended');
    // A carteirinha pública mostra a suspensão.
    const v = await ca.verify(ctx(db), { code: 'CDEANA2345' });
    expect(v).toMatchObject({ found: true, status: 'suspended' });
  });

  it('duas suspensões: desfazer uma não apaga a outra', async () => {
    const db = cenario();
    const curta = await chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'suspension', reason: 'Primeira falta grave', ends_at: '2027-03-20' });
    await chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'suspension', reason: 'Segunda falta grave', ends_at: '2027-05-01' });
    expect(aff(db, 'ana').discipline_until_ms).toBe(m.endOfDayBrMs('2027-05-01'));
    await chamar(db, DISC, { action: 'end', sanctionId: curta.sanctionId, note: 'Cumprida' });
    expect(aff(db, 'ana').discipline_until_ms).toBe(m.endOfDayBrMs('2027-05-01'));
  });

  it('multa: vira cobrança do clube, e quitá-la NÃO renova a filiação', async () => {
    const db = cenario();
    const r = await chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'fine', reason: 'Dano à quadra', fine_cents: 15000 });
    expect(r.chargeId).toBeTruthy();
    const c = cobrancas(db)[0];
    expect(c).toMatchObject({ origin: 'fine', amount_cents: 15000, status: 'open', user_id: 'ana', sanction_id: r.sanctionId, plan_name: 'Multa disciplinar' });
    const antes = aff(db, 'ana').valid_until;
    await ca.association(ctx(db), FIN, { clubId: 'c1', action: 'charge_confirm', decision: 'confirm', chargeId: r.chargeId });
    expect(cobrancas(db)[0].status).toBe('paid');
    expect(aff(db, 'ana')).toMatchObject({ status: 'active', valid_until: antes, card_code: 'CDEANA2345' });
  });

  it('exclusão: encerra a filiação (não o clube) e cancela as cobranças; o recurso aceito a devolve com código novo', async () => {
    const db = cenario({});
    db.store.docs.set('club_x/c1/charges/aberta', { club_id: 'c1', user_id: 'ana', status: 'open', origin: 'renewal' });
    const r = await chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'exclusion', reason: 'Fraude em resultado' });
    expect(aff(db, 'ana')).toMatchObject({ status: 'cancelled', card_code: null, excluded_by_sanction_id: r.sanctionId, status_before_exclusion: 'active' });
    expect(doc(db, 'club_card_index/CDEANA2345')).toBeUndefined();
    expect(doc(db, 'club_members/c1_ana')).toBeTruthy(); // continua no clube
    expect(doc(db, 'club_x/c1/charges/aberta').status).toBe('cancelled');
    await chamar(db, ANA, { action: 'appeal', sanctionId: r.sanctionId, text: 'Foi um engano, tenho as provas do jogo.' });
    await chamar(db, DISC, { action: 'decide_appeal', sanctionId: r.sanctionId, decision: 'overturn', note: 'Provas aceitas' });
    expect(aff(db, 'ana')).toMatchObject({ status: 'active', excluded_by_sanction_id: null });
    expect(aff(db, 'ana').card_code).toBeTruthy();
    expect(aff(db, 'ana').card_code).not.toBe('CDEANA2345');
    expect(doc(db, `club_card_index/${aff(db, 'ana').card_code}`)).toMatchObject({ club_id: 'c1', user_id: 'ana' });
  });

  it('o recurso é da própria pessoa, uma vez só, com texto; o aceite desfaz a suspensão, o negado mantém', async () => {
    const db = cenario();
    const r = await chamar(db, DISC, { action: 'apply', userId: 'ana', kind: 'suspension', reason: 'Agressão verbal', ends_at: '2027-06-01' });
    await expect(chamar(db, BIA, { action: 'appeal', sanctionId: r.sanctionId, text: 'Não é minha mas recorro mesmo assim' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ANA, { action: 'appeal', sanctionId: r.sanctionId, text: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, ANA, { action: 'appeal', sanctionId: r.sanctionId, text: 'Houve um mal-entendido e peço revisão.' });
    expect(doc(db, `club_x/c1/cases/${r.sanctionId}`)).toMatchObject({ status: 'appealed' });
    expect(avisosPara(db, 'disc').length).toBeGreaterThan(0);
    await expect(chamar(db, ANA, { action: 'appeal', sanctionId: r.sanctionId, text: 'Segundo recurso, não pode.....' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, ANA, { action: 'decide_appeal', sanctionId: r.sanctionId, decision: 'overturn' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, DISC, { action: 'decide_appeal', sanctionId: r.sanctionId, decision: 'talvez' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, DISC, { action: 'decide_appeal', sanctionId: r.sanctionId, decision: 'uphold', note: 'Mantida' });
    expect(doc(db, `club_x/c1/cases/${r.sanctionId}`)).toMatchObject({ status: 'upheld' });
    expect(aff(db, 'ana').discipline_until_ms).toBe(m.endOfDayBrMs('2027-06-01'));
    // Mantida: não cabe novo recurso, e pode ser encerrada antes do prazo.
    await expect(chamar(db, ANA, { action: 'appeal', sanctionId: r.sanctionId, text: 'Mais um recurso que não deve valer.' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, DISC, { action: 'end', sanctionId: r.sanctionId, note: 'Ânimos serenados' });
    expect(aff(db, 'ana').discipline_until_ms).toBe(0);
    await expect(chamar(db, DISC, { action: 'end', sanctionId: r.sanctionId })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('multa anulada no recurso cancela a cobrança aberta', async () => {
    const db = cenario();
    const r = await chamar(db, DISC, { action: 'apply', userId: 'bia', kind: 'fine', reason: 'Dano à quadra', fine_cents: 5000 });
    await chamar(db, BIA, { action: 'appeal', sanctionId: r.sanctionId, text: 'A quadra já estava danificada antes.' });
    await chamar(db, DISC, { action: 'decide_appeal', sanctionId: r.sanctionId, decision: 'overturn' });
    expect(cobrancas(db)[0].status).toBe('cancelled');
  });
});

describe('ouvidoria do clube', () => {
  it('exige conta, clube aberto e texto; anônima não guarda quem enviou; avisa a disciplina', async () => {
    await expect(chamar(cenario({ publicado: false }), ANA, { action: 'report', body: 'Aconteceu algo grave na quadra 2 ontem.' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const db = cenario();
    await expect(chamar(db, ANA, { action: 'report', body: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const anon = await chamar(db, ANA, { action: 'report', kind: 'conduct', body: 'Aconteceu algo grave na quadra 2 ontem.', anonymous: true });
    const ident = await chamar(db, BIA, { action: 'report', kind: 'invalido', body: 'Reclamação sobre a organização do torneio.' });
    expect(doc(db, `club_x/c1/ombud/${anon.reportId}`)).toMatchObject({ anonymous: true, reporter_uid: null, status: 'open', kind: 'conduct' });
    expect(doc(db, `club_x/c1/ombud/${ident.reportId}`)).toMatchObject({ anonymous: false, reporter_uid: 'bia', kind: 'other' });
    // o id É o protocolo: 10 letras e números maiúsculos, para quem o digita achar o documento
    expect(anon.reportId).toMatch(/^[A-Z0-9]{10}$/);
    expect(avisosPara(db, 'disc').length).toBe(2);
    expect(avisosPara(db, 'ana')).toHaveLength(0);
  });

  it('o protocolo diz só o estado: a anônima a quem tem o protocolo, a identificada só a quem enviou', async () => {
    const db = cenario();
    const anon = await chamar(db, ANA, { action: 'report', body: 'Aconteceu algo grave na quadra 2 ontem.', anonymous: true });
    const ident = await chamar(db, BIA, { action: 'report', body: 'Reclamação sobre a organização do torneio.' });
    const a1 = await chamar(db, BIA, { action: 'report_status', reportId: anon.reportId });
    expect(a1.report).toEqual({ id: anon.reportId, status: 'open', kind: 'other', created_at_ms: NOW, anonymous: true });
    expect(a1.report.body).toBeUndefined();
    await expect(chamar(db, ANA, { action: 'report_status', reportId: ident.reportId })).rejects.toMatchObject({ code: 'not-found' });
    await expect(chamar(db, ANA, { action: 'report_status', reportId: 'inexistente' })).rejects.toMatchObject({ code: 'not-found' });
    expect((await chamar(db, BIA, { action: 'report_status', reportId: ident.reportId })).report.status).toBe('open');
  });

  it('só o cargo trata: apura, anota e conclui; concluída não volta a ser editada', async () => {
    const db = cenario();
    const r = await chamar(db, ANA, { action: 'report', body: 'Aconteceu algo grave na quadra 2 ontem.', anonymous: true });
    await expect(chamar(db, ANA, { action: 'report_update', reportId: r.reportId, status: 'in_review' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, DISC, { action: 'report_update', reportId: r.reportId, status: 'quase' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, DISC, { action: 'report_update', reportId: r.reportId, status: 'in_review', notes: 'Ouvi o árbitro.' });
    expect(doc(db, `club_x/c1/ombud/${r.reportId}`)).toMatchObject({ status: 'in_review', notes: 'Ouvi o árbitro.', handled_by: 'disc' });
    await chamar(db, PRES, { action: 'report_update', reportId: r.reportId, status: 'closed' });
    await expect(chamar(db, DISC, { action: 'report_update', reportId: r.reportId, notes: 'tarde demais' })).rejects.toMatchObject({ code: 'failed-precondition' });
    // Quem enviou vê o estado, nunca as anotações.
    const est = await chamar(db, BIA, { action: 'report_status', reportId: r.reportId });
    expect(est.report).toMatchObject({ status: 'closed' });
    expect(JSON.stringify(est)).not.toContain('Ouvi o árbitro');
  });
});
