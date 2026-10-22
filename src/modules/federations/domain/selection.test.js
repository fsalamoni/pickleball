import { describe, it, expect } from 'vitest';
import {
  APPLICATION_STATUS, CALLUP_CRITERIA, appealUntil, callupCostsTotal, callupDocsState, callupExpenses, callupInviteOpen, canAppeal,
  grantAcceptsApplications, grantCanFinalize, grantExpenses, grantNoticeText, grantPublicResult, grantSlotsLeft, normalizeCallup,
  normalizeCallupCosts, normalizeGrantDocs, ownFilePath, validateApplication, validateCallup, validateGrant,
} from './selection';

const CONVOCACAO = { title: 'Seleção gaúcha', event_name: 'Brasileiro 2027', starts_at: '2027-03-10', criterion: 'ranking', season: 2026 };
const EDITAL = { title: 'Auxílio-viagem', description: 'Ajuda para a viagem ao Brasileiro.', criteria: 'Ranking oficial de 2026.', closes_at: '2026-11-10' };

describe('convocação', () => {
  it('pelo ranking exige o ano; a dedo não guarda ano nem categorias', () => {
    expect(validateCallup(CONVOCACAO).ok).toBe(true);
    expect(validateCallup({ ...CONVOCACAO, season: null }).errors.season).toBe('required');
    const manual = normalizeCallup({ ...CONVOCACAO, criterion: CALLUP_CRITERIA.MANUAL, categories: ['x'] });
    expect([manual.season, manual.categories]).toEqual([null, null]);
  });

  it('o fim antes do começo é erro; documentos fora da lista somem', () => {
    expect(validateCallup({ ...CONVOCACAO, ends_at: '2027-03-01' }).errors.ends_at).toBe('before_start');
    expect(normalizeCallup({ ...CONVOCACAO, travel_docs: ['passport', 'inventado'] }).travel_docs).toEqual(['passport']);
  });

  it('custos: id repetido vira outro, o pago entra nas contas e o rascunho não', () => {
    const custos = normalizeCallupCosts([{ id: 'a', label: 'Passagem', amount_cents: 1000, paid_at: '2026-10-01' }, { id: 'a', label: 'Hotel', amount_cents: 500 }]);
    expect(new Set(custos.map((x) => x.id)).size).toBe(2);
    expect(callupCostsTotal(custos)).toEqual({ planned: 1500, paid: 1000 });
    const despesas = callupExpenses([{ id: 'k', title: 'Seleção', status: 'closed', costs: custos }, { id: 'r', status: 'draft', costs: custos }]);
    expect(despesas).toHaveLength(1);
    expect(despesas[0]).toMatchObject({ amount_cents: 1000, category: 'travel', ref: 'callup:k:a', auto: 'callup' });
  });

  it('convite aberto só antes do prazo; documentos conferidos sobre os pedidos', () => {
    expect(callupInviteOpen({ status: 'invited', expires_at_ms: 2000 }, 1000)).toBe(true);
    expect(callupInviteOpen({ status: 'invited', expires_at_ms: 500 }, 1000)).toBe(false);
    expect(callupDocsState({ travel_docs: ['id_doc', 'medical'] }, { docs_ok: { id_doc: true, passport: true } })).toEqual({ required: ['id_doc', 'medical'], ok: ['id_doc'], missing: ['medical'], complete: false });
  });
});

describe('editais', () => {
  it('validação e documentos pedidos com chave pela ordem', () => {
    expect(validateGrant(EDITAL).ok).toBe(true);
    expect(validateGrant({ ...EDITAL, opens_at: '2026-12-01' }).errors.closes_at).toBe('before_open');
    expect(normalizeGrantDocs(['RG', '', { label: 'Comprovante' }])).toEqual([{ key: 'd1', label: 'RG' }, { key: 'd2', label: 'Comprovante' }]);
  });

  it('inscrição aceita só no período e com o edital aberto', () => {
    const g = { ...EDITAL, status: 'open', opens_at: '2026-10-20' };
    expect(grantAcceptsApplications(g, '2026-10-19')).toBe(false);
    expect(grantAcceptsApplications(g, '2026-11-10')).toBe(true);
    expect(grantAcceptsApplications(g, '2026-11-11')).toBe(false);
    expect(grantAcceptsApplications({ ...g, status: 'review' }, '2026-10-25')).toBe(false);
  });

  it('o arquivo tem de estar na pasta de quem se inscreve', () => {
    expect(ownFilePath('federacao/u1/abc.pdf', 'u1')).toBe(true);
    expect(ownFilePath('federacao/u2/abc.pdf', 'u1')).toBe(false);
    const g = { required_docs: [{ key: 'd1', label: 'RG' }] };
    expect(validateApplication(g, { text: 'Justificativa longa.', files: { d1: { path: 'federacao/u2/x.pdf' } } }, 'u1').errors.d1).toBe('required');
    expect(validateApplication(g, { text: 'Justificativa longa.', files: { d1: { path: 'federacao/u1/x.pdf' } } }, 'u1').ok).toBe(true);
  });

  it('resultado público sem uid, vagas, recurso e encerramento', () => {
    const apps = [{ id: 'b', user_id: 'u2', user_name: 'Bia', status: 'approved' }, { id: 'a', user_id: 'u1', user_name: 'Ana', status: APPLICATION_STATUS.REJECTED }];
    expect(grantPublicResult(apps)).toEqual([{ application_id: 'b', name: 'Bia' }]);
    expect(grantSlotsLeft({ slots: 1 }, apps)).toBe(0);
    const g = { status: 'result', appeal_until: appealUntil('2026-10-22', 3) };
    expect(g.appeal_until).toBe('2026-10-25');
    expect(canAppeal(apps[1], g, '2026-10-25')).toBe(true);
    expect(canAppeal(apps[1], g, '2026-10-26')).toBe(false);
    expect(canAppeal({ ...apps[1], appeal: { status: 'pending' } }, g, '2026-10-24')).toBe(false);
    expect(grantCanFinalize(g, apps, '2026-10-25')).toBe(false);
    expect(grantCanFinalize(g, apps, '2026-10-26')).toBe(true);
    expect(grantCanFinalize(g, [{ ...apps[1], appeal: { status: 'pending' } }], '2026-10-26')).toBe(false);
  });

  it('pagamento vira despesa na categoria do tipo de apoio', () => {
    const d = grantExpenses([{ id: 'g', title: 'Bolsa', kind: 'scholarship', payments: [{ application_id: 'b', name: 'Bia', amount_cents: 30000, paid_at: '2026-11-20' }, { application_id: 'c', amount_cents: 0, paid_at: '2026-11-20' }] }]);
    expect(d).toEqual([{ date: '2026-11-20', amount_cents: 30000, category: 'other_expense', ref: 'grant:g:b', description: 'Bolsa · Bia', auto: 'grant' }]);
  });

  it('o texto oficial do edital diz quem pode se inscrever', () => {
    expect(grantNoticeText({ name: 'Federação X', acronym: 'FX' }, EDITAL)).toContain('Só filiados em dia podem se inscrever.');
    expect(grantNoticeText({ name: 'Federação X' }, { ...EDITAL, members_only: false })).toContain('qualquer atleta');
  });
});
