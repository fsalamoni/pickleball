/**
 * Cloud Functions da plataforma.
 *
 * Recálculo automático do ranking no SERVIDOR: sempre que um torneio passa a ser
 * (ou deixa de ser) elegível para o ranking — público e encerrado —, o ranking
 * é recalculado automaticamente, sem depender de nenhum cliente. Como o
 * encerramento do torneio grava `status: finished` no documento do torneio, este
 * gatilho cobre o fluxo "último resultado lançado → torneio encerra → ranking
 * atualiza".
 *
 * A base Firestore usada pela plataforma é a nomeada `pickleball` (não a
 * default), por isso o gatilho e o cliente admin apontam para ela.
 *
 * Arena V3 (2026-07-21): automações adicionadas para sprints 1, 5, 6, 7.
 *  - expireStaleNotifications (sprint 1): limpa notificações com > 7 dias.
 *  - refreshLadderWeekly (sprint 5): agrega ladder de arenas ativas.
 *  - aggregateNpsDaily (sprint 6): consolida NPS por arena.
 *  - autoCloseChecklists (sprint 7): fecha checklists opening/closing do dia.
 */

const { initializeApp, getApps, getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { recomputeAllRatings, isEligible } = require('./ranking');
const { recomputeClubInternalRankings } = require('./clubRanking');

if (!getApps().length) initializeApp();

const DATABASE_ID = 'pickleball';
const REGION = 'southamerica-east1';

setGlobalOptions({ region: REGION, maxInstances: 3 });

// =====================================================================
// RANKING (existente — mantido intacto)
// =====================================================================

exports.recomputeRankingOnTournamentChange = onDocumentWritten(
  {
    document: 'tournaments/{tournamentId}',
    database: DATABASE_ID,
    region: REGION,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    // Só recalcula quando a elegibilidade para o ranking muda (encerrar, reabrir,
    // arquivar, tornar público/privado, excluir) — ignora edições irrelevantes.
    if (!isEligible(before) && !isEligible(after)) return;

    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      const res = await recomputeAllRatings(db);
      logger.info('Ranking recalculado (gatilho de torneio).', {
        tournamentId: event.params.tournamentId,
        players: res.players,
        matchesUsed: res.matchesUsed,
      });
    } catch (err) {
      logger.error('Falha ao recalcular o ranking no servidor.', err);
    }
  },
);

// =====================================================================
// ARENA V3 — Sprint 1: expireStaleNotifications
// =====================================================================
// Limpa notificações com mais de 7 dias e não lidas.
// Roda todo dia às 3h (horário de SP).

exports.expireStaleNotifications = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
  },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    const cutoff = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const snap = await db
        .collection('notifications')
        .where('created_at', '<', cutoff)
        .where('read', '==', false)
        .limit(500)
        .get();
      if (snap.empty) {
        logger.info('expireStaleNotifications: nada a limpar.');
        return { archived: 0 };
      }
      const batch = db.batch();
      snap.docs.forEach((d) => batch.update(d.ref, { archived: true, archived_at: Timestamp.now() }));
      await batch.commit();
      logger.info('expireStaleNotifications: notificações arquivadas.', { count: snap.size });
      return { archived: snap.size };
    } catch (err) {
      logger.error('expireStaleNotifications: erro.', err);
      throw err;
    }
  },
);

// =====================================================================
// PUSH (PWA/FCM) — espelha as notificações in-app para os tokens do usuário
// =====================================================================
// ADITIVO E INERTE por padrão: só age quando o usuário optou por push e há
// tokens em `push_tokens`. Sem tokens (o normal até o opt-in), retorna cedo.
// Nunca lança — falhas são apenas logadas. Não altera a notificação in-app.
const PWA_ORIGIN = 'https://picklerush.web.app';

