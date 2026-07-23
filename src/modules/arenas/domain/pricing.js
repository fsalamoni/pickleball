/**
 * Domínio puro de preços da arena.
 *
 * Modelo:
 *  - base_price: preço padrão único (fallback), número ou null.
 *  - price_rules: [{ id, label, weekdays:[0..6], start:'HH:MM', end:'HH:MM', price }]
 *    preços padrão por dia da semana e faixa de horário.
 *  - price_overrides: [{ id, label, date:'YYYY-MM-DD'|null, client_id:string|null,
 *    price, note }] exceções por ocasião (data) ou cliente específico.
 *
 * A resolução é determinística: exceção (data/cliente) > regra por dia/horário >
 * preço base. Sem I/O — testável isoladamente.
 */

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 'HH:MM' -> minutos desde 00:00 (ou null). */
export function timeToMinutes(value) {
  const m = String(value ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Normaliza/valida uma regra de preço padrão. */
export function normalizePriceRule(input = {}) {
  const weekdays = Array.isArray(input.weekdays)
    ? input.weekdays.map((d) => Math.trunc(Number(d))).filter((d) => d >= 0 && d <= 6)
    : [];
  const price = num(input.price);
  const start = String(input.start ?? '').trim();
  const end = String(input.end ?? '').trim();
  const courtId = String(input.court_id ?? '').trim(); // ARE-05: regra por quadra
  const valid = weekdays.length > 0
    && price != null && price >= 0
    && timeToMinutes(start) != null
    && timeToMinutes(end) != null
    && timeToMinutes(end) > timeToMinutes(start);
  return {
    valid,
    value: {
      id: String(input.id || '').trim() || `r_${Math.random().toString(36).slice(2, 9)}`,
      label: String(input.label ?? '').trim().slice(0, 80),
      weekdays: Array.from(new Set(weekdays)).sort((a, b) => a - b),
      start,
      end,
      price: price ?? 0,
      court_id: courtId || null, // ARE-05
    },
  };
}

/** Normaliza/valida uma exceção de preço. */
export function normalizePriceOverride(input = {}) {
  const price = num(input.price);
  const date = String(input.date ?? '').trim();
  const clientId = String(input.client_id ?? '').trim();
  const validDate = date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date);
  const valid = price != null && price >= 0 && validDate && (date !== '' || clientId !== '' || String(input.label ?? '').trim() !== '');
  return {
    valid,
    value: {
      id: String(input.id || '').trim() || `o_${Math.random().toString(36).slice(2, 9)}`,
      label: String(input.label ?? '').trim().slice(0, 80),
      date: validDate ? date : '',
      client_id: clientId,
      price: price ?? 0,
      note: String(input.note ?? '').trim().slice(0, 200),
    },
  };
}

/**
 * Resolve o preço para um horário específico.
 *
 * Hierarquia (ARE-05, com court_id):
 *  1. Override com court_id matching
 *  2. Override sem court_id (todas)
 *  3. Regra com court_id matching
 *  4. Regra sem court_id (todas)
 *  5. base_price
 *
 * @param {{ base_price?: number|null, price_rules?: object[], price_overrides?: object[] }} arena
 * @param {{ date?: string, weekday?: number, time?: string, clientId?: string, courtId?: string|null }} slot
 * @returns {{ price: number|null, source: 'override'|'rule'|'base'|'none', label: string }}
 */
export function resolveArenaPrice(arena = {}, slot = {}) {
  const overrides = Array.isArray(arena.price_overrides) ? arena.price_overrides : [];
  const rules = Array.isArray(arena.price_rules) ? arena.price_rules : [];
  const { date, weekday, time, clientId, courtId } = slot;

  // Helper: match por data exata OU cliente específico. Se slot tem courtId,
  // prioriza override com court_id matching, depois sem court_id.
  const matchingOverrides = (filterCourt) => overrides.filter((o) => {
    if (o.date && date && o.date === date) return true;
    if (o.client_id && clientId && o.client_id === clientId) return true;
    return false;
  }).filter((o) => filterCourt
    ? (o.court_id && o.court_id === filterCourt)
    : !o.court_id);

  let override = null;
  if (courtId) override = matchingOverrides(courtId)[0];
  if (!override) override = overrides.find((o) => {
    if (o.date && date && o.date === date) return true;
    if (o.client_id && clientId && o.client_id === clientId) return true;
    return false;
  });
  if (override) {
    return { price: num(override.price), source: 'override', label: override.label || 'Exceção' };
  }

  // 2) Regra por dia da semana + faixa de horário. Mesma lógica de prioridade court.
  const minutes = timeToMinutes(time);
  if (Number.isFinite(weekday) && minutes != null) {
    const matches = (filterCourt) => rules.filter((r) => {
      const s = timeToMinutes(r.start);
      const e = timeToMinutes(r.end);
      const wdMatch = Array.isArray(r.weekdays) && r.weekdays.includes(weekday);
      const timeMatch = s != null && e != null && minutes >= s && minutes < e;
      const courtMatch = filterCourt
        ? (r.court_id && r.court_id === filterCourt)
        : !r.court_id;
      return wdMatch && timeMatch && courtMatch;
    });

    let rule = null;
    if (courtId) rule = matches(courtId)[0];
    if (!rule) rule = rules.find((r) => {
      const s = timeToMinutes(r.start);
      const e = timeToMinutes(r.end);
      return Array.isArray(r.weekdays)
        && r.weekdays.includes(weekday)
        && s != null && e != null
        && minutes >= s && minutes < e
        && !r.court_id; // só regras sem court_id no fallback
    });
    if (rule) return { price: num(rule.price), source: 'rule', label: rule.label || 'Preço padrão' };
  }

  // 3) Preço base.
  const base = num(arena.base_price);
  if (base != null) return { price: base, source: 'base', label: 'Preço base' };

  return { price: null, source: 'none', label: 'Sob consulta' };
}

/** Formata um valor em BRL (ou "Sob consulta"). */
export function formatPrice(value) {
  const n = num(value);
  if (n == null) return 'Sob consulta';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
