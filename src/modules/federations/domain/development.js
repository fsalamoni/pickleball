/**
 * REDE E DESENVOLVIMENTO (rodada 3, Bloco 3, `docs/50` §38) — a conta PURA
 * dos embaixadores regionais (módulo `ambassadors`) e do selo de clube
 * certificado (módulo `club_seal`).
 *
 *  - Embaixador: o filiado em dia se candidata aceitando o código de conduta
 *    da federação; a equipe (filiados/admin) nomeia para uma região, depois
 *    de conferir a proteção de menores quando a federação a exige para
 *    embaixador. Ele manda um relatório a cada N meses e aparece na página
 *    pública (nome, foto e região — nunca o uid).
 *  - Selo de clube certificado: critérios da federação. Parte é conferida
 *    pelo servidor (sediou torneio chancelado nos últimos 12 meses, tem
 *    professor licenciado — só para arena, que é o que o sistema sabe), parte
 *    vem de evidência enviada por quem gere o clube ou a arena. O selo tem
 *    validade e aparece na lista pública de clubes e arenas filiados.
 *
 * O servidor tem uma CÓPIA (`functions/federationDevelopmentPolicy.js`) com
 * paridade em `federationDevelopment.parity.test.js`. Estados, ids de
 * critério e chaves automáticas são GRAVADOS: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

const str = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const inteiro = (v, min, max, d) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Soma meses a uma data ISO (o dia 31 cai no último dia do mês). */
export function addMonthsISO(iso, months) {
  if (!isIso(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + Math.trunc(Number(months) || 0), 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Caminho de arquivo enviado pela própria pessoa (`federacao/{uid}/…`). */
export const ownFilePath = (path, uid) => Boolean(uid) && new RegExp(`^federacao/${String(uid).replace(/[^A-Za-z0-9_-]/g, '')}/[A-Za-z0-9_-]+\\.[a-z]{3,4}$`).test(String(path || ''));

/* ---------------------------------------------------------- embaixadores -- */

export const AMBASSADOR_STATUS = Object.freeze({ APPLIED: 'applied', APPOINTED: 'appointed', REJECTED: 'rejected', ENDED: 'ended' });
export const AMBASSADOR_STATUS_LABELS = Object.freeze({
  applied: tk('Candidatura enviada'), appointed: tk('Embaixador nomeado'), rejected: tk('Candidatura recusada'), ended: tk('Mandato encerrado'),
});
export const AMB_REPORT_MONTHS = Object.freeze([1, 3, 6, 12]);
export const AMB_LIMITS = Object.freeze({ MOTIVATION_MAX: 1500, REGION_MAX: 80, CONDUCT_MAX: 6000, REPORT_MAX: 3000, REPORTS_MAX: 60, PUBLIC_MAX: 60 });
/** O código de conduta que vale enquanto a federação não escreve o dela. */
export const DEFAULT_CONDUCT = 'Como embaixador da federação, eu me comprometo a: representar a federação com respeito e boa-fé; tratar todas as pessoas com igualdade, sem discriminação de qualquer tipo; proteger crianças e adolescentes, nunca ficando a sós com menores e seguindo a política de proteção da federação; não usar o título para vantagem pessoal ou comercial sem autorização; divulgar só informações oficiais; enviar os relatórios no prazo; e avisar a federação de qualquer conflito de interesse.';

/** As regras do programa (o admin da federação grava em `federations.ambassador_rules`). */
export function normalizeAmbassadorRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const conduct = txt(r.conduct_text, AMB_LIMITS.CONDUCT_MAX);
  return {
    open: r.open !== false,
    conduct_text: conduct.length >= 20 ? conduct : DEFAULT_CONDUCT,
    conduct_version: inteiro(r.conduct_version, 1, 1e6, 1),
    report_months: AMB_REPORT_MONTHS.includes(Number(r.report_months)) ? Number(r.report_months) : 3,
  };
}

/** A candidatura digitada → o que pode ser gravado. */
export function validateAmbassadorApply(input = {}) {
  const errors = {};
  const motivation = txt(input.motivation, AMB_LIMITS.MOTIVATION_MAX);
  if (motivation.length < 20) errors.motivation = t('Conte em poucas linhas por que quer ser embaixador (mínimo de 20 letras).');
  const region_wish = str(input.region_wish, AMB_LIMITS.REGION_MAX);
  if (region_wish.length < 2) errors.region_wish = t('Diga a região onde quer atuar.');
  if (input.accept_conduct !== true) errors.accept_conduct = t('É preciso aceitar o código de conduta.');
  return { ok: Object.keys(errors).length === 0, errors, value: { motivation, region_wish } };
}

/** A nomeação (região e fim do mandato, opcional). */
export function validateAppointment(input = {}, hoje) {
  const errors = {};
  const region = str(input.region, AMB_LIMITS.REGION_MAX);
  if (region.length < 2) errors.region = t('Diga a região do embaixador.');
  const term_until = isIso(input.term_until) ? input.term_until : '';
  if (input.term_until && !term_until) errors.term_until = t('Data inválida.');
  else if (term_until && term_until <= hoje) errors.term_until = t('O mandato termina depois de hoje.');
  return { ok: Object.keys(errors).length === 0, errors, value: { region, term_until } };
}

export function validateReport(input = {}) {
  const text = txt(input.text, AMB_LIMITS.REPORT_MAX);
  return text.length >= 20 ? { ok: true, errors: {}, value: { text } } : { ok: false, errors: { text: t('Conte o que foi feito no período (mínimo de 20 letras).') }, value: { text } };
}

/** A situação de um embaixador hoje. */
export function ambassadorState(amb, rules, hoje) {
  if (!amb) return { status: '', appointed: false, reportDue: false, overdueDays: 0, needsReaccept: false, termEnded: false, canApply: true };
  const r = normalizeAmbassadorRules(rules);
  const status = amb.status || AMBASSADOR_STATUS.APPLIED;
  const appointed = status === AMBASSADOR_STATUS.APPOINTED;
  const termEnded = appointed && isIso(amb.term_until) && amb.term_until < hoje;
  const reportDue = appointed && !termEnded && isIso(amb.next_report_due) && amb.next_report_due <= hoje;
  return {
    status,
    appointed: appointed && !termEnded,
    reportDue,
    overdueDays: reportDue ? dias(amb.next_report_due, hoje) : 0,
    needsReaccept: appointed && Number(amb.conduct_version || 0) < r.conduct_version,
    termEnded,
    canApply: [AMBASSADOR_STATUS.REJECTED, AMBASSADOR_STATUS.ENDED].includes(status) || termEnded,
  };
}

/** A lista pública (gravada pelo servidor em `federations.ambassadors_public`): sem uid, ordenada por região e nome. */
export function ambassadorsPublic(list = [], hoje) {
  return lista(list)
    .filter((a) => a && a.status === AMBASSADOR_STATUS.APPOINTED && !(isIso(a.term_until) && a.term_until < hoje))
    .map((a) => ({ key: str(a.key, 20), name: str(a.user_name, 120), photo_url: str(a.photo_url, 500), region: str(a.region, AMB_LIMITS.REGION_MAX), since: isIso(a.appointed_at) ? a.appointed_at : '' }))
    .sort((a, b) => a.region.localeCompare(b.region, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, AMB_LIMITS.PUBLIC_MAX);
}

/* -------------------------------------------------- selo de clube certificado -- */

export const SEAL_STATUS = Object.freeze({ APPLIED: 'applied', GRANTED: 'granted', REJECTED: 'rejected', REVOKED: 'revoked' });
export const SEAL_STATUS_LABELS = Object.freeze({
  applied: tk('Pedido em análise'), granted: tk('Selo concedido'), rejected: tk('Pedido recusado'), revoked: tk('Selo cassado'),
});
/** O que o servidor confere sozinho (só para arena: é o que a plataforma sabe dela). */
export const SEAL_AUTO = Object.freeze({ HOSTED_EVENT: 'hosted_event', LICENSED_COACH: 'licensed_coach' });
export const SEAL_AUTO_LABELS = Object.freeze({
  hosted_event: tk('Conferido pela plataforma: sediou torneio chancelado nos últimos 12 meses'),
  licensed_coach: tk('Conferido pela plataforma: tem professor com licença da federação em dia'),
});
export const SEAL_LIMITS = Object.freeze({ CRITERIA_MAX: 12, LABEL_MAX: 120, DESCRIPTION_MAX: 300, EVIDENCE_MAX: 1000, NAME_MAX: 40, MONTHS_MIN: 6, MONTHS_MAX: 36, NOTE_MAX: 500, RENEW_DAYS: 60, WARN_DAYS: 30 });
export const DEFAULT_SEAL_NAME = 'Clube certificado';
export const DEFAULT_SEAL_CRITERIA = Object.freeze([
  { id: 'safeguarding', label: 'Proteção de menores: política escrita e responsável nomeado', description: 'Envie a política e diga quem é o responsável.', auto: '', required: true },
  { id: 'coach', label: 'Professor licenciado pela federação', description: 'Diga quem é o professor e o número da licença.', auto: 'licensed_coach', required: true },
  { id: 'insurance', label: 'Seguro para os participantes das atividades', description: 'Envie a apólice ou o comprovante.', auto: '', required: true },
  { id: 'courts', label: 'Quadras nas medidas oficiais, com rede e marcação', description: 'Fotos ou laudo das quadras.', auto: '', required: true },
  { id: 'event', label: 'Torneio chancelado nos últimos 12 meses', description: 'Diga qual torneio e quando.', auto: 'hosted_event', required: false },
]);

const idCriterio = (v, i) => str(v, 24).toLowerCase().replace(/[^a-z0-9_-]/g, '') || `c${i + 1}`;

/** As regras do selo (o admin da federação grava em `federations.club_seal`). Sem critérios = os padrão. */
export function normalizeSealRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const vistos = new Set();
  const criteria = (Array.isArray(r.criteria) && r.criteria.length ? r.criteria : DEFAULT_SEAL_CRITERIA)
    .slice(0, SEAL_LIMITS.CRITERIA_MAX)
    .map((c, i) => {
      let id = idCriterio(c?.id, i);
      if (vistos.has(id)) id = `${id}${i + 1}`;
      vistos.add(id);
      return {
        id,
        label: str(c?.label, SEAL_LIMITS.LABEL_MAX),
        description: str(c?.description, SEAL_LIMITS.DESCRIPTION_MAX),
        auto: Object.values(SEAL_AUTO).includes(c?.auto) ? c.auto : '',
        required: c?.required !== false,
      };
    })
    .filter((c) => c.label.length >= 3);
  return {
    open: r.open !== false,
    name: str(r.name, SEAL_LIMITS.NAME_MAX) || DEFAULT_SEAL_NAME,
    validity_months: inteiro(r.validity_months, SEAL_LIMITS.MONTHS_MIN, SEAL_LIMITS.MONTHS_MAX, 12),
    criteria,
  };
}

/** A automática vale para este tipo de organização? (clube: a plataforma não sabe, quem decide é a equipe) */
export const autoApplies = (criterion, kind) => Boolean(criterion?.auto) && kind === 'arena';

/**
 * A evidência enviada → o que pode ser gravado. Critério conferido pela
 * plataforma não pede evidência; os obrigatórios pedem texto ou arquivo.
 */
export function validateSealApply(rules, kind, input = {}, uid = '') {
  const r = normalizeSealRules(rules);
  const errors = {};
  const evidence = {};
  const raw = input && typeof input.evidence === 'object' && input.evidence ? input.evidence : {};
  r.criteria.forEach((c) => {
    const e = raw[c.id] || {};
    const text = txt(e.text, SEAL_LIMITS.EVIDENCE_MAX);
    const file = e.file && ownFilePath(e.file.path, uid) ? { path: String(e.file.path), name: str(e.file.name, 120) } : null;
    if (e.file && !file) errors[c.id] = t('Envie o arquivo de novo.');
    if (text || file) evidence[c.id] = { text, file };
    else if (c.required && !autoApplies(c, kind)) errors[c.id] = t('Mande uma explicação ou um arquivo.');
  });
  return { ok: Object.keys(errors).length === 0, errors, value: { evidence } };
}

/** A situação do selo hoje: a validade concedida vale até o fim, mesmo com a renovação em análise. */
export function sealState(seal, hoje) {
  if (!seal) return { status: '', valid: false, expiring: false, validUntil: '', canApply: true, applied: false };
  const status = seal.status || SEAL_STATUS.APPLIED;
  const validUntil = isIso(seal.granted_until) ? seal.granted_until : '';
  const valid = status !== SEAL_STATUS.REVOKED && Boolean(validUntil) && validUntil >= hoje;
  const restam = valid ? dias(hoje, validUntil) : 0;
  const applied = status === SEAL_STATUS.APPLIED;
  return {
    status,
    valid,
    expiring: valid && restam <= SEAL_LIMITS.WARN_DAYS,
    validUntil,
    applied,
    canApply: !applied && (!valid || restam <= SEAL_LIMITS.RENEW_DAYS),
  };
}

/**
 * A decisão da equipe: cada critério OBRIGATÓRIO atendido. O automático vem
 * da plataforma (`auto[c.auto]`); quando ela não sabe (clube) ou não confere,
 * vale a marcação da equipe.
 * @returns {{ ok: boolean, missing: string[], checks: Record<string, boolean> }}
 */
export function sealDecision(rules, kind, auto = {}, marcados = {}) {
  const r = normalizeSealRules(rules);
  const checks = {};
  r.criteria.forEach((c) => {
    const daPlataforma = autoApplies(c, kind) && auto[c.auto] === true;
    checks[c.id] = daPlataforma || marcados[c.id] === true;
  });
  const missing = r.criteria.filter((c) => c.required && !checks[c.id]).map((c) => c.id);
  return { ok: missing.length === 0, missing, checks };
}

/** O selo público gravado na filiação (`federation_affiliations.seal`) vale hoje? */
export const affiliationSealValid = (aff, hoje) => Boolean(aff?.seal && isIso(aff.seal.valid_until) && aff.seal.valid_until >= hoje);

/**
 * As regras do programa de embaixadores que o admin salva. Mudar o TEXTO do
 * código sobe a versão: quem já é embaixador aceita de novo.
 */
export function ambassadorRulesToSave(input, atual) {
  const antes = normalizeAmbassadorRules(atual);
  const novo = normalizeAmbassadorRules({ ...input, conduct_version: antes.conduct_version });
  const mudou = novo.conduct_text !== antes.conduct_text;
  return { ...novo, conduct_text: novo.conduct_text === DEFAULT_CONDUCT ? '' : novo.conduct_text, conduct_version: antes.conduct_version + (mudou ? 1 : 0) };
}

/** As regras do selo que o admin salva: todo critério com nome e ao menos um obrigatório. */
export function validateSealRules(input) {
  const value = normalizeSealRules(input);
  const errors = {};
  if (Array.isArray(input?.criteria) && input.criteria.some((c) => str(c?.label, SEAL_LIMITS.LABEL_MAX).length < 3)) errors.criteria = t('Todo critério precisa de um nome (mínimo de 3 letras).');
  else if (!value.criteria.some((c) => c.required)) errors.criteria = t('Marque ao menos um critério como obrigatório.');
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Quem cuida do desenvolvimento: a secretaria (filiados) e a administração. */
export const canManageDevelopment = (perms = []) => perms.includes('admin') || perms.includes('members');