exports.pushOnNotificationCreate = onDocumentCreated(
  {
    document: 'notifications/{notifId}',
    database: DATABASE_ID,
    region: REGION,
  },
  async (event) => {
    const snap = event.data;
    const n = snap && typeof snap.data === 'function' ? snap.data() : null;
    if (!n || !n.user_id) return;

    const db = getFirestore(getApp(), DATABASE_ID);
    let docs = [];
    try {
      const tokensSnap = await db.collection('push_tokens').where('user_id', '==', n.user_id).get();
      docs = tokensSnap.docs;
    } catch (err) {
      logger.error('pushOnNotificationCreate: falha ao ler tokens.', err);
      return;
    }
    const tokens = docs.map((d) => d.data() && d.data().token).filter(Boolean);
    if (tokens.length === 0) return;

    const rawLink = n.link ? String(n.link) : '/';
    const link = rawLink.startsWith('http')
      ? rawLink
      : `${PWA_ORIGIN}${rawLink.startsWith('/') ? '' : '/'}${rawLink}`;

    const message = {
      notification: {
        title: String(n.title || 'PickleRush').slice(0, 120),
        body: String(n.message || '').slice(0, 300),
      },
      webpush: {
        fcmOptions: { link },
        notification: { icon: '/pwa-192.png', badge: '/pwa-192.png' },
      },
      data: { link, type: String(n.type || 'generic') },
      tokens,
    };

    let res;
    try {
      res = await getMessaging().sendEachForMulticast(message);
    } catch (err) {
      logger.error('pushOnNotificationCreate: falha no envio FCM.', err);
      return;
    }

    // Remove tokens inválidos/expirados.
    const toDelete = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (code === 'messaging/registration-token-not-registered'
          || code === 'messaging/invalid-registration-token'
          || code === 'messaging/invalid-argument') {
          if (docs[i]) toDelete.push(docs[i].ref);
        }
      }
    });
    if (toDelete.length > 0) {
      const batch = db.batch();
      toDelete.forEach((ref) => batch.delete(ref));
      await batch.commit().catch(() => {});
    }
    logger.info('pushOnNotificationCreate: push processado.', {
      user: n.user_id, sent: res.successCount, failed: res.failureCount,
    });
  },
);

// =====================================================================
// ARENA V3 — Sprint 5: refreshLadderWeekly
// =====================================================================
// Recalcula a ladder semanal de todas as arenas que têm módulo leagues
// habilitado. Roda todo domingo às 23h (horário de SP).

exports.refreshLadderWeekly = onSchedule(
  {
    schedule: '0 23 * * 0',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      // Arenas com módulo leagues ativo
      const statesSnap = await db
        .collection('arena_module_states')
        .where('module_id', '==', 'leagues_ladder')
        .where('enabled', '==', true)
        .get();
      if (statesSnap.empty) {
        logger.info('refreshLadderWeekly: nenhuma arena com ladder ativa.');
        return { processed: 0 };
      }
      let processed = 0;
      for (const state of statesSnap.docs) {
        const { arena_id } = state.data();
        if (!arena_id) continue;
        try {
          // Ladder simples: conta wins/losses por usuário em arena_class_bookings
          // + arena_matches da arena. Para V3 mínimo, escrevemos snapshot
          // agregado em arena_ladders/{arenaId}_current.
          const matchesSnap = await db
            .collection('arena_matches')
            .where('arena_id', '==', arena_id)
            .limit(500)
            .get();
          const stats = {};
          matchesSnap.docs.forEach((d) => {
            const m = d.data();
            if (!m.winner_uid) return;
            const loser_uid = m.winner_uid === m.user_a ? m.user_b : m.user_a;
            if (!stats[m.winner_uid]) stats[m.winner_uid] = { wins: 0, losses: 0, points: 0 };
            if (!stats[loser_uid]) stats[loser_uid] = { wins: 0, losses: 0, points: 0 };
            stats[m.winner_uid].wins += 1;
            stats[m.winner_uid].points += 3;
            stats[loser_uid].losses += 1;
          });
          const ranking = Object.entries(stats)
            .map(([user_id, s]) => ({ user_id, ...s }))
            .sort((a, b) => b.points - a.points || b.wins - a.wins)
            .slice(0, 50);
          await db
            .collection('arena_ladders')
            .doc(`${arena_id}_current`)
            .set({
              arena_id,
              ranking,
              refreshed_at: Timestamp.now(),
              source: 'cloud_function_refreshLadderWeekly',
            });
          processed += 1;
        } catch (innerErr) {
          logger.error('refreshLadderWeekly: erro em arena.', { arena_id, error: innerErr.message });
        }
      }
      logger.info('refreshLadderWeekly: ladders atualizadas.', { processed });
      return { processed };
    } catch (err) {
      logger.error('refreshLadderWeekly: erro.', err);
      throw err;
    }
  },
);

