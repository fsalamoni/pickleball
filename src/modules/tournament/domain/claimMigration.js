/**
 * Lógica pura de migração de inscrições provisórias.
 *
 * Quando o admin inscreve um atleta sem conta (cadastro provisório), o registro
 * no `tournament_registrations` grava o email digitado e deixa
 * `player_a_user_id` / `player_b_user_id` vazios. Quando esse atleta cria a
 * conta definitiva com o MESMO email, a função `claimProvisionalRegistrationsForUser`
 * é chamada no login e migra o registro. Mas se o admin digitou o email errado
 * (ex.: `vicente@google.com` em vez de `vicente.bcosta@icloud.com`), o claim
 * automático não encontra nada.
 *
 * Esta função encapsula a transformação campo-a-campo aplicada em cada
 * `tournament_registrations` que casa com algum dos emails de origem. É pura
 * (sem I/O) e testável.
 */

/** Normaliza email (trim + lowercase), igual à convenção do service. */
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Decide se um registro de `tournament_registrations` deve ser migrado e,
 * em caso afirmativo, retorna os campos a sobrescrever. Lógica espelhada em
 * `officialPlayerData` do service — mas desacoplada, para que possa ser
 * testada sem Firebase.
 *
 * Apenas o slot (player_a ou player_b) que casa com o email de origem é
 * atualizado. O parceiro (se houver) é preservado.
 *
 * @param {Record<string, any>} reg documento de `tournament_registrations`
 * @param {string[]} fromEmails emails de origem (já normalizados)
 * @param {{ uid: string, name: string, email: string, level: any, competition_gender: any, photo_url: any }} player dados oficiais do atleta real
 * @returns {Record<string, any>|null} diff a aplicar via `updateDoc`, ou null se nada a fazer
 */
export function buildRegistrationMigrationDiff(reg, fromEmails, player) {
  if (!reg || !fromEmails?.length || !player?.uid) return null;
  const aMatch = fromEmails.includes(normalizeEmail(reg.player_a_email_lc));
  const bMatch = fromEmails.includes(normalizeEmail(reg.player_b_email_lc));
  if (!aMatch && !bMatch) return null;
  // Se a inscrição já foi reivindicada para o mesmo UID, não há nada a fazer.
  if (aMatch && reg.player_a_user_id === player.uid) return null;
  if (bMatch && reg.player_b_user_id === player.uid) return null;

  const diff = {};
  if (aMatch) {
    diff.player_a_user_id = player.uid;
    diff.user_id = player.uid; // espelha no campo top-level (legado)
    diff.player_a_name = player.name;
    diff.player_a_email = player.email;
    diff.player_a_email_lc = normalizeEmail(player.email);
    diff.player_a_level = player.level ?? null;
    // Não apaga gênero já gravado se o perfil não tiver.
    diff.player_a_competition_gender = player.competition_gender || reg.player_a_competition_gender || null;
    diff.player_a_photo = player.photo_url ?? null;
    diff.player_a_provisional = false;
  }
  if (bMatch) {
    diff.player_b_user_id = player.uid;
    diff.player_b_name = player.name;
    diff.player_b_email = player.email;
    diff.player_b_email_lc = normalizeEmail(player.email);
    diff.player_b_level = player.level ?? null;
    diff.player_b_competition_gender = player.competition_gender || reg.player_b_competition_gender || null;
    diff.player_b_photo = player.photo_url ?? null;
    diff.player_b_provisional = false;
  }
  // is_provisional e label são recomputados pelo service após aplicar este diff.
  return diff;
}

/**
 * Recalcula `is_provisional` e `label` depois do diff ter sido aplicado. Útil
 * para o service montar o payload final do `updateDoc`.
 *
 * @param {Record<string, any>} next registro pós-diff
 * @returns {{ is_provisional: boolean, label: string }}
 */
export function recomputeRegistrationFlags(next) {
  const isProvisional = Boolean(next.player_a_provisional || next.player_b_provisional);
  const format = next.format;
  let label;
  if (format === 'doubles') {
    label = `${next.player_a_name || '—'} / ${next.player_b_name || '—'}`;
  } else {
    label = next.player_a_name || '—';
  }
  return { is_provisional: isProvisional, label };
}

/**
 * Constrói os dados oficiais do atleta (espelha `officialPlayerData` do
 * service). Recebe o `firebaseUser` e o perfil, devolve o objeto "jogador
 * oficial" usado para sobrescrever os campos de player_a / player_b.
 *
 * @param {{ uid?: string, email?: string, displayName?: string, photoURL?: string }|null|undefined} user
 * @param {Record<string, any>} [profile]
 */
export function buildOfficialPlayer(user, profile = {}) {
  const name = profile.platform_name || profile.full_name || user?.displayName || user?.email || '';
  return {
    uid: user?.uid || null,
    name,
    email: user?.email || profile.email || '',
    level: profile.level || profile.leveling_level || null,
    competition_gender: profile.competition_gender || null,
    photo_url: profile.photo_url || user?.photoURL || null,
  };
}

/**
 * Filtra a lista de inscrições para incluir só as que casam com algum dos
 * emails de origem. Útil para o dry-run do admin.
 *
 * @param {Array<Record<string, any>>} registrations
 * @param {string[]} fromEmails emails já normalizados
 */
export function filterRegistrationsByEmails(registrations = [], fromEmails = []) {
  const set = new Set(fromEmails.map(normalizeEmail));
  return registrations.filter((reg) => {
    return set.has(normalizeEmail(reg.player_a_email_lc)) || set.has(normalizeEmail(reg.player_b_email_lc));
  });
}
