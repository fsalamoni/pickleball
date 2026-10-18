/**
 * CURSOS E CREDENCIAIS (módulo `courses`): o curso (`federation_courses`,
 * público), a inscrição (`federation_course_enrollments/{curso}_{uid}`, só do
 * servidor) e a credencial (`federation_credentials`) que a aprovação emite,
 * com código verificável na MESMA página da carteirinha. Lógica pura; a
 * verificação pública tem CÓPIA no servidor (`functions/federationMembership.js`,
 * paridade em `federationMembership.parity.test.js`).
 */
import { t } from '@/core/i18n';
import { COURSE_KIND, COURSE_STATUS, CREDENTIAL_STATUS, ENROLLMENT_STATUS } from './constants.js';
import { addMonthsISO, isoDate } from './membership.js';

const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const intOr = (v, d) => (v !== '' && v !== null && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** @returns {{ ok: boolean, errors: Record<string,string>, value: object }} */
export function validateCourseInput(input = {}) {
  const errors = {};
  const name = str(input.name, 120);
  if (name.length < 3) errors.name = t('Dê um nome ao curso (mínimo 3 caracteres).');
  const kind = Object.values(COURSE_KIND).includes(input.kind) ? input.kind : COURSE_KIND.CLINIC;
  const starts_at = str(input.starts_at, 10);
  const ends_at = str(input.ends_at, 10) || starts_at;
  if (!ISO.test(starts_at)) errors.starts_at = t('Informe a data de início.');
  if (ends_at && !ISO.test(ends_at)) errors.ends_at = t('Data de fim inválida.');
  if (ISO.test(starts_at) && ISO.test(ends_at) && ends_at < starts_at) errors.ends_at = t('O fim vem antes do início.');
  const price_cents = intOr(input.price_cents, 0);
  const member_price_cents = intOr(input.member_price_cents, price_cents);
  if (price_cents < 0 || price_cents > 100000000) errors.price_cents = t('Valor inválido.');
  if (member_price_cents < 0 || member_price_cents > price_cents) errors.member_price_cents = t('O valor de filiado não pode passar do valor cheio.');
  const seats = intOr(input.seats, 0);
  if (seats < 0 || seats > 10000) errors.seats = t('Vagas inválidas (0 = sem limite).');
  const credential_months = intOr(input.credential_months, 0);
  const online = input.online === true;
  const link = str(input.link, 300);
  if (online && link && !/^https:\/\//.test(link)) errors.link = t('O link precisa começar com https://');
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      name, kind, level: str(input.level, 60), description: str(input.description, 2000), starts_at, ends_at,
      place: online ? '' : str(input.place, 160), online, link: online ? link : '', seats, hours: Math.max(0, intOr(input.hours, 0)),
      price_cents: Math.max(0, price_cents), member_price_cents: Math.max(0, member_price_cents), instructors: str(input.instructors, 300),
      requires_membership: input.requires_membership === true, issues_credential: input.issues_credential === true,
      credential_months: Math.max(0, Math.min(120, credential_months)), status: Object.values(COURSE_STATUS).includes(input.status) ? input.status : COURSE_STATUS.DRAFT,
    },
  };
}

/** O preço para esta pessoa: filiado em dia paga o de filiado. */
export function coursePriceFor(course, { isMember = false } = {}) {
  const cheio = Math.max(0, Math.trunc(Number(course?.price_cents) || 0));
  const filiado = Math.max(0, Math.trunc(Number(course?.member_price_cents ?? cheio) || 0));
  return isMember ? Math.min(cheio, filiado) : cheio;
}

/** Vagas que restam (`null` = sem limite). */
export function seatsLeft(course) {
  const total = Math.trunc(Number(course?.seats) || 0);
  if (total <= 0) return null;
  return Math.max(0, total - (Math.trunc(Number(course?.enrolled_count) || 0)));
}

/**
 * A situação do curso hoje: aberto para inscrição? lotado? passou?
 * @returns {{ open: boolean, full: boolean, past: boolean, label: string }}
 */
export function courseState(course, hoje = isoDate()) {
  if (!course) return { open: false, full: false, past: false, label: '' };
  const past = Boolean(course.ends_at) && String(course.ends_at) < hoje;
  const left = seatsLeft(course);
  const full = left != null && left <= 0;
  const open = course.status === COURSE_STATUS.OPEN && !past && !full;
  let label = '';
  if (course.status === COURSE_STATUS.CANCELLED) label = t('Cancelado');
  else if (course.status === COURSE_STATUS.DONE || past) label = t('Realizado');
  else if (course.status === COURSE_STATUS.DRAFT) label = t('Rascunho');
  else if (full) label = t('Lotado');
  else if (course.status === COURSE_STATUS.CLOSED) label = t('Inscrições encerradas');
  else label = t('Inscrições abertas');
  return { open, full, past, label };
}

/** A pessoa pode cancelar a própria inscrição? (antes do curso, se não foi avaliada) */
export const canCancelEnrollment = (enr, course, hoje = isoDate()) => Boolean(enr)
  && [ENROLLMENT_STATUS.AWAITING_PAYMENT, ENROLLMENT_STATUS.CONFIRMED].includes(enr.status)
  && !(course?.starts_at && String(course.starts_at) < hoje);

/** Até quando a credencial vale: `credential_months` do curso a partir da emissão (0 = sem validade). */
export function credentialValidUntil(course, issuedISO) {
  const meses = Math.trunc(Number(course?.credential_months) || 0);
  return meses > 0 ? addMonthsISO(issuedISO, meses) : '';
}

/** A credencial HOJE: `active` vencida pela data vira `expired` na tela. */
export function credentialState(cred, hoje = isoDate()) {
  if (!cred) return { status: '', valid: false };
  let status = cred.status || CREDENTIAL_STATUS.ACTIVE;
  if (status === CREDENTIAL_STATUS.ACTIVE && cred.valid_until && String(cred.valid_until) < hoje) status = CREDENTIAL_STATUS.EXPIRED;
  return { status, valid: status === CREDENTIAL_STATUS.ACTIVE };
}

/**
 * O que a verificação PÚBLICA devolve de uma credencial: o mínimo. Cópia no servidor.
 */
export function publicCredentialVerification(cred, federation, hoje = isoDate()) {
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

/** Cursos: abertos e futuros primeiro (pela data), depois os passados (mais recente em cima). */
export function sortCourses(list = [], hoje = isoDate()) {
  const fut = (c) => !(c.ends_at && String(c.ends_at) < hoje);
  return [...list].sort((a, b) => {
    const fa = fut(a); const fb = fut(b);
    if (fa !== fb) return fa ? -1 : 1;
    return fa ? String(a.starts_at).localeCompare(String(b.starts_at)) : String(b.starts_at).localeCompare(String(a.starts_at));
  });
}

/** Os cursos que o público vê (rascunho não). */
export const publicCourses = (list = []) => list.filter((c) => c.status !== COURSE_STATUS.DRAFT);
