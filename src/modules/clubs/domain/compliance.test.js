import { describe, expect, it } from 'vitest';
import { clubComplianceChecklist, clubComplianceSummary, clubTransparencyChecklist, CLUB_TRANSPARENCY_ITEMS } from './compliance';

const NOW = Date.parse('2026-06-10T15:00:00Z');
const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));
const pub = (type, year = 2025) => ({ id: `${type}-${year}`, type, act_date: `${year}-03-01`, visibility: 'public', status: 'published' });
const presidente = (fim) => ({ user_id: 'u1', role_id: 'president', is_master: true, term_end: fim, term_end_ms: fim ? Date.parse(`${fim}T23:59:59-03:00`) : 0 });
const conselho = { user_id: 'u2', role_id: 'fiscal_council', perms: ['fiscal'], term_end_ms: 0 };

describe('clubComplianceChecklist', () => {
  it('sem fontes carregadas: nada é reprovado por falta de dado', () => {
    const r = porId(clubComplianceChecklist({ nowMs: NOW }));
    ['statute', 'mandate', 'election', 'fiscal', 'assembly', 'accounts', 'budget', 'transparency'].forEach((id) => expect(r[id].status).toBe('unknown'));
  });

  it('estatuto: só vale o publicado, vigente e aberto ao público', () => {
    expect(porId(clubComplianceChecklist({ docs: [], nowMs: NOW })).statute.status).toBe('attention');
    expect(porId(clubComplianceChecklist({ docs: [pub('statute')], nowMs: NOW })).statute.status).toBe('ok');
    const restrito = { ...pub('statute'), visibility: 'members' };
    expect(porId(clubComplianceChecklist({ docs: [restrito], nowMs: NOW })).statute.status).toBe('attention');
    const revogado = { ...pub('statute'), revoked_by: 'x' };
    expect(porId(clubComplianceChecklist({ docs: [revogado], nowMs: NOW })).statute.status).toBe('attention');
  });

  it('mandatos: vencido e presidência sem prazo pedem atenção; com prazo, ok', () => {
    expect(porId(clubComplianceChecklist({ staff: [], nowMs: NOW })).mandate.status).toBe('attention');
    expect(porId(clubComplianceChecklist({ staff: [presidente('2027-12-31')], nowMs: NOW })).mandate.status).toBe('ok');
    expect(porId(clubComplianceChecklist({ staff: [presidente('')], nowMs: NOW })).mandate.status).toBe('attention');
    const vencido = { user_id: 'u3', role_id: 'treasurer', perms: ['finance'], term_end_ms: NOW - 1000 };
    expect(porId(clubComplianceChecklist({ staff: [presidente('2027-12-31'), vencido], nowMs: NOW })).mandate.status).toBe('attention');
  });

  it('conselho fiscal: o cargo conta, o presidente não, e mandato vencido não conta', () => {
    expect(porId(clubComplianceChecklist({ staff: [presidente('2027-12-31')], nowMs: NOW })).fiscal.status).toBe('attention');
    expect(porId(clubComplianceChecklist({ staff: [presidente('2027-12-31'), conselho], nowMs: NOW })).fiscal.status).toBe('ok');
    expect(porId(clubComplianceChecklist({ staff: [{ ...conselho, term_end_ms: NOW - 1 }], nowMs: NOW })).fiscal.status).toBe('attention');
  });

  it('eleição: precisa do fim do mandato; longe do fim está ok; perto do fim sem edital pede atenção', () => {
    const el = { id: 'e1', title: 'Chapa 2027', status: 'published', calendar: { result_on: '2027-11-20' } };
    expect(porId(clubComplianceChecklist({ staff: [], elections: [], nowMs: NOW })).election.status).toBe('unknown');
    expect(porId(clubComplianceChecklist({ staff: [presidente('2028-12-31')], elections: [], nowMs: NOW })).election.status).toBe('ok');
    expect(porId(clubComplianceChecklist({ staff: [presidente('2026-09-30')], elections: [], nowMs: NOW })).election.status).toBe('attention');
    const rascunho = { ...el, status: 'draft', calendar: { result_on: '2026-09-01' } };
    expect(porId(clubComplianceChecklist({ staff: [presidente('2026-09-30')], elections: [rascunho], nowMs: NOW })).election.status).toBe('attention');
    const marcada = { ...el, calendar: { result_on: '2026-09-10' } };
    expect(porId(clubComplianceChecklist({ staff: [presidente('2026-09-30')], elections: [marcada], nowMs: NOW })).election.status).toBe('ok');
  });

  it('assembleia ordinária do ano, com a antecedência do estatuto', () => {
    expect(porId(clubComplianceChecklist({ events: [], nowMs: NOW })).assembly.status).toBe('attention');
    const certo = { type: 'assembly_ordinary', date: '2026-04-20', meeting: { convened_on: '2026-04-01' } };
    expect(porId(clubComplianceChecklist({ events: [certo], nowMs: NOW })).assembly.status).toBe('ok');
    const tarde = { type: 'assembly_ordinary', date: '2026-04-20', meeting: { convened_on: '2026-04-15' } };
    expect(porId(clubComplianceChecklist({ events: [tarde], nowMs: NOW })).assembly.status).toBe('attention');
    const cancelada = { type: 'assembly_ordinary', date: '2026-04-20', status: 'cancelled' };
    expect(porId(clubComplianceChecklist({ events: [cancelada], nowMs: NOW })).assembly.status).toBe('attention');
  });

  it('contas do ano anterior: publicada ou documento; senão diz em que fase está', () => {
    expect(porId(clubComplianceChecklist({ accountReports: [], nowMs: NOW })).accounts.status).toBe('attention');
    expect(porId(clubComplianceChecklist({ accountReports: [{ year: 2025, status: 'published' }], nowMs: NOW })).accounts.status).toBe('ok');
    const emParecer = porId(clubComplianceChecklist({ accountReports: [{ year: 2025, status: 'submitted' }], nowMs: NOW })).accounts;
    expect(emParecer.status).toBe('attention');
    expect(emParecer.detail).toContain('conselho fiscal');
    expect(porId(clubComplianceChecklist({ accountReports: [{ year: 2025, status: 'draft' }], docs: [pub('financial_statements')], nowMs: NOW })).accounts.status).toBe('ok');
  });

  it('orçamento do ano: aprovado ou publicado; a cópia não vale', () => {
    expect(porId(clubComplianceChecklist({ budgets: [], nowMs: NOW })).budget.status).toBe('attention');
    expect(porId(clubComplianceChecklist({ budgets: [{ year: 2026, status: 'approved' }], nowMs: NOW })).budget.status).toBe('ok');
    expect(porId(clubComplianceChecklist({ budgets: [{ year: 2026, status: 'draft' }], nowMs: NOW })).budget.status).toBe('attention');
    expect(porId(clubComplianceChecklist({ budgets: [{ year: 2026, status: 'approved', copy_of: 'x' }], nowMs: NOW })).budget.status).toBe('attention');
  });

  it('o resumo conta cada estado', () => {
    const r = clubComplianceChecklist({ nowMs: NOW });
    expect(clubComplianceSummary(r)).toEqual({ ok: 0, attention: 0, unknown: r.length, total: r.length });
  });
});

