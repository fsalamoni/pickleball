/**
 * A ESCADA da liga no servidor — cópia de `src/modules/leagues/domain/leagueLadder.js`
 * e de `src/core/domain/americanoGroups.js` (paridade em
 * `leagueLadder.parity.test.js`). É com ela que a ação `session` monta as
 * quadras da sessão seguinte: a escada é refeita dos jogos, nunca gravada.
 * Explicação completa no arquivo do cliente e em docs/57-LIGAS.md §10.
 */
const P = require('./leaguePolicy.js');

const LADDER_RULES = {
  ladder_individual: { kind: 'americano', sizes: [4, 5], target: 4 },
  ladder_pairs: { kind: 'round_robin', sizes: [3, 4, 5], target: 4 },
};
const isLadderFormat = (format) => Object.hasOwn(LADDER_RULES, format);
const LADDER_DEFAULT_ORDER = ['wins', 'balance', 'points_for'];
const LADDER_TIEBREAK_KEYS = ['wins', 'balance', 'points_for', 'points_against', 'win_rate', 'balance_rate', 'sets'];

function ladderTiebreakOrder(order) {
  const lista = [...new Set((Array.isArray(order) ? order : []).filter((k) => LADDER_TIEBREAK_KEYS.includes(k)))];
  return lista.length ? lista : [...LADDER_DEFAULT_ORDER];
}

const americanoFecha = (n) => n >= 4 && (n % 4 === 0 || n % 4 === 1);

function splitIntoGroups(n, { sizes, target }) {
  const total = Math.floor(Number(n));
  const permitidos = [...new Set((sizes || []).map(Number).filter((s) => Number.isInteger(s) && s > 0))].sort((a, b) => a - b);
  if (!Number.isFinite(total) || total < 1 || !permitidos.length || total < permitidos[0]) return null;
  const melhor = new Array(total + 1).fill(null);
  melhor[0] = { custo: 0, grupos: [] };
  for (let k = 1; k <= total; k += 1) {
    permitidos.forEach((s) => {
      if (s > k || !melhor[k - s]) return;
      const anterior = melhor[k - s];
      const custo = anterior.custo + (s - target) ** 2;
      const grupos = [...anterior.grupos, s];
      const atual = melhor[k];
      if (!atual || custo < atual.custo || (custo === atual.custo && grupos.length < atual.grupos.length)) {
        melhor[k] = { custo, grupos };
      }
    });
  }
  const r = melhor[total];
  return r ? r.grupos.slice().sort((a, b) => b - a) : null;
}

function americanoGroupSizes(n, target = 4) {
  if (Math.floor(Number(n)) < 4) return null;
  const sizes = [];
  for (let s = 4; s <= 2 * target + 1; s += 1) if (americanoFecha(s)) sizes.push(s);
  return splitIntoGroups(n, { sizes, target });
}

const AMERICANO_COURT_ROUNDS = {
  4: [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]],
  5: [0, 1, 2, 3, 4].map((i) => [[(i + 1) % 5, (i + 4) % 5], [(i + 2) % 5, (i + 3) % 5]]),
};

function americanoCourtMatches(ids) {
  const plano = AMERICANO_COURT_ROUNDS[ids.length];
  if (!plano) return [];
  return plano.map(([a, b], i) => ({ round: i + 1, team_a: a.map((k) => ids[k]), team_b: b.map((k) => ids[k]) }));
}

function ladderGroupSizes(format, n) {
  const r = LADDER_RULES[format];
  if (!r) return null;
  return r.kind === 'americano' ? americanoGroupSizes(n, r.target) : splitIntoGroups(n, r);
}

function buildSessionGroups(format, orderedIds) {
  const ids = Array.isArray(orderedIds) ? orderedIds : [];
  const r = LADDER_RULES[format];
  if (!r || ids.length < Math.min(...r.sizes)) return { ok: false, error: 'too_few', sizes: [], groups: [] };
  const sizes = ladderGroupSizes(format, ids.length);
  if (!sizes) return { ok: false, error: 'no_fit', sizes: [], groups: [] };
  const groups = [];
  let i = 0;
  sizes.forEach((s) => { groups.push(ids.slice(i, i + s)); i += s; });
  return { ok: true, error: null, sizes, groups };
}

