/**
 * Serviço do formato de EQUIPES em torneios (flag team_tournaments).
 *
 * Camada de I/O sobre o domínio puro `domain/teamFormat.js`. É ADITIVO e
 * autocontido: reaproveita as coleções existentes sem alterar os fluxos atuais.
 *
 *  - Uma EQUIPE é uma inscrição (`tournament_registrations`) com
 *    `kind: 'team'`, `team_name` e `members[]`.
 *  - Um CONFRONTO é um jogo da fase (`tournament_matches`) com
 *    `team_confrontation: true` e `etapas[]` (escalação + placares). O
 *    pareamento (pontos corridos/grupos/chaves) é feito pelo sorteio existente,
 *    tratando cada inscrição-equipe como um "participante".
 *
 * Nada aqui roda quando a modalidade não tem `team_config` — os torneios
 * comuns seguem exatamente como estão.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { REGISTRATION_STATUS, MATCH_STATUS } from '../domain/constants.js';
import {
  validateTeamRoster, validateConfrontationLineup, computeConfrontationResult, buildTeamRanking,
  buildConfrontationRankingMirror, validateTeamAgainstExisting, buildTeamGroupTables,
  matchToConfrontation, isTeamConfrontation,
} from '../domain/teamFormat.js';

const REG_COL = 'tournament_registrations';
const MATCH_COL = 'tournament_matches';
const RANKING_COL = 'club_event_games';

/** Normaliza um membro do elenco para gravação. */
function normalizeMember(m) {
  return {
    user_id: m?.user_id || null,
    name: String(m?.name || '').trim() || 'Atleta',
    gender: m?.gender === 'female' ? 'female' : (m?.gender === 'male' ? 'male' : null),
    photo_url: m?.photo_url || null,
    level: m?.level || null,
  };
}

/**
 * Inscreve uma EQUIPE numa modalidade de equipes. Valida o elenco contra a
 * `team_config` da modalidade. Retorna o id da inscrição-equipe.
 *
 * @param {object} args
 * @param {object} args.tournament
 * @param {object} args.modality  precisa ter `team_config`
 * @param {{ team_name: string, members: Array }} args.input
 * @param {object} args.actor
 */
export async function registerTeam({ tournament, modality, input, actor } = {}) {
  if (!modality?.team_config) throw new Error('Modalidade não é de equipes.');
  const members = (input?.members || []).map(normalizeMember);
  const check = validateTeamRoster(members, modality.team_config);
  if (!check.valid) throw new Error(check.errors[0] || 'Elenco inválido.');

  const teamName = String(input?.team_name || '').trim().slice(0, 80) || 'Equipe';
  // Nome único na modalidade e nenhum atleta com conta em duas equipes.
  const existing = await listTeamRegistrations(modality.id);
  const clash = validateTeamAgainstExisting({ teamName, members, existingTeams: existing });
  if (!clash.valid) throw new Error(clash.errors[0]);

  const id = doc(collection(db, REG_COL)).id;
  const payload = {
    id,
    tournament_id: modality.tournament_id || tournament?.id || null,
    modality_id: modality.id,
    format: modality.format || 'doubles',
    kind: 'team',
    team_name: teamName,
    members,
    member_uids: members.map((m) => m.user_id).filter(Boolean),
    created_by: actor?.uid || null,
    created_by_role: 'player',
    user_id: actor?.uid || null,
    status: (modality.entry_fee_cents || 0) > 0 ? REGISTRATION_STATUS.PENDING_PAYMENT : REGISTRATION_STATUS.CONFIRMED,
    label: teamName,
    seed: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, REG_COL, id), payload);
  await createAuditLog({
    action: 'team_registration_created',
    actor,
    details: { tournament_id: payload.tournament_id, modality_id: modality.id, registration_id: id },
  });
  return id;
}

/** Edita o nome/elenco de uma equipe já inscrita (revalida o elenco). */
export async function updateTeamRoster(regId, { team_name, members }, modality, actor) {
  if (!regId) throw new Error('Inscrição inválida.');
  if (!modality?.team_config) throw new Error('Modalidade não é de equipes.');
  const normalized = (members || []).map(normalizeMember);
  const check = validateTeamRoster(normalized, modality.team_config);
  if (!check.valid) throw new Error(check.errors[0] || 'Elenco inválido.');
  const existing = await listTeamRegistrations(modality.id);
  const clash = validateTeamAgainstExisting({
    teamName: team_name != null ? String(team_name) : '',
    members: normalized,
    existingTeams: existing,
    currentTeamId: regId,
  });
  if (!clash.valid) throw new Error(clash.errors[0]);
  const updates = {
    members: normalized,
    member_uids: normalized.map((m) => m.user_id).filter(Boolean),
    updated_at: serverTimestamp(),
  };
  if (team_name != null) {
    updates.team_name = String(team_name).trim().slice(0, 80) || 'Equipe';
    updates.label = updates.team_name;
  }
  await updateDoc(doc(db, REG_COL, regId), updates);
  await createAuditLog({ action: 'team_registration_updated', actor, details: { registration_id: regId } });
}

