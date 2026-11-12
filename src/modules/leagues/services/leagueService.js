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
