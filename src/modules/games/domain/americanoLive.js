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
import {
  GAME_KIND, gameKindOf, hasSinglesCourt, kindOfCourt, withoutPartnerLinks,
} from './gameKind.js';

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
 * As DUPLAS VINCULADAS presentes num grupo de ids, no formato que
 * `pairFourBalanced` espera (`[[a, b], …]`).
 *
 * Existe porque o motor do Americano recebe IDS, não participantes: ele não
 * tem como saber quem está vinculado a quem. Sem esta ponte, o vínculo era
 * respeitado ao escolher QUEM joga (`respectsFixedPairs`) e ignorado ao
 * decidir os LADOS — a dupla entrava na mesma partida e saía uma contra a
 * outra, que foi o defeito relatado.
 *
 * @param {string[]} ids            os quatro escolhidos
 * @param {Map|Array} participantes fila ou mapa `id → participante`
 */
export function fixedPairsWithin(ids = [], participantes = []) {
  const porId = participantes instanceof Map
    ? participantes
    : new Map((participantes || []).filter(Boolean).map((p) => [p.id, p]));
  const dentro = new Set(ids);
  const pares = [];
  const vistos = new Set();
  ids.forEach((id) => {
    if (vistos.has(id)) return;
    const p = porId.get(id);
    const parceiro = p ? parceiroMutuo(p, porId) : null;
    if (!parceiro || !dentro.has(parceiro.id)) return;
    vistos.add(id);
    vistos.add(parceiro.id);
    pares.push([id, parceiro.id]);
  });
  return pares;
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
  // Jogo SIMPLES (Onda CF): caminho próprio, porque a conta é outra — não há
  // dupla a formar, só um adversário a escolher.
  if (opts.kind === GAME_KIND.SINGLES) return drawNextSinglesLiveMatch(availableOrdered, opts);
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
    const par = pairFourBalanced(grupo, {
      history: historico, levels, rng, fixedPairs: fixedPairsWithin(grupo, fila),
    });
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
  const par = pairFourBalanced(estrita, {
    history: historico, levels, rng, fixedPairs: fixedPairsWithin(estrita, fila),
  });
  return { side_a: par.side_a, side_b: par.side_b, ids: estrita };
}

/** Repetir o MESMO adversário no simples: o que mais se quer evitar. */
export const AMERICANO_LIVE_SINGLES_REPEAT_WEIGHT = 10;
/** Desnível no simples, por ponto da régua 2.0–8.0 (o mesmo peso das duplas). */
const SINGLES_LEVEL_WEIGHT = 2;

const chaveDoPar = (a, b) => (String(a) < String(b) ? `${a}|${b}` : `${b}|${a}`);

/** Quantas vezes cada par já se enfrentou em jogo SIMPLES. */
function confrontosDeSimples(games = []) {
  const mapa = new Map();
  (games || []).forEach((g) => {
    if (!g || gameKindOf(g) !== GAME_KIND.SINGLES) return;
    const [a] = idsDoLado(g.side_a);
    const [b] = idsDoLado(g.side_b);
    if (!a || !b) return;
    const k = chaveDoPar(a, b);
    mapa.set(k, (mapa.get(k) || 0) + 1);
  });
  return mapa;
}

/**
 * A próxima partida SIMPLES (1 × 1) — Onda CF.
 *
 * A mesma filosofia das duplas, com a conta de dois:
 *
 *  1. o PRIMEIRO da fila joga sempre (ninguém é pulado em nome da variedade);
 *  2. o adversário sai de uma janela curta logo atrás dele, e o escolhido é o
 *     que MENOS repete confronto de simples, com nível mais parecido e mais
 *     perto do topo da fila — nessa ordem de peso: repetir adversário (10)
 *     pesa mais que descer várias posições (2 cada) e que o desnível (2 por
 *     ponto).
 *
 * A dupla vinculada não vale no simples: a fila é lida sem os vínculos.
 *
 * @returns {{ side_a: string[], side_b: string[], ids: string[] }|null}
 */
