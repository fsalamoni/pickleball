/**
 * LIGAS — leitura direta (a regra deixa quem tem conta ler `leagues/**`) e
 * escrita SÓ pela função `leagues` (`functions/leagues.js`). Nenhuma
 * consulta aqui pede índice composto: uma igualdade (ou `array-contains`) por
 * consulta e a ordenação em memória.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/core/config/firebase';
import { t, tk } from '@/core/i18n';
import { leagueSeasonsOfPlayer, leagueUpcomingOfPlayer } from '../domain/leagueActivity.js';
import { LEAGUE_STATUS } from '../domain/leagueFormats.js';
import { leagueGamesOfPlayer } from '../domain/leagueRankingGames.js';

export const LEAGUES = 'leagues';

export class LeagueError extends Error {}

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const recentes = (a, b) => (b.updated_at?.toMillis?.() || 0) - (a.updated_at?.toMillis?.() || 0);

function exigeDb() {
  if (!db) throw new LeagueError(t('Firebase não está configurado neste ambiente.'));
}

/** As ligas abertas, em andamento e encerradas (rascunho e cancelada ficam de fora). */
export async function listPublicLeagues() {
  exigeDb();
  const snap = await getDocs(query(collection(db, LEAGUES), where('status', 'in', ['open', 'running', 'finished'])));
  return lista(snap).filter((l) => l.visibility !== 'unlisted').sort(recentes);
}

/** As ligas em que a pessoa joga ou que organiza. */
export async function listMyLeagues(uid) {
  exigeDb();
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, LEAGUES), where('member_uids', 'array-contains', uid)));
  return lista(snap).sort(recentes);
}

