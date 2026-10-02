import { describe, it, expect } from 'vitest';
import { rankingCoverageSummary } from './rankingCoverage.js';
import { OUT_OF_RANKING_REASON } from '@/modules/games/domain/myGames.js';

const publico = { visibility: 'public', status: 'in_progress' };

describe('rankingCoverageSummary — por que um jogo meu não está no ranking', () => {
  it('tudo com conta, torneio público e dia publicado: nada fora', () => {
    const r = rankingCoverageSummary({
      history: [{ tournament: publico, entries: [{ registration: { format: 'doubles', player_a_user_id: 'u1', player_b_user_id: 'u2' }, ranking: { played: 5 } }] }],
      gameDayGames: [{ ranked: true }],
    });
    expect(r.totalFora).toBe(0);
  });

  it('parceiro sem conta tira os jogos da inscrição; torneio em rascunho tira os do torneio', () => {
    const r = rankingCoverageSummary({
      history: [
        { tournament: publico, entries: [{ registration: { format: 'doubles', player_a_user_id: 'u1', player_b_name: 'Zé' }, ranking: { played: 4 } }] },
        { tournament: { visibility: 'public', status: 'draft' }, entries: [{ registration: { format: 'singles', player_a_user_id: 'u1' }, ranking: { played: 3 } }] },
      ],
    });
    expect(r.torneio).toEqual({ semConta: 4, torneioFora: 3 });
    expect(r.totalFora).toBe(7);
  });

  it('dias de jogo: separa não publicado de convidado sem conta e aponta os dias', () => {
    const r = rankingCoverageSummary({
      gameDayGames: [
        { ranked: false, outReason: OUT_OF_RANKING_REASON.NOT_PUBLISHED, gameDayId: 'd1', label: 'Sábado' },
        { ranked: false, outReason: OUT_OF_RANKING_REASON.NOT_PUBLISHED, gameDayId: 'd1', label: 'Sábado' },
        { ranked: false, outReason: OUT_OF_RANKING_REASON.GUEST, gameDayId: 'd2', label: 'Quinta' },
        { ranked: true, gameDayId: 'd3' },
      ],
    });
    expect(r.diaDeJogo).toEqual({ naoPublicado: 2, convidado: 1, pendente: 0 });
    expect(r.dias).toEqual([
      { id: 'd1', label: 'Sábado', jogos: 2, motivo: OUT_OF_RANKING_REASON.NOT_PUBLISHED },
      { id: 'd2', label: 'Quinta', jogos: 1, motivo: OUT_OF_RANKING_REASON.GUEST },
    ]);
  });

  it('entradas vazias não quebram', () => {
    expect(rankingCoverageSummary().totalFora).toBe(0);
    expect(rankingCoverageSummary({ history: null, gameDayGames: null }).totalFora).toBe(0);
  });
});
