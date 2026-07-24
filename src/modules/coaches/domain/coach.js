/**
 * Domínio puro de Professores (Sprint 4 PRO-15).
 *
 * Coach (professor) tem:
 * - profile: bio, valor/hora, regiões, modalidades
 * - residencies: arenas onde dá aula (sub-coleção coach_arenas)
 * - classes: aulas ofertadas (futuro)
 *
 * Decisões:
 * - Profile é público (athletes acham no diretório)
 * - Residência é link coach ↔ arena (visível se arena opt-in)
 * - Sem dependência de framework
 */

export const COACH_BIO_MAX = 1000;
export const COACH_DISPLAY_NAME_MAX = 80;
export const COACH_REGIONS_MAX = 10;
export const COACH_REGION_MAX = 60;
export const COACH_MODALITIES_MAX = 5;
export const COACH_MODALITY_MAX = 30;
export const COACH_CERTIFICATIONS_MAX = 10;
export const COACH_CERTIFICATION_MAX = 120;
export const COACH_PHOTOS_MAX = 8;

const str = (v) => String(v ?? '').trim();

/** Sanitiza uma lista de URLs de foto (http/https). */
export function normalizeCoachPhotos(input) {
  return (Array.isArray(input) ? input : [])
    .map((p) => str(p))
    .filter((p) => /^https?:\/\//i.test(p))
    .slice(0, COACH_PHOTOS_MAX);
}

/**
 * Normaliza e valida o perfil de um coach.
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizeCoachProfile(input = {}) {
  const display_name = str(input.display_name);
  if (!display_name) {
    return { valid: false, error: 'Nome de exibição é obrigatório.', value: {} };
  }
  if (display_name.length > COACH_DISPLAY_NAME_MAX) {
    return { valid: false, error: `Nome muito longo (máx. ${COACH_DISPLAY_NAME_MAX}).`, value: { display_name: display_name.slice(0, COACH_DISPLAY_NAME_MAX) } };
  }
  const bio = str(input.bio).slice(0, COACH_BIO_MAX);
  const hourly_rate = (() => {
    const n = Number(input.hourly_rate);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  })();
  const regions = (Array.isArray(input.regions) ? input.regions : [])
    .map((r) => str(r).slice(0, COACH_REGION_MAX))
    .filter(Boolean)
    .slice(0, COACH_REGIONS_MAX);
  const modalities = (Array.isArray(input.modalities) ? input.modalities : [])
    .map((m) => str(m).slice(0, COACH_MODALITY_MAX))
    .filter(Boolean)
    .slice(0, COACH_MODALITIES_MAX);
  if (modalities.length === 0) {
    return { valid: false, error: 'Informe ao menos uma modalidade (ex: "Iniciantes", "Avançado", "DUPR 4.0+").', value: { display_name, bio, hourly_rate, regions } };
  }
  const certifications = (Array.isArray(input.certifications) ? input.certifications : [])
    .map((c) => str(c).slice(0, COACH_CERTIFICATION_MAX))
    .filter(Boolean)
    .slice(0, COACH_CERTIFICATIONS_MAX);
  return {
    valid: true,
    error: null,
    value: {
      display_name,
      bio,
      hourly_rate,
      regions,
      modalities,
      certifications,
      photos: normalizeCoachPhotos(input.photos),
      contact_whatsapp: str(input.contact_whatsapp).slice(0, 40),
      contact_email: str(input.contact_email).slice(0, 160),
      accepting_students: input.accepting_students !== false, // default true
      active: input.active !== false, // default true
    },
  };
}

/** Normaliza dados de residência (vínculo coach ↔ arena). */
export function normalizeCoachResidency(input = {}) {
  const coach_id = str(input.coach_id);
  const arena_id = str(input.arena_id);
  if (!coach_id) return { valid: false, error: 'coach_id é obrigatório.', value: {} };
  if (!arena_id) return { valid: false, error: 'arena_id é obrigatório.', value: { coach_id } };
  return {
    valid: true,
    error: null,
    value: {
      coach_id,
      arena_id,
      status: ['paused', 'pending'].includes(input.status) ? input.status : 'active',
      // weekly_schedule: { weekdays[], start, end, court_id? }
      weekly_schedule: input.weekly_schedule && typeof input.weekly_schedule === 'object' ? input.weekly_schedule : null,
      notes: str(input.notes).slice(0, 500),
      since: input.since || null,
    },
  };
}

/** Filtra coaches por critérios básicos. */
export function filterCoaches(coaches = [], { region, modality, accepting_only = true } = {}) {
  return coaches.filter((c) => {
    if (accepting_only && !c.accepting_students) return false;
    if (!c.active) return false;
    if (region && !(c.regions || []).some((r) => r.toLowerCase().includes(region.toLowerCase()))) return false;
    if (modality && !(c.modalities || []).some((m) => m.toLowerCase().includes(modality.toLowerCase()))) return false;
    return true;
  });
}

/** Indica se o coach pode receber novos alunos. */
export function canAcceptStudents(coach) {
  return Boolean(coach?.active && coach?.accepting_students);
}

/** Calcula idade da conta em dias (a partir de created_at). */
export function coachTenureDays(coach) {
  if (!coach?.created_at) return null;
  let ms = 0;
  const t = coach.created_at;
  if (typeof t.seconds === 'number') ms = t.seconds * 1000;
  else if (typeof t.toMillis === 'function') ms = t.toMillis();
  else if (typeof t === 'number') ms = t;
  else return null;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}
