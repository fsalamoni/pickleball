import { describe, expect, it } from 'vitest';
import { assetState, contractAlerts, contractState, mergeContractEdit, overdueLoansToWarn, splitInstallments, sponsorIncome, trimLoans, validateAsset, validateContract, validateLoan } from './management';

const HOJE = '2026-10-23';
const base = { sponsor_name: 'Raquetes Sul', start: '2026-01-01', end: '2026-12-31', installments: [{ id: 'p1', due: '2026-02-01', amount_cents: 1000 }, { id: 'p2', due: '2026-03-01', amount_cents: 2000 }] };

describe('contratos de patrocínio', () => {
  it('valida e soma o total pelas parcelas', () => {
    const r = validateContract(base);
    expect(r.ok).toBe(true);
    expect(r.value.total_cents).toBe(3000);
    const ruim = validateContract({ sponsor_name: 'X', start: '2026-05-01', end: '2026-04-01', installments: [{ due: '', amount_cents: 0 }] });
    expect(Object.keys(ruim.errors)).toEqual(expect.arrayContaining(['sponsor_name', 'end', 'installments.0']));
  });

  it('linha nova não toma o id de uma parcela que já existe', () => {
    const r = validateContract({ ...base, installments: [{ id: 'p2', due: '2026-03-01', amount_cents: 1 }, { id: 'p3', due: '2026-04-01', amount_cents: 1 }, { id: '', due: '2026-05-01', amount_cents: 1 }] });
    expect(r.value.installments.map((x) => x.id)).toEqual(['p2', 'p3', 'p4']);
  });

  it('divide o total em parcelas mensais sem perder centavos', () => {
    const p = splitInstallments(100001, 3, '2026-01-31');
    expect(p.map((x) => x.due)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(p.reduce((s, x) => s + x.amount_cents, 0)).toBe(100001);
    expect(splitInstallments(0, 3, '2026-01-01')).toEqual([]);
  });

  it('parcela recebida não some nem muda de valor na edição', () => {
    const gravado = { ...base, installments: [{ ...base.installments[0], received_at: '2026-02-02', received_by: 'u' }, base.installments[1]] };
    expect(mergeContractEdit(gravado, validateContract({ ...base, installments: [base.installments[1]] }).value).error).toBeTruthy();
    expect(mergeContractEdit(gravado, validateContract({ ...base, installments: [{ ...base.installments[0], amount_cents: 999 }, base.installments[1]] }).value).error).toBeTruthy();
    const ok = mergeContractEdit(gravado, validateContract(base).value);
    expect(ok.value.installments[0]).toMatchObject({ received_at: '2026-02-02', received_by: 'u' });
    expect(ok.value.installments[1].received_at).toBe('');
  });

  it('situação: vigência, recebido, atrasado e contrapartidas', () => {
    const c = { ...base, end: '2026-11-10', installments: [{ id: 'p1', due: '2026-02-01', amount_cents: 1000, received_at: '2026-02-02' }, { id: 'p2', due: '2026-03-01', amount_cents: 2000 }], counterparts: [{ id: 'c1', text: 'Logo', due: '2026-04-01' }] };
    const st = contractState(c, HOJE);
    expect(st).toMatchObject({ state: 'expiring', received_cents: 1000, pending_cents: 2000, overdue_cents: 2000, counterparts_total: 1 });
    expect(st.counterparts_late).toHaveLength(1);
    expect(contractState({ ...c, status: 'cancelled' }, HOJE)).toMatchObject({ state: 'cancelled', overdue_cents: 0 });
    expect(contractState(c, '2025-12-31').state).toBe('upcoming');
    expect(contractState(c, '2026-12-01').state).toBe('ended');
    expect(contractAlerts(c, HOJE)).toEqual({ expiry: true, installments: ['p2'], counterparts: ['c1'] });
    expect(contractAlerts({ ...c, warned: { expiry_for: '2026-11-10', installments: ['p2'], counterparts: ['c1'] } }, HOJE)).toEqual({ expiry: false, installments: [], counterparts: [] });
  });

  it('só a parcela recebida vira receita de patrocínio', () => {
    const r = sponsorIncome([{ id: 'k', sponsor_name: 'S', installments: [{ id: 'p1', due: '2026-02-01', amount_cents: 1000, received_at: '2026-02-05' }, { id: 'p2', due: '2026-03-01', amount_cents: 1000 }] }]);
    expect(r).toEqual([expect.objectContaining({ date: '2026-02-05', amount_cents: 1000, category: 'sponsorship', ref: 'sponsor:k:p1', auto: 'sponsor' })]);
  });
});

describe('patrimônio', () => {
  const bem = { name: 'Rede', quantity: 5, loans: [{ id: 'l1', quantity: 2, due_at: '2026-10-10' }, { id: 'l2', quantity: 1, due_at: '2026-10-01', returned_at: '2026-10-01' }] };

  it('valida o bem', () => {
    expect(validateAsset({ name: 'Placar', quantity: 2 }).ok).toBe(true);
    expect(validateAsset({ name: 'P', quantity: 0 }).errors).toMatchObject({ name: expect.any(String), quantity: expect.any(String) });
  });

  it('emprestado, disponível e atrasado', () => {
    expect(assetState(bem, HOJE)).toMatchObject({ lent: 2, available: 3 });
    expect(assetState(bem, HOJE).overdue.map((l) => l.id)).toEqual(['l1']);
    expect(overdueLoansToWarn(bem, HOJE).map((l) => l.id)).toEqual(['l1']);
    expect(overdueLoansToWarn({ ...bem, loans: [{ ...bem.loans[0], warned_for: '2026-10-10' }] }, HOJE)).toEqual([]);
  });

  it('não empresta mais do que há, nem bem baixado', () => {
    expect(validateLoan(bem, { borrower_name: 'Clube', quantity: 4, due_at: '2026-11-01' }, HOJE).errors.quantity).toBeTruthy();
    expect(validateLoan(bem, { borrower_name: 'Clube', quantity: 3, due_at: '2026-11-01' }, HOJE).ok).toBe(true);
    expect(validateLoan({ ...bem, status: 'retired' }, { borrower_name: 'Clube', quantity: 1, due_at: '2026-11-01' }, HOJE).errors.asset).toBeTruthy();
  });

  it('guarda os abertos e os últimos devolvidos', () => {
    const muitos = Array.from({ length: 120 }, (_, i) => ({ id: `d${i}`, returned_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }));
    const r = trimLoans([{ id: 'aberto' }, ...muitos]);
    expect(r).toHaveLength(100);
    expect(r[0].id).toBe('aberto');
  });
});
