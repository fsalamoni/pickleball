/**
 * Serviço do "Dia de jogo do atleta" (flag athlete_game_day).
 *
 * Coleções (aditivas):
 *  - game_days/{id}                    — o dia de jogo (dono, visibilidade, membros)
 *  - game_days/{id}/participants/{pid} — participantes do dia
 *  - game_days/{id}/games/{gid}        — jogos sorteados/avulsos do dia
 *  - open_games (kind='game_day')      — convite público em "Procura-se jogo"
 *  - club_event_games                  — espelho dos resultados no ranking (reuso)
 *
 * Todas as listagens usam `where` simples + ordenação em memória (sem índice
 * composto), seguindo o padrão do projeto.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch, arrayUnion,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeGameDayInput, computeMemberUids, GAME_DAY_STATUS,
  GD_PARTICIPANT_SOURCE, isPublicGameDay,
} from '../domain/gameDay.js';
import {
  buildGameDayRankingMatches, gameDayRankingId, GAME_DAY_DATE_ID,
} from '../domain/gameDayRanking.js';
import {
  computePlayOrder, buildPlayNextMatch, assignPlayTeams,
  nextFreePlayCourt, pickSwapReplacement, PLAY_GAME_STATUS, PLAY_SLOTS,
} from '../domain/gamePlay.js';
import { mirrorGameToMyGame, sourceGameToMyGame, gameDayMirrorId } from '../domain/myGames.js';

const COL = 'game_days';
const COL_OPEN = 'open_games';
const COL_RANKING = 'club_event_games';
const SUB_PARTICIPANTS = 'participants';
const SUB_GAMES = 'games';

function displayName(u, p) {
  return p?.platform_name || p?.full_name || u?.displayName || u?.email || 'Atleta';
}

/* ------------------------------ Dia de jogo ----------------------------- */

/** Cria um dia de jogo do atleta autenticado (+ convite público se aplicável). */
export async function createGameDay(input, actor, profile) {
  if (!actor?.uid) throw new Error('É preciso estar autenticado.');
  const { valid, errors, value } = normalizeGameDayInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');

  const id = doc(collection(db, COL)).id;
  const creatorName = displayName(actor, profile);
  const creatorPhoto = profile?.photo_url || actor?.photoURL || null;
  const payload = {
    id,
    ...value,
    created_by: actor.uid,
    creator_name: creatorName,
    creator_photo: creatorPhoto,
    member_uids: [actor.uid],
    invited_uids: [],
    status: GAME_DAY_STATUS.ACTIVE,
    publish_to_ranking: false,
    published_count: 0,
    open_game_id: null,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload);

  // O criador entra como primeiro participante.
  await addGameDayParticipant(id, {
    user_id: actor.uid, name: creatorName, photo_url: creatorPhoto,
    source: GD_PARTICIPANT_SOURCE.OWNER,
    play_level: profile?.level || profile?.leveling_level || null,
    play_gender: profile?.gender || null,
  }, actor);

  // Dia de jogo público → publica convite em "Procura-se jogo".
  let openGameId = null;
  if (isPublicGameDay(value)) {
    openGameId = await publishGameDayInvite({ id, ...value }, actor, creatorName, creatorPhoto);
    await updateDoc(doc(db, COL, id), { open_game_id: openGameId, updated_at: serverTimestamp() });
  }

  await createAuditLog({ action: 'game_day_created', actor, details: { game_day_id: id, visibility: value.visibility } });
  return { id, openGameId };
}

export async function getGameDay(id) {
  if (!db || !id) return null;
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Lista os dias de jogo visíveis ao atleta (criador + membros). */
export async function listMyGameDays(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL), where('member_uids', 'array-contains', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((g) => g.status !== GAME_DAY_STATUS.ARCHIVED)
    .sort((a, b) => Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0));
}

/** Atualiza campos do dia de jogo (somente o criador — reforçado nas rules). */
export async function updateGameDay(id, patch, actor) {
  if (!id) return;
  const current = await getGameDay(id);
  if (!current) throw new Error('Dia de jogo não encontrado.');

  // Normaliza sobre os valores atuais + patch, mantendo só os campos presentes.
  const { value } = normalizeGameDayInput({ ...current, ...patch });
  const editable = {};
  ['title', 'visibility', 'date', 'time', 'location', 'city', 'state', 'notes', 'format', 'play_courts']
    .forEach((k) => { if (k in patch) editable[k] = value[k]; });
  await updateDoc(doc(db, COL, id), { ...editable, updated_at: serverTimestamp() });

  // Sincroniza o convite público (open_games) conforme a visibilidade resultante.
  const merged = { ...current, ...editable, id };
  const creatorName = current.creator_name || displayName(actor);
  const creatorPhoto = current.creator_photo || actor?.photoURL || null;
  if (isPublicGameDay(merged)) {
    if (current.open_game_id) {
      // Atualiza o convite existente (data/descrição/local).
      await updateDoc(doc(db, COL_OPEN, current.open_game_id), {
        date: merged.date || null,
        when_text: [merged.title, merged.date, merged.time].filter(Boolean).join(' · ') || merged.title || 'Dia de jogo',
        city: merged.city || '',
        state: merged.state || '',
        notes: merged.notes || '',
        updated_at: serverTimestamp(),
      }).catch(() => {});
    } else {
      // Passou a público: cria o convite.
      const openGameId = await publishGameDayInvite(merged, actor, creatorName, creatorPhoto);
      await updateDoc(doc(db, COL, id), { open_game_id: openGameId, updated_at: serverTimestamp() });
    }
  } else if (current.open_game_id) {
    // Passou a privado: remove o convite público.
    await deleteDoc(doc(db, COL_OPEN, current.open_game_id)).catch(() => {});
    await updateDoc(doc(db, COL, id), { open_game_id: null, updated_at: serverTimestamp() });
  }

  await createAuditLog({ action: 'game_day_updated', actor, details: { game_day_id: id } });
}

