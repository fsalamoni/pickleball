/**
 * Sorteio de jogos para o "Dia de jogo" de um clube.
 *
 * Diferente do Americano de torneio (que exige N ≡ 0 ou 1 mod 4 e garante
 * cobertura EXATA de parcerias), aqui o objetivo é prático e flexível:
 *
 *  - Funciona com QUALQUER número de participantes (N ≥ 4).
 *  - Segue a mesma lógica/estrutura do Americano (jogos de duplas 2×2, todos
 *    rodando), priorizando parcerias e adversários inéditos.
 *  - É PERMITIDA a repetição de duplas e de adversários, mas só "depois de
 *    esgotadas as possibilidades normais": o motor sempre escolhe as
 *    combinações com menos repetições primeiro.
 *  - Equilibra a PARTICIPAÇÃO: em cada rodada quem menos jogou entra em quadra,
 *    e quem mais jogou descansa (quando N não é múltiplo de 4). O descanso
 *    circula de forma justa.
 *  - Equilibra o NÍVEL (quando conhecido, via `levels`): prefere quadras com
 *    atletas de força parecida e, dentro de cada quadra, a formação de duplas
 *    que deixa os dois lados mais próximos. É um critério TERCIÁRIO: pesa
 *    menos que repetir parceria e menos que repetir adversário, então nunca
 *    troca um jogo inédito por um jogo repetido só para equilibrar nível.
 *
 * Determinístico dada a seed (reprodutível ao re-sortear com a mesma seed).
 */

