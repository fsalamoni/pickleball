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
 *  - expireStaleNotifications (sprint 1): aposentada em 2026-10-10 (no-op).
 *  - refreshLadderWeekly (sprint 5): agrega ladder de arenas ativas.
 *  - aggregateNpsDaily (sprint 6): consolida NPS por arena.
 *  - autoCloseChecklists (sprint 7): fecha checklists opening/closing do dia.
 *  - advanceOpenSlotWaitlist (2026-09-13): expira a promoção vencida da fila
 *    de espera e chama o próximo — o prazo existia e ninguém o cumpria.
 */

const { initializeApp, getApps, getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentWritten, onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { isEligible } = require('./ranking');
const {
  requestRankingRecompute, mudouResultado,
  CAMPOS_PARTIDA_TORNEIO, CAMPOS_INSCRICAO, CAMPOS_JOGO_EVENTO,
} = require('./platformRankings');
const { recuperarSeFaltou } = require('./rankingCatchUp');
const { recomputeClubInternalRankings } = require('./clubRanking');
const { recomputeSeasonRanking } = require('./seasonRanking');
const notificationPrefs = require('./notificationPrefs');
const avisoI18n = require('./avisoI18n');

if (!getApps().length) initializeApp();

const DATABASE_ID = 'pickleball';
const REGION = 'southamerica-east1';

setGlobalOptions({ region: REGION, maxInstances: 3 });

// =====================================================================
// RANKINGS DA PLATAFORMA
//
// TODO resultado publicado atualiza, NA HORA, os três rankings que dependem
// de partida: ELO/nacional, rating estilo DUPR (2.0–8.0) e ranking de duplas.
//
// Por que no servidor: materializar ranking é escrita em coleção que só o
// admin da plataforma pode escrever. Quem publica um dia de jogo quase nunca
// é o admin — a tentativa do cliente era recusada e morria num `catch`. Aqui
// roda com privilégio de servidor e funciona para qualquer pessoa.
//
// As rajadas (publicar um dia de jogo grava dezenas de partidas de uma vez)
// são coalescidas dentro de `requestRankingRecompute`: a primeira escrita
// recalcula, as demais marcam "pendente", e uma passada final fecha a conta.
// =====================================================================

/** Opções comuns dos gatilhos de ranking. */
const GATILHO_RANKING = {
  database: DATABASE_ID,
  region: REGION,
  timeoutSeconds: 540,
  memory: '512MiB',
};

const antes = (event) => (event.data && event.data.before && event.data.before.exists
  ? event.data.before.data() : null);
const depois = (event) => (event.data && event.data.after && event.data.after.exists
  ? event.data.after.data() : null);

/** Dispara o recálculo sem deixar o erro virar alerta de incidente. */
async function pedirRecalculo(motivo, contexto) {
  const db = getFirestore(getApp(), DATABASE_ID);
  try {
    const res = await requestRankingRecompute(db, motivo, { logger });
    if (!res.ran) logger.debug('Ranking: pedido coalescido.', { motivo, ...contexto });
    return res;
  } catch (err) {
    logger.error('Falha ao recalcular os rankings no servidor.', { motivo, ...contexto, err });
    return { ran: false, reason: 'error' };
  }
}

// (1) Torneio mudou de elegibilidade (encerrar, reabrir, arquivar, publicar).
exports.recomputeRankingOnTournamentChange = onDocumentWritten(
  { ...GATILHO_RANKING, document: 'tournaments/{tournamentId}' },
  async (event) => {
    // Só recalcula quando a elegibilidade para o ranking muda — ignora
    // edições irrelevantes (nome, descrição, banner...).
    if (!isEligible(antes(event)) && !isEligible(depois(event))) return;
    await pedirRecalculo('tournament-change', { tournamentId: event.params.tournamentId });
  },
);

// (2) Resultado de partida de TORNEIO.
exports.recomputeRankingOnTournamentMatch = onDocumentWritten(
  { ...GATILHO_RANKING, document: 'tournament_matches/{matchId}' },
  async (event) => {
    if (!mudouResultado(antes(event), depois(event), CAMPOS_PARTIDA_TORNEIO)) return;
    await pedirRecalculo('tournament-match', { matchId: event.params.matchId });
  },
);

// (2b) INSCRIÇÃO de torneio: quem é o atleta por trás daquela inscrição.
//
//      A partida guarda ids de INSCRIÇÃO, não uids — o ranking só descobre de
//      quem é o resultado resolvendo a inscrição. Então trocar/preencher o uid
//      de uma inscrição muda a quem o jogo pertence, sem tocar em partida
//      nenhuma. É o que acontece na migração de inscrições provisórias: o
//      atleta reivindica a vaga e todos os jogos dele passam a ser dele.
//
//      Sem este gatilho, isso dependia de um admin apertar "Recalcular ranking
//      agora" — e o botão saiu justamente porque o ranking não pode depender
//      de alguém lembrar.
exports.recomputeRankingOnTournamentRegistration = onDocumentWritten(
  { ...GATILHO_RANKING, document: 'tournament_registrations/{registrationId}' },
  async (event) => {
    if (!mudouResultado(antes(event), depois(event), CAMPOS_INSCRICAO)) return;
    await pedirRecalculo('tournament-registration', {
      registrationId: event.params.registrationId,
    });
  },
);

// (3) Resultado PUBLICADO de dia de jogo / evento de clube. É por aqui que
//     passa a publicação do dia de jogo (o espelho em `club_event_games`).
exports.recomputeRankingOnClubEventGame = onDocumentWritten(
  { ...GATILHO_RANKING, document: 'club_event_games/{gameId}' },
  async (event) => {
    if (!mudouResultado(antes(event), depois(event), CAMPOS_JOGO_EVENTO)) return;
    await pedirRecalculo('club-event-game', { gameId: event.params.gameId });
  },
);

// (4) RECUPERAÇÃO: o gatilho que não disparou.
//
//     Gatilho não tem fila: resultado escrito enquanto a função não existe
//     nunca é reprocessado. Em 2026-09-22 o deploy de outro aplicativo do
//     mesmo projeto Firebase apagou as funções daqui, e o dia de jogo
//     publicado naquela noite ficou fora do ranking 2.0–8.0 até alguém
//     perceber. A cada 30 min esta função compara o que a última passada leu
//     com o que o banco tem hoje (duas contagens + torneios) e só recalcula
//     quando falta alguma coisa — em dia, ela não grava nada.
exports.catchUpPlatformRankings = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      const res = await recuperarSeFaltou(db, { requestRankingRecompute, logger });
      if (res.ran) logger.info('Ranking: recuperação concluída.', res);
      return res;
    } catch (err) {
      logger.error('Ranking: falha na recuperação agendada.', { err });
      return { ran: false, reason: 'error' };
    }
  },
);

// =====================================================================
// expireStaleNotifications — APOSENTADA (2026-10-10)
// =====================================================================
// Marcava `archived: true` nos avisos não lidos com mais de 7 dias. Falhava
// TODO dia (`created_at <` + `read ==` pede índice composto que não existe) e,
// mesmo funcionando, não servia: ninguém lê `archived`, e a central de
// notificações guarda os avisos antigos de propósito (docs/36). Fica como
// no-op só porque o deploy é por nome e não apaga função: tirar a exportação
// deixaria a versão antiga rodando (e falhando) no projeto. Para removê-la de
// vez: `firebase functions:delete expireStaleNotifications --region
// southamerica-east1` e então apagar este bloco.
exports.expireStaleNotifications = onSchedule(
  {
    schedule: '0 3 1 1 *', // uma vez por ano: não há o que fazer
    timeZone: 'America/Sao_Paulo',
    region: REGION,
  },
  async () => ({ archived: 0 }),
);

