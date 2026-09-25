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
import { openSlotConflict } from '../domain/openMatch.js';
import { formatSlotLabel } from '../domain/calendar.js';
import { getNextInLine, WAITLIST_STATUS, compactPositions, computePromotionExpiresAt, DEFAULT_PROMOTION_WINDOW_MINUTES } from '../domain/waitlist.js';
import { getArena, listArenaManagerIds } from './arenaService.js';
import { fetchUnifiedLevelValues } from '@/modules/rating/services/unifiedLevelService.js';
import { checkBookingConflict } from '../domain/booking_conflict.js';
import {
  normalizeOpenMatchInput, isLinkedOpenSlot, canJoinLinkedGameDay, OPEN_MATCH_GAME_FORMATS,
} from '../domain/openMatchGameDay.js';
import {
  normalizeArenaGameDayInput, slotsAsBookingCandidates,
} from '@/modules/games/domain/arenaGameDay.js';
import { GD_PARTICIPANT_SOURCE } from '@/modules/games/domain/gameDay.js';
import {
  getGameDay, listGameDayParticipants, listGameDayGames, buildGameDayParticipant,
  sealParticipantBeforeRemoval,
} from '@/modules/games/services/gameDayService.js';
import {
  buildArenaGameDayPayload, syncArenaGameDayBlocks, archiveArenaGameDay,
} from '@/modules/games/services/arenaGameDayService.js';

const COL = 'arena_open_slots';
const COL_GAME_DAYS = 'game_days';

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
async function ocupacaoDaArena(arenaId, { exceptSlotId, exceptGameDayId } = {}) {
  // Importação dinâmica: `arenaOccupancy` lê as vagas abertas deste mesmo
  // arquivo, e o ciclo estático quebraria o pacote.
  const { arenaOccupancy } = await import('./arenaOccupancy.js');
  return arenaOccupancy(arenaId, { exceptSlotId, exceptGameDayId });
}

/** Recusa a vaga quando ela cai em cima de algo já marcado, dizendo o quê. */
async function recusarSeQuadraOcupada(arenaId, vaga, { exceptSlotId, exceptGameDayId } = {}) {
  if (!vaga?.court_id && !(vaga?.court_ids || []).length) return;
  const blocos = await ocupacaoDaArena(arenaId, { exceptSlotId, exceptGameDayId });
  const { hasConflict, reason } = openSlotConflict(vaga, blocos, []);
  if (hasConflict) throw new Error(reason);
}

/**
 * Confere contra as RESERVAS que a tela já tem carregadas (as mesmas que o
 * diálogo do dia de jogo usa). Sem a lista, a conferência é pulada — como no
 * dia de jogo: o bloqueio gravado impede reservas NOVAS de qualquer jeito.
 */
function recusarSeHaReserva(gameDayValue, bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) return;
  const { hasConflict, conflicts } = checkBookingConflict(
    slotsAsBookingCandidates({ date: gameDayValue.date, slots: gameDayValue.arena_slots }), bookings,
  );
  if (hasConflict) {
    const c = conflicts[0];
    throw new Error(`Já existe uma reserva nessa quadra das ${c.conflict_with.start} às ${c.conflict_with.end}. Cancele a reserva ou escolha outro horário.`);
  }
}

/* ------------------------------------------------------------------ */
/*  O JOGO ABERTO QUE É UM DIA DE JOGO (Onda CA)                        */
/* ------------------------------------------------------------------ */

/**
 * Publica um jogo aberto E o dia de jogo dele, num lote só.
 *
 * Os dois documentos nascem juntos ou nenhum nasce: uma vitrine sem jogo por
 * trás (ou um dia de jogo órfão, sem vitrine) é justamente o estado que a
 * tela não tem como explicar. Depois do lote, o dia de jogo fecha as quadras
 * no calendário (`syncArenaGameDayBlocks`) — e se essa cópia falhar, o
 * bloqueio DERIVADO do dia de jogo (`gameDayBlocks`) segue valendo.
 *
 * @param {string} arenaId
 * @param {object} input o formulário da Central (vitrine + como se joga)
 * @param {object} actor
 * @param {{ courts?: Array, formats?: string[], bookings?: Array }} [ctx]
 * @returns {Promise<{ slotId: string, gameDayId: string }>}
 */
