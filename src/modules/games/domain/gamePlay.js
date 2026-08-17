/**
 * Domínio puro do formato "Play" (open play) do dia de jogo do atleta
 * (flag gameday_play). Sem I/O e sem React.
 *
 * Ideia: uma sessão de jogo aberto com N quadras, organizada por ORDEM DE
 * CHEGADA/ESPERA — não há sorteio de grade nem registro de resultados. A
 * plataforma cria o próximo jogo pegando quem está esperando há mais tempo
 * (empates são sorteados), quadra a quadra; ao concluir um jogo, o próximo
 * entra automaticamente na quadra que ficou livre.
 *
 * Modelo de espera (determinístico e justo):
 *  - Cada participante disponível tem `available_since` (ms) — quando entrou na
 *    fila (chegada, ou o instante em que terminou o último jogo) — e
 *    `available_tie` (número aleatório fixado naquele instante). A ordem é
 *    (available_since ASC, available_tie ASC): quem espera há mais tempo primeiro,
 *    e o desempate aleatório JÁ embute o "sorteio entre os de mesma espera".
 *  - Quem terminou o MESMO jogo recebe o MESMO `available_since` (empate) e
 *    `available_tie` distintos — ou seja, entram num grupo cujo desempate é
 *    sorteado.
 *
 * Estados derivados:
 *  - `in_court`   — está num jogo aberto;
 *  - `unavailable`— optou por pular as próximas X partidas (`skip_remaining` > 0);
 *  - `available`  — na ordem de participação, apto a entrar em quadra.
 */

export const PLAY_STATUS = Object.freeze({
  AVAILABLE: 'available',
  IN_COURT: 'in_court',
  UNAVAILABLE: 'unavailable',
});

export const PLAY_GAME_STATUS = Object.freeze({
  OPEN: 'open',
  FINISHED: 'finished',
});

/** Jogadores por jogo (duplas 2×2). */
export const PLAY_SLOTS = 4;

/** Nível padrão quando o participante não tem nível informado (guests etc.). */
export const PLAY_DEFAULT_LEVEL = 3.0;

/* ------------------------------ utilidades ------------------------------ */

