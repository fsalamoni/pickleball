/**
 * Suporte à inscrição de atletas pelo admin da plataforma (lógica pura).
 *
 * Estas funções não têm dependência de I/O: convertem um documento de usuário
 * (`users/{uid}`) nos campos do formulário de inscrição e filtram a lista de
 * atletas por nome. Ficam isoladas aqui para serem testáveis sem UI.
 */

/** Nome de exibição preferido de um usuário da plataforma. */
export function platformUserDisplayName(user = {}) {
  const name = String(user.platform_name || '').trim()
    || String(user.full_name || '').trim()
    || String(user.email || '').trim().split('@')[0];
  return name || 'Atleta';
}

/**
 * Converte um usuário da plataforma nos campos de um jogador do formulário de
 * inscrição. O nível e o gênero podem vir vazios (perfil incompleto) — nesse
 * caso o admin completa manualmente antes de enviar.
 *
 * @param {Record<string, unknown>} user documento de `users/{uid}`
 * @returns {{ user_id: string|null, name: string, email: string, level: string, gender: string, photo_url: string }}
 */
export function platformUserToPlayerFields(user = {}) {
  return {
    user_id: user.uid || null,
    name: platformUserDisplayName(user),
    email: String(user.email || '').trim(),
    level: user.leveling_level || user.level || '',
    gender: user.competition_gender || '',
    photo_url: user.photo_url || '',
  };
}

/**
 * Filtra e ordena a lista de atletas da plataforma para o seletor do admin.
 * O filtro é por nome (case-insensitive, ignorando acentos); com termo vazio,
 * retorna todos ordenados por nome. Resultado limitado para manter a lista leve.
 *
 * @param {Array<Record<string, unknown>>} users
 * @param {string} term termo de busca por nome
 * @param {{ limit?: number }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function filterPlatformAthletes(users = [], term = '', options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 50;
  const needle = normalize(term);
  const withName = (users || []).map((u) => ({ ...u, _displayName: platformUserDisplayName(u) }));
  const filtered = needle
    ? withName.filter((u) => normalize(u._displayName).includes(needle)
      || normalize(String(u.email || '')).includes(needle))
    : withName;
  filtered.sort((a, b) => a._displayName.localeCompare(b._displayName, 'pt-BR', { sensitivity: 'base' }));
  return filtered.slice(0, limit).map(({ _displayName, ...rest }) => rest);
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
