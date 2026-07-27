/**
 * Domínio puro do espelhamento de resultados de dia de jogo no ranking
 * nacional (Wave C). Sem I/O — recebe listas de objetos já materializados e
 * devolve o conjunto de documentos a gravar em `club_event_games` + os que
 * devem ser pulados, mantendo total determinismo e cobertura de testes.
 *
 * Regras:
 *  1. Só jogos DECIDIDOS (score_a != null, score_b != null, score_a !=
 *     score_b) são publicados.
 *  2. Só jogadores com `user_id` válido (não guests) entram no ranking.
 *  3. Id determinístico `${eventId}_${dateId}_${gameId}` para idempotência.
 *  4. `side_a_ids`/`side_b_ids` são derivados do mapa de participantes
 *     (user_id por participant_id).
 *  5. `kind` = 'singles' se ambos os lados têm 1 jogador; 'doubles' caso
 *     contrário.
 *
 * O objeto retornado é compatível com o schema exigido pelas
 * `firestore.rules` (ver bloco `match /club_event_games/{gameId}`).
 */

import { GAME_DAY_RANKING_RESULT, GAME_DAY_RANKING_SOURCE } from './constants.js';

/** Verifica se um jogo está decidido (tem placar e um vencedor). */
export function isGameDecided(game) {
  if (!game) return false;
  // Checagem explícita de null/undefined (Number(null) = 0, e queremos
  // distinguir placar não lançado = 0-0 de placar zerado = 0-0 que
  // também é empate. Mas placar null/undefined nunca conta como
  // decidido).
  if (game.score_a == null || game.score_b == null) return false;
  const a = Number(game.score_a);
  const b = Number(game.score_b);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return a !== b;
}

/** Determina o vencedor: 'a' ou 'b'. Assume jogo decidido. */
export function winnerSideOf(game) {
  return Number(game.score_a) > Number(game.score_b) ? 'a' : 'b';
}

/** Infere o tipo de jogo a partir dos lados. */
export function inferKind(sideA, sideB) {
  const a = (sideA || []).length;
  const b = (sideB || []).length;
  if (a === 1 && b === 1) return 'singles';
  return 'doubles';
}

/**
 * Resolve os `user_id`s de um lado a partir da lista de participantes do dia
 * de jogo. Um slot sem `user_id` (convidado avulso) vira `null` — o jogo
 * inteiro é pulado se algum slot obrigatório ficar sem uid (ver
 * `buildPublishableMatches`).
 *
 * @param {Array} side - [{ id, name, user_id }] do lado (sem `user_id` = guest)
 * @returns {string[]} uids resolvidos (sem `null`s)
 */
export function resolveSideUids(side) {
  return (side || []).map((p) => p?.user_id).filter(Boolean);
}

/**
 * Tenta construir o documento espelhado de um jogo de dia de jogo para o
 * ranking nacional. Retorna `null` se o jogo não pode ser publicado.
 *
 * @param {object} args
 * @param {object} args.event      - `club_events/{id}`
 * @param {string} args.dateId     - id do dia de jogo (`dates/{dateId}`)
 * @param {string} args.clubId     - clube do evento
 * @param {string} args.gameId     - id do jogo em `club_events/{id}/games/{gameId}`
 * @param {object} args.game       - jogo original
 * @param {Array}  args.participants - participantes do dia (já filtrados)
 * @param {string} args.publishedBy - uid do publicador (auditoria)
 * @returns {null | { id: string, payload: object }}
 */
