/**
 * Rodízio equilibrado do Play — variação de duplas e grupos SEM furar a ordem
 * de participação. Atrás da flag `play_smart_rotation` (padrão DESLIGADA).
 *
 * ── O PROBLEMA ────────────────────────────────────────────────────────────
 * `buildPlayNextMatch` pega SEMPRE os 4 primeiros da fila. Quando as partidas
 * terminam mais ou menos na ordem em que começaram — o caso normal —, a fila
 * se reforma em blocos de 4 e os MESMOS quartetos voltam a jogar juntos,
 * rodada após rodada. Com 12 jogadores em 2 quadras, por exemplo, formam-se
 * três quartetos fixos que se revezam para sempre.
 * E como `assignPlayTeams` é quase determinístico (o sorteio só desempata com
 * peso 0,001), dentro do quarteto as duplas também se repetem.
 *
 * ── A SOLUÇÃO ─────────────────────────────────────────────────────────────
 * Duas alavancas, ambas conservadoras quanto à ordem:
 *
 * 1. JANELA DE ESCOLHA. Em vez de pegar rigidamente os 4 primeiros, olha uma
 *    janela curta (4 + `windowExtra`, padrão 8) e escolhe, dentro dela, a
 *    combinação de 4 que menos repete encontros já ocorridos — pagando um
 *    custo por "descer" na fila, de modo que ficar perto do topo é sempre
 *    preferido quando o resto empata.
 *
 * 2. VARIAÇÃO DE DUPLAS. Ao dividir os 4 em dois lados, penaliza quem já foi
 *    parceiro de quem, sem mexer na prioridade de dupla mista nem no
 *    equilíbrio de nível.
 *
 * ── GARANTIAS DE JUSTIÇA (testadas) ───────────────────────────────────────
 *  · O PRIMEIRO ELEGÍVEL DA FILA ENTRA SEMPRE. Ninguém é ultrapassado
 *    indefinidamente — quem esperou mais joga.
 *  · Quem é preterido sobe na fila (os escolhidos saem para a quadra), então
 *    a espera extra é de no máximo uma rodada.
 *  · Duplas fixas (`partner_id` mútuo) continuam entrando juntas.
 *  · Quem declarou parceiro indisponível continua aguardando, como hoje.
 *  · Sem combinação válida na janela, CAI DE VOLTA em `buildPlayNextMatch`:
 *    nunca deixa de criar uma partida que hoje seria criada.
 *
 * ── IMPACTO NO BANCO: NENHUM ──────────────────────────────────────────────
 * O histórico é derivado das partidas já carregadas em memória. Nenhuma
 * coleção, campo, índice ou escrita nova.
 */

import {
  PLAY_SLOTS, PLAY_GAME_STATUS, buildPlayNextMatch, freePlayCourts, assignPlayTeams,
} from './gamePlay.js';

/** Pesos padrão. Expostos para teste e ajuste fino. */
export const ROTATION_WEIGHTS = Object.freeze({
  /** Custo de "descer" uma posição na fila. Mantém a ordem como referência. */
  order: 1,
  /** Já estiveram na mesma partida (qualquer lado). */
  together: 2,
  /** Já foram PARCEIROS (mesmo lado) — soma-se a `together`. */
  partner: 3,
  /** Estiveram juntos na partida imediatamente anterior de um deles. */
  consecutive: 4,
});

/** Quantos jogadores além dos 4 entram na janela de escolha. */
export const ROTATION_WINDOW_EXTRA = 4;

const pairKey = (a, b) => (String(a) < String(b) ? `${a}|${b}` : `${b}|${a}`);

const sideIds = (side) => (Array.isArray(side) ? side : [])
  .map((p) => (typeof p === 'string' ? p : p?.id))
  .filter(Boolean);

/**
 * Histórico de encontros a partir das partidas do dia de jogo.
 *
 * Conta partidas ABERTAS e CONCLUÍDAS: uma partida em andamento também é um
 * encontro que acabou de acontecer e não deve se repetir na sequência.
 *
 * @param {Array} games partidas do Play (com `side_a`/`side_b` e `order`)
 * @returns {{ together: Map<string, number>, partner: Map<string, number>,
 *             lastGameWith: Map<string, Set<string>>, gamesPlayed: Map<string, number> }}
 */
