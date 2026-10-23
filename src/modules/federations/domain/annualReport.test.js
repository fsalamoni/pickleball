import { describe, expect, it } from 'vitest';
import { annualReport, annualReportYears } from './annualReport';

const NOW = Date.UTC(2026, 9, 23, 15);
const fed = { name: 'Federação Gaúcha', acronym: 'FGP', modules: { tournaments: true, discipline: true } };
const secao = (r, id) => r.sections.find((s) => s.id === id);
const valor = (s, label) => s.rows.find((x) => x.label.startsWith(label))?.value;

describe('relatório anual', () => {
  it('oferece o ano atual e os quatro anteriores', () => {
    expect(annualReportYears(NOW)).toEqual([2026, 2025, 2024, 2023, 2022]);
  });

  it('fonte que não carregou é dita, nunca vira zero', () => {
    const r = annualReport({ federation: fed, year: 2026, nowMs: NOW });
    expect(secao(r, 'members').missing).toEqual(['filiados']);
    expect(secao(r, 'members').rows).toEqual([]);
    expect(secao(r, 'competitions').missing).toEqual(['torneios', 'resultados']);
    expect(secao(r, 'discipline').missing).toEqual(['ouvidoria', 'sanções']);
    expect(secao(r, 'finance').missing).toEqual(['cobranças']);
  });

  it('módulo desligado não aparece', () => {
    const r = annualReport({ federation: { ...fed, modules: {} }, year: 2026, members: [], nowMs: NOW });
    expect(secao(r, 'competitions')).toBeUndefined();
    expect(secao(r, 'discipline')).toBeUndefined();
    expect(secao(r, 'ranking')).toBeUndefined();
  });

  it('filiados: quem entrou no ano pelo número da filiação', () => {
    const members = [
      { status: 'active', valid_until: '2099-12-31', member_number: 'FGP-2026-000001' },
      { status: 'active', valid_until: '2099-12-31', member_number: 'FGP-2025-000002' },
      { status: 'active', valid_until: '2026-03-01', member_number: 'FGP-2025-000003' },
    ];
    const s = secao(annualReport({ federation: fed, year: 2026, members, nowMs: NOW }), 'members');
    expect(valor(s, 'Em dia hoje')).toBe('2');
    expect(valor(s, 'Entraram em 2026')).toBe('1');
    expect(valor(s, 'Venceram em 2026')).toBe('1');
  });

  it('finanças: a prestação enviada vence o que entrou pela plataforma', () => {
    const accountReports = [
      { period: '2026', status: 'draft', snapshot: { income_total: 1, expense_total: 1, balance: 0 } },
      { period: '2025', status: 'submitted', snapshot: { income_total: 500000, expense_total: 200000, balance: 300000 } },
    ];
    const charges = [{ status: 'paid', paid_at: '2026-04-01', amount_cents: 10000, origin: 'membership' }];
    const r25 = secao(annualReport({ federation: fed, year: 2025, accountReports, charges, nowMs: NOW }), 'finance');
    expect(valor(r25, 'Receitas')).toMatch(/5\.000,00/);
    const r26 = secao(annualReport({ federation: fed, year: 2026, accountReports, charges, nowMs: NOW }), 'finance');
    expect(valor(r26, 'Recebido pela plataforma')).toMatch(/100,00/);
    expect(r26.note).toMatch(/ainda não foi enviada/);
  });
});
