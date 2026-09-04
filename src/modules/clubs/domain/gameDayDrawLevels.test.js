/**
 * Equilíbrio por NÍVEL no sorteio do dia de jogo.
 *
 * Duas garantias precisam conviver e estão testadas juntas:
 *   1. com nível, as duplas e as quadras ficam mais parelhas;
 *   2. sem nível — ou com nível desconhecido — NADA muda em relação ao
 *      comportamento histórico, e as garantias antigas (participação
 *      equilibrada, parcerias inéditas primeiro) continuam valendo.
 */
import { describe, it, expect } from 'vitest';
import { generateGameDayGames } from './gameDayDraw.js';

/** Desequilíbrio médio entre os dois lados dos jogos gerados. */
function desequilibrioMedio(jogos, levels) {
  const difs = jogos.map((g) => {
    const a = (levels[g.side_a[0]] + levels[g.side_a[1]]) / 2;
    const b = (levels[g.side_b[0]] + levels[g.side_b[1]]) / 2;
    return Math.abs(a - b);
  });
  return difs.reduce((s, d) => s + d, 0) / difs.length;
}

/** Amplitude média de nível dentro de cada quadra. */
function amplitudeMedia(jogos, levels) {
  const amps = jogos.map((g) => {
    const v = [...g.side_a, ...g.side_b].map((id) => levels[id]);
    return Math.max(...v) - Math.min(...v);
  });
  return amps.reduce((s, a) => s + a, 0) / amps.length;
}

// 12 atletas espalhados de 2.5 a 5.5 — cenário realista de clube.
const IDS = Array.from({ length: 12 }, (_, i) => `p${i}`);
const NIVEIS = {
  p0: 2.5, p1: 2.5, p2: 3.0, p3: 3.0, p4: 3.5, p5: 3.5,
  p6: 4.0, p7: 4.0, p8: 4.5, p9: 4.5, p10: 5.5, p11: 5.5,
};

describe('sorteio COM nível vs. SEM nível', () => {
  it('as duplas ficam mais equilibradas com nível', () => {
    const semNivel = generateGameDayGames(IDS, { seed: 'x', rounds: 8 });
    const comNivel = generateGameDayGames(IDS, { seed: 'x', rounds: 8, levels: NIVEIS });
    expect(desequilibrioMedio(comNivel, NIVEIS))
      .toBeLessThan(desequilibrioMedio(semNivel, NIVEIS));
  });

  it('as quadras ficam mais parelhas com nível', () => {
    const semNivel = generateGameDayGames(IDS, { seed: 'y', rounds: 8 });
    const comNivel = generateGameDayGames(IDS, { seed: 'y', rounds: 8, levels: NIVEIS });
    expect(amplitudeMedia(comNivel, NIVEIS)).toBeLessThan(amplitudeMedia(semNivel, NIVEIS));
  });

  it('o ganho se mantém em várias sementes (não é sorte de uma)', () => {
    let melhor = 0;
    const sementes = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (const seed of sementes) {
      const sem = desequilibrioMedio(generateGameDayGames(IDS, { seed, rounds: 8 }), NIVEIS);
      const com = desequilibrioMedio(generateGameDayGames(IDS, { seed, rounds: 8, levels: NIVEIS }), NIVEIS);
      if (com < sem) melhor += 1;
    }
    expect(melhor, 'equilíbrio deveria melhorar na maioria das sementes').toBeGreaterThanOrEqual(5);
  });
});

describe('as garantias antigas continuam valendo COM nível', () => {
  const jogos = generateGameDayGames(IDS, { seed: 'z', rounds: 9, levels: NIVEIS });

  it('todos jogam, e a participação continua equilibrada', () => {
    const contagem = {};
    IDS.forEach((id) => { contagem[id] = 0; });
    jogos.forEach((g) => [...g.side_a, ...g.side_b].forEach((id) => { contagem[id] += 1; }));
    const vals = Object.values(contagem);
    expect(Math.min(...vals)).toBeGreaterThan(0);
    // ninguém joga mais que 2 jogos a mais que o que menos jogou
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(2);
  });

  it('ninguém joga contra si mesmo nem é parceiro de si mesmo', () => {
    for (const g of jogos) {
      const todos = [...g.side_a, ...g.side_b];
      expect(new Set(todos).size).toBe(4);
    }
  });

  it('parcerias inéditas vêm antes das repetidas', () => {
    // com 12 atletas e 9 rodadas, a maioria das duplas ainda deve ser inédita
    const vistas = new Set();
    let repetidas = 0;
    jogos.forEach((g) => {
      for (const lado of [g.side_a, g.side_b]) {
        const k = [...lado].sort().join('|');
        if (vistas.has(k)) repetidas += 1;
        vistas.add(k);
      }
    });
    const totalDuplas = jogos.length * 2;
    expect(repetidas / totalDuplas).toBeLessThan(0.35);
  });

  it('continua determinístico: mesma semente, mesmo resultado', () => {
    const a = generateGameDayGames(IDS, { seed: 'det', rounds: 6, levels: NIVEIS });
    const b = generateGameDayGames(IDS, { seed: 'det', rounds: 6, levels: NIVEIS });
    expect(a).toEqual(b);
  });
});

