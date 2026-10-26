/**
 * SELEÇÃO DO CLUBE (Bloco E3) — a conta PURA: validar a convocação, contar os convites, o nome
 * da lista pública e a TRAVA DE PROTEÇÃO (menor só com o responsável autorizando; comissão de
 * convocação com menores só com a proteção de menores em dia).
 *
 * Quem grava é SÓ o servidor (`functions/clubSelection.js`); cópia em
 * `functions/clubSelectionPolicy.js` com paridade (`clubSelection.parity.test.js`). Os ids de
 * estado e de papel são gravados: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

export const CALLUP_STATUS = Object.freeze({ DRAFT: 'draft', OPEN: 'open', CLOSED: 'closed', CANCELLED: 'cancelled' });
export const CALLUP_STATUS_LABELS = Object.freeze({ draft: tk('Rascunho'), open: tk('Aberta'), closed: tk('Encerrada'), cancelled: tk('Cancelada') });
export const CALLUP_PUBLIC_STATUSES = Object.freeze(['open', 'closed']);
export const MEMBER_STATUS = Object.freeze({ INVITED: 'invited', ACCEPTED: 'accepted', DECLINED: 'declined', EXPIRED: 'expired', CANCELLED: 'cancelled' });
export const MEMBER_STATUS_LABELS = Object.freeze({
  invited: tk('Aguardando resposta'), accepted: tk('Confirmou'), declined: tk('Recusou'), expired: tk('Prazo vencido'), cancelled: tk('Retirado'),
});
/** Quem é chamado: o atleta ou alguém da comissão técnica (treinador, auxiliar, capitão). */
export const CALLUP_ROLES = Object.freeze(['athlete', 'staff']);
export const CALLUP_ROLE_LABELS = Object.freeze({ athlete: tk('Atleta'), staff: tk('Comissão técnica') });
export const TRAVEL_DOCS = Object.freeze(['id_doc', 'medical', 'vaccination', 'passport']);
export const TRAVEL_DOC_LABELS = Object.freeze({
  id_doc: tk('Documento de identidade'), medical: tk('Atestado médico'), vaccination: tk('Carteira de vacinação'), passport: tk('Passaporte'),
});
export const UNIFORM_SIZES = Object.freeze(['PP', 'P', 'M', 'G', 'GG', 'XG']);
export const CALLUP_LIMITS = Object.freeze({ TITLE: 120, TEXT: 120, MESSAGE: 2000, LABEL: 60, SLOTS_MAX: 200, ACCEPT_DAYS_MAX: 30, ACCEPT_DAYS_DEFAULT: 7, REASON: 300 });

const str = (v, max = 500) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const int = (v, d, min, max) => {
  if (v == null || v === '') return d;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

export function normalizeCallup(input = {}) {
  const i = input || {};
  return {
    title: str(i.title, CALLUP_LIMITS.TITLE),
    event_name: str(i.event_name, CALLUP_LIMITS.TEXT),
    place: str(i.place, CALLUP_LIMITS.TEXT),
    starts_at: isIso(i.starts_at) ? i.starts_at : '',
    ends_at: isIso(i.ends_at) ? i.ends_at : '',
    accept_days: int(i.accept_days, CALLUP_LIMITS.ACCEPT_DAYS_DEFAULT, 1, CALLUP_LIMITS.ACCEPT_DAYS_MAX),
    slots: i.slots == null || i.slots === '' ? 0 : int(i.slots, 0, 0, CALLUP_LIMITS.SLOTS_MAX),
    travel_docs: Array.isArray(i.travel_docs) ? TRAVEL_DOCS.filter((x) => i.travel_docs.includes(x)) : [],
    collect_uniform: i.collect_uniform === true,
    involves_minors: i.involves_minors === true,
    message: str(i.message, CALLUP_LIMITS.MESSAGE),
  };
}

export function validateCallup(input = {}) {
  const v = normalizeCallup(input);
  const errors = {};
  if (v.title.length < 3) errors.title = t('Dê um nome à convocação.');
  if (v.event_name.length < 3) errors.event_name = t('Diga qual é o evento.');
  if (!v.starts_at) errors.starts_at = t('Diga quando o evento começa.');
  if (v.starts_at && v.ends_at && v.ends_at < v.starts_at) errors.ends_at = t('O fim não pode ser antes do começo.');
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

/** O nome que aparece na lista PÚBLICA: o menor de idade só com o primeiro nome e a inicial do último. */
export function publicName(name, isMinor) {
  const partes = str(name, 120).split(' ').filter(Boolean);
  if (!partes.length) return 'Atleta';
  if (!isMinor || partes.length === 1) return partes.join(' ');
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

export const memberDocId = (callupId, uid) => `${callupId}_${uid}`;

/** Convites que ocupam vaga: aguardando ou confirmado. */
export const occupies = (m) => Boolean(m) && (m.status === MEMBER_STATUS.INVITED || m.status === MEMBER_STATUS.ACCEPTED);

export function callupCounts(members = []) {
  const lista = Array.isArray(members) ? members : [];
  const por = (s) => lista.filter((m) => m && m.status === s).length;
  return {
    invited: por(MEMBER_STATUS.INVITED), accepted: por(MEMBER_STATUS.ACCEPTED), declined: por(MEMBER_STATUS.DECLINED),
    athletes: lista.filter((m) => m && m.role === 'athlete' && m.status === MEMBER_STATUS.ACCEPTED).length,
    staff: lista.filter((m) => m && m.role === 'staff' && m.status === MEMBER_STATUS.ACCEPTED).length,
  };
}

/** Vagas de atleta que sobram (`null` = sem limite definido). */
export function slotsLeft(callup, members = []) {
  const cap = Number((callup || {}).slots) || 0;
  if (!cap) return null;
  const ocupadas = (Array.isArray(members) ? members : []).filter((m) => occupies(m) && m.role === 'athlete').length;
  return Math.max(0, cap - ocupadas);
}

/**
 * A TRAVA DE PROTEÇÃO ao convocar. `minor`: a pessoa tem menos de 18; `guardian`: o responsável
 * registrado (ou null); `cleared`: a proteção de menores dela está em dia hoje.
 */
export function callupGate({ role, minor, guardian, cleared, involvesMinors }) {
  if (role === 'athlete' && minor) {
    if (!guardian) return { ok: false, reason: 'guardian', message: t('Menor de idade: registre o responsável legal antes de convocar.') };
    if (guardian.consent !== true) return { ok: false, reason: 'consent', message: t('O responsável não autorizou a participação deste menor.') };
  }
  if (role === 'staff' && involvesMinors && !cleared) {
    return { ok: false, reason: 'protecao', message: t('A convocação inclui menores: a pessoa precisa estar com a proteção de menores em dia (compromisso e certidão).') };
  }
  return { ok: true, reason: '', message: '' };
}

/** O convite ainda pode ser respondido? */
export const inviteOpen = (m, now = Date.now()) => Boolean(m) && m.status === MEMBER_STATUS.INVITED && Number(m.expires_at_ms) > now;
