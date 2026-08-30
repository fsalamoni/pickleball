/**
 * Serviço de I/O da exportação de partidas para o DUPR (flag `dupr_match_export`).
 *
 * SOMENTE LEITURA. Carrega as mesmas fontes canônicas de jogos decididos do
 * ranking da plataforma (`tournament_matches` + `club_event_games`) mais os
 * mapas de referência (inscrições, perfis, torneios, dias de jogo, eventos,
 * clubes) e delega TODA a lógica ao domínio puro `duprMatchExport`.
 *
 * Não grava nada em nenhuma coleção de partidas — apenas registra uma linha de
 * auditoria quando o admin baixa o CSV (`recordDuprExportAudit`).
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { MATCH_STATUS } from '@/modules/tournament/domain/constants';
import { normalizeExportMatches } from '../domain/duprMatchExport.js';

const FINISHED_STATUSES = [MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER];

/** Nome de exibição preferido do atleta (mesma convenção do ranking). */
function displayName(profile) {
  return profile.platform_name || profile.full_name || 'Atleta';
}

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

  // 2) Referências: inscrições, perfis, torneios, dias de jogo, eventos, clubes.
  const [regsSnap, profilesSnap, tournamentsSnap, gameDaysSnap, clubEventsSnap, clubsSnap] = await Promise.all([
    getDocs(collection(db, 'tournament_registrations')),
    getDocs(collection(db, 'athlete_profiles')),
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

  // Projeção enxuta dos perfis: só o que o CSV/filtros precisam.
  const profileById = new Map(profilesSnap.docs.map((d) => {
    const p = d.data();
    return [d.id, {
      uid: d.id,
      name: displayName(p),
      dupr_id: (p.dupr_id || '').toString().trim(),
      city: p.city || '',
      state: p.state || '',
    }];
  }));

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
