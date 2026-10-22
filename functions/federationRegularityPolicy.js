/**
 * Regularidade do filiado — a conta PURA do servidor: validade dos documentos
 * (o resumo que vai para `federation_members.docs_state` e a trava
 * `docs_block`), a escala do nível oficial, o seguro e as ocorrências, os
 * consentimentos.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/regularity.js` e de
 * `requiredDocs`/`requiredDocsStatus` de `privateData.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationRegularity.parity.test.js`. As mensagens daqui são CÓDIGOS; o
 * texto para a pessoa é o da tela. Ids e chaves são GRAVADOS: nunca renomeie.
 */
const { addMonthsISO, daysBetween } = require('./federationMembership.js');

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);
const isIsoDate = (s) => ISO.test(String(s || '')) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());

/* ------------------------------------------------------------- documentos -- */

const DOC_KINDS = Object.freeze(['identidade', 'atestado', 'comprovante_residencia', 'autorizacao_responsavel', 'outro']);
const OTHER_DOCS_MAX = 5;
const DOC_VALIDITY_MONTHS = Object.freeze([0, 3, 6, 12, 24, 36, 60]);
const DOC_EXPIRY_WARN_DAYS = 30;
const DOC_EXPIRY_NOTICE_DAYS = Object.freeze([30, 7, 0]);

function normalizeOtherDocs(list) {
  const vistos = new Set();
  return (Array.isArray(list) ? list : [])
    .map((x) => ({ id: str(x && x.id, 24).replace(/[^A-Za-z0-9_-]/g, ''), label: str(x && x.label, 80) }))
    .filter((x) => x.id && x.label.length >= 2 && !vistos.has(x.label.toLowerCase()) && vistos.add(x.label.toLowerCase()))
    .slice(0, OTHER_DOCS_MAX);
}

function requiredDocs(plan) {
  const proprios = normalizeOtherDocs(plan && plan.other_docs);
  const kinds = [...new Set(((plan && plan.requires_docs) || []).filter((k) => DOC_KINDS.includes(k)))];
  const lista = kinds.filter((k) => k !== 'outro').map((k) => ({ key: k, kind: k, label: null }));
  if (kinds.includes('outro') || proprios.length) {
    if (proprios.length) proprios.forEach((o) => lista.push({ key: o.id, kind: 'outro', label: o.label }));
    else lista.push({ key: 'outro', kind: 'outro', label: null });
  }
  return lista;
}

const submittedDocKey = (d) => (d && (d.doc_key || d.kind)) || 'outro';

function requiredDocsStatus(plan, docs = [], hoje = null) {
  return requiredDocs(plan).map((req) => {
    const dos = docs.filter((d) => submittedDocKey(d) === req.key).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
    const doc = dos[0] || null;
    if (!doc) return { ...req, status: 'missing', doc: null };
    const aceitos = dos.filter((d) => d.status === 'approved');
    const venceu = (d) => Boolean(hoje && d.valid_until && d.valid_until < hoje);
    const valido = aceitos.find((d) => !venceu(d));
    if (valido) {
      const dias = hoje && valido.valid_until ? daysBetween(hoje, valido.valid_until) : null;
      return { ...req, status: 'approved', doc: valido, newer: doc !== valido ? doc : null, valid_until: valido.valid_until || null, days_left: dias, expiring: dias != null && dias <= DOC_EXPIRY_WARN_DAYS };
    }
    if (aceitos.length) return { ...req, status: 'expired', doc: aceitos[0], newer: doc !== aceitos[0] ? doc : null, valid_until: aceitos[0].valid_until, days_left: daysBetween(hoje, aceitos[0].valid_until), expiring: false };
    return { ...req, status: doc.status === 'rejected' ? 'rejected' : 'pending', doc };
  });
}

