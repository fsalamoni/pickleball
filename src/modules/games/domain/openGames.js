/**
 * Lógica pura de "Procura-se jogo" (sem I/O).
 *
 * Normaliza/valida o convite publicado e filtra/ordena o mural. Mantida pura
 * para ser testável; a persistência fica no `openGameService`.
 */

import { toMillis } from '@/modules/tournament/domain/participation';

export const OPEN_GAME_STATUS = Object.freeze({ OPEN: 'open', CLOSED: 'closed' });

/** Formatos aceitos no convite (inclui "tanto faz"). */
export const OPEN_GAME_FORMAT = Object.freeze({
  ANY: 'any',
  SINGLES: 'singles',
  DOUBLES: 'doubles',
});

export const OPEN_GAME_FORMAT_LABELS = Object.freeze({
  [OPEN_GAME_FORMAT.ANY]: 'Tanto faz',
  [OPEN_GAME_FORMAT.SINGLES]: 'Simples',
  [OPEN_GAME_FORMAT.DOUBLES]: 'Duplas',
});

function trimmed(value) {
  return String(value ?? '').trim();
}

/**
 * Normaliza e valida o input do convite.
 * @param {object} input
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function normalizeOpenGameInput(input = {}) {
  const value = {
    date: trimmed(input.date) || null, // 'YYYY-MM-DD' (opcional)
    when_text: trimmed(input.when_text),
    city: trimmed(input.city),
    state: trimmed(input.state).toUpperCase().slice(0, 2),
    level: trimmed(input.level) || null,
    format: Object.values(OPEN_GAME_FORMAT).includes(input.format) ? input.format : OPEN_GAME_FORMAT.ANY,
    notes: trimmed(input.notes).slice(0, 400),
  };

  const errors = {};
  // Aceita a data OU a descrição livre ("quando"); ao menos uma é obrigatória.
  if (!value.date && !value.when_text) errors.when_text = 'Informe a data ou quando você quer jogar.';
  if (!value.city) errors.city = 'Informe a cidade.';

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/**
 * Separa os convites abertos em "próximos" (sem data ou com data ≥ hoje) e
 * "passados" (data < hoje), cada grupo ordenado. Convites sem data ficam entre
 * os próximos (são convites flexíveis, ex.: "sábado de manhã").
 *
 * @param {Array<object>} games
 * @param {string} todayISO - data de hoje 'YYYY-MM-DD'
 * @returns {{ upcoming: object[], past: object[] }}
 */
export function partitionOpenGamesByDate(games, todayISO) {
  const open = (games || []).filter((g) => g.status === OPEN_GAME_STATUS.OPEN);
  const upcoming = [];
  const past = [];
  open.forEach((g) => {
    if (g.date && todayISO && g.date < todayISO) past.push(g);
    else upcoming.push(g);
  });

  // Próximos: datados primeiro (mais próximos no topo), depois os sem data
  // (por mais recentes). Passados: mais recentes primeiro.
  upcoming.sort((a, b) => {
    if (a.date && b.date) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return toMillis(b.created_at) - toMillis(a.created_at);
    }
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return toMillis(b.created_at) - toMillis(a.created_at);
  });
  past.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return toMillis(b.created_at) - toMillis(a.created_at);
  });

  return { upcoming, past };
}

/**
 * Filtra (somente abertos + critérios) e ordena por mais recentes primeiro.
 * @param {Array<object>} games
 * @param {{ city?: string, level?: string, format?: string }} [filters]
 * @returns {Array<object>}
 */
export function filterAndSortOpenGames(games, filters = {}) {
  const city = filters.city ? filters.city.trim().toLowerCase() : null;
  const level = filters.level && filters.level !== 'all' ? filters.level : null;
  const format = filters.format && filters.format !== 'all' ? filters.format : null;

  return (games || [])
    .filter((g) => g.status === OPEN_GAME_STATUS.OPEN)
    .filter((g) => (city ? String(g.city || '').trim().toLowerCase().includes(city) : true))
    .filter((g) => (level ? g.level === level : true))
    .filter((g) => (format ? g.format === format || g.format === OPEN_GAME_FORMAT.ANY : true))
    .sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
}