// =====================================================================
// FILA DE ESPERA DO JOGO ABERTO — a fila que andava sozinha, e não andava
// =====================================================================
//
// 🐞 O que estava quebrado: a promoção tinha prazo (`notification_expires_at`)
// e NINGUÉM o cumpria. `expireStaleNotifications` do lado do cliente existia,
// mas não era chamada de lugar nenhum — e não poderia ser: expirar a promoção
// de OUTRA pessoa é escrita que o navegador dela não vai fazer. Resultado: se
// quem foi chamado não respondia, a vaga ficava presa para sempre e o próximo
// da fila nunca era avisado.
//
// Aqui, no servidor, a cada 10 minutos: expira o prazo vencido e chama o
// próximo — que é a única coisa que a fila de espera promete.
//
// Sem índice novo: um `where` de igualdade só, o resto conferido em memória.

const openSlotWaitlist = require('./openSlotWaitlist');

const ctxFila = () => ({
  db: getFirestore(getApp(), DATABASE_ID), Timestamp, agoraMs: Date.now(), logger,
});

exports.advanceOpenSlotWaitlist = onSchedule(
  {
    schedule: 'every 10 minutes',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
  },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    const agora = Date.now();
    try {
      const notificados = await db
        .collection('arena_waitlist')
        .where('status', '==', 'notified')
        .limit(300)
        .get();

      const vencidas = notificados.docs.filter((d) => openSlotWaitlist.venceu(d.data(), agora));
      if (vencidas.length === 0) return { expired: 0, promoted: 0 };

      // 1. Expira quem não respondeu no prazo.
      const lote = db.batch();
      vencidas.forEach((d) => lote.update(d.ref, {
        status: 'expired',
        expired_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      }));
      await lote.commit();

      // 2. Chama o próximo de cada vaga afetada — se ainda houver lugar. Numa
      // transação (`promoverProximo`): o gatilho da entrada, disparado por
      // esta mesma expiração, não chama uma segunda pessoa para o lugar.
      const slotIds = [...new Set(vencidas.map((d) => d.data()?.slot_id).filter(Boolean))];
      let promovidos = 0;
      for (const slotId of slotIds) {
        // eslint-disable-next-line no-await-in-loop
        const r = await openSlotWaitlist.promoverProximo({ db, Timestamp, agoraMs: agora, logger }, slotId);
        promovidos += r.promoted.length;
      }

      logger.info('advanceOpenSlotWaitlist: fila avançou.', {
        expired: vencidas.length, promoted: promovidos,
      });
      return { expired: vencidas.length, promoted: promovidos };
    } catch (err) {
      logger.error('advanceOpenSlotWaitlist: erro.', err);
      throw err;
    }
  },
);

/**
 * Alguém SAIU de uma vaga (2026-09-24): chama o próximo da fila na hora.
 *
 * Antes era o navegador de quem saía que tentava — e a regra recusava,
 * porque chamar o próximo é escrever na entrada de OUTRA pessoa.
 */
exports.promoteOpenSlotWaitlistOnSlot = onDocumentUpdated(
  { document: 'arena_open_slots/{slotId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    if (!openSlotWaitlist.vagaAbriuLugar(antes(event), depois(event))) return;
    try {
      await openSlotWaitlist.promoverProximo(ctxFila(), event.params.slotId);
    } catch (err) {
      logger.error('promoteOpenSlotWaitlistOnSlot: erro.', err);
    }
  },
);

/**
 * Uma chamada deixou de valer (recusada, expirada, apagada): o lugar que ela
 * segurava vai para o próximo — na hora, não em até 10 minutos.
 */
exports.promoteOpenSlotWaitlistOnEntry = onDocumentWritten(
  { document: 'arena_waitlist/{entryId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    const a = antes(event);
    if (!openSlotWaitlist.chamadaLiberouLugar(a, depois(event))) return;
    try {
      await openSlotWaitlist.promoverProximo(ctxFila(), a.slot_id);
    } catch (err) {
      logger.error('promoteOpenSlotWaitlistOnEntry: erro.', err);
    }
  },
);

// =====================================================================
// LISTA DE ESPERA DO PROFESSOR (2026-10-16) — ver functions/coachWaitlist.js
// =====================================================================
// O aluno sem horário livre entra em `coach_waitlist`; quando o professor
// abre horário (ou uma aula confirmada é desfeita), o servidor avisa a lista.
// Os mesmos gatilhos mantêm `coach_busy_slots/{coachId}` — os horários já
// confirmados, públicos e sem aluno, que o pedido de aula desconta.
// Consultas de igualdade (`coach_id`), sem índice novo.

const coachWaitlist = require('./coachWaitlist');

/** O professor salvou a disponibilidade: recalcula os ocupados e, se abriu horário, avisa a lista. */
exports.onCoachAvailabilityWritten = onDocumentWritten(
  { document: 'coach_availability/{coachId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    try {
      await coachWaitlist.aoMudarDisponibilidade(ctxFila(), event.params.coachId, antes(event), depois(event));
    } catch (err) {
      logger.error('onCoachAvailabilityWritten: erro.', err);
    }
  },
);

/**
 * Uma aula mudou: recalcula os horários ocupados do professor (públicos, sem
 * aluno) e, se uma confirmada foi desfeita, avisa a lista de espera.
 */
