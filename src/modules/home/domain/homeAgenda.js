/**
 * A AGENDA da tela inicial — todos os compromissos da pessoa numa linha do
 * tempo só (lógica pura).
 *
 * Antes, para saber "o que eu tenho essa semana", a pessoa abria cinco telas:
 * o torneio (próximo jogo), o dia de jogo, Minhas reservas, Minhas aulas e o
 * clube. Cada uma sabia a sua parte, e nenhuma respondia a pergunta. Aqui as
 * fontes viram o MESMO formato de item e se juntam por data.
 *
 * Três regras que valem para toda fonte:
 *
 *  1. **Só o que ainda vai acontecer** (ou está acontecendo). Compromisso
 *     vencido na tela inicial é o defeito que esta tela existe para não ter.
 *  2. **Cancelado, recusado e arquivado não entram.** Um "pedido recusado"
 *     não é compromisso.
 *  3. **O que depende de ALGUÉM AGIR vem marcado** (`acao`): o pedido de aula
 *     esperando a resposta do professor, o convite do clube sem resposta.
 *
 * Sem I/O: cada construtor recebe o que a tela já carregou. A tela junta as
 * listas com `mergeAgenda` — e é ela que diz quando uma fonte FALHOU, porque
 * agenda vazia só pode ser afirmada com todas as fontes carregadas.
 */
import { formatDateShortBR } from '../../arenas/domain/calendar.js';
import { bookingSlots, sortSlots } from '../../arenas/domain/booking.js';
import { BOOKING_STATUS } from '../../arenas/domain/constants.js';
import { CLASS_STATUS } from '../../arenas/domain/classes.js';
import { OPEN_SLOT_STATUS } from '../../arenas/domain/openMatch.js';
import { lessonFormatLabel } from '../../coaches/domain/lesson.js';
import { INVITE_STATUS } from '../../clubs/domain/constants.js';
import { diaLocal, diasAte, hojeLocal, instanteLocal } from './freshness.js';

/** Tipos de compromisso. */
export const AGENDA_KIND = Object.freeze({
  JOGO_TORNEIO: 'jogo_torneio',
  DIA_DE_JOGO: 'dia_de_jogo',
  RESERVA: 'reserva',
  AULA: 'aula',                     // eu sou o aluno
  AULA_PROFESSOR: 'aula_professor', // eu dou a aula
  AULA_ARENA: 'aula_arena',         // aula de arena em que estou matriculado
  JOGO_ABERTO: 'jogo_aberto',
  EVENTO_CLUBE: 'evento_clube',
});

/** Rótulo curto do tipo, para o selo do item. */
export const AGENDA_KIND_LABEL = Object.freeze({
  [AGENDA_KIND.JOGO_TORNEIO]: 'Torneio',
  [AGENDA_KIND.DIA_DE_JOGO]: 'Dia de jogo',
  [AGENDA_KIND.RESERVA]: 'Reserva',
  [AGENDA_KIND.AULA]: 'Aula',
  [AGENDA_KIND.AULA_PROFESSOR]: 'Você dá aula',
  [AGENDA_KIND.AULA_ARENA]: 'Aula',
  [AGENDA_KIND.JOGO_ABERTO]: 'Jogo aberto',
  [AGENDA_KIND.EVENTO_CLUBE]: 'Clube',
});

/** Quanto tempo um compromisso sem hora de fim "dura", para sair da tela. */
const DURACAO_PADRAO_MS = 2 * 60 * 60 * 1000;
/** Um dia de jogo sem fim informado pode durar a tarde toda. */
const DURACAO_DIA_DE_JOGO_MS = 6 * 60 * 60 * 1000;

const ATIVOS = new Set([BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED]);

function str(v) {
  return String(v ?? '').trim();
}

function horaOuNull(h) {
  const t = str(h);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
}

/**
 * Monta um item e decide se ele ainda vale.
 * @returns {object|null} o item, ou `null` quando já passou
 */
function item({ key, kind, dia, hora = null, fim = null, duracaoMs = DURACAO_PADRAO_MS, agora, ...resto }) {
  const d = diaLocal(dia);
  if (!d || !key) return null;
  const h = horaOuNull(hora);
  const hoje = hojeLocal(new Date(agora));
  if (d < hoje) return null;
  const inicioMs = h ? instanteLocal(d, h) : instanteLocal(d, '00:00');
  if (h && d === hoje) {
    const f = horaOuNull(fim);
    const fimMs = f ? instanteLocal(d, f) : inicioMs + duracaoMs;
    if (fimMs < agora) return null;
  }
  return { key, kind, dia: d, hora: h, inicioMs, acao: false, ...resto };
}

/* ------------------------------------------------------------------ */
/*  Construtores, um por fonte                                        */
/* ------------------------------------------------------------------ */

/**
 * Jogos de torneio (de `getMyUpcomingMatches`: `{ matchId, tournamentId,
 * tournamentName, scheduledAt(ms), court, opponent }`).
 */
