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
function membershipState(member, hoje) {
  if (!member) return { status: '', daysLeft: null, expiring: false, canRenew: false };
  let status = member.status;
  const validUntil = String(member.valid_until || '');
  const daysLeft = validUntil ? daysBetween(hoje, validUntil) : null;
  if (status === 'active' && daysLeft != null && daysLeft < 0) status = 'expired';
  const expiring = status === 'active' && daysLeft != null && daysLeft <= RENEWAL_WINDOW_DAYS;
  return { status, daysLeft, expiring, canRenew: (status === 'active' && expiring) || status === 'expired' };
}

function publicVerification(member, federation, hoje) {
  if (!member || !federation) return { found: false };
  const st = membershipState(member, hoje);
  return {
    found: true,
    name: member.user_name || '',
    photo_url: member.public_photo === false ? '' : (member.photo_url || ''),
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

module.exports = {
  RENEWAL_WINDOW_DAYS, EXPIRY_NOTICE_DAYS, CHARGE_DUE_DAYS, CARD_CODE_ALPHABET, CARD_CODE_LENGTH,
  isoDateBR, addMonthsISO, daysBetween, computeValidUntil, renewalStart, formatMemberNumber,
  cardCodeFromBytes, normalizeCardCode, membershipState, publicVerification, chargeDueDate,
};
