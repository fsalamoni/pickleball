/**
 * ASSOCIAÇÃO DO CLUBE (flag `club_association`) — lógica pura.
 *
 * O clube vira uma associação quando a administração liga `clubs.association`
 * (`enabled`) e a abre ao público (`published`). Os dados moram em
 * `club_x/{clube}/{espécie}/{id}` (planos, filiações, cobranças, cargos,
 * configuração); só o servidor grava filiação e cobrança. A validade, o
 * estado e o código da carteirinha usam a conta da federação
 * (`federations/domain/membership.js`), com a cópia do servidor em
 * `functions/clubAssociation.js`.
 */
import { t, tk, fmtData } from '@/core/i18n';
import { buildPixPayload, formatBrlCents } from '@/modules/tournament/domain/payment.js';
import { readableInk, BRAND_DEFAULT_COLOR, normalizeHex } from '@/modules/arenas/domain/whiteLabel.js';
import { CHARGE_STATUS, MEMBER_STATUS, MEMBER_STATUS_LABELS } from '@/modules/federations/domain/constants.js';
import { membershipState, isoDate } from '@/modules/federations/domain/membership.js';

import { canDeclarePayment, financeSummary, isChargeOverdue, parseBrlCents, sortChargesForStaff } from '@/modules/federations/domain/charges.js';

export { formatBrlCents, MEMBER_STATUS, MEMBER_STATUS_LABELS, CHARGE_STATUS, membershipState, isoDate, canDeclarePayment, financeSummary, isChargeOverdue, parseBrlCents, sortChargesForStaff };

