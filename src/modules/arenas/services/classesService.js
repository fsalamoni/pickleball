/**
 * Service: aulas e professores da arena.
 *
 * ## 🐞 A matrícula NUNCA funcionou
 *
 * A regra de `arena_class_bookings` exige
 * `request.resource.data.user_id == request.auth.uid`, e este serviço gravava
 * o campo com o nome `athlete_id`. Campo ausente vale `null`, `null` nunca é
 * igual a um uid, e o Firestore recusava **toda** matrícula — desde o dia em
 * que a funcionalidade foi escrita. O erro chegava à tela como um
 * "permission-denied" genérico, que ninguém liga a um nome de campo.
 *
 * Agora grava os dois: `user_id` (o campo que a REGRA lê, e que por isso é o
 * campo de verdade) e `athlete_id` (mantido porque é o nome usado no resto do
 * módulo de arena, e remover quebraria leitura de documento antigo).
 *
 * A lição, que vale para todo o projeto: **o nome do campo que a regra usa é
 * contrato**. Escrever um sinônimo não é estilo — é a operação inteira sendo
 * recusada em silêncio.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeCoachInput, normalizeClassInput, CLASS_STATUS,
  classSplit, classSeatsLeft, isClassOpen, DEFAULT_ARENA_COMMISSION_PCT,
} from '../domain/classes.js';
import {
  checkUnavailabilityConflict, unavailabilityConflictMessage,
} from '../domain/booking_conflict.js';

const COL_COACHES = 'arena_coaches';
const COL_CLASSES = 'arena_classes';
const COL_BOOKINGS = 'arena_class_bookings';

function str(v) { return String(v ?? '').trim(); }

/**
 * Recusa a aula quando a quadra já está comprometida naquele horário.
 *
 * Marcar aula em cima de uma reserva confirmada é criar um conflito que só
 * aparece no dia, com duas pessoas na quadra. A conferência é feita contra
 * TODAS as fontes (bloqueios gravados, dia de jogo, vaga aberta, outras
 * aulas) e contra as reservas.
 *
 * Importado dinamicamente porque `bookingService` importa este arquivo: sem
 * isso o ciclo quebra o pacote.
 */
async function recusarSeQuadraOcupada(arenaId, aula, { exceptClassId } = {}) {
  if (!aula?.court_id || !aula?.date || !aula?.start || !aula?.end) return;
  const { arenaOccupancy } = await import('./arenaOccupancy.js');
  const blocos = (await arenaOccupancy(arenaId, { exceptClassId }))
    .filter((b) => !b.court_id || b.court_id === aula.court_id);
  const { hasConflict, conflicts } = checkUnavailabilityConflict(
    [{ date: aula.date, start: aula.start, end: aula.end, court_id: aula.court_id }],
    blocos,
  );
  if (hasConflict) throw new Error(unavailabilityConflictMessage(conflicts));
}
function displayName(u, p) {
  return p?.platform_name || p?.full_name || u?.displayName || u?.email || 'Atleta';
}

/* --------------------- Coaches -------------------- */