exports.onCoachLessonWritten = onDocumentWritten(
  { document: 'coach_lessons/{lessonId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    try {
      await coachWaitlist.aoMudarAula(ctxFila(), antes(event), depois(event));
    } catch (err) {
      logger.error('onCoachLessonWritten: erro.', err);
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
const messagingPolicy = require('./messagingPolicy');
const messaging = require('./messaging');

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

    // A categoria que a pessoa silenciou nas Configurações não vira push — o
    // sino já obedecia, o celular não. Sem conseguir ler as preferências, o
    // aviso segue (como antes): perder um aviso é pior que um a mais.
    // A mesma leitura traz o idioma da pessoa (`users.language`): o push sai
    // nele quando o aviso tem `i18n`. Sem conseguir ler, fica o português.
    let language = null;
    try {
      const userSnap = await db.collection('users').doc(String(n.user_id)).get();
      const prefs = userSnap.exists ? userSnap.data().notification_prefs : null;
      language = userSnap.exists ? userSnap.data().language || null : null;
      if (notificationPrefs.isNotificationMuted(prefs, n.type)) {
        logger.info('pushOnNotificationCreate: categoria silenciada, sem push.', { user: n.user_id, type: n.type });
        return;
      }
      // Com os avisos por e-mail e celular ligados, o push também obedece à
      // escolha por ÁREA e ao horário silencioso estendido ao celular.
      const ctxMsg = await messaging.loadContext(db);
      if (ctxMsg.flagOn) {
        const canais = messagingPolicy.normalizeUserChannels(userSnap.exists ? userSnap.data().notification_channels : null);
        const area = messagingPolicy.classifyNotice(n).area;
        const v = messagingPolicy.pushAllowed({ area }, { settings: ctxMsg.settings, prefs: canais, flagOn: true });
        if (!v.allowed) {
          logger.info('pushOnNotificationCreate: push desligado pela escolha de canais.', { user: n.user_id, reason: v.reason });
          return;
        }
      }
    } catch (err) {
      logger.warn('pushOnNotificationCreate: preferências ilegíveis; envia assim mesmo.', err);
    }

    const rawLink = n.link ? String(n.link) : '/';
    const link = rawLink.startsWith('http')
      ? rawLink
      : `${PWA_ORIGIN}${rawLink.startsWith('/') ? '' : '/'}${rawLink}`;

    const message = {
      notification: {
        title: String(avisoI18n.campoNoIdioma(n, 'title', language) || 'PickleRush').slice(0, 120),
        body: String(avisoI18n.campoNoIdioma(n, 'message', language)).slice(0, 300),
      },
      webpush: {
        fcmOptions: { link },
        notification: { icon: '/icones/app-claro-192-v1.png', badge: '/icones/aviso-badge-96-v1.png' },
      },
      data: { link, type: String(n.type || 'generic'), area: notificationPrefs.noticeArea(n) },
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

/**
 * Ranking sazonal da gamificação V2 (flag `gamification_v2`).
 *
 * Diário às 03h de Brasília: a temporada fica viva durante o mês em vez de
 * só existir no fechamento — o atleta precisa ver a posição mudar enquanto
 * ainda dá tempo de reagir.
 *
 * As regras do Firestore proíbem o cliente de escrever em `season_rankings`
 * (posição não se decide no navegador), então esta função é a única fonte.
 * É idempotente: recalcula tudo do zero a cada execução.
 */
exports.recomputeSeasonRankingDaily = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    try {
      const res = await recomputeSeasonRanking({ logger });
      return res;
    } catch (err) {
      logger.error('recomputeSeasonRankingDaily falhou:', err);
      // Não relança: é ranking, não pode virar alerta de incidente. A próxima
      // execução recalcula tudo do zero de qualquer forma.
      return { ranked: 0, error: String(err && err.message) };
    }
  },
);

// =====================================================================
// (7b) GAMIFICAÇÃO V2 — as tarefas que o navegador não pode decidir.
//
// Placar e prêmio dos desafios, duelo da semana, reputação das avaliações,
// sinais de integridade para o admin e o resumo da semana. Todas leem a flag
// mestra `gamification_v2` e os módulos ligados no painel do admin: com a
// flag desligada nada roda; com um módulo desligado, só ele para. Todas são
// idempotentes (prêmio e aviso têm id fixo) e nunca relançam o erro — é
// gamificação, não pode virar alerta de incidente; o próximo ciclo refaz.
// Lógica em `functions/gamification.js` (testada com um Firestore falso).
// =====================================================================
const gamification = require('./gamification');

/** Executa uma tarefa de gamificação sem deixar o erro virar incidente. */
async function rodarGamificacao(nome, tarefa) {
  const db = getFirestore(getApp(), DATABASE_ID);
  try {
    return await tarefa(db);
  } catch (err) {
    logger.error(`${nome} falhou.`, err);
    return { error: String(err && err.message) };
  }
}

// O placar dos desafios (e o fechamento dos que terminaram), a cada 3 horas.
exports.gamificationChallengeStandings = onSchedule(
  {
    schedule: 'every 3 hours',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => rodarGamificacao('gamificationChallengeStandings', (db) => gamification.runChallengeStandings(db, { logger })),
);

// Segunda de manhã: fecha os duelos da semana que passou e emparelha os novos.
exports.gamificationWeeklyDuels = onSchedule(
  {
    schedule: '30 5 * * 1',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => rodarGamificacao('gamificationWeeklyDuels', (db) => gamification.runWeeklyDuels(db, { logger })),
);

// Segunda às 8h: "Sua semana em revisão" (só para quem jogou, e só se quiser).
exports.gamificationWeeklyDigest = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => rodarGamificacao('gamificationWeeklyDigest', (db) => gamification.runWeeklyDigest(db, { logger })),
);

// Todo dia às 4h: reputação, sinais de integridade e o retrato das métricas.
exports.gamificationDailyUpkeep = onSchedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => rodarGamificacao('gamificationDailyUpkeep', async (db) => ({
    reputation: await gamification.runReputation(db, { logger }),
    integrity: await gamification.runIntegrity(db, { logger }),
    metrics: await gamification.runMetricsSnapshot(db, { logger }),
  })),
);

// =====================================================================
// (8) Admin: EXCLUIR CADASTRO. Callable.
//
// Prévia (só lê) e execução (refaz a análise aqui dentro e apaga). Motivo
// obrigatório, "EXCLUIR" digitado, 25 contas por vez, e SÓ o dono da
// plataforma executa — excluir é mais destrutivo que revogar poder, e a
// revogação também é só do dono. Todo o desenho, as travas e a ordem das
// operações estão em `functions/accountDeletion.js`.
// =====================================================================
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { FieldValue: FieldValueDel } = require('firebase-admin/firestore');
const accountDeletion = require('./accountDeletion');

exports.adminDeleteAccounts = onCall(
  {
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (req) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    if (!(await isPlatformAdminUser(req, db))) {
      throw new HttpsError('permission-denied', 'Só o admin da plataforma exclui cadastros.');
    }
    const pedido = accountDeletion.validateRequest(req.data || {});
    if (pedido.error) throw new HttpsError('invalid-argument', pedido.error);

    const token = (req.auth && req.auth.token) || {};
    if (pedido.mode === 'execute'
      && !(accountDeletion.isOwnerEmail(token.email) && token.email_verified !== false)) {
      throw new HttpsError('permission-denied', 'Só o dono da plataforma executa a exclusão de cadastros.');
    }

    let bucket = null;
    try {
      bucket = getStorage().bucket();
    } catch (err) {
      logger.warn('adminDeleteAccounts: Storage indisponível; arquivos não serão tocados.', err);
    }
    const ctx = { db, auth: getAuth(), bucket };
    const hojeISO = accountDeletion.hojeEmSaoPaulo();
    const actor = { uid: req.auth.uid, name: token.name || '', email: token.email || '' };

    // Uma conta por vez, de propósito: o lote de 25 fica dentro do prazo da
    // função, e uma falha numa conta não contamina as outras.
    const resultados = [];
    for (const uid of pedido.uids) {
      try {
        if (pedido.mode === 'preview') {
          // eslint-disable-next-line no-await-in-loop
          const { report } = await accountDeletion.analyzeAccount(ctx, uid, { actorUid: actor.uid, hojeISO });
          resultados.push({ uid, status: 'preview', report });
        } else {
          // eslint-disable-next-line no-await-in-loop
          resultados.push(await accountDeletion.executeAccountDeletion(ctx, uid, {
            actor, reason: pedido.reason, hojeISO, FieldValue: FieldValueDel,
          }));
        }
      } catch (err) {
        logger.error(`adminDeleteAccounts: falha em ${uid}`, err);
        resultados.push({ uid, status: 'error', error: 'Falha inesperada nesta conta. Nada mais foi feito nela.' });
      }
    }
    logger.info(`adminDeleteAccounts ${pedido.mode}: ${resultados.length} conta(s) por ${actor.uid}`);
    return { mode: pedido.mode, results: resultados };
  },
);

// =====================================================================
// UNIFICAR O HISTÓRICO de uma conta EXCLUÍDA numa conta que continua.
//
// O caso real: a pessoa tinha dois cadastros, um foi excluído, e os jogos dele
// seguiram no ranking como "Atleta" (uma posição sem perfil). A conta excluída
// era DELA — os números vão para a conta que ficou. Prévia para o admin,
// execução só do dono, conflito bloqueia. Ver `functions/accountMerge.js`.
// =====================================================================
const accountMerge = require('./accountMerge');

exports.adminMergeAccountHistory = onCall(
  {
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (req) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    if (!(await isPlatformAdminUser(req, db))) {
      throw new HttpsError('permission-denied', 'Só o admin da plataforma unifica cadastros.');
    }
    const pedido = accountMerge.validateMergeRequest(req.data || {});
    if (pedido.error) throw new HttpsError('invalid-argument', pedido.error);

    const token = (req.auth && req.auth.token) || {};
    if (pedido.mode === 'execute'
      && !(accountDeletion.isOwnerEmail(token.email) && token.email_verified !== false)) {
      throw new HttpsError('permission-denied', 'Só o dono da plataforma executa a unificação de cadastros.');
    }
    const ctx = { db, auth: getAuth() };
    try {
      if (pedido.mode === 'preview') {
        const { report } = await accountMerge.analyzeMerge(ctx, pedido.fromUid, pedido.intoUid);
        return { mode: 'preview', report };
      }
      const actor = { uid: req.auth.uid, name: token.name || '', email: token.email || '' };
      const res = await accountMerge.executeMerge(ctx, {
        fromUid: pedido.fromUid,
        intoUid: pedido.intoUid,
        reason: pedido.reason,
        actor,
        FieldValue: FieldValueDel,
        requestRankingRecompute,
        logger,
      });
      logger.info(`adminMergeAccountHistory: ${pedido.fromUid} → ${pedido.intoUid} (${res.status}) por ${actor.uid}`);
      return { mode: 'execute', ...res };
    } catch (err) {
      logger.error('adminMergeAccountHistory falhou', err);
      throw new HttpsError('internal', 'Falha inesperada na unificação. Rodar de novo é seguro: o que já foi transferido não é transferido duas vezes.');
    }
  },
);

// =====================================================================
// SUSPENDER / BLOQUEAR / REATIVAR uma conta, e o ACESSO DE SUPORTE com
// registro de leitura. Só o admin da plataforma; as travas da exclusão (a
// própria conta, outro admin, e-mail de dono) valem de novo no servidor.
// Ver `functions/accountStatus.js` e `functions/supportAccess.js`.
// =====================================================================
const accountStatus = require('./accountStatus');
const supportAccess = require('./supportAccess');

exports.adminSetAccountStatus = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (req) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    if (!(await isPlatformAdminUser(req, db))) {
      throw new HttpsError('permission-denied', 'Só o admin da plataforma suspende ou bloqueia contas.');
    }
    const pedido = accountStatus.validateStatusRequest(req.data || {});
    if (pedido.error) throw new HttpsError('invalid-argument', pedido.error);
    const token = (req.auth && req.auth.token) || {};
    const actor = { uid: req.auth.uid, name: token.name || '', email: token.email || '' };
    try {
      const res = await accountStatus.applyAccountStatus({ db, auth: getAuth() }, pedido, { actor });
      if (res.status === 'error') throw new HttpsError('failed-precondition', res.error);
      logger.info(`adminSetAccountStatus ${pedido.action} ${pedido.uid} por ${actor.uid}`);
      return res;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('adminSetAccountStatus falhou', err);
      throw new HttpsError('internal', 'Falha inesperada. Rodar de novo é seguro.');
    }
  },
);