/** "12/03/2027" a partir de 'YYYY-MM-DD'; "—" sem data. */
export function dataCurta(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '—';
  return fmtData(new Date(`${iso}T12:00:00`), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const CLUB_X = 'club_x';
export const CLUB_CARD_INDEX = 'club_card_index';

/** As espécies de documento sob `club_x/{clube}/…` — o nome é gravado, nunca renomeie. */
export const CLUB_X_KIND = Object.freeze({
  plans: 'plans', aff: 'aff', charges: 'charges', staff: 'staff', cfg: 'cfg', roles: 'roles', imports: 'imports',
  benefits: 'benefits', bsec: 'bsec', news: 'news', sponsors: 'sponsors',
  budgets: 'budgets', ledger: 'ledger', reports: 'reports', docs: 'docs', events: 'events',
  cases: 'cases', ombud: 'ombud', assets: 'assets', safeguard: 'safeguard', minors: 'minors', callups: 'callups', callup_members: 'callup_members',
});

/** Permissões de quem trabalha no clube (o administrador do clube tem todas). Gravadas em `staff/{uid}.perms`. */
export const CLUB_PERM = Object.freeze({
  ADMIN: 'admin', MEMBERS: 'members', FINANCE: 'finance', COMMS: 'comms', DOCS: 'docs', SPORTS: 'sports', DISCIPLINE: 'discipline', FISCAL: 'fiscal', STAFF: 'staff',
});

export const CLUB_PERM_LABELS = Object.freeze({
  admin: tk('Tudo'),
  members: tk('Associados e secretaria'),
  finance: tk('Financeiro'),
  comms: tk('Comunicação'),
  docs: tk('Documentos e atas'),
  sports: tk('Esporte e competições'),
  discipline: tk('Disciplina'),
  fiscal: tk('Conselho fiscal'),
  staff: tk('Diretoria e cargos'),
});

/** Todas as permissões do clube. */
export const ALL_CLUB_PERMS = Object.freeze(Object.values(CLUB_PERM));

/**
 * O que a pessoa pode fazer na gestão do clube: o administrador do clube tem
 * tudo; quem tem cargo (`staff/{uid}`) tem as permissões gravadas, enquanto o
 * mandato vale (`term_end_ms` 0 = sem prazo). Mesma conta do servidor e da regra.
 */
export function clubPermsOf({ isClubAdmin = false, staff = null, now = Date.now() } = {}) {
  if (isClubAdmin) return [...ALL_CLUB_PERMS];
  if (!staff) return [];
  const fim = Number(staff.term_end_ms) || 0;
  if (fim !== 0 && fim <= now) return [];
  if (staff.is_master === true) return [...ALL_CLUB_PERMS]; // o cargo de presidência vale "tudo", inclusive o criado depois
  return (Array.isArray(staff.perms) ? staff.perms : []).filter((p) => ALL_CLUB_PERMS.includes(p));
}

/**
 * Os clubes em que a pessoa opera a LOJA no Mercado (`club_{id}`): associação
 * publicada e administração do clube ou cargo com `admin`/`finance` — a mesma
 * conta de `isMarketOperator` na regra e de `operatorUids` no servidor.
 * `clubs` = meus clubes (com `my_role`); `staffByClub` = cargo de cada um (`club → staff`).
 */
export function storeClubs(clubs = [], staffByClub = {}, now = Date.now()) {
  return clubs.filter((c) => {
    if (!c || !isAssociationOpen(c)) return false;
    const perms = clubPermsOf({ isClubAdmin: c.my_role === 'admin', staff: staffByClub[c.id] || null, now });
    return perms.includes(CLUB_PERM.ADMIN) || perms.includes(CLUB_PERM.FINANCE);
  });
}

export const PLAN_BILLING =Object.freeze({ MONTHLY: 'monthly', ANNUAL: 'annual' });

/** Limites do plano — os mesmos da regra (`firestore.rules`) e do servidor. */
export const PLAN_LIMITS = Object.freeze({ nameMax: 80, priceMaxCents: 100_000_000, benefitsMax: 10, benefitMax: 120, descriptionMax: 400, categoryMax: 40 });

const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const pct = (v) => Math.min(100, Math.max(0, Math.trunc(Number(v) || 0)));

/* ------------------------------------------------------- o estado do clube -- */

/** O clube ligou a associação? */
export const isAssociationEnabled = (club) => club?.association?.enabled === true;

/** Está aberta ao público (recebe pedidos e mostra os planos)? `published` ausente = oculta. */
export const isAssociationOpen = (club) => isAssociationEnabled(club) && club?.association?.published === true;

/** O que o clube escolheu para a associação, com os padrões. */
export function normalizeAssociation(club) {
  const a = club?.association || {};
  return {
    enabled: a.enabled === true,
    published: a.published === true,
    intro: str(a.intro, 600),
    color: normalizeHex(a.color) || '',
  };
}

/* ------------------------------------------------------------------ planos -- */

export const isFreePlan = (plan) => !plan || Number(plan.price_cents) <= 0;

/** Os benefícios do plano, um por linha (lista ou texto). */
export function benefitLines(plan) {
  const b = plan?.benefits;
  const linhas = Array.isArray(b) ? b : String(b || '').split('\n');
  return linhas.map((x) => String(x || '').trim()).filter(Boolean);
}

/** "por mês" / "por ano". */
export const planPeriodLabelOf = (plan) => (plan?.billing === PLAN_BILLING.MONTHLY ? t('por mês') : t('por ano'));

/** "R$ 120,00 por ano", "Gratuito". */
export function planPriceLabel(plan) {
  if (isFreePlan(plan)) return t('Gratuito');
  return `${formatBrlCents(plan.price_cents)} ${planPeriodLabelOf(plan)}`;
}

/** O plano aceita esta idade? Sem limites aceita todos; idade desconhecida não barra. */
export function planAcceptsAge(plan, age) {
  if (age == null) return true;
  if (plan?.age_min != null && age < plan.age_min) return false;
  if (plan?.age_max != null && age > plan.age_max) return false;
  return true;
}

/** Cópia de `planPrice` do servidor (`federationMembership.js`): o MAIOR desconto, um só. Parity em `association.parity.test.js`. */
export function planPriceFor(plan, { age = null } = {}) {
  const base = Math.max(0, Math.trunc(Number(plan?.price_cents) || 0));
  const d = plan?.discounts || {};
  const pcts = [];
  if (age != null && age < 18 && d.minor_pct > 0) pcts.push(d.minor_pct);
  else if (age != null && age >= 60 && d.senior_pct > 0) pcts.push(d.senior_pct);
  const maior = pcts.reduce((m, x) => Math.max(m, x), 0);
  return { base, total: Math.max(0, Math.round((base * (100 - maior)) / 100)), pct: maior };
}

/** Os planos que a vitrine mostra: públicos, ativos e da idade da pessoa; mais barato primeiro. */
export function publicPlans(plans = [], { age = null } = {}) {
  return plans
    .filter((p) => p?.active !== false && p?.public !== false && planAcceptsAge(p, age))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.price_cents ?? 0) - (b.price_cents ?? 0));
}

