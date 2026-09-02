/**
 * hallOfFameService — adapter para o Hall da Fama público.
 *
 * Lê de user_progression_v2 (já existente) e retorna top 50 por XP.
 * Filtro: só mostra quem tem tier >= 'Jogador' (privacidade).
 *
 * Em produção, usar collectionGroup query + índice composto
 * (xpTotal desc, tier). Aqui é interface simples.
 */
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

function db() { return getFirestore(); }

const PUBLIC_MIN_TIER = 'Jogador'; // tier mínimo pra aparecer

export const HALL_OF_FAME_LIMIT = 50;

/**
 * Retorna top N do Hall da Fama.
 * @param {Object} args
 * @param {number} args.limit - default 50, max 200
 * @param {string} args.tierMin - tier mínimo (default Jogador)
 * @returns {Promise<Array<{uid, xpTotal, tier, level, achievementsUnlocked, achievementsTotal}>>}
 */
export async function fetchHallOfFame({ limit: lim = HALL_OF_FAME_LIMIT, tierMin = PUBLIC_MIN_TIER } = {}) {
  const tierOrder = ['Calouro', 'Aprendiz', 'Jogador', 'Competidor', 'Veterano', 'Craque', 'Mestre', 'Lendário', 'Imortal'];
  const tierIdx = tierOrder.indexOf(tierMin);
  const validTiers = tierOrder.slice(tierIdx);

  // firestore: in + orderBy por xpTotal desc
  // necessário índice composto: tier IN, xpTotal DESC
  const q = query(
    collection(db(), 'user_progression_v2'),
    where('tier', 'in', validTiers),
    orderBy('xpTotal', 'desc'),
    limit(lim),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      xpTotal: data.xpTotal || 0,
      tier: data.tier || 'Calouro',
      level: data.level || 1,
      achievementsUnlocked: data.achievementsUnlocked || 0,
      achievementsTotal: data.achievementsTotal || 83,
    };
  });
}

/** Hall do top 1 só (imortal atual). */
export async function fetchTopPlayer() {
  const list = await fetchHallOfFame({ limit: 1 });
  return list[0] || null;
}
