import { describe, it, expect } from 'vitest';
import {
  drawNextAmericanoLiveMatch, forecastAmericanoLiveMatches, americanoLiveProgress,
  suggestAmericanoLiveTotal, respectsFixedPairs, americanoLiveView, gameIds,
  AMERICANO_LIVE_WINDOW_EXTRA, drawAmericanoLiveRoundForFreeCourts,
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

/* =============================================== rodada de todas as quadras */

describe('⭐ drawAmericanoLiveRoundForFreeCourts', () => {
  it('⭐ 8 na fila e 2 quadras livres: cria as duas, sem repetir ninguém', () => {
    const r = drawAmericanoLiveRoundForFreeCourts(fila(['a','b','c','d','e','f','g','h']), {
      courts: 2, games: [], rng,
    });
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.court)).toEqual([1, 2]);
    const todos = r.flatMap((x) => x.ids);
    expect(new Set(todos).size).toBe(8);
  });

  it('as duplas já vêm pareadas pelo motor do Americano', () => {
    const r = drawAmericanoLiveRoundForFreeCourts(fila(['a','b','c','d','e','f','g','h']), {
      courts: 2, games: [], rng,
    });
    r.forEach((bloco) => {
      expect(bloco.side_a).toHaveLength(2);
      expect(bloco.side_b).toHaveLength(2);
      expect(new Set([...bloco.side_a, ...bloco.side_b])).toEqual(new Set(bloco.ids));
    });
  });

  it('⭐ a quadra OCUPADA fica de fora (aquela previsão é condicional)', () => {
    const emQuadra = jogo(['x','y'], ['z','w'], { status: 'open', court: 1 });
    const r = drawAmericanoLiveRoundForFreeCourts(fila(['a','b','c','d','e','f','g','h']), {
      courts: 2, games: [emQuadra], rng,
    });
    expect(r).toHaveLength(1);
    expect(r[0].court).toBe(2);
  });

  it('⭐ o que sorteia é o que a previsão anuncia (mesma fonte)', () => {
    const entrada = fila(['a','b','c','d','e','f','g','h']);
    const opts = { courts: 2, games: [], rng };
    const previsto = forecastAmericanoLiveMatches(entrada, opts)
      .filter((b) => !b.conditional)
      .map((b) => ({ court: b.court, ids: b.players.map((p) => p.id), side_a: b.side_a, side_b: b.side_b }));
    expect(drawAmericanoLiveRoundForFreeCourts(entrada, opts)).toEqual(previsto);
  });

  it('fila curta devolve o que dá, sem partida pela metade', () => {
    const r = drawAmericanoLiveRoundForFreeCourts(fila(['a','b','c','d','e']), { courts: 2, games: [], rng });
    expect(r).toHaveLength(1);
    expect(r[0].ids).toHaveLength(4);
    expect(drawAmericanoLiveRoundForFreeCourts(fila(['a','b','c']), { courts: 2, games: [], rng })).toEqual([]);
    expect(drawAmericanoLiveRoundForFreeCourts([], { courts: 2, games: [], rng })).toEqual([]);
  });
});

/* ---------------------------------------------------------------------------
 * A RODADA OLHA A RODADA INTEIRA
 *
 * O formato é americano: com elenco estável, todos deveriam formar dupla com
 * todos e enfrentar todos duas vezes. Sortear quadra a quadra não chega nem
 * perto disso quando o número de atletas é exatamente o das quadras — a
 * primeira quadra leva o melhor grupo e a última herda o que sobrou.
 * ------------------------------------------------------------------------ */
