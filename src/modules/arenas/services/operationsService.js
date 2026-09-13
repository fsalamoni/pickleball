/**
 * Service: Operações da arena — checklist, manutenção e equipe.
 *
 * ## A decisão que vale conhecer
 *
 * A ordem de manutenção **grava** a cópia em `arena_unavailabilities`; o dia
 * de jogo **deriva** a dele. A diferença não é inconsistência: o dia de jogo é
 * público e qualquer tela consegue derivar da fonte, enquanto a ordem de
 * manutenção é privada da arena (`allow read: if isArenaManager`) — o atleta
 * nunca a leria. Então a verdade que o calendário público enxerga precisa ser
 * um documento público, e manter essa cópia em dia (criar, editar, concluir,
 * cancelar, apagar) é obrigação deste serviço.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import {
  normalizeChecklistItem, normalizeMaintenanceInput, checklistProgress,
  normalizeStaffMember, startChecklistDay, maintenanceBlockPayloads,
  CHECKLIST_KIND, MAINTENANCE_STATUS, STAFF_MAX,
} from '../domain/operations.js';
import { ARENA_COLLECTIONS } from '../domain/constants.js';

const COL_CHECKLISTS = 'arena_checklists';
const COL_MAINTENANCE = 'arena_maintenance_orders';
const COL_UNAV = ARENA_COLLECTIONS.unavailabilities;
const COL_SETTINGS = 'arena_settings';

function str(v) { return String(v ?? '').trim(); }

/* --------------------- Checklists -------------------- */

