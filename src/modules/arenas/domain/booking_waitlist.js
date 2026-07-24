/**
 * Domínio puro da lista de espera de RESERVAS (flag booking_waitlist).
 *
 * Distinto do waitlist de matchmaking (Arena V3). Normaliza uma entrada da lista
 * de espera de um horário de reserva e agrupa as entradas por horário para a
 * arena visualizar. Sem I/O.
 */

const str = (v) => String(v ?? '').trim();

/** Chave estável de um horário (data + início + fim + quadra opcional). */
export function waitlistSlotKey(entry = {}) {
  return [str(entry.date), str(entry.start), str(entry.end), str(entry.court_id) || 'any'].join('|');
}

/** Normaliza a entrada a ser gravada. Retorna { valid, error, value }. */
export function normalizeWaitlistEntry(input = {}) {
  const arena_id = str(input.arena_id);
  const user_id = str(input.user_id);
  const date = str(input.date);
  const start = str(input.start);
  const end = str(input.end);
  if (!arena_id) return { valid: false, error: 'Arena inválida.', value: {} };
  if (!user_id) return { valid: false, error: 'Usuário inválido.', value: {} };
  if (!date || !start || !end) return { valid: false, error: 'Horário inválido.', value: {} };
  return {
    valid: true,
    error: null,
    value: {
      arena_id, user_id, date, start, end,
      court_id: str(input.court_id) || null,
      user_name: str(input.user_name).slice(0, 120) || 'Atleta',
      user_photo: str(input.user_photo) || '',
      notes: str(input.notes).slice(0, 300),
    },
  };
}

/** Id determinístico (evita duplicar a mesma pessoa no mesmo horário). */
export function waitlistDocId(entry = {}) {
  return `${str(entry.arena_id)}_${str(entry.user_id)}_${str(entry.date)}_${str(entry.start)}`;
}

/** Agrupa as entradas por horário, ordenando por data/hora. */
export function groupWaitlistBySlot(entries = []) {
  const map = new Map();
  (entries || []).forEach((e) => {
    const key = waitlistSlotKey(e);
    if (!map.has(key)) map.set(key, { key, date: e.date, start: e.start, end: e.end, court_id: e.court_id || null, entries: [] });
    map.get(key).entries.push(e);
  });
  return Array.from(map.values()).sort((a, b) => (
    (a.date > b.date ? 1 : a.date < b.date ? -1 : 0)
    || (a.start > b.start ? 1 : a.start < b.start ? -1 : 0)
  ));
}

/** Uma pessoa já está na lista de espera daquele horário? */
export function isOnWaitlist(entries = [], userId, slot = {}) {
  const key = waitlistSlotKey(slot);
  return (entries || []).some((e) => e.user_id === userId && waitlistSlotKey(e) === key);
}
