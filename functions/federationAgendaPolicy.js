/**
 * Calendário oficial da federação — a conta PURA (sem banco): tipos de
 * evento, a validação, o horário em milissegundos e o arquivo de calendário
 * (ICS, RFC 5545) que a agenda assinável entrega.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/agenda.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationAgenda.parity.test.js`. Os ids são GRAVADOS: nunca renomeie.
 */
const TITLE_MAX = 160;
const DESCRIPTION_MAX = 4000;
const PLACE_MAX = 120;
const ADDRESS_MAX = 200;
const CITY_MAX = 80;
const ORGAN_MAX = 120;
const URL_MAX = 500;
const RELATED_MAX = 10;
const REASON_MIN = 10;
const SPAN_MAX_DAYS = 366;
const HISTORY_MAX = 20;
/** O Brasil não tem horário de verão desde 2019: Brasília é sempre UTC−3. */
const BR_OFFSET_MS = 3 * 3600000;
const DAY_MS = 86400000;

const STATUS = Object.freeze({ SCHEDULED: 'scheduled', POSTPONED: 'postponed', CANCELLED: 'cancelled' });
const VISIBILITY = Object.freeze(['public', 'members', 'staff']);
const GROUPS = Object.freeze(['sport', 'institutional', 'event']);

/** [id, grupo, é reunião de órgão, rótulo] — `meeting` ganha pauta, quórum e ata. */
const KINDS = Object.freeze(Object.fromEntries([
  ['competition', 'sport', false, 'Competição ou etapa'], ['selection', 'sport', false, 'Seletiva ou seleção'],
  ['course', 'sport', false, 'Curso ou clínica'], ['sport_other', 'sport', false, 'Outro evento esportivo'],
  ['assembly_ordinary', 'institutional', true, 'Assembleia geral ordinária'],
  ['assembly_extraordinary', 'institutional', true, 'Assembleia geral extraordinária'],
  ['assembly_special', 'institutional', true, 'Assembleia especial ou eleitoral'],
  ['board', 'institutional', true, 'Reunião da diretoria'], ['fiscal_council', 'institutional', true, 'Reunião do conselho fiscal'],
  ['committee', 'institutional', true, 'Reunião de comissão ou setor'],
  ['deadline', 'institutional', false, 'Prazo oficial'], ['office', 'institutional', false, 'Expediente ou recesso'],
  ['ceremony', 'event', false, 'Solenidade ou premiação'], ['event', 'event', false, 'Evento'],
].map(([id, group, meeting, label]) => [id, Object.freeze({ group, meeting, label })])));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DOC_ID = /^[A-Za-z0-9]{1,80}$/;
const UF = /^[A-Z]{2}$/;

const limpa = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const limpaTexto = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

