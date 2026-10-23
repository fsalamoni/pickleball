/**
 * Camada nacional no SERVIDOR contra um Firestore falso: o admin da
 * plataforma marca a confederação; a estadual pede e a confederação aceita
 * (o espelho `national_body` nasce e some com o vínculo); uma confederação
 * por estadual; o ranking nacional soma as filiadas; a anuidade é lançada,
 * declarada, confirmada (e entra nas contas das duas); a varredura avisa a
 * vencida uma vez; a transferência entre duas filiadas espera a homologação.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nac = require('./federationNational.js');
const feds = require('./federations.js');
const transfers = require('./federationTransfers.js');
const accounts = require('./federationAccounts.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0); // 23/10/2026, meio-dia em Brasília
const ADMIN = { uid: 'plat', name: 'Admin', isPlatformAdmin: true };
const CB = { uid: 'cbpres', name: 'Presidente CBP' };
const CBFIN = { uid: 'cbfin', name: 'Financeiro CBP' };
const CBSEC = { uid: 'cbsec', name: 'Secretaria CBP' };
const GP = { uid: 'gppres', name: 'Presidente FGP' };
const GPFIN = { uid: 'gpfin', name: 'Financeiro FGP' };
const PP = { uid: 'pppres', name: 'Presidente FPP' };
const PPSEC = { uid: 'ppsec', name: 'Secretaria FPP' };
const ANA = { uid: 'ana', name: 'Ana' };

const ponto = (fed, uid, pts) => ({ federation_id: fed, federation_acronym: fed.toUpperCase(), uid, name: uid, season: 2026, status: 'awarded', points: pts, result_id: `${fed}_t_m`, category: 'open|open|doubles', tournament_name: `Aberto ${fed}`, date: '2026-05-01' });

function cenario(extra = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/cbp': { name: 'Confederação Brasileira', acronym: 'CBP', slug: 'cbp', status: 'approved', published: true, level: 'national', created_by: 'cbpres', modules: { ranking: true, accounts: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', state: 'RS', status: 'approved', published: true, member_count: 40, modules: { ranking: true, accounts: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', state: 'SP', status: 'approved', published: true, member_count: 10, modules: {}, rules: { transfer_release_days: 15 } },
      'federation_staff/cbp_cbpres': { federation_id: 'cbp', user_id: 'cbpres', role: 'president' },
      'federation_staff/cbp_cbfin': { federation_id: 'cbp', user_id: 'cbfin', role: 'custom', perms: ['finance'] },
      'federation_staff/cbp_cbsec': { federation_id: 'cbp', user_id: 'cbsec', role: 'custom', perms: ['members'] },
      'federation_staff/fgp_gppres': { federation_id: 'fgp', user_id: 'gppres', role: 'president' },
      'federation_staff/fgp_gpfin': { federation_id: 'fgp', user_id: 'gpfin', role: 'custom', perms: ['finance'] },
      'federation_staff/fpp_pppres': { federation_id: 'fpp', user_id: 'pppres', role: 'president' },
      'federation_staff/fpp_ppsec': { federation_id: 'fpp', user_id: 'ppsec', role: 'custom', perms: ['members'] },
      'federation_points/fgp_t_m_ana': ponto('fgp', 'ana', 100),
      'federation_points/fpp_t_m_ana': ponto('fpp', 'ana', 50),
      'federation_points/fpp_t_m_bia': ponto('fpp', 'bia', 70),
      ...extra,
    }),
  };
}
const ctx = (c, now = NOW) => ({ db: c.db, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, fed, data, now) => nac.national(ctx(c, now), actor, { federationId: fed, ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && (!uid || d.user_id === uid)).map(([, d]) => d);

async function confederar(c) {
  await feds.review(ctx(c), ADMIN, { action: 'confederation', federationId: 'cbp' });
}
async function filiar(c, fed, pres) {
  const r = await chamar(c, pres, fed, { action: 'link_request', confId: 'cbp' });
  await chamar(c, CB, 'cbp', { action: 'link_accept', linkId: r.linkId });
  return r.linkId;
}

describe('confederação e vínculo das estaduais', () => {
  it('só o admin da plataforma marca a confederação; sem ela, ninguém se filia', async () => {
    const c = cenario();
    await expect(chamar(c, GP, 'fgp', { action: 'link_request', confId: 'cbp' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(feds.review(ctx(c), CB, { action: 'confederation', federationId: 'cbp' })).rejects.toMatchObject({ code: 'permission-denied' });
    await confederar(c);
    expect(doc(c, 'federations/cbp').confederation).toBe(true);
    expect(avisos(c, 'cbpres').some((n) => /confederação/.test(n.title))).toBe(true);
  });

  it('a estadual pede, a confederação aceita: nasce o espelho; sair apaga o espelho e pede motivo', async () => {
    const c = cenario();
    await confederar(c);
    await expect(chamar(c, GPFIN, 'fgp', { action: 'link_request', confId: 'cbp' })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(c, GP, 'fgp', { action: 'link_request', confId: 'cbp', message: 'Queremos entrar' });
    expect(doc(c, `federation_national_links/${r.linkId}`)).toMatchObject({ status: 'pending', conf_id: 'cbp', federation_id: 'fgp', federation_state: 'RS' });
    expect(avisos(c, 'cbpres').some((n) => n.link.includes('rede-filiadas'))).toBe(true);
    await expect(chamar(c, GP, 'fgp', { action: 'link_accept', linkId: r.linkId })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, CB, 'cbp', { action: 'link_accept', linkId: r.linkId });
    expect(doc(c, 'federations/fgp').national_body).toMatchObject({ id: 'cbp', acronym: 'CBP', slug: 'cbp' });
    await expect(chamar(c, GP, 'fgp', { action: 'link_leave', linkId: r.linkId })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, GP, 'fgp', { action: 'link_leave', linkId: r.linkId, reason: 'Decisão da assembleia' });
    expect(doc(c, 'federations/fgp').national_body).toBeNull();
    expect(doc(c, `federation_national_links/${r.linkId}`)).toMatchObject({ status: 'left', reason: 'Decisão da assembleia' });
  });

  it('a confederação convida; uma confederação por estadual; confederação com filiadas não perde o papel', async () => {
    const c = cenario({ 'federations/cbx': { name: 'Outra Confederação', acronym: 'CBX', status: 'approved', confederation: true } });
    await confederar(c);
    const inv = await chamar(c, CB, 'cbp', { action: 'link_invite', targetId: 'fgp' });
    expect(doc(c, `federation_national_links/${inv.linkId}`).status).toBe('invited');
    await chamar(c, GP, 'fgp', { action: 'link_accept', linkId: inv.linkId });
    await expect(chamar(c, GP, 'fgp', { action: 'link_request', confId: 'cbx' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(feds.review(ctx(c), ADMIN, { action: 'unconfederation', federationId: 'cbp' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(feds.review(ctx(c), ADMIN, { action: 'confederation', federationId: 'fgp' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('ranking nacional', () => {
  it('soma os lançamentos das filiadas e some com a que sai', async () => {
    const c = cenario();
    await confederar(c);
    await filiar(c, 'fgp', GP);
    let r = doc(c, 'federation_rankings/cbp_nacional_2026');
    expect(r).toMatchObject({ federation_id: 'cbp', scope: 'national', season: 2026 });
    expect(r.general.map((l) => [l.uid, l.points])).toEqual([['ana', 100]]);
    await filiar(c, 'fpp', PP);
    r = doc(c, 'federation_rankings/cbp_nacional_2026');
    expect(r.general.map((l) => [l.uid, l.points])).toEqual([['ana', 150], ['bia', 70]]);
    expect(r.general[0].results.map((x) => x.federation_acronym).sort()).toEqual(['FGP', 'FPP']);
    expect(r.uids).toEqual(['ana', 'bia']);
    const link = [...c.db.store.docs.keys()].find((k) => k === 'federation_national_links/cbp_fpp');
    await chamar(c, CB, 'cbp', { action: 'link_remove', linkId: link.split('/')[1], reason: 'Estatuto descumprido' });
    expect(doc(c, 'federation_rankings/cbp_nacional_2026').general.map((l) => [l.uid, l.points])).toEqual([['ana', 100]]);
  });

  it('o ranking da filiada refaz o nacional junto; ano fechado não muda', async () => {
    const c = cenario();
    await confederar(c);
    await filiar(c, 'fgp', GP);
    c.db.store.docs.set('federation_points/fgp_t2_m_caio', { ...ponto('fgp', 'caio', 30), result_id: 'fgp_t2_m' });
    await require('./federationRanking.js').recomputeSeason(ctx(c), 'fgp', 2026);
    expect(doc(c, 'federation_rankings/cbp_nacional_2026').general.map((l) => l.uid)).toEqual(['ana', 'caio']);
    expect(await nac.recomputeNational(ctx(c, Date.UTC(2027, 1, 2)), 'cbp', 2026)).toBeNull();
  });
});

describe('regras da rede e anuidade', () => {
  it('lança, declara, confirma e entra nas contas das duas', async () => {
    const c = cenario();
    await confederar(c);
    await filiar(c, 'fgp', GP);
    await expect(chamar(c, CBFIN, 'cbp', { action: 'dues_issue', year: 2026 })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, CBFIN, 'cbp', { action: 'config_save', config: { homologation_days: 10, dues_fixed_cents: 100000, dues_per_member_cents: 500, dues_due_md: '10-31' } })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, CB, 'cbp', { action: 'config_save', config: { homologation_days: 10, dues_fixed_cents: 100000, dues_per_member_cents: 500, dues_due_md: '10-31' } });
    expect(await chamar(c, CBFIN, 'cbp', { action: 'dues_issue', year: 2026 })).toMatchObject({ created: 1, existing: 0 });
    expect(await chamar(c, CBFIN, 'cbp', { action: 'dues_issue', year: 2026 })).toMatchObject({ created: 0, existing: 1 });
    expect(doc(c, 'federation_dues/cbp_fgp_2026')).toMatchObject({ status: 'open', amount_cents: 120000, member_count: 40, due: '2026-10-31' });
    expect(avisos(c, 'gpfin').some((n) => n.link.includes('confederacao-anuidades'))).toBe(true);
    await expect(chamar(c, GPFIN, 'cbp', { action: 'dues_confirm', duesId: 'cbp_fgp_2026' })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, GPFIN, 'fgp', { action: 'dues_declare', duesId: 'cbp_fgp_2026', note: 'Pix enviado' });
    expect(avisos(c, 'cbfin').some((n) => n.link.includes('rede-anuidades'))).toBe(true);
    await chamar(c, CBFIN, 'cbp', { action: 'dues_confirm', duesId: 'cbp_fgp_2026', date: '2026-10-22' });
    expect(doc(c, 'federation_dues/cbp_fgp_2026')).toMatchObject({ status: 'paid', paid_at: '2026-10-22' });
    const conf = await nac.contas(ctx(c), { id: 'cbp', confederation: true });
    const est = await nac.contas(ctx(c), { id: 'fgp' });
    expect(conf.receitas).toEqual([expect.objectContaining({ category: 'memberships', amount_cents: 120000, auto: 'dues' })]);
    expect(est.despesas).toEqual([expect.objectContaining({ category: 'taxes', amount_cents: 120000, auto: 'dues' })]);
    expect(accounts.accounts).toBeTypeOf('function');
    await expect(chamar(c, CBFIN, 'cbp', { action: 'dues_reopen', duesId: 'cbp_fgp_2026' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('período com prestação enviada não aceita a confirmação', async () => {
    const c = cenario({ 'federation_account_reports/fgp_2026': { federation_id: 'fgp', period: '2026', status: 'submitted' } });
    await confederar(c);
    await filiar(c, 'fgp', GP);
    await chamar(c, CB, 'cbp', { action: 'config_save', config: { homologation_days: 15, dues_fixed_cents: 1000, dues_per_member_cents: 0, dues_due_md: '03-31' } });
    await chamar(c, CBFIN, 'cbp', { action: 'dues_issue', year: 2026 });
    await expect(chamar(c, CBFIN, 'cbp', { action: 'dues_confirm', duesId: 'cbp_fgp_2026', date: '2026-10-22' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('a vencida avisa uma vez', async () => {
    const c = cenario({ 'federation_dues/cbp_fgp_2026': { conf_id: 'cbp', conf_acronym: 'CBP', federation_id: 'fgp', year: 2026, status: 'open', due: '2026-03-31', amount_cents: 1000, warned_for: '' } });
    expect(await nac.sweep(ctx(c))).toEqual({ notices: 1 });
    expect(await nac.sweep(ctx(c))).toEqual({ notices: 0 });
    expect(avisos(c, 'gpfin')).toHaveLength(1);
  });
});

describe('homologação da transferência entre filiadas', () => {
  const comAna = () => ({
    'federation_members/fpp_ana': { federation_id: 'fpp', user_id: 'ana', user_name: 'Ana', status: 'active', plan_id: 'p', valid_until: '2027-01-01' },
  });

  it('liberada pela antiga, espera a confederação; homologada, encerra a filiação antiga', async () => {
    const c = cenario(comAna());
    await confederar(c);
    await filiar(c, 'fgp', GP);
    await filiar(c, 'fpp', PP);
    const t = await transfers.transfer(ctx(c), ANA, { action: 'request', federationId: 'fpp', kind: 'federation', toFederationId: 'fgp' });
    await transfers.transfer(ctx(c), PPSEC, { action: 'approve', transferId: t.transferId });
    expect(doc(c, `federation_transfers/${t.transferId}`)).toMatchObject({ status: 'homologation', homologation_by: 'cbp', homologation_deadline: '2026-11-07' });
    expect(doc(c, 'federation_members/fpp_ana').status).toBe('active');
    expect(avisos(c, 'cbsec').some((n) => n.link.includes('rede-homologacoes'))).toBe(true);
    await expect(transfers.transfer(ctx(c), CBFIN, { action: 'homologate', transferId: t.transferId })).rejects.toMatchObject({ code: 'permission-denied' });
    await transfers.transfer(ctx(c), CBSEC, { action: 'homologate', transferId: t.transferId });
    expect(doc(c, `federation_transfers/${t.transferId}`)).toMatchObject({ status: 'approved', homologated_by: 'cbsec' });
    expect(doc(c, 'federation_members/fpp_ana')).toMatchObject({ status: 'cancelled', released_to_federation_id: 'fgp' });
  });

  it('negada, a filiação fica como estava; sem resposta no prazo, a varredura homologa', async () => {
    const c = cenario(comAna());
    await confederar(c);
    await filiar(c, 'fgp', GP);
    await filiar(c, 'fpp', PP);
    const t = await transfers.transfer(ctx(c), ANA, { action: 'request', federationId: 'fpp', kind: 'federation', toFederationId: 'fgp' });
    await transfers.transfer(ctx(c), PPSEC, { action: 'approve', transferId: t.transferId });
    await expect(transfers.transfer(ctx(c), CBSEC, { action: 'deny', transferId: t.transferId })).rejects.toMatchObject({ code: 'invalid-argument' });
    await transfers.transfer(ctx(c), CBSEC, { action: 'deny', transferId: t.transferId, reason: 'Documentação incompleta' });
    expect(doc(c, `federation_transfers/${t.transferId}`)).toMatchObject({ status: 'denied', deny_reason: 'Documentação incompleta' });
    expect(doc(c, 'federation_members/fpp_ana').status).toBe('active');

    const t2 = await transfers.transfer(ctx(c), ANA, { action: 'request', federationId: 'fpp', kind: 'federation', toFederationId: 'fgp' });
    await transfers.transfer(ctx(c), PPSEC, { action: 'approve', transferId: t2.transferId });
    expect((await transfers.sweep(ctx(c))).homologadas).toBe(0);
    expect((await transfers.sweep(ctx(c, NOW + 16 * 86400000))).homologadas).toBe(1);
    expect(doc(c, `federation_transfers/${t2.transferId}`)).toMatchObject({ status: 'approved', auto_homologated: true });
  });

  it('entre federações sem confederação comum, a liberação vale sozinha (como antes)', async () => {
    const c = cenario(comAna());
    await confederar(c);
    await filiar(c, 'fgp', GP);
    const t = await transfers.transfer(ctx(c), ANA, { action: 'request', federationId: 'fpp', kind: 'federation', toFederationId: 'fgp' });
    await transfers.transfer(ctx(c), PPSEC, { action: 'approve', transferId: t.transferId });
    expect(doc(c, `federation_transfers/${t.transferId}`).status).toBe('approved');
  });
});