/**
 * Valida o formulário do plano. Devolve o valor limpo para gravar.
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validatePlan(input = {}) {
  const errors = {};
  const name = str(input.name, PLAN_LIMITS.nameMax);
  if (name.length < 2) errors.name = t('Dê um nome ao plano (ao menos 2 letras).');
  const price = Number(input.price_cents);
  if (!Number.isInteger(price) || price < 0) errors.price_cents = t('Informe o valor em reais (0 para gratuito).');
  else if (price > PLAN_LIMITS.priceMaxCents) errors.price_cents = t('O valor passou do limite.');
  const billing = input.billing === PLAN_BILLING.MONTHLY ? PLAN_BILLING.MONTHLY : PLAN_BILLING.ANNUAL;
  const ageMin = input.age_min === '' || input.age_min == null ? null : Math.trunc(Number(input.age_min));
  const ageMax = input.age_max === '' || input.age_max == null ? null : Math.trunc(Number(input.age_max));
  if ((ageMin != null && (!Number.isFinite(ageMin) || ageMin < 0 || ageMin > 120)) || (ageMax != null && (!Number.isFinite(ageMax) || ageMax < 0 || ageMax > 120))) errors.age = t('Idade inválida.');
  else if (ageMin != null && ageMax != null && ageMin > ageMax) errors.age = t('A idade mínima não pode passar da máxima.');
  const lines = benefitLines({ benefits: input.benefits }).slice(0, PLAN_LIMITS.benefitsMax).map((l) => l.slice(0, PLAN_LIMITS.benefitMax));
  const value = {
    name,
    description: str(input.description, PLAN_LIMITS.descriptionMax),
    category: str(input.category, PLAN_LIMITS.categoryMax),
    price_cents: Number.isInteger(price) ? price : 0,
    billing,
    benefits: lines,
    public: input.public !== false,
    active: input.active !== false,
    auto_approve: input.auto_approve === true,
    votes: input.votes === true,
    age_min: ageMin,
    age_max: ageMax,
    discounts: { minor_pct: pct(input.discounts?.minor_pct), senior_pct: pct(input.discounts?.senior_pct) },
    sort: Math.trunc(Number(input.sort) || 0),
  };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Plano de partida para o formulário de "novo plano". */
export const EMPTY_PLAN = Object.freeze({
  name: '', description: '', category: '', price_cents: 0, billing: PLAN_BILLING.ANNUAL, benefits: [], public: true, active: true, auto_approve: false, votes: false, age_min: null, age_max: null, discounts: { minor_pct: 0, senior_pct: 0 }, sort: 0,
});

/* --------------------------------------------------------------------- Pix -- */

/** Valida a chave Pix e o recebedor do clube. */
export function validatePix(input = {}) {
  const errors = {};
  const pix_key = str(input.pix_key, 140);
  if (!pix_key) errors.pix_key = t('Informe a chave Pix do clube.');
  const receiver_name = str(input.receiver_name, 60);
  if (!receiver_name) errors.receiver_name = t('Informe o nome de quem recebe.');
  return { ok: Object.keys(errors).length === 0, errors, value: { pix_key, key_type: str(input.key_type, 20), receiver_name, instructions: str(input.instructions, 500) } };
}

/** Identificador do Pix (≤ 25 alfanuméricos): o id da cobrança, limpo. */
const txid = (id) => String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

/** O Pix "copia e cola" de uma cobrança do clube (a chave vem COPIADA na cobrança). `null` sem chave. */
export function clubChargePixPayload(charge) {
  const p = charge?.payment || {};
  if (!p.pix_key) return null;
  return buildPixPayload({
    key: p.pix_key,
    merchantName: p.receiver_name || charge.club_name || 'CLUBE',
    merchantCity: p.city || 'BRASIL',
    amountCents: charge.amount_cents,
    txid: txid(charge.id),
  });
}

/* --------------------------------------------------- a filiação de alguém -- */

/** Filiações "vivas": ocupam o lugar da pessoa no clube. */
export const LIVE_AFF = Object.freeze(['pending', 'awaiting_payment', 'active', 'expired', 'suspended']);

/**
 * O que a pessoa vê da própria filiação: estado de hoje, cobrança que espera
 * pagamento e o que pode fazer. `charges` são as dela.
 */
