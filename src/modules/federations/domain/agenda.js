/**
 * CALENDÁRIO OFICIAL da federação (módulo `calendar`) — lógica pura.
 *
 * Cada evento é um `federation_events` que SÓ o servidor grava
 * (`functions/federationAgenda.js`): agenda esportiva (competições,
 * seletivas, cursos), institucional (assembleias, reuniões da diretoria e do
 * conselho fiscal, prazos, expediente) e eventos (solenidades). O evento já
 * divulgado não some nem muda de data calado: adiar, remarcar e cancelar
 * pedem motivo e ficam no histórico, visível a quem lê. Os torneios
 * chancelados entram na agenda DERIVADOS (nada é gravado para eles).
 *
 * Horário: Brasília (UTC−3, sem horário de verão desde 2019).
 *
 * ⚠️ Os ids de tipo, grupo, situação e visibilidade são GRAVADOS: nunca
 * renomeie. A tabela de tipos, a validação e o arquivo de calendário (ICS)
 * têm cópia no servidor (`functions/federationAgendaPolicy.js`, paridade em
 * `federationAgenda.parity.test.js`).
 */
import { t, tk } from '@/core/i18n';
import { FED_PERMISSION } from './constants.js';

export const EVENT_TITLE_MAX = 160;
export const EVENT_DESCRIPTION_MAX = 4000;
export const EVENT_PLACE_MAX = 120;
export const EVENT_ADDRESS_MAX = 200;
export const EVENT_CITY_MAX = 80;
export const EVENT_ORGAN_MAX = 120;
export const EVENT_URL_MAX = 500;
export const EVENT_RELATED_MAX = 10;
export const EVENT_REASON_MIN = 10;
export const EVENT_SPAN_MAX_DAYS = 366;
export const EVENT_HISTORY_MAX = 20;
const BR_OFFSET_MS = 3 * 3600000;
const DAY_MS = 86400000;

export const EVENT_STATUS = Object.freeze({ SCHEDULED: 'scheduled', POSTPONED: 'postponed', CANCELLED: 'cancelled' });
export const EVENT_STATUS_LABELS = Object.freeze({ scheduled: tk('Confirmado'), postponed: tk('Adiado'), cancelled: tk('Cancelado') });

export const EVENT_VISIBILITY = Object.freeze({ PUBLIC: 'public', MEMBERS: 'members', STAFF: 'staff' });
export const EVENT_VISIBILITY_LABELS = Object.freeze({ public: tk('Público'), members: tk('Só filiados'), staff: tk('Só a equipe') });

export const EVENT_GROUPS = Object.freeze([
  { id: 'sport', label: tk('Agenda esportiva') },
  { id: 'institutional', label: tk('Agenda institucional') },
  { id: 'event', label: tk('Eventos') },
]);

/** `meeting`: reunião de órgão (assembleia, diretoria, conselho) — ganha pauta, quórum e ata. */
export const EVENT_KINDS = Object.freeze([
  { id: 'competition', group: 'sport', meeting: false, label: tk('Competição ou etapa') },
  { id: 'selection', group: 'sport', meeting: false, label: tk('Seletiva ou seleção') },
  { id: 'course', group: 'sport', meeting: false, label: tk('Curso ou clínica') },
  { id: 'sport_other', group: 'sport', meeting: false, label: tk('Outro evento esportivo') },
  { id: 'assembly_ordinary', group: 'institutional', meeting: true, label: tk('Assembleia geral ordinária') },
  { id: 'assembly_extraordinary', group: 'institutional', meeting: true, label: tk('Assembleia geral extraordinária') },
  { id: 'assembly_special', group: 'institutional', meeting: true, label: tk('Assembleia especial ou eleitoral') },
  { id: 'board', group: 'institutional', meeting: true, label: tk('Reunião da diretoria') },
  { id: 'fiscal_council', group: 'institutional', meeting: true, label: tk('Reunião do conselho fiscal') },
  { id: 'committee', group: 'institutional', meeting: true, label: tk('Reunião de comissão ou setor') },
  { id: 'deadline', group: 'institutional', meeting: false, label: tk('Prazo oficial') },
  { id: 'office', group: 'institutional', meeting: false, label: tk('Expediente ou recesso') },
  { id: 'ceremony', group: 'event', meeting: false, label: tk('Solenidade ou premiação') },
  { id: 'event', group: 'event', meeting: false, label: tk('Evento') },
]);
/** O torneio chancelado é um item DERIVADO da agenda (não é tipo gravável). */
export const TOURNAMENT_KIND = Object.freeze({ id: 'tournament', group: 'sport', meeting: false, label: tk('Torneio chancelado') });

