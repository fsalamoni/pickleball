/**
 * FEDERAÇÕES — ganchos do React Query. As chaves vêm de `fedKeys` (fonte
 * única: chave escrita duas vezes diverge e busca de novo o que já estava em
 * cache).
 */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import * as svc from '../services/federationService';
import { FED_PERMISSION } from '../domain/constants.js';
import { grantActive, staffIsMaster, staffPerms, staffRoleName } from '../domain/staff.js';

export const fedKeys = {
  all: ['federacoes'],
  publicList: ['federacoes', 'diretorio'],
  adminList: ['federacoes', 'admin', 'todas'],
  one: (id) => ['federacoes', 'federacao', id],
  bySlug: (slug) => ['federacoes', 'slug', slug],
  priv: (id) => ['federacoes', 'federacao', id, 'privado'],
  staff: (id) => ['federacoes', 'federacao', id, 'equipe'],
  plans: (id) => ['federacoes', 'federacao', id, 'planos'],
  members: (id) => ['federacoes', 'federacao', id, 'filiados'],
  charges: (id) => ['federacoes', 'federacao', id, 'cobrancas'],
  myRoles: (uid) => ['federacoes', 'meus-papeis', uid],
  myGrant: (fedId, uid) => ['federacoes', 'federacao', fedId, 'acesso-suporte', uid],
  accessLogs: ['federacoes', 'admin', 'acessos'],
  myMemberships: (uid) => ['federacoes', 'minhas-filiacoes', uid],
  myCharges: (uid) => ['federacoes', 'minhas-cobrancas', uid],
  myCreated: (uid) => ['federacoes', 'pedidas-por', uid],
  membership: (fedId, uid) => ['federacoes', 'federacao', fedId, 'filiacao', uid],
  verify: (code) => ['federacoes', 'verificar', code],
  affiliations: (id) => ['federacoes', 'federacao', id, 'filiados-orgs'],
  approvedAffiliations: (id) => ['federacoes', 'federacao', id, 'filiados-orgs', 'aprovados'],
  orgAffiliations: (kind, orgId, approvedOnly) => ['federacoes', 'organizacao', kind, orgId, approvedOnly ? 'aprovadas' : 'todas'],
  tournaments: (id) => ['federacoes', 'federacao', id, 'torneios'],
  results: (id) => ['federacoes', 'federacao', id, 'resultados'],
  tournamentResults: (tid) => ['federacoes', 'torneio', tid, 'resultados'],
  personResults: (uid) => ['federacoes', 'pessoa', uid, 'resultados'],
  ranking: (id, season) => ['federacoes', 'federacao', id, 'ranking', season],
  // PR 3
  myDependents: (uid) => ['federacoes', 'meus-dependentes', uid],
  memberPrivate: (memberId) => ['federacoes', 'filiacao-privado', memberId],
  myDocuments: (uid) => ['federacoes', 'meus-documentos', uid],
  documents: (id) => ['federacoes', 'federacao', id, 'documentos'],
  myTransfers: (uid) => ['federacoes', 'minhas-transferencias', uid],
  transfers: (id) => ['federacoes', 'federacao', id, 'transferencias'],
  incomingTransfers: (id) => ['federacoes', 'federacao', id, 'transferencias-chegando'],
  imports: (id) => ['federacoes', 'federacao', id, 'importacoes'],
  courses: (id) => ['federacoes', 'federacao', id, 'cursos'],
  publicCourses: (id) => ['federacoes', 'federacao', id, 'cursos', 'publicos'],
  courseEnrollments: (courseId) => ['federacoes', 'curso', courseId, 'inscritos'],
  myEnrollments: (uid) => ['federacoes', 'minhas-inscricoes-curso', uid],
  myCredentials: (uid) => ['federacoes', 'minhas-credenciais', uid],
  credentials: (id) => ['federacoes', 'federacao', id, 'credenciais'],
  publicCredentials: (id) => ['federacoes', 'federacao', id, 'credenciais', 'publicas'],
  mySanctions: (uid) => ['federacoes', 'minhas-sancoes', uid],
  sanctions: (id) => ['federacoes', 'federacao', id, 'sancoes'],
  report: (id) => ['federacoes', 'ouvidoria', id],
  myReports: (uid) => ['federacoes', 'minhas-manifestacoes', uid],
  reports: (id) => ['federacoes', 'federacao', id, 'ouvidoria'],
  // PR 4
  news: (id) => ['federacoes', 'federacao', id, 'noticias'],
  publicNews: (id) => ['federacoes', 'federacao', id, 'noticias', 'publicas'],
  memberNews: (id) => ['federacoes', 'federacao', id, 'noticias', 'filiados'],
};

