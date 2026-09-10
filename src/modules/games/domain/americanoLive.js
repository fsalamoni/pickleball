/**
 * AMERICANO APRIMORADO — lógica pura, sem I/O.
 *
 * É a mescla dos dois modelos que a plataforma já tinha:
 *
 *   ORGANIZAÇÃO ......... do Play (`gamePlay.js`)
 *     quadra a quadra, um jogo por vez, com fila de participação, pausa
 *     ("indisponível por X jogos") e dupla fixa. Ninguém entra em duas quadras
 *     ao mesmo tempo.
 *
 *   SORTEIO ............. do Americano (`clubs/domain/gameDayDraw.js`)
 *     quem forma dupla com quem, e contra quem, é decidido pelo MESMO motor do
 *     Americano — duplas inéditas primeiro, adversários inéditos depois, nível
 *     equilibrado por último. Não há uma segunda regra de pareamento aqui: se
 *     houvesse, as duas divergiriam na primeira vez que uma delas mudasse.
 *
 *   RESULTADO ........... do Americano
 *     cada partida grava placar, alimenta o ranking do dia e pode ir para o
 *     ranking/rating da plataforma e para o DUPR. (O Play não grava placar.)
 *
 * ## A diferença que dá nome ao formato
 *
 * O Americano sorteia RODADAS INTEIRAS de uma vez: todos os jogos já existem
 * antes de o dia começar, e quem chega atrasado ou sai no meio bagunça a grade.
 * Aqui os jogos nascem UM A UM, cada um com quem está disponível NAQUELE
 * momento — então entrar, sair, pausar e formar dupla no meio do dia são
 * situações normais, não exceções.
 *
 * A previsão do total de partidas existe, mas é REFERÊNCIA, não compromisso:
 * ela diz quantos jogos seriam necessários para todos jogarem com todos, e o
 * quanto já se andou nesse caminho.
 */
import {
  PLAY_SLOTS, PLAY_GAME_STATUS, computePlayOrder, buildPlayNextMatch,
  freePlayCourts, inCourtIdsFromGames,
} from './gamePlay.js';
import { buildDrawHistory, pairFourBalanced } from '@/modules/clubs/domain/gameDayDraw.js';

/** Quantos candidatos ALÉM dos 4 slots entram na janela de escolha. */
export const AMERICANO_LIVE_WINDOW_EXTRA = 4;

/**
 * Peso de descer na fila. Comparável ao custo do pareamento
 * (`pairFourBalanced`: repetir dupla custa 10, repetir adversário 3).
 * Em 2, pular uma posição na fila custa menos que repetir um adversário, e
 * MUITO menos que repetir uma dupla — então o motor troca ordem por variedade,
 * mas nunca cava fundo na fila para conseguir isso.
 */
export const AMERICANO_LIVE_ORDER_WEIGHT = 2;

/** Status de um jogo do formato (mesmo vocabulário do Play). */
export { PLAY_GAME_STATUS as AMERICANO_LIVE_GAME_STATUS };

const idsDoLado = (side) => (side || [])
  .map((x) => (typeof x === 'string' ? x : x?.id))
  .filter(Boolean);

/** Os quatro ids de um jogo, em ordem `side_a` + `side_b`. */
export function gameIds(game) {
  return [...idsDoLado(game?.side_a), ...idsDoLado(game?.side_b)];
}

/**
 * Quantas partidas seriam necessárias para TODOS formarem dupla com todos e
 * enfrentarem todos duas vezes.
 *
 * Com `n` atletas há `C(n,2)` duplas possíveis e cada jogo forma 2 delas, logo
 * `n(n-1)/4` jogos cobrem todas as parcerias. Cada jogo também cria 4
 * confrontos, e enfrentar todos DUAS vezes exige `2·C(n,2)` confrontos — que
 * dão exatamente o mesmo `n(n-1)/4`. Os dois objetivos custam o mesmo número
 * de partidas; é por isso que faz sentido persegui-los juntos.
 *
 * É uma referência do IDEAL. Na prática, gente entrando e saindo, pausas e
 * duplas fixas fazem o número real ser maior.
 */
export function suggestAmericanoLiveTotal(n) {
  const total = Math.floor(n) || 0;
  if (total < 4) return 0;
  return Math.ceil((total * (total - 1)) / 4);
}

/**
 * A visão do dia: quem está em quadra, quem aguarda (em ordem) e quem está
 * pausado. É exatamente a do Play — o modelo de participante é o mesmo.
 */
export function americanoLiveView({ participants = [], games = [] } = {}) {
  return computePlayOrder({ participants, games });
}

/** Parceiro MÚTUO de um participante, dentro do conjunto informado. */
function parceiroMutuo(p, porId) {
  if (!p?.partner_id) return null;
  const parceiro = porId.get(p.partner_id);
  return parceiro && parceiro.partner_id === p.id ? parceiro : null;
}