export async function createOpenMatch(arenaId, input, actor, { courts = [], formats = OPEN_MATCH_GAME_FORMATS, bookings = null } = {}) {
  if (!arenaId) throw new Error('arenaId é obrigatório.');
  if (!actor?.uid) throw new Error('Usuário não autenticado.');

  const norm = normalizeOpenMatchInput(input, { courts, formats });
  if (!norm.valid) throw new Error(Object.values(norm.errors)[0] || 'Dados inválidos.');
  const dia = normalizeArenaGameDayInput(norm.gameDay, { courts });
  if (!dia.valid) throw new Error(Object.values(dia.errors)[0] || 'Dados inválidos.');

  const arena = await getArena(arenaId);
  if (!arena) throw new Error('Arena não encontrada.');

  await recusarSeQuadraOcupada(arenaId, norm.slot);
  recusarSeHaReserva(dia.value, bookings);

  const slotId = doc(collection(db, COL)).id;
  const gameDayId = doc(collection(db, COL_GAME_DAYS)).id;
  const gameDay = buildArenaGameDayPayload({
    id: gameDayId, value: dia.value, arenaId, arena, actor, extra: { open_slot_id: slotId },
  });
  const slot = {
    id: slotId,
    arena_id: arenaId,
    arena_name: arena.name || '',
    ...norm.slot,
    game_day_id: gameDayId,
    game_format: dia.value.format,
    filled_spots: 0,
    participants: [],
    status: OPEN_SLOT_STATUS.OPEN,
    created_by: actor.uid,
    created_by_name: displayName(actor, actor.profile),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, COL_GAME_DAYS, gameDayId), gameDay);
  batch.set(doc(db, COL, slotId), slot);
  await batch.commit();

  try {
    await syncArenaGameDayBlocks(gameDay);
  } catch (err) {
    // O bloqueio DERIVADO do dia de jogo continua valendo nas telas.
    logger.info('open_match_blocks_sync_failed', { slotId, gameDayId, err: err?.code });
  }

  await createAuditLog({
    action: 'open_slot_created',
    actor,
    details: {
      arena_id: arenaId, slot_id: slotId, game_day_id: gameDayId,
      date: norm.slot.date, start: norm.slot.start, format: dia.value.format,
    },
  });
  logger.info('open_match_created', { slotId, gameDayId, arenaId });
  return { slotId, gameDayId };
}

/**
 * Edita um jogo aberto ligado: vitrine e dia de jogo no mesmo lote.
 *
 * Duas travas, as mesmas que a tela explica:
 *  - **vagas abaixo de quem já entrou** não: tirar alguém é uma decisão sobre
 *    uma pessoa, não um efeito colateral de mudar um número;
 *  - **o formato não muda depois que há partida**: o Play não guarda placar e
 *    Mexicano/Rei da Quadra derivam as rodadas do que já aconteceu — trocar
 *    depois não é edição, é perda.
 */
export async function updateOpenMatch(slotId, input, actor, { courts = [], formats = OPEN_MATCH_GAME_FORMATS, bookings = null } = {}) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  const atual = await getOpenSlot(slotId);
  if (!atual) throw new Error('Jogo aberto não encontrado.');
  if (!isLinkedOpenSlot(atual)) return updateOpenSlot(slotId, input, actor);

  const gameDayId = atual.game_day_id;
  const gdAtual = await getGameDay(gameDayId);
  if (!gdAtual) throw new Error('O dia de jogo deste jogo aberto não foi encontrado.');

  // O formato que o dia JÁ tem vale mesmo com a flag desligada: desligar uma
  // flag tira a opção de CRIAR, nunca pode travar uma edição.
  const formatosValidos = formats.includes(gdAtual.format) ? formats : [...formats, gdAtual.format];
  const norm = normalizeOpenMatchInput(input, { courts, formats: formatosValidos });
  if (!norm.valid) throw new Error(Object.values(norm.errors)[0] || 'Dados inválidos.');
  const dia = normalizeArenaGameDayInput(norm.gameDay, { courts });
  if (!dia.valid) throw new Error(Object.values(dia.errors)[0] || 'Dados inválidos.');

  const participants = await listGameDayParticipants(gameDayId);
  const inscritos = Math.max((atual.participants || []).length, participants.length);
  if (norm.slot.total_spots < inscritos) {
    throw new Error(`Já há ${inscritos} inscrito(s). Para diminuir as vagas, tire alguém da lista antes.`);
  }
  if (dia.value.format !== gdAtual.format) {
    const jogos = await listGameDayGames(gameDayId);
    if (jogos.length > 0) {
      throw new Error('O jogo já tem partidas — o formato não muda mais. Encerre e publique outro jogo aberto, se preciso.');
    }
  }

  await recusarSeQuadraOcupada(atual.arena_id, norm.slot, { exceptSlotId: slotId, exceptGameDayId: gameDayId });
  recusarSeHaReserva(dia.value, bookings);

  const uids = atual.participants || [];
  const statusVitrine = ['open', 'full'].includes(atual.status || 'open')
    ? (Math.max(uids.length, participants.length) >= norm.slot.total_spots ? OPEN_SLOT_STATUS.FULL : OPEN_SLOT_STATUS.OPEN)
    : atual.status;

  const batch = writeBatch(db);
  batch.update(doc(db, COL, slotId), {
    ...norm.slot,
    game_format: dia.value.format,
    status: statusVitrine,
    updated_at: serverTimestamp(),
  });
  batch.update(doc(db, COL_GAME_DAYS, gameDayId), {
    title: dia.value.title,
    date: dia.value.date,
    notes: dia.value.notes,
    format: dia.value.format,
    manage_mode: dia.value.manage_mode,
    signup_mode: dia.value.signup_mode,
    capacity: dia.value.capacity,
    arena_slots: dia.value.arena_slots,
    play_courts: Math.max(1, dia.value.arena_slots.length),
    updated_at: serverTimestamp(),
  });
  await batch.commit();

  try {
    await syncArenaGameDayBlocks({ ...gdAtual, ...dia.value, id: gameDayId });
  } catch (err) {
    logger.info('open_match_blocks_sync_failed', { slotId, gameDayId, err: err?.code });
  }
  await createAuditLog({
    action: 'open_slot_updated',
    actor,
    details: { slot_id: slotId, game_day_id: gameDayId },
  });
  return { slotId, gameDayId };
}

