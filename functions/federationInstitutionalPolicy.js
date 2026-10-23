/**
 * Regularidade da própria federação (rodada 3, Bloco 2) — a conta PURA do
 * cofre de certidões e dos projetos da Lei de Incentivo ao Esporte.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/institutional.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationInstitutional.parity.test.js`. Tipos, estados e ids são
 * GRAVADOS: nunca renomeie.
 */
const t = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : `{${k}}`));
const str = (v, max = 500) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

const AMOUNT_MAX = 100000000000;
const cents = (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, AMOUNT_MAX) : 0; };

/* ----------------------------------------------------------- certidões -- */

const CERT_KINDS = Object.freeze(['cnd_federal', 'fgts', 'cndt', 'state', 'municipal', 'other']);
const CERT_KIND_LABELS = Object.freeze({
  cnd_federal: 'CND federal (Receita e PGFN)', fgts: 'Certificado de regularidade do FGTS', cndt: 'CNDT (débitos trabalhistas)',
  state: 'Certidão estadual', municipal: 'Certidão municipal', other: 'Outra certidão',
});
const CERT_WARN_DAYS = Object.freeze([30, 7, 1]);
const CERT_NOTE_MAX = 500;

function validateCertificate(input = {}) {
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

const certSlot = (c) => (c && c.kind === 'other' ? `other:${str(c.label, 80).toLowerCase()}` : String((c && c.kind) || ''));

function certificateState(c, hoje) {
  const left = isIso(c && c.valid_until) ? dias(hoje, c.valid_until) : null;
  const state = left === null || left < 0 ? 'expired' : left <= CERT_WARN_DAYS[0] ? 'expiring' : 'valid';
  return { state, daysLeft: left };
}

function currentCertificates(certs = []) {
  const melhor = new Map();
  lista(certs).forEach((c) => {
    if (!c) return;
    const k = certSlot(c);
    const a = melhor.get(k);
    if (!a || String(c.valid_until || '') > String(a.valid_until || '') || (c.valid_until === a.valid_until && Number(c.created_at_ms || 0) > Number(a.created_at_ms || 0))) melhor.set(k, c);
  });
  return [...melhor.values()];
}

function certificatesSummary(certs = [], hoje) {
  const atuais = currentCertificates(certs).map((c) => ({ ...c, ...certificateState(c, hoje) }));
  return {
    current: atuais.sort((a, b) => String(a.valid_until).localeCompare(String(b.valid_until))),
    expired: atuais.filter((c) => c.state === 'expired'),
    expiring: atuais.filter((c) => c.state === 'expiring'),
  };
}

function certificateWarnStep(c, hoje) {
  const { daysLeft } = certificateState(c, hoje);
  if (daysLeft === null) return null;
  const passos = CERT_WARN_DAYS.filter((d) => daysLeft <= d);
  const passo = daysLeft < 0 ? 0 : passos.length ? Math.min(...passos) : null;
  if (passo === null) return null;
  const ja = lista(c.warned_steps);
  return ja.includes(passo) ? null : passo;
}

/* ------------------------------------------ Lei de Incentivo ao Esporte -- */

const INCENTIVE_STATUS = Object.freeze({ CAPTURING: 'capturing', EXECUTING: 'executing', REPORTING: 'reporting', CLOSED: 'closed', CANCELLED: 'cancelled' });
const INCENTIVE_FLOW = Object.freeze(['capturing', 'executing', 'reporting', 'closed']);
const ACCOUNTABILITY_RESULTS = Object.freeze(['approved', 'approved_caveats', 'rejected']);
const RECEIPT_KINDS = Object.freeze(['sponsorship', 'donation']);
const INCENTIVE_CAPTURE_WARN_DAYS = 30;
const RECEIPTS_MAX = 300;
const INCENTIVE_NOTES_MAX = 2000;

function validateIncentiveProject(input = {}) {
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

function validateIncentiveReceipt(input = {}, hoje) {
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

function incentiveProjectState(p, hoje) {
  const recebidos = lista(p && p.receipts).filter((r) => !r.voided_at);
  const captado = recebidos.reduce((s, r) => s + cents(r.amount_cents), 0);
  const aprovado = cents(p && p.approved_cents);
  const left = isIso(p && p.capture_until) ? dias(hoje, p.capture_until) : null;
  const captando = Boolean(p) && p.status === INCENTIVE_STATUS.CAPTURING;
  return {
    captured_cents: captado, approved_cents: aprovado, remaining_cents: Math.max(0, aprovado - captado),
    pct: aprovado ? Math.min(100, Math.round((captado / aprovado) * 100)) : 0,
    donors: new Set(recebidos.map((r) => str(r.donor_name, 120).toLowerCase())).size,
    captureDaysLeft: left, captureEnded: left !== null && left < 0,
    captureEnding: captando && left !== null && left >= 0 && left <= INCENTIVE_CAPTURE_WARN_DAYS,
  };
}

function incentiveTransition(p, to) {
  const de = p && p.status;
  if (de === INCENTIVE_STATUS.CANCELLED || de === to) return { ok: false, error: t('O projeto já está nesta situação.') };
  if (to === INCENTIVE_STATUS.CANCELLED) {
    return incentiveProjectState(p, '1970-01-01').captured_cents > 0 ? { ok: false, error: t('Projeto com aporte não se cancela: encerre com a prestação de contas.') } : { ok: true, back: false };
  }
  const i = INCENTIVE_FLOW.indexOf(de);
  const j = INCENTIVE_FLOW.indexOf(to);
  if (i < 0 || j < 0 || Math.abs(j - i) !== 1) return { ok: false, error: t('Passe uma etapa de cada vez.') };
  return { ok: true, back: j < i };
}

function incentiveIncome(projects = []) {
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
const canManageInstitutional = (perms) => tem(perms, 'finance', 'admin');
const canViewInstitutional = (perms) => tem(perms, 'finance', 'admin', 'fiscal');

module.exports = {
  AMOUNT_MAX, CERT_KINDS, CERT_KIND_LABELS, CERT_WARN_DAYS, CERT_NOTE_MAX, validateCertificate, certSlot, certificateState, currentCertificates, certificatesSummary, certificateWarnStep,
  INCENTIVE_STATUS, INCENTIVE_FLOW, ACCOUNTABILITY_RESULTS, RECEIPT_KINDS, INCENTIVE_CAPTURE_WARN_DAYS, RECEIPTS_MAX, INCENTIVE_NOTES_MAX,
  validateIncentiveProject, validateIncentiveReceipt, incentiveProjectState, incentiveTransition, incentiveIncome, canManageInstitutional, canViewInstitutional,
};
