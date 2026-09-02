import { describe, it, expect } from 'vitest';
import {
  UserReferralCodeSchema,
  UserReferralSchema,
  UserKudoSchema,
  KudoType,
  KudoScope,
  UserKudoIndexSchema,
  UserRivalSchema,
  rivalPairKey,
  CrewSchema,
  CrewMemberSchema,
  CrewMemberRole,
  MentorshipSchema,
  mentorPairKey,
  MentorshipStatus,
  SeasonRankingSchema,
  referralCodePath,
  referralPath,
  kudoPath,
  kudoIndexPath,
  rivalPath,
  crewPath,
  crewMemberPath,
  mentorshipPath,
  seasonRankingPath,
} from './gamificationV2Schema2';

describe('Referral code schema', () => {
  it('válido', () => {
    const ok = {
      uid: 'u1', schemaVersion: 2, code: 'ABC23456', createdAt: 1,
      totalSignups: 0, totalActivated: 0, totalTournaments: 0,
      totalXpEarned: 0, monthlyCount: 0, monthKey: '2026-09', updatedAt: 1,
    };
    expect(UserReferralCodeSchema.safeParse(ok).success).toBe(true);
  });
  it('código com 0/O/1/I/L falha', () => {
    const bad = {
      uid: 'u1', schemaVersion: 2, code: 'ABC0DEFG', createdAt: 1,
      totalSignups: 0, totalActivated: 0, totalTournaments: 0,
      totalXpEarned: 0, monthlyCount: 0, monthKey: '2026-09', updatedAt: 1,
    };
    expect(UserReferralCodeSchema.safeParse(bad).success).toBe(false);
  });
  it('código com length != 8 falha', () => {
    const bad = {
      uid: 'u1', schemaVersion: 2, code: 'AB23', createdAt: 1,
      totalSignups: 0, totalActivated: 0, totalTournaments: 0,
      totalXpEarned: 0, monthlyCount: 0, monthKey: '2026-09', updatedAt: 1,
    };
    expect(UserReferralCodeSchema.safeParse(bad).success).toBe(false);
  });
  it('schemaVersion diferente falha', () => {
    const bad = {
      uid: 'u1', schemaVersion: 1, code: 'ABC23456', createdAt: 1,
      totalSignups: 0, totalActivated: 0, totalTournaments: 0,
      totalXpEarned: 0, monthlyCount: 0, monthKey: '2026-09', updatedAt: 1,
    };
    expect(UserReferralCodeSchema.safeParse(bad).success).toBe(false);
  });
  it('path', () => {
    expect(referralCodePath('u1')).toBe('user_referral_codes/u1');
  });
});

describe('Referral schema', () => {
  it('válido', () => {
    const ok = {
      refereeUid: 'u2', referrerUid: 'u1', code: 'ABC23456',
      signedUpAt: 1, activatedAt: null, tournamentAt: null,
      xpPaidOut: 0, updatedAt: 1,
    };
    expect(UserReferralSchema.safeParse(ok).success).toBe(true);
  });
  it('path', () => {
    expect(referralPath('u2')).toBe('user_referrals/u2');
  });
});

describe('Kudo enums', () => {
  it('KudoType aceita os 8', () => {
    ['sportsmanship', 'clutch', 'mentor', 'teacher', 'positive', 'resilient', 'teamwork', 'custom'].forEach((t) => {
      expect(KudoType.safeParse(t).success).toBe(true);
    });
  });
  it('KudoType rejeita inválido', () => {
    expect(KudoType.safeParse('hacker').success).toBe(false);
  });
  it('KudoScope aceita os 5', () => {
    ['universal', 'match', 'tournament', 'crew', 'rivalry'].forEach((s) => {
      expect(KudoScope.safeParse(s).success).toBe(true);
    });
  });
});

describe('Kudo schema', () => {
  it('válido', () => {
    const ok = {
      kudoId: 'k1', fromUid: 'u1', toUid: 'u2', type: 'sportsmanship',
      scope: 'match', message: 'Bom jogo!',
      contextId: 'm1', createdAt: 1, expiresAt: Date.now() + 86400000,
    };
    expect(UserKudoSchema.safeParse(ok).success).toBe(true);
  });
  it('message > 280 chars falha', () => {
    const bad = {
      kudoId: 'k1', fromUid: 'u1', toUid: 'u2', type: 'sportsmanship',
      scope: 'match', message: 'a'.repeat(281),
      createdAt: 1, expiresAt: 1,
    };
    expect(UserKudoSchema.safeParse(bad).success).toBe(false);
  });
  it('path', () => {
    expect(kudoPath('k1')).toBe('user_kudos/k1');
  });
});