/** Os jogos da sessão: `[{ group, round, team_a, team_b }]` (só no servidor). */
function sessionMatches(format, groups) {
  const r = LADDER_RULES[format];
  if (!r) return [];
  return groups.flatMap((ids, group) => (r.kind === 'americano'
    ? americanoCourtMatches(ids)
    : P.roundRobin(ids, 1).map((m) => ({ round: m.round, team_a: [m.side_a], team_b: [m.side_b] }))
  ).map((m) => ({ group, ...m })));
}

// Instante gravado: Timestamp (com `toMillis`), o mesmo já serializado
// (`seconds`/`_seconds`) ou um número.
const msOf = (v) => {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  const seg = v && typeof v === 'object' ? Number(v.seconds ?? v._seconds) : NaN;
  if (Number.isFinite(seg)) return seg * 1000 + Math.floor(Number(v.nanoseconds ?? v._nanoseconds ?? 0) / 1e6);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function entryRating(e) {
  const ps = Array.isArray(e && e.players) ? e.players : [];
  const ds = ps.map((p) => Number(p && p.dupr)).filter((n) => Number.isFinite(n) && n > 0);
  return ps.length && ds.length === ps.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
}

function seedOrder(list) {
  return list.slice().sort((a, b) => {
    const ra = entryRating(a);
    const rb = entryRating(b);
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    if ((ra == null) !== (rb == null)) return ra == null ? 1 : -1;
    return (msOf(a.created_at) - msOf(b.created_at)) || String(a.id).localeCompare(String(b.id));
  });
}

function matchWinner(m) {
  if (!m) return null;
  if (m.wo_winner === 'a' || m.wo_winner === 'b') return m.wo_winner;
  const r = P.validateResult({ games: m.games });
  return r.ok ? r.winner : null;
}

const vazio = () => ({ played: 0, wins: 0, losses: 0, points_for: 0, points_against: 0, sets_won: 0, sets_lost: 0 });

function somar(stats, m) {
  const w = matchWinner(m);
  if (!w) return;
  const lados = { a: m.team_a || [], b: m.team_b || [] };
  ['a', 'b'].forEach((lado) => {
    const outro = lado === 'a' ? 'b' : 'a';
    lados[lado].forEach((id) => {
      if (!stats.has(id)) stats.set(id, vazio());
      const r = stats.get(id);
      r.played += 1;
      if (w === lado) r.wins += 1; else r.losses += 1;
      if (m.wo_winner) return;
      (m.games || []).forEach((g) => {
        const meu = Number(g && g[lado]) || 0;
        const dele = Number(g && g[outro]) || 0;
        r.points_for += meu;
        r.points_against += dele;
        if (meu > dele) r.sets_won += 1; else r.sets_lost += 1;
      });
    });
  });
}

function valor(chave, r) {
  const jogos = r.played || 0;
  const saldo = r.points_for - r.points_against;
  switch (chave) {
    case 'wins': return r.wins;
    case 'balance': return saldo;
    case 'points_for': return r.points_for;
    case 'points_against': return -r.points_against;
    case 'win_rate': return jogos ? r.wins / jogos : 0;
    case 'balance_rate': return jogos ? saldo / jogos : 0;
    case 'sets': return r.sets_won - r.sets_lost;
    default: return 0;
  }
}

function sessionsOf(matches) {
  const porSessao = new Map();
  (Array.isArray(matches) ? matches : []).forEach((m) => {
    if (!m || m.phase !== 'ladder' || !Number.isInteger(m.session)) return;
    if (!porSessao.has(m.session)) porSessao.set(m.session, { session: m.session, created: Infinity, matches: [] });
    const s = porSessao.get(m.session);
    s.matches.push(m);
    s.created = Math.min(s.created, msOf(m.created_at) || Infinity);
  });
  return [...porSessao.values()].sort((a, b) => a.session - b.session).map((s) => ({
    ...s,
    complete: s.matches.length > 0 && s.matches.every((m) => matchWinner(m) != null),
  }));
}

/** A escada (mesma conta do cliente): `{ order, rows, sessions, pending }`. */
function computeLadder(entries, matches, config = {}) {
  const lista = (Array.isArray(entries) ? entries : []).filter((e) => e && e.id);
  const porId = new Map(lista.map((e) => [e.id, e]));
  const ordem = ladderTiebreakOrder(config && config.tiebreak_order);
  const L = [];
  const conhecidos = new Set();
  const entrar = (ate) => {
    const novos = lista.filter((e) => !conhecidos.has(e.id) && (ate == null || msOf(e.created_at) < ate));
    seedOrder(novos).forEach((e) => { L.push(e.id); conhecidos.add(e.id); });
  };
  const total = new Map();
  const presencas = new Map();
  const sessoes = [];
  let anterior = null;
  let pending = null;
  let mov = new Map();

  for (const s of sessionsOf(matches)) {
    entrar(Number.isFinite(s.created) ? s.created : null);
    s.matches.forEach((m) => [...(m.team_a || []), ...(m.team_b || [])].forEach((id) => {
      if (!conhecidos.has(id)) { L.push(id); conhecidos.add(id); }
    }));
    s.matches.forEach((m) => somar(total, m));
    new Set(s.matches.flatMap((m) => [...(m.team_a || []), ...(m.team_b || [])])).forEach((id) => presencas.set(id, (presencas.get(id) || 0) + 1));
    const pos = new Map(L.map((id, i) => [id, i]));
    const quadras = new Map();
    s.matches.forEach((m) => {
      const g = Number.isInteger(m.group) ? m.group : 0;
      if (!quadras.has(g)) quadras.set(g, []);
      quadras.get(g).push(m);
    });
    const grupos = [...quadras.entries()].sort((a, b) => a[0] - b[0]).map(([index, ms]) => {
      const members = [...new Set(ms.flatMap((m) => [...(m.team_a || []), ...(m.team_b || [])]))].sort((a, b) => pos.get(a) - pos.get(b));
      const st = new Map(members.map((id) => [id, vazio()]));
      ms.forEach((m) => somar(st, m));
      const ranking = members.slice().sort((a, b) => {
        for (const k of ordem) {
          const d = valor(k, st.get(b)) - valor(k, st.get(a));
          if (d) return d;
        }
        return pos.get(a) - pos.get(b);
      });
      return { index, members, ranking, stats: Object.fromEntries(st), up: null, down: null, matches: ms };
    });
    sessoes.push({ session: s.session, complete: s.complete && pending == null, groups: grupos });
    if (!s.complete || pending != null) {
      if (pending == null) pending = s.session;
      continue;
    }
    const flat = grupos.flatMap((g) => g.ranking);
    let fim = 0;
    grupos.forEach((g, i) => {
      fim += g.ranking.length;
      if (i < grupos.length - 1) {
        g.down = flat[fim - 1];
        grupos[i + 1].up = flat[fim];
        [flat[fim - 1], flat[fim]] = [flat[fim], flat[fim - 1]];
      }
    });
    anterior = L.slice();
    const lugares = flat.map((id) => pos.get(id)).sort((a, b) => a - b);
    lugares.forEach((lugar, i) => { L[lugar] = flat[i]; });
    mov = new Map();
    grupos.forEach((g) => {
      if (g.up) mov.set(g.up, 'up');
      if (g.down) mov.set(g.down, 'down');
    });
  }
  entrar(null);

  const ativos = (ids) => ids.filter((id) => porId.has(id) && porId.get(id).status !== 'withdrawn');
  const posAntes = new Map((anterior ? ativos(anterior) : []).map((id, i) => [id, i + 1]));
  const linha = (id, position) => {
    const e = porId.get(id);
    const st = total.get(id) || vazio();
    const antes = posAntes.get(id);
    return {
      entry_id: id, name: (e && e.name) || '', withdrawn: !!e && e.status === 'withdrawn', position,
      change: position != null && antes != null ? antes - position : null,
      movement: mov.get(id) || null,
      sessions: presencas.get(id) || 0,
      ...st,
    };
  };
  const rows = [
    ...ativos(L).map((id, i) => linha(id, i + 1)),
    ...L.filter((id) => porId.get(id) && porId.get(id).status === 'withdrawn').map((id) => linha(id, null)),
  ];
  return { order: L.filter((id) => porId.has(id)), rows, sessions: sessoes, pending };
}

module.exports = {
  LADDER_RULES, isLadderFormat, LADDER_DEFAULT_ORDER, LADDER_TIEBREAK_KEYS, ladderTiebreakOrder,
  splitIntoGroups, americanoGroupSizes, AMERICANO_COURT_ROUNDS, americanoCourtMatches,
  ladderGroupSizes, buildSessionGroups, sessionMatches, computeLadder, matchWinner,
};