/** As federações estão ligadas para quem vê? (a flag do admin) */
export const useFederationsEnabled = () => useFeatureFlag(FEATURE_FLAG.FEDERATIONS);

export function usePublicFederations({ enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.publicList, queryFn: svc.listPublicFederations, staleTime: 5 * 60_000, enabled });
}

export function useFederation(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.one(id), queryFn: () => svc.getFederation(id), enabled: !!id && enabled });
}

export function useFederationBySlug(slug) {
  return useQuery({ queryKey: fedKeys.bySlug(slug), queryFn: () => svc.getFederationBySlug(slug), enabled: !!slug });
}

export function useFederationPrivate(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.priv(id), queryFn: () => svc.getFederationPrivate(id), enabled: !!id && enabled });
}

export function useFederationStaff(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.staff(id), queryFn: () => svc.listFederationStaff(id), enabled: !!id && enabled });
}

export function useFederationPlans(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.plans(id), queryFn: () => svc.listFederationPlans(id), enabled: !!id && enabled });
}

export function useFederationMembers(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.members(id), queryFn: () => svc.listFederationMembers(id), enabled: !!id && enabled });
}

export function useFederationCharges(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.charges(id), queryFn: () => svc.listFederationCharges(id), enabled: !!id && enabled });
}

/** Admin da plataforma: todas, em qualquer estado. */
export function useAdminFederations({ enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.adminList, queryFn: svc.listAllFederations, enabled });
}

/** As federações que a pessoa pediu para abrir (pendente, recusada…). */
export function useMyCreatedFederations({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.myCreated(user?.uid), queryFn: () => svc.listFederationsCreatedBy(user?.uid), enabled: !!user?.uid && enabled });
}

/** Os papéis da pessoa em todas as federações — uma consulta, compartilhada. */
export function useMyFederationRoles({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.myRoles(user?.uid), queryFn: () => svc.listMyStaffRoles(user?.uid), enabled: !!user?.uid && enabled, staleTime: 60_000 });
}

/** O acesso de suporte do admin da plataforma a esta federação (só o admin consulta). */
export function useMyFederationGrant(fedId, { enabled = true } = {}) {
  const { user, isPlatformAdmin } = useAuth();
  return useQuery({ queryKey: fedKeys.myGrant(fedId, user?.uid), queryFn: () => svc.getMyFederationGrant(fedId, user?.uid), enabled: !!fedId && !!user?.uid && !!isPlatformAdmin && enabled });
}

/** Admin da plataforma: o registro dos acessos às federações. */
export function useFederationAccessLogs({ enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.accessLogs, queryFn: svc.listFederationAccessLogs, enabled });
}

/**
 * O cargo e as permissões de quem vê NESTA federação: o cargo com o mandato
 * valendo (`staffPerms`). O admin da plataforma tem tudo SÓ com o acesso
 * justificado valendo (`grant`); sem ele, `needsGrant` diz que a Central deve
 * pedir o motivo antes.
 */
