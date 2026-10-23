/**
 * Contratos de patrocínio e patrimônio no SERVIDOR contra um Firestore falso:
 * quem grava (financeiro/admin; patrimônio também competições; o conselho
 * fiscal só lê), a parcela recebida virando receita nas contas, o período
 * fechado, a contrapartida, o empréstimo e a devolução, e a varredura que
 * avisa uma vez cada.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mg = require('./federationManagement.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0); // 23/10/2026, meio-dia em Brasília
const PRES = { uid: 'pres', name: 'Presidente' };
const FIN = { uid: 'fin', name: 'Financeiro' };
const FIS = { uid: 'fis', name: 'Fiscal' };
const COMP = { uid: 'comp', name: 'Competições' };

function cenario(extra = {}, mods = { sponsors: true, assets: true, accounts: true }) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', status: 'approved', published: true, modules: mods },
      'federation_staff/fgp_pres': { federation_id: 'fgp', user_id: 'pres', role: 'president' },
      'federation_staff/fgp_fin': { federation_id: 'fgp', user_id: 'fin', role: 'custom', perms: ['finance'] },
      'federation_staff/fgp_fis': { federation_id: 'fgp', user_id: 'fis', role: 'custom', perms: ['fiscal'] },
      'federation_staff/fgp_comp': { federation_id: 'fgp', user_id: 'comp', role: 'custom', perms: ['competitions'] },
      ...extra,
    }),
  };
}
const ctx = (c, now = NOW) => ({ db: c.db, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => mg.management(ctx(c, now), actor, { federationId: 'fgp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && (!uid || d.user_id === uid)).map(([, d]) => d);
const CONTRATO = {
  sponsor_name: 'Raquetes Sul', start: '2026-01-01', end: '2026-11-10', tier: 'main',
  installments: [{ id: 'p1', due: '2026-02-01', amount_cents: 50000 }, { id: 'p2', due: '2026-09-01', amount_cents: 50000 }],
  counterparts: [{ id: 'c1', text: 'Logo na camisa', due: '2026-03-01' }],
};

describe('contratos de patrocínio', () => {
  it('o financeiro cria; o fiscal e as competições não gravam', async () => {
    const c = cenario();
    const r = await chamar(c, FIN, { action: 'contract_save', contract: CONTRATO });
    expect(doc(c, `federation_sponsor_contracts/${r.contractId}`)).toMatchObject({ federation_id: 'fgp', status: 'active', total_cents: 100000, created_by: 'fin' });
    await expect(chamar(c, FIS, { action: 'contract_save', contract: CONTRATO })).rejects.toThrow(/financeiro/);
    await expect(chamar(c, COMP, { action: 'contract_save', contract: CONTRATO })).rejects.toThrow(/financeiro/);
    await expect(chamar(cenario({}, { assets: true }), FIN, { action: 'contract_save', contract: CONTRATO })).rejects.toThrow(/patrocinadores/);
  });

  it('a parcela recebida vira receita nas contas; sem data futura nem período fechado', async () => {
    const c = cenario({ 'federation_account_reports/q1': { federation_id: 'fgp', period: '2026-Q1', status: 'submitted' } });
    const { contractId } = await chamar(c, FIN, { action: 'contract_save', contract: CONTRATO });
    await expect(chamar(c, FIN, { action: 'contract_receive', contractId, installmentId: 'p1', date: '2026-12-01' })).rejects.toThrow(/futuro/);
    await chamar(c, FIN, { action: 'contract_receive', contractId, installmentId: 'p2', date: '2026-09-03' });
    await expect(chamar(c, FIN, { action: 'contract_receive', contractId, installmentId: 'p2' })).rejects.toThrow(/já foi recebida/);
    const rec = await mg.receitas(ctx(c), { id: 'fgp', modules: { sponsors: true } });
    expect(rec).toEqual([expect.objectContaining({ date: '2026-09-03', amount_cents: 50000, category: 'sponsorship', auto: 'sponsor' })]);
    expect(await mg.receitas(ctx(c), { id: 'fgp', modules: {} })).toEqual([]);
    // Editar sem a parcela recebida é recusado; desfazer pede motivo.
    await expect(chamar(c, FIN, { action: 'contract_save', contractId, contract: { ...CONTRATO, installments: [CONTRATO.installments[0]] } })).rejects.toThrow(/já foi recebida/);
    await expect(chamar(c, FIN, { action: 'contract_unreceive', contractId, installmentId: 'p2' })).rejects.toThrow(/motivo/);
    await chamar(c, FIN, { action: 'contract_unreceive', contractId, installmentId: 'p2', reason: 'Lançado errado' });
    expect(await mg.receitas(ctx(c), { id: 'fgp', modules: { sponsors: true } })).toEqual([]);
  });

  it('recebimento num período com prestação enviada é recusado', async () => {
    const c = cenario({ 'federation_account_reports/a': { federation_id: 'fgp', period: '2026', status: 'submitted' } });
    const { contractId } = await chamar(c, FIN, { action: 'contract_save', contract: CONTRATO });
    await expect(chamar(c, FIN, { action: 'contract_receive', contractId, installmentId: 'p1', date: '2026-02-02' })).rejects.toThrow(/fechado/);
  });

  it('contrapartida entregue; só o admin cancela; com recebimento não se apaga', async () => {
    const c = cenario();
    const { contractId } = await chamar(c, FIN, { action: 'contract_save', contract: CONTRATO });
    await chamar(c, FIN, { action: 'contract_deliver', contractId, counterpartId: 'c1', date: '2026-03-01' });
    expect(doc(c, `federation_sponsor_contracts/${contractId}`).counterparts[0]).toMatchObject({ done_at: '2026-03-01', done_by: 'fin' });
    await expect(chamar(c, FIN, { action: 'contract_cancel', contractId, reason: 'Fim' })).rejects.toThrow(/administração/);
    await chamar(c, FIN, { action: 'contract_receive', contractId, installmentId: 'p1', date: '2026-02-02' });
    await expect(chamar(c, PRES, { action: 'contract_cancel', contractId, remove: true })).rejects.toThrow(/não se apaga/);
    await chamar(c, PRES, { action: 'contract_cancel', contractId, reason: 'Patrocinador saiu' });
    expect(doc(c, `federation_sponsor_contracts/${contractId}`)).toMatchObject({ status: 'cancelled', cancelled_reason: 'Patrocinador saiu' });
    await expect(chamar(c, FIN, { action: 'contract_receive', contractId, installmentId: 'p2', date: '2026-09-02' })).rejects.toThrow(/cancelado/);
  });
});

describe('patrimônio', () => {
  it('competições cadastram e emprestam; não se empresta além do disponível', async () => {
    const c = cenario();
    const { assetId } = await chamar(c, COMP, { action: 'asset_save', asset: { name: 'Rede oficial', category: 'nets', quantity: 4 } });
    await expect(chamar(c, FIS, { action: 'asset_save', asset: { name: 'X', quantity: 1 } })).rejects.toThrow(/patrimônio/);
    const { loanId } = await chamar(c, COMP, { action: 'asset_loan', assetId, loan: { borrower_kind: 'club', borrower_name: 'Clube Sul', quantity: 3, out_at: '2026-10-01', due_at: '2026-10-10' } });
    await expect(chamar(c, COMP, { action: 'asset_loan', assetId, loan: { borrower_name: 'Evento', quantity: 2, due_at: '2026-11-01' } })).rejects.toThrow(/quantity/);
    await expect(chamar(c, COMP, { action: 'asset_save', assetId, asset: { name: 'Rede oficial', quantity: 2 } })).rejects.toThrow(/emprestado/);
    await expect(chamar(c, PRES, { action: 'asset_retire', assetId, reason: 'Velha' })).rejects.toThrow(/devolução/);
    await chamar(c, COMP, { action: 'asset_return', assetId, loanId, date: '2026-10-12', condition: 'damaged', note: 'Rasgou' });
    const bem = doc(c, `federation_assets/${assetId}`);
    expect(bem.condition).toBe('damaged');
    expect(bem.loans[0]).toMatchObject({ returned_at: '2026-10-12', return_condition: 'damaged', returned_by: 'comp' });
    await expect(chamar(c, COMP, { action: 'asset_retire', assetId, remove: true })).rejects.toThrow(/administração/);
    await expect(chamar(c, PRES, { action: 'asset_retire', assetId, remove: true })).rejects.toThrow(/dê baixa/);
    await chamar(c, PRES, { action: 'asset_retire', assetId, reason: 'Danificada' });
    expect(doc(c, `federation_assets/${assetId}`)).toMatchObject({ status: 'retired', retired_reason: 'Danificada' });
  });
});

describe('varredura', () => {
  it('avisa vencimento, parcela, contrapartida e empréstimo uma vez cada', async () => {
    const c = cenario({
      'federation_sponsor_contracts/k1': { federation_id: 'fgp', status: 'active', sponsor_name: 'Raquetes Sul', start: '2026-01-01', end: '2026-11-10', installments: [{ id: 'p1', due: '2026-09-01', amount_cents: 50000 }], counterparts: [{ id: 'c1', text: 'Logo', due: '2026-10-01' }] },
      'federation_assets/a1': { federation_id: 'fgp', status: 'active', name: 'Placar', quantity: 2, loans: [{ id: 'l1', quantity: 1, out_at: '2026-10-01', due_at: '2026-10-10', borrower_name: 'Clube Sul', lent_by: 'comp' }] },
    });
    const r = await mg.sweep(ctx(c));
    expect(r.notices).toBeGreaterThan(0);
    expect(avisos(c, 'fin').map((a) => a.title)).toEqual(expect.arrayContaining([expect.stringMatching(/vence em 10\/11\/2026/), expect.stringMatching(/sem receber/)]));
    expect(avisos(c, 'pres').map((a) => a.title)).toEqual(expect.arrayContaining([expect.stringMatching(/atrasada/)]));
    expect(avisos(c, 'comp').map((a) => a.title)).toEqual([expect.stringMatching(/Placar/)]);
    expect(avisos(c, 'fis')).toHaveLength(0);
    const antes = avisos(c).length;
    await mg.sweep(ctx(c));
    expect(avisos(c)).toHaveLength(antes);
  });
});