export function buildPlayHistory(games = []) {
  const together = new Map();
  const partner = new Map();
  const gamesPlayed = new Map();
  const lastGameWith = new Map();

  const bump = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);

  // Ordem cronológica: `order` é Date.now() no momento da criação.
  const ordered = (games || [])
    .filter(Boolean)
    .slice()
    .sort((g1, g2) => (Number(g1.order) || 0) - (Number(g2.order) || 0));

  ordered.forEach((g) => {
    const a = sideIds(g.side_a);
    const b = sideIds(g.side_b);
    const all = [...a, ...b];
    if (all.length === 0) return;

    all.forEach((id) => bump(gamesPlayed, id));

    // Mesmo lado = parceria.
    [a, b].forEach((side) => {
      for (let i = 0; i < side.length; i += 1) {
        for (let j = i + 1; j < side.length; j += 1) bump(partner, pairKey(side[i], side[j]));
      }
    });
    // Qualquer par da partida = encontro.
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) bump(together, pairKey(all[i], all[j]));
    }
    // Companhia na partida MAIS RECENTE de cada um (sobrescreve as anteriores).
    all.forEach((id) => {
      lastGameWith.set(id, new Set(all.filter((x) => x !== id)));
    });
  });

  return { together, partner, lastGameWith, gamesPlayed };
}

/** Histórico vazio — usado quando não há partidas ainda. */
export function emptyPlayHistory() {
  return {
    together: new Map(), partner: new Map(),
    lastGameWith: new Map(), gamesPlayed: new Map(),
  };
}

/**
 * Custo de repetição de um par de jogadores.
 * @returns {number} 0 quando nunca se encontraram.
 */
export function pairRepeatCost(history, a, b, weights = ROTATION_WEIGHTS) {
  if (!history || a === b) return 0;
  const key = pairKey(a, b);
  const enc = history.together?.get(key) || 0;
  const par = history.partner?.get(key) || 0;
  const seguidos = history.lastGameWith?.get(a)?.has(b) ? 1 : 0;
  return enc * weights.together + par * weights.partner + seguidos * weights.consecutive;
}

/** Soma do custo de repetição entre todos os pares de um grupo. */
export function groupRepeatCost(history, ids, weights = ROTATION_WEIGHTS) {
  let total = 0;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      total += pairRepeatCost(history, ids[i], ids[j], weights);
    }
  }
  return total;
}

/* ---------------------- validade quanto a duplas fixas --------------------- */

/** Parceiro MÚTUO de `p` dentro da lista de disponíveis, ou null. */
function mutualPartnerOf(p, byId) {
  if (!p?.partner_id) return null;
  const parceiro = byId.get(p.partner_id);
  return parceiro && parceiro.partner_id === p.id ? parceiro : null;
}

/**
 * Um jogador é ELEGÍVEL quando pode entrar agora: ou não tem dupla fixa, ou o
 * parceiro também está disponível. Quem tem parceiro indisponível aguarda —
 * exatamente como em `buildPlayNextMatch`.
 */
function isEligible(p, byId) {
  if (!p?.partner_id) return true;
  return mutualPartnerOf(p, byId) != null;
}

/** A combinação respeita as duplas fixas? (parceiro dentro, ou ninguém dentro) */
function comboRespeitaDuplas(combo, byId) {
  const dentro = new Set(combo.map((p) => p.id));
  return combo.every((p) => {
    if (!p.partner_id) return true;
    const parceiro = mutualPartnerOf(p, byId);
    if (!parceiro) return false;            // parceiro indisponível: aguarda
    return dentro.has(parceiro.id);         // parceiro tem de estar junto
  });
}

/* ------------------------------ escolha do grupo --------------------------- */

/** Combinações de `k` índices em `n`, todas contendo `forced`. */
function combinacoes(n, k, forced) {
  const out = [];
  const rest = [];
  for (let i = 0; i < n; i += 1) if (i !== forced) rest.push(i);

  const escolher = (start, atual) => {
    if (atual.length === k - 1) { out.push([forced, ...atual]); return; }
    for (let i = start; i < rest.length; i += 1) {
      atual.push(rest[i]);
      escolher(i + 1, atual);
      atual.pop();
    }
  };
  escolher(0, []);
  return out;
}

/**
 * Escolhe os `slots` jogadores da próxima partida variando os grupos, sem
 * furar a ordem de participação.
 *
 * @param {Array} availableOrdered disponíveis, já em ordem de espera
 * @param {object} [opts]
 * @param {number} [opts.slots]
 * @param {object} [opts.history] de `buildPlayHistory`
 * @param {number} [opts.windowExtra] jogadores extras na janela
 * @param {object} [opts.weights]
 * @returns {string[]|null} ids escolhidos, ou null se não dá para formar partida
 */
