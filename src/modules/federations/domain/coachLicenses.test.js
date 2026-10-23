import { describe, it, expect } from 'vitest';
import {
  addDaysISO, badgeOf, licenseRequirements, licenseState, nextValidUntil, normalizeCoachRules,
  pendingLicenseRequests, sortLicenses, validateCoachRules, visibleBadges,
} from './coachLicenses';

const HOJE = '2026-10-22';
const FED = { id: 'fgp', acronym: 'FGP', name: 'Federação Gaúcha', slug: 'fgp', status: 'approved', published: true };

describe('licença de professor: régua', () => {
  it('sem níveis gravados valem os três padrão', () => {
    expect(normalizeCoachRules(undefined).levels.map((l) => l.id)).toEqual(['l1', 'l2', 'l3']);
    expect(normalizeCoachRules({ levels: [] }).levels).toHaveLength(3);
  });

  it('limpa o que veio da tela (código, nome, horas e meses dentro dos tetos; repetido sai)', () => {
    const r = normalizeCoachRules({ levels: [{ id: 'A b!', label: '  Base ', update_hours: 999, valid_months: 0, requires_credential: false }, { id: 'ab', label: 'Dup' }] });
    expect(r.levels).toEqual([{ id: 'ab', label: 'Base', requires_credential: false, update_hours: 200, valid_months: 1 }]);
  });

  it('recusa régua vazia, sem nome ou com código repetido', () => {
    expect(validateCoachRules({ levels: [] }).ok).toBe(false);
    expect(validateCoachRules({ levels: [{ id: 'a', label: '' }] }).ok).toBe(false);
    expect(validateCoachRules({ levels: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }).ok).toBe(false);
    expect(validateCoachRules({ levels: [{ id: 'a', label: 'A' }] }).ok).toBe(true);
  });
});

describe('licença de professor: requisitos', () => {
  const base = { rules: undefined, levelId: 'l1', hoje: HOJE };

  it('credencial do curso do nível (pelo nome sem acento ou pelo código), válida hoje', () => {
    const credentials = [{ kind: 'coach', level: 'nivel 1', status: 'active', valid_until: '2027-01-01', course_name: 'F1' }];
    const r = licenseRequirements({ ...base, credentials, hourEntries: [{ date: '2026-05-01', hours: 8 }] });
    expect(r.ok).toBe(true);
    expect(r.credential.found.course_name).toBe('F1');
  });

  it('credencial vencida, de outro nível ou de árbitro não vale', () => {
    const credentials = [
      { kind: 'coach', level: 'Nível 1', valid_until: '2026-01-01' },
      { kind: 'coach', level: 'Nível 2' },
      { kind: 'referee', level: 'Nível 1' },
    ];
    expect(licenseRequirements({ ...base, credentials }).missing).toContain('credential');
  });

  it('horas só dos últimos 12 meses e só até hoje', () => {
    const hourEntries = [{ date: '2025-10-01', hours: 50 }, { date: '2026-12-01', hours: 50 }, { date: '2026-03-01', hours: 5 }];
    const r = licenseRequirements({ ...base, rules: { levels: [{ id: 'l1', label: 'Nível 1', requires_credential: false, update_hours: 8 }] }, hourEntries });
    expect(r.hours).toEqual({ needed: 8, done: 5, ok: false });
    expect(r.missing).toEqual(['hours']);
    expect(r.waivable).toEqual(['hours']);
  });

  it('a proteção de menores exigida e fora do dia NUNCA é dispensável', () => {
    const rules = { levels: [{ id: 'l1', label: 'Nível 1', requires_credential: false, update_hours: 0 }] };
    const r = licenseRequirements({ ...base, rules, safeguarding: { required: true, until: '2026-01-01' } });
    expect(r.missing).toEqual(['safeguarding']);
    expect(r.waivable).toEqual([]);
    expect(licenseRequirements({ ...base, rules, safeguarding: { required: true, until: '2027-01-01' } }).ok).toBe(true);
    expect(licenseRequirements({ ...base, rules, safeguarding: { required: false } }).ok).toBe(true);
  });

  it('nível que não existe não passa', () => {
    expect(licenseRequirements({ ...base, levelId: 'zz' })).toMatchObject({ level: null, ok: false });
  });
});

