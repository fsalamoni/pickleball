/**
 * Domínio puro do agregado "meus jogos" de dia de jogo — normaliza os jogos em
 * que o atleta participou (do espelho `club_event_games` e da fonte
 * `game_days/.../games`) num formato único e os funde nas estatísticas.
 *
 * Regra do produto: em "Meu desempenho" (estatística + meus jogos) entram TODOS
 * os jogos que o atleta participa, sempre — independente de publicação no
 * ranking. A publicação afeta apenas o ranking individual e o de duplas.
 *
 * Sem I/O — recebe documentos já carregados.
 */

import { winRate, normalizeStatsFormat } from '@/modules/performance/domain/playerStats.js';
import { toMillis } from '@/modules/tournament/domain/participation.js';
import { buildParticipantResolver, resolveSlotUid } from '@/modules/clubs/domain/rankingPublishing.js';

/**
 * Por que um jogo do atleta NÃO está no ranking da plataforma. O jogo continua
 * contando no "Meu desempenho" — o motivo existe para a tela EXPLICAR a
 * diferença entre "joguei 30" e "o ranking mostra 12", em vez de deixá-la
 * parecer defeito.
 */
export const OUT_OF_RANKING_REASON = Object.freeze({
  /** O dia de jogo não foi publicado no ranking (é decisão de quem organiza). */
  NOT_PUBLISHED: 'nao_publicado',
  /** Há atleta sem conta (convidado) na partida — o ranking só conta quem tem conta. */
  GUEST: 'convidado_sem_conta',
  /** Publicado e completo, mas ainda não espelhado (a publicação precisa ser atualizada). */
  PENDING_SYNC: 'publicacao_desatualizada',
});

/** Origem de um jogo agregado. */
export const MY_GAME_SOURCE = Object.freeze({
  GAME_DAY: 'game_day', // dia de jogo do atleta
  CLUB_GAME_DAY: 'club_game_day', // dia de jogo de clube (publicado)
});

/** Id determinístico do espelho de um jogo de dia de jogo do atleta. */
export function gameDayMirrorId(gameDayId, gameId) {
  return `gd_${gameDayId}_${gameId}`;
}

/**
 * Normaliza um documento do espelho `club_event_games` para "meu jogo".
 * Retorna null se não decidido ou se o atleta não participa.
 *
 * @param {string} uid
 * @param {object} m - doc de club_event_games
 * @param {Map<string,string>} [nameByUid] - uid → nome (adversários)
 */
export function mirrorGameToMyGame(uid, m, nameByUid) {
  if (!m || (m.winner_side !== 'a' && m.winner_side !== 'b')) return null;
  const a = Array.isArray(m.side_a_ids) ? m.side_a_ids.filter(Boolean) : [];
  const b = Array.isArray(m.side_b_ids) ? m.side_b_ids.filter(Boolean) : [];
  const mine = a.includes(uid) ? 'a' : (b.includes(uid) ? 'b' : null);
  if (!mine) return null;
  const myUids = mine === 'a' ? a : b;
  const oppUids = mine === 'a' ? b : a;
  const scoreA = Number(m.score_a) || 0;
  const scoreB = Number(m.score_b) || 0;
  const source = m.source === 'athlete_game_day' ? MY_GAME_SOURCE.GAME_DAY : MY_GAME_SOURCE.CLUB_GAME_DAY;
  const resolveName = (id) => (nameByUid && nameByUid.get(id)) || 'Atleta';
  return {
    id: m.id,
    at: toMillis(m.result_recorded_at) || toMillis(m.created_at) || 0,
    // Americano/duplas: sempre duplas; só individual se o espelho marcou singles.
    kind: normalizeStatsFormat(m.kind),
    label: m.event_title || 'Dia de jogo',
    source,
    // Só o dia de jogo modular tem página própria (`/dia-de-jogo/:id`); o
    // `event_id` do legado de clube é o EVENTO, não um dia de jogo.
    gameDayId: m.source === 'athlete_game_day' ? (m.event_id || null) : null,
    // Parceiro(s) da MINHA dupla (os do meu lado que não sou eu). Vazio = individual.
    partner: myUids.filter((id) => id !== uid).map(resolveName).join(' / '),
    opponent: oppUids.map(resolveName).join(' / ') || 'Adversário',
    // Um a um (confronto direto por PESSOA): no dia de jogo as duplas giram,
    // e "Caio / Duda" quase nunca se repete — "Caio" se repete sempre.
    opponents: oppUids.map(resolveName),
    // Quem jogou, por conta (uid) — a avaliação pós-jogo e a carta ao
    // companheiro precisam de QUEM, não do nome. Aditivo.
    partnerUids: myUids.filter((id) => id && id !== uid),
    opponentUids: oppUids.filter(Boolean),
    // A chave do jogo publicado: é o id do espelho em `club_event_games`, o que
    // o servidor confere ao agregar a reputação.
    matchKey: m.id ? `gd:${m.id}` : null,
    myScore: mine === 'a' ? scoreA : scoreB,
    oppScore: mine === 'a' ? scoreB : scoreA,
    won: m.winner_side === mine,
    walkover: false,
    // Veio do espelho publicado: é exatamente o que o ranking conta.
    ranked: true,
    outReason: null,
  };
}

