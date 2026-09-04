import { describe, it, expect } from 'vitest';
import {
  generateGameDayGames, suggestRounds, buildDrawHistory, normalizeDrawCourts,
} from './gameDayDraw.js';

const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function counts(games) {
  const played = new Map();
  const partners = new Map();
  const opps = new Map();
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const g of games) {
    [...g.side_a, ...g.side_b].forEach((p) => played.set(p, (played.get(p) || 0) + 1));
    partners.set(key(...g.side_a), (partners.get(key(...g.side_a)) || 0) + 1);
    partners.set(key(...g.side_b), (partners.get(key(...g.side_b)) || 0) + 1);
    for (const x of g.side_a) for (const y of g.side_b) opps.set(key(x, y), (opps.get(key(x, y)) || 0) + 1);
  }
  return { played, partners, opps };
}

describe('gameDayDraw', () => {
  it('exige no mínimo 4 participantes', () => {
    expect(() => generateGameDayGames(['a', 'b', 'c'])).toThrow();
  });

  it('é determinístico para a mesma seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const g1 = generateGameDayGames(ids, { rounds: 5, seed: 's1' });
    const g2 = generateGameDayGames(ids, { rounds: 5, seed: 's1' });
    expect(g1).toEqual(g2);
  });

  it('gera 4 jogadores distintos por jogo', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const games = generateGameDayGames(ids, { rounds: 6, seed: 'x' });
    for (const g of games) {
      const players = [...g.side_a, ...g.side_b];
      expect(new Set(players).size).toBe(4);
    }
  });

  it('funciona com N não múltiplo/condizente do Americano (ex.: 7) equilibrando participação', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const games = generateGameDayGames(ids, { rounds: 7, seed: 'z' });
    const { played } = counts(games);
    const values = ids.map((id) => played.get(id) || 0);
    // Equilíbrio: diferença entre quem mais e quem menos jogou é pequena.
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });

  it('prioriza parcerias inéditas antes de repetir (8 jogadores, 7 rodadas)', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const games = generateGameDayGames(ids, { rounds: 7, seed: 'k' });
    const { partners } = counts(games);
    // Com 8 jogadores há 28 duplas possíveis e 7*2 = 14 duplas usadas: deve
    // ser possível não repetir nenhuma dupla.
    const maxPartner = Math.max(...Array.from(partners.values()));
    expect(maxPartner).toBe(1);
  });

  it('suggestRounds retorna valor prático', () => {
    expect(suggestRounds(3)).toBe(0);
    expect(suggestRounds(8)).toBeGreaterThanOrEqual(3);
    expect(suggestRounds(100)).toBeLessThanOrEqual(12);
  });
});

