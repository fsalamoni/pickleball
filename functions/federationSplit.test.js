/**
 * Cobrança dividida e troca de plano no SERVIDOR contra um Firestore falso:
 * a filiação paga anota a parte do clube (filiado à federação) e da
 * confederação; a troca de plano cobra só a diferença e, paga, muda o plano
 * sem mexer na validade; o financeiro marca repassado (e desfaz com motivo);
 * o repasse feito entra nas contas das duas federações.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const feds = require('./federations.js');
const split = require('./federationSplit.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0);
const GPFIN = { uid: 'gpfin', name: 'Financeiro FGP' };
const CBFIN = { uid: 'cbfin', name: 'Financeiro CBP' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };

const plano = (nome, preco, extra = {}) => ({ federation_id: 'fgp', name: nome, person_type: 'athlete', tier: 'federated', billing: 'annual', validity: 'rolling', price_cents: preco, active: true, split: { club_pct: 10, confederation_pct: 20 }, ...extra });

function cenario() {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/cbp': { name: 'Confederação Brasileira', acronym: 'CBP', status: 'approved', published: true, confederation: true, modules: { accounts: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', status: 'approved', published: true, modules: { accounts: true }, national_body: { id: 'cbp', name: 'Confederação Brasileira', acronym: 'CBP' } },
      'federation_staff/fgp_gpfin': { federation_id: 'fgp', user_id: 'gpfin', role: 'custom', perms: ['finance'] },
      'federation_staff/cbp_cbfin': { federation_id: 'cbp', user_id: 'cbfin', role: 'custom', perms: ['finance'] },
      'federation_plans/anual': plano('Atleta', 10000),
      'federation_plans/ouro': plano('Atleta ouro', 15000),
      'federation_plans/bronze': plano('Atleta bronze', 8000),
      'federation_plans/mensal': plano('Atleta mensal', 20000, { billing: 'monthly' }),
      'federation_affiliations/fgp_club_c1': { federation_id: 'fgp', kind: 'club', org_id: 'c1', org_name: 'Clube Um', status: 'approved' },
      'federation_members/fgp_ana': { federation_id: 'fgp', user_id: 'ana', user_name: 'Ana', plan_id: 'anual', plan_name: 'Atleta', tier: 'federated', billing: 'annual', status: 'awaiting_payment', represented_club_id: 'c1', member_number: null, card_code: null, valid_from: null, valid_until: null },
      'federation_charges/c1': { federation_id: 'fgp', member_id: 'fgp_ana', payer_uid: 'ana', origin: 'membership', plan_id: 'anual', plan_name: 'Atleta', amount_cents: 10000, status: 'declared' },
    }),
  };
}
const ctx = (c) => ({ db: c.db, now: NOW, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const doc = (c, path) => c.db.store.docs.get(path);
const docs = (c, prefixo) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith(prefixo)).map(([p, d]) => ({ id: p.split('/')[1], ...d }));
const confirmar = (c, chargeId) => feds.chargeConfirm(ctx(c), GPFIN, { chargeId, action: 'confirm' });

describe('cobrança dividida', () => {
  it('a filiação paga anota a parte do clube filiado e da confederação', async () => {
    const c = cenario();
    await confirmar(c, 'c1');
    expect(doc(c, 'federation_members/fgp_ana').status).toBe('active');
    expect(doc(c, 'federation_repasses/c1_club')).toMatchObject({ to: 'club', to_id: 'c1', to_name: 'Clube Um', amount_cents: 1000, status: 'pending', federation_id: 'fgp' });
    expect(doc(c, 'federation_repasses/c1_confederation')).toMatchObject({ to: 'confederation', to_id: 'cbp', amount_cents: 2000, status: 'pending' });
    expect(doc(c, 'federation_repasses/c1_club').member_name).toBeUndefined();
  });

  it('clube não filiado à federação: a parte dele fica com a federação', async () => {
    const c = cenario();
    c.db.store.docs.set('federation_affiliations/fgp_club_c1', { federation_id: 'fgp', kind: 'club', org_id: 'c1', status: 'pending' });
    await confirmar(c, 'c1');
    expect(doc(c, 'federation_repasses/c1_club')).toBeUndefined();
    expect(doc(c, 'federation_repasses/c1_confederation').amount_cents).toBe(2000);
  });

  it('o financeiro marca repassado (avisa a confederação), desfaz com motivo, e o feito entra nas contas das duas', async () => {
    const c = cenario();
    await confirmar(c, 'c1');
    await expect(split.split(ctx(c), ANA, { repasseId: 'c1_confederation', action: 'pay' })).rejects.toMatchObject({ code: 'permission-denied' });
    await split.split(ctx(c), GPFIN, { repasseId: 'c1_confederation', action: 'pay' });
    expect(doc(c, 'federation_repasses/c1_confederation')).toMatchObject({ status: 'paid', paid_at: '2026-10-23', paid_by: 'gpfin' });
    expect(docs(c, 'notifications/').some((n) => n.user_id === 'cbfin')).toBe(true);
    const fgp = await split.contas(ctx(c), { id: 'fgp' });
    const cbp = await split.contas(ctx(c), { id: 'cbp' });
    expect(fgp.despesas.map((x) => x.amount_cents)).toEqual([2000]);
    expect(cbp.receitas.map((x) => x.amount_cents)).toEqual([2000]);
    await expect(split.split(ctx(c), GPFIN, { repasseId: 'c1_confederation', action: 'reopen' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await split.split(ctx(c), GPFIN, { repasseId: 'c1_confederation', action: 'reopen', reason: 'Marquei errado' });
    expect(doc(c, 'federation_repasses/c1_confederation')).toMatchObject({ status: 'pending', paid_at: null });
    expect((await split.contas(ctx(c), { id: 'cbp' })).receitas).toEqual([]);
    await expect(split.split(ctx(c), CBFIN, { repasseId: 'c1_club', action: 'pay' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('período com prestação enviada não aceita marcar', async () => {
    const c = cenario();
    await confirmar(c, 'c1');
    c.db.store.docs.set('federation_account_reports/fgp_2026', { federation_id: 'fgp', period: '2026', period_start: '2026-01-01', period_end: '2026-12-31', status: 'submitted' });
    await expect(split.split(ctx(c), GPFIN, { repasseId: 'c1_club', action: 'pay' })).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('período') });
  });
});

describe('troca de plano', () => {
  it('paga só a diferença; paga, o plano muda e a validade fica', async () => {
    const c = cenario();
    await confirmar(c, 'c1');
    const validade = doc(c, 'federation_members/fgp_ana').valid_until;
    const r = await feds.membership(ctx(c), ANA, { federationId: 'fgp', action: 'upgrade', planId: 'ouro' });
    expect(r.amountCents).toBe(5000);
    expect(doc(c, `federation_charges/${r.chargeId}`)).toMatchObject({ origin: 'upgrade', plan_id: 'ouro', from_plan_id: 'anual', amount_cents: 5000, status: 'open' });
    await expect(feds.membership(ctx(c), ANA, { federationId: 'fgp', action: 'upgrade', planId: 'ouro' })).rejects.toMatchObject({ code: 'already-exists' });
    await confirmar(c, r.chargeId);
    expect(doc(c, 'federation_members/fgp_ana')).toMatchObject({ plan_id: 'ouro', plan_name: 'Atleta ouro', valid_until: validade, status: 'active' });
    expect(doc(c, `federation_repasses/${r.chargeId}_confederation`).amount_cents).toBe(1000);
  });

  it('plano mais barato, de outro período ou de quem não é dono: recusado', async () => {
    const c = cenario();
    await expect(feds.membership(ctx(c), ANA, { federationId: 'fgp', action: 'upgrade', planId: 'ouro' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await confirmar(c, 'c1');
    await expect(feds.membership(ctx(c), ANA, { federationId: 'fgp', action: 'upgrade', planId: 'bronze' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(feds.membership(ctx(c), ANA, { federationId: 'fgp', action: 'upgrade', planId: 'mensal' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(feds.membership(ctx(c), BIA, { federationId: 'fgp', action: 'upgrade', planId: 'ouro', memberId: 'fgp_ana' })).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
