/**
 * Domínio PURO da CONFERÊNCIA e do REGISTRO de exportação DUPR.
 *
 * Resolve o pedido central da governança DUPR: saber, para cada partida da
 * plataforma, se ela JÁ foi exportada/lançada no DUPR ou se ainda está
 * PENDENTE — evitando lançamentos duplicados. Trabalha em duas frentes
 * complementares, ambas sem I/O e sem React:
 *
 *  1. LEDGER local (coleção `dupr_export_log`): a plataforma anota, por partida,
 *     quando ela entrou num CSV baixado (`exported`) e quando o admin confirmou
 *     o lançamento manual no DUPR (`submitted`). É a rede de segurança que
 *     funciona SEM depender de credenciais externas.
 *
 *  2. CONFERÊNCIA com o DUPR (flag reservada `dupr_official_sync`): dado o
 *     histórico de partidas já registradas no DUPR (importado do Partner API
 *     `POST /match/history/search` ou colado pelo admin), casa cada partida
 *     local por uma IMPRESSÃO DIGITAL determinística (data + tipo + IDs DUPR dos
 *     jogadores + placar por game) e/ou pelo `identifier` externo. As casadas
 *     viram `confirmed` (já estão no DUPR); o resto segue `pending`.
 *
 * Precedência da situação (maior vence): confirmed > submitted > exported >
 * pending. Assim o admin sempre vê o estado mais "avançado" conhecido.
 */

/** Situação de uma partida perante o DUPR. */
export const EXPORT_STATUS = Object.freeze({
  PENDING: 'pending',
  EXPORTED: 'exported',
  SUBMITTED: 'submitted',
  CONFIRMED: 'confirmed',
});

/** Rótulos pt-BR curtos (para badges/filtros). */
export const EXPORT_STATUS_LABELS = Object.freeze({
  [EXPORT_STATUS.PENDING]: 'Pendente',
  [EXPORT_STATUS.EXPORTED]: 'Exportada',
  [EXPORT_STATUS.SUBMITTED]: 'Lançada no DUPR',
  [EXPORT_STATUS.CONFIRMED]: 'Confirmada no DUPR',
});

/** Ordem/precedência das situações (maior = mais avançada). */
export const EXPORT_STATUS_RANK = Object.freeze({
  [EXPORT_STATUS.PENDING]: 0,
  [EXPORT_STATUS.EXPORTED]: 1,
  [EXPORT_STATUS.SUBMITTED]: 2,
  [EXPORT_STATUS.CONFIRMED]: 3,
});

/** Tom do badge (primitivas V2Badge) por situação. */
export const EXPORT_STATUS_TONE = Object.freeze({
  [EXPORT_STATUS.PENDING]: 'neutral',
  [EXPORT_STATUS.EXPORTED]: 'blue',
  [EXPORT_STATUS.SUBMITTED]: 'amber',
  [EXPORT_STATUS.CONFIRMED]: 'green',
});

/* --------------------------------- helpers -------------------------------- */

function mapGet(map, key) {
  if (!map || key == null) return undefined;
  if (typeof map.get === 'function') return map.get(key);
  return map[key];
}

/** Normaliza um ID DUPR para comparação (trim + maiúsculas). */
function normId(value) {
  return String(value ?? '').trim().toUpperCase();
}

/**
 * `identifier` externo, único e DETERMINÍSTICO, para enviar ao DUPR e permitir
 * a deduplicação server-side (o DUPR rejeita/ignora `identifier` repetido).
 * Baseado no id estável da partida na plataforma — nunca muda, nunca repete.
 */
export function deterministicIdentifier(matchId) {
  const id = String(matchId ?? '').trim();
  return id ? `pr_${id}` : '';
}

/**
 * Impressão digital canônica de uma partida, INDEPENDENTE da ordem dos times
 * (A×B e B×A geram a mesma) e da ordem dos jogadores dentro do time. Retorna ''
 * quando falta algum ID DUPR (não dá para conferir com segurança).
 *
 * @param {object} p
 * @param {string} p.date  `YYYY-MM-DD`
 * @param {string} p.type  'S' | 'D'
 * @param {Array<{ids:string[], points:number[]}>} p.teams  exatamente 2 times
 */
