/**
 * Núcleo PURO da gamificação no servidor — sem Firestore, sem relógio global.
 *
 * Tudo aqui recebe dados já carregados e devolve dados: é o que dá para provar
 * com teste sem emulador. As leituras e escritas ficam em `gamification.js`.
 *
 * O pacote de Functions é publicado isolado (não importa de `../src`), então
 * as poucas regras que o cliente também tem (semana de Brasília, agregação de
 * avaliações) são cópias fiéis, com teste de paridade contra o cliente em
 * `src/modules/progression/domain/serverParity.test.js`.
 */

const TZ = 'America/Sao_Paulo';
const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ tempo -- */

/** 'YYYY-MM-DD' no fuso da plataforma. */
function brDay(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
}

function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Meia-noite de Brasília da data civil `key`, em ms. */
function dayStartMs(key) {
  let ms = Date.parse(`${key}T00:00:00-03:00`);
  for (let i = 0; i < 3; i += 1) {
    const visto = brDay(ms);
    if (visto === key) {
      if (brDay(ms - 1) !== key) return ms;
      ms -= 3600_000;
    } else {
      ms += visto < key ? 3600_000 : -3600_000;
    }
  }
  return ms;
}

/** A segunda-feira da semana de `ms` (Brasília): 'YYYY-MM-DD'. */
function weekKey(ms) {
  const dia = brDay(ms);
  const [y, m, d] = dia.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(dia, -((dow + 6) % 7));
}

/** [início, fim) da semana cuja segunda é `key`. */
function weekWindow(key) {
  return { startMs: dayStartMs(key), endMs: dayStartMs(addDays(key, 7)) };
}

/** 'YYYY-MM' no fuso da plataforma. */
function monthKey(ms) {
  return brDay(ms).slice(0, 7);
}

/** [início, fim) do mês 'YYYY-MM'. */
function monthWindow(key) {
  const [y, m] = key.split('-').map(Number);
  const prox = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { startMs: dayStartMs(`${key}-01`), endMs: dayStartMs(prox) };
}

/** O mês anterior de 'YYYY-MM'. */
function previousMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/* ----------------------------------------------------------------- jogos -- */

/**
 * Jogos normalizados (saída de `normalizeMatches`) → por pessoa.
 * @param {Array<{ side_a: string[], side_b: string[], winner: 'a'|'b', at: number }>} games
 * @returns {Map<string, Array<{ at: number, won: boolean }>>}
 */
function gamesByUid(games) {
  const mapa = new Map();
  (games || []).forEach((g) => {
    const at = Number(g.at);
    if (!Number.isFinite(at) || at <= 0) return;
    const lado = (uids, ganhou) => (uids || []).forEach((u) => {
      if (!u) return;
      if (!mapa.has(u)) mapa.set(u, []);
      mapa.get(u).push({ at, won: ganhou });
    });
    lado(g.side_a, g.winner === 'a');
    lado(g.side_b, g.winner === 'b');
  });
  return mapa;
}

/**
 * O valor de uma medida de desafio para uma pessoa, numa janela.
 * Reserva e aula chegam como listas de datas já filtradas pelo chamador.
 */
function metricValue(metric, { games = [], bookingDates = [], lessonDates = [], startMs, endMs }) {
  const dentro = (ms) => Number.isFinite(ms) && ms >= startMs && ms < endMs;
  const doPeriodo = games.filter((g) => dentro(g.at));
  switch (metric) {
    case 'games_played': return doPeriodo.length;
    case 'games_won': return doPeriodo.filter((g) => g.won).length;
    case 'active_days': return new Set(doPeriodo.map((g) => brDay(g.at))).size;
    case 'arena_bookings': return bookingDates.filter(dentro).length;
    case 'coach_lessons': return lessonDates.filter(dentro).length;
    default: return 0;
  }
}

/**
 * Posição por valor (competição "1224"), desempate estável pela entrada.
 * @param {Array<{ subjectId: string, value: number, joinedAt?: number, eligible?: boolean }>} entries
 */
function rankEntries(entries) {
  const lista = (entries || []).filter((e) => e && e.eligible !== false)
    .sort((a, b) => (b.value || 0) - (a.value || 0) || (a.joinedAt || 0) - (b.joinedAt || 0)
      || String(a.subjectId).localeCompare(String(b.subjectId)));
  let pos = 0;
  let ultimo = null;
  return lista.map((e, i) => {
    if ((e.value || 0) !== ultimo) { pos = i + 1; ultimo = e.value || 0; }
    return { ...e, position: pos };
  });
}

/* ----------------------------------------------------------------- duelos -- */

