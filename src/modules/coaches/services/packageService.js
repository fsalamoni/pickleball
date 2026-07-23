/**
 * Service I/O de pacotes e vendas do professor (Fase C).
 *
 * Coleções (aditivas, flag coach_lessons):
 * - coach_packages/{id}      — definição do pacote (professor)
 * - coach_package_sales/{id} — venda/crédito (professor ↔ aluno)
 *
 * Permissões (ver firestore.rules):
 * - Pacotes: leitura pública; escrita do professor/admin.
 * - Vendas: leitura do professor e do aluno; escrita do professor/admin.
 */

import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizePackage, normalizePackageSale, computeExpiresAt, creditsRemaining,
} from '../domain/package.js';

export const COACH_PACKAGE_COLLECTIONS = {
  packages: 'coach_packages',
  sales: 'coach_package_sales',
};

/* ------------------------------ Pacotes ------------------------------ */

export async function listCoachPackages(coachId, { onlyActive = false } = {}) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_PACKAGE_COLLECTIONS.packages), where('coach_id', '==', coachId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return onlyActive ? list.filter((p) => p.active !== false) : list;
}

export async function createPackage(coachId, input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== coachId && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  const { valid, error, value } = normalizePackage({ ...input, coach_id: coachId });
  if (!valid) throw new Error(error);
  const id = doc(collection(db, COACH_PACKAGE_COLLECTIONS.packages)).id;
  await setDoc(doc(db, COACH_PACKAGE_COLLECTIONS.packages, id), {
    ...value, id, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'coach_package_created', actor, details: { coach_id: coachId, package_id: id } });
  return id;
}

export async function deletePackage(pkg, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== pkg.coach_id && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  await deleteDoc(doc(db, COACH_PACKAGE_COLLECTIONS.packages, pkg.id));
  await createAuditLog({ action: 'coach_package_deleted', actor, details: { package_id: pkg.id } });
}

/* ------------------------------- Vendas ------------------------------ */

export async function listCoachSales(coachId) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_PACKAGE_COLLECTIONS.sales), where('coach_id', '==', coachId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listStudentSales(studentId) {
  if (!studentId) return [];
  const q = query(collection(db, COACH_PACKAGE_COLLECTIONS.sales), where('student_id', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Vende um pacote a um aluno: cria a venda com créditos totais e validade
 * calculada a partir da definição do pacote.
 */
export async function sellPackage(coachId, { pkg, studentId, studentName, paid = false }, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== coachId && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  if (!pkg?.id) throw new Error('Pacote inválido.');
  const expires_at = computeExpiresAt(new Date(), pkg.validity_days);
  const { valid, error, value } = normalizePackageSale({
    coach_id: coachId,
    student_id: studentId,
    student_name: studentName,
    package_id: pkg.id,
    package_name: pkg.name,
    credits_total: pkg.lessons_count,
    credits_used: 0,
    price: pkg.price,
    expires_at,
    paid,
  });
  if (!valid) throw new Error(error);
  const id = doc(collection(db, COACH_PACKAGE_COLLECTIONS.sales)).id;
  await setDoc(doc(db, COACH_PACKAGE_COLLECTIONS.sales, id), {
    ...value, id, sold_at: serverTimestamp(), sold_by: actor.uid,
  });
  if (studentId) {
    notifyUsers([studentId], {
      title: 'Novo pacote de aulas',
      message: `Você recebeu o pacote "${value.package_name}" (${value.credits_total} aulas).`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-aulas',
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: 'coach_package_sold', actor, details: { coach_id: coachId, sale_id: id, package_id: pkg.id } });
  return id;
}

/** Marca uma venda como paga/não paga (professor/admin). */
export async function setSalePaid(sale, paid, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== sale.coach_id && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  await updateDoc(doc(db, COACH_PACKAGE_COLLECTIONS.sales, sale.id), { paid: paid === true, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'coach_package_payment', actor, details: { sale_id: sale.id, paid: paid === true } });
}

/** Debita 1 crédito de uma venda (uso de uma aula). */
export async function consumeCredit(saleId, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const ref = doc(db, COACH_PACKAGE_COLLECTIONS.sales, saleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Venda não encontrada.');
  const sale = { id: snap.id, ...snap.data() };
  if (actor.uid !== sale.coach_id && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  if (creditsRemaining(sale) <= 0) throw new Error('Sem créditos disponíveis.');
  await updateDoc(ref, {
    credits_used: (Math.trunc(Number(sale.credits_used) || 0)) + 1,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'coach_package_credit_used', actor, details: { sale_id: saleId } });
  return creditsRemaining(sale) - 1;
}

/**
 * Debita, best-effort, 1 crédito da venda vinculada a uma aula concluída.
 * Chamado ao concluir a aula; nunca lança (não deve bloquear a conclusão).
 */
export async function debitForLesson(lesson, actor) {
  try {
    if (lesson?.package_sale_id) await consumeCredit(lesson.package_sale_id, actor);
  } catch {
    // silencioso — a conclusão da aula não depende do débito
  }
}
