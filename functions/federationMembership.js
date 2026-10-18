/**
 * FEDERAÇÕES — a conta da filiação no SERVIDOR.
 *
 * Cópia de `src/modules/federations/domain/membership.js` (o pacote de
 * Functions é publicado isolado e não enxerga `src/`), com teste de paridade
 * em `federationMembership.parity.test.js`: a validade que a tela mostra ANTES
 * de pagar é a mesma que o servidor grava DEPOIS.
 */

const RENEWAL_WINDOW_DAYS = 30;
const EXPIRY_NOTICE_DAYS = Object.freeze([30, 7, 1]);
const CHARGE_DUE_DAYS = 10;
const DIA_MS = 86400000;

/** 'YYYY-MM-DD' em Brasília — a federação é brasileira e o servidor roda em UTC. */
function isoDateBR(ms = Date.now()) {
  const d = new Date(ms - 3 * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function isoOfLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addMonthsISO(iso, months) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const alvo = new Date(Number(m[1]), Number(m[2]) - 1 + months, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(Number(m[3]), ultimo));
  return isoOfLocal(alvo);
}

function daysBetween(de, ate) {
  const a = new Date(`${de}T12:00:00`);
  const b = new Date(`${ate}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b - a) / DIA_MS);
}

function computeValidUntil(plan, fromISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fromISO || ''))) return '';
  if (plan && plan.billing === 'monthly') return addMonthsISO(fromISO, 1);
  if (plan && plan.validity === 'calendar' && /^\d{2}-\d{2}$/.test(plan.rollover_mmdd || '')) {
    const ano = Number(fromISO.slice(0, 4));
    let virada = `${ano}-${plan.rollover_mmdd}`;
    if (virada <= fromISO) virada = `${ano + 1}-${plan.rollover_mmdd}`;
    const graca = Number.isFinite(Number(plan.calendar_grace_days)) ? Number(plan.calendar_grace_days) : 60;
    if (daysBetween(fromISO, virada) < graca) virada = `${Number(virada.slice(0, 4)) + 1}-${plan.rollover_mmdd}`;
    return virada;
  }
  return addMonthsISO(fromISO, 12);
}

function renewalStart(member, hoje) {
  const atual = String((member && member.valid_until) || '');
  return atual > hoje ? atual : hoje;
}

function formatMemberNumber(acronym, year, seq) {
  const sigla = String(acronym || 'FED').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'FED';
  return `${sigla}-${year}-${String(Math.max(1, Math.trunc(Number(seq) || 1))).padStart(6, '0')}`;
}

const CARD_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CARD_CODE_LENGTH = 10;

function cardCodeFromBytes(bytes) {
  let out = '';
  for (let i = 0; i < CARD_CODE_LENGTH; i += 1) out += CARD_CODE_ALPHABET[(bytes[i] || 0) % CARD_CODE_ALPHABET.length];
  return out;
}

function normalizeCardCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
  return s.length === CARD_CODE_LENGTH && [...s].every((c) => CARD_CODE_ALPHABET.includes(c)) ? s : '';
}

/** O estado de HOJE (só o que o servidor precisa: vencida pela data, janela de renovação). */
function membershipState(member, hoje, nowMs = Date.now()) {
  if (!member) return { status: '', daysLeft: null, expiring: false, canRenew: false, disciplined: false };
  let status = member.status;
  const validUntil = String(member.valid_until || '');
  const daysLeft = validUntil ? daysBetween(hoje, validUntil) : null;
  if (status === 'active' && daysLeft != null && daysLeft < 0) status = 'expired';
  // Suspensão disciplinar em vigor (PR 3) — a mesma conta do cliente.
  const disciplined = Number(member.discipline_until_ms) > nowMs && ['active', 'expired'].includes(status);
  if (disciplined) status = 'suspended';
  const expiring = status === 'active' && daysLeft != null && daysLeft <= RENEWAL_WINDOW_DAYS;
  return { status, daysLeft, expiring, canRenew: (status === 'active' && expiring) || status === 'expired', disciplined };
}

function publicVerification(member, federation, hoje, nowMs = Date.now()) {
  if (!member || !federation) return { found: false };
  const st = membershipState(member, hoje, nowMs);
  const semFoto = member.public_photo === false || (member.is_minor === true && member.minor_photo_consent !== true);
  return {
    found: true,
    name: member.user_name || '',
    photo_url: semFoto ? '' : (member.photo_url || ''),
    federation: { name: federation.name, acronym: federation.acronym, slug: federation.slug },
    tier: member.tier || '',
    person_type: member.person_type || '',
    member_number: member.member_number || '',
    status: st.status,
    valid_until: String(member.valid_until || ''),
  };
}

function chargeDueDate(fromISO, dias = CHARGE_DUE_DAYS) {
  const base = new Date(`${fromISO}T12:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + dias);
  return isoOfLocal(base);
}

/* ------------------------------------------------- PR 3: preço, CPF, credencial -- */

/** O preço do plano para esta pessoa (cópia de `plans.js` `planPrice`): o MAIOR desconto, um só. */
function planPrice(plan, { age = null, familyIndex = 1 } = {}) {
  const base = Math.max(0, Math.trunc(Number(plan && plan.price_cents) || 0));
  const d = (plan && plan.discounts) || {};
  const pcts = [];
  if (age != null && age < 18 && d.minor_pct > 0) pcts.push(d.minor_pct);
  else if (age != null && age >= 60 && d.senior_pct > 0) pcts.push(d.senior_pct);
  if (d.family_pct > 0 && familyIndex >= (d.family_from || 2)) pcts.push(d.family_pct);
  const maior = pcts.reduce((m, x) => Math.max(m, x), 0);
  const total = Math.max(0, Math.round(base * (1 - maior / 100)));
  return { base, total, pct: maior };
}

/** CPF válido pelos dígitos verificadores (cópia de `privateData.js`). */
function isValidCpf(raw) {
  const d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i += 1) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Fim do dia `iso` em Brasília, em ms (cópia de `discipline.js`) — o que a regra compara com `request.time`. */
function endOfDayBrMs(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return 0;
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 23 + 3, 59, 59, 999);
}

