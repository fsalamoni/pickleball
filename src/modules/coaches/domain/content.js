/**
 * Domínio puro da biblioteca de conteúdo do professor (Fase D — PRO-18).
 *
 * O professor publica drills/dicas (`coach_content/{id}`) com texto e/ou link
 * de vídeo, por categoria, com visibilidade pública ou restrita aos alunos
 * vinculados. Sem I/O — testável isoladamente.
 */

const str = (v) => String(v ?? '').trim();

export const CONTENT_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  STUDENTS: 'students',
});

export const CONTENT_VISIBILITY_LABELS = Object.freeze({
  [CONTENT_VISIBILITY.PUBLIC]: 'Público',
  [CONTENT_VISIBILITY.STUDENTS]: 'Só alunos',
});

export const CONTENT_CATEGORY = Object.freeze({
  DRILL: 'drill',
  TIP: 'dica',
  TACTIC: 'tatica',
  FITNESS: 'condicionamento',
  OTHER: 'outro',
});

export const CONTENT_CATEGORY_LABELS = Object.freeze({
  [CONTENT_CATEGORY.DRILL]: 'Drill',
  [CONTENT_CATEGORY.TIP]: 'Dica',
  [CONTENT_CATEGORY.TACTIC]: 'Tática',
  [CONTENT_CATEGORY.FITNESS]: 'Condicionamento',
  [CONTENT_CATEGORY.OTHER]: 'Outro',
});

export const CONTENT_TITLE_MAX = 120;
export const CONTENT_BODY_MAX = 5000;

/** Aceita apenas http(s) e retorna a url limpa (ou ''). */
export function sanitizeVideoUrl(value) {
  const url = str(value);
  if (!url) return '';
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return '';
  return url.slice(0, 500);
}

function normCategory(value) {
  const v = str(value).toLowerCase();
  return Object.values(CONTENT_CATEGORY).includes(v) ? v : CONTENT_CATEGORY.OTHER;
}

function normVisibility(value) {
  const v = str(value).toLowerCase();
  return v === CONTENT_VISIBILITY.STUDENTS ? CONTENT_VISIBILITY.STUDENTS : CONTENT_VISIBILITY.PUBLIC;
}

/**
 * Normaliza/valida um item de conteúdo. Exige título e ao menos um corpo
 * (texto ou vídeo).
 */
export function normalizeContent(input = {}) {
  const coach_id = str(input.coach_id);
  if (!coach_id) return { valid: false, error: 'coach_id é obrigatório.', value: {} };
  const title = str(input.title).slice(0, CONTENT_TITLE_MAX);
  if (!title) return { valid: false, error: 'Informe um título.', value: { coach_id } };
  const body = str(input.body).slice(0, CONTENT_BODY_MAX);
  const video_url = sanitizeVideoUrl(input.video_url);
  if (!body && !video_url) {
    return { valid: false, error: 'Adicione um texto ou um link de vídeo.', value: { coach_id, title } };
  }
  return {
    valid: true,
    error: null,
    value: {
      coach_id,
      title,
      body,
      video_url,
      category: normCategory(input.category),
      visibility: normVisibility(input.visibility),
    },
  };
}

/**
 * Indica se um conteúdo é visível para um observador.
 * @param {object} content
 * @param {{ isOwner?: boolean, isStudent?: boolean }} viewer
 */
export function isContentVisibleTo(content = {}, { isOwner = false, isStudent = false } = {}) {
  if (isOwner) return true;
  if (content.visibility === CONTENT_VISIBILITY.STUDENTS) return isStudent;
  return true; // público
}

/** Filtra a lista pelo que o observador pode ver. */
export function visibleContent(list = [], viewer = {}) {
  return list.filter((c) => isContentVisibleTo(c, viewer));
}

export function contentCategoryLabel(category) {
  return CONTENT_CATEGORY_LABELS[normCategory(category)] || category;
}

export function contentVisibilityLabel(visibility) {
  return CONTENT_VISIBILITY_LABELS[normVisibility(visibility)] || visibility;
}

/** Ordena por data de criação (mais recente primeiro) quando disponível. */
export function sortContent(list = []) {
  const ms = (c) => {
    const t = c.created_at;
    if (!t) return 0;
    if (typeof t.seconds === 'number') return t.seconds * 1000;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t === 'number') return t;
    return 0;
  };
  return [...list].sort((a, b) => ms(b) - ms(a));
}