/**
 * Normaliza um jogo da fonte `game_days/{id}/games` (schema do organizador:
 * `side_a`/`side_b` = [{ id (participantId), name }]). Resolve o user_id via o
 * mapa de participantes. Retorna null se não decidido ou se o atleta não jogou.
 *
 * @param {string} uid
 * @param {string} gameDayId
 * @param {string} gdTitle
 * @param {object} game
 * @param {Map<string,object>} partById - participantId → participante (com user_id)
 */
export function sourceGameToMyGame(uid, gameDayId, gdTitle, game, partById, { published = false } = {}) {
  if (!game) return null;
  const sa = Number(game.score_a);
  const sb = Number(game.score_b);
  if (game.score_a == null || game.score_b == null || sa === sb) return null; // só decididos
  // Mesma resolução da PUBLICAÇÃO (`resolveSlotUid`): pelo participante, pelo
  // uid selado no próprio slot (atleta que saiu do dia depois de jogar) e pelo
  // nome único do dia. Antes só o id do participante valia, e o jogo de quem
  // tinha saído do dia sumia do "Meu desempenho".
  const participants = Array.from((partById || new Map()).entries())
    .map(([id, p]) => ({ id, ...(p || {}) }));
  const resolver = buildParticipantResolver(participants);
  const slotUid = (slot) => resolveSlotUid(slot, resolver);
  const aU = (game.side_a || []).map(slotUid);
  const bU = (game.side_b || []).map(slotUid);
  const mine = aU.includes(uid) ? 'a' : (bU.includes(uid) ? 'b' : null);
  if (!mine) return null;
  const mySide = mine === 'a' ? game.side_a : game.side_b;
  const myUids = mine === 'a' ? aU : bU;
  const oppSide = mine === 'a' ? game.side_b : game.side_a;
  // Dia de jogo do atleta é sempre em DUPLAS (americano/mexicano/rei da quadra).
  // O formato não muda por um parceiro não estar cadastrado — vale o `kind` do
  // jogo (que nasce 'doubles'); a heurística por nº de jogadores foi removida
  // porque contava como individual um jogo de duplas com parceiro avulso.
  const kind = normalizeStatsFormat(game.kind);
  // Parceiro(s) da MINHA dupla: os do meu lado que não sou eu (inclui
  // convidados avulsos, que não têm user_id).
  const partner = (mySide || [])
    .filter((p, i) => myUids[i] !== uid)
    .map((p) => p.name)
    .join(' / ');
  const temConvidado = [...aU, ...bU].some((u) => !u);
  let outReason = OUT_OF_RANKING_REASON.PENDING_SYNC;
  if (!published) outReason = OUT_OF_RANKING_REASON.NOT_PUBLISHED;
  else if (temConvidado) outReason = OUT_OF_RANKING_REASON.GUEST;
  return {
    id: gameDayMirrorId(gameDayId, game.id),
    at: toMillis(game.updated_at) || toMillis(game.created_at) || 0,
    kind,
    label: gdTitle || 'Dia de jogo',
    source: MY_GAME_SOURCE.GAME_DAY,
    gameDayId,
    partner,
    opponent: (oppSide || []).map((p) => p.name).join(' / ') || 'Adversário',
    partnerUids: myUids.filter((id, i) => id && id !== uid && (mySide || [])[i]),
    opponentUids: (mine === 'a' ? bU : aU).filter(Boolean),
    // Só o jogo PUBLICADO tem espelho (e portanto como o servidor conferir).
    matchKey: published ? `gd:${gameDayMirrorId(gameDayId, game.id)}` : null,
    myScore: mine === 'a' ? sa : sb,
    oppScore: mine === 'a' ? sb : sa,
    won: mine === 'a' ? sa > sb : sb > sa,
    walkover: false,
    // Só a FONTE do dia de jogo: o espelho publicado (que é o que o ranking
    // conta) chega por `mirrorGameToMyGame` e vence a deduplicação.
    ranked: false,
    outReason,
  };
}