export function canonicalFingerprint({ date, type, teams } = {}) {
  if (!date || !type || !Array.isArray(teams) || teams.length !== 2) return '';
  const norm = teams.map((t) => ({
    key: (Array.isArray(t?.ids) ? t.ids : []).map(normId).filter(Boolean).sort().join('+'),
    points: (Array.isArray(t?.points) ? t.points : []).map((n) => Math.trunc(Number(n) || 0)),
  }));
  if (norm.some((t) => !t.key)) return '';
  const ordered = [...norm].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const gameCount = Math.max(ordered[0].points.length, ordered[1].points.length);
  const games = [];
  for (let i = 0; i < gameCount; i += 1) {
    games.push(`${ordered[0].points[i] ?? 0}-${ordered[1].points[i] ?? 0}`);
  }
  return `${date}|${type}|${ordered[0].key}|${ordered[1].key}|${games.join(',')}`;
}

/**
 * Impressão digital de uma ENTRY de exportação (a partir de `entry.row`, que já
 * traz os IDs DUPR e o placar por game). '' se algum jogador não tiver ID DUPR.
 */
export function entryFingerprint(entry) {
  const r = entry?.row;
  if (!r) return '';
  const isDoubles = r.matchType === 'D';
  const teamAIds = [r.playerA1DuprId, r.playerA2DuprId].filter(Boolean);
  const teamBIds = [r.playerB1DuprId, r.playerB2DuprId].filter(Boolean);
  // Exige o time COMPLETO com IDs: duplas → 2 por lado, simples → 1 por lado.
  // Uma partida incompleta (algum jogador sem ID DUPR) não é conferível.
  const need = isDoubles ? 2 : 1;
  if (teamAIds.length !== need || teamBIds.length !== need) return '';
  const teamAPoints = [];
  const teamBPoints = [];
  for (let i = 1; i <= 5; i += 1) {
    const a = r[`teamAGame${i}`];
    const b = r[`teamBGame${i}`];
    if (a === '' || a === undefined || a === null) continue;
    teamAPoints.push(a);
    teamBPoints.push(b);
  }
  return canonicalFingerprint({
    date: r.date,
    type: r.matchType,
    teams: [{ ids: teamAIds, points: teamAPoints }, { ids: teamBIds, points: teamBPoints }],
  });
}

/* --------------------- parsing do histórico do DUPR ----------------------- */

/** Extrai o ID DUPR de um "player" que pode ser string ou objeto. */
function playerDuprId(player) {
  if (player == null) return '';
  if (typeof player === 'string' || typeof player === 'number') return normId(player);
  return normId(player.duprId || player.dupr_id || player.id || player.duprID || '');
}

/** Extrai os pontos por game de um time do histórico (game1..game5 ou games[]). */
function teamPoints(team) {
  if (!team || typeof team !== 'object') return [];
  if (Array.isArray(team.games)) return team.games.map((n) => Math.trunc(Number(n) || 0));
  const pts = [];
  for (let i = 1; i <= 5; i += 1) {
    const g = team[`game${i}`];
    if (g === '' || g === undefined || g === null) continue;
    pts.push(Math.trunc(Number(g) || 0));
  }
  return pts;
}

/** IDs DUPR de um time do histórico (player1/player2 ou players[]). */
function teamIds(team) {
  if (!team || typeof team !== 'object') return [];
  if (Array.isArray(team.players)) return team.players.map(playerDuprId).filter(Boolean);
  return [playerDuprId(team.player1), playerDuprId(team.player2)].filter(Boolean);
}

/** Converte o formato do DUPR ('SINGLES'/'DOUBLES') em 'S'/'D'. */
function duprFormatToType(raw, teams) {
  const f = String(raw || '').toUpperCase();
  if (f.startsWith('S')) return 'S';
  if (f.startsWith('D')) return 'D';
  // Inferência pelo tamanho dos times quando o formato não vem no registro.
  const maxTeam = Math.max(...teams.map((t) => t.ids.length), 0);
  return maxTeam >= 2 ? 'D' : 'S';
}

