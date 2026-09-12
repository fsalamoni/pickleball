/**
 * DIA DE JOGO DA ARENA — I/O.
 *
 * Nenhuma coleção nova. Um dia de jogo de arena é um documento de `game_days`
 * com `arena_id` (ver `domain/arenaGameDay.js` para o porquê), e por isso todo
 * o resto — participantes, sorteio, fila do Play, placar, ranking do dia,
 * telão, publicação no ranking da plataforma — já funciona sem uma linha nova.
 *
 * O que este arquivo acrescenta é o que só existe na arena:
 *
 *  1. **fechar a quadra no calendário.** Um dia de jogo grava uma
 *     `arena_unavailabilities` por quadra/faixa, marcada com
 *     `source: 'game_day'`. A partir daí, conflito de reserva, status de slot
 *     e calendário mensal já respeitam — não foi preciso ensinar nada a eles;
 *  2. **conferir choque de horário** contra as reservas existentes e contra os
 *     outros dias de jogo da arena (dois dias na mesma quadra e no mesmo dia
 *     podem coexistir, desde que em horários diferentes);
 *  3. **inscrição do atleta**, no dia ou na quadra, respeitando o teto.
 *
 * ## Quem cria não vira jogador
 *
 * Diferente do dia de jogo do atleta, quem cria aqui é a ARENA: o gestor que
 * clicou não entra como participante. Ele entra na lista se quiser jogar, pelo
 * mesmo botão de todo mundo.
 *
 * ## O teto de vagas
 *
 * Conferido no domínio e RECONFERIDO aqui, lendo a lista no instante da
 * inscrição. Isso fecha o uso normal e o clique repetido; não é barreira de
 * segurança (a regra não conta documentos de subcoleção). Ver o cabeçalho do
 * domínio.
 */

