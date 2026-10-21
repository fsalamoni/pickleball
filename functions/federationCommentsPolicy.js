/**
 * Cópia no SERVIDOR da validação dos comentários
 * (`src/modules/federations/domain/comments.js`): texto, modo do documento ou
 * evento (abertos, fechados, consulta pública com prazo) e se dá para
 * comentar agora. Paridade em `federationComments.parity.test.js` — mexer num
 * lado só quebra o teste.
 */
const COMMENT_TEXT_MIN = 3;
const COMMENT_TEXT_MAX = 1000;
const COMMENT_REASON_MIN = 10;
const COMMENT_REPORTS_TO_HIDE = 3;
const COMMENT_INTERVAL_MS = 30000;
const COMMENT_DAILY_MAX = 10;
const COMMENT_LIST_MAX = 300;
const BR_OFFSET_MS = 3 * 3600000;
const DAY_MS = 86400000;

const COMMENT_TARGETS = ['doc', 'event'];
const MODE_IDS = ['open', 'closed', 'consultation'];
const REPORT_REASON_IDS = ['offensive', 'personal_data', 'spam', 'off_topic', 'other'];

const limpa = (s, max) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const todayBr = (nowMs) => new Date(nowMs - BR_OFFSET_MS).toISOString().slice(0, 10);
const endOfDayBr = (iso) => Date.parse(`${iso}T00:00:00Z`) + BR_OFFSET_MS + DAY_MS - 1;

function validateCommentText(text) {
  const value = limpa(text, COMMENT_TEXT_MAX + 1);
  if (value.length < COMMENT_TEXT_MIN) return { ok: false, value, error: `Escreva pelo menos ${COMMENT_TEXT_MIN} caracteres.` };
  if (value.length > COMMENT_TEXT_MAX) return { ok: false, value, error: `No máximo ${COMMENT_TEXT_MAX} caracteres.` };
  return { ok: true, value, error: null };
}

function validateCommentSettings(input, { nowMs = Date.now() } = {}) {
  const mode = MODE_IDS.includes(input && input.mode) ? input.mode : null;
  if (!mode) return { ok: false, error: 'Escolha como ficam os comentários.' };
  if (mode !== 'consultation') return { ok: true, value: { mode, until_date: null, until_ms: null }, error: null };
  const until = String((input && input.until_date) || '');
  if (!isoOk(until)) return { ok: false, error: 'Diga até quando vai a consulta pública.' };
  if (until < todayBr(nowMs)) return { ok: false, error: 'O prazo da consulta não pode ter passado.' };
  return { ok: true, value: { mode, until_date: until, until_ms: endOfDayBr(until) }, error: null };
}

function commentsState(target, { rules, kind = 'doc', nowMs = Date.now() } = {}) {
  const c = (target && target.comments) || {};
  const mode = MODE_IDS.includes(c.mode) ? c.mode : 'open';
  const base = { mode, until_date: mode === 'consultation' ? c.until_date || null : null };
  if (rules && rules.comments === false) return { ...base, open: false, why: 'disabled' };
  if (kind === 'doc' && (!target || target.status !== 'published')) return { ...base, open: false, why: 'unpublished' };
  if (mode === 'closed') return { ...base, open: false, why: 'closed' };
  if (mode === 'consultation' && !(Number(c.until_ms) > nowMs)) return { ...base, open: false, why: 'ended' };
  return { ...base, open: true, why: null };
}

module.exports = {
  COMMENT_TEXT_MIN, COMMENT_TEXT_MAX, COMMENT_REASON_MIN, COMMENT_REPORTS_TO_HIDE, COMMENT_INTERVAL_MS, COMMENT_DAILY_MAX, COMMENT_LIST_MAX,
  COMMENT_TARGETS, MODE_IDS, REPORT_REASON_IDS, todayBr, endOfDayBr, validateCommentText, validateCommentSettings, commentsState,
};