/**
 * Emparelha atletas de nível parecido. Gulosa e determinística: ordena por
 * nível, e cada um leva o vizinho mais próximo que ainda está livre, dentro do
 * limite de diferença — preferindo o mesmo estado.
 *
 * @param {Array<{ uid: string, level: number|null, state?: string|null }>} candidatos
 * @param {{ maxLevelGap?: number, jaPareados?: Set<string> }} [opts] pares da semana anterior a evitar
 * @returns {Array<{ a: string, b: string, gap: number }>}
 */
function pairDuels(candidatos, { maxLevelGap = 1, jaPareados = new Set() } = {}) {
  const lista = (candidatos || [])
    .filter((c) => c && c.uid && Number.isFinite(c.level))
    .sort((x, y) => x.level - y.level || x.uid.localeCompare(y.uid));
  const usados = new Set();
  const pares = [];
  for (let i = 0; i < lista.length; i += 1) {
    const a = lista[i];
    if (usados.has(a.uid)) continue;
    let melhor = null;
    for (let j = i + 1; j < lista.length; j += 1) {
      const b = lista[j];
      if (usados.has(b.uid)) continue;
      const gap = b.level - a.level;
      if (gap > maxLevelGap) break; // ordenado: daqui para frente só piora
      const chave = [a.uid, b.uid].sort().join('|');
      if (jaPareados.has(chave)) continue;
      const mesmoEstado = a.state && b.state && a.state === b.state;
      const pontos = gap + (mesmoEstado ? 0 : 0.5); // estado diferente "custa" meio ponto
      if (!melhor || pontos < melhor.pontos) melhor = { b, gap, pontos };
    }
    if (melhor) {
      usados.add(a.uid);
      usados.add(melhor.b.uid);
      pares.push({ a: a.uid, b: melhor.b.uid, gap: Math.round(melhor.gap * 100) / 100 });
    }
  }
  return pares;
}

/** Id do duelo: semana + os dois uids em ordem alfabética. */
function duelId(week, uidA, uidB) {
  const [x, y] = [uidA, uidB].sort();
  return `${week}_${x}_${y}`;
}

/**
 * Resultado de um duelo a partir das vitórias e dos jogos de cada lado.
 * Sem jogo de nenhum dos dois → 'void' (não gera XP: ninguém duelou).
 * @returns {{ outcome: 'a'|'b'|'tie'|'void', winner: string|null }}
 */
function duelOutcome(a, b) {
  if ((a.games || 0) === 0 && (b.games || 0) === 0) return { outcome: 'void', winner: null };
  if (a.wins !== b.wins) return a.wins > b.wins ? { outcome: 'a', winner: a.uid } : { outcome: 'b', winner: b.uid };
  if ((a.games || 0) !== (b.games || 0)) return a.games > b.games ? { outcome: 'a', winner: a.uid } : { outcome: 'b', winner: b.uid };
  return { outcome: 'tie', winner: null };
}

/* ------------------------------------------------------------ reputação ---- */

const REVIEW_TAGS = ['companheiro', 'educado', 'justo', 'pontual', 'esportista', 'energia'];

/**
 * Agrega as avaliações RECEBIDAS por uma pessoa (cópia fiel do cliente).
 */
function aggregateReputation(reviews, { minForPublicScore = 5, minTagVotes = 3 } = {}) {
  const lista = (reviews || []).filter((r) => Number(r && r.rating) >= 1 && Number(r.rating) <= 5);
  const count = lista.length;
  const soma = lista.reduce((s, r) => s + Number(r.rating), 0);
  const tagCounts = {};
  lista.forEach((r) => (r.tags || []).forEach((t) => {
    if (REVIEW_TAGS.includes(t)) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }));
  const topTags = Object.entries(tagCounts)
    .filter(([, n]) => n >= minTagVotes)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => ({ tag, count: n }));
  return {
    count,
    average: count >= minForPublicScore ? Math.round((soma / count) * 10) / 10 : null,
    publicScore: count >= minForPublicScore,
    fiveStarCount: lista.filter((r) => Number(r.rating) === 5).length,
    topTags,
  };
}

/** Pares 1–2★ × 5★ no mesmo jogo (vingança ou combinação) — para revisão humana. */
function suspiciousReviewPairs(reviews) {
  const idx = new Map();
  (reviews || []).forEach((r) => idx.set(`${r.matchKey}|${r.fromUid}|${r.toUid}`, r));
  const out = [];
  const vistos = new Set();
  (reviews || []).forEach((r) => {
    const volta = idx.get(`${r.matchKey}|${r.toUid}|${r.fromUid}`);
    if (!volta) return;
    const chave = [r.fromUid, r.toUid].sort().join('|') + r.matchKey;
    if (vistos.has(chave)) return;
    if ((r.rating <= 2 && volta.rating === 5) || (volta.rating <= 2 && r.rating === 5)) {
      vistos.add(chave);
      out.push({ matchKey: r.matchKey, a: r.fromUid, b: r.toUid });
    }
  });
  return out;
}

