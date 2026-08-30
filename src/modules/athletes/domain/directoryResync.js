/**
 * Planejamento (puro, sem I/O) da re-sincronização em lote do diretório.
 *
 * O espelho público `athlete_profiles/{uid}` é derivado da fonte de verdade
 * `users/{uid}` por `buildAthletePublicProfile`, e só é reescrito quando
 * `syncAthleteProfile` roda (login, salvar perfil, entrar em clube, inscrição).
 * Quando um campo é inserido MANUALMENTE no `users` (ex.: `dupr_id`, `gender`,
 * `competition_gender`, `court_side`), o espelho NÃO reflete a mudança até o
 * próximo sync — deixando o diretório desatualizado.
 *
 * Este módulo calcula, sem tocar no Firestore, o conjunto de escritas para
 * refletir o `users` no espelho. Regra de segurança: só considera espelhos que
 * JÁ EXISTEM (interseção `users` ∩ `athlete_profiles`), de modo que a operação
 * nunca cria entradas novas no diretório — apenas atualiza as existentes.
 */

import { buildAthletePublicProfile, filterEmptyStringFields } from './publicProfile.js';

/** Campos tipicamente inseridos à mão no `users` que o admin quer propagar. */
export const RESYNC_MANUAL_FIELDS = ['dupr_id', 'gender', 'competition_gender', 'court_side'];

function hasValue(value) {
  return String(value ?? '').trim() !== '';
}

/**
 * Agrupa documentos de `club_members` por `user_id`, no formato usado por
 * `buildAthletePublicProfile` (`{ id, name }`). Espelha `listUserClubsSummary`,
 * mas para toda a base de uma vez (1 leitura de coleção em vez de N consultas).
 *
 * @param {Array<object>} clubMemberDocs
 * @returns {Map<string, Array<{ id: string, name: string }>>}
 */
export function groupClubsByUser(clubMemberDocs = []) {
  const map = new Map();
  for (const member of clubMemberDocs || []) {
    if (!member || !member.user_id || !member.club_id || !member.club_name) continue;
    const list = map.get(member.user_id) || [];
    list.push({ id: member.club_id, name: member.club_name });
    map.set(member.user_id, list);
  }
  return map;
}

/**
 * Monta o plano de re-sincronização do diretório.
 *
 * Para cada usuário cujo espelho já existe, reconstrói a projeção pública a
 * partir do `users` (fonte de verdade) e remove campos com string vazia (via
 * `filterEmptyStringFields`), garantindo que a escrita `{ merge: true }` na
 * camada de serviço nunca sobrescreva um valor válido do espelho com `''`.
 *
 * @param {object} params
 * @param {Array<object>} params.users - docs de `users` no formato `{ uid, ...data }`
 * @param {Set<string>|Array<string>} params.mirrorIds - uids que já têm espelho
 * @param {Map<string, Array<{id,name}>>} [params.clubsByUser] - clubes por uid
 * @param {Date} [params.referenceDate] - data de referência para calcular idade
 * @returns {{ writes: Array<{ uid: string, payload: object }>, summary: object }}
 */
export function buildAthleteProfilesResyncPlan({
  users = [],
  mirrorIds = [],
  clubsByUser = new Map(),
  referenceDate,
} = {}) {
  const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
  const clubsMap = clubsByUser instanceof Map ? clubsByUser : new Map();
  const writes = [];
  const summary = {
    totalUsers: users.length,
    totalMirrors: mirrorSet.size,
    eligible: 0,
    withDupr: 0,
    withGender: 0,
    withCompetitionGender: 0,
    withCourtSide: 0,
  };

  for (const user of users || []) {
    const uid = user?.uid || user?.id;
    if (!uid) continue;
    // Só atualiza espelhos existentes — nunca cria entrada nova no diretório.
    if (!mirrorSet.has(uid)) continue;

    summary.eligible += 1;
    if (hasValue(user.dupr_id)) summary.withDupr += 1;
    if (hasValue(user.gender)) summary.withGender += 1;
    if (hasValue(user.competition_gender)) summary.withCompetitionGender += 1;
    if (hasValue(user.court_side)) summary.withCourtSide += 1;

    const clubs = clubsMap.get(uid) || [];
    const options = referenceDate ? { referenceDate } : {};
    const publicProfile = buildAthletePublicProfile(uid, user, clubs, options);
    const payload = filterEmptyStringFields(publicProfile);
    writes.push({ uid, payload });
  }

  return { writes, summary };
}
