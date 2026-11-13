import { describe, it, expect } from 'vitest';
import { playoffFirstRound, playoffRoundLabel, playoffSize, playoffState } from './leaguePlayoff.js';

const ids = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'];
const ganha = (m, lado) => ({ ...m, phase: 'playoff', games: [lado === 'a' ? { a: 11, b: 3 } : { a: 3, b: 11 }] });

describe('playoff da liga', () => {
  it('o tamanho cabe nas inscrições', () => {
    expect(playoffSize(8, 6)).toBe(4);
    expect(playoffSize(4, 3)).toBe(2);
    expect(playoffSize(2, 1)).toBe(0);
  });

  it('a 1ª fase cruza a cabeça 1 com a última e separa 1 e 2 até a final', () => {
    expect(playoffFirstRound(ids, 8).map((m) => [m.seed_a, m.seed_b])).toEqual([[1, 8], [4, 5], [2, 7], [3, 6]]);
    expect(playoffFirstRound(ids.slice(0, 5), 4).map((m) => [m.side_a, m.side_b])).toEqual([['e1', 'e4'], ['e2', 'e3']]);
  });

  it('fase a fase até o campeão, com a disputa do 3º lugar', () => {
    const semis = playoffFirstRound(ids, 4).map((m) => ({ ...m, phase: 'playoff' }));
    expect(playoffState(semis).stage).toBe('playing');
    const feitas = [ganha(semis[0], 'a'), ganha(semis[1], 'b')];
    const s = playoffState(feitas, { thirdPlace: true });
    expect(s.stage).toBe('ready');
    expect(s.next).toEqual([
      { round: 2, slot: 0, side_a: 'e1', side_b: 'e3' },
      { round: 2, slot: 1, third: true, side_a: 'e4', side_b: 'e2' },
    ]);
    const fim = playoffState([...feitas, ganha(s.next[0], 'b'), ganha(s.next[1], 'a')], { thirdPlace: true });
    expect(fim).toMatchObject({ stage: 'done', champion: 'e3', runner_up: 'e1', third: 'e4' });
  });

  it('sem a disputa do 3º lugar a final fecha sozinha', () => {
    const semis = playoffFirstRound(ids, 4).map((m) => ganha(m, 'a'));
    const s = playoffState(semis);
    expect(s.next).toHaveLength(1);
    expect(playoffState([...semis, ganha(s.next[0], 'a')])).toMatchObject({ stage: 'done', champion: 'e1', third: null });
  });

  it('o nome das fases', () => {
    expect(playoffRoundLabel(3, 3)).toBe('Final');
    expect(playoffRoundLabel(2, 3)).toBe('Semifinal');
    expect(playoffRoundLabel(1, 3)).toBe('Quartas de final');
  });
});
