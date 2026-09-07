import { describe, it, expect } from 'vitest';
import {
  buildPlayHistory, emptyPlayHistory, pairRepeatCost, groupRepeatCost,
  buildPlayNextMatchBalanced, forecastPlayMatchesBalanced,
  makePartnerRepeatCounter, ROTATION_WEIGHTS,
} from './playRotation.js';
import { buildPlayNextMatch, assignPlayTeams, PLAY_SLOTS } from './gamePlay.js';

/* ------------------------------- utilidades ------------------------------ */

const P = (id, extra = {}) => ({
  id, available_since: extra.since ?? 0, available_tie: 0,
  created_at_ms: 0, play_gender: 'male', play_level: 3.0, ...extra,
});
const fila = (...ids) => ids.map((id, i) => P(id, { since: i }));
const jogo = (a1, a2, b1, b2, order = 1) => ({
  side_a: [{ id: a1 }, { id: a2 }], side_b: [{ id: b1 }, { id: b2 }], order,
});

describe('buildPlayHistory', () => {
  it('conta parceria e encontro', () => {
    const h = buildPlayHistory([jogo('a', 'b', 'c', 'd')]);
    expect(h.partner.get('a|b')).toBe(1);
    expect(h.partner.get('c|d')).toBe(1);
    expect(h.together.get('a|c')).toBe(1);
    expect(h.partner.get('a|c')).toBeUndefined();
    expect(h.gamesPlayed.get('a')).toBe(1);
  });
  it('acumula ao longo das partidas', () => {
    const h = buildPlayHistory([jogo('a','b','c','d',1), jogo('a','b','e','f',2)]);
    expect(h.partner.get('a|b')).toBe(2);
  });
  it('registra a companhia da partida mais recente', () => {
    const h = buildPlayHistory([jogo('a','b','c','d',1), jogo('a','e','f','g',2)]);
    expect(h.lastGameWith.get('a').has('e')).toBe(true);
    expect(h.lastGameWith.get('a').has('b')).toBe(false); // ficou para trás
  });
  it('tolera lista vazia, nula e lados malformados', () => {
    expect(buildPlayHistory([]).partner.size).toBe(0);
    expect(buildPlayHistory(undefined).partner.size).toBe(0);
    expect(() => buildPlayHistory([{ side_a: null, side_b: undefined }])).not.toThrow();
  });
  it('aceita lados como ids crus além de objetos', () => {
    const h = buildPlayHistory([{ side_a: ['a','b'], side_b: ['c','d'], order: 1 }]);
    expect(h.partner.get('a|b')).toBe(1);
  });
});

describe('custos de repetição', () => {
  it('zero para quem nunca se encontrou', () => {
    expect(pairRepeatCost(buildPlayHistory([]), 'a', 'b')).toBe(0);
  });
  it('parceria custa mais que só ter cruzado', () => {
    const h = buildPlayHistory([jogo('a','b','c','d')]);
    expect(pairRepeatCost(h, 'a', 'b')).toBeGreaterThan(pairRepeatCost(h, 'a', 'c'));
  });
  it('soma todos os pares do grupo', () => {
    const h = buildPlayHistory([jogo('a','b','c','d')]);
    expect(groupRepeatCost(h, ['a','b','c','d'])).toBeGreaterThan(0);
    expect(groupRepeatCost(h, ['w','x','y','z'])).toBe(0);
  });
});