describe('degradação segura', () => {
  it('mapa de níveis vazio se comporta como se não existisse', () => {
    const semOpcao = generateGameDayGames(IDS, { seed: 'q', rounds: 6 });
    const comVazio = generateGameDayGames(IDS, { seed: 'q', rounds: 6, levels: {} });
    expect(comVazio).toEqual(semOpcao);
  });

  it('níveis inválidos são ignorados sem quebrar', () => {
    const lixo = { p0: null, p1: 'abc', p2: undefined, p3: NaN };
    expect(() => generateGameDayGames(IDS, { seed: 'q', rounds: 4, levels: lixo })).not.toThrow();
  });

  it('nível conhecido de só parte do grupo funciona', () => {
    const parcial = { p0: 2.5, p1: 2.5, p10: 5.5, p11: 5.5 };
    const jogos = generateGameDayGames(IDS, { seed: 'p', rounds: 6, levels: parcial });
    expect(jogos.length).toBeGreaterThan(0);
    jogos.forEach((g) => expect(new Set([...g.side_a, ...g.side_b]).size).toBe(4));
  });

  it('grupo com nível idêntico não desestabiliza o sorteio', () => {
    const iguais = Object.fromEntries(IDS.map((id) => [id, 3.5]));
    const jogos = generateGameDayGames(IDS, { seed: 'i', rounds: 6, levels: iguais });
    expect(desequilibrioMedio(jogos, iguais)).toBe(0);
  });
});

describe('a garantia estrutural: nível nunca vence parceria inédita', () => {
  it('preferir uma dupla INÉDITA vale mais que equilibrar o nível', () => {
    // p0 e p1 já foram parceiros; p0 e p3 nunca foram. Mesmo que juntar p0
    // com p1 deixasse os lados milimetricamente mais parelhos, o motor tem de
    // preferir a parceria nova — repetir dupla custa mais que qualquer
    // desequilíbrio de nível (o custo de nível é limitado por teto).
    const ids = ['p0', 'p1', 'p2', 'p3'];
    const niveis = { p0: 3.0, p1: 5.0, p2: 3.0, p3: 5.0 };
    const historico = {
      partners: new Map([['p0|p1', 3]]),
      opponents: new Map(),
      played: new Map(),
      present: new Map(),
      rounds: 0,
    };
    const jogos = generateGameDayGames(ids, {
      seed: 'estrutural', rounds: 1, levels: niveis, history: historico,
    });
    const duplas = jogos.flatMap((g) => [
      [...g.side_a].sort().join('|'),
      [...g.side_b].sort().join('|'),
    ]);
    expect(duplas).not.toContain('p0|p1');
  });

  it('o custo de nível de uma quadra tem teto e não domina o sorteio', () => {
    // Extremos de 2.0 a 8.0: mesmo com a maior amplitude possível, as
    // parcerias continuam variando ao longo das rodadas.
    const ids = Array.from({ length: 8 }, (_, i) => `x${i}`);
    const niveis = { x0: 2.0, x1: 2.0, x2: 2.0, x3: 2.0, x4: 8.0, x5: 8.0, x6: 8.0, x7: 8.0 };
    const jogos = generateGameDayGames(ids, { seed: 'teto', rounds: 8, levels: niveis });
    const duplas = new Set();
    jogos.forEach((g) => {
      duplas.add([...g.side_a].sort().join('|'));
      duplas.add([...g.side_b].sort().join('|'));
    });
    expect(duplas.size).toBeGreaterThan(4);
  });
});
