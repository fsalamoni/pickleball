/**
 * O que as câmeras de um jogo dividem entre si — duas subcoleções do dia de
 * jogo, SEM vídeo nem foto:
 *
 * · `game_days/{id}/line_cams/{uid}_{posição}` — a câmera "no ar": quem é,
 *   em que posição, se está calibrada e analisando. Sinal de vida a cada
 *   `HEARTBEAT_MS`; ao sair, o aparelho apaga o próprio documento.
 * · `game_days/{id}/line_calls/{auto}` — cada marcação de cada câmera (tipo,
 *   veredito, margem, incerteza, ponto no chão, hora). A central junta
 *   (`domain/fusion.js`).
 *
 * A regra deixa gravar só quem organiza o dia ou participa dele, só com o
 * controle de linhas ligado no jogo, e só em nome próprio. Marcação não se
 * edita; quem organiza limpa.
 */

import {
  collection, doc, setDoc, updateDoc, deleteDoc, addDoc, getDocs, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';

export const HEARTBEAT_MS = 15000;

const camsCol = (gameDayId) => collection(db, 'game_days', gameDayId, 'line_cams');
const callsCol = (gameDayId) => collection(db, 'game_days', gameDayId, 'line_calls');

export const camDocId = (uid, position) => `${uid}_${position}`;

/** Grava (ou renova) a câmera deste aparelho. */
export function upsertLineCam(gameDayId, {
  uid, name, position, layout, calibrated, analyzing, fps, battery = null, charging = null, checkCm = null,
}) {
  const extra = {};
  // Saúde da câmera, quando o navegador conta: bateria (0–100), carregando, e o
  // erro da calibração medido no 5º ponto (cm).
  if (Number.isFinite(battery)) extra.battery = Math.max(0, Math.min(100, Math.round(battery)));
  if (typeof charging === 'boolean') extra.charging = charging;
  if (Number.isFinite(checkCm)) extra.check_cm = Math.round(checkCm * 10) / 10;
  return setDoc(doc(camsCol(gameDayId), camDocId(uid, position)), {
    uid,
    name: String(name || '').slice(0, 60),
    position,
    layout: layout || null,
    calibrated: calibrated === true,
    analyzing: analyzing === true,
    fps: Number.isFinite(fps) ? Math.round(fps) : 0,
    ...extra,
    seen_ms: Date.now(),
    updated_at: serverTimestamp(),
  });
}

export function removeLineCam(gameDayId, uid, position) {
  return deleteDoc(doc(camsCol(gameDayId), camDocId(uid, position)));
}

const num = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

/**
 * Uma marcação do motor (`lineCallEngine`) desta câmera.
 * @param {number} tMs a hora do lance no relógio do aparelho (ms)
 */
export function postLineCall(gameDayId, { uid, position, event, tMs }) {
  const c = {
    uid,
    position,
    kind: event.type,
    call: event.call,
    t_ms: Math.round(tMs),
    margin_m: num(event.marginM),
    uncertainty_m: num(event.uncertaintyM),
    depth_m: num(event.depthM),
    serve: event.serve === true ? true : null,
    x: num(event.point?.x),
    y: num(event.point?.y),
    created_at: serverTimestamp(),
  };
  Object.keys(c).forEach((k) => { if (c[k] === null) delete c[k]; });
  return addDoc(callsCol(gameDayId), c);
}

/**
 * A palavra final de quem organiza num lance (`decision`): grava na marcação
 * que representa o lance. A regra só deixa quem organiza, só estes campos e
 * só em nome próprio.
 */
export function decideLance(gameDayId, callDocId, { decision, uid }) {
  return updateDoc(doc(callsCol(gameDayId), callDocId), {
    decision,
    decided_by: uid,
    decided_ms: Date.now(),
  });
}

/** Quem organiza apaga as marcações do jogo (lotes de 400). */
export async function clearLineCalls(gameDayId) {
  const snap = await getDocs(callsCol(gameDayId));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
     
    await batch.commit();
  }
  return snap.docs.length;
}

export { camsCol, callsCol };