/**
 * Resumo do que, entre os jogos de dia de jogo do atleta, está FORA do
 * ranking, por motivo. Pura.
 *
 * @param {Array<{ ranked?: boolean, outReason?: string|null }>} games
 * @returns {{ total: number, ranked: number, out: number, byReason: Record<string, number> }}
 */
export function summarizeRankingCoverage(games) {
  const lista = Array.isArray(games) ? games : [];
  const byReason = {};
  let ranked = 0;
  lista.forEach((g) => {
    if (g?.ranked) { ranked += 1; return; }
    const motivo = g?.outReason || OUT_OF_RANKING_REASON.PENDING_SYNC;
    byReason[motivo] = (byReason[motivo] || 0) + 1;
  });
  return { total: lista.length, ranked, out: lista.length - ranked, byReason };
}

/**
 * Funde uma lista de jogos agregados (dia de jogo) nas estatísticas do jogador,
 * atualizando jogos/vitórias/derrotas/aproveitamento — geral e por formato.
 * Não altera torneios/inscrições/títulos/pódios.
 *
 * @param {object} stats - resultado de buildPlayerStats
 * @param {Array} games - jogos normalizados (mirrorGameToMyGame/sourceGameToMyGame)
 */
export function foldGameDayGamesIntoStats(stats, games) {
  const base = stats || {};
  let played = Number(base.played) || 0;
  let wins = Number(base.wins) || 0;
  let losses = Number(base.losses) || 0;
  const byFormat = {};
  Object.entries(base.byFormat || {}).forEach(([k, v]) => { byFormat[k] = { ...v }; });

  (games || []).forEach((g) => {
    played += 1;
    if (g.won) wins += 1; else losses += 1;
    const fmt = normalizeStatsFormat(g.kind);
    const b = byFormat[fmt] || { played: 0, wins: 0, losses: 0 };
    b.played += 1;
    if (g.won) b.wins += 1; else b.losses += 1;
    b.winRate = winRate(b.wins, b.losses);
    byFormat[fmt] = b;
  });

  return {
    ...base,
    played,
    wins,
    losses,
    winRate: winRate(wins, losses),
    byFormat,
  };
}

/**
 * Registros de confronto direto (`{ opponent, won, at }`) a partir dos jogos
 * de dia de jogo — UM por adversário, não por dupla adversária. Pura.
 *
 * @param {Array<{ opponents?: string[], opponent?: string, won: boolean, at?: number }>} games
 * @returns {Array<{ opponent: string, won: boolean, at: number }>}
 */
export function gameDayGamesToH2HRecords(games) {
  const out = [];
  (games || []).forEach((g) => {
    const nomes = Array.isArray(g?.opponents) && g.opponents.length > 0
      ? g.opponents
      : [g?.opponent].filter(Boolean);
    nomes.forEach((nome) => {
      const opponent = String(nome || '').trim();
      // "Atleta" é o nome de quem não tem perfil: juntar todos sob um nome só
      // inventaria um rival que não existe.
      if (!opponent || opponent === 'Atleta') return;
      out.push({ opponent, won: Boolean(g.won), at: Number(g.at) || 0 });
    });
  });
  return out;
}