/* RNG determinístico (mulberry32 semeado por string) — auto-contido. */
function seededRng(seed = 'gameday') {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Teto de rodadas sugeridas quando há fila (menos quadras que grupos de 4). */
const MAX_SUGGESTED_ROUNDS = 30;

/**
 * Normaliza o nº de QUADRAS SIMULTÂNEAS de um sorteio.
 *
 * O limite físico é `maxByPlayers` (= ⌊n/4⌋): não há como abrir mais jogos
 * simultâneos do que grupos de 4 disponíveis. Valor ausente/inválido significa
 * "automático" → usa o máximo, que é exatamente o comportamento histórico
 * (todos jogam em todas as rodadas quando n é múltiplo de 4).
 *
 * @param {number|null|undefined} value  quadras informadas pelo organizador
 * @param {number} maxByPlayers  ⌊n/4⌋
 * @returns {number} quadras efetivas (>= 1)
 */
export function normalizeDrawCourts(value, maxByPlayers) {
  const cap = Math.max(1, Math.floor(maxByPlayers) || 1);
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return cap;
  return Math.min(cap, n);
}

/**
 * Normaliza um lado (side_a/side_b) para uma lista de ids de participante.
 * Aceita tanto o shape do Firestore (`[{ id, name }]`) quanto ids "crus"
 * (`['id1', 'id2']`) — os dois convivem no código.
 * @param {Array} side
 * @returns {string[]}
 */
function sideIds(side) {
  return (side || [])
    .map((e) => (e && typeof e === 'object' ? e.id : e))
    .filter(Boolean);
}

/**
 * Constrói o "histórico" do dia de jogo a partir dos jogos MANTIDOS (os que já
 * têm resultado e, quando o organizador não os substitui, também os sem
 * resultado). Serve para que um novo sorteio ADITIVO leve em conta o que já
 * aconteceu no dia:
 *  - as DUPLAS já formadas (para evitar repetir parcerias);
 *  - os ADVERSÁRIOS já enfrentados (para evitar repetir confrontos);
 *  - o nº de PARTIDAS já disputadas por cada atleta e o nº de RODADAS em que
 *    cada um esteve presente — para equilibrar a participação por TAXA (jogos
 *    por rodada presente), respeitando o momento em que cada um entrou.
 *
 * Só considera ids que estão em `currentIds` (participantes atuais do sorteio);
 * duplas/confrontos com atletas que já saíram são ignorados, pois eles não
 * voltam ao sorteio. A "rodada de entrada" de cada atleta é a primeira rodada
 * numerada em que ele aparece; as "rodadas presentes" são as rodadas existentes
 * a partir dela (aproximação segura derivada só dos jogos, sem novo schema).
 *
 * @param {Array} keptGames  jogos mantidos (`side_a`/`side_b` = `[{id}]` ou `[id]`)
 * @param {string[]} currentIds  ids dos participantes que entram no novo sorteio
 * @param {{ formationGames?: Array }} [options]
 *   `formationGames`: jogos considerados para EVITAR repetir duplas/adversários
 *   — normalmente TODOS os jogos do dia, inclusive os que serão substituídos.
 *   A participação (jogos/rodadas) continua vindo só de `keptGames`. Ausente,
 *   usa os próprios `keptGames` (comportamento anterior).
 * @returns {{ partner: Map<string,number>, opp: Map<string,number>,
 *             played: Map<string,number>, present: Map<string,number> }}
 */
export function buildDrawHistory(keptGames = [], currentIds = [], options = {}) {
  const current = new Set((currentIds || []).filter(Boolean));
  const partner = new Map();
  const opp = new Map();
  const played = new Map();
  const firstRound = new Map(); // id -> primeira rodada em que aparece
  const roundSet = new Set(); // todas as rodadas numeradas existentes

  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

  // MEMÓRIA DE FORMAÇÕES (duplas/adversários) × PARTICIPAÇÃO (jogos/rodadas).
  // São coisas diferentes: ao RE-SORTEAR substituindo os jogos sem resultado,
  // aqueles jogos não aconteceram (não contam participação), mas as duplas que
  // eles formaram devem ser EVITADAS — senão o novo sorteio repete exatamente
  // as parcerias que o organizador quis trocar. Por isso `formationGames`
  // (default: os próprios mantidos) alimenta parcerias/adversários, enquanto
  // `keptGames` alimenta jogos disputados e rodadas presentes.
  const { formationGames = null } = options;
  const pairSource = Array.isArray(formationGames) ? formationGames : keptGames;

  (pairSource || []).forEach((g) => {
    const a = sideIds(g?.side_a);
    const b = sideIds(g?.side_b);

    // Parcerias (duplas) — pares dentro de cada lado.
    [a, b].forEach((side) => {
      for (let i = 0; i < side.length; i += 1) {
        for (let j = i + 1; j < side.length; j += 1) {
          if (current.has(side[i]) && current.has(side[j])) bump(partner, pairKey(side[i], side[j]));
        }
      }
    });
    // Adversários — cruzando os dois lados.
    a.forEach((x) => b.forEach((y) => {
      if (current.has(x) && current.has(y)) bump(opp, pairKey(x, y));
    }));
  });

  (keptGames || []).forEach((g) => {
    const a = sideIds(g?.side_a);
    const b = sideIds(g?.side_b);
    const r = Number.isFinite(g?.round) ? g.round : null;
    if (r != null) roundSet.add(r);

    // Partidas disputadas e rodada de entrada (só participantes atuais).
    [...a, ...b].forEach((id) => {
      if (!current.has(id)) return;
      bump(played, id);
      if (r != null && (!firstRound.has(id) || r < firstRound.get(id))) firstRound.set(id, r);
    });
  });

  // Rodadas presentes por atleta = nº de rodadas existentes a partir da entrada.
  const rounds = Array.from(roundSet);
  const present = new Map();
  current.forEach((id) => {
    const entry = firstRound.get(id);
    const playedN = played.get(id) || 0;
    if (entry == null) { present.set(id, playedN); return; }
    let count = 0;
    for (const r of rounds) if (r >= entry) count += 1;
    // present >= played sempre (jogos avulsos sem rodada não distorcem a taxa).
    present.set(id, Math.max(count, playedN));
  });

  return { partner, opp, played, present };
}

/**
 * Semeia os contadores internos do sorteio (índice-a-índice) a partir do
 * histórico (id-a-id) devolvido por {@link buildDrawHistory}:
 *  - parcerias e adversários já ocorridos (para o motor evitá-los primeiro);
 *  - o "déficit de participação" inicial de cada jogador, dado por
 *    `played - taxaGlobal * present`, onde `taxaGlobal = Σplayed / Σpresent`.
 *
 * Assim, quem está ABAIXO da sua taxa justa de jogos (considerando o tempo que
 * esteve presente) começa com déficit negativo e entra em quadra primeiro nas
 * novas rodadas; quem está ACIMA descansa primeiro. Isso equilibra a
 * participação por TAXA — sem forçar quem entrou tarde a igualar o TOTAL de
 * quem entrou desde o início. Sem histórico, todos começam em 0 (comportamento
 * idêntico ao sorteio original).
 */
function seedFromHistory(history, ids, idToIndex, gamesPlayed, partnerCount, oppCount) {
  const translatePairs = (srcMap, dstMap) => {
    (srcMap || new Map()).forEach((count, key) => {
      const [x, y] = key.split('|');
      const ix = idToIndex.get(x);
      const iy = idToIndex.get(y);
      if (ix == null || iy == null) return; // par com atleta que saiu: ignora
      const k = pairKey(ix, iy);
      dstMap.set(k, (dstMap.get(k) || 0) + count);
    });
  };
  translatePairs(history.partner, partnerCount);
  translatePairs(history.opp, oppCount);

  let sumPlayed = 0;
  let sumPresent = 0;
  ids.forEach((id) => {
    sumPlayed += history.played?.get(id) || 0;
    sumPresent += history.present?.get(id) || 0;
  });
  const rate = sumPresent > 0 ? sumPlayed / sumPresent : 0;
  ids.forEach((id, i) => {
    const played = history.played?.get(id) || 0;
    const present = history.present?.get(id) || 0;
    gamesPlayed[i] = played - rate * present; // déficit (pode ser fracionário)
  });
}

/**
 * Ordena por nível com um ruído pequeno, para as tentativas variarem entre si
 * sem perder o agrupamento por força.
 *
 * Quem não tem nível conhecido recebe a MEDIANA do grupo: assim ele cai no
 * meio da tabela em vez de ser empurrado sistematicamente para uma das pontas
 * (o que aconteceria se tratássemos "sem nível" como 0 ou como o máximo).
 */
function orderByLevelWithJitter(playing, levelOf, rng) {
  const conhecidos = playing.map(levelOf).filter((v) => v != null).sort((a, b) => a - b);
  const mediana = conhecidos.length === 0
    ? 0
    : (conhecidos.length % 2
      ? conhecidos[(conhecidos.length - 1) / 2]
      : (conhecidos[conhecidos.length / 2 - 1] + conhecidos[conhecidos.length / 2]) / 2);
  // O ruído é ~0.25 de ponto: suficiente para trocar vizinhos de posição,
  // pequeno demais para misturar um 3.0 com um 5.0.
  return playing
    .map((p) => {
      const v = levelOf(p);
      return { p, key: (v == null ? mediana : v) + (rng() - 0.5) * 0.5 };
    })
    .sort((a, b) => a.key - b.key)
    .map((e) => e.p);
}

/**
 * Escolhe a melhor das 3 formações de duplas para um grupo de 4 jogadores,
 * minimizando repetições de parceria (peso maior) e de adversários.
 *
 * @returns {{ side_a: [number, number], side_b: [number, number], cost: number }}
 */
function bestPairingOfFour(group, partnerCount, oppCount, rng, levelOf = null) {
  const [a, b, c, d] = group;
  const W_PARTNER = 10; // repetir dupla é pior que repetir adversário
  const W_OPP = 3;
  // Peso do desequilíbrio de nível. Calibrado para ficar SEMPRE abaixo de uma
  // repetição de parceria (10): um desnível de 1.0 ponto custa 2, de 3.0
  // pontos custa 6 — nunca compensa repetir uma dupla para equilibrar.
  const W_LEVEL = 2;
  const partnerCost = (x, y) => (partnerCount.get(pairKey(x, y)) || 0);
  const oppCost = (p, q) =>
    (oppCount.get(pairKey(p[0], q[0])) || 0) +
    (oppCount.get(pairKey(p[0], q[1])) || 0) +
    (oppCount.get(pairKey(p[1], q[0])) || 0) +
    (oppCount.get(pairKey(p[1], q[1])) || 0);

  const options = [
    { side_a: [a, b], side_b: [c, d] },
    { side_a: [a, c], side_b: [b, d] },
    { side_a: [a, d], side_b: [b, c] },
  ];
  // Desequilíbrio entre os dois lados, na régua unificada (0 quando não se
  // conhece o nível de todos os quatro — aí este critério simplesmente não opina).
  const levelCost = (p, q) => {
    if (!levelOf) return 0;
    const va = [levelOf(p[0]), levelOf(p[1])];
    const vb = [levelOf(q[0]), levelOf(q[1])];
    if (va.some((v) => v == null) || vb.some((v) => v == null)) return 0;
    const mediaA = (va[0] + va[1]) / 2;
    const mediaB = (vb[0] + vb[1]) / 2;
    return Math.abs(mediaA - mediaB);
  };

  let best = null;
  for (const opt of options) {
    const cost =
      W_PARTNER * (partnerCost(opt.side_a[0], opt.side_a[1]) + partnerCost(opt.side_b[0], opt.side_b[1])) +
      W_OPP * oppCost(opt.side_a, opt.side_b) +
      W_LEVEL * levelCost(opt.side_a, opt.side_b) +
      rng() * 0.001; // desempate determinístico
    if (!best || cost < best.cost) best = { ...opt, cost };
  }
  return best;
}

/**
 * Monta uma rodada (lista de jogos de 4 jogadores) a partir do conjunto de
 * jogadores que vão jogar, escolhendo grupos e formações que minimizem
 * repetições. Faz várias tentativas e fica com a de menor custo.
 *
 * @param {number[]} playing  índices dos jogadores que jogam nesta rodada
 * @returns {{ games: Array<{side_a:[number,number], side_b:[number,number]}>, cost: number }}
 */
function buildRound(playing, partnerCount, oppCount, rng, levelOf = null) {
  const courts = Math.floor(playing.length / 4);
  // Amplitude de nível dentro de uma quadra: quanto menor, mais parelho o jogo.
  const W_COURT_SPREAD = 3;
  // TETO: o custo de nível de uma quadra nunca alcança o de uma parceria
  // repetida (W_PARTNER = 10 em `bestPairingOfFour`). Assim a garantia "nunca
  // troco uma dupla inédita por equilíbrio de nível" vale por construção, e
  // não por calibragem feliz dos pesos.
  const MAX_COURT_SPREAD_COST = 9;
  const courtSpread = (group) => {
    if (!levelOf) return 0;
    const vals = group.map(levelOf).filter((v) => v != null);
    if (vals.length < 2) return 0;
    const amplitude = Math.max(...vals) - Math.min(...vals);
    return Math.min(W_COURT_SPREAD * amplitude, MAX_COURT_SPREAD_COST);
  };

  let best = null;
  const attempts = 24;
  for (let t = 0; t < attempts; t += 1) {
    // Metade das tentativas parte de uma ordem AGRUPADA POR NÍVEL (com um
    // empurrãozinho aleatório, para variar entre tentativas): assim os quatro
    // de uma quadra tendem a ter força parecida. A outra metade continua sendo
    // embaralhamento puro, que é o que garante variedade de parcerias ao longo
    // do dia. O custo abaixo decide qual tentativa vence.
    const order = (levelOf && t % 2 === 0)
      ? orderByLevelWithJitter(playing, levelOf, rng)
      : shuffle(playing, rng);
    // Clones locais para acumular o efeito dentro da própria rodada.
    const localP = new Map(partnerCount);
    const localO = new Map(oppCount);
    const games = [];
    let totalCost = 0;
    for (let g = 0; g < courts; g += 1) {
      const group = order.slice(g * 4, g * 4 + 4);
      const pick = bestPairingOfFour(group, localP, localO, rng, levelOf);
      games.push({ side_a: pick.side_a, side_b: pick.side_b });
      totalCost += pick.cost + courtSpread(group);
      // Atualiza os clones para refletir a escolha na mesma rodada.
      localP.set(pairKey(pick.side_a[0], pick.side_a[1]), (localP.get(pairKey(pick.side_a[0], pick.side_a[1])) || 0) + 1);
      localP.set(pairKey(pick.side_b[0], pick.side_b[1]), (localP.get(pairKey(pick.side_b[0], pick.side_b[1])) || 0) + 1);
      for (const x of pick.side_a) {
        for (const y of pick.side_b) {
          localO.set(pairKey(x, y), (localO.get(pairKey(x, y)) || 0) + 1);
        }
      }
    }
    if (!best || totalCost < best.cost) best = { games, cost: totalCost };
  }
  return best || { games: [], cost: 0 };
}

/**
 * Gera os jogos do dia em `rounds` rodadas, equilibrando a participação.
 *
 * @param {string[]} playerIds  ids/identificadores únicos dos participantes
 * @param {{ rounds?: number, seed?: string, history?: object, courts?: number }} [options]
 *   `history` (opcional): saída de {@link buildDrawHistory} com as duplas e
 *   adversários já ocorridos e o nº de partidas/rodadas presentes por atleta,
 *   para um sorteio ADITIVO ciente do que já aconteceu no dia (evita repetir
 *   parcerias/confrontos e equilibra a participação por taxa).
 *
 *   `levels` (opcional): mapa `id → nível na régua unificada 2.0–8.0`
 *   (`rating/domain/unifiedLevel.js`). Com ele, o sorteio prefere quadras
 *   parelhas e duplas equilibradas. SEM ele, o comportamento é exatamente o
 *   histórico — nenhum sorteio existente muda por causa desta opção.
 *
 *   `courts` (opcional): QUADRAS SIMULTÂNEAS disponíveis. Sem ele, o motor abre
 *   uma quadra por grupo de 4 (comportamento histórico). Com ele, cada rodada
 *   tem no máximo `courts` jogos — ex.: 12 atletas em 2 quadras → 8 jogam e 4
 *   aguardam, e na rodada seguinte esses 4 entram junto com 4 dos que jogaram.
 *   A escolha de quem joga continua sendo "quem menos jogou primeiro", então a
 *   distribuição de jogos permanece equilibrada ao longo do dia.
 * @returns {Array<{ round: number, side_a: [string, string], side_b: [string, string] }>}
 *   Jogos de duplas. Os ids retornados são os mesmos recebidos em `playerIds`.
 */
export function generateGameDayGames(playerIds, options = {}) {
  const ids = (playerIds || []).filter(Boolean);
  const n = ids.length;
  if (n < 4) {
    throw new Error('O sorteio do dia de jogo exige no mínimo 4 participantes.');
  }
  const {
    seed = 'gameday', history = null, courts: courtsOption = null, levels = null,
  } = options;
  // Quadras SIMULTÂNEAS disponíveis. Ausente = automático (uma quadra por grupo
  // de 4), que é exatamente o comportamento histórico.
  const courts = normalizeDrawCourts(courtsOption, Math.floor(n / 4));
  const rounds = options.rounds === undefined ? suggestRounds(n, courtsOption) : options.rounds;
  const totalRounds = Math.max(1, Math.min(60, Math.floor(rounds)));
  const rng = seededRng(seed);

  // Trabalhamos com índices 0..n-1; mapeamos para ids no final.
  const players = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  );
  // Nível por ÍNDICE interno (o motor trabalha com 0..n-1, não com ids).
  // Ausente ou vazio ⇒ `levelOf` é null e nada muda em relação ao histórico.
  let levelOf = null;
  if (levels && typeof levels === 'object') {
    const porIndice = ids.map((id) => {
      const bruto = levels[id];
      // `Number(null)` e `Number('')` são 0 — que é finito. Sem esta guarda,
      // "sem nível" viraria o piso da régua e o atleta entraria no sorteio
      // como o mais fraco de todos.
      if (bruto == null || bruto === '') return null;
      const v = Number(bruto);
      return Number.isFinite(v) ? v : null;
    });
    if (porIndice.some((v) => v != null)) levelOf = (i) => porIndice[i];
  }

  const gamesPlayed = new Array(n).fill(0);
  const restCount = new Array(n).fill(0);
  const partnerCount = new Map();
  const oppCount = new Map();

  // Sorteio ADITIVO ciente do histórico: parte das duplas/adversários já
  // ocorridos e do déficit de participação de cada atleta (ver seedFromHistory).
  if (history) {
    const idToIndex = new Map(ids.map((id, i) => [id, i]));
    seedFromHistory(history, ids, idToIndex, gamesPlayed, partnerCount, oppCount);
  }

  // Jogadores em quadra por rodada. Quando as quadras limitam (ex.: 12 atletas
  // em 2 quadras → 8 jogam, 4 aguardam), o rodízio abaixo escolhe SEMPRE quem
  // menos jogou (desempate: quem mais descansou), então a fila circula e a
  // distribuição de jogos segue equilibrada ao longo do dia.
  const playPerRound = courts * 4;
  const out = [];

  for (let r = 0; r < totalRounds; r += 1) {
    // Quem joga: os que menos jogaram (e, em empate, os que mais descansaram).
    const ranked = players
      .slice()
      .sort((x, y) => {
        if (gamesPlayed[x] !== gamesPlayed[y]) return gamesPlayed[x] - gamesPlayed[y];
        if (restCount[x] !== restCount[y]) return restCount[y] - restCount[x];
        return rng() - 0.5;
      });
    const playing = ranked.slice(0, playPerRound);
    const resting = ranked.slice(playPerRound);
    resting.forEach((p) => {
      restCount[p] += 1;
    });

    const { games } = buildRound(playing, partnerCount, oppCount, rng, levelOf);
    games.forEach((gm) => {
      // Persiste o efeito nos contadores globais.
      partnerCount.set(pairKey(gm.side_a[0], gm.side_a[1]), (partnerCount.get(pairKey(gm.side_a[0], gm.side_a[1])) || 0) + 1);
      partnerCount.set(pairKey(gm.side_b[0], gm.side_b[1]), (partnerCount.get(pairKey(gm.side_b[0], gm.side_b[1])) || 0) + 1);
      for (const x of gm.side_a) {
        for (const y of gm.side_b) {
          oppCount.set(pairKey(x, y), (oppCount.get(pairKey(x, y)) || 0) + 1);
        }
      }
      [...gm.side_a, ...gm.side_b].forEach((p) => {
        gamesPlayed[p] += 1;
      });
      out.push({
        round: r + 1,
        side_a: [ids[gm.side_a[0]], ids[gm.side_a[1]]],
        side_b: [ids[gm.side_b[0]], ids[gm.side_b[1]]],
      });
    });
  }
  return out;
}

/**
 * Sugestão de número de rodadas para que todos joguem um número equilibrado de
 * vezes — algo próximo de "cada jogador participa de N−1 jogos" do Americano,
 * limitado para não gerar uma grade gigante.
 */
export function suggestRounds(n, courts = null) {
  if (n < 4) return 0;
  // Um valor prático: o suficiente para uma boa rotação sem exagero.
  const base = Math.max(3, Math.min(12, n - 1));
  // Sem informar quadras, devolve exatamente o valor histórico.
  if (courts == null) return base;
  const maxByPlayers = Math.floor(n / 4);
  const effective = normalizeDrawCourts(courts, maxByPlayers);
  // Só escala quando as quadras REDUZEM o que o nº de atletas permitiria.
  if (effective >= maxByPlayers) return base;
  // Com fila, cada rodada entrega menos jogos por atleta; aumentar as rodadas
  // preserva a MÉDIA de jogos por pessoa que o dia teria sem fila.
  const playPerRound = effective * 4;
  return Math.max(base, Math.min(MAX_SUGGESTED_ROUNDS, Math.ceil((base * n) / playPerRound)));
}
