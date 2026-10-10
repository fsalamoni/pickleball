/**
 * Service I/O do roster de alunos do professor (Fase B).
 *
 * Coleção `coach_students/{coachId_studentId}` (aditiva, flag coach_lessons).
 *
 * Permissões (ver firestore.rules):
 * - Lê o professor e o próprio aluno.
 * - Escreve o professor (cria/edita ficha, tags, notas, status).
 * - O aluno pode aceitar o convite alterando apenas o próprio status.
 * - Qualquer um dos dois ENCERRA o vínculo; encerrado, só o aluno o reativa
 *   (aceitando um novo convite) e o professor não o apaga.
 */

import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeStudent, studentDocId, canSetStudentStatus, canCoachRemoveStudent, isLinkEndedHistory, STUDENT_STATUS,
} from '../domain/student.js';

export const COACH_STUDENT_COLLECTION = 'coach_students';
/**
 * Notas privadas do professor: `coach_student_notes/{coachId_studentId}`. O
 * vínculo é legível pelo ALUNO e o Firestore não esconde campo, então a nota
 * mora numa coleção que só o professor (e o admin) lê.
 */
export const COACH_STUDENT_NOTES = 'coach_student_notes';

const str = (v) => String(v ?? '').trim();

/** Roster completo de um professor. */
export async function listCoachStudents(coachId) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_STUDENT_COLLECTION), where('coach_id', '==', coachId));
  // Falhar a leitura das notas falha a lista: salvar uma ficha com a nota em
  // branco por engano apagaria o que o professor escreveu.
  const [snap, notasSnap] = await Promise.all([
    getDocs(q),
    getDocs(query(collection(db, COACH_STUDENT_NOTES), where('coach_id', '==', coachId))),
  ]);
  const notas = new Map(notasSnap.docs.map((d) => [d.id, d.data()?.text || '']));
  const fichas = snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, private_notes: notas.has(d.id) ? notas.get(d.id) : (data.private_notes || '') };
  });
  migrarNotasLegadas(coachId, snap.docs, notas);
  return fichas;
}

/** Nota que ainda mora no vínculo (visível ao aluno) vai para a coleção privada. Melhor esforço. */
function migrarNotasLegadas(coachId, docs, notas) {
  const pendentes = docs.filter((d) => d.data()?.private_notes && !notas.has(d.id));
  if (!pendentes.length) return;
  const batch = writeBatch(db);
  pendentes.slice(0, 200).forEach((d) => {
    const data = d.data();
    batch.set(doc(db, COACH_STUDENT_NOTES, d.id), {
      coach_id: coachId, student_id: data.student_id, text: data.private_notes, updated_at: serverTimestamp(),
    });
    batch.update(doc(db, COACH_STUDENT_COLLECTION, d.id), { private_notes: deleteField() });
  });
  batch.commit().catch(() => {});
}