describe('buildPlayNextMatchBalanced — compatibilidade e segurança', () => {
  it('sem histórico, devolve exatamente o mesmo que hoje', () => {
    const q = fila('a','b','c','d','e','f');
    expect(buildPlayNextMatchBalanced(q, { history: null }))
      .toEqual(buildPlayNextMatch(q));
  });
  it('com menos de 4 disponíveis, devolve null (como hoje)', () => {
    expect(buildPlayNextMatchBalanced(fila('a','b','c'), { history: emptyPlayHistory() }))
      .toBeNull();
  });
  it('histórico vazio: mantém os 4 primeiros da fila', () => {
    const q = fila('a','b','c','d','e','f','g','h');
    expect(buildPlayNextMatchBalanced(q, { history: emptyPlayHistory() }))
      .toEqual(['a','b','c','d']);
  });
  it('devolve sempre 4 ids', () => {
    const h = buildPlayHistory([jogo('a','b','c','d')]);
    const r = buildPlayNextMatchBalanced(fila('a','b','c','d','e','f','g','h'), { history: h });
    expect(r).toHaveLength(PLAY_SLOTS);
    expect(new Set(r).size).toBe(PLAY_SLOTS);
  });
  it('só escolhe quem está na fila', () => {
    const q = fila('a','b','c','d','e','f');
    const h = buildPlayHistory([jogo('a','b','c','d')]);
    const ids = new Set(q.map((p) => p.id));
    buildPlayNextMatchBalanced(q, { history: h }).forEach((id) => expect(ids.has(id)).toBe(true));
  });
});

describe('⭐ FLAG DESLIGADA = COMPORTAMENTO IDÊNTICO (propriedade)', () => {
  // Gerador determinístico: o teste tem de ser reprodutível.
  const rand = (seed) => () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  it('em 300 cenários aleatórios, sem histórico a escolha é a MESMA de hoje', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const r = rand(seed);
      const n = 4 + Math.floor(r() * 14);            // 4..17 disponíveis
      const q = Array.from({ length: n }, (_, i) => {
        const p = P(`p${i}`, {
          since: i,
          play_gender: r() < 0.5 ? 'male' : 'female',
          play_level: 2 + r() * 6,
        });
        return p;
      });
      // Algumas duplas fixas mútuas, e às vezes um parceiro inexistente.
      if (n >= 6 && r() < 0.5) {
        const i = Math.floor(r() * (n - 1));
        q[i].partner_id = q[i + 1].id;
        q[i + 1].partner_id = q[i].id;
      }
      if (r() < 0.2) q[Math.floor(r() * n)].partner_id = 'inexistente';

      expect(buildPlayNextMatchBalanced(q, { history: null }))
        .toEqual(buildPlayNextMatch(q));
    }
  });

  it('assignPlayTeams sem contador de repetição é idêntico ao de hoje', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const r = rand(seed);
      const quatro = Array.from({ length: 4 }, (_, i) => P(`p${i}`, {
        play_gender: r() < 0.5 ? 'male' : 'female',
        play_level: 2 + r() * 6,
      }));
      const fixo = () => 0.5;
      expect(assignPlayTeams(quatro, { rng: fixo }))
        .toEqual(assignPlayTeams(quatro, { rng: fixo, partnerRepeatCount: null }));
    }
  });
});

describe('⭐ JUSTIÇA — a ordem de participação é respeitada', () => {
  it('o primeiro da fila entra SEMPRE, mesmo com histórico carregado', () => {
    const q = fila('a','b','c','d','e','f','g','h');
    // 'a' já jogou com todo mundo — ainda assim não pode ser preterido.
    const h = buildPlayHistory([
      jogo('a','b','c','d',1), jogo('a','e','f','g',2), jogo('a','h','b','c',3),
    ]);
    expect(buildPlayNextMatchBalanced(q, { history: h })).toContain('a');
  });
  it('nunca escolhe alguém fora da janela (não pula meia fila)', () => {
    const q = fila('a','b','c','d','e','f','g','h','i','j','k','l');
    const h = buildPlayHistory([jogo('a','b','c','d',1), jogo('a','e','f','g',2)]);
    const janela = new Set(['a','b','c','d','e','f','g','h']); // 4 + 4
    buildPlayNextMatchBalanced(q, { history: h, windowExtra: 4 })
      .forEach((id) => expect(janela.has(id)).toBe(true));
  });
  it('windowExtra = 0 reproduz o comportamento de hoje', () => {
    const q = fila('a','b','c','d','e','f','g','h');
    const h = buildPlayHistory([jogo('a','b','c','d')]);
    expect(buildPlayNextMatchBalanced(q, { history: h, windowExtra: 0 }))
      .toEqual(buildPlayNextMatch(q));
  });
});

