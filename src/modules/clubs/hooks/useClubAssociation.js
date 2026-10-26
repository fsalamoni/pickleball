/**
 * Hooks da ASSOCIAÇÃO DO CLUBE (flag `club_association`).
 *
 * Leitura por React Query; toda mutação invalida a árvore `club-assoc` do
 * clube (barato, e nunca deixa cache velho). Fonte que falha é `isError` —
 * a tela nunca afirma "nenhum plano" / "nenhum associado" sem a consulta ter
 * dado certo (`docs/27-FALHA-NAO-E-VAZIO.md`).
 */
import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { clubPermsOf, isAssociationOpen, storeClubs } from '../domain/association.js';
import { useMyClubs, useMyMembership } from './useClubs.js';
import {
  deleteBenefit, deleteClubNews, deleteSponsor, fetchMemberBenefits, getBenefitSecret, listAllBenefits, listAllClubNews, listAllSponsors, listMemberClubNews,
  listPublicBenefits, listPublicClubNews, listPublicSponsors, notifyClubNews, saveBenefit, saveClubNews, saveSponsor, setBenefitActive,
} from '../services/contentService.js';
import {
  associationAction, getMyAffiliation, getMyStaff, getPix, getPlan, getRoles, importMembers, listAffiliations, listAllPlans, listCharges, listImports, listMyCharges,
  listPublicPlans, listStaff, saveAssociationSettings, savePix, savePlan, setPlanActive, staffAction, verifyClubCard,
} from '../services/associationService.js';
import { fetchMyClubData } from '../services/mineService.js';

export const assocKeys = {
  all: (clubId) => ['club-assoc', clubId],
  publicPlans: (clubId) => ['club-assoc', clubId, 'public-plans'],
  allPlans: (clubId) => ['club-assoc', clubId, 'all-plans'],
  plan: (clubId, planId) => ['club-assoc', clubId, 'plan', planId],
  mine: (clubId, uid) => ['club-assoc', clubId, 'mine', uid],
  myCharges: (clubId, uid) => ['club-assoc', clubId, 'my-charges', uid],
  myStaff: (clubId, uid) => ['club-assoc', clubId, 'my-staff', uid],
  affiliations: (clubId) => ['club-assoc', clubId, 'affiliations'],
  charges: (clubId) => ['club-assoc', clubId, 'charges'],
  pix: (clubId) => ['club-assoc', clubId, 'pix'],
  staff: (clubId) => ['club-assoc', clubId, 'staff'],
  roles: (clubId) => ['club-assoc', clubId, 'roles'],
  imports: (clubId) => ['club-assoc', clubId, 'imports'],
  publicBenefits: (clubId) => ['club-assoc', clubId, 'public-benefits'],
  allBenefits: (clubId) => ['club-assoc', clubId, 'all-benefits'],
  benefitSecret: (clubId, id) => ['club-assoc', clubId, 'benefit-secret', id],
  myBenefits: (clubId, uid) => ['club-assoc', clubId, 'my-benefits', uid],
  publicNews: (clubId) => ['club-assoc', clubId, 'public-news'],
  memberNews: (clubId) => ['club-assoc', clubId, 'member-news'],
  allNews: (clubId) => ['club-assoc', clubId, 'all-news'],
  publicSponsors: (clubId) => ['club-assoc', clubId, 'public-sponsors'],
  allSponsors: (clubId) => ['club-assoc', clubId, 'all-sponsors'],
  verify: (code) => ['club-assoc', 'verify', code],
};

/** Os planos da vitrine (públicos e ativos). */
export function usePublicPlans(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.publicPlans(clubId), queryFn: () => listPublicPlans(clubId), enabled: !!clubId && enabled, staleTime: 60_000 });
}

/** Todos os planos (quem gere). */
export function useAllPlans(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.allPlans(clubId), queryFn: () => listAllPlans(clubId), enabled: !!clubId && enabled });
}

export function useClubPlan(clubId, planId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.plan(clubId, planId), queryFn: () => getPlan(clubId, planId), enabled: !!clubId && !!planId && enabled, staleTime: 60_000 });
}

/** A filiação da pessoa logada neste clube. */
export function useMyAffiliation(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: assocKeys.mine(clubId, user?.uid), queryFn: () => getMyAffiliation(clubId, user?.uid), enabled: !!clubId && !!user?.uid && enabled });
}

export function useMyClubCharges(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: assocKeys.myCharges(clubId, user?.uid), queryFn: () => listMyCharges(clubId, user?.uid), enabled: !!clubId && !!user?.uid && enabled });
}

/** O cargo da pessoa logada neste clube (o que ela pode operar além de ser administradora). */
export function useMyClubStaff(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: assocKeys.myStaff(clubId, user?.uid), queryFn: () => getMyStaff(clubId, user?.uid), enabled: !!clubId && !!user?.uid && enabled, staleTime: 60_000 });
}

