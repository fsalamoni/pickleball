import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  addMonthsISO, canRequestMembership, homeFederationRows, cardCodeFromBytes, computeValidUntil, daysBetween, formatMemberNumber, memberCounts, membershipState,
  normalizeCardCode, publicVerification, renewalStart, toISODate, CARD_CODE_ALPHABET,
} from './membership.js';

describe('datas', () => {
  it('soma meses segurando o fim do mês', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2026-03-15', 12)).toBe('2027-03-15');
    expect(daysBetween('2026-10-18', '2026-11-17')).toBe(30);
  });
  it('lê Timestamp de verdade do banco', () => {
    expect(toISODate(Timestamp.fromDate(new Date(2027, 2, 12, 12)))).toBe('2027-03-12');
    expect(toISODate('2027-03-12')).toBe('2027-03-12');
    expect(toISODate(null)).toBe('');
  });
});

describe('computeValidUntil', () => {
  it('mensal + 1 mês; anual rolante + 12 meses', () => {
    expect(computeValidUntil({ billing: 'monthly' }, '2026-10-18')).toBe('2026-11-18');
    expect(computeValidUntil({ billing: 'annual', validity: 'rolling' }, '2026-10-18')).toBe('2027-10-18');
  });
  it('por data fixa: a próxima virada, pulando quando falta menos que a carência', () => {
    const plano = { billing: 'annual', validity: 'calendar', rollover_mmdd: '12-31', calendar_grace_days: 60 };
    expect(computeValidUntil(plano, '2026-03-01')).toBe('2026-12-31');
    expect(computeValidUntil(plano, '2026-11-20')).toBe('2027-12-31');
    expect(computeValidUntil(plano, '2026-12-31')).toBe('2027-12-31');
  });
  it('renovação parte do fim da validade atual quando ainda vale', () => {
    expect(renewalStart({ valid_until: '2026-11-10' }, '2026-10-18')).toBe('2026-11-10');
    expect(renewalStart({ valid_until: '2026-09-10' }, '2026-10-18')).toBe('2026-10-18');
  });
});

describe('membershipState', () => {
  it('ativa com data vencida vira vencida na tela', () => {
    const s = membershipState({ status: 'active', valid_until: '2026-10-01' }, '2026-10-18');
    expect(s.status).toBe('expired');
    expect(s.canRenew).toBe(true);
    expect(s.countsForRanking).toBe(false);
  });
  it('vencendo em 30 dias oferece renovar e segue contando', () => {
    const s = membershipState({ status: 'active', valid_until: '2026-11-10' }, '2026-10-18');
    expect(s.expiring).toBe(true);
    expect(s.canRenew).toBe(true);
    expect(s.countsForRanking).toBe(true);
    expect(membershipState({ status: 'active', valid_until: '2027-10-10' }, '2026-10-18').expiring).toBe(false);
  });
  it('suspensa não renova nem conta; pendente não tem validade', () => {
    expect(membershipState({ status: 'suspended', valid_until: '2027-01-01' }, '2026-10-18')).toMatchObject({ canRenew: false, countsForRanking: false });
    expect(membershipState({ status: 'pending' }, '2026-10-18').daysLeft).toBeNull();
    expect(membershipState(null).status).toBe('');
  });
  it('só sem filiação viva pode pedir de novo', () => {
    expect(canRequestMembership(null)).toBe(true);
    expect(canRequestMembership({ status: 'rejected' })).toBe(true);
    expect(canRequestMembership({ status: 'cancelled' })).toBe(true);
    expect(canRequestMembership({ status: 'expired' })).toBe(false);
    expect(canRequestMembership({ status: 'pending' })).toBe(false);
  });
});

describe('número e código', () => {
  it('formata o número de filiado', () => {
    expect(formatMemberNumber('fgp', 2026, 123)).toBe('FGP-2026-000123');
    expect(formatMemberNumber('', 2026, 0)).toBe('FED-2026-000001');
  });
  it('código sem 0/O/1/I, 10 caracteres, canônico', () => {
    expect(CARD_CODE_ALPHABET).not.toMatch(/[01OI]/);
    const code = cardCodeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(code).toBe('ABCDEFGHJK');
    expect(normalizeCardCode(' abcde-fghjk ')).toBe('ABCDEFGHJK');
    expect(normalizeCardCode('ABCDEFGHJ0')).toBe('');
    expect(normalizeCardCode('ABC')).toBe('');
  });
});

describe('publicVerification', () => {
  it('devolve só o mínimo', () => {
    const v = publicVerification(
      { user_name: 'Ana', photo_url: 'p.jpg', tier: 'federated', member_number: 'FGP-2026-000001', status: 'active', valid_until: '2027-01-01', email: 'x@y.z', birth_date: '1990-01-01' },
      { name: 'FGP', acronym: 'FGP', slug: 'fgp' },
      '2026-10-18',
    );
    expect(v).toMatchObject({ found: true, name: 'Ana', status: 'active', valid_until: '2027-01-01' });
    expect(JSON.stringify(v)).not.toMatch(/x@y.z|1990/);
    expect(publicVerification(null, null).found).toBe(false);
  });
  it('contagens para a Central', () => {
    const c = memberCounts([
      { status: 'pending' }, { status: 'active', valid_until: '2026-11-01' }, { status: 'active', valid_until: '2026-01-01' },
    ], '2026-10-18');
    expect(c).toMatchObject({ total: 3, pending: 1, active: 1, expiring: 1, expired: 1 });
  });
});

describe('homeFederationRows', () => {
  it('a filiação que pede ação vem primeiro; cancelada e recusada saem', () => {
    const rows = homeFederationRows([
      { id: 'a', status: 'active', valid_until: '2027-06-01' },
      { id: 'b', status: 'awaiting_payment' },
      { id: 'c', status: 'active', valid_until: '2026-10-25' },
      { id: 'd', status: 'cancelled' },
      { id: 'e', status: 'rejected' },
    ], '2026-10-21');
    expect(rows.map((r) => [r.member.id, r.acao])).toEqual([['b', 'pagar'], ['c', 'renovar'], ['a', '']]);
  });
});
