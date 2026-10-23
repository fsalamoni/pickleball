import { describe, it, expect } from 'vitest';
import {
  LINK_STATUS, canOpenLink, duesAmount, duesDueDate, duesExpenses, duesIncome, duesState, duesToWarn, duesTransition, duesYearOk,
  homologationDeadline, linkTransition, nationalBodyOf, needsHomologation, normalizeNationalConfig, validateNationalConfig,
} from './national';

const CONF = { id: 'cbp', status: 'approved', confederation: true, acronym: 'CBP' };
const FGP = { id: 'fgp', status: 'approved', acronym: 'FGP', national_body: { id: 'cbp', acronym: 'CBP' } };
const FPP = { id: 'fpp', status: 'approved', acronym: 'FPP', national_body: { id: 'cbp', acronym: 'CBP' } };

describe('vínculo da estadual com a confederação', () => {
  it('quem pede é a estadual, quem convida é a confederação, quem recebe aceita', () => {
    expect(linkTransition(null, 'request', 'state')).toEqual({ status: 'pending' });
    expect(linkTransition(null, 'request', 'national').error).toBeTruthy();
    expect(linkTransition(null, 'invite', 'national')).toEqual({ status: 'invited' });
    expect(linkTransition({ status: 'pending' }, 'accept', 'national')).toEqual({ status: 'approved' });
    expect(linkTransition({ status: 'pending' }, 'accept', 'state').error).toBeTruthy();
    expect(linkTransition({ status: 'invited' }, 'accept', 'state')).toEqual({ status: 'approved' });
    expect(linkTransition({ status: 'invited' }, 'cancel', 'national')).toEqual({ status: 'cancelled' });
    expect(linkTransition({ status: 'pending' }, 'cancel', 'national').error).toBeTruthy();
    expect(linkTransition({ status: 'pending' }, 'reject', 'national')).toEqual({ status: 'rejected' });
  });

  it('não abre de novo o que está em aberto ou aprovado; sair e desligar só do aprovado', () => {
    expect(linkTransition({ status: 'pending' }, 'request', 'state').error).toBeTruthy();
    expect(linkTransition({ status: 'approved' }, 'invite', 'national').error).toBeTruthy();
    expect(linkTransition({ status: 'left' }, 'request', 'state')).toEqual({ status: 'pending' });
    expect(linkTransition({ status: 'approved' }, 'leave', 'state')).toEqual({ status: LINK_STATUS.LEFT });
    expect(linkTransition({ status: 'approved' }, 'remove', 'national')).toEqual({ status: LINK_STATUS.REMOVED });
    expect(linkTransition({ status: 'pending' }, 'leave', 'state').error).toBeTruthy();
  });

  it('uma confederação por estadual; confederação não se filia; as duas aprovadas', () => {
    expect(canOpenLink({ id: 'fgp', status: 'approved' }, CONF).ok).toBe(true);
    expect(canOpenLink({ ...FGP, national_body: { id: 'outra' } }, CONF).error).toMatch(/outra confederação/);
    expect(canOpenLink({ id: 'x', status: 'approved', confederation: true }, CONF).error).toBeTruthy();
    expect(canOpenLink({ id: 'fgp', status: 'approved' }, { ...CONF, confederation: false }).error).toBeTruthy();
    expect(canOpenLink({ id: 'fgp', status: 'pending' }, CONF).error).toBeTruthy();
    expect(nationalBodyOf({ national_body: null })).toBeNull();
  });
});

