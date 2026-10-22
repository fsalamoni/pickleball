/**
 * Seleção e apoio ao atleta (Bloco 3) — a conta PURA (sem banco): convocação
 * da seleção/delegação e editais de apoio ao atleta.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/selection.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationSelection.parity.test.js`. Ids, estados e chaves são GRAVADOS:
 * nunca renomeie.
 */
const { FINAL_INVITE_STATUS, finalInvitesToSend, normalizeFinalOptions } = require('./federationCompetitionsPolicy');
const { addDaysISO } = require('./federationRefereesPolicy');
const { isoDateBR } = require('./federationMembership');

const str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
const int = (v, d, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : d;
};
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);

/* ------------------------------------------------------------ convocação -- */

const CALLUP_STATUS = Object.freeze({ DRAFT: 'draft', OPEN: 'open', CLOSED: 'closed', CANCELLED: 'cancelled' });
const CALLUP_STATUS_LABELS = Object.freeze({
  draft: 'Rascunho', open: 'Convocação aberta', closed: 'Delegação fechada', cancelled: 'Cancelada',
});
/** O que sai da Central: aberta, fechada e cancelada (o rascunho cancelado é apagado). */
const CALLUP_PUBLIC_STATUSES = Object.freeze(['open', 'closed', 'cancelled']);
const CALLUP_CRITERIA = Object.freeze({ RANKING: 'ranking', MANUAL: 'manual' });
const CALLUP_CRITERIA_LABELS = Object.freeze({ ranking: 'Pelo ranking oficial do ano', manual: 'Escolha da comissão técnica' });
const TRAVEL_DOCS = Object.freeze(['id_doc', 'minor_authorization', 'medical', 'passport', 'vaccination']);
const TRAVEL_DOC_LABELS = Object.freeze({
  id_doc: 'Documento de identidade', minor_authorization: 'Autorização de viagem (menor de idade)',
  medical: 'Atestado médico', passport: 'Passaporte', vaccination: 'Comprovante de vacinação',
});
const UNIFORM_SIZES = Object.freeze(['PP', 'P', 'M', 'G', 'GG', 'XG']);
const CALLUP_COST_CATEGORIES = Object.freeze(['travel', 'events', 'equipment', 'other_expense']);
const CALLUP_COSTS_MAX = 30;
const CALLUP_PER_CATEGORY_MAX = 32;
const CALLUP_TEXT_MAX = 2000;
/** O convite da convocação usa os mesmos estados do convite da final. */
const CALLUP_MEMBER_STATUS = FINAL_INVITE_STATUS;
const MANUAL_CATEGORY = 'manual';

function normalizeCallupCost(c, i = 0) {
  return {
    id: str((c || {}).id, 12).replace(/[^A-Za-z0-9_-]/g, '') || `c${i + 1}`,
    label: str((c || {}).label, 80),
    category: CALLUP_COST_CATEGORIES.includes((c || {}).category) ? c.category : 'travel',
    amount_cents: int((c || {}).amount_cents, 0, 0, 1e10),
    paid_at: isIso((c || {}).paid_at) ? c.paid_at : '',
  };
}

function normalizeCallupCosts(raw) {
  const vistos = new Set();
  return lista(raw).slice(0, CALLUP_COSTS_MAX).map(normalizeCallupCost).map((c, i) => {
    const id = vistos.has(c.id) ? `c${i + 1}x` : c.id;
    vistos.add(id);
    return { ...c, id };
  });
}

/** Os campos da convocação, limpos. `categories` nulo = todas as categorias do ranking. */
function normalizeCallup(input = {}) {
  const criterion = Object.values(CALLUP_CRITERIA).includes(input.criterion) ? input.criterion : CALLUP_CRITERIA.RANKING;
  const fin = normalizeFinalOptions({ season: input.season, categories: input.categories, accept_days: input.accept_days });
  return {
    title: str(input.title, 120),
    event_name: str(input.event_name, 120),
    place: str(input.place, 120),
    starts_at: isIso(input.starts_at) ? input.starts_at : '',
    ends_at: isIso(input.ends_at) ? input.ends_at : '',
    criterion,
    season: criterion === CALLUP_CRITERIA.RANKING ? fin.season : null,
    categories: criterion === CALLUP_CRITERIA.RANKING ? fin.categories : null,
    per_category: int(input.per_category, 4, 1, CALLUP_PER_CATEGORY_MAX),
    accept_days: fin.accept_days,
    travel_docs: TRAVEL_DOCS.filter((k) => lista(input.travel_docs).includes(k)),
    collect_uniform: input.collect_uniform === true,
    notes: str(input.notes, CALLUP_TEXT_MAX),
  };
}

