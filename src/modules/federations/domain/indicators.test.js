import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { federationIndicators, financeIndicators, indicatorsCsv, memberIndicators, monthKeys, renewalRate } from './indicators.js';

const HOJE = '2026-10-21';
const ts = (iso) => Timestamp.fromDate(new Date(`${iso}T15:00:00`));

describe('monthKeys', () => {
  it('12 meses terminando no atual, do mais antigo ao mais novo', () => {
    const k = monthKeys(HOJE);
    expect(k).toHaveLength(12);
    expect(k[0]).toBe('2025-11');
    expect(k[11]).toBe('2026-10');
  });
  it('vira o ano no fim do mês sem pular nem repetir', () => {
    expect(monthKeys('2026-01-31', 3)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('memberIndicators', () => {
  it('fonte que não veio é null, nunca zero', () => {
    expect(memberIndicators(undefined, HOJE)).toBeNull();
    expect(financeIndicators(undefined, HOJE)).toBeNull();
  });

  const membros = [
    { id: 'a', status: 'active', valid_until: '2027-05-01', plan_name: 'Anual', person_type: 'athlete', tier: 'federated', requested_at: ts('2026-10-02') },
    { id: 'b', status: 'active', valid_until: '2026-11-01', plan_name: 'Anual', person_type: 'coach', tier: 'federated', requested_at: ts('2026-03-10') },
    { id: 'c', status: 'active', valid_until: '2027-01-01', plan_name: 'Grátis', person_type: 'athlete', tier: 'registered', requested_at: ts('2024-03-10'), guardian_uid: 'pai' },
    // "active" com a validade passada é VENCIDA (a varredura ainda não gravou) e conta como não renovou.
    { id: 'd', status: 'active', valid_until: '2026-06-30', plan_name: 'Anual', requested_at: ts('2025-06-01') },
    { id: 'e', status: 'expired', valid_until: '2026-02-01', plan_name: 'Anual', requested_at: ts('2025-01-05') },
    // Venceu há mais de 12 meses: fica fora da janela.
    { id: 'f', status: 'expired', valid_until: '2025-08-01', plan_name: 'Anual', requested_at: ts('2024-08-01') },
    { id: 'g', status: 'pending', plan_name: 'Anual', requested_at: '2026-10-20' },
  ];

  it('em dia, vencendo, pedidos por mês e quem não renovou', () => {
    const m = memberIndicators(membros, HOJE);
    expect(m.total).toBe(7);
    expect(m.active).toBe(3);
    expect(m.expiring).toBe(1);
    expect(m.requestsByMonth.find((x) => x.month === '2026-10').n).toBe(2);
    expect(m.requestsByMonth.find((x) => x.month === '2026-03').n).toBe(1);
    expect(m.requests12).toBe(3);
    expect(m.notRenewed12).toBe(2);
    expect(m.dependents).toBe(1);
  });

  it('divisões só de quem está em dia, maior primeiro', () => {
    const m = memberIndicators(membros, HOJE);
    expect(m.byPlan).toEqual([{ key: 'Anual', n: 2 }, { key: 'Grátis', n: 1 }]);
    expect(m.byPersonType).toEqual([{ key: 'athlete', n: 2 }, { key: 'coach', n: 1 }]);
    expect(m.byTier).toEqual([{ key: 'federated', n: 2 }, { key: 'registered', n: 1 }]);
  });
});

describe('financeIndicators', () => {
  const cobrancas = [
    { status: 'paid', origin: 'membership', amount_cents: 12000, paid_at: '2026-10-05' },
    { status: 'paid', origin: 'renewal', amount_cents: 10000, paid_at: '2026-09-15' },
    { status: 'paid', origin: 'course', amount_cents: 5000, paid_at: '2026-09-20' },
    { status: 'paid', origin: 'renewal', amount_cents: 10000, paid_at: '2025-09-01' }, // fora da janela
    { status: 'open', origin: 'membership', amount_cents: 12000, due_date: '2026-10-01' }, // em atraso
    { status: 'open', origin: 'membership', amount_cents: 12000, due_date: '2026-10-30' }, // ainda no prazo
    { status: 'declared', origin: 'membership', amount_cents: 12000, due_date: '2026-10-01' }, // informada: não é atraso
    { status: 'cancelled', origin: 'fine', amount_cents: 3000 },
  ];

  it('recebido por mês e por origem nos 12 meses', () => {
    const f = financeIndicators(cobrancas, HOJE);
    expect(f.paid12Cents).toBe(27000);
    expect(f.paidByMonth.find((x) => x.month === '2026-09').cents).toBe(15000);
    expect(f.paidByOrigin).toEqual([{ key: 'membership', cents: 12000 }, { key: 'renewal', cents: 10000 }, { key: 'course', cents: 5000 }]);
    expect(f.renewalsPaid12).toBe(1);
  });

  it('atraso é só a cobrança ABERTA vencida (a informada espera o financeiro)', () => {
    const f = financeIndicators(cobrancas, HOJE);
    expect(f.overdue).toBe(1);
    expect(f.overdueCents).toBe(12000);
  });

  it('pago só com paid_at_ms também conta', () => {
    const f = financeIndicators([{ status: 'paid', origin: 'renewal', amount_cents: 100, paid_at_ms: new Date('2026-10-10T12:00:00').getTime() }], HOJE);
    expect(f.paid12Cents).toBe(100);
  });
});

describe('renewalRate', () => {
  it('renovou ÷ (renovou + não renovou), inteiro', () => {
    expect(renewalRate({ notRenewed12: 1 }, { renewalsPaid12: 3 })).toBe(75);
  });
  it('sem uma das fontes, ou sem ninguém para medir, é null', () => {
    expect(renewalRate(null, { renewalsPaid12: 3 })).toBeNull();
    expect(renewalRate({ notRenewed12: 0 }, { renewalsPaid12: 0 })).toBeNull();
  });
});

describe('indicatorsCsv', () => {
  it('só o que foi medido entra; célula-fórmula neutralizada', () => {
    const ind = federationIndicators({ members: [{ status: 'active', valid_until: '2027-01-01', plan_name: '=HYPERLINK("x")', requested_at: '2026-10-01' }], hoje: HOJE });
    const csv = indicatorsCsv(ind);
    expect(csv).toContain('"Em dia";"1"');
    expect(csv).toContain('"Mês";"Pedidos de filiação"');
    expect(csv).toContain('"10/2026";"1"');
    expect(csv).toContain('"Atleta";"1"');
    expect(csv).toContain('"Federado";"1"');
    expect(csv).not.toContain('Recebido');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('com as duas fontes traz a taxa de renovação e o dinheiro em reais', () => {
    const ind = federationIndicators({ members: [{ status: 'expired', valid_until: '2026-05-01' }], charges: [{ status: 'paid', origin: 'renewal', amount_cents: 15000, paid_at: '2026-10-01' }], hoje: HOJE });
    expect(ind.renewalRate).toBe(50);
    const csv = indicatorsCsv(ind);
    expect(csv).toContain('"Taxa de renovação (%)";"50"');
    expect(csv).toContain('"Recebido em 12 meses (R$)";"150,00"');
    expect(csv).toContain('"Renovação";"150,00"');
  });
});