export function myAssociationView(aff, charges = [], hoje = isoDate()) {
  if (!aff) return { kind: 'none', canRequest: true, openCharge: null, canRenew: false, hasCard: false };
  const st = membershipState(aff, hoje);
  const openCharge = [...charges].filter((c) => [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status))
    .sort((a, b) => (Number(b.created_at_ms) || 0) - (Number(a.created_at_ms) || 0))[0] || null;
  const live = LIVE_AFF.includes(st.status) || LIVE_AFF.includes(aff.status);
  return {
    kind: st.status || aff.status,
    state: st,
    canRequest: !live,
    openCharge,
    canRenew: st.canRenew && !openCharge,
    hasCard: Boolean(aff.card_code) && [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED, MEMBER_STATUS.SUSPENDED].includes(st.status),
  };
}

/* --------------------------------------------------------- a carteirinha -- */

/** O caminho público de verificação de um código do clube. */
export const clubVerifyPath = (code) => `/c/verificar/${encodeURIComponent(String(code || ''))}`;

const FAIXA = Object.freeze({
  active: { tone: 'green', label: tk('Em dia') },
  expiring: { tone: 'amber', label: tk('Vence em breve') },
  expired: { tone: 'amber', label: tk('Vencida') },
  suspended: { tone: 'red', label: tk('Suspensa') },
  other: { tone: 'gray', label: tk('Sem validade') },
});

/**
 * O modelo da carteirinha do associado: tudo o que está escrito nela sai
 * daqui. Mesmo formato do `buildMemberCard` da federação (a arte é a mesma).
 */
export function buildClubCard({ aff, club, plan = null, origin = '', hoje = isoDate() } = {}) {
  const st = membershipState(aff, hoje);
  let band = FAIXA.other;
  if (st.status === MEMBER_STATUS.ACTIVE) band = st.expiring ? FAIXA.expiring : FAIXA.active;
  else if (st.status === MEMBER_STATUS.EXPIRED) band = FAIXA.expired;
  else if (st.status === MEMBER_STATUS.SUSPENDED) band = FAIXA.suspended;
  const color = normalizeHex(club?.association?.color) || BRAND_DEFAULT_COLOR;
  const code = aff?.card_code || '';
  const semValidade = st.status === MEMBER_STATUS.ACTIVE && !st.validUntil;
  return {
    federation: { name: club?.name || '', acronym: (aff?.member_number || '').split('-')[0] || '', logo: club?.logo_url || '', color, ink: readableInk(color), official: false, sponsors: [] },
    person: { name: aff?.user_name || t('Associado'), photo: aff?.photo_url || '' },
    kind: t('Associado'),
    tier: aff?.category || plan?.category || '',
    plan: plan?.name || aff?.plan_name || '',
    number: aff?.member_number || '—',
    validUntil: st.validUntil,
    validUntilLabel: semValidade ? t('Sem vencimento') : dataCurta(st.validUntil),
    band: { tone: band.tone, label: t(semValidade ? FAIXA.active.label : band.label) },
    status: st.status,
    code,
    verifyUrl: code ? `${origin}${clubVerifyPath(code)}` : '',
    hasCard: Boolean(code) && [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED, MEMBER_STATUS.SUSPENDED].includes(st.status),
  };
}

/* -------------------------------------------------------------- a secretaria -- */

/** Conta os associados por situação (só sobre o que carregou). */
export function affiliationCounts(list = [], hoje = isoDate()) {
  const out = { total: list.length, pending: 0, awaiting_payment: 0, active: 0, expiring: 0, expired: 0, suspended: 0, cancelled: 0, rejected: 0 };
  list.forEach((a) => {
    const st = membershipState(a, hoje);
    if (st.status in out) out[st.status] += 1;
    if (st.expiring) out.expiring += 1;
  });
  return out;
}

/** A fila da secretaria: pedidos primeiro, depois os que esperam pagamento, os vencendo e o resto; recentes em cima. */
export function sortAffiliationsForStaff(list = [], hoje = isoDate()) {
  const peso = (a) => {
    const st = membershipState(a, hoje);
    if (st.status === 'pending') return 0;
    if (st.status === 'awaiting_payment') return 1;
    if (st.expiring) return 2;
    if (st.status === 'expired') return 3;
    if (st.status === 'active') return 4;
    return 5;
  };
  return [...list].sort((a, b) => peso(a) - peso(b) || (Number(b.requested_at_ms) || 0) - (Number(a.requested_at_ms) || 0));
}