// =====================================================================
// ARENA V3 — Sprint 6: aggregateNpsDaily
// =====================================================================
// Consolida NPS diário de cada arena. Roda todo dia às 4h (horário de SP).

exports.aggregateNpsDaily = onSchedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
  },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      // Agrupa por arena_id nas últimas 24h
      const cutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const snap = await db
        .collection('arena_nps_responses')
        .where('created_at', '>=', cutoff)
        .get();
      if (snap.empty) {
        logger.info('aggregateNpsDaily: sem respostas nas últimas 24h.');
        return { arenas: 0 };
      }
      const byArena = {};
      snap.docs.forEach((d) => {
        const r = d.data();
        if (!r.arena_id || !Number.isFinite(r.score)) return;
        if (!byArena[r.arena_id]) byArena[r.arena_id] = [];
        byArena[r.arena_id].push(r);
      });
      const today = new Date().toISOString().slice(0, 10);
      const batch = db.batch();
      let count = 0;
      for (const [arenaId, responses] of Object.entries(byArena)) {
        const promoters = responses.filter((r) => r.score >= 9).length;
        const detractors = responses.filter((r) => r.score <= 6).length;
        const nps = Math.round(((promoters - detractors) / responses.length) * 100);
        const docId = `${arenaId}_${today}`;
        batch.set(db.collection('arena_nps_daily').doc(docId), {
          arena_id: arenaId,
          date: today,
          count: responses.length,
          promoters,
          detractors,
          nps,
          refreshed_at: Timestamp.now(),
        });
        count += 1;
      }
      await batch.commit();
      logger.info('aggregateNpsDaily: NPS diário consolidado.', { arenas: count });
      return { arenas: count };
    } catch (err) {
      logger.error('aggregateNpsDaily: erro.', err);
      throw err;
    }
  },
);

// =====================================================================
// ARENA V3 — Sprint 7: autoCloseChecklists
// =====================================================================
// Auto-fecha checklists 'opening' se passaram do horário OU 'closing' após
// meia-noite. Roda todo dia às 1h (horário de SP).

exports.autoCloseChecklists = onSchedule(
  {
    schedule: '0 1 * * *',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
  },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      const snap = await db
        .collection('arena_checklists')
        .where('auto_close', '==', true)
        .where('closed', '==', false)
        .limit(200)
        .get();
      if (snap.empty) {
        logger.info('autoCloseChecklists: nenhum checklist pendente.');
        return { closed: 0 };
      }
      const now = Timestamp.now();
      const batch = db.batch();
      let count = 0;
      snap.docs.forEach((d) => {
        const cl = d.data();
        // Critério simples: checklists com completed_pct >= 100 OU criados há > 24h
        const createdAt = cl.created_at && cl.created_at.toMillis ? cl.created_at.toMillis() : 0;
        const ageMs = Date.now() - createdAt;
        const tooOld = ageMs > 24 * 60 * 60 * 1000;
        const fullyDone = (cl.completed_pct || 0) >= 100;
        if (tooOld || fullyDone) {
          batch.update(d.ref, { closed: true, closed_at: now, auto_closed: true });
          count += 1;
        }
      });
      if (count > 0) await batch.commit();
      logger.info('autoCloseChecklists: checklists fechados.', { count });
      return { closed: count };
    } catch (err) {
      logger.error('autoCloseChecklists: erro.', err);
      throw err;
    }
  },
);


// =====================================================================
// CLUBE — Ranking interno (Wave C.3): materializado no Firestore
// =====================================================================
// Gatilhos: quando um resultado de jogo é gravado em qualquer fonte
// (evento do clube, Wave C, torneio), os clubes afetados são
// recalculados. O frontend apenas LÊ `club_internal_ratings` e
// `club_internal_ratings_ext`.

/**
 * Recalcula o ranking de um clube. Garante que o ranking fica
 * consistente após mudanças em jogos/membros. Idempotente.
 */
