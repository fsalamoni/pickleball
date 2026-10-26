/**
 * PARIDADE cliente × servidor da proteção de menores do clube: o que a tela diz antes (quem
 * precisa, o compromisso, a certidão, o responsável do menor) é o que o servidor
 * (`clubSafeguarding.js`) confere depois.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/clubs/domain/safeguarding.js';

const require = createRequire(import.meta.url);
const s = require('./clubSafeguardingPolicy.js');

const HOJE = '2027-03-10';
const REGRAS = [undefined, null, {}, { required_for: [] }, { required_for: ['staff'], background_months: 6 }, { required_for: ['designated', 'lixo'], background_months: 999, pledge_version: 3 }, { background_months: '24', pledge_text: '  Meu   compromisso  ' }];
const REGISTROS = [
  null,
  { pledge_version: 1 },
  { pledge_version: 2, background: { status: 'valid', valid_until: '2028-01-01' } },
  { pledge_version: 1, background: { status: 'valid', valid_until: '2027-03-01' } },
  { pledge_version: 1, background: { status: 'revoked', valid_until: '2028-01-01' } },
  { background: { status: 'valid', valid_until: '2028-01-01' } },
];

describe('paridade da proteção de menores do clube', () => {
  it('os mesmos papéis e limites', () => {
    expect(s.ROLES).toEqual(c.CLUB_SG_ROLES);
    expect(s.DEFAULT_REQUIRED).toEqual(c.CLUB_SG_DEFAULT_REQUIRED);
    expect(s.PLEDGE_MAX).toBe(c.CLUB_SG_PLEDGE_MAX);
    expect(s.LABEL_MAX).toBe(c.CLUB_SG_LABEL_MAX);
    expect(s.MAJORITY).toBe(c.MAJORITY);
    expect(s.GUARDIAN_RELATIONS).toEqual(c.GUARDIAN_RELATIONS);
    expect(s.GUARDIAN_LIMITS).toEqual(c.GUARDIAN_LIMITS);
  });

  it('as regras (normalizar e validar)', () => {
    REGRAS.forEach((r) => {
      expect(s.normalizeRules(r)).toEqual(c.normalizeClubSgRules(r));
      const a = s.validateRules(r || {});
      const b = c.validateClubSgRules(r || {});
      expect(a.ok).toBe(b.ok);
      expect(a.value).toEqual(b.value);
      expect(a.errors).toEqual(b.errors);
    });
    const ruim = { background_months: 0 };
    expect(s.validateRules(ruim).errors.background_months).toBe(c.validateClubSgRules(ruim).errors.background_months);
  });

  it('o compromisso, a liberação de hoje e quem precisa estar em dia', () => {
    REGRAS.forEach((r) => REGISTROS.forEach((rec) => {
      expect(s.pledgeOk(rec, r)).toBe(c.clubPledgeOk(rec, r));
      expect(s.clearance({ record: rec, rules: r, hoje: HOJE })).toEqual(c.clubClearance({ record: rec, rules: r, hoje: HOJE }));
      [[true, true], [true, false], [false, true], [false, false]].forEach(([staff, designated]) => {
        expect(s.requiredFor({ staff, designated, rules: r })).toBe(c.clubSgRequiredFor({ staff, designated, rules: r }));
      });
    }));
  });

  it('idade e menoridade', () => {
    [['2013-06-01', HOJE], ['2009-03-11', HOJE], ['2009-03-10', HOJE], ['2009-03-09', HOJE], ['1990-04-04', HOJE], ['', HOJE], [null, HOJE], ['2030-01-01', HOJE]].forEach(([nasc, hoje]) => {
      expect(s.ageOn(nasc, hoje)).toBe(c.ageOn(nasc, hoje));
      expect(s.isMinor(nasc, hoje)).toBe(c.isMinor(nasc, hoje));
    });
    expect(c.isMinor('2009-03-11', HOJE)).toBe(true);
    expect(c.isMinor('2009-03-10', HOJE)).toBe(false);
  });

  it('o responsável do menor', () => {
    const base = { name: 'Carla Souza', relation: 'mother', phone: '(51) 99999-0000', consent: true, image_consent: true, note: '  Alergia   ' };
    [base, { ...base, name: 'Al' }, { ...base, relation: 'tio' }, { ...base, phone: '123' }, { ...base, consent: 'sim' }, {}, { ...base, image_consent: undefined }].forEach((g) => {
      const a = s.validateGuardian(g);
      const b = c.validateGuardian(g);
      expect(a.ok).toBe(b.ok);
      expect(a.value).toEqual(b.value);
      expect(a.errors).toEqual(b.errors);
    });
  });
});
