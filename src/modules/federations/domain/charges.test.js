import { describe, expect, it } from 'vitest';
import { canConfirmCharge, canDeclarePayment, chargeDueDate, chargePixPayload, chargeTxid, chargesCsv, financeSummary, isChargeOverdue, sortChargesForStaff } from './charges.js';

const fed = { name: 'Federação Gaúcha', acronym: 'FGP', city: 'Porto Alegre', payment: { pix_key: 'a@b.co', receiver_name: 'FGP' } };

describe('Pix da cobrança', () => {
  it('gera o payload com valor e identificador da cobrança', () => {
    const p = chargePixPayload({ id: 'abc-123_XYZ', amount_cents: 12050 }, fed);
    expect(p).toMatch(/^000201/);
    expect(p).toContain('5406120.50');
    expect(p).toContain('abc123XYZ');
    expect(chargeTxid('abc-123_XYZ')).toBe('abc123XYZ');
  });
  it('sem chave não há Pix', () => {
    expect(chargePixPayload({ id: 'x', amount_cents: 1 }, { payment: {} })).toBeNull();
  });
});

describe('vencimento e estados', () => {
  it('vence em 10 dias; aberta e vencida é atrasada; declarada não', () => {
    expect(chargeDueDate('2026-10-18')).toBe('2026-10-28');
    expect(isChargeOverdue({ status: 'open', due_date: '2026-10-10' }, '2026-10-18')).toBe(true);
    expect(isChargeOverdue({ status: 'declared', due_date: '2026-10-10' }, '2026-10-18')).toBe(false);
    expect(canDeclarePayment({ status: 'paid' })).toBe(false);
    expect(canConfirmCharge({ status: 'declared' })).toBe(true);
  });
});

describe('financeSummary', () => {
  it('soma por estado e pelo mês do pagamento', () => {
    const s = financeSummary([
      { status: 'open', amount_cents: 100, due_date: '2026-10-01' },
      { status: 'declared', amount_cents: 200 },
      { status: 'paid', amount_cents: 300, paid_at: '2026-10-05' },
      { status: 'paid', amount_cents: 400, paid_at: '2026-09-05' },
      { status: 'cancelled', amount_cents: 999 },
    ], '2026-10-18');
    expect(s).toMatchObject({ open: 1, open_cents: 100, overdue: 1, declared: 1, declared_cents: 200, paid_month_cents: 300, paid_prev_month_cents: 400, paid_total_cents: 700 });
  });
  it('ordena informadas primeiro e exporta CSV com cabeçalho', () => {
    const ordem = sortChargesForStaff([{ status: 'paid' }, { status: 'open' }, { status: 'declared' }]).map((c) => c.status);
    expect(ordem).toEqual(['declared', 'open', 'paid']);
    const csv = chargesCsv([{ id: '1', payer_name: 'Ana "A"', origin: 'membership', amount_cents: 100, status: 'paid' }]);
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('"Ana ""A"""');
  });
});