/** Lista as inscrições-equipe de uma modalidade. */
export async function listTeamRegistrations(modalityId) {
  const q = query(collection(db, REG_COL), where('modality_id', '==', modalityId), orderBy('created_at', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).filter((r) => r.kind === 'team');
}

/**
 * Grava a escalação + placares das ETAPAS de um confronto e apura o resultado
 * (vencedor/estado) pela regra da modalidade. Valida a escalação apenas quando
 * os elencos das duas equipes forem fornecidos.
 *
 * @param {string} matchId
 * @param {object} args
 * @param {Array} args.etapas             [{ id, type, side_a:[uid], side_b:[uid], score_a, score_b }]
 * @param {object} args.config            team_config da modalidade
 * @param {string[]} [args.rosterAIds]    elenco da equipe A (para validar)
 * @param {string[]} [args.rosterBIds]    elenco da equipe B (para validar)
 * @param {Map<string,string>} [args.genderById]
 * @param {boolean} [args.validate]       valida a escalação antes de gravar
 * @param {object} actor
 */
export async function recordConfrontation(matchId, {
  etapas = [], config = {}, rosterAIds = [], rosterBIds = [], genderById = new Map(), validate = false,
  tournamentId = null, modalityId = null, eventTitle = '', validUids = [],
} = {}, actor) {
  if (!matchId) throw new Error('Confronto inválido.');
  if (validate) {
    const v = validateConfrontationLineup(etapas, config, rosterAIds, rosterBIds, genderById);
    if (!v.valid) throw new Error(v.errors[0] || 'Escalação inválida.');
  }
  const result = computeConfrontationResult({ etapas }, config);
  const updates = {
    team_confrontation: true,
    etapas,
    etapa_wins_a: result.etapaWins.a,
    etapa_wins_b: result.etapaWins.b,
    // Games (sets) somados das etapas — leitura rápida para a UI/relatórios.
    sets_a: result.sets.a,
    sets_b: result.sets.b,
    points_a: result.points.a,
    points_b: result.points.b,
    updated_at: serverTimestamp(),
  };
  if (result.decided) {
    updates.status = MATCH_STATUS.FINISHED;
    updates.winner_side = result.winner; // 'a' | 'b' | null (empate)
    updates.result_recorded_at = serverTimestamp();
  } else {
    updates.status = MATCH_STATUS.IN_PROGRESS;
    updates.winner_side = null;
  }

  // Espelha cada ETAPA decidida (com jogadores com conta) no ranking INDIVIDUAL
  // (`club_event_games`, a mesma base do ELO e das duplas). Idempotente: grava
  // as válidas e remove as que deixaram de valer.
  const mirror = buildConfrontationRankingMirror({
    matchId, tournamentId, modalityId, eventTitle, etapas, validUids, config,
  });
  const nowIso = new Date().toISOString();

  const batch = writeBatch(db);
  batch.update(doc(db, MATCH_COL, matchId), updates);
  mirror.toWrite.forEach(({ id, payload }) => {
    batch.set(doc(db, RANKING_COL, id), {
      ...payload,
      result_recorded_at: nowIso,
      created_at: nowIso,
    });
  });
  mirror.toRemove.forEach((id) => batch.delete(doc(db, RANKING_COL, id)));
  await batch.commit();

  await createAuditLog({
    action: 'team_confrontation_recorded',
    actor,
    details: {
      match_id: matchId,
      status: updates.status,
      winner: updates.winner_side || null,
      mirrored: mirror.toWrite.length,
    },
  });
  return { ...updates, result };
}

export async function getMatch(id) {
  const snap = await getDoc(doc(db, MATCH_COL, id));
  return snap.exists() ? snap.data() : null;
}

/**
 * Monta a classificação de equipes de uma modalidade, a partir dos confrontos
 * (jogos) e das inscrições-equipe. Puramente derivado — não escreve nada.
 *
 * @param {object} args
 * @param {Array} args.matches            jogos da modalidade (confrontos)
 * @param {Array} args.teamRegistrations  inscrições-equipe
 * @param {object} args.config            team_config
 * @returns {Array} classificação ordenada
 */
export function buildTeamStandingsFromMatches({ matches = [], teamRegistrations = [], config = {} } = {}) {
  const teamIds = teamRegistrations.map((t) => t.id);
  const confrontations = matches.filter(isTeamConfrontation).map(matchToConfrontation);
  const nameById = new Map(teamRegistrations.map((t) => [t.id, t.team_name || t.label || 'Equipe']));
  return buildTeamRanking(confrontations, teamIds, config).map((row) => ({
    ...row,
    team_name: nameById.get(row.team_id) || 'Equipe',
  }));
}

/**
 * Tabelas de classificação POR GRUPO de uma fase (a "tabela do grupo"). Quando
 * a fase não tem grupos, devolve uma tabela única. Derivado — não escreve nada.
 *
 * @param {object} args
 * @param {Array} args.matches            jogos da fase (confrontos)
 * @param {Array} args.teamRegistrations  inscrições-equipe
 * @param {object} args.config            team_config
 * @returns {Array<{ name: string|null, rows: Array<object> }>}
 */
export function buildTeamGroupStandings({ matches = [], teamRegistrations = [], config = {} } = {}) {
  return buildTeamGroupTables({ matches, teamRegistrations, config });
}
