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

/**
 * O preço TOTAL de uma reserva: a soma de cada horário, na tabela da arena.
 *
 * ## O bug que isto corrige
 *
 * `resolveArenaPrice` devolve o valor **por hora**. As telas gravavam esse
 * número como `proposed_price` da reserva — então uma reserva de três horas
 * chegava à arena valendo **uma**. O erro aparecia de novo na lista de
 * reservas do dia: várias quadras pendentes, todas com o preço de uma hora.
 *
 * Não era erro de exibição: era o número **gravado**. Por isso a conta mora
 * aqui, no domínio, e o serviço a refaz antes de escrever — a tela pode
 * estimar, mas quem grava confere.
 *
 * Cada horário é cobrado pela sua própria faixa: das 18h às 20h com tabela
 * diferente às 19h, a soma respeita as duas.
 *
 * @param {object} arena
 * @param {{ courtId?: string|null, slots?: Array<{date,start,end}>, clientId?: string|null }} args
 * @returns {{ total: number, hours: number, minutes: number, hourlyRates: Array<number>, breakdown: Array }}
 */
export function totalBookingPrice(arena, { courtId = null, slots = [], clientId = null } = {}) {
  const vazio = { total: 0, hours: 0, minutes: 0, hourlyRates: [], breakdown: [] };
  if (!arena || !Array.isArray(slots) || slots.length === 0) return vazio;

  let total = 0;
  let minutes = 0;
  const breakdown = [];
  const hourlyRates = [];

  slots.forEach((slot) => {
    const ini = timeToMinutes(slot?.start);
    const fim = timeToMinutes(slot?.end);
    if (!slot?.date || ini == null || fim == null || fim <= ini) return;
    const duracao = fim - ini;
    const { price, label } = resolveArenaPrice(arena, {
      date: slot.date, weekday: weekdayOfDate(slot.date), time: slot.start, courtId, clientId,
    });
    const hora = Number(price) || 0;
    const valor = hora * (duracao / 60);
    minutes += duracao;
    total += valor;
    hourlyRates.push(hora);
    breakdown.push({
      date: slot.date, start: slot.start, end: slot.end,
      minutes: duracao, hourlyRate: hora, price: Math.round(valor * 100) / 100, label,
    });
  });

  return {
    total: Math.round(total * 100) / 100,
    hours: Math.round((minutes / 60) * 100) / 100,
    minutes,
    hourlyRates: Array.from(new Set(hourlyRates)),
    breakdown,
  };
}

/**
 * Dia da semana de 'YYYY-MM-DD' (0 = domingo).
 *
 * Repetido aqui (em vez de importado de `booking.js`) porque aquele arquivo já
 * importa deste: uma ida e volta entre os dois por três linhas não paga o ciclo.
 */
function weekdayOfDate(dateISO) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
}

/**
 * O texto que tira a ambiguidade de um valor de reserva.
 *
 * "R$ 240" sozinho não diz se é a hora ou o total — e foi exatamente essa
 * dúvida que apareceu na tela. Com a duração ao lado, não sobra pergunta.
 *
 * @returns {string} ex.: "R$ 240,00 · 3h (R$ 80,00/h)"
 */
export function priceWithDurationText(total, hours, hourlyRates = []) {
  const partes = [formatPrice(total)];
  if (hours > 0) partes.push(`${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`);
  if (hourlyRates.length === 1 && hours !== 1) partes.push(`${formatPrice(hourlyRates[0])}/h`);
  const [valor, ...resto] = partes;
  return resto.length > 0 ? `${valor} · ${resto.join(' · ')}` : valor;
}

/**
 * O valor a MOSTRAR de uma reserva, sem ambiguidade.
 *
 * Três coisas competiam pelo mesmo espaço na tela — o valor por hora, o total
 * pedido e o valor acordado — e todas apareciam como "R$ X". Esta função diz
 * qual é qual, e devolve a duração junto, porque um número de dinheiro sem
 * duração ao lado sempre pode ser lido como "por hora".
 *
 * Com a `arena` em mãos, RECALCULA o total pela tabela: é o que corrige as
 * reservas antigas, gravadas com o valor de uma hora só. Sem ela, mostra o que
 * está gravado — mas nunca sem a duração ao lado.
 *
 * @param {object} booking
 * @param {{ arena?: object|null }} [ctx]
 * @returns {{ value: number|null, hours: number, agreed: boolean, recalculado: boolean, text: string }}
 */
export function bookingPriceInfo(booking, { arena = null } = {}) {
  const slots = Array.isArray(booking?.slots) ? booking.slots : [];
  const minutos = slots.reduce((acc, s) => {
    const ini = timeToMinutes(s?.start);
    const fim = timeToMinutes(s?.end);
    return ini != null && fim != null && fim > ini ? acc + (fim - ini) : acc;
  }, 0);
  const hours = Math.round((minutos / 60) * 100) / 100;

  const acordado = num(booking?.agreed_price);
  if (acordado != null) {
    return { value: acordado, hours, agreed: true, recalculado: false, text: priceWithDurationText(acordado, hours, []) };
  }

  if (arena && slots.length > 0) {
    const r = totalBookingPrice(arena, { courtId: booking?.court_id || null, slots, clientId: booking?.athlete_id || null });
    if (r.total > 0) {
      return { value: r.total, hours, agreed: false, recalculado: true, text: priceWithDurationText(r.total, hours, r.hourlyRates) };
    }
  }

  const proposto = num(booking?.proposed_price);
  return {
    value: proposto,
    hours,
    agreed: false,
    recalculado: false,
    text: proposto == null ? 'Sob consulta' : priceWithDurationText(proposto, hours, []),
  };
}