exports.adminSupportReveal = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (req) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    if (!(await isPlatformAdminUser(req, db))) {
      throw new HttpsError('permission-denied', 'Só o admin da plataforma acessa dados de contato.');
    }
    const pedido = supportAccess.validateRevealRequest(req.data || {});
    if (pedido.error) throw new HttpsError('invalid-argument', pedido.error);
    const token = (req.auth && req.auth.token) || {};
    const actor = { uid: req.auth.uid, email: token.email || '' };
    const raw = req.rawRequest || {};
    try {
      return await supportAccess.revealFields({ db }, pedido, {
        actor, ip: raw.ip || '', userAgent: (raw.headers && raw.headers['user-agent']) || '',
      });
    } catch (err) {
      logger.error('adminSupportReveal falhou', err);
      throw new HttpsError('internal', err && err.message ? err.message : 'Falha inesperada.');
    }
  },
);

// =====================================================================
// Torneio: ligar o jogador provisório de uma inscrição à CONTA do atleta,
// trocando também nome, nível, categoria, foto e o e-mail OFICIAL (que o
// organizador não lê). Ver `functions/registrationLink.js`.
// =====================================================================
const registrationLink = require('./registrationLink');

exports.tournamentLinkRegistrationAccount = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const db = getFirestore(getApp(), DATABASE_ID);
    const pedido = registrationLink.validateLinkRequest(req.data || {});
    if (pedido.error) throw new HttpsError('invalid-argument', pedido.error);
    const actor = { uid: req.auth.uid, isPlatformAdmin: await isPlatformAdminUser(req, db) };
    try {
      const res = await registrationLink.applyRegistrationLink(
        { db, auth: getAuth(), FieldValue: FieldValueDel }, pedido, { actor },
      );
      if (res.status === 'denied') throw new HttpsError('permission-denied', res.error);
      if (res.status === 'error') throw new HttpsError('failed-precondition', res.error);
      logger.info(`tournamentLinkRegistrationAccount ${pedido.registrationId}/${pedido.slot} por ${actor.uid}`);
      return res;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('tournamentLinkRegistrationAccount falhou', err);
      throw new HttpsError('internal', 'Falha inesperada. Tentar de novo é seguro.');
    }
  },
);

// =====================================================================
// MERCADO (flag `marketplace`): pedido, oferta, avaliação e a rotina. A regra
// não deixa o navegador escrever nada disso — ver `functions/marketplace.js`.
// =====================================================================
const marketplace = require('./marketplace');

/** Chamada do Mercado: confere a conta e traduz o erro para a tela. */
function marketCallable(nome, fn) {
  return onCall({ region: REGION, timeoutSeconds: 60 }, async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const db = getFirestore(getApp(), DATABASE_ID);
    const actor = { uid: req.auth.uid, isPlatformAdmin: await isPlatformAdminUser(req, db) };
    try {
      return await fn({ db, FieldValue: FieldValueDel, now: Date.now(), logger }, actor, req.data || {});
    } catch (err) {
      if (err instanceof marketplace.MarketError) throw new HttpsError(err.code, err.message);
      if (err instanceof HttpsError) throw err;
      logger.error(`${nome} falhou`, err);
      throw new HttpsError('internal', 'Falha inesperada. Tente de novo.');
    }
  });
}

exports.marketPlaceOrders = marketCallable('marketPlaceOrders', (ctx, actor, data) => marketplace.placeOrders(ctx, actor.uid, data));
exports.marketOrderAction = marketCallable('marketOrderAction', marketplace.orderAction);
exports.marketOfferAction = marketCallable('marketOfferAction', marketplace.offerAction);
exports.marketSubmitReview = marketCallable('marketSubmitReview', marketplace.submitReview);
exports.marketGiftCardAction = marketCallable('marketGiftCardAction', marketplace.giftCardAction);

exports.marketHousekeeping = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'America/Sao_Paulo', region: REGION, timeoutSeconds: 300 },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    await marketplace.housekeeping({ db, FieldValue: FieldValueDel, now: Date.now(), logger });
  },
);

// =====================================================================
// FEDERAÇÕES (flag `federations`): revisão, filiação, cobrança, varredura e a
// verificação pública da carteirinha — ver `functions/federations.js`.
// =====================================================================
const federations = require('./federations');

/** Contexto comum das chamadas de federação. */
const fedCtx = () => ({ db: getFirestore(getApp(), DATABASE_ID), FieldValue: FieldValueDel, Timestamp, now: Date.now(), logger });

/** Chamada de federação: confere a conta e traduz o erro para a tela. */
function federationCallable(nome, fn, opts = {}) {
  return onCall({ region: REGION, timeoutSeconds: 60, ...opts }, async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const ctx = fedCtx();
    const token = req.auth.token || {};
    const actor = { uid: req.auth.uid, name: token.name || '', email: token.email || '', isPlatformAdmin: await isPlatformAdminUser(req, ctx.db) };
    try {
      return await fn(ctx, actor, req.data || {}, req);
    } catch (err) {
      if (err instanceof federations.FederationError) throw new HttpsError(err.code, err.message);
      if (err instanceof HttpsError) throw err;
      logger.error(`${nome} falhou`, err);
      throw new HttpsError('internal', 'Falha inesperada. Tente de novo.');
    }
  });
}

exports.federationReview = federationCallable('federationReview', federations.review);
exports.federationMembership = federationCallable('federationMembership', federations.membership);
exports.federationChargeConfirm = federationCallable('federationChargeConfirm', federations.chargeConfirm);

// Verificação pública da carteirinha: sem conta (o QR é lido por qualquer um).
exports.federationVerify = onCall({ region: REGION, timeoutSeconds: 30 }, async (req) => {
  try {
    return await federations.verify(fedCtx(), req.data || {});
  } catch (err) {
    if (err instanceof federations.FederationError) throw new HttpsError(err.code, err.message);
    logger.error('federationVerify falhou', err);
    throw new HttpsError('internal', 'Falha inesperada. Tente de novo.');
  }
});

