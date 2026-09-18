import { describe, it, expect } from 'vitest';
import {
  isTournamentRankingEligible, eligibleTournamentIdsForRanking, RANKING_ELIGIBLE_STATUSES,
} from './rankingEligibility.js';
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

  it('inelegível: rascunho (torneio sendo montado é ambiente de teste)', () => {
    expect(isTournamentRankingEligible({ ...eligible, status: TOURNAMENT_STATUS.DRAFT })).toBe(false);
  });

  it('inelegível: cancelado', () => {
    expect(isTournamentRankingEligible({ ...eligible, status: TOURNAMENT_STATUS.CANCELLED })).toBe(false);
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
      // Em andamento ENTRA: o resultado lançado já conta.
      { id: 't3', visibility: TOURNAMENT_VISIBILITY.PUBLIC, status: TOURNAMENT_STATUS.IN_PROGRESS },
      { id: 't4', visibility: TOURNAMENT_VISIBILITY.PUBLIC, status: TOURNAMENT_STATUS.FINISHED, archived: true },
      { id: 't5', visibility: TOURNAMENT_VISIBILITY.PUBLIC, status: TOURNAMENT_STATUS.DRAFT },
      { id: 't6', visibility: TOURNAMENT_VISIBILITY.PUBLIC, status: TOURNAMENT_STATUS.CANCELLED },
    ]);
    expect([...ids].sort()).toEqual(['t1', 't3']);
  });
});

/* ---------------------------------------------------------------------------
 * ⭐ O RESULTADO DE TORNEIO CONTA ASSIM QUE É LANÇADO
 *
 * Em torneio o lançamento NÃO é facultativo: o placar é lançado porque a
 * partida aconteceu. Exigir o "encerrar" do organizador para o rating se mexer
 * atrasava o ranking inteiro — num torneio de três dias, nada do que
 * acontecia em quadra aparecia até alguém clicar num botão.
 * ------------------------------------------------------------------------ */
describe('⭐ elegibilidade: conta ao LANÇAR, não ao encerrar', () => {
  const publico = { id: 't1', visibility: TOURNAMENT_VISIBILITY.PUBLIC, archived: false };

  it('⭐ torneio EM ANDAMENTO já conta', () => {
    expect(isTournamentRankingEligible({ ...publico, status: TOURNAMENT_STATUS.IN_PROGRESS })).toBe(true);
  });

  it('⭐ encerrado continua contando', () => {
    expect(isTournamentRankingEligible({ ...publico, status: TOURNAMENT_STATUS.FINISHED })).toBe(true);
  });

  it('inscrições abertas ou encerradas também contam (se houver resultado lançado)', () => {
    expect(isTournamentRankingEligible({ ...publico, status: TOURNAMENT_STATUS.REGISTRATIONS_OPEN })).toBe(true);
    expect(isTournamentRankingEligible({ ...publico, status: TOURNAMENT_STATUS.REGISTRATIONS_CLOSED })).toBe(true);
  });

  it('⭐ RASCUNHO não conta — torneio sendo montado é ambiente de teste', () => {
    expect(isTournamentRankingEligible({ ...publico, status: TOURNAMENT_STATUS.DRAFT })).toBe(false);
  });

  it('⭐ CANCELADO não conta — o que não aconteceu não pontua', () => {
    expect(isTournamentRankingEligible({ ...publico, status: TOURNAMENT_STATUS.CANCELLED })).toBe(false);
  });

  it('privado e arquivado seguem de fora, em qualquer status', () => {
    [TOURNAMENT_STATUS.IN_PROGRESS, TOURNAMENT_STATUS.FINISHED].forEach((status) => {
      expect(isTournamentRankingEligible({
        ...publico, status, visibility: TOURNAMENT_VISIBILITY.PRIVATE,
      })).toBe(false);
      expect(isTournamentRankingEligible({ ...publico, status, archived: true })).toBe(false);
    });
  });

  it('⭐ a lista de status é a MESMA do servidor (as duas cópias não podem divergir)', async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const servidor = require('../../../../functions/ranking.js');
    expect([...servidor.RANKING_ELIGIBLE_STATUSES].sort())
      .toEqual([...RANKING_ELIGIBLE_STATUSES].sort());
    // E a função do servidor decide igual à do cliente, caso a caso.
    Object.values(TOURNAMENT_STATUS).forEach((status) => {
      const t = { visibility: 'public', archived: false, status };
      expect(servidor.isEligible(t)).toBe(isTournamentRankingEligible(t));
    });
  });
});
