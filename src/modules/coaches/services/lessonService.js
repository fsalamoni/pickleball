/**
 * Service I/O do produto de aulas do professor (Fase A).
 *
 * Coleções (aditivas, atrás da flag `coach_lessons`):
 * - coach_availability/{coachId} — disponibilidade semanal (1 doc/professor)
 * - coach_lessons/{lessonId}      — aulas (avulsas/recorrentes)
 *
 * Permissões (ver firestore.rules):
 * - Disponibilidade: leitura pública; escrita do próprio professor ou admin.
 * - Aula: cria o professor OU o aluno (student_id == uid) OU admin; responde/
 *   conclui/cancela o professor; o aluno só cancela a própria aula.
 */

import {
  collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { expandRecurring } from '../../arenas/domain/booking.js';
import { normalizeAvailability } from '../domain/availability.js';
import {
  normalizeLesson,
  canTransition,
  lessonSlots,
  lessonFirstSlot,
  LESSON_STATUS,
  LESSON_KIND,
} from '../domain/lesson.js';
import { getCoach } from './coachService.js';
import { debitForLesson } from './packageService.js';
import { COACH_STUDENT_COLLECTION } from './studentService.js';
import { logger } from '@/core/lib/logger';
import { LESSON_COUPON_STATUS, lessonCouponLine, pendingCouponReturn } from '../../promo/domain/lessonCoupon.js';

export const COACH_LESSON_COLLECTIONS = {
  availability: 'coach_availability',
  lessons: 'coach_lessons',
};

const str = (v) => String(v ?? '').trim();

/* --------------------------- Disponibilidade --------------------------- */

/** Lê a disponibilidade de um professor (ou null). */
export async function getAvailability(coachId) {
  if (!coachId) return null;
  const snap = await getDoc(doc(db, COACH_LESSON_COLLECTIONS.availability, coachId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Salva (merge) a disponibilidade. Só o próprio professor ou platform admin. */
export async function saveAvailability(coachId, input, actor) {
  if (!coachId) throw new Error('coachId é obrigatório.');
  if (actor?.uid !== coachId && !actor?.isPlatformAdmin) {
    throw new Error('Sem permissão para editar esta disponibilidade.');
  }
  const value = normalizeAvailability({ ...input, coach_id: coachId });
  await setDoc(doc(db, COACH_LESSON_COLLECTIONS.availability, coachId), {
    ...value,
    updated_at: serverTimestamp(),
  }, { merge: true });
  await createAuditLog({
    action: 'coach_availability_updated',
    actor,
    details: { coach_id: coachId, windows: value.windows.length },
  });
  return coachId;
}

/* -------------------------------- Aulas -------------------------------- */

export async function getLesson(lessonId) {
  if (!lessonId) return null;
  const snap = await getDoc(doc(db, COACH_LESSON_COLLECTIONS.lessons, lessonId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Aulas de um professor (agenda do professor). */
export async function listCoachLessons(coachId) {
  if (!coachId) return [];
  const q = query(
    collection(db, COACH_LESSON_COLLECTIONS.lessons),
    where('coach_id', '==', coachId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Aulas de um aluno ("Minhas aulas"). */
export async function listStudentLessons(studentId) {
  if (!studentId) return [];
  const q = query(
    collection(db, COACH_LESSON_COLLECTIONS.lessons),
    where('student_id', '==', studentId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Slots ocupados (aulas confirmadas) de um professor — alimenta a geração de
 * horários livres da disponibilidade.
 */
export async function getBusySlots(coachId) {
  const lessons = await listCoachLessons(coachId);
  return lessons
    .filter((l) => l.status === LESSON_STATUS.CONFIRMED)
    .flatMap((l) => lessonSlots(l));
}

/**
 * Cria/solicita uma aula. O ator pode ser o aluno (solicita ao professor) ou
 * o próprio professor (agenda para um aluno). Nasce SOLICITADA quando pedida
 * pelo aluno; o professor pode marcar já confirmada ao criar (input.confirm).
 *
 * @param {string} coachId
 * @param {object} actor - usuário autenticado (.uid, .isPlatformAdmin)
 * @param {object} input - dados da aula (ver normalizeLesson) + recurring?
 * @returns {Promise<string>} id da aula
 */
export async function requestLesson(coachId, actor, input) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (!coachId) throw new Error('coachId é obrigatório.');

  const isCoach = actor.uid === coachId || actor.isPlatformAdmin;
  const requestedBy = isCoach ? 'coach' : 'student';

  // Expande recorrência (se houver) para slots concretos.
  let slots = Array.isArray(input.slots) ? input.slots : [];
  let recurrence = null;
  if (str(input.kind).toLowerCase() === LESSON_KIND.RECURRING || input.recurring) {
    recurrence = {
      weekday: Math.trunc(Number(input.recurring?.weekday)),
      start: str(input.recurring?.start),
      end: str(input.recurring?.end),
      weeks: Math.max(1, Math.min(52, Math.trunc(Number(input.recurring?.weeks) || 0))),
      fromDate: str(input.recurring?.fromDate),
    };
    slots = expandRecurring(recurrence);
    if (slots.length === 0) throw new Error('Preencha o dia da semana, os horários e o número de semanas.');
  }

  const { valid, error, value } = normalizeLesson({
    ...input,
    coach_id: coachId,
    kind: recurrence ? LESSON_KIND.RECURRING : LESSON_KIND.SINGLE,
    slots,
    recurrence,
    requested_by: requestedBy,
    // aluno solicitante: vincula student_id ao próprio uid
    student_id: isCoach ? (str(input.student_id) || null) : actor.uid,
    student_name: isCoach ? input.student_name : (input.student_name || actor.displayName),
    status: (isCoach && input.confirm) ? LESSON_STATUS.CONFIRMED : LESSON_STATUS.REQUESTED,
    // O cupom é do ALUNO que pede: aula criada pelo professor não leva cupom.
    coupon: isCoach ? null : input.coupon,
  });
  if (!valid) throw new Error(error);

  const id = doc(collection(db, COACH_LESSON_COLLECTIONS.lessons)).id;
  await setDoc(doc(db, COACH_LESSON_COLLECTIONS.lessons, id), {
    ...value,
    id,
    created_by: actor.uid,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });

  const first = lessonFirstSlot(value);
  const when = first ? `${first.date} ${first.start}` : 'horário combinado';
  if (requestedBy === 'student') {
    notifyUsers([coachId], {
      title: 'Nova solicitação de aula',
      message: `${value.student_name || 'Um aluno'} solicitou aula (${when}). Toque para responder.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/aulas',
      actor: { uid: actor.uid, displayName: value.student_name },
    });
  } else if (value.student_id) {
    notifyUsers([value.student_id], {
      title: 'Aula agendada pelo professor',
      message: `Você tem uma aula ${value.status === LESSON_STATUS.CONFIRMED ? 'confirmada' : 'proposta'} (${when}).`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-aulas',
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: 'coach_lesson_requested', actor, details: { coach_id: coachId, lesson_id: id, requested_by: requestedBy } });
  return id;
}

/**
 * Transição de status de uma aula, com guarda de fluxo e de papel.
 * @param {object} lesson - documento atual (com id e status)
 * @param {string} nextStatus
 * @param {object} actor
 */
export async function respondLesson(lesson, nextStatus, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (!lesson?.id) throw new Error('Aula inválida.');
  const isCoach = actor.uid === lesson.coach_id || actor.isPlatformAdmin;
  const isStudent = actor.uid === lesson.student_id;
  if (!isCoach && !isStudent) throw new Error('Sem permissão para alterar esta aula.');
  if (!canTransition(lesson.status, nextStatus)) {
    throw new Error('Transição de status inválida.');
  }
  // Aluno só pode cancelar.
  if (!isCoach && nextStatus !== LESSON_STATUS.CANCELLED) {
    throw new Error('Sem permissão para esta ação.');
  }

  // O cupom do pedido (Onda CG) é resolvido na CONFIRMAÇÃO, pelo professor —
  // como na arena, o uso é contado quando o serviço acontece, não no pedido.
  const cupom = isCoach && nextStatus === LESSON_STATUS.CONFIRMED
    ? await resolverCupomDaAula(lesson)
    : null;

  await updateDoc(doc(db, COACH_LESSON_COLLECTIONS.lessons, lesson.id), {
    status: nextStatus,
    ...(cupom ? { coupon: cupom.coupon, ...(cupom.price !== undefined ? { price: cupom.price } : {}) } : {}),
    updated_at: serverTimestamp(),
  });
  if (cupom?.coupon?.status === LESSON_COUPON_STATUS.APPLIED) {
    // Best-effort: a aula já está confirmada; falhar aqui só deixa de contar o uso.
    try {
      const { registrarUsoDePromo } = await import('../../promo/services/promoService.js');
      await registrarUsoDePromo(cupom.coupon.coupon_id, lesson.student_id);
    } catch (err) {
      logger.info('Uso do cupom da aula não contabilizado', { err: err?.code });
    }
  }

  // Aula desfeita pelo PROFESSOR com o cupom já contado: o uso volta na hora
  // (quando é o aluno quem cancela, ele não escreve o cupom — o professor
  // acerta depois; ver `returnPendingCouponUses`).
  if (isCoach && pendingCouponReturn({ ...lesson, status: nextStatus })) {
    try {
      await devolverUsoDoCupom(lesson.id);
    } catch (err) {
      logger.info('Uso do cupom da aula não devolvido', { err: err?.code });
    }
  }

  // Ao concluir, debita 1 crédito do pacote vinculado (best-effort).
  if (nextStatus === LESSON_STATUS.COMPLETED) {
    await debitForLesson(lesson, actor);
  }

  // Notifica a contraparte.
  const recipient = isCoach ? lesson.student_id : lesson.coach_id;
  if (recipient) {
    const first = lessonFirstSlot(lesson);
    const when = first ? `${first.date} ${first.start}` : '';
    const label = {
      [LESSON_STATUS.CONFIRMED]: 'confirmada',
      [LESSON_STATUS.DECLINED]: 'recusada',
      [LESSON_STATUS.CANCELLED]: 'cancelada',
      [LESSON_STATUS.COMPLETED]: 'concluída',
    }[nextStatus] || 'atualizada';
    // A devolução do cupom só vai no aviso ao ALUNO (é dele o uso que volta);
    // quando é o aluno quem cancela, o aviso vai ao professor e não fala nisso.
    const cupomDoAviso = cupom?.coupon
      || (isCoach && pendingCouponReturn({ ...lesson, status: nextStatus }) ? lesson.coupon : null);
    const linhaDoCupom = cupomDoAviso ? ` ${lessonCouponLine(cupomDoAviso, { lessonStatus: nextStatus })}.` : '';
    notifyUsers([recipient], {
      title: `Aula ${label}`,
      message: `A aula ${when ? `de ${when} ` : ''}foi ${label}.${linhaDoCupom}`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: isCoach ? '/minhas-aulas' : '/aulas',
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: 'coach_lesson_status_changed', actor, details: { lesson_id: lesson.id, to: nextStatus } });
}

/**
 * Devolve o uso do cupom de UMA aula desfeita — numa transação que lê a aula:
 * se outra aba já devolveu, não devolve de novo (o contador não pode descer
 * duas vezes pelo mesmo cancelamento). Só o professor (o emissor) consegue:
 * a regra só deixa o emissor escrever o cupom.
 *
 * @returns {Promise<boolean>} se devolveu agora
 */
async function devolverUsoDoCupom(lessonId) {
  if (!db || !lessonId) return false;
  const { PROMO_COLLECTIONS } = await import('../../promo/domain/promo.js');
  const aulaRef = doc(db, COACH_LESSON_COLLECTIONS.lessons, lessonId);
  return runTransaction(db, async (tx) => {
    const aulaSnap = await tx.get(aulaRef);
    if (!aulaSnap.exists()) return false;
    const aula = { id: aulaSnap.id, ...aulaSnap.data() };
    if (!pendingCouponReturn(aula)) return false;
    const cupomRef = doc(db, PROMO_COLLECTIONS.coupons, aula.coupon.coupon_id);
    const cupomSnap = await tx.get(cupomRef);
    if (cupomSnap.exists()) {
      const c = cupomSnap.data();
      const patch = {
        used_count: Math.max(0, (Number(c.used_count) || 0) - 1),
        updated_at: serverTimestamp(),
      };
      if (aula.student_id) {
        patch.used_by = (Array.isArray(c.used_by) ? c.used_by : []).filter((u) => u !== aula.student_id);
      }
      tx.update(cupomRef, patch);
    }
    tx.update(aulaRef, {
      coupon: { ...aula.coupon, returned: true, returned_at: Date.now() },
      updated_at: serverTimestamp(),
    });
    return true;
  });
}

/**
 * Acerta os usos de cupom presos em aulas desfeitas pelo ALUNO (ele cancela,
 * mas não escreve o cupom do professor). Roda do lado do professor — ao abrir
 * a agenda e antes de conferir o cupom de outro pedido do mesmo aluno. Cada
 * devolução é idempotente; uma que falhe não impede as outras.
 *
 * @param {object[]} lessons aulas já lidas pelo professor
 * @returns {Promise<number>} quantas foram devolvidas agora
 */
export async function returnPendingCouponUses(lessons = []) {
  const pendentes = (lessons || []).filter(pendingCouponReturn);
  let devolvidas = 0;
  for (const aula of pendentes) {
    try {
      if (await devolverUsoDoCupom(aula.id)) devolvidas += 1;
    } catch (err) {
      logger.info('Uso do cupom da aula não devolvido', { err: err?.code });
    }
  }
  return devolvidas;
}

/**
 * O aluno é aluno DESTE professor? (vínculo ativo ou em pausa, como na
 * vitrine). Consulta pelas DUAS igualdades — `coach_id` é o campo que a regra
 * confere, e ler o documento pelo id recusaria quando ele não existe.
 */
async function ehAlunoDoProfessor(coachId, studentId) {
  if (!coachId || !studentId) return false;
  const snap = await getDocs(query(
    collection(db, COACH_STUDENT_COLLECTION),
    where('coach_id', '==', coachId),
    where('student_id', '==', studentId),
  ));
  return snap.docs.some((d) => ['active', 'paused'].includes(d.data()?.status));
}

/**
 * Confere o cupom pendente da aula contra o BANCO (o aluno informou; quem
 * aplica é o professor) e devolve o que gravar. Sem cupom pendente, `null`.
 * Se a conferência falhar (rede), o cupom segue pendente — nunca é recusado
 * nem aplicado às cegas.
 *
 * Antes de conferir: (1) acerta usos presos em aulas deste aluno que foram
 * desfeitas — senão "você já usou" recusaria o cupom que a tela do aluno já
 * disse ter voltado; (2) no cupom "só para os meus alunos", confere o vínculo.
 */
async function resolverCupomDaAula(lesson) {
  if (lesson?.coupon?.status !== LESSON_COUPON_STATUS.PENDING || !lesson.coupon.coupon_id) return null;
  try {
    // Sob demanda: a conferência puxa o marketing inteiro, e o serviço de
    // aulas é carregado por telas (a tela inicial) que nunca confirmam aula.
    const [{ getPromoCoupon }, { resolveLessonCoupon, PROMO_VISIBILITY }] = await Promise.all([
      import('../../promo/services/promoService.js'),
      import('../../promo/domain/promo.js'),
    ]);
    if (lesson.student_id) {
      const doAluno = await getDocs(query(
        collection(db, COACH_LESSON_COLLECTIONS.lessons),
        where('coach_id', '==', lesson.coach_id),
        where('student_id', '==', lesson.student_id),
      ));
      await returnPendingCouponUses(doAluno.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    const [cupom, professor] = await Promise.all([
      getPromoCoupon(lesson.coupon.coupon_id),
      getCoach(lesson.coach_id).catch(() => null),
    ]);
    const isStudent = cupom?.visibility === PROMO_VISIBILITY.STUDENTS
      ? await ehAlunoDoProfessor(lesson.coach_id, lesson.student_id)
      : null;
    return resolveLessonCoupon({ lesson, coupon: cupom, coach: professor || {}, isStudent });
  } catch (err) {
    logger.info('Cupom da aula não conferido', { err: err?.code });
    return null;
  }
}

/** Perfil do professor (reexport de conveniência para as telas de aula). */
export { getCoach };
