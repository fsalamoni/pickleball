/**
 * LIGAS NO RANKING E NO DUPR — os jogos de liga que valem, com as MESMAS
 * regras do torneio (decisão do dono, 2026-11-13; `docs/57-LIGAS.md` §14).
 *
 * Uma fonte só para os dois leitores: o recálculo dos rankings da plataforma
 * (`platformRankings.js`: ELO/nacional, 2.0–8.0 e duplas) e o envio ao DUPR
 * (`duprSubmissions.js`). Regras:
 *
 *  - vale a liga que não está em rascunho nem cancelada (`isLeagueRankingEligible`)
 *    — como o torneio, o jogo conta do LANÇAMENTO, não do encerramento, e
 *    cancelar a liga TIRA do ranking o que já contou (o recálculo é integral);
 *  - vale o jogo `done` (placar a confirmar da liga flexível não conta, como
 *    não conta na tabela);
 *  - W.O. entra no ranking sem pontos (como no torneio) e nunca vai ao DUPR;
 *  - nas EQUIPES cada linha do confronto é um jogo de duplas, e só vale a
 *    linha com a ESCALAÇÃO lançada (`lineups[i]`): sem saber quem jogou, o
 *    resultado não tem dono. O DreamBreaker (simples em rodízio) não vale;
 *  - lado com atleta sem conta tira o jogo (como no torneio).
 */

const P = require('./leaguePolicy.js');
const { DUPR_BUCKET } = require('./duprPolicy.js');

const LEAGUE_RANKING_STATUSES = Object.freeze(['open', 'running', 'finished']);

/** Por que um jogo de liga decidido ficou fora (o painel do admin explica). */
const LEAGUE_FORA = Object.freeze({
  SEM_CONTA: 'sem_conta',
  SEM_ESCALACAO: 'sem_escalacao',
  SEM_VENCEDOR: 'sem_vencedor',
});

const isLeagueRankingEligible = (lg) => Boolean(lg && LEAGUE_RANKING_STATUSES.includes(lg.status));

/**
 * O grupo do DUPR de cada formato — os do torneio: equipes são confrontos de
 * equipe, a escada individual é um Americano (parceiro muda a cada jogo) e o
 * resto são duplas/simples fixas. Cópia no cliente (`leagueDuprBucket`), com paridade.
 */
function leagueDuprBucket(format) {
  const f = P.FORMATS[format] || {};
  if (f.entry === 'team') return DUPR_BUCKET.TOURNAMENT_TEAM;
  if (format === 'ladder_individual') return DUPR_BUCKET.TOURNAMENT_ROTATION;
  return DUPR_BUCKET.TOURNAMENT_FIXED;
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return 0;
}

const placar = (g) => ({ a: Math.trunc(Number(g && g.a) || 0), b: Math.trunc(Number(g && g.b) || 0) });

/** As inscrições de cada lado (escada: `team_a`/`team_b`; o resto: `side_a`/`side_b`). */
function inscricoesDosLados(m) {
  if (Array.isArray(m.team_a) || Array.isArray(m.team_b)) return [m.team_a || [], m.team_b || []];
  return [[m.side_a].filter(Boolean), [m.side_b].filter(Boolean)];
}

function uidsDe(ids, entryById) {
  const uids = [];
  let completo = ids.length > 0;
  ids.forEach((id) => {
    const e = entryById.get(id);
    const lista = e && Array.isArray(e.player_uids) ? e.player_uids : [];
    if (!lista.length || lista.some((u) => !u)) completo = false;
    lista.forEach((u) => { if (u) uids.push(u); });
  });
  return { uids, completo };
}

/** O vencedor de um jogo de games (o DreamBreaker fica de fora: não é duplas). */
function vencedorDosGames(games) {
  const a = games.filter((g) => g.a > g.b).length;
  const b = games.filter((g) => g.b > g.a).length;
  if (a === b) return null;
  return a > b ? 'a' : 'b';
}

/**
 * Os jogos de UMA partida de liga que valem para ranking e DUPR (puro).
 * Cada um: `{ key, side_a, side_b, winner, games, wo, line }`. `fora` lista o
 * motivo de cada jogo decidido que não entrou.
 */
