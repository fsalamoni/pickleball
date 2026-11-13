/**
 * OS JOGOS DE LIGA QUE VALEM PARA O RANKING — e os jogos de liga de UMA pessoa,
 * no formato que "Meu desempenho", o perfil e o confronto direto já consomem
 * (o mesmo dos jogos de dia de jogo, `games/domain/myGames.js`).
 *
 * `leagueMatchGames` é CÓPIA de `functions/leagueRanking.js` (o servidor é
 * quem grava o ranking; a tela usa a mesma régua para dizer o que conta), com
 * paridade em `leagueRankingGames.test.js`. Regras em
 * `docs/57-LIGAS.md` §14: vale o jogo decidido de liga aberta, em andamento ou
 * encerrada; atleta sem conta tira o jogo; nas equipes cada linha conta com a
 * escalação; W.O. conta sem pontos.
 *
 * Puro: recebe os documentos já lidos.
 */
import { instanteEmMs } from '@/core/domain/instant.js';
import { t } from '@/core/i18n';
import { resultRules } from './leagueFormats.js';

export const LEAGUE_RANKING_STATUSES = Object.freeze(['open', 'running', 'finished']);

/** Por que um jogo de liga decidido ficou fora do ranking (igual ao servidor). */
export const LEAGUE_FORA = Object.freeze({
  SEM_CONTA: 'sem_conta',
  SEM_ESCALACAO: 'sem_escalacao',
  SEM_VENCEDOR: 'sem_vencedor',
});

/** Por que um jogo MEU de liga não está no ranking (`outReason` do jogo). */
export const LEAGUE_OUT_REASON = Object.freeze({
  /** A liga está em rascunho ou foi cancelada: não conta para ninguém. */
  LEAGUE_OFF: 'liga_fora',
  /** Há atleta sem conta no jogo: sai do ranking para todos. */
  NO_ACCOUNT: 'liga_sem_conta',
});

export const isLeagueRankingEligible = (lg) => Boolean(lg && LEAGUE_RANKING_STATUSES.includes(lg.status));

const placar = (g) => ({ a: Math.trunc(Number(g && g.a) || 0), b: Math.trunc(Number(g && g.b) || 0) });