/**
 * O papel da pessoa na gestão do clube: administradora do clube (tudo) ou cargo
 * com permissões e mandato. `isLoading` só até as duas fontes responderem;
 * `isError` se alguma falhou (a tela não afirma "sem acesso" sem saber).
 */
export function useMyClubRole(clubId, { association = true } = {}) {
  const membership = useMyMembership(clubId);
  const admin = membership.data?.role === 'admin';
  // O cargo só vale para quem ainda é membro do clube (a regra e o servidor conferem o mesmo).
  // Com a associação desligada (`association: false`) não há cargo: a regra recusa a leitura
  // de `club_x` e a falha viraria "não carregou" para um membro comum.
  const staff = useMyClubStaff(clubId, { enabled: association && membership.isSuccess && !!membership.data && !admin });
  const perms = useMemo(() => clubPermsOf({ isClubAdmin: admin, staff: staff.data }), [admin, staff.data]);
  const temCargo = association && !admin && !!membership.data;
  const isLoading = membership.isLoading || (temCargo && staff.isLoading);
  const isError = membership.isError || (temCargo && staff.isError);
  return {
    perms, isAdmin: admin, isStaff: perms.length > 0, isLoading, isError,
    roleName: admin ? 'admin' : (staff.data?.role_name || ''),
    staffDoc: temCargo ? staff.data || null : null,
    refetch: () => { membership.refetch(); if (temCargo) staff.refetch(); },
  };
}

const juntarCargos = (queries) => ({
  docs: queries.map((q) => q.data || null),
  pendente: queries.some((q) => q.isLoading),
  falhou: queries.some((q) => q.isError),
});

/**
 * Os clubes em que a pessoa opera a loja no Mercado (ver `storeClubs`). O cargo
 * só é buscado nos clubes de associação aberta em que ela não é administradora.
 * `isError`: não dá para afirmar "nenhuma loja de clube" sem saber o cargo.
 */
export function useMyStoreClubs({ enabled = true } = {}) {
  const { user } = useAuth();
  const mine = useMyClubs({ enabled });
  const abertos = useMemo(() => (mine.data || []).filter(isAssociationOpen), [mine.data]);
  const semAdmin = useMemo(() => abertos.filter((c) => c.my_role !== 'admin'), [abertos]);
  const cargos = useQueries({
    queries: semAdmin.map((c) => ({ queryKey: assocKeys.myStaff(c.id, user?.uid), queryFn: () => getMyStaff(c.id, user?.uid), enabled: enabled && !!user?.uid, staleTime: 60_000 })),
    combine: juntarCargos,
  });
  const clubs = useMemo(() => {
    const porClube = {};
    semAdmin.forEach((c, i) => { if (cargos.docs[i]) porClube[c.id] = cargos.docs[i]; });
    return storeClubs(abertos, porClube);
  }, [abertos, semAdmin, cargos.docs]);
  return { clubs, isLoading: mine.isLoading || cargos.pendente, isError: mine.isError || cargos.falhou };
}

export function useClubAffiliations(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.affiliations(clubId), queryFn: () => listAffiliations(clubId), enabled: !!clubId && enabled });
}

export function useClubCharges(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.charges(clubId), queryFn: () => listCharges(clubId), enabled: !!clubId && enabled });
}

export function useClubPix(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.pix(clubId), queryFn: () => getPix(clubId), enabled: !!clubId && enabled });
}

export function useClubStaff(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.staff(clubId), queryFn: () => listStaff(clubId), enabled: !!clubId && enabled });
}

/** Os cargos que o clube montou (`null` = valem os modelos). Só quem tem "staff" lê. */
export function useClubRoles(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.roles(clubId), queryFn: () => getRoles(clubId), enabled: !!clubId && enabled });
}

/** As importações já feitas, com quem ficou sem conta (secretaria). */
export function useClubImports(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.imports(clubId), queryFn: () => listImports(clubId), enabled: !!clubId && enabled });
}

/* ------------------------------------------------ vantagens, comunicados, patrocinadores -- */

/** A vitrine pública de vantagens. */
export function usePublicBenefits(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.publicBenefits(clubId), queryFn: () => listPublicBenefits(clubId), enabled: !!clubId && enabled, staleTime: 60_000 });
}

/** Todas as vantagens, internas e pausadas inclusive (comunicação). */
export function useAllBenefits(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.allBenefits(clubId), queryFn: () => listAllBenefits(clubId), enabled: !!clubId && enabled });
}

/** O "como usar" e o código de uma vantagem (comunicação, ao editar). */
export function useBenefitSecret(clubId, id, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.benefitSecret(clubId, id), queryFn: () => getBenefitSecret(clubId, id), enabled: !!clubId && !!id && enabled });
}

