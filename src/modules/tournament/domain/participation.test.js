import { describe, it, expect } from 'vitest';
import { toMillis, partnerNameFor, partnerPhotoFor, buildParticipationHistory } from './participation.js';
import { REGISTRATION_STATUS } from './constants.js';

describe('toMillis', () => {
  it('lê ISO, Date, Firestore Timestamp e seconds', () => {
    expect(toMillis('2026-06-20T00:00:00.000Z')).toBe(Date.parse('2026-06-20T00:00:00.000Z'));
    const d = new Date('2026-01-01T12:00:00Z');
    expect(toMillis(d)).toBe(d.getTime());
    expect(toMillis({ seconds: 100 })).toBe(100000);
    expect(toMillis({ toDate: () => new Date('2026-03-03T00:00:00Z') })).toBe(
      Date.parse('2026-03-03T00:00:00Z'),
    );
    expect(toMillis(null)).toBe(0);
    expect(toMillis('lixo')).toBe(0);
  });
});

describe('partnerNameFor', () => {
  it('jogador A → parceiro é o B', () => {
    const reg = { player_a_user_id: 'u1', player_b_name: 'Bia', player_a_name: 'Ana' };
    expect(partnerNameFor(reg, 'u1')).toBe('Bia');
  });
  it('jogador B → parceiro é o A', () => {
    const reg = { player_b_user_id: 'u2', player_a_name: 'Ana', player_b_name: 'Bia' };
    expect(partnerNameFor(reg, 'u2')).toBe('Ana');
  });
  it('singles (sem B) → null', () => {
    const reg = { player_a_user_id: 'u1', player_a_name: 'Ana', player_b_name: '' };
    expect(partnerNameFor(reg, 'u1')).toBeNull();
  });
});

describe('partnerPhotoFor', () => {
  it('jogador A → foto do parceiro B', () => {
    const reg = { player_a_user_id: 'u1', player_b_photo: 'b.jpg', player_a_photo: 'a.jpg' };
    expect(partnerPhotoFor(reg, 'u1')).toBe('b.jpg');
  });
  it('jogador B → foto do parceiro A', () => {
    const reg = { player_b_user_id: 'u2', player_a_photo: 'a.jpg', player_b_photo: 'b.jpg' };
    expect(partnerPhotoFor(reg, 'u2')).toBe('a.jpg');
  });
  it('sem foto do parceiro → null', () => {
    const reg = { player_a_user_id: 'u1', player_a_photo: 'a.jpg' };
    expect(partnerPhotoFor(reg, 'u1')).toBeNull();
  });
});

describe('buildParticipationHistory', () => {
  const userId = 'u1';
  const tournamentById = new Map([
    ['t1', { id: 't1', name: 'Copa A', starts_at: '2026-06-20T00:00:00Z', status: 'in_progress' }],
    ['t2', { id: 't2', name: 'Copa B', starts_at: '2026-01-10T00:00:00Z', status: 'finished' }],
  ]);
  const modalityById = new Map([
    ['m1', { id: 'm1', name: 'Duplas Masc A', format: 'doubles', stages: [{ type: 'round_robin' }] }],
    ['m2', { id: 'm2', name: 'Simples B', format: 'singles', stages: [{ type: 'knockout' }] }],
  ]);
  const rankingByModality = new Map([
    [
      'm1',
      [
        { participant_id: 'r1', position: 1, played: 3, wins: 3, losses: 0 },
        { participant_id: 'rx', position: 2, played: 3, wins: 1, losses: 2 },
      ],
    ],
    ['m2', [{ participant_id: 'r2', position: 1, played: 0, wins: 0, losses: 0 }]], // não iniciado
  ]);

  const regs = [
    { id: 'r1', tournament_id: 't1', modality_id: 'm1', status: REGISTRATION_STATUS.CONFIRMED, player_a_user_id: 'u1', player_a_name: 'Eu', player_b_name: 'Parça' },
    { id: 'r2', tournament_id: 't2', modality_id: 'm2', status: REGISTRATION_STATUS.CONFIRMED, player_a_user_id: 'u1', player_a_name: 'Eu' },
  ];

  it('agrupa por torneio, ordena por data desc e mapeia ranking', () => {
    const history = buildParticipationHistory(regs, { userId, tournamentById, modalityById, rankingByModality });
    expect(history).toHaveLength(2);
    // Copa A (jun) antes de Copa B (jan)
    expect(history[0].tournamentId).toBe('t1');
    expect(history[1].tournamentId).toBe('t2');

    const a = history[0].entries[0];
    expect(a.partnerName).toBe('Parça');
    expect(a.ranking).toEqual({ position: 1, total: 2, played: 3, wins: 3, losses: 0, started: true });

    const b = history[1].entries[0];
    expect(b.partnerName).toBeNull();
    expect(b.ranking).toBeNull(); // modalidade ainda não iniciada
  });

  it('coloca inscrições canceladas por último dentro do torneio', () => {
    const multi = [
      { id: 'rc', tournament_id: 't1', modality_id: 'm2', status: REGISTRATION_STATUS.CANCELLED, player_a_user_id: 'u1', player_a_name: 'Eu' },
      ...regs.filter((r) => r.tournament_id === 't1'),
    ];
    const history = buildParticipationHistory(multi, { userId, tournamentById, modalityById, rankingByModality });
    const t1 = history.find((g) => g.tournamentId === 't1');
    expect(t1.entries[t1.entries.length - 1].registration.status).toBe(REGISTRATION_STATUS.CANCELLED);
  });

  it('lida com torneio/modalidade ausentes sem quebrar', () => {
    const orphan = [{ id: 'r9', tournament_id: 'tX', modality_id: 'mX', status: REGISTRATION_STATUS.CONFIRMED, player_a_user_id: 'u1' }];
    const history = buildParticipationHistory(orphan, {
      userId,
      tournamentById: new Map(),
      modalityById: new Map(),
      rankingByModality: new Map(),
    });
    expect(history).toHaveLength(1);
    expect(history[0].tournament).toBeNull();
    expect(history[0].entries[0].modality).toBeNull();
    expect(history[0].entries[0].ranking).toBeNull();
  });
});