export function agendaFromTournamentMatches(matches = [], { agora = Date.now() } = {}) {
  return (matches || []).map((m) => {
    const ms = Number(m?.scheduledAt);
    if (!Number.isFinite(ms) || ms + DURACAO_PADRAO_MS < agora) return null;
    const d = new Date(ms);
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return item({
      key: `torneio:${m.matchId}`,
      kind: AGENDA_KIND.JOGO_TORNEIO,
      dia: ms,
      hora,
      agora,
      title: m.opponent ? `vs ${m.opponent}` : 'Jogo de torneio',
      subtitle: [m.tournamentName, m.court].filter(Boolean).join(' · '),
      link: m.tournamentId ? `/torneios/${m.tournamentId}` : '/torneios',
    });
  }).filter(Boolean);
}

/** A hora de começo e de fim de um dia de jogo de ARENA (pelas quadras reservadas). */
function horarioDaArena(gd) {
  const slots = Array.isArray(gd?.arena_slots) ? gd.arena_slots : [];
  const inicios = slots.map((s) => horaOuNull(s?.start_time)).filter(Boolean).sort();
  const fins = slots.map((s) => horaOuNull(s?.end_time)).filter(Boolean).sort();
  return { inicio: inicios[0] || null, fim: fins[fins.length - 1] || null };
}

/** Dias de jogo em que estou (`useMyGameDays`). Arquivado não entra. */
export function agendaFromGameDays(gameDays = [], { agora = Date.now() } = {}) {
  return (gameDays || []).map((gd) => {
    if (!gd?.id || gd.status === 'archived' || gd.archived === true) return null;
    const arena = horarioDaArena(gd);
    const origem = gd.arena_name || gd.club_name || gd.location || '';
    return item({
      key: `dia:${gd.id}`,
      kind: AGENDA_KIND.DIA_DE_JOGO,
      dia: gd.date,
      hora: arena.inicio || gd.time,
      fim: arena.fim,
      duracaoMs: DURACAO_DIA_DE_JOGO_MS,
      agora,
      title: str(gd.title) || 'Dia de jogo',
      subtitle: origem,
      link: `/dia-de-jogo/${gd.id}`,
      gameDayId: gd.id,
    });
  }).filter(Boolean);
}

/** O próximo horário de uma reserva/aula que ainda não terminou. */
function proximoHorario(slots, agora) {
  const hoje = hojeLocal(new Date(agora));
  return sortSlots(slots || []).find((s) => {
    const d = diaLocal(s?.date);
    if (!d || d < hoje) return false;
    if (d > hoje) return true;
    const f = horaOuNull(s.end) || horaOuNull(s.start);
    return !f || instanteLocal(d, f) >= agora;
  }) || null;
}

/** Reservas de quadra (`useMyBookings`): só pedidas, em conversa ou confirmadas. */
export function agendaFromBookings(bookings = [], { agora = Date.now() } = {}) {
  return (bookings || []).map((b) => {
    if (!b?.id || !ATIVOS.has(b.status)) return null;
    const s = proximoHorario(bookingSlots(b), agora);
    if (!s) return null;
    const aguardando = b.status !== BOOKING_STATUS.CONFIRMED;
    return item({
      key: `reserva:${b.id}`,
      kind: AGENDA_KIND.RESERVA,
      dia: s.date,
      hora: s.start,
      fim: s.end,
      agora,
      title: str(b.arena_name) || 'Reserva de quadra',
      subtitle: [b.court_name, s.start && s.end ? `${s.start}–${s.end}` : null].filter(Boolean).join(' · '),
      status: aguardando ? 'Aguardando a arena' : 'Confirmada',
      link: '/minhas-reservas',
    });
  }).filter(Boolean);
}

/**
 * Aulas com professor (`coach_lessons`). `papel` diz de que lado a pessoa
 * está: o ALUNO espera a resposta; o PROFESSOR é quem precisa responder.
 */
export function agendaFromLessons(lessons = [], { papel = 'aluno', agora = Date.now() } = {}) {
  const professor = papel === 'professor';
  return (lessons || []).map((l) => {
    if (!l?.id || !ATIVOS.has(l.status)) return null;
    const s = proximoHorario(bookingSlots(l), agora);
    if (!s) return null;
    const pedido = l.status === BOOKING_STATUS.REQUESTED;
    return item({
      key: `aula:${l.id}`,
      kind: professor ? AGENDA_KIND.AULA_PROFESSOR : AGENDA_KIND.AULA,
      dia: s.date,
      hora: s.start,
      fim: s.end,
      agora,
      title: professor
        ? `Aula com ${str(l.student_name) || 'aluno'}`
        : `Aula ${lessonFormatLabel(l.format).toLowerCase()}`,
      subtitle: [l.location, s.start && s.end ? `${s.start}–${s.end}` : null].filter(Boolean).join(' · '),
      status: pedido ? (professor ? 'Pedido esperando você' : 'Aguardando o professor') : 'Confirmada',
      acao: professor && pedido,
      link: professor ? '/aulas' : '/minhas-aulas',
    });
  }).filter(Boolean);
}

/**
 * Aulas de arena em que estou matriculado (linhas de `enrollmentRows`:
 * `{ key, booking, aula, arenaName, cancelled }`).
 */
