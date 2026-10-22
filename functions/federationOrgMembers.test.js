/**
 * Clube e arena filiados por PLANO (Etapa 2): só quem gere a entidade pede;
 * o plano tem de ser do tipo da entidade; a cobrança vai para o
 * representante; ativa ⇒ espelho `approved` em `federation_affiliations`;
 * outro gestor assume a representação (e as cobranças em aberto); suspensa ⇒
 * espelho suspenso; cancelada ⇒ espelho sai; a conta excluída do
 * representante deixa a filiação viva, sem representante.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fed = require('./federations.js');
const O = require('./federationOrgMembers.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 18, 15, 0, 0);
const ctx = (db) => ({ db, now: NOW, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const LEO = { uid: 'leo' }; // admin do clube
const MIA = { uid: 'mia' }; // outra admin do clube
const ZED = { uid: 'zed' }; // só membro
const SEC = { uid: 'sec' };
const TES = { uid: 'tes' };
const MID = 'fpp_club_c1';

function cenario() {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fpp': { name: 'Federação Paulista de Pickleball', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, member_counter: 0, created_by: 'pres' },
    'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
    'federation_staff/fpp_tes': { federation_id: 'fpp', user_id: 'tes', role: 'treasurer' },
    'federation_plans/clube': { federation_id: 'fpp', name: 'Clube filiado', person_type: 'club', tier: 'federated', billing: 'annual', validity: 'rolling', price_cents: 50000, active: true },
    'federation_plans/atleta': { federation_id: 'fpp', name: 'Atleta', person_type: 'athlete', tier: 'federated', billing: 'annual', validity: 'rolling', price_cents: 0, active: true },
    'clubs/c1': { name: 'Clube Pinheiros', city: 'São Paulo', state: 'sp', logo_url: 'https://x/c1.png' },
    'club_members/c1_leo': { role: 'admin' },
    'club_members/c1_mia': { role: 'admin' },
    'club_members/c1_zed': { role: 'member' },
    'users/leo': { full_name: 'Leo Lima' },
    'users/mia': { full_name: 'Mia Melo' },
  });
}
const doc = (db, path) => db.store.docs.get(path);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);
const pedir = (c, actor, extra = {}) => fed.membership(c, actor, { federationId: 'fpp', action: 'request', planId: 'clube', org: { kind: 'club', id: 'c1' }, representativeRole: 'Presidente', ...extra });

describe('clube filiado por plano', () => {
  it('só quem administra pede; o plano tem de ser de clube; pessoa não usa plano de clube', async () => {
    const db = cenario();
    const c = ctx(db);
    await expect(pedir(c, ZED)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(pedir(c, LEO, { planId: 'atleta' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(fed.membership(c, LEO, { federationId: 'fpp', action: 'request', planId: 'clube' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(pedir(c, LEO, { org: { kind: 'arena', id: 'c1' } })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('pedido → aprovação → cobrança ao representante → confirmação ativa e espelha', async () => {
    const db = cenario();
    const c = ctx(db);
    await pedir(c, LEO);
    let m = doc(db, `federation_members/${MID}`);
    expect(m).toMatchObject({ status: 'pending', user_id: null, org_kind: 'club', org_id: 'c1', org_name: 'Clube Pinheiros', user_name: 'Clube Pinheiros', representative_uid: 'leo', person_type: 'club', person_category: 'club' });
    expect(m.representatives).toEqual([{ uid: 'leo', name: 'Leo Lima', role: 'Presidente' }]);
    await expect(pedir(c, MIA)).rejects.toMatchObject({ code: 'already-exists' });

    const ap = await fed.membership(c, SEC, { federationId: 'fpp', action: 'approve', memberId: MID });
    expect(doc(db, `federation_charges/${ap.chargeId}`)).toMatchObject({ payer_uid: 'leo', amount_cents: 50000, status: 'open' });
    expect(doc(db, `federation_affiliations/${MID}`)).toBeUndefined(); // aguardando pagamento não espelha

    await fed.chargeConfirm(c, TES, { chargeId: ap.chargeId, action: 'confirm' });
    m = doc(db, `federation_members/${MID}`);
    expect(m.status).toBe('active');
    expect(doc(db, `federation_affiliations/${MID}`)).toMatchObject({ status: 'approved', kind: 'club', org_id: 'c1', member_id: MID, requested_by: 'leo', plan_name: 'Clube filiado', tier: 'federated' });

    // O certificado verifica com o tipo da entidade.
    const v = await fed.verify(c, { code: m.card_code });
    expect(v).toMatchObject({ found: true, name: 'Clube Pinheiros', org_kind: 'club', person_type: 'club' });
  });

  it('outra admin assume a representação: cobranças em aberto passam a ela e o anterior é avisado', async () => {
    const db = cenario();
    const c = ctx(db);
    await pedir(c, LEO);
    const ap = await fed.membership(c, SEC, { federationId: 'fpp', action: 'approve', memberId: MID });
    await expect(fed.membership(c, ZED, { federationId: 'fpp', action: 'represent', memberId: MID, representativeRole: 'Sócio' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(fed.membership(c, LEO, { federationId: 'fpp', action: 'represent', memberId: MID })).rejects.toMatchObject({ code: 'failed-precondition' });

    await fed.membership(c, MIA, { federationId: 'fpp', action: 'represent', memberId: MID, representativeRole: 'Diretora' });
    const m = doc(db, `federation_members/${MID}`);
    expect(m).toMatchObject({ representative_uid: 'mia', representative_name: 'Mia Melo' });
    expect(m.representatives[0]).toEqual({ uid: 'mia', name: 'Mia Melo', role: 'Diretora' });
    expect(m.representatives.map((r) => r.uid)).toEqual(['mia', 'leo']);
    expect(doc(db, `federation_charges/${ap.chargeId}`).payer_uid).toBe('mia');
    expect(avisosPara(db, 'leo').some((a) => /passou a representar/.test(a.title))).toBe(true);

    // A pessoa comum não tem representante.
    await fed.membership(c, { uid: 'ana' }, { federationId: 'fpp', action: 'request', planId: 'atleta' }).catch(() => {});
    await expect(fed.membership(c, { uid: 'ana' }, { federationId: 'fpp', action: 'represent' })).rejects.toBeTruthy();
  });

  it('suspender espelha suspensa; cancelar tira o espelho desta filiação', async () => {
    const db = cenario();
    const c = ctx(db);
    await pedir(c, LEO);
    const ap = await fed.membership(c, SEC, { federationId: 'fpp', action: 'approve', memberId: MID });
    await fed.chargeConfirm(c, TES, { chargeId: ap.chargeId, action: 'confirm' });

    await fed.membership(c, SEC, { federationId: 'fpp', action: 'suspend', memberId: MID, reason: 'Documentos vencidos' });
    expect(doc(db, `federation_affiliations/${MID}`)).toMatchObject({ status: 'suspended' });
    await fed.membership(c, SEC, { federationId: 'fpp', action: 'reinstate', memberId: MID });
    expect(doc(db, `federation_affiliations/${MID}`)).toMatchObject({ status: 'approved' });

    await fed.membership(c, MIA, { federationId: 'fpp', action: 'cancel', memberId: MID });
    expect(doc(db, `federation_members/${MID}`).status).toBe('cancelled');
    expect(doc(db, `federation_affiliations/${MID}`)).toBeUndefined();
  });

  it('o espelho de outro pedido (sem plano) não é apagado pelo cancelamento', async () => {
    const db = cenario();
    const batch = db.batch();
    db.store.docs.set(`federation_affiliations/${MID}`, { status: 'approved', member_id: null });
    await O.tirarEspelho(ctx(db), batch, { federation_id: 'fpp', org_kind: 'club', org_id: 'c1' }, MID);
    await batch.commit();
    expect(doc(db, `federation_affiliations/${MID}`)).toMatchObject({ status: 'approved' });
  });

  it('quem gere: admin do clube ou gestor da arena', async () => {
    const db = cenario();
    db.store.docs.set('arena_managers/a1_leo', { arena_id: 'a1' });
    const c = ctx(db);
    expect(await O.gereOrg(c, 'club', 'c1', 'leo')).toBe(true);
    expect(await O.gereOrg(c, 'club', 'c1', 'zed')).toBe(false);
    expect(await O.gereOrg(c, 'arena', 'a1', 'leo')).toBe(true);
    expect(await O.gereOrg(c, 'arena', 'a1', 'mia')).toBe(false);
    expect(await O.gereOrg(c, 'outro', 'c1', 'leo')).toBe(false);
    expect(O.estadoDoEspelho('active')).toBe('approved');
    expect(O.estadoDoEspelho('expired')).toBe('suspended');
    expect(O.estadoDoEspelho('pending')).toBeNull();
    expect(O.representantes({ org_kind: 'club', representative_uid: 'a', representatives: [{ uid: 'a' }, { uid: 'b' }] })).toEqual(['a', 'b']);
  });
});