/** Vínculos de um aluno (professores que o adicionaram). */
export async function listStudentCoaches(studentId) {
  if (!studentId) return [];
  const q = query(collection(db, COACH_STUDENT_COLLECTION), where('student_id', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * O vínculo entre os dois, ou `null`. Por CONSULTA, não por id: a regra de
 * leitura olha `resource.data`, e o `get` de um vínculo que não existe (o
 * professor o removeu, uma das contas foi excluída) seria recusado em vez de
 * responder "não há vínculo".
 */
export async function getStudent(coachId, studentId) {
  if (!coachId || !studentId) return null;
  const snap = await getDocs(query(
    collection(db, COACH_STUDENT_COLLECTION),
    where('coach_id', '==', coachId),
    where('student_id', '==', studentId),
  ));
  const d = snap.docs[0];
  return d ? { id: d.id, ...d.data() } : null;
}

/**
 * Cria ou atualiza a ficha de um aluno (só o professor/admin). Preserva o
 * status atual se o vínculo já existir e o input não trouxer status novo.
 */
export async function upsertStudent(coachId, input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== coachId && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão para editar este aluno.');
  }
  const { valid, error, value: completo } = normalizeStudent({ ...input, coach_id: coachId });
  if (!valid) throw new Error(error);
  const { private_notes: notas, ...value } = completo;

  const id = studentDocId(coachId, value.student_id);
  const existing = await getDoc(doc(db, COACH_STUDENT_COLLECTION, id));
  const isNew = !existing.exists();
  // Numa atualização, não rebaixa o status por omissão. Vínculo encerrado (ou
  // reconvidado) não muda de status pela ficha: só por `setStudentStatus`.
  const atual = isNew ? null : existing.data();
  const status = (!isNew && (!input.status || isLinkEndedHistory(atual))) ? atual.status : value.status;

  await setDoc(doc(db, COACH_STUDENT_COLLECTION, id), {
    ...value,
    status,
    updated_at: serverTimestamp(),
    ...(isNew ? { joined_at: serverTimestamp(), invited_by: actor.uid } : {}),
    private_notes: deleteField(), // nunca no vínculo, que o aluno lê
  }, { merge: true });
  await setDoc(doc(db, COACH_STUDENT_NOTES, id), {
    coach_id: coachId, student_id: value.student_id, text: notas, updated_at: serverTimestamp(),
  });

  if (isNew && value.student_id) {
    notifyUsers([value.student_id], {
      title: 'Você foi adicionado por um professor',
      message: `${str(actor.displayName) || 'Um professor'} adicionou você como aluno. Toque para ver.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-aulas',
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: isNew ? 'coach_student_added' : 'coach_student_updated', actor, details: { coach_id: coachId, student_id: value.student_id } });
  return id;
}

/** O que muda no documento para cada passo do vínculo. */
function statusPatch(link, nextStatus, actor) {
  const patch = { status: nextStatus, updated_at: serverTimestamp() };
  if (nextStatus === STUDENT_STATUS.ENDED) {
    patch.ended_at = serverTimestamp();
    patch.ended_by = actor.uid;
  }
  // O aluno aceitou de novo: o vínculo volta a ser um vínculo comum.
  if (nextStatus === STUDENT_STATUS.ACTIVE && actor.uid === link.student_id && isLinkEndedHistory(link)) {
    patch.ended_at = deleteField();
    patch.ended_by = deleteField();
  }
  return patch;
}

/** Quem recebe o aviso de cada passo — e o que ele diz. */
function statusNotice(link, nextStatus, { byStudent, actor }) {
  const aluno = str(link.student_name) || 'Um aluno';
  const professor = str(actor.displayName) || 'Seu professor';
  if (byStudent && nextStatus === STUDENT_STATUS.ACTIVE) {
    return { to: link.coach_id, title: 'Aluno aceitou o convite', message: `${aluno} aceitou fazer parte da sua lista de alunos.`, link: '/aulas?aba=alunos' };
  }
  if (byStudent && nextStatus === STUDENT_STATUS.ENDED) {
    return link.status === STUDENT_STATUS.INVITED
      ? { to: link.coach_id, title: 'Convite recusado', message: `${aluno} recusou o convite para ser seu aluno.`, link: '/aulas?aba=alunos' }
      : { to: link.coach_id, title: 'Vínculo de aluno encerrado', message: `${aluno} encerrou o vínculo de aluno com você.`, link: '/aulas?aba=alunos' };
  }
  if (!byStudent && nextStatus === STUDENT_STATUS.ENDED && link.status !== STUDENT_STATUS.INVITED) {
    return { to: link.student_id, title: 'Vínculo com o professor encerrado', message: `${professor} encerrou o vínculo de aluno com você.`, link: '/minhas-aulas' };
  }
  if (!byStudent && nextStatus === STUDENT_STATUS.INVITED) {
    return { to: link.student_id, title: 'Convite de professor', message: `${professor} convidou você para ser aluno de novo. Toque para responder.`, link: '/minhas-aulas' };
  }
  return null;
}

/**
 * Muda o status do vínculo com guarda (`canSetStudentStatus`). O professor
 * ativa/pausa/encerra e, depois do fim, só convida de novo; o aluno aceita o
 * convite e encerra o vínculo.
 */
export async function setStudentStatus(student, nextStatus, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (!student?.coach_id || !student?.student_id) throw new Error('Vínculo inválido.');
  const isCoach = actor.uid === student.coach_id || actor.isPlatformAdmin;
  const isStudent = actor.uid === student.student_id;
  if (!isCoach && !isStudent) throw new Error('Sem permissão.');
  // Quem é o aluno age como aluno mesmo sendo admin: o fim é dele.
  const role = isStudent ? 'aluno' : 'professor';
  if (!canSetStudentStatus(student, nextStatus, role)) {
    throw new Error(isLinkEndedHistory(student) && role === 'professor'
      ? 'O vínculo foi encerrado: só volta se o aluno aceitar um novo convite.'
      : 'Sem permissão para esta ação.');
  }

  const id = studentDocId(student.coach_id, student.student_id);
  await updateDoc(doc(db, COACH_STUDENT_COLLECTION, id), statusPatch(student, nextStatus, actor));

  const aviso = statusNotice(student, nextStatus, { byStudent: isStudent, actor });
  if (aviso?.to && aviso.to !== actor.uid) {
    notifyUsers([aviso.to], {
      title: aviso.title,
      message: aviso.message,
      type: NOTIFICATION_TYPE.GENERIC,
      link: aviso.link,
      actor: { uid: actor.uid },
    })?.catch?.(() => 0);
  }
  await createAuditLog({ action: 'coach_student_status_changed', actor, details: { coach_id: student.coach_id, student_id: student.student_id, to: nextStatus } });
}

/** Remove o vínculo (só o professor/admin; o encerrado fica no histórico). */
export async function removeStudent(student, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== student.coach_id && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão para remover este aluno.');
  }
  if (!actor.isPlatformAdmin && !canCoachRemoveStudent(student)) {
    throw new Error('O vínculo encerrado fica no histórico.');
  }
  const id = studentDocId(student.coach_id, student.student_id);
  await deleteDoc(doc(db, COACH_STUDENT_NOTES, id)).catch(() => {});
  await deleteDoc(doc(db, COACH_STUDENT_COLLECTION, id));
  await createAuditLog({ action: 'coach_student_removed', actor, details: { coach_id: student.coach_id, student_id: student.student_id } });
}
