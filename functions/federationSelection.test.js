/**
 * Seleção e editais no SERVIDOR contra um Firestore falso: a convocação pelo
 * ranking (publicar, aceitar, recusar e o suplente chamado, o prazo que vence,
 * a lista pública sem uid, os documentos conferidos, o fechamento), os custos
 * que só o financeiro marca como pagos, e o edital do começo ao fim
 * (publicar, inscrever, fechar sozinho, decidir, resultado, recurso, pagar).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sel = require('./federationSelection.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 22, 15, 0, 0); // 22/10/2026, meio-dia em Brasília
const DIA = 86400000;
const COMP = { uid: 'comp', name: 'Competições' };
const TES = { uid: 'tes', name: 'Tesouraria' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };
const ZE = { uid: 'ze', name: 'Zé' };

function cenario(extra = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, modules: { selection: true, grants: true } },
      'federation_staff/fpp_comp': { federation_id: 'fpp', user_id: 'comp', role: 'competitions' },
      'federation_staff/fpp_tes': { federation_id: 'fpp', user_id: 'tes', role: 'treasurer' },
      'federation_members/fpp_ana': { federation_id: 'fpp', user_id: 'ana', status: 'active', valid_until: '2027-12-31' },
      'users/ana': { platform_name: 'Ana Souza' },
      'users/bia': { platform_name: 'Bia Lima' },
      'users/ze': { platform_name: 'Zé Costa' },
      'federation_rankings/fpp_2026': {
        federation_id: 'fpp', season: 2026,
        categories: [{ key: 'female|open|doubles', gender_category: 'female', age_category: 'open', format: 'doubles', rows: [
          { uid: 'ana', name: 'Ana Souza', position: 1, points: 900 }, { uid: 'bia', name: 'Bia Lima', position: 2, points: 700 }, { uid: 'cris', name: 'Cris', position: 3, points: 500 },
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
const chamar = (c, actor, data, now) => sel.selection(ctx(c, now), actor, { federationId: 'fpp', ...data });

const CONVOCACAO = { title: 'Seleção paulista', event_name: 'Brasileiro 2027', place: 'Brasília', starts_at: '2026-12-10', criterion: 'ranking', season: 2026, per_category: 2, accept_days: 5, travel_docs: ['id_doc', 'medical'], collect_uniform: true };
const EDITAL = { title: 'Auxílio-viagem', kind: 'travel', description: 'Ajuda para a viagem ao Brasileiro.', criteria: 'Ranking oficial de 2026.', closes_at: '2026-10-30', slots: 1, amount_cents: 50000, required_docs: ['RG'] };

async function convocacaoPublicada(c) {
  const { callupId } = await chamar(c, COMP, { action: 'callup_save', ...CONVOCACAO });
  const r = await chamar(c, COMP, { action: 'callup_publish', callupId });
  return { callupId, ...r };
}
const convite = (c, uid) => docs(c, 'federation_callup_members/').find((d) => d.user_id === uid);

describe('convocação pelo ranking', () => {
  it('só a equipe de competições monta; publicar convida os N melhores e avisa', async () => {
    const c = cenario();
    await expect(chamar(c, ANA, { action: 'callup_save', ...CONVOCACAO })).rejects.toThrow(/equipe de competições/);
    const { callupId, invited } = await convocacaoPublicada(c);
    expect(invited).toBe(2);
    expect(doc(c, `federation_callups/${callupId}`).status).toBe('open');
    expect(convite(c, 'ana')).toMatchObject({ status: 'invited', position: 1, expires_at_ms: NOW + 5 * DIA });
    expect(convite(c, 'cris')).toBeUndefined();
    expect(avisos(c, 'ana')).toHaveLength(1);
  });

  it('recusar chama o suplente; aceitar entra na lista pública sem uid', async () => {
    const c = cenario();
    const { callupId } = await convocacaoPublicada(c);
    await chamar(c, ANA, { action: 'callup_answer', memberId: convite(c, 'ana').id, accept: true, uniform_size: 'M' });
    await expect(chamar(c, ANA, { action: 'callup_answer', memberId: convite(c, 'bia').id, accept: false })).rejects.toThrow(/não é seu/);
    const r = await chamar(c, BIA, { action: 'callup_answer', memberId: convite(c, 'bia').id, accept: false });
    expect(r.substitutes).toBe(1);
    expect(convite(c, 'cris')).toMatchObject({ status: 'invited', substitute: true });
    const cu = doc(c, `federation_callups/${callupId}`);
    expect(cu.roster).toHaveLength(1);
    expect(cu.roster[0].name).toBe('Ana Souza');
    expect(JSON.stringify(cu.roster)).not.toContain('ana_');
    expect(cu.roster[0].key).toBe(sel.rosterKey(convite(c, 'ana').id));
    expect(convite(c, 'ana').uniform_size).toBe('M');
    expect(cu.counts).toMatchObject({ accepted: 1, declined: 1, invited: 1 });
  });

  it('o prazo vence pela varredura e o próximo é chamado', async () => {
    const c = cenario();
    await convocacaoPublicada(c);
    const r = await sel.sweep(ctx(c, NOW + 6 * DIA));
    expect(r.expired).toBe(2);
    expect(r.substitutes).toBe(1);
    expect(convite(c, 'ana').status).toBe('expired');
    expect(convite(c, 'cris').status).toBe('invited');
  });

  it('documentos de viagem: a equipe confere, o convocado não', async () => {
    const c = cenario();
    await convocacaoPublicada(c);
    const id = convite(c, 'ana').id;
    await chamar(c, ANA, { action: 'callup_answer', memberId: id, accept: true });
    await expect(chamar(c, ANA, { action: 'callup_member_update', memberId: id, docs_ok: { id_doc: true } })).rejects.toThrow(/equipe de competições/);
    await chamar(c, COMP, { action: 'callup_member_update', memberId: id, docs_ok: { id_doc: true, passport: true } });
    expect(convite(c, 'ana').docs_ok).toEqual({ id_doc: true, medical: false });
    await chamar(c, ANA, { action: 'callup_member_update', memberId: id, uniform_size: 'G' });
    expect(convite(c, 'ana').uniform_size).toBe('G');
  });

  it('convocar a dedo e fechar a delegação: quem não respondeu perde o convite', async () => {
    const c = cenario();
    const { callupId } = await convocacaoPublicada(c);
    await chamar(c, COMP, { action: 'callup_add', callupId, userId: 'ze', label: 'Técnico' });
    expect(convite(c, 'ze')).toMatchObject({ category_key: 'manual', label: 'Técnico', user_name: 'Zé Costa' });
    await expect(chamar(c, COMP, { action: 'callup_add', callupId, userId: 'ze' })).rejects.toThrow(/já está convocada/);
    await chamar(c, ZE, { action: 'callup_answer', memberId: convite(c, 'ze').id, accept: true });
    await chamar(c, COMP, { action: 'callup_close', callupId });
    expect(doc(c, `federation_callups/${callupId}`).status).toBe('closed');
    expect(convite(c, 'ana').status).toBe('cancelled');
    expect(convite(c, 'ze').status).toBe('accepted');
    expect(avisos(c, 'ze').some((a) => /Delegação fechada/.test(a.title))).toBe(true);
  });

  it('custos: só o financeiro marca o pago, e o pago vira despesa nas contas', async () => {
    const c = cenario();
    const { callupId } = await convocacaoPublicada(c);
    await chamar(c, COMP, { action: 'callup_costs', callupId, costs: [{ id: 'c1', label: 'Passagens', amount_cents: 300000, paid_at: '2026-10-21' }] });
    expect(doc(c, `federation_callups/${callupId}`).costs[0].paid_at).toBe('');
    await chamar(c, TES, { action: 'callup_costs', callupId, costs: [{ id: 'c1', label: 'Passagens', amount_cents: 300000, paid_at: '2026-10-21' }] });
    const desp = await sel.despesas(ctx(c), { id: 'fpp', modules: { selection: true } });
    expect(desp).toEqual([expect.objectContaining({ amount_cents: 300000, category: 'travel', auto: 'callup' })]);
  });

  it('cancelar rascunho apaga; módulo desligado recusa', async () => {
    const c = cenario();
    const { callupId } = await chamar(c, COMP, { action: 'callup_save', ...CONVOCACAO });
    expect((await chamar(c, COMP, { action: 'callup_cancel', callupId })).deleted).toBe(true);
    expect(doc(c, `federation_callups/${callupId}`)).toBeUndefined();
    c.db.store.docs.set('federations/fpp', { ...doc(c, 'federations/fpp'), modules: { grants: true } });
    await expect(chamar(c, COMP, { action: 'callup_save', ...CONVOCACAO })).rejects.toThrow(/seleção e delegações/);
  });
});

describe('edital do começo ao fim', () => {
  async function editalAberto(c) {
    const { grantId } = await chamar(c, COMP, { action: 'grant_save', ...EDITAL });
    const r = await chamar(c, COMP, { action: 'grant_publish', grantId });
    return { grantId, ...r };
  }
  const inscrever = (c, actor, grantId) => chamar(c, actor, { action: 'grant_apply', grantId, text: 'Preciso do apoio para a viagem.', files: { d1: { path: `federacao/${actor.uid}/rg1.pdf`, name: 'rg.pdf' } } });

  it('publicar avisa os filiados; só filiado se inscreve; arquivo de outra pasta é recusado', async () => {
    const c = cenario();
    const { grantId, notified } = await editalAberto(c);
    expect(notified).toBe(1);
    expect(doc(c, `federation_grants/${grantId}`).status).toBe('open');
    await expect(inscrever(c, BIA, grantId)).rejects.toThrow(/só para filiados/);
    await expect(chamar(c, ANA, { action: 'grant_apply', grantId, text: 'Preciso do apoio para a viagem.', files: { d1: { path: 'federacao/bia/x.pdf' } } })).rejects.toThrow(/Confira os campos/);
    const { applicationId } = await inscrever(c, ANA, grantId);
    expect(doc(c, `federation_grant_applications/${applicationId}`)).toMatchObject({ status: 'submitted', user_name: 'Ana Souza', member_id: 'fpp_ana' });
  });

  it('publicado, só o prazo cresce, com motivo', async () => {
    const c = cenario();
    const { grantId } = await editalAberto(c);
    await expect(chamar(c, COMP, { action: 'grant_save', grantId, ...EDITAL, slots: 5 })).rejects.toThrow(/prorrogar/);
    await expect(chamar(c, COMP, { action: 'grant_save', grantId, closes_at: '2026-11-05' })).rejects.toThrow(/motivo/);
    await chamar(c, COMP, { action: 'grant_save', grantId, closes_at: '2026-11-05', reason: 'Pedido dos clubes.' });
    const g = doc(c, `federation_grants/${grantId}`);
    expect([g.closes_at, g.slots]).toEqual(['2026-11-05', 1]);
    expect(g.history.at(-1)).toMatchObject({ action: 'extend' });
  });

  it('fecha sozinho, decide, resultado, recurso, pagamento e despesa', async () => {
    const c = cenario({ 'federation_members/fpp_bia': { federation_id: 'fpp', user_id: 'bia', status: 'active', valid_until: '2027-12-31' } });
    const { grantId } = await editalAberto(c);
    const a = (await inscrever(c, ANA, grantId)).applicationId;
    const b = (await inscrever(c, BIA, grantId)).applicationId;
    await expect(chamar(c, COMP, { action: 'grant_decide', applicationId: a, decision: 'approved' })).rejects.toThrow(/inscrições fecham/);
    const depois = NOW + 9 * DIA; // 31/10
    expect((await sel.sweep(ctx(c, depois))).review).toBe(1);
    expect(avisos(c, 'comp').some((x) => /Inscrições encerradas/.test(x.title))).toBe(true);
    await chamar(c, COMP, { action: 'grant_decide', applicationId: a, decision: 'approved', score: 90 }, depois);
    await expect(chamar(c, COMP, { action: 'grant_decide', applicationId: b, decision: 'approved' }, depois)).rejects.toThrow(/vagas/);
    await expect(chamar(c, COMP, { action: 'grant_decide', applicationId: b, decision: 'rejected' }, depois)).rejects.toThrow(/motivo/);
    await chamar(c, COMP, { action: 'grant_decide', applicationId: b, decision: 'waitlisted', reason: 'Pontuação menor.' }, depois);
    const r = await chamar(c, COMP, { action: 'grant_result', grantId }, depois);
    expect(r).toMatchObject({ approved: 1, appealUntil: '2026-11-05' });
    expect(doc(c, `federation_grants/${grantId}`).result).toEqual([{ application_id: a, name: 'Ana Souza' }]);
    await chamar(c, BIA, { action: 'grant_appeal', applicationId: b, text: 'Minha pontuação foi calculada errada.' }, depois);
    await expect(chamar(c, COMP, { action: 'grant_finalize', grantId }, NOW + 20 * DIA)).rejects.toThrow(/recurso/);
    await expect(chamar(c, COMP, { action: 'grant_appeal_decide', applicationId: b, accept: true, reason: 'Conta refeita.' }, depois)).rejects.toThrow(/Não há vaga/);
    await chamar(c, COMP, { action: 'grant_appeal_decide', applicationId: b, accept: false, reason: 'Conta conferida.' }, depois);
    await expect(chamar(c, COMP, { action: 'grant_pay', applicationId: a }, depois)).rejects.toThrow(/financeiro/);
    await chamar(c, TES, { action: 'grant_pay', applicationId: a, amount_cents: 50000, paid_at: '2026-10-31' }, depois);
    expect(doc(c, `federation_grants/${grantId}`).payments).toEqual([{ application_id: a, name: 'Ana Souza', amount_cents: 50000, paid_at: '2026-10-31' }]);
    const desp = await sel.despesas(ctx(c), { id: 'fpp', modules: { grants: true } });
    expect(desp).toEqual([expect.objectContaining({ amount_cents: 50000, category: 'travel', auto: 'grant' })]);
    await expect(chamar(c, COMP, { action: 'grant_cancel', grantId, reason: 'Teste.' }, depois)).rejects.toThrow(/pagamento/);
    expect((await sel.sweep(ctx(c, NOW + 20 * DIA))).final).toBe(1);
    expect(doc(c, `federation_grants/${grantId}`).status).toBe('final');
  });

  it('o arquivo da inscrição: o dono e a equipe de competições, ninguém mais', async () => {
    const c = cenario();
    const { grantId } = await editalAberto(c);
    const { applicationId } = await inscrever(c, ANA, grantId);
    expect((await sel.applicationFile(ctx(c), ANA, applicationId, 'd1')).dono).toBe(true);
    expect((await sel.applicationFile(ctx(c), COMP, applicationId, 'd1')).path).toBe('federacao/ana/rg1.pdf');
    await expect(sel.applicationFile(ctx(c), TES, applicationId, 'd1')).rejects.toThrow(/equipe de competições/);
  });
});
