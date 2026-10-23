/**
 * PARIDADE cliente × servidor dos contratos de patrocínio e do patrimônio
 * (Bloco 5): a tela valida, conta e mostra o mesmo que o servidor grava
 * (`federationManagementPolicy.js` é cópia de `domain/management.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/management.js';

const require = createRequire(import.meta.url);
const s = require('./federationManagementPolicy.js');

const HOJE = '2026-10-23';
const CONTRATO = {
  id: 'k1', sponsor_name: 'Raquetes Sul', start: '2026-01-01', end: '2026-11-10', status: 'active',
  installments: [{ id: 'p1', due: '2026-02-01', amount_cents: 50000, received_at: '2026-02-03' }, { id: 'p2', due: '2026-09-01', amount_cents: 50000 }, { id: 'p3', due: '2026-12-01', amount_cents: 50000 }],
  counterparts: [{ id: 'c1', text: 'Logo na camisa', due: '2026-03-01', done_at: '2026-03-01' }, { id: 'c2', text: 'Post mensal', due: '2026-10-01' }],
  warned: { installments: ['p2'] },
};
const BEM = { id: 'a1', name: 'Rede oficial', quantity: 6, status: 'active', loans: [{ id: 'l1', quantity: 2, out_at: '2026-10-01', due_at: '2026-10-10' }, { id: 'l2', quantity: 1, out_at: '2026-09-01', due_at: '2026-09-05', returned_at: '2026-09-05' }, { id: 'l3', quantity: 1, out_at: '2026-10-20', due_at: '2026-10-30', warned_for: '2026-10-30' }] };

describe('paridade: contratos e patrimônio', () => {
  it('os mesmos enums e tetos', () => {
    ['CONTRACT_STATUS', 'CONTRACT_TIERS', 'ASSET_CATEGORIES', 'ASSET_CONDITIONS', 'ASSET_STATUS', 'BORROWER_KINDS'].forEach((k) => expect(s[k], k).toEqual(c[k]));
    ['AMOUNT_MAX', 'CONTRACT_EXPIRY_WARN_DAYS', 'INSTALLMENTS_MAX', 'COUNTERPARTS_MAX', 'CONTRACT_NOTES_MAX', 'ASSET_NOTES_MAX', 'ASSET_QTY_MAX', 'LOANS_KEPT'].forEach((k) => expect(s[k], k).toBe(c[k]));
    expect(Object.keys(s.ASSET_CATEGORY_LABELS)).toEqual(Object.keys(c.ASSET_CATEGORY_LABELS));
  });

  it('o mesmo contrato, a mesma edição e a mesma situação', () => {
    [{}, { sponsor_name: ' X ', start: '2026-05-01', end: '2026-01-01', tier: 'gold', installments: [{ id: 'p1', due: '2026-06-01', amount_cents: 100 }, { id: 'p1', due: 'x', amount_cents: -1 }], counterparts: [{ text: 'ab' }] }, CONTRATO]
      .forEach((x) => expect(s.validateContract(x)).toEqual(c.validateContract(x)));
    const novo = c.validateContract({ ...CONTRATO, installments: CONTRATO.installments.slice(1) }).value;
    expect(s.mergeContractEdit(CONTRATO, novo)).toEqual(c.mergeContractEdit(CONTRATO, novo));
    const ok = c.validateContract(CONTRATO).value;
    expect(s.mergeContractEdit(CONTRATO, ok)).toEqual(c.mergeContractEdit(CONTRATO, ok));
    ['2025-12-01', HOJE, '2026-12-01'].forEach((d) => {
      expect(s.contractState(CONTRATO, d)).toEqual(c.contractState(CONTRATO, d));
      expect(s.contractAlerts(CONTRATO, d)).toEqual(c.contractAlerts(CONTRATO, d));
    });
    expect(s.contractState({ ...CONTRATO, status: 'cancelled' }, HOJE)).toEqual(c.contractState({ ...CONTRATO, status: 'cancelled' }, HOJE));
    expect(s.sponsorIncome([CONTRATO, null])).toEqual(c.sponsorIncome([CONTRATO, null]));
    expect(s.splitInstallments(100001, 3, '2026-01-31')).toEqual(c.splitInstallments(100001, 3, '2026-01-31'));
  });

  it('o mesmo bem, o mesmo empréstimo e os mesmos avisos', () => {
    [{}, { name: 'Placar', quantity: '3', category: 'x', condition: 'new', value_cents: '150000', acquired_at: '2026-01-02' }, { name: 'a', quantity: 0 }]
      .forEach((x) => expect(s.validateAsset(x)).toEqual(c.validateAsset(x)));
    expect(s.assetState(BEM, HOJE)).toEqual(c.assetState(BEM, HOJE));
    [{}, { borrower_kind: 'club', borrower_name: 'Clube X', quantity: 4, due_at: '2026-11-01' }, { borrower_name: 'Evento', quantity: 2, out_at: '2026-11-05', due_at: '2026-11-01' }]
      .forEach((x) => expect(s.validateLoan(BEM, x, HOJE)).toEqual(c.validateLoan(BEM, x, HOJE)));
    expect(s.overdueLoansToWarn(BEM, '2026-11-02')).toEqual(c.overdueLoansToWarn(BEM, '2026-11-02'));
    expect(s.trimLoans(BEM.loans)).toEqual(c.trimLoans(BEM.loans));
    ['canManageContracts', 'canViewContracts', 'canManageAssets', 'canViewAssets'].forEach((k) => [['fiscal'], ['competitions'], ['finance'], []].forEach((p) => expect(s[k](p)).toBe(c[k](p))));
  });
});
