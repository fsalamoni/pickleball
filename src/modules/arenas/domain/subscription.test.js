import { describe, it, expect } from 'vitest';
import {
  SUBSCRIPTION_STATUS,
  amountDue,
  dueDateForMonth,
  monthKey,
  monthsBetween,
  normalizeSubscriptionInput,
  subscriptionState,
} from './subscription.js';

const plano = (over = {}) => ({
  plan_name: 'Mensal', price: 200, billing_day: 10,
  started_on: '2026-06-01', paid_months: [], status: SUBSCRIPTION_STATUS.ACTIVE,
  ...over,
});

describe('monthKey', () => {
  it('extrai o mês de uma data', () => {
    expect(monthKey('2026-08-13')).toBe('2026-08');
  });

  it('entrada inválida devolve vazio', () => {
    expect(monthKey('nada')).toBe('');
    expect(monthKey(null)).toBe('');
  });
});

describe('dueDateForMonth', () => {
  it('monta o vencimento do mês', () => {
    expect(dueDateForMonth('2026-08', 10)).toBe('2026-08-10');
  });

  it('⭐ dia 31 em fevereiro vira o último dia — não escorrega para março', () => {
    expect(dueDateForMonth('2026-02', 31)).toBe('2026-02-28');
  });

  it('dia fora da faixa é preso nos limites', () => {
    expect(dueDateForMonth('2026-08', 0)).toBe('2026-08-01');
    expect(dueDateForMonth('2026-08', 99)).toBe('2026-08-31');
  });

  it('mês inválido devolve vazio', () => {
    expect(dueDateForMonth('xx', 10)).toBe('');
  });
});

describe('normalizeSubscriptionInput', () => {
  it('aceita um plano válido', () => {
    const r = normalizeSubscriptionInput({ plan_name: 'Mensal', price: 199.9, billing_day: 5 });
    expect(r.valid).toBe(true);
    expect(r.value.price).toBe(199.9);
    expect(r.value.billing_day).toBe(5);
  });

  it('exige nome e valor', () => {
    const r = normalizeSubscriptionInput({ price: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors.plan_name).toBeTruthy();
    expect(r.errors.price).toBeTruthy();
  });

  it('⭐ recusa vencimento acima de 28 — 29/30/31 não existem em todo mês', () => {
    expect(normalizeSubscriptionInput({ plan_name: 'x', price: 10, billing_day: 31 }).valid).toBe(false);
    expect(normalizeSubscriptionInput({ plan_name: 'x', price: 10, billing_day: 28 }).valid).toBe(true);
  });
});

describe('monthsBetween', () => {
  it('lista os meses, inclusive, atravessando o ano', () => {
    expect(monthsBetween('2026-11', '2027-02'))
      .toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('mesmo mês devolve um só', () => {
    expect(monthsBetween('2026-08', '2026-08')).toEqual(['2026-08']);
  });

  it('fim antes do início devolve vazio', () => {
    expect(monthsBetween('2026-08', '2026-07')).toEqual([]);
  });

  it('entrada inválida não quebra', () => {
    expect(monthsBetween(null, '2026-08')).toEqual([]);
  });
});

describe('⭐ subscriptionState', () => {
  it('em dia quando todos os meses estão pagos', () => {
    const s = subscriptionState(
      plano({ paid_months: ['2026-06', '2026-07', '2026-08'] }),
      '2026-08-20',
    );
    expect(s.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(s.monthsLate).toBe(0);
    expect(s.dueDate).toBe('2026-08-10');
  });

  it('⭐ antes do vencimento, o mês corrente NÃO conta como atraso', () => {
    // Vence dia 10; hoje é dia 3 e o mês ainda não foi pago.
    const s = subscriptionState(
      plano({ started_on: '2026-08-01', paid_months: [] }),
      '2026-08-03',
    );
    expect(s.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(s.paidCurrent).toBe(false);
  });

  it('depois do vencimento, o mês corrente conta', () => {
    const s = subscriptionState(
      plano({ started_on: '2026-08-01', paid_months: [] }),
      '2026-08-11',
    );
    expect(s.status).toBe(SUBSCRIPTION_STATUS.OVERDUE);
    expect(s.unpaidMonths).toEqual(['2026-08']);
  });

  it('⭐ mês pulado aparece, mesmo com o seguinte pago', () => {
    const s = subscriptionState(
      plano({ paid_months: ['2026-06', '2026-08'] }),
      '2026-08-20',
    );
    expect(s.unpaidMonths).toEqual(['2026-07']);
    expect(s.monthsLate).toBe(1);
  });

  it('encerrada não cobra nada', () => {
    const s = subscriptionState(
      plano({ status: SUBSCRIPTION_STATUS.CANCELLED }),
      '2026-08-20',
    );
    expect(s.status).toBe(SUBSCRIPTION_STATUS.CANCELLED);
    expect(s.monthsLate).toBe(0);
  });

  it('sem mensalidade, o estado é o neutro', () => {
    const s = subscriptionState(null, '2026-08-20');
    expect(s.status).toBe(SUBSCRIPTION_STATUS.CANCELLED);
    expect(s.unpaidMonths).toEqual([]);
  });

  it('não cobra meses anteriores ao início do plano', () => {
    const s = subscriptionState(
      plano({ started_on: '2026-08-01', paid_months: ['2026-08'] }),
      '2026-08-20',
    );
    expect(s.unpaidMonths).toEqual([]);
  });
});

describe('amountDue', () => {
  it('multiplica os meses em aberto pelo valor', () => {
    expect(amountDue(plano({ paid_months: ['2026-06'] }), '2026-08-20')).toBe(400);
  });

  it('em dia, deve zero', () => {
    expect(amountDue(plano({ paid_months: ['2026-06', '2026-07', '2026-08'] }), '2026-08-20')).toBe(0);
  });

  it('sem plano, zero', () => {
    expect(amountDue(null)).toBe(0);
  });
});