describe('gameDayDraw — sorteio ciente do histórico (aditivo)', () => {
  it('buildDrawHistory conta duplas, adversários, jogos e rodadas presentes (ignora quem saiu)', () => {
    const kept = [
      { round: 1, side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }], score_a: 11, score_b: 7 },
      { round: 2, side_a: [{ id: 'a' }, { id: 'c' }], side_b: [{ id: 'b' }, { id: 'e' }], score_a: 9, score_b: 11 },
    ];
    const h = buildDrawHistory(kept, ['a', 'b', 'c', 'd']); // 'e' saiu do dia

    // Duplas: (a,b) e (c,d) na r1; (a,c) na r2. (b,e) é ignorado (e saiu).
    expect(h.partner.get(key('a', 'b'))).toBe(1);
    expect(h.partner.get(key('c', 'd'))).toBe(1);
    expect(h.partner.get(key('a', 'c'))).toBe(1);
    expect(h.partner.get(key('b', 'e'))).toBeUndefined();

    // Adversários: a-c na r1; a-b e b-c na r2 (confrontos com 'e' ignorados).
    expect(h.opp.get(key('a', 'c'))).toBe(1);
    expect(h.opp.get(key('a', 'b'))).toBe(1);
    expect(h.opp.get(key('a', 'e'))).toBeUndefined();

    // Partidas: a/b/c jogaram 2, d jogou 1; 'e' não entra.
    expect(h.played.get('a')).toBe(2);
    expect(h.played.get('d')).toBe(1);
    expect(h.played.has('e')).toBe(false);

    // Rodadas presentes: todos entraram na r1 → 2 rodadas existentes.
    expect(h.present.get('a')).toBe(2);
    expect(h.present.get('d')).toBe(2);
  });

  it('buildDrawHistory usa a rodada de entrada como momento de inserção', () => {
    const kept = [
      { round: 1, side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }], score_a: 11, score_b: 5 },
      { round: 2, side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }], score_a: 11, score_b: 6 },
      { round: 3, side_a: [{ id: 'a' }, { id: 'e' }], side_b: [{ id: 'c' }, { id: 'd' }], score_a: 11, score_b: 8 },
    ];
    const h = buildDrawHistory(kept, ['a', 'b', 'c', 'd', 'e']);
    // 'e' só aparece na r3: presente em 1 rodada (a partir da entrada).
    expect(h.present.get('e')).toBe(1);
    expect(h.played.get('e')).toBe(1);
    // Veteranos entraram na r1: presentes nas 3 rodadas.
    expect(h.present.get('a')).toBe(3);
  });

  it('histórico vazio equivale a sortear sem histórico (determinismo preservado)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const noHistory = generateGameDayGames(ids, { rounds: 5, seed: 's' });
    const emptyHistory = generateGameDayGames(ids, { rounds: 5, seed: 's', history: buildDrawHistory([], ids) });
    expect(emptyHistory).toEqual(noHistory);
  });

  it('evita repetir duplas já formadas no dia', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const kept = [
      { round: 1, side_a: [{ id: 'p0' }, { id: 'p1' }], side_b: [{ id: 'p2' }, { id: 'p3' }], score_a: 11, score_b: 6 },
    ];
    const history = buildDrawHistory(kept, ids);
    const games = generateGameDayGames(ids, { rounds: 4, seed: 'avoid', history });
    const { partners } = counts(games);
    // A dupla p0-p1 já ocorreu: não deve se repetir nas novas rodadas
    // (há 27 outras duplas possíveis).
    expect(partners.get(key('p0', 'p1')) || 0).toBe(0);
  });

  it('prioriza quem está atrás na taxa de participação (equilíbrio por rodada presente)', () => {
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
    // p0 muito atrás: 0 jogos em 10 rodadas presentes; os demais 8 em 10.
    // Espelha a queixa do usuário (quem ficou o tempo todo jogando pouco deve
    // ser priorizado), mas normalizado pela taxa (não força o total).
    const history = {
      partner: new Map(),
      opp: new Map(),
      played: new Map([['p0', 0], ['p1', 8], ['p2', 8], ['p3', 8], ['p4', 8]]),
      present: new Map([['p0', 10], ['p1', 10], ['p2', 10], ['p3', 10], ['p4', 10]]),
    };
    const rounds = 5;
    const games = generateGameDayGames(ids, { rounds, seed: 'hist', history });
    const { played } = counts(games);
    // Com 5 jogadores há 1 quadra por rodada: exatamente 1 descansa por rodada.
    // p0 (mais atrás) joga TODAS as rodadas; nenhum dos demais joga todas.
    expect(played.get('p0')).toBe(rounds);
    ['p1', 'p2', 'p3', 'p4'].forEach((id) => {
      expect(played.get(id) || 0).toBeLessThan(rounds);
    });
  });

  it('não força quem entrou tarde a igualar o total de quem entrou cedo', () => {
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
    // p4 entrou tarde: presente só em 2 rodadas, jogou 1 (taxa 0,5, na média).
    // Os veteranos: presentes em 10, jogaram ~5 (taxa 0,5). Ninguém "atrás".
    const history = {
      partner: new Map(),
      opp: new Map(),
      played: new Map([['p0', 5], ['p1', 5], ['p2', 5], ['p3', 5], ['p4', 1]]),
      present: new Map([['p0', 10], ['p1', 10], ['p2', 10], ['p3', 10], ['p4', 2]]),
    };
    const rounds = 5;
    const games = generateGameDayGames(ids, { rounds, seed: 'late', history });
    const { played } = counts(games);
    // p4 está na média (taxa 0,5), não abaixo: não deve monopolizar as quadras
    // para "alcançar" o total dos veteranos. Recebe participação equilibrada.
    expect(played.get('p4') || 0).toBeLessThan(rounds);
  });
});

