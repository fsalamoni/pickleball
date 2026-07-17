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
 */

const { initializeApp, getApps, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { recomputeAllRatings, isEligible } = require('./ranking');

if (!getApps().length) initializeApp();

const DATABASE_ID = 'pickleball';
const REGION = 'southamerica-east1';

setGlobalOptions({ region: REGION, maxInstances: 3 });

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
