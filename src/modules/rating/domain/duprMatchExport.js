/**
 * Domínio PURO da exportação de partidas para o DUPR (flag `dupr_match_export`).
 *
 * Reaproveita a MESMA base de jogos finalizados do ranking da plataforma
 * (torneios em `tournament_matches` + dias de jogo/eventos/confrontos de equipe
 * espelhados em `club_event_games`) — a mesma fonte de `normalizeFinishedGames`
 * e `listFinishedEngineMatches` —, porém preservando o que o CSV do DUPR exige:
 * placar POR GAME (até 5), nome do evento, data, local e tipo (simples/duplas).
 *
 * Sem I/O: recebe as listas cruas + mapas de referência e devolve:
 *  - `normalizeExportMatches` → partidas normalizadas (para filtrar/pré-visualizar)
 *  - `buildDuprEntries`       → linhas do DUPR (27 colunas) + prontidão (ID DUPR)
 *  - `buildDuprCsv`           → string CSV no formato de upload de clubes do DUPR
 *
 * Formato do CSV (autoridade: o próprio DUPR, seção "Adding Matches via CSV"):
 *  - 27 colunas camelCase, separador VÍRGULA, datas `YYYY-MM-DD`.
 *  - `matchType`: `S` (simples) ou `D` (duplas).
 *  - `scoreType`: `SIDEOUT` (lado-fora, tradicional) ou `RALLY`.
 *  - IDs DUPR (não nomes) identificam os jogadores; sem eles a linha não sobe.
 */

import { toMillis } from '@/modules/tournament/domain/participation';

/** Máximo de games que o DUPR aceita por partida. */
export const DUPR_MAX_GAMES = 5;

/** Tipos de pontuação aceitos pelo DUPR. */
export const DUPR_SCORE_TYPE = Object.freeze({ SIDEOUT: 'SIDEOUT', RALLY: 'RALLY' });

export const DUPR_SCORE_TYPE_LABELS = Object.freeze({
  [DUPR_SCORE_TYPE.SIDEOUT]: 'Lado-fora (tradicional)',
  [DUPR_SCORE_TYPE.RALLY]: 'Rally (ponto corrido)',
});

/** Tipo de partida no DUPR (S = simples, D = duplas). */
export const DUPR_MATCH_TYPE = Object.freeze({ SINGLES: 'S', DOUBLES: 'D' });

/** Origem da partida na plataforma (para filtro e rótulo). */
export const DUPR_EXPORT_SOURCE = Object.freeze({
  TOURNAMENT: 'tournament',
  GAME_DAY: 'game_day',
  CLUB_EVENT: 'club_event',
  TEAM: 'team_confrontation',
});

export const DUPR_EXPORT_SOURCE_LABELS = Object.freeze({
  [DUPR_EXPORT_SOURCE.TOURNAMENT]: 'Torneio',
  [DUPR_EXPORT_SOURCE.GAME_DAY]: 'Dia de jogo',
  [DUPR_EXPORT_SOURCE.CLUB_EVENT]: 'Evento de clube',
  [DUPR_EXPORT_SOURCE.TEAM]: 'Torneio por equipes',
});

/**
 * Cabeçalhos do CSV, na ORDEM exata exigida pelo DUPR. As chaves batem com as
 * do objeto devolvido por `buildDuprRow`, então o CSV é montado lendo por chave
 * (a ordem de inserção do objeto é irrelevante).
 */
export const DUPR_CSV_HEADERS = Object.freeze([
  'matchType', 'event', 'date',
  'playerA1', 'playerA1DuprId', 'playerA1ExternalId',
  'playerA2', 'playerA2DuprId', 'playerA2ExternalId',
  'playerB1', 'playerB1DuprId', 'playerB1ExternalId',
  'playerB2', 'playerB2DuprId', 'playerB2ExternalId',
  'teamAGame1', 'teamBGame1', 'teamAGame2', 'teamBGame2', 'teamAGame3', 'teamBGame3',
  'teamAGame4', 'teamBGame4', 'teamAGame5', 'teamBGame5',
  'location', 'scoreType',
]);

/* --------------------------------- helpers -------------------------------- */

function mapGet(map, key) {
  if (!map || key == null) return undefined;
  if (typeof map.get === 'function') return map.get(key);
  return map[key];
}

