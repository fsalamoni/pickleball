import { describe, it, expect } from 'vitest';
import {
  normalizePackage,
  computeExpiresAt,
  normalizePackageSale,
  creditsRemaining,
  isSaleExpired,
  isSaleActive,
  studentActiveCredits,
  debitOne,
  revenueSummary,
  salesToCSV,
} from './package.js';

describe('normalizePackage', () => {
  const base = { coach_id: 'c1', name: 'Pacote 10', lessons_count: 10, price: 500, validity_days: 90 };
  it('valida pacote correto', () => {
    const r = normalizePackage(base);
    expect(r.valid).toBe(true);
    expect(r.value.active).toBe(true);
    expect(r.value.price).toBe(500);
  });
  it('exige coach_id e nome', () => {
    expect(normalizePackage({ ...base, coach_id: '' }).valid).toBe(false);
    expect(normalizePackage({ ...base, name: '' }).valid).toBe(false);
  });
  it('valida faixas de aulas e validade', () => {
    expect(normalizePackage({ ...base, lessons_count: 0 }).valid).toBe(false);
    expect(normalizePackage({ ...base, lessons_count: 999 }).valid).toBe(false);
    expect(normalizePackage({ ...base, validity_days: 0 }).valid).toBe(false);
  });
  it('exige preço válido', () => {
    expect(normalizePackage({ ...base, price: -1 }).valid).toBe(false);
    expect(normalizePackage({ ...base, price: 'abc' }).valid).toBe(false);
  });
});

describe('computeExpiresAt', () => {
  it('soma dias de validade', () => {
    expect(computeExpiresAt(new Date(2026, 0, 1), 30)).toBe('2026-01-31');
  });
  it('aceita string de data', () => {
    expect(computeExpiresAt('2026-01-01', 10)).toBe('2026-01-11');
  });
});

describe('normalizePackageSale', () => {
  const base = { coach_id: 'c1', student_id: 's1', package_id: 'p1', credits_total: 10, price: 500 };
  it('valida venda', () => {
    const r = normalizePackageSale(base);
    expect(r.valid).toBe(true);
    expect(r.value.credits_used).toBe(0);
    expect(r.value.paid).toBe(false);
  });
  it('exige ids', () => {
    expect(normalizePackageSale({ ...base, student_id: '' }).valid).toBe(false);
    expect(normalizePackageSale({ ...base, package_id: '' }).valid).toBe(false);
  });
  it('limita credits_used ao total', () => {
    expect(normalizePackageSale({ ...base, credits_used: 99 }).value.credits_used).toBe(10);
  });
});

describe('créditos e validade', () => {
  it('creditsRemaining', () => {
    expect(creditsRemaining({ credits_total: 10, credits_used: 3 })).toBe(7);
    expect(creditsRemaining({ credits_total: 5, credits_used: 9 })).toBe(0);
  });
  it('isSaleExpired', () => {
    const now = new Date(2026, 5, 15);
    expect(isSaleExpired({ expires_at: '2026-06-01' }, now)).toBe(true);
    expect(isSaleExpired({ expires_at: '2026-06-30' }, now)).toBe(false);
    expect(isSaleExpired({}, now)).toBe(false);
  });
  it('isSaleActive exige pago, saldo e não expirado', () => {
    const now = new Date(2026, 5, 15);
    expect(isSaleActive({ paid: true, credits_total: 10, credits_used: 2, expires_at: '2026-12-01' }, now)).toBe(true);
    expect(isSaleActive({ paid: false, credits_total: 10, credits_used: 2, expires_at: '2026-12-01' }, now)).toBe(false);
    expect(isSaleActive({ paid: true, credits_total: 10, credits_used: 10, expires_at: '2026-12-01' }, now)).toBe(false);
    expect(isSaleActive({ paid: true, credits_total: 10, credits_used: 0, expires_at: '2026-01-01' }, now)).toBe(false);
  });
  it('studentActiveCredits soma vendas ativas', () => {
    const now = new Date(2026, 5, 15);
    const sales = [
      { paid: true, credits_total: 10, credits_used: 3, expires_at: '2026-12-01' }, // 7
      { paid: true, credits_total: 5, credits_used: 0, expires_at: '2026-01-01' }, // expirada
      { paid: false, credits_total: 8, credits_used: 0, expires_at: '2026-12-01' }, // não paga
      { paid: true, credits_total: 4, credits_used: 1, expires_at: '2026-12-01' }, // 3
    ];
    expect(studentActiveCredits(sales, now)).toBe(10);
  });
});

describe('debitOne', () => {
  it('incrementa credits_used sem mutar', () => {
    const sale = { credits_total: 5, credits_used: 2 };
    const next = debitOne(sale);
    expect(next.credits_used).toBe(3);
    expect(sale.credits_used).toBe(2);
  });
  it('não excede o total', () => {
    expect(debitOne({ credits_total: 3, credits_used: 3 }).credits_used).toBe(3);
  });
});

describe('revenueSummary', () => {
  it('separa recebido de esperado', () => {
    const s = revenueSummary([
      { paid: true, price: 500 },
      { paid: true, price: 300 },
      { paid: false, price: 200 },
    ]);
    expect(s.revenue).toBe(800);
    expect(s.pending_revenue).toBe(200);
    expect(s.paid_count).toBe(2);
    expect(s.pending_count).toBe(1);
  });
});

describe('salesToCSV', () => {
  it('gera cabeçalho e linhas, escapando vírgulas', () => {
    const csv = salesToCSV([
      { student_name: 'Ana, Silva', package_name: 'P10', credits_total: 10, credits_used: 2, price: 500, paid: true, expires_at: '2026-12-01' },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Aluno');
    expect(lines[1]).toContain('"Ana, Silva"');
    expect(lines[1]).toContain('8'); // restantes
    expect(lines[1]).toContain('sim');
  });
});