describe('Kudo index', () => {
  it('válido', () => {
    const ok = {
      uid: 'u1', schemaVersion: 2, receivedCount: 0, givenCount: 0,
      receivedToday: 0, givenToday: 0, lastKudoDay: '2026-09-02', updatedAt: 1,
    };
    expect(UserKudoIndexSchema.safeParse(ok).success).toBe(true);
  });
  it('receivedToday > 100 falha', () => {
    const bad = {
      uid: 'u1', schemaVersion: 2, receivedCount: 0, givenCount: 0,
      receivedToday: 101, givenToday: 0, lastKudoDay: '2026-09-02', updatedAt: 1,
    };
    expect(UserKudoIndexSchema.safeParse(bad).success).toBe(false);
  });
  it('givenToday > 50 falha', () => {
    const bad = {
      uid: 'u1', schemaVersion: 2, receivedCount: 0, givenCount: 0,
      receivedToday: 0, givenToday: 51, lastKudoDay: '2026-09-02', updatedAt: 1,
    };
    expect(UserKudoIndexSchema.safeParse(bad).success).toBe(false);
  });
  it('path', () => {
    expect(kudoIndexPath('u1')).toBe('user_kudos_index/u1');
  });
});

describe('Rivals', () => {
  it('rivalPairKey ordena', () => {
    expect(rivalPairKey('u2', 'u1')).toBe('u1_u2');
    expect(rivalPairKey('u1', 'u2')).toBe('u1_u2');
  });
  it('válido', () => {
    const ok = {
      pairKey: 'u1_u2', userA: 'u1', userB: 'u2',
      gamesA: 5, gamesB: 3, winsA: 3, winsB: 2,
      lastGameAt: 1000, createdAt: 1, updatedAt: 1,
    };
    expect(UserRivalSchema.safeParse(ok).success).toBe(true);
  });
  it('path', () => {
    expect(rivalPath('u1_u2')).toBe('user_rivals/u1_u2');
  });
});

describe('Crews', () => {
  it('CrewMemberRole aceita owner/captain/member', () => {
    ['owner', 'captain', 'member'].forEach((r) => {
      expect(CrewMemberRole.safeParse(r).success).toBe(true);
    });
  });
  it('válido', () => {
    const ok = {
      crewId: 'c1', schemaVersion: 2, name: 'Smash Bros',
      description: 'Crew de SP', region: 'SP', isPublic: true,
      createdBy: 'u1', membersCount: 3, totalXp: 5000, totalWins: 50,
      createdAt: 1, updatedAt: 1,
    };
    expect(CrewSchema.safeParse(ok).success).toBe(true);
  });
  it('name > 40 chars falha', () => {
    const bad = {
      crewId: 'c1', schemaVersion: 2, name: 'a'.repeat(41),
      isPublic: true, createdBy: 'u1', membersCount: 1, totalXp: 0, totalWins: 0,
      createdAt: 1, updatedAt: 1,
    };
    expect(CrewSchema.safeParse(bad).success).toBe(false);
  });
  it('CrewMember válido', () => {
    const ok = {
      crewId: 'c1', uid: 'u1', role: 'owner',
      joinedAt: 1, contributionXp: 100, updatedAt: 1,
    };
    expect(CrewMemberSchema.safeParse(ok).success).toBe(true);
  });
  it('paths', () => {
    expect(crewPath('c1')).toBe('crews/c1');
    expect(crewMemberPath('c1', 'u1')).toBe('crew_members/c1_u1');
  });
});

describe('Mentorships', () => {
  it('mentorPairKey', () => {
    expect(mentorPairKey('m1', 'a1')).toBe('m1_a1');
  });
  it('MentorshipStatus aceita os 4', () => {
    ['active', 'paused', 'completed', 'cancelled'].forEach((s) => {
      expect(MentorshipStatus.safeParse(s).success).toBe(true);
    });
  });
  it('válido', () => {
    const ok = {
      pairKey: 'm1_a1', schemaVersion: 2,
      mentorUid: 'm1', apprenticeUid: 'a1', status: 'active',
      lessonsCompleted: 5, startedAt: 1, endedAt: null, updatedAt: 1,
    };
    expect(MentorshipSchema.safeParse(ok).success).toBe(true);
  });
  it('path', () => {
    expect(mentorshipPath('m1_a1')).toBe('mentorships/m1_a1');
  });
});

describe('Season ranking', () => {
  it('válido', () => {
    const ok = {
      seasonId: '2026-q3', uid: 'u1', schemaVersion: 2,
      xp: 5000, tier: 'Craque', position: 1, deltaPosition: 2,
      prizeXp: 500, updatedAt: 1,
    };
    expect(SeasonRankingSchema.safeParse(ok).success).toBe(true);
  });
  it('path', () => {
    expect(seasonRankingPath('2026-q3', 'u1')).toBe('season_rankings/2026-q3_u1');
  });
});
