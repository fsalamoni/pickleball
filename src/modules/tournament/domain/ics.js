/**
 * Domínio puro de geração de arquivos de calendário (iCalendar / .ics).
 *
 * Gera o conteúdo de um evento (VEVENT) importável no Google, Apple e Outlook
 * Calendar. Sem I/O — recebe os dados do evento e devolve a string .ics. O
 * download em si é responsabilidade da camada de UI.
 *
 * Usado para exportar jogos, torneios e reservas/aulas para o calendário do
 * usuário (flag calendar_export).
 */

const PRODID = '-//PickleRush//Calendario//PT-BR';

/** Escapa texto conforme a RFC 5545 (vírgula, ponto-e-vírgula, barra, quebra). */
export function escapeICSText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Converte Date (ou ms) para o formato UTC do iCalendar: YYYYMMDDTHHMMSSZ. */
export function toICSDate(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`
    + `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * Monta um Date a partir de 'YYYY-MM-DD' + 'HH:MM' interpretados no horário de
 * Brasília (UTC-3). Pickleball no Brasil não observa mais horário de verão, então
 * o offset fixo é suficiente e evita depender do fuso do dispositivo.
 */
export function brtDateTime(dateStr, timeStr = '00:00') {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const [hh, mm] = String(timeStr || '00:00').split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  // Meio-dia UTC do dia + offset: constrói no UTC somando 3h ao horário local BRT.
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh + 3, mm, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Quebra linhas longas em 75 octetos (folding), como manda a RFC 5545. */
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

/**
 * Gera o conteúdo .ics de um único evento.
 * @param {object} e
 * @param {string} e.uid      identificador estável (ex.: booking id + arena)
 * @param {Date|number} e.start início
 * @param {Date|number} e.end   fim (opcional; default +1h)
 * @param {string} e.title    resumo
 * @param {string} [e.description]
 * @param {string} [e.location]
 * @param {string} [e.url]
 * @returns {string|null} conteúdo .ics ou null se datas inválidas
 */
export function buildICS(e = {}) {
  const dtStart = toICSDate(e.start);
  if (!dtStart) return null;
  const endInput = e.end != null ? e.end : new Date(new Date(e.start).getTime() + 60 * 60 * 1000);
  const dtEnd = toICSDate(endInput);
  if (!dtEnd) return null;

  const uid = escapeICSText(e.uid || `${Date.now()}@picklerush`);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(e.title || 'Evento')}`,
  ];
  if (e.description) lines.push(`DESCRIPTION:${escapeICSText(e.description)}`);
  if (e.location) lines.push(`LOCATION:${escapeICSText(e.location)}`);
  if (e.url) lines.push(`URL:${escapeICSText(e.url)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldLine).join('\r\n');
}

/** Nome de arquivo seguro a partir de um título. */
export function icsFilename(title) {
  const base = String(title || 'evento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'evento';
  return `${base}.ics`;
}
