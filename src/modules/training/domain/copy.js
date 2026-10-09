/**
 * "Copiar e adaptar": a cópia é um item NOVO, do autor que copiou, que
 * guarda de onde veio (`derived_from`) para dar o crédito.
 *
 * `locked` ESPELHA a regra (`trainingOpenToCopy` no `firestore.rules`), que é
 * quem decide de verdade: copiar um item que não está aberto a quem copia (o
 * treino que um professor mandou só aos alunos, ou uma cópia já travada) gera
 * uma cópia que nunca pode virar pública — senão bastaria copiar para
 * "lavar" o conteúdo privado de outra pessoa.
 */

import { isPubliclyListed, VISIBILITY } from './visibility.js';

const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** O original está aberto a quem copia (pode ser republicado)? */
export function isOpenToCopy(source = {}, uid) {
  const ownUnlocked = !!uid && source.author_uid === uid && source.derived_from?.locked !== true;
  return ownUnlocked || isPubliclyListed(source);
}

/** Dá para copiar? Conteúdo antigo do professor (`coach_content`) não. */
export function canCopyItem(source = {}, { uid } = {}) {
  if (!uid) return { ok: false, reason: 'Entre na sua conta.' };
  if (source.legacy) return { ok: false, reason: 'Este conteúdo antigo não pode ser copiado.' };
  if (!source.id) return { ok: false, reason: 'Item inválido.' };
  return { ok: true, reason: '' };
}

/** O `derived_from` que a cópia grava. */
export function derivedFromFor(source = {}, uid) {
  return {
    id: source.id,
    title: str(source.title, 120),
    author_name: str(source.author_name, 80),
    locked: !isOpenToCopy(source, uid),
  };
}

const NOT_CONTENT = new Set([
  'id', 'author_uid', 'author_role', 'author_name', 'author_photo', 'created_by', 'visibility', 'review',
  'review_note', 'reviewed_by', 'reviewed_at', 'hidden', 'hidden_reason', 'featured', 'shared_uids',
  'derived_from', 'ai_assisted', 'schema_version', 'created_at', 'updated_at', 'seed_slug', 'seed_version',
  'seed_customized', 'legacy', 'legacy_id',
]);

/**
 * O formulário inicial da cópia: só o CONTEÚDO, título marcado como cópia e
 * visibilidade "Só eu" (a pessoa decide publicar depois).
 * A mídia enviada por upload aponta para o arquivo do autor original: a cópia
 * mantém o link (leitura é aberta a quem tem conta), mas não o caminho — só o
 * dono apaga o próprio arquivo.
 */
export function buildCopyInput(source = {}) {
  const out = {};
  for (const [k, v] of Object.entries(source)) if (!NOT_CONTENT.has(k)) out[k] = v;
  out.title = str(`Cópia de ${str(source.title, 120)}`, 120);
  out.media = (Array.isArray(source.media) ? source.media : []).map((m) => ({ ...m, path: null }));
  out.visibility = VISIBILITY.PRIVADO;
  return out;
}