export function buildPlayNextMatchBalanced(availableOrdered, {
  slots = PLAY_SLOTS,
  history = null,
  windowExtra = ROTATION_WINDOW_EXTRA,
  weights = ROTATION_WEIGHTS,
} = {}) {
  const ordem = (availableOrdered || []).slice();

  // Rede de segurança: o comportamento de hoje é sempre a referência. Se ele
  // não consegue formar partida, esta função também não deve inventar uma.
  const base = buildPlayNextMatch(ordem, { slots });
  if (!base) return null;
  if (!history) return base;

  const byId = new Map(ordem.map((p) => [p.id, p]));

  // Janela curta a partir do topo da fila.
  const janela = ordem.slice(0, Math.max(slots, slots + Math.max(0, windowExtra)));
  if (janela.length < slots) return base;

  // O primeiro ELEGÍVEL da fila entra sempre — é a garantia de que ninguém é
  // ultrapassado indefinidamente.
  const forced = janela.findIndex((p) => isEligible(p, byId));
  if (forced < 0) return base;

  let melhor = null;
  for (const idx of combinacoes(janela.length, slots, forced)) {
    const combo = idx.map((i) => janela[i]);
    if (!comboRespeitaDuplas(combo, byId)) continue;

    const custoOrdem = idx.reduce((acc, i) => acc + i, 0) * weights.order;
    const custoRepeticao = groupRepeatCost(history, combo.map((p) => p.id), weights);
    const custo = custoOrdem + custoRepeticao;

    // Desempate determinístico: a combinação mais próxima do topo da fila.
    if (!melhor || custo < melhor.custo) melhor = { custo, idx, combo };
  }

  if (!melhor) return base;
  // Devolve na ordem da fila, para o restante do fluxo continuar previsível.
  return melhor.idx.slice().sort((a, b) => a - b).map((i) => janela[i].id);
}


/* ============================ SIMULAÇÃO DA SEQUÊNCIA ======================== */

/** Cópia rasa e mutável do histórico (Maps novos). */
function clonarHistorico(history) {
  return {
    together: new Map(history?.together || []),
    partner: new Map(history?.partner || []),
    lastGameWith: new Map(history?.lastGameWith || []),
    gamesPlayed: new Map(history?.gamesPlayed || []),
  };
}

/** Registra um jogo HIPOTÉTICO no histórico (usado só dentro da simulação). */
function registrarJogoNoHistorico(hist, ladoA, ladoB) {
  const todos = [...ladoA, ...ladoB];
  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  [ladoA, ladoB].forEach((lado) => {
    for (let i = 0; i < lado.length; i += 1) {
      for (let j = i + 1; j < lado.length; j += 1) bump(hist.partner, pairKey(lado[i], lado[j]));
    }
  });
  for (let i = 0; i < todos.length; i += 1) {
    for (let j = i + 1; j < todos.length; j += 1) bump(hist.together, pairKey(todos[i], todos[j]));
  }
  todos.forEach((id) => {
    bump(hist.gamesPlayed, id);
    hist.lastGameWith.set(id, new Set(todos.filter((x) => x !== id)));
  });
}