/** As vantagens do associado em dia, com o segredo — do servidor (`{ eligible, items }`). */
export function useMyBenefits(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: assocKeys.myBenefits(clubId, user?.uid), queryFn: () => fetchMemberBenefits(clubId), enabled: !!clubId && !!user?.uid && enabled, retry: 1 });
}

/**
 * O que os clubes-associação guardam da PRÓPRIA pessoa e espera por ela (cobrança, convocação,
 * sanção, votação) — leitura do servidor, uma chamada para todos os clubes (Minha área).
 */
export function useMyClubAssociations({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['club-assoc-me', user?.uid, 'pending'], queryFn: () => fetchMyClubData('pending'), enabled: !!user?.uid && enabled, staleTime: 60_000, retry: 1 });
}

export function usePublicClubNews(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.publicNews(clubId), queryFn: () => listPublicClubNews(clubId), enabled: !!clubId && enabled, staleTime: 60_000 });
}

/** Os "só associados" publicados (qualquer membro do clube lê). */
export function useMemberClubNews(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.memberNews(clubId), queryFn: () => listMemberClubNews(clubId), enabled: !!clubId && enabled });
}

export function useAllClubNews(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.allNews(clubId), queryFn: () => listAllClubNews(clubId), enabled: !!clubId && enabled });
}

export function usePublicClubSponsors(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.publicSponsors(clubId), queryFn: () => listPublicSponsors(clubId), enabled: !!clubId && enabled, staleTime: 60_000 });
}

export function useAllClubSponsors(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.allSponsors(clubId), queryFn: () => listAllSponsors(clubId), enabled: !!clubId && enabled });
}

/** A verificação pública da carteirinha (sem login). */
export function useClubCardVerification(code) {
  return useQuery({ queryKey: assocKeys.verify(code), queryFn: () => verifyClubCard(code), enabled: !!code, retry: 1, staleTime: 30_000 });
}

/** Toda mutação da associação: invalida a árvore do clube (e a do clube em si, que guarda `association`). */
function useAssocMutation(clubId, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: assocKeys.all(clubId) });
      qc.invalidateQueries({ queryKey: ['club', clubId] });
      qc.invalidateQueries({ queryKey: ['club-membership', clubId] });
      qc.invalidateQueries({ queryKey: ['public-club', clubId] });
    },
  });
}

/** Uma ação do servidor (pedir, renovar, declarar, aprovar…): `mutate({ action, ...extra })`. */
export function useAssociationAction(clubId) {
  return useAssocMutation(clubId, ({ action, ...extra }) => associationAction(clubId, action, extra));
}

/** Uma ação da diretoria (nomear, prorrogar, tirar, montar cargo): `mutate({ action, ...extra })`. */
export function useClubStaffAction(clubId) {
  return useAssocMutation(clubId, ({ action, ...extra }) => staffAction(clubId, action, extra));
}

/** Importa a lista de associados: `mutate({ planId, rows })`. */
export function useImportMembers(clubId) {
  return useAssocMutation(clubId, ({ planId, rows }) => importMembers(clubId, planId, rows));
}

export function useSavePlan(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, ({ planId, input }) => savePlan(clubId, planId || null, input, user));
}

export function useSetPlanActive(clubId) {
  return useAssocMutation(clubId, ({ planId, active }) => setPlanActive(clubId, planId, active));
}

export function useSavePix(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, (input) => savePix(clubId, input, user));
}

export function useSaveBenefit(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, ({ benefitId, input }) => saveBenefit(clubId, benefitId || null, input, user));
}

export function useDeleteBenefit(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, (benefit) => deleteBenefit(clubId, benefit, user));
}

export function useSetBenefitActive(clubId) {
  return useAssocMutation(clubId, ({ benefitId, active }) => setBenefitActive(clubId, benefitId, active));
}

/** Salva o comunicado: `mutate({ club, input, newsId })`. */
export function useSaveClubNews(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, ({ club, input, newsId }) => saveClubNews(club, input, { uid: user?.uid, newsId }));
}

export function useDeleteClubNews(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, (news) => deleteClubNews(clubId, news, { uid: user?.uid }));
}

/** O aviso do comunicado aos associados em dia (servidor, uma vez só): `mutate(newsId)`. */
export function useNotifyClubNews(clubId) {
  return useAssocMutation(clubId, (newsId) => notifyClubNews(clubId, newsId));
}

/** Salva o patrocinador: `mutate({ sponsorId, input, total })`. */
export function useSaveSponsor(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, ({ sponsorId, input, total }) => saveSponsor(clubId, sponsorId || null, input, { actor: user, total }));
}

export function useDeleteSponsor(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, (sponsor) => deleteSponsor(clubId, sponsor, user));
}

export function useSaveAssociationSettings(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, (patch) => saveAssociationSettings(clubId, patch, user));
}
