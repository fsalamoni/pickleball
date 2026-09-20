import { describe, it, expect } from 'vitest';
import {
  rankByOfficialCriteria, buildHeadToHead, miniTable, balanceOf, TIEBREAK_CRITERIA,
  DEFAULT_TIEBREAK_ORDER, TIEBREAK_PRESETS, normalizeTiebreakOrder, describeTiebreakOrder,
} from './tiebreak.js';

/** Jogo simplificado: `a` venceu `b` por `pa`×`pb`. */
const jogo = (a, b, pa, pb) => ({ a, b, pa, pb });

const adapters = {
  sideIds: (m, side) => [side === 'a' ? m.a : m.b],
  result: (m) => ({ winner: m.pa > m.pb ? 'a' : 'b', pointsA: m.pa, pointsB: m.pb }),
};

const h2h = (jogos) => buildHeadToHead(jogos, adapters);

const linha = (id, wins, pf, pa) => ({
  participant_id: id, wins, points_for: pf, points_against: pa,
});

const ordem = (rows, jogos) => rankByOfficialCriteria(rows, {
  headToHead: jogos ? h2h(jogos) : null,
}).map((r) => r.participant_id);

describe('sem confronto direto: a conta antiga, bit a bit', () => {
  it('vitórias → saldo → pontos a favor → pontos sofridos', () => {
    const rows = [
      linha('c', 1, 30, 40),
      linha('a', 2, 50, 30),
      linha('b', 2, 45, 30),
    ];
    expect(ordem(rows)).toEqual(['a', 'b', 'c']);
  });

  it('empate em vitórias e saldo → mais pontos a favor', () => {
    const rows = [linha('x', 1, 20, 15), linha('y', 1, 30, 25)];
    expect(ordem(rows)).toEqual(['y', 'x']);
  });

  it('empate até os pontos a favor → menos pontos sofridos', () => {
    const rows = [linha('x', 1, 30, 25), linha('y', 1, 30, 20)];
    expect(ordem(rows)).toEqual(['y', 'x']);
  });

  it('empate absoluto preserva a ordem de entrada (classificação estável)', () => {
    const rows = [linha('x', 1, 30, 20), linha('y', 1, 30, 20)];
    expect(ordem(rows)).toEqual(['x', 'y']);
    expect(ordem([rows[1], rows[0]])).toEqual(['y', 'x']);
  });
});

describe('⭐ confronto direto: "mas eu ganhei dele"', () => {
  it('⭐ quem venceu o confronto passa à frente, mesmo com saldo geral pior', () => {
    // A e B empatados em vitórias. B tem saldo geral melhor (+20 × +5),
    // mas A ganhou de B em quadra. Pelo regulamento, A fica à frente.
    const rows = [linha('a', 2, 40, 35), linha('b', 2, 45, 25)];
    const jogos = [jogo('a', 'b', 11, 9)];
    expect(ordem(rows, jogos)).toEqual(['a', 'b']);
    // Sem os jogos em mãos, a conta antiga (saldo) continua valendo.
    expect(ordem(rows)).toEqual(['b', 'a']);
  });

  it('o confronto direto só vale entre EMPATADOS em vitórias', () => {
    // B ganhou de A, mas A tem uma vitória a mais: A fica à frente.
    const rows = [linha('a', 3, 40, 35), linha('b', 2, 45, 25)];
    expect(ordem(rows, [jogo('b', 'a', 11, 5)])).toEqual(['a', 'b']);
  });

  it('quem não se enfrentou: o critério é PULADO, não inventado', () => {
    // Nenhum jogo entre A e B (grupo interrompido). Decide o saldo geral.
    const rows = [linha('a', 2, 40, 35), linha('b', 2, 45, 25)];
    expect(ordem(rows, [jogo('c', 'd', 11, 3)])).toEqual(['b', 'a']);
  });
});