describe('clubTransparencyChecklist', () => {
  it('lista só os itens do clube e marca o que está publicado', () => {
    const r = clubTransparencyChecklist([pub('statute'), pub('minutes', 2024)], { nowMs: NOW });
    expect(r).toHaveLength(CLUB_TRANSPARENCY_ITEMS.length);
    expect(r.find((x) => x.id === 'statute').ok).toBe(true);
    expect(r.find((x) => x.id === 'minutes').ok).toBe(true);
    expect(r.find((x) => x.id === 'accounts').ok).toBe(false);
  });

  it('contas e parecer só valem do ano passado para cá', () => {
    const velho = clubTransparencyChecklist([pub('financial_statements', 2022)], { nowMs: NOW });
    expect(velho.find((x) => x.id === 'accounts').ok).toBe(false);
    const novo = clubTransparencyChecklist([pub('financial_statements', 2025)], { nowMs: NOW });
    expect(novo.find((x) => x.id === 'accounts').ok).toBe(true);
  });

  it('todo tipo exigido existe na lista de tipos do clube', async () => {
    const { CLUB_DOC_TYPE_IDS } = await import('./docs');
    CLUB_TRANSPARENCY_ITEMS.forEach((x) => x.types.forEach((tp) => expect(CLUB_DOC_TYPE_IDS).toContain(tp)));
  });
});
