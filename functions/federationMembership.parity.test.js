/**
 * PARIDADE cliente × servidor da filiação: a validade que a tela mostra antes
 * de pagar é a que o servidor grava depois; o número e o código saem iguais.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/membership.js';
import * as cc from '@/modules/federations/domain/charges.js';
import { planPrice } from '@/modules/federations/domain/plans.js';
import { isValidCpf } from '@/modules/federations/domain/privateData.js';
import { endOfDayBrMs } from '@/modules/federations/domain/discipline.js';
import { credentialState, publicCredentialVerification } from '@/modules/federations/domain/courses.js';
import { RENEWAL_WINDOW_DAYS, EXPIRY_NOTICE_DAYS, CHARGE_DUE_DAYS } from '@/modules/federations/domain/constants.js';

const require = createRequire(import.meta.url);
const s = require('./federationMembership.js');

const PLANOS = [
  { billing: 'monthly' },
  { billing: 'annual', validity: 'rolling' },
  { billing: 'annual', validity: 'calendar', rollover_mmdd: '12-31' },
  { billing: 'annual', validity: 'calendar', rollover_mmdd: '06-30', calendar_grace_days: 0 },
  { billing: 'annual', validity: 'calendar', rollover_mmdd: '02-29' },
];
const DATAS = ['2026-01-31', '2026-03-01', '2026-11-20', '2026-12-31', '2027-02-28', '2028-02-29'];

describe('paridade: filiação', () => {
  it('as mesmas constantes', () => {
    expect(s.RENEWAL_WINDOW_DAYS).toBe(RENEWAL_WINDOW_DAYS);
    expect([...s.EXPIRY_NOTICE_DAYS]).toEqual([...EXPIRY_NOTICE_DAYS]);
    expect(s.CHARGE_DUE_DAYS).toBe(CHARGE_DUE_DAYS);
    expect(s.CARD_CODE_ALPHABET).toBe(c.CARD_CODE_ALPHABET);
  });
  it('a validade sai igual nos dois lados', () => {
    PLANOS.forEach((p) => DATAS.forEach((d) => expect(s.computeValidUntil(p, d), `${JSON.stringify(p)} ${d}`).toBe(c.computeValidUntil(p, d))));
  });
  it('renovação, número, código e vencimento', () => {
    expect(s.renewalStart({ valid_until: '2026-11-10' }, '2026-10-18')).toBe(c.renewalStart({ valid_until: '2026-11-10' }, '2026-10-18'));
    expect(s.formatMemberNumber('fgp', 2026, 7)).toBe(c.formatMemberNumber('fgp', 2026, 7));
    const bytes = Array.from({ length: 10 }, (_, i) => i * 37);
    expect(s.cardCodeFromBytes(bytes)).toBe(c.cardCodeFromBytes(bytes));
    expect(s.normalizeCardCode('abcde fghjk')).toBe(c.normalizeCardCode('abcde fghjk'));
    expect(s.chargeDueDate('2026-10-18')).toBe(cc.chargeDueDate('2026-10-18'));
  });
  it('o estado de hoje e a verificação pública', () => {
    const m = { status: 'active', valid_until: '2026-11-01', user_name: 'Ana', tier: 'federated', member_number: 'FGP-2026-000001' };
    const f = { name: 'FGP', acronym: 'FGP', slug: 'fgp' };
    ['2026-10-18', '2026-11-02'].forEach((hoje) => {
      const a = s.membershipState(m, hoje);
      const b = c.membershipState(m, hoje);
      expect([a.status, a.expiring, a.canRenew]).toEqual([b.status, b.expiring, b.canRenew]);
      expect(s.publicVerification(m, f, hoje)).toEqual(c.publicVerification(m, f, hoje));
    });
  });
  it('suspensão disciplinar e foto do menor saem iguais (PR 3)', () => {
    const f = { name: 'FGP', acronym: 'FGP', slug: 'fgp' };
    const agora = Date.parse('2026-10-18T12:00:00Z');
    const casos = [
      { status: 'active', valid_until: '2027-01-01', discipline_until_ms: agora + 1000, user_name: 'Ana', photo_url: 'p' },
      { status: 'active', valid_until: '2027-01-01', discipline_until_ms: agora - 1000, user_name: 'Ana', photo_url: 'p' },
      { status: 'active', valid_until: '2027-01-01', is_minor: true, user_name: 'Bia', photo_url: 'p' },
      { status: 'active', valid_until: '2027-01-01', is_minor: true, minor_photo_consent: true, user_name: 'Bia', photo_url: 'p' },
    ];
    casos.forEach((m) => {
      const a = s.membershipState(m, '2026-10-18', agora);
      const b = c.membershipState(m, '2026-10-18', { nowMs: agora });
      expect([a.status, a.disciplined]).toEqual([b.status, b.disciplined]);
      expect(s.publicVerification(m, f, '2026-10-18', agora)).toEqual(c.publicVerification(m, f, '2026-10-18', { nowMs: agora }));
    });
    expect(c.publicVerification(casos[2], f, '2026-10-18', { nowMs: agora }).photo_url).toBe('');
    expect(c.publicVerification(casos[3], f, '2026-10-18', { nowMs: agora }).photo_url).toBe('p');
    expect(c.membershipState(casos[0], '2026-10-18', { nowMs: agora }).status).toBe('suspended');
  });
  it('PR 3: preço com desconto, CPF, fim do dia e credencial saem iguais', () => {
    const plano = { price_cents: 10000, discounts: { minor_pct: 50, senior_pct: 30, family_pct: 20, family_from: 2 } };
    [[15, 1], [15, 2], [65, 1], [30, 1], [30, 3], [null, 2]].forEach(([age, familyIndex]) => {
      const a = planPrice(plano, { age, familyIndex });
      const b = s.planPrice(plano, { age, familyIndex });
      expect([b.base, b.total], `${age} ${familyIndex}`).toEqual([a.base, a.total]);
    });
    ['52998224725', '529.982.247-25', '11111111111', '12345678900', ''].forEach((cpf) => expect(s.isValidCpf(cpf), cpf).toBe(isValidCpf(cpf)));
    ['2026-10-18', '2026-02-29', ''].forEach((d) => expect(s.endOfDayBrMs(d)).toBe(endOfDayBrMs(d)));
    const cred = { user_name: 'Ana', photo_url: 'x', public_photo: false, kind: 'referee', level: 'N1', course_name: 'Curso', issued_at: '2026-01-01', valid_until: '2026-06-30', status: 'active' };
    const fed = { name: 'F', acronym: 'FF', slug: 'ff' };
    ['2026-03-01', '2026-07-01'].forEach((hoje) => {
      expect(s.credentialState(cred, hoje)).toEqual(credentialState(cred, hoje));
      expect(s.publicCredentialVerification(cred, fed, hoje)).toEqual(publicCredentialVerification(cred, fed, hoje));
    });
  });
});
