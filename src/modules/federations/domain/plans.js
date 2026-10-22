/**
 * Planos de filiação: o que a federação cobra, de quem, por quanto tempo —
 * e o preço de uma pessoa (descontos explicados). Lógica pura.
 */
import { t } from '@/core/i18n';
import { DOC_KIND, PLAN_BILLING, PLAN_PERSON_TYPE, PLAN_TIER, PLAN_VALIDITY } from './constants.js';
import { normalizeOtherDocs } from './privateData.js';
import { MEMBER_TYPE_ID_RE, isOrgEntity, memberTypeCatalog, memberTypeOf, planTypeFields } from './memberTypes.js';

const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const intOr = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.trunc(Number(v)) : d);
const pct = (v) => Math.min(100, Math.max(0, intOr(v, 0)));

/**
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
/** 'MM-DD' de um dia que existe (num ano bissexto: 02-29 vale, 02-30 não). */
export function isValidMonthDay(mmdd) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(mmdd || ''));
  if (!m) return false;
  const d = new Date(2024, Number(m[1]) - 1, Number(m[2]));
  return d.getMonth() === Number(m[1]) - 1 && d.getDate() === Number(m[2]);
}

/**
 * `catalog` é o catálogo de tipos da plataforma (`memberTypeCatalog`): o plano
 * grava o tipo resolvido (entidade, grupo e nome) para valer mesmo se o tipo
 * sair do catálogo depois. Plano de CLUBE ou ARENA não tem faixa de idade nem
 * desconto de pessoa, e só pede documentos com nome (estatuto, CNPJ, ata…).
 */
export function validatePlanInput(input = {}, { catalog = memberTypeCatalog(), currentType = null } = {}) {
  const errors = {};
  const name = str(input.name, 80);
  if (name.length < 3) errors.name = t('Dê um nome ao plano (mínimo 3 caracteres).');
  const tipo = planTypeFields(catalog, MEMBER_TYPE_ID_RE.test(String(input.person_type || '')) ? input.person_type : PLAN_PERSON_TYPE.ATHLETE);
  const entidade = isOrgEntity(tipo.entity);
  // Tipo desligado pelo admin: o plano que já é dele segue editável; plano novo não nasce nele.
  if (memberTypeOf(catalog, tipo.person_type).active === false && tipo.person_type !== currentType) errors.person_type = t('Este tipo de filiação não está disponível para planos novos.');
  const tier = Object.values(PLAN_TIER).includes(input.tier) ? input.tier : PLAN_TIER.FEDERATED;
  const billing = Object.values(PLAN_BILLING).includes(input.billing) ? input.billing : PLAN_BILLING.ANNUAL;
  const validity = Object.values(PLAN_VALIDITY).includes(input.validity) ? input.validity : PLAN_VALIDITY.ROLLING;
  const price_cents = intOr(input.price_cents, -1);
  if (price_cents < 0 || price_cents > 1_000_000_00) errors.price_cents = t('Informe o valor (0 para plano gratuito).');
  const rollover = str(input.rollover_mmdd, 5);
  if (billing === PLAN_BILLING.ANNUAL && validity === PLAN_VALIDITY.CALENDAR && !isValidMonthDay(rollover)) {
    errors.rollover_mmdd = t('Informe a data de virada no formato MM-DD (ex.: 12-31).');
  }
  const age_min = entidade ? null : intOr(input.age_min, null);
  const age_max = entidade ? null : intOr(input.age_max, null);
  if (age_min != null && age_max != null && age_min > age_max) errors.age_max = t('Idade máxima menor que a mínima.');
  const discounts = entidade ? { minor_pct: 0, senior_pct: 0, family_pct: 0, family_from: 2 } : {
    minor_pct: pct(input.discounts?.minor_pct), senior_pct: pct(input.discounts?.senior_pct),
    family_pct: pct(input.discounts?.family_pct), family_from: Math.max(2, intOr(input.discounts?.family_from, 2)),
  };
  // "Outro documento" sempre com nome: é o que a pessoa lê na hora de enviar.
  const other_docs = normalizeOtherDocs(input.other_docs);
  let requires_docs = [...new Set((Array.isArray(input.requires_docs) ? input.requires_docs : []).filter((k) => Object.values(DOC_KIND).includes(k) && (!entidade || k === DOC_KIND.OTHER)))];
  if (other_docs.length && !requires_docs.includes(DOC_KIND.OTHER)) requires_docs = [...requires_docs, DOC_KIND.OTHER];
  if (!other_docs.length && requires_docs.includes(DOC_KIND.OTHER)) errors.other_docs = entidade ? t('Diga qual é o documento (ex.: estatuto social).') : t('Diga qual é o outro documento (ex.: exame de vista).');
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      name, description: str(input.description, 600), benefits: str(input.benefits, 1200),
      ...tipo, tier, billing, validity, rollover_mmdd: billing === PLAN_BILLING.ANNUAL && validity === PLAN_VALIDITY.CALENDAR ? rollover : '',
      calendar_grace_days: Math.min(180, Math.max(0, intOr(input.calendar_grace_days, 60))),
      price_cents: Math.max(0, price_cents), age_min, age_max, discounts,
      auto_approve: input.auto_approve === true, active: input.active !== false,
      sort: intOr(input.sort, 0),
      // PR 3: documentos que a pessoa precisa enviar (a secretaria confere antes de aprovar).
      requires_docs,
      other_docs,
    },
  };
}

