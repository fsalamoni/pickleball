/**
 * REGULARIDADE DA PRÓPRIA FEDERAÇÃO (rodada 3, Bloco 2, `docs/50` §37) — a
 * conta PURA do cofre de certidões (módulo `certificates`) e dos projetos da
 * Lei de Incentivo ao Esporte (módulo `incentive_projects`), mais o
 * relatório anual de proteção da infância (zero banco, só números).
 *
 *  - Certidão: tipo, número, emissão, validade e o arquivo. A ATUAL de cada
 *    tipo é a de validade mais longa; as antigas ficam de histórico. A
 *    varredura avisa 30, 7 e 1 dia antes de vencer e no dia em que vence.
 *    Certidão vencida bloqueia repasse federal e de loteria (Acórdão TCU
 *    2331/2025): a Conformidade mostra.
 *  - Projeto incentivado (Lei 11.438/2006): valor aprovado, prazo de
 *    captação, cada aporte (patrocínio ou doação) e a prestação de contas.
 *    O aporte RECEBIDO entra nas contas como receita derivada
 *    (`incentiveIncome`, categoria "Convênios e repasses"), sem lançar de novo.
 *
 * O servidor tem uma CÓPIA (`functions/federationInstitutionalPolicy.js`) com
 * paridade em `federationInstitutional.parity.test.js`. Tipos, estados e ids
 * são GRAVADOS: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

const str = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export const AMOUNT_MAX = 100_000_000_000;
const cents = (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, AMOUNT_MAX) : 0; };

/* ----------------------------------------------------------- certidões -- */

export const CERT_KINDS = Object.freeze(['cnd_federal', 'fgts', 'cndt', 'state', 'municipal', 'other']);
export const CERT_KIND_LABELS = Object.freeze({
  cnd_federal: tk('CND federal (Receita e PGFN)'), fgts: tk('Certificado de regularidade do FGTS'), cndt: tk('CNDT (débitos trabalhistas)'),
  state: tk('Certidão estadual'), municipal: tk('Certidão municipal'), other: tk('Outra certidão'),
});
/** Os dias antes do vencimento em que a varredura avisa (e no dia em que vence). */
export const CERT_WARN_DAYS = Object.freeze([30, 7, 1]);
export const CERT_NOTE_MAX = 500;

