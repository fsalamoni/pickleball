/**
 * Seguro no SERVIDOR contra o Firestore falso: o termo exigido barra o pedido
 * e a renovação sem o aceite da versão em vigor, o titular aceita depois
 * (outro não), mudar o texto pede aceite novo; o clube filiado pede o
 * certificado do evento, a secretaria emite (nunca o próprio) só com a apólice
 * cobrindo as datas, e a verificação pública diz válido ou cancelado.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fed = require('./federations.js');
const ins = require('./federationInsurance.js');
const P = require('./federationInsurancePolicy.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0);
const ANA = { uid: 'ana' };
const ZE = { uid: 'ze' };
const SEC = { uid: 'sec' };
const GESTOR = { uid: 'gestor' };
const TERMO = 'Declaro estar ciente de que o seguro esportivo da federação cobre acidentes em treinos e eventos oficiais.';
const APOLICE = { insurer: 'Seguradora X', policy: 'AP-1', valid_from: '2026-01-01', valid_until: '2026-12-31', coverage: 'Morte e invalidez', covers: 'active_members', require_term: true, term_text: TERMO };

function cenario(extra = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, member_counter: 0, modules: { insurance: true }, insurance: APOLICE },
    'federation_staff/fgp_sec': { federation_id: 'fgp', user_id: 'sec', role: 'custom', perms: ['members'] },
    'federation_staff/fgp_gestor': { federation_id: 'fgp', user_id: 'gestor', role: 'custom', perms: ['members'] },
    'federation_plans/gratis': { federation_id: 'fgp', name: 'Atleta', person_type: 'athlete', tier: 'federated', billing: 'annual', price_cents: 0, auto_approve: true, active: true },
    'federation_plans/cad': { federation_id: 'fgp', name: 'Cadastro', person_type: 'athlete', tier: 'registered', billing: 'annual', price_cents: 0, auto_approve: true, active: true },
    'users/ana': { full_name: 'Ana Souza', birth_date: '1990-05-01' },
    'club_members/c1_gestor': { club_id: 'c1', user_id: 'gestor', role: 'admin' },
    'club_members/c1_ze': { club_id: 'c1', user_id: 'ze', role: 'admin' },
    'federation_affiliations/fgp_club_c1': { federation_id: 'fgp', kind: 'club', org_id: 'c1', org_name: 'Clube Um', org_city: 'Porto Alegre', status: 'approved' },
    ...extra,
  });
}
const ctx = (db, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const doc = (db, path) => db.store.docs.get(path);
const versao = P.termVersion(TERMO);
const chamar = (db, actor, data) => ins.insurance(ctx(db), actor, { federationId: 'fgp', ...data });

describe('termo do seguro', () => {
  it('o pedido sem o aceite da versão em vigor é recusado; com ela, grava o aceite', async () => {
    const db = cenario();
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fgp', action: 'request', planId: 'gratis' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fgp', action: 'request', planId: 'gratis', insuranceTermVersion: 'velha' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await fed.membership(ctx(db), ANA, { federationId: 'fgp', action: 'request', planId: 'gratis', insuranceTermVersion: versao });
    expect(doc(db, 'federation_members/fgp_ana')).toMatchObject({ status: 'active', insurance_term: { version: versao, accepted_at_ms: NOW, by: 'ana' } });
  });

  it('apólice só de filiados: o cadastrado não precisa aceitar', async () => {
    const db = cenario();
    db.store.docs.set('federations/fgp', { ...doc(db, 'federations/fgp'), insurance: { ...APOLICE, covers: 'federated_only' } });
    await fed.membership(ctx(db), ANA, { federationId: 'fgp', action: 'request', planId: 'cad' });
    expect(doc(db, 'federation_members/fgp_ana').insurance_term).toBeUndefined();
  });

  it('o titular aceita depois; outro não; mudar o texto pede aceite novo', async () => {
    const db = cenario({ 'federation_members/fgp_ana': { federation_id: 'fgp', user_id: 'ana', status: 'active', tier: 'federated', plan_id: 'gratis', valid_until: '2027-06-01' } });
    await expect(chamar(db, ZE, { action: 'term_accept', memberId: 'fgp_ana', version: versao })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ANA, { action: 'term_accept', memberId: 'fgp_ana', version: 'x' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, ANA, { action: 'term_accept', memberId: 'fgp_ana', version: versao });
    expect(doc(db, 'federation_members/fgp_ana').insurance_term.version).toBe(versao);
    const novo = `${TERMO} Inclui despesas médicas.`;
    db.store.docs.set('federations/fgp', { ...doc(db, 'federations/fgp'), insurance: { ...APOLICE, term_text: novo } });
    const fgp = doc(db, 'federations/fgp');
    expect(P.termState(doc(db, 'federation_members/fgp_ana'), fgp)).toMatchObject({ required: true, accepted: false, outdated: true });
    await chamar(db, ANA, { action: 'term_accept', memberId: 'fgp_ana', version: P.termVersion(novo) });
    expect(doc(db, 'federation_members/fgp_ana').insurance_term_log).toHaveLength(2);
  });

  it('a renovação pede o aceite de quem ainda não aceitou', async () => {
    const db = cenario({ 'federation_members/fgp_ana': { federation_id: 'fgp', user_id: 'ana', status: 'active', tier: 'federated', plan_id: 'gratis', valid_from: '2025-11-10', valid_until: '2026-11-10', card_code: 'ABCD2345' } });
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fgp', action: 'renew' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await fed.membership(ctx(db), ANA, { federationId: 'fgp', action: 'renew', insuranceTermVersion: versao });
    expect(doc(db, 'federation_members/fgp_ana').insurance_term.version).toBe(versao);
  });
});

describe('certificado de seguro do evento', () => {
  const EVENTO = { event_name: 'Festival de Primavera', venue: 'Arena Sul', city: 'Porto Alegre', date_from: '2026-11-20', date_to: '2026-11-21', participants: 60 };

  it('só quem gere o clube filiado pede', async () => {
    const db = cenario({ 'federation_affiliations/fgp_club_c2': { federation_id: 'fgp', kind: 'club', org_id: 'c2', status: 'pending' }, 'club_members/c2_ze': { club_id: 'c2', user_id: 'ze', role: 'admin' } });
    await expect(chamar(db, ANA, { action: 'cert_request', kind: 'club', orgId: 'c1', ...EVENTO })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ZE, { action: 'cert_request', kind: 'club', orgId: 'c2', ...EVENTO })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, ZE, { action: 'cert_request', kind: 'club', orgId: 'c1', ...EVENTO, date_from: '2026-10-01' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(db, ZE, { action: 'cert_request', kind: 'club', orgId: 'c1', ...EVENTO });
    expect(doc(db, `federation_insurance_certificates/${r.certificateId}`)).toMatchObject({ status: 'requested', kind: 'club', org_id: 'c1', org_name: 'Clube Um', requested_by: 'ze' });
  });

  it('a secretaria emite (não quem gere o clube); a verificação diz válido e, cancelado, cancelado', async () => {
    const db = cenario();
    const { certificateId } = await chamar(db, ZE, { action: 'cert_request', kind: 'club', orgId: 'c1', ...EVENTO });
    await expect(chamar(db, GESTOR, { action: 'cert_issue', certificateId })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ZE, { action: 'cert_issue', certificateId })).rejects.toMatchObject({ code: 'permission-denied' });
    const { code } = await chamar(db, SEC, { action: 'cert_issue', certificateId });
    expect(doc(db, `federation_card_index/${code}`)).toMatchObject({ kind: 'insurance_certificate', certificate_id: certificateId });
    expect(doc(db, `federation_insurance_certificates/${certificateId}`)).toMatchObject({ status: 'issued', code, policy: { insurer: 'Seguradora X', policy: 'AP-1' } });
    expect(await fed.verify(ctx(db), { code })).toMatchObject({ found: true, kind: 'insurance_certificate', status: 'valid', org_name: 'Clube Um', event: { name: 'Festival de Primavera', participants: 60 } });
    await expect(chamar(db, SEC, { action: 'cert_cancel', certificateId, reason: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, SEC, { action: 'cert_cancel', certificateId, reason: 'Evento adiado' });
    expect(await fed.verify(ctx(db), { code })).toMatchObject({ found: true, status: 'cancelled' });
  });

  it('não emite se a apólice não cobre as datas; recusa com motivo; retirar só o pedido em aberto', async () => {
    const db = cenario();
    const fora = await chamar(db, ZE, { action: 'cert_request', kind: 'club', orgId: 'c1', ...EVENTO, date_from: '2026-12-30', date_to: '2027-01-02' });
    await expect(chamar(db, SEC, { action: 'cert_issue', certificateId: fora.certificateId })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, SEC, { action: 'cert_decline', certificateId: fora.certificateId, reason: 'Apólice vence antes' });
    expect(doc(db, `federation_insurance_certificates/${fora.certificateId}`)).toMatchObject({ status: 'declined', decision_reason: 'Apólice vence antes' });
    await expect(chamar(db, ZE, { action: 'cert_withdraw', certificateId: fora.certificateId })).rejects.toMatchObject({ code: 'failed-precondition' });
    const outro = await chamar(db, ZE, { action: 'cert_request', kind: 'club', orgId: 'c1', ...EVENTO });
    await chamar(db, GESTOR, { action: 'cert_withdraw', certificateId: outro.certificateId });
    expect(doc(db, `federation_insurance_certificates/${outro.certificateId}`).status).toBe('withdrawn');
  });

  it('sem o módulo do seguro nada funciona', async () => {
    const db = cenario();
    db.store.docs.set('federations/fgp', { ...doc(db, 'federations/fgp'), modules: {} });
    await expect(chamar(db, ZE, { action: 'cert_request', kind: 'club', orgId: 'c1', ...EVENTO })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