/**
 * O conjunto de 4 respeita as DUPLAS FIXAS?
 *
 * Duas regras, as mesmas do Play: quem tem parceiro mútuo disponível só entra
 * COM ele; quem tem parceiro declarado mas indisponível AGUARDA (não entra
 * sozinho).
 */
export function respectsFixedPairs(ids, availableOrdered) {
  const porId = new Map((availableOrdered || []).map((p) => [p.id, p]));
  const conjunto = new Set(ids);
  return ids.every((id) => {
    const p = porId.get(id);
    if (!p?.partner_id) return true;
    const parceiro = parceiroMutuo(p, porId);
    if (!parceiro) return false;            // parceiro fora da fila → aguarda
    return conjunto.has(parceiro.id);       // só entra junto
  });
}

/** Todas as combinações de `k` elementos de uma lista (k pequeno). */
function combinacoes(lista, k) {
  const saida = [];
  const atual = [];
  const passo = (inicio) => {
    if (atual.length === k) { saida.push([...atual]); return; }
    for (let i = inicio; i < lista.length; i += 1) {
      atual.push(lista[i]);
      passo(i + 1);
      atual.pop();
    }
  };
  passo(0);
  return saida;
}

/**
 * Sorteia A PRÓXIMA PARTIDA — uma só, para uma quadra.
 *
 * Como decide, em duas etapas separadas de propósito:
 *
 *  1. QUEM entra: a partir da fila de participação, dentro de uma janela curta
 *     (4 vagas + `windowExtra`). O primeiro elegível da fila entra SEMPRE — é o
 *     que impede alguém de ser pulado indefinidamente em nome da variedade.
 *  2. COMO se dividem: `pairFourBalanced`, o motor do Americano.
 *
 * O custo total soma o do pareamento (repetir dupla/adversário/desnível) ao de
 * descer na fila. Sem combinação válida na janela, cai no comportamento
 * estrito do Play (`buildPlayNextMatch`) — nunca fica sem jogo por causa da
 * otimização.
 *
 * @param {Array} availableOrdered  disponíveis, em ordem de participação
 * @param {{ games?: Array, levels?: object, rng?: function, slots?: number,
 *           windowExtra?: number, orderWeight?: number }} [opts]
 * @returns {{ side_a: string[], side_b: string[], ids: string[] }|null}
 */
export function drawNextAmericanoLiveMatch(availableOrdered, opts = {}) {
  const {
    games = [], levels = null, rng = Math.random, slots = PLAY_SLOTS,
    windowExtra = AMERICANO_LIVE_WINDOW_EXTRA,
    orderWeight = AMERICANO_LIVE_ORDER_WEIGHT,
  } = opts;

  const fila = (availableOrdered || []).filter(Boolean);
  if (fila.length < slots) return null;

  // Baseline: a escolha estrita por ordem. Serve de rede e define quem é o
  // primeiro elegível — que precisa estar no jogo aconteça o que acontecer.
  const estrita = buildPlayNextMatch(fila, { slots });
  if (!estrita) return null;
  const primeiro = estrita[0];

  const historico = buildDrawHistory(games || [], fila.map((p) => p.id));
  const posicao = new Map(fila.map((p, i) => [p.id, i]));
  const janela = fila.slice(0, slots + Math.max(0, windowExtra)).map((p) => p.id);

  let melhor = null;
  combinacoes(janela, slots).forEach((grupo) => {
    if (!grupo.includes(primeiro)) return;
    if (!respectsFixedPairs(grupo, fila)) return;
    const par = pairFourBalanced(grupo, { history: historico, levels, rng });
    const custoOrdem = grupo.reduce((acc, id) => acc + (posicao.get(id) ?? 0), 0);
    const custo = par.cost + orderWeight * custoOrdem;
    if (!melhor || custo < melhor.custo) {
      melhor = { custo, side_a: par.side_a, side_b: par.side_b, ids: grupo };
    }
  });

  if (melhor) {
    return { side_a: melhor.side_a, side_b: melhor.side_b, ids: melhor.ids };
  }
  // Rede: a escolha estrita do Play, pareada pelo motor do Americano.
  const par = pairFourBalanced(estrita, { history: historico, levels, rng });
  return { side_a: par.side_a, side_b: par.side_b, ids: estrita };
}

/**
 * PREVISÃO das próximas partidas, uma por quadra livre e depois pelas ocupadas
 * — a mesma ideia da previsão do Play: quem está jogando volta ao fim da fila
 * quando a partida termina, e disputa as vagas seguintes.
 *
 * A previsão das quadras OCUPADAS é CONDICIONAL: depende de qual partida
 * termina primeiro, e isso não dá para saber sem o placar. A hipótese é
 * "termina primeiro quem começou primeiro".
 *
 * @param {Array} [opts.participants] lista completa do dia, só para resolver o
 *   NOME de quem volta de uma quadra ocupada (essa gente não está na fila).
 * @returns {Array<{
 *   court: number, players: Array, conditional: boolean,
 *   side_a: string[], side_b: string[]
 * }>}
 */