function leagueMatchGames(league, m, entryById) {
  const out = { jogos: [], fora: [] };
  if (!m || m.status !== 'done') return out;
  const [idsA, idsB] = inscricoesDosLados(m);
  const linhas = m.phase === 'ladder' ? 0 : P.resultRules(league && league.format).lines;

  if (linhas) {
    // W.O. de equipe: ninguém jogou nenhuma linha.
    if (m.wo_winner === 'a' || m.wo_winner === 'b') return out;
    const ea = uidsDe(idsA, entryById);
    const eb = uidsDe(idsB, entryById);
    const games = Array.isArray(m.games) ? m.games : [];
    const escalacoes = Array.isArray(m.lineups) ? m.lineups : [];
    games.slice(0, linhas).forEach((g, i) => {
      const e = escalacoes[i];
      const la = e && Array.isArray(e.a) ? e.a.filter(Boolean) : [];
      const lb = e && Array.isArray(e.b) ? e.b.filter(Boolean) : [];
      if (la.length !== 2 || lb.length !== 2) { out.fora.push(LEAGUE_FORA.SEM_ESCALACAO); return; }
      // A escalação tem de ser da equipe de cada lado (o servidor já conferiu ao gravar).
      if (!la.every((u) => ea.uids.includes(u)) || !lb.every((u) => eb.uids.includes(u))) { out.fora.push(LEAGUE_FORA.SEM_ESCALACAO); return; }
      const jogo = placar(g);
      const winner = vencedorDosGames([jogo]);
      if (!winner) { out.fora.push(LEAGUE_FORA.SEM_VENCEDOR); return; }
      out.jogos.push({ key: `${m.id}_${i + 1}`, side_a: la, side_b: lb, winner, games: [jogo], wo: false, line: i });
    });
    return out;
  }

  const a = uidsDe(idsA, entryById);
  const b = uidsDe(idsB, entryById);
  const wo = m.wo_winner === 'a' || m.wo_winner === 'b';
  const games = wo ? [] : (Array.isArray(m.games) ? m.games : []).map(placar);
  const winner = wo ? m.wo_winner : vencedorDosGames(games);
  if (!winner) { out.fora.push(LEAGUE_FORA.SEM_VENCEDOR); return out; }
  if (!a.completo || !b.completo) { out.fora.push(LEAGUE_FORA.SEM_CONTA); return out; }
  out.jogos.push({ key: m.id, side_a: a.uids, side_b: b.uids, winner, games, wo, line: null });
  return out;
}

/** Campos do jogo de liga que mudam o ranking. */
const CAMPOS_JOGO_LIGA = Object.freeze(['status', 'games', 'wo_winner', 'lineups', 'side_a', 'side_b', 'team_a', 'team_b']);

/**
 * O jogo mudou de um jeito que move o ranking? Só o que está ou estava `done`
 * importa (placar a confirmar não conta) e só os campos do resultado.
 */
function leagueMatchChanged(before, after) {
  if ((before && before.status) !== 'done' && (after && after.status) !== 'done') return false;
  if (!before || !after) return true;
  return CAMPOS_JOGO_LIGA.some((c) => JSON.stringify(before[c] === undefined ? null : before[c]) !== JSON.stringify(after[c] === undefined ? null : after[c]));
}

/** A assinatura das ligas que valem (id + situação), para a recuperação do ranking. */
function leagueSignature(ligas) {
  return (ligas || []).map((l) => `${l.id}:${l.status}`).sort().join('|');
}

/**
 * Lê as ligas que valem e devolve os jogos de cada uma, prontos (I/O). Uma
 * leitura por liga (inscrições + jogos `done`): sem consulta de grupo de
 * coleção, que pediria índice novo.
 *
 * @returns {Promise<{ leagues: number, games: Array<object>, fora: string[], lidos: number, signature: string }>}
 */
async function loadLeagueGames(db) {
  const ligas = await db.collection('leagues').where('status', 'in', LEAGUE_RANKING_STATUSES).get();
  const games = [];
  const fora = [];
  let lidos = 0;
  await Promise.all(ligas.docs.map(async (d) => {
    const lg = { id: d.id, ...d.data() };
    const [entries, matches, divisions] = await Promise.all([
      d.ref.collection('entries').get(),
      d.ref.collection('matches').where('status', '==', 'done').get(),
      d.ref.collection('divisions').get(),
    ]);
    const entryById = new Map(entries.docs.map((e) => [e.id, e.data()]));
    const divisionName = new Map(divisions.docs.map((x) => [x.id, String(x.data().name || '')]));
    matches.docs.forEach((md) => {
      const m = { id: md.id, ...md.data() };
      lidos += 1;
      const r = leagueMatchGames(lg, m, entryById);
      fora.push(...r.fora);
      const at = toMillis(m.recorded_at) || toMillis(m.updated_at) || toMillis(m.created_at);
      r.jogos.forEach((j) => games.push({
        ...j, league: lg, match_id: m.id, division_name: divisionName.get(m.division_id) || '',
        at, played_date: P.isIsoDate(m.scheduled_date) ? m.scheduled_date : '',
      }));
    });
  }));
  const signature = leagueSignature(ligas.docs.map((d) => ({ id: d.id, status: d.data().status })));
  return { leagues: ligas.size, games, fora, lidos, signature };
}

module.exports = {
  LEAGUE_RANKING_STATUSES, LEAGUE_FORA, isLeagueRankingEligible, leagueDuprBucket, leagueMatchGames, loadLeagueGames, leagueSignature, leagueMatchChanged, CAMPOS_JOGO_LIGA,
};
