/**
 * A ESCADA da liga (fonte única do cliente): escada individual — o "King of
 * the Court" — e escada de duplas.
 *
 * ## Como se joga
 *
 * A temporada é feita de SESSÕES (as datas do calendário da liga). Em cada
 * sessão, quem veio é dividido em quadras pela posição na escada: a quadra 1
 * com os de cima, a 2 com os seguintes, e assim por diante.
 *
 * - **Individual**: quadras de 4 ou 5, e dentro de cada quadra um AMERICANO —
 *   cada um joga com cada outro uma vez (o mesmo padrão do Americano do torneio
 *   e do dia de jogo, `core/domain/americanoGroups.js`).
 * - **Duplas**: grupos de 3 a 5 duplas, e cada dupla enfrenta todas as outras.
 *
 * Fechada a sessão (todo jogo com placar), o 1º de cada quadra SOBE para a de
 * cima e o último DESCE para a de baixo. Na conta: a escada da sessão é a
 * ordem das quadras com cada uma na ordem de chegada, e em cada divisa entre
 * duas quadras o último da de cima troca de lugar com o primeiro da de baixo.
 *
 * ## A posição é DERIVADA
 *
 * Nada da escada é gravado: ela é refeita dos jogos a cada leitura, sessão a
 * sessão. A ordem inicial é a do DUPR (maior primeiro; sem DUPR por último) e,
 * no empate, a da inscrição. Quem se inscreve depois de começada a escada
 * entra embaixo. Quem falta a uma sessão fica no MESMO lugar: os presentes se
 * rearrumam só nos lugares que eles ocupavam. Placar corrigido numa sessão
 * antiga refaz a escada dali em diante.
 *
 * ## Quem fica à frente na quadra
 *
 * A ordem de desempate é a da liga (`standings.tiebreak_order`), só com os
 * critérios que valem para quem troca de parceiro a cada jogo: confronto
 * direto não existe no Americano (o parceiro de um jogo é o adversário do
 * outro), e por isso os critérios de confronto direto não entram. Empate em
 * tudo: fica à frente quem estava acima na escada.
 *
 * A conta tem cópia no servidor (`functions/leagueLadder.js`, paridade): é com
 * ela que o servidor monta as quadras da sessão seguinte.
 */
import { tk } from '@/core/i18n';
import { americanoGroupSizes, splitIntoGroups } from '@/core/domain/americanoGroups.js';
import { matchWinner } from './leagueResults.js';

/** Os formatos de escada e como cada um divide a sessão. */
export const LADDER_RULES = Object.freeze({
  ladder_individual: Object.freeze({ kind: 'americano', sizes: Object.freeze([4, 5]), target: 4 }),
  ladder_pairs: Object.freeze({ kind: 'round_robin', sizes: Object.freeze([3, 4, 5]), target: 4 }),
});

export const isLadderFormat = (format) => Object.hasOwn(LADDER_RULES, format);

/** A ordem de quem fica à frente na quadra quando a organização não escolhe. */
export const LADDER_DEFAULT_ORDER = Object.freeze(['wins', 'balance', 'points_for']);

/** Os critérios que valem na escada (sem confronto direto). */
export const LADDER_TIEBREAK_KEYS = Object.freeze(['wins', 'balance', 'points_for', 'points_against', 'win_rate', 'balance_rate', 'sets']);

export function ladderTiebreakOrder(order) {
  const lista = [...new Set((Array.isArray(order) ? order : []).filter((k) => LADDER_TIEBREAK_KEYS.includes(k)))];
  return lista.length ? lista : [...LADDER_DEFAULT_ORDER];
}

/** Os tamanhos das quadras da sessão para `n` presentes (maiores primeiro), ou `null`. */
export function ladderGroupSizes(format, n) {
  const r = LADDER_RULES[format];
  if (!r) return null;
  return r.kind === 'americano' ? americanoGroupSizes(n, r.target) : splitIntoGroups(n, r);
}

/** Os números de presentes mais perto (abaixo e acima) que fecham as quadras. */
export function ladderNearestFits(format, n) {
  let below = null;
  for (let k = n - 1; k >= 1; k -= 1) if (ladderGroupSizes(format, k)) { below = k; break; }
  let above = null;
  for (let k = n + 1; k <= n + 8; k += 1) if (ladderGroupSizes(format, k)) { above = k; break; }
  return { below, above };
}

export const LADDER_GROUP_ERROR_LABELS = Object.freeze({
  too_few: tk('Poucos presentes para formar uma quadra.'),
  no_fit: tk('Com esse número de presentes as quadras não fecham.'),
});