const KIND_BY_ID = Object.fromEntries([...EVENT_KINDS, TOURNAMENT_KIND].map((k) => [k.id, k]));
export const eventKind = (id) => KIND_BY_ID[id] || null;
export const eventGroup = (id) => EVENT_GROUPS.find((g) => g.id === id) || null;

/** O que fica no histórico do evento. */
export const EVENT_CHANGE_LABELS = Object.freeze({
  rescheduled: tk('Remarcado'), postponed: tk('Adiado'), cancelled: tk('Cancelado'), reopened: tk('Reaberto'),
  agenda_changed: tk('Convocação alterada'), record_corrected: tk('Resultado corrigido'),
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DOC_ID = /^[A-Za-z0-9]{1,80}$/;
const UF = /^[A-Z]{2}$/;

const limpa = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const limpaTexto = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

export function isoValida(s) {
  if (!ISO.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "2026-11-05" + "19:30" no horário de Brasília → milissegundos (UTC). */
export function brMs(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) + BR_OFFSET_MS;
}

/** Início e fim em milissegundos. Sem hora de fim, uma hora (ou até o fim do último dia). */
export function eventSpan({ date, end_date: endDate, all_day: allDay, start_time: startTime, end_time: endTime }) {
  const fim = endDate || date;
  if (allDay) return { starts_at_ms: brMs(date), ends_at_ms: brMs(fim) + DAY_MS };
  const starts = brMs(date, startTime);
  if (endTime) return { starts_at_ms: starts, ends_at_ms: brMs(fim, endTime) };
  return { starts_at_ms: starts, ends_at_ms: fim === date ? starts + 3600000 : brMs(fim, '23:59') };
}

/** A mesma régua do servidor. Devolve `{ ok, errors, value }`. */
export function validateEventInput(input = {}) {
  const errors = {};
  const kind = EVENT_KINDS.some((k) => k.id === input.kind) ? input.kind : '';
  if (!kind) errors.kind = t('Escolha o tipo do evento.');
  const title = limpa(input.title, EVENT_TITLE_MAX);
  if (title.length < 3) errors.title = t('Dê um título ao evento.');
  const description = limpaTexto(input.description, EVENT_DESCRIPTION_MAX);
  const date = String(input.date || '');
  if (!isoValida(date)) errors.date = t('Informe a data.');
  const endDate = input.end_date ? String(input.end_date) : date;
  if (input.end_date && !isoValida(endDate)) errors.end_date = t('Data de término inválida.');
  else if (isoValida(date) && isoValida(endDate)) {
    if (endDate < date) errors.end_date = t('O término não pode ser antes do início.');
    else if ((brMs(endDate) - brMs(date)) / DAY_MS > EVENT_SPAN_MAX_DAYS) errors.end_date = t('Um evento dura no máximo um ano.');
  }
  const allDay = input.all_day === true;
  const startTime = allDay ? '' : String(input.start_time || '');
  const endTime = allDay ? '' : String(input.end_time || '');
  if (!allDay && !HHMM.test(startTime)) errors.start_time = t('Informe o horário de início.');
  if (!allDay && endTime && !HHMM.test(endTime)) errors.end_time = t('Horário de término inválido.');
  if (!allDay && HHMM.test(startTime) && HHMM.test(endTime) && endDate === date && endTime <= startTime) errors.end_time = t('O término precisa ser depois do início.');
  const p = input.place && typeof input.place === 'object' ? input.place : {};
  const state = limpa(p.state, 2).toUpperCase();
  const place = { name: limpa(p.name, EVENT_PLACE_MAX), address: limpa(p.address, EVENT_ADDRESS_MAX), city: limpa(p.city, EVENT_CITY_MAX), state: /^[A-Z]{2}$/.test(state) ? state : '' };
  const onlineUrl = limpa(input.online_url, EVENT_URL_MAX);
  if (onlineUrl && !/^https:\/\/[^\s]+\.[^\s]+/.test(onlineUrl)) errors.online_url = t('Use um link que comece com https://.');
  const organ = limpa(input.organ, EVENT_ORGAN_MAX);
  const visibility = Object.values(EVENT_VISIBILITY).includes(input.visibility) ? input.visibility : 'public';
  const ids = [...new Set((Array.isArray(input.related_docs) ? input.related_docs : []).map((r) => String((r && r.doc_id) || r || '')).filter((x) => DOC_ID.test(x)))];
  if (ids.length > EVENT_RELATED_MAX) errors.related_docs = t('No máximo {n} documentos ligados.', { n: EVENT_RELATED_MAX });
  const value = {
    kind, group: kind ? KIND_BY_ID[kind].group : '', title, description, date, end_date: endDate, all_day: allDay, start_time: startTime, end_time: endTime,
    place, online_url: onlineUrl, organ, visibility, related_docs: ids.slice(0, EVENT_RELATED_MAX).map((doc_id) => ({ doc_id })),
  };
  if (!errors.date && !errors.end_date && !errors.start_time && !errors.end_time) Object.assign(value, eventSpan(value));
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** A data ou o horário mudaram? */
export const whenChanged = (a = {}, b = {}) => ['date', 'end_date', 'all_day', 'start_time', 'end_time'].some((k) => (a[k] ?? '') !== (b[k] ?? ''));

/** Salvar ESTE formulário sobre o evento gravado pede motivo? (Já divulgado e mudou a data, ou estava adiado/cancelado.) */
export const saveNeedsReason = (prev, next) => Boolean(prev?.ever_visible) && (whenChanged(prev, next) || (prev.status || EVENT_STATUS.SCHEDULED) !== EVENT_STATUS.SCHEDULED);

/* ------------------------------------------------------------- ICS -- */

export const icsEscape = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([;,])/g, '\\$1');
const utcStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateStamp = (iso) => iso.replace(/-/g, '');
const somaDia = (iso, n) => new Date(brMs(iso) - BR_OFFSET_MS + n * DAY_MS).toISOString().slice(0, 10);

/** Dobra a linha em 75 octetos (RFC 5545 §3.1), sem partir um caractere. */
export function fold(line) {
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

export const placeText = (p = {}) => [p.name, p.address, [p.city, p.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');

export function eventIcsLines(ev, { url = '', host = 'picklerush.web.app', stampMs = 0 } = {}) {
  const linhas = ['BEGIN:VEVENT', `UID:${ev.id}@${host}`, `DTSTAMP:${utcStamp(stampMs || Number(ev.updated_at_ms) || Number(ev.created_at_ms) || 0)}`];
  if (ev.all_day) {
    linhas.push(`DTSTART;VALUE=DATE:${dateStamp(ev.date)}`, `DTEND;VALUE=DATE:${dateStamp(somaDia(ev.end_date || ev.date, 1))}`);
  } else {
    linhas.push(`DTSTART:${utcStamp(ev.starts_at_ms)}`, `DTEND:${utcStamp(ev.ends_at_ms)}`);
  }
  const status = ev.status === EVENT_STATUS.CANCELLED ? 'CANCELLED' : ev.status === EVENT_STATUS.POSTPONED ? 'TENTATIVE' : 'CONFIRMED';
  const prefixo = ev.status === EVENT_STATUS.CANCELLED ? 'CANCELADO: ' : ev.status === EVENT_STATUS.POSTPONED ? 'ADIADO: ' : '';
  linhas.push(`SUMMARY:${icsEscape(prefixo + ev.title)}`);
  const desc = [ev.description, ev.online_url, url].filter(Boolean).join('\n\n');
  if (desc) linhas.push(`DESCRIPTION:${icsEscape(desc)}`);
  const loc = placeText(ev.place) || (ev.online_url ? 'Online' : '');
  if (loc) linhas.push(`LOCATION:${icsEscape(loc)}`);
  if (url) linhas.push(`URL:${url}`);
  linhas.push(`STATUS:${status}`, `SEQUENCE:${(Array.isArray(ev.history) ? ev.history.length : 0)}`, 'END:VEVENT');
  return linhas;
}

export function buildIcs(events = [], { name = 'Agenda', host = 'picklerush.web.app', urlOf = () => '', stampMs = 0 } = {}) {
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PickleRush//Agenda oficial//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(name)}`, 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ];
  (events || []).filter((ev) => ev && ev.id && ev.date).forEach((ev) => linhas.push(...eventIcsLines(ev, { url: urlOf(ev), host, stampMs })));
  linhas.push('END:VCALENDAR');
  return linhas.map(fold).join('\r\n') + '\r\n';
}

/** O torneio entra na agenda? Chancela aprovada, público, não arquivado, nem rascunho nem cancelado. */
export const isAgendaTournament = (tt) => Boolean(tt) && tt.federation_sanction && tt.federation_sanction.status === 'approved'
  && tt.visibility === 'public' && tt.archived !== true && !['draft', 'cancelled'].includes(tt.status);

/** Torneio chancelado como item de agenda (derivado, nada gravado). */
export function tournamentAgendaItem(tt) {
  if (!isAgendaTournament(tt)) return null;
  const date = String(tt.starts_at || '').slice(0, 10);
  if (!isoValida(date)) return null;
  const fim = String(tt.ends_at || '').slice(0, 10);
  const endDate = isoValida(fim) && fim >= date ? fim : date;
  return {
    id: `torneio_${tt.id}`, tournament_id: tt.id, kind: 'tournament', group: 'sport', derived: true,
    title: String(tt.name || 'Torneio'), description: '', date, end_date: endDate, all_day: true, start_time: '', end_time: '',
    place: { name: String(tt.venue || ''), address: '', city: String(tt.city || ''), state: UF.test(String(tt.state || '').toUpperCase()) ? String(tt.state).toUpperCase() : '' }, online_url: '', status: EVENT_STATUS.SCHEDULED,
    starts_at_ms: brMs(date), ends_at_ms: brMs(endDate) + DAY_MS, history: [],
  };
}

/* -------------------------------------------------------- para a tela -- */

/** Junta listas (cada visibilidade é uma consulta) sem repetir. */
export function mergeEventLists(...listas) {
  const porId = new Map();
  listas.flat().filter(Boolean).forEach((e) => porId.set(e.id, e));
  return [...porId.values()];
}

/**
 * A situação do evento AGORA: `cancelled`, `postponed` (sem nova data),
 * `ongoing`, `upcoming` ou `past`. Remarcado volta a `upcoming` com o
 * histórico dizendo de onde veio.
 */
export function eventState(ev, nowMs = Date.now()) {
  if (ev?.status === EVENT_STATUS.CANCELLED) return 'cancelled';
  if (ev?.status === EVENT_STATUS.POSTPONED) return 'postponed';
  const ini = Number(ev?.starts_at_ms) || 0;
  const fim = Number(ev?.ends_at_ms) || ini;
  if (fim <= nowMs) return 'past';
  if (ini <= nowMs) return 'ongoing';
  return 'upcoming';
}

/** A última mudança registrada (para a faixa "Remarcado de … — motivo"). */
export const lastChange = (ev) => (Array.isArray(ev?.history) && ev.history.length ? ev.history[ev.history.length - 1] : null);

/**
 * Próximos (do mais cedo ao mais tarde: em andamento, futuros, adiados sem
 * data no fim) e anteriores (do mais recente ao mais antigo). O cancelado
 * fica onde a data o põe — some quem ia, não a informação.
 */
export function splitAgenda(items = [], nowMs = Date.now()) {
  const upcoming = [];
  const past = [];
  (items || []).forEach((ev) => {
    const st = eventState(ev, nowMs);
    if (st === 'postponed') upcoming.push(ev);
    else if ((Number(ev.ends_at_ms) || 0) > nowMs) upcoming.push(ev);
    else past.push(ev);
  });
  const adiado = (e) => (e.status === EVENT_STATUS.POSTPONED ? 1 : 0);
  upcoming.sort((a, b) => adiado(a) - adiado(b) || (Number(a.starts_at_ms) || 0) - (Number(b.starts_at_ms) || 0));
  past.sort((a, b) => (Number(b.starts_at_ms) || 0) - (Number(a.starts_at_ms) || 0));
  return { upcoming, past };
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Busca (título, descrição, local, órgão) e grupo. */
export function filterAgenda(items = [], { q = '', group = '' } = {}) {
  const termo = semAcento(q).trim();
  return (items || []).filter((ev) => {
    if (group && ev.group !== group) return false;
    if (!termo) return true;
    return semAcento([ev.title, ev.description, placeText(ev.place), ev.organ].join(' ')).includes(termo);
  });
}

/** Agrupa por mês (`2026-11`) na ordem em que os itens vieram. Adiado sem data vai para o grupo `''`. */
export function groupByMonth(items = []) {
  const grupos = [];
  const porChave = new Map();
  (items || []).forEach((ev) => {
    const chave = ev.status === EVENT_STATUS.POSTPONED ? '' : String(ev.date || '').slice(0, 7);
    if (!porChave.has(chave)) { const g = { key: chave, items: [] }; porChave.set(chave, g); grupos.push(g); }
    porChave.get(chave).items.push(ev);
  });
  return grupos;
}

const slugDe = (federation) => encodeURIComponent(federation?.slug || federation?.id || '');
export const agendaPublicPath = (federation) => `/f/${slugDe(federation)}/agenda`;
/** Torneio: a página pública (`/p/:id`, abre sem conta); dentro do app (`inApp`), a do app. */
export const tournamentPath = (id, { inApp = false } = {}) => `${inApp ? '/torneios' : '/p'}/${encodeURIComponent(id || '')}`;
/** Página do item: o evento, ou o próprio torneio quando é chancelado. */
export const eventPublicPath = (federation, ev, { inApp = false } = {}) => (ev?.derived && ev.tournament_id ? tournamentPath(ev.tournament_id, { inApp }) : `${agendaPublicPath(federation)}/${encodeURIComponent(ev?.id || '')}`);
/** A agenda assinável (só o que é público), servida pela função `federationAgendaFeed`. */
export const agendaFeedPath = (federation) => `/api/agenda/${slugDe(federation)}.ics`;

const gcalStamp = (ev) => (ev.all_day
  ? `${dateStamp(ev.date)}/${dateStamp(somaDia(ev.end_date || ev.date, 1))}`
  : `${utcStamp(ev.starts_at_ms)}/${utcStamp(ev.ends_at_ms)}`);

/** "Adicionar ao Google Agenda" de um evento. */
export function googleCalendarUrl(ev, { url = '' } = {}) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates: gcalStamp(ev), details: [ev.description, ev.online_url, url].filter(Boolean).join('\n\n'), location: placeText(ev.place) || ev.online_url || '' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Endereço no mapa (busca pelo texto do local). */
export const mapUrl = (place) => { const q = placeText(place); return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : ''; };

/** Quem cuida do evento: `admin`/`docs` qualquer um; `competitions` só a agenda esportiva. */
export function canManageKind(perms = [], kindOrGroup) {
  if (perms.includes(FED_PERMISSION.ADMIN) || perms.includes(FED_PERMISSION.DOCS)) return true;
  const group = KIND_BY_ID[kindOrGroup]?.group || kindOrGroup;
  return perms.includes(FED_PERMISSION.COMPETITIONS) && group === 'sport';
}
export const canUseAgenda = (perms = []) => [FED_PERMISSION.ADMIN, FED_PERMISSION.DOCS, FED_PERMISSION.COMPETITIONS].some((p) => perms.includes(p));
/** Os tipos que ESTA pessoa pode marcar. */
export const kindsFor = (perms = []) => EVENT_KINDS.filter((k) => canManageKind(perms, k.id));

/** O que dá para fazer com o evento. */
export function eventActions(ev, perms = [], nowMs = Date.now()) {
  if (!ev || ev.derived || !canManageKind(perms, ev.kind)) return { edit: false, postpone: false, cancel: false, remove: false };
  const st = eventState(ev, nowMs);
  return {
    edit: true,
    postpone: st === 'upcoming' || st === 'ongoing',
    cancel: st !== 'cancelled' && st !== 'past',
    remove: !ev.ever_visible,
  };
}
