/**
 * Domínio puro de CourtSchedule (horário recorrente de uma quadra).
 *
 * Cada schedule define uma janela de tempo recorrente (ex: "Seg-Sex
 * 08:00–12:00", "Sáb 14:00–22:00") em que uma quadra está disponível
 * para reservas. Múltiplas janelas no mesmo dia são permitidas (ex:
 * comercial + noturno).
 *
 * Sprint 1 (ARE-04) do roadmap arena — `docs/arena-roadmap.md`.
 * Adiciona a "grade de horários" que faltava entre as quadras (ARE-01)
 * e a lógica de conflito (futura ARE-07).
 *
 * Convenção de weekday: 0=Domingo..6=Sábado (igual a `Date.getDay()`
 * no JavaScript). Helpers de label em pt-BR inclusos.
 *
 * Decisões:
 * - `weekdays` é array (não único dia) porque o caso comum é "Seg-Sex"
 *   que seria 5 documentos se modelado por dia. Reduz volume de
 *   leituras em N vezes.
 * - `start_time`/`end_time` são string 'HH:MM' (não minutos) porque é
 *   mais legível pro admin e timezone-irrelevante (interpretado em
 *   local time do arena).
 * - `is_active` permite soft delete (esconder uma janela sem perder
 *   histórico de bookings que referenciam implicitamente esse slot).
 */

export const WEEKDAYS = Object.freeze({
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
});

export const WEEKDAY_LABELS_PT = Object.freeze({
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
});

export const WEEKDAY_SHORT_PT = Object.freeze({
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
});

/** Valida formato HH:MM (24h). Retorna 'HH:MM' normalizado ou null. */
export function normalizeTime(value) {
  const v = String(value ?? '').trim();
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Converte 'HH:MM' para minutos desde meia-noite. Retorna null se inválido. */
export function timeToMinutes(value) {
  const t = normalizeTime(value);
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Formata minutos desde meia-noite em 'HH:MM'. */
export function minutesToTime(min) {
  if (!Number.isFinite(min) || min < 0) return null;
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Formata range '08:00–12:00' (usa en-dash). */
export function formatTimeRange(start, end) {
  const s = normalizeTime(start);
  const e = normalizeTime(end);
  if (!s || !e) return '';
  return `${s}–${e}`;
}

/** Normaliza e valida array de weekdays (0-6, sem duplicatas, ordenado). */
export function normalizeWeekdays(input) {
  if (!Array.isArray(input)) return null;
  const out = new Set();
  for (const w of input) {
    const n = Number(w);
    if (!Number.isInteger(n) || n < 0 || n > 6) return null;
    out.add(n);
  }
  if (out.size === 0) return null;
  return Array.from(out).sort((a, b) => a - b);
}

/**
 * Normaliza e valida o input de um schedule.
 * @returns {{ valid: boolean, errors: object, value: object }}
 */
export function normalizeScheduleInput(input = {}) {
  const errors = {};
  const start = normalizeTime(input.start_time);
  const end = normalizeTime(input.end_time);
  if (!start) errors.start_time = 'Informe um horário de início válido (HH:MM).';
  if (!end) errors.end_time = 'Informe um horário de fim válido (HH:MM).';
  if (start && end && timeToMinutes(start) >= timeToMinutes(end)) {
    errors.end_time = 'O horário de fim deve ser depois do início.';
  }
  const weekdays = normalizeWeekdays(input.weekdays);
  if (!weekdays) errors.weekdays = 'Selecione pelo menos um dia da semana.';

  const label = String(input.label ?? '').trim().slice(0, 60);

  const value = {
    weekdays: weekdays || [],
    start_time: start || '',
    end_time: end || '',
    label,
    is_active: input.is_active !== false,
  };

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** Ordena schedules por (primeiro dia da semana, start_time). */
export function sortSchedules(schedules = []) {
  return [...schedules].sort((a, b) => {
    const aFirst = Array.isArray(a?.weekdays) && a.weekdays.length > 0 ? a.weekdays[0] : 99;
    const bFirst = Array.isArray(b?.weekdays) && b.weekdays.length > 0 ? b.weekdays[0] : 99;
    if (aFirst !== bFirst) return aFirst - bFirst;
    const aStart = timeToMinutes(a?.start_time) ?? 0;
    const bStart = timeToMinutes(b?.start_time) ?? 0;
    return aStart - bStart;
  });
}

/** Agrupa schedules por dia da semana. Retorna { 0: [...], 1: [...], ... }. */
export function groupSchedulesByWeekday(schedules = []) {
  const out = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const s of sortSchedules(schedules)) {
    if (!Array.isArray(s?.weekdays)) continue;
    for (const w of s.weekdays) {
      if (out[w]) out[w].push(s);
    }
  }
  return out;
}

/** Filtra schedules que se aplicam a um weekday específico. */
export function getSchedulesForWeekday(schedules = [], weekday) {
  return sortSchedules(schedules).filter(
    (s) => Array.isArray(s?.weekdays) && s.weekdays.includes(Number(weekday)),
  );
}

/** Filtra só os ativos. */
export function activeSchedules(schedules = []) {
  return schedules.filter((s) => s && s.is_active !== false);
}

/**
 * Renderiza uma lista de schedules como string pt-BR (ex: 'Seg-Sex
 * 08:00–12:00, Sáb 14:00–22:00'). Usado em cards de UI.
 */
export function summarizeSchedules(schedules = []) {
  const active = activeSchedules(schedules);
  if (active.length === 0) return '';
  return active.map(formatOneSchedule).join(' · ');
}

function formatOneSchedule(s) {
  const wd = Array.isArray(s.weekdays) ? s.weekdays : [];
  if (wd.length === 0) return '';
  const dayLabel = formatWeekdayRange(wd);
  const timeLabel = formatTimeRange(s.start_time, s.end_time);
  const labelPart = s.label ? ` (${s.label})` : '';
  return timeLabel ? `${dayLabel} ${timeLabel}${labelPart}` : `${dayLabel}${labelPart}`;
}

/** Formata lista de weekdays como 'Seg-Sex' ou 'Seg, Qua, Sex'. */
function formatWeekdayRange(weekdays) {
  if (weekdays.length === 0) return '';
  if (weekdays.length === 7) return 'Todos os dias';
  if (weekdays.length === 1) return WEEKDAY_SHORT_PT[weekdays[0]];
  // Detecta range contíguo
  let isRange = true;
  for (let i = 1; i < weekdays.length; i++) {
    if (weekdays[i] !== weekdays[i - 1] + 1) { isRange = false; break; }
  }
  if (isRange) {
    return `${WEEKDAY_SHORT_PT[weekdays[0]]}–${WEEKDAY_SHORT_PT[weekdays[weekdays.length - 1]]}`;
  }
  return weekdays.map((w) => WEEKDAY_SHORT_PT[w]).join(', ');
}

export const SCHEDULE = Object.freeze({
  WEEKDAYS,
  WEEKDAY_LABELS_PT,
  WEEKDAY_SHORT_PT,
});
