import { describe, expect, it } from 'vitest';
import { complianceChecklist, complianceSummary } from './compliance';

const NOW = Date.parse('2026-06-10T15:00:00Z');
const tudoLigado = { official_docs: true, calendar: true, discipline: true };
const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));
const pub = (type, year = 2025) => ({ id: `${type}-${year}`, type, act_date: `${year}-03-01`, visibility: 'public', status: 'published' });

describe('complianceChecklist', () => {
  it('sem fontes carregadas: nada é reprovado por falta de dado', () => {
    const r = porId(complianceChecklist({ federation: { modules: tudoLigado }, nowMs: NOW }));
    expect(r.fiscal.status).toBe('unknown');
    expect(r.assembly.status).toBe('unknown');
    expect(r.accounts.status).toBe('unknown');
    expect(r.transparency.status).toBe('unknown');
    expect(r.statute.status).toBe('unknown');
  });

  it('módulo desligado leva aos módulos, não à aba que não existe', () => {
    const r = porId(complianceChecklist({ federation: {}, staff: [], docs: [], events: [], nowMs: NOW }));
    expect(r.assembly).toMatchObject({ status: 'unknown', tab: 'modulos' });
    expect(r.accounts.tab).toBe('modulos');
    expect(r.ombudsman.status).toBe('attention');
  });

  it('mulheres e mandato vêm da governança', () => {
    const governance = { board: Array.from({ length: 10 }, (_, i) => ({ role: i === 0 ? 'Representante dos atletas' : 'Diretor', name: 'X' })), women_count: 3, mandate: { start: '2025-01-01', end: '2028-12-31' } };
    const r = porId(complianceChecklist({ federation: { governance }, nowMs: NOW }));
    expect(r.women.status).toBe('ok');
    expect(r.mandate.status).toBe('ok');
    expect(r.athletes.status).toBe('ok');
    const longo = porId(complianceChecklist({ federation: { governance: { ...governance, women_count: 2, mandate: { start: '2025-01-01', end: '2030-01-01' } } }, nowMs: NOW }));
    expect(longo.women.status).toBe('attention');
    expect(longo.mandate.status).toBe('attention');
    const vencido = porId(complianceChecklist({ federation: { governance: { mandate: { start: '2022-01-01', end: '2025-12-31' } } }, nowMs: NOW }));
    expect(vencido.mandate.status).toBe('attention');
  });

  it('conselho fiscal: o cargo conta, o presidente (admin) não', () => {
    const presidente = { role: 'president', perms: ['admin', 'fiscal'] };
    const so = porId(complianceChecklist({ federation: {}, staff: [presidente], nowMs: NOW }));
    expect(so.fiscal.status).toBe('attention');
    const com = porId(complianceChecklist({ federation: {}, staff: [presidente, { role: 'fiscal_council', perms: ['fiscal'] }], nowMs: NOW }));
    expect(com.fiscal.status).toBe('ok');
    const vencido = porId(complianceChecklist({ federation: {}, staff: [{ role: 'fiscal_council', perms: ['fiscal'], term_end_ms: NOW - 1 }], nowMs: NOW }));
    expect(vencido.fiscal.status).toBe('ok'); // o cargo conta pelo papel; a Equipe mostra o mandato vencido
  });

  it('assembleia ordinária do ano e a antecedência da convocação', () => {
    const fed = { modules: tudoLigado, rules: { convocation_min_days: 8 } };
    const sem = porId(complianceChecklist({ federation: fed, events: [], nowMs: NOW }));
    expect(sem.assembly.status).toBe('attention');
    const tarde = porId(complianceChecklist({ federation: fed, events: [{ type: 'assembly_ordinary', date: '2026-04-20', meeting: { convened_on: '2026-04-15' } }], nowMs: NOW }));
    expect(tarde.assembly.status).toBe('attention');
    const certo = porId(complianceChecklist({ federation: fed, events: [{ type: 'assembly_ordinary', date: '2026-04-20', meeting: { convened_on: '2026-04-01' } }], nowMs: NOW }));
    expect(certo.assembly.status).toBe('ok');
    const cancelada = porId(complianceChecklist({ federation: fed, events: [{ type: 'assembly_ordinary', date: '2026-04-20', status: 'cancelled' }], nowMs: NOW }));
    expect(cancelada.assembly.status).toBe('attention');
  });

  it('contas e transparência pelo acervo público', () => {
    const fed = { modules: tudoLigado, governance: { statute_url: 'https://x' } };
    const vazio = porId(complianceChecklist({ federation: fed, docs: [], nowMs: NOW }));
    expect(vazio.accounts.status).toBe('attention');
    expect(vazio.accounts.detail).toMatch(/abril/);
    expect(vazio.transparency.status).toBe('attention');
    expect(vazio.statute.status).toBe('ok');
    const docs = ['statute', 'leaders_pay', 'agreements', 'financial_statements', 'fiscal_opinion', 'management_report', 'annual_calendar', 'minutes'].map((x) => pub(x));
    const cheio = porId(complianceChecklist({ federation: fed, docs, nowMs: NOW }));
    expect(cheio.accounts.status).toBe('ok');
    expect(cheio.transparency.status).toBe('ok');
  });

  it('com o módulo de contas: orçamento do ano e prestação publicada valem', () => {
    const federation = { modules: { accounts: true } };
    const semFonte = porId(complianceChecklist({ federation, nowMs: NOW }));
    expect(semFonte.budget.status).toBe('unknown');
    const vazio = porId(complianceChecklist({ federation, budgets: [], accountReports: [], nowMs: NOW }));
    expect(vazio.budget).toMatchObject({ status: 'attention', tab: 'orcamento-anual' });
    expect(vazio.accounts).toMatchObject({ status: 'attention', tab: 'prestacao-contas' });
    const emAndamento = porId(complianceChecklist({ federation, budgets: [{ year: 2026, status: 'submitted' }], accountReports: [{ year: 2025, status: 'submitted' }], nowMs: NOW }));
    expect(emAndamento.budget.status).toBe('attention');
    expect(emAndamento.accounts.detail).toContain('conselho fiscal');
    const ok = porId(complianceChecklist({ federation, budgets: [{ year: 2026, status: 'approved' }, { year: 2026, status: 'draft', copy_of: 'x' }], accountReports: [{ year: 2025, status: 'published' }], nowMs: NOW }));
    expect(ok.budget.status).toBe('ok');
    expect(ok.accounts.status).toBe('ok');
    expect(porId(complianceChecklist({ federation: {}, budgets: [], nowMs: NOW })).budget).toBeUndefined();
  });

  it('com o módulo de eleições: a sucessão tem de estar marcada perto do fim do mandato', () => {
    const fed = (end) => ({ modules: { elections: true }, governance: { mandate: { start: '2023-01-01', end } } });
    expect(porId(complianceChecklist({ federation: { modules: { elections: true } }, elections: [], nowMs: NOW })).election.status).toBe('unknown');
    expect(porId(complianceChecklist({ federation: fed('2026-08-31'), nowMs: NOW })).election.status).toBe('unknown');
    expect(porId(complianceChecklist({ federation: fed('2027-12-31'), elections: [], nowMs: NOW })).election.status).toBe('ok');
    expect(porId(complianceChecklist({ federation: fed('2026-08-31'), elections: [], nowMs: NOW })).election).toMatchObject({ status: 'attention', tab: 'eleicoes' });
    const rascunho = [{ title: 'Eleição 2026', status: 'draft', calendar: { result_on: '2026-08-20' } }];
    expect(porId(complianceChecklist({ federation: fed('2026-08-31'), elections: rascunho, nowMs: NOW })).election.status).toBe('attention');
    const publicada = [{ title: 'Eleição 2026', status: 'published', calendar: { result_on: '2026-08-20' } }];
    expect(porId(complianceChecklist({ federation: fed('2026-08-31'), elections: publicada, nowMs: NOW })).election.status).toBe('ok');
    const antiga = [{ title: 'Eleição 2022', status: 'closed', calendar: { result_on: '2022-11-20' } }];
    expect(porId(complianceChecklist({ federation: fed('2026-08-31'), elections: antiga, nowMs: NOW })).election.status).toBe('attention');
  });

  it('resumo conta os estados', () => {
    const s = complianceSummary([{ status: 'ok' }, { status: 'attention' }, { status: 'unknown' }, { status: 'ok' }]);
    expect(s).toEqual({ ok: 2, attention: 1, unknown: 1, total: 4 });
  });
});