/**
 * As quadras da sessão: os presentes, JÁ na ordem da escada, cortados nos
 * tamanhos de `ladderGroupSizes` (a quadra 1 é a de cima).
 *
 * @returns {{ ok: boolean, error: string|null, sizes: number[], groups: string[][] }}
 */
export function buildSessionGroups(format, orderedIds) {
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

// Instante gravado: Timestamp (com `toMillis`), o mesmo já serializado
// (`seconds`/`_seconds`) ou um número.
const msOf = (v) => {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  const seg = v && typeof v === 'object' ? Number(v.seconds ?? v._seconds) : NaN;
  if (Number.isFinite(seg)) return seg * 1000 + Math.floor(Number(v.nanoseconds ?? v._nanoseconds ?? 0) / 1e6);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** O nível da inscrição para a ordem inicial (média do DUPR; `null` se faltar de alguém). */
function entryRating(e) {
  const ps = Array.isArray(e?.players) ? e.players : [];
  const ds = ps.map((p) => Number(p?.dupr)).filter((n) => Number.isFinite(n) && n > 0);
  return ps.length && ds.length === ps.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
}

/** Ordem de quem entra na escada ao mesmo tempo: DUPR, depois a inscrição. */
function seedOrder(list) {
  return list.slice().sort((a, b) => {
    const ra = entryRating(a);
    const rb = entryRating(b);
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    if ((ra == null) !== (rb == null)) return ra == null ? 1 : -1;
    return (msOf(a.created_at) - msOf(b.created_at)) || String(a.id).localeCompare(String(b.id));
  });
}

const vazio = () => ({ played: 0, wins: 0, losses: 0, points_for: 0, points_against: 0, sets_won: 0, sets_lost: 0 });

/** Soma o jogo nas linhas de quem jogou (`stats`: Map id → linha). */
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
        const meu = Number(g?.[lado]) || 0;
        const dele = Number(g?.[outro]) || 0;
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

/** As sessões gravadas, em ordem, com os jogos de cada quadra. */
function sessionsOf(matches) {
  const porSessao = new Map();
  (Array.isArray(matches) ? matches : []).forEach((m) => {
    if (m?.phase !== 'ladder' || !Number.isInteger(m.session)) return;
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

/**
 * A escada da divisão.
 *
 * @param {Array<{ id: string, name?: string, status?: string, players?: Array<{ dupr?: number }>, created_at?: any }>} entries
 * @param {Array<object>} matches os da divisão
 * @param {{ tiebreak_order?: string[] }} [config]
 * @returns {{
 *   order: string[],
 *   rows: Array<object>,
 *   sessions: Array<{ session: number, complete: boolean, groups: Array<{ index: number, members: string[], ranking: string[], stats: Object<string, object>, up: string|null, down: string|null, matches: object[] }> }>,
 *   pending: number|null,
 * }} `order` = a escada (com quem desistiu, no lugar em que ficou)
 */
export function computeLadder(entries, matches, config = {}) {
  const lista = (Array.isArray(entries) ? entries : []).filter((e) => e?.id);
  const porId = new Map(lista.map((e) => [e.id, e]));
  const ordem = ladderTiebreakOrder(config?.tiebreak_order);
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
    // Fechada: a escada da sessão, com a troca em cada divisa.
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
      entry_id: id, name: e?.name || '', withdrawn: e?.status === 'withdrawn', position,
      change: position != null && antes != null ? antes - position : null,
      movement: mov.get(id) || null,
      sessions: presencas.get(id) || 0,
      ...st,
    };
  };
  const rows = [
    ...ativos(L).map((id, i) => linha(id, i + 1)),
    ...L.filter((id) => porId.get(id)?.status === 'withdrawn').map((id) => linha(id, null)),
  ];
  return { order: L.filter((id) => porId.has(id)), rows, sessions: sessoes, pending };
}

/** A próxima sessão a gerar e se a de agora pode ser refeita (nenhum placar). */
export function nextSessionState(ladder) {
  const sessoes = ladder?.sessions || [];
  const ultima = sessoes[sessoes.length - 1];
  if (!ultima) return { number: 1, redo: false, blocked: false };
  if (ultima.complete) return { number: ultima.session + 1, redo: false, blocked: false };
  const algumPlacar = ultima.groups.some((g) => g.matches.some((m) => matchWinner(m) != null));
  return { number: ultima.session, redo: !algumPlacar, blocked: algumPlacar };
}
