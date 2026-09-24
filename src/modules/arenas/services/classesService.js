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
  query, where, serverTimestamp, increment, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeCoachInput, normalizeClassInput, CLASS_STATUS,
  classSplit, classSeatsLeft, isClassOpen, commissionPctFrom,
} from '../domain/classes.js';
import { ARENA_MODULE_ID, moduleStateDocId } from '../domain/modules.js';
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

export async function listArenaClasses(arenaId, { onlyFuture = false, lim = 100, includeClosed = false } = {}) {
  if (!db || !arenaId) return [];
  // Idem: tres condicoes e uma ordenacao, sem indice nenhum em
  // `arena_classes`. A agenda de aulas da arena nunca carregou.
  const snap = await getDocs(query(collection(db, COL_CLASSES), where('arena_id', '==', arenaId)));
  const hoje = new Date().toISOString().slice(0, 10);
  const lista = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    // `includeClosed` traz também as dadas e as canceladas. 🐞 Sem isso, marcar
    // a aula como "dada" a fazia SUMIR da agenda — e com ela o botão de
    // registrar o pagamento de quem esteve lá. Os calendários continuam sem
    // (só a aula de pé ocupa quadra).
    .filter((x) => includeClosed || isClassOpen(x))
    .filter((x) => !onlyFuture || String(x.date || '') >= hoje)
    .sort((a, b) => `${a.date || ''}${a.start || ''}`.localeCompare(`${b.date || ''}${b.start || ''}`));
  // O corte leva as MAIS ANTIGAS. Cortar do começo (como era) jogava fora as
  // aulas FUTURAS assim que a arena passasse de cem aulas nunca marcadas como
  // dadas — e a aula de amanhã deixava de ocupar a quadra no calendário.
  return lista.slice(-Math.max(1, Number(lim) || 100));
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
  // Trocou o professor? As matrículas levam o professor NOVO. É o `coach_id`
  // da matrícula que deixa o professor ver os alunos da aula (regra do
  // Firestore) — sem isto o novo professor abriria a aula e a veria vazia.
  if ((value.coach_id || null) !== (atual.coach_id || null)) {
    try {
      const alunos = await listClassBookings(classId, atual.arena_id);
      if (alunos.length > 0) {
        const lote = writeBatch(db);
        alunos.forEach((b) => lote.update(doc(db, COL_BOOKINGS, b.id), { coach_id: value.coach_id || null }));
        await lote.commit();
      }
    } catch (err) {
      logger.info('Falha ao levar o novo professor às matrículas', { err: err?.code });
    }
  }
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

  // Avisar é importante, mas não pode desfazer o cancelamento: se a leitura
  // falhar, a aula continua cancelada e o erro fica no log.
  const alunos = await listClassBookings(classId, cls.arena_id).catch((err) => {
    logger.info('Falha ao ler os alunos da aula cancelada', { err: err?.code });
    return [];
  });
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

/**
 * As matrículas de UMA aula — a leitura da ARENA.
 *
 * 🐞 Filtrava só por `class_id`, e a regra deixa a arena ler conferindo o
 * `arena_id` da matrícula: o Firestore só aceita uma consulta quando consegue
 * provar a regra para tudo o que ela pode devolver, e `class_id` não prova
 * nada sobre a arena. A consulta era recusada SEMPRE — a lista de alunos da
 * arena vinha vazia ("ninguém matriculado"), e cancelar a aula quebrava no
 * meio: a aula ficava cancelada e ninguém era avisado.
 *
 * Agora filtra pelos dois. Só igualdades — o Firestore junta os índices de
 * campo único sozinho, sem índice composto.
 *
 * @param {string} classId
 * @param {string} arenaId  a arena DA AULA — é o que a regra confere
 */
export async function listClassBookings(classId, arenaId) {
  if (!db || !classId || !arenaId) return [];
  const snap = await getDocs(query(
    collection(db, COL_BOOKINGS),
    where('arena_id', '==', arenaId),
    where('class_id', '==', classId),
  ));
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

/**
 * Todas as matrículas da ARENA — para as métricas (receita das aulas).
 *
 * Por `arena_id`: é o campo que a regra confere para a arena ler.
 */
export async function listArenaClassBookings(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_BOOKINGS), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * As matrículas de UM professor (todas as aulas em que ele é o professor).
 *
 * A consulta TEM de filtrar por `coach_id`: a regra deixa o professor ler a
 * matrícula conferindo o cadastro apontado por `coach_id`, e o Firestore só
 * aceita uma consulta quando consegue provar a regra para tudo o que ela pode
 * devolver — filtrar por `class_id` não prova nada sobre o professor.
 */
export async function listCoachClassBookings(coachId) {
  if (!db || !coachId) return [];
  const snap = await getDocs(query(collection(db, COL_BOOKINGS), where('coach_id', '==', coachId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const TETO_MINHAS = 80;
const unicos = (xs) => [...new Set(xs.filter(Boolean))];

async function lerVarios(colecao, ids) {
  const docs = await Promise.all(ids.map((id) => getDoc(doc(db, colecao, id)).catch(() => null)));
  return docs.filter((d) => d?.exists?.()).map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * As matrículas da pessoa em TODAS as arenas, com a aula e a arena de cada
 * uma — para "Minhas aulas".
 *
 * A matrícula não guarda data nem horário (moram na aula). As mais recentes
 * primeiro, até 80: quem tem mais que isso quer ver as próximas, não as de
 * dois anos atrás.
 *
 * @returns {Promise<{ bookings: Array, aulas: Array, arenas: Array }>}
 */
export async function listMyClassEnrollments(userId) {
  if (!db || !userId) return { bookings: [], aulas: [], arenas: [] };
  const snap = await getDocs(query(collection(db, COL_BOOKINGS), where('user_id', '==', userId)));
  const bookings = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (Number(b.booked_at?.seconds) || 0) - (Number(a.booked_at?.seconds) || 0))
    .slice(0, TETO_MINHAS);
  const aulas = await lerVarios(COL_CLASSES, unicos(bookings.map((b) => b.class_id)));
  const arenas = await lerVarios('arenas', unicos(aulas.map((a) => a.arena_id)));
  return { bookings, aulas, arenas };
}

/**
 * As aulas que a pessoa DÁ, em todas as arenas em que é professora — para a
 * agenda do professor (`/aulas`).
 *
 * @returns {Promise<{ perfis: Array, aulasPorPerfil: Object<string, Array>, arenas: Array }>}
 */
export async function listMyTaughtClasses(userId) {
  if (!db || !userId) return { perfis: [], aulasPorPerfil: {}, arenas: [] };
  const perfis = (await listCoachProfiles(userId)).filter((p) => p.active !== false);
  const aulasPorPerfil = {};
  await Promise.all(perfis.map(async (p) => {
    aulasPorPerfil[p.id] = await listCoachClasses(p.arena_id, p.id).catch(() => []);
  }));
  const arenas = await lerVarios('arenas', unicos(perfis.map((p) => p.arena_id)));
  return { perfis, aulasPorPerfil, arenas };
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

  // A divisão é decidida AQUI, com o que está no banco — não com o que a tela
  // mandou. 🐞 A tela mandava `partner: true` fixo: o professor da CASA pagava
  // comissão à própria arena. Agora quem diz se o professor é parceiro é o
  // cadastro dele, e o percentual vem da configuração do módulo (zero
  // inclusive — `|| 20` transformava "sem comissão" em 20%).
  const [coachSnap, configSnap] = await Promise.all([
    cls.coach_id ? getDoc(doc(db, COL_COACHES, cls.coach_id)) : Promise.resolve(null),
    getDoc(doc(db, 'arena_module_states', moduleStateDocId(cls.arena_id, ARENA_MODULE_ID.CLASSES_MARKETPLACE)))
      .catch(() => null),
  ]);
  const partner = Boolean(coachSnap?.exists?.() && coachSnap.data()?.partner);
  const commissionPct = commissionPctFrom(configSnap?.exists?.() ? configSnap.data()?.config : opts.config);
  const divisao = classSplit(cls.price, { commissionPct, partner });

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