export function forecastAmericanoLiveMatches(availableOrdered, opts = {}) {
  const {
    courts = 1, games = [], levels = null, rng = Math.random, slots = PLAY_SLOTS,
    participants = null,
  } = opts;
  const total = Math.max(1, Math.floor(courts) || 1);
  const livres = freePlayCourts({ courts: total, games });
  const livresSet = new Set(livres);
  const abertos = (games || [])
    .filter((g) => g?.status !== PLAY_GAME_STATUS.FINISHED && g?.court != null)
    .filter((g) => !livresSet.has(Number(g.court)))
    .sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));

  // `participants` é OPCIONAL e serve só para NOMEAR. Quem está em quadra não
  // está na fila e, portanto, não aparece em `availableOrdered` — sem esta
  // lista, a previsão condicional (a de quem volta ao terminar a partida)
  // mostraria o id cru no lugar do nome. A fila continua tendo a palavra final
  // sobre o estado de cada um: ela entra depois e sobrescreve.
  const porId = new Map([
    ...(participants || []).map((p) => [p.id, p]),
    ...(availableOrdered || []).map((p) => [p.id, p]),
  ]);
  let fila = (availableOrdered || []).slice();
  const jogosHipoteticos = [...(games || [])];
  const blocos = [];

  const escolher = (court, conditional) => {
    const escolha = drawNextAmericanoLiveMatch(fila, {
      games: jogosHipoteticos, levels, rng, slots,
    });
    if (!escolha) return false;
    const escolhidos = new Set(escolha.ids);
    blocos.push({
      court,
      conditional,
      players: escolha.ids.map((id) => porId.get(id) || { id }),
      side_a: escolha.side_a,
      side_b: escolha.side_b,
    });
    fila = fila.filter((p) => !escolhidos.has(p.id));
    jogosHipoteticos.push({ side_a: escolha.side_a, side_b: escolha.side_b });
    return true;
  };

  for (const court of livres) {
    if (!escolher(court, false)) return blocos;
  }
  for (const jogo of abertos) {
    const voltando = gameIds(jogo)
      .map((id) => porId.get(id) || { id, available_since: Number.MAX_SAFE_INTEGER })
      .filter(Boolean);
    voltando.forEach((p) => { if (!porId.has(p.id)) porId.set(p.id, p); });
    fila = [...fila, ...voltando.filter((p) => !fila.some((q) => q.id === p.id))];
    if (!escolher(Number(jogo.court), true)) break;
  }
  return blocos;
}

/**
 * O quanto o dia já andou rumo a "todos com todos, contra todos duas vezes".
 *
 * Serve para a tela dizer algo honesto ao organizador: quantas partidas já
 * saíram, quantas faltariam no ideal, e quais parcerias/confrontos ainda não
 * aconteceram. Não é um alvo obrigatório — é uma bússola.
 */
export function americanoLiveProgress({ participants = [], games = [] } = {}) {
  const ids = (participants || []).map((p) => p.id).filter(Boolean);
  const n = ids.length;
  const concluidos = (games || []).filter((g) => g?.status === PLAY_GAME_STATUS.FINISHED
    || (g?.score_a != null && g?.score_b != null));

  const duplas = new Set();
  const confrontos = new Map();
  const jogosPor = new Map(ids.map((id) => [id, 0]));

  (games || []).forEach((g) => {
    const a = idsDoLado(g?.side_a);
    const b = idsDoLado(g?.side_b);
    [a, b].forEach((lado) => {
      if (lado.length === 2) duplas.add([...lado].sort().join('|'));
    });
    a.forEach((x) => b.forEach((y) => {
      const k = [x, y].sort().join('|');
      confrontos.set(k, (confrontos.get(k) || 0) + 1);
    }));
    [...a, ...b].forEach((id) => {
      if (jogosPor.has(id)) jogosPor.set(id, jogosPor.get(id) + 1);
    });
  });

  const duplasPossiveis = n >= 2 ? (n * (n - 1)) / 2 : 0;
  const confrontosDuplicados = Array.from(confrontos.values()).filter((v) => v >= 2).length;
  const jogados = Array.from(jogosPor.values());

  return {
    participantes: n,
    partidasCriadas: (games || []).length,
    partidasConcluidas: concluidos.length,
    partidasPrevistas: suggestAmericanoLiveTotal(n),
    duplasFormadas: duplas.size,
    duplasPossiveis,
    confrontosCompletos: confrontosDuplicados,
    confrontosPossiveis: duplasPossiveis,
    jogosPorAtleta: jogosPor,
    minJogos: jogados.length ? Math.min(...jogados) : 0,
    maxJogos: jogados.length ? Math.max(...jogados) : 0,
  };
}

/** Ids que estão EM QUADRA agora — ninguém pode entrar em duas ao mesmo tempo. */
export { inCourtIdsFromGames as americanoLiveInCourtIds };
