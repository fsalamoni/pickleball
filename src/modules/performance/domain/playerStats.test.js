import { describe, it, expect } from 'vitest';
import { buildPlayerStats, winRate } from './playerStats.js';

const TOURNAMENT_FINISHED = 'finished';
const TOURNAMENT_IN_PROGRESS = 'in_progress';

function entry(format, ranking) {
  return { modality: { format }, ranking };
}

describe('winRate', () => {
  it('calcula a fração de vitórias sobre jogos decididos', () => {
    expect(winRate(3, 1)).toBe(0.75);
  });
  it('retorna null sem jogos decididos', () => {
    expect(winRate(0, 0)).toBeNull();
  });
});

describe('buildPlayerStats', () => {
  it('retorna zeros para histórico vazio', () => {
    const s = buildPlayerStats([]);
    expect(s.tournaments).toBe(0);
    expect(s.played).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.byFormat).toEqual({});
  });

  it('soma jogos, vitórias e derrotas de todas as inscrições', () => {
    const history = [
      {
        tournament: { status: TOURNAMENT_IN_PROGRESS },
        entries: [
          entry('doubles', { played: 4, wins: 3, losses: 1, position: 2 }),
          entry('singles', { played: 2, wins: 1, losses: 1, position: 5 }),
        ],
      },
    ];
    const s = buildPlayerStats(history);
    expect(s.tournaments).toBe(1);
    expect(s.registrations).toBe(2);
    expect(s.played).toBe(6);
    expect(s.wins).toBe(4);
    expect(s.losses).toBe(2);
    expect(s.winRate).toBeCloseTo(4 / 6);
    expect(s.byFormat.doubles).toMatchObject({ played: 4, wins: 3, losses: 1 });
    expect(s.byFormat.singles).toMatchObject({ played: 2, wins: 1, losses: 1 });
  });

  it('conta títulos e pódios apenas em torneios encerrados', () => {
    const history = [
      {
        tournament: { status: TOURNAMENT_FINISHED },
        entries: [entry('doubles', { played: 5, wins: 5, losses: 0, position: 1 })],
      },
      {
        tournament: { status: TOURNAMENT_FINISHED },
        entries: [entry('doubles', { played: 4, wins: 2, losses: 2, position: 3 })],
      },
      {
        // em andamento: posição 1 não conta como título ainda
        tournament: { status: TOURNAMENT_IN_PROGRESS },
        entries: [entry('singles', { played: 3, wins: 3, losses: 0, position: 1 })],
      },
    ];
    const s = buildPlayerStats(history);
    expect(s.titles).toBe(1);
    expect(s.podiums).toBe(2);
  });

  it('ignora inscrições sem ranking (torneio não iniciado) mas as conta como inscrição', () => {
    const history = [
      {
        tournament: { status: TOURNAMENT_IN_PROGRESS },
        entries: [entry('doubles', null), entry('doubles', { played: 1, wins: 1, losses: 0, position: 1 })],
      },
    ];
    const s = buildPlayerStats(history);
    expect(s.registrations).toBe(2);
    expect(s.played).toBe(1);
    expect(s.wins).toBe(1);
  });
});