async function recalcOneClub(clubId) {
  if (!clubId) return;
  try {
    const res = await recomputeClubInternalRankings(getFirestore(getApp(), DATABASE_ID), clubId);
    logger.info('club_internal_ranking recalculado.', { clubId, ...res });
  } catch (err) {
    logger.error(`Falha ao recalcular o ranking do clube ${clubId}:`, err);
  }
}

/** Mapeia uids de um match → clubes que precisam recalcular. */
async function clubIdsForUids(db, uids) {
  if (!uids || uids.length === 0) return new Set();
  const set = new Set();
  const CHUNK = 30;
  for (let i = 0; i < uids.length; i += CHUNK) {
    const slice = uids.slice(i, i + CHUNK);
    const snap = await db.collection('athlete_profiles').where('__name__', 'in', slice).get();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (Array.isArray(data.club_ids)) data.club_ids.forEach((cid) => set.add(cid));
    });
  }
  return set;
}

// (1) Jogos do clube: subcoleção `club_events/{eventId}/games/{gameId}`.
//     Mudança aqui afeta o clube dono do evento.
exports.recomputeClubRankingOnClubGame = onDocumentWritten(
  {
    document: 'club_events/{eventId}/games/{gameId}',
    database: DATABASE_ID,
    region: REGION,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (event) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    const eventSnap = await db.collection('club_events').doc(event.params.eventId).get();
    if (!eventSnap.exists) return;
    const clubId = eventSnap.data().club_id;
    await recalcOneClub(clubId);
  },
);

// (2) `club_event_games` (Wave C): o espelhamento é top-level.
//     Mudança aqui pode afetar o clube dono + clubes dos uids externos.
exports.recomputeClubRankingOnClubEventGame = onDocumentWritten(
  {
    document: 'club_event_games/{gameId}',
    database: DATABASE_ID,
    region: REGION,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (event) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    const data = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const payload = data || before;
    if (!payload) return;
    const affected = new Set();
    if (payload.club_id) affected.add(payload.club_id);
    const uids = []
      .concat(payload.side_a_ids || [])
      .concat(payload.side_b_ids || []);
    const extraClubs = await clubIdsForUids(db, uids);
    extraClubs.forEach((c) => affected.add(c));
    for (const clubId of affected) {
      // eslint-disable-next-line no-await-in-loop
      await recalcOneClub(clubId);
    }
  },
);

// (3) `tournament_matches`: mudança pode afetar vários clubes.
exports.recomputeClubRankingOnTournamentMatch = onDocumentWritten(
  {
    document: 'tournament_matches/{matchId}',
    database: DATABASE_ID,
    region: REGION,
    timeoutSeconds: 180,
    memory: '512MiB',
  },
  async (event) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    const data = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const payload = data || before;
    if (!payload) return;
    // Resolve registration → uids
    const regIds = []
      .concat(payload.side_a_ids || [])
      .concat(payload.side_b_ids || []);
    if (regIds.length === 0) return;
    const regSnap = await db.getAll(
      ...regIds.slice(0, 30).map((rid) => db.collection('tournament_registrations').doc(rid)),
    );
    const uids = new Set();
    regSnap.forEach((s) => {
      const d = s.data();
      if (d && d.player_a_user_id) uids.add(d.player_a_user_id);
      if (d && d.player_b_user_id) uids.add(d.player_b_user_id);
    });
    if (uids.size === 0) return;
    const affected = await clubIdsForUids(db, Array.from(uids));
    for (const clubId of affected) {
      // eslint-disable-next-line no-await-in-loop
      await recalcOneClub(clubId);
    }
  },
);

// (4) Membership muda (`club_members/{memberId}`): recalcula o clube.
exports.recomputeClubRankingOnMemberChange = onDocumentWritten(
  {
    document: 'club_members/{memberId}',
    database: DATABASE_ID,
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const payload = after || before;
    if (!payload) return;
    await recalcOneClub(payload.club_id);
  },
);