/**
 * Transforma um jogo aberto ANTIGO (publicado antes da Onda CA, sem dia de
 * jogo) num jogo aberto com dia de jogo — por escolha da arena, um de cada vez.
 *
 * Nada é migrado em lote: quem publicou antes decide, e os inscritos entram no
 * dia de jogo como participantes (a arena pode inserir terceiros).
 */
export async function linkOpenSlotToGameDay(slotId, input, actor, { courts = [], formats = OPEN_MATCH_GAME_FORMATS, names = {} } = {}) {
  const atual = await getOpenSlot(slotId);
  if (!atual) throw new Error('Jogo aberto não encontrado.');
  if (isLinkedOpenSlot(atual)) return { slotId, gameDayId: atual.game_day_id };
  if (!['open', 'full'].includes(atual.status || 'open')) throw new Error('Este jogo aberto já foi encerrado.');

  const norm = normalizeOpenMatchInput({
    date: atual.date, start: atual.start, end: atual.end, total_spots: atual.total_spots,
    format: atual.format, min_level: atual.min_level, max_level: atual.max_level, price: atual.price,
    notes: atual.notes, court_ids: atual.court_id ? [atual.court_id] : [],
    ...input,
  }, { courts, formats });
  if (!norm.valid) throw new Error(Object.values(norm.errors)[0] || 'Dados inválidos.');
  const dia = normalizeArenaGameDayInput(norm.gameDay, { courts });
  if (!dia.valid) throw new Error(Object.values(dia.errors)[0] || 'Dados inválidos.');

  const arena = await getArena(atual.arena_id);
  const gameDayId = doc(collection(db, COL_GAME_DAYS)).id;
  const uids = atual.participants || [];
  const gameDay = buildArenaGameDayPayload({
    id: gameDayId, value: dia.value, arenaId: atual.arena_id, arena, actor,
    extra: { open_slot_id: slotId, member_uids: Array.from(new Set([actor.uid, ...uids])) },
  });

  const batch = writeBatch(db);
  batch.set(doc(db, COL_GAME_DAYS, gameDayId), gameDay);
  uids.forEach((uid) => {
    const pid = doc(collection(db, COL_GAME_DAYS, gameDayId, 'participants')).id;
    batch.set(doc(db, COL_GAME_DAYS, gameDayId, 'participants', pid), buildGameDayParticipant(pid, {
      user_id: uid,
      name: names[uid] || 'Atleta',
      source: GD_PARTICIPANT_SOURCE.JOINED,
    }));
  });
  batch.update(doc(db, COL, slotId), {
    game_day_id: gameDayId,
    game_format: dia.value.format,
    court_ids: norm.slot.court_ids,
    updated_at: serverTimestamp(),
  });
  await batch.commit();

  try {
    await syncArenaGameDayBlocks(gameDay);
  } catch (err) {
    logger.info('open_match_blocks_sync_failed', { slotId, gameDayId, err: err?.code });
  }
  await createAuditLog({
    action: 'open_slot_linked_to_game_day',
    actor,
    details: { slot_id: slotId, game_day_id: gameDayId, participants: uids.length },
  });
  return { slotId, gameDayId };
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
  const atual = await getOpenSlot(slotId);
  await updateDoc(doc(db, COL, slotId), {
    status: OPEN_SLOT_STATUS.CANCELLED,
    cancellation_reason: str(reason).slice(0, 200),
    cancelled_by: actor?.uid,
    cancelled_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  // O dia de jogo vai junto: libera as quadras no calendário (Onda CA).
  if (isLinkedOpenSlot(atual)) {
    try {
      const gd = await getGameDay(atual.game_day_id);
      if (gd && gd.status !== 'archived') {
        await archiveArenaGameDay(atual.game_day_id, actor, { fromOpenSlot: true });
      }
    } catch (err) {
      logger.info('open_match_game_day_archive_failed', { slotId, err: err?.code });
    }
  }
  // 🐞 O diálogo dizia "serão avisados" e ninguém era avisado: quem estava
  // dentro só descobria na porta da arena.
  const avisar = (atual?.participants || []).filter((uid) => uid && uid !== actor?.uid);
  if (avisar.length > 0) {
    try {
      notifyUsers(avisar, {
        title: 'Jogo aberto cancelado',
        message: `O jogo de ${formatSlotLabel(atual)}${atual.arena_name ? ` em ${str(atual.arena_name).slice(0, 50)}` : ''} foi cancelado pela arena.`,
        type: NOTIFICATION_TYPE.GENERIC,
        link: atual.arena_id ? `/arenas/${atual.arena_id}#arena-jogos-abertos` : '/arenas',
        actor: actor?.uid ? { uid: actor.uid } : undefined,
      });
    } catch (err) {
      logger.info('Falha ao avisar cancelamento (não crítico)', { err: err?.code });
    }
  }
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
 * Os jogos abertos em que a pessoa está, de TODAS as arenas (Minhas reservas).
 *
 * `array-contains` num campo só: o Firestore resolve com o índice de campo
 * único, sem índice composto. A vaga é de leitura pública, então a regra não
 * pede filtro nenhum além deste.
 */
export async function listMyOpenSlots(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL), where('participants', 'array-contains', userId)));
  return ordenarPorDataHora(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

  if (isLinkedOpenSlot(slot)) {
    await entrarNoJogoLigado(slot, user, profile);
  } else {
    await entrarSoNaVaga(slot, user);
  }

  // Notifica a arena
  try {
    // 🐞 Era `listArenaManagers` — documentos, não uids: o aviso ia para
    // "[object Object]" e a arena nunca sabia de quem entrou.
    const managerIds = await listArenaManagerIds(slot.arena_id);
    notifyUsers(managerIds, {
      title: `Novo inscrito em "${str(slot.arena_name).slice(0, 50)}"`,
      message: `${displayName(user, profile)} entrou no jogo aberto de ${formatSlotLabel(slot)}`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${slot.arena_id}/gerir?aba=jogo-aberto`,
      actor: { uid: user.uid, displayName: displayName(user, profile) },
    });
  } catch (err) {
    logger.info('Falha ao notificar arena (não crítico)', { err: err?.code });
  }

  await createAuditLog({
    action: 'open_slot_joined',
    actor: user,
    details: { slot_id: slotId, arena_id: slot.arena_id, game_day_id: slot.game_day_id || null },
  });
}

/** A vaga antiga, sem dia de jogo: só a lista da vaga. */
async function entrarSoNaVaga(slot, user) {
  const ref = doc(db, COL, slot.id);
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
}

/**
 * Entrar num jogo aberto que é um dia de jogo: a vaga E o dia de jogo, no
 * MESMO lote (tudo ou nada). Lista que diverge não dá erro, dá a arena vendo
 * 4 inscritos numa tela e 3 na outra.
 *
 * As três escritas passam, cada uma, pela regra de "só a si mesmo" que já
 * existia: a vaga (acrescentar o próprio uid), o participante (`user_id` =
 * quem entra, num dia de jogo público) e a lista de membros (a antiga MAIS
 * quem pede). Nenhuma regra nova.
 */
async function entrarNoJogoLigado(slot, user, profile) {
  const gdId = slot.game_day_id;
  const [gameDay, participants] = await Promise.all([getGameDay(gdId), listGameDayParticipants(gdId)]);
  const pode = canJoinLinkedGameDay({ slot, gameDay, participants, uid: user.uid });
  if (!pode.ok) throw new Error(pode.reason);

  const novos = [...(slot.participants || []), user.uid];
  const batch = writeBatch(db);
  batch.update(doc(db, COL, slot.id), {
    participants: arrayUnion(user.uid),
    filled_spots: novos.length,
    status: novos.length >= (slot.total_spots || 0) ? OPEN_SLOT_STATUS.FULL : OPEN_SLOT_STATUS.OPEN,
    updated_at: serverTimestamp(),
  });
  const jaNoDia = participants.some((p) => p.user_id === user.uid);
  if (!jaNoDia) {
    const pid = doc(collection(db, COL_GAME_DAYS, gdId, 'participants')).id;
    batch.set(doc(db, COL_GAME_DAYS, gdId, 'participants', pid), buildGameDayParticipant(pid, {
      user_id: user.uid,
      name: displayName(user, profile),
      photo_url: profile?.photo_url || user?.photoURL || null,
      source: GD_PARTICIPANT_SOURCE.JOINED,
      play_level: profile?.level || profile?.leveling_level || null,
      play_gender: profile?.gender || null,
    }));
    batch.update(doc(db, COL_GAME_DAYS, gdId), {
      member_uids: arrayUnion(user.uid),
      updated_at: serverTimestamp(),
    });
  }
  await batch.commit();
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

  if (isLinkedOpenSlot(slot)) {
    const saiu = await sairDoJogoLigado(slot, userId, wasInSlot);
    if (!saiu) return;
  } else {
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
  }

  // 🐞 A fila de espera existia e NUNCA era chamada: alguém saía, a vaga
  // abria, e quem estava na fila não ficava sabendo. Chamar o próximo é
  // escrita na entrada de OUTRA pessoa — o navegador de quem sai não pode
  // fazê-la (a regra recusa). Quem chama é o SERVIDOR: o gatilho
  // `promoteOpenSlotWaitlistOnSlot` roda na hora em que esta saída é gravada
  // e, se a vaga lotada passou a ter lugar, chama o próximo.

  await createAuditLog({
    action: 'open_slot_left',
    actor: { uid: userId },
    details: { slot_id: slotId, arena_id: slot.arena_id },
  });
}

/**
 * Sair de um jogo aberto que é um dia de jogo: vaga e dia de jogo no mesmo
 * lote. Antes, as partidas já decididas recebem o uid de quem sai
 * (`sealParticipantBeforeRemoval`) — senão o resultado dele sumiria do
 * ranking do dia.
 *
 * Serve ao atleta saindo sozinho E à arena tirando alguém: cada escrita passa
 * pela regra de "só a si mesmo" (atleta) ou pela de quem gerencia (arena).
 *
 * @returns {Promise<boolean>} se havia algo a desfazer
 */
async function sairDoJogoLigado(slot, userId, wasInSlot) {
  const gdId = slot.game_day_id;
  const [gameDay, participants] = await Promise.all([getGameDay(gdId), listGameDayParticipants(gdId)]);
  const meu = participants.find((p) => p.user_id === userId) || null;
  if (!wasInSlot && !meu) return false;

  if (meu) await sealParticipantBeforeRemoval(gdId, meu);

  const batch = writeBatch(db);
  if (wasInSlot) {
    const restantes = (slot.participants || []).filter((p) => p !== userId);
    batch.update(doc(db, COL, slot.id), {
      participants: arrayRemove(userId),
      filled_spots: restantes.length,
      status: restantes.length >= (slot.total_spots || 0) ? OPEN_SLOT_STATUS.FULL : OPEN_SLOT_STATUS.OPEN,
      updated_at: serverTimestamp(),
    });
  }
  if (meu) {
    batch.delete(doc(db, COL_GAME_DAYS, gdId, 'participants', meu.id));
    // Quem criou (a arena) continua membro mesmo que tenha entrado para jogar
    // e saído: é o que mantém o dia de jogo na lista de quem o organiza.
    if (gameDay && gameDay.created_by !== userId) {
      batch.update(doc(db, COL_GAME_DAYS, gdId), {
        member_uids: arrayRemove(userId),
        updated_at: serverTimestamp(),
      });
    }
  }
  await batch.commit();
  return true;
}

/**
 * Deleta slot (apenas criador ou platform admin).
 */
export async function deleteOpenSlot(slotId, actor) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  // O dia de jogo NÃO é apagado: é arquivado, como qualquer outro — o que se
  // jogou ali pode estar no ranking de alguém (Onda CA).
  try {
    const atual = await getOpenSlot(slotId);
    if (isLinkedOpenSlot(atual)) {
      const gd = await getGameDay(atual.game_day_id);
      if (gd && gd.status !== 'archived') {
        await archiveArenaGameDay(atual.game_day_id, actor, { fromOpenSlot: true });
      }
    }
  } catch (err) {
    logger.info('open_match_game_day_archive_failed', { slotId, err: err?.code });
  }
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
