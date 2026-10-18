/**
 * DISCIPLINA E OUVIDORIA (módulo `discipline`): a sanção
 * (`federation_sanctions`, só o servidor grava) e o seu EFEITO — suspensão
 * em vigor bloqueia a inscrição em torneio chancelado NA REGRA (pelo
 * `discipline_until_ms` gravado na filiação) e marca a carteirinha como
 * "Suspensa"; exclusão cancela a filiação; multa vira cobrança. Só a pessoa
 * e a federação veem (D11). A ouvidoria (`federation_reports`) aceita
 * manifestação anônima, com protocolo. Lógica pura.
 */
import { t } from '@/core/i18n';
import { DISCIPLINE_KIND, DISCIPLINE_STATUS, REPORT_KIND, REPORT_MAX_CHARS } from './constants.js';
import { isoDate } from './membership.js';

const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Fim do dia `iso` em Brasília, em ms — o que a regra compara com `request.time`. */
export function endOfDayBrMs(iso) {
  if (!ISO.test(String(iso || ''))) return 0;
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 23 + 3, 59, 59, 999);
}

/** @returns {{ ok: boolean, errors: Record<string,string>, value: object }} */
export function validateSanctionInput(input = {}, { hoje = isoDate() } = {}) {
  const errors = {};
  const kind = Object.values(DISCIPLINE_KIND).includes(input.kind) ? input.kind : null;
  if (!kind) errors.kind = t('Escolha o tipo da sanção.');
  const reason = str(input.reason, 1000);
  if (reason.length < 10) errors.reason = t('Descreva o motivo (mínimo 10 caracteres). A pessoa vai ler.');
  const starts_at = str(input.starts_at, 10) || hoje;
  let ends_at = str(input.ends_at, 10);
  if (!ISO.test(starts_at)) errors.starts_at = t('Data de início inválida.');
  if (kind === DISCIPLINE_KIND.SUSPENSION) {
    if (!ISO.test(ends_at)) errors.ends_at = t('A suspensão precisa de data de fim.');
    else if (ends_at < starts_at) errors.ends_at = t('O fim vem antes do início.');
  } else ends_at = '';
  let fine_cents = 0;
  if (kind === DISCIPLINE_KIND.FINE) {
    fine_cents = Math.trunc(Number(input.fine_cents) || 0);
    if (fine_cents <= 0 || fine_cents > 100000000) errors.fine_cents = t('Informe o valor da multa.');
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { kind, reason, starts_at, ends_at, fine_cents, tournament_id: str(input.tournament_id, 80) || null, tournament_name: str(input.tournament_name, 120) },
  };
}

/** A sanção ainda produz efeito? (em vigor ou com recurso pendente, dentro do prazo) */
export function sanctionInForce(s, hoje = isoDate()) {
  if (!s || ![DISCIPLINE_STATUS.ACTIVE, DISCIPLINE_STATUS.APPEALED, DISCIPLINE_STATUS.UPHELD].includes(s.status)) return false;
  if (s.kind === DISCIPLINE_KIND.SUSPENSION) return Boolean(s.ends_at) && String(s.ends_at) >= hoje && String(s.starts_at || '') <= hoje;
  return s.kind === DISCIPLINE_KIND.EXCLUSION;
}

/** A filiação está suspensa por disciplina AGORA? (o campo que o servidor grava e a regra lê) */
export const isDisciplineSuspended = (member, nowMs = Date.now()) => Number(member?.discipline_until_ms) > nowMs;

/** Recurso: uma vez, enquanto em vigor e sem recurso anterior. */
export const canAppeal = (s) => Boolean(s) && s.status === DISCIPLINE_STATUS.ACTIVE && !s.appeal;

/** As sanções que a pessoa vê em destaque: em vigor hoje. */
export const activeSanctions = (list = [], hoje = isoDate()) => list.filter((s) => sanctionInForce(s, hoje));

/** Em vigor primeiro, depois as mais recentes. */
export function sortSanctions(list = [], hoje = isoDate()) {
  return [...list].sort((a, b) => Number(sanctionInForce(b, hoje)) - Number(sanctionInForce(a, hoje)) || (b.created_at_ms || 0) - (a.created_at_ms || 0));
}

/* ------------------------------------------------------------ ouvidoria -- */

/** @returns {{ ok: boolean, errors: Record<string,string>, value: object }} */
export function validateReportInput(input = {}) {
  const errors = {};
  const kind = Object.values(REPORT_KIND).includes(input.kind) ? input.kind : REPORT_KIND.OTHER;
  const body = str(input.body, REPORT_MAX_CHARS);
  if (body.length < 20) errors.body = t('Conte o que aconteceu (mínimo 20 caracteres).');
  const anonymous = input.anonymous === true;
  return { ok: Object.keys(errors).length === 0, errors, value: { kind, body, anonymous, tournament_name: str(input.tournament_name, 120) } };
}

/** O protocolo que a pessoa guarda: o id do documento, legível em blocos. */
export function reportProtocol(id) {
  const s = String(id || '').toUpperCase();
  return s ? s.replace(/(.{4})(?=.)/g, '$1-') : '';
}

/** O protocolo digitado → id do documento. */
export function protocolToId(raw) {
  const s = String(raw || '').replace(/[\s-]/g, '');
  return /^[A-Za-z0-9]{10,40}$/.test(s) ? s : '';
}

/** Protocolo é maiúsculo; o id do Firestore diferencia maiúsculas: a tela guarda o id e mostra o protocolo. */
export const sortReports = (list = []) => [...list].sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || (b.created_at_ms || 0) - (a.created_at_ms || 0));
