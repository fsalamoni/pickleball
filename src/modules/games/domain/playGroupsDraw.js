/**
 * O SORTEIO DENTRO DOS GRUPOS do Play (flag `play_groups`) — lógica pura.
 *
 * ## O que muda em relação ao Play de sempre
 *
 * Antes, `buildPlayNextMatch` olhava UMA fila. Agora cada grupo tem a sua, e o
 * sorteio de uma quadra faz duas perguntas, nesta ordem:
 *
 *  1. **Cada grupo** consegue montar uma partida? Sem regra, com o MESMO
 *     seletor de sempre (`buildPlayNextMatchBalanced`: FIFO, ou o rodízio
 *     equilibrado quando há histórico). Com regra (formação, diferença de
 *     nível), com uma busca que só aceita combinações que a respeitem.
 *  2. **Qual deles** ocupa a quadra? A política decide: por tempo de espera,
 *     revezamento ou prioridade.
 *
 * ## Quem espera há mais tempo e PODE jogar
 *
 * No Play, o primeiro elegível da fila entra sempre. Com regra exigida isso não
 * se sustenta ("a primeira da fila é a única mulher, a mista pede duas"), então
 * vale o primeiro que CONSEGUE formar partida. Quem ficou para trás sobe na
 * fila a cada partida — e `explainGroups` diz, na tela, por que ele ainda não
 * entrou.
 *
 * ## Exigir × preferir
 *
 * `strict`: sem combinação que respeite as regras, NÃO há partida. Sem `strict`:
 * tenta respeitar e, se não der, cai no seletor comum — a quadra não fica
 * parada por causa de uma preferência.
 *
 * ## Por que este arquivo é separado de `playRotation.js`
 *
 * `simulatePlaySequence` (a previsão) precisa chamar este sorteio, e este
 * sorteio precisa de peças de `playRotation.js`. Importar nos dois sentidos
 * daria um ciclo. Então a previsão recebe um **sorteador** (`makeGroupsDrawer`)
 * em vez de importar o sorteio: o mesmo objeto que o serviço usa para criar a
 * partida. **Previsão e criação nunca divergem porque são o mesmo código.**
 *
 * ⚠️ Nenhuma tela chama `pickGroupedMatch` diretamente. Ver
 * `src/core/guards/playGrupos.test.js`.
 */

import {
  buildPlayNextMatchBalanced, ROTATION_WEIGHTS, groupRepeatCost,
  combinacoes, comboRespeitaDuplas, isEligible, applyPlayEntryOrder,
} from './playRotation.js';
import { computePlayOrder, PLAY_SLOTS } from './gamePlay.js';
import { GAME_KIND, slotsForKind, withoutPartnerLinks } from './gameKind.js';
import {
  GROUP_FORMATION, GROUP_POLICY, NO_GROUP, groupById, groupIdOf, fitsFormation, fitsLevelGap,
  genderOfParticipant, applyGroupNumbers,
} from './playGroups.js';

/** O grupo implícito de quem não está em nenhum: livre, sem regra, qualquer quadra. */
const UNGROUPED = Object.freeze({
  id: null,
  name: 'Sem grupo',
  color: 'gray',
  level_min: null,
  level_max: null,
  gender: 'any',
  formation: GROUP_FORMATION.FREE,
  max_level_gap: null,
  strict: false,
  courts: [],
  fill: false,
  paused: false,
  join: 'open',
});

/** Quantos além das vagas entram na janela da busca com regras. */
const CONSTRAINED_EXTRA = 8;

const temRegra = (g) => g.formation !== GROUP_FORMATION.FREE || g.max_level_gap != null;

/* ------------------------------- peças internas ----------------------------- */

/** A fila quebrada por grupo, cada uma na ordem de espera. `null` = sem grupo. */
function partition(pool, config) {
  const mapa = new Map([...config.groups.map((g) => [g.id, []]), [null, []]]);
  pool.forEach((p) => mapa.get(groupIdOf(p, config)).push(p));
  return mapa;
}

/**
 * Dupla vinculada só vale DENTRO do grupo. Se o parceiro está na fila mas em
 * outro grupo, o vínculo é ignorado neste sorteio — senão a pessoa esperaria
 * para sempre por alguém que nunca estará na mesma lista. Parceiro que não está
 * na fila (em quadra, pausado) continua valendo: aí a pessoa aguarda, como
 * sempre aguardou.
 */
