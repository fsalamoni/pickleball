import { describe, it, expect } from 'vitest';
import { isTournamentRankingEligible, eligibleTournamentIdsForRanking } from './rankingEligibility.js';
import { TOURNAMENT_STATUS, TOURNAMENT_VISIBILITY } from './constants.js';

const eligible = {
  id: 't1',
  visibility: TOURNAMENT_VISIBILITY.PUBLIC,
  status: TOURNAMENT_STATUS.FINISHED,
};

describe('isTournamentRankingEligible', () => {
  it('elegível: público, encerrado, não arquivado', () => {
    expect(isTournamentRankingEligible(eligible)).toBe(true);
  });

  it('inelegível: privado', () => {
    expect(isTournamentRankingEligible({ ...eligible, visibility: TOURNAMENT_VISIBILITY.PRIVATE })).toBe(false);
  });

  it('inelegível: não encerrado', () => {
    expect(isTournamentRankingEligible({ ...eligible, status: TOURNAMENT_STATUS.IN_PROGRESS })).toBe(false);
  });

  it('inelegível: arquivado', () => {
    expect(isTournamentRankingEligible({ ...eligible, archived: true })).toBe(false);
  });

  it('inelegível: nulo', () => {
    expect(isTournamentRankingEligible(null)).toBe(false);
  });
});

describe('eligibleTournamentIdsForRanking', () => {
  it('retorna apenas os ids elegíveis', () => {
    const ids = eligibleTournamentIdsForRanking([
      eligible,
      { id: 't2', visibility: TOURNAMENT_VISIBILITY.PRIVATE, status: TOURNAMENT_STATUS.FINISHED },
      { id: 't3', visibility: TOURNAMENT_VISIBILITY.PUBLIC, status: TOURNAMENT_STATUS.IN_PROGRESS },
      { id: 't4', visibility: TOURNAMENT_VISIBILITY.PUBLIC, status: TOURNAMENT_STATUS.FINISHED, archived: true },
    ]);
    expect([...ids]).toEqual(['t1']);
  });
});
