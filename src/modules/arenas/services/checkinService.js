/**
 * Serviço: chegada na arena (módulo `iot_qr_kiosk`).
 *
 * **Zero coleção nova.** A chegada é um campo aditivo na reserva
 * (`arena_bookings.checked_in_at`) — que o atleta já pode escrever pela regra
 * existente, e o gestor também. O totem é um `arena_devices` de tipo
 * `qr_kiosk`, que já existia no cadastro de dispositivos.
 *
 * Duas escritas, dois donos:
 *
 * - **o atleta** confirma a própria chegada, conferindo o código do totem;
 * - **a arena** confirma pelo painel (e desfaz), que é o caminho que faz o
 *   módulo funcionar mesmo sem tablet nenhum na recepção.
 */

import {
  collection, doc, getDoc, getDocs, updateDoc, writeBatch, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { ARENA_COLLECTIONS } from '../domain/constants.js';
import {
  newKioskToken, kioskCodeMatches, checkinState, checkinBlockedReason,
} from '../domain/checkin.js';

const COL_DEVICES = 'arena_devices';
const COL_BOOKINGS = ARENA_COLLECTIONS.bookings || 'arena_bookings';

/** O totem, cru. */
export async function getKioskDevice(deviceId) {
  if (!db || !deviceId) return null;
  const snap = await getDoc(doc(db, COL_DEVICES, deviceId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Os totens desta arena.
 *
 * Um `where` só e o filtro de tipo em memória: `arena_devices` tem índice
 * `[arena_id, name]` e acrescentar um segundo filtro pediria índice novo — e
 * mexer no banco é o que esta onda inteira não faz.
 */
export async function listKioskDevices(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_DEVICES), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => String(d.kind) === 'qr_kiosk');
}

/**
 * Troca o código que o totem mostra.
 *
 * Escrita da ARENA (a regra de `arena_devices` só aceita o gestor), o que é
 * coerente com o que o totem é: um tablet da recepção logado na conta da
 * arena. Serve também de sinal de vida — `last_seen` diz se aquela tela ainda
 * está de pé, e essa é a única forma de a arena descobrir que o totem caiu.
 */
export async function rotateKioskToken(deviceId, nowMs = Date.now()) {
  if (!db || !deviceId) return null;
  const token = newKioskToken(nowMs);
  await updateDoc(doc(db, COL_DEVICES, deviceId), {
    checkin_token: token,
    status: 'online',
    last_seen: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return token;
}

/** O totem saiu do ar (a tela foi fechada). */
export async function markKioskOffline(deviceId) {
  if (!db || !deviceId) return;
  // O token vai junto: totem fechado que deixa um código válido para trás é
  // exatamente a chegada confirmada de casa que a janela curta evita.
  await updateDoc(doc(db, COL_DEVICES, deviceId), {
    checkin_token: null,
    status: 'offline',
    updated_at: serverTimestamp(),
  }).catch(() => {});
}

/**
 * O atleta confirma a própria chegada.
 *
 * A tela já conferiu a janela e o código — e este serviço **confere de novo**,
 * como o resto do módulo: a tela estima, quem grava confere. O código é lido
 * do banco no instante da gravação, não do que a tela tinha em mãos.
 *
 * `deviceId` é uma pista, não um requisito: quem chegou pelo QR do totem já
 * traz o aparelho na URL, e quem DIGITOU o código não sabe (nem deve saber) o
 * identificador de nada — nesse caso o código é conferido contra todos os
 * totens da arena. É a diferença entre "aponte a câmera" e "informe o número
 * de série do tablet".
 *
 * @param {object} booking
 * @param {object} user      quem está chegando
 * @param {{ deviceId?: string, code?: string }} opts
 */
export async function checkInBooking(booking, user, { deviceId, code } = {}) {
  if (!booking?.id) throw new Error('Reserva inválida.');
  if (!user?.uid) throw new Error('Faça login para confirmar sua chegada.');
  if (booking.checked_in_at) return booking.checked_in_at;

  const { state, minutesToStart } = checkinState(booking, new Date());
  if (state !== 'open') {
    throw new Error(checkinBlockedReason(state, minutesToStart) || 'Não é possível confirmar a chegada agora.');
  }

  const candidatos = deviceId
    ? [await getKioskDevice(deviceId)].filter(Boolean)
    : await listKioskDevices(booking.arena_id);
  const daArena = candidatos.filter((d) => String(d.arena_id) === String(booking.arena_id));
  if (daArena.length === 0) {
    throw new Error('Esta arena não tem totem de chegada ativo. Fale com a recepção.');
  }
  const device = daArena.find((d) => kioskCodeMatches(d, code));
  if (!device) {
    throw new Error('Código inválido ou vencido. Confira o que está na tela do totem.');
  }

  await updateDoc(doc(db, COL_BOOKINGS, booking.id), {
    checked_in_at: serverTimestamp(),
    checked_in_by: 'athlete',
    checked_in_uid: user.uid,
    checkin_device_id: device.id,
    // Chegou: não faltou. Sem isto, uma falta marcada por engano antes da hora
    // ficaria contradizendo a presença no mesmo documento.
    no_show: false,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_booking_checkin', actor: user,
    details: { booking_id: booking.id, arena_id: booking.arena_id, device_id: device.id, via: 'totem' },
  });
  return true;
}

/** A arena confirma a chegada pelo painel (sem totem, ou quando ele falhou). */
export async function confirmArrivalByArena(booking, actor) {
  if (!booking?.id) return;
  await updateDoc(doc(db, COL_BOOKINGS, booking.id), {
    checked_in_at: serverTimestamp(),
    checked_in_by: 'arena',
    checked_in_uid: actor?.uid || null,
    no_show: false,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_booking_checkin', actor,
    details: { booking_id: booking.id, arena_id: booking.arena_id, via: 'arena' },
  });
}

/** Desfaz a chegada — só a arena. Marcar presença errada acontece. */
export async function undoArrival(booking, actor) {
  if (!booking?.id) return;
  await updateDoc(doc(db, COL_BOOKINGS, booking.id), {
    checked_in_at: null,
    checked_in_by: null,
    checked_in_uid: null,
    checkin_device_id: null,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_booking_checkin_undone', actor,
    details: { booking_id: booking.id, arena_id: booking.arena_id },
  });
}

/**
 * Marca falta em lote.
 *
 * A arena já podia marcar uma a uma (`setBookingNoShow`), e por isso ninguém
 * marcava: no fim do dia, com dez horários, a lista era um trabalho manual que
 * competia com fechar o caixa. Aqui é um toque sobre quem o sistema já sabe
 * que não chegou. Um lote (limite de 500 escritas) dá conta de qualquer dia
 * de qualquer arena.
 */
export async function markNoShowBatch(bookings, actor) {
  const alvo = (bookings || []).filter((b) => b?.id).slice(0, 400);
  if (alvo.length === 0) return 0;
  const lote = writeBatch(db);
  alvo.forEach((b) => {
    lote.update(doc(db, COL_BOOKINGS, b.id), { no_show: true, updated_at: serverTimestamp() });
  });
  await lote.commit();
  await createAuditLog({
    action: 'arena_booking_no_show_batch', actor,
    details: { quantidade: alvo.length, arena_id: alvo[0]?.arena_id || null },
  });
  return alvo.length;
}