export function agendaFromArenaEnrollments(rows = [], { agora = Date.now() } = {}) {
  return (rows || []).map((r) => {
    const aula = r?.aula;
    if (!aula || r.cancelled || aula.status === CLASS_STATUS.CANCELLED) return null;
    if (aula.status === CLASS_STATUS.COMPLETED) return null;
    if (r.booking?.status === 'cancelled') return null;
    return item({
      key: `aula-arena:${r.key}`,
      kind: AGENDA_KIND.AULA_ARENA,
      dia: aula.date,
      hora: aula.start,
      fim: aula.end,
      agora,
      title: str(aula.title) || 'Aula na arena',
      subtitle: [r.arenaName, aula.coach_name].filter(Boolean).join(' · '),
      link: '/minhas-aulas',
    });
  }).filter(Boolean);
}

/**
 * Jogos abertos em que entrei (`useMyOpenSlots`). O jogo aberto que já é um
 * dia de jogo (Onda CA) aparece UMA vez só — pelo dia de jogo — e por isso
 * recebe a lista de dias de jogo já na agenda.
 */
export function agendaFromOpenSlots(slots = [], { agora = Date.now(), gameDayIds = new Set() } = {}) {
  return (slots || []).map((s) => {
    if (!s?.id) return null;
    if (s.status === OPEN_SLOT_STATUS.CANCELLED || s.status === OPEN_SLOT_STATUS.COMPLETED) return null;
    if (s.game_day_id && gameDayIds.has(s.game_day_id)) return null;
    return item({
      key: `aberto:${s.id}`,
      kind: AGENDA_KIND.JOGO_ABERTO,
      dia: s.date,
      hora: s.start,
      fim: s.end,
      agora,
      title: `Jogo aberto · ${str(s.arena_name) || 'arena'}`,
      subtitle: [s.court, s.start && s.end ? `${s.start}–${s.end}` : null].filter(Boolean).join(' · '),
      link: s.game_day_id ? `/dia-de-jogo/${s.game_day_id}` : `/arenas/${s.arena_id}`,
    });
  }).filter(Boolean);
}

/**
 * Eventos dos meus clubes (`listAvailableEvents`: `starts_at` como
 * 'AAAA-MM-DDTHH:mm' e `my_invite_status`). Entra quem vai e o convite ainda
 * sem resposta (que pede uma).
 */
export function agendaFromClubEvents(events = [], { agora = Date.now() } = {}) {
  return (events || []).map((e) => {
    const st = e?.my_invite_status;
    if (!e?.id || !(st === INVITE_STATUS.GOING || st === INVITE_STATUS.MAYBE || st === INVITE_STATUS.INVITED)) return null;
    const [dia, horaBruta] = str(e.starts_at).split('T');
    return item({
      key: `evento:${e.id}`,
      kind: AGENDA_KIND.EVENTO_CLUBE,
      dia,
      hora: str(horaBruta).slice(0, 5),
      duracaoMs: DURACAO_DIA_DE_JOGO_MS,
      agora,
      title: str(e.title) || 'Evento do clube',
      subtitle: [e.club_name, e.location].filter(Boolean).join(' · '),
      status: st === INVITE_STATUS.INVITED ? 'Convite sem resposta' : (st === INVITE_STATUS.MAYBE ? 'Talvez' : 'Você vai'),
      acao: st === INVITE_STATUS.INVITED,
      link: e.club_id ? `/clubes/${e.club_id}/eventos/${e.id}` : '/clubes',
    });
  }).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Junção e leitura                                                  */
/* ------------------------------------------------------------------ */

/**
 * Junta as listas numa agenda só: sem repetição, pela data, e o que pede ação
 * na frente dentro do mesmo dia.
 * @param {Array<Array<object>>} listas
 * @param {{ limite?: number }} [opts]
 */
export function mergeAgenda(listas = [], { limite = Infinity } = {}) {
  const porChave = new Map();
  (listas || []).flat().filter(Boolean).forEach((i) => {
    if (!porChave.has(i.key)) porChave.set(i.key, i);
  });
  return [...porChave.values()]
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0)
      || Number(b.acao) - Number(a.acao)
      || a.inicioMs - b.inicioMs
      || String(a.title).localeCompare(String(b.title)))
    .slice(0, limite);
}

/** "Hoje", "Amanhã" ou "Sáb, 27/09". */
export function agendaDayLabel(dia, hoje) {
  const n = diasAte(dia, hoje);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  return formatDateShortBR(dia, { hoje });
}

/** A agenda agrupada por dia, na ordem, para a tela. */
export function groupAgendaByDay(itens = [], hoje) {
  const grupos = [];
  (itens || []).forEach((i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === i.dia) ultimo.itens.push(i);
    else grupos.push({ dia: i.dia, label: agendaDayLabel(i.dia, hoje), itens: [i] });
  });
  return grupos;
}

/** Quantos compromissos caem HOJE (para a frase de abertura). */
export function countToday(itens = [], hoje) {
  return (itens || []).filter((i) => i.dia === hoje).length;
}
