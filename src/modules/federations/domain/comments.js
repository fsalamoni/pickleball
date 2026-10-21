/**
 * COMENTÁRIOS nos documentos do acervo e nos eventos do calendário oficial —
 * lógica pura.
 *
 * Quem pode ler o documento ou o evento e tem conta comenta; a federação
 * responde em destaque (resposta oficial), oculta com motivo e reabre. Três
 * denúncias de pessoas diferentes ocultam o comentário até a moderação olhar.
 * Cada documento ou evento escolhe: comentários abertos, fechados ou CONSULTA
 * PÚBLICA com prazo (aberta até o fim do dia escolhido, horário de Brasília).
 * A federação inteira pode desligar em Configurações → Regras
 * (`rules.comments`, ausente ⇒ ligado).
 *
 * Comentário não é recurso nem manifestação: a tela diz isso e leva à
 * ouvidoria. Tudo passa pelo servidor (`functions/federationComments.js`); a
 * validação tem cópia em `functions/federationCommentsPolicy.js` (paridade em
 * `federationComments.parity.test.js`).
 *
 * ⚠️ Modos, motivos de denúncia e status são GRAVADOS: nunca renomeie.
 */
import { fmtData, t, tk } from '@/core/i18n';

export const COMMENT_TEXT_MIN = 3;
export const COMMENT_TEXT_MAX = 1000;
export const COMMENT_REASON_MIN = 10;
export const COMMENT_REPORTS_TO_HIDE = 3;
export const COMMENT_INTERVAL_MS = 30000;
export const COMMENT_DAILY_MAX = 10;
export const COMMENT_LIST_MAX = 300;
const BR_OFFSET_MS = 3 * 3600000;
const DAY_MS = 86400000;

/** Onde se comenta: documento do acervo ou evento do calendário. */
export const COMMENT_TARGETS = Object.freeze(['doc', 'event']);

export const COMMENT_MODES = Object.freeze([
  { id: 'open', label: tk('Abertos') },
  { id: 'closed', label: tk('Fechados') },
  { id: 'consultation', label: tk('Consulta pública com prazo') },
]);

export const COMMENT_REPORT_REASONS = Object.freeze([
  { id: 'offensive', label: tk('Ofensivo ou discriminatório') },
  { id: 'personal_data', label: tk('Expõe dado pessoal de alguém') },
  { id: 'spam', label: tk('Propaganda ou spam') },
  { id: 'off_topic', label: tk('Fora do assunto') },
  { id: 'other', label: tk('Outro motivo') },
]);

const limpa = (s, max) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const todayBr = (nowMs) => new Date(nowMs - BR_OFFSET_MS).toISOString().slice(0, 10);
/** O fim do dia (23:59:59.999) em Brasília. */
export const endOfDayBr = (iso) => Date.parse(`${iso}T00:00:00Z`) + BR_OFFSET_MS + DAY_MS - 1;

/** O texto do comentário. */
export function validateCommentText(text) {
  const value = limpa(text, COMMENT_TEXT_MAX + 1);
  if (value.length < COMMENT_TEXT_MIN) return { ok: false, value, error: t('Escreva pelo menos {n} caracteres.', { n: COMMENT_TEXT_MIN }) };
  if (value.length > COMMENT_TEXT_MAX) return { ok: false, value, error: t('No máximo {n} caracteres.', { n: COMMENT_TEXT_MAX }) };
  return { ok: true, value, error: null };
}

/** Os comentários do documento ou evento: modo e, na consulta, o último dia. */
export function validateCommentSettings(input, { nowMs = Date.now() } = {}) {
  const mode = COMMENT_MODES.some((m) => m.id === input?.mode) ? input.mode : null;
  if (!mode) return { ok: false, error: t('Escolha como ficam os comentários.') };
  if (mode !== 'consultation') return { ok: true, value: { mode, until_date: null, until_ms: null }, error: null };
  const until = String(input?.until_date || '');
  if (!isoOk(until)) return { ok: false, error: t('Diga até quando vai a consulta pública.') };
  if (until < todayBr(nowMs)) return { ok: false, error: t('O prazo da consulta não pode ter passado.') };
  return { ok: true, value: { mode, until_date: until, until_ms: endOfDayBr(until) }, error: null };
}

/**
 * Se dá para comentar agora: `{ open, mode, until_date, why }`. `why` diz
 * por que não: `disabled` (a federação desligou), `closed`, `ended` (a
 * consulta acabou) ou `unpublished` (documento que não está publicado).
 */
export function commentsState(target, { rules, kind = 'doc', nowMs = Date.now() } = {}) {
  const c = target?.comments || {};
  const mode = COMMENT_MODES.some((m) => m.id === c.mode) ? c.mode : 'open';
  const base = { mode, until_date: mode === 'consultation' ? c.until_date || null : null };
  if (rules && rules.comments === false) return { ...base, open: false, why: 'disabled' };
  if (kind === 'doc' && target?.status !== 'published') return { ...base, open: false, why: 'unpublished' };
  if (mode === 'closed') return { ...base, open: false, why: 'closed' };
  if (mode === 'consultation' && !(Number(c.until_ms) > nowMs)) return { ...base, open: false, why: 'ended' };
  return { ...base, open: true, why: null };
}

/**
 * A lista que o servidor devolve, em fios: cada comentário com as respostas
 * oficiais logo abaixo, do mais antigo ao mais novo. Resposta cujo comentário
 * sumiu fica sozinha, no lugar dela.
 */
export function commentThreads(comments) {
  const lista = [...(comments || [])].sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
  const ids = new Set(lista.filter((c) => !c.parent_id).map((c) => c.id));
  const filhos = new Map();
  lista.filter((c) => c.parent_id && ids.has(c.parent_id)).forEach((c) => filhos.set(c.parent_id, [...(filhos.get(c.parent_id) || []), c]));
  return lista.filter((c) => !c.parent_id || !ids.has(c.parent_id)).map((c) => ({ ...c, replies: filhos.get(c.id) || [] }));
}

const dataBr = (iso) => { const [y, m, d] = String(iso || '').split('-').map(Number); return y ? fmtData(new Date(y, m - 1, d), { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; };

/** A frase do estado, para a tela. */
export function commentsStateLabel(state) {
  if (!state) return '';
  if (state.why === 'disabled') return t('A federação não recebe comentários.');
  if (state.why === 'unpublished') return t('Comentários só depois de publicado.');
  if (state.why === 'closed') return t('Comentários fechados.');
  if (state.why === 'ended') return t('A consulta pública terminou.');
  if (state.mode === 'consultation') return t('Consulta pública aberta até {data}.', { data: dataBr(state.until_date) });
  return '';
}
