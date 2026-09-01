/**
 * Domínio puro do espelhamento de resultados de um "Dia de jogo do atleta" no
 * ranking da plataforma. Sem I/O.
 *
 * Reaproveita a MESMA coleção materializada dos clubes (`club_event_games`),
 * consumida sem alteração pelo motor de rating nacional
 * (`ratingService.recomputeAllRatings`) e pelo ranking interno dos clubes
 * (`functions/clubRanking.js`). Isso garante que:
 *  - o ranking GERAL da plataforma recebe todo jogo decidido publicado; e
 *  - o ranking de um CLUBE recebe uma partida quando TODOS os atletas dela são
 *    do mesmo clube (via `club_id` resolvido por partida).
 *
 * Regras (idênticas às dos clubes, ver `clubs/domain/rankingPublishing.js`):
 *  1. Só jogos DECIDIDOS (placar com vencedor) são publicados.
 *  2. Só jogadores com `user_id` válido (não convidados avulsos) entram.
 *  3. Lados com mesma quantidade de jogadores (1=singles, 2=doubles).
 *  4. Id determinístico `gd_${gameDayId}_${gameId}` (idempotência).
 *  5. `club_id` por partida = clube comum a TODOS os atletas (ou null).
 */

import {
  isGameDecided, winnerSideOf, inferKind, resolveSideUids,
} from '@/modules/clubs/domain/rankingPublishing.js';

/** Fonte da publicação (auditoria). */
export const GAME_DAY_RANKING_SOURCE = 'athlete_game_day';

/** date_id fixo — um dia de jogo do atleta é uma única data. */
export const GAME_DAY_DATE_ID = 'main';

/** Id determinístico do jogo espelhado. */
export function gameDayRankingId(gameDayId, gameId) {
  return `gd_${gameDayId}_${gameId}`;
}

function clubsOf(uid, clubIdsByUid) {
  if (!clubIdsByUid) return [];
  const raw = typeof clubIdsByUid.get === 'function' ? clubIdsByUid.get(uid) : clubIdsByUid[uid];
  return Array.isArray(raw) ? raw.filter(Boolean) : [];
}

/**
 * Resolve o clube comum a TODOS os atletas de uma partida. Retorna null se
 * algum atleta não tem clube ou se não há interseção. Escolha determinística:
 * o primeiro em ordem alfabética quando há mais de um clube comum.
 *
 * @param {string[]} sideAUids
 * @param {string[]} sideBUids
 * @param {Map<string,string[]>|Object} clubIdsByUid
 * @returns {string|null}
 */
export function resolveMatchClubId(sideAUids, sideBUids, clubIdsByUid) {
  const all = [...(sideAUids || []), ...(sideBUids || [])];
  if (all.length === 0) return null;
  let inter = null;
  for (const uid of all) {
    const clubs = new Set(clubsOf(uid, clubIdsByUid));
    if (clubs.size === 0) return null;
    if (inter === null) inter = clubs;
    else inter = new Set([...inter].filter((c) => clubs.has(c)));
    if (inter.size === 0) return null;
  }
  return Array.from(inter).sort()[0] || null;
}

/**
 * Constrói o documento espelhado de UM jogo de dia de jogo. Retorna null se o
 * jogo não pode ser publicado (não decidido, guests, lados desiguais…).
 *
 * @param {object} args
 * @param {object} args.gameDay        - `game_days/{id}`
 * @param {string} args.gameId
 * @param {object} args.game           - jogo com side_a/side_b/score_a/score_b
 * @param {Array}  args.participants    - participantes do dia (com user_id)
 * @param {Map|Object} args.clubIdsByUid - uid → club_ids[]
 * @param {string} args.publishedBy
 * @returns {null | { id: string, payload: object }}
 */