// PR 3: transferências, cursos/credenciais, disciplina, importação e leitura de documentos — só o servidor grava.
const federationTransfers = require('./federationTransfers');
const federationCourses = require('./federationCourses');
const federationDiscipline = require('./federationDiscipline');
const federationSecretariat = require('./federationSecretariat');
exports.federationTransfer = federationCallable('federationTransfer', federationTransfers.transfer);
exports.federationCourse = federationCallable('federationCourse', federationCourses.course);
exports.federationDiscipline = federationCallable('federationDiscipline', federationDiscipline.discipline);
exports.federationImportMembers = federationCallable('federationImportMembers', federationSecretariat.importMembers);
// Conta nova com e-mail de uma importação sem conta: convite da federação (nunca filiação direta).
exports.federationImportInvite = onDocumentCreated(
  { document: 'users/{uid}', database: DATABASE_ID, region: REGION, timeoutSeconds: 120 },
  async (event) => {
    try {
      const snap = event.data;
      const user = snap && typeof snap.data === 'function' ? snap.data() : null;
      if (user) await federationSecretariat.onUserCreated(fedCtx(), event.params.uid, user);
    } catch (err) {
      logger.error('federationImportInvite falhou', err);
    }
  },
);
const federationNews = require('./federationNews');
exports.federationNews = federationCallable('federationNews', federationNews.notify);
// Notícia agendada: a cada 15 min publica a que chegou a hora (e avisa, se pedido).
exports.federationNewsPublish = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'America/Sao_Paulo', region: REGION, timeoutSeconds: 300 },
  async () => {
    try {
      await federationNews.publishDue(fedCtx());
    } catch (err) {
      logger.error('federationNewsPublish falhou', err);
    }
  },
);
// Cargos, mandatos e admins master (só o servidor grava a equipe) — `functions/federationStaff.js`.
const federationStaff = require('./federationStaff');
exports.federationStaff = federationCallable('federationStaff', federationStaff.staff);
// O admin da plataforma entra numa federação só com motivo e prazo; o registro vai para `admin_access_logs`.
exports.federationAdminAccess = federationCallable('federationAdminAccess', (ctx, actor, data, req) => {
  const raw = (req && req.rawRequest) || {};
  return federationStaff.adminAccess(ctx, actor, data, { ip: raw.ip || '', userAgent: (raw.headers && raw.headers['user-agent']) || '' });
});
// Acervo oficial (normas, atos, atas, transparência): só o servidor grava — `functions/federationAcervo.js`.
// Publicar copia e confere arquivos de até 100 MB (SHA-256): mais tempo e memória.
const federationAcervo = require('./federationAcervo');
exports.federationAcervo = federationCallable('federationAcervo', (ctx, actor, data) => {
  let bucket = null;
  try { bucket = getStorage().bucket(); } catch (err) { logger.warn('federationAcervo: Storage indisponível.', err); }
  return federationAcervo.acervo({ ...ctx, bucket }, actor, data);
}, { timeoutSeconds: 540, memory: '1GiB' });
// Pix com baixa automática (Mercado Pago/Asaas da conta da federação) — `functions/federationPayments.js`.
const federationPayments = require('./federationPayments');
exports.federationPayments = federationCallable('federationPayments', federationPayments.payments);
// Carteirinha no Apple Wallet e no Google Wallet (credenciais da plataforma) — `functions/federationWallet.js`.
const federationWallet = require('./federationWallet');
exports.federationWallet = federationCallable('federationWallet', federationWallet.wallet);
// Calendário oficial (agenda esportiva e institucional): só o servidor grava — `functions/federationAgenda.js`.
const federationAgenda = require('./federationAgenda');
exports.federationAgenda = federationCallable('federationAgenda', federationAgenda.agenda);
// Orçamento e prestação de contas (módulo `accounts`): só o servidor grava — `functions/federationAccounts.js`.
const federationAccounts = require('./federationAccounts');
exports.federationAccounts = federationCallable('federationAccounts', (ctx, actor, data) => {
  let bucket = null;
  try { bucket = getStorage().bucket(); } catch (err) { logger.warn('federationAccounts: Storage indisponível.', err); }
  return federationAccounts.accounts({ ...ctx, bucket }, actor, data);
}, { timeoutSeconds: 120, memory: '512MiB' });
// Eleições (edital, chapas, voto secreto ponderado, apuração): só o servidor grava — `functions/federationElections.js`.
exports.federationElections = federationCallable('federationElections', require('./federationElections').elections);
// Comentários nos documentos do acervo e nos eventos da agenda: só o servidor grava; a lista é pública (também sem conta).
const federationComments = require('./federationComments');
exports.federationComments = federationCallable('federationComments', federationComments.comments);
exports.federationCommentsList = onCall({ region: REGION, timeoutSeconds: 30 }, async (req) => {
  const ctx = fedCtx();
  try {
    const actor = req.auth ? { uid: req.auth.uid, name: (req.auth.token || {}).name || '', email: (req.auth.token || {}).email || '', isPlatformAdmin: await isPlatformAdminUser(req, ctx.db) } : null;
    return await federationComments.list(ctx, actor, req.data || {});
  } catch (err) {
    if (err instanceof federations.FederationError) throw new HttpsError(err.code, err.message);
    logger.error('federationCommentsList falhou', err);
    throw new HttpsError('internal', 'Falha inesperada. Tente de novo.');
  }
});
exports.federationDocument =federationCallable('federationDocument', (ctx, actor, data) => {
  let bucket = null;
  try { bucket = getStorage().bucket(); } catch (err) { logger.warn('federationDocument: Storage indisponível.', err); }
  return federationSecretariat.document({ ...ctx, bucket }, actor, data);
});

// Arbitragem (quadro, escalas, súmulas, avaliações e diárias): só o servidor grava — `functions/federationReferees.js`.
// O quadro público e quem apita cada evento saem por uma função à parte, também sem conta (sem valor, nota nem conflito).
const federationReferees = require('./federationReferees');
exports.federationReferees = federationCallable('federationReferees', federationReferees.referees);
exports.federationRefereesPublic = onCall({ region: REGION, timeoutSeconds: 30 }, async (req) => {
  const ctx = fedCtx();
  try {
    const actor = req.auth ? { uid: req.auth.uid, name: (req.auth.token || {}).name || '', email: (req.auth.token || {}).email || '', isPlatformAdmin: await isPlatformAdminUser(req, ctx.db) } : null;
    return await federationReferees.publico(ctx, actor, req.data || {});
  } catch (err) {
    if (err instanceof federations.FederationError) throw new HttpsError(err.code, err.message);
    logger.error('federationRefereesPublic falhou', err);
    throw new HttpsError('internal', 'Falha inesperada. Tente de novo.');
  }
});

// Regularidade do filiado (nível oficial, consentimentos, ocorrências) e a
// validade dos documentos: só o servidor grava — `functions/federationRegularity.js`.
const federationRegularity = require('./federationRegularity');
exports.federationRegularity = federationCallable('federationRegularity', federationRegularity.regularity);
exports.federationDocumentsOnWrite = onDocumentWritten(
  { document: 'federation_documents_submitted/{docId}', database: DATABASE_ID, region: REGION, timeoutSeconds: 60 },
  async (event) => {
    try {
      await federationRegularity.onDocumentWritten(fedCtx(), antes(event), depois(event));
    } catch (err) {
      logger.error('federationDocumentsOnWrite falhou', err);
    }
  },
);

// Competições (Bloco 2): o pedido de chancela é conferido pelo servidor
// (antecedência, diretor credenciado, taxa da categoria), a chancela aprovada
// abre o relatório do diretor, e a final do circuito convida pelo ranking —
// `functions/federationCompetitions.js`.
const federationCompetitions = require('./federationCompetitions');
exports.federationCompetition = federationCallable('federationCompetition', federationCompetitions.competition);
exports.federationSanctionSync = onDocumentWritten(
  { document: 'tournaments/{tournamentId}', database: DATABASE_ID, region: REGION, timeoutSeconds: 60 },
  async (event) => {
    const a = antes(event);
    const d = depois(event);
    // Torneio sem federação (quase todos) sai sem ler nada.
    if (!(a && a.federation_id) && !(d && d.federation_id)) return;
    try {
      await federationCompetitions.onTournamentWritten(fedCtx(), a, d, event.params.tournamentId);
    } catch (err) {
      logger.error('federationSanctionSync falhou', err);
    }
  },
);

// Seleção e editais (Bloco 3): convocação pelo ranking com suplente automático,
// documentos de viagem, uniforme e custos; editais de apoio ao atleta com
// inscrição, resultado, recurso e pagamento — `functions/federationSelection.js`.
const federationSelection = require('./federationSelection');
exports.federationSelection = federationCallable('federationSelection', federationSelection.selection);

