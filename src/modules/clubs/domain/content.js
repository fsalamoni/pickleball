/**
 * VANTAGENS, COMUNICADOS E PATROCINADORES do clube-associação (Bloco C) — lógica pura.
 *
 * Três espécies sob `club_x/{clube}/…`, gravadas pelo navegador da equipe de
 * comunicação (permissão `comms`; a regra confere o acesso):
 *  - `benefits`: a vantagem exclusiva do associado (parceiro, desconto,
 *    prioridade…). O documento é a VITRINE (título, resumo, validade, quais
 *    planos) e pode ir à página pública (`public: true`). O que só o associado
 *    pode ver — "como usar" e o código — mora em `bsec/{mesmo id}` e só chega
 *    por `clubContent` (servidor), para quem tem filiação em dia;
 *  - `news`: o comunicado (mesma validação das notícias da federação);
 *    publicado e público sai na página, "só associados" para quem é membro do
 *    clube. O AVISO é do servidor, uma vez só (`notified_at`);
 *  - `sponsors`: um documento por patrocinador (até {@link SPONSORS_MAX}).
 * Desligar a associação não apaga nada: a lista gravada fica.
 */
import { t, tk } from '@/core/i18n';
import { NEWS_AUDIENCE, NEWS_STATUS, SPONSOR_TIER } from '@/modules/federations/domain/constants.js';
import { validateNewsInput, sortNews, canNotifyNews } from '@/modules/federations/domain/news.js';
import { SPONSORS_MAX, sortSponsors, validateSponsors } from '@/modules/federations/domain/sponsors.js';
import { isoDate } from '@/modules/federations/domain/membership.js';

export { NEWS_AUDIENCE, NEWS_STATUS, SPONSOR_TIER, SPONSORS_MAX, sortNews, canNotifyNews, sortSponsors };

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const isHttps = (u) => /^https:\/\/\S+$/i.test(u);

/* ---------------------------------------------------------------- vantagens -- */

/** Tipos de vantagem — o id é gravado: nunca renomeie. */
export const BENEFIT_KIND = Object.freeze({
  DISCOUNT: 'discount', PARTNER: 'partner', EVENT: 'event', PRIORITY: 'priority', GIFT: 'gift', OTHER: 'other',
});

export const BENEFIT_KIND_LABELS = Object.freeze({
  discount: tk('Desconto'),
  partner: tk('Parceiro'),
  event: tk('Eventos'),
  priority: tk('Prioridade'),
  gift: tk('Brinde'),
  other: tk('Outra vantagem'),
});

export const BENEFIT_LIMITS = Object.freeze({ titleMax: 80, summaryMax: 300, partnerMax: 80, howToMax: 800, codeMax: 40, plansMax: 20 });

/** Vantagem de partida para o formulário de "nova vantagem". */
export const EMPTY_BENEFIT = Object.freeze({
  title: '', summary: '', kind: BENEFIT_KIND.OTHER, partner: '', valid_until: '', plan_ids: [], public: false, active: true, how_to: '', code: '', sort: 0,
});

/**
 * Valida o formulário da vantagem e separa as duas metades: `value` é a
 * vitrine (documento `benefits`), `secret` o que é só do associado (`bsec`).
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object, secret: object }}
 */
export function validateBenefit(input = {}) {
  const errors = {};
  const title = str(input.title, BENEFIT_LIMITS.titleMax);
  if (title.length < 3) errors.title = t('Dê um título à vantagem (mínimo 3 letras).');
  const valid = str(input.valid_until, 10);
  if (valid && !/^\d{4}-\d{2}-\d{2}$/.test(valid)) errors.valid_until = t('Data inválida.');
  const planIds = Array.isArray(input.plan_ids) ? [...new Set(input.plan_ids.map((x) => str(x, 80)).filter(Boolean))].slice(0, BENEFIT_LIMITS.plansMax) : [];
  const how_to = str(input.how_to, BENEFIT_LIMITS.howToMax);
  const code = str(input.code, BENEFIT_LIMITS.codeMax);
  const kind = Object.values(BENEFIT_KIND).includes(input.kind) ? input.kind : BENEFIT_KIND.OTHER;
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      title, summary: str(input.summary, BENEFIT_LIMITS.summaryMax), kind, partner: str(input.partner, BENEFIT_LIMITS.partnerMax),
      valid_until: valid, plan_ids: planIds, public: input.public === true, active: input.active !== false,
      has_secret: Boolean(how_to || code), sort: Math.trunc(Number(input.sort) || 0),
    },
    secret: { how_to, code },
  };
}

