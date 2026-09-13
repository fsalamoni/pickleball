/**
 * Domínio puro de calendário de arena.
 *
 * Gera grids de mês/semana e helpers de navegação. Sem I/O — recebe
 * reservas e quadras como input e retorna estruturas prontas pra UI.
 *
 * Sprint 1 (ARE-02) do roadmap arena — `docs/arena-roadmap.md`.
 *
 * Convenção:
 * - Semana começa no DOMINGO (0), igual a `Date.getDay()` no JS
 * - 'YYYY-MM-DD' para datas (sempre local, sem timezone math)
 * - Grid mensal: 6 linhas x 7 colunas (até 42 dias) cobrindo o mês
 *   inteiro incluindo dias overflow de meses vizinhos
 *
 * Decisões:
 * - Função pura `buildMonthGrid(year, month)` — mesma entrada = mesma
 *   saída (sem dependência de `Date.now()` exceto pra "hoje")
 * - `todayISO()` é a única função com side-effect (data atual),
 *   separada pra permitir mocking em tests
 * - Navegação por offset (month ± N) em vez de Date arithmetic no
 *   componente — domain fica testável
 */

const WEEKDAY_HEADERS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** 'YYYY-MM-DD' -> Date local (meia-noite) ou null. Valida mês/dia. */
export function parseDate(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** Date -> 'YYYY-MM-DD' (local). */
export function formatDateISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' -> weekday 0-6 (domingo=0) ou null. */
export function weekdayOf(value) {
  const d = parseDate(value);
  return d ? d.getDay() : null;
}

/** Hoje como 'YYYY-MM-DD'. */
export function todayISO() {
  return formatDateISO(new Date());
}

/* ------------------------------------------------------------------ *
 * Datas COMO GENTE LÊ
 *
 * `2026-07-23 · 19:00–20:00` era o que aparecia na reserva do atleta, na do
 * arena, no resumo do pedido e no bloqueio do calendário. Ninguém no Brasil
 * lê data assim: o mês vem antes do dia, e a pessoa precisa parar para
 * traduzir — bem no momento em que confere se a reserva é a que ela queria.
 *
 * Montado a partir das constantes daqui, e não de `toLocaleDateString`, para
 * a saída não depender da configuração de idioma da máquina nem dos dados de
 * localização do Node: mesma entrada, mesmo texto, sempre.
 * ------------------------------------------------------------------ */

/** 'YYYY-MM-DD' → '23/07'. Vazio se a data não fizer sentido. */
export function formatDayMonth(value) {
  const d = parseDate(value);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → '23/07/2026'. */
export function formatDateBR(value) {
  const d = parseDate(value);
  if (!d) return '';
  return `${formatDayMonth(value)}/${d.getFullYear()}`;
}

/**
 * 'YYYY-MM-DD' → 'Qui, 23/07' — e com o ANO quando ele não é o corrente,
 * porque "23/07" numa reserva de 2027 é uma armadilha.
 *
 * @param {string} value
 * @param {{ hoje?: string }} [opts] `hoje` existe para o teste não depender
 *   do relógio; em produção vale a data de hoje.
 */
export function formatDateShortBR(value, { hoje = todayISO() } = {}) {
  const d = parseDate(value);
  if (!d) return '';
  const dia = WEEKDAY_HEADERS_PT[d.getDay()];
  const mesmoAno = String(hoje || '').slice(0, 4) === String(d.getFullYear());
  return `${dia}, ${mesmoAno ? formatDayMonth(value) : formatDateBR(value)}`;
}

/** 'YYYY-MM-DD' → 'Quinta-feira, 23 de julho de 2026'. */
export function formatDateLongBR(value) {
  const d = parseDate(value);
  if (!d) return '';
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${MONTH_LABELS_PT[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}

/**
 * Um horário de reserva por extenso: 'Qui, 23/07 · 19:00–20:00'.
 *
 * É a etiqueta que aparece na linha da reserva dos dois lados do balcão —
 * mesma função, mesmo texto, para a pessoa e a arena estarem falando do
 * mesmo horário.
 */
export function formatSlotLabel(slot, { hoje = todayISO() } = {}) {
  if (!slot?.date) return '';
  const dia = formatDateShortBR(slot.date, { hoje });
  if (!dia) return '';
  if (!slot.start || !slot.end) return dia;
  return `${dia} · ${slot.start}–${slot.end}`;
}

/** Compara 2 'YYYY-MM-DD'. Retorna -1, 0, 1. */
export function compareDateISO(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Adiciona N dias a uma data ISO. */
export function addDaysISO(dateISO, days) {
  const d = parseDate(dateISO);
  if (!d) return null;
  d.setDate(d.getDate() + Number(days || 0));
  return formatDateISO(d);
}

/** Adiciona N meses. Retorna { year, month }. */
export function addMonths(year, month, delta) {
  const d = new Date(year, month - 1 + Number(delta || 0), 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Headers de dias da semana em pt-BR. */
export function getWeekdayHeaders() {
  return [...WEEKDAY_HEADERS_PT];
}

/** Label do mês em pt-BR (ex: 'Janeiro 2026'). */
export function getMonthLabel(year, month) {
  const m = MONTH_LABELS_PT[month - 1] || '';
  return `${m} ${year}`;
}

/**
 * Constrói grid mensal: 6 linhas x 7 colunas. Cada célula contém:
 *  - date: 'YYYY-MM-DD'
 *  - day: número do dia (1-31)
 *  - inMonth: true se é do mês exibido
 *  - isToday: true se é hoje
 *  - weekday: 0-6
 */
export function buildMonthGrid(year, month, today = todayISO()) {
  if (!Number.isInteger(year) || year < 1900 || year > 3000) return [];
  if (!Number.isInteger(month) || month < 1 || month > 12) return [];

  const firstOfMonth = new Date(year, month - 1, 1);
  const firstWeekday = firstOfMonth.getDay();
  const startDate = new Date(year, month - 1, 1 - firstWeekday);

  const grid = [];
  for (let week = 0; week < 6; week++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(startDate);
      cell.setDate(startDate.getDate() + week * 7 + d);
      const iso = formatDateISO(cell);
      row.push({
        date: iso,
        day: cell.getDate(),
        inMonth: cell.getMonth() + 1 === month,
        isToday: iso === today,
        weekday: cell.getDay(),
      });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Extrai todos os slots de uma reserva (lida com formato novo e legado).
 */
export function expandBookingSlots(booking) {
  if (!booking) return [];
  if (Array.isArray(booking.slots)) {
    return booking.slots.map((s) => ({ ...s, court_id: s.court_id || booking.court_id || null }));
  }
  if (booking.date && booking.start && booking.end) {
    return [{
      date: booking.date,
      start: booking.start,
      end: booking.end,
      court_id: booking.court_id || null,
    }];
  }
  return [];
}

/**
 * Agrupa slots de reservas por data.
 * @param {Object} [opts]
 * @param {string} [opts.courtId] - se informado, só slots dessa quadra
 * @param {Array<string>} [opts.statuses] - default: todos os status
 */
export function groupBookingsByDate(bookings = [], { courtId, statuses } = {}) {
  const out = {};
  for (const b of bookings) {
    if (statuses && !statuses.includes(b.status)) continue;
    for (const slot of expandBookingSlots(b)) {
      if (courtId && slot.court_id && slot.court_id !== courtId) continue;
      if (!out[slot.date]) out[slot.date] = [];
      out[slot.date].push({
        ...slot,
        booking_id: b.id,
        booking_status: b.status,
        booking_kind: b.kind || 'single',
        athlete_name: b.athlete_name || '',
      });
    }
  }
  return out;
}

/** Gera range de datas ISO entre start e end (inclusive). */
export function dateRangeISO(startISO, endISO) {
  const start = parseDate(startISO);
  const end = parseDate(endISO);
  if (!start || !end) return [];
  const out = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(formatDateISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Range ISO do mês inteiro (incluso dias overflow do grid 6x7). */
export function monthRangeISO(year, month) {
  const grid = buildMonthGrid(year, month);
  if (grid.length === 0) return { start: null, end: null, dates: [] };
  const first = grid[0][0].date;
  const last = grid[grid.length - 1][6].date;
  return { start: first, end: last, dates: dateRangeISO(first, last) };
}
