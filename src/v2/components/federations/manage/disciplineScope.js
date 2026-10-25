/**
 * O ESCOPO da disciplina: a mesma tela de sanções e de ouvidoria serve a federação e o
 * clube-associação (Bloco E1).
 *
 * O painel recebe uma "entidade" (`federation`): a federação como ela é, ou o clube no
 * mesmo formato (`clubDisciplineEntity`, com `kind: 'club'`). Só mudam poucas coisas, todas
 * aqui: qual função do servidor é chamada (e com que nome de campo), o que a invalidação
 * atinge e os textos que falam de "filiado/federação/torneio chancelado". A régua é a MESMA
 * (`functions/clubDiscipline.js` espelha `federationDiscipline.js`); o clube não tem
 * início futuro nem antidopagem (essas duas são da federação).
 */
import { useQueryClient } from '@tanstack/react-query';
import { disciplineAction, updateReport } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { clubDisciplineAction } from '@/modules/clubs/services/clubDisciplineService';
import { assocKeys } from '@/modules/clubs/hooks/useClubAssociation';

export const isClubDiscipline = (entity) => entity?.kind === 'club';

/** O clube no formato que o painel lê (a disciplina do clube está sempre ligada para quem tem o cargo). */
export const clubDisciplineEntity = (club) => ({
  id: club?.id, kind: 'club', name: club?.name || '', acronym: club?.name || club?.id, slug: club?.id, modules: { discipline: true },
});

/** O texto da federação ou o do clube. */
export const pick = (entity, daFederacao, doClube) => (isClubDiscipline(entity) ? doClube : daFederacao);

/** Chama a função do servidor do escopo (`memberId` da tela é o `userId` do clube). */
export function callDiscipline(entity, payload) {
  if (!isClubDiscipline(entity)) return disciplineAction(payload);
  const { memberId, federationId: _fed, starts_at: _inicio, basis: _base, ...resto } = payload;
  return clubDisciplineAction({ clubId: entity.id, ...(memberId ? { userId: memberId } : {}), ...resto });
}

/** A disciplina muda o estado da manifestação e anota. */
export function callReportUpdate(entity, rep, patch) {
  if (!isClubDiscipline(entity)) return updateReport(rep, patch);
  return clubDisciplineAction({ clubId: entity.id, action: 'report_update', reportId: rep.id, status: patch.status, notes: patch.notes });
}

/** Mutação da disciplina. A federação segue com `useFederationMutation`; o clube soma a invalidação da árvore da associação. */
export function useDisciplineMutation(entity, fn) {
  const qc = useQueryClient();
  return useFederationMutation(async (payload) => {
    try {
      return await fn(payload);
    } finally {
      if (isClubDiscipline(entity)) qc.invalidateQueries({ queryKey: assocKeys.all(entity.id) });
    }
  });
}