function drawNextSinglesLiveMatch(availableOrdered, opts = {}) {
  const {
    games = [], levels = null, rng = Math.random,
    windowExtra = AMERICANO_LIVE_WINDOW_EXTRA,
    orderWeight = AMERICANO_LIVE_ORDER_WEIGHT,
  } = opts;
  const fila = withoutPartnerLinks((availableOrdered || []).filter(Boolean));
  if (fila.length < 2) return null;

  const primeiro = fila[0].id;
  const repetidos = confrontosDeSimples(games);
  const nivel = (id) => {
    const v = levels ? levels[id] : null;
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const nivelDoPrimeiro = nivel(primeiro);

  let melhor = null;
  fila.slice(1, 2 + Math.max(0, windowExtra)).forEach((p, i) => {
    const nv = nivel(p.id);
    const desnivel = nivelDoPrimeiro != null && nv != null ? Math.abs(nivelDoPrimeiro - nv) : 0;
    const custo = AMERICANO_LIVE_SINGLES_REPEAT_WEIGHT * (repetidos.get(chaveDoPar(primeiro, p.id)) || 0)
      + SINGLES_LEVEL_WEIGHT * desnivel
      + orderWeight * (i + 1)
      + rng() * 0.001;
    if (!melhor || custo < melhor.custo) melhor = { custo, id: p.id };
  });

  return { side_a: [primeiro], side_b: [melhor.id], ids: [primeiro, melhor.id] };
}

/**
 * A RODADA INTEIRA de uma vez: a melhor divisão da fila em `k` grupos de 4,
 * um por quadra livre.
 *
 * ## Por que isto existe
 *
 * Sortear quadra a quadra é GULOSO: a primeira quadra fica com o melhor grupo
 * possível e a segunda herda o que sobrou. Com 8 na fila e 2 quadras, escolher
 * os 4 da quadra 1 já DETERMINA os 4 da quadra 2 — e o custo do grupo que
 * sobra não entrou em conta nenhuma. Medido em simulação de um dia inteiro
 * (elenco estável, 8 atletas, 2 quadras, 16 partidas): guloso formava
 * **12 das 28 duplas possíveis**; a rodada otimizada em conjunto forma 26.
 *
 * ## Por que os grupos podem ser avaliados separadamente
 *
 * Os grupos de uma rodada são DISJUNTOS: as duplas e os confrontos que a
 * quadra 1 cria envolvem só gente da quadra 1. Então o custo da rodada é a
 * soma dos custos dos grupos sobre o MESMO histórico — não há interação para
 * modelar, e a otimização vira uma partição de custo aditivo.
 *
 * ## Como escolhe
 *
 * 1. SEMENTE: exatamente o sorteio guloso de hoje (que já respeita duplas
 *    fixas e o primeiro elegível da fila). Assim a rodada nunca sai pior que
 *    a de antes.
 * 2. MELHORIA: trocas de dois em dois — um jogador de um grupo por um de
 *    outro, ou por alguém que ficou de fora — enquanto baixarem o custo total.
 *    A busca para quando nenhuma troca melhora.
 *
 * Restrições que NENHUMA troca pode violar: duplas fixas em cada grupo, o
 * primeiro elegível da fila continua jogando, e a FRENTE da fila continua
 * dentro da rodada — juntas, são o que impede que a busca por variedade
 * empurre sempre a mesma pessoa para fora.
 *
 * @returns {Array<string[]>|null} `k` grupos de ids, ou null se não dá rodada.
 */
function bestAmericanoLiveRound(fila, k, opts = {}) {
  const {
    games = [], levels = null, rng = Math.random, slots = PLAY_SLOTS,
    windowExtra = AMERICANO_LIVE_WINDOW_EXTRA,
    orderWeight = AMERICANO_LIVE_ORDER_WEIGHT,
  } = opts;
  if (k < 1 || fila.length < k * slots) return null;

  // Semente: o sorteio de hoje, quadra a quadra.
  let restante = fila.slice();
  const jogosHipoteticos = [...(games || [])];
  const grupos = [];
  for (let i = 0; i < k; i += 1) {
    const escolha = drawNextAmericanoLiveMatch(restante, {
      games: jogosHipoteticos, levels, rng, slots, windowExtra, orderWeight,
    });
    if (!escolha) return null;
    grupos.push(escolha.ids.slice());
    const dentro = new Set(escolha.ids);
    restante = restante.filter((p) => !dentro.has(p.id));
    jogosHipoteticos.push({ side_a: escolha.side_a, side_b: escolha.side_b });
  }
  if (k === 1) return grupos;

  // Daqui para baixo, a rodada é avaliada como um todo. O histórico é UM só
  // (os grupos são disjuntos, então não há efeito de um sobre o outro) e a
  // posição na fila é a de `fila`, não a da fila que ia encolhendo.
  const historico = buildDrawHistory(games || [], fila.map((p) => p.id));
  const posicao = new Map(fila.map((p, i) => [p.id, i]));
  const primeiroElegivel = (buildPlayNextMatch(fila, { slots }) || [])[0] || null;
  // Janela: os `k*slots` da frente mais uma folga. Fora dela ninguém entra —
  // mesma regra do sorteio de uma quadra, só que dimensionada para a rodada.
  const janela = fila.slice(0, k * slots + Math.max(0, windowExtra)).map((p) => p.id);
  // FRENTE DA FILA: quem está esperando há mais tempo joga esta rodada, ponto.
  // Sem isto, trazer alguém do fundo para desfazer uma repetição empurra um
  // dos primeiros para fora — e repetido ao longo da noite isso vira gente com
  // partidas a menos que os outros. A rodada tem `k*slots` vagas e a folga de
  // escolha é `windowExtra`; o resto da frente é obrigatório.
  //
  // Filtrado pelo que a SEMENTE já escolheu: se uma dupla fixa deixou alguém
  // da frente de fora, a restrição não pode travar a busca inteira — ela existe
  // para não DESFAZER o que o sorteio guloso já garantiu, não para exigir o
  // impossível.
  const naSemente = new Set(grupos.flat());
  const obrigatorios = fila
    .slice(0, Math.max(0, k * slots - Math.max(0, windowExtra)))
    .map((p) => p.id)
    .filter((id) => naSemente.has(id));

  const memo = new Map();
  const custoGrupo = (grupo) => {
    const chave = [...grupo].sort().join('|');
    if (memo.has(chave)) return memo.get(chave);
    const par = pairFourBalanced(grupo, {
      history: historico, levels, rng, fixedPairs: fixedPairsWithin(grupo, fila),
    });
    memo.set(chave, par.cost);
    return par.cost;
  };
  const custoOrdem = (grupo) => grupo.reduce((acc, id) => acc + (posicao.get(id) ?? 0), 0);
  const custoTotal = (gs) => gs.reduce(
    (acc, g) => acc + custoGrupo(g) + orderWeight * custoOrdem(g), 0,
  );

  const valido = (grupo) => respectsFixedPairs(grupo, fila);
  let atual = grupos.map((g) => g.slice());
  let melhorCusto = custoTotal(atual);

  // Quem está na janela e ficou de fora da rodada: candidato a entrar numa
  // troca. É o que permite trazer alguém do fundo da fila quando ele desfaz
  // uma repetição — e o custo de ordem é quem decide se compensa.
  const forasDe = (gs) => {
    const dentro = new Set(gs.flat());
    return janela.filter((id) => !dentro.has(id));
  };

  const MAX_PASSOS = 200;
  for (let passo = 0; passo < MAX_PASSOS; passo += 1) {
    let melhorTroca = null;
    const fora = forasDe(atual);

    const avaliar = (i, xi, j, yj) => {
      const gi = atual[i].slice();
      const alvo = j == null ? null : atual[j].slice();
      const x = gi[xi];
      const y = j == null ? fora[yj] : alvo[yj];
      gi[xi] = y;
      if (alvo) alvo[yj] = x;
      if (!valido(gi) || (alvo && !valido(alvo))) return;
      const dentro = new Set(atual.flatMap((g, idx) => {
        if (idx === i) return gi;
        if (idx === j) return alvo;
        return g;
      }));
      if (primeiroElegivel && !dentro.has(primeiroElegivel)) return;
      if (obrigatorios.some((id) => !dentro.has(id))) return;
      const antes = custoGrupo(atual[i]) + orderWeight * custoOrdem(atual[i])
        + (alvo ? custoGrupo(atual[j]) + orderWeight * custoOrdem(atual[j]) : 0);
      const depois = custoGrupo(gi) + orderWeight * custoOrdem(gi)
        + (alvo ? custoGrupo(alvo) + orderWeight * custoOrdem(alvo) : 0);
      const delta = depois - antes;
      // A folga de 1e-9 evita ficar trocando para sempre por causa do
      // desempate aleatório de `pairFourBalanced` (que vale 0,001).
      if (delta < -1e-9 && (!melhorTroca || delta < melhorTroca.delta)) {
        melhorTroca = { delta, i, j, gi, alvo };
      }
    };

    for (let i = 0; i < atual.length; i += 1) {
      for (let xi = 0; xi < atual[i].length; xi += 1) {
        for (let j = i + 1; j < atual.length; j += 1) {
          for (let yj = 0; yj < atual[j].length; yj += 1) avaliar(i, xi, j, yj);
        }
        // `fora` já vem da janela: quem está além dela não entra por troca.
        for (let yj = 0; yj < fora.length; yj += 1) avaliar(i, xi, null, yj);
      }
    }

    if (!melhorTroca) break;
    const proximo = atual.map((g) => g.slice());
    proximo[melhorTroca.i] = melhorTroca.gi;
    if (melhorTroca.alvo) proximo[melhorTroca.j] = melhorTroca.alvo;
    const custo = custoTotal(proximo);
    if (custo >= melhorCusto - 1e-9) break;
    atual = proximo;
    melhorCusto = custo;
  }

  // A quadra da frente fica com o grupo de quem está esperando há mais tempo.
  return atual
    .map((g) => ({ g, chave: Math.min(...g.map((id) => posicao.get(id) ?? 0)) }))
    .sort((a, b) => a.chave - b.chave)
    .map((x) => x.g);
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
    participants = null, courtKinds = null,
  } = opts;
  const total = Math.max(1, Math.floor(courts) || 1);
  const tipoDa = (court) => (courtKinds ? kindOfCourt(courtKinds, court) : GAME_KIND.DOUBLES);
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

  const registrar = (court, conditional, ids) => {
    const par = pairFourBalanced(ids, {
      history: buildDrawHistory(jogosHipoteticos, ids), levels, rng,
      fixedPairs: fixedPairsWithin(ids, porId),
    });
    blocos.push({
      court,
      conditional,
      kind: GAME_KIND.DOUBLES,
      players: ids.map((id) => porId.get(id) || { id }),
      side_a: par.side_a,
      side_b: par.side_b,
    });
    const dentro = new Set(ids);
    fila = fila.filter((p) => !dentro.has(p.id));
    jogosHipoteticos.push({ side_a: par.side_a, side_b: par.side_b });
  };

  const escolher = (court, conditional) => {
    const kind = tipoDa(court);
    const escolha = drawNextAmericanoLiveMatch(fila, {
      games: jogosHipoteticos, levels, rng, slots, kind,
    });
    if (!escolha) return false;
    const escolhidos = new Set(escolha.ids);
    blocos.push({
      court,
      conditional,
      kind,
      players: escolha.ids.map((id) => porId.get(id) || { id }),
      side_a: escolha.side_a,
      side_b: escolha.side_b,
    });
    fila = fila.filter((p) => !escolhidos.has(p.id));
    jogosHipoteticos.push({ side_a: escolha.side_a, side_b: escolha.side_b });
    return true;
  };

  // AS QUADRAS LIVRES SAEM JUNTAS. Com duas ou mais, escolher uma de cada vez
  // é guloso: a primeira leva o melhor grupo e a última herda o que sobrou —
  // e com 8 na fila e 2 quadras a segunda nem tem escolha. `bestAmericanoLiveRound`
  // olha a rodada inteira. Com uma quadra livre só (ou sem rodada possível), o
  // caminho continua sendo exatamente o de antes, partida a partida.
  if (courtKinds && hasSinglesCourt(courtKinds)) {
    // QUADRAS DE TIPOS DIFERENTES (Onda CF). As de DUPLAS saem primeiro, como
    // rodada (a mesma otimização de sempre, só sobre elas); depois as de
    // SIMPLES, uma a uma, com quem sobrou. Uma quadra que não fecha não
    // impede a outra: três na fila não enchem as duplas, mas dão um simples.
    const livresDuplas = livres.filter((c) => tipoDa(c) === GAME_KIND.DOUBLES);
    const livresSimples = livres.filter((c) => tipoDa(c) === GAME_KIND.SINGLES);
    let todasCheias = true;
    const nDuplas = Math.min(livresDuplas.length, Math.floor(fila.length / slots));
    const rodadaDuplas = nDuplas >= 2
      ? bestAmericanoLiveRound(fila, nDuplas, { games: jogosHipoteticos, levels, rng, slots })
      : null;
    if (rodadaDuplas) {
      rodadaDuplas.forEach((ids, i) => registrar(livresDuplas[i], false, ids));
      if (rodadaDuplas.length < livresDuplas.length) todasCheias = false;
    } else {
      for (const court of livresDuplas) {
        if (!escolher(court, false)) { todasCheias = false; break; }
      }
    }
    for (const court of livresSimples) {
      if (!escolher(court, false)) { todasCheias = false; break; }
    }
    if (!todasCheias) return blocos;
  } else {
    const quadrasDaRodada = Math.min(livres.length, Math.floor(fila.length / slots));
    const rodada = quadrasDaRodada >= 2
      ? bestAmericanoLiveRound(fila, quadrasDaRodada, {
        games: jogosHipoteticos, levels, rng, slots,
      })
      : null;
    if (rodada) {
      rodada.forEach((ids, i) => registrar(livres[i], false, ids));
    } else {
      for (const court of livres) {
        if (!escolher(court, false)) return blocos;
      }
    }
    // Sobrou quadra livre sem gente para encher? A previsão simplesmente para
    // ali — meia partida não existe.
    if (rodada && rodada.length < livres.length) return blocos;
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
 * As próximas partidas de TODAS as quadras livres do Americano aprimorado,
 * sorteadas DE UMA VEZ — mesma ideia (e mesmo motivo) de
 * `drawPlayRoundForFreeCourts`: com 8 jogadores em 2 quadras, sortear uma
 * quadra por vez devolve sempre os mesmos 4 para a mesma quadra.
 *
 * Sai de `forecastAmericanoLiveMatches`, que é a previsão da tela: o que se
 * anuncia é o que se cria. As duplas já vêm pareadas pelo motor do Americano.
 *
 * @returns {Array<{ court:number, ids:string[], side_a:string[], side_b:string[] }>}
 *   só as quadras LIVRES (a previsão das ocupadas é condicional).
 */
export function drawAmericanoLiveRoundForFreeCourts(availableOrdered, opts = {}) {
  return forecastAmericanoLiveMatches(availableOrdered, opts)
    .filter((b) => !b.conditional)
    .map((b) => ({
      court: b.court,
      kind: b.kind,
      ids: b.players.map((p) => p.id),
      side_a: b.side_a,
      side_b: b.side_b,
    }));
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
    // A bússola é a do AMERICANO: todos com todos, contra todos duas vezes —
    // em DUPLAS. Um jogo simples conta como partida jogada, mas não forma
    // dupla nem soma confronto de duplas (Onda CF).
    if (gameKindOf(g) === GAME_KIND.DOUBLES) {
      [a, b].forEach((lado) => {
        if (lado.length === 2) duplas.add([...lado].sort().join('|'));
      });
      a.forEach((x) => b.forEach((y) => {
        const k = [x, y].sort().join('|');
        confrontos.set(k, (confrontos.get(k) || 0) + 1);
      }));
    }
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
