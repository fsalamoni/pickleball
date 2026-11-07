/**
 * RASCUNHO, PUBLICAÇÃO E PRAZOS DAS INSCRIÇÕES (2026-11-07).
 *
 * O torneio nasce em RASCUNHO (`draft`): só quem o criou, os administradores
 * dele e o admin da plataforma o veem — a regra do banco confere. "Publicar"
 * o torna visível; as inscrições abrem e encerram sozinhas na data e hora
 * marcadas (`registration_opens_ms` / `registration_closes_ms`, instantes em
 * milissegundos) e o pagamento fica à vista até `payment_deadline_ms`, que
 * nunca vem antes do encerramento.
 *
 * Quem vira o status é o servidor (`functions/tournamentSchedule.js`, a cada
 * 5 min — a cópia desta conta tem teste de paridade). Entre uma passada e
 * outra a tela e a regra do banco já seguem o RELÓGIO: `published` com a
 * abertura vencida vale como aberto, e aberto com o encerramento vencido vale
 * como encerrado. Torneio antigo, sem as datas, segue como sempre.
 */
import { tk } from '@/core/i18n';
import { TOURNAMENT_STATUS } from './constants.js';

/** Situação das inscrições agora. */
export const REG_WINDOW = Object.freeze({
  DRAFT: 'draft', // rascunho: ninguém de fora vê
  SOON: 'soon', // publicado, as inscrições ainda não abriram
  OPEN: 'open',
  CLOSED: 'closed',
  OVER: 'over', // começou, terminou ou foi cancelado
});

const ANTES_DO_JOGO = [
  TOURNAMENT_STATUS.PUBLISHED,
  TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
  TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
];

