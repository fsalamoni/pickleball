/**
 * SELEÇÃO DO CLUBE (Bloco E3) — a conta PURA, no servidor. Cópia de
 * `src/modules/clubs/domain/selection.js` (paridade: `clubSelection.parity.test.js`).
 *
 * Convocação = o clube chama associados para um evento (campeonato, interclubes, amistoso):
 * atletas e comissão técnica, com prazo para responder. Aqui mora a regra — validar a
 * convocação, contar os convites, o nome que aparece na lista pública e, sobretudo, a
 * TRAVA DE PROTEÇÃO: menor de idade só é convocado com o responsável legal registrado e
 * autorizando; quem integra a comissão de uma convocação com menores só entra com a
 * proteção de menores em dia (compromisso + certidão).
 */
const str = (v, max = 500) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const int = (v, d, min, max) => {
  if (v == null || v === '') return d;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

const CALLUP_STATUS = Object.freeze({ DRAFT: 'draft', OPEN: 'open', CLOSED: 'closed', CANCELLED: 'cancelled' });
const CALLUP_STATUS_LABELS = Object.freeze({ draft: 'Rascunho', open: 'Aberta', closed: 'Encerrada', cancelled: 'Cancelada' });
const PUBLIC_STATUSES = Object.freeze(['open', 'closed']);
const MEMBER_STATUS = Object.freeze({ INVITED: 'invited', ACCEPTED: 'accepted', DECLINED: 'declined', EXPIRED: 'expired', CANCELLED: 'cancelled' });
const MEMBER_STATUS_LABELS = Object.freeze({ invited: 'Aguardando resposta', accepted: 'Confirmou', declined: 'Recusou', expired: 'Prazo vencido', cancelled: 'Retirado' });
/** Quem é chamado: o atleta ou alguém da comissão técnica (treinador, auxiliar, capitão). */
const ROLES = Object.freeze(['athlete', 'staff']);
const ROLE_LABELS = Object.freeze({ athlete: 'Atleta', staff: 'Comissão técnica' });
const TRAVEL_DOCS = Object.freeze(['id_doc', 'medical', 'vaccination', 'passport']);
const TRAVEL_DOC_LABELS = Object.freeze({ id_doc: 'Documento de identidade', medical: 'Atestado médico', vaccination: 'Carteira de vacinação', passport: 'Passaporte' });
const UNIFORM_SIZES = Object.freeze(['PP', 'P', 'M', 'G', 'GG', 'XG']);
const LIMITS = Object.freeze({ TITLE: 120, TEXT: 120, MESSAGE: 2000, LABEL: 60, SLOTS_MAX: 200, ACCEPT_DAYS_MAX: 30, ACCEPT_DAYS_DEFAULT: 7, REASON: 300 });

function normalizeCallup(input = {}) {
  const i = input || {};
  return {
    title: str(i.title, LIMITS.TITLE),
    event_name: str(i.event_name, LIMITS.TEXT),
    place: str(i.place, LIMITS.TEXT),
    starts_at: isIso(i.starts_at) ? i.starts_at : '',
    ends_at: isIso(i.ends_at) ? i.ends_at : '',
    accept_days: int(i.accept_days, LIMITS.ACCEPT_DAYS_DEFAULT, 1, LIMITS.ACCEPT_DAYS_MAX),
    slots: i.slots == null || i.slots === '' ? 0 : int(i.slots, 0, 0, LIMITS.SLOTS_MAX),
    travel_docs: Array.isArray(i.travel_docs) ? TRAVEL_DOCS.filter((x) => i.travel_docs.includes(x)) : [],
    collect_uniform: i.collect_uniform === true,
    involves_minors: i.involves_minors === true,
    message: str(i.message, LIMITS.MESSAGE),
  };
}

function validateCallup(input = {}) {
  const v = normalizeCallup(input);
  const errors = {};
  if (v.title.length < 3) errors.title = 'Dê um nome à convocação.';
  if (v.event_name.length < 3) errors.event_name = 'Diga qual é o evento.';
  if (!v.starts_at) errors.starts_at = 'Diga quando o evento começa.';
  if (v.starts_at && v.ends_at && v.ends_at < v.starts_at) errors.ends_at = 'O fim não pode ser antes do começo.';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

/** O nome que aparece na lista PÚBLICA: o menor de idade só com o primeiro nome e a inicial do último. */
function publicName(name, isMinor) {
  const partes = str(name, 120).split(' ').filter(Boolean);
  if (!partes.length) return 'Atleta';
  if (!isMinor || partes.length === 1) return partes.join(' ');
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

const memberDocId = (callupId, uid) => `${callupId}_${uid}`;

/** Convites que ocupam vaga: aguardando ou confirmado. */
const occupies = (m) => Boolean(m) && (m.status === MEMBER_STATUS.INVITED || m.status === MEMBER_STATUS.ACCEPTED);

function callupCounts(members = []) {
  const lista = Array.isArray(members) ? members : [];
  const por = (s) => lista.filter((m) => m && m.status === s).length;
  return {
    invited: por(MEMBER_STATUS.INVITED), accepted: por(MEMBER_STATUS.ACCEPTED), declined: por(MEMBER_STATUS.DECLINED),
    athletes: lista.filter((m) => m && m.role === 'athlete' && m.status === MEMBER_STATUS.ACCEPTED).length,
    staff: lista.filter((m) => m && m.role === 'staff' && m.status === MEMBER_STATUS.ACCEPTED).length,
  };
}

/** Vagas de atleta que sobram (0 = sem limite definido, devolve null). */
function slotsLeft(callup, members = []) {
  const cap = Number((callup || {}).slots) || 0;
  if (!cap) return null;
  const ocupadas = (Array.isArray(members) ? members : []).filter((m) => occupies(m) && m.role === 'athlete').length;
  return Math.max(0, cap - ocupadas);
}

/**
 * A TRAVA DE PROTEÇÃO ao convocar. `minor`: a pessoa tem menos de 18; `guardian`: o responsável
 * registrado (ou null); `cleared`: a proteção de menores dela está em dia hoje.
 */
function callupGate({ role, minor, guardian, cleared, involvesMinors }) {
  if (role === 'athlete' && minor) {
    if (!guardian) return { ok: false, reason: 'guardian', message: 'Menor de idade: registre o responsável legal antes de convocar.' };
    if (guardian.consent !== true) return { ok: false, reason: 'consent', message: 'O responsável não autorizou a participação deste menor.' };
  }
  if (role === 'staff' && involvesMinors && !cleared) {
    return { ok: false, reason: 'protecao', message: 'A convocação inclui menores: a pessoa precisa estar com a proteção de menores em dia (compromisso e certidão).' };
  }
  return { ok: true, reason: '', message: '' };
}

/** O convite ainda pode ser respondido? */
const inviteOpen = (m, now = Date.now()) => Boolean(m) && m.status === MEMBER_STATUS.INVITED && Number(m.expires_at_ms) > now;

module.exports = {
  CALLUP_STATUS, CALLUP_STATUS_LABELS, PUBLIC_STATUSES, MEMBER_STATUS, MEMBER_STATUS_LABELS, ROLES, ROLE_LABELS, TRAVEL_DOCS, TRAVEL_DOC_LABELS, UNIFORM_SIZES, LIMITS,
  normalizeCallup, validateCallup, publicName, memberDocId, occupies, callupCounts, slotsLeft, callupGate, inviteOpen,
};