/** @returns {{ ok: boolean, errors: Record<string, string>, value: object }} */
function validateCallup(input = {}) {
  const v = normalizeCallup(input);
  const errors = {};
  if (v.title.length < 3) errors.title = 'required';
  if (v.event_name.length < 3) errors.event_name = 'required';
  if (!v.starts_at) errors.starts_at = 'required';
  if (v.ends_at && v.starts_at && v.ends_at < v.starts_at) errors.ends_at = 'before_start';
  if (v.criterion === CALLUP_CRITERIA.RANKING && !v.season) errors.season = 'required';
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/** As opções do convite pelo ranking (as mesmas da final do circuito). */
const callupRankingOptions = (callup) => ({
  season: (callup || {}).season, categories: (callup || {}).categories || null, per_category: (callup || {}).per_category, accept_days: (callup || {}).accept_days,
});

/** Quem convidar agora pelo ranking — a mesma escolha da final do circuito. */
const callupInvitesToSend = (categories, existing, callup) => finalInvitesToSend(categories, existing, callupRankingOptions(callup));

/** O convite ainda está esperando resposta? */
const callupInviteOpen = (inv, now = Date.now()) => Boolean(inv) && inv.status === FINAL_INVITE_STATUS.INVITED && Number(inv.expires_at_ms) > now;

/** Total previsto e pago dos custos. */
function callupCostsTotal(costs) {
  const cs = normalizeCallupCosts(costs);
  return {
    planned: cs.reduce((s, c) => s + c.amount_cents, 0),
    paid: cs.filter((c) => c.paid_at).reduce((s, c) => s + c.amount_cents, 0),
  };
}

/** Os custos PAGOS como despesas derivadas das contas (o dinheiro não é lançado duas vezes). */
function callupExpenses(callups = []) {
  const out = [];
  lista(callups).forEach((c) => {
    if (!c || c.status === CALLUP_STATUS.DRAFT) return;
    normalizeCallupCosts(c.costs).filter((x) => x.paid_at && x.amount_cents > 0).forEach((x) => out.push({
      date: x.paid_at, amount_cents: x.amount_cents, category: x.category, ref: `callup:${c.id}:${x.id}`,
      description: `${str(c.title, 80)} · ${x.label}`.slice(0, 200), auto: 'callup',
    }));
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

/** Contagem dos convites por estado. */
function callupCounts(members = []) {
  const out = { invited: 0, accepted: 0, declined: 0, expired: 0, cancelled: 0 };
  lista(members).forEach((m) => { if (m && Object.prototype.hasOwnProperty.call(out, m.status)) out[m.status] += 1; });
  return out;
}

/** Os documentos de viagem que a comissão já conferiu, sobre os que a convocação pede. */
function callupDocsState(callup, member) {
  const pedidos = lista((callup || {}).travel_docs).filter((k) => TRAVEL_DOCS.includes(k));
  const ok = pedidos.filter((k) => ((member || {}).docs_ok || {})[k] === true);
  return { required: pedidos, ok, missing: pedidos.filter((k) => !ok.includes(k)), complete: ok.length === pedidos.length };
}

/* --------------------------------------------------------------- editais -- */

const GRANT_STATUS = Object.freeze({ DRAFT: 'draft', OPEN: 'open', REVIEW: 'review', RESULT: 'result', FINAL: 'final', CANCELLED: 'cancelled' });
const GRANT_STATUS_LABELS = Object.freeze({
  draft: 'Rascunho', open: 'Inscrições abertas', review: 'Em análise', result: 'Resultado (prazo de recurso)', final: 'Encerrado', cancelled: 'Cancelado',
});
const GRANT_PUBLIC_STATUSES = Object.freeze(['open', 'review', 'result', 'final', 'cancelled']);
const GRANT_KINDS = Object.freeze(['travel', 'scholarship', 'equipment', 'other']);
const GRANT_KIND_LABELS = Object.freeze({ travel: 'Auxílio-viagem', scholarship: 'Bolsa-atleta', equipment: 'Material esportivo', other: 'Outro apoio' });
/** Em que categoria de despesa das contas o pagamento entra. */
const GRANT_KIND_EXPENSE = Object.freeze({ travel: 'travel', scholarship: 'other_expense', equipment: 'equipment', other: 'other_expense' });
const APPLICATION_STATUS = Object.freeze({ SUBMITTED: 'submitted', WITHDRAWN: 'withdrawn', APPROVED: 'approved', WAITLISTED: 'waitlisted', REJECTED: 'rejected' });
const APPLICATION_STATUS_LABELS = Object.freeze({
  submitted: 'Inscrição enviada', withdrawn: 'Desistiu', approved: 'Contemplado', waitlisted: 'Lista de espera', rejected: 'Não contemplado',
});
const APPEAL_STATUS = Object.freeze({ PENDING: 'pending', ACCEPTED: 'accepted', REJECTED: 'rejected' });
const GRANT_DOCS_MAX = 10;
const GRANT_TEXT_MAX = 4000;
const APPLICATION_TEXT_MAX = 3000;

/** Os documentos que o edital pede: `[{ key: 'd1', label }]` (chave pela ordem — gravada). */
function normalizeGrantDocs(raw) {
  return lista(raw).map((d) => str(typeof d === 'string' ? d : (d || {}).label, 80)).filter(Boolean).slice(0, GRANT_DOCS_MAX).map((label, i) => ({ key: `d${i + 1}`, label }));
}

function normalizeGrant(input = {}) {
  return {
    title: str(input.title, 120),
    kind: GRANT_KINDS.includes(input.kind) ? input.kind : 'travel',
    description: str(input.description, GRANT_TEXT_MAX),
    criteria: str(input.criteria, GRANT_TEXT_MAX),
    amount_cents: int(input.amount_cents, 0, 0, 1e9),
    slots: int(input.slots, 1, 1, 500),
    opens_at: isIso(input.opens_at) ? input.opens_at : '',
    closes_at: isIso(input.closes_at) ? input.closes_at : '',
    appeal_days: int(input.appeal_days, 5, 1, 15),
    members_only: input.members_only !== false,
    required_docs: normalizeGrantDocs(input.required_docs),
  };
}

function validateGrant(input = {}) {
  const v = normalizeGrant(input);
  const errors = {};
  if (v.title.length < 3) errors.title = 'required';
  if (v.description.length < 10) errors.description = 'required';
  if (v.criteria.length < 10) errors.criteria = 'required';
  if (!v.closes_at) errors.closes_at = 'required';
  if (v.opens_at && v.closes_at && v.closes_at < v.opens_at) errors.closes_at = 'before_open';
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/** Dá para se inscrever hoje? */
function grantAcceptsApplications(grant, hoje = isoDateBR()) {
  if (!grant || grant.status !== GRANT_STATUS.OPEN) return false;
  if (grant.opens_at && hoje < grant.opens_at) return false;
  return !grant.closes_at || hoje <= grant.closes_at;
}

/** O caminho do arquivo é da pasta de QUEM se inscreve (a regra do Storage só deixa ele subir ali). */
const ownFilePath = (path, uid) => Boolean(uid) && new RegExp(`^federacao/${String(uid).replace(/[^A-Za-z0-9_-]/g, '')}/[A-Za-z0-9_-]+\\.[a-z]{3,4}$`).test(String(path || ''));

/** A inscrição: texto e um arquivo por documento pedido, todos da pasta de quem se inscreve. */
function validateApplication(grant, input = {}, uid = '') {
  const text = str(input.text, APPLICATION_TEXT_MAX);
  const files = {};
  const errors = {};
  normalizeGrantDocs((grant || {}).required_docs).forEach((d) => {
    const f = (input.files || {})[d.key];
    if (!f || !ownFilePath(f.path, uid)) { errors[d.key] = 'required'; return; }
    files[d.key] = { path: String(f.path), name: str(f.name, 120), content_type: str(f.content_type, 60), size: int(f.size, 0, 0, 1e8), label: d.label };
  });
  if (text.length < 10) errors.text = 'required';
  return { ok: !Object.keys(errors).length, errors, value: { text, files } };
}

/** Quantas vagas ainda cabem entre os contemplados. */
const grantSlotsLeft = (grant, apps = []) => Math.max(0, int((grant || {}).slots, 1, 1, 500) - lista(apps).filter((a) => (a || {}).status === APPLICATION_STATUS.APPROVED).length);

/** Cabe recurso desta inscrição hoje? */
function canAppeal(app, grant, hoje = isoDateBR()) {
  return Boolean(app && grant) && [APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.WAITLISTED].includes(app.status)
    && grant.status === GRANT_STATUS.RESULT && Boolean(grant.appeal_until) && hoje <= grant.appeal_until && !app.appeal;
}

/** O resultado publicado: só os contemplados, sem uid (o id da inscrição é opaco). */
function grantPublicResult(apps = []) {
  return lista(apps).filter((a) => (a || {}).status === APPLICATION_STATUS.APPROVED)
    .map((a) => ({ application_id: String(a.id || ''), name: str(a.user_name, 120) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.application_id.localeCompare(b.application_id));
}

/** O fim do prazo de recurso a partir do dia em que o resultado sai. */
const appealUntil = (hoje, days) => addDaysISO(hoje, int(days, 5, 1, 15));

/** O resultado vira definitivo quando o prazo passou e não há recurso pendente. */
function grantCanFinalize(grant, apps = [], hoje = isoDateBR()) {
  if (!grant || grant.status !== GRANT_STATUS.RESULT) return false;
  if (grant.appeal_until && hoje <= grant.appeal_until) return false;
  return !lista(apps).some((a) => Boolean(a && a.appeal) && a.appeal.status === APPEAL_STATUS.PENDING);
}

/** Os pagamentos do edital como despesas derivadas das contas. */
function grantExpenses(grants = []) {
  const out = [];
  lista(grants).forEach((g) => {
    if (!g) return;
    lista(g.payments).filter((p) => p && isIso(p.paid_at) && int(p.amount_cents, 0, 0, 1e9) > 0).forEach((p) => out.push({
      date: p.paid_at, amount_cents: int(p.amount_cents, 0, 0, 1e9), category: GRANT_KIND_EXPENSE[g.kind] || 'other_expense',
      ref: `grant:${g.id}:${str(p.application_id, 40)}`, description: `${str(g.title, 80)} · ${str(p.name, 80)}`.slice(0, 200), auto: 'grant',
    }));
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

/** O texto do edital que vai para o acervo oficial (com o módulo ligado). */
function grantNoticeText(fed, g) {
  const v = normalizeGrant(g);
  const linhas = [
    `${str((fed || {}).name, 120)}${(fed || {}).acronym ? ` (${str(fed.acronym, 20)})` : ''}`,
    `Edital: ${v.title}`,
    '',
    v.description,
    '',
    'Critérios',
    v.criteria,
    '',
    `Vagas: ${v.slots}${v.amount_cents ? ` · Valor por contemplado: R$ ${(v.amount_cents / 100).toFixed(2).replace('.', ',')}` : ''}`,
    `Inscrições: ${v.opens_at ? `de ${v.opens_at.split('-').reverse().join('/')} ` : ''}até ${v.closes_at.split('-').reverse().join('/')}, pelo aplicativo.`,
    v.members_only ? 'Só filiados em dia podem se inscrever.' : 'Inscrição aberta a qualquer atleta com conta na plataforma.',
    v.required_docs.length ? `Documentos: ${v.required_docs.map((d) => d.label).join('; ')}.` : '',
    `Recurso: ${v.appeal_days} dia(s) depois da publicação do resultado.`,
  ];
  return linhas.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
}

module.exports = {
  CALLUP_STATUS, CALLUP_STATUS_LABELS, CALLUP_PUBLIC_STATUSES, CALLUP_CRITERIA, CALLUP_CRITERIA_LABELS, TRAVEL_DOCS, TRAVEL_DOC_LABELS, UNIFORM_SIZES, CALLUP_COST_CATEGORIES, CALLUP_COSTS_MAX, CALLUP_PER_CATEGORY_MAX, CALLUP_TEXT_MAX, CALLUP_MEMBER_STATUS, MANUAL_CATEGORY, normalizeCallupCost, normalizeCallupCosts, normalizeCallup, validateCallup, callupRankingOptions, callupInvitesToSend, callupInviteOpen, callupCostsTotal, callupExpenses, callupCounts, callupDocsState, GRANT_STATUS, GRANT_STATUS_LABELS, GRANT_PUBLIC_STATUSES, GRANT_KINDS, GRANT_KIND_LABELS, GRANT_KIND_EXPENSE, APPLICATION_STATUS, APPLICATION_STATUS_LABELS, APPEAL_STATUS, GRANT_DOCS_MAX, GRANT_TEXT_MAX, APPLICATION_TEXT_MAX, normalizeGrantDocs, normalizeGrant, validateGrant, grantAcceptsApplications, ownFilePath, validateApplication, grantSlotsLeft, canAppeal, grantPublicResult, appealUntil, grantCanFinalize, grantExpenses, grantNoticeText,
};