export function buildPublishableMatch({ event, dateId, clubId, gameId, game, participants, publishedBy }) {
  if (!event?.id || !dateId || !clubId || !gameId) return null;
  if (!isGameDecided(game)) return null;

  const byId = new Map((participants || []).map((p) => [p.id, p]));
  const sideAUids = resolveSideUids(game.side_a?.map((p) => byId.get(p.id) || p));
  const sideBUids = resolveSideUids(game.side_b?.map((p) => byId.get(p.id) || p));

  // Exige lado A e B com a MESMA quantidade de jogadores; e a contagem
  // precisa ser 1 (singles) ou 2 (doubles). Sem isso, o jogo é pulado.
  const sideASource = game.side_a || [];
  const sideBSource = game.side_b || [];
  const aLen = sideASource.length;
  const bLen = sideBSource.length;
  if (aLen === 0 || bLen === 0) return null;
  if (aLen !== bLen) return null;
  if (aLen > 2) return null;
  if (sideAUids.length !== aLen || sideBUids.length !== bLen) return null;

  const kind = inferKind(sideASource, sideBSource);
  const winner = winnerSideOf(game);
  const pointsA = Number(game.score_a) || 0;
  const pointsB = Number(game.score_b) || 0;

  return {
    id: `${event.id}_${dateId}_${gameId}`,
    payload: {
      id: `${event.id}_${dateId}_${gameId}`,
      source: GAME_DAY_RANKING_SOURCE.CLUB_EVENT_GAME,
      event_id: event.id,
      event_title: event.title || '',
      date_id: dateId,
      club_id: clubId,
      game_id: gameId,
      // Sides como string (mirrored de `tournament_matches`).
      side_a: sideAUids.join('+'),
      side_b: sideBUids.join('+'),
      side_a_ids: sideAUids,
      side_b_ids: sideBUids,
      kind,
      score_a: pointsA,
      score_b: pointsB,
      sets_a: pointsA,
      sets_b: pointsB,
      winner_side: winner,
      status: 'finished',
      result_recorded_at: game.updated_at || game.created_at || new Date().toISOString(),
      published_by: publishedBy || null,
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Processa uma lista de jogos e devolve três coleções:
 *  - `toWrite`: documentos a serem criados (id + payload) em `club_event_games`
 *  - `toRemove`: ids a serem removidos (somente se o jogo não existe mais
 *    no dia de jogo)
 *  - `summary`: contadores por tipo de resultado
 *
 * @param {object} args
 * @param {object} args.event
 * @param {string} args.dateId
 * @param {string} args.clubId
 * @param {string} args.publishedBy
 * @param {Array}  args.participants  - participantes do dia
 * @param {Array}  args.games         - jogos do dia (`score_a`/`score_b` opcionais)
 * @param {string[]=} args.publishedIds - ids já em `club_event_games` (idempotência)
 * @returns {{
 *   toWrite: Array<{id: string, payload: object}>,
 *   toRemove: string[],
 *   summary: { published: number, skipped: number, already_published: number, removed: number }
 * }}
 */
export function buildPublishableMatches({
  event,
  dateId,
  clubId,
  publishedBy,
  participants,
  games,
  publishedIds = [],
}) {
  const publishedSet = new Set(publishedIds);
  const currentGameIds = new Set();
  const toWrite = [];
  let published = 0;
  let skipped = 0;
  let already = 0;

  (games || []).forEach((g) => {
    if (!g?.id) return;
    currentGameIds.add(`${event.id}_${dateId}_${g.id}`);
    if (publishedSet.has(`${event.id}_${dateId}_${g.id}`)) {
      already += 1;
      return;
    }
    const result = buildPublishableMatch({
      event,
      dateId,
      clubId,
      gameId: g.id,
      game: g,
      participants,
      publishedBy,
    });
    if (result) {
      toWrite.push(result);
      published += 1;
    } else {
      skipped += 1;
    }
  });

  // Jogos que estavam publicados mas sumiram do dia de jogo (foram
  // removidos pelo organizador): remove do ranking para evitar fantasmas.
  const toRemove = publishedIds.filter((id) => !currentGameIds.has(id));

  return {
    toWrite,
    toRemove,
    summary: { published, skipped, already_published: already, removed: toRemove.length },
  };
}

/** Resultado legível de uma operação publish/unpublish. */
export function summarizeResult(parts) {
  return {
    [GAME_DAY_RANKING_RESULT.PUBLISHED]: parts.published,
    [GAME_DAY_RANKING_RESULT.SKIPPED]: parts.skipped,
    [GAME_DAY_RANKING_RESULT.ALREADY_PUBLISHED]: parts.already_published,
    removed: parts.removed,
  };
}