/** `true` para uma string exatamente no formato `YYYY-MM-DD`. */
function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Formata um instante (ms) como `YYYY-MM-DD` em UTC — estável entre fusos e
 * determinístico em testes. Datas explícitas (ex.: `game_days.date`) são usadas
 * sem conversão, evitando qualquer deslocamento de fuso.
 */
export function formatDuprDate(millis) {
  if (!millis) return '';
  const d = new Date(millis);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ms de uma data `YYYY-MM-DD` (meio-dia UTC, para ordenar sem risco de fuso). */
function isoDateToMillis(value) {
  if (!isIsoDate(value)) return 0;
  const ms = Date.parse(`${value}T12:00:00Z`);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Normaliza a lista de games para `[{a,b}]` inteiros (máx. 5), descartando inválidos. */
function cleanGames(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const g of raw) {
    const a = Number(g?.a);
    const b = Number(g?.b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    out.push({ a: Math.trunc(a), b: Math.trunc(b) });
    if (out.length >= DUPR_MAX_GAMES) break;
  }
  return out;
}

/** Junta partes não-vazias de um local/endereço com vírgula. */
function joinLocation(...parts) {
  return parts.map((p) => String(p ?? '').trim()).filter(Boolean).join(', ');
}

function tournamentLocation(t) {
  if (!t) return '';
  return joinLocation(t.venue || t.location, t.city, t.state);
}

function gameDayLocation(gd) {
  if (!gd) return '';
  return joinLocation(gd.location, gd.city, gd.state);
}

function clubEventLocation(ev, clubById) {
  if (!ev) return '';
  const club = mapGet(clubById, ev.club_id) || {};
  return joinLocation(ev.location, club.home_venue, club.city, club.state);
}

/**
 * Resolve os uids reais de um lado de um jogo de TORNEIO a partir das
 * inscrições (o `side_x_ids` guarda ids de INSCRIÇÃO, não uids). Só é
 * `complete` se todos os jogadores obrigatórios tiverem conta.
 */
function registrationSideUids(sideIds, regById) {
  const uids = [];
  let complete = true;
  (sideIds || []).forEach((regId) => {
    const reg = mapGet(regById, regId);
    if (!reg) { complete = false; return; }
    const isDoubles = reg.format === 'doubles';
    const a = reg.player_a_user_id || null;
    const b = reg.player_b_user_id || null;
    if (isDoubles) {
      if (!a || !b) complete = false;
      if (a) uids.push(a);
      if (b) uids.push(b);
    } else {
      if (!a) complete = false;
      else uids.push(a);
    }
  });
  if (uids.length === 0) complete = false;
  return { uids, complete };
}

/** Mapeia a `source` do `club_event_games` para a origem de exportação. */
function mapClubEventSource(source) {
  if (source === 'athlete_game_day') return DUPR_EXPORT_SOURCE.GAME_DAY;
  if (source === 'team_confrontation') return DUPR_EXPORT_SOURCE.TEAM;
  return DUPR_EXPORT_SOURCE.CLUB_EVENT;
}

/* ------------------------------ normalização ------------------------------ */

/**
 * Constrói a lista de partidas normalizadas para exportação a partir das fontes
 * canônicas de jogos decididos. Ignora WOs/sem placar e jogos com jogadores
 * sem conta (mesma regra do ranking). Sem I/O.
 *
 * @param {object} params
 * @param {Array<object>} [params.tournamentMatches] docs de `tournament_matches`
 * @param {Array<object>} [params.clubEventMatches]   docs de `club_event_games`
 * @param {Map|object} [params.regById]        inscrição por id
 * @param {Map|object} [params.tournamentById] torneio por id
 * @param {Map|object} [params.gameDayById]    dia de jogo por id
 * @param {Map|object} [params.clubEventById]  evento de clube por id
 * @param {Map|object} [params.clubById]       clube por id (para local do evento)
 * @returns {Array<object>} partidas normalizadas
 */
export function normalizeExportMatches({
  tournamentMatches = [], clubEventMatches = [],
  regById, tournamentById, gameDayById, clubEventById, clubById,
} = {}) {
  const out = [];

  // 1) Jogos de torneio (id de inscrição → uids via inscrições).
  tournamentMatches.forEach((m) => {
    if (m.team_confrontation) return; // espelhado por etapa em club_event_games
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const a = registrationSideUids(m.side_a_ids, regById);
    const b = registrationSideUids(m.side_b_ids, regById);
    if (!a.complete || !b.complete) return;
    if (a.uids.length !== b.uids.length) return;
    if (a.uids.length < 1 || a.uids.length > 2) return;
    const games = cleanGames(m.games);
    if (games.length === 0) return; // sem placar por game (ex.: WO)

    const t = mapGet(tournamentById, m.tournament_id) || {};
    const at = toMillis(m.result_recorded_at) || toMillis(m.updated_at)
      || toMillis(m.created_at) || toMillis(t.starts_at);
    out.push({
      id: m.id || `tm_${m.tournament_id || ''}_${m.modality_id || ''}_${out.length}`,
      source: DUPR_EXPORT_SOURCE.TOURNAMENT,
      match_type: a.uids.length === 2 ? DUPR_MATCH_TYPE.DOUBLES : DUPR_MATCH_TYPE.SINGLES,
      event_name: t.name || 'Torneio',
      location: tournamentLocation(t),
      at,
      date: formatDuprDate(at),
      side_a_uids: a.uids,
      side_b_uids: b.uids,
      games,
      tournament_id: m.tournament_id || null,
      club_id: null,
      game_day_id: null,
      event_id: null,
      winner_side: m.winner_side,
    });
  });

  // 2) Espelho do ranking: dias de jogo, eventos de clube e confrontos de equipe.
  clubEventMatches.forEach((m, idx) => {
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const aUids = (Array.isArray(m.side_a_ids) ? m.side_a_ids : []).filter(Boolean);
    const bUids = (Array.isArray(m.side_b_ids) ? m.side_b_ids : []).filter(Boolean);
    if (aUids.length === 0 || bUids.length === 0) return;
    if (aUids.length !== bUids.length || aUids.length > 2) return;

    const explicitGames = cleanGames(m.games);
    const games = explicitGames.length
      ? explicitGames
      : [{ a: Math.trunc(Number(m.score_a) || 0), b: Math.trunc(Number(m.score_b) || 0) }];

    const source = mapClubEventSource(m.source);
    let eventName = m.event_title || '';
    let location = '';
    let at = 0;
    let dateStr = '';
    let tournamentId = null;
    let clubId = m.club_id || null;
    let gameDayId = null;
    let eventId = null;

    if (source === DUPR_EXPORT_SOURCE.GAME_DAY) {
      const gd = mapGet(gameDayById, m.event_id) || {};
      eventName = gd.title || eventName || 'Dia de jogo';
      location = gameDayLocation(gd);
      gameDayId = m.event_id || null;
      dateStr = isIsoDate(gd.date) ? gd.date : '';
      at = dateStr ? isoDateToMillis(dateStr)
        : (toMillis(m.result_recorded_at) || toMillis(m.created_at));
    } else if (source === DUPR_EXPORT_SOURCE.TEAM) {
      const t = mapGet(tournamentById, m.tournament_id) || {};
      eventName = t.name || eventName || 'Torneio por equipes';
      location = tournamentLocation(t);
      tournamentId = m.tournament_id || null;
      at = toMillis(m.result_recorded_at) || toMillis(t.starts_at) || toMillis(m.created_at);
    } else {
      const ev = mapGet(clubEventById, m.event_id) || {};
      eventName = ev.title || eventName || 'Evento de clube';
      location = clubEventLocation(ev, clubById);
      eventId = m.event_id || null;
      clubId = m.club_id || ev.club_id || null;
      at = toMillis(m.result_recorded_at) || toMillis(ev.starts_at) || toMillis(m.created_at);
    }

    out.push({
      id: m.id || `ceg_${idx}`,
      source,
      match_type: aUids.length === 2 ? DUPR_MATCH_TYPE.DOUBLES : DUPR_MATCH_TYPE.SINGLES,
      event_name: eventName,
      location,
      at,
      date: dateStr || formatDuprDate(at),
      side_a_uids: aUids,
      side_b_uids: bUids,
      games,
      tournament_id: tournamentId,
      club_id: clubId,
      game_day_id: gameDayId,
      event_id: eventId,
      winner_side: m.winner_side,
    });
  });

  return out;
}

/* -------------------------------- filtros --------------------------------- */

/**
 * Filtra partidas normalizadas pelos parâmetros do admin. Todos opcionais.
 *
 * @param {Array<object>} matches
 * @param {object} filters
 * @param {string} [filters.dateFrom] `YYYY-MM-DD` (inclusive)
 * @param {string} [filters.dateTo]   `YYYY-MM-DD` (inclusive)
 * @param {string} [filters.tournamentId]
 * @param {string} [filters.clubId]
 * @param {string} [filters.gameDayId]
 * @param {string} [filters.eventId]
 * @param {string} [filters.athleteUid]
 * @param {string} [filters.matchType] 'S' | 'D'
 * @param {string} [filters.source]    uma das DUPR_EXPORT_SOURCE
 * @returns {Array<object>}
 */
export function filterExportMatches(matches = [], filters = {}) {
  const {
    dateFrom, dateTo, tournamentId, clubId, gameDayId, eventId,
    athleteUid, matchType, source,
  } = filters;

  return matches.filter((m) => {
    if (dateFrom) {
      if (!m.date || m.date < dateFrom) return false;
    }
    if (dateTo) {
      if (!m.date || m.date > dateTo) return false;
    }
    if (tournamentId && m.tournament_id !== tournamentId) return false;
    if (clubId && m.club_id !== clubId) return false;
    if (gameDayId && m.game_day_id !== gameDayId) return false;
    if (eventId && m.event_id !== eventId) return false;
    if (matchType && m.match_type !== matchType) return false;
    if (source && m.source !== source) return false;
    if (athleteUid
      && !m.side_a_uids.includes(athleteUid)
      && !m.side_b_uids.includes(athleteUid)) return false;
    return true;
  });
}

/* ------------------------------ linhas do DUPR ---------------------------- */

function playerFields(uid, profileById) {
  const p = uid ? mapGet(profileById, uid) : null;
  return {
    uid: uid || '',
    name: p ? (p.name || '') : '',
    duprId: p ? (p.dupr_id || '') : '',
  };
}

/**
 * Monta UMA linha do CSV do DUPR + metadados de prontidão (quais jogadores
 * ainda não têm ID DUPR — sem eles a linha não sobe no DUPR).
 *
 * @param {object} match  partida normalizada (de `normalizeExportMatches`)
 * @param {Map|object} profileById  uid → { name, dupr_id }
 * @param {object} [opts]
 * @param {string} [opts.scoreType=SIDEOUT]
 * @param {boolean} [opts.includeExternalId=true] usa o uid interno como externalId
 * @returns {{ row: object, ready: boolean, missing: string[], source: string, match_type: string, at: number }}
 */
export function buildDuprRow(match, profileById, opts = {}) {
  const { scoreType = DUPR_SCORE_TYPE.SIDEOUT, includeExternalId = true } = opts;
  const isDoubles = match.match_type === DUPR_MATCH_TYPE.DOUBLES;

  const a1 = playerFields(match.side_a_uids[0], profileById);
  const a2 = playerFields(match.side_a_uids[1], profileById);
  const b1 = playerFields(match.side_b_uids[0], profileById);
  const b2 = playerFields(match.side_b_uids[1], profileById);

  const ext = (v) => (includeExternalId ? v : '');

  const row = {
    matchType: match.match_type,
    event: match.event_name || '',
    date: match.date || '',
    playerA1: a1.name,
    playerA1DuprId: a1.duprId,
    playerA1ExternalId: ext(a1.uid),
    playerA2: isDoubles ? a2.name : '',
    playerA2DuprId: isDoubles ? a2.duprId : '',
    playerA2ExternalId: isDoubles ? ext(a2.uid) : '',
    playerB1: b1.name,
    playerB1DuprId: b1.duprId,
    playerB1ExternalId: ext(b1.uid),
    playerB2: isDoubles ? b2.name : '',
    playerB2DuprId: isDoubles ? b2.duprId : '',
    playerB2ExternalId: isDoubles ? ext(b2.uid) : '',
    location: match.location || '',
    scoreType,
  };

  for (let i = 0; i < DUPR_MAX_GAMES; i += 1) {
    const g = match.games[i];
    row[`teamAGame${i + 1}`] = g ? g.a : '';
    row[`teamBGame${i + 1}`] = g ? g.b : '';
  }

  const missing = [];
  if (!a1.duprId) missing.push(a1.name || 'Jogador A1');
  if (!b1.duprId) missing.push(b1.name || 'Jogador B1');
  if (isDoubles) {
    if (!a2.duprId) missing.push(a2.name || 'Jogador A2');
    if (!b2.duprId) missing.push(b2.name || 'Jogador B2');
  }

  return {
    row,
    ready: missing.length === 0,
    missing,
    source: match.source,
    match_type: match.match_type,
    at: match.at,
  };
}

/**
 * Constrói as linhas (com metadados) de uma lista de partidas normalizadas,
 * ordenadas por data (mais antigas primeiro — ordem natural de disputa).
 */
export function buildDuprEntries(matches = [], profileById, opts = {}) {
  return matches
    .map((m) => buildDuprRow(m, profileById, opts))
    .sort((x, y) => (x.at || 0) - (y.at || 0));
}

/** Resumo de contadores para a UI. */
export function summarizeEntries(entries = []) {
  let ready = 0;
  let singles = 0;
  let doubles = 0;
  entries.forEach((e) => {
    if (e.ready) ready += 1;
    if (e.match_type === DUPR_MATCH_TYPE.DOUBLES) doubles += 1;
    else singles += 1;
  });
  return { total: entries.length, ready, incomplete: entries.length - ready, singles, doubles };
}

/* --------------------------- opções de filtro ----------------------------- */

function countByKey(matches, keyOf, labelOf) {
  const counts = new Map();
  matches.forEach((m) => {
    const key = keyOf(m);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: labelOf(value) || value, count }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
}

/**
 * Deriva as listas de filtro (só entidades que TÊM partidas na base), com
 * rótulos resolvidos e contagem. Puro — recebe os mapas de referência.
 */
export function buildFilterOptions(matches = [], maps = {}) {
  const {
    profileById, tournamentById, clubById, gameDayById, clubEventById,
  } = maps;

  const tournaments = countByKey(matches, (m) => m.tournament_id,
    (id) => (mapGet(tournamentById, id) || {}).name || 'Torneio');
  const clubs = countByKey(matches, (m) => m.club_id,
    (id) => (mapGet(clubById, id) || {}).name || 'Clube');
  const gameDays = countByKey(matches, (m) => m.game_day_id,
    (id) => (mapGet(gameDayById, id) || {}).title || 'Dia de jogo');
  const events = countByKey(matches, (m) => m.event_id,
    (id) => (mapGet(clubEventById, id) || {}).title || 'Evento');

  const athleteCounts = new Map();
  matches.forEach((m) => {
    [...m.side_a_uids, ...m.side_b_uids].forEach((uid) => {
      if (!uid) return;
      athleteCounts.set(uid, (athleteCounts.get(uid) || 0) + 1);
    });
  });
  const athletes = [...athleteCounts.entries()]
    .map(([value, count]) => ({
      value,
      label: (mapGet(profileById, value) || {}).name || 'Atleta',
      count,
    }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));

  return { tournaments, clubs, gameDays, events, athletes };
}

/* ---------------------------------- CSV ----------------------------------- */

/** Escapa um campo CSV (padrão RFC 4180 — aspas quando há vírgula/aspas/quebra). */
export function csvField(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Gera o CSV do DUPR a partir das LINHAS (objetos de 27 campos). Separador
 * vírgula, quebras CRLF, SEM BOM (o BOM quebra a detecção da 1ª coluna no DUPR).
 *
 * @param {Array<object>} rows  objetos com as chaves de DUPR_CSV_HEADERS
 * @returns {string}
 */
export function buildDuprCsv(rows = []) {
  const header = DUPR_CSV_HEADERS.join(',');
  const lines = rows.map((r) => DUPR_CSV_HEADERS.map((h) => csvField(r[h])).join(','));
  return [header, ...lines].join('\r\n');
}

/** Extrai só as linhas (para o CSV) de uma lista de entries, opcionalmente só as prontas. */
export function entriesToRows(entries = [], { readyOnly = false } = {}) {
  return entries.filter((e) => (readyOnly ? e.ready : true)).map((e) => e.row);
}

/** Nome do arquivo CSV a partir do intervalo de datas do filtro. */
export function duprCsvFilename(filters = {}) {
  const clean = (s) => String(s || '').replace(/[^0-9]/g, '');
  const from = clean(filters.dateFrom);
  const to = clean(filters.dateTo);
  const suffix = [from, to].filter(Boolean).join('-');
  return suffix ? `dupr-partidas-${suffix}.csv` : 'dupr-partidas.csv';
}