export const isFreePlan = (plan) => !plan || Number(plan.price_cents) <= 0;

/**
 * O preço de UMA pessoa neste plano, com cada desconto dito.
 * @param {object} plan
 * @param {{ age?: number|null, familyIndex?: number }} pessoa `familyIndex` = posição na família (1 = primeiro)
 * @returns {{ base: number, total: number, discounts: Array<{ id: string, pct: number, label: string }> }}
 */
export function planPrice(plan, { age = null, familyIndex = 1 } = {}) {
  const base = Math.max(0, Math.trunc(Number(plan?.price_cents) || 0));
  const d = plan?.discounts || {};
  const discounts = [];
  if (age != null && age < 18 && d.minor_pct > 0) discounts.push({ id: 'minor', pct: d.minor_pct, label: t('Desconto de menor de 18 anos') });
  else if (age != null && age >= 60 && d.senior_pct > 0) discounts.push({ id: 'senior', pct: d.senior_pct, label: t('Desconto a partir de 60 anos') });
  if (d.family_pct > 0 && familyIndex >= (d.family_from || 2)) discounts.push({ id: 'family', pct: d.family_pct, label: t('Desconto família') });
  // Os descontos não se somam: vale o maior (somar dois de 50% daria grátis).
  const maior = discounts.reduce((m, x) => Math.max(m, x.pct), 0);
  const total = Math.round(base * (100 - maior) / 100);
  return { base, total, discounts: maior ? discounts.filter((x) => x.pct === maior).slice(0, 1) : [] };
}

/** O plano aceita esta idade? Sem limites, aceita todo mundo; idade desconhecida não barra. */
export function planAcceptsAge(plan, age) {
  if (age == null) return true;
  if (plan?.age_min != null && age < plan.age_min) return false;
  if (plan?.age_max != null && age > plan.age_max) return false;
  return true;
}

/** Os planos que a pessoa pode escolher: ativos, do tipo dela, da idade dela. */
export function plansFor(plans = [], { personType = PLAN_PERSON_TYPE.ATHLETE, age = null } = {}) {
  return plans
    .filter((p) => p?.active !== false && (p.person_type || PLAN_PERSON_TYPE.ATHLETE) === personType && planAcceptsAge(p, age))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.price_cents ?? 0) - (b.price_cents ?? 0));
}

/** Frase curta da periodicidade: "R$ 120,00 por ano", "Gratuito". */
export function planPeriodLabel(plan) {
  if (isFreePlan(plan)) return t('Gratuito');
  return plan.billing === PLAN_BILLING.MONTHLY ? t('por mês') : t('por ano');
}

/**
 * Os benefícios do plano, um por linha, para a tela. O campo é TEXTO (um
 * por linha, como o editor grava); uma lista gravada por importação ou à mão
 * também vale — `.split` num vetor derrubava a página pública inteira.
 */
export function planBenefitLines(plan) {
  const b = plan?.benefits;
  const linhas = Array.isArray(b) ? b : String(b || '').split('\n');
  return linhas.map((x) => String(x || '').trim()).filter(Boolean);
}