export async function getLeague(id) {
  exigeDb();
  const s = await getDoc(doc(db, LEAGUES, id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

const daLiga = (id, nome) => getDocs(collection(db, LEAGUES, id, nome)).then(lista);

export async function listDivisions(id) {
  exigeDb();
  return (await daLiga(id, 'divisions')).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function listEntries(id) {
  exigeDb();
  return (await daLiga(id, 'entries'))
    .sort((a, b) => (a.created_at?.toMillis?.() || 0) - (b.created_at?.toMillis?.() || 0));
}

export async function listMatches(id) {
  exigeDb();
  return (await daLiga(id, 'matches')).sort((a, b) => (a.round - b.round) || String(a.id).localeCompare(String(b.id)));
}

function mensagemDoServidor(err) {
  const code = String(err?.code || '');
  if (code.endsWith('unauthenticated')) return t('Entre na sua conta.');
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded')) return t('Sem conexão com o servidor. Tente de novo.');
  if (code.endsWith('internal')) return t('Não foi possível concluir. Tente de novo.');
  return err?.message || t('Não foi possível concluir. Tente de novo.');
}

/**
 * Uma ação no servidor: `create`, `update`, `status`, `division_save`,
 * `division_remove`, `register`, `withdraw`, `entry_add`, `schedule`,
 * `result`, `staff`.
 */
export async function leagueAction(action, payload = {}) {
  if (!functions) throw new LeagueError(t('Firebase não está configurado neste ambiente.'));
  try {
    const { data } = await httpsCallable(functions, 'leagues', { timeout: 120_000 })({ action, ...payload });
    return data;
  } catch (err) {
    const e = new LeagueError(mensagemDoServidor(err));
    e.code = err?.code;
    throw e;
  }
}

/**
 * O que a exportação de dados (LGPD) leva das ligas: cada liga por onde a
 * pessoa passou e as inscrições dela. Falha vai para `incomplete`.
 */
export async function collectLeagueExport(uid) {
  try {
    exigeDb();
    const snap = await getDocs(query(collection(db, LEAGUES), where('ever_uids', 'array-contains', uid)));
    const ligas = await Promise.all(lista(snap).map(async (l) => {
      const entries = await getDocs(query(collection(db, LEAGUES, l.id, 'entries'), where('player_uids', 'array-contains', uid)));
      return { id: l.id, name: l.name, format: l.format, status: l.status, organizer: l.organizer, organizes: (l.admins || []).includes(uid), entries: lista(entries) };
    }));
    return { leagues: ligas, incomplete: [] };
  } catch (_) {
    return { leagues: undefined, incomplete: [tk('Ligas')] };
  }
}

/** O Firestore aceita até 30 valores em `in` / `array-contains-any`. */
const EM_LOTES = 30;
const lotes = (ids) => Array.from({ length: Math.ceil(ids.length / EM_LOTES) }, (_, i) => ids.slice(i * EM_LOTES, (i + 1) * EM_LOTES));

const subDe = (leagueId) => (nome, ...filtros) => getDocs(query(collection(db, LEAGUES, leagueId, nome), ...filtros)).then(lista);

/**
 * A liga na vida de UMA pessoa (de qualquer pessoa: a liga é de leitura de
 * conta logada), numa leitura só:
 *   - `games`: os jogos decididos, no formato de "Meu desempenho", do perfil e
 *     do confronto direto, do mais novo ao mais antigo;
 *   - `upcoming`: os jogos que ela ainda vai jogar ("Próximos");
 *   - `seasons`: a participação dela em cada liga (linha do tempo da Carreira).
 * Lê só as divisões e os jogos das inscrições dela — nunca a liga inteira.
 * Qualquer leitura que falhe FALHA a consulta: jogo de liga que não carregou
 * não vira "nenhum jogo".
 *
 * @param {string} uid
 * @returns {Promise<{ games: object[], upcoming: object[], seasons: object[] }>}
 */
export async function listLeagueActivityOf(uid) {
  exigeDb();
  if (!uid) return { games: [], upcoming: [], seasons: [] };
  const ligas = lista(await getDocs(query(collection(db, LEAGUES), where('ever_uids', 'array-contains', uid))));
  const porLiga = await Promise.all(ligas.map(async (lg) => {
    const sub = subDe(lg.id);
    const minhas = await sub('entries', where('player_uids', 'array-contains', uid));
    if (!minhas.length) return null;
    const ids = minhas.map((e) => e.id);
    const divisoes = [...new Set(minhas.map((e) => e.division_id).filter(Boolean))];
    const [todasDivisoes, inscricoes, ...jogos] = await Promise.all([
      sub('divisions'),
      Promise.all(lotes(divisoes).map((d) => sub('entries', where('division_id', 'in', d)))),
      // Duplas, simples e equipes guardam o lado; a escada guarda a quadra.
      ...lotes(ids).flatMap((l) => [
        sub('matches', where('side_a', 'in', l)),
        sub('matches', where('side_b', 'in', l)),
        sub('matches', where('team_a', 'array-contains-any', l)),
        sub('matches', where('team_b', 'array-contains-any', l)),
      ]),
    ]);
    const unicos = [...new Map(jogos.flat().map((m) => [m.id, m])).values()];
    const entries = inscricoes.flat();
    return {
      games: leagueGamesOfPlayer(uid, lg, entries, unicos),
      upcoming: leagueUpcomingOfPlayer(uid, lg, entries, unicos),
      seasons: leagueSeasonsOfPlayer(uid, lg, todasDivisoes, entries, unicos),
    };
  }));
  const feitas = porLiga.filter(Boolean);
  return {
    games: feitas.flatMap((l) => l.games).sort((a, b) => b.at - a.at),
    upcoming: feitas.flatMap((l) => l.upcoming).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')),
    seasons: feitas.flatMap((l) => l.seasons),
  };
}

/**
 * O que o PÓDIO das ligas de uma pessoa precisa: de cada divisão em que ela
 * jogou numa liga ENCERRADA, todas as inscrições e todos os jogos (o pódio é
 * da divisão inteira, não só dos jogos dela). Liga em andamento não é lida.
 *
 * @param {string} uid
 * @returns {Promise<Array<{ league: object, division: object, entries: object[], matches: object[] }>>}
 */
export async function listLeaguePodiumSourcesOf(uid) {
  exigeDb();
  if (!uid) return [];
  const ligas = lista(await getDocs(query(collection(db, LEAGUES), where('ever_uids', 'array-contains', uid))))
    .filter((lg) => lg.status === LEAGUE_STATUS.FINISHED);
  const porLiga = await Promise.all(ligas.map(async (lg) => {
    const sub = subDe(lg.id);
    const minhas = await sub('entries', where('player_uids', 'array-contains', uid));
    const divisoes = [...new Set(minhas.map((e) => e.division_id).filter(Boolean))];
    if (!divisoes.length) return [];
    const [todasDivisoes, inscricoes, jogos] = await Promise.all([
      sub('divisions'),
      Promise.all(lotes(divisoes).map((d) => sub('entries', where('division_id', 'in', d)))),
      Promise.all(lotes(divisoes).map((d) => sub('matches', where('division_id', 'in', d)))),
    ]);
    const nomes = new Map(todasDivisoes.map((d) => [d.id, d]));
    return divisoes.map((id) => ({
      league: lg,
      // Liga de uma divisão só: o nome dela não acrescenta nada ao troféu.
      division: { id, name: todasDivisoes.length > 1 ? (nomes.get(id)?.name || '') : '' },
      entries: inscricoes.flat().filter((e) => e.division_id === id),
      matches: jogos.flat().filter((m) => m.division_id === id),
    }));
  }));
  return porLiga.flat();
}