/** Jogos ABERTOS por quadra, do mais antigo para o mais novo. */
function jogosAbertosPorQuadra(games = []) {
  return (games || [])
    .filter((g) => g && g.status !== PLAY_GAME_STATUS.FINISHED && g.court != null)
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

/**
 * SIMULA a sequência de partidas que `createNextPlayGame` vai criar — é a
 * FONTE ÚNICA de verdade da previsão e da ordem de participação.
 *
 * Por que existe: a previsão antiga listava um bloco por quadra a partir de
 * quem está disponível AGORA, como se quem está em quadra nunca voltasse para
 * a fila. Só que volta: ao terminar a partida, os 4 retornam ao fim da fila e
 * disputam as vagas seguintes. Resultado: o telão anunciava para as quadras
 * ocupadas gente que não entraria (ou bloco vazio). Aqui a devolução é
 * simulada.
 *
 * Ordem de liberação: quadras LIVRES primeiro (da menor para a maior, que é a
 * ordem em que `createNextPlayGame` cria); depois as OCUPADAS, da partida que
 * começou há mais tempo para a mais recente — a hipótese mais razoável, e a
 * única disponível sem adivinhar o placar. Por isso a previsão das quadras
 * ocupadas é CONDICIONAL: `conditional: true` marca esses blocos para a UI
 * poder dizer que dependem de qual partida terminar primeiro.
 *
 * Limite conhecido e documentado: o split em duplas dos jogos HIPOTÉTICOS usa
 * `assignPlayTeams` sem o nível unificado (que só o serviço busca, de forma
 * assíncrona). Isso só influencia a contagem de PARCERIA de jogadores que
 * saem e voltam DENTRO da mesma simulação — situação rara (muitas quadras,
 * poucos jogadores) e de efeito pequeno. A escolha de QUEM entra na próxima
 * partida — a que importa — não é afetada.
 *
 * @returns {{ blocks: Array, entryOrder: Array }}
 */
export function simulatePlaySequence(availableOrdered, {
  courts = 1, games = [], slots = PLAY_SLOTS, history = null,
  windowExtra = ROTATION_WINDOW_EXTRA, weights = ROTATION_WEIGHTS,
} = {}) {
  const total = Math.max(1, Math.floor(courts) || 1);
  const livres = freePlayCourts({ courts: total, games });
  const livresSet = new Set(livres);
  const abertos = jogosAbertosPorQuadra(games).filter((g) => !livresSet.has(Number(g.court)));

  const hist = history ? clonarHistorico(history) : null;
  let pool = (availableOrdered || []).slice();
  const porId = new Map(pool.map((p) => [p.id, p]));
  const blocks = [];
  const entryOrder = [];

  const escolher = (court, free, conditional) => {
    const ids = hist
      ? buildPlayNextMatchBalanced(pool, { slots, history: hist, windowExtra, weights })
      : buildPlayNextMatch(pool, { slots });
    if (!ids) {
      const players = pool.slice(0, slots);
      blocks.push({
        court, free, conditional, players,
        waiting: Math.max(0, slots - players.length), full: false,
      });
      return false;
    }
    const escolhidos = new Set(ids);
    const players = ids.map((id) => pool.find((p) => p.id === id)).filter(Boolean);
    blocks.push({ court, free, conditional, players, waiting: 0, full: true });
    players.forEach((p) => entryOrder.push(p));
    pool = pool.filter((p) => !escolhidos.has(p.id));
    if (hist) {
      const { side_a, side_b } = assignPlayTeams(players, { rng: () => 0.5 });
      registrarJogoNoHistorico(hist, side_a, side_b);
    }
    return true;
  };

  // 1) Quadras livres: entram agora.
  for (const court of livres) {
    if (!escolher(court, true, false)) return { blocks, entryOrder: concluirOrdem(entryOrder, pool) };
  }

  // 2) Quadras ocupadas: ao terminar, os 4 voltam ao FIM da fila e disputam.
  for (const jogo of abertos) {
    const voltando = [...(jogo.side_a || []), ...(jogo.side_b || [])]
      .map((x) => (typeof x === 'string' ? x : x?.id))
      .filter(Boolean)
      .map((id) => porId.get(id) || { id, available_since: Number.MAX_SAFE_INTEGER })
      .filter(Boolean);
    // Voltam para o fim: acabaram de jogar.
    pool = [...pool, ...voltando.filter((p) => !pool.some((q) => q.id === p.id))];
    if (!escolher(Number(jogo.court), false, true)) break;
  }

  return { blocks, entryOrder: concluirOrdem(entryOrder, pool) };
}

/** Completa a ordem de entrada com quem sobrou, preservando a espera. */
function concluirOrdem(entryOrder, resto) {
  const dentro = new Set(entryOrder.map((p) => p.id));
  return [...entryOrder, ...resto.filter((p) => !dentro.has(p.id))]
    .map((p, i) => ({ ...p, orderNo: i + 1 }));
}

/**
 * ORDEM DE PARTICIPAÇÃO na sequência em que os jogadores REALMENTE vão entrar.
 *
 * A fila crua (`computePlayOrder().order`) ordena por tempo de espera — e com
 * o rodízio equilibrado os quatro primeiros dela nem sempre são os quatro que
 * entram. Mostrar `#1 #2 #3 #4` e colocar outros em quadra cria falsa
 * expectativa. Aqui a numeração passa a ser a ordem real de entrada.
 *
 * Sem histórico (flag desligada) devolve a fila como está, apenas renumerada —
 * que é exatamente a ordem de entrada quando a escolha é FIFO pura.
 */
export function buildPlayEntryOrder(availableOrdered, {
  courts = 1, games = [], slots = PLAY_SLOTS, history = null,
  windowExtra = ROTATION_WINDOW_EXTRA, weights = ROTATION_WEIGHTS,
} = {}) {
  const disponiveis = availableOrdered || [];
  if (!history) {
    return disponiveis.map((p, i) => ({ ...p, orderNo: i + 1 }));
  }
  // A simulação também posiciona quem está EM QUADRA (eles voltam para a fila
  // quando a partida deles termina). A fila exibida, porém, é só de quem está
  // disponível agora — senão a lista mostraria gente que está jogando. Filtra
  // para o conjunto original e renumera.
  const idsDisponiveis = new Set(disponiveis.map((p) => p.id));
  const { entryOrder } = simulatePlaySequence(disponiveis, {
    courts, games, slots, history, windowExtra, weights,
  });
  const vistos = new Set();
  const ordenados = [];
  entryOrder.forEach((p) => {
    if (idsDisponiveis.has(p.id) && !vistos.has(p.id)) { vistos.add(p.id); ordenados.push(p); }
  });
  disponiveis.forEach((p) => {
    if (!vistos.has(p.id)) { vistos.add(p.id); ordenados.push(p); }
  });
  return ordenados.map((p, i) => ({ ...p, orderNo: i + 1 }));
}

/**
 * Aplica a ORDEM DE ENTRADA a uma `view` do `computePlayOrder`.
 *
 * Ponto único de reescrita: devolve a mesma `view`, com `order` na sequência
 * real de entrada e `orderNo` renumerado em `order` e em `all`. Assim toda a
 * interface — a lista de participantes, o crachá "#N · aguardando" e o
 * destaque "entra a seguir" no telão — passa a mostrar a mesma coisa que vai
 * acontecer em quadra, sem precisar mexer em cada ponto de renderização.
 *
 * Sem histórico (flag desligada) devolve a `view` INTACTA — mesmo objeto.
 *
 * @param {{order: Array, inCourt: Array, unavailable: Array, all: Array}} view
 * @returns {{order: Array, inCourt: Array, unavailable: Array, all: Array}}
 */
export function applyPlayEntryOrder(view, {
  courts = 1, games = [], slots = PLAY_SLOTS, history = null,
  windowExtra = ROTATION_WINDOW_EXTRA, weights = ROTATION_WEIGHTS,
} = {}) {
  if (!view || !history) return view;
  const order = buildPlayEntryOrder(view.order, {
    courts, games, slots, history, windowExtra, weights,
  });
  const noPorId = new Map(order.map((p) => [p.id, p.orderNo]));
  return {
    ...view,
    order,
    all: (view.all || []).map((p) => (
      noPorId.has(p.id) ? { ...p, orderNo: noPorId.get(p.id) } : p
    )),
  };
}

/**
 * Previsão em blocos (um por quadra), na ordem em que as partidas serão
 * criadas. Deriva da simulação — mesma regra da criação.
 */
export function forecastPlayMatchesBalanced(availableOrdered, {
  courts = 1, games = [], slots = PLAY_SLOTS, history = null,
  windowExtra = ROTATION_WINDOW_EXTRA, weights = ROTATION_WEIGHTS,
} = {}) {
  return simulatePlaySequence(availableOrdered, {
    courts, games, slots, history, windowExtra, weights,
  }).blocks;
}

/**
 * Previsão POR QUADRA (1..courts), para o telão. Deriva da mesma simulação.
 */
export function forecastPlayByCourtBalanced(availableOrdered, {
  courts = 1, games = [], slots = PLAY_SLOTS, history = null,
  windowExtra = ROTATION_WINDOW_EXTRA, weights = ROTATION_WEIGHTS,
} = {}) {
  const total = Math.max(1, Math.floor(courts) || 1);
  const { blocks } = simulatePlaySequence(availableOrdered, {
    courts: total, games, slots, history, windowExtra, weights,
  });
  const porQuadra = new Map(blocks.map((b) => [b.court, b]));
  const livresSet = new Set(freePlayCourts({ courts: total, games }));
  return Array.from({ length: total }, (_, i) => i + 1).map((court) => (
    porQuadra.get(court) || {
      court, free: livresSet.has(court), conditional: !livresSet.has(court),
      players: [], waiting: slots, full: false,
    }
  ));
}

/**
 * Contador de parceria repetida, no formato que `assignPlayTeams` espera.
 * Conta quantas vezes dois jogadores já ficaram do MESMO lado, com um peso
 * extra se isso aconteceu na partida imediatamente anterior.
 *
 * @param {object|null} history de `buildPlayHistory`
 * @returns {((a: string, b: string) => number)|null} null quando não há histórico
 */
export function makePartnerRepeatCounter(history) {
  if (!history) return null;
  return (a, b) => {
    if (!a || !b || a === b) return 0;
    const key = pairKey(a, b);
    const par = history.partner?.get(key) || 0;
    const seguidos = history.lastGameWith?.get(a)?.has(b) ? 0.5 : 0;
    return par + seguidos;
  };
}