// (5) `athlete_profiles/{uid}` mudou `club_ids`: recalcula cada clube.
exports.recomputeClubRankingOnAthleteProfileChange = onDocumentWritten(
  {
    document: 'athlete_profiles/{uid}',
    database: DATABASE_ID,
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const afterIds = new Set((after && after.club_ids) || []);
    const beforeIds = new Set((before && before.club_ids) || []);
    const all = new Set([...afterIds, ...beforeIds]);
    for (const clubId of all) {
      // eslint-disable-next-line no-await-in-loop
      await recalcOneClub(clubId);
    }
  },
);

// (6) Admin: recalcular todos os clubes (backfill). Callable.
const { onCall, HttpsError } = require('firebase-functions/v2/https');

async function isPlatformAdminUser(req, db) {
  if (!req || !req.auth) return false;
  // 1) Custom claim (rápido).
  if (req.auth.token && req.auth.token.platform_admin) return true;
  // 2) Fallback: doc users/{uid}.role === 'platform_admin'.
  try {
    const userSnap = await db.collection('users').doc(req.auth.uid).get();
    if (userSnap.exists && userSnap.data().role === 'platform_admin') return true;
  } catch (err) {
    // silencioso
  }
  return false;
}

exports.recomputeAllClubInternalRankings = onCall(
  {
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (req) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    if (!(await isPlatformAdminUser(req, db))) {
      throw new HttpsError('permission-denied', 'Apenas platform_admin pode recalcular todos os clubes.');
    }
    const clubsSnap = await db.collection('clubs').get();
    let processed = 0;
    let failed = 0;
    const errors = [];
    for (const d of clubsSnap.docs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await recomputeClubInternalRankings(db, d.id);
        processed += 1;
      } catch (err) {
        failed += 1;
        const msg = (err && err.message) ? err.message : String(err);
        errors.push({ clubId: d.id, error: msg });
        logger.error(`Falha ao recalcular clube ${d.id}:`, err);
      }
    }
    return { processed, failed, total: clubsSnap.size, errors };
  },
);

exports.recomputeOneClubInternalRanking = onCall(
  {
    region: REGION,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (req) => {
    if (!req.auth || !req.auth.token) {
      throw new HttpsError('unauthenticated', 'Faça login para recalcular.');
    }
    const { clubId } = req.data || {};
    if (!clubId) throw new HttpsError('invalid-argument', 'clubId obrigatório');
    const db = getFirestore(getApp(), DATABASE_ID);
    logger.info(`recomputeOneClubInternalRanking START: clubId=${clubId}, uid=${req.auth.uid}`);
    // Admins do clube OU platform admin podem disparar.
    const isAdmin = await isPlatformAdminUser(req, db);
    if (!isAdmin) {
      const memberSnap = await db.collection('club_members').doc(`${clubId}_${req.auth.uid}`).get();
      if (!memberSnap.exists || memberSnap.data().role !== 'admin') {
        throw new HttpsError('permission-denied', 'Apenas admins do clube ou platform admin podem recalcular.');
      }
    }
    try {
      const res = await recomputeClubInternalRankings(db, clubId);
      logger.info(`recomputeOneClubInternalRanking OK: clubId=${clubId}`, JSON.stringify(res.counts || {}));
      return res;
    } catch (err) {
      logger.error(`recomputeOneClubInternalRanking FAIL: clubId=${clubId}`, err);
      throw err;
    }
  },
);

// =====================================================================
// CLUBE — Recálculo mensal de defesa (Wave C.4)
// =====================================================================
// Garante que TODOS os clubes tenham seu ranking materializado
// atualizado pelo menos uma vez por mês — proteção contra
// qualquer inconsistência acumulada por falhas pontuais nos
// gatilhos em tempo real.
exports.recomputeAllClubsMonthly = onSchedule(
  {
    schedule: '0 4 1 * *', // dia 1 de cada mês, 4h (horário SP)
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    const clubsSnap = await db.collection('clubs').get();
    let ok = 0;
    let failed = 0;
    for (const d of clubsSnap.docs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await recomputeClubInternalRankings(db, d.id);
        ok += 1;
      } catch (err) {
        failed += 1;
        logger.error(`recomputeAllClubsMonthly: falha em ${d.id}:`, err);
      }
    }
    logger.info('recomputeAllClubsMonthly: concluído.', { ok, failed, total: clubsSnap.size });
    return { ok, failed, total: clubsSnap.size };
  },
);
