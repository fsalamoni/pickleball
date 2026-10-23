/**
 * PARIDADE cliente × servidor da licença de professor e da proteção de
 * menores (Bloco 4): a tela mostra os mesmos requisitos, a mesma situação, o
 * mesmo selo e a mesma liberação que o servidor confere e grava.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as lic from '@/modules/federations/domain/coachLicenses.js';
import * as sg from '@/modules/federations/domain/safeguarding.js';

const require = createRequire(import.meta.url);
const s = require('./federationCoachingPolicy.js');

const HOJE = '2026-10-22';
const REGRAS = [
  undefined,
  {},
  { levels: [] },
  { levels: [{ id: 'Base!', label: '  Nível   Base ', requires_credential: false, update_hours: '6', valid_months: 99 }, { id: 'base', label: 'dup' }, { id: '', label: 'x' }, { id: 'av', label: '' }] },
  { levels: [{ id: 'l1', label: 'Nível 1', update_hours: -5, valid_months: 0 }, { id: 'l2', label: 'Nível 2', update_hours: 500 }] },
];
const CREDS = [
  { id: 'c1', kind: 'coach', level: 'nivel 1', status: 'active', valid_until: '2027-01-01', course_name: 'Formação 1' },
  { id: 'c2', kind: 'coach', level: 'l2', status: 'active', valid_until: '2026-01-01' },
  { id: 'c3', kind: 'coach', level: 'Nível 2', status: 'revoked' },
  { id: 'c4', kind: 'referee', level: 'Nível 1', status: 'active' },
  { id: 's1', kind: 'safeguarding', federation_id: 'fgp', status: 'active', valid_until: '2027-03-01' },
  { id: 's2', kind: 'safeguarding', federation_id: 'fgp', status: 'active', valid_until: '2026-12-01' },
  { id: 's3', kind: 'safeguarding', federation_id: 'outra', status: 'active' },
];
const HORAS = [
  { date: '2026-09-01', hours: 4 }, { date: '2025-11-01', hours: 3.7 }, { date: '2025-10-01', hours: 20 }, { date: '2026-12-01', hours: 9 }, { date: 'x', hours: 5 }, { date: '2026-05-05', hours: -3 },
];
const LICENCAS = [
  null,
  { status: 'pending' },
  { status: 'active', valid_until: '2027-06-01' },
  { status: 'active', valid_until: '2026-11-10' },
  { status: 'active', valid_until: '2026-11-10', renewal_requested_at_ms: 1 },
  { status: 'active', valid_until: '2026-10-01' },
  { status: 'declined' },
  { status: 'suspended', valid_until: '2027-06-01' },
  { status: 'revoked' },
  { status: 'active', valid_until: '2027-06-01', public_listing: false, level: 'l1', level_label: 'Nível 1' },
];
const FEDS = [
  { id: 'fgp', acronym: 'FGP', name: 'Federação Gaúcha', slug: 'fgp', status: 'approved', published: true },
  { id: 'fx', name: 'Federação X sem sigla', status: 'approved', published: false },
  { id: 'fy', acronym: 'FY', status: 'pending', published: true },
];
const SGR = [undefined, {}, { required_for: [] }, { required_for: ['staff', 'coach', 'xx'], background_months: '24' }, { background_months: 0 }, { background_months: 100 }];
const REGISTROS = [
  null, {}, { background: { status: 'pending' } },
  { background: { status: 'valid', valid_until: '2027-02-01' } },
  { background: { status: 'valid', valid_until: '2026-10-01' } },
  { background: { status: 'rejected' } }, { background: { status: 'revoked' } },
];

describe('paridade: licença de professor', () => {
  it('os mesmos enums, padrões e tetos', () => {
    expect(s.LICENSE_STATUS).toEqual(lic.LICENSE_STATUS);
    expect(s.LICENSE_REQ).toEqual(lic.LICENSE_REQ);
    expect(s.DEFAULT_COACH_LEVELS).toEqual(lic.DEFAULT_COACH_LEVELS);
    expect(s.LICENSE_LIMITS).toEqual(lic.LICENSE_LIMITS);
    expect(s.LICENSE_WARN_DAYS).toBe(lic.LICENSE_WARN_DAYS);
  });

  it('a mesma régua e a mesma validação', () => {
    for (const r of REGRAS) {
      expect(s.normalizeCoachRules(r)).toEqual(lic.normalizeCoachRules(r));
      expect(s.validateCoachRules(r || {})).toEqual(lic.validateCoachRules(r || {}));
    }
    const muitos = { levels: Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, label: `N${i}` })) };
    expect(s.validateCoachRules(muitos)).toEqual(lic.validateCoachRules(muitos));
  });

  it('os mesmos requisitos', () => {
    for (const rules of REGRAS) {
      for (const levelId of ['l1', 'l2', 'l3', 'base', 'zz']) {
        for (const safeguarding of [{}, { required: true }, { required: true, until: '2027-01-01' }, { required: true, until: '2026-01-01' }]) {
          const a = { rules, levelId, credentials: CREDS, hourEntries: HORAS, safeguarding, hoje: HOJE };
          expect(s.licenseRequirements(a)).toEqual(lic.licenseRequirements(a));
        }
      }
    }
    expect(s.hoursLast12Months(HORAS, HOJE)).toBe(lic.hoursLast12Months(HORAS, HOJE));
  });

  it('a mesma situação, validade e selo', () => {
    const nivel = lic.coachLevel(undefined, 'l2');
    for (const l of LICENCAS) {
      expect(s.licenseState(l, HOJE)).toEqual(lic.licenseState(l, HOJE));
      expect(s.nextValidUntil(l, nivel, HOJE)).toBe(lic.nextValidUntil(l, nivel, HOJE));
      for (const f of FEDS) expect(s.badgeOf(l && { level: 'l1', level_label: 'Nível 1', ...l }, f, HOJE)).toEqual(lic.badgeOf(l && { level: 'l1', level_label: 'Nível 1', ...l }, f, HOJE));
    }
  });
});

describe('paridade: proteção de menores', () => {
  it('os mesmos enums e tetos', () => {
    expect(s.SG_ROLES).toEqual(sg.SG_ROLES);
    expect(s.SG_DEFAULT_REQUIRED).toEqual(sg.SG_DEFAULT_REQUIRED);
    expect(s.BACKGROUND_STATUS).toEqual(sg.BACKGROUND_STATUS);
    expect(s.SG_LIMITS).toEqual(sg.SG_LIMITS);
    expect(s.SG_FOREVER).toBe(sg.SG_FOREVER);
    expect(s.SG_WARN_DAYS).toBe(sg.SG_WARN_DAYS);
  });

  it('a mesma régua, exigência e certidão', () => {
    for (const r of SGR) {
      expect(s.normalizeSgRules(r)).toEqual(sg.normalizeSgRules(r));
      expect(s.validateSgRules(r || {})).toEqual(sg.validateSgRules(r || {}));
      for (const on of [true, false]) {
        const fed = { modules: { safeguarding: on }, safeguarding_rules: r };
        for (const role of [...sg.SG_ROLES, 'x']) expect(s.sgRequired(fed, role)).toBe(sg.sgRequired(fed, role));
      }
      for (const issued_at of ['', '2026-11-01', '2026-10-22', '2025-10-23', '2024-01-01']) {
        expect(s.validateBackgroundSubmit({ issued_at, hoje: HOJE, rules: r })).toEqual(sg.validateBackgroundSubmit({ issued_at, hoje: HOJE, rules: r }));
      }
    }
  });

  it('o mesmo curso, a mesma certidão e a mesma liberação', () => {
    for (const fedId of ['fgp', 'outra', 'nada']) expect(s.trainingUntil(CREDS, fedId, HOJE)).toBe(sg.trainingUntil(CREDS, fedId, HOJE));
    for (const record of REGISTROS) {
      expect(s.backgroundState(record, HOJE)).toEqual(sg.backgroundState(record, HOJE));
      for (const training of ['', '2026-01-01', '2027-03-01', sg.SG_FOREVER]) {
        expect(s.clearance({ training, record, hoje: HOJE })).toEqual(sg.clearance({ training, record, hoje: HOJE }));
      }
    }
    for (const u of ['', '2026-10-21', '2026-10-22', '2026-11-21', '2026-11-22', sg.SG_FOREVER]) {
      expect(s.clearedOn(u, HOJE)).toBe(sg.clearedOn(u, HOJE));
      expect(s.expiresSoon(u, HOJE)).toBe(sg.expiresSoon(u, HOJE));
    }
  });
});
