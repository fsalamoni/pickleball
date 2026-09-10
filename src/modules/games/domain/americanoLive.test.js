import { describe, it, expect } from 'vitest';
import {
  drawNextAmericanoLiveMatch, forecastAmericanoLiveMatches, americanoLiveProgress,
  suggestAmericanoLiveTotal, respectsFixedPairs, americanoLiveView, gameIds,
  AMERICANO_LIVE_WINDOW_EXTRA,
} from './americanoLive.js';

/** Participante do Play: espera crescente = mais tempo na fila. */
const P = (id, extra = {}) => ({
  id, name: id.toUpperCase(), available_since: 1000, available_tie: 0,
  skip_remaining: 0, partner_id: null, ...extra,
});
const fila = (ids) => ids.map((id, i) => P(id, { available_since: 1000 + i }));
const rng = () => 0.5; // determinístico

const jogo = (a, b, extra = {}) => ({
  side_a: a.map((id) => ({ id })), side_b: b.map((id) => ({ id })),
  status: 'finished', ...extra,
});

describe('suggestAmericanoLiveTotal', () => {
  it('⭐ n(n-1)/4 — cobre parcerias E confrontos duplos com o mesmo número', () => {
    // 8 atletas: C(8,2)=28 duplas possíveis, 2 por jogo → 14 jogos.
    expect(suggestAmericanoLiveTotal(8)).toBe(14);
    expect(suggestAmericanoLiveTotal(12)).toBe(33);
  });
  it('menos de 4 não gera partida nenhuma', () => {
    expect(suggestAmericanoLiveTotal(3)).toBe(0);
    expect(suggestAmericanoLiveTotal(0)).toBe(0);
  });
});

describe('drawNextAmericanoLiveMatch — quem entra', () => {
  it('⭐ o PRIMEIRO da fila entra sempre', () => {
    // Sem esta garantia, a busca por variedade pularia alguém indefinidamente.
    for (let i = 0; i < 20; i += 1) {
      const escolha = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), {
        games: [], rng: () => i / 20,
      });
      expect(escolha.ids).toContain('a');
    }
  });

  it('devolve 4 jogadores, dois de cada lado, sem repetir ninguém', () => {
    const e = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c', 'd', 'e', 'f']), { rng });
    expect(e.ids).toHaveLength(4);
    expect(e.side_a).toHaveLength(2);
    expect(e.side_b).toHaveLength(2);
    expect(new Set([...e.side_a, ...e.side_b]).size).toBe(4);
  });

  it('menos de 4 disponíveis → não há partida', () => {
    expect(drawNextAmericanoLiveMatch(fila(['a', 'b', 'c']), { rng })).toBeNull();
    expect(drawNextAmericanoLiveMatch([], { rng })).toBeNull();
  });

  it('⭐ NUNCA chama alguém de fora da janela', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
    const e = drawNextAmericanoLiveMatch(fila(ids), { rng });
    const limite = 4 + AMERICANO_LIVE_WINDOW_EXTRA;
    e.ids.forEach((id) => {
      expect(ids.indexOf(id)).toBeLessThan(limite);
    });
  });
});

describe('drawNextAmericanoLiveMatch — usa o motor do Americano', () => {
  it('⭐ evita repetir uma DUPLA que já jogou junta', () => {
    // a e b já foram dupla. Com c,d,e,f disponíveis, o motor deve preferir
    // separar a e b em vez de repeti-los.
    const historico = [jogo(['a', 'b'], ['c', 'd'])];
    let repetiu = 0;
    for (let i = 0; i < 12; i += 1) {
      const e = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c', 'd', 'e', 'f']), {
        games: historico, rng: () => i / 12,
      });
      const juntos = (lado) => lado.includes('a') && lado.includes('b');
      if (juntos(e.side_a) || juntos(e.side_b)) repetiu += 1;
    }
    expect(repetiu).toBe(0);
  });

  it('⭐ com histórico vazio, forma duplas variadas ao longo de vários sorteios', () => {
    const vistas = new Set();
    const historico = [];
    for (let i = 0; i < 6; i += 1) {
      const e = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), {
        games: historico, rng: () => (i * 7 % 11) / 11,
      });
      [e.side_a, e.side_b].forEach((l) => vistas.add([...l].sort().join('|')));
      historico.push(jogo(e.side_a, e.side_b));
    }
    // 6 sorteios × 2 duplas = 12 duplas; esperamos variedade alta.
    expect(vistas.size).toBeGreaterThanOrEqual(10);
  });

  it('o nível equilibra os lados quando conhecido', () => {
    const levels = { a: 5.0, b: 5.0, c: 3.0, d: 3.0 };
    const e = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c', 'd']), { levels, rng });
    const media = (l) => l.reduce((s, id) => s + levels[id], 0) / 2;
    expect(Math.abs(media(e.side_a) - media(e.side_b))).toBeLessThanOrEqual(1);
  });
});

