/**
 * hallOfFameService — o Hall da Fama público (XP de vida).
 *
 * Lê `hall_of_fame`, que é gravado pelo SERVIDOR já com a privacidade aplicada:
 * só entra quem tem perfil no diretório, aceitou aparecer, não foi escondido
 * pela moderação nem está retido para revisão e atinge o tier mínimo. O cliente
 * não decide quem aparece — antes ele lia `user_progression_v2` e mostrava
 * "UID: a1b2c3d4…" no lugar do nome, para qualquer um, sem respeitar nada.
 *
 * Nome, foto, estado e cidade vêm no próprio documento (a leitura é uma só, sem
 * resolver cada atleta). Filtro por UF é por consulta (índice `state+position`).
 */
import {
  collection, getDocs, limit, orderBy, query, where, doc, getDoc,
} from 'firebase/firestore';
import { ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2';
import { gamificationDb } from './firestoreDb.js';

function db() { return gamificationDb(); }

export const HALL_OF_FAME_LIMIT = 50;

/** O documento do Hall → o formato que a tela usa. */
export function hallRowToView(id, d = {}) {
  return {
    uid: d.uid || id,
    position: Number(d.position) || 0,
    xpTotal: Number(d.xp) || 0,
    tier: d.tier || 'Calouro',
    level: Number(d.level) || 1,
    achievementsUnlocked: Number(d.achievements) || 0,
    achievementsTotal: ACHIEVEMENTS_V2.length,
    name: d.displayName || 'Atleta',
    photoUrl: d.photoUrl || '',
    state: d.state || null,
    city: d.city || null,
  };
}

/**
 * Top N do Hall da Fama.
 * @param {{ limit?: number, state?: string|null }} [args]
 */
export async function fetchHallOfFame({ limit: lim = HALL_OF_FAME_LIMIT, state = null } = {}) {
  const filtros = state ? [where('state', '==', state)] : [];
  const snap = await getDocs(query(
    collection(db(), 'hall_of_fame'), ...filtros, orderBy('position', 'asc'), limit(Math.min(200, lim)),
  ));
  return snap.docs.map((d) => hallRowToView(d.id, d.data()));
}

/** O campeão atual (top 1). */
export async function fetchTopPlayer() {
  const list = await fetchHallOfFame({ limit: 1 });
  return list[0] || null;
}

/** A linha de UMA pessoa no Hall (ou null se ela não aparece). */
export async function fetchMyHallRow(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db(), 'hall_of_fame', uid));
  return snap.exists() ? hallRowToView(snap.id, snap.data()) : null;
}
