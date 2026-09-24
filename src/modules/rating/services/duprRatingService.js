/**
 * Serviço do ranking "estilo DUPR" (escala 2.000–8.000) — SÓ LEITURA.
 *
 * Quem materializa `player_skill_ratings` e `skill_rating_history` é só o
 * servidor (`functions/platformRankings.js`, motor em `functions/engines/`),
 * na MESMA passada do ELO e das duplas. O cliente não grava — a regra recusa,
 * inclusive para o admin. O motor do cliente (`domain/duprScale.js`) continua
 * existindo para o teste de paridade com o servidor.
 *
 * NOTA (fase 2 / DUPR oficial): quando houver acesso de parceiro DUPR, a
 * semente/《verificação》 e o envio de partidas passam por `duprOfficial.js`
 * (hoje um espaço reservado, sem rede). Este serviço permanece o motor local.
 */

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

const RATINGS_COLLECTION = 'player_skill_ratings';
const HISTORY_COLLECTION = 'skill_rating_history';

/**
 * Lê o ranking "estilo DUPR" materializado. Sem ordenação no servidor (a UI
 * ordena por simples/duplas), evitando índice composto novo.
 * @returns {Promise<Array<object>>}
 */
export async function listDuprRanking() {
  if (!db) return [];
  const snap = await getDocs(collection(db, RATINGS_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Evolução do rating "estilo DUPR" de um atleta: a trajetória do rating APÓS
 * cada jogo, separada por duplas e simples.
 * @returns {Promise<{ doubles: Array<{ at: number|null, rating: number }>, singles: Array<{ at: number|null, rating: number }> }>}
 */
export async function getDuprRatingHistory(uid) {
  if (!db || !uid) return { doubles: [], singles: [] };
  const snap = await getDoc(doc(db, HISTORY_COLLECTION, uid));
  const data = snap.exists() ? snap.data() : null;
  return {
    doubles: Array.isArray(data?.doubles) ? data.doubles : [],
    singles: Array.isArray(data?.singles) ? data.singles : [],
  };
}

/** Rating "estilo DUPR" de um único atleta (ou null se ainda não houver). */
export async function getDuprRatingForUid(uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, RATINGS_COLLECTION, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