/** "no ar", "vencida" (passou da validade) ou "pausada" — hoje é 'YYYY-MM-DD'. */
export function benefitState(b, hoje = isoDate()) {
  if (b?.active === false) return 'paused';
  if (b?.valid_until && b.valid_until < hoje) return 'expired';
  return 'live';
}

/** A vantagem vale para quem tem este plano? Sem planos escolhidos vale para todos. */
export function benefitFitsPlan(b, planId) {
  const ids = Array.isArray(b?.plan_ids) ? b.plan_ids : [];
  return ids.length === 0 || ids.includes(planId);
}

/** O que a vitrine mostra: no ar, ordenada. `planId` opcional filtra pelo plano da pessoa. */
export function liveBenefits(list = [], { hoje = isoDate(), planId = undefined } = {}) {
  return [...(list || [])]
    .filter((b) => benefitState(b, hoje) === 'live' && (planId === undefined || benefitFitsPlan(b, planId)))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'));
}

/** "Até 31/12/2026 · Planos: Efetivo, Atleta" — a linha de apoio da vantagem. */
export function benefitMetaLine(b, planNames = {}) {
  const partes = [];
  if (b?.partner) partes.push(b.partner);
  if (b?.valid_until) partes.push(t('até {data}', { data: `${b.valid_until.slice(8, 10)}/${b.valid_until.slice(5, 7)}/${b.valid_until.slice(0, 4)}` }));
  const ids = Array.isArray(b?.plan_ids) ? b.plan_ids : [];
  if (ids.length) partes.push(t('Planos: {nomes}', { nomes: ids.map((id) => planNames[id] || '—').join(', ') }));
  return partes.join(' · ');
}

/* ---------------------------------------------------------------- comunicados -- */

/**
 * Valida o comunicado (as mesmas regras das notícias da federação). O clube
 * não agenda: só rascunho, publicado ou arquivado. `public` é DERIVADO
 * (publicado + público) — é o campo que a regra de leitura pública confere.
 */
export function validateClubNews(input = {}) {
  const status = [NEWS_STATUS.DRAFT, NEWS_STATUS.PUBLISHED, NEWS_STATUS.ARCHIVED].includes(input.status) ? input.status : NEWS_STATUS.DRAFT;
  const r = validateNewsInput({ ...input, status });
  const value = { ...r.value, status, public: status === NEWS_STATUS.PUBLISHED && r.value.audience === NEWS_AUDIENCE.PUBLIC };
  delete value.publish_at_ms; delete value.notify_on_publish;
  return { ok: r.ok, errors: r.errors, value };
}

/**
 * O que a pessoa vê: os publicados públicos e, sendo MEMBRO do clube, os "só
 * associados". `member` = faz parte do clube.
 */
export function visibleClubNews(list = [], { member = false } = {}) {
  return sortNews((list || []).filter((n) => n?.status === NEWS_STATUS.PUBLISHED && (n.audience === NEWS_AUDIENCE.PUBLIC || (member && n.audience === NEWS_AUDIENCE.MEMBERS))));
}

/* ------------------------------------------------------------- patrocinadores -- */

export const EMPTY_SPONSOR = Object.freeze({ name: '', logo_url: '', url: '', tier: SPONSOR_TIER.SUPPORT, public: true, active: true, sort: 0 });

/** Valida UM patrocinador (mesmas regras do nome, logo e site da federação). */
export function validateSponsor(input = {}) {
  const r = validateSponsors([input]);
  const errors = {};
  Object.entries(r.errors).forEach(([k, v]) => { errors[k.replace(/^0\./, '')] = v; });
  const logo = str(input.logo_url, 500);
  if (logo && !isHttps(logo)) errors.logo_url = t('O logo precisa de um endereço https://');
  return { ok: Object.keys(errors).length === 0, errors, value: { ...(r.value[0] || {}), public: input.public !== false, active: input.active !== false, sort: Math.trunc(Number(input.sort) || 0) } };
}

/** Os patrocinadores que SAEM na página: ativos e públicos, por faixa. */
export function visibleClubSponsors(list = []) {
  return sortSponsors((list || []).filter((s) => s && s.name && s.active !== false && s.public !== false));
}