/* --------------------------------------------------------------- antifarm -- */

/**
 * XP que a atividade VERIFICADA pelo servidor sustenta: jogos e vitórias (as
 * duas fontes que o servidor enxerga com certeza) com os mesmos pesos do
 * cliente (`XP_WEIGHTS_V2`: jogo 10, vitória 20).
 */
function verifiedActivityXp({ games = 0, wins = 0 }) {
  return games * 10 + wins * 20;
}

/**
 * Sinais de integridade de UMA pessoa. Devolve os motivos para o admin olhar —
 * NUNCA pune. Cada sinal carrega os números, para o admin decidir em segundos.
 *
 * @param {{
 *   xpTotal: number, grantsXp: number, verified: { games: number, wins: number },
 *   previous?: { xp: number, at: number }|null, now: number,
 * }} p
 * @param {{ xpJumpPerDay: number, unverifiedXpFactor: number }} cfg
 * @returns {Array<{ type: string, severity: 'high'|'medium', detail: object }>}
 */
function integritySignals(p, cfg) {
  const sinais = [];
  const xpProprio = Math.max(0, (p.xpTotal || 0) - (p.grantsXp || 0));
  const sustentado = verifiedActivityXp(p.verified || {});
  const teto = cfg.unverifiedXpFactor * sustentado + 3000;
  if (xpProprio >= 5000 && xpProprio > teto) {
    sinais.push({ type: 'xp_unverified', severity: 'high', detail: { xpTotal: p.xpTotal, verifiedGames: p.verified?.games || 0, verifiedWins: p.verified?.wins || 0, ceiling: Math.round(teto) } });
  }
  if (p.previous && Number.isFinite(p.previous.at) && p.now > p.previous.at) {
    const dias = Math.max(1 / 24, (p.now - p.previous.at) / DAY_MS);
    const delta = (p.xpTotal || 0) - (p.previous.xp || 0);
    if (delta / dias > cfg.xpJumpPerDay && delta > cfg.xpJumpPerDay) {
      sinais.push({ type: 'xp_jump', severity: 'medium', detail: { from: p.previous.xp, to: p.xpTotal, hours: Math.round(dias * 24) } });
    }
  }
  return sinais;
}

/**
 * Anéis de kudos: pares que trocaram muitos kudos na janela, nos DOIS sentidos.
 * @param {Array<{ fromUid: string, toUid: string }>} kudos
 * @param {number} min
 * @returns {Array<{ a: string, b: string, ab: number, ba: number }>}
 */
function kudosRings(kudos, min) {
  const cont = new Map();
  (kudos || []).forEach((k) => {
    const chave = `${k.fromUid}>${k.toUid}`;
    cont.set(chave, (cont.get(chave) || 0) + 1);
  });
  const out = [];
  const vistos = new Set();
  cont.forEach((ab, chave) => {
    const [a, b] = chave.split('>');
    const par = [a, b].sort().join('|');
    if (vistos.has(par)) return;
    const ba = cont.get(`${b}>${a}`) || 0;
    if (ab >= min && ba >= min) {
      vistos.add(par);
      out.push({ a, b, ab, ba });
    }
  });
  return out;
}

/* ------------------------------------------------------------- temporada --- */

/**
 * Posição → prêmio de XP da temporada (faixa percentual), com os valores da
 * configuração do admin. Participação só vale com ao menos 1 de XP na
 * temporada: prêmio por existir seria prêmio por criar conta.
 */
function seasonPrize(position, total, xpSeason, prizes) {
  if (!(position >= 1) || !(total >= 1) || !(xpSeason > 0)) return 0;
  const percentil = position / total;
  if (percentil <= 0.01 || position === 1) return prizes.prizeTop1;
  if (percentil <= 0.10) return prizes.prizeTop10Percent;
  return prizes.prizeParticipation;
}

module.exports = {
  TZ, DAY_MS, brDay, addDays, dayStartMs, weekKey, weekWindow, monthKey, monthWindow, previousMonthKey,
  gamesByUid, metricValue, rankEntries, pairDuels, duelId, duelOutcome,
  REVIEW_TAGS, aggregateReputation, suspiciousReviewPairs,
  verifiedActivityXp, integritySignals, kudosRings, seasonPrize,
};