describe('⭐ empate de TRÊS: a mini-tabela', () => {
  it('⭐ separa pelas vitórias ENTRE os empatados', () => {
    // Triangular: A ganhou de B e de C; B ganhou de C; C perdeu as duas.
    // Na mini-tabela: A=2, B=1, C=0 — e é essa a ordem, não a do saldo geral.
    const rows = [
      linha('c', 2, 60, 40), // melhor saldo geral (+20), mas pior na mini-tabela
      linha('b', 2, 50, 45),
      linha('a', 2, 48, 46),
    ];
    const jogos = [
      jogo('a', 'b', 11, 9),
      jogo('a', 'c', 11, 8),
      jogo('b', 'c', 11, 7),
    ];
    expect(ordem(rows, jogos)).toEqual(['a', 'b', 'c']);
  });

  it('⭐ empate MENOR é empate NOVO: os dois que sobram voltam ao confronto direto', () => {
    // A ganhou de B e C. B e C empatam na mini-tabela dos três (1 vitória cada
    // — cada um ganhou de um). Entre B e C, quem ganhou foi C: C fica à
    // frente, ainda que B tenha saldo geral melhor.
    const rows = [
      linha('a', 3, 60, 30),
      linha('b', 2, 50, 30), // saldo +20
      linha('c', 2, 44, 40), // saldo +4, mas ganhou de B
    ];
    const jogos = [
      jogo('a', 'b', 11, 5),
      jogo('a', 'c', 11, 6),
      jogo('c', 'b', 11, 9),
    ];
    expect(ordem(rows, jogos)).toEqual(['a', 'c', 'b']);
  });

  it('triangular perfeito (todos 1-1) cai no saldo geral', () => {
    const rows = [
      linha('a', 1, 30, 28),
      linha('b', 1, 30, 25),
      linha('c', 1, 30, 30),
    ];
    const jogos = [
      jogo('a', 'b', 11, 9),
      jogo('b', 'c', 11, 9),
      jogo('c', 'a', 11, 9),
    ];
    expect(ordem(rows, jogos)).toEqual(['b', 'a', 'c']);
  });

  it('saldo no confronto direto desempata quando as vitórias diretas empatam', () => {
    // A e B: uma vitória cada no recorte, mesmo saldo GERAL. Decide o saldo
    // DENTRO do confronto direto.
    const rows = [linha('a', 1, 40, 30), linha('b', 1, 40, 30)];
    const jogos = [jogo('a', 'b', 11, 2), jogo('b', 'a', 11, 9)];
    expect(ordem(rows, jogos)).toEqual(['a', 'b']);
  });
});

describe('miniTable', () => {
  it('conta só o que aconteceu DENTRO do recorte', () => {
    const jogos = [jogo('a', 'b', 11, 5), jogo('a', 'z', 11, 0)];
    const t = miniTable(['a', 'b'], h2h(jogos));
    expect(t.get('a')).toEqual({ wins: 1, balance: 6, played: 1 });
    expect(t.get('b')).toEqual({ wins: 0, balance: -6, played: 1 });
    // O 11×0 contra 'z' não entra: 'z' está fora do recorte.
  });

  it('quem não jogou contra ninguém do recorte tem played 0', () => {
    const t = miniTable(['a', 'b'], h2h([jogo('a', 'z', 11, 0)]));
    expect(t.get('b').played).toBe(0);
  });
});

describe('robustez', () => {
  it('lista vazia ou de um só não quebra', () => {
    expect(rankByOfficialCriteria([])).toEqual([]);
    expect(rankByOfficialCriteria([linha('a', 1, 2, 3)]).map((r) => r.participant_id)).toEqual(['a']);
    expect(rankByOfficialCriteria(null)).toEqual([]);
  });

  it('jogo sem vencedor não entra no confronto direto', () => {
    const semVencedor = buildHeadToHead([{ a: 'x', b: 'y' }], {
      sideIds: (m, side) => [side === 'a' ? m.a : m.b],
      result: () => null,
    });
    expect(semVencedor.size).toBe(0);
  });

  it('duplas: o confronto vale para os dois lados inteiros', () => {
    const t = buildHeadToHead([{ a: ['p1', 'p2'], b: ['p3', 'p4'], pa: 11, pb: 5 }], {
      sideIds: (m, side) => (side === 'a' ? m.a : m.b),
      result: (m) => ({ winner: 'a', pointsA: m.pa, pointsB: m.pb }),
    });
    expect(t.get('p1|p3').wins).toBe(1);
    expect(t.get('p2|p4').wins).toBe(1);
    expect(t.get('p3|p1').wins).toBe(0);
    expect(t.get('p3|p1').points_for).toBe(5);
  });

  it('balanceOf trata campo ausente como zero', () => {
    expect(balanceOf({ points_for: 10 })).toBe(10);
    expect(balanceOf({})).toBe(0);
    expect(balanceOf(null)).toBe(0);
  });

  it('a ordem PADRÃO é a do regulamento', () => {
    expect(DEFAULT_TIEBREAK_ORDER).toEqual([
      'wins', 'head_to_head', 'balance', 'head_to_head_balance', 'points_for', 'points_against',
    ]);
  });

  it('todo critério do catálogo tem rótulo e explicação', () => {
    TIEBREAK_CRITERIA.forEach((c) => {
      expect(c.key, JSON.stringify(c)).toBeTruthy();
      expect(c.label, c.key).toBeTruthy();
      expect(c.help?.length, c.key).toBeGreaterThan(20);
    });
  });

  it('todo preset usa só critérios que existem, e explica a escolha', () => {
    const validas = new Set(TIEBREAK_CRITERIA.map((c) => c.key));
    TIEBREAK_PRESETS.forEach((p) => {
      expect(p.order.length, p.id).toBeGreaterThan(0);
      p.order.forEach((k) => expect(validas.has(k), `${p.id}: ${k}`).toBe(true));
      expect(p.help?.length, p.id).toBeGreaterThan(20);
    });
  });
});

