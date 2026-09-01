/**
 * Serviço de I/O da exportação de partidas para o DUPR (flag `dupr_match_export`).
 *
 * SOMENTE LEITURA. Carrega as mesmas fontes canônicas de jogos decididos do
 * ranking da plataforma (`tournament_matches` + `club_event_games`) mais os
 * mapas de referência (inscrições, perfis — fonte de verdade `users` +
 * espelho público `athlete_profiles` —, torneios, dias de jogo, eventos,
 * clubes) e delega TODA a lógica ao domínio puro `duprMatchExport`.
 *
 * Não grava nada em nenhuma coleção de partidas — apenas registra uma linha de
 * auditoria quando o admin baixa o CSV (`recordDuprExportAudit`).
 */

import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { MATCH_STATUS } from '@/modules/tournament/domain/constants';
import { normalizeExportMatches, buildExportProfileIndex } from '../domain/duprMatchExport.js';
import { EXPORT_STATUS, buildLedgerUpserts } from '../domain/duprReconcile.js';

const FINISHED_STATUSES = [MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER];

/** Coleção do registro de exportação DUPR (ledger por partida). */
const DUPR_LOG_COL = 'dupr_export_log';

/** Máximo de escritas por lote do Firestore. */
const BATCH_LIMIT = 400;

/**
 * Carrega todos os dados necessários para a exportação e devolve as partidas já
 * normalizadas (via domínio) + os mapas de referência para montar filtros/linhas.
 *
 * @returns {Promise<{
 *   matches: Array<object>,
 *   profileById: Map<string, {uid:string,name:string,dupr_id:string,city:string,state:string}>,
 *   maps: { tournamentById: Map, clubById: Map, gameDayById: Map, clubEventById: Map }
 * }>}
 */
