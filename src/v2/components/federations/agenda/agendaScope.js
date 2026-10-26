/**
 * O ESCOPO da agenda oficial: a mesma tela serve a federação e o clube-associação.
 *
 * Os formulários, a lista e a página do evento recebem uma "entidade" (`federation`): a
 * federação como ela é, ou o clube no mesmo formato (`clubAgendaEntity`, com
 * `kind: 'club'`). Só mudam poucas coisas, todas aqui: qual função do servidor é
 * chamada, de onde vêm os eventos (e quais o leitor pode ver), de onde vêm os
 * documentos ligados, para onde os links apontam e o que a invalidação atinge. A régua
 * do evento é a MESMA (`functions/federationAgendaPolicy.js`, com a cópia em
 * `domain/agenda`). O clube tem convocação e resultado de reunião (Bloco F1), mas não
 * seguir nem comentários: `hasMeetings`/`hasFollow`/`hasComments` dizem onde a tela os esconde.
 */
import { useQueryClient } from '@tanstack/react-query';
import { tk } from '@/core/i18n';
import { agendaAction } from '@/modules/federations/services/federationService';
import { useFederationMutation, useVisibleAcervo, useVisibleAgenda } from '@/modules/federations/hooks/useFederations';
import { agendaFeedPath, agendaPublicPath, eventPublicPath } from '@/modules/federations/domain/agenda';
import { clubAgendaAction } from '@/modules/clubs/services/clubAgendaService';
import { clubAgendaFeedPath, clubAgendaPath } from '@/modules/clubs/domain/agenda';
import { useClubEventsAll, useReadableClubEvents } from '@/modules/clubs/hooks/useClubAgenda';
import { useClubDocsAll } from '@/modules/clubs/hooks/useClubDocs';
import { assocKeys } from '@/modules/clubs/hooks/useClubAssociation';

export const isClubAgenda = (entity) => entity?.kind === 'club';

/**
 * O clube no formato que a agenda lê. `staff`: quem cuida da agenda (lê tudo, o "só a equipe"
 * inclusive); `member`: quem é membro do clube (lê o público e o "só associados"); `publica`:
 * a vitrine sem login (`/c/:id`).
 */
export const clubAgendaEntity = (club, { publica = false, member = false, staff = false } = {}) => ({
  id: club?.id, kind: 'club', name: club?.name || '', acronym: club?.name || club?.id, slug: club?.id, modules: { calendar: true, official_docs: true }, publica, member, staff,
});

/** A reunião tem convocação, pauta e ata? (Federação e clube: sim — Bloco F1.) */
export const hasMeetings = () => true;
/** Seguir as publicações oficiais e comentar o evento são da federação. */
export const hasFollow = (entity) => !isClubAgenda(entity);
export const hasComments = (entity) => !isClubAgenda(entity);

/** Chama a função do servidor do escopo. */
export function callAgenda(entity, payload) {
  return isClubAgenda(entity)
    ? clubAgendaAction({ clubId: entity.id, ...payload })
    : agendaAction({ federationId: entity.id, ...payload });
}

/** Mutação da agenda. A federação segue com `useFederationMutation`; o clube soma a invalidação da árvore da associação. */
export function useAgendaMutation(entity, fn) {
  const qc = useQueryClient();
  return useFederationMutation(async (payload) => {
    try {
      return await fn(payload);
    } finally {
      if (isClubAgenda(entity)) qc.invalidateQueries({ queryKey: assocKeys.all(entity.id) });
    }
  });
}

/**
 * A agenda que ESTA pessoa vê, no formato de `useVisibleAgenda`. No clube: a equipe lê tudo; o
 * membro, `members`; o visitante, `pub` — uma consulta só, e a falha é dita (`isError`).
 */
export function useScopedAgenda(entity) {
  const club = isClubAgenda(entity);
  const fed = useVisibleAgenda(entity, { enabled: !club });
  const todos = useClubEventsAll(entity?.id, { enabled: club && Boolean(entity.staff) });
  const lidos = useReadableClubEvents(entity?.id, { member: Boolean(entity?.member), enabled: club && !entity.staff });
  if (!club) return fed;
  const q = entity.staff ? todos : lidos;
  return {
    ligado: true, items: q.isSuccess ? q.data : null, isLoading: q.isLoading, isError: q.isError, incompleto: false,
    refetch: () => q.refetch(), filiado: Boolean(entity.member), isStaff: Boolean(entity.staff), perms: [],
  };
}

/** Os documentos do acervo que o formulário oferece para ligar ao evento (só os publicados). */
export function useScopedAcervo(entity) {
  const club = isClubAgenda(entity);
  const fed = useVisibleAcervo(entity, { enabled: !club });
  const cl = useClubDocsAll(entity?.id, { enabled: club });
  if (!club) return fed;
  return { ligado: true, docs: cl.isSuccess ? cl.data.filter((d) => d.status === 'published') : null, isError: cl.isError, refetch: () => cl.refetch() };
}

/** A página da agenda como o público a vê. */
export const agendaPathFor = (entity) => (isClubAgenda(entity) ? clubAgendaPath(entity.id, null, { publica: entity.publica }) : agendaPublicPath(entity));
/** A página de um evento (o torneio chancelado, só na federação, aponta para o torneio). */
export const eventPathFor = (entity, ev, opts) => (isClubAgenda(entity) ? clubAgendaPath(entity.id, ev?.id, { publica: entity.publica }) : eventPublicPath(entity, ev, opts));
/** A agenda assinável (só o público). */
export const feedPathFor = (entity) => (isClubAgenda(entity) ? clubAgendaFeedPath(entity.id) : agendaFeedPath(entity));

/** Como cada visibilidade se explica ao marcar o evento. */
const FED_HINTS = {
  public: tk('Aparece na página da federação, na agenda assinável e para quem segue.'),
  members: tk('Só filiados em dia e a equipe veem.'),
  staff: tk('Só a equipe vê. Bom para preparar antes de divulgar: enquanto só a equipe viu, dá para apagar.'),
};
const CLUB_HINTS = {
  public: tk('Aparece na página do clube, na vitrine e na agenda assinável.'),
  members: tk('Só quem é do clube e a equipe veem.'),
  staff: tk('Só a equipe vê. Bom para preparar antes de divulgar: enquanto só a equipe viu, dá para apagar.'),
};
export const agendaVisibilityHint = (entity, v) => (isClubAgenda(entity) ? CLUB_HINTS : FED_HINTS)[v] || '';