describe('⭐ DUPLAS FIXAS continuam entrando juntas', () => {
  it('parceiros mútuos entram no mesmo jogo', () => {
    const q = [
      P('a', { since: 0 }), P('b', { since: 1 }), P('c', { since: 2 }),
      P('d', { since: 3, partner_id: 'e' }), P('e', { since: 4, partner_id: 'd' }),
      P('f', { since: 5 }), P('g', { since: 6 }), P('h', { since: 7 }),
    ];
    const h = buildPlayHistory([jogo('a','b','c','f',1)]);
    const r = buildPlayNextMatchBalanced(q, { history: h });
    expect(r.includes('d')).toBe(r.includes('e')); // ou os dois, ou nenhum
  });
  it('quem tem parceiro INDISPONÍVEL aguarda (não entra sozinho)', () => {
    const q = [
      P('a', { since: 0, partner_id: 'zz' }), // 'zz' não está na fila
      P('b', { since: 1 }), P('c', { since: 2 }), P('d', { since: 3 }), P('e', { since: 4 }),
    ];
    const r = buildPlayNextMatchBalanced(q, { history: buildPlayHistory([jogo('b','c','d','e')]) });
    expect(r).not.toContain('a');
  });
});

describe('makePartnerRepeatCounter + assignPlayTeams', () => {
  it('sem histórico devolve null e o comportamento não muda', () => {
    expect(makePartnerRepeatCounter(null)).toBeNull();
  });
  it('evita repetir a mesma dupla quando pode', () => {
    // a+b já foram parceiros duas vezes; todos do mesmo sexo e nível, então a
    // única diferença de custo é a repetição.
    const h = buildPlayHistory([jogo('a','b','c','d',1), jogo('a','b','c','d',2)]);
    const quatro = ['a','b','c','d'].map((id) => P(id));
    const { side_a, side_b } = assignPlayTeams(quatro, {
      rng: () => 0, partnerRepeatCount: makePartnerRepeatCounter(h),
    });
    const juntos = (x, y) => (side_a.includes(x) && side_a.includes(y))
      || (side_b.includes(x) && side_b.includes(y));
    expect(juntos('a','b')).toBe(false);
    expect(juntos('c','d')).toBe(false);
  });
  it('a dupla MISTA continua tendo prioridade sobre a variação', () => {
    const h = buildPlayHistory([jogo('a','b','c','d',1), jogo('a','b','c','d',2)]);
    const quatro = [
      P('a', { play_gender: 'male' }), P('b', { play_gender: 'female' }),
      P('c', { play_gender: 'male' }), P('d', { play_gender: 'female' }),
    ];
    const { side_a, side_b } = assignPlayTeams(quatro, {
      rng: () => 0, partnerRepeatCount: makePartnerRepeatCounter(h),
    });
    const genero = Object.fromEntries(quatro.map((p) => [p.id, p.play_gender]));
    const misto = (lado) => genero[lado[0]] !== genero[lado[1]];
    expect(misto(side_a) && misto(side_b)).toBe(true);
  });
});

describe('forecastPlayMatchesBalanced', () => {
  it('monta um bloco por quadra sem repetir jogador', () => {
    const q = fila('a','b','c','d','e','f','g','h');
    const blocos = forecastPlayMatchesBalanced(q, { courts: 2, history: emptyPlayHistory() });
    expect(blocos).toHaveLength(2);
    const todos = blocos.flatMap((b) => b.players.map((p) => p.id));
    expect(new Set(todos).size).toBe(8);
  });
  it('marca bloco parcial quando faltam jogadores', () => {
    const blocos = forecastPlayMatchesBalanced(fila('a','b','c','d','e','f'), {
      courts: 2, history: emptyPlayHistory(),
    });
    expect(blocos[0].full).toBe(true);
    expect(blocos[1].full).toBe(false);
    expect(blocos[1].waiting).toBe(2);
  });
});

/* ==========================================================================
 * SIMULAÇÃO — a prova de que o problema relatado some.
 *
 * Reproduz um dia de jogo real: N jogadores, C quadras, R rodadas. A cada
 * rodada preenche as quadras livres e conclui a partida mais antiga (os
 * jogadores voltam para o fim da fila). Mede repetição e justiça.
 * ========================================================================== */