describe('licença de professor: situação, validade e selo', () => {
  it('ativa vencida pela data é vencida e pode pedir de novo', () => {
    expect(licenseState({ status: 'active', valid_until: '2026-10-21' }, HOJE)).toMatchObject({ status: 'expired', valid: false, canApply: true });
  });

  it('ativa vencendo em 30 dias pede renovação; com pedido aberto, não pede de novo', () => {
    const v = { status: 'active', valid_until: addDaysISO(HOJE, 20) };
    expect(licenseState(v, HOJE)).toMatchObject({ valid: true, expiring: true, canApply: true, renewing: false });
    expect(licenseState({ ...v, renewal_requested_at_ms: 1 }, HOJE)).toMatchObject({ renewing: true, canApply: false });
  });

  it('pedido em análise, suspensa e cassada não pedem', () => {
    for (const status of ['pending', 'suspended', 'revoked']) expect(licenseState({ status }, HOJE).canApply).toBe(false);
  });

  it('renovar antes de vencer soma a partir do vencimento; vencida, a partir de hoje', () => {
    const nivel = { valid_months: 12 };
    expect(nextValidUntil({ status: 'active', valid_until: '2026-11-10' }, nivel, HOJE)).toBe('2027-11-10');
    expect(nextValidUntil({ status: 'active', valid_until: '2026-10-01' }, nivel, HOJE)).toBe('2027-10-22');
    expect(nextValidUntil(null, nivel, HOJE)).toBe('2027-10-22');
  });

  it('selo só de licença válida, que o professor deixou aparecer, de federação publicada', () => {
    const l = { status: 'active', valid_until: '2027-06-01', level: 'l2', level_label: 'Nível 2' };
    expect(badgeOf(l, FED, HOJE)).toEqual({ federation_id: 'fgp', acronym: 'FGP', name: 'Federação Gaúcha', slug: 'fgp', level_id: 'l2', level_label: 'Nível 2', valid_until: '2027-06-01' });
    expect(badgeOf({ ...l, public_listing: false }, FED, HOJE)).toBeNull();
    expect(badgeOf(l, { ...FED, published: false }, HOJE)).toBeNull();
    expect(badgeOf({ ...l, status: 'suspended' }, FED, HOJE)).toBeNull();
    expect(badgeOf({ ...l, valid_until: '2026-10-01' }, FED, HOJE)).toBeNull();
  });

  it('a tela esconde selo vencido mesmo antes da varredura', () => {
    const doc = { badges: [{ federation_id: 'a', valid_until: '2026-10-21' }, { federation_id: 'b', valid_until: HOJE }, null] };
    expect(visibleBadges(doc, HOJE).map((b) => b.federation_id)).toEqual(['b']);
    expect(visibleBadges(undefined, HOJE)).toEqual([]);
  });
});

describe('licença de professor: pendências e ordem', () => {
  it('conta pedidos e renovações; fonte que falhou é indefinida, nunca zero', () => {
    expect(pendingLicenseRequests([{ status: 'pending' }, { status: 'active', renewal_requested_at_ms: 1 }, { status: 'active' }])).toBe(2);
    expect(pendingLicenseRequests(undefined)).toBeUndefined();
  });

  it('pedidos primeiro, depois vencendo, depois válidas, depois o resto', () => {
    const list = [
      { name: 'D', status: 'revoked' },
      { name: 'C', status: 'active', valid_until: '2027-06-01' },
      { name: 'B', status: 'active', valid_until: addDaysISO(HOJE, 5) },
      { name: 'A', status: 'pending' },
    ];
    expect(sortLicenses(list, HOJE).map((l) => l.name)).toEqual(['A', 'B', 'C', 'D']);
  });
});
