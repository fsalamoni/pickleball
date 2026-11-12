/**
 * PLACAR e CLASSIFICAÇÃO da liga (fonte única do cliente).
 *
 * O jogo guarda o placar por game (`games: [{ a, b }]`) ou o W.O.
 * (`wo_winner: 'a' | 'b'` = o lado que VENCEU por W.O.). A classificação é
 * calculada dos jogos a cada leitura, nunca gravada — mudar um placar muda a
 * tabela inteira sem segundo escritor. A validação do placar tem cópia no
 * servidor (`functions/leaguePolicy.js`, paridade).
 */
import { tk } from '@/core/i18n';
import { buildHeadToHead, normalizeTiebreakOrder, rankByOfficialCriteria } from '@/core/domain/tiebreak.js';
import { DEFAULT_LEAGUE_POINTS } from './leagueFormats.js';

/**
 * A ordem de desempate da LIGA quando a organização não escolhe: a de sempre
 * (vitórias, confronto direto, saldo de games, saldo de pontos, pontos feitos).
 * A organização troca pelo mesmo editor do torneio (`standings.tiebreak_order`).
 */
export const LEAGUE_DEFAULT_TIEBREAK_ORDER = Object.freeze(['wins', 'head_to_head', 'sets', 'balance', 'points_for']);

/** A ordem que vale: a escolhida (só critérios conhecidos) ou a da liga. */
export function leagueTiebreakOrder(order) {
  return Array.isArray(order) && order.length ? normalizeTiebreakOrder(order) : [...LEAGUE_DEFAULT_TIEBREAK_ORDER];
}

export const MAX_GAMES = 5;
export const MAX_SCORE = 99;

/** Como a tabela ordena. Gravado em `leagues.standings.mode`. */
export const STANDINGS_MODE = Object.freeze({ POINTS: 'points', WIN_PCT: 'win_pct' });

export const STANDINGS_MODE_LABELS = Object.freeze({
  points: tk('Pontos corridos (vitória, derrota e W.O. valem pontos)'),
  win_pct: tk('Aproveitamento (% de vitórias, como na MiLP)'),
});

export const RESULT_ERROR_LABELS = Object.freeze({
  empty: tk('Informe o placar de pelo menos um game, ou o W.O.'),
  too_many: tk('No máximo 5 games.'),
  invalid: tk('Placar inválido: use números de 0 a 99.'),
  tie_game: tk('Um game não pode terminar empatado.'),
  draw: tk('Os dois lados venceram o mesmo número de games: falta um game para decidir.'),
});

const placar = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_SCORE ? n : null;
};

/**
 * Confere o placar enviado.
 * @returns {{ ok: boolean, error: string|null, games: Array<{a:number,b:number}>, wo_winner: 'a'|'b'|null, winner: 'a'|'b'|null }}
 */
export function validateResult(input = {}) {
  const falha = (error) => ({ ok: false, error, games: [], wo_winner: null, winner: null });
  if (input.wo_winner === 'a' || input.wo_winner === 'b') {
    return { ok: true, error: null, games: [], wo_winner: input.wo_winner, winner: input.wo_winner };
  }
  const brutos = Array.isArray(input.games) ? input.games : [];
  if (!brutos.length) return falha('empty');
  if (brutos.length > MAX_GAMES) return falha('too_many');
  const games = [];
  for (const g of brutos) {
    const a = placar(g?.a);
    const b = placar(g?.b);
    if (a == null || b == null) return falha('invalid');
    if (a === b) return falha('tie_game');
    games.push({ a, b });
  }
  const ga = games.filter((g) => g.a > g.b).length;
  const gb = games.length - ga;
  if (ga === gb) return falha('draw');
  return { ok: true, error: null, games, wo_winner: null, winner: ga > gb ? 'a' : 'b' };
}

/** Quem venceu o jogo gravado (`null` = sem resultado). */
export function matchWinner(match) {
  if (!match) return null;
  if (match.wo_winner === 'a' || match.wo_winner === 'b') return match.wo_winner;
  const r = validateResult({ games: match.games });
  return r.ok ? r.winner : null;
}

