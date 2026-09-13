/**
 * Service: Open Match (Arena V3 — sprint 1).
 *
 * CRUD + ações de slots de jogo aberto.
 * Coleção: arena_open_slots/{slotId}.
 *
 * Aditivo — não mexe em arena_bookings nem em nenhuma coleção existente.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeOpenSlotInput,
  computeSlotStatus,
  isSlotFinished,
  OPEN_SLOT_STATUS,
  canJoinOpenSlot,
  getAvailableSpots,
} from '../domain/openMatch.js';
import { openSlotConflict, mergeOpenSlotBlocks } from '../domain/openMatch.js';
import { getNextInLine, WAITLIST_STATUS, compactPositions, computePromotionExpiresAt, DEFAULT_PROMOTION_WINDOW_MINUTES } from '../domain/waitlist.js';
import { getArena, listArenaManagers, listArenaUnavailabilities } from './arenaService.js';
import { listArenaGameDays } from '@/modules/games/services/arenaGameDayService.js';
import { mergeGameDayBlocks } from '@/modules/games/domain/arenaGameDay.js';
import { fetchUnifiedLevelValues } from '@/modules/rating/services/unifiedLevelService.js';

const COL = 'arena_open_slots';

function str(v) {
  return String(v ?? '').trim();
}

function displayName(user, profile) {
  return profile?.platform_name || profile?.full_name || user?.displayName || user?.email || 'Atleta';
}

/**
 * O nível do atleta na RÉGUA ÚNICA (2.0–8.0) — a mesma dos sorteios.
 *
 * Antes a peneira comparava `profile.level`, que não vive nessa escala: ou não
 * filtrava nada, ou filtrava errado. Falha de leitura devolve `null`, e nível
 * desconhecido nunca barra ninguém.
 */
async function nivelDoAtleta(uid) {
  if (!uid) return null;
  try {
    const mapa = await fetchUnifiedLevelValues([uid], { side: 'doubles' });
    const v = Number(mapa?.[uid]);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Tudo o que já ocupa as quadras da arena: bloqueios gravados, dias de jogo e
 * as OUTRAS vagas abertas. É contra isto que uma vaga nova é conferida.
 *
 * Nenhuma leitura pode derrubar a publicação por si: falha volta lista vazia e
 * a vaga segue o caminho antigo.
 */
async function ocupacaoDaArena(arenaId, { exceptSlotId } = {}) {
  const [gravados, diasDeJogo, vagas] = await Promise.all([
    listArenaUnavailabilities(arenaId).catch(() => []),
    listArenaGameDays(arenaId).catch(() => []),
    listArenaOpenSlots(arenaId, { limit: 500 }).catch(() => []),
  ]);
  const outras = vagas.filter((v) => v.id !== exceptSlotId);
  return mergeOpenSlotBlocks(mergeGameDayBlocks(gravados, diasDeJogo), outras);
}

/** Recusa a vaga quando ela cai em cima de algo já marcado, dizendo o quê. */
async function recusarSeQuadraOcupada(arenaId, vaga, { exceptSlotId } = {}) {
  if (!vaga?.court_id) return;
  const blocos = await ocupacaoDaArena(arenaId, { exceptSlotId });
  const { hasConflict, reason } = openSlotConflict(vaga, blocos, []);
  if (hasConflict) throw new Error(reason);
}

/**
 * Cria um slot de open match.
 * @returns {Promise<string>} slotId
 */
export async function createOpenSlot(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId é obrigatório.');
  if (!actor?.uid) throw new Error('Usuário não autenticado.');

  const { valid, errors, value } = normalizeOpenSlotInput(input);
  if (!valid) {
    const firstError = Object.values(errors)[0] || 'Dados inválidos.';
    throw new Error(firstError);
  }

  const arena = await getArena(arenaId);
  if (!arena) throw new Error('Arena não encontrada.');

  // Publicar em cima de uma reserva, de um dia de jogo ou de outra vaga é
  // criar um conflito que só aparece no dia — com gente na porta da arena.
  await recusarSeQuadraOcupada(arenaId, value);

  const id = doc(collection(db, COL)).id;
  const payload = {
    id,
    arena_id: arenaId,
    arena_name: arena.name || '',
    ...value,
    filled_spots: 0,
    participants: [],
    status: OPEN_SLOT_STATUS.OPEN,
    created_by: actor.uid,
    created_by_name: displayName(actor, actor.profile),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload);
  await createAuditLog({
    action: 'open_slot_created',
    actor,
    details: { arena_id: arenaId, slot_id: id, date: value.date, start: value.start },
  });
  logger.info('open_slot_created', { id, arenaId });
  return id;
}

/**
 * Atualiza um slot.
 */
export async function updateOpenSlot(slotId, updates, actor) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  const { valid, errors, value } = normalizeOpenSlotInput(updates);
  if (!valid) {
    const firstError = Object.values(errors)[0] || 'Dados inválidos.';
    throw new Error(firstError);
  }
  // A mesma conferência da criação — mudar o horário também pode atropelar.
  // A própria vaga é excluída da conta, senão ela conflitaria consigo mesma.
  const atual = await getOpenSlot(slotId);
  if (atual?.arena_id) {
    await recusarSeQuadraOcupada(atual.arena_id, value, { exceptSlotId: slotId });
  }
  await updateDoc(doc(db, COL, slotId), {
    ...value,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'open_slot_updated',
    actor,
    details: { slot_id: slotId },
  });
}

/**
 * Cancela um slot.
 */
export async function cancelOpenSlot(slotId, reason, actor) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  await updateDoc(doc(db, COL, slotId), {
    status: OPEN_SLOT_STATUS.CANCELLED,
    cancellation_reason: str(reason).slice(0, 200),
    cancelled_by: actor?.uid,
    cancelled_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'open_slot_cancelled',
    actor,
    details: { slot_id: slotId, reason: str(reason).slice(0, 200) },
  });
}