describe('⭐ a ordem dos critérios é do ORGANIZADOR', () => {
  const linha = (id, extra) => ({ participant_id: id, played: 3, ...extra });
  const ordenar = (rows, order, jogos) => rankByOfficialCriteria(rows, {
    order,
    headToHead: jogos
      ? buildHeadToHead(jogos, {
        sideIds: (m, side) => [side === 'a' ? m.a : m.b],
        result: (m) => ({ winner: m.pa > m.pb ? 'a' : 'b', pointsA: m.pa, pointsB: m.pb }),
      })
      : null,
  }).map((r) => r.participant_id);

  it('⭐ "saldo antes do confronto direto" inverte o resultado, como pedido', () => {
    const rows = [
      linha('a', { wins: 2, points_for: 40, points_against: 35 }),
      linha('b', { wins: 2, points_for: 45, points_against: 25 }),
    ];
    const jogos = [{ a: 'a', b: 'b', pa: 11, pb: 9 }];
    // Oficial: A ganhou de B → A na frente.
    expect(ordenar(rows, undefined, jogos)).toEqual(['a', 'b']);
    // Escolhendo saldo antes: B, que tem saldo melhor.
    expect(ordenar(rows, ['wins', 'balance', 'head_to_head'], jogos)).toEqual(['b', 'a']);
  });

  it('⭐ "confronto direto acima de tudo" ignora a vitória a mais', () => {
    const rows = [
      linha('a', { wins: 3, points_for: 40, points_against: 35 }),
      linha('b', { wins: 2, points_for: 45, points_against: 25 }),
    ];
    const jogos = [{ a: 'b', b: 'a', pa: 11, pb: 5 }];
    expect(ordenar(rows, ['wins', 'head_to_head'], jogos)).toEqual(['a', 'b']);
    expect(ordenar(rows, ['head_to_head', 'wins'], jogos)).toEqual(['b', 'a']);
  });

  it('⭐ aproveitamento resolve o grupo em que alguém jogou menos', () => {
    // A: 3 de 5 (60%). B: 2 de 3 (67%). Em vitórias absolutas A ganha.
    const rows = [
      { participant_id: 'a', wins: 3, played: 5, points_for: 50, points_against: 45 },
      { participant_id: 'b', wins: 2, played: 3, points_for: 30, points_against: 25 },
    ];
    expect(ordenar(rows, ['wins'])).toEqual(['a', 'b']);
    expect(ordenar(rows, ['win_rate'])).toEqual(['b', 'a']);
  });

  it('saldo por partida e saldo de games existem e funcionam', () => {
    const rows = [
      { participant_id: 'a', wins: 1, played: 4, points_for: 44, points_against: 40, sets_won: 4, sets_lost: 4 },
      { participant_id: 'b', wins: 1, played: 2, points_for: 24, points_against: 20, sets_won: 3, sets_lost: 1 },
    ];
    expect(ordenar(rows, ['balance_rate'])).toEqual(['b', 'a']);
    expect(ordenar(rows, ['sets'])).toEqual(['b', 'a']);
  });

  it('ordem vazia, nula ou com lixo cai na oficial', () => {
    expect(normalizeTiebreakOrder([])).toEqual([...DEFAULT_TIEBREAK_ORDER]);
    expect(normalizeTiebreakOrder(null)).toEqual([...DEFAULT_TIEBREAK_ORDER]);
    expect(normalizeTiebreakOrder(['inexistente'])).toEqual([...DEFAULT_TIEBREAK_ORDER]);
  });

  it('critério repetido entra uma vez só', () => {
    expect(normalizeTiebreakOrder(['wins', 'wins', 'balance'])).toEqual(['wins', 'balance']);
  });

  it('critério desconhecido no meio é descartado, o resto vale', () => {
    expect(normalizeTiebreakOrder(['wins', 'xpto', 'balance'])).toEqual(['wins', 'balance']);
  });

  it('describeTiebreakOrder devolve a ordem numerada e explicada, para a tela', () => {
    const d = describeTiebreakOrder(['wins', 'head_to_head']);
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ position: 1, key: 'wins' });
    expect(d[1].help.length).toBeGreaterThan(20);
  });

  it('a ordem escolhida não quebra a estabilidade', () => {
    const rows = [linha('x', { wins: 1, points_for: 30, points_against: 20 }), linha('y', { wins: 1, points_for: 30, points_against: 20 })];
    expect(ordenar(rows, ['wins', 'balance'])).toEqual(['x', 'y']);
    expect(ordenar([rows[1], rows[0]], ['wins', 'balance'])).toEqual(['y', 'x']);
  });
});