describe('duplas fixas', () => {
  it('⭐ dupla fixa entra JUNTA ou não entra', () => {
    const lista = [
      P('a', { available_since: 1000, partner_id: 'b' }),
      P('b', { available_since: 1001, partner_id: 'a' }),
      P('c', { available_since: 1002 }),
      P('d', { available_since: 1003 }),
      P('e', { available_since: 1004 }),
      P('f', { available_since: 1005 }),
    ];
    for (let i = 0; i < 10; i += 1) {
      const e = drawNextAmericanoLiveMatch(lista, { rng: () => i / 10 });
      expect(e.ids.includes('a')).toBe(e.ids.includes('b'));
      // E ficam do MESMO lado? Não necessariamente — dupla fixa garante entrar
      // junto; o lado é decisão do motor. Documentado no domínio.
    }
  });

  it('⭐ quem tem parceiro INDISPONÍVEL aguarda, não entra sozinho', () => {
    const lista = [
      P('a', { available_since: 1000, partner_id: 'zz' }), // zz não está na fila
      P('c', { available_since: 1002 }),
      P('d', { available_since: 1003 }),
      P('e', { available_since: 1004 }),
      P('f', { available_since: 1005 }),
    ];
    const e = drawNextAmericanoLiveMatch(lista, { rng });
    expect(e.ids).not.toContain('a');
  });

  it('respectsFixedPairs julga o conjunto corretamente', () => {
    const lista = [
      P('a', { partner_id: 'b' }), P('b', { partner_id: 'a' }),
      P('c'), P('d'), P('e'),
    ];
    expect(respectsFixedPairs(['a', 'b', 'c', 'd'], lista)).toBe(true);
    expect(respectsFixedPairs(['a', 'c', 'd', 'e'], lista)).toBe(false);
    expect(respectsFixedPairs(['c', 'd', 'e', 'b'], lista)).toBe(false);
  });
});

describe('ninguém em duas quadras ao mesmo tempo', () => {
  it('⭐ quem está EM QUADRA não aparece na fila nem no próximo sorteio', () => {
    const participantes = fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const emQuadra = [{
      id: 'g1', court: 1, status: 'open',
      side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }],
    }];
    const view = americanoLiveView({ participants: participantes, games: emQuadra });
    const idsNaFila = view.order.map((p) => p.id);
    ['a', 'b', 'c', 'd'].forEach((id) => expect(idsNaFila).not.toContain(id));

    const e = drawNextAmericanoLiveMatch(view.order, { games: emQuadra, rng });
    expect(e.ids.sort()).toEqual(['e', 'f', 'g', 'h']);
  });

  it('quem está pausado também fica de fora', () => {
    const participantes = [
      ...fila(['a', 'b', 'c', 'd']),
      P('pausado', { available_since: 999, skip_remaining: 2 }),
    ];
    const view = americanoLiveView({ participants: participantes, games: [] });
    expect(view.order.map((p) => p.id)).not.toContain('pausado');
  });
});

describe('forecastAmericanoLiveMatches', () => {
  it('⭐ prevê uma partida por quadra LIVRE', () => {
    const view = americanoLiveView({
      participants: fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), games: [],
    });
    const blocos = forecastAmericanoLiveMatches(view.order, { courts: 2, games: [], rng });
    expect(blocos).toHaveLength(2);
    expect(blocos.map((b) => b.court).sort()).toEqual([1, 2]);
    // Sem sobreposição entre as duas quadras.
    const todos = blocos.flatMap((b) => b.players.map((p) => p.id));
    expect(new Set(todos).size).toBe(8);
    blocos.forEach((b) => expect(b.conditional).toBe(false));
  });

  it('⭐ a previsão da quadra OCUPADA é marcada como condicional', () => {
    const games = [{
      id: 'g1', court: 1, status: 'open', created_at_ms: 1,
      side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }],
    }];
    const participantes = fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const view = americanoLiveView({ participants: participantes, games });
    const blocos = forecastAmericanoLiveMatches(view.order, { courts: 1, games, rng });
    expect(blocos).toHaveLength(1);
    expect(blocos[0].court).toBe(1);
    expect(blocos[0].conditional).toBe(true);
  });

  it('sem gente suficiente, a previsão simplesmente para', () => {
    const view = americanoLiveView({ participants: fila(['a', 'b', 'c']), games: [] });
    expect(forecastAmericanoLiveMatches(view.order, { courts: 2, games: [], rng })).toEqual([]);
  });
});

