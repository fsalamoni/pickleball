import { describe, it, expect } from 'vitest';
import {
  SG_FOREVER, ageOn, certidaoStoragePath, clubClearance, clubPledgeOk, clubSgRequiredFor, isMinor, minorsWithoutGuardian,
  normalizeClubSgRules, validateClubSgRules, validateGuardian,
} from './safeguarding';

describe('proteção de menores do clube (domínio do cliente)', () => {
  it('as regras em branco valem o padrão e a versão nunca é menor que 1', () => {
    expect(normalizeClubSgRules(undefined)).toMatchObject({ required_for: ['staff', 'designated'], pledge_version: 1 });
    expect(normalizeClubSgRules({ required_for: ['designated'], pledge_version: 0 })).toMatchObject({ required_for: ['designated'], pledge_version: 1 });
    expect(validateClubSgRules({ background_months: 999 }).ok).toBe(false);
  });

  it('só está liberado com o compromisso da versão em vigor E a certidão conferida', () => {
    const rules = { pledge_version: 2 };
    const bg = { status: 'valid', valid_until: '2027-05-01' };
    expect(clubPledgeOk({ pledge_version: 1 }, rules)).toBe(false);
    expect(clubClearance({ record: { pledge_version: 2 }, rules, hoje: '2026-10-25' }).ok).toBe(false);
    expect(clubClearance({ record: { pledge_version: 1, background: bg }, rules, hoje: '2026-10-25' }).ok).toBe(false);
    const c = clubClearance({ record: { pledge_version: 2, background: bg }, rules, hoje: '2026-10-25' });
    expect(c.ok).toBe(true);
    expect(c.until).not.toBe(SG_FOREVER);
  });

  it('quem precisa estar em dia segue as regras do clube', () => {
    expect(clubSgRequiredFor({ staff: true })).toBe(true);
    expect(clubSgRequiredFor({ designated: true, rules: { required_for: ['staff'] } })).toBe(false);
    expect(clubSgRequiredFor({})).toBe(false);
  });

  it('a idade é completa e menor é quem tem menos de 18', () => {
    expect(ageOn('2009-03-11', '2027-03-10')).toBe(17);
    expect(isMinor('2009-03-11', '2027-03-10')).toBe(true);
    expect(isMinor('2009-03-11', '2027-03-11')).toBe(false);
    expect(isMinor('', '2027-03-11')).toBe(false);
  });

  it('o responsável exige nome, parentesco, telefone com DDD e a autorização dita (sim ou não)', () => {
    expect(validateGuardian({}).ok).toBe(false);
    const v = validateGuardian({ name: 'Maria Lima', relation: 'mother', phone: '(48) 99999-0000', consent: false });
    expect(v.ok).toBe(true);
    expect(v.value).toMatchObject({ phone: '48999990000', consent: false, image_consent: false });
    expect(validateGuardian({ name: 'Maria Lima', relation: 'mother', phone: '999' }).errors.phone).toBeTruthy();
  });

  it('o arquivo da certidão fica na pasta de quem envia e fonte que falhou não vira zero', () => {
    expect(certidaoStoragePath('u1', 'abc', 'application/pdf')).toBe('clube-protecao/u1/abc.pdf');
    expect(minorsWithoutGuardian([{ guardian: null }, { guardian: { name: 'x' } }])).toBe(1);
    expect(minorsWithoutGuardian(undefined)).toBeUndefined();
  });
});