describe('regras da rede', () => {
  it('padrões no que falta; validação recusa o inválido', () => {
    expect(normalizeNationalConfig(undefined)).toEqual({ homologate_transfers: true, homologation_days: 15, dues_fixed_cents: 0, dues_per_member_cents: 0, dues_due_md: '03-31' });
    expect(normalizeNationalConfig({ homologate_transfers: false, homologation_days: 999, dues_due_md: '02-30' })).toMatchObject({ homologate_transfers: false, homologation_days: 15, dues_due_md: '03-31' });
    const r = validateNationalConfig({ homologation_days: 0, dues_fixed_cents: -1, dues_per_member_cents: 'x', dues_due_md: '13-01' });
    expect(Object.keys(r.errors).sort()).toEqual(['dues_due_md', 'dues_fixed_cents', 'dues_per_member_cents', 'homologation_days']);
    expect(validateNationalConfig({ homologation_days: 10, dues_fixed_cents: 100000, dues_per_member_cents: 500, dues_due_md: '04-30' }).value).toMatchObject({ homologate_transfers: true, homologation_days: 10 });
  });
});

describe('homologação', () => {
  it('só entre duas estaduais da mesma confederação, e só se a regra dela pede', () => {
    expect(needsHomologation(FGP, FPP, CONF)).toBe(true);
    expect(needsHomologation(FGP, { ...FPP, national_body: null }, CONF)).toBe(false);
    expect(needsHomologation(FGP, FPP, { ...CONF, national_config: { homologate_transfers: false } })).toBe(false);
    expect(needsHomologation(FGP, FPP, { ...CONF, confederation: false })).toBe(false);
    expect(homologationDeadline('2026-12-25', { national_config: { homologation_days: 10 } })).toBe('2027-01-04');
  });
});

describe('anuidade', () => {
  it('fixo + por filiado; vencimento do ano; ano lançável', () => {
    expect(duesAmount({ dues_fixed_cents: 100000, dues_per_member_cents: 500 }, 40)).toEqual({ fixed_cents: 100000, per_member_cents: 500, member_count: 40, amount_cents: 120000 });
    expect(duesDueDate({ dues_due_md: '04-30' }, 2027)).toBe('2027-04-30');
    expect(duesYearOk(2025, '2026-10-23')).toBe(true);
    expect(duesYearOk(2024, '2026-10-23')).toBe(false);
  });

  it('declarar, confirmar, reabrir e dispensar seguem a situação', () => {
    expect(duesTransition({ status: 'open' }, 'declare')).toEqual({ status: 'declared' });
    expect(duesTransition({ status: 'paid' }, 'declare').error).toBeTruthy();
    expect(duesTransition({ status: 'declared' }, 'confirm')).toEqual({ status: 'paid' });
    expect(duesTransition({ status: 'paid' }, 'reopen')).toEqual({ status: 'open' });
    expect(duesTransition({ status: 'paid' }, 'waive').error).toBeTruthy();
  });

  it('vencida só em aberto depois do vencimento; avisa uma vez', () => {
    const d = { status: 'open', due: '2026-03-31' };
    expect(duesState(d, '2026-04-01')).toBe('overdue');
    expect(duesState({ ...d, status: 'declared' }, '2026-04-01')).toBe('declared');
    expect(duesToWarn(d, '2026-04-01')).toBe(true);
    expect(duesToWarn({ ...d, warned_for: '2026-03-31' }, '2026-04-01')).toBe(false);
  });

  it('paga vira receita da confederação e despesa da estadual; o resto não entra', () => {
    const dues = [
      { id: 'cbp_fgp_2026', status: 'paid', paid_at: '2026-04-02', amount_cents: 120000, year: 2026, federation_name: 'Federação Gaúcha', federation_acronym: 'FGP', conf_name: 'Confederação', conf_acronym: 'CBP' },
      { id: 'cbp_fpp_2026', status: 'declared', amount_cents: 50000, year: 2026 },
    ];
    expect(duesIncome(dues)).toEqual([{ date: '2026-04-02', amount_cents: 120000, category: 'memberships', ref: 'dues:cbp_fgp_2026', description: 'Anuidade 2026 · FGP', counterparty: 'Federação Gaúcha', auto: 'dues' }]);
    expect(duesExpenses(dues)[0]).toMatchObject({ category: 'taxes', counterparty: 'Confederação', description: 'Anuidade 2026 · CBP', auto: 'dues' });
  });
});