function isoValida(s) {
  if (!ISO.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "2026-11-05" + "19:30" no horário de Brasília → milissegundos (UTC). */
function brMs(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) + BR_OFFSET_MS;
}

/** Início e fim do evento em milissegundos. Sem hora de fim, o evento dura uma hora (ou vai até o fim do último dia). */
function eventSpan({ date, end_date: endDate, all_day: allDay, start_time: startTime, end_time: endTime }) {
  const fim = endDate || date;
  if (allDay) return { starts_at_ms: brMs(date), ends_at_ms: brMs(fim) + DAY_MS };
  const starts = brMs(date, startTime);
  if (endTime) return { starts_at_ms: starts, ends_at_ms: brMs(fim, endTime) };
  return { starts_at_ms: starts, ends_at_ms: fim === date ? starts + 3600000 : brMs(fim, '23:59') };
}

/**
 * Valida o evento. Devolve `{ ok, errors, value }` — `value` com os campos
 * limpos e o início/fim calculados (`starts_at_ms`, `ends_at_ms`).
 */
function validateEvent(input = {}) {
  const errors = {};
  const kind = KINDS[input.kind] ? input.kind : '';
  if (!kind) errors.kind = 'Escolha o tipo do evento.';
  const title = limpa(input.title, TITLE_MAX);
  if (title.length < 3) errors.title = 'Dê um título ao evento.';
  const description = limpaTexto(input.description, DESCRIPTION_MAX);
  const date = String(input.date || '');
  if (!isoValida(date)) errors.date = 'Informe a data.';
  const endDate = input.end_date ? String(input.end_date) : date;
  if (input.end_date && !isoValida(endDate)) errors.end_date = 'Data de término inválida.';
  else if (isoValida(date) && isoValida(endDate)) {
    if (endDate < date) errors.end_date = 'O término não pode ser antes do início.';
    else if ((brMs(endDate) - brMs(date)) / DAY_MS > SPAN_MAX_DAYS) errors.end_date = 'Um evento dura no máximo um ano.';
  }
  const allDay = input.all_day === true;
  const startTime = allDay ? '' : String(input.start_time || '');
  const endTime = allDay ? '' : String(input.end_time || '');
  if (!allDay && !HHMM.test(startTime)) errors.start_time = 'Informe o horário de início.';
  if (!allDay && endTime && !HHMM.test(endTime)) errors.end_time = 'Horário de término inválido.';
  if (!allDay && HHMM.test(startTime) && HHMM.test(endTime) && endDate === date && endTime <= startTime) errors.end_time = 'O término precisa ser depois do início.';
  const p = input.place && typeof input.place === 'object' ? input.place : {};
  const state = limpa(p.state, 2).toUpperCase();
  const place = { name: limpa(p.name, PLACE_MAX), address: limpa(p.address, ADDRESS_MAX), city: limpa(p.city, CITY_MAX), state: /^[A-Z]{2}$/.test(state) ? state : '' };
  const onlineUrl = limpa(input.online_url, URL_MAX);
  if (onlineUrl && !/^https:\/\/[^\s]+\.[^\s]+/.test(onlineUrl)) errors.online_url = 'Use um link que comece com https://.';
  const organ = limpa(input.organ, ORGAN_MAX);
  const visibility = VISIBILITY.includes(input.visibility) ? input.visibility : 'public';
  const ids = [...new Set((Array.isArray(input.related_docs) ? input.related_docs : []).map((r) => String((r && r.doc_id) || r || '')).filter((x) => DOC_ID.test(x)))];
  if (ids.length > RELATED_MAX) errors.related_docs = `No máximo ${RELATED_MAX} documentos ligados.`;
  const value = {
    kind, group: kind ? KINDS[kind].group : '', title, description, date, end_date: endDate, all_day: allDay, start_time: startTime, end_time: endTime,
    place, online_url: onlineUrl, organ, visibility, related_docs: ids.slice(0, RELATED_MAX).map((doc_id) => ({ doc_id })),
  };
  if (!errors.date && !errors.end_date && !errors.start_time && !errors.end_time) Object.assign(value, eventSpan(value));
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** A data ou o horário mudaram? (É o que exige motivo num evento que já foi divulgado.) */
const whenChanged = (a = {}, b = {}) => ['date', 'end_date', 'all_day', 'start_time', 'end_time'].some((k) => (a[k] ?? '') !== (b[k] ?? ''));

/* ------------------------------------------------------------- ICS -- */

const icsEscape = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([;,])/g, '\\$1');
const utcStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateStamp = (iso) => iso.replace(/-/g, '');
const somaDia = (iso, n) => new Date(brMs(iso) - BR_OFFSET_MS + n * DAY_MS).toISOString().slice(0, 10);

/** Dobra a linha em 75 octetos (RFC 5545 §3.1), sem partir um caractere. */
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let atual = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(atual); atual = ''; bytes = 0; }
    atual += ch;
    bytes += b;
  }
  out.push(atual);
  return out.join('\r\n ');
}