export function useMyFederationRole(fedId) {
  const { isPlatformAdmin } = useAuth();
  const q = useMyFederationRoles({ enabled: !!fedId });
  const g = useMyFederationGrant(fedId);
  const { refetch: qRefetch } = q;
  const { refetch: gRefetch } = g;
  return useMemo(() => {
    const agora = Date.now();
    const mine = (q.data || []).find((s) => s.federation_id === fedId) || null;
    const grant = isPlatformAdmin && grantActive(g.data, agora) ? g.data : null;
    const proprias = staffPerms(mine, agora);
    const perms = grant ? Object.values(FED_PERMISSION) : proprias;
    const carregando = q.isLoading || (isPlatformAdmin && g.isLoading);
    return {
      staff: mine, role: mine?.role || null, roleName: staffRoleName(mine), isMaster: Boolean(grant) || (staffIsMaster(mine) && proprias.length > 0),
      perms, has: (p) => perms.includes(p), isStaff: perms.length > 0, grant,
      needsGrant: Boolean(isPlatformAdmin) && !grant && proprias.length === 0 && !carregando,
      isLoading: carregando, isError: q.isError || g.isError, refetch: () => { qRefetch(); if (isPlatformAdmin) gRefetch(); },
    };
  }, [q.data, q.isLoading, q.isError, qRefetch, g.data, g.isLoading, g.isError, gRefetch, fedId, isPlatformAdmin]);
}

export function useMyMemberships({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.myMemberships(user?.uid), queryFn: () => svc.listMyMemberships(user?.uid), enabled: !!user?.uid && enabled });
}

export function useMyFederationCharges({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.myCharges(user?.uid), queryFn: () => svc.listMyCharges(user?.uid), enabled: !!user?.uid && enabled });
}

/** A minha filiação numa federação. */
export function useMyMembership(fedId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.membership(fedId, user?.uid), queryFn: () => svc.getMembership(fedId, user?.uid), enabled: !!fedId && !!user?.uid && enabled });
}

/** Verificação pública da carteirinha (sem conta). */
export function useCardVerification(code) {
  return useQuery({ queryKey: fedKeys.verify(code), queryFn: () => svc.verifyCard(code), enabled: !!code, retry: 1, staleTime: 30_000 });
}

/** Toda mutação invalida a árvore das federações (barato, e nunca deixa cache velho). */
export function useFederationMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: fedKeys.all }) });
}

/* ------------------------------------------- PR 2: filiados, chancela, ranking -- */

export function useFederationAffiliations(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.affiliations(id), queryFn: () => svc.listFederationAffiliations(id), enabled: !!id && enabled });
}

/** Os filiados aprovados — público (página da federação). */
export function useApprovedAffiliations(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.approvedAffiliations(id), queryFn: () => svc.listApprovedAffiliations(id), enabled: !!id && enabled, staleTime: 5 * 60_000 });
}

/** As filiações de um clube/arena. `approvedOnly` para quem não gere (o selo público). */
export function useOrgAffiliations(kind, orgId, { approvedOnly = false, enabled = true } = {}) {
  const ligado = useFederationsEnabled();
  return useQuery({ queryKey: fedKeys.orgAffiliations(kind, orgId, approvedOnly), queryFn: () => svc.listOrgAffiliations(kind, orgId, { approvedOnly }), enabled: !!kind && !!orgId && ligado && enabled, staleTime: 5 * 60_000 });
}

/** Os torneios ligados à federação (pendentes de chancela e chancelados). */
export function useFederationTournaments(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.tournaments(id), queryFn: () => svc.listFederationTournaments(id), enabled: !!id && enabled });
}

export function useFederationResults(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.results(id), queryFn: () => svc.listFederationResults(id), enabled: !!id && enabled });
}

/** O que o organizador já enviou deste torneio. */
export function useTournamentFederationResults(tournamentId, { enabled = true } = {}) {
  const ligado = useFederationsEnabled();
  return useQuery({ queryKey: fedKeys.tournamentResults(tournamentId), queryFn: () => svc.listTournamentFederationResults(tournamentId), enabled: !!tournamentId && ligado && enabled });
}

/** Os resultados oficiais em que a PESSOA aparece (a declaração de vínculo lista os desta federação). Leitura pública. */
export function usePersonFederationResults(uid, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.personResults(uid), queryFn: () => svc.listResultsWith(uid), enabled: !!uid && enabled, staleTime: 60_000 });
}