function normalizeDocValidity(raw, keys = null) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.entries(raw).forEach(([k, v]) => {
    const meses = Math.trunc(Number(v));
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(k) || !DOC_VALIDITY_MONTHS.includes(meses) || meses === 0) return;
    if (keys && !keys.includes(k)) return;
    out[k] = meses;
  });
  return out;
}

const docValidityMonths = (plan, key) => normalizeDocValidity(plan && plan.doc_validity)[key] || 0;

function defaultValidUntil(plan, key, fromIso) {
  const meses = docValidityMonths(plan, key);
  return meses && isIsoDate(fromIso) ? addMonthsISO(fromIso, meses) : null;
}

function docsSummary(statusList = []) {
  if (!statusList.length) return { state: 'none', next_expiry: null, expired: 0, expiring: 0, missing: 0, pending: 0 };
  const conta = (f) => statusList.filter(f).length;
  const expired = conta((d) => d.status === 'expired');
  const missing = conta((d) => d.status === 'missing' || d.status === 'rejected');
  const pending = conta((d) => d.status === 'pending');
  const expiring = conta((d) => d.status === 'approved' && d.expiring);
  const validades = statusList.filter((d) => d.status === 'approved' && d.valid_until).map((d) => d.valid_until).sort();
  const state = expired ? 'expired' : (missing || pending) ? 'incomplete' : expiring ? 'expiring' : 'ok';
  return { state, next_expiry: validades[0] || null, expired, expiring, missing, pending };
}

const docsBlock = (rules, summary) => Boolean(rules && rules.block_expired_docs === true && summary && summary.state === 'expired');

/* ------------------------------------------------------------ nível oficial -- */

const DEFAULT_LEVELS = Object.freeze(['2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5+']);
const LEVELS_MAX = 20;
const LEVEL_LABEL_MAX = 16;
const LEVEL_HISTORY_MAX = 20;
const LEVEL_REASON_MIN = 3;

function normalizeLevels(list) {
  const vistos = new Set();
  const out = (Array.isArray(list) ? list : [])
    .map((x) => str(x, LEVEL_LABEL_MAX))
    .filter((x) => x && !vistos.has(x.toLowerCase()) && vistos.add(x.toLowerCase()))
    .slice(0, LEVELS_MAX);
  return out.length ? out : [...DEFAULT_LEVELS];
}

function validateLevelInput(input = {}, levels) {
  const errors = {};
  const label = str(input.label, LEVEL_LABEL_MAX);
  const reason = str(input.reason, 300);
  if (!normalizeLevels(levels).includes(label)) errors.label = 'level_unknown';
  if (reason.length < LEVEL_REASON_MIN) errors.reason = 'reason_short';
  return { ok: !Object.keys(errors).length, errors, value: { label, reason } };
}

function validateLevelReview(input = {}) {
  const reason = str(input.reason, 600);
  return reason.length < 10 ? { ok: false, error: 'reason_short' } : { ok: true, value: { reason, wanted: str(input.wanted, LEVEL_LABEL_MAX) } };
}

/* ----------------------------------------------------- seguro e ocorrências -- */

const INSURANCE_COVERS = Object.freeze({ ACTIVE: 'active_members', FEDERATED: 'federated_only' });

function insuranceState(ins, hoje) {
  if (!ins || !isIsoDate(ins.valid_until)) return { state: 'none', days_left: null };
  if (ins.valid_from && hoje < ins.valid_from) return { state: 'future', days_left: null };
  const dias = daysBetween(hoje, ins.valid_until);
  return dias < 0 ? { state: 'expired', days_left: dias } : { state: 'active', days_left: dias };
}

function memberInsured(member, federation, hoje, memberActive) {
  const ins = federation && federation.insurance;
  if (!memberActive || insuranceState(ins, hoje).state !== 'active') return false;
  return ins.covers !== INSURANCE_COVERS.FEDERATED || ((member && member.tier) || 'federated') === 'federated';
}

