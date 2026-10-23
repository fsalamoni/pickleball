/**
 * SEGURO: TERMO E CERTIFICADO (rodada 3, Bloco 5, `docs/50` §42) — a conta
 * PURA do aceite do termo do seguro e do certificado para eventos.
 *
 *  - TERMO: a federação escreve o termo do seguro na apólice
 *    (`federations.insurance.term_text`) e liga `require_term`. Quem pede ou
 *    renova a filiação (pessoa, não clube nem arena) aceita a versão em vigor;
 *    a versão é a impressão digital do texto (`termVersion`), então mudar o
 *    texto pede um aceite novo. O aceite fica na filiação
 *    (`insurance_term { version, accepted_at_ms, by }` + o histórico).
 *  - CERTIFICADO: o clube ou a arena filiada pede um certificado de seguro
 *    para um evento (alugar quadra, fazer um festival); a federação emite com
 *    código e QR de verificação pública (`/f/verificar/:codigo`).
 *
 * O servidor tem uma CÓPIA (`functions/federationInsurancePolicy.js`) com
 * paridade em `federationInsurance.parity.test.js`. Estados são GRAVADOS:
 * nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

const str = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export const INSURANCE_LIMITS = Object.freeze({
  TERM_MIN: 40, TERM_MAX: 6000, LOG_MAX: 10, EVENT_NAME_MAX: 120, VENUE_MAX: 160, CITY_MAX: 80,
  NOTE_MAX: 500, REASON_MAX: 300, PARTICIPANTS_MAX: 5000, EVENT_DAYS_MAX: 31,
});

/* ---------------------------------------------------------------- o termo -- */

