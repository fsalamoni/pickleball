/**
 * Ranking com o rating OFICIAL do DUPR — só de quem conectou a conta pelo
 * login do DUPR (`dupr_verified`, gravado só pelo servidor). O número digitado
 * à mão no perfil, sem o selo, não entra: não é o rating do DUPR, é o que a
 * pessoa disse. Puro, sem I/O.
 */

/** Campo do rating no espelho do perfil, por formato. */
export const DUPR_FORMAT_FIELD = Object.freeze({ doubles: 'dupr_rating', singles: 'dupr_rating_singles' });

const nomeDe = (p) => String(p?.platform_name || p?.full_name || '').trim();

/**
 * @param {Array<object>} profiles espelhos `athlete_profiles` (com `id`)
 * @param {'doubles'|'singles'} format
 * @returns {Array<{ uid: string, name: string, photo_url: string, city: string, state: string, dupr_id: string, rating: number, position: number }>}
 */
export function buildOfficialDuprRanking(profiles, format = 'doubles') {
  const campo = DUPR_FORMAT_FIELD[format] || DUPR_FORMAT_FIELD.doubles;
  const linhas = (Array.isArray(profiles) ? profiles : [])
    .filter((p) => p && p.dupr_verified === true && p.hidden !== true)
    .map((p) => ({
      uid: p.id || p.uid,
      name: nomeDe(p),
      photo_url: p.photo_url || '',
      city: p.city || '',
      state: p.state || '',
      dupr_id: p.dupr_id || '',
      rating: Number(p[campo]),
    }))
    .filter((r) => r.uid && Number.isFinite(r.rating) && r.rating > 0);
  linhas.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, 'pt-BR'));
  // Rating igual divide a posição (1, 2, 2, 4).
  let posicao = 0;
  return linhas.map((r, i) => {
    if (i === 0 || linhas[i - 1].rating !== r.rating) posicao = i + 1;
    return { ...r, position: posicao };
  });
}
