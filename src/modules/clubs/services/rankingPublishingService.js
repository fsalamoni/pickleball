/**
 * Serviço de publicação dos resultados de um dia de jogo (game day) no
 * ranking da plataforma (Wave C).
 *
 * Fluxo:
 *  1. Lê o evento, o dia de jogo, os participantes e os jogos
 *     (`club_events/{id}/dates/{dateId}/.../games`).
 *  2. Resolve `publishedIds` atuais em `club_event_games` com id
 *     determinístico `${eventId}_${dateId}_${gameId}`.
 *  3. Calcula `toWrite`/`toRemove` via `buildPublishableMatches`
 *     (domínio puro, testado).
 *  4. Aplica o batch (cria novos + remove fantasmas) no Firestore.
 *  5. Grava o estado da publicação no próprio dia de jogo:
 *     `publish_to_ranking: true`, `published_at`, `published_by`,
 *     `ranking_published_count`.
 *
 * O recálculo dos rankings NÃO é feito aqui: a própria escrita do espelho
 * dispara o gatilho do servidor (`recomputeRankingOnClubEventGame`), que
 * recalcula ELO/nacional, rating 2.0–8.0 e duplas. Ver o comentário de
 * `recomputeNationalRating`, logo abaixo, para o porquê.
 *
 * Idempotente: re-executar a publicação não duplica jogos já espelhados.
 *
 * Segurança/robustez:
 *  - Lê `score_a`/`score_b` numéricos; pula jogos não decididos.
 *  - Pula jogos com `user_id` faltando (convidados avulsos).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { CLUB_COLLECTIONS } from '../domain/constants.js';
import {
  buildPublishableMatches,
  summarizeResult,
} from '../domain/rankingPublishing.js';

const COL = CLUB_COLLECTIONS;

function publishedGameId(eventId, dateId, gameId) {
  return `${eventId}_${dateId}_${gameId}`;
}

async function listPublishedIdsForDate(eventId, dateId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, COL.clubEventGames),
        where('event_id', '==', eventId),
        where('date_id', '==', dateId),
      ),
    );
    return snap.docs.map((d) => d.id);
  } catch (err) {
    logger.error('listPublishedIdsForDate falhou:', err);
    return [];
  }
}

/**
 * Lê os documentos já espelhados do dia (id → dados). Serve para propagar
 * edições de placar de jogos JÁ publicados (o domínio compara o resultado
 * gravado com o recém-calculado e só regrava o que mudou).
 */
async function listPublishedDocsForDate(eventId, dateId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, COL.clubEventGames),
        where('event_id', '==', eventId),
        where('date_id', '==', dateId),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  } catch (err) {
    logger.error('listPublishedDocsForDate falhou:', err);
    return [];
  }
}

async function listGamesForDate(eventId, dateId) {
  const snap = await getDocs(collection(db, COL.events, eventId, COL.eventGames));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((g) => (g.date_id || null) === (dateId || null));
}

async function listParticipantsForDate(eventId, dateId) {
  const snap = await getDocs(collection(db, COL.events, eventId, COL.eventParticipants));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => (p.date_id || null) === (dateId || null));
}