/** Extrai um nível numérico de um participante (aceita número ou string USAP). */
export function playLevelValue(participant) {
  const raw = participant?.play_level;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const m = raw.match(/\d+(?:[.,]\d+)?/);
    if (m) {
      const n = parseFloat(m[0].replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return PLAY_DEFAULT_LEVEL;
}

/** Ids dos participantes que estão em jogos ABERTOS (em quadra). */
export function inCourtIdsFromGames(games) {
  const set = new Set();
  (games || []).forEach((g) => {
    if (!g || g.status === PLAY_GAME_STATUS.FINISHED) return;
    [...(g.side_a || []), ...(g.side_b || [])].forEach((p) => {
      if (p?.id) set.add(p.id);
    });
  });
  return set;
}

/** Status derivado de um participante do Play. */
export function playParticipantStatus(participant, inCourtIds) {
  if (!participant) return PLAY_STATUS.UNAVAILABLE;
  if (inCourtIds && inCourtIds.has(participant.id)) return PLAY_STATUS.IN_COURT;
  if (Number(participant.skip_remaining) > 0) return PLAY_STATUS.UNAVAILABLE;
  return PLAY_STATUS.AVAILABLE;
}

/** Chave de ordenação da fila (menor = espera há mais tempo = entra antes). */
function waitKey(p) {
  const since = Number(p?.available_since);
  const base = Number.isFinite(since) ? since : Number(p?.created_at_ms) || 0;
  const tie = Number(p?.available_tie);
  return { base, tie: Number.isFinite(tie) ? tie : 0, born: Number(p?.created_at_ms) || 0 };
}

function compareWait(a, b) {
  const ka = waitKey(a);
  const kb = waitKey(b);
  if (ka.base !== kb.base) return ka.base - kb.base;
  if (ka.tie !== kb.tie) return ka.tie - kb.tie;
  if (ka.born !== kb.born) return ka.born - kb.born;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Classifica todos os participantes em: `order` (disponíveis, numerados 1..k por
 * ordem de espera), `inCourt` (em quadra) e `unavailable` (pulando partidas).
 * Também devolve `all` com `status` e `orderNo` (null p/ quem não está na ordem).
 *
 * @param {object} args
 * @param {Array} args.participants
 * @param {Array} args.games
 * @returns {{ order: Array, inCourt: Array, unavailable: Array, all: Array }}
 */
export function computePlayOrder({ participants = [], games = [] } = {}) {
  const inCourtIds = inCourtIdsFromGames(games);
  const withStatus = participants.map((p) => ({
    ...p,
    status: playParticipantStatus(p, inCourtIds),
  }));

  const available = withStatus
    .filter((p) => p.status === PLAY_STATUS.AVAILABLE)
    .sort(compareWait)
    .map((p, i) => ({ ...p, orderNo: i + 1 }));

  const inCourt = withStatus.filter((p) => p.status === PLAY_STATUS.IN_COURT).map((p) => ({ ...p, orderNo: null }));
  const unavailable = withStatus.filter((p) => p.status === PLAY_STATUS.UNAVAILABLE).map((p) => ({ ...p, orderNo: null }));

  const orderById = new Map(available.map((p) => [p.id, p.orderNo]));
  const all = withStatus.map((p) => ({ ...p, orderNo: orderById.get(p.id) ?? null }));

  return { order: available, inCourt, unavailable, all };
}

/* --------------------------- seleção do próximo jogo --------------------------- */

/**
 * Escolhe os `slots` jogadores do próximo jogo a partir da ORDEM DE PARTICIPAÇÃO
 * (já disponível e ordenada por espera). Respeita rigorosamente a ordem e as
 * DUPLAS FIXAS (partner_id mútuo):
 *  - uma dupla só entra quando ambos cabem sem "furar" a ordem (sem antecipar o
 *    parceiro que está mais atrás por cima de quem está na frente);
 *  - se a dupla não couber, ela é EMPURRADA para a próxima partida e o próximo
 *    solo disponível entra no lugar;
 *  - quem tem parceiro mas o parceiro não está disponível AGUARDA (não entra
 *    sozinho — "sempre entram juntos").
 *
 * @param {Array} availableOrdered  participantes disponíveis, em ordem de espera
 * @param {{ slots?: number }} [opts]
 * @returns {string[]|null}  ids escolhidos (tamanho `slots`) ou null se faltam jogadores
 */
export function buildPlayNextMatch(availableOrdered, { slots = PLAY_SLOTS } = {}) {
  const order = (availableOrdered || []).slice();
  const byId = new Map(order.map((p) => [p.id, p]));
  const chosen = [];
  const chosenSet = new Set();
  const deferred = new Set();

  const mutualPartner = (p) => {
    if (!p?.partner_id) return null;
    const partner = byId.get(p.partner_id);
    return partner && partner.partner_id === p.id ? partner : null;
  };

  for (let i = 0; i < order.length && chosen.length < slots; i += 1) {
    const p = order[i];
    if (chosenSet.has(p.id) || deferred.has(p.id)) continue;

    if (!p.partner_id) {
      chosen.push(p.id);
      chosenSet.add(p.id);
      continue;
    }

    const partner = mutualPartner(p);
    if (!partner) {
      // Tem parceiro declarado, mas o parceiro não está disponível/não é mútuo:
      // aguarda (não joga sozinho).
      deferred.add(p.id);
      continue;
    }

    // p é o membro mais à frente da dupla (encontrado primeiro na ordem).
    const partnerIndex = order.findIndex((x) => x.id === partner.id);
    const between = [];
    let ok = true;
    for (let k = i + 1; k < partnerIndex; k += 1) {
      const q = order[k];
      if (chosenSet.has(q.id) || deferred.has(q.id)) continue;
      if (q.partner_id) { ok = false; break; } // outra dupla no meio -> conservador
      between.push(q.id);
    }
    const needed = 2 + between.length; // p + entre-solos + parceiro
    if (ok && chosen.length + needed <= slots) {
      const ids = [p.id, ...between, partner.id];
      ids.forEach((id) => { chosen.push(id); chosenSet.add(id); });
    } else {
      // A dupla furaria a ordem/não cabe -> empurra a dupla p/ a próxima partida.
      deferred.add(p.id);
      deferred.add(partner.id);
    }
  }

  return chosen.length === slots ? chosen : null;
}

/** Primeiro disponível na ordem que não esteja em `excludeIds` (para substituições). */
export function nextAvailableExcluding(availableOrdered, excludeIds = []) {
  const exclude = new Set(excludeIds);
  return (availableOrdered || []).find((p) => !exclude.has(p.id)) || null;
}

/* ------------------------------ formação de duplas ------------------------------ */

function isMixedPair(a, b) {
  const g1 = a?.play_gender;
  const g2 = b?.play_gender;
  return (g1 === 'male' && g2 === 'female') || (g1 === 'female' && g2 === 'male');
}

/**
 * Distribui 4 jogadores em dois lados (duplas), equilibrando por SEXO e NÍVEL:
 *  - prioriza duplas MISTAS (1 homem + 1 mulher em cada lado);
 *  - equilibra a força dos lados (soma de níveis parecida — o que naturalmente
 *    junta um mais forte com um mais fraco em cada dupla).
 * Respeita a DUPLA FIXA (partner_id mútuo): os parceiros ficam no mesmo lado.
 *
 * @param {Array} four  4 participantes
 * @param {{ rng?: () => number }} [opts]
 * @returns {{ side_a: [string,string], side_b: [string,string] }}
 */
export function assignPlayTeams(four, { rng = Math.random } = {}) {
  const players = (four || []).slice(0, PLAY_SLOTS);
  if (players.length !== PLAY_SLOTS) {
    return { side_a: [], side_b: [] };
  }

  const W_MIXED = 100;
  const W_LEVEL = 1;
  const splits = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ];

  // Dupla fixa entre os quatro força o split.
  const forced = [];
  for (let i = 0; i < 4 && forced.length === 0; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      const a = players[i];
      const b = players[j];
      if (a?.partner_id === b?.id && b?.partner_id === a?.id) {
        forced.push([i, j]);
        break;
      }
    }
  }

  const cost = (teamA, teamB) => {
    const lvl = (idx) => playLevelValue(players[idx]);
    const sumA = lvl(teamA[0]) + lvl(teamA[1]);
    const sumB = lvl(teamB[0]) + lvl(teamB[1]);
    const levelDiff = Math.abs(sumA - sumB);
    const mixedPenalty = (isMixedPair(players[teamA[0]], players[teamA[1]]) ? 0 : 1)
      + (isMixedPair(players[teamB[0]], players[teamB[1]]) ? 0 : 1);
    return W_MIXED * mixedPenalty + W_LEVEL * levelDiff + rng() * 0.001;
  };

  let candidates = splits;
  if (forced.length) {
    const [fi, fj] = forced[0];
    const others = [0, 1, 2, 3].filter((k) => k !== fi && k !== fj);
    candidates = [[[fi, fj], others]];
  }

  let best = null;
  for (const [teamA, teamB] of candidates) {
    const c = cost(teamA, teamB);
    if (!best || c < best.cost) best = { teamA, teamB, cost: c };
  }

  return {
    side_a: [players[best.teamA[0]].id, players[best.teamA[1]].id],
    side_b: [players[best.teamB[0]].id, players[best.teamB[1]].id],
  };
}

/* --------------------------------- quadras --------------------------------- */

/** Números das quadras (1..courts) que estão SEM jogo aberto. */
export function freePlayCourts({ courts = 1, games = [] } = {}) {
  const busy = new Set();
  (games || []).forEach((g) => {
    if (g && g.status !== PLAY_GAME_STATUS.FINISHED && Number.isFinite(Number(g.court))) {
      busy.add(Number(g.court));
    }
  });
  const free = [];
  for (let c = 1; c <= Math.max(1, courts); c += 1) {
    if (!busy.has(c)) free.push(c);
  }
  return free;
}

/** Menor quadra livre (ou null se todas ocupadas). */
export function nextFreePlayCourt({ courts = 1, games = [] } = {}) {
  const free = freePlayCourts({ courts, games });
  return free.length ? free[0] : null;
}
