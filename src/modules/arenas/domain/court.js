/**
 * Domínio puro de Court (quadra) — validação/normalização de input,
 * ordenação e helpers de apresentação. Sem I/O, testável isoladamente.
 *
 * Sprint 1 (ARE-01) do roadmap arena — `docs/arena-roadmap.md`.
 * Adiciona o conceito de "quadras nomeadas" (cada uma com nome, tipo e
 * superfície) que faltava — antes só existia um número `court_count`
 * que era informativo mas não representava entidades reais. Agora cada
 * arena tem N quadras reais que podem ser reservadas, terem horários
 * distintos, etc.
 *
 * Decisões:
 * - IDs determinísticos não fazem sentido aqui (vários courts do mesmo
 *   tipo coexistindo). Usa autogen.
 * - `sort_order` é número editável manualmente para o admin reordenar
 *   quadras exibidas na UI (ex: "Quadra 1" antes de "Quadra 2").
 * - `is_active` permite esconder quadras em reforma sem perder histórico
 *   de bookings.
 * - `court_type` e `surface_type` são enums curtos (não strings livres)
 *   para que o futuro filtro do atleta funcione.
 */

const COURT_TYPES = Object.freeze({
  INDOOR: 'indoor',
  OUTDOOR: 'outdoor',
  COVERED: 'covered', // outdoor mas com cobertura
});

const SURFACE_TYPES = Object.freeze({
  CONCRETE: 'concrete',
  SYNTHETIC: 'synthetic',
  WOOD: 'wood',
  ASPHALT: 'asphalt',
});

const COURT_TYPE_LABELS = Object.freeze({
  indoor: 'Coberta',
  outdoor: 'Descoberta',
  covered: 'Coberta com laterais',
});

const SURFACE_TYPE_LABELS = Object.freeze({
  concrete: 'Concreto',
  synthetic: 'Sintético',
  wood: 'Madeira',
  asphalt: 'Asfalto',
});

function str(v) { return String(v ?? '').trim(); }
function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * Normaliza e valida o input de uma quadra.
 * @returns {{ valid: boolean, errors: object, value: object }}
 */
export function normalizeCourtInput(input = {}) {
  const errors = {};
  const name = str(input.name);
  if (!name) errors.name = 'Informe o nome da quadra.';
  if (name.length > 60) errors.name = 'Nome muito longo (máx. 60).';

  const courtType = str(input.court_type).toLowerCase();
  if (courtType && !Object.values(COURT_TYPES).includes(courtType)) {
    errors.court_type = 'Tipo de quadra inválido.';
  }
  const surfaceType = str(input.surface_type).toLowerCase();
  if (surfaceType && !Object.values(SURFACE_TYPES).includes(surfaceType)) {
    errors.surface_type = 'Superfície inválida.';
  }

  const sortOrderRaw = Number(input.sort_order);
  const sortOrder = Number.isFinite(sortOrderRaw) ? clampInt(sortOrderRaw, 0, 9999) : 0;

  const value = {
    name,
    court_type: courtType || COURT_TYPES.OUTDOOR,
    surface_type: surfaceType || null,
    is_active: input.is_active !== false,
    sort_order: sortOrder,
    notes: str(input.notes).slice(0, 500),
  };

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** Ordena quadras pelo sort_order, depois nome. */
export function sortCourts(courts = []) {
  return [...courts].sort((a, b) => {
    const aOrder = Number.isFinite(a?.sort_order) ? a.sort_order : 0;
    const bOrder = Number.isFinite(b?.sort_order) ? b.sort_order : 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return str(a?.name).localeCompare(str(b?.name));
  });
}

/** Filtra só as quadras ativas (ex: pra UI pública). */
export function activeCourts(courts = []) {
  return courts.filter((c) => c && c.is_active !== false);
}

/**
 * Renumera sort_order sequencialmente (0, 1, 2...) preservando a ordem
 * atual. Útil depois de reordenar manualmente.
 */
export function renumberSortOrder(courts = []) {
  const sorted = sortCourts(courts);
  return sorted.map((c, i) => ({ ...c, sort_order: i }));
}

/** Gera o próximo sort_order (max + 1) a partir de uma lista existente. */
export function nextSortOrder(courts = []) {
  if (!Array.isArray(courts) || courts.length === 0) return 0;
  const max = courts.reduce((acc, c) => {
    const n = Number(c?.sort_order);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, -1);
  return max + 1;
}

export const COURT = Object.freeze({
  TYPES: COURT_TYPES,
  SURFACES: SURFACE_TYPES,
  TYPE_LABELS: COURT_TYPE_LABELS,
  SURFACE_LABELS: SURFACE_TYPE_LABELS,
});