export async function loadDuprExportData() {
  if (!db) {
    return {
      matches: [],
      profileById: new Map(),
      maps: {
        tournamentById: new Map(), clubById: new Map(),
        gameDayById: new Map(), clubEventById: new Map(),
      },
    };
  }

  // 1) Jogos decididos (mesmas queries do motor de rating).
  const [tournamentMatchesSnap, clubEventGamesSnap] = await Promise.all([
    getDocs(query(collection(db, 'tournament_matches'), where('status', 'in', FINISHED_STATUSES))),
    getDocs(query(collection(db, 'club_event_games'), where('status', '==', MATCH_STATUS.FINISHED))),
  ]);
  const tournamentMatches = tournamentMatchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const clubEventMatches = clubEventGamesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // 2) Referências: inscrições, perfis (espelho + fonte de verdade), torneios,
  //    dias de jogo, eventos, clubes.
  //    Leitura de coleção inteira (mesmo padrão dos 6 reads abaixo): operação
  //    admin-only, sob demanda e cacheada (React Query, staleTime 60s). O
  //    `users` tem a MESMA cardinalidade do `athlete_profiles` já lido aqui, e
  //    os participantes das partidas são justamente usuários ativos — logo um
  //    `documentId() in` fragmentado (limite de 30/consulta) não reduziria os
  //    reads de forma relevante e só adicionaria complexidade. Se algum dia a
  //    base crescer a ponto de exigir paginação, o redesenho vale para TODAS as
  //    coleções deste carregador, não só para `users`.
  const [regsSnap, profilesSnap, usersSnap, tournamentsSnap, gameDaysSnap, clubEventsSnap, clubsSnap] = await Promise.all([
    getDocs(collection(db, 'tournament_registrations')),
    getDocs(collection(db, 'athlete_profiles')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'tournaments')),
    getDocs(collection(db, 'game_days')),
    getDocs(collection(db, 'club_events')),
    getDocs(collection(db, 'clubs')),
  ]);

  const regById = new Map(regsSnap.docs.map((d) => [d.id, d.data()]));
  const tournamentById = new Map(tournamentsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const gameDayById = new Map(gameDaysSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const clubEventById = new Map(clubEventsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const clubById = new Map(clubsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

  // Índice de perfis do CSV: a FONTE DE VERDADE (`users`) tem PRECEDÊNCIA sobre
  // o ESPELHO público (`athlete_profiles`). Assim, um `dupr_id` carregado
  // manualmente no `users` (sem re-sync do espelho) já entra na exportação.
  const usersById = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
  const profilesRawById = new Map(profilesSnap.docs.map((d) => [d.id, d.data()]));
  const profileById = buildExportProfileIndex(usersById, profilesRawById);

  const matches = normalizeExportMatches({
    tournamentMatches,
    clubEventMatches,
    regById,
    tournamentById,
    gameDayById,
    clubEventById,
    clubById,
  });

  return {
    matches,
    profileById,
    maps: { tournamentById, clubById, gameDayById, clubEventById },
  };
}

/**
 * Registra em auditoria uma exportação de CSV feita pelo admin. Não bloqueia o
 * download em caso de falha (best-effort).
 *
 * @param {object} actor  usuário admin (uid/email)
 * @param {object} summary  { total, ready, incomplete, singles, doubles, filters }
 */
export async function recordDuprExportAudit(actor, summary = {}) {
  try {
    await createAuditLog({
      action: 'dupr_matches_exported',
      actor,
      details: {
        total: summary.total ?? 0,
        ready: summary.ready ?? 0,
        incomplete: summary.incomplete ?? 0,
        singles: summary.singles ?? 0,
        doubles: summary.doubles ?? 0,
        filters: summary.filters || {},
      },
    });
  } catch (err) {
    logger.warn('[duprExport] falha ao registrar auditoria da exportação', err);
  }
}

/**
 * Carrega o LEDGER de exportação DUPR (`dupr_export_log`): mapa por id de
 * partida com a situação já registrada (`exported`/`submitted`) e os carimbos.
 * Somente leitura; devolve `Map` vazio quando não há Firestore.
 *
 * @returns {Promise<Map<string, object>>}
 */
export async function loadDuprLedger() {
  if (!db) return new Map();
  const snap = await getDocs(collection(db, DUPR_LOG_COL));
  return new Map(snap.docs.map((d) => [d.id, { match_id: d.id, ...d.data() }]));
}

/**
 * Registra no ledger uma ação sobre um conjunto de partidas: `exported` (quando
 * entram num CSV baixado) ou `submitted` (quando o admin confirma o lançamento
 * manual no DUPR). Aditivo e idempotente — usa `set(..., {merge:true})` com id
 * determinístico (id da partida) e mantém a situação MONOTÔNICA (o domínio não
 * rebaixa `submitted`). Best-effort: falhas não quebram o download.
 *
 * @param {object} actor  admin (uid/email/displayName)
 * @param {Array<object>} entries  entries de exportação (com `.id` e `.row`)
 * @param {object} [opts]
 * @param {string} [opts.status=EXPORT_STATUS.EXPORTED]
 * @param {Map|object} [opts.ledgerByKey]  ledger atual (evita rebaixar situação)
 * @returns {Promise<{ written: number }>}
 */
export async function recordDuprLedger(actor, entries = [], opts = {}) {
  const { status = EXPORT_STATUS.EXPORTED, ledgerByKey } = opts;
  if (!db) return { written: 0 };

  const upserts = buildLedgerUpserts(entries, { status, at: Date.now(), ledgerByKey });
  if (upserts.length === 0) return { written: 0 };

  // Grava em lotes (limite do Firestore) para suportar exportações grandes.
  for (let i = 0; i < upserts.length; i += BATCH_LIMIT) {
    const slice = upserts.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    slice.forEach(({ id, data }) => {
      batch.set(
        doc(db, DUPR_LOG_COL, id),
        { ...data, updated_at: serverTimestamp() },
        { merge: true },
      );
    });
    await batch.commit();
  }

  try {
    await createAuditLog({
      action: status === EXPORT_STATUS.SUBMITTED ? 'dupr_matches_submitted' : 'dupr_matches_exported',
      actor,
      details: { count: upserts.length, status },
    });
  } catch (err) {
    logger.warn('[duprExport] falha ao auditar registro do ledger', err);
  }

  return { written: upserts.length };
}