/** Data `YYYY-MM-DD` a partir de vários campos possíveis do DUPR. */
function duprMatchDate(raw) {
  const v = raw?.matchDate || raw?.date || raw?.eventDate || raw?.matchDateTime || '';
  const s = String(v);
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

/**
 * Normaliza UM registro do histórico do DUPR para `{ date, type, identifier,
 * matchCode, fingerprint }`. Tolerante a formatos (Partner API e legado);
 * devolve `null` se não der para extrair times com IDs.
 */
export function normalizeDuprHistoryRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rawTeams = Array.isArray(raw.teams) ? raw.teams
    : [raw.teamA, raw.teamB].filter(Boolean);
  const teams = rawTeams.map((t) => ({ ids: teamIds(t), points: teamPoints(t) }));
  if (teams.length !== 2 || teams.some((t) => t.ids.length === 0)) return null;
  const date = duprMatchDate(raw);
  const type = duprFormatToType(raw.matchFormat || raw.format || raw.eventFormat, teams);
  const identifier = String(raw.identifier || '').trim();
  const matchCode = String(raw.matchCode || raw.matchId || raw.hashedMatchCode || raw.id || '').trim();
  return {
    date,
    type,
    identifier,
    matchCode,
    fingerprint: canonicalFingerprint({ date, type, teams }),
  };
}

/**
 * Encontra o array de partidas dentro de respostas variadas do DUPR
 * (`{result:{hits}}`, `{result:{matches}}`, `{hits}`, `{matches}`, array cru).
 */
function extractHistoryArray(input) {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];
  const r = input.result || input.data || input;
  if (Array.isArray(r)) return r;
  return r.hits || r.matches || r.content || r.records || [];
}

/**
 * Faz o parse do histórico do DUPR (string JSON, objeto de resposta ou array)
 * e devolve os registros normalizados. NUNCA lança — em erro devolve `[]`.
 */
export function parseDuprHistory(input) {
  let data = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      data = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  return extractHistoryArray(data)
    .map(normalizeDuprHistoryRecord)
    .filter(Boolean);
}

/**
 * Índice do histórico DUPR para busca O(1): por impressão digital, por
 * `identifier` externo e por `matchCode`.
 */
export function buildDuprIndex(records = []) {
  const byFingerprint = new Set();
  const byIdentifier = new Set();
  const byMatchCode = new Set();
  records.forEach((rec) => {
    if (rec?.fingerprint) byFingerprint.add(rec.fingerprint);
    if (rec?.identifier) byIdentifier.add(rec.identifier);
    if (rec?.matchCode) byMatchCode.add(rec.matchCode);
  });
  return { byFingerprint, byIdentifier, byMatchCode, count: records.length };
}

/* ----------------------------- classificação ------------------------------ */

function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Classifica a situação DUPR de UMA entry cruzando o ledger local com o índice
 * do histórico DUPR (quando houver conferência ativa).
 *
 * @param {object} entry  entry de exportação (com `.id` e `.row`)
 * @param {object} ctx
 * @param {Map|object} [ctx.ledgerByKey]  registro local por id de partida
 * @param {object} [ctx.duprIndex]        índice de `buildDuprIndex` (opcional)
 * @returns {{status:string, rank:number, exportedAt:number, submittedAt:number,
 *   confirmed:boolean, fingerprint:string}}
 */
export function classifyEntry(entry, { ledgerByKey, duprIndex } = {}) {
  const ledger = mapGet(ledgerByKey, entry?.id) || null;
  const fingerprint = entryFingerprint(entry);
  const identifier = deterministicIdentifier(entry?.id);

  const confirmed = !!(duprIndex && (
    (identifier && duprIndex.byIdentifier?.has(identifier))
    || (fingerprint && duprIndex.byFingerprint?.has(fingerprint))
  ));

  let status = EXPORT_STATUS.PENDING;
  if (ledger?.status === EXPORT_STATUS.SUBMITTED) status = EXPORT_STATUS.SUBMITTED;
  else if (ledger?.status === EXPORT_STATUS.EXPORTED || ledger?.exported_at) status = EXPORT_STATUS.EXPORTED;
  if (confirmed) status = EXPORT_STATUS.CONFIRMED;

  return {
    status,
    rank: EXPORT_STATUS_RANK[status],
    exportedAt: toMillis(ledger?.exported_at),
    submittedAt: toMillis(ledger?.submitted_at),
    confirmed,
    fingerprint,
  };
}