describe('gameDayDraw — quadras disponíveis (fila justa)', () => {
  const ids12 = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
  const inRound = (games, r) => games.filter((g) => g.round === r);
  const playersOf = (games, r) => inRound(games, r).flatMap((g) => [...g.side_a, ...g.side_b]);

  it('sem informar quadras, mantém o comportamento histórico (todos jogam)', () => {
    const games = generateGameDayGames(ids12, { rounds: 4, seed: 'x' });
    for (let r = 1; r <= 4; r += 1) {
      expect(inRound(games, r)).toHaveLength(3); // 12/4 = 3 quadras
      expect(new Set(playersOf(games, r)).size).toBe(12);
    }
  });

  it('informar o máximo de quadras não altera o sorteio', () => {
    const auto = generateGameDayGames(ids12, { rounds: 4, seed: 'x' });
    const max = generateGameDayGames(ids12, { rounds: 4, seed: 'x', courts: 3 });
    expect(max).toEqual(auto);
  });

  it('12 atletas em 2 quadras: 2 jogos por rodada, 8 em quadra e 4 aguardando', () => {
    const games = generateGameDayGames(ids12, { rounds: 6, seed: 'q2', courts: 2 });
    for (let r = 1; r <= 6; r += 1) {
      expect(inRound(games, r)).toHaveLength(2);
      const emQuadra = playersOf(games, r);
      expect(emQuadra).toHaveLength(8);
      expect(new Set(emQuadra).size).toBe(8); // ninguém joga 2x na mesma rodada
    }
  });

  it('quem ficou de fora entra na rodada seguinte, com 4 dos que jogaram', () => {
    const games = generateGameDayGames(ids12, { rounds: 2, seed: 'fila', courts: 2 });
    const r1 = new Set(playersOf(games, 1));
    const foraR1 = ids12.filter((id) => !r1.has(id));
    expect(foraR1).toHaveLength(4);

    const r2 = new Set(playersOf(games, 2));
    foraR1.forEach((id) => expect(r2.has(id)).toBe(true)); // todos os 4 entram
    expect([...r2].filter((id) => r1.has(id))).toHaveLength(4); // + 4 dos 8
  });

  it('mantém a distribuição de jogos equilibrada ao longo do dia', () => {
    const games = generateGameDayGames(ids12, { rounds: 9, seed: 'eq', courts: 2 });
    const { played } = counts(games);
    const totais = ids12.map((id) => played.get(id) || 0);
    expect(Math.max(...totais) - Math.min(...totais)).toBeLessThanOrEqual(1);
  });

  it('quadras acima do possível são limitadas pelo nº de atletas', () => {
    const games = generateGameDayGames(ids12, { rounds: 2, seed: 'cap', courts: 10 });
    expect(inRound(games, 1)).toHaveLength(3);
  });

  it('valores inválidos de quadras caem no automático', () => {
    const base = generateGameDayGames(ids12, { rounds: 3, seed: 'inv' });
    [0, -2, null, undefined, 'x', NaN].forEach((v) => {
      expect(generateGameDayGames(ids12, { rounds: 3, seed: 'inv', courts: v })).toEqual(base);
    });
  });

  it('funciona com N não múltiplo de 4 (13 atletas em 2 quadras)', () => {
    const ids13 = Array.from({ length: 13 }, (_, i) => `q${i + 1}`);
    const games = generateGameDayGames(ids13, { rounds: 8, seed: 'n13', courts: 2 });
    for (let r = 1; r <= 8; r += 1) expect(inRound(games, r)).toHaveLength(2);
    const { played } = counts(games);
    const totais = ids13.map((id) => played.get(id) || 0);
    expect(Math.max(...totais) - Math.min(...totais)).toBeLessThanOrEqual(1);
  });

  it('suggestRounds: sem quadras mantém o histórico; com fila, escala', () => {
    expect(suggestRounds(12)).toBe(11);
    expect(suggestRounds(12, 3)).toBe(11); // 3 quadras: sem redução
    expect(suggestRounds(12, 2)).toBeGreaterThan(11); // fila → mais rodadas
    expect(suggestRounds(12, 2)).toBeLessThanOrEqual(30);
  });

  it('normalizeDrawCourts respeita o teto de grupos de 4', () => {
    expect(normalizeDrawCourts(2, 3)).toBe(2);
    expect(normalizeDrawCourts(9, 3)).toBe(3);
    expect(normalizeDrawCourts(0, 3)).toBe(3);
    expect(normalizeDrawCourts(null, 3)).toBe(3);
  });
});

