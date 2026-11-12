/**
 * LIGAS — a régua do servidor (cópia de `src/modules/leagues/domain/`).
 *
 * O pacote das Functions é publicado isolado e não importa `src/`. Esta cópia
 * tem teste de paridade (`leaguePolicy.parity.test.js`): mexer num lado só
 * quebra o teste, de propósito.
 */

const FORMATS = Object.freeze({
  divisional_pairs: { entry: 'pair', players: 2, available: true },
  flex_pairs: { entry: 'pair', players: 2, available: true },
  divisional_singles: { entry: 'single', players: 1, available: true },
  ladder_pairs: { entry: 'pair', players: 2, available: false },
  ladder_individual: { entry: 'individual', players: 1, available: false },
  team_milp: { entry: 'team', players: 4, available: false },
  team_milp_v3: { entry: 'team', players: 3, available: false },
  team_v4_gendered: { entry: 'team', players: 4, available: false },
});

const ORGANIZER_FLAG = Object.freeze({
  athlete: 'leagues_athletes',
  club: 'leagues_clubs',
  arena: 'leagues_arenas',
  coach: 'leagues_coaches',
  federation: 'leagues_federations',
});

const STATUS_NEXT = Object.freeze({
  draft: ['open', 'cancelled'],
  open: ['draft', 'running', 'cancelled'],
  running: ['open', 'finished', 'cancelled'],
  finished: ['running'],
  cancelled: [],
});

const canMoveStatus = (from, to) => (STATUS_NEXT[from] || []).includes(to);

/* ------------------------------------------------------------ temporada -- */