function semVinculoEntreGrupos(lista, grupoNaFila) {
  return lista.map((p) => (
    p.partner_id && grupoNaFila.has(p.partner_id) && grupoNaFila.get(p.partner_id) !== grupoNaFila.get(p.id)
      ? { ...p, partner_id: null }
      : p
  ));
}

function seletorComum(lista, o) {
  return buildPlayNextMatchBalanced(lista, {
    slots: o.slots, history: o.history ?? null, windowExtra: o.windowExtra, weights: o.weights,
  });
}

/**
 * A busca com regras: o primeiro da fila que CONSEGUE formar partida dentro
 * delas, com a combinação mais próxima do topo (e, havendo histórico, a que
 * menos repete encontros). Devolve ids ou null.
 */
function seletorComRegras(lista, g, o) {
  const pesos = o.weights || ROTATION_WEIGHTS;
  const porId = new Map(lista.map((p) => [p.id, p]));
  const janela = lista.slice(0, o.slots + CONSTRAINED_EXTRA);
  if (janela.length < o.slots) return null;

  for (let ancora = 0; ancora < janela.length; ancora += 1) {
    if (!isEligible(janela[ancora], porId)) continue;
    let melhor = null;
    for (const idx of combinacoes(janela.length, o.slots, ancora)) {
      const combo = idx.map((i) => janela[i]);
      if (!comboRespeitaDuplas(combo, porId)) continue;
      if (!fitsFormation(combo, g.formation) || !fitsLevelGap(combo, g.max_level_gap)) continue;
      const custo = idx.reduce((acc, i) => acc + i, 0) * pesos.order
        + (o.history ? groupRepeatCost(o.history, combo.map((p) => p.id), pesos) : 0);
      if (!melhor || custo < melhor.custo) melhor = { custo, idx };
    }
    if (melhor) return melhor.idx.slice().sort((a, b) => a - b).map((i) => janela[i].id);
  }
  return null;
}

/** A partida que UM grupo montaria com esta lista (ou null). */
function escolherNoGrupo(lista, g, o) {
  if (!temRegra(g)) return seletorComum(lista, o);
  const ids = seletorComRegras(lista, g, o);
  if (ids) return ids;
  return g.strict ? null : seletorComum(lista, o);
}

/**
 * A proposta de um grupo para a quadra: respeita pausa e quadras do grupo,
 * escolhe entre os seus e, se pode e precisa, completa com quem está sem grupo.
 *
 * @param {object} ctx `{ partes, grupoNaFila, court, slots, history, weights, windowExtra, ignorarQuadra }`
 */
function proporDoGrupo(g, ctx) {
  if (g.paused) return null;
  const forcado = ctx.forcado && ctx.forcado.id === g.id;
  if (!ctx.ignorarQuadra && !forcado && g.courts.length > 0 && !g.courts.includes(ctx.court)) return null;

  const membros = ctx.partes.get(g.id) || [];
  if (membros.length === 0) return null;

  const proprios = semVinculoEntreGrupos(membros, ctx.grupoNaFila);
  let ids = escolherNoGrupo(proprios, g, ctx);

  if (!ids && g.fill && g.id !== null) {
    const sobras = semVinculoEntreGrupos(ctx.partes.get(null) || [], ctx.grupoNaFila);
    if (sobras.length > 0) {
      // O grupo vem primeiro: quem completa é quem está sem grupo, nunca o contrário.
      const completo = escolherNoGrupo([...proprios, ...sobras], g, ctx);
      const deles = new Set(proprios.map((p) => p.id));
      if (completo && completo.some((id) => deles.has(id))) ids = completo;
    }
  }
  return ids ? { ids, groupId: g.id } : null;
}

/* --------------------------------- o sorteio -------------------------------- */

/**
 * Escolhe a partida de uma quadra DENTRO dos grupos.
 *
 * @param {Array} pool fila de quem está disponível, em ordem de espera
 * @param {object} o
 * @param {{ groups: object[], policy: string }} o.config
 * @param {number} o.court número da quadra
 * @param {number} o.slots jogadores da partida (4 nas duplas, 2 no simples)
 * @param {object|null} [o.history] histórico do rodízio equilibrado (ou null)
 * @param {object} [o.weights]
 * @param {number} [o.windowExtra]
 * @param {string|null|undefined} [o.lastGroupId] grupo da última partida (revezamento)
 * @param {string} [o.forceGroupId] grupo escolhido à mão para esta quadra
 *   (`NO_GROUP` para quem está sem grupo)
 * @returns {{ ids: string[], groupId: string|null }|null}
 */