/** A credencial HOJE (cópia de `courses.js`). */
function credentialState(cred, hoje) {
  if (!cred) return { status: '', valid: false };
  let status = cred.status || 'active';
  if (status === 'active' && cred.valid_until && String(cred.valid_until) < hoje) status = 'expired';
  return { status, valid: status === 'active' };
}

/** Verificação pública de uma credencial: o mínimo (cópia de `courses.js`). */
function publicCredentialVerification(cred, federation, hoje) {
  if (!cred || !federation) return { found: false };
  const st = credentialState(cred, hoje);
  return {
    found: true,
    kind: 'credential',
    name: cred.user_name || '',
    photo_url: cred.public_photo === false ? '' : (cred.photo_url || ''),
    federation: { name: federation.name, acronym: federation.acronym, slug: federation.slug },
    credential_kind: cred.kind || '',
    level: cred.level || '',
    course_name: cred.course_name || '',
    issued_at: String(cred.issued_at || ''),
    valid_until: String(cred.valid_until || ''),
    status: st.status,
  };
}

module.exports = {
  RENEWAL_WINDOW_DAYS, EXPIRY_NOTICE_DAYS, CHARGE_DUE_DAYS, CARD_CODE_ALPHABET, CARD_CODE_LENGTH,
  isoDateBR, addMonthsISO, daysBetween, computeValidUntil, renewalStart, formatMemberNumber,
  cardCodeFromBytes, normalizeCardCode, membershipState, publicVerification, chargeDueDate,
  planPrice, isValidCpf, endOfDayBrMs, credentialState, publicCredentialVerification,
};
