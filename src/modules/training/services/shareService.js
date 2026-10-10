/**
 * Compartilhar e indicar itens (`training_shares`).
 *
 * - `indicacao`: qualquer pessoa indica o próprio item ou um da biblioteca.
 * - `aluno`: SÓ o professor, para os alunos com vínculo ATIVO (a regra confere
 *   `coach_students/{professor}_{aluno}`; aqui só filtramos antes).
 *
 * Indicar um item privado dá ao destinatário acesso de leitura
 * (`shared_uids`), gravado junto com o primeiro lote de envios.
 */

import {
  arrayUnion, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  buildShares, canShareItem, MAX_RECIPIENTS, needsSharedAccess, SHARE_DONE_NOTE_MAX, SHARE_KIND,
} from '../domain/share.js';
import { TRAINING_ITEMS, TrainingItemError } from './trainingItemService.js';

export const TRAINING_SHARES = 'training_shares';
const toShare = (d) => ({ id: d.id, ...d.data() });
// Lote pequeno de propósito: a regra lê, POR envio, a configuração, o item, o
// cadastro de professor e o vínculo (4 leituras), e um lote aceita no máximo 20
// leituras de regra no total — 5 envios "para aluno" já passam do teto (provado
// no emulador). 4 por lote cabe, com a atualização do item junto no primeiro.
const SHARE_BATCH = 4;

/** O que recebi (indicações e envios do professor). */
export async function listInbox(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, TRAINING_SHARES), where('to_uid', '==', uid)))).docs.map(toShare);
}

/** O que mandei (o professor vê quem concluiu). */
export async function listSent(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, TRAINING_SHARES), where('from_uid', '==', uid)))).docs.map(toShare);
}

/**
 * Indica/envia um item para várias pessoas.
 * Quem já recebeu este item e ainda não concluiu não recebe de novo.
 *
 * @param {object} p
 * @param {object} p.item
 * @param {string[]} p.toUids
 * @param {'indicacao'|'aluno'} p.kind
 * @param {string} [p.note]
 * @param {string|null} [p.dueDate] 'YYYY-MM-DD' (só para aluno)
 * @param {string[]} [p.activeStudentIds] alunos ativos (obrigatório para `aluno`)
 * @param {object} p.identity
 * @param {object} p.settings
 * @returns {Promise<{ sent: number, skipped: number, failed: number, notified: number }>}
 */
export async function shareItem({ item, toUids = [], kind = SHARE_KIND.INDICACAO, note = '', dueDate = null, activeStudentIds = [], identity, settings }) {
  if (settings?.allow_sharing === false) throw new TrainingItemError('O compartilhamento de treinos está pausado no momento.');
  const can = canShareItem(item, { uid: identity?.uid });
  if (!can.ok) throw new TrainingItemError(can.reason);
  const isStudentSend = kind === SHARE_KIND.ALUNO;
  if (isStudentSend && !identity.isCoach) throw new TrainingItemError('Só professores enviam para alunos.');

  let destinos = [...new Set(toUids.filter((u) => u && u !== identity.uid))];
  if (isStudentSend) destinos = destinos.filter((u) => activeStudentIds.includes(u));
  if (!destinos.length) throw new TrainingItemError(isStudentSend ? 'Escolha pelo menos um aluno ativo.' : 'Escolha pelo menos uma pessoa.');

  // Não duplica o que a pessoa já tem em aberto deste mesmo item.
  const anteriores = await getDocs(query(collection(db, TRAINING_SHARES),
    where('from_uid', '==', identity.uid), where('item_id', '==', item.id)));
  const emAberto = new Set(anteriores.docs.map((d) => d.data()).filter((s) => !s.done_at).map((s) => s.to_uid));
  const novos = destinos.filter((u) => !emAberto.has(u)).slice(0, MAX_RECIPIENTS); // o mesmo teto de buildShares: quem lê o item é quem recebe o aviso
  if (!novos.length) return { sent: 0, skipped: destinos.length, failed: 0, notified: 0 };

  const shares = buildShares({
    item, toUids: novos, kind, note, dueDate,
    from: { uid: identity.uid, name: identity.name, role: identity.isCoach ? 'professor' : 'atleta' },
  });
  // Lotes de até 10: a regra de cada envio "para aluno" lê o vínculo daquele
  // aluno, e um lote só pode fazer 20 leituras de regra. O acesso ao item
  // (`shared_uids`) vai no PRIMEIRO lote, para ninguém receber o aviso de um
  // item que não consegue abrir.
  let acesso = null;
  if (needsSharedAccess(item, { kind })) {
    const atual = Array.isArray(item.shared_uids) ? item.shared_uids : [];
    const faltam = novos.filter((u) => !atual.includes(u));
    if (atual.length + faltam.length > 50) {
      throw new TrainingItemError('Este item já foi compartilhado com muitas pessoas. Deixe-o visível aos seus alunos ou publique na biblioteca.');
    }
    if (faltam.length) acesso = faltam;
  }
  const entregues = [];
  for (let i = 0; i < shares.length; i += SHARE_BATCH) {
    const parte = shares.slice(i, i + SHARE_BATCH);
    const batch = writeBatch(db);
    if (i === 0 && acesso) batch.update(doc(db, TRAINING_ITEMS, item.id), { shared_uids: arrayUnion(...acesso), updated_at: serverTimestamp() });
    for (const sh of parte) batch.set(doc(collection(db, TRAINING_SHARES)), { ...sh, created_at: serverTimestamp() });
    try {
      await batch.commit();
    } catch (err) {
      if (!entregues.length) throw err;
      break; // o que já foi entregue fica; a tela diz quantos faltaram
    }
    entregues.push(...parte.map((sh) => sh.to_uid));
  }

  const notified = await notifyUsers(entregues, {
    type: NOTIFICATION_TYPE.TRAINING_SHARE,
    title: isStudentSend ? 'Seu professor mandou um treino' : 'Indicaram um treino para você',
    message: `${identity.name || 'Alguém'}: "${item.title}"${dueDate && isStudentSend ? ` — para fazer até ${dueDate.split('-').reverse().join('/')}` : ''}`,
    link: '/treino?aba=recebidos',
    actor: { uid: identity.uid, name: identity.name },
    data: { item_id: item.id },
  }).catch(() => 0);
  await createAuditLog({
    action: isStudentSend ? 'training_item_sent_students' : 'training_item_shared',
    actor: identity.actor,
    details: { item_id: item.id, recipients: entregues.length, kind },
  });
  return { sent: entregues.length, skipped: destinos.length - novos.length, failed: novos.length - entregues.length, notified };
}

/** O destinatário abriu. */
export async function markShareRead(share) {
  if (share.read_at) return;
  await updateDoc(doc(db, TRAINING_SHARES, share.id), { read_at: serverTimestamp() });
}

/** O destinatário concluiu (com um recado opcional ao professor) — ou desfaz. */
export async function setShareDone(share, done, note = '') {
  await updateDoc(doc(db, TRAINING_SHARES, share.id), {
    done_at: done ? serverTimestamp() : null,
    done_note: done ? String(note ?? '').trim().slice(0, SHARE_DONE_NOTE_MAX) : '',
    ...(share.read_at ? {} : { read_at: serverTimestamp() }),
  });
}

/** Tira da caixa (quem recebeu) ou cancela o envio (quem mandou). */
export async function deleteShare(share) {
  await deleteDoc(doc(db, TRAINING_SHARES, share.id));
}
