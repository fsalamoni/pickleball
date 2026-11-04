/**
 * As quadras de um dia de jogo com controle de linhas
 * (`game_days/{id}/line_courts/court-N`, docs/53 §3). Ler é de quem enxerga o
 * dia; gravar é de quem organiza (criador, gestor da arena ou do clube,
 * administrador nomeado) — a regra confere.
 */

import { collection, doc, getDocsFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { LINE_COURTS } from '../domain/gameDayLine.js';
import { saveEach } from './saveEach.js';

const courtsCol = (gameDayId) => collection(db, 'game_days', gameDayId, LINE_COURTS);

/**
 * Do SERVIDOR: sem rede, a leitura comum devolve o que sobrou no cache — às
 * vezes nada —, e "nenhuma quadra" virava "controle desligado" na câmera que
 * estava filmando. Sem rede é FALHA, e a tela segue com o que já tinha.
 */
export async function listGameDayLineCourts(gameDayId) {
  const snap = await getDocsFromServer(courtsCol(gameDayId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Liga/desliga ou troca o arranjo de UMA quadra; cria o documento na primeira
 * vez (`exists: false` ⇒ nasce desligada, a não ser que o pedido ligue).
 */
export function saveGameDayLineCourt({ gameDayId, courtId, patch, uid, exists }) {
  const base = exists === false ? { line_control: false } : {};
  return setDoc(
    doc(courtsCol(gameDayId), courtId),
    { ...base, ...patch, updated_by: uid, updated_at: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Várias quadras (de um ou de vários dias) de uma vez, uma escrita por quadra
 * (ver `saveEach`: a que falhar não derruba as outras).
 * @param {Array<{ gameDayId: string, courtId: string, patch: object, exists?: boolean }>} items
 * @returns {Promise<{ ok: number, failed: number }>}
 */
export function saveGameDayLineCourts(items, uid) {
  return saveEach(items, (it) => saveGameDayLineCourt({ ...it, uid }));
}
