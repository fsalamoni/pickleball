/**
 * Mexicano e Rei da Quadra com a régua unificada de nível.
 *
 * Duas coisas precisam ser verdade ao mesmo tempo:
 *  1) COM níveis, as duplas ficam mais equilibradas;
 *  2) SEM níveis (ou com níveis inúteis), o resultado é BYTE A BYTE o mesmo de
 *     antes — nenhum dia de jogo existente muda de comportamento.
 */
import { describe, it, expect } from 'vitest';
import {
  generateMexicanoSchedule,
  kingOfCourtFirstRound,
  kingOfCourtNextRound,
} from './gameDayFormats.js';

/** 12 atletas de 2.5 a 5.8, do mais forte ao mais fraco. */
const IDS = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
const NIVEIS = IDS.reduce((acc, id, i) => {
  acc[id] = 5.8 - i * 0.3;
  return acc;
}, {});

const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Diferença média de nível entre os dois lados de cada jogo. */
function desequilibrioMedio(jogos, niveis) {
  const difs = jogos.map((g) => {
    const a = media(g.side_a.map((id) => niveis[id]));
    const b = media(g.side_b.map((id) => niveis[id]));
    return Math.abs(a - b);
  });
  return media(difs);
}

describe('Mexicano com níveis', () => {
  it('não muda nada quando `levels` não é informado', () => {
    const semOpcao = generateMexicanoSchedule(IDS, { rounds: 4, seed: 's' });
    const comNull = generateMexicanoSchedule(IDS, { rounds: 4, seed: 's', levels: null });
    const comVazio = generateMexicanoSchedule(IDS, { rounds: 4, seed: 's', levels: {} });
    expect(comNull).toEqual(semOpcao);
    expect(comVazio).toEqual(semOpcao);
  });

  it('ignora um mapa de níveis sem nenhum valor utilizável', () => {
    const base = generateMexicanoSchedule(IDS, { rounds: 3, seed: 's' });
    const lixo = generateMexicanoSchedule(IDS, {
      rounds: 3, seed: 's', levels: { p1: null, p2: '', p3: 'abc' },
    });
    expect(lixo).toEqual(base);
  });

  it('equilibra as duplas dentro de cada quadra', () => {
    const sem = generateMexicanoSchedule(IDS, { rounds: 6, seed: 'mex' });
    const com = generateMexicanoSchedule(IDS, { rounds: 6, seed: 'mex', levels: NIVEIS });
    expect(desequilibrioMedio(com, NIVEIS)).toBeLessThan(desequilibrioMedio(sem, NIVEIS));
  });

  it('mantém a MESMA composição de quadras e quem descansa', () => {
    const sem = generateMexicanoSchedule(IDS, { rounds: 5, seed: 'mex' });
    const com = generateMexicanoSchedule(IDS, { rounds: 5, seed: 'mex', levels: NIVEIS });
    expect(com).toHaveLength(sem.length);
    com.forEach((g, i) => {
      const quatroSem = [...sem[i].side_a, ...sem[i].side_b].sort();
      const quatroCom = [...g.side_a, ...g.side_b].sort();
      expect(g.round).toBe(sem[i].round);
      expect(g.court).toBe(sem[i].court);
      // O grupo de quatro é idêntico: só o recorte da dupla mudou.
      expect(quatroCom).toEqual(quatroSem);
    });
  });

  it('quem não tem nível entra pela mediana, não pela ponta', () => {
    const parcial = { ...NIVEIS };
    delete parcial.p6;
    const jogos = generateMexicanoSchedule(IDS, { rounds: 4, seed: 'mex', levels: parcial });
    // Sem nível não vira "o mais fraco": o p6 nunca é sistematicamente colado
    // ao mais forte da quadra (o que aconteceria se valesse 0).
    const comOMaisForte = jogos.filter((g) => {
      const lado = g.side_a.includes('p6') ? g.side_a : (g.side_b.includes('p6') ? g.side_b : null);
      return lado && lado.includes('p1');
    });
    expect(comOMaisForte.length).toBeLessThan(jogos.filter((g) => [...g.side_a, ...g.side_b].includes('p6')).length);
  });

  it('é determinístico com a mesma semente', () => {
    const a = generateMexicanoSchedule(IDS, { rounds: 5, seed: 'x', levels: NIVEIS });
    const b = generateMexicanoSchedule(IDS, { rounds: 5, seed: 'x', levels: NIVEIS });
    expect(a).toEqual(b);
  });
});