describe('⭐ a rodada é escolhida como um todo, não quadra a quadra', () => {
  it('⭐ com 8 e 2 quadras, o grupo que SOBRA também entra na conta', () => {
    // O caso que o sorteio guloso não enxerga: entre e, f, g e h TODAS as seis
    // duplas já aconteceram. Escolhendo a quadra 1 primeiro, a|b|c|d é o grupo
    // mais barato que existe — e a quadra 2 fica obrigada a repetir duas
    // duplas, custo que nunca entrou na decisão da quadra 1. Olhando a rodada
    // inteira, os quatro "gastos" se espalham pelas duas quadras e não se
    // repete nada.
    const games = [
      jogo(['e', 'f'], ['g', 'h']), jogo(['e', 'g'], ['f', 'h']), jogo(['e', 'h'], ['f', 'g']),
    ];
    const r = drawAmericanoLiveRoundForFreeCourts(
      fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), { courts: 2, games, rng },
    );
    expect(r).toHaveLength(2);
    const duplas = r.flatMap((b) => [
      [...b.side_a].sort().join('|'), [...b.side_b].sort().join('|'),
    ]);
    // Nenhuma das seis duplas já formadas entre e, f, g e h volta.
    ['e|f', 'e|g', 'e|h', 'f|g', 'f|h', 'g|h'].forEach((d) => {
      expect(duplas).not.toContain(d);
    });
    // Ou seja: os dois quartetos foram misturados, não mantidos.
    r.forEach((bloco) => {
      const doFundo = bloco.ids.filter((id) => 'efgh'.includes(id)).length;
      expect(doFundo).toBe(2);
    });
  });

  it('⭐ dia inteiro com elenco estável: TODOS formam dupla com todos', () => {
    // 8 atletas, 2 quadras. C(8,2) = 28 duplas possíveis; 2 por partida ⇒ 14
    // partidas cobririam todas. Rodando o dia inteiro pela rodada, a cobertura
    // tem de ser total. (Quadra a quadra, o mesmo dia formava 12 das 28: os
    // dois quartetos nunca se cruzavam.)
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let relogio = 1000;
    const estado = new Map(ids.map((id, i) => [id, 1000 + i]));
    const games = [];
    for (let rodada = 0; rodada < 8; rodada += 1) {
      const ordem = ids
        .map((id) => P(id, { available_since: estado.get(id) }))
        .sort((x, y) => x.available_since - y.available_since);
      const r = drawAmericanoLiveRoundForFreeCourts(ordem, { courts: 2, games: [...games], rng });
      expect(r).toHaveLength(2);
      r.forEach((b) => {
        games.push(jogo(b.side_a, b.side_b));
        b.ids.forEach((id) => { relogio += 1; estado.set(id, relogio); });
      });
    }
    const duplas = new Set(games.flatMap((g) => [
      g.side_a.map((p) => p.id).sort().join('|'),
      g.side_b.map((p) => p.id).sort().join('|'),
    ]));
    expect(duplas.size).toBe(28);

    // E o alvo do confronto: ninguém fica sem enfrentar alguém.
    const conf = new Map();
    games.forEach((g) => {
      g.side_a.forEach((x) => g.side_b.forEach((y) => {
        const k = [x.id, y.id].sort().join('|');
        conf.set(k, (conf.get(k) || 0) + 1);
      }));
    });
    expect(conf.size).toBe(28);
  });

  it('⭐ ninguém joga duas vezes na mesma rodada', () => {
    const r = drawAmericanoLiveRoundForFreeCourts(
      fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']),
      { courts: 3, games: [], rng },
    );
    expect(r).toHaveLength(3);
    const todos = r.flatMap((b) => b.ids);
    expect(todos).toHaveLength(12);
    expect(new Set(todos).size).toBe(12);
  });

  it('⭐ a frente da fila continua jogando: quem espera há mais tempo entra', () => {
    // 12 na fila, 2 quadras: 8 jogam. Os 4 primeiros da fila são obrigatórios —
    // sem isso, buscar variedade no fundo da fila deixaria gente de fora duas
    // rodadas seguidas.
    const entrada = fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
    const r = drawAmericanoLiveRoundForFreeCourts(entrada, { courts: 2, games: [], rng });
    const escolhidos = new Set(r.flatMap((b) => b.ids));
    ['a', 'b', 'c', 'd'].forEach((id) => expect(escolhidos.has(id)).toBe(true));
  });

  it('⭐ dupla fixa continua entrando junta, mesmo na rodada', () => {
    const entrada = [
      P('a', { available_since: 1000, partner_id: 'b' }),
      P('b', { available_since: 1001, partner_id: 'a' }),
      P('c', { available_since: 1002 }), P('d', { available_since: 1003 }),
      P('e', { available_since: 1004 }), P('f', { available_since: 1005 }),
      P('g', { available_since: 1006 }), P('h', { available_since: 1007 }),
    ];
    const r = drawAmericanoLiveRoundForFreeCourts(entrada, { courts: 2, games: [], rng });
    const bloco = r.find((b) => b.ids.includes('a'));
    expect(bloco.ids).toContain('b');
    // E juntos DO MESMO LADO — dupla fixa é dupla, não adversário.
    const lado = bloco.side_a.includes('a') ? bloco.side_a : bloco.side_b;
    expect(lado).toContain('b');
  });

  it('com UMA quadra livre, o caminho é o de sempre (partida a partida)', () => {
    const entrada = fila(['a', 'b', 'c', 'd', 'e', 'f']);
    const umaQuadra = drawAmericanoLiveRoundForFreeCourts(entrada, { courts: 1, games: [], rng });
    const sozinha = drawNextAmericanoLiveMatch(entrada, { games: [], rng });
    expect(umaQuadra).toHaveLength(1);
    expect(umaQuadra[0].ids).toEqual(sozinha.ids);
    expect(umaQuadra[0].side_a).toEqual(sozinha.side_a);
    expect(umaQuadra[0].side_b).toEqual(sozinha.side_b);
  });
});

