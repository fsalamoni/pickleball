/**
 * A filiação: validade, estado de hoje, janela de renovação, número de
 * filiado e o código da carteirinha. Lógica pura — o SERVIDOR usa a mesma
 * conta (`functions/federations.js`, com teste de paridade em `membership.parity.test.js`).
 */
import { t } from '@/core/i18n';
import { instanteDoDiaEmMs } from '@/core/domain/instant.js';
import {
  MEMBER_STATUS, MEMBER_STATUS_LABELS, PLAN_BILLING, PLAN_VALIDITY, RENEWAL_WINDOW_DAYS,
} from './constants.js';

export const DIA_MS = 86_400_000;

/** 'YYYY-MM-DD' local. */
export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Soma meses a uma data ISO, segurando o dia no fim do mês (31/01 + 1 mês = 28/02). */
export function addMonthsISO(iso, months) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const ano = Number(m[1]);
  const mes = Number(m[2]) - 1 + months;
  const dia = Number(m[3]);
  const alvo = new Date(ano, mes, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ultimo));
  return isoDate(alvo);
}

/** Dias inteiros de `de` até `ate` (negativo se `ate` já passou). */
export function daysBetween(de, ate) {
  const a = new Date(`${de}T12:00:00`);
  const b = new Date(`${ate}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b - a) / DIA_MS);
}

/**
 * Até quando vale uma filiação paga/ativada em `fromISO`.
 *  - mensal: + 1 mês;
 *  - anual rolante: + 12 meses;
 *  - anual por data fixa: a próxima virada (`rollover_mmdd`); se faltarem menos
 *    de `calendar_grace_days` para ela, vale até a virada SEGUINTE (quem paga
 *    em novembro não paga de novo em janeiro).
 * Na renovação, `fromISO` é o maior entre hoje e a validade atual.
 */
export function computeValidUntil(plan, fromISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fromISO || ''))) return '';
  if (plan?.billing === PLAN_BILLING.MONTHLY) return addMonthsISO(fromISO, 1);
  if (plan?.validity === PLAN_VALIDITY.CALENDAR && /^\d{2}-\d{2}$/.test(plan.rollover_mmdd || '')) {
    const ano = Number(fromISO.slice(0, 4));
    let virada = `${ano}-${plan.rollover_mmdd}`;
    if (virada <= fromISO) virada = `${ano + 1}-${plan.rollover_mmdd}`;
    const graca = Number.isFinite(Number(plan.calendar_grace_days)) ? Number(plan.calendar_grace_days) : 60;
    if (daysBetween(fromISO, virada) < graca) virada = `${Number(virada.slice(0, 4)) + 1}-${plan.rollover_mmdd}`;
    return virada;
  }
  return addMonthsISO(fromISO, 12);
}

/** A data de início da renovação: nunca antes de hoje, nunca antes do fim da validade atual. */
export function renewalStart(member, hoje = isoDate()) {
  const atual = String(member?.valid_until || '');
  return atual > hoje ? atual : hoje;
}

/** 'YYYY-MM-DD' de qualquer valor do banco (string, Timestamp, Date, ms). */
export function toISODate(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
  const ms = instanteDoDiaEmMs(valor);
  return Number.isFinite(ms) && ms > 0 ? isoDate(new Date(ms)) : '';
}

/**
 * A situação da filiação HOJE, derivada do estado gravado e da validade.
 * `active` com a data vencida é "vencida" na tela antes da varredura gravar.
 *
 * @returns {{ status: string, label: string, validUntil: string, daysLeft: number|null, expiring: boolean, canRenew: boolean, countsForRanking: boolean }}
 */
export function membershipState(member, hoje = isoDate(), { nowMs = Date.now() } = {}) {
  const validUntil = toISODate(member?.valid_until);
  const vazio = { status: '', label: '', validUntil, daysLeft: null, expiring: false, canRenew: false, countsForRanking: false, disciplined: false };
  if (!member) return vazio;
  let status = member.status;
  const daysLeft = validUntil ? daysBetween(hoje, validUntil) : null;
  if (status === MEMBER_STATUS.ACTIVE && daysLeft != null && daysLeft < 0) status = MEMBER_STATUS.EXPIRED;
  // Suspensão DISCIPLINAR em vigor (PR 3): a filiação segue válida, mas a
  // carteirinha diz "Suspensa" e a regra recusa a inscrição em chancelado.
  const disciplined = Number(member.discipline_until_ms) > nowMs && [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(status);
  if (disciplined) status = MEMBER_STATUS.SUSPENDED;
  const expiring = status === MEMBER_STATUS.ACTIVE && daysLeft != null && daysLeft <= RENEWAL_WINDOW_DAYS;
  const canRenew = (status === MEMBER_STATUS.ACTIVE && expiring) || status === MEMBER_STATUS.EXPIRED;
  return {
    status,
    label: t(MEMBER_STATUS_LABELS[status] || ''),
    validUntil,
    daysLeft,
    expiring,
    canRenew,
    countsForRanking: status === MEMBER_STATUS.ACTIVE,
    disciplined,
  };
}

/** Os estados em que a filiação ainda está "viva" (aparece na carteira da pessoa). */
export const LIVE_MEMBER_STATUSES = Object.freeze([
  MEMBER_STATUS.PENDING, MEMBER_STATUS.AWAITING_PAYMENT, MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED, MEMBER_STATUS.SUSPENDED,
]);

/** Pode pedir filiação de novo? Só sem filiação viva (cancelada e recusada liberam). */
export function canRequestMembership(member) {
  return !member || !LIVE_MEMBER_STATUSES.includes(member.status);
}

/**
 * Número de filiado: `SIGLA-ANO-000123`. Sequencial por federação, gerado no
 * servidor numa transação sobre `member_counter`; nunca reaproveitado.
 */
export function formatMemberNumber(acronym, year, seq) {
  const sigla = String(acronym || 'FED').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'FED';
  return `${sigla}-${year}-${String(Math.max(1, Math.trunc(Number(seq) || 1))).padStart(6, '0')}`;
}

/** Alfabeto do código da carteirinha: sem 0/O/1/I para ler em voz alta na mesa do torneio. */
export const CARD_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CARD_CODE_LENGTH = 10;

/**
 * Código novo a partir de bytes aleatórios (quem chama passa `crypto.getRandomValues`
 * ou `randomBytes`). Determinístico sobre os bytes — testável.
 * @param {Uint8Array|number[]} bytes
 */
export function cardCodeFromBytes(bytes) {
  let out = '';
  for (let i = 0; i < CARD_CODE_LENGTH; i += 1) {
    out += CARD_CODE_ALPHABET[(bytes[i] ?? 0) % CARD_CODE_ALPHABET.length];
  }
  return out;
}

/** Código digitado/escaneado → forma canônica (maiúsculas, sem espaço/hífen). Vazio se não tem cara de código. */
export function normalizeCardCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
  return s.length === CARD_CODE_LENGTH && [...s].every((c) => CARD_CODE_ALPHABET.includes(c)) ? s : '';
}

/**
 * O que a verificação PÚBLICA devolve de uma filiação: o mínimo (D11 e LGPD).
 * Sem e-mail, telefone, nascimento, documento.
 */
export function publicVerification(member, federation, hoje = isoDate(), { nowMs = Date.now() } = {}) {
  if (!member || !federation) return { found: false };
  const st = membershipState(member, hoje, { nowMs });
  // Menor: a foto só sai com o consentimento do responsável (D7).
  const semFoto = member.public_photo === false || (member.is_minor === true && member.minor_photo_consent !== true);
  return {
    found: true,
    name: member.user_name || '',
    photo_url: semFoto ? '' : (member.photo_url || ''),
    federation: { name: federation.name, acronym: federation.acronym, slug: federation.slug },
    tier: member.tier || '',
    person_type: member.person_type || '',
    person_type_label: member.person_type_label || '',
    org_kind: member.org_kind || null,
    member_number: member.member_number || '',
    // O nível oficial só sai quando a federação decidiu publicá-lo (`rules.level_public`).
    official_level: federation.rules?.level_public === true && member.official_level?.label ? member.official_level.label : '',
    status: st.status,
    valid_until: st.validUntil,
  };
}

/** Ordena filiados: pendentes primeiro (mais antigo em cima), depois por nome. */
export function sortMembersForStaff(members = []) {
  const peso = { pending: 0, awaiting_payment: 1, active: 2, expired: 3, suspended: 4, cancelled: 5, rejected: 6 };
  return [...members].sort((a, b) => (peso[a.status] ?? 9) - (peso[b.status] ?? 9) || String(a.user_name || '').localeCompare(String(b.user_name || ''), 'pt-BR'));
}

/** Contagens para o resumo da Central (só sobre o que carregou). */
export function memberCounts(members = [], hoje = isoDate()) {
  const out = { total: members.length, pending: 0, awaiting_payment: 0, active: 0, expiring: 0, expired: 0, suspended: 0 };
  members.forEach((m) => {
    const st = membershipState(m, hoje);
    if (st.status in out) out[st.status] += 1;
    if (st.expiring) out.expiring += 1;
  });
  return out;
}

/**
 * O card "Federação" do início: as filiações vivas da pessoa, a que pede uma
 * ação primeiro (pagar, renovar), cada uma com o que fazer. Dependente
 * (menor) entra junto — o responsável é quem paga.
 * @returns {Array<{ member: object, estado: object, acao: ''|'pagar'|'renovar' }>}
 */
export function homeFederationRows(memberships = [], hoje = isoDate()) {
  const peso = { pagar: 0, renovar: 1, '': 2 };
  return (memberships || [])
    .map((member) => {
      const estado = membershipState(member, hoje);
      const acao = estado.status === MEMBER_STATUS.AWAITING_PAYMENT ? 'pagar' : estado.canRenew ? 'renovar' : '';
      return { member, estado, acao };
    })
    .filter((r) => LIVE_MEMBER_STATUSES.includes(r.estado.status))
    .sort((a, b) => peso[a.acao] - peso[b.acao]);
}

/**
 * Quando abre a renovação de uma filiação ATIVA que ainda não está na janela:
 * `RENEWAL_WINDOW_DAYS` antes do fim da validade. Fora disso (já na janela,
 * vencida, sem validade) devolve '' — a tela mostra o botão ou nada.
 */
export function renewalOpensOn(member, hoje = isoDate()) {
  const st = membershipState(member, hoje);
  if (st.status !== MEMBER_STATUS.ACTIVE || st.canRenew || !st.validUntil) return '';
  const [y, mo, d] = st.validUntil.split('-').map(Number);
  return isoDate(new Date(Date.UTC(y, mo - 1, d - RENEWAL_WINDOW_DAYS, 12)));
}
