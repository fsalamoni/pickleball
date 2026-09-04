import { describe, it, expect } from 'vitest';
import {
  generateReferralCode,
  isValidReferralCode,
  normalizeReferralCode,
  buildReferralUrl,
  buildReferralShareText,
  computeReferralStatus,
  validateReferralInput,
  totalReferrerXp,
  monthlyValidReferrals,
  REFERRAL_REWARDS,
  REFERRAL_STATUS,
  REFERRAL_MONTHLY_CAP,
} from './referrals.js';

describe('referrals · generateReferralCode', () => {
  it('gera código de 8 chars', () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
  });

  it('gera códigos diferentes a cada chamada', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i += 1) codes.add(generateReferralCode());
    expect(codes.size).toBeGreaterThan(95);
  });

  it('aceita PRNG custom (determinístico)', () => {
    const code1 = generateReferralCode(() => 0.1);
    const code2 = generateReferralCode(() => 0.1);
    expect(code1).toBe(code2);
    expect(code1).toHaveLength(8);
  });
});

describe('referrals · isValidReferralCode', () => {
  it('código válido', () => {
    expect(isValidReferralCode('ABC23456')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(isValidReferralCode('abc23456')).toBe(true);
  });

  it('rejeita length errado', () => {
    expect(isValidReferralCode('ABC')).toBe(false);
    expect(isValidReferralCode('ABCDEFGHI')).toBe(false);
  });

  it('rejeita chars ambíguos (0/O/1/I/L)', () => {
    // O, 0, 1, I, L não estão no ALPHABET
    expect(isValidReferralCode('OBC23456')).toBe(false);
    expect(isValidReferralCode('0BC23456')).toBe(false);
    expect(isValidReferralCode('1BC23456')).toBe(false);
  });

  it('rejeita chars especiais', () => {
    expect(isValidReferralCode('AB-23456')).toBe(false);
    expect(isValidReferralCode('AB 23456')).toBe(false);
  });
});

describe('referrals · normalizeReferralCode', () => {
  it('uppercase + trim', () => {
    expect(normalizeReferralCode('  abc23456  ')).toBe('ABC23456');
  });

  it('string vazia → vazia', () => {
    expect(normalizeReferralCode('')).toBe('');
    expect(normalizeReferralCode(null)).toBe('');
  });
});

describe('referrals · buildReferralUrl', () => {
  it('monta URL absoluta', () => {
    expect(buildReferralUrl('https://picklerush.web.app', 'ABC23456'))
      .toBe('https://picklerush.web.app/r/ABC23456');
  });

  it('remove trailing slash', () => {
    expect(buildReferralUrl('https://picklerush.web.app/', 'ABC23456'))
      .toBe('https://picklerush.web.app/r/ABC23456');
  });

  it('sem origin → path relativo', () => {
    expect(buildReferralUrl('', 'ABC23456')).toBe('/r/ABC23456');
  });

  it('código inválido → vazio', () => {
    expect(buildReferralUrl('https://x.com', 'XX')).toBe('');
  });
});

describe('referrals · buildReferralShareText', () => {
  it('monta texto com código', () => {
    const t = buildReferralShareText('ABC23456', 'https://x.com/r/ABC23456', { userName: 'Beltrano' });
    expect(t).toContain('Beltrano te convidou');
    expect(t).toContain('ABC23456');
    expect(t).toContain('https://x.com/r/ABC23456');
  });

  it('aceita customMessage', () => {
    const t = buildReferralShareText('ABC23456', '', { customMessage: 'Teste custom' });
    expect(t).toContain('Teste custom');
  });
});

describe('referrals · computeReferralStatus', () => {
  it('0 jogos = pending', () => {
    expect(computeReferralStatus({})).toBe(REFERRAL_STATUS.PENDING);
  });
  it('1-4 jogos = signed_up', () => {
    expect(computeReferralStatus({ games_played: 1 })).toBe(REFERRAL_STATUS.SIGNED_UP);
    expect(computeReferralStatus({ games_played: 4 })).toBe(REFERRAL_STATUS.SIGNED_UP);
  });
  it('5+ jogos = activated', () => {
    expect(computeReferralStatus({ games_played: 5 })).toBe(REFERRAL_STATUS.ACTIVATED);
    expect(computeReferralStatus({ games_played: 50 })).toBe(REFERRAL_STATUS.ACTIVATED);
  });
  it('1+ torneio organizado = organizer', () => {
    expect(computeReferralStatus({ games_played: 10, tournaments_organized: 1 })).toBe(REFERRAL_STATUS.ORGANIZER);
  });
});

describe('referrals · validateReferralInput', () => {
  it('valido', () => {
    const r = validateReferralInput({ code: 'ABC23456', referrerUid: 'u1', refereeUid: 'u2' });
    expect(r.valid).toBe(true);
    expect(r.value.code).toBe('ABC23456');
  });
  it('sem código', () => {
    expect(validateReferralInput({}).valid).toBe(false);
  });
  it('código inválido', () => {
    expect(validateReferralInput({ code: 'XX' }).valid).toBe(false);
  });
  it('self-referral', () => {
    expect(validateReferralInput({ code: 'ABC23456', referrerUid: 'u1', refereeUid: 'u1' }).valid).toBe(false);
  });
});

describe('referrals · totalReferrerXp', () => {
  it('soma XP por status', () => {
    expect(totalReferrerXp(['signed_up', 'activated'])).toBe(250);
    expect(totalReferrerXp(['organizer', 'signed_up', 'activated'])).toBe(750);
    expect(totalReferrerXp([])).toBe(0);
  });
});

describe('referrals · monthlyValidReferrals', () => {
  it('conta apenas status válidos do mês corrente', () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const refs = [
      { status: 'signed_up', created_at_ms: new Date('2026-09-10').getTime() },
      { status: 'activated', created_at_ms: new Date('2026-09-05').getTime() },
      { status: 'pending', created_at_ms: new Date('2026-09-10').getTime() },
      { status: 'signed_up', created_at_ms: new Date('2026-08-30').getTime() }, // mês anterior
    ];
    expect(monthlyValidReferrals(refs, now)).toBe(2);
  });
});

describe('referrals · constantes', () => {
  it('REFERRAL_REWARDS tem 3 status', () => {
    expect(Object.keys(REFERRAL_REWARDS)).toHaveLength(3);
  });
  it('REFERRAL_MONTHLY_CAP = 50', () => {
    expect(REFERRAL_MONTHLY_CAP).toBe(50);
  });
});