const INCIDENT_KINDS = Object.freeze(['injury', 'accident', 'illness', 'other']);
const INCIDENT_STATUSES = Object.freeze(['open', 'claim', 'closed']);
const INCIDENT_DESC_MAX = 2000;

function validateIncident(input = {}, hoje) {
  const errors = {};
  const v = {
    date: str(input.date, 10), kind: INCIDENT_KINDS.includes(input.kind) ? input.kind : 'injury',
    place: str(input.place, 120), event_name: str(input.event_name, 120), tournament_id: str(input.tournament_id, 64) || null,
    body_part: str(input.body_part, 60), description: str(input.description, INCIDENT_DESC_MAX),
    first_aid: input.first_aid === true, hospital: input.hospital === true,
  };
  if (!isIsoDate(v.date)) errors.date = 'date_invalid';
  else if (hoje && v.date > hoje) errors.date = 'date_future';
  if (v.description.length < 10) errors.description = 'description_short';
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/* ---------------------------------------------------------- consentimentos -- */

const BASE_CONSENT_IDS = Object.freeze(['image', 'comms', 'share']);
const CONSENT_EXTRA_MAX = 5;
const CONSENT_LOG_MAX = 30;

function normalizeExtraConsents(list) {
  const vistos = new Set(BASE_CONSENT_IDS);
  return (Array.isArray(list) ? list : [])
    .map((x) => ({ id: str(x && x.id, 24).replace(/[^A-Za-z0-9_-]/g, ''), label: str(x && x.label, 60), text: str(x && x.text, 600) }))
    .filter((x) => x.id && x.label.length >= 2 && x.text.length >= 10 && !vistos.has(x.id) && vistos.add(x.id))
    .slice(0, CONSENT_EXTRA_MAX);
}

const consentIds = (federation) => [...BASE_CONSENT_IDS, ...normalizeExtraConsents(federation && federation.rules && federation.rules.extra_consents).map((c) => c.id)];

function normalizeConsentsInput(raw, ids) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  ids.forEach((id) => { if (typeof raw[id] === 'boolean') out[id] = raw[id]; });
  return out;
}

/**
 * O patch dos consentimentos: só o que MUDOU entra no registro, com a hora do
 * servidor. `null` se nada mudou. Usado no pedido de filiação e na ação `consents`.
 */
function consentsPatch(federation, member, raw, uid, now) {
  const novos = normalizeConsentsInput(raw, consentIds(federation));
  const atuais = (member && member.consents) || {};
  const mudou = Object.keys(novos).filter((id) => !atuais[id] || atuais[id].granted !== novos[id]);
  if (!mudou.length) return null;
  const consents = { ...atuais };
  mudou.forEach((id) => { consents[id] = { granted: novos[id], at_ms: now }; });
  const log = mudou.map((id) => ({ id, granted: novos[id], at_ms: now, by: uid }));
  return { consents, consents_log: [...log, ...(Array.isArray(member && member.consents_log) ? member.consents_log : [])].slice(0, CONSENT_LOG_MAX), changed: mudou.length };
}

module.exports = {
  isIsoDate, DOC_VALIDITY_MONTHS, DOC_EXPIRY_WARN_DAYS, DOC_EXPIRY_NOTICE_DAYS,
  requiredDocs, submittedDocKey, requiredDocsStatus, normalizeDocValidity, docValidityMonths, defaultValidUntil, docsSummary, docsBlock,
  DEFAULT_LEVELS, LEVELS_MAX, LEVEL_LABEL_MAX, LEVEL_HISTORY_MAX, LEVEL_REASON_MIN, normalizeLevels, validateLevelInput, validateLevelReview,
  INSURANCE_COVERS, insuranceState, memberInsured, INCIDENT_KINDS, INCIDENT_STATUSES, INCIDENT_DESC_MAX, validateIncident,
  BASE_CONSENT_IDS, CONSENT_EXTRA_MAX, CONSENT_LOG_MAX, normalizeExtraConsents, consentIds, normalizeConsentsInput, consentsPatch,
};
