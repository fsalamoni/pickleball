import { describe, it, expect } from 'vitest';
import {
  suggestRivals, summarizeH2H,
  crewId, aggregateCrewStats, validateCrewInput,
  mentorshipId, validateMentorshipInput, apprenticeshipProgress,
  RIVALS_MAX, CREW_MAX_MEMBERS, MENTOR_MAX_APPRENTICES,
  MENTOR_XP_BONUS_PER_GOAL, APPRENTICE_XP_BONUS_PER_GOAL,
  rivalId,
} from './socialBonds.js';

describe('socialBonds · Rivals', () => {
  it('RIVALS_MAX = 5', () => {
    expect(RIVALS_MAX).toBe(5);
  });

  it('rivalId determinístico', () => {
    expect(rivalId('u1', 'u2')).toBe('u1_u2');
  });

  it('suggestRivals: ordena por proximidade + cidade', () => {
    const me = { uid: 'me', rating: 1100, city: 'Curitiba', state: 'PR' };
    const candidates = [
      { uid: 'c1', rating: 1100, city: 'Curitiba', state: 'PR' }, // mesmo rating, mesma cidade
      { uid: 'c2', rating: 1300, city: 'SP', state: 'SP' }, // longe
      { uid: 'c3', rating: 1080, city: 'Curitiba', state: 'PR' }, // próximo, mesma cidade
      { uid: 'c4', rating: 1100, city: 'SP', state: 'SP' }, // mesmo rating, outra cidade
    ];
    const rivals = suggestRivals({ me, candidates, options: { max: 3, maxRatingDiff: 200 } });
    expect(rivals).toHaveLength(3);
    // c1 e c3 vêm antes (mesma cidade)
    expect(rivals[0].uid).toMatch(/c1|c3/);
    expect(rivals[1].uid).toMatch(/c1|c3/);
    // c2 fica de fora (rating diff 200, mas com maxDiff=200, passa)
    // na verdade c2.ratingDiff=200 === maxDiff, então passa
  });

  it('exclude próprio user', () => {
    const me = { uid: 'me', rating: 1100, city: 'X', state: 'Y' };
    const rivals = suggestRivals({ me, candidates: [{ uid: 'me', rating: 1100 }] });
    expect(rivals).toEqual([]);
  });
});

describe('socialBonds · H2H', () => {
  it('resume vitórias', () => {
    const s = summarizeH2H({ wins: 3 }, { wins: 1 });
    expect(s.myWins).toBe(3);
    expect(s.rivalWins).toBe(1);
    expect(s.total).toBe(4);
    expect(s.myWinRate).toBe(0.75);
    expect(s.leader).toBe('me');
  });

  it('empate', () => {
    const s = summarizeH2H({ wins: 2 }, { wins: 2 });
    expect(s.leader).toBe('tied');
  });

  it('sem jogos', () => {
    const s = summarizeH2H({ wins: 0 }, { wins: 0 });
    expect(s.myWinRate).toBe(null);
    expect(s.leader).toBe('tied');
  });
});

describe('socialBonds · Crews', () => {
  it('CREW_MAX_MEMBERS = 8', () => {
    expect(CREW_MAX_MEMBERS).toBe(8);
  });

  it('crewId normaliza nome', () => {
    expect(crewId('Smash da Segunda!')).toBe('crew_smash-da-segunda');
  });

  it('aggregateCrewStats', () => {
    const stats = aggregateCrewStats([
      {
        uid: 'm1',
        games: [
          { won: true, pointsFor: 11, pointsAgainst: 5 },
          { won: false, pointsFor: 7, pointsAgainst: 11 },
        ],
      },
      {
        uid: 'm2',
        games: [
          { won: true, pointsFor: 11, pointsAgainst: 9 },
        ],
      },
    ]);
    expect(stats.totalGames).toBe(3);
    expect(stats.totalWins).toBe(2);
    expect(stats.totalLosses).toBe(1);
    expect(stats.winRate).toBeCloseTo(0.666, 2);
    expect(stats.pointsFor).toBe(29);
    expect(stats.pointsAgainst).toBe(25);
    expect(stats.diff).toBe(4);
  });

  it('validateCrewInput: nome', () => {
    expect(validateCrewInput({ name: 'x' }).valid).toBe(false);
    expect(validateCrewInput({ name: 'Nome Válido' }).valid).toBe(true);
  });

  it('validateCrewInput: max membros', () => {
    const members = Array.from({ length: 9 }, (_, i) => `u${i}`);
    expect(validateCrewInput({ name: 'Nome OK', members }).valid).toBe(false);
    const ok8 = Array.from({ length: 8 }, (_, i) => `u${i}`);
    expect(validateCrewInput({ name: 'Nome OK', members: ok8 }).valid).toBe(true);
  });
});

describe('socialBonds · Mentorship', () => {
  it('MENTOR_MAX_APPRENTICES = 2', () => {
    expect(MENTOR_MAX_APPRENTICES).toBe(2);
  });

  it('mentorshipId determinístico', () => {
    expect(mentorshipId('m1', 'a1')).toBe('m1_a1');
  });

  it('validateMentorshipInput', () => {
    expect(validateMentorshipInput({ mentorUid: 'm1', apprenticeUid: 'a1' }).valid).toBe(true);
    expect(validateMentorshipInput({ mentorUid: 'm1', apprenticeUid: 'm1' }).valid).toBe(false);
    expect(validateMentorshipInput({}).valid).toBe(false);
  });

  it('apprenticeshipProgress', () => {
    const p = apprenticeshipProgress([
      { metric: 'games', target: 3, current: 5 },
      { metric: 'tournaments', target: 1, current: 0 },
      { metric: 'lessons', target: 2, current: 2 },
    ]);
    expect(p.total).toBe(3);
    expect(p.done).toBe(2);
    expect(p.ratio).toBeCloseTo(0.666, 2);
  });

  it('XP bônus mentor/aprendiz', () => {
    expect(MENTOR_XP_BONUS_PER_GOAL).toBe(100);
    expect(APPRENTICE_XP_BONUS_PER_GOAL).toBe(200);
  });
});