// Licença de professor e proteção de menores (Bloco 4): concessão com
// requisitos conferidos, selo público no perfil do professor, certidão de
// antecedentes conferida pelo responsável (o arquivo é apagado depois) e a
// denúncia de proteção de menor avisando na hora — `functions/federationCoaching.js`.
const federationCoaching = require('./federationCoaching');
exports.federationCoaching = federationCallable('federationCoaching', (ctx, actor, data) => {
  let bucket = null;
  try { bucket = getStorage().bucket(); } catch (err) { logger.warn('federationCoaching: Storage indisponível.', err); }
  return federationCoaching.coaching({ ...ctx, bucket }, actor, data);
});
exports.federationMinorReportNotify = onDocumentCreated(
  { document: 'federation_reports/{reportId}', database: DATABASE_ID, region: REGION, timeoutSeconds: 60 },
  async (event) => {
    const d = event.data && event.data.data();
    if (!d || d.kind !== 'minor_protection') return;
    try {
      await federationCoaching.onReportCreated(fedCtx(), d);
    } catch (err) {
      logger.error('federationMinorReportNotify falhou', err);
    }
  },
);

// Contratos de patrocínio e patrimônio (Bloco 5): parcelas recebidas entram
// nas contas como receita, contrapartidas com entrega, inventário de bens com
// empréstimo e devolução — `functions/federationManagement.js`.
const federationManagement = require('./federationManagement');
exports.federationManagement = federationCallable('federationManagement', federationManagement.management);

// Jogo limpo (rodada 3, Bloco 1): a lista de equipamentos homologados, com
// situação, data e motivo — `functions/federationIntegrity.js`.
const federationIntegrity = require('./federationIntegrity');
exports.federationIntegrity = federationCallable('federationIntegrity', federationIntegrity.integrity);

// Regularidade da própria federação (rodada 3, Bloco 2): o cofre de certidões
// (arquivo fechado, aviso antes de vencer) e os projetos da Lei de Incentivo
// ao Esporte, com os aportes entrando nas contas — `functions/federationInstitutional.js`.
const federationInstitutional = require('./federationInstitutional');
exports.federationInstitutional = federationCallable('federationInstitutional', (ctx, actor, data) => {
  let bucket = null;
  try { bucket = getStorage().bucket(); } catch (err) { logger.warn('federationInstitutional: Storage indisponível.', err); }
  return federationInstitutional.institutional({ ...ctx, bucket }, actor, data);
}, { timeoutSeconds: 120, memory: '512MiB' });

// Rede e desenvolvimento (rodada 3, Bloco 3): embaixadores regionais (código
// de conduta, nomeação, relatório periódico, lista pública) e selo de clube
// certificado (evidências, conferência automática, validade) —
// `functions/federationDevelopment.js`.
const federationDevelopment = require('./federationDevelopment');
exports.federationDevelopment = federationCallable('federationDevelopment', (ctx, actor, data) => {
  let bucket = null;
  try { bucket = getStorage().bucket(); } catch (err) { logger.warn('federationDevelopment: Storage indisponível.', err); }
  return federationDevelopment.development({ ...ctx, bucket }, actor, data);
}, { timeoutSeconds: 120, memory: '512MiB' });

// Sedes e Copa (rodada 3, Bloco 3): edital de sede de campeonato (cartas,
// propostas, notas ponderadas, resultado publicado) e Copa das Federações
// (elencos das estaduais aprovados pela confederação) —
// `functions/federationHosting.js`.
const federationHosting = require('./federationHosting');
exports.federationHosting = federationCallable('federationHosting', (ctx, actor, data) => {
  let bucket = null;
  try { bucket = getStorage().bucket(); } catch (err) { logger.warn('federationHosting: Storage indisponível.', err); }
  return federationHosting.hosting({ ...ctx, bucket }, actor, data);
}, { timeoutSeconds: 120, memory: '512MiB' });

// Pickleball adaptado (rodada 3, Bloco 4b): categorias adaptadas, pedido de
// classificação com laudo (guardado em pasta fechada), decisão da comissão e
// a conferência dos inscritos numa modalidade adaptada —
// `functions/federationAdapted.js`.
const federationAdapted = require('./federationAdapted');
exports.federationAdapted = federationCallable('federationAdapted', (ctx, actor, data) => {
  let bucket = null;
  try { bucket = getStorage().bucket(); } catch (err) { logger.warn('federationAdapted: Storage indisponível.', err); }
  return federationAdapted.adapted({ ...ctx, bucket }, actor, data);
}, { timeoutSeconds: 120, memory: '512MiB' });

// Seguro (rodada 3, Bloco 5): o aceite do termo do seguro e o certificado de
// seguro para eventos de clube/arena, com QR de verificação pública —
// `functions/federationInsurance.js`.
const federationInsurance = require('./federationInsurance');
exports.federationInsurance = federationCallable('federationInsurance', federationInsurance.insurance);

// Camada nacional (Bloco 6): vínculo das estaduais com a confederação, regras
// da rede e repasse da anuidade; o ranking nacional é refeito junto com o
// ranking de cada filiada — `functions/federationNational.js`.
const federationNational = require('./federationNational');
exports.federationNational = federationCallable('federationNational', federationNational.national);
// Repasses da cobrança dividida (rodada 3, Bloco 6d): o financeiro marca o que repassou ao clube
// e à confederação — `functions/federationSplit.js`.
const federationSplit = require('./federationSplit');
exports.federationSplit = federationCallable('federationSplit', federationSplit.split);

exports.federationMembershipSweep = onSchedule(
  { schedule: 'every day 06:00', timeZone: 'America/Sao_Paulo', region: REGION, timeoutSeconds: 540 },
  async () => {
    // Cada varredura falha sozinha: a das transferências não pode ficar sem rodar porque a das filiações caiu.
    const resultados = await Promise.allSettled([federations.sweep(fedCtx()), federationTransfers.sweep(fedCtx()), federationDiscipline.sweep(fedCtx()), federationStaff.sweep(fedCtx()), federationReferees.sweep(fedCtx()), federationRegularity.sweep(fedCtx()), federationCompetitions.sweep(fedCtx()), federationSelection.sweep(fedCtx()), federationCoaching.sweep(fedCtx()), federationManagement.sweep(fedCtx()), federationNational.sweep(fedCtx()), federationInstitutional.sweep(fedCtx()), federationDevelopment.sweep(fedCtx()), federationHosting.sweep(fedCtx()), federationAdapted.sweep(fedCtx())]);
    resultados.filter((r) => r.status === 'rejected').forEach((r) => logger.error('federationMembershipSweep: uma varredura falhou', r.reason));
  },
);

// Ranking oficial: resultado enviado/reenviado/recusado/retirado → os
// lançamentos daquele resultado no histórico dos atletas são acertados
// (`federation_points`) e a temporada é somada de novo; a configuração do
// ranking mudou → só as temporadas ABERTAS são somadas de novo (o ponto já
// lançado não muda). Temporada fechada (depois de 31/01 do ano seguinte) é
// imutável. Só o servidor grava `federation_points` e `federation_rankings`
// (`functions/federationRanking.js`). Nada roda por agenda.
const federationRanking = require('./federationRanking');
exports.federationRankingRecompute = onDocumentWritten(
  { document: 'federation_results/{resultId}', database: DATABASE_ID, region: REGION, timeoutSeconds: 120 },
  async (event) => {
    try {
      await federationRanking.onResultWritten(fedCtx(), antes(event), depois(event), event.params.resultId);
    } catch (err) {
      logger.error('federationRankingRecompute falhou', err);
    }
  },
);
exports.federationRankingConfig = onDocumentWritten(
  { document: 'federations/{fedId}', database: DATABASE_ID, region: REGION, timeoutSeconds: 300 },
  async (event) => {
    try {
      await federationRanking.onFederationWritten(fedCtx(), event.params.fedId, antes(event), depois(event));
    } catch (err) {
      logger.error('federationRankingConfig falhou', err);
    }
  },
);
// APOSENTADA (2026-10-22): a varredura diária do ranking "corrido" saiu — o
// ranking oficial é por lançamento e por ano, sem agenda. Fica como no-op (uma
// vez por ano) porque o deploy é por nome e não apaga função publicada; remover
// de vez com `firebase functions:delete federationRankingRolling --region
// southamerica-east1` e então apagar estas linhas.
exports.federationRankingRolling = onSchedule(
  { schedule: '0 3 1 1 *', timeZone: 'America/Sao_Paulo', region: REGION },
  async () => ({ retired: true }),
);