export function pickGroupedMatch(pool, o) {
  const lista = (pool || []).filter(Boolean);
  const { config } = o;
  const partes = partition(lista, config);
  const grupoNaFila = new Map(lista.map((p) => [p.id, groupIdOf(p, config)]));
  const posicao = new Map(lista.map((p, i) => [p.id, i]));

  const todos = [...config.groups, UNGROUPED];
  let forcado = null;
  if (o.forceGroupId === NO_GROUP) forcado = UNGROUPED;
  else if (o.forceGroupId) forcado = groupById(config, o.forceGroupId);

  const ctx = {
    partes, grupoNaFila, court: o.court, slots: o.slots, history: o.history,
    weights: o.weights, windowExtra: o.windowExtra, forcado,
  };

  const propostas = [];
  todos.forEach((g, ordem) => {
    if (forcado && g.id !== forcado.id) return;
    const prop = proporDoGrupo(g, ctx);
    if (!prop) return;
    const deles = prop.ids.filter((id) => grupoNaFila.get(id) === g.id);
    const rank = Math.min(...(deles.length ? deles : prop.ids).map((id) => posicao.get(id)));
    propostas.push({ ...prop, ordem, rank });
  });
  if (propostas.length === 0) return null;

  let escolhida;
  const politica = config.policy;
  if (forcado) {
    [escolhida] = propostas;
  } else if (politica === GROUP_POLICY.PRIORITY) {
    escolhida = propostas.reduce((a, b) => (b.ordem < a.ordem ? b : a));
  } else if (politica === GROUP_POLICY.ROTATE) {
    const ordemIds = todos.map((g) => g.id);
    const ultimo = ordemIds.indexOf(o.lastGroupId === undefined ? undefined : o.lastGroupId);
    const inicio = o.lastGroupId === undefined || ultimo < 0 ? 0 : ultimo + 1;
    for (let k = 0; k < ordemIds.length && !escolhida; k += 1) {
      const gid = ordemIds[(inicio + k) % ordemIds.length];
      escolhida = propostas.find((p) => p.groupId === gid);
    }
  } else {
    escolhida = propostas.reduce((a, b) => (b.rank < a.rank ? b : a));
  }

  // Na ordem da fila: é como o resto do Play lê uma partida escolhida.
  const ids = escolhida.ids.slice().sort((a, b) => posicao.get(a) - posicao.get(b));
  return { ids, groupId: escolhida.groupId };
}

/**
 * O grupo da partida mais recente — é de onde o revezamento sabe de quem é a
 * vez. `null` quando a última foi de quem estava sem grupo; `undefined` quando
 * ainda não há partida (o revezamento começa pelo primeiro grupo).
 */
export function lastGroupIdFromGames(games) {
  const lista = (games || []).filter(Boolean);
  if (lista.length === 0) return undefined;
  const ultimo = lista.reduce((a, b) => ((Number(b.order) || 0) >= (Number(a.order) || 0) ? b : a));
  return ultimo.group_id ?? null;
}

/**
 * O SORTEADOR que a previsão (`simulatePlaySequence`) e o serviço compartilham.
 *
 * @param {{ groups: object[], policy: string }} config
 * @param {{ games?: Array, courtGroups?: Record<number,string>, participants?: Array }} [extras]
 *   `courtGroups`: o grupo escolhido à mão por quadra (vale só para esta conta);
 *   `participants`: todos os do dia, para quem volta de uma quadra ocupada
 *   voltar ao grupo certo (a fila de disponíveis não os tem)
 */
export function makeGroupsDrawer(config, { games = [], courtGroups = {}, participants = [] } = {}) {
  const porId = new Map((participants || []).filter(Boolean).map((p) => [p.id, p]));
  return {
    config,
    courtGroups: courtGroups || {},
    lastGroupId: lastGroupIdFromGames(games),
    /** Um participante pelo id — a previsão usa para devolver ao seu grupo quem está em quadra. */
    participant: (id) => porId.get(id) || null,
    pick(args) {
      const { pool, court, forceGroupId, ...resto } = args;
      return pickGroupedMatch(pool, {
        ...resto,
        config,
        court,
        forceGroupId: forceGroupId ?? (courtGroups || {})[court],
      });
    },
    meta(groupId) {
      const g = groupById(config, groupId);
      return g ? { id: g.id, name: g.name, color: g.color } : null;
    },
    pairingOf(groupId) {
      const g = groupById(config, groupId);
      if (g?.formation === GROUP_FORMATION.MIXED) return 'mixed';
      if (g?.formation === GROUP_FORMATION.SAME_SEX) return 'same_sex';
      return 'default';
    },
  };
}

