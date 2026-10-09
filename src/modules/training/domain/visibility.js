/**
 * Quem vê, quem edita e quando um item de treino passa por revisão.
 *
 * ESTE ARQUIVO ESPELHA A REGRA de `training_items` no `firestore.rules`. A
 * regra é a defesa; aqui a tela só evita oferecer o que seria recusado e diz
 * à pessoa, ANTES de salvar, o que vai acontecer ("vai para revisão").
 */

export const VISIBILITY = Object.freeze({
  PUBLICO: 'publico',
  PRIVADO: 'privado',
  ALUNOS: 'alunos',
});

export const VISIBILITY_LABELS = Object.freeze({
  publico: 'Público',
  privado: 'Só eu',
  alunos: 'Meus alunos',
});

export const VISIBILITY_HINTS = Object.freeze({
  publico: 'Aparece na biblioteca para todas as pessoas da plataforma.',
  privado: 'Só você vê — e quem você escolher compartilhar.',
  alunos: 'Seus alunos ativos veem e podem usar. Ninguém mais.',
});

export const REVIEW = Object.freeze({
  NAO_SE_APLICA: 'nao_se_aplica',
  PENDENTE: 'pendente',
  APROVADO: 'aprovado',
  RECUSADO: 'recusado',
});

export const REVIEW_LABELS = Object.freeze({
  nao_se_aplica: '—',
  pendente: 'Em revisão',
  aprovado: 'Publicado',
  recusado: 'Não aprovado',
});

export const AUTHOR_ROLE = Object.freeze({
  PLATAFORMA: 'plataforma',
  PROFESSOR: 'professor',
  ATLETA: 'atleta',
});

export const AUTHOR_ROLE_LABELS = Object.freeze({
  plataforma: 'PickleRush',
  professor: 'Professor',
  atleta: 'Atleta',
});

/** `author_uid` do conteúdo da plataforma (não é uma conta). */
export const PLATFORM_AUTHOR = 'plataforma';

/** Visibilidades que este papel pode escolher. */
export function visibilityOptionsFor(role) {
  if (role === AUTHOR_ROLE.PROFESSOR) return [VISIBILITY.PRIVADO, VISIBILITY.ALUNOS, VISIBILITY.PUBLICO];
  return [VISIBILITY.PRIVADO, VISIBILITY.PUBLICO];
}

/**
 * Papel de autoria de quem está criando.
 * @param {{ asPlatform?: boolean, isAdmin?: boolean, isCoach?: boolean }} who
 */
export function authorRoleFor({ asPlatform = false, isAdmin = false, isCoach = false } = {}) {
  if (asPlatform && isAdmin) return AUTHOR_ROLE.PLATAFORMA;
  return isCoach ? AUTHOR_ROLE.PROFESSOR : AUTHOR_ROLE.ATLETA;
}

/**
 * O item público deste papel é publicado direto (sem fila)?
 * Padrões iguais aos da regra: atleta e professor passam por revisão; o
 * professor que o admin VERIFICOU (`verified_professors`) publica direto.
 * O admin pode desligar a revisão de cada papel.
 */
export function isAutoApproved(role, settings = {}, { isAdmin = false, uid = null } = {}) {
  if (isAdmin || role === AUTHOR_ROLE.PLATAFORMA) return true;
  if (role === AUTHOR_ROLE.PROFESSOR) {
    return settings.public_review_professor === false || isVerifiedProfessor(uid, settings);
  }
  return settings.public_review_atleta === false;
}

/** O admin verificou este professor (o público dele entra sem fila)? */
export function isVerifiedProfessor(uid, settings = {}) {
  return Boolean(uid) && Array.isArray(settings.verified_professors) && settings.verified_professors.includes(uid);
}

