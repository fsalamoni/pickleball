/**
 * PARIDADE cliente × servidor da cobrança dividida e da troca de plano
 * (Bloco 6d): `federationSplitPolicy.js` é cópia de `domain/split.js`.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/split.js';

const require = createRequire(import.meta.url);
const s = require('./federationSplitPolicy.js');

const ANUAL = { id: 'a', federation_id: 'fgp', billing: 'annual', person_type: 'athlete', tier: 'federated', price_cents: 10000 };

describe('paridade: cobrança dividida', () => {
  it('as mesmas constantes', () => {
    ['REPASSE_TO', 'REPASSE_STATUS', 'SPLIT_ORIGINS'].forEach((k) => expect(s[k], k).toEqual(c[k]));
    ['SPLIT_PCT_MAX', 'SPLIT_TOTAL_MAX'].forEach((k) => expect(s[k], k).toBe(c[k]));
    expect(Object.keys(s.REPASSE_STATUS_LABELS)).toEqual(Object.keys(c.REPASSE_STATUS_LABELS));
  });

  it('as mesmas contas', () => {
    [undefined, {}, { club_pct: '7', confederation_pct: 60 }, { club_pct: 50, confederation_pct: 45 }].forEach((x) => {
      expect(s.normalizeSplit(x)).toEqual(c.normalizeSplit(x));
      expect(s.validateSplit(x)).toEqual(c.validateSplit(x));
    });
    const dest = { club: { id: 'c', name: 'C' }, confederation: { id: 'cbp', name: 'CBP' } };
    [0, 1, 9999, 12345].forEach((v) => expect(s.splitShares(v, { club_pct: 10, confederation_pct: 15 }, dest)).toEqual(c.splitShares(v, { club_pct: 10, confederation_pct: 15 }, dest)));
    ['pending', 'paid', 'x'].forEach((st) => ['pay', 'reopen', 'x'].forEach((a) => expect(s.repasseTransition({ status: st }, a)).toEqual(c.repasseTransition({ status: st }, a))));
    const lista = [{ id: 'x_confederation', to: 'confederation', status: 'paid', paid_at: '2026-10-01', amount_cents: 200, federation_acronym: 'FGP', plan_name: 'P', to_name: 'CBP' }];
    expect(s.repasseExpenses(lista)).toEqual(c.repasseExpenses(lista));
    expect(s.repasseIncome(lista)).toEqual(c.repasseIncome(lista));
  });

  it('a mesma troca de plano', () => {
    const alvos = [ANUAL, { ...ANUAL, id: 'b', price_cents: 15000 }, { ...ANUAL, id: 'm', billing: 'monthly', price_cents: 20000 }, { ...ANUAL, id: 'k', person_type: 'coach', price_cents: 20000 }, { ...ANUAL, id: 'r', tier: 'registered', price_cents: 20000 }];
    [{ status: 'active', federation_id: 'fgp' }, { status: 'expired' }, null].forEach((mb) => alvos.forEach((p) => expect(s.upgradeBlocker(mb, ANUAL, p)).toBe(c.upgradeBlocker(mb, ANUAL, p))));
    expect(s.upgradeTargets(alvos, { status: 'active', federation_id: 'fgp' }, ANUAL)).toEqual(c.upgradeTargets(alvos, { status: 'active', federation_id: 'fgp' }, ANUAL));
    [[100, 200], [200, 200], [300, 100]].forEach(([a, b]) => expect(s.upgradeDifference(a, b)).toEqual(c.upgradeDifference(a, b)));
  });
});