/** As inscrições de cada lado (escada: `team_a`/`team_b`; o resto: `side_a`/`side_b`). */
export function matchSideEntries(m) {
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
 * Os jogos de UMA partida de liga que valem para ranking e DUPR.
 * Cada um: `{ key, side_a, side_b, winner, games, wo, line }`. `fora` lista o
 * motivo de cada jogo decidido que não entrou.
 *
 * @param {object} league
 * @param {object} m jogo (`leagues/{id}/matches/{id}`, com `id`)
 * @param {Map<string, object>} entryById inscrições da liga, por id
 */
export function leagueMatchGames(league, m, entryById) {
  const out = { jogos: [], fora: [] };
  if (!m || m.status !== 'done') return out;
  const [idsA, idsB] = matchSideEntries(m);
  const linhas = m.phase === 'ladder' ? 0 : resultRules(league && league.format).lines;

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

/** Os atletas de um lado, pelas inscrições: `{ uid|null, name }` (inclui quem não tem conta). */
function atletasDoLado(ids, entryById) {
  return ids.flatMap((id) => {
    const e = entryById.get(id);
    const players = e && Array.isArray(e.players) ? e.players : [];
    return players.map((p) => ({ uid: (p && p.uid) || null, name: String((p && p.name) || '').trim() }));
  });
}

/** O placar como a pessoa o reconhece: pontos num game só, games vencidos em vários. */
function placarDoLado(games, lado) {
  if (games.length === 1) return games[0][lado];
  const outro = lado === 'a' ? 'b' : 'a';
  return games.filter((g) => g[lado] > g[outro]).length;
}

/**
 * Os jogos de liga de UMA pessoa, prontos para somar em "Meu desempenho", no
 * perfil e no confronto direto. Entram TODOS os jogos decididos em que ela
 * jogou; `ranked` diz se o ranking conta e `outReason` por que não.
 *
 * Nas equipes só existe "meu jogo" na linha com escalação: sem ela ninguém
 * sabe quem jogou.
 *
 * @param {string} uid
 * @param {object} league liga (com `id`)
 * @param {Array<object>} entries inscrições (com `id`) — as da pessoa e as adversárias
 * @param {Array<object>} matches jogos (com `id`)
 * @returns {Array<object>} jogos no formato de `games/domain/myGames.js`
 */
export function leagueGamesOfPlayer(uid, league, entries, matches) {
  if (!uid || !league) return [];
  const entryById = new Map((entries || []).map((e) => [e.id, e]));
  const nomePorUid = new Map();
  (entries || []).forEach((e) => (e.players || []).forEach((p) => { if (p && p.uid) nomePorUid.set(p.uid, String(p.name || '').trim()); }));
  const elegivel = isLeagueRankingEligible(league);
  const nome = (p) => p.name || t('Atleta');
  const out = [];

  const empurra = (m, key, ladoA, ladoB, { winner, games, wo, ranked, outReason }) => {
    const meu = ladoA.some((p) => p.uid === uid) ? 'a' : (ladoB.some((p) => p.uid === uid) ? 'b' : null);
    if (!meu) return;
    const meus = meu === 'a' ? ladoA : ladoB;
    const deles = meu === 'a' ? ladoB : ladoA;
    const parceiros = meus.filter((p) => p.uid !== uid);
    out.push({
      id: `lg_${league.id}_${key}`,
      at: instanteEmMs(m.recorded_at) || instanteEmMs(m.updated_at) || instanteEmMs(m.created_at) || 0,
      kind: meus.length === 1 ? 'singles' : 'doubles',
      label: league.name || t('Liga'),
      source: 'league',
      leagueId: league.id,
      gameDayId: null,
      partner: parceiros.map(nome).join(' / '),
      opponent: deles.map(nome).join(' / ') || t('Adversário'),
      opponents: deles.map(nome),
      partnerUids: parceiros.map((p) => p.uid).filter(Boolean),
      opponentUids: deles.map((p) => p.uid).filter(Boolean),
      // A avaliação pós-jogo confere a chave no servidor, que só conhece
      // torneio e dia de jogo publicado.
      matchKey: null,
      myScore: wo ? 0 : placarDoLado(games, meu),
      oppScore: wo ? 0 : placarDoLado(games, meu === 'a' ? 'b' : 'a'),
      won: winner === meu,
      walkover: wo,
      ranked,
      outReason,
    });
  };

  (matches || []).forEach((m) => {
    const r = leagueMatchGames(league, m, entryById);
    // O que o servidor conta (duplas, simples, escada e cada linha de equipe).
    r.jogos.forEach((j) => {
      const comNome = (uids) => uids.map((u) => ({ uid: u, name: nomePorUid.get(u) || '' }));
      empurra(m, j.key, comNome(j.side_a), comNome(j.side_b), {
        winner: j.winner, games: j.games, wo: j.wo, ranked: elegivel, outReason: elegivel ? null : LEAGUE_OUT_REASON.LEAGUE_OFF,
      });
    });
    // Jogo decidido com atleta sem conta: é meu jogo, mas o ranking não conta.
    if (r.fora.includes(LEAGUE_FORA.SEM_CONTA)) {
      const [idsA, idsB] = matchSideEntries(m);
      const wo = m.wo_winner === 'a' || m.wo_winner === 'b';
      const games = wo ? [] : (Array.isArray(m.games) ? m.games : []).map(placar);
      empurra(m, m.id, atletasDoLado(idsA, entryById), atletasDoLado(idsB, entryById), {
        winner: wo ? m.wo_winner : vencedorDosGames(games), games, wo, ranked: false,
        outReason: elegivel ? LEAGUE_OUT_REASON.NO_ACCOUNT : LEAGUE_OUT_REASON.LEAGUE_OFF,
      });
    }
  });
  return out.sort((a, b) => b.at - a.at);
}