/**
 * Anexa a situação DUPR a cada entry (imutável — devolve novas entries com
 * `.situation` e `.situationRank` para ordenar/filtrar). NÃO altera as originais.
 */
export function buildReconciliationView(entries = [], ctx = {}) {
  return entries.map((entry) => {
    const situation = classifyEntry(entry, ctx);
    return { ...entry, situation, situationRank: situation.rank };
  });
}

/** Conta as entries por situação + total conferido no DUPR. */
export function summarizeSituations(view = []) {
  const out = {
    total: view.length,
    pending: 0,
    exported: 0,
    submitted: 0,
    confirmed: 0,
  };
  view.forEach((e) => {
    const s = e?.situation?.status || EXPORT_STATUS.PENDING;
    if (out[s] !== undefined) out[s] += 1;
  });
  return out;
}

/** Filtra a view por situação ('' = todas). */
export function filterBySituation(view = [], situation = '') {
  if (!situation) return view;
  return view.filter((e) => (e?.situation?.status || EXPORT_STATUS.PENDING) === situation);
}

/* ------------------------------ ledger (upserts) -------------------------- */

/**
 * Monta os upserts do ledger para uma ação (`exported` ou `submitted`). Mantém a
 * situação MONOTÔNICA: nunca rebaixa um `submitted` para `exported`. Cada item é
 * `{ id, data }` — o serviço faz o `set(..., { merge:true })` e acrescenta os
 * carimbos de servidor.
 *
 * @param {Array<object>} entries  entries de exportação (com `.id` e `.row`)
 * @param {object} opts
 * @param {string} opts.status  EXPORT_STATUS.EXPORTED | EXPORT_STATUS.SUBMITTED
 * @param {number} [opts.at=Date.now()]  instante da ação (ms)
 * @param {Map|object} [opts.ledgerByKey]  ledger atual (para não rebaixar)
 * @returns {Array<{id:string, data:object}>}
 */
export function buildLedgerUpserts(entries = [], { status, at = Date.now(), ledgerByKey } = {}) {
  const nextRank = EXPORT_STATUS_RANK[status] ?? 0;
  const upserts = [];
  entries.forEach((entry) => {
    if (!entry?.id) return;
    const prev = mapGet(ledgerByKey, entry.id) || null;
    const prevRank = EXPORT_STATUS_RANK[prev?.status] ?? 0;
    const finalStatus = nextRank >= prevRank ? status : prev.status;

    const data = {
      match_id: entry.id,
      source: entry.source || null,
      match_type: entry.match_type || null,
      event_name: entry.row?.event || '',
      match_date: entry.row?.date || '',
      fingerprint: entryFingerprint(entry),
      identifier: deterministicIdentifier(entry.id),
      status: finalStatus,
    };
    if (status === EXPORT_STATUS.EXPORTED) data.exported_at = at;
    if (status === EXPORT_STATUS.SUBMITTED) data.submitted_at = at;

    upserts.push({ id: entry.id, data });
  });
  return upserts;
}

/**
 * Resumo do ledger para o painel "Última exportação": instante da atividade
 * mais recente + contagens. Aceita `Map` ou objeto simples.
 */
export function latestExportInfo(ledgerByKey) {
  const values = ledgerByKey instanceof Map
    ? [...ledgerByKey.values()]
    : Object.values(ledgerByKey || {});
  let lastActivityAt = 0;
  let exportedCount = 0;
  let submittedCount = 0;
  values.forEach((v) => {
    const exp = toMillis(v?.exported_at);
    const sub = toMillis(v?.submitted_at);
    lastActivityAt = Math.max(lastActivityAt, exp, sub);
    if (v?.status === EXPORT_STATUS.SUBMITTED || sub) submittedCount += 1;
    else if (v?.status === EXPORT_STATUS.EXPORTED || exp) exportedCount += 1;
  });
  return { lastActivityAt, exportedCount, submittedCount, total: values.length };
}