/* ---------------------------------------------------------------------------
 * ⭐ A DUPLA VINCULADA JOGA JUNTA — SEMPRE
 *
 * O defeito relatado em quadra: a dupla vinculada era mantida na mesma
 * PARTIDA (é o que `respectsFixedPairs` garante) e saía uma CONTRA a outra.
 * A causa: quem escolhe os lados é `pairFourBalanced`, que recebe IDS e não
 * sabia quem estava vinculado — e a partir da SEGUNDA partida repetir aquela
 * parceria custava 10, então o motor os separava.
 *
 * O vínculo atravessa as demais regras do sorteio. Elas continuam valendo
 * para todo o resto.
 * ------------------------------------------------------------------------ */
describe('⭐ dupla vinculada no Americano aprimorado', () => {
  const comDupla = (x, y) => [
    P('a', { available_since: 1000, partner_id: x === 'a' ? y : null }),
    P('b', { available_since: 1001, partner_id: y === 'b' ? x : null }),
    P('c', { available_since: 1002 }), P('d', { available_since: 1003 }),
    P('e', { available_since: 1004 }), P('f', { available_since: 1005 }),
    P('g', { available_since: 1006 }), P('h', { available_since: 1007 }),
  ];
  const filaAB = () => comDupla('a', 'b');
  const juntos = (side_a, side_b, x, y) => (
    (side_a.includes(x) && side_a.includes(y)) || (side_b.includes(x) && side_b.includes(y))
  );

  it('⭐ mesmo com a parceria JÁ no histórico, a dupla sai do mesmo lado', () => {
    // Este é exatamente o caso que falhava: na 1ª partida eles saíam juntos
    // por acaso; da 2ª em diante o motor os colocava como adversários.
    const games = [jogo(['a', 'b'], ['c', 'd'])];
    const r = drawNextAmericanoLiveMatch(filaAB(), { games, rng });
    expect(r.ids).toContain('a');
    expect(r.ids).toContain('b');
    expect(juntos(r.side_a, r.side_b, 'a', 'b')).toBe(true);
  });

  it('⭐ o dia inteiro: a dupla nunca se enfrenta e nunca entra pela metade', () => {
    const games = [];
    for (let i = 0; i < 12; i += 1) {
      const r = drawNextAmericanoLiveMatch(filaAB(), { games, rng });
      expect(juntos(r.side_a, r.side_b, 'a', 'b')).toBe(true);
      games.push(jogo(r.side_a, r.side_b));
    }
    // E os ADVERSÁRIOS variaram: a regra do americano segue valendo à volta.
    const adversarios = new Set(games.flatMap((g) => {
      const a = g.side_a.map((p) => p.id);
      const lado = a.includes('a') ? g.side_b : g.side_a;
      return [lado.map((p) => p.id).sort().join('+')];
    }));
    expect(adversarios.size).toBeGreaterThan(1);
  });

  it('⭐ na RODADA de várias quadras, o vínculo vale igual', () => {
    const games = [jogo(['a', 'b'], ['c', 'd']), jogo(['a', 'b'], ['e', 'f'])];
    const r = drawAmericanoLiveRoundForFreeCourts(filaAB(), { courts: 2, games, rng });
    const bloco = r.find((b) => b.ids.includes('a'));
    expect(bloco.ids).toContain('b');
    expect(juntos(bloco.side_a, bloco.side_b, 'a', 'b')).toBe(true);
  });

  it('⭐ a PREVISÃO mostra a mesma dupla que vai ser criada', () => {
    const entrada = filaAB();
    const opts = { courts: 2, games: [jogo(['a', 'b'], ['c', 'd'])], rng };
    const previsto = forecastAmericanoLiveMatches(entrada, opts).find((b) => !b.conditional
      && b.players.some((p) => p.id === 'a'));
    expect(juntos(previsto.side_a, previsto.side_b, 'a', 'b')).toBe(true);
  });

  it('⭐ DUAS duplas vinculadas convivem na mesma partida', () => {
    const entrada = [
      P('a', { available_since: 1000, partner_id: 'b' }),
      P('b', { available_since: 1001, partner_id: 'a' }),
      P('c', { available_since: 1002, partner_id: 'd' }),
      P('d', { available_since: 1003, partner_id: 'c' }),
      P('e', { available_since: 1004 }), P('f', { available_since: 1005 }),
    ];
    const r = drawNextAmericanoLiveMatch(entrada, {
      games: [jogo(['a', 'b'], ['c', 'd'])], rng,
    });
    if (r.ids.includes('c')) {
      expect(juntos(r.side_a, r.side_b, 'c', 'd')).toBe(true);
    }
    expect(juntos(r.side_a, r.side_b, 'a', 'b')).toBe(true);
  });

  it('⭐ a dupla não é PUNIDA por repetir a si mesma: continua jogando tanto quanto', () => {
    // Se a parceria vinculada contasse como repetição, o custo do grupo
    // cresceria 10 a cada partida e a dupla passaria a ser evitada.
    const estado = new Map(filaAB().map((p) => [p.id, { ...p }]));
    const games = [];
    const jogosPor = new Map(Array.from(estado.keys()).map((id) => [id, 0]));
    let relogio = 5000;
    for (let i = 0; i < 16; i += 1) {
      const ordem = Array.from(estado.values()).sort((x, y) => x.available_since - y.available_since);
      const r = drawNextAmericanoLiveMatch(ordem, { games, rng });
      games.push(jogo(r.side_a, r.side_b));
      r.ids.forEach((id) => {
        jogosPor.set(id, jogosPor.get(id) + 1);
        relogio += 1;
        estado.get(id).available_since = relogio;
      });
    }
    const v = Array.from(jogosPor.values());
    expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(1);
  });

  it('sem vínculo nenhum, o sorteio é exatamente o de antes', () => {
    const semDupla = fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const games = [jogo(['a', 'b'], ['c', 'd'])];
    const r = drawNextAmericanoLiveMatch(semDupla, { games, rng });
    // a|b já foram dupla: sem vínculo, o motor os separa (comportamento antigo).
    expect(juntos(r.side_a, r.side_b, 'a', 'b')).toBe(false);
  });
});
