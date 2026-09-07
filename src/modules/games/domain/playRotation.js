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

import { PLAY_SLOTS, buildPlayNextMatch, freePlayCourts } from './gamePlay.js';

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

/**
 * Previsão em blocos (um por quadra) usando o rodízio equilibrado. Espelha
 * `forecastPlayMatches` para o telão mostrar exatamente o que será criado.
 */
export function forecastPlayMatchesBalanced(availableOrdered, {
  courts = 1, slots = PLAY_SLOTS, history = null,
  windowExtra = ROTATION_WINDOW_EXTRA, weights = ROTATION_WEIGHTS,
} = {}) {
  const blocos = [];
  let restantes = (availableOrdered || []).slice();
  const maxQuadras = Math.max(1, courts);

  for (let c = 0; c < maxQuadras; c += 1) {
    if (restantes.length === 0) break;
    const ids = buildPlayNextMatchBalanced(restantes, { slots, history, windowExtra, weights });
    if (ids) {
      const escolhidos = new Set(ids);
      const players = ids.map((id) => restantes.find((p) => p.id === id)).filter(Boolean);
      blocos.push({ players, waiting: 0, full: true });
      restantes = restantes.filter((p) => !escolhidos.has(p.id));
    } else {
      const players = restantes.slice(0, slots);
      blocos.push({ players, waiting: Math.max(0, slots - players.length), full: false });
      break;
    }
  }
  return blocos;
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

/**
 * Previsão por QUADRA usando o rodízio equilibrado. Espelha
 * `forecastPlayByCourt` para o telão e o painel do organizador mostrarem
 * exatamente quem `createNextPlayGame` vai chamar — se a previsão divergisse
 * da criação, a tela estaria mentindo para quem organiza.
 */
export function forecastPlayByCourtBalanced(availableOrdered, {
  courts = 1, games = [], slots = PLAY_SLOTS, history = null,
  windowExtra = ROTATION_WINDOW_EXTRA, weights = ROTATION_WEIGHTS,
} = {}) {
  const total = Math.max(1, Math.floor(courts) || 1);
  const livres = freePlayCourts({ courts: total, games });
  const livresSet = new Set(livres);
  const ocupadas = [];
  for (let c = 1; c <= total; c += 1) if (!livresSet.has(c)) ocupadas.push(c);

  const ordemDeCriacao = [...livres, ...ocupadas];
  const blocos = forecastPlayMatchesBalanced(availableOrdered, {
    courts: total, slots, history, windowExtra, weights,
  });

  const porQuadra = new Map();
  ordemDeCriacao.forEach((court, i) => {
    const bloco = blocos[i];
    porQuadra.set(court, {
      court,
      free: livresSet.has(court),
      players: bloco ? bloco.players : [],
      waiting: bloco ? bloco.waiting : 0,
      full: bloco ? bloco.full : false,
    });
  });

  return Array.from({ length: total }, (_, i) => i + 1).map((court) => porQuadra.get(court));
}