/* ------------------------------- explicações -------------------------------- */

const plural = (n, um, varios) => (n === 1 ? um : varios);
const faltaFalta = (n) => (n === 1 ? 'Falta' : 'Faltam');

/** Por que uma proposta com regras não saiu — em linguagem de quadra. */
function motivoDoBloqueio(g, waiting, slots) {
  const sexos = waiting.map(genderOfParticipant);
  const homens = sexos.filter((s) => s === 'male').length;
  const mulheres = sexos.filter((s) => s === 'female').length;
  const semSexo = sexos.filter((s) => s == null).length;
  const nota = semSexo > 0 ? ` (${semSexo} sem sexo informado)` : '';

  if (g.formation === GROUP_FORMATION.MIXED) {
    const metade = slots / 2;
    const fh = Math.max(0, metade - homens);
    const fm = Math.max(0, metade - mulheres);
    if (fh + fm > 0) {
      const partes = [];
      if (fh > 0) partes.push(`${fh} ${plural(fh, 'homem', 'homens')}`);
      if (fm > 0) partes.push(`${fm} ${plural(fm, 'mulher', 'mulheres')}`);
      return `${faltaFalta(fh + fm)} ${partes.join(' e ')} para duplas mistas${nota}.`;
    }
  }
  if (g.formation === GROUP_FORMATION.SAME_SEX) {
    const falta = Math.max(0, slots - Math.max(homens, mulheres));
    if (falta > 0) {
      return `${faltaFalta(falta)} ${falta} do mesmo sexo para completar uma partida${nota}.`;
    }
  }
  if (g.max_level_gap != null) {
    return `A diferença de nível entre quem espera passa de ${g.max_level_gap.toFixed(1)} — não há quatro dentro do limite.`;
  }
  return 'As regras do grupo não fecham uma partida com quem está esperando.';
}

/**
 * O QUE ESTÁ ACONTECENDO com cada grupo agora — para o cartão dizer por que um
 * grupo não joga, em vez de deixar quem organiza adivinhar.
 *
 * `status`: `ready` (tem partida pronta), `short` (falta gente), `blocked`
 * (tem gente, mas as regras exigidas não fecham), `paused`, `empty` (ninguém
 * no grupo), `idle` (todos em quadra ou pausados), `no_court` (as quadras
 * livres não são dele).
 *
 * @param {{ view: { order: Array, inCourt: Array, unavailable: Array },
 *           config: object, slots?: number, freeCourts?: number[],
 *           history?: object|null, weights?: object, windowExtra?: number }} args
 */