/** A versão do termo: FNV-1a de 32 bits do texto (espaços juntados). Mesmo texto, mesma versão. */
export function termVersion(text) {
  const s = str(text, INSURANCE_LIMITS.TERM_MAX);
  if (!s) return '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** O termo digitado na apólice: obrigatório (e com texto) só quando `require_term` está ligado. */
export function validateInsuranceTerm(input = {}) {
  const v = { require_term: input.require_term === true, term_text: txt(input.term_text, INSURANCE_LIMITS.TERM_MAX) };
  const errors = {};
  if (v.require_term && v.term_text.length < INSURANCE_LIMITS.TERM_MIN) errors.term_text = t('Escreva o termo (ao menos {n} letras) para pedir o aceite.', { n: INSURANCE_LIMITS.TERM_MIN });
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/**
 * Esta filiação precisa aceitar o termo? Só pessoa (clube e arena não), só com
 * o módulo `insurance` e o termo ligados e escrito, e só quem a apólice cobre (`federated_only` ⇒ só o
 * filiado pagante).
 */
export function termRequired(federation, { tier = 'federated', entity = 'person' } = {}) {
  const ins = federation?.insurance;
  if (!ins || federation.modules?.insurance !== true || ins.require_term !== true || !termVersion(ins.term_text)) return false;
  if (entity !== 'person') return false;
  return ins.covers !== 'federated_only' || (tier || 'federated') === 'federated';
}

/** O aceite de uma filiação: precisa? aceitou a versão de hoje? aceitou uma antiga? */
export function termState(member, federation) {
  const required = termRequired(federation, { tier: member?.tier, entity: member?.org_kind ? member.org_kind : 'person' });
  const version = required ? termVersion(federation.insurance.term_text) : '';
  const aceite = member?.insurance_term || null;
  const accepted = required && Boolean(aceite) && aceite.version === version;
  return {
    required, version, accepted,
    outdated: required && Boolean(aceite?.version) && !accepted,
    accepted_at_ms: accepted ? Number(aceite.accepted_at_ms) || null : null,
  };
}

/** O que grava o aceite: a versão de agora e o histórico (os últimos 10). */
export function termAcceptancePatch(member, version, uid, now) {
  const reg = { version: String(version), accepted_at_ms: now, by: uid || null };
  const log = (Array.isArray(member?.insurance_term_log) ? member.insurance_term_log : []).concat([reg]).slice(-INSURANCE_LIMITS.LOG_MAX);
  return { insurance_term: reg, insurance_term_log: log };
}

/* ----------------------------------------------------------- o certificado -- */

export const CERT_STATUS = Object.freeze({ REQUESTED: 'requested', ISSUED: 'issued', DECLINED: 'declined', CANCELLED: 'cancelled', WITHDRAWN: 'withdrawn' });
export const CERT_STATUS_LABELS = Object.freeze({
  requested: tk('Pedido em análise'), issued: tk('Emitido'), declined: tk('Pedido não aceito'), cancelled: tk('Cancelado'), withdrawn: tk('Pedido retirado'),
});

/** O pedido do clube ou da arena: o evento, o local, as datas e quantas pessoas. */
export function validateCertificateRequest(input = {}, hoje) {
  const L = INSURANCE_LIMITS;
  const v = {
    event_name: str(input.event_name, L.EVENT_NAME_MAX), venue: str(input.venue, L.VENUE_MAX), city: str(input.city, L.CITY_MAX),
    date_from: str(input.date_from, 10), date_to: str(input.date_to, 10) || str(input.date_from, 10),
    participants: Math.trunc(Number(input.participants) || 0), note: txt(input.note, L.NOTE_MAX),
  };
  const errors = {};
  if (v.event_name.length < 3) errors.event_name = t('Diga o nome do evento.');
  if (v.venue.length < 3) errors.venue = t('Diga o local (quadra, arena, endereço).');
  if (v.city.length < 2) errors.city = t('Diga a cidade.');
  if (!isIso(v.date_from)) errors.date_from = t('Informe a data do evento.');
  else if (hoje && v.date_from < hoje) errors.date_from = t('O evento não pode ser no passado.');
  if (!isIso(v.date_to)) errors.date_to = t('Data inválida.');
  else if (isIso(v.date_from) && v.date_to < v.date_from) errors.date_to = t('O fim vem antes do início.');
  else if (isIso(v.date_from) && dias(v.date_from, v.date_to) + 1 > L.EVENT_DAYS_MAX) errors.date_to = t('Um certificado cobre até {n} dias.', { n: L.EVENT_DAYS_MAX });
  if (v.participants < 1 || v.participants > L.PARTICIPANTS_MAX) errors.participants = t('Informe quantas pessoas (1 a {n}).', { n: L.PARTICIPANTS_MAX });
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/** Por que a federação NÃO pode emitir: sem apólice, apólice vencida ou que não cobre as datas do evento. */
export function certificateIssueError(ins, event, hoje) {
  if (!ins || !isIso(ins.valid_until)) return t('Cadastre a apólice do seguro antes de emitir.');
  if (ins.valid_until < hoje) return t('A apólice está vencida.');
  if (!event || !isIso(event.date_from)) return t('O pedido não tem a data do evento.');
  if (ins.valid_from && event.date_from < ins.valid_from) return t('O evento começa antes do início da apólice.');
  if ((event.date_to || event.date_from) > ins.valid_until) return t('O evento termina depois do fim da apólice.');
  return null;
}

/** O certificado hoje: o estado gravado, e o emitido vira `expired` depois do evento. */
export function certificateState(cert, hoje) {
  const st = cert?.status || CERT_STATUS.REQUESTED;
  if (st !== CERT_STATUS.ISSUED) return st;
  const fim = cert.event?.date_to || cert.event?.date_from;
  return isIso(fim) && fim < hoje ? 'expired' : st;
}

/** O que a verificação pública mostra (sem conta): o mínimo para conferir. */
export function publicCertificateVerification(cert, fed, hoje) {
  const st = certificateState(cert, hoje);
  return {
    found: true,
    kind: 'insurance_certificate',
    status: st === CERT_STATUS.ISSUED ? 'valid' : st === 'expired' ? 'expired' : 'cancelled',
    federation: { name: fed?.name || cert?.federation_name || '', acronym: fed?.acronym || cert?.federation_acronym || '', slug: fed?.slug || '' },
    org_name: cert?.org_name || '',
    event: { name: cert?.event?.event_name || '', venue: cert?.event?.venue || '', city: cert?.event?.city || '', date_from: cert?.event?.date_from || '', date_to: cert?.event?.date_to || '', participants: Number(cert?.event?.participants) || 0 },
    policy: { insurer: cert?.policy?.insurer || '', number: cert?.policy?.policy || '', valid_until: cert?.policy?.valid_until || '' },
    issued_at_ms: Number(cert?.issued_at_ms) || null,
  };
}