const CADENCES = ['weekly', 'biweekly', 'monthly', 'custom'];
const WINDOW_DEFAULT = { weekly: 7, biweekly: 14, monthly: 28, custom: 7 };
const MAX_DATES = 60;
const PLAYOFF_SIZES = [2, 4, 8];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function isIsoDate(v) {
  if (typeof v !== 'string' || !DATA.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const datas = (lista) => [...new Set((Array.isArray(lista) ? lista : []).filter(isIsoDate))].sort().slice(0, MAX_DATES);
const inteiro = (v, min, max, padrao) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
};

function normalizeSeason(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const cadence = CADENCES.includes(r.cadence) ? r.cadence : 'weekly';
  const playoff = r.playoff && typeof r.playoff === 'object' ? r.playoff : {};
  return {
    start_date: isIsoDate(r.start_date) ? r.start_date : null,
    cadence,
    custom_dates: cadence === 'custom' ? datas(r.custom_dates) : [],
    skip_dates: datas(r.skip_dates),
    play_time: typeof r.play_time === 'string' && HORA.test(r.play_time) ? r.play_time : '',
    round_window_days: inteiro(r.round_window_days, 1, 31, WINDOW_DEFAULT[cadence]),
    legs: inteiro(r.legs, 1, 2, 1),
    playoff: {
      enabled: playoff.enabled === true,
      size: PLAYOFF_SIZES.includes(Number(playoff.size)) ? Number(playoff.size) : 4,
      third_place: playoff.third_place === true,
    },
  };
}

/* ------------------------------------------------------------- divisões -- */

const RULES = ['open', 'dupr_range', 'dupr_sum'];
const GENDERS = ['open', 'male', 'female', 'mixed'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const tres = (n) => Math.round(n * 1000) / 1000;

function normalizeDivisionRule(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const kind = RULES.includes(r.kind) ? r.kind : 'open';
  if (kind === 'dupr_range') {
    let min = num(r.min);
    let max = num(r.max);
    if (min && max && min > max) [min, max] = [max, min];
    return { kind, min, max, allow_unrated: r.allow_unrated !== false };
  }
  if (kind === 'dupr_sum') {
    return { kind, cap: num(r.cap), individual_cap: num(r.individual_cap), unrated_value: num(r.unrated_value) || 3.0 };
  }
  return { kind };
}

function confereGenero(gender, players) {
  if (!gender || gender === 'open') return null;
  const gs = players.map((p) => (p && p.gender) || null);
  if (gs.some((g) => g !== 'male' && g !== 'female')) return 'gender_unknown';
  if (gender === 'mixed') return gs.includes('male') && gs.includes('female') ? null : 'gender';
  return gs.every((g) => g === gender) ? null : 'gender';
}

function divisionEligibility(division, players) {
  const lista = Array.isArray(players) ? players : [];
  const rule = normalizeDivisionRule(division && division.rule);
  const genero = confereGenero(division && division.gender, lista);
  const resp = (reason, value = null, unrated = false) => ({ ok: !reason, reason, value, unrated });
  if (genero) return resp(genero);
  const duprs = lista.map((p) => num(p && p.dupr));
  const semDupr = duprs.some((d) => d == null);
  if (rule.kind === 'dupr_range') {
    const conhecidos = duprs.filter((d) => d != null);
    if (semDupr && !rule.allow_unrated) return resp('missing_dupr');
    if (!conhecidos.length) return resp(null, null, true);
    const media = tres(conhecidos.reduce((a, b) => a + b, 0) / conhecidos.length);
    if (rule.min && media < rule.min) return resp('below', media, semDupr);
    if (rule.max && media > rule.max) return resp('above', media, semDupr);
    return resp(null, media, semDupr);
  }
  if (rule.kind === 'dupr_sum') {
    const valores = duprs.map((d) => (d == null ? rule.unrated_value : d));
    const soma = tres(valores.reduce((a, b) => a + b, 0));
    if (rule.individual_cap && valores.some((v) => v > rule.individual_cap)) return resp('over_individual_cap', soma, semDupr);
    if (rule.cap && soma > rule.cap) return resp('over_cap', soma, semDupr);
    return resp(null, soma, semDupr);
  }
  return resp(null);
}

/* --------------------------------------------------------------- placar -- */

const MAX_GAMES = 5;
const MAX_SCORE = 99;
const placar = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_SCORE ? n : null;
};

function validateResult(input = {}) {
  const falha = (error) => ({ ok: false, error, games: [], wo_winner: null, winner: null });
  if (input.wo_winner === 'a' || input.wo_winner === 'b') {
    return { ok: true, error: null, games: [], wo_winner: input.wo_winner, winner: input.wo_winner };
  }
  const brutos = Array.isArray(input.games) ? input.games : [];
  if (!brutos.length) return falha('empty');
  if (brutos.length > MAX_GAMES) return falha('too_many');
  const games = [];
  for (const g of brutos) {
    const a = placar(g && g.a);
    const b = placar(g && g.b);
    if (a == null || b == null) return falha('invalid');
    if (a === b) return falha('tie_game');
    games.push({ a, b });
  }
  const ga = games.filter((g) => g.a > g.b).length;
  const gb = games.length - ga;
  if (ga === gb) return falha('draw');
  return { ok: true, error: null, games, wo_winner: null, winner: ga > gb ? 'a' : 'b' };
}

/* ------------------------------------------------------------- rodadas -- */

/**
 * Pontos corridos pelo método do círculo (o primeiro fica fixo, os outros
 * giram); ímpar ganha uma folga por rodada. Returno: os mesmos jogos com os
 * lados trocados, nas rodadas seguintes.
 */
function roundRobin(ids, legs = 1) {
  const ps = ids.slice();
  if (ps.length < 2) return [];
  if (ps.length % 2 === 1) ps.push(null);
  const n = ps.length;
  const ida = [];
  const ring = ps.slice();
  for (let r = 0; r < n - 1; r += 1) {
    for (let i = 0; i < n / 2; i += 1) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a && b) ida.push({ side_a: r % 2 === 0 ? a : b, side_b: r % 2 === 0 ? b : a, round: r + 1 });
    }
    ring.splice(1, 0, ring.pop());
  }
  if (legs !== 2) return ida;
  return [...ida, ...ida.map((m) => ({ side_a: m.side_b, side_b: m.side_a, round: m.round + (n - 1) }))];
}

module.exports = {
  FORMATS, ORGANIZER_FLAG, STATUS_NEXT, canMoveStatus,
  isIsoDate, normalizeSeason, normalizeDivisionRule, divisionEligibility, validateResult, roundRobin,
  GENDERS, MAX_GAMES,
};