/** Arquiva um dia de jogo: remove convite público e resultados espelhados. */
export async function deleteGameDay(id, actor) {
  if (!id) return;
  const gd = await getGameDay(id);
  if (gd?.open_game_id) {
    await deleteDoc(doc(db, COL_OPEN, gd.open_game_id)).catch(() => {});
  }
  await clearGameDayRanking(id);
  await updateDoc(doc(db, COL, id), { status: GAME_DAY_STATUS.ARCHIVED, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'game_day_archived', actor, details: { game_day_id: id } });
}

/* ---------------------- Convite público (open_games) --------------------- */

/** Cria o convite público em `open_games` vinculado ao dia de jogo. */
async function publishGameDayInvite(gameDay, actor, creatorName, creatorPhoto) {
  const id = doc(collection(db, COL_OPEN)).id;
  const whenText = [gameDay.title, gameDay.date, gameDay.time].filter(Boolean).join(' · ');
  await setDoc(doc(db, COL_OPEN, id), {
    id,
    kind: 'game_day',
    game_day_id: gameDay.id,
    date: gameDay.date || null,
    when_text: whenText || gameDay.title || 'Dia de jogo',
    city: gameDay.city || '',
    state: gameDay.state || '',
    level: null,
    format: 'doubles',
    notes: gameDay.notes || '',
    created_by: actor.uid,
    creator_name: creatorName,
    creator_photo: creatorPhoto,
    status: 'open',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return id;
}

/**
 * Participar de um dia de jogo público (a partir de "Procura-se jogo").
 * Adiciona o atleta como participante e como membro (passa a ver o dia de jogo).
 * Idempotente: se já participa, apenas retorna.
 */
export async function joinPublicGameDay(gameDay, user, profile) {
  if (!user?.uid) throw new Error('Entre na plataforma para participar.');
  if (!gameDay?.id) throw new Error('Dia de jogo inválido.');
  if (gameDay.created_by === user.uid) return; // já é o dono

  const existing = await getDocs(query(
    collection(db, COL, gameDay.id, SUB_PARTICIPANTS), where('user_id', '==', user.uid),
  ));
  if (!existing.empty) {
    // Garante a associação mesmo se o participante já existia.
    await updateDoc(doc(db, COL, gameDay.id), { member_uids: arrayUnion(user.uid), updated_at: serverTimestamp() });
    return;
  }

  const name = displayName(user, profile);
  await addGameDayParticipant(gameDay.id, {
    user_id: user.uid, name, photo_url: profile?.photo_url || user?.photoURL || null,
    source: GD_PARTICIPANT_SOURCE.JOINED,
    play_level: profile?.level || profile?.leveling_level || null,
    play_gender: profile?.gender || null,
  }, user);

  notifyUsers([gameDay.created_by], {
    title: 'Novo participante no seu dia de jogo',
    message: `${name} entrou no dia de jogo "${gameDay.title}" pelo convite.`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: '/dia-de-jogo',
    actor: { uid: user.uid, displayName: name },
  });
  await createAuditLog({ action: 'game_day_joined', actor: user, details: { game_day_id: gameDay.id } });
}

/* ------------------------------ Participantes ---------------------------- */

export async function listGameDayParticipants(gdId) {
  if (!db || !gdId) return [];
  const snap = await getDocs(collection(db, COL, gdId, SUB_PARTICIPANTS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Insere um participante. Se tiver `user_id` (atleta da plataforma), passa a
 * ser membro do dia de jogo (vê o dia de jogo). Convidados avulsos (só nome)
 * não afetam a associação.
 */
export async function addGameDayParticipant(gdId, entry, actor) {
  if (!gdId) throw new Error('Dia de jogo inválido.');
  const pid = doc(collection(db, COL, gdId, SUB_PARTICIPANTS)).id;
  const source = entry.source || (entry.user_id ? GD_PARTICIPANT_SOURCE.INVITED : GD_PARTICIPANT_SOURCE.GUEST);
  const now = Date.now();
  await setDoc(doc(db, COL, gdId, SUB_PARTICIPANTS, pid), {
    id: pid,
    user_id: entry.user_id || null,
    name: entry.name || 'Atleta',
    photo_url: entry.photo_url || null,
    source,
    created_at: serverTimestamp(),
    created_at_ms: now,
    // Campos do formato Play (aditivos; inertes nos demais formatos).
    play_level: entry.play_level ?? null,
    play_gender: entry.play_gender ?? null,
    available_since: now,
    available_tie: Math.random(),
    skip_remaining: 0,
    partner_id: null,
  });
  if (entry.user_id) {
    const patch = { member_uids: arrayUnion(entry.user_id), updated_at: serverTimestamp() };
    if (source === GD_PARTICIPANT_SOURCE.INVITED) patch.invited_uids = arrayUnion(entry.user_id);
    await updateDoc(doc(db, COL, gdId), patch);
    // Notifica atletas inseridos pelo criador.
    if (source === GD_PARTICIPANT_SOURCE.INVITED && actor?.uid && entry.user_id !== actor.uid) {
      notifyUsers([entry.user_id], {
        title: 'Você foi convidado para um dia de jogo',
        message: 'Um atleta te inseriu em um dia de jogo. Abra "Dia de jogo" para ver.',
        type: NOTIFICATION_TYPE.GENERIC,
        link: '/dia-de-jogo',
        actor: { uid: actor.uid },
      });
    }
  }
  return pid;
}

/** Remove um participante e recalcula os membros do dia de jogo. */
export async function removeGameDayParticipant(gdId, pid, actor) {
  if (!gdId || !pid) return;
  await deleteDoc(doc(db, COL, gdId, SUB_PARTICIPANTS, pid));
  await recomputeGameDayMembers(gdId);
  await createAuditLog({ action: 'game_day_participant_removed', actor, details: { game_day_id: gdId, participant_id: pid } });
}

/** Recalcula `member_uids` a partir do criador + convidados + participantes. */
async function recomputeGameDayMembers(gdId) {
  const [gd, participants] = await Promise.all([getGameDay(gdId), listGameDayParticipants(gdId)]);
  if (!gd) return;
  const member_uids = computeMemberUids({
    createdBy: gd.created_by,
    invitedUids: gd.invited_uids || [],
    participants,
  });
  await updateDoc(doc(db, COL, gdId), { member_uids, updated_at: serverTimestamp() });
}

/* --------------------------------- Jogos --------------------------------- */

export async function listGameDayGames(gdId) {
  if (!db || !gdId) return [];
  const snap = await getDocs(collection(db, COL, gdId, SUB_GAMES));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

export async function addGameDayGame(gdId, game, actor) {
  if (!gdId) throw new Error('Dia de jogo inválido.');
  const gid = doc(collection(db, COL, gdId, SUB_GAMES)).id;
  await setDoc(doc(db, COL, gdId, SUB_GAMES, gid), {
    id: gid,
    round: game.round ?? null,
    court: game.court ?? null,
    kind: game.kind || 'doubles',
    side_a: game.side_a || [],
    side_b: game.side_b || [],
    score_a: game.score_a ?? null,
    score_b: game.score_b ?? null,
    order: game.order ?? Date.now(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  autoSyncGameDayRanking(gdId, actor);
  return gid;
}

export async function updateGameDayGame(gdId, gid, updates, actor) {
  if (!gdId || !gid) return;
  await updateDoc(doc(db, COL, gdId, SUB_GAMES, gid), { ...updates, updated_at: serverTimestamp() });
  autoSyncGameDayRanking(gdId, actor);
}

export async function deleteGameDayGame(gdId, gid, actor) {
  if (!gdId || !gid) return;
  await deleteDoc(doc(db, COL, gdId, SUB_GAMES, gid));
  autoSyncGameDayRanking(gdId, actor);
}

/** Substitui todos os jogos do dia (usado no sorteio). */
export async function replaceGameDayGames(gdId, games, actor) {
  if (!gdId) throw new Error('Dia de jogo inválido.');
  const current = await getDocs(collection(db, COL, gdId, SUB_GAMES));
  const batch = writeBatch(db);
  current.docs.forEach((d) => batch.delete(d.ref));
  games.forEach((g, i) => {
    const gid = doc(collection(db, COL, gdId, SUB_GAMES)).id;
    batch.set(doc(db, COL, gdId, SUB_GAMES, gid), {
      id: gid,
      round: g.round ?? null,
      court: g.court ?? null,
      kind: g.kind || 'doubles',
      side_a: g.side_a || [],
      side_b: g.side_b || [],
      score_a: g.score_a ?? null,
      score_b: g.score_b ?? null,
      order: g.order ?? i,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
  await createAuditLog({ action: 'game_day_games_drawn', actor, details: { game_day_id: gdId, count: games.length } });
  autoSyncGameDayRanking(gdId, actor);
}

/**
 * Sorteio ADITIVO: adiciona novos jogos SEM apagar os já lançados. Remove
 * apenas os jogos indicados em `removeIds` (jogos sem resultado que o usuário
 * optou por substituir). Os jogos com resultado nunca são tocados aqui.
 *
 * @param {string} gdId
 * @param {{ removeIds?: string[], games?: Array, orderBase?: number }} plan
 * @param {object} actor
 */
export async function appendGameDayGames(gdId, { removeIds = [], games = [], orderBase = 0 } = {}, actor) {
  if (!gdId) throw new Error('Dia de jogo inválido.');
  const batch = writeBatch(db);
  removeIds.forEach((id) => {
    if (id) batch.delete(doc(db, COL, gdId, SUB_GAMES, id));
  });
  const base = Number.isFinite(orderBase) ? orderBase : 0;
  games.forEach((g, i) => {
    const gid = doc(collection(db, COL, gdId, SUB_GAMES)).id;
    batch.set(doc(db, COL, gdId, SUB_GAMES, gid), {
      id: gid,
      round: g.round ?? null,
      court: g.court ?? null,
      kind: g.kind || 'doubles',
      side_a: g.side_a || [],
      side_b: g.side_b || [],
      score_a: g.score_a ?? null,
      score_b: g.score_b ?? null,
      order: g.order ?? base + i,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
  await createAuditLog({
    action: 'game_day_games_drawn',
    actor,
    details: { game_day_id: gdId, added: games.length, removed: removeIds.length, mode: 'append' },
  });
  autoSyncGameDayRanking(gdId, actor);
}

export async function clearGameDayGames(gdId, actor) {
  if (!gdId) return;
  const current = await getDocs(collection(db, COL, gdId, SUB_GAMES));
  const batch = writeBatch(db);
  current.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await createAuditLog({ action: 'game_day_games_cleared', actor, details: { game_day_id: gdId } });
  autoSyncGameDayRanking(gdId, actor);
}

/* ---------------------------- Play (open play) --------------------------- */

/** Monta os lados (2 jogadores) com nome/foto a partir dos ids. */
function playSideEntries(ids, byId) {
  return (ids || []).map((id) => {
    const p = byId.get(id);
    return {
      id,
      name: p?.name || 'Jogador',
      user_id: p?.user_id || null,
      photo_url: p?.photo_url || null,
    };
  });
}

/** Grava (no batch) um jogo aberto do Play numa quadra e devolve o id. */
function writePlayGame(batch, gdId, { court, side_a, side_b, order }) {
  const gid = doc(collection(db, COL, gdId, SUB_GAMES)).id;
  batch.set(doc(db, COL, gdId, SUB_GAMES, gid), {
    id: gid,
    round: null,
    court: court ?? null,
    kind: 'doubles',
    format: 'play',
    status: PLAY_GAME_STATUS.OPEN,
    side_a: side_a || [],
    side_b: side_b || [],
    score_a: null,
    score_b: null,
    order: order ?? Date.now(),
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });
  return gid;
}

/** Após criar uma partida, quem estava pulando desconta 1 (e volta à fila ao zerar). */
function applySkipDecrement(batch, gdId, participants) {
  const now = Date.now();
  (participants || []).forEach((p) => {
    const skip = Number(p.skip_remaining) || 0;
    if (skip <= 0) return;
    const nextSkip = skip - 1;
    const patch = { skip_remaining: nextSkip, updated_at: serverTimestamp() };
    if (nextSkip === 0) { patch.available_since = now; patch.available_tie = Math.random(); }
    batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, p.id), patch);
  });
}

/**
 * Cria o PRÓXIMO jogo do Play por ordem de participação (sorteando entre
 * empatados via `available_tie`), formando duplas equilibradas por nível/sexo.
 * @param {string} gdId
 * @param {object} actor
 * @param {{ court?: number|null }} [opts]  quadra alvo (padrão: menor livre)
 * @returns {{ gameId: string, court: number }}
 */
export async function createNextPlayGame(gdId, actor, { court = null } = {}) {
  const gd = await getGameDay(gdId);
  if (!gd) throw new Error('Dia de jogo não encontrado.');
  const [participants, games] = await Promise.all([
    listGameDayParticipants(gdId), listGameDayGames(gdId),
  ]);
  const targetCourt = court ?? nextFreePlayCourt({ courts: gd.play_courts || 1, games });
  if (targetCourt == null) throw new Error('Todas as quadras já estão em jogo.');

  const { order } = computePlayOrder({ participants, games });
  const ids = buildPlayNextMatch(order, { slots: PLAY_SLOTS });
  if (!ids) throw new Error('Não há jogadores disponíveis suficientes (mínimo 4) para criar o próximo jogo.');

  const byId = new Map(participants.map((p) => [p.id, p]));
  const four = ids.map((id) => byId.get(id)).filter(Boolean);
  const { side_a, side_b } = assignPlayTeams(four);

  const batch = writeBatch(db);
  const gid = writePlayGame(batch, gdId, {
    court: targetCourt,
    side_a: playSideEntries(side_a, byId),
    side_b: playSideEntries(side_b, byId),
    order: Date.now(),
  });
  const chosen = new Set(ids);
  applySkipDecrement(batch, gdId, participants.filter((p) => !chosen.has(p.id)));
  await batch.commit();
  await createAuditLog({
    action: 'game_day_play_game_created', actor,
    details: { game_day_id: gdId, court: targetCourt, game_id: gid },
  });
  return { gameId: gid, court: targetCourt };
}

/** Criação MANUAL de um jogo do Play (jogadores escolhidos à mão). */
export async function createManualPlayGame(gdId, { court = null, sideAIds = [], sideBIds = [] }, actor) {
  const participants = await listGameDayParticipants(gdId);
  const byId = new Map(participants.map((p) => [p.id, p]));
  const batch = writeBatch(db);
  const gid = writePlayGame(batch, gdId, {
    court,
    side_a: playSideEntries(sideAIds, byId),
    side_b: playSideEntries(sideBIds, byId),
    order: Date.now(),
  });
  await batch.commit();
  await createAuditLog({ action: 'game_day_play_game_manual', actor, details: { game_day_id: gdId, game_id: gid, court } });
  return { gameId: gid };
}

/**
 * Conclui um jogo do Play: marca finalizado, devolve os jogadores à fila (mesmo
 * grupo de espera) e cria AUTOMATICAMENTE o próximo jogo na quadra liberada.
 */
export async function finishPlayGame(gdId, gid, actor) {
  const gd = await getGameDay(gdId);
  if (!gd) throw new Error('Dia de jogo não encontrado.');
  const [participants, games] = await Promise.all([
    listGameDayParticipants(gdId), listGameDayGames(gdId),
  ]);
  const game = games.find((g) => g.id === gid);
  if (!game) throw new Error('Jogo não encontrado.');
  if (game.status === PLAY_GAME_STATUS.FINISHED) return { finished: gid, next: null };

  const now = Date.now();
  const playerIds = [...(game.side_a || []), ...(game.side_b || [])].map((p) => p.id).filter(Boolean);
  const partById = new Map(participants.map((p) => [p.id, p]));

  const batch = writeBatch(db);
  batch.update(doc(db, COL, gdId, SUB_GAMES, gid), {
    status: PLAY_GAME_STATUS.FINISHED, finished_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  playerIds.forEach((pid) => {
    if (!partById.has(pid)) return;
    batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, pid), {
      available_since: now, available_tie: Math.random(), updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
  await createAuditLog({ action: 'game_day_play_game_finished', actor, details: { game_day_id: gdId, game_id: gid } });

  // Cria o próximo jogo para a quadra liberada (se houver 4 disponíveis).
  try {
    const next = await createNextPlayGame(gdId, actor, { court: game.court });
    return { finished: gid, next };
  } catch (err) {
    return { finished: gid, next: null, reason: err.message };
  }
}

/** Cancela (remove) um jogo aberto do Play e devolve os jogadores à fila. */
export async function cancelPlayGame(gdId, gid, actor) {
  const games = await listGameDayGames(gdId);
  const game = games.find((g) => g.id === gid);
  if (!game) return;
  const now = Date.now();
  const playerIds = [...(game.side_a || []), ...(game.side_b || [])].map((p) => p.id).filter(Boolean);
  const batch = writeBatch(db);
  batch.delete(doc(db, COL, gdId, SUB_GAMES, gid));
  playerIds.forEach((pid) => {
    batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, pid), {
      available_since: now, available_tie: Math.random(), updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
  await createAuditLog({ action: 'game_day_play_game_cancelled', actor, details: { game_day_id: gdId, game_id: gid } });
}

/**
 * Marca um jogador como AUSENTE num jogo aberto: ele é substituído pelo próximo
 * da ordem de participação, e os dois TROCAM de lugar (o ausente assume a
 * posição do substituto na fila).
 */
export async function noShowSwapPlayGame(gdId, gid, absentId, actor) {
  const [participants, games] = await Promise.all([
    listGameDayParticipants(gdId), listGameDayGames(gdId),
  ]);
  const game = games.find((g) => g.id === gid);
  if (!game || game.status === PLAY_GAME_STATUS.FINISHED) throw new Error('Jogo não disponível.');
  const inGameIds = [...(game.side_a || []), ...(game.side_b || [])].map((p) => p.id);
  if (!inGameIds.includes(absentId)) throw new Error('Jogador não está neste jogo.');

  // Quem já foi substituído para FORA deste mesmo jogo não pode voltar a ele
  // (mesmo em uma segunda substituição na mesma partida).
  const swappedOutIds = Array.isArray(game.swapped_out_ids) ? game.swapped_out_ids.filter(Boolean) : [];

  const { order } = computePlayOrder({ participants, games });
  const repl = pickSwapReplacement(order, { inGameIds, swappedOutIds });
  if (!repl) throw new Error('Não há substituto disponível na ordem de participação.');

  const swapSide = (side) => (side || []).map((p) => (p.id === absentId
    ? { id: repl.id, name: repl.name || 'Jogador', user_id: repl.user_id || null, photo_url: repl.photo_url || null }
    : p));

  const nextSwappedOut = swappedOutIds.includes(absentId) ? swappedOutIds : [...swappedOutIds, absentId];
  const batch = writeBatch(db);
  batch.update(doc(db, COL, gdId, SUB_GAMES, gid), {
    side_a: swapSide(game.side_a),
    side_b: swapSide(game.side_b),
    // Registra o ausente como "substituído para fora" deste jogo (aditivo).
    swapped_out_ids: nextSwappedOut,
    updated_at: serverTimestamp(),
  });
  // O ausente assume a posição do substituto na fila (trocam de lugar).
  batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, absentId), {
    available_since: Number(repl.available_since) || Date.now(),
    available_tie: Number.isFinite(Number(repl.available_tie)) ? Number(repl.available_tie) : Math.random(),
    updated_at: serverTimestamp(),
  });
  await batch.commit();
  await createAuditLog({
    action: 'game_day_play_no_show', actor,
    details: { game_day_id: gdId, game_id: gid, absent_id: absentId, replaced_by: repl.id },
  });
  return { replacedBy: repl.id };
}

/** Define/ajusta a indisponibilidade ("pular X partidas") de um participante. */
export async function setPlayParticipantSkip(gdId, pid, count, actor) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const patch = { skip_remaining: n, updated_at: serverTimestamp() };
  if (n === 0) { patch.available_since = Date.now(); patch.available_tie = Math.random(); }
  await updateDoc(doc(db, COL, gdId, SUB_PARTICIPANTS, pid), patch);
  await createAuditLog({ action: 'game_day_play_skip_set', actor, details: { game_day_id: gdId, participant_id: pid, count: n } });
}

/** Define/limpa a DUPLA FIXA (mútua) de um participante. */
export async function setPlayParticipantPartner(gdId, pid, partnerId, actor) {
  const participants = await listGameDayParticipants(gdId);
  const byId = new Map(participants.map((p) => [p.id, p]));
  const me = byId.get(pid);
  if (!me) throw new Error('Participante não encontrado.');
  if (partnerId && partnerId === pid) throw new Error('Escolha outro participante.');

  const batch = writeBatch(db);
  const clearOldPartner = (p) => {
    if (p?.partner_id && p.partner_id !== pid && p.partner_id !== partnerId && byId.has(p.partner_id)) {
      batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, p.partner_id), { partner_id: null, updated_at: serverTimestamp() });
    }
  };

  if (!partnerId) {
    clearOldPartner(me);
    if (me.partner_id && byId.has(me.partner_id)) {
      batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, me.partner_id), { partner_id: null, updated_at: serverTimestamp() });
    }
    batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, pid), { partner_id: null, updated_at: serverTimestamp() });
  } else {
    const partner = byId.get(partnerId);
    if (!partner) throw new Error('Parceiro não encontrado.');
    clearOldPartner(me);
    clearOldPartner(partner);
    batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, pid), { partner_id: partnerId, updated_at: serverTimestamp() });
    batch.update(doc(db, COL, gdId, SUB_PARTICIPANTS, partnerId), { partner_id: pid, updated_at: serverTimestamp() });
  }
  await batch.commit();
  await createAuditLog({
    action: 'game_day_play_partner_set', actor,
    details: { game_day_id: gdId, participant_id: pid, partner_id: partnerId || null },
  });
}

/* ------------------------------- Ranking -------------------------------- */

/** Ids já espelhados em `club_event_games` para este dia de jogo. */
async function listRankingIds(gdId) {
  try {
    const snap = await getDocs(query(collection(db, COL_RANKING), where('event_id', '==', gdId)));
    return snap.docs.map((d) => d.id);
  } catch (err) {
    logger.error('listRankingIds (game day) falhou:', err);
    return [];
  }
}

/**
 * Lê os documentos já espelhados do dia (id → dados). Serve para propagar
 * edições de placar de jogos JÁ publicados (o domínio compara o resultado
 * gravado com o recém-calculado e só regrava o que mudou).
 */
async function listRankingDocs(gdId) {
  try {
    const snap = await getDocs(query(collection(db, COL_RANKING), where('event_id', '==', gdId)));
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  } catch (err) {
    logger.error('listRankingDocs (game day) falhou:', err);
    return [];
  }
}

/** Carrega uid → club_ids[] a partir dos perfis (para o clube por partida). */
async function loadClubIdsByUid(uids) {
  const map = new Map();
  const unique = Array.from(new Set((uids || []).filter(Boolean)));
  const CHUNK = 30;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    // eslint-disable-next-line no-await-in-loop
    const snap = await getDocs(query(collection(db, 'athlete_profiles'), where('__name__', 'in', slice)));
    snap.docs.forEach((d) => map.set(d.id, Array.isArray(d.data().club_ids) ? d.data().club_ids : []));
  }
  return map;
}

/**
 * Núcleo compartilhado do espelhamento de um dia de jogo do atleta em
 * `club_event_games`. Lê ids publicados/jogos/participantes, calcula o diff
 * idempotente via `buildGameDayRankingMatches` (domínio puro) e aplica o
 * batch. NÃO mexe no estado de publicação nem dispara recálculo.
 *
 * @returns {Promise<{ result: object, changed: boolean }>}
 */
async function applyGameDayMirror(gameDay, actor) {
  const [publishedDocs, games, participants] = await Promise.all([
    listRankingDocs(gameDay.id),
    listGameDayGames(gameDay.id),
    listGameDayParticipants(gameDay.id),
  ]);
  const clubIdsByUid = await loadClubIdsByUid(participants.map((p) => p.user_id));

  const publishedIds = publishedDocs.map((d) => d.id);
  const publishedById = new Map(publishedDocs.map((d) => [d.id, d.data]));

  const result = buildGameDayRankingMatches({
    gameDay, participants, games, clubIdsByUid, publishedIds, publishedById, publishedBy: actor?.uid || null,
  });

  const changed = result.toWrite.length > 0 || result.toRemove.length > 0;
  if (changed) {
    const batch = writeBatch(db);
    result.toWrite.forEach((w) => batch.set(doc(db, COL_RANKING, w.id), w.payload));
    result.toRemove.forEach((id) => batch.delete(doc(db, COL_RANKING, id)));
    await batch.commit();
  }
  return { result, changed };
}

/** Recálculo best-effort do rating nacional (força ignorar o throttle). */
async function recomputeNationalRating(actor, contextMsg) {
  try {
    const { maybeAutoRecomputeRatings } = await import('@/modules/rating/services/ratingService');
    await maybeAutoRecomputeRatings(actor, { force: true });
  } catch (err) {
    logger.error(contextMsg, err);
  }
}

/**
 * Publica os resultados decididos do dia de jogo no ranking geral (e no ranking
 * de um clube quando todos os atletas de uma partida são do mesmo clube).
 * Idempotente.
 */
export async function publishGameDayToRanking(gameDay, actor) {
  if (!gameDay?.id) throw new Error('Dia de jogo inválido.');
  const { result } = await applyGameDayMirror(gameDay, actor);

  await updateDoc(doc(db, COL, gameDay.id), {
    publish_to_ranking: true,
    published_at: serverTimestamp(),
    published_by: actor?.uid || null,
    published_count: result.toWrite.length,
    updated_at: serverTimestamp(),
  });

  await recomputeNationalRating(actor, 'Recálculo automático do rating após publicação (game day) falhou:');

  await createAuditLog({
    action: 'game_day_published_to_ranking',
    actor,
    details: { game_day_id: gameDay.id, ...result.summary },
  });
  return result.summary;
}

/**
 * Sincroniza (best-effort) o espelhamento do dia de jogo QUANDO ele já foi
 * publicado no ranking. Chamada após alterações de jogos (inclusão/edição/
 * exclusão — inclusive AVULSAS lançadas depois da publicação inicial), para
 * que essas partidas entrem no ranking/rating/DUPR sem exigir republicação
 * manual.
 *
 * Guardas:
 *  - Só age se o dia estiver com `publish_to_ranking: true`.
 *  - Não altera o interruptor de publicação; apenas atualiza o espelho.
 *  - No-op silencioso se o dia não foi publicado ou se nada mudou.
 *
 * @param {string} gameDayId
 * @param {object} actor
 * @returns {Promise<{ synced: boolean, reason?: string }>}
 */
export async function syncGameDayRankingIfPublished(gameDayId, actor) {
  if (!db || !gameDayId) return { synced: false, reason: 'invalid' };

  let gameDay = null;
  try {
    const snap = await getDoc(doc(db, COL, gameDayId));
    gameDay = snap?.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    logger.error('syncGameDayRankingIfPublished: leitura do dia falhou:', err);
    return { synced: false, reason: 'read-failed' };
  }
  if (!gameDay) return { synced: false, reason: 'no-game-day' };
  if (!gameDay.publish_to_ranking) return { synced: false, reason: 'not-published' };

  const { result, changed } = await applyGameDayMirror(gameDay, actor);
  if (!changed) return { synced: false, reason: 'up-to-date' };

  await updateDoc(doc(db, COL, gameDayId), {
    ranking_synced_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await recomputeNationalRating(actor, 'Recálculo automático do rating após sincronização (game day) falhou:');

  await createAuditLog({
    action: 'game_day_ranking_synced',
    actor,
    details: { game_day_id: gameDayId, ...result.summary },
  });
  return { synced: true, ...result.summary };
}

/**
 * Dispara (best-effort, SEM bloquear a mutação) a sincronização do espelho de
 * ranking após uma alteração de jogos, caso o dia já esteja publicado. Erros
 * apenas são logados — nunca interrompem a operação principal do organizador.
 * As partidas de origem (que o organizador vê) já foram gravadas de forma
 * síncrona; o espelho alimenta ranking/rating/DUPR e pode ser atualizado em
 * segundo plano.
 *
 * @param {string} gameDayId
 * @param {object} actor
 */
function autoSyncGameDayRanking(gameDayId, actor) {
  syncGameDayRankingIfPublished(gameDayId, actor).catch((err) =>
    logger.error('Auto-sincronização do ranking (game day) falhou:', err),
  );
}

/** Remove os resultados espelhados deste dia de jogo do ranking. */
export async function unpublishGameDayFromRanking(gameDay, actor) {
  if (!gameDay?.id) throw new Error('Dia de jogo inválido.');
  const removed = await clearGameDayRanking(gameDay.id);
  await updateDoc(doc(db, COL, gameDay.id), {
    publish_to_ranking: false,
    unpublished_at: serverTimestamp(),
    published_count: 0,
    updated_at: serverTimestamp(),
  });
  await recomputeNationalRating(actor, 'Recálculo automático do rating após despublicação (game day) falhou:');
  await createAuditLog({ action: 'game_day_unpublished_from_ranking', actor, details: { game_day_id: gameDay.id, removed } });
  return { removed };
}

/** Apaga todos os espelhamentos deste dia de jogo (uso interno). */
async function clearGameDayRanking(gdId) {
  const ids = await listRankingIds(gdId);
  if (ids.length === 0) return 0;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, COL_RANKING, id)));
  await batch.commit();
  return ids.length;
}

/** Metadados de publicação (contagem espelhada + estado). */
export async function getGameDayRankingMeta(gdId) {
  if (!db || !gdId) return { publishedIds: [] };
  const publishedIds = await listRankingIds(gdId);
  return { publishedIds };
}

/* --------------------- Meus jogos (desempenho pessoal) ------------------- */

async function loadNamesByUid(uids) {
  const map = new Map();
  const unique = Array.from(new Set((uids || []).filter(Boolean)));
  const CHUNK = 30;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    // eslint-disable-next-line no-await-in-loop
    const snap = await getDocs(query(collection(db, 'athlete_profiles'), where('__name__', 'in', slice)));
    snap.docs.forEach((d) => map.set(d.id, d.data().platform_name || d.data().full_name || 'Atleta'));
  }
  return map;
}

/**
 * Todos os jogos de DIA DE JOGO em que o atleta participou (decididos), para o
 * "Meu desempenho". Inclui:
 *  - o espelho publicado (`club_event_games`) — dias de jogo de clube e de atleta
 *    já publicados no ranking; e
 *  - a fonte dos dias de jogo do atleta (`game_days`) — SEMPRE, mesmo sem
 *    publicação no ranking, deduplicando contra o espelho.
 *
 * @param {string} uid
 * @returns {Promise<Array>} jogos normalizados (ver domain/myGames)
 */
export async function getMyGameDayGames(uid) {
  if (!db || !uid) return [];

  // 1) Espelho publicado onde o atleta aparece (2 queries array-contains).
  const [aSnap, bSnap] = await Promise.all([
    getDocs(query(collection(db, COL_RANKING), where('side_a_ids', 'array-contains', uid))),
    getDocs(query(collection(db, COL_RANKING), where('side_b_ids', 'array-contains', uid))),
  ]);
  const mirrorDocs = new Map();
  [...aSnap.docs, ...bSnap.docs].forEach((d) => mirrorDocs.set(d.id, { id: d.id, ...d.data() }));

  // Nomes dos adversários (uids do espelho).
  const uidSet = new Set();
  mirrorDocs.forEach((m) => {
    (m.side_a_ids || []).forEach((x) => uidSet.add(x));
    (m.side_b_ids || []).forEach((x) => uidSet.add(x));
  });
  uidSet.delete(uid);
  const nameByUid = await loadNamesByUid(Array.from(uidSet));

  const out = [];
  const seen = new Set();
  mirrorDocs.forEach((m) => {
    const g = mirrorGameToMyGame(uid, m, nameByUid);
    if (g) { out.push(g); seen.add(g.id); }
  });

  // 2) Fonte dos dias de jogo do atleta (inclui não publicados).
  const gdSnap = await getDocs(query(collection(db, COL), where('member_uids', 'array-contains', uid)));
  for (const gd of gdSnap.docs) {
    const gdData = gd.data();
    // eslint-disable-next-line no-await-in-loop
    const [gamesSnap, partsSnap] = await Promise.all([
      getDocs(collection(db, COL, gd.id, SUB_GAMES)),
      getDocs(collection(db, COL, gd.id, SUB_PARTICIPANTS)),
    ]);
    const partById = new Map(partsSnap.docs.map((p) => [p.id, p.data()]));
    gamesSnap.docs.forEach((gDoc) => {
      const game = { id: gDoc.id, ...gDoc.data() };
      if (seen.has(gameDayMirrorId(gd.id, game.id))) return; // já veio do espelho
      const g = sourceGameToMyGame(uid, gd.id, gdData.title, game, partById);
      if (g) { out.push(g); seen.add(g.id); }
    });
  }

  return out.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
}

export { gameDayRankingId, GAME_DAY_DATE_ID };
