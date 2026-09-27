/**
 * O que é ATUAL — a régua única da tela inicial (lógica pura).
 *
 * A tela inicial é a vitrine mais vista da plataforma, e o pior que ela pode
 * fazer é mostrar o que já passou: um torneio encerrado "em destaque", um dia
 * de jogo de ontem como "próximo", uma inscrição "aberta" com o prazo vencido.
 * Quem toca num item desses cai numa página que não serve para mais nada — e
 * aprende que a tela inicial não merece confiança.
 *
 * Cada fonte tem a sua data e o seu status, gravados de jeitos diferentes
 * (texto 'YYYY-MM-DD', `Timestamp` do Firestore, milissegundos). Esta régua os
 * traduz para UMA pergunta — **isto ainda está valendo?** — e é a única que a
 * tela inicial usa. Sem I/O: `hoje`/`agora` entram por parâmetro, para o teste
 * não depender do relógio.
 *
 * ⚠️ Data sem hora ('2026-09-26') é um DIA LOCAL. `Date.parse` a lê como
 * meia-noite em UTC, que no Brasil é 21h do dia ANTERIOR — um torneio que
 * termina hoje sumiria às 21h de ontem. Por isso texto de data nunca passa por
 * `Date.parse` aqui.
 */
import { formatDateISO } from '../../arenas/domain/calendar.js';
import { instanteEmMs } from '../../../core/domain/instant.js';
import { TOURNAMENT_STATUS } from '../../tournament/domain/constants.js';

/** Hoje, como dia local 'YYYY-MM-DD'. */
export function hojeLocal(agora = new Date()) {
  return formatDateISO(agora instanceof Date ? agora : new Date(agora));
}

/**
 * Qualquer data vinda do banco → dia local 'YYYY-MM-DD' (ou `null`).
 *
 * Texto que já começa por 'YYYY-MM-DD' é tomado como está (é um dia, não um
 * instante). O resto (Timestamp, Date, ms, ISO com hora) vira instante e é
 * lido no fuso de quem está olhando.
 */
export function diaLocal(valor) {
  if (valor == null || valor === '') return null;
  if (typeof valor === 'string') {
    const m = valor.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/);
    if (m && valor.trim().length === 10) return m[1];
  }
  const ms = instanteEmMs(valor);
  if (!Number.isFinite(ms)) return null;
  return formatDateISO(new Date(ms));
}

/** Um horário 'HH:MM' válido? */
function horaValida(h) {
  return typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
}

/**
 * Dia + hora locais → ms. Sem hora, vale o FIM do dia (23:59): um compromisso
 * de hoje sem horário continua valendo até o dia acabar.
 */
export function instanteLocal(dia, hora) {
  const m = String(dia || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  const [hh, mm] = horaValida(hora) ? hora.split(':').map(Number) : [23, 59];
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm, 0, 0).getTime();
}

/* ------------------------------------------------------------------ *
 * TORNEIOS
 * ------------------------------------------------------------------ */

/** Fases de um torneio do ponto de vista de quem abre a tela inicial. */
export const TOURNAMENT_PHASE = Object.freeze({
  DRAFT: 'draft',         // rascunho — só interessa a quem organiza
  OPEN: 'open',           // inscrição aberta DE VERDADE (status + prazo)
  UPCOMING: 'upcoming',   // inscrições fechadas, ainda não começou
  LIVE: 'live',           // acontecendo agora
  STALE: 'stale',         // "em andamento" com a data de fim já vencida
  OVER: 'over',           // encerrado, cancelado ou arquivado
});

/**
 * Em que fase o torneio está HOJE.
 *
 * O status gravado não basta: "inscrições abertas" com o prazo vencido não
 * aceita mais ninguém, e "em andamento" com a data de fim no passado é um
 * torneio que o organizador esqueceu de encerrar — mostrar qualquer um dos
 * dois como atual é oferecer uma porta que não abre.
 *
 * @param {object} t documento do torneio
 * @param {string} hoje 'YYYY-MM-DD'
 * @returns {string} um valor de `TOURNAMENT_PHASE`
 */
export function tournamentPhase(t, hoje) {
  if (!t) return TOURNAMENT_PHASE.OVER;
  if (t.archived === true) return TOURNAMENT_PHASE.OVER;
  const status = t.status;
  if (status === TOURNAMENT_STATUS.FINISHED || status === TOURNAMENT_STATUS.CANCELLED) {
    return TOURNAMENT_PHASE.OVER;
  }
  if (status === TOURNAMENT_STATUS.DRAFT) return TOURNAMENT_PHASE.DRAFT;

  const inicio = diaLocal(t.starts_at);
  const fim = diaLocal(t.ends_at) || inicio;
  const prazo = diaLocal(t.registration_deadline);
  const terminou = fim && fim < hoje;

  if (status === TOURNAMENT_STATUS.IN_PROGRESS) {
    return terminou ? TOURNAMENT_PHASE.STALE : TOURNAMENT_PHASE.LIVE;
  }
  if (terminou) return TOURNAMENT_PHASE.STALE;

  const comecou = inicio && inicio <= hoje;
  if (status === TOURNAMENT_STATUS.REGISTRATIONS_OPEN) {
    const prazoVencido = prazo && prazo < hoje;
    if (!prazoVencido) return TOURNAMENT_PHASE.OPEN;
    return comecou ? TOURNAMENT_PHASE.LIVE : TOURNAMENT_PHASE.UPCOMING;
  }
  if (status === TOURNAMENT_STATUS.REGISTRATIONS_CLOSED) {
    return comecou ? TOURNAMENT_PHASE.LIVE : TOURNAMENT_PHASE.UPCOMING;
  }
  // Status desconhecido: não afirma nada de atual.
  return TOURNAMENT_PHASE.OVER;
}

/** Aceita inscrição hoje? */
export function isTournamentOpen(t, hoje) {
  return tournamentPhase(t, hoje) === TOURNAMENT_PHASE.OPEN;
}

/** Vale mostrar como atual (aberto, por começar ou acontecendo)? */
export function isTournamentCurrent(t, hoje) {
  const fase = tournamentPhase(t, hoje);
  return fase === TOURNAMENT_PHASE.OPEN
    || fase === TOURNAMENT_PHASE.UPCOMING
    || fase === TOURNAMENT_PHASE.LIVE;
}

/** Rótulo curto da fase, para o selo do cartão. */
export const TOURNAMENT_PHASE_LABEL = Object.freeze({
  [TOURNAMENT_PHASE.DRAFT]: 'Rascunho',
  [TOURNAMENT_PHASE.OPEN]: 'Inscrições abertas',
  [TOURNAMENT_PHASE.UPCOMING]: 'Em breve',
  [TOURNAMENT_PHASE.LIVE]: 'Acontecendo',
  [TOURNAMENT_PHASE.STALE]: 'Aguardando encerramento',
  [TOURNAMENT_PHASE.OVER]: 'Encerrado',
});

/** Quantos dias faltam até `dia` (0 = hoje; negativo = passou; null = sem data). */
export function diasAte(dia, hoje) {
  const a = String(hoje || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const b = String(dia || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!a || !b) return null;
  const da = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const db = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((db - da) / 86_400_000);
}

/**
 * "Hoje", "Amanhã", "Em 3 dias", "Encerra hoje"… — o tempo como gente fala.
 * Para mais de uma semana devolve `null` (a data por extenso diz melhor).
 */
export function prazoRelativo(dia, hoje) {
  const n = diasAte(dia, hoje);
  if (n == null || n < 0) return null;
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n <= 7) return `em ${n} dias`;
  return null;
}