describe('americanoLiveProgress', () => {
  it('⭐ conta duplas formadas, confrontos e jogos por atleta', () => {
    const participants = fila(['a', 'b', 'c', 'd']);
    const games = [jogo(['a', 'b'], ['c', 'd']), jogo(['a', 'c'], ['b', 'd'])];
    const p = americanoLiveProgress({ participants, games });
    expect(p.participantes).toBe(4);
    expect(p.partidasCriadas).toBe(2);
    expect(p.partidasConcluidas).toBe(2);
    expect(p.partidasPrevistas).toBe(3); // 4*3/4
    expect(p.duplasFormadas).toBe(4);    // ab, cd, ac, bd
    expect(p.duplasPossiveis).toBe(6);
    expect(p.minJogos).toBe(2);
    expect(p.maxJogos).toBe(2);
  });

  it('dia vazio não quebra', () => {
    const p = americanoLiveProgress({ participants: [], games: [] });
    expect(p.partidasPrevistas).toBe(0);
    expect(p.minJogos).toBe(0);
  });
});

describe('gameIds', () => {
  it('aceita os dois formatos de lado gravados', () => {
    expect(gameIds({ side_a: [{ id: 'a' }, { id: 'b' }], side_b: ['c', 'd'] }))
      .toEqual(['a', 'b', 'c', 'd']);
    expect(gameIds(null)).toEqual([]);
  });
});

describe('previsão — nomes de quem volta da quadra', () => {
  const oito = fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  const emQuadra = [{
    id: 'g1', court: 1, status: 'open', created_at_ms: 1,
    side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }],
  }];

  it('⭐ a previsão condicional mostra NOME, não id, de quem está em quadra', () => {
    // Quem está jogando não está na fila. Sem a lista completa, a previsão da
    // quadra ocupada devolvia `{ id }` pelado e a tela imprimia o id cru.
    const emFila = oito.slice(4); // e, f, g, h

    const semNomes = forecastAmericanoLiveMatches(emFila, { courts: 2, games: emQuadra, rng });
    const condicionalSem = semNomes.find((b) => b.conditional);
    expect(condicionalSem.players.some((p) => !p.name)).toBe(true);

    const comNomes = forecastAmericanoLiveMatches(emFila, {
      courts: 2, games: emQuadra, rng, participants: oito,
    });
    const condicionalCom = comNomes.find((b) => b.conditional);
    expect(condicionalCom.players.every((p) => !!p.name)).toBe(true);
    expect(condicionalCom.players.map((p) => p.name).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('a fila continua mandando no estado: `participants` só completa o nome', () => {
    // A MESMA pessoa nas duas listas, com estados diferentes: vale a da fila,
    // que é a que carrega o estado corrente do dia.
    const participants = [P('a', { skip_remaining: 3 }), ...oito.slice(1)];
    const emFila = fila(['a', 'e', 'f', 'g']);
    const [bloco] = forecastAmericanoLiveMatches(emFila, {
      courts: 1, games: [], rng, participants,
    });
    expect(bloco.players.find((p) => p.id === 'a').skip_remaining).toBe(0);
  });

  it('sem `participants`, tudo o mais continua igual (o parâmetro só nomeia)', () => {
    const emFila = oito.slice(4);
    const sem = forecastAmericanoLiveMatches(emFila, { courts: 2, games: emQuadra, rng });
    const com = forecastAmericanoLiveMatches(emFila, {
      courts: 2, games: emQuadra, rng, participants: oito,
    });
    expect(com.map((b) => [b.court, b.conditional, b.side_a, b.side_b]))
      .toEqual(sem.map((b) => [b.court, b.conditional, b.side_a, b.side_b]));
  });
});