export function buildGameDayMatch({ gameDay, gameId, game, participants, clubIdsByUid, publishedBy }) {
  if (!gameDay?.id || !gameId) return null;
  if (!isGameDecided(game)) return null;

  const byId = new Map((participants || []).map((p) => [p.id, p]));
  const sideAUids = resolveSideUids((game.side_a || []).map((p) => byId.get(p.id) || p));
  const sideBUids = resolveSideUids((game.side_b || []).map((p) => byId.get(p.id) || p));

  const aLen = (game.side_a || []).length;
  const bLen = (game.side_b || []).length;
  if (aLen === 0 || bLen === 0) return null;
  if (aLen !== bLen) return null;
  if (aLen > 2) return null;
  if (sideAUids.length !== aLen || sideBUids.length !== bLen) return null;

  const kind = inferKind(game.side_a, game.side_b);
  const winner = winnerSideOf(game);
  const pointsA = Number(game.score_a) || 0;
  const pointsB = Number(game.score_b) || 0;
  const clubId = resolveMatchClubId(sideAUids, sideBUids, clubIdsByUid);
  const id = gameDayRankingId(gameDay.id, gameId);

  return {
    id,
    payload: {
      id,
      source: GAME_DAY_RANKING_SOURCE,
      event_id: gameDay.id,
      event_title: gameDay.title || '',
      date_id: GAME_DAY_DATE_ID,
      club_id: clubId,
      game_id: gameId,
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
 * Campos do espelho que definem o RESULTADO de uma partida. Se qualquer um deles
 * muda, o espelho em `club_event_games` precisa ser regravado para que ranking,
 * rating, desenvolvimento e exportação reflitam a correção.
 */
const MIRROR_DECISION_KEYS = ['score_a', 'score_b', 'winner_side', 'kind', 'club_id'];

/**
 * Compara o documento já espelhado (`stored`) com o payload recém-calculado
 * (`fresh`) e diz se o RESULTADO mudou (placar, vencedor, lados, modalidade ou
 * clube). Usado para propagar edições de jogos já publicados sem regravar quando
 * nada mudou (mantém a idempotência).
 *
 * @param {object|null|undefined} stored
 * @param {object} fresh
 * @returns {boolean}
 */
export function mirrorDecisionChanged(stored, fresh) {
  if (!stored || !fresh) return true;
  for (const k of MIRROR_DECISION_KEYS) {
    if (String(stored[k] ?? '') !== String(fresh[k] ?? '')) return true;
  }
  if ((stored.side_a_ids || []).join('+') !== (fresh.side_a_ids || []).join('+')) return true;
  if ((stored.side_b_ids || []).join('+') !== (fresh.side_b_ids || []).join('+')) return true;
  return false;
}

/** Normaliza `publishedById` (Map ou objeto simples) para um Map, ou null. */
function toStoredMap(publishedById) {
  if (!publishedById) return null;
  if (publishedById instanceof Map) return publishedById;
  return new Map(Object.entries(publishedById));
}

/**
 * Processa a lista de jogos do dia e devolve o que gravar/remover em
 * `club_event_games`, idempotente. Espelha `buildPublishableMatches` dos clubes.
 *
 * Quando `publishedById` (id → documento já espelhado) é fornecido, jogos JÁ
 * publicados são REAVALIADOS: se o resultado mudou (correção de placar, troca de
 * lados, etc.) o espelho é regravado; se o jogo deixou de ser decidido (empate/
 * indefinido/convidado) ele é removido. Sem `publishedById`, mantém o
 * comportamento legado (idempotência por id: já publicado = pula).
 *
 * @param {object} args
 * @param {object} args.gameDay
 * @param {Array}  args.participants
 * @param {Array}  args.games
 * @param {Map|Object} args.clubIdsByUid
 * @param {string[]=} args.publishedIds
 * @param {Map|Object=} args.publishedById - id → payload já espelhado (habilita propagação de edições)
 * @param {string=} args.publishedBy
 * @returns {{ toWrite: Array<{id,payload}>, toRemove: string[], summary: object }}
 */
export function buildGameDayRankingMatches({
  gameDay, participants, games, clubIdsByUid, publishedIds = [], publishedById = null, publishedBy,
}) {
  const publishedSet = new Set(publishedIds);
  const storedById = toStoredMap(publishedById);
  const currentIds = new Set();
  const toWrite = [];
  const staleRemovals = [];
  let published = 0;
  let updated = 0;
  let skipped = 0;
  let already = 0;

  (games || []).forEach((g) => {
    if (!g?.id) return;
    const id = gameDayRankingId(gameDay.id, g.id);
    currentIds.add(id);
    const result = buildGameDayMatch({
      gameDay, gameId: g.id, game: g, participants, clubIdsByUid, publishedBy,
    });

    if (publishedSet.has(id)) {
      // Modo legado (sem base de comparação): já publicado = idempotente.
      if (!storedById) { already += 1; return; }
      // Deixou de ser publicável (empate/indefinido/convidado): remove do espelho.
      if (!result) { staleRemovals.push(id); return; }
      const stored = storedById.get(id) || null;
      if (!mirrorDecisionChanged(stored, result.payload)) { already += 1; return; }
      // Preserva o created_at original ao regravar uma edição.
      if (stored?.created_at) result.payload.created_at = stored.created_at;
      toWrite.push(result); updated += 1; return;
    }

    if (result) { toWrite.push(result); published += 1; } else { skipped += 1; }
  });

  const ghostRemovals = publishedIds.filter((id) => !currentIds.has(id));
  const toRemove = [...ghostRemovals, ...staleRemovals];

  return {
    toWrite,
    toRemove,
    summary: { published, updated, skipped, already_published: already, removed: toRemove.length },
  };
}
