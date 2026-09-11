/**
 * Leitura do RANKING DE DUPLAS materializado (`doubles_rankings`).
 *
 * ## Por que materializado
 *
 * Antes, a página montava o ranking no navegador: lia `tournament_matches`,
 * `club_event_games`, `tournament_registrations` e `athlete_profiles` INTEIRAS
 * a cada abertura, e reprocessava tudo. Quatro coleções completas para desenhar
 * uma tabela — caro, lento e cada vez pior à medida que a plataforma cresce.
 *
 * Agora a conta é feita UMA vez, no servidor, no momento em que um resultado é
 * publicado (`functions/platformRankings.js`), e a página faz uma leitura só de
 * uma coleção pequena — uma linha por parceria, já classificada, já com nome e
 * foto de cada atleta.
 *
 * ## A posição vem do banco
 *
 * Cada linha traz `position`, gravada pela mesma regra de classificação que a
 * tela usaria (aproveitamento → vitórias → derrotas → saldo). Ordenar por um
 * campo só dispensa índice composto e garante que a numeração mostrada seja
 * exatamente a calculada — não uma reordenação feita no navegador.
 *
 * ## Enquanto não houver recálculo
 *
 * A coleção só nasce no primeiro recálculo do servidor. Até lá — e se ela
 * estiver vazia por qualquer motivo — quem chama recorre ao cálculo antigo no
 * cliente. Ninguém vê uma página vazia por causa da migração.
 */

import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

export const DOUBLES_RANKING_COLLECTION = 'doubles_rankings';

/**
 * Lê o ranking de duplas materializado, já na ordem da classificação.
 *
 * @returns {Promise<Array<object>>} vazio quando ainda não houve recálculo
 */
export async function listDoublesRanking() {
  if (!db) return [];
  const snap = await getDocs(query(
    collection(db, DOUBLES_RANKING_COLLECTION),
    orderBy('position'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