import {
  collection, doc, getDocs, setDoc, updateDoc,
  query, where, serverTimestamp, writeBatch, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { ARENA_COLLECTIONS } from '@/modules/arenas/domain/constants';
import { checkBookingConflict } from '@/modules/arenas/domain/booking_conflict';
import { GAME_DAY_STATUS, GD_PARTICIPANT_SOURCE, GAME_DAY_VISIBILITY } from '../domain/gameDay.js';
import {
  normalizeArenaGameDayInput, findGameDayOverlaps, slotsAsBookingCandidates,
  unavailabilityPayloadsFor, canSignUpToArenaGameDay, arenaGameDaySlots,
} from '../domain/arenaGameDay.js';
import {
  getGameDay, listGameDayParticipants, addGameDayParticipant,
  removeGameDayParticipant, deleteGameDay,
} from './gameDayService.js';

const COL = 'game_days';
const SUB_PARTICIPANTS = 'participants';
const COL_UNAV = ARENA_COLLECTIONS.unavailabilities;

function nomeDe(user, profile) {
  return profile?.platform_name || profile?.full_name || user?.displayName || user?.email || 'Atleta';
}

/* ------------------------------------------------- bloqueio de quadra -- */

/** As indisponibilidades já gravadas por ESTE dia de jogo. */
async function blocosDoDiaDeJogo(gameDayId) {
  if (!db || !gameDayId) return [];
  const snap = await getDocs(query(collection(db, COL_UNAV), where('game_day_id', '==', gameDayId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Deixa o calendário exatamente com os bloqueios que este dia de jogo precisa:
 * apaga os antigos e grava os novos. Chamado na criação, na edição (a arena
 * pode trocar quadra e horário) e no arquivamento (que libera tudo).
 *
 * Só mexe em documentos marcados com `game_day_id` — um bloqueio que a arena
 * criou à mão nunca é tocado.
 */
export async function syncArenaGameDayBlocks(gameDay, { remover = false } = {}) {
  if (!db || !gameDay?.id) return;
  const atuais = await blocosDoDiaDeJogo(gameDay.id);
  const desejados = remover ? [] : unavailabilityPayloadsFor(gameDay);

  const batch = writeBatch(db);
  atuais.forEach((b) => batch.delete(doc(db, COL_UNAV, b.id)));
  desejados.forEach((payload) => {
    const ref = doc(collection(db, COL_UNAV));
    batch.set(ref, { ...payload, created_at: serverTimestamp(), updated_at: serverTimestamp() });
  });
  await batch.commit();
}

/* -------------------------------------------------------------- CRUD -- */

/** Os dias de jogo de uma arena (sem os arquivados, salvo pedido contrário). */
export async function listArenaGameDays(arenaId, { includeArchived = false } = {}) {
  if (!db || !arenaId) return [];
  // Um `where` só: sem índice composto, como no resto do projeto. A ordenação
  // por data é feita em memória.
  const snap = await getDocs(query(collection(db, COL), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((g) => includeArchived || g.status !== GAME_DAY_STATUS.ARCHIVED)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))
      || Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0));
}

/**
 * Confere se as quadras/horários pedidos estão livres.
 *
 * @returns {{ ok: boolean, message: string|null }}
 */
export async function checkArenaGameDaySlots(arenaId, value, { ignoreId = null, bookings = null } = {}) {
  const outros = await listArenaGameDays(arenaId);
  const choques = findGameDayOverlaps(
    { date: value.date, slots: value.arena_slots }, outros, { ignoreId },
  );
  if (choques.length > 0) {
    const c = choques[0];
    return {
      ok: false,
      message: `A ${c.court_name || 'quadra'} já está ocupada nesse horário pelo dia de jogo "${c.title}" (${c.start_time}–${c.end_time}).`,
    };
  }

  // Contra as RESERVAS: a lista vem de quem chama (a tela já tem as reservas
  // carregadas). Sem ela, esta conferência é pulada — o bloqueio gravado
  // impede reservas NOVAS de qualquer jeito.
  if (Array.isArray(bookings)) {
    const { hasConflict, conflicts } = checkBookingConflict(
      slotsAsBookingCandidates({ date: value.date, slots: value.arena_slots }), bookings,
    );
    if (hasConflict) {
      const c = conflicts[0];
      return {
        ok: false,
        message: `Já existe uma reserva nessa quadra das ${c.conflict_with.start} às ${c.conflict_with.end}. Cancele a reserva ou escolha outro horário.`,
      };
    }
  }
  return { ok: true, message: null };
}

/**
 * Cria o dia de jogo da arena e fecha as quadras no calendário.
 *
 * @param {string} arenaId
 * @param {object} input o que a arena preencheu
 * @param {object} actor usuário autenticado (gestor da arena)
 * @param {{ arena?: object, courts?: Array, bookings?: Array }} [ctx]
 * @returns {Promise<{ id: string }>}
 */
export async function createArenaGameDay(arenaId, input, actor, { arena = null, courts = [], bookings = null } = {}) {
  if (!actor?.uid) throw new Error('É preciso estar autenticado.');
  if (!arenaId) throw new Error('Arena inválida.');

  const { valid, errors, value } = normalizeArenaGameDayInput(input, { courts });
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');

  const livre = await checkArenaGameDaySlots(arenaId, value, { bookings });
  if (!livre.ok) throw new Error(livre.message);

  const id = doc(collection(db, COL)).id;
  const payload = {
    id,
    ...value,
    // --- o que faz dele um dia de jogo de ARENA ---
    arena_id: arenaId,
    arena_name: arena?.name || null,
    arena_city: arena?.city || null,
    arena_state: arena?.state || null,
    // Público para que o atleta ENXERGUE e possa marcar presença. Diferente do
    // dia de jogo do atleta, não publica convite em "Procura-se jogo": o canal
    // desta aqui é a página e o calendário da arena.
    visibility: GAME_DAY_VISIBILITY.PUBLIC,
    open_game_id: null,
    // Quem cria é a ARENA: o gestor não entra como jogador.
    created_by: actor.uid,
    creator_name: arena?.name || null,
    creator_photo: arena?.photo_url || null,
    member_uids: [actor.uid],
    invited_uids: [],
    admin_uids: [],
    // O Play usa esta contagem para saber quantas quadras rodam ao mesmo tempo.
    play_courts: Math.max(1, value.arena_slots.length),
    status: GAME_DAY_STATUS.ACTIVE,
    publish_to_ranking: false,
    published_count: 0,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload);
  await syncArenaGameDayBlocks({ ...payload, id });

  await createAuditLog({
    action: 'arena_game_day_created',
    actor,
    details: { arena_id: arenaId, game_day_id: id, date: value.date, courts: value.arena_slots.length },
  });
  return { id };
}

/** Edita o dia de jogo da arena e reajusta os bloqueios do calendário. */
export async function updateArenaGameDay(gameDayId, input, actor, { courts = [], bookings = null } = {}) {
  const atual = await getGameDay(gameDayId);
  if (!atual?.arena_id) throw new Error('Dia de jogo de arena não encontrado.');

  const { valid, errors, value } = normalizeArenaGameDayInput({ ...atual, ...input }, { courts });
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');

  const livre = await checkArenaGameDaySlots(atual.arena_id, value, { ignoreId: gameDayId, bookings });
  if (!livre.ok) throw new Error(livre.message);

  await updateDoc(doc(db, COL, gameDayId), {
    ...value,
    play_courts: Math.max(1, value.arena_slots.length),
    updated_at: serverTimestamp(),
  });
  await syncArenaGameDayBlocks({ ...atual, ...value, id: gameDayId });

  await createAuditLog({
    action: 'arena_game_day_updated',
    actor,
    details: { arena_id: atual.arena_id, game_day_id: gameDayId },
  });
}

/**
 * Arquiva o dia de jogo e LIBERA as quadras no calendário.
 *
 * Reusa `deleteGameDay` (que já tira o convite público e os resultados do
 * ranking) e acrescenta só o que é da arena.
 */
export async function archiveArenaGameDay(gameDayId, actor) {
  const atual = await getGameDay(gameDayId);
  if (!atual?.arena_id) throw new Error('Dia de jogo de arena não encontrado.');
  await deleteGameDay(gameDayId, actor);
  await syncArenaGameDayBlocks({ ...atual, id: gameDayId }, { remover: true });
  await createAuditLog({
    action: 'arena_game_day_archived',
    actor,
    details: { arena_id: atual.arena_id, game_day_id: gameDayId },
  });
}

/* -------------------------------------------------------- inscrição -- */

/**
 * Marca presença no dia de jogo da arena.
 *
 * Relê a lista de participantes ANTES de gravar: a tela pode estar com um
 * número velho na mão, e o teto tem de valer sobre o que existe agora.
 */
export async function signUpToArenaGameDay(gameDay, user, profile, { courtId = null } = {}) {
  if (!user?.uid) throw new Error('Entre na sua conta para marcar presença.');
  if (!gameDay?.id) throw new Error('Dia de jogo inválido.');

  const atual = await getGameDay(gameDay.id);
  if (!atual) throw new Error('Dia de jogo não encontrado.');
  const participants = await listGameDayParticipants(gameDay.id);

  const pode = canSignUpToArenaGameDay({
    gameDay: atual, participants, uid: user.uid, courtId,
  });
  if (!pode.ok) throw new Error(pode.message || 'Não foi possível marcar presença.');

  const name = nomeDe(user, profile);
  await addGameDayParticipant(gameDay.id, {
    user_id: user.uid,
    name,
    photo_url: profile?.photo_url || user?.photoURL || null,
    source: GD_PARTICIPANT_SOURCE.JOINED,
    play_level: profile?.level || profile?.leveling_level || null,
    play_gender: profile?.gender || null,
    arena_court_id: courtId || null,
  }, user);

  if (atual.created_by && atual.created_by !== user.uid) {
    notifyUsers([atual.created_by], {
      title: 'Nova presença no dia de jogo',
      message: `${name} marcou presença em "${atual.title}".`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${atual.arena_id}/gerir/dia-de-jogo/${atual.id}`,
      actor: { uid: user.uid, displayName: name },
    });
  }
  await createAuditLog({
    action: 'arena_game_day_signed_up',
    actor: user,
    details: { arena_id: atual.arena_id, game_day_id: atual.id, court_id: courtId || null },
  });
}

/** Desmarca presença: tira o participante e a associação ao dia de jogo. */
export async function leaveArenaGameDay(gameDayId, uid, actor) {
  if (!gameDayId || !uid) return;
  const participants = await listGameDayParticipants(gameDayId);
  const meu = participants.find((p) => p.user_id === uid);
  if (!meu) return;
  await removeGameDayParticipant(gameDayId, meu.id, actor || { uid });
  // `removeGameDayParticipant` recalcula os membros a partir da lista; o
  // arrayRemove é a garantia de que quem saiu perde o acesso mesmo se a
  // recontagem tiver visto uma lista antiga.
  await updateDoc(doc(db, COL, gameDayId), {
    member_uids: arrayRemove(uid),
    updated_at: serverTimestamp(),
  }).catch(() => {});
  await createAuditLog({
    action: 'arena_game_day_left',
    actor: actor || { uid },
    details: { game_day_id: gameDayId },
  });
}

/** Troca a quadra de um inscrito (modo "por quadra"). */
export async function setArenaParticipantCourt(gameDayId, participantId, courtId) {
  if (!gameDayId || !participantId) return;
  await updateDoc(doc(db, COL, gameDayId, SUB_PARTICIPANTS, participantId), {
    arena_court_id: courtId || null,
    updated_at: serverTimestamp(),
  });
}

/**
 * Os dias de jogo de arena que tocam um intervalo de datas — o que o
 * calendário do atleta precisa para marcar os dias.
 */
export async function listArenaGameDaysInRange(arenaId, { from = null, to = null } = {}) {
  const todos = await listArenaGameDays(arenaId);
  return todos.filter((g) => {
    if (!g.date) return false;
    if (from && g.date < from) return false;
    if (to && g.date > to) return false;
    return true;
  });
}

/** Um dia de jogo de arena pelo id (com as quadras já normalizadas). */
export async function getArenaGameDay(gameDayId) {
  const gd = await getGameDay(gameDayId);
  if (!gd?.arena_id) return null;
  return { ...gd, arena_slots: arenaGameDaySlots(gd) };
}

/** Existe bloqueio órfão? (usado só pelo diagnóstico do admin) */
export async function listBlocksOfArenaGameDay(gameDayId) {
  return blocosDoDiaDeJogo(gameDayId);
}
