/**
 * Datas do treino em DIA LOCAL ('YYYY-MM-DD'). Nunca `toISOString().slice(0,10)`:
 * é a data de Greenwich, e das 21h à meia-noite no Brasil já seria amanhã.
 * A semana começa na segunda (como a sequência da gamificação).
 */

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocal(now = new Date()) {
  return toISODate(now);
}

export function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ''));
}

function at(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addDays(iso, n) {
  const d = at(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(iso) {
  return at(iso).getDay();
}

/** Segunda-feira da semana do dia (chave da semana). */
export function weekKeyOf(iso) {
  const wd = weekdayOf(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

/** Os 7 dias (segunda a domingo) da semana. */
export function weekDates(weekKey) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekKey, i));
}

export function daysBetween(a, b) {
  return Math.round((at(b) - at(a)) / 86400000);
}

export const WEEKDAY_SHORT = Object.freeze(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);
export const WEEKDAY_LONG = Object.freeze(['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);

/** "Qua, 08/10" (e o ano quando não é o corrente). */
export function formatDayLabel(iso, today = todayLocal()) {
  if (!isISODate(iso)) return '';
  const [y, m, d] = iso.split('-');
  const ano = y !== today.slice(0, 4) ? `/${y}` : '';
  return `${WEEKDAY_SHORT[weekdayOf(iso)]}, ${d}/${m}${ano}`;
}
