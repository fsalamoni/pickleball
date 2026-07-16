import { describe, it, expect } from 'vitest';
import { isTournamentComplete, isModalityFinalStageReached, hasPendingMatch } from './tournamentCompletion.js';
import { MATCH_STATUS } from './constants.js';

const F = MATCH_STATUS.FINISHED;
const S = MATCH_STATUS.SCHEDULED;
const IP = MATCH_STATUS.IN_PROGRESS;
const WO = MATCH_STATUS.WALKOVER;

describe('hasPendingMatch', () => {
  it('detecta agendados/em andamento', () => {
    expect(hasPendingMatch([{ status: F }, { status: S }])).toBe(true);
    expect(hasPendingMatch([{ status: F }, { status: IP }])).toBe(true);
    expect(hasPendingMatch([{ status: F }, { status: WO }])).toBe(false);
  });
});

describe('isModalityFinalStageReached', () => {
  it('fase única: precisa ter jogos', () => {
    const modality = { id: 'm1', stages: [{ type: 'groups' }] };
    expect(isModalityFinalStageReached(modality, [])).toBe(false);
    expect(isModalityFinalStageReached(modality, [{ stage_index: 0, status: F }])).toBe(true);
  });

  it('multi-fase: exige alcançar a última fase configurada', () => {
    const modality = { id: 'm1', stages: [{ type: 'groups' }, { type: 'knockout' }] };
    expect(isModalityFinalStageReached(modality, [{ stage_index: 0, status: F }])).toBe(false);
    expect(isModalityFinalStageReached(modality, [
      { stage_index: 0, status: F },
      { stage_index: 1, status: F },
    ])).toBe(true);
  });
});

describe('isTournamentComplete', () => {
  it('falso sem jogos', () => {
    expect(isTournamentComplete([{ id: 'm1', stages: [{}] }], [])).toBe(false);
  });

  it('falso se há jogo pendente', () => {
    const modalities = [{ id: 'm1', stages: [{}] }];
    const matches = [
      { modality_id: 'm1', stage_index: 0, status: F },
      { modality_id: 'm1', stage_index: 0, status: S },
    ];
    expect(isTournamentComplete(modalities, matches)).toBe(false);
  });

  it('verdadeiro quando todas as modalidades com jogos alcançaram a última fase e nada está pendente', () => {
    const modalities = [
      { id: 'm1', stages: [{}] },
      { id: 'm2', stages: [{}, {}] },
      { id: 'm3', stages: [{}] }, // sem jogos → não bloqueia
    ];
    const matches = [
      { modality_id: 'm1', stage_index: 0, status: F },
      { modality_id: 'm2', stage_index: 0, status: F },
      { modality_id: 'm2', stage_index: 1, status: WO },
    ];
    expect(isTournamentComplete(modalities, matches)).toBe(true);
  });

  it('falso se uma modalidade multi-fase não chegou à fase final', () => {
    const modalities = [{ id: 'm1', stages: [{}, {}] }];
    const matches = [{ modality_id: 'm1', stage_index: 0, status: F }];
    expect(isTournamentComplete(modalities, matches)).toBe(false);
  });

  it('mata-mata: NÃO conclui entre rodadas (rodada 1 decidida, final ainda por vir)', () => {
    // 4 jogadores, rodada 1 (2 jogos) decidida, sem pendências mas a final não
    // foi gerada ainda — não deve encerrar.
    const modalities = [{ id: 'm1', stages: [{ type: 'knockout' }] }];
    const matches = [
      { modality_id: 'm1', stage_index: 0, status: F, bracket: 'wb', round: 1, position: 1, winner_side: 'a', side_a_ids: ['p1'], side_b_ids: ['p2'] },
      { modality_id: 'm1', stage_index: 0, status: F, bracket: 'wb', round: 1, position: 2, winner_side: 'a', side_a_ids: ['p3'], side_b_ids: ['p4'] },
    ];
    expect(isTournamentComplete(modalities, matches)).toBe(false);
  });

  it('mata-mata: conclui quando a final decide o campeão', () => {
    const modalities = [{ id: 'm1', stages: [{ type: 'knockout' }] }];
    const matches = [
      { modality_id: 'm1', stage_index: 0, status: F, bracket: 'wb', round: 1, position: 1, winner_side: 'a', side_a_ids: ['p1'], side_b_ids: ['p2'] },
      { modality_id: 'm1', stage_index: 0, status: F, bracket: 'wb', round: 1, position: 2, winner_side: 'a', side_a_ids: ['p3'], side_b_ids: ['p4'] },
      { modality_id: 'm1', stage_index: 0, status: F, bracket: 'wb', round: 2, position: 1, winner_side: 'a', side_a_ids: ['p1'], side_b_ids: ['p3'] },
    ];
    expect(isTournamentComplete(modalities, matches)).toBe(true);
  });
});