/**
 * Lista slots de uma arena (com filtros opcionais).
 */
export async function listArenaOpenSlots(arenaId, { status, limit: lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  // Igualdade num campo mais ordenacao noutro exige INDICE COMPOSTO, e o unico
  // indice de `arena_open_slots` e [arena_id, starts_at] — enquanto a consulta
  // ordenava por `date`. Ela falhava SEMPRE, e como o padrao do projeto e
  // `const { data = [] } = useX()`, o erro virava lista vazia: a arena nunca
  // viu as proprias vagas publicadas. Um `where` so, o resto em memoria.
  const snap = await getDocs(query(collection(db, COL), where('arena_id', '==', arenaId)));
  return ordenarPorDataHora(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    .filter((s) => !status || s.status === status)
    // O corte vem DEPOIS da ordenacao: antes seriam 50 quaisquer.
    .slice(0, Math.max(1, Number(lim) || 50));
}

/** Data + hora, do mais cedo para o mais tarde. Sem data, vai para o fim. */
function ordenarPorDataHora(lista) {
  return [...lista].sort((a, b) => (
    `${a.date || '9999'}${a.start || ''}`.localeCompare(`${b.date || '9999'}${b.start || ''}`)
  ));
}

/**
 * Lista slots abertos no sistema (público).
 */
export async function listOpenSlotsGlobal({ limit: lim = 100, onlyFuture = true } = {}) {
  if (!db) return [];
  // Mesma historia: `status ==` + `date >=` + `orderBy(date)` precisa de
  // [status, date], que nao existe. Um `where` so (o status, que corta a maior
  // parte) e o recorte de data em memoria.
  const snap = await getDocs(query(
    collection(db, COL),
    where('status', '==', OPEN_SLOT_STATUS.OPEN),
    limit(500),
  ));
  const hoje = new Date().toISOString().slice(0, 10);
  return ordenarPorDataHora(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    .filter((s) => !onlyFuture || (s.date || '') >= hoje)
    .slice(0, Math.max(1, Number(lim) || 100));
}

/**
 * Busca um slot por id.
 */
export async function getOpenSlot(slotId) {
  if (!db || !slotId) return null;
  const snap = await getDoc(doc(db, COL, slotId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Atleta se inscreve em um slot.
 * Valida usando canJoinOpenSlot.
 * Notifica a arena.
 */
export async function joinOpenSlot(slotId, user, profile) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  if (!user?.uid) throw new Error('Faça login para se inscrever.');

  const slot = await getOpenSlot(slotId);
  if (!slot) throw new Error('Slot não encontrado.');

  // A peneira de nível usa a RÉGUA ÚNICA, não o campo do perfil.
  const level = await nivelDoAtleta(user.uid);
  const check = canJoinOpenSlot(slot, user, { level });
  if (!check.ok) throw new Error(check.reason);

  const ref = doc(db, COL, slotId);
  const newParticipants = [...(slot.participants || []), user.uid];
  const newFilled = newParticipants.length;
  const newStatus = newFilled >= (slot.total_spots || 0)
    ? OPEN_SLOT_STATUS.FULL
    : OPEN_SLOT_STATUS.OPEN;

  await updateDoc(ref, {
    participants: arrayUnion(user.uid),
    filled_spots: newFilled,
    status: newStatus,
    updated_at: serverTimestamp(),
  });

  // Notifica a arena
  try {
    const managerIds = await listArenaManagers(slot.arena_id);
    notifyUsers(managerIds, {
      title: `Novo inscrito em "${str(slot.arena_name).slice(0, 50)}"`,
      message: `${displayName(user, profile)} entrou no slot de ${slot.date} ${slot.start}`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${slot.arena_id}/gerir/open-match`,
      actor: { uid: user.uid, displayName: displayName(user, profile) },
    });
  } catch (err) {
    logger.info('Falha ao notificar arena (não crítico)', { err: err?.code });
  }

  await createAuditLog({
    action: 'open_slot_joined',
    actor: user,
    details: { slot_id: slotId, arena_id: slot.arena_id },
  });
}

/**
 * Atleta sai de um slot.
 */
export async function leaveOpenSlot(slotId, userId) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  if (!userId) throw new Error('userId é obrigatório.');

  const slot = await getOpenSlot(slotId);
  if (!slot) return;

  const wasInSlot = (slot.participants || []).includes(userId);
  if (!wasInSlot) return;

  const newParticipants = (slot.participants || []).filter((p) => p !== userId);
  const newFilled = newParticipants.length;
  const newStatus = newFilled < (slot.total_spots || 0)
    ? OPEN_SLOT_STATUS.OPEN
    : OPEN_SLOT_STATUS.FULL;

  await updateDoc(doc(db, COL, slotId), {
    participants: arrayRemove(userId),
    filled_spots: newFilled,
    status: newStatus,
    updated_at: serverTimestamp(),
  });

  // 🐞 A fila de espera existia e NUNCA era chamada: alguém saía, a vaga
  // abria, e quem estava na fila não ficava sabendo — que é a única coisa que
  // a fila promete. Agora quem sai libera o próximo, na hora.
  //
  // Só quando o slot estava LOTADO e passou a ter vaga: sair de um jogo com
  // lugar sobrando não chama ninguém.
  if (slot.status === OPEN_SLOT_STATUS.FULL && newStatus === OPEN_SLOT_STATUS.OPEN) {
    try {
      // Importado sob demanda: `waitlistService` já importa daqui, e um ciclo
      // no topo do arquivo é a receita para uma exportação chegar `undefined`
      // em tempo de carga.
      const { notifyNextInLine } = await import('./waitlistService.js');
      await notifyNextInLine(slotId, { uid: userId });
    } catch (err) {
      // Chamar a fila é consequência, não pré-requisito: se falhar, quem saiu
      // saiu do mesmo jeito.
      logger.info('Falha ao chamar o próximo da fila (não crítico)', { err: err?.code });
    }
  }

  await createAuditLog({
    action: 'open_slot_left',
    actor: { uid: userId },
    details: { slot_id: slotId, arena_id: slot.arena_id },
  });
}

/**
 * Deleta slot (apenas criador ou platform admin).
 */
export async function deleteOpenSlot(slotId, actor) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  // Limpa waitlist relacionada
  try {
    const wlSnap = await getDocs(query(collection(db, 'arena_waitlist'), where('slot_id', '==', slotId)));
    if (!wlSnap.empty) {
      const batch = writeBatch(db);
      wlSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    logger.info('Falha ao limpar waitlist do slot', { err: err?.code });
  }
  await deleteDoc(doc(db, COL, slotId));
  await createAuditLog({
    action: 'open_slot_deleted',
    actor,
    details: { slot_id: slotId },
  });
}
