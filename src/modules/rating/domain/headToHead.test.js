import { describe, it, expect } from 'vitest';
import { buildHeadToHead, topRivals } from './headToHead.js';

describe('buildHeadToHead', () => {
  it('agrega vitórias e derrotas por adversário', () => {
    const h2h = buildHeadToHead([
      { opponent: 'Ana', won: true },
      { opponent: 'Ana', won: false },
      { opponent: 'Bia', won: true },
    ]);
    const ana = h2h.find((x) => x.opponent === 'Ana');
    expect(ana).toMatchObject({ played: 2, wins: 1, losses: 1 });
    expect(h2h[0].opponent).toBe('Ana'); // mais confrontos primeiro
  });

  it('ignora adversários vazios', () => {
    expect(buildHeadToHead([{ opponent: '  ', won: true }])).toEqual([]);
  });
});

describe('topRivals', () => {
  it('retorna só quem tem 2+ confrontos, limitado', () => {
    const h2h = buildHeadToHead([
      { opponent: 'Ana', won: true },
      { opponent: 'Ana', won: false },
      { opponent: 'Bia', won: true },
    ]);
    const rivals = topRivals(h2h, 5);
    expect(rivals.map((r) => r.opponent)).toEqual(['Ana']);
  });
});