/**
 * O `review` que a escrita deve gravar.
 *
 * - Não público ⇒ `nao_se_aplica`.
 * - Público e publicado direto para o papel ⇒ `aprovado`.
 * - Já aprovado e a mudança é só de compartilhamento ⇒ continua `aprovado`
 *   (compartilhar não é editar o conteúdo).
 * - Senão ⇒ `pendente` (inclui editar um item aprovado: volta para a fila).
 *
 * @param {{ visibility: string, role: string, settings?: object, isAdmin?: boolean, uid?: string,
 *   previousReview?: string, onlySharingChanged?: boolean, adminReview?: string }} p
 */
export function reviewFor({
  visibility, role, settings = {}, isAdmin = false, uid = null,
  previousReview = null, onlySharingChanged = false, adminReview = null,
}) {
  if (visibility !== VISIBILITY.PUBLICO) return REVIEW.NAO_SE_APLICA;
  if (isAdmin && adminReview && Object.values(REVIEW).includes(adminReview)) return adminReview;
  if (isAutoApproved(role, settings, { isAdmin, uid })) return REVIEW.APROVADO;
  if (previousReview === REVIEW.APROVADO && onlySharingChanged) return REVIEW.APROVADO;
  return REVIEW.PENDENTE;
}

/** O que dizer ao autor antes de salvar um item público. */
export function publishNotice({ visibility, role, settings = {}, isAdmin = false, uid = null, wasApproved = false }) {
  if (visibility !== VISIBILITY.PUBLICO) return '';
  if (isAutoApproved(role, settings, { isAdmin, uid })) return 'Será publicado na biblioteca assim que você salvar.';
  return wasApproved
    ? 'Ao salvar, a nova versão passa por revisão da equipe antes de voltar à biblioteca.'
    : 'A equipe revisa antes de publicar. Enquanto isso, só você vê.';
}

/** Está na biblioteca pública agora? */
export function isPubliclyListed(item = {}) {
  return item.visibility === VISIBILITY.PUBLICO && item.review === REVIEW.APROVADO && item.hidden !== true;
}

/**
 * Quem pode ver este item (espelho da regra de leitura).
 * @param {object} item
 * @param {{ uid?: string, isAdmin?: boolean, activeCoachIds?: string[] }} viewer
 */
export function canSeeItem(item = {}, { uid = null, isAdmin = false, activeCoachIds = [] } = {}) {
  if (!uid) return false;
  if (isAdmin || item.author_uid === uid) return true;
  if (item.hidden === true) return false;
  if (isPubliclyListed(item)) return true;
  if (item.visibility === VISIBILITY.ALUNOS && activeCoachIds.includes(item.author_uid)) return true;
  return Array.isArray(item.shared_uids) && item.shared_uids.includes(uid);
}

export function isAuthor(item = {}, uid) {
  return !!uid && item.author_uid === uid;
}

/** Editar/excluir: o autor; o admin edita tudo (inclusive o da plataforma). */
export function canEditItem(item = {}, { uid = null, isAdmin = false } = {}) {
  if (!uid) return false;
  return isAdmin || item.author_uid === uid;
}

/**
 * Selo de autoria mostrado no cartão e na ficha.
 * @returns {{ label: string, role: string, name: string }}
 */
export function authorBadge(item = {}) {
  const role = item.author_role;
  if (role === AUTHOR_ROLE.PLATAFORMA) return { role, name: 'PickleRush', label: 'Equipe PickleRush' };
  const name = String(item.author_name || '').trim() || 'Atleta';
  if (role === AUTHOR_ROLE.PROFESSOR) return { role, name, label: `Professor ${name}` };
  return { role, name, label: name };
}

/** Rótulo de estado para o autor (lista "Meus"). */
export function itemStatusLabel(item = {}) {
  if (item.hidden === true) return 'Oculto pela equipe';
  if (item.visibility === VISIBILITY.PUBLICO) return REVIEW_LABELS[item.review] || 'Em revisão';
  return VISIBILITY_LABELS[item.visibility] || 'Só eu';
}
