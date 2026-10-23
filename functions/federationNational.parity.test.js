/**
 * PARIDADE cliente × servidor da camada nacional (Bloco 6): a tela mostra e
 * valida o mesmo que o servidor grava (`federationNationalPolicy.js` é cópia
 * de `domain/national.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/national.js';

const require = createRequire(import.meta.url);
const s = require('./federationNationalPolicy.js');

const CONF = { id: 'cbp', status: 'approved', confederation: true, national_config: { homologation_days: 7 } };
const A = { id: 'fgp', status: 'approved', national_body: { id: 'cbp' } };
const B = { id: 'fpp', status: 'approved', national_body: { id: 'cbp' } };

describe('paridade: camada nacional', () => {
  it('os mesmos estados e padrões', () => {
    ['LINK_STATUS', 'LINK_OPEN', 'NATIONAL_CONFIG_DEFAULT', 'DUES_STATUS'].forEach((k) => expect(s[k], k).toEqual(c[k]));
    ['DUES_AMOUNT_MAX', 'HOMOLOGATION_DAYS_MAX'].forEach((k) => expect(s[k], k).toBe(c[k]));
    expect(Object.keys(s.LINK_STATUS_LABELS)).toEqual(Object.keys(c.LINK_STATUS_LABELS));
  });

  it('as mesmas transições do vínculo e da anuidade', () => {
    [null, 'pending', 'invited', 'approved', 'rejected', 'left'].forEach((st) => ['request', 'invite', 'accept', 'reject', 'cancel', 'leave', 'remove', 'x'].forEach((a) => ['state', 'national'].forEach((side) => {
      expect(s.linkTransition(st && { status: st }, a, side), `${st}/${a}/${side}`).toEqual(c.linkTransition(st && { status: st }, a, side));
    })));
    ['open', 'declared', 'paid', 'waived'].forEach((st) => ['declare', 'confirm', 'reopen', 'waive', 'x'].forEach((a) => expect(s.duesTransition({ status: st }, a)).toEqual(c.duesTransition({ status: st }, a))));
  });

  it('as mesmas regras, homologação, valores e itens da conta', () => {
    [undefined, {}, { homologation_days: 99, dues_due_md: '02-29' }, { homologate_transfers: false, dues_fixed_cents: 10, dues_per_member_cents: 2, dues_due_md: '12-31' }].forEach((r) => {
      expect(s.normalizeNationalConfig(r)).toEqual(c.normalizeNationalConfig(r));
      expect(s.validateNationalConfig(r || {})).toEqual(c.validateNationalConfig(r || {}));
    });
    expect(s.needsHomologation(A, B, CONF)).toBe(c.needsHomologation(A, B, CONF));
    expect(s.homologationDeadline('2026-10-23', CONF)).toBe(c.homologationDeadline('2026-10-23', CONF));
    expect(s.canOpenLink(A, CONF)).toEqual(c.canOpenLink(A, CONF));
    expect(s.duesAmount(CONF.national_config, 12)).toEqual(c.duesAmount(CONF.national_config, 12));
    const dues = [{ id: 'd', status: 'paid', paid_at: '2026-04-01', amount_cents: 10, year: 2026, federation_acronym: 'FGP', conf_acronym: 'CBP' }, { id: 'e', status: 'open', due: '2026-03-31' }];
    expect(s.duesIncome(dues)).toEqual(c.duesIncome(dues));
    expect(s.duesExpenses(dues)).toEqual(c.duesExpenses(dues));
    expect(s.duesToWarn(dues[1], '2026-04-02')).toBe(c.duesToWarn(dues[1], '2026-04-02'));
  });
});