/** O ranking oficial da temporada (gravado pelo servidor; `null` = ainda não há). */
export function useFederationRanking(id, season, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.ranking(id, season), queryFn: () => svc.getFederationRanking(id, season), enabled: !!id && !!season && enabled, staleTime: 60_000 });
}

/* ------------------------------------------- PR 3: dependentes, documentos, transferências, cursos, disciplina -- */

const porUid = (fn, chave) => ({ enabled = true } = {}) => {
  const { user } = useAuth();
  return useQuery({ queryKey: chave(user?.uid), queryFn: () => fn(user?.uid), enabled: !!user?.uid && enabled });
};
const porFed = (fn, chave) => (id, { enabled = true } = {}) => useQuery({ queryKey: chave(id), queryFn: () => fn(id), enabled: !!id && enabled });

/** As filiações dos dependentes (menores) que a pessoa filiou. */
export const useMyDependents = porUid(svc.listMyDependents, fedKeys.myDependents);
export const useMyDocuments = porUid(svc.listMyDocuments, fedKeys.myDocuments);
export const useMyTransfers = porUid(svc.listMyTransfers, fedKeys.myTransfers);
export const useMyEnrollments = porUid(svc.listMyEnrollments, fedKeys.myEnrollments);
export const useMyCredentials = porUid(svc.listMyCredentials, fedKeys.myCredentials);
export const useMySanctions = porUid(svc.listMySanctions, fedKeys.mySanctions);
export const useMyReports = porUid(svc.listMyReports, fedKeys.myReports);

/** `private/data` de uma filiação (o próprio/responsável; a secretaria passa por `revealMemberPrivate`). */
export function useMemberPrivate(memberId, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.memberPrivate(memberId), queryFn: () => svc.getMemberPrivate(memberId), enabled: !!memberId && enabled });
}

export const useFederationDocuments = porFed(svc.listFederationDocuments, fedKeys.documents);
export const useFederationTransfers = porFed(svc.listFederationTransfers, fedKeys.transfers);
export const useIncomingTransfers = porFed(svc.listIncomingTransfers, fedKeys.incomingTransfers);
export const useFederationImports = porFed(svc.listFederationImports, fedKeys.imports);
export const useFederationCourses = porFed(svc.listFederationCourses, fedKeys.courses);
export const useFederationCredentials = porFed(svc.listFederationCredentials, fedKeys.credentials);
export const useFederationSanctions = porFed(svc.listFederationSanctions, fedKeys.sanctions);
export const useFederationReports = porFed(svc.listFederationReports, fedKeys.reports);

/** Os cursos que o público vê (página da federação). */
export function usePublicCourses(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.publicCourses(id), queryFn: () => svc.listPublicCourses(id), enabled: !!id && enabled, staleTime: 5 * 60_000 });
}

/** O diretório público de credenciados. */
export function usePublicCredentials(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.publicCredentials(id), queryFn: () => svc.listPublicCredentials(id), enabled: !!id && enabled, staleTime: 5 * 60_000 });
}

export function useCourseEnrollments(courseId, fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.courseEnrollments(courseId), queryFn: () => svc.listCourseEnrollments(courseId, fedId), enabled: !!courseId && !!fedId && enabled });
}

/* ---------------------------------------------- PR 4: notícias -- */

/** Todas as notícias (equipe `comms`/`admin`). */
export const useFederationNews = porFed(svc.listFederationNews, fedKeys.news);

/** As notícias públicas publicadas (página da federação, dentro e fora do app). */
export function usePublicNews(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.publicNews(id), queryFn: () => svc.listPublicNews(id), enabled: !!id && enabled, staleTime: 5 * 60_000 });
}

/** As notícias "só filiados" — só com filiação ATIVA (`enabled` decide; a regra confere). */
export function useMemberNews(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.memberNews(id), queryFn: () => svc.listMemberNews(id), enabled: !!id && enabled, staleTime: 5 * 60_000 });
}

/** Uma manifestação pelo protocolo (o id). */
export function useReport(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.report(id), queryFn: () => svc.getReportById(id), enabled: !!id && enabled, retry: 0 });
}