/** Instante gravado (ms) ou `null` — nunca um palpite. */
export function instante(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * O status que vale AGORA. Igual ao gravado, exceto entre uma passada do
 * servidor e outra: publicado com a abertura vencida já está aberto; aberto
 * ou publicado com o encerramento vencido já está encerrado.
 */
export function effectiveTournamentStatus(t, agora = Date.now()) {
  const status = t?.status;
  if (status !== TOURNAMENT_STATUS.PUBLISHED && status !== TOURNAMENT_STATUS.REGISTRATIONS_OPEN) return status;
  const abre = instante(t.registration_opens_ms);
  const fecha = instante(t.registration_closes_ms);
  if (fecha != null && agora >= fecha) return TOURNAMENT_STATUS.REGISTRATIONS_CLOSED;
  if (status === TOURNAMENT_STATUS.PUBLISHED && abre != null && agora >= abre) return TOURNAMENT_STATUS.REGISTRATIONS_OPEN;
  return status;
}

/**
 * A situação das inscrições — a MESMA conta da regra do banco (`tRegOpen`):
 * aberto é status aberto (ou publicado com a abertura vencida), sem o
 * encerramento vencido, e não arquivado.
 */
export function registrationWindow(t, agora = Date.now()) {
  if (!t) return REG_WINDOW.OVER;
  if (t.status === TOURNAMENT_STATUS.DRAFT) return REG_WINDOW.DRAFT;
  if (t.archived === true) return REG_WINDOW.OVER;
  const status = effectiveTournamentStatus(t, agora);
  if (status === TOURNAMENT_STATUS.REGISTRATIONS_OPEN) return REG_WINDOW.OPEN;
  if (status === TOURNAMENT_STATUS.PUBLISHED) return REG_WINDOW.SOON;
  if (status === TOURNAMENT_STATUS.REGISTRATIONS_CLOSED) return REG_WINDOW.CLOSED;
  return REG_WINDOW.OVER;
}

export function isRegistrationOpen(t, agora = Date.now()) {
  return registrationWindow(t, agora) === REG_WINDOW.OPEN;
}

/**
 * Por que a pessoa não pode se inscrever sozinha agora (`null` = pode). A
 * equipe do torneio inscreve sempre — quem chama decide isso antes.
 */
export function registrationBlockReason(t, agora = Date.now()) {
  const janela = registrationWindow(t, agora);
  if (janela === REG_WINDOW.OPEN) return null;
  if (janela === REG_WINDOW.DRAFT) return tk('O torneio ainda não foi publicado.');
  if (janela === REG_WINDOW.SOON) return tk('As inscrições ainda não abriram.');
  return tk('As inscrições estão encerradas.');
}

/**
 * O pagamento fica à vista do período das inscrições até o prazo de
 * pagamento. Sem prazo gravado (torneio antigo), como sempre foi: até o
 * torneio ser cancelado.
 */
export function isPaymentOpen(t, agora = Date.now()) {
  const janela = registrationWindow(t, agora);
  if (janela === REG_WINDOW.DRAFT || janela === REG_WINDOW.SOON) return false;
  if (t.archived === true || t.status === TOURNAMENT_STATUS.CANCELLED) return false;
  const prazo = instante(t.payment_deadline_ms);
  return prazo == null || agora < prazo;
}

/**
 * O status que as datas pedem, para gravar junto quando a organização muda as
 * datas, publica, abre ou encerra. Só mexe antes do jogo (publicado, aberto,
 * encerrado); rascunho, andamento e fim seguem como estão. Encerrado à mão sem
 * data (torneio antigo) continua encerrado.
 */
export function statusFromSchedule(t, agora = Date.now()) {
  const status = t?.status;
  if (!ANTES_DO_JOGO.includes(status)) return status;
  const abre = instante(t.registration_opens_ms);
  const fecha = instante(t.registration_closes_ms);
  if (fecha != null && agora >= fecha) return TOURNAMENT_STATUS.REGISTRATIONS_CLOSED;
  if (abre != null && agora < abre) return TOURNAMENT_STATUS.PUBLISHED;
  if (status === TOURNAMENT_STATUS.REGISTRATIONS_CLOSED && fecha == null) return status;
  return TOURNAMENT_STATUS.REGISTRATIONS_OPEN;
}

/**
 * O que o servidor faz na passada: `'open'`, `'close'` ou `null`. Só vira o
 * que as datas mandam e o status ainda não disse — nunca reabre o que a
 * organização encerrou.
 */
export function dueScheduleChange(t, agora = Date.now()) {
  if (!t || t.archived === true) return null;
  const abre = instante(t.registration_opens_ms);
  const fecha = instante(t.registration_closes_ms);
  const fechou = fecha != null && agora >= fecha;
  if ((t.status === TOURNAMENT_STATUS.PUBLISHED || t.status === TOURNAMENT_STATUS.REGISTRATIONS_OPEN) && fechou) return 'close';
  if (t.status === TOURNAMENT_STATUS.PUBLISHED && abre != null && agora >= abre) return 'open';
  return null;
}

/**
 * Abrir ou encerrar À MÃO acerta a data junto — a data e o status nunca se
 * desmentem, e a tarefa do servidor não desfaz o que a organização fez.
 * Devolve o que gravar, ou `{ erro }` (texto para `t()`).
 */
export function statusPatchForManualChange(t, status, agora = Date.now()) {
  const abre = instante(t?.registration_opens_ms);
  const fecha = instante(t?.registration_closes_ms);
  if (status === TOURNAMENT_STATUS.REGISTRATIONS_OPEN) {
    if (fecha != null && fecha <= agora) {
      return { erro: tk('O encerramento das inscrições já passou. Marque um novo encerramento (ou apague o atual) antes de reabrir.') };
    }
    return { status, ...(abre == null || abre > agora ? { registration_opens_ms: agora } : {}) };
  }
  if (status === TOURNAMENT_STATUS.REGISTRATIONS_CLOSED && (fecha == null || fecha > agora)) {
    return { status, registration_closes_ms: agora, registration_deadline: msToLocalDate(agora) };
  }
  return { status };
}

/** O que acontece ao publicar agora: `{ status, opensNow }`. */
export function publishOutcome(t, agora = Date.now()) {
  const status = statusFromSchedule({ ...t, status: TOURNAMENT_STATUS.PUBLISHED }, agora);
  return { status, opensNow: status === TOURNAMENT_STATUS.REGISTRATIONS_OPEN && instante(t?.registration_opens_ms) == null };
}

/**
 * Confere as três datas. Devolve a lista de problemas (texto para `t()`):
 * encerramento depois da abertura; prazo de pagamento igual ou depois do
 * encerramento — e, por isso, só com o encerramento marcado.
 */
export function scheduleProblems({ opens, closes, payment } = {}) {
  const abre = instante(opens);
  const fecha = instante(closes);
  const paga = instante(payment);
  const problemas = [];
  if (abre != null && fecha != null && fecha <= abre) {
    problemas.push(tk('O encerramento das inscrições precisa ser depois da abertura.'));
  }
  if (paga != null && fecha == null) {
    problemas.push(tk('Para marcar o prazo de pagamento, marque antes o encerramento das inscrições.'));
  }
  if (paga != null && fecha != null && paga < fecha) {
    problemas.push(tk('O prazo para pagamento precisa ser igual ou depois do encerramento das inscrições.'));
  }
  return problemas;
}

/* ----------------------------------------------- campo datetime-local --- */

const doisDigitos = (n) => String(n).padStart(2, '0');

/** Instante → valor de `<input type="datetime-local">` (hora do aparelho). */
export function msToLocalInput(ms) {
  const v = instante(ms);
  if (v == null) return '';
  const d = new Date(v);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

/** Valor de `<input type="datetime-local">` → instante, ou `null` se vazio/inválido. */
export function localInputToMs(valor) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(valor))) return null;
  const ms = new Date(String(valor)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Dia local (AAAA-MM-DD) de um instante — o `registration_deadline` antigo. */
export function msToLocalDate(ms) {
  const v = msToLocalInput(ms);
  return v ? v.slice(0, 10) : null;
}