export async function listArenaChecklists(arenaId, { kind, onlyActive = false, lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  // 🐞 `arena_id ==` + `kind ==` + `orderBy('created_at')` exige índice
  // composto, e `arena_checklists` não tem nenhum: a consulta falhava sempre.
  // Filtro, ordenação e corte foram para a memória — e o corte só pode vir
  // DEPOIS da ordenação, senão os 50 seriam 50 quaisquer.
  const snap = await getDocs(query(collection(db, COL_CHECKLISTS), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => !kind || x.kind === kind)
    .sort((a, b) => Number(b.created_at?.seconds || 0) - Number(a.created_at?.seconds || 0))
    .slice(0, Math.max(1, Number(lim) || 50));
}

export async function createChecklist(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const items = (Array.isArray(input.items) ? input.items : []).map(normalizeChecklistItem);
  const kind = Object.values(CHECKLIST_KIND).includes(input.kind) ? input.kind : CHECKLIST_KIND.OPENING;
  const id = doc(collection(db, COL_CHECKLISTS)).id;
  await setDoc(doc(db, COL_CHECKLISTS, id), {
    id, arena_id: arenaId, kind,
    title: str(input.title).slice(0, 120),
    items: items.map((i) => ({ ...i, completed: false, completed_at: null, completed_by: null })),
    completed_pct: 0,
    created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_checklist_created', actor, details: { arena_id: arenaId, kind } });
  return id;
}

export async function toggleChecklistItem(checklistId, itemIdx, userId) {
  if (!checklistId || !Number.isFinite(itemIdx)) return;
  const ref = doc(db, COL_CHECKLISTS, checklistId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cl = { id: snap.id, ...snap.data() };
  const items = [...(cl.items || [])];
  if (itemIdx < 0 || itemIdx >= items.length) return;
  items[itemIdx] = {
    ...items[itemIdx],
    completed: !items[itemIdx].completed,
    completed_at: items[itemIdx].completed ? null : serverTimestamp(),
    completed_by: items[itemIdx].completed ? null : userId,
  };
  const completed_pct = checklistProgress(items);
  await updateDoc(ref, { items, completed_pct, updated_at: serverTimestamp() });
}

/* --------------------- Maintenance -------------------- */

export async function listArenaMaintenance(arenaId, { lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_MAINTENANCE), where('arena_id', '==', arenaId), orderBy('created_at', 'desc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Deixa o calendário exatamente com os bloqueios que ESTA ordem precisa:
 * apaga os antigos e grava os novos, num lote só.
 *
 * Só mexe em documentos marcados com `maintenance_id` — um bloqueio que a
 * arena criou à mão nunca é tocado. Concluir ou cancelar a ordem chama isto
 * com a lista vazia, o que devolve a quadra à venda: manutenção que termina e
 * deixa a quadra fechada é prejuízo silencioso.
 */
export async function syncMaintenanceBlocks(order) {
  if (!db || !order?.id) return;
  const snap = await getDocs(
    query(collection(db, COL_UNAV), where('maintenance_id', '==', order.id)),
  );
  const atuais = snap.docs.map((d) => d.id);
  const desejados = maintenanceBlockPayloads(order);

  if (atuais.length === 0 && desejados.length === 0) return;

  const batch = writeBatch(db);
  atuais.forEach((id) => batch.delete(doc(db, COL_UNAV, id)));
  desejados.forEach((payload) => {
    batch.set(doc(collection(db, COL_UNAV)), {
      ...payload, created_at: serverTimestamp(), updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function createMaintenance(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeMaintenanceInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_MAINTENANCE)).id;
  const ordem = {
    id, arena_id: arenaId, ...value,
    created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL_MAINTENANCE, id), ordem);
  // A quadra é fechada DEPOIS de a ordem existir: se este passo falhar, a
  // ordem fica lá para ser corrigida. Na ordem inversa sobraria um bloqueio
  // órfão, apontando para uma ordem que ninguém encontra.
  await syncMaintenanceBlocks({ ...ordem, arena_id: arenaId });
  await createAuditLog({
    action: 'arena_maintenance_created',
    actor,
    details: { arena_id: arenaId, title: value.title, fecha_quadra: value.blocks_court },
  });
  return id;
}

/** A ordem inteira, para poder ressincronizar o calendário depois de editar. */
async function ordemPorId(orderId) {
  const snap = await getDoc(doc(db, COL_MAINTENANCE, orderId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Edita a ordem e refaz os bloqueios (a arena pode trocar quadra e data). */
export async function updateMaintenance(orderId, input, actor) {
  if (!orderId) return;
  const atual = await ordemPorId(orderId);
  if (!atual) throw new Error('Ordem não encontrada.');
  const { valid, errors, value } = normalizeMaintenanceInput({ ...atual, ...input });
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  await updateDoc(doc(db, COL_MAINTENANCE, orderId), { ...value, updated_at: serverTimestamp() });
  await syncMaintenanceBlocks({ ...atual, ...value, id: orderId });
  await createAuditLog({
    action: 'arena_maintenance_updated',
    actor,
    details: { order_id: orderId, arena_id: atual.arena_id },
  });
}

export async function updateMaintenanceStatus(orderId, status, actor) {
  if (!orderId) return;
  if (!Object.values(MAINTENANCE_STATUS).includes(status)) throw new Error('Status inválido.');
  const atual = await ordemPorId(orderId);
  await updateDoc(doc(db, COL_MAINTENANCE, orderId), {
    status,
    completed_at: status === MAINTENANCE_STATUS.DONE ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  });
  // Concluir ou cancelar DEVOLVE a quadra: `maintenanceBlockPayloads` devolve
  // lista vazia para ordem que não está mais aberta, e o sync apaga.
  if (atual) await syncMaintenanceBlocks({ ...atual, status, id: orderId });
  await createAuditLog({ action: 'arena_maintenance_status', actor, details: { order_id: orderId, status } });
}

/** Apaga a ordem — e o bloqueio junto, senão a quadra fica fechada por nada. */
export async function deleteMaintenance(orderId, actor) {
  if (!orderId) return;
  const atual = await ordemPorId(orderId);
  await syncMaintenanceBlocks({ ...(atual || {}), id: orderId, blocks_court: false });
  await deleteDoc(doc(db, COL_MAINTENANCE, orderId));
  await createAuditLog({
    action: 'arena_maintenance_deleted',
    actor,
    details: { order_id: orderId, arena_id: atual?.arena_id || null },
  });
}

/* --------------------- Checklist: a rotina do dia -------------------- */

/**
 * Começa o dia deste checklist: limpa os itens e guarda o dia anterior no
 * histórico. Chamado pela tela ao abrir — é o que faz o checkmark de ontem
 * parar de valer por hoje.
 *
 * Idempotente: rodar duas vezes no mesmo dia não apaga o que já foi marcado
 * (`startChecklistDay` devolve `null` quando o `run_date` já é hoje).
 */
export async function rollChecklistDay(checklist, todayISO) {
  if (!db || !checklist?.id) return false;
  const patch = startChecklistDay(checklist, todayISO);
  if (!patch) return false;
  await updateDoc(doc(db, COL_CHECKLISTS, checklist.id), {
    ...patch, updated_at: serverTimestamp(),
  });
  return true;
}

/** Edita título, tipo, itens e recorrência de um checklist. */
export async function updateChecklist(checklistId, input, actor) {
  if (!checklistId) return;
  const patch = { updated_at: serverTimestamp() };
  if (input.title != null) patch.title = str(input.title).slice(0, 120);
  if (input.kind != null && Object.values(CHECKLIST_KIND).includes(input.kind)) {
    patch.kind = input.kind;
  }
  if (input.recurring != null) patch.recurring = Boolean(input.recurring);
  if (input.active != null) patch.active = Boolean(input.active);
  if (Array.isArray(input.items)) {
    // Os itens que continuam existindo mantêm o que já foi marcado HOJE —
    // acrescentar "conferir a rede" às 10h não pode apagar o que a equipe fez
    // às 6h.
    const antes = await getDoc(doc(db, COL_CHECKLISTS, checklistId));
    const marcados = new Map(
      (antes.data()?.items || []).map((i) => [i.title, i]),
    );
    const itens = input.items.map(normalizeChecklistItem).map((i) => {
      const antigo = marcados.get(i.title);
      return {
        ...i,
        completed: Boolean(antigo?.completed),
        completed_at: antigo?.completed_at || null,
        completed_by: antigo?.completed_by || null,
      };
    });
    patch.items = itens;
    patch.completed_pct = checklistProgress(itens);
  }
  await updateDoc(doc(db, COL_CHECKLISTS, checklistId), patch);
  await createAuditLog({ action: 'arena_checklist_updated', actor, details: { checklist_id: checklistId } });
}

export async function deleteChecklist(checklistId, actor) {
  if (!checklistId) return;
  await deleteDoc(doc(db, COL_CHECKLISTS, checklistId));
  await createAuditLog({ action: 'arena_checklist_deleted', actor, details: { checklist_id: checklistId } });
}

/* ------------------------------- Equipe ------------------------------ */

/**
 * A equipe mora em `arena_settings.staff` — campo opcional, coleção que só o
 * gestor lê e escreve. Não é coleção nova de propósito: uma lista de até 40
 * pessoas cabe folgada num documento, e coleção nova custaria regra nova.
 */
export async function getArenaStaff(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDoc(doc(db, COL_SETTINGS, arenaId));
  const lista = snap.exists() ? snap.data()?.staff : null;
  return Array.isArray(lista) ? lista : [];
}

export async function saveArenaStaff(arenaId, staff, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const lista = (Array.isArray(staff) ? staff : [])
    .slice(0, STAFF_MAX)
    .map((m, i) => {
      const { valid, errors, value } = normalizeStaffMember(m);
      if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
      return { ...value, id: value.id || `s${Date.now().toString(36)}${i}` };
    });
  await setDoc(doc(db, COL_SETTINGS, arenaId), {
    arena_id: arenaId, staff: lista, updated_at: serverTimestamp(),
  }, { merge: true });
  await createAuditLog({
    action: 'arena_staff_updated',
    actor,
    details: { arena_id: arenaId, total: lista.length },
  });
  return lista;
}
