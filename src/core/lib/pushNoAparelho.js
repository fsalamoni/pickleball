/**
 * O que o app precisa saber do push ANTES de baixar o código do push: se a
 * pessoa o ativou neste aparelho. Leve de propósito — o layout consulta isto
 * em toda abertura e só quem ativou baixa `pushService` (e o FCM).
 *
 * A marca é por conta (`picklerush:push:<uid>`): num aparelho dividido, uma
 * pessoa ativar o push não liga o da outra.
 */

/** Escopo do service worker do push (o mesmo que o FCM usa por padrão). */
export const PUSH_SCOPE = '/firebase-cloud-messaging-push-scope';

const chave = (uid) => `picklerush:push:${uid}`;

/** A pessoa ativou o push neste aparelho? */
export function pushAtivoAqui(uid) {
  if (!uid) return false;
  try {
    return window.localStorage.getItem(chave(uid)) === '1';
  } catch {
    return false;
  }
}

/** Grava (ou apaga) a marca de push ativo neste aparelho. */
export function marcarPushAqui(uid, ativo) {
  if (!uid) return;
  try {
    if (ativo) window.localStorage.setItem(chave(uid), '1');
    else window.localStorage.removeItem(chave(uid));
  } catch { /* armazenamento bloqueado: vale só nesta visita */ }
}