export function explainGroups({
  view, config, slots = 4, freeCourts = null, history = null, weights, windowExtra,
}) {
  const pool = view?.order || [];
  const partes = partition(pool, config);
  const grupoNaFila = new Map(pool.map((p) => [p.id, groupIdOf(p, config)]));
  const contar = (lista, gid) => (lista || []).filter((p) => groupIdOf(p, config) === gid).length;
  const sobrasSemGrupo = (partes.get(null) || []).length;
  const ctx = {
    partes, grupoNaFila, court: null, slots, history, weights, windowExtra, ignorarQuadra: true,
  };

  const grupos = [...config.groups, UNGROUPED];
  return grupos.map((g) => {
    const waiting = (partes.get(g.id) || []);
    const inCourt = contar(view?.inCourt, g.id);
    const pausados = contar(view?.unavailable, g.id);
    const total = waiting.length + inCourt + pausados;
    const base = {
      id: g.id, name: g.name, color: g.color, total, waiting: waiting.length, inCourt, pausados,
      status: 'ready', missing: 0, reason: '', group: g,
    };

    if (g.id === null && total === 0) return null;
    if (g.paused) return { ...base, status: 'paused', reason: 'Grupo em pausa — fora do sorteio.' };
    if (total === 0) return { ...base, status: 'empty', reason: 'Ninguém neste grupo ainda.' };
    if (waiting.length === 0) {
      return {
        ...base, status: 'idle',
        reason: inCourt > 0 ? 'Todos estão em quadra ou em pausa.' : 'Todos estão em pausa.',
      };
    }
    if (freeCourts && freeCourts.length > 0 && g.courts.length > 0
      && !freeCourts.some((c) => g.courts.includes(c))) {
      return {
        ...base, status: 'no_court',
        reason: `As quadras livres agora não são deste grupo (ele joga ${g.courts.length === 1 ? 'na quadra' : 'nas quadras'} ${g.courts.join(', ')}).`,
      };
    }

    if (proporDoGrupo(g, ctx)) {
      const proprio = escolherNoGrupo(semVinculoEntreGrupos(waiting, grupoNaFila), g, ctx);
      return {
        ...base, status: 'ready',
        reason: proprio ? 'Pronto para a próxima quadra livre.' : 'Pronto — completa com quem está sem grupo.',
      };
    }

    const disponiveis = waiting.length + (g.fill && g.id !== null ? sobrasSemGrupo : 0);
    if (disponiveis < slots) {
      const falta = slots - disponiveis;
      return {
        ...base, status: 'short', missing: falta,
        reason: `${faltaFalta(falta)} ${falta} ${plural(falta, 'jogador', 'jogadores')}.`,
      };
    }
    return { ...base, status: 'blocked', reason: motivoDoBloqueio(g, waiting, slots) };
  }).filter(Boolean);
}

/**
 * A mensagem quando NENHUM grupo tem partida: o motivo de cada um que tem gente
 * esperando. Substitui o genérico "não há jogadores suficientes".
 */
export function describeNoMatch(explanations) {
  const comGente = (explanations || []).filter((e) => e.waiting > 0 && e.status !== 'ready');
  if (comGente.length === 0) return 'Ninguém aguardando no momento.';
  return `Nenhum grupo tem partida pronta. ${comGente.map((e) => `${e.name}: ${e.reason}`).join(' ')}`;
}

/* ----------------------------- a visão com grupos --------------------------- */

/**
 * A `view` do Play (`order`, `inCourt`, `unavailable`, `all`) com GRUPOS: a
 * ordem de entrada segue a política e cada fila tem a sua numeração
 * (`groupNo`), com o grupo de cada pessoa em `group_id`.
 *
 * É O lugar onde isso se monta — o painel do organizador, a visão do jogador e
 * o telão chamam esta função. Montar a visão por conta própria em cada tela é
 * como a previsão e a ordem exibida divergem sem erro nenhum.
 *
 * @param {object} args
 * @param {Array} args.participants já com o nível resolvido (`withLevels`)
 * @param {Array} args.games
 * @param {number} args.courts
 * @param {object|null} [args.history] histórico do rodízio equilibrado
 * @param {object|null} [args.courtKinds]
 * @param {object} args.drawer de `makeGroupsDrawer`
 */
export function buildGroupedPlayView({
  participants, games, courts, history = null, courtKinds = null, drawer,
}) {
  const bruto = computePlayOrder({ participants, games });
  const ordenado = applyPlayEntryOrder(bruto, {
    courts, games, history, courtKinds, groups: drawer,
  });
  return applyGroupNumbers(ordenado, drawer.config);
}

/**
 * Esta quadra tem partida PRONTA agora? É a pergunta do botão "Criar jogo" — e
 * responde pela mesma conta do serviço (`createNextPlayGame`): a fila inteira,
 * lida sem os vínculos de dupla se a quadra for de simples, com o grupo
 * escolhido à mão para ela quando houver. Contar gente na fila, como o Play sem
 * grupos faz, mentiria: com grupos pode haver oito esperando e nenhuma partida.
 *
 * @param {object} drawer de `makeGroupsDrawer`
 * @param {{ order: Array, court: number, kind?: string, history?: object|null }} args
 * @returns {boolean}
 */
export function courtHasMatch(drawer, { order, court, kind = GAME_KIND.DOUBLES, history = null }) {
  const singles = kind === GAME_KIND.SINGLES;
  const fila = singles ? withoutPartnerLinks(order || []) : (order || []);
  const vagas = singles ? slotsForKind(GAME_KIND.SINGLES) : PLAY_SLOTS;
  return !!drawer.pick({
    pool: fila, court, slots: vagas, history, lastGroupId: drawer.lastGroupId,
  });
}