function simular({ jogadores, quadras, rodadas, balanceado }) {
  let relogio = 1000;
  const participantes = Array.from({ length: jogadores }, (_, i) => P(`p${i + 1}`, {
    since: i, play_gender: i % 2 === 0 ? 'male' : 'female',
    play_level: 3 + (i % 5) * 0.5,
  }));
  const porId = new Map(participantes.map((p) => [p.id, p]));
  const abertos = [];
  const encerrados = [];
  const quartetos = new Map();
  const duplas = new Map();
  // Justiça medida do jeito certo: (a) qual a posição MAIS FUNDA da fila de
  // onde alguém foi chamado, e (b) qual o MAIOR intervalo, em partidas, entre
  // duas aparições do mesmo jogador. Contar "quem ficou de fora" não serve:
  // com 12 jogadores em 2 quadras, 4 sempre ficam de fora por falta de vaga.
  const ultimaAparicao = new Map(participantes.map((p) => [p.id, 0]));
  let maiorIndiceChamado = 0;
  let maiorIntervalo = 0;
  let nJogo = 0;

  const emQuadra = () => new Set(abertos.flatMap((g) => [
    ...g.side_a.map((x) => x.id), ...g.side_b.map((x) => x.id),
  ]));

  for (let r = 0; r < rodadas; r += 1) {
    while (abertos.length < quadras) {
      const ocupados = emQuadra();
      const disponiveis = participantes
        .filter((p) => !ocupados.has(p.id))
        .sort((a, b) => a.available_since - b.available_since);
      if (disponiveis.length < PLAY_SLOTS) break;

      const historico = buildPlayHistory([...encerrados, ...abertos]);
      const ids = balanceado
        ? buildPlayNextMatchBalanced(disponiveis, { history: historico })
        : buildPlayNextMatch(disponiveis);
      if (!ids) break;

      const quatro = ids.map((id) => porId.get(id));
      const { side_a, side_b } = assignPlayTeams(quatro, {
        rng: () => 0.5,
        partnerRepeatCount: balanceado ? makePartnerRepeatCounter(historico) : null,
      });

      nJogo += 1;
      ids.forEach((id) => {
        const idx = disponiveis.findIndex((p) => p.id === id);
        if (idx > maiorIndiceChamado) maiorIndiceChamado = idx;
        const anterior = ultimaAparicao.get(id) || 0;
        if (anterior > 0 && nJogo - anterior > maiorIntervalo) maiorIntervalo = nJogo - anterior;
        ultimaAparicao.set(id, nJogo);
      });

      quartetos.set([...ids].sort().join('|'), (quartetos.get([...ids].sort().join('|')) || 0) + 1);
      [side_a, side_b].forEach((lado) => {
        const k = [...lado].sort().join('|');
        duplas.set(k, (duplas.get(k) || 0) + 1);
      });

      abertos.push({
        side_a: side_a.map((id) => ({ id })), side_b: side_b.map((id) => ({ id })),
        order: relogio += 1,
      });
    }

    const terminado = abertos.shift();
    if (!terminado) break;
    encerrados.push(terminado);
    [...terminado.side_a, ...terminado.side_b].forEach((x) => {
      porId.get(x.id).available_since = relogio += 1;
    });
  }

  const totalJogos = encerrados.length + abertos.length;
  const repetidos = (mapa) => Array.from(mapa.values()).filter((n) => n > 1).length;
  return {
    totalJogos,
    quartetosDistintos: quartetos.size,
    quartetosRepetidos: repetidos(quartetos),
    duplasDistintas: duplas.size,
    duplasRepetidas: repetidos(duplas),
    maxRepeticaoQuarteto: Math.max(0, ...quartetos.values()),
    maxRepeticaoDupla: Math.max(0, ...duplas.values()),
    maiorIndiceChamado,
    maiorIntervalo,
  };
}