// Favorito entra/sai → contador do anúncio (o navegador não escreve o contador).
exports.marketFavoriteCount = onDocumentWritten(
  { document: 'market_favorites/{favId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    const a = antes(event);
    const d = depois(event);
    const delta = (d ? 1 : 0) - (a ? 1 : 0);
    const listingId = (d || a || {}).listing_id;
    if (!delta || !listingId) return;
    const db = getFirestore(getApp(), DATABASE_ID);
    const ref = db.collection('market_listings').doc(listingId);
    try {
      await ref.update({ favorite_count: FieldValueDel.increment(delta) });
    } catch (err) {
      logger.debug('Mercado: favorito de anúncio que não existe mais.', { listingId });
    }
  },
);

// Seguir / deixar de seguir uma loja → contagem no vendedor.
exports.marketFollowCount = onDocumentWritten(
  { document: 'market_follows/{followId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    const a = antes(event);
    const d = depois(event);
    const delta = (d ? 1 : 0) - (a ? 1 : 0);
    const sellerKey = (d || a || {}).seller_key;
    if (!delta || !sellerKey) return;
    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      await db.collection('market_sellers').doc(sellerKey).update({ follower_count: FieldValueDel.increment(delta) });
    } catch (err) {
      logger.debug('Mercado: seguidor de loja que não existe mais.', { sellerKey });
    }
  },
);

// Anúncio entrou no ar → aviso a quem segue a loja (uma vez por anúncio).
exports.marketFollowersNotify = onDocumentWritten(
  { document: 'market_listings/{listingId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    const a = antes(event);
    const d = depois(event);
    if (!d || d.status !== 'active' || (a && a.status === 'active') || d.followers_notified_at_ms) return;
    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      await marketplace.notifyFollowers({ db, now: Date.now() }, event.params.listingId, a, d);
    } catch (err) {
      logger.warn('Mercado: aviso aos seguidores não enviado.', { listingId: event.params.listingId, err: err && err.message });
    }
  },
);

// Pergunta feita ou respondida → aviso para o outro lado.
exports.marketQuestionNotify = onDocumentWritten(
  { document: 'market_questions/{questionId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    const db = getFirestore(getApp(), DATABASE_ID);
    await marketplace.notifyQuestion({ db, now: Date.now() }, event.params.questionId, antes(event), depois(event));
  },
);

// Anúncio publicado ou editado → moderação automática por termo proibido.
exports.marketModerateListing = onDocumentWritten(
  { document: 'market_listings/{listingId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    const d = depois(event);
    const a = antes(event);
    if (!d) return;
    if (a && a.title === d.title && a.description === d.description && a.status === d.status) return;
    const db = getFirestore(getApp(), DATABASE_ID);
    await marketplace.moderateListing({ db, now: Date.now() }, event.params.listingId, d);
  },
);

// Buscas salvas: um aviso por dia por busca, quando chegou anúncio novo.
exports.marketSavedSearchAlerts = onSchedule(
  { schedule: 'every day 10:00', timeZone: 'America/Sao_Paulo', region: REGION, timeoutSeconds: 300 },
  async () => {
    const db = getFirestore(getApp(), DATABASE_ID);
    await marketplace.savedSearchAlerts({ db, now: Date.now(), logger });
  },
);

// O preço baixou → aviso para quem favoritou o anúncio.
exports.marketPriceDropNotify = onDocumentWritten(
  { document: 'market_listings/{listingId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    const a = antes(event);
    const d = depois(event);
    if (!a || !d || !(Number(d.price_cents) < Number(a.price_cents))) return;
    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      await marketplace.notifyPriceDrop({ db, now: Date.now() }, event.params.listingId, a, d);
    } catch (err) {
      logger.warn('Mercado: aviso de preço não enviado.', { listingId: event.params.listingId, err: err && err.message });
    }
  },
);

// Estoque único da arena: liga um anúncio a um produto do estoque, e cada
// mudança do produto refaz a quantidade do anúncio (ver `marketplace.js`).
exports.marketLinkArenaProduct = marketCallable('marketLinkArenaProduct', marketplace.linkArenaProduct);

exports.marketArenaStockSync = onDocumentWritten(
  { document: 'arena_inventory_products/{productId}', database: DATABASE_ID, region: REGION },
  async (event) => {
    const a = antes(event);
    const d = depois(event);
    if (!(a && a.market_listing_id) && !(d && d.market_listing_id)) return;
    if (a && d && a.stock_qty === d.stock_qty && a.market_listing_id === d.market_listing_id) return;
    const db = getFirestore(getApp(), DATABASE_ID);
    try {
      await marketplace.syncArenaListing({ db, now: Date.now() }, event.params.productId, a, d);
    } catch (err) {
      logger.warn('Mercado: estoque da arena não refletido no anúncio agora.', { productId: event.params.productId, err: err && err.message });
    }
  },
);

// =====================================================================
// ERROS DO NAVEGADOR → Error Reporting. O aplicativo manda para `/api/erro`
// (rewrite do Hosting); a validação e o formato moram em `clientErrors.js`.
// Pública de propósito: o erro pode acontecer antes do login (tela branca).
// =====================================================================
const { onRequest } = require('firebase-functions/v2/https');
const clientErrors = require('./clientErrors');

const dentroDoLimiteDeErros = clientErrors.criarLimite();

exports.clientErrorReport = onRequest(
  { region: REGION, maxInstances: 2, memory: '256MiB', invoker: 'public' },
  (req, res) => {
    if (req.method !== 'POST') { res.status(405).end(); return; }
    if (dentroDoLimiteDeErros()) {
      const entrada = clientErrors.entradaDeLog(clientErrors.lerCorpo(req), { userAgent: req.get('user-agent') || '' });
      if (entrada) logger.write(entrada);
    }
    res.status(204).end();
  },
);

// Agenda ASSINÁVEL da federação (`/api/agenda/{slug}.ics`, rewrite do Hosting):
// só o que é público. Sem conta, de propósito: é o endereço que o celular assina.
exports.federationAgendaFeed = onRequest(
  { region: REGION, maxInstances: 3, memory: '256MiB', invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).end(); return; }
    const m = String(req.path || '').match(/\/api\/agenda\/([A-Za-z0-9_-]{1,80})\.ics$/);
    if (!m) { res.status(404).end(); return; }
    try {
      const ics = await federationAgenda.feed(fedCtx(), m[1]);
      if (!ics) { res.status(404).type('text/plain').send('Agenda não encontrada.'); return; }
      res.set('Cache-Control', 'public, max-age=900, s-maxage=900');
      res.set('Content-Disposition', `inline; filename="agenda-${m[1]}.ics"`);
      res.type('text/calendar; charset=utf-8').send(ics);
    } catch (err) {
      logger.error('federationAgendaFeed falhou', err);
      res.status(500).end();
    }
  },
);

// Aviso do provedor de Pix da federação (`/api/federacao/pix/{fed}/{token}`, rewrite
// do Hosting). Sem conta, de propósito; o corpo não é confiado — o servidor busca
// o pagamento no provedor com a chave da federação (`federationPayments.hook`).
exports.federationPixHook = onRequest(
  { region: REGION, maxInstances: 5, memory: '256MiB', invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST' && req.method !== 'GET') { res.status(405).end(); return; }
    const m = String(req.path || '').match(/\/api\/federacao\/pix\/([A-Za-z0-9_-]{1,80})\/([a-f0-9]{48})$/);
    if (!m) { res.status(404).end(); return; }
    const status = await federationPayments.hook(fedCtx(), { fedId: m[1], token: m[2], body: req.body || {}, query: req.query || {} });
    res.status(status).end();
  },
);