/** Uma certidão digitada → o que pode ser gravado (o servidor confere de novo; o arquivo é conferido à parte). */
export function validateCertificate(input = {}) {
  const errors = {};
  const kind = CERT_KINDS.includes(input.kind) ? input.kind : '';
  if (!kind) errors.kind = t('Escolha o tipo da certidão.');
  const label = str(input.label, 80);
  if (kind === 'other' && label.length < 3) errors.label = t('Diga qual é a certidão.');
  const issued_at = isIso(input.issued_at) ? input.issued_at : '';
  const valid_until = isIso(input.valid_until) ? input.valid_until : '';
  if (!issued_at) errors.issued_at = t('Informe a data de emissão.');
  if (!valid_until) errors.valid_until = t('Informe a validade.');
  else if (issued_at && valid_until < issued_at) errors.valid_until = t('A validade vem depois da emissão.');
  const value = { kind, label: kind === 'other' ? label : '', number: str(input.number, 60), issued_at, valid_until, note: txt(input.note, CERT_NOTE_MAX) };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** A chave do "tipo": a certidão "outra" se distingue pelo nome. */
export const certSlot = (c) => (c?.kind === 'other' ? `other:${str(c.label, 80).toLowerCase()}` : String(c?.kind || ''));

/** A situação de uma certidão hoje: `valid`, `expiring` (até 30 dias) ou `expired`. */
export function certificateState(c, hoje) {
  const left = isIso(c?.valid_until) ? dias(hoje, c.valid_until) : null;
  const state = left === null || left < 0 ? 'expired' : left <= CERT_WARN_DAYS[0] ? 'expiring' : 'valid';
  return { state, daysLeft: left };
}
export const CERT_STATE_LABELS = Object.freeze({ valid: tk('Em dia'), expiring: tk('Vence em breve'), expired: tk('Vencida'), superseded: tk('Substituída') });

/** As certidões ATUAIS (a de validade mais longa de cada tipo); as demais saem como `superseded`. */
export function currentCertificates(certs = []) {
  const melhor = new Map();
  lista(certs).forEach((c) => {
    if (!c) return;
    const k = certSlot(c);
    const a = melhor.get(k);
    if (!a || String(c.valid_until || '') > String(a.valid_until || '') || (c.valid_until === a.valid_until && Number(c.created_at_ms || 0) > Number(a.created_at_ms || 0))) melhor.set(k, c);
  });
  return [...melhor.values()];
}

/** O resumo para a tela e a Conformidade: quantas atuais, quantas vencidas e vencendo. */
export function certificatesSummary(certs = [], hoje) {
  const atuais = currentCertificates(certs).map((c) => ({ ...c, ...certificateState(c, hoje) }));
  return {
    current: atuais.sort((a, b) => String(a.valid_until).localeCompare(String(b.valid_until))),
    expired: atuais.filter((c) => c.state === 'expired'),
    expiring: atuais.filter((c) => c.state === 'expiring'),
  };
}

/**
 * O próximo aviso que a varredura deve dar para esta certidão (uma vez cada):
 * `30`, `7`, `1` ou `0` (venceu). `null` = nada a avisar. Só a ATUAL do tipo
 * é avisada (a substituída não incomoda).
 */
export function certificateWarnStep(c, hoje) {
  const { daysLeft } = certificateState(c, hoje);
  if (daysLeft === null) return null;
  const passos = CERT_WARN_DAYS.filter((d) => daysLeft <= d);
  const passo = daysLeft < 0 ? 0 : passos.length ? Math.min(...passos) : null;
  if (passo === null) return null;
  const ja = lista(c.warned_steps);
  return ja.includes(passo) ? null : passo;
}

/* ------------------------------------------ Lei de Incentivo ao Esporte -- */

export const INCENTIVE_STATUS = Object.freeze({ CAPTURING: 'capturing', EXECUTING: 'executing', REPORTING: 'reporting', CLOSED: 'closed', CANCELLED: 'cancelled' });
export const INCENTIVE_STATUS_LABELS = Object.freeze({
  capturing: tk('Em captação'), executing: tk('Em execução'), reporting: tk('Prestação de contas enviada'), closed: tk('Encerrado'), cancelled: tk('Cancelado'),
});
/** A ordem natural: dá para voltar uma etapa (com motivo) e cancelar sem aporte. */
export const INCENTIVE_FLOW = Object.freeze(['capturing', 'executing', 'reporting', 'closed']);
export const ACCOUNTABILITY_RESULTS = Object.freeze(['approved', 'approved_caveats', 'rejected']);
export const ACCOUNTABILITY_RESULT_LABELS = Object.freeze({ approved: tk('Aprovada'), approved_caveats: tk('Aprovada com ressalvas'), rejected: tk('Reprovada') });
export const RECEIPT_KINDS = Object.freeze(['sponsorship', 'donation']);
export const RECEIPT_KIND_LABELS = Object.freeze({ sponsorship: tk('Patrocínio incentivado'), donation: tk('Doação incentivada') });
export const INCENTIVE_CAPTURE_WARN_DAYS = 30;
export const RECEIPTS_MAX = 300;
export const INCENTIVE_NOTES_MAX = 2000;

/** Um projeto digitado → o que pode ser gravado. */
export function validateIncentiveProject(input = {}) {
  const errors = {};
  const title = str(input.title, 160);
  if (title.length < 3) errors.title = t('Diga o nome do projeto.');
  const approved_cents = cents(input.approved_cents);
  if (!approved_cents) errors.approved_cents = t('Informe o valor aprovado para captação.');
  const capture_until = isIso(input.capture_until) ? input.capture_until : '';
  if (!capture_until) errors.capture_until = t('Informe o fim do prazo de captação.');
  const exec_start = isIso(input.exec_start) ? input.exec_start : '';
  const exec_end = isIso(input.exec_end) ? input.exec_end : '';
  if (exec_start && exec_end && exec_end < exec_start) errors.exec_end = t('O fim da execução vem depois do início.');
  const value = {
    title, process_number: str(input.process_number, 40), manifestation: str(input.manifestation, 60), bank_account: str(input.bank_account, 80),
    approved_cents, capture_until, exec_start, exec_end, notes: txt(input.notes, INCENTIVE_NOTES_MAX),
  };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Um aporte digitado (patrocinador ou doador, valor e data do depósito). */
export function validateIncentiveReceipt(input = {}, hoje) {
  const errors = {};
  const donor_name = str(input.donor_name, 120);
  if (donor_name.length < 2) errors.donor_name = t('Diga quem fez o aporte.');
  const amount_cents = cents(input.amount_cents);
  if (!amount_cents) errors.amount_cents = t('Informe o valor do aporte.');
  const date = isIso(input.date) ? input.date : '';
  if (!date) errors.date = t('Informe a data do depósito.');
  else if (hoje && date > hoje) errors.date = t('A data não pode ser no futuro.');
  const value = { donor_name, donor_doc: str(input.donor_doc, 20), kind: RECEIPT_KINDS.includes(input.kind) ? input.kind : 'sponsorship', amount_cents, date };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** A situação do projeto: quanto foi captado, quanto falta e o prazo. */
export function incentiveProjectState(p, hoje) {
  const recebidos = lista(p?.receipts).filter((r) => !r.voided_at);
  const captado = recebidos.reduce((s, r) => s + cents(r.amount_cents), 0);
  const aprovado = cents(p?.approved_cents);
  const left = isIso(p?.capture_until) ? dias(hoje, p.capture_until) : null;
  const captando = p?.status === INCENTIVE_STATUS.CAPTURING;
  return {
    captured_cents: captado, approved_cents: aprovado, remaining_cents: Math.max(0, aprovado - captado),
    pct: aprovado ? Math.min(100, Math.round((captado / aprovado) * 100)) : 0,
    donors: new Set(recebidos.map((r) => str(r.donor_name, 120).toLowerCase())).size,
    captureDaysLeft: left, captureEnded: left !== null && left < 0,
    captureEnding: captando && left !== null && left >= 0 && left <= INCENTIVE_CAPTURE_WARN_DAYS,
  };
}

/** O estado pode ir para a etapa seguinte, voltar uma (com motivo) ou ser cancelado (sem aporte). */
export function incentiveTransition(p, to) {
  const de = p?.status;
  if (de === INCENTIVE_STATUS.CANCELLED || de === to) return { ok: false, error: t('O projeto já está nesta situação.') };
  if (to === INCENTIVE_STATUS.CANCELLED) {
    return incentiveProjectState(p, '1970-01-01').captured_cents > 0 ? { ok: false, error: t('Projeto com aporte não se cancela: encerre com a prestação de contas.') } : { ok: true, back: false };
  }
  const i = INCENTIVE_FLOW.indexOf(de);
  const j = INCENTIVE_FLOW.indexOf(to);
  if (i < 0 || j < 0 || Math.abs(j - i) !== 1) return { ok: false, error: t('Passe uma etapa de cada vez.') };
  return { ok: true, back: j < i };
}

/** Os aportes RECEBIDOS como receita (no formato de `extraIncomeItems`): categoria "Convênios e repasses". */
export function incentiveIncome(projects = []) {
  const out = [];
  lista(projects).forEach((p) => {
    if (!p || p.status === INCENTIVE_STATUS.CANCELLED) return;
    lista(p.receipts).filter((r) => !r.voided_at && isIso(r.date) && cents(r.amount_cents)).forEach((r) => out.push({
      date: r.date, amount_cents: cents(r.amount_cents), category: 'grants', ref: `incentive:${p.id}:${r.id}`,
      description: `${str(p.title, 80)} · ${str(r.donor_name, 80)}`.slice(0, 200), counterparty: str(r.donor_name, 120), auto: 'incentive',
    }));
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

/* ------------------------------------------------------------ permissões -- */

const tem = (perms, ...ps) => Array.isArray(perms) && ps.some((p) => perms.includes(p));
/** Certidões e projetos incentivados: o financeiro e o admin gerem; o conselho fiscal lê. */
export const canManageInstitutional = (perms) => tem(perms, 'finance', 'admin');
export const canViewInstitutional = (perms) => tem(perms, 'finance', 'admin', 'fiscal');

/* ------------------------- relatório anual de proteção da infância (zero banco) -- */

/**
 * O relatório anual de proteção de crianças e adolescentes (Lei 14.597, art.
 * 36, XIII, "h"), SÓ COM NÚMEROS: quem trabalha com menores e se está em dia
 * (o quadro do servidor, `sg_overview`) e as denúncias de proteção recebidas
 * no ano, por situação. Nenhum nome sai daqui. Fonte ausente = `null`.
 */
export function safeguardingAnnualReport({ rows, reports, year } = {}) {
  const ano = String(year || '');
  const quadro = Array.isArray(rows) ? (() => {
    const exigidos = rows.filter((r) => r.required);
    const conta = (lst, k) => lst.filter((r) => r.roles?.includes(k)).length;
    return {
      people: rows.length, required: exigidos.length,
      cleared: exigidos.filter((r) => r.ok).length, pendingReview: rows.filter((r) => r.pending).length,
      trainingOk: exigidos.filter((r) => r.training_ok).length,
      backgroundOk: exigidos.filter((r) => r.background?.valid === true).length,
      byRole: { coach: conta(rows, 'coach'), referee: conta(rows, 'referee'), director: conta(rows, 'director'), staff: conta(rows, 'staff') },
    };
  })() : null;
  const denuncias = Array.isArray(reports) ? (() => {
    const doAno = reports.filter((r) => r?.kind === 'minor_protection' && new Date(Number(r.created_at_ms) || 0).getFullYear() === Number(ano));
    const st = (s) => doAno.filter((r) => (r.status || 'open') === s).length;
    return { received: doAno.length, open: st('open'), inReview: st('in_review'), closed: st('closed'), anonymous: doAno.filter((r) => r.anonymous).length };
  })() : null;
  return { year: Number(ano), staff: quadro, reports: denuncias };
}
