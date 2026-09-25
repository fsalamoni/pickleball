/**
 * Leituras do RANKING DA CASA (Onda CB).
 *
 * Só LÊ. O ranking da casa é somado a cada leitura a partir do que já existe
 * (dias de jogo da arena, torneios da plataforma sediados nela e o ladder
 * antigo) — nada aqui grava. Ver `domain/houseRanking.js`.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

const COL_LADDERS = 'arena_ladders';

/**
 * O ladder dos torneios internos que já aconteceram, com a data do último
 * resultado (a temporada em que ele entra).
 *
 * `getLadder` devolve só as linhas; aqui vem o documento inteiro, porque sem o
 * `updated_at` não há como saber de que temporada são aqueles pontos.
 *
 * @returns {Promise<{ rankings: Array<object>, updated_at: any } | null>}
 */
export async function getLegacyHouseLadder(arenaId) {
  if (!db || !arenaId) return null;
  const snap = await getDoc(doc(db, COL_LADDERS, `${arenaId}_geral`));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { rankings: Array.isArray(d.rankings) ? d.rankings : [], updated_at: d.updated_at || null };
}
