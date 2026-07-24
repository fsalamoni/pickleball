/**
 * Domínio puro da busca global federada (flag global_search).
 *
 * Recebe listas já carregadas de atletas, torneios, arenas e clubes e devolve
 * resultados unificados, filtrados por um termo e agrupados por tipo. Sem I/O.
 */

/** Normaliza texto para busca (minúsculas, sem acentos). */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matches(term, ...fields) {
  const t = normalizeText(term);
  if (!t) return false;
  const hay = normalizeText(fields.filter(Boolean).join(' '));
  return hay.includes(t);
}

/**
 * Executa a busca federada.
 * @param {string} term
 * @param {{ athletes?, tournaments?, arenas?, clubs? }} sources
 * @param {{ perGroup?: number }} [opts]
 * @returns {{ groups: Array<{type,label,items}>, total: number }}
 */
export function searchAll(term, sources = {}, opts = {}) {
  const perGroup = Number.isFinite(opts.perGroup) ? opts.perGroup : 8;
  const t = normalizeText(term);
  if (t.length < 2) return { groups: [], total: 0 };

  const {
    athletes = [], tournaments = [], arenas = [], clubs = [],
  } = sources;

  const athleteItems = athletes
    .filter((a) => matches(term, a.platform_name, a.full_name, a.city, a.state))
    .slice(0, perGroup)
    .map((a) => ({ id: a.id, type: 'athlete', title: a.platform_name || a.full_name || 'Atleta', subtitle: [a.city, a.state].filter(Boolean).join(' / '), to: `/atletas/${a.id}`, photo: a.photo_url || '' }));

  const tournamentItems = tournaments
    .filter((x) => matches(term, x.name, x.city, x.state))
    .slice(0, perGroup)
    .map((x) => ({ id: x.id, type: 'tournament', title: x.name || 'Torneio', subtitle: [x.city, x.state].filter(Boolean).join(' / '), to: `/torneios/${x.id}` }));

  const arenaItems = arenas
    .filter((x) => matches(term, x.name, x.city, x.state, x.neighborhood))
    .slice(0, perGroup)
    .map((x) => ({ id: x.id, type: 'arena', title: x.name || 'Arena', subtitle: [x.city, x.state].filter(Boolean).join(' / '), to: `/arenas/${x.id}` }));

  const clubItems = clubs
    .filter((x) => matches(term, x.name, x.city, x.state))
    .slice(0, perGroup)
    .map((x) => ({ id: x.id, type: 'club', title: x.name || 'Clube', subtitle: [x.city, x.state].filter(Boolean).join(' / '), to: `/clubes/${x.id}` }));

  const groups = [
    { type: 'athlete', label: 'Atletas', items: athleteItems },
    { type: 'tournament', label: 'Torneios', items: tournamentItems },
    { type: 'arena', label: 'Arenas', items: arenaItems },
    { type: 'club', label: 'Clubes', items: clubItems },
  ].filter((g) => g.items.length > 0);

  const total = groups.reduce((s, g) => s + g.items.length, 0);
  return { groups, total };
}
