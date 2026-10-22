/**
 * PARIDADE cliente × servidor da seleção e dos editais: a tela valida, conta
 * e mostra o mesmo que o servidor grava (`federationSelectionPolicy.js` é
 * cópia de `domain/selection.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/selection.js';

const require = createRequire(import.meta.url);
const s = require('./federationSelectionPolicy.js');

const HOJE = '2026-10-22';
const CATS = [
  { key: 'f|open|doubles', gender_category: 'female', rows: [{ uid: 'a', name: 'A', position: 1 }, { uid: 'b', name: 'B', position: 2 }, { uid: 'c', position: 3 }] },
  { key: 'm|50+|singles', age_category: '50+', format: 'singles', rows: [{ uid: 'd', position: 1 }] },
];
const GRANT = { id: 'g1', title: 'Auxílio', kind: 'travel', slots: 2, status: 'result', appeal_until: '2026-10-25', required_docs: [{ key: 'd1', label: 'RG' }], amount_cents: 50000, payments: [{ application_id: 'x', name: 'Ana', amount_cents: 50000, paid_at: '2026-10-20' }] };
const APPS = [{ id: 'x', user_name: 'Ana', status: 'approved' }, { id: 'y', user_name: 'Bia', status: 'rejected', appeal: { status: 'pending' } }, { id: 'z', status: 'withdrawn' }];

describe('paridade: seleção e editais', () => {
  it('os mesmos enums e tetos', () => {
    ['CALLUP_STATUS', 'CALLUP_PUBLIC_STATUSES', 'CALLUP_CRITERIA', 'TRAVEL_DOCS', 'UNIFORM_SIZES', 'CALLUP_COST_CATEGORIES', 'CALLUP_MEMBER_STATUS', 'GRANT_STATUS', 'GRANT_PUBLIC_STATUSES', 'GRANT_KINDS', 'GRANT_KIND_EXPENSE', 'APPLICATION_STATUS', 'APPEAL_STATUS']
      .forEach((k) => expect(s[k], k).toEqual(c[k]));
    ['CALLUP_COSTS_MAX', 'CALLUP_PER_CATEGORY_MAX', 'CALLUP_TEXT_MAX', 'MANUAL_CATEGORY', 'GRANT_DOCS_MAX', 'GRANT_TEXT_MAX', 'APPLICATION_TEXT_MAX']
      .forEach((k) => expect(s[k], k).toBe(c[k]));
  });

  it('a mesma convocação, os mesmos custos e os mesmos convidados', () => {
    [{}, { title: 'Seleção', event_name: 'Brasileiro', starts_at: '2026-12-01', ends_at: '2026-11-01', criterion: 'ranking', season: 2026, categories: ['a', 'a'] }, { criterion: 'manual', season: 2026, per_category: 99, travel_docs: ['passport', 'x'], collect_uniform: 'sim' }]
      .forEach((x) => expect(s.validateCallup(x)).toEqual(c.validateCallup(x)));
    const custos = [{ id: 'c1', label: 'Passagem', amount_cents: 120000, paid_at: '2026-10-01' }, { id: 'c1', label: 'Hotel', category: 'x', amount_cents: -5 }, null];
    expect(s.normalizeCallupCosts(custos)).toEqual(c.normalizeCallupCosts(custos));
    expect(s.callupCostsTotal(custos)).toEqual(c.callupCostsTotal(custos));
    const cus = [{ id: 'k1', title: 'Seleção', status: 'open', costs: custos }, { id: 'k2', status: 'draft', costs: custos }];
    expect(s.callupExpenses(cus)).toEqual(c.callupExpenses(cus));
    const cu = { season: 2026, per_category: 2, accept_days: 5 };
    expect(s.callupInvitesToSend(CATS, [{ category_key: 'f|open|doubles', user_id: 'a', status: 'declined' }], cu)).toEqual(c.callupInvitesToSend(CATS, [{ category_key: 'f|open|doubles', user_id: 'a', status: 'declined' }], cu));
    const membros = [{ status: 'invited' }, { status: 'accepted' }, { status: 'x' }];
    expect(s.callupCounts(membros)).toEqual(c.callupCounts(membros));
    expect(s.callupDocsState({ travel_docs: ['id_doc', 'medical'] }, { docs_ok: { id_doc: true } })).toEqual(c.callupDocsState({ travel_docs: ['id_doc', 'medical'] }, { docs_ok: { id_doc: true } }));
  });

  it('o mesmo edital, a mesma inscrição e o mesmo resultado', () => {
    [{}, { title: 'Auxílio-viagem', description: 'Para o Brasileiro.', criteria: 'Ranking do ano.', closes_at: '2026-11-01', opens_at: '2026-12-01', required_docs: ['RG', { label: 'CPF' }, ''] }]
      .forEach((x) => expect(s.validateGrant(x)).toEqual(c.validateGrant(x)));
    const insc = { text: 'Preciso do apoio para viajar.', files: { d1: { path: 'federacao/u1/abc.pdf', name: 'rg.pdf' } } };
    expect(s.validateApplication(GRANT, insc, 'u1')).toEqual(c.validateApplication(GRANT, insc, 'u1'));
    expect(s.validateApplication(GRANT, insc, 'u2')).toEqual(c.validateApplication(GRANT, insc, 'u2'));
    expect(s.grantSlotsLeft(GRANT, APPS)).toBe(c.grantSlotsLeft(GRANT, APPS));
    expect(s.grantPublicResult(APPS)).toEqual(c.grantPublicResult(APPS));
    ['2026-10-24', '2026-10-26'].forEach((d) => {
      expect(s.canAppeal(APPS[1], GRANT, d)).toBe(c.canAppeal(APPS[1], GRANT, d));
      expect(s.grantCanFinalize(GRANT, APPS, d)).toBe(c.grantCanFinalize(GRANT, APPS, d));
    });
    expect(s.appealUntil(HOJE, 5)).toBe(c.appealUntil(HOJE, 5));
    expect(s.grantExpenses([GRANT])).toEqual(c.grantExpenses([GRANT]));
    expect(s.grantNoticeText({ name: 'Federação X', acronym: 'FX' }, { ...GRANT, description: 'Descrição longa.', criteria: 'Critérios claros.', closes_at: '2026-11-01' }))
      .toBe(c.grantNoticeText({ name: 'Federação X', acronym: 'FX' }, { ...GRANT, description: 'Descrição longa.', criteria: 'Critérios claros.', closes_at: '2026-11-01' }));
  });
});
