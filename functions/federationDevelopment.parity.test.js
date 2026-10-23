/**
 * PARIDADE cliente × servidor de embaixadores e selo de clube (rodada 3,
 * Bloco 3): a tela valida e mostra o mesmo que o servidor grava
 * (`federationDevelopmentPolicy.js` é cópia de `domain/development.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/development.js';

const require = createRequire(import.meta.url);
const s = require('./federationDevelopmentPolicy.js');

const HOJE = ['2026-01-31', '2026-10-23', '2027-01-01'];
const AMBS = [
  null,
  { status: 'applied' },
  { status: 'appointed', next_report_due: '2026-10-01', conduct_version: 1, term_until: '' },
  { status: 'appointed', next_report_due: '2027-01-01', conduct_version: 2, term_until: '2026-12-31' },
  { status: 'rejected' },
  { status: 'ended' },
];
const RULES = [undefined, {}, { conduct_text: 'curto', report_months: 5 }, { conduct_text: 'Um código de conduta inteiro, longo o bastante.', conduct_version: 3, report_months: 6, open: false }];
const SEAL_RULES = [undefined, { criteria: [] }, { name: ' Selo Ouro ', validity_months: 99, criteria: [{ id: 'A b', label: 'Um', auto: 'x' }, { id: 'a', label: 'Dois critérios', auto: 'hosted_event', required: false }, { label: 'xy' }] }];
const SEALS = [null, { status: 'applied' }, { status: 'granted', granted_until: '2026-11-01' }, { status: 'applied', granted_until: '2027-06-01' }, { status: 'revoked', granted_until: '2027-06-01' }, { status: 'rejected', granted_until: '2026-01-01' }];

describe('paridade: embaixadores e selo de clube', () => {
  it('os mesmos enums, tetos e textos padrão', () => {
    ['AMBASSADOR_STATUS', 'AMB_REPORT_MONTHS', 'AMB_LIMITS', 'SEAL_STATUS', 'SEAL_AUTO', 'SEAL_LIMITS', 'DEFAULT_SEAL_CRITERIA'].forEach((k) => expect(s[k], k).toEqual(c[k]));
    ['DEFAULT_CONDUCT', 'DEFAULT_SEAL_NAME'].forEach((k) => expect(s[k], k).toBe(c[k]));
    ['AMBASSADOR_STATUS_LABELS', 'SEAL_STATUS_LABELS', 'SEAL_AUTO_LABELS'].forEach((k) => expect(s[k], k).toEqual({ ...c[k] }));
  });

  it('as mesmas datas e caminhos', () => {
    [['2026-01-31', 1], ['2026-03-31', -1], ['2026-10-23', 12], ['x', 1]].forEach(([d, n]) => expect(s.addMonthsISO(d, n)).toBe(c.addMonthsISO(d, n)));
    [['federacao/u1/a.pdf', 'u1'], ['federacao/u2/a.pdf', 'u1'], ['federacao/u1/../a.pdf', 'u1'], ['x', '']].forEach(([p, u]) => expect(s.ownFilePath(p, u)).toBe(c.ownFilePath(p, u)));
  });

  it('as mesmas regras, candidaturas e situações de embaixador', () => {
    RULES.forEach((r) => expect(s.normalizeAmbassadorRules(r)).toEqual(c.normalizeAmbassadorRules(r)));
    [{}, { motivation: 'quero muito ajudar a crescer o esporte', region_wish: 'Serra', accept_conduct: true }, { motivation: 'x', accept_conduct: 'sim' }]
      .forEach((x) => expect(s.validateAmbassadorApply(x)).toEqual(c.validateAmbassadorApply(x)));
    HOJE.forEach((h) => {
      [{}, { region: 'Litoral', term_until: '2027-01-01' }, { region: 'Litoral', term_until: h }, { region: 'L', term_until: 'x' }]
        .forEach((x) => expect(s.validateAppointment(x, h)).toEqual(c.validateAppointment(x, h)));
      AMBS.forEach((a) => RULES.forEach((r) => expect(s.ambassadorState(a, r, h)).toEqual(c.ambassadorState(a, r, h))));
      const lista = [{ status: 'appointed', key: 'k1', user_name: 'Bia', region: 'Serra', appointed_at: '2026-01-01' }, { status: 'appointed', key: 'k2', user_name: 'Ana', region: 'Litoral', term_until: '2026-05-01' }, { status: 'applied', user_name: 'Caio' }];
      expect(s.ambassadorsPublic(lista, h)).toEqual(c.ambassadorsPublic(lista, h));
    });
    [{}, { text: 'curto' }, { text: 'fiz três clínicas na serra e um festival' }].forEach((x) => expect(s.validateReport(x)).toEqual(c.validateReport(x)));
  });

  it('as mesmas regras, evidências, situações e decisões do selo', () => {
    SEAL_RULES.forEach((r) => expect(s.normalizeSealRules(r)).toEqual(c.normalizeSealRules(r)));
    const ev = { evidence: { safeguarding: { text: 'política anexa', file: { path: 'federacao/u1/p.pdf', name: 'p.pdf' } }, insurance: { file: { path: 'federacao/u9/x.pdf' } } } };
    ['club', 'arena'].forEach((k) => {
      SEAL_RULES.forEach((r) => {
        [{}, ev].forEach((x) => expect(s.validateSealApply(r, k, x, 'u1')).toEqual(c.validateSealApply(r, k, x, 'u1')));
        [[{}, {}], [{ hosted_event: true, licensed_coach: true }, { safeguarding: true, insurance: true, courts: true }], [{ licensed_coach: false }, { safeguarding: true, coach: true, insurance: true, courts: true }]]
          .forEach(([a, m]) => expect(s.sealDecision(r, k, a, m)).toEqual(c.sealDecision(r, k, a, m)));
      });
    });
    HOJE.forEach((h) => {
      SEALS.forEach((x) => expect(s.sealState(x, h)).toEqual(c.sealState(x, h)));
      [null, { seal: { valid_until: '2026-12-01' } }, { seal: {} }].forEach((a) => expect(s.affiliationSealValid(a, h)).toBe(c.affiliationSealValid(a, h)));
    });
    [[], ['members'], ['finance'], ['admin']].forEach((p) => expect(s.canManageDevelopment(p)).toBe(c.canManageDevelopment(p)));
  });
});
