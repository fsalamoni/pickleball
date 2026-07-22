/**
 * Domínio puro de Circuitos (Sprint 4 ORG-20).
 *
 * Circuito = série de torneios com ranking acumulado. Cada torneio do
 * circuito atribui pontos aos atletas baseado na posição final.
 *
 * Decisões de design:
 * - Sem dependência de framework (sem React, sem Firestore)
 * - Pontos por posição: tabela configurável (default = top 100, top 50, etc)
 * - Resultados armazenados por torneio (circuit_results/{circuitId}_{tournamentId}_{userId})
 * - Ranking agregado = soma de pontos de todos os torneios do circuito
 *
 * Fórmula de pontuação default (top N do torneio):
 * - 1º lugar: 100
 * - 2º lugar: 75
 * - 3º/4º: 50
 * - 5º-8º: 30
 * - 9º-16º: 20
 * - 17º-32º: 10
 * - Demais (que pontuam): 5
 *
 * Posição 0 = não pontuou.
 */

export const CIRCUIT_DEFAULT_POINTS = {
  1: 100, 2: 75, 3: 50, 4: 50,
  5: 30, 6: 30, 7: 30, 8: 30,
  9: 20, 10: 20, 11: 20, 12: 20, 13: 20, 14: 20, 15: 20, 16: 20,
  17: 10, 18: 10, 19: 10, 20: 10, 21: 10, 22: 10, 23: 10, 24: 10,
  25: 10, 26: 10, 27: 10, 28: 10, 29: 10, 30: 10, 31: 10, 32: 10,
  33: 5, 34: 5, 35: 5, 36: 5, 37: 5, 38: 5, 39: 5, 40: 5,
  41: 5, 42: 5, 43: 5, 44: 5, 45: 5, 46: 5, 47: 5, 48: 5,
  49: 5, 50: 5, 51: 5, 52: 5, 53: 5, 54: 5, 55: 5, 56: 5,
};

export const CIRCUIT_MAX_NAME = 80;
export const CIRCUIT_MAX_DESCRIPTION = 500;
export const CIRCUIT_MAX_SEASON_LENGTH = 40;
export const CIRCUIT_MAX_CATEGORIES = 10;
export const CIRCUIT_CATEGORY_MAX = 30;

const str = (v) => String(v ?? '').trim();

/**
 * Normaliza e valida input de circuito.
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizeCircuitInput(input = {}) {
  const name = str(input.name);
  if (!name) return { valid: false, error: 'Nome do circuito é obrigatório.', value: {} };
  if (name.length > CIRCUIT_MAX_NAME) {
    return { valid: false, error: `Nome muito longo (máx. ${CIRCUIT_MAX_NAME} chars).`, value: { name: name.slice(0, CIRCUIT_MAX_NAME) } };
  }
  const description = str(input.description).slice(0, CIRCUIT_MAX_DESCRIPTION);
  const season = str(input.season).slice(0, CIRCUIT_MAX_SEASON_LENGTH);
  if (!season) {
    return { valid: false, error: 'Temporada (ex: "2026 Q1", "2026 Inverno") é obrigatória.', value: { name, description } };
  }
  const categories = (Array.isArray(input.categories) ? input.categories : [])
    .map((c) => str(c).slice(0, CIRCUIT_CATEGORY_MAX))
    .filter(Boolean)
    .slice(0, CIRCUIT_MAX_CATEGORIES);
  if (categories.length === 0) {
    return { valid: false, error: 'Informe ao menos uma categoria (ex: "Open Misto", "Sênior").', value: { name, description, season } };
  }
  const startDate = str(input.start_date);
  const endDate = str(input.end_date);
  if (startDate && endDate && startDate > endDate) {
    return { valid: false, error: 'Data final não pode ser anterior à inicial.', value: { name, description, season, categories } };
  }
  const value = {
    name,
    description,
    season,
    categories,
    start_date: startDate || null,
    end_date: endDate || null,
    active: input.active !== false,
    points_table: input.points_table && typeof input.points_table === 'object' ? input.points_table : CIRCUIT_DEFAULT_POINTS,
  };
  return { valid: true, error: null, value };
}

/** Pontos por posição usando tabela customizada (ou default). */
export function pointsForPosition(position, pointsTable = CIRCUIT_DEFAULT_POINTS) {
  if (!Number.isInteger(position) || position < 1) return 0;
  return pointsTable[position] || 0;
}

/** Calcula ranking agregado a partir de resultados por torneio.
 * @param {Array<{tournament_id, user_id, user_name, position, total_participants}>} results
 * @param {object} [pointsTable] - override da tabela de pontos
 * @returns {Array<{user_id, user_name, total_points, tournaments, best_position}>}
 */
export function computeCircuitRanking(results = [], pointsTable) {
  const byUser = new Map();
  for (const r of results) {
    if (!r?.user_id) continue;
    const pts = pointsForPosition(r.position, pointsTable);
    if (pts <= 0) continue;
    const cur = byUser.get(r.user_id) || {
      user_id: r.user_id, user_name: r.user_name || 'Atleta', user_photo: r.user_photo || null,
      total_points: 0, tournaments: 0, best_position: Infinity, history: [],
    };
    cur.total_points += pts;
    cur.tournaments += 1;
    if (r.position < cur.best_position) {
      cur.best_position = r.position;
      if (r.user_name) cur.user_name = r.user_name;
      if (r.user_photo) cur.user_photo = r.user_photo;
    }
    cur.history.push({
      tournament_id: r.tournament_id, position: r.position, points: pts,
      total_participants: r.total_participants || null,
    });
    byUser.set(r.user_id, cur);
  }
  // ordena: points desc, best_position asc, total_tournaments desc, name asc
  return Array.from(byUser.values())
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (a.best_position !== b.best_position) return a.best_position - b.best_position;
      if (b.tournaments !== a.tournaments) return b.tournaments - a.tournaments;
      return (a.user_name || '').localeCompare(b.user_name || '');
    })
    .map((u, i) => ({
      ...u,
      rank: i + 1,
      best_position: u.best_position === Infinity ? null : u.best_position,
    }));
}

/** Resultado de um torneio (1 doc por atleta). */
export function normalizeCircuitResult(input = {}) {
  const position = Number(input.position);
  if (!Number.isInteger(position) || position < 1 || position > 9999) {
    return { valid: false, error: 'Posição inválida.', value: {} };
  }
  return {
    valid: true,
    error: null,
    value: {
      user_id: str(input.user_id),
      user_name: str(input.user_name).slice(0, 80),
      user_photo: str(input.user_photo) || null,
      tournament_id: str(input.tournament_id),
      position,
      total_participants: Number.isInteger(Number(input.total_participants)) ? Math.max(1, Number(input.total_participants)) : null,
      points: pointsForPosition(position, input.points_table),
    },
  };
}

/** Indica se um atleta está no top N do ranking (medalhas). */
export function isTopRanked(rank, n = 3) {
  return Number.isInteger(rank) && rank >= 1 && rank <= n;
}