const placeText = (p = {}) => [p.name, p.address, [p.city, p.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');

/**
 * Um evento como VEVENT. `ev` pode ser um evento gravado ou um item derivado
 * (torneio chancelado). `url` é o endereço da página do evento; `host` vai no UID.
 */
function eventIcsLines(ev, { url = '', host = 'picklerush.web.app', stampMs = 0 } = {}) {
  const linhas = ['BEGIN:VEVENT', `UID:${ev.id}@${host}`, `DTSTAMP:${utcStamp(stampMs || Number(ev.updated_at_ms) || Number(ev.created_at_ms) || 0)}`];
  if (ev.all_day) {
    linhas.push(`DTSTART;VALUE=DATE:${dateStamp(ev.date)}`, `DTEND;VALUE=DATE:${dateStamp(somaDia(ev.end_date || ev.date, 1))}`);
  } else {
    linhas.push(`DTSTART:${utcStamp(ev.starts_at_ms)}`, `DTEND:${utcStamp(ev.ends_at_ms)}`);
  }
  const status = ev.status === STATUS.CANCELLED ? 'CANCELLED' : ev.status === STATUS.POSTPONED ? 'TENTATIVE' : 'CONFIRMED';
  const prefixo = ev.status === STATUS.CANCELLED ? 'CANCELADO: ' : ev.status === STATUS.POSTPONED ? 'ADIADO: ' : '';
  linhas.push(`SUMMARY:${icsEscape(prefixo + ev.title)}`);
  const desc = [ev.description, ev.online_url, url].filter(Boolean).join('\n\n');
  if (desc) linhas.push(`DESCRIPTION:${icsEscape(desc)}`);
  const loc = placeText(ev.place) || (ev.online_url ? 'Online' : '');
  if (loc) linhas.push(`LOCATION:${icsEscape(loc)}`);
  if (url) linhas.push(`URL:${url}`);
  linhas.push(`STATUS:${status}`, `SEQUENCE:${(Array.isArray(ev.history) ? ev.history.length : 0)}`, 'END:VEVENT');
  return linhas;
}

/** O calendário inteiro (VCALENDAR). `urlOf(ev)` dá o endereço de cada evento. */
function buildIcs(events = [], { name = 'Agenda', host = 'picklerush.web.app', urlOf = () => '', stampMs = 0 } = {}) {
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PickleRush//Agenda oficial//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(name)}`, 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ];
  (events || []).filter((ev) => ev && ev.id && ev.date).forEach((ev) => linhas.push(...eventIcsLines(ev, { url: urlOf(ev), host, stampMs })));
  linhas.push('END:VCALENDAR');
  return linhas.map(fold).join('\r\n') + '\r\n';
}

/** O torneio entra na agenda? Chancela aprovada, público, não arquivado, nem rascunho nem cancelado. */
const isAgendaTournament = (tt) => Boolean(tt) && tt.federation_sanction && tt.federation_sanction.status === 'approved'
  && tt.visibility === 'public' && tt.archived !== true && !['draft', 'cancelled'].includes(tt.status);

/** Torneio chancelado como item de agenda (derivado, nada gravado). */
function tournamentAgendaItem(tt) {
  if (!isAgendaTournament(tt)) return null;
  const date = String(tt.starts_at || '').slice(0, 10);
  if (!isoValida(date)) return null;
  const fim = String(tt.ends_at || '').slice(0, 10);
  const endDate = isoValida(fim) && fim >= date ? fim : date;
  return {
    id: `torneio_${tt.id}`, tournament_id: tt.id, kind: 'tournament', group: 'sport', derived: true,
    title: String(tt.name || 'Torneio'), description: '', date, end_date: endDate, all_day: true, start_time: '', end_time: '',
    place: { name: String(tt.venue || ''), address: '', city: String(tt.city || ''), state: UF.test(String(tt.state || '').toUpperCase()) ? String(tt.state).toUpperCase() : '' }, online_url: '', status: STATUS.SCHEDULED,
    starts_at_ms: brMs(date), ends_at_ms: brMs(endDate) + DAY_MS, history: [],
  };
}

module.exports = {
  TITLE_MAX, DESCRIPTION_MAX, PLACE_MAX, ADDRESS_MAX, CITY_MAX, ORGAN_MAX, URL_MAX, RELATED_MAX, REASON_MIN, SPAN_MAX_DAYS, HISTORY_MAX,
  STATUS, VISIBILITY, GROUPS, KINDS, brMs, eventSpan, validateEvent, whenChanged, icsEscape, fold, eventIcsLines, buildIcs, isAgendaTournament, tournamentAgendaItem,
};