// Carteirinha no Apple Wallet: o download do `.pkpass` (link com token por
// filiação) e o serviço web da Apple (`/api/carteira/apple/v1/...`), que cada
// iPhone chama para registrar o aparelho e buscar o passe atualizado.
exports.federationWalletHook = onRequest(
  { region: REGION, maxInstances: 5, memory: '256MiB', invoker: 'public' },
  async (req, res) => {
    try {
      const r = await federationWallet.hook(fedCtx(), { method: req.method, path: req.path, headers: req.headers || {}, body: req.body || {}, query: req.query || {} });
      Object.entries(r.headers || {}).forEach(([k, v]) => res.set(k, v));
      res.status(r.status).send(r.body === undefined ? '' : r.body);
    } catch (err) {
      logger.error('federationWalletHook falhou', err);
      res.status(500).end();
    }
  },
);

// A carteirinha na carteira acompanha a filiação: situação, validade, código
// ou plano mudou ⇒ corrige o objeto do Google e avisa os iPhones (APNs).
exports.federationWalletOnMemberUpdate = onDocumentUpdated(
  { document: 'federation_members/{memberId}', database: DATABASE_ID, region: REGION, timeoutSeconds: 60 },
  async (event) => {
    try {
      await federationWallet.onMemberChange(fedCtx(), antes(event), depois(event), event.params.memberId);
    } catch (err) {
      logger.error('federationWalletOnMemberUpdate falhou', err);
    }
  },
);

// =====================================================================
// AVISOS POR E-MAIL E CELULAR (`external_messaging`, padrão desligado).
// Cada aviso novo passa pela regra de canais (`messagingPolicy.js`) e sai por
// e-mail (Amazon SES ou Resend), WhatsApp (Cloud API da Meta) ou SMS (Twilio
// ou Zenvia) conforme o admin configurou e a pessoa escolheu. A fila manda o
// que esperava e monta os resumos; `/api/mensagens/**` recebe os retornos
// dos provedores e as páginas de descadastro e denúncia.
// Ver `functions/messaging.js` e `docs/49-AVISOS-POR-EMAIL-E-CELULAR.md`.
// =====================================================================
const messagingAdmin = require('./messagingAdmin');

const deMensagens = () => ({ db: getFirestore(getApp(), DATABASE_ID), auth: getAuth(), fcm: getMessaging() });

/** Erro de ação vira HttpsError com a mensagem que o painel mostra. */
function erroDeMensagens(nome, err) {
  if (err instanceof HttpsError) return err;
  if (err instanceof messagingAdmin.ActionError) return new HttpsError(err.code, err.message);
  if (err && err.name === 'ProviderError') return new HttpsError('failed-precondition', err.message);
  logger.error(`${nome} falhou`, err);
  return new HttpsError('internal', 'Falha inesperada. Tente de novo.');
}

exports.messagingOnNotificationCreate = onDocumentCreated(
  { document: 'notifications/{notifId}', database: DATABASE_ID, region: REGION, timeoutSeconds: 60 },
  async (event) => {
    const n = event.data && typeof event.data.data === 'function' ? event.data.data() : null;
    if (!n) return;
    try {
      const r = await messaging.handleNotice(deMensagens(), event.params.notifId, n);
      if (r.handled) logger.info('messagingOnNotificationCreate', { notice: event.params.notifId, results: r.results });
    } catch (err) {
      logger.error('messagingOnNotificationCreate falhou', { notice: event.params.notifId, err });
    }
  },
);

exports.messagingQueue = onSchedule(
  { schedule: 'every 10 minutes', timeZone: 'America/Sao_Paulo', region: REGION, timeoutSeconds: 300, memory: '512MiB' },
  async () => {
    try {
      const r = await messaging.processQueue(deMensagens());
      if (r.due || r.digests || r.cleaned) logger.info('messagingQueue', r);
    } catch (err) {
      logger.error('messagingQueue falhou', err);
    }
  },
);

exports.messagingAdmin = onCall(
  { region: REGION, timeoutSeconds: 120 },
  async (req) => {
    const deps = deMensagens();
    if (!(await isPlatformAdminUser(req, deps.db))) {
      throw new HttpsError('permission-denied', 'Só o admin da plataforma configura as comunicações.');
    }
    const token = (req.auth && req.auth.token) || {};
    try {
      return await messagingAdmin.adminAction(deps, { uid: req.auth.uid, email: token.email || '' }, req.data || {});
    } catch (err) {
      throw erroDeMensagens('messagingAdmin', err);
    }
  },
);

exports.messagingUser = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (req) => {
    if (!req.auth || !req.auth.uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    try {
      return await messagingAdmin.userAction(deMensagens(), req.auth.uid, req.data || {});
    } catch (err) {
      throw erroDeMensagens('messagingUser', err);
    }
  },
);

exports.messagingAuthEmail = onCall(
  { region: REGION, timeoutSeconds: 30, maxInstances: 2 },
  async (req) => {
    try {
      return await messagingAdmin.authEmailAction(deMensagens(), req.data || {});
    } catch (err) {
      throw erroDeMensagens('messagingAuthEmail', err);
    }
  },
);

exports.messagingHook = onRequest(
  { region: REGION, maxInstances: 3, memory: '256MiB', invoker: 'public' },
  async (req, res) => {
    try {
      const r = await messaging.handleHttp(deMensagens(), req);
      res.set('Cache-Control', 'no-store');
      if (r.html) res.status(r.code).type('html').send(r.html);
      else if (r.xml) res.status(r.code).type('text/xml').send(r.xml);
      else if (r.text !== undefined) res.status(r.code).type('text/plain').send(r.text);
      else res.status(r.code).end();
    } catch (err) {
      logger.error('messagingHook falhou', err);
      res.status(500).end();
    }
  },
);

// =====================================================================
// DUPR OFICIAL (flag `dupr_official_sync`) — vínculo da conta pelo SSO, rating
// por webhook e assinaturas. Ver `functions/dupr.js` e `docs/51-DUPR.md`.
// =====================================================================
const duprOficial = require('./dupr');

const duprCtx = () => ({ db: getFirestore(getApp(), DATABASE_ID), FieldValue: FieldValueDel, Timestamp, now: Date.now(), logger });

/** `action`: `config` (URL do login + situação), `link`, `unlink`, `status`. */
exports.duprIntegration = onCall({ region: REGION, timeoutSeconds: 60, maxInstances: 3 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const token = req.auth.token || {};
  const data = req.data || {};
  // No piloto da política, só o admin da plataforma usa a integração.
  const isPlatformAdmin = data.action === 'config' || data.action === 'link'
    ? await isPlatformAdminUser(req, getFirestore(getApp(), DATABASE_ID))
    : false;
  const actor = { uid: req.auth.uid, name: token.name || '', email: token.email || '', isPlatformAdmin };
  const acoes = { config: duprOficial.config, link: duprOficial.link, unlink: duprOficial.unlink, status: duprOficial.status };
  const fn = acoes[data.action];
  if (!fn) throw new HttpsError('invalid-argument', 'Ação desconhecida.');
  try {
    return await fn(duprCtx(), actor, data);
  } catch (err) {
    if (err instanceof duprOficial.DuprServiceError) throw new HttpsError(err.code, err.message);
    logger.error('duprIntegration falhou', err);
    throw new HttpsError('internal', 'Falha inesperada. Tente de novo.');
  }
});

// Eventos de rating do DUPR (`/api/dupr/webhook?k=<token>`, rewrite no hosting).
// Responde 200 depressa; o token da URL é o que separa o DUPR de qualquer outro.
exports.duprWebhook = onRequest(
  { region: REGION, maxInstances: 5, memory: '256MiB', invoker: 'public' },
  async (req, res) => {
    try {
      const r = await duprOficial.webhook(duprCtx(), { method: req.method, query: req.query || {}, body: req.body || {} });
      res.set('Cache-Control', 'no-store');
      res.status(r.status).json(r.body);
    } catch (err) {
      logger.error('duprWebhook falhou', err);
      res.status(500).end();
    }
  },
);
