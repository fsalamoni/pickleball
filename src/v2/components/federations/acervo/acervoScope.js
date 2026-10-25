/**
 * O ESCOPO do acervo: a mesma tela serve a federação e o clube-associação.
 *
 * Os formulários e o painel recebem uma "entidade" (`federation`): a federação como
 * ela é, ou o clube no mesmo formato (`clubDocsEntity`, com `kind: 'club'`). Só mudam
 * poucas coisas, todas aqui: qual função do servidor é chamada, em que pasta do
 * Storage o rascunho sobe, quais tipos de documento existem, para onde o link do
 * documento aponta e quais consultas a ação invalida. A régua do documento é a MESMA
 * (`functions/federationAcervoPolicy.js`, com a cópia em `domain/acervo`).
 */
import { useQueryClient } from '@tanstack/react-query';
import { acervoAction } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { tk } from '@/core/i18n';
import { DOC_CATEGORIES, DOC_TYPES, DOC_VISIBILITY_HINTS, DOC_VISIBILITY_LABELS, docPublicPath, acervoPublicPath } from '@/modules/federations/domain/acervo';
import { clubDocsAction } from '@/modules/clubs/services/clubDocsService';
import { clubDocCategories, clubDocPath, clubDocTypes, CLUB_DOC_TYPE_IDS } from '@/modules/clubs/domain/docs';
import { assocKeys } from '@/modules/clubs/hooks/useClubAssociation';

export const isClubDocs = (entity) => entity?.kind === 'club';

/** O clube no formato que o acervo lê (nome e identificador; o módulo do acervo está sempre ligado nele). */
export const clubDocsEntity = (club, { publica = false } = {}) => ({ id: club?.id, kind: 'club', name: club?.name || '', acronym: club?.name || club?.id, modules: { official_docs: true }, publica });

/** A pasta do Storage de onde o servidor aceita o arquivo novo. */
export const acervoFolder = (entity) => (isClubDocs(entity) ? 'clube-acervo' : 'federacao-acervo');

/** Os ids do escopo para a função do servidor. */
export const acervoScopeIds = (entity) => (isClubDocs(entity) ? { clubId: entity.id } : { federationId: entity.id });

/** Chama a função do servidor do escopo. */
export function callAcervo(entity, payload) {
  return isClubDocs(entity)
    ? clubDocsAction({ clubId: entity.id, ...payload })
    : acervoAction({ federationId: entity.id, ...payload });
}

/** Mutação do acervo. A federação segue com `useFederationMutation`; o clube soma a invalidação da árvore da associação. */
export function useAcervoMutation(entity, fn) {
  const qc = useQueryClient();
  return useFederationMutation(async (payload) => {
    try {
      return await fn(payload);
    } finally {
      if (isClubDocs(entity)) qc.invalidateQueries({ queryKey: assocKeys.all(entity.id) });
    }
  });
}

/** Os tipos e categorias que o escopo oferece. */
export const docTypesFor = (entity) => (isClubDocs(entity) ? clubDocTypes() : DOC_TYPES);
export const docCategoriesFor = (entity) => (isClubDocs(entity) ? clubDocCategories() : DOC_CATEGORIES);
/** Para a validação da tela: `null` = todos (federação). */
export const allowedDocTypeIds = (entity) => (isClubDocs(entity) ? CLUB_DOC_TYPE_IDS : null);

/** No clube a visibilidade "members" é "associados" (quem é membro do clube); o valor gravado é o mesmo. */
const CLUB_VISIBILITY_LABELS = Object.freeze({ public: tk('Público'), members: tk('Só associados'), staff: tk('Só a equipe') });
const CLUB_VISIBILITY_HINTS = Object.freeze({
  public: tk('Qualquer pessoa lê e baixa, sem conta.'),
  members: tk('Quem é membro do clube.'),
  staff: tk('Só quem é da equipe do clube.'),
});
export const visibilityLabelFor = (entity, v) => (isClubDocs(entity) ? CLUB_VISIBILITY_LABELS : DOC_VISIBILITY_LABELS)[v] || v;
export const visibilityHintFor = (entity, v) => (isClubDocs(entity) ? CLUB_VISIBILITY_HINTS : DOC_VISIBILITY_HINTS)[v] || '';

/** O endereço do documento (federação: `/f/:slug/acervo/:id`; clube: a aba Documentos da página do clube). */
export const docPathFor = (entity, docId) => (isClubDocs(entity) ? clubDocPath(entity.id, docId, { publica: entity.publica }) : docPublicPath(entity, docId));
/** O endereço do acervo como o público o vê. */
export const acervoPathFor = (entity) => (isClubDocs(entity) ? clubDocPath(entity.id, null, { publica: entity.publica }) : acervoPublicPath(entity));
