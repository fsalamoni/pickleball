/**
 * Domínio puro de clínicas/workshops do professor (flag coach_clinics).
 *
 * Uma clínica (`coach_clinics/{clinicId}`) é um evento aberto criado por um
 * professor, com data/horário, local, vagas e preço. Atletas se inscrevem
 * (auto-inscrição) em `coach_clinic_signups/{clinicId_athleteId}`. Aditivo:
 * não altera aulas, rating nem ranking.
 *
 * Sem I/O — testável isoladamente.
 */

const str = (v) => String(v ?? '').trim();

export const CLINIC_STATUS = Object.freeze({
  OPEN: 'open',
  CANCELLED: 'cancelled',
});

export const CLINIC_STATUS_LABELS = Object.freeze({
  [CLINIC_STATUS.OPEN]: 'Aberta',
  [CLINIC_STATUS.CANCELLED]: 'Cancelada',
});

export const CLINIC_TITLE_MAX = 120;
export const CLINIC_DESCRIPTION_MAX = 2000;
export const CLINIC_LOCATION_MAX = 160;
export const CLINIC_LEVEL_MAX = 40;
export const CLINIC_CAPACITY_MAX = 200;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** id determinístico da inscrição. */
export function clinicSignupDocId(clinicId, athleteId) {
  return `${str(clinicId)}_${str(athleteId)}`;
}

/**
 * Normaliza e valida uma clínica.
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizeClinic(input = {}) {
  const coach_id = str(input.coach_id);
  if (!coach_id) return { valid: false, error: 'Professor é obrigatório.', value: {} };

  const title = str(input.title).slice(0, CLINIC_TITLE_MAX);
  if (!title) return { valid: false, error: 'Informe um título.', value: {} };

  const date = str(input.date);
  if (!DATE_RE.test(date)) return { valid: false, error: 'Data inválida.', value: {} };

  const start = str(input.start);
  const end = str(input.end);
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
    return { valid: false, error: 'Horário inválido.', value: {} };
  }
  if (end <= start) return { valid: false, error: 'O término deve ser após o início.', value: {} };

  const capacity = (() => {
    const n = Math.floor(Number(input.capacity));
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.min(n, CLINIC_CAPACITY_MAX);
  })();
  if (capacity === null) return { valid: false, error: 'Informe o número de vagas (mín. 1).', value: {} };

  const price = (() => {
    const n = Number(input.price);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  })();

  const value = {
    coach_id,
    coach_name: str(input.coach_name).slice(0, 140),
    title,
    description: str(input.description).slice(0, CLINIC_DESCRIPTION_MAX),
    location: str(input.location).slice(0, CLINIC_LOCATION_MAX),
    level: str(input.level).slice(0, CLINIC_LEVEL_MAX),
    date,
    start,
    end,
    capacity,
    price,
    status: input.status === CLINIC_STATUS.CANCELLED ? CLINIC_STATUS.CANCELLED : CLINIC_STATUS.OPEN,
  };
  return { valid: true, error: null, value };
}

/** Vagas restantes (nunca negativo). */
export function spotsLeft(clinic, signupCount = 0) {
  const cap = Math.max(0, Math.floor(Number(clinic?.capacity) || 0));
  return Math.max(0, cap - Math.max(0, Math.floor(Number(signupCount) || 0)));
}

export function isClinicFull(clinic, signupCount = 0) {
  return spotsLeft(clinic, signupCount) <= 0;
}

/** Uma clínica está no passado quando seu fim (data+hora) já passou. */
export function isClinicPast(clinic, now = new Date()) {
  if (!clinic?.date || !clinic?.end) return false;
  const [y, m, d] = str(clinic.date).split('-').map(Number);
  const [hh, mm] = str(clinic.end).split(':').map(Number);
  if (!y || !m || !d) return false;
  const endAt = new Date(y, m - 1, d, hh || 0, mm || 0);
  return endAt.getTime() < now.getTime();
}

/**
 * Se o atleta pode se inscrever.
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function canEnroll({ clinic, signupCount = 0, alreadyEnrolled = false, now = new Date() } = {}) {
  if (!clinic) return { ok: false, reason: 'Clínica inválida.' };
  if (clinic.status === CLINIC_STATUS.CANCELLED) return { ok: false, reason: 'Clínica cancelada.' };
  if (alreadyEnrolled) return { ok: false, reason: 'Você já está inscrito.' };
  if (isClinicPast(clinic, now)) return { ok: false, reason: 'Clínica já realizada.' };
  if (isClinicFull(clinic, signupCount)) return { ok: false, reason: 'Vagas esgotadas.' };
  return { ok: true, reason: null };
}

/** Ordena clínicas por data e horário crescentes. */
export function sortClinics(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const ka = `${str(a?.date)} ${str(a?.start)}`;
    const kb = `${str(b?.date)} ${str(b?.start)}`;
    return ka.localeCompare(kb);
  });
}

/** Só clínicas abertas e futuras, ordenadas. */
export function upcomingClinics(list, now = new Date()) {
  return sortClinics(
    (Array.isArray(list) ? list : [])
      .filter((c) => c && c.status !== CLINIC_STATUS.CANCELLED && !isClinicPast(c, now)),
  );
}

/** Rótulo amigável de data/hora (ex.: "12/08 · 08:00–10:00"). */
export function clinicWhenLabel(clinic) {
  if (!clinic?.date) return '';
  const [, m, d] = str(clinic.date).split('-');
  const day = d && m ? `${d}/${m}` : str(clinic.date);
  const range = clinic.start && clinic.end ? ` · ${clinic.start}–${clinic.end}` : '';
  return `${day}${range}`;
}