describe('⭐ SIMULAÇÃO DE DIA DE JOGO — o problema relatado', () => {
  it('12 jogadores / 2 quadras: hoje os mesmos quartetos se repetem sem parar', () => {
    const hoje = simular({ jogadores: 12, quadras: 2, rodadas: 30, balanceado: false });
    // Documenta o problema com número: em ~41 partidas saem só 3 quartetos
    // distintos, um deles repetido 14 vezes. É a "sempre as mesmas pessoas".
    expect(hoje.quartetosDistintos).toBeLessThanOrEqual(4);
    expect(hoje.maxRepeticaoQuarteto).toBeGreaterThanOrEqual(8);
  });

  it('12 jogadores / 2 quadras: o rodízio equilibrado varia MUITO mais', () => {
    const hoje = simular({ jogadores: 12, quadras: 2, rodadas: 30, balanceado: false });
    const novo = simular({ jogadores: 12, quadras: 2, rodadas: 30, balanceado: true });
    expect(novo.totalJogos).toBe(hoje.totalJogos);            // mesma vazão
    // Medido: 3 → 40 quartetos distintos; repetição máxima 14 → 2.
    expect(novo.quartetosDistintos).toBeGreaterThanOrEqual(hoje.quartetosDistintos * 5);
    expect(novo.duplasDistintas).toBeGreaterThanOrEqual(hoje.duplasDistintas * 5);
    expect(novo.maxRepeticaoQuarteto).toBeLessThanOrEqual(3);
  });

  it('16 jogadores / 3 quadras: idem', () => {
    const hoje = simular({ jogadores: 16, quadras: 3, rodadas: 40, balanceado: false });
    const novo = simular({ jogadores: 16, quadras: 3, rodadas: 40, balanceado: true });
    expect(novo.totalJogos).toBe(hoje.totalJogos);
    expect(novo.quartetosDistintos).toBeGreaterThan(hoje.quartetosDistintos);
    expect(novo.maxRepeticaoDupla).toBeLessThanOrEqual(hoje.maxRepeticaoDupla);
  });

  it('⭐ JUSTIÇA: ninguém é chamado de fora da janela (nunca pula meia fila)', () => {
    [
      { jogadores: 12, quadras: 2, rodadas: 40 },
      { jogadores: 16, quadras: 3, rodadas: 40 },
      { jogadores: 20, quadras: 3, rodadas: 40 },
      { jogadores: 9,  quadras: 2, rodadas: 30 },
    ].forEach((cfg) => {
      const novo = simular({ ...cfg, balanceado: true });
      // Janela = 4 vagas + 4 extras ⇒ índice máximo possível é 7.
      expect(novo.maiorIndiceChamado).toBeLessThanOrEqual(PLAY_SLOTS + 4 - 1);
    });
  });

  it('⭐ JUSTIÇA: a maior espera entre partidas cresce no máximo 1 jogo', () => {
    [
      { jogadores: 12, quadras: 2, rodadas: 40 },
      { jogadores: 16, quadras: 3, rodadas: 40 },
      { jogadores: 20, quadras: 3, rodadas: 40 },
      { jogadores: 13, quadras: 3, rodadas: 40 },
      { jogadores: 8,  quadras: 1, rodadas: 40 },
    ].forEach((cfg) => {
      const hoje = simular({ ...cfg, balanceado: false });
      const novo = simular({ ...cfg, balanceado: true });
      // É o preço da variedade — e ele é baixíssimo perto do ganho.
      expect(novo.maiorIntervalo).toBeLessThanOrEqual(hoje.maiorIntervalo + 1);
    });
  });

  it('⭐ a vazão de partidas não cai em nenhuma configuração', () => {
    [
      { jogadores: 8,  quadras: 1, rodadas: 20 },
      { jogadores: 12, quadras: 2, rodadas: 30 },
      { jogadores: 16, quadras: 3, rodadas: 40 },
      { jogadores: 20, quadras: 3, rodadas: 40 },
      { jogadores: 5,  quadras: 1, rodadas: 15 },
    ].forEach((cfg) => {
      expect(simular({ ...cfg, balanceado: true }).totalJogos)
        .toBe(simular({ ...cfg, balanceado: false }).totalJogos);
    });
  });
});
