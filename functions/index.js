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
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { recomputeAllRatings, isEligible } = require('./ranking');

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