export async function listArenaCoaches(arenaId, { onlyActive = true, lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  // `arena_id ==` + `active ==` + `orderBy(name)` exige indice composto, e
  // `arena_coaches` nao tem nenhum: a consulta falhava sempre e o catalogo de
  // professores da arena aparecia VAZIO em toda arena, desde que foi escrito.
  const snap = await getDocs(query(collection(db, COL_COACHES), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => !onlyActive || x.active !== false)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .slice(0, Math.max(1, Number(lim) || 50));
}

export async function createArenaCoach(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeCoachInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_COACHES)).id;
  await setDoc(doc(db, COL_COACHES, id), {
    id, arena_id: arenaId, ...value, rating_avg: null, rating_count: 0, sessions_given: 0, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_coach_created', actor, details: { arena_id: arenaId, name: value.name } });
  return id;
}

export async function deleteArenaCoach(coachId, actor) {
  if (!coachId) return;
  await deleteDoc(doc(db, COL_COACHES, coachId));
  await createAuditLog({ action: 'arena_coach_deleted', actor, details: { coach_id: coachId } });
}

/* --------------------- Classes -------------------- */

export async function listArenaClasses(arenaId, { onlyFuture = false, lim = 100 } = {}) {
  if (!db || !arenaId) return [];
  // Idem: tres condicoes e uma ordenacao, sem indice nenhum em
  // `arena_classes`. A agenda de aulas da arena nunca carregou.
  const snap = await getDocs(query(collection(db, COL_CLASSES), where('arena_id', '==', arenaId)));
  const hoje = new Date().toISOString().slice(0, 10);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => x.status === CLASS_STATUS.SCHEDULED)
    .filter((x) => !onlyFuture || String(x.date || '') >= hoje)
    .sort((a, b) => `${a.date || ''}${a.start || ''}`.localeCompare(`${b.date || ''}${b.start || ''}`))
    .slice(0, Math.max(1, Number(lim) || 100));
}

export async function createArenaClass(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeClassInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  await recusarSeQuadraOcupada(arenaId, value);
  const id = doc(collection(db, COL_CLASSES)).id;
  await setDoc(doc(db, COL_CLASSES, id), {
    id, arena_id: arenaId, ...value, enrolled: 0, created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_class_created', actor, details: { arena_id: arenaId, date: value.date } });
  return id;
}

/** Edita uma aula (quadra, horário, professor, preço, vagas). */
export async function updateArenaClass(classId, input, actor) {
  if (!classId) return;
  const ref = doc(db, COL_CLASSES, classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Aula não encontrada.');
  const atual = { id: snap.id, ...snap.data() };
  const { valid, errors, value } = normalizeClassInput({ ...atual, ...input });
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  // Reduzir o número de vagas abaixo de quem já se matriculou tiraria alguém
  // da aula sem avisar ninguém.
  if (value.max_students < (Number(atual.enrolled) || 0)) {
    throw new Error(`Já há ${atual.enrolled} matriculado(s): o limite não pode ser menor.`);
  }
  // A própria aula não pode conflitar consigo mesma ao ser editada.
  await recusarSeQuadraOcupada(atual.arena_id, value, { exceptClassId: classId });
  await updateDoc(ref, { ...value, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'arena_class_updated', actor,
    details: { class_id: classId, arena_id: atual.arena_id },
  });
}

/**
 * Cancela a aula e avisa quem estava matriculado.
 *
 * Cancelar em vez de apagar: as matrículas continuam existindo, e o aluno
 * precisa saber por que a aula sumiu da agenda dele. Uma aula que desaparece
 * sem aviso é o tipo de coisa que faz a pessoa não marcar de novo.
 */
export async function cancelArenaClass(classId, motivo, actor) {
  if (!classId) return;
  const ref = doc(db, COL_CLASSES, classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cls = { id: snap.id, ...snap.data() };

  await updateDoc(ref, {
    status: CLASS_STATUS.CANCELLED,
    cancel_reason: str(motivo).slice(0, 200),
    updated_at: serverTimestamp(),
  });

  const alunos = await listClassBookings(classId);
  const uids = alunos.map((b) => b.user_id || b.athlete_id).filter(Boolean);
  if (uids.length > 0) {
    try {
      await notifyUsers(uids, {
        title: 'Aula cancelada',
        message: `A aula de ${cls.date} às ${cls.start} foi cancelada${motivo ? `: ${str(motivo)}` : '.'}`,
        type: NOTIFICATION_TYPE.GENERIC,
        link: `/arenas/${cls.arena_id}/aulas`,
        actor,
      });
    } catch (err) {
      logger.info('Falha ao avisar alunos da aula cancelada', { err: err?.code });
    }
  }
  await createAuditLog({
    action: 'arena_class_cancelled', actor,
    details: { class_id: classId, arena_id: cls.arena_id, alunos: uids.length },
  });
}

export async function deleteArenaClass(classId, actor) {
  if (!classId) return;
  await deleteDoc(doc(db, COL_CLASSES, classId));
  await createAuditLog({ action: 'arena_class_deleted', actor, details: { class_id: classId } });
}

/* --------------------- Matrículas -------------------- */

/** As matrículas de UMA aula. Um `where` só: sem índice composto. */
export async function listClassBookings(classId) {
  if (!db || !classId) return [];
  const snap = await getDocs(query(collection(db, COL_BOOKINGS), where('class_id', '==', classId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** As MINHAS aulas nesta arena. */
export async function listMyClassBookings(arenaId, userId) {
  if (!db || !arenaId || !userId) return [];
  // A regra só deixa ler a própria matrícula (ou a da arena que se gere), e
  // filtrar por `user_id` no servidor exigiria índice composto com `arena_id`.
  // Um `where` só, filtro em memória.
  const snap = await getDocs(query(collection(db, COL_BOOKINGS), where('user_id', '==', userId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.arena_id === arenaId);
}

export async function bookClass(classId, user, profile, opts = {}) {
  if (!classId) throw new Error('classId obrigatório.');
  if (!user?.uid) throw new Error('Faça login.');

  const classRef = doc(db, COL_CLASSES, classId);
  const cSnap = await getDoc(classRef);
  if (!cSnap.exists()) throw new Error('Aula não encontrada.');
  const cls = { id: cSnap.id, ...cSnap.data() };

  if (!isClassOpen(cls)) throw new Error('Esta aula não está mais aberta.');
  if (classSeatsLeft(cls) <= 0) throw new Error('Aula lotada.');

  const bookingId = `${classId}_${user.uid}`;
  const jaTem = await getDoc(doc(db, COL_BOOKINGS, bookingId));
  if (jaTem.exists()) throw new Error('Você já está matriculado nesta aula.');

  // A divisão sai da CONFIGURAÇÃO do módulo, não de um 50% escrito no código
  // (que era o que estava aqui, ignorando o que a arena tinha configurado).
  const divisao = classSplit(cls.price, {
    commissionPct: Number(opts.commissionPct) || DEFAULT_ARENA_COMMISSION_PCT,
    partner: Boolean(opts.partner),
  });

  await setDoc(doc(db, COL_BOOKINGS, bookingId), {
    id: bookingId,
    class_id: classId,
    arena_id: cls.arena_id,
    coach_id: cls.coach_id || null,
    // ⚠️ `user_id` é o campo que a REGRA do Firestore confere. Sem ele a
    // matrícula é recusada — era o defeito. `athlete_id` fica por
    // compatibilidade com o resto do módulo.
    user_id: user.uid,
    athlete_id: user.uid,
    athlete_name: displayName(user, profile),
    status: 'booked',
    paid: false,
    amount: divisao.total,
    arena_amount: divisao.arena,
    coach_amount: divisao.coach,
    commission_pct: divisao.pct,
    booked_at: serverTimestamp(),
  });
  await updateDoc(classRef, { enrolled: increment(1), updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_class_booked', actor: user, details: { class_id: classId } });
  return bookingId;
}

/**
 * Desmarca a matrícula — pelo aluno ou pela arena.
 *
 * Devolve a vaga (`enrolled - 1`). Sem isto a aula ficava "lotada" para
 * sempre a cada desistência, e a arena perdia aluno por uma vaga que existia.
 */
export async function cancelClassBooking(bookingId, actor) {
  if (!bookingId) return;
  const ref = doc(db, COL_BOOKINGS, bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const b = { id: snap.id, ...snap.data() };

  await deleteDoc(ref);
  // O decremento vem DEPOIS de a matrícula sumir: se falhar, sobra uma vaga
  // ocupada por ninguém (corrigível pela arena). Na ordem inversa a mesma
  // vaga poderia ser vendida duas vezes.
  try {
    await updateDoc(doc(db, COL_CLASSES, b.class_id), {
      enrolled: increment(-1), updated_at: serverTimestamp(),
    });
  } catch (err) {
    logger.info('Falha ao devolver a vaga da aula', { err: err?.code });
  }
  await createAuditLog({
    action: 'arena_class_booking_cancelled', actor,
    details: { booking_id: bookingId, class_id: b.class_id, arena_id: b.arena_id },
  });
}

/** Marca a matrícula como paga (ou desfaz). */
export async function setClassBookingPaid(bookingId, paid, actor) {
  if (!bookingId) return;
  await updateDoc(doc(db, COL_BOOKINGS, bookingId), {
    paid: Boolean(paid), paid_at: paid ? serverTimestamp() : null, updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: paid ? 'arena_class_paid' : 'arena_class_unpaid', actor,
    details: { booking_id: bookingId },
  });
}

/* --------------------- Professor: edição -------------------- */

export async function updateArenaCoach(coachId, input, actor) {
  if (!coachId) return;
  const snap = await getDoc(doc(db, COL_COACHES, coachId));
  if (!snap.exists()) throw new Error('Professor não encontrado.');
  const { valid, errors, value } = normalizeCoachInput({ ...snap.data(), ...input });
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  await updateDoc(doc(db, COL_COACHES, coachId), { ...value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_coach_updated', actor, details: { coach_id: coachId } });
}


/* --------------------- O professor e a agenda DELE -------------------- */

/**
 * Os cadastros de professor desta pessoa, em todas as arenas.
 *
 * É o que faz o módulo cumprir o que promete ao professor ("sua agenda na
 * arena, com os alunos e o histórico no mesmo lugar"). Um `where` só, contra
 * `user_id`: sem o vínculo, isto devolve nada — e era exatamente o estado
 * anterior, em que o professor da arena era um nome solto.
 *
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
export async function listCoachProfiles(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL_COACHES), where('user_id', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * As aulas de UM professor numa arena, incluindo as passadas.
 *
 * A agenda do professor não pode esconder o que já aconteceu: é lá que estão
 * os alunos que ele atendeu e o que ele tem a receber.
 */
export async function listCoachClasses(arenaId, coachId) {
  if (!db || !arenaId || !coachId) return [];
  const snap = await getDocs(query(collection(db, COL_CLASSES), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.coach_id === coachId)
    .sort((a, b) => `${b.date || ''}${b.start || ''}`.localeCompare(`${a.date || ''}${a.start || ''}`));
}

/** Marca a aula como dada, e conta a sessão para o professor. */
export async function completeArenaClass(classId, actor) {
  if (!classId) return;
  const ref = doc(db, COL_CLASSES, classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cls = { id: snap.id, ...snap.data() };
  await updateDoc(ref, { status: CLASS_STATUS.COMPLETED, updated_at: serverTimestamp() });
  if (cls.coach_id) {
    // O contador do professor é conveniência de exibição; falhar aqui não
    // pode desfazer a aula dada.
    try {
      await updateDoc(doc(db, COL_COACHES, cls.coach_id), {
        sessions_given: increment(1), updated_at: serverTimestamp(),
      });
    } catch (err) {
      logger.info('Falha ao contar a sessão do professor', { err: err?.code });
    }
  }
  await createAuditLog({
    action: 'arena_class_completed', actor,
    details: { class_id: classId, arena_id: cls.arena_id },
  });
}
