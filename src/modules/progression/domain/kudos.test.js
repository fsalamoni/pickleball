import { describe, it, expect } from 'vitest';
import {
  kudosId,
  validateKudosInput,
  receiveKudosXp,
  giveKudosXp,
  detectKudosSpam,
  summarizeKudos,
  KUDOS_TARGET_TYPE,
  KUDOS_XP,
} from './kudos.js';

describe('kudos · kudosId', () => {
  it('formato determinístico', () => {
    expect(kudosId('u1', 'u2', 'profile', 'u2')).toBe('u1_u2_profile_u2');
  });
});

describe('kudos · validateKudosInput', () => {
  it('válido', () => {
    const r = validateKudosInput({
      fromUid: 'u1', toUid: 'u2', targetType: 'profile', targetId: 'u2',
    });
    expect(r.valid).toBe(true);
    expect(r.value.id).toBe('u1_u2_profile_u2');
  });
  it('sem fromUid', () => {
    expect(validateKudosInput({ toUid: 'u2', targetType: 'profile', targetId: 'u2' }).valid).toBe(false);
  });
  it('self-kudos', () => {
    expect(validateKudosInput({ fromUid: 'u1', toUid: 'u1', targetType: 'profile', targetId: 'u1' }).valid).toBe(false);
  });
  it('targetType inválido', () => {
    expect(validateKudosInput({ fromUid: 'u1', toUid: 'u2', targetType: 'foo', targetId: 'x' }).valid).toBe(false);
  });
});

describe('kudos · receiveKudosXp', () => {
  it('xp = delta * 1', () => {
    const r = receiveKudosXp(0, 5);
    expect(r.xpGained).toBe(5);
    expect(r.capped).toBe(false);
    expect(r.newTotal).toBe(5);
  });
  it('cap diário = 100', () => {
    const r = receiveKudosXp(98, 10);
    expect(r.xpGained).toBe(2);
    expect(r.capped).toBe(true);
    expect(r.newTotal).toBe(100);
  });
  it('zero delta = zero xp', () => {
    expect(receiveKudosXp(0, 0).xpGained).toBe(0);
  });
});

describe('kudos · giveKudosXp', () => {
  it('xp = delta * 1', () => {
    expect(giveKudosXp(0, 3).xpGained).toBe(3);
  });
  it('cap = 50', () => {
    const r = giveKudosXp(45, 10);
    expect(r.xpGained).toBe(5);
    expect(r.capped).toBe(true);
  });
});

describe('kudos · detectKudosSpam', () => {
  it('não detecta padrão normal', () => {
    const kudos = [
      { fromUid: 'u1', targetId: 't1', ts: Date.now() - 1 * 60 * 60 * 1000 },
      { fromUid: 'u1', targetId: 't2', ts: Date.now() },
    ];
    expect(detectKudosSpam(kudos)).toBe(false);
  });
  it('detecta spam (3+ kudos mesmo user→target em 24h)', () => {
    const now = Date.now();
    const kudos = [
      { fromUid: 'u1', targetId: 't1', ts: now - 3 * 60 * 60 * 1000 },
      { fromUid: 'u1', targetId: 't1', ts: now - 2 * 60 * 60 * 1000 },
      { fromUid: 'u1', targetId: 't1', ts: now - 1 * 60 * 60 * 1000 },
    ];
    expect(detectKudosSpam(kudos)).toBe(true);
  });
  it('NÃO detecta se kudos foram em dias diferentes', () => {
    const now = Date.now();
    const kudos = [
      { fromUid: 'u1', targetId: 't1', ts: now - 26 * 60 * 60 * 1000 }, // > 24h
      { fromUid: 'u1', targetId: 't1', ts: now - 25 * 60 * 60 * 1000 },
      { fromUid: 'u1', targetId: 't1', ts: now - 1 * 60 * 60 * 1000 },
    ];
    expect(detectKudosSpam(kudos)).toBe(false);
  });
});

describe('kudos · summarizeKudos', () => {
  it('conta total + today + por tipo', () => {
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const kudos = [
      { targetType: 'profile', ts: today.getTime() + 1000 },
      { targetType: 'profile', ts: today.getTime() + 2000 },
      { targetType: 'game',    ts: today.getTime() + 3000 },
      { targetType: 'profile', ts: today.getTime() - 24 * 60 * 60 * 1000 }, // ontem
    ];
    const s = summarizeKudos(kudos, now);
    expect(s.total).toBe(4);
    expect(s.today).toBe(3);
    expect(s.byTargetType.profile).toBe(3);
    expect(s.byTargetType.game).toBe(1);
  });
});

describe('kudos · constantes', () => {
  it('KUDOS_TARGET_TYPE tem os tipos esperados', () => {
    expect(Object.values(KUDOS_TARGET_TYPE)).toContain('profile');
    expect(Object.values(KUDOS_TARGET_TYPE)).toContain('achievement');
  });
  it('KUDOS_XP tem cap receptor e doador', () => {
    expect(KUDOS_XP.RECEIVE_DAILY_CAP).toBe(100);
    expect(KUDOS_XP.GIVE_DAILY_CAP).toBe(50);
  });
});