describe('gameDayDraw — memória de formações no re-sorteio', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const mk = (round, sa, sb) => ({
    round, side_a: sa.map((id) => ({ id })), side_b: sb.map((id) => ({ id })),
  });

  it('formationGames lembra as duplas mesmo com os jogos substituídos', () => {
    const anteriores = [mk(1, ['a', 'b'], ['c', 'd']), mk(1, ['e', 'f'], ['g', 'h'])];
    const hist = buildDrawHistory([], ids, { formationGames: anteriores });
    expect(hist.partner.get(key('a', 'b'))).toBe(1);
    expect(hist.partner.get(key('e', 'f'))).toBe(1);
    expect(hist.opp.get(key('a', 'c'))).toBe(1);
    // Os jogos foram substituídos: não contam participação.
    expect(hist.played.size).toBe(0);
  });

  it('participação vem só dos mantidos; formações vêm de todos', () => {
    const mantido = mk(1, ['a', 'b'], ['c', 'd']);
    const substituido = mk(2, ['e', 'f'], ['g', 'h']);
    const hist = buildDrawHistory([mantido], ids, { formationGames: [mantido, substituido] });
    expect(hist.played.get('a')).toBe(1);
    expect(hist.played.get('e')).toBeUndefined(); // não jogou de fato
    expect(hist.partner.get(key('e', 'f'))).toBe(1); // mas a dupla é lembrada
  });

  it('sem options, o comportamento é idêntico ao anterior', () => {
    const g = [mk(1, ['a', 'b'], ['c', 'd'])];
    const antes = buildDrawHistory(g, ids);
    const comDefault = buildDrawHistory(g, ids, {});
    expect([...comDefault.partner.entries()]).toEqual([...antes.partner.entries()]);
    expect([...comDefault.opp.entries()]).toEqual([...antes.opp.entries()]);
    expect([...comDefault.played.entries()]).toEqual([...antes.played.entries()]);
  });

  it('o novo sorteio não repete as duplas que foram substituídas', () => {
    const ids12 = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
    const primeiro = generateGameDayGames(ids12, { rounds: 2, seed: 'r1', courts: 2 });
    const comoJogos = primeiro.map((g) => ({
      round: g.round,
      side_a: g.side_a.map((id) => ({ id })),
      side_b: g.side_b.map((id) => ({ id })),
    }));
    const hist = buildDrawHistory([], ids12, { formationGames: comoJogos });
    const novo = generateGameDayGames(ids12, { rounds: 2, seed: 'r2', courts: 2, history: hist });

    const antes = new Set();
    primeiro.forEach((g) => { antes.add(key(...g.side_a)); antes.add(key(...g.side_b)); });
    novo.forEach((g) => {
      expect(antes.has(key(...g.side_a))).toBe(false);
      expect(antes.has(key(...g.side_b))).toBe(false);
    });
  });
});