async function patchEventDate(eventId, dateId, patch) {
  await setDoc(
    doc(db, COL.events, eventId, COL.eventDates, dateId),
    { ...patch, updated_at: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Núcleo compartilhado do espelhamento de um dia de jogo em
 * `club_event_games`. Lê `publishedIds`/jogos/participantes, calcula o
 * diff idempotente via `buildPublishableMatches` (domínio puro) e aplica o
 * batch (grava novos + remove fantasmas). NÃO mexe no estado de publicação
 * do dia nem dispara recálculo — isso é responsabilidade de quem chama.
 *
 * @returns {Promise<{ result: object, changed: boolean }>}
 */
async function applyEventDateMirror(event, dateId, clubId, actor) {
  const [publishedDocs, games, participants] = await Promise.all([
    listPublishedDocsForDate(event.id, dateId),
    listGamesForDate(event.id, dateId),
    listParticipantsForDate(event.id, dateId),
  ]);

  const publishedIds = publishedDocs.map((d) => d.id);
  const publishedById = new Map(publishedDocs.map((d) => [d.id, d.data]));

  const result = buildPublishableMatches({
    event,
    dateId,
    clubId,
    publishedBy: actor?.uid || null,
    participants,
    games,
    publishedIds,
    publishedById,
  });

  const changed = result.toWrite.length > 0 || result.toRemove.length > 0;
  if (changed) {
    const batch = writeBatch(db);
    result.toWrite.forEach((w) => batch.set(doc(db, COL.clubEventGames, w.id), w.payload));
    result.toRemove.forEach((id) => batch.delete(doc(db, COL.clubEventGames, id)));
    await batch.commit();
  }

  return { result, changed };
}

/**
 * O recálculo dos rankings NÃO acontece mais aqui.
 *
 * Quem recalcula é o SERVIDOR, no gatilho de `club_event_games`
 * (`functions/index.js` → `recomputeRankingOnClubEventGame`), disparado pela
 * própria escrita do espelho que acabou de ser feita — publicação, edição,
 * sincronização e despublicação, todas passam por ali.
 *
 * Por que a tentativa do cliente saiu: materializar ranking é escrita em
 * coleção que só o admin da plataforma pode gravar. Para todo mundo mais, a
 * chamada era recusada pela regra e morria num `catch` — custando, de graça,
 * a leitura da coleção INTEIRA de torneios a cada publicação. E para o admin
 * ela ainda concorria com o gatilho, recalculando duas vezes a mesma coisa.
 */

/**
 * Publica os resultados decididos de um dia de jogo no ranking nacional.
 * Idempotente: re-rodar não duplica jogos já espelhados.
 *
 * @param {object} event    - `club_events/{id}`
 * @param {string} dateId   - id do dia de jogo
 * @param {string} clubId   - clube vinculado (validado em runtime)
 * @param {object} actor    - usuário autenticado (auditoria)
 * @returns {Promise<{ published: number, skipped: number, already_published: number, removed: number }>}
 */
export async function publishEventDateToRanking(event, dateId, clubId, actor) {
  if (!event?.id) throw new Error('Evento inválido.');
  if (!dateId) throw new Error('Dia de jogo inválido.');
  if (!clubId) throw new Error('Clube inválido.');
  if (event.club_id && event.club_id !== clubId) {
    throw new Error('O evento não pertence ao clube informado.');
  }

  const { result } = await applyEventDateMirror(event, dateId, clubId, actor);

  // Marca o dia de jogo como publicado (idempotente).
  await patchEventDate(event.id, dateId, {
    publish_to_ranking: true,
    published_at: serverTimestamp(),
    published_by: actor?.uid || null,
    published_count: result.toWrite.length,
    // Mantém um carimbo "última operação" para auditoria
    last_publish_summary: result.summary,
  });

  // Recálculo best-effort do ranking nacional.

  await createAuditLog({
    action: 'club_event_date_published_to_ranking',
    actor,
    details: {
      event_id: event.id,
      date_id: dateId,
      club_id: clubId,
      ...result.summary,
    },
  });

  return summarizeResult(result.summary);
}

/**
 * Sincroniza (best-effort) o espelhamento de um dia de jogo QUANDO ele já foi
 * publicado no ranking. Chamada após alterações de jogos (inclusão/edição/
 * exclusão de partidas — inclusive AVULSAS lançadas depois da publicação
 * inicial), para que essas partidas entrem no ranking/rating/DUPR sem exigir
 * que o organizador clique em "Publicar" de novo.
 *
 * Guardas:
 *  - Só age se o dia de jogo estiver com `publish_to_ranking: true`.
 *  - Não altera o interruptor de publicação; apenas atualiza o espelho.
 *  - No-op silencioso (retorna `synced: false`) se o dia não foi publicado,
 *    se faltam dados ou se nada mudou.
 *
 * @param {string} eventId
 * @param {string} dateId
 * @param {object} actor
 * @returns {Promise<{ synced: boolean, reason?: string }>}
 */
export async function syncEventDateRankingIfPublished(eventId, dateId, actor) {
  if (!db || !eventId || !dateId) return { synced: false, reason: 'invalid' };

  // Guarda 1: o dia precisa estar publicado.
  let dateData = null;
  try {
    const snap = await getDoc(doc(db, COL.events, eventId, COL.eventDates, dateId));
    dateData = snap?.exists() ? snap.data() : null;
  } catch (err) {
    logger.error('syncEventDateRankingIfPublished: leitura do dia falhou:', err);
    return { synced: false, reason: 'read-failed' };
  }
  if (!dateData?.publish_to_ranking) return { synced: false, reason: 'not-published' };

  // Carrega o evento (título, clube) para montar o espelho.
  let event = null;
  try {
    const snap = await getDoc(doc(db, COL.events, eventId));
    event = snap?.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    logger.error('syncEventDateRankingIfPublished: leitura do evento falhou:', err);
    return { synced: false, reason: 'read-failed' };
  }
  if (!event) return { synced: false, reason: 'no-event' };
  const clubId = event.club_id || null;
  if (!clubId) return { synced: false, reason: 'no-club' };

  const { result, changed } = await applyEventDateMirror(event, dateId, clubId, actor);
  if (!changed) return { synced: false, reason: 'up-to-date' };

  // Atualiza o carimbo da última sincronização (sem tocar no interruptor).
  await patchEventDate(eventId, dateId, {
    last_publish_summary: result.summary,
    ranking_synced_at: serverTimestamp(),
  });

  // Recálculo best-effort do ranking nacional para refletir as novas partidas.

  await createAuditLog({
    action: 'club_event_date_ranking_synced',
    actor,
    details: {
      event_id: eventId,
      date_id: dateId,
      club_id: clubId,
      ...result.summary,
    },
  });

  return { synced: true, ...summarizeResult(result.summary) };
}

/**
 * Remove os jogos espelhados de um dia de jogo do ranking nacional.
 * Mantém o campo `publish_to_ranking: false` no dia de jogo (interruptor
 * desligado) e dispara recálculo.
 *
 * @returns {Promise<{ removed: number }>}
 */
export async function unpublishEventDateFromRanking(event, dateId, actor) {
  if (!event?.id) throw new Error('Evento inválido.');
  if (!dateId) throw new Error('Dia de jogo inválido.');

  const publishedIds = await listPublishedIdsForDate(event.id, dateId);
  if (publishedIds.length > 0) {
    const batch = writeBatch(db);
    publishedIds.forEach((id) => batch.delete(doc(db, COL.clubEventGames, id)));
    await batch.commit();
  }

  await patchEventDate(event.id, dateId, {
    publish_to_ranking: false,
    unpublished_at: serverTimestamp(),
    unpublished_by: actor?.uid || null,
    published_count: 0,
  });


  await createAuditLog({
    action: 'club_event_date_unpublished_from_ranking',
    actor,
    details: { event_id: event.id, date_id: dateId, removed: publishedIds.length },
  });

  return { removed: publishedIds.length };
}

/**
 * Lê o estado de publicação de um dia de jogo: contagem de jogos espelhados
 * em `club_event_games` + campos administrativos gravados no dia de jogo.
 */
export async function getEventDateRankingMeta(eventId, dateId) {
  if (!db || !eventId || !dateId) return { publishedIds: [], date: null };
  const [publishedIds, dateSnap] = await Promise.all([
    listPublishedIdsForDate(eventId, dateId),
    getDoc(doc(db, COL.events, eventId, COL.eventDates, dateId)).catch(() => null),
  ]);
  return {
    publishedIds,
    date: dateSnap?.exists() ? { id: dateSnap.id, ...dateSnap.data() } : null,
  };
}

/** Lista os jogos espelhados de um dia de jogo (read-only). */
export async function listPublishedGamesForDate(eventId, dateId) {
  if (!db || !eventId || !dateId) return [];
  const snap = await getDocs(
    query(
      collection(db, COL.clubEventGames),
      where('event_id', '==', eventId),
      where('date_id', '==', dateId),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Helper para limpar todos os espelhamentos de um dia de jogo (chamado
 * pelo `clearGameDayData` quando o dia de jogo é excluído).
 */
export async function clearPublishedGamesForDate(eventId, dateId) {
  if (!db || !eventId || !dateId) return 0;
  const publishedIds = await listPublishedIdsForDate(eventId, dateId);
  if (publishedIds.length === 0) return 0;
  const batch = writeBatch(db);
  publishedIds.forEach((id) => batch.delete(doc(db, COL.clubEventGames, id)));
  await batch.commit();
  return publishedIds.length;
}

// Util exposto para o motor de rating (cross-module).
export { publishedGameId };