describe('Rei da Quadra com níveis', () => {
  it('não muda nada quando `levels` não é informado', () => {
    const sem = kingOfCourtFirstRound(IDS, { seed: 'k' });
    expect(kingOfCourtFirstRound(IDS, { seed: 'k', levels: null })).toEqual(sem);
    expect(kingOfCourtFirstRound(IDS, { seed: 'k', levels: {} })).toEqual(sem);
  });

  it('escalona as quadras: a quadra 1 é a mais forte', () => {
    const jogos = kingOfCourtFirstRound(IDS, { seed: 'k', levels: NIVEIS });
    const forcaDaQuadra = jogos
      .sort((x, y) => x.court - y.court)
      .map((g) => media([...g.side_a, ...g.side_b].map((id) => NIVEIS[id])));
    for (let i = 1; i < forcaDaQuadra.length; i += 1) {
      expect(forcaDaQuadra[i]).toBeLessThanOrEqual(forcaDaQuadra[i - 1]);
    }
  });

  it('equilibra as duplas dentro de cada quadra', () => {
    const sem = kingOfCourtFirstRound(IDS, { seed: 'k' });
    const com = kingOfCourtFirstRound(IDS, { seed: 'k', levels: NIVEIS });
    expect(desequilibrioMedio(com, NIVEIS)).toBeLessThanOrEqual(desequilibrioMedio(sem, NIVEIS));
  });

  it('o nível NÃO decide quem fica de fora', () => {
    // 14 atletas, 3 quadras → 12 jogam, 2 descansam. O corte tem de continuar
    // vindo do sorteio: os dois mais fracos não podem ser sempre os cortados.
    const ids14 = Array.from({ length: 14 }, (_, i) => `q${i + 1}`);
    const niveis14 = ids14.reduce((acc, id, i) => { acc[id] = 6 - i * 0.3; return acc; }, {});
    const cortadosSempreOsMaisFracos = ['seedA', 'seedB', 'seedC', 'seedD', 'seedE'].every((seed) => {
      const jogos = kingOfCourtFirstRound(ids14, { seed, levels: niveis14 });
      const jogando = new Set(jogos.flatMap((g) => [...g.side_a, ...g.side_b]));
      return !jogando.has('q13') && !jogando.has('q14');
    });
    expect(cortadosSempreOsMaisFracos).toBe(false);
  });

  it('todo mundo que joga aparece uma única vez na rodada 1', () => {
    const jogos = kingOfCourtFirstRound(IDS, { seed: 'k', levels: NIVEIS });
    const todos = jogos.flatMap((g) => [...g.side_a, ...g.side_b]);
    expect(new Set(todos).size).toBe(todos.length);
    expect(todos).toHaveLength(12);
  });

  it('as rodadas seguintes continuam movidas pelo RESULTADO', () => {
    const r1 = kingOfCourtFirstRound(IDS, { seed: 'k', levels: NIVEIS })
      .map((g, i) => ({ ...g, score_a: i % 2 === 0 ? 11 : 7, score_b: i % 2 === 0 ? 7 : 11 }));
    const r2 = kingOfCourtNextRound(r1, { round: 2 });
    expect(r2.length).toBeGreaterThan(0);
    // A dupla vencedora da quadra 2 subiu para a quadra 1.
    const vencedoraQ2 = r1.find((g) => g.court === 2);
    const subiu = vencedoraQ2.score_a > vencedoraQ2.score_b ? vencedoraQ2.side_a : vencedoraQ2.side_b;
    const quadra1 = r2.filter((g) => g.court === 1).flatMap((g) => [...g.side_a, ...g.side_b]);
    subiu.forEach((id) => expect(quadra1).toContain(id));
  });
});