export const hasResult = (match) => matchWinner(match) != null;

function linhaVazia(entry) {
  return {
    entry_id: entry.id, name: entry.name || '', withdrawn: entry.status === 'withdrawn',
    played: 0, wins: 0, losses: 0, wo_losses: 0,
    games_won: 0, games_lost: 0, points_for: 0, points_against: 0, points: 0, win_pct: 0,
  };
}

/**
 * A tabela da divisão.
 *
 * @param {Array<{ id: string, name?: string, status?: string }>} entries
 * @param {Array<object>} matches  só os da divisão (fase de temporada)
 * @param {{ mode?: string, win?: number, loss?: number, wo_loss?: number, tiebreak_order?: string[] }} [config]
 */
export function computeLeagueStandings(entries, matches, config = {}) {
  const pts = { ...DEFAULT_LEAGUE_POINTS, ...(config || {}) };
  const mode = config?.mode === STANDINGS_MODE.WIN_PCT ? STANDINGS_MODE.WIN_PCT : STANDINGS_MODE.POINTS;
  const linhas = new Map((Array.isArray(entries) ? entries : []).filter((e) => e?.id).map((e) => [e.id, linhaVazia(e)]));
  for (const m of Array.isArray(matches) ? matches : []) {
    const w = matchWinner(m);
    if (!w) continue;
    const A = linhas.get(m.side_a);
    const B = linhas.get(m.side_b);
    if (!A || !B) continue;
    const venc = w === 'a' ? A : B;
    const perd = w === 'a' ? B : A;
    venc.played += 1; perd.played += 1;
    venc.wins += 1; perd.losses += 1;
    venc.points += Number(pts.win) || 0;
    if (m.wo_winner) {
      perd.wo_losses += 1;
      perd.points += Number(pts.wo_loss) || 0;
    } else {
      perd.points += Number(pts.loss) || 0;
      for (const g of m.games || []) {
        A.points_for += g.a; A.points_against += g.b;
        B.points_for += g.b; B.points_against += g.a;
        if (g.a > g.b) { A.games_won += 1; B.games_lost += 1; } else { B.games_won += 1; A.games_lost += 1; }
      }
    }
  }
  const rows = [...linhas.values()].map((r) => ({
    ...r, win_pct: r.played ? r.wins / r.played : 0, sets_won: r.games_won, sets_lost: r.games_lost,
  }));
  const chave = mode === STANDINGS_MODE.WIN_PCT ? (r) => r.win_pct : (r) => r.points;
  // O desempate é o do TORNEIO (`core/domain/tiebreak.js`), na ordem que a
  // organização escolheu: confronto direto com mini-tabela entre três ou mais,
  // critério que não se aplica é pulado. Empate absoluto: ordem do nome.
  const headToHead = buildHeadToHead((Array.isArray(matches) ? matches : []).filter((m) => linhas.has(m?.side_a) && linhas.has(m?.side_b)), {
    sideIds: (m, s) => [s === 'a' ? m.side_a : m.side_b],
    result: (m) => {
      const winner = matchWinner(m);
      if (!winner) return null;
      const soma = (lado) => (m.wo_winner ? 0 : (m.games || []).reduce((n, g) => n + (Number(g?.[lado]) || 0), 0));
      return { winner, pointsA: soma('a'), pointsB: soma('b') };
    },
  });
  const order = leagueTiebreakOrder(config?.tiebreak_order);
  const blocos = new Map();
  rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).forEach((r) => {
    const k = `${r.withdrawn ? 1 : 0}|${chave(r)}`;
    if (!blocos.has(k)) blocos.set(k, []);
    blocos.get(k).push(r);
  });
  const ordenados = [...blocos.values()]
    .sort((x, y) => (x[0].withdrawn - y[0].withdrawn) || (chave(y[0]) - chave(x[0])))
    .flatMap((bloco) => rankByOfficialCriteria(bloco, { headToHead, idOf: (r) => r.entry_id, order }));
  return ordenados.map((r, i) => ({ ...r, position: i + 1 }));
}
