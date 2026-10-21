/**
 * V2FederationManage — a Central da federação (`/federacoes/:id/gerir?aba=`).
 *
 * Como a Central da arena: seções em dois grupos (Atender · Gerir), a aba na
 * URL, os painéis baixando sob demanda. Quem entra é a EQUIPE
 * (`federation_staff`) — e cada cargo só vê as seções da sua permissão
 * (`buildFederationSections(perms)`), com o mandato valendo. O admin da
 * plataforma entra só com o acesso justificado (`FedSupportAccessGate`:
 * motivo + prazo, no registro interno). Sem cargo, a pessoa volta à página.
 */
import React, { Suspense, lazy, useCallback, useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Landmark, Settings2 } from 'lucide-react';
import {
  useFederation, useFederationAffiliations, useFederationDocsAll, useFederationCharges, useFederationCourses, useFederationCredentials, useFederationDocuments, useFederationImports, useFederationMembers, useFederationNews, useFederationPlans,
  useFederationReports, useFederationResults, useFederationSanctions, useFederationStaff, useFederationTournaments, useFederationTransfers, useIncomingTransfers, useMyFederationRole,
} from '@/modules/federations/hooks/useFederations';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { FED_PERMISSION, FEDERATION_STATUS, FEDERATION_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Page, V2Skeleton } from '@/v2/ui/primitives';
import { V2SectionNav, V2SubTabs } from '@/v2/ui/V2SectionNav';
import { PAGE_TITLE } from '@/v2/ui/pageFrame';
import { FED_SECTION_GROUPS, buildFederationSections, sectionOfTab } from '@/v2/components/federations/federationSections';
import { FedBadges, FedLogo, FederationGate, fedPath } from '@/v2/components/federations/federationUi';
import FederationPendencias from '@/v2/components/federations/FederationPendencias';
import { FedSupportAccessBanner, FedSupportAccessGate } from '@/v2/components/federations/manage/FedSupportAccess';
import { t } from '@/core/i18n';

const FedHojePanel = lazy(() => import('@/v2/components/federations/manage/FedHojePanel'));
const FedMembersPanel = lazy(() => import('@/v2/components/federations/manage/FedMembersPanel'));
const FedFinancePanel = lazy(() => import('@/v2/components/federations/manage/FedFinancePanel'));
const FedIndicatorsPanel = lazy(() => import('@/v2/components/federations/manage/FedIndicatorsPanel'));
const FedStaffPanel = lazy(() => import('@/v2/components/federations/manage/FedStaffPanel'));
const FedSettingsPanel = lazy(() => import('@/v2/components/federations/manage/FedSettingsPanel'));
const FedAffiliationsPanel = lazy(() => import('@/v2/components/federations/manage/FedAffiliationsPanel'));
const FedCompetitionsPanel = lazy(() => import('@/v2/components/federations/manage/FedCompetitionsPanel'));
const FedSecretariatPanel = lazy(() => import('@/v2/components/federations/manage/FedSecretariatPanel'));
const FedCoursesPanel = lazy(() => import('@/v2/components/federations/manage/FedCoursesPanel'));
const FedDisciplinePanel = lazy(() => import('@/v2/components/federations/manage/FedDisciplinePanel'));
const FedCommsPanel = lazy(() => import('@/v2/components/federations/manage/FedCommsPanel'));
const FedAcervoPanel = lazy(() => import('@/v2/components/federations/manage/FedAcervoPanel'));
const FedAgendaPanel = lazy(() => import('@/v2/components/federations/manage/FedAgendaPanel'));
const FedCommentsPanel = lazy(() => import('@/v2/components/federations/manage/FedCommentsPanel'));

const ABAS_SECRETARIA = ['transferencias', 'documentos', 'importar'];

function Central({ federationId }) {
  const fq = useFederation(federationId);
  const papel = useMyFederationRole(federationId);
  const perms = papel.perms;
  const sections = useMemo(() => buildFederationSections(perms, fq.data, { isMaster: papel.isMaster }), [perms, fq.data, papel.isMaster]);
  const [params, setParams] = useSearchParams();
  const tabPedida = params.get('aba') || '';
  const secaoPedida = params.get('secao') || '';
  const secaoAtiva = useMemo(() => {
    if (secaoPedida) return sections.find((s) => s.id === secaoPedida) || sectionOfTab(sections, tabPedida);
    return sectionOfTab(sections, tabPedida);
  }, [sections, tabPedida, secaoPedida]);
  const tab = secaoAtiva?.tabs.some((x) => x.value === tabPedida) ? tabPedida : secaoAtiva?.tabs[0]?.value;
  const setTab = useCallback((value) => {
    setParams((atual) => { const novo = new URLSearchParams(atual); novo.set('aba', value); novo.delete('secao'); return novo; }, { replace: true });
  }, [setParams]);
  const irParaAba = (aba) => { if (sections.some((s) => s.tabs.some((x) => x.value === aba))) setTab(aba); };

  // Só quem tem a permissão consulta: a regra recusaria a leitura, e a falha
  // viraria "não carregou" numa seção que a pessoa nem vê.
  const podeFiliados = perms.includes(FED_PERMISSION.MEMBERS);
  const podeFinanceiro = perms.includes(FED_PERMISSION.FINANCE);
  const admin = perms.includes(FED_PERMISSION.ADMIN);
  const membersQ = useFederationMembers(federationId, { enabled: papel.isStaff && (podeFiliados || perms.includes(FED_PERMISSION.DISCIPLINE)) }); // a disciplina escolhe o filiado na lista
  const chargesQ = useFederationCharges(federationId, { enabled: papel.isStaff && podeFinanceiro });
  const plansQ = useFederationPlans(federationId, { enabled: papel.isStaff && (admin || podeFinanceiro || podeFiliados) });
  const staffQ = useFederationStaff(federationId, { enabled: papel.isStaff && perms.includes(FED_PERMISSION.STAFF) });
  const podeCompeticoes = perms.includes(FED_PERMISSION.COMPETITIONS);
  const affiliationsQ = useFederationAffiliations(federationId, { enabled: papel.isStaff && podeFiliados && fedModuleOn(fq.data, 'affiliations') });
  const tournamentsQ = useFederationTournaments(federationId, { enabled: papel.isStaff && podeCompeticoes && fedModuleOn(fq.data, 'tournaments') });
  const resultsQ = useFederationResults(federationId, { enabled: papel.isStaff && podeCompeticoes && fedModuleOn(fq.data, 'tournaments') });
  // PR 3 — secretaria, cursos e disciplina (cada consulta só com a permissão e o módulo).
  const transfersQ = useFederationTransfers(federationId, { enabled: papel.isStaff && podeFiliados });
  const incomingQ = useIncomingTransfers(federationId, { enabled: papel.isStaff && podeFiliados });
  const documentsQ = useFederationDocuments(federationId, { enabled: papel.isStaff && podeFiliados });
  const importsQ = useFederationImports(federationId, { enabled: papel.isStaff && podeFiliados && tab === 'importar' });
  const podeCursos = perms.includes(FED_PERMISSION.COURSES) && fedModuleOn(fq.data, 'courses');
  const coursesQ = useFederationCourses(federationId, { enabled: papel.isStaff && podeCursos });
  const credentialsQ = useFederationCredentials(federationId, { enabled: papel.isStaff && podeCursos && tab === 'credenciais' });
  const podeDisciplina = perms.includes(FED_PERMISSION.DISCIPLINE) && fedModuleOn(fq.data, 'discipline');
  const sanctionsQ = useFederationSanctions(federationId, { enabled: papel.isStaff && podeDisciplina });
  const reportsQ = useFederationReports(federationId, { enabled: papel.isStaff && podeDisciplina });
  // PR 4 — comunicação: as notícias só com a permissão e o módulo.
  const newsQ = useFederationNews(federationId, { enabled: papel.isStaff && perms.includes(FED_PERMISSION.COMMS) && fedModuleOn(fq.data, 'news') });
  // Acervo oficial: a permissão do acervo ou o admin (o admin master antigo não tem `docs` gravado).
  const podeAcervo = (perms.includes(FED_PERMISSION.DOCS) || admin) && fedModuleOn(fq.data, 'official_docs');
  const docsQ = useFederationDocsAll(federationId, { enabled: papel.isStaff && podeAcervo });

  if (fq.isError || papel.isError) return <V2Page><V2ErrorState title={t('Não carregou a federação')} onRetry={() => { fq.refetch(); papel.refetch(); }} /></V2Page>;
  if (fq.isLoading || papel.isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-24" /><V2Skeleton className="h-16" /><V2Skeleton className="h-64" /></V2Page>;
  const f = fq.data;
  if (!f) return <V2Page><V2EmptyState icon={Landmark} title={t('Federação não encontrada')} action={<V2Button asChild variant="secondary"><Link to="/federacoes">{t('Ver as federações')}</Link></V2Button>} /></V2Page>;
  if (papel.needsGrant) return <V2Page className="space-y-4"><V2BackLink to={fedPath(f)}>{f.acronym || f.name}</V2BackLink><FedSupportAccessGate federation={f} /></V2Page>;
  if (!papel.isStaff) return <Navigate to={fedPath(f)} replace />;

  const naoAprovada = f.status !== FEDERATION_STATUS.APPROVED;
  return (
    <V2Page className="space-y-6">
      <V2BackLink to={fedPath(f)}>{f.acronym || f.name}</V2BackLink>
      <header className="flex flex-wrap items-center gap-4">
        <FedLogo federation={f} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Central da federação')}</p>
          <h1 className={PAGE_TITLE}>{f.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <FedBadges federation={f} />
            {papel.grant ? <V2Badge tone="amber">{t('Suporte da plataforma')}</V2Badge> : papel.roleName && <V2Badge tone="ink">{papel.roleName}</V2Badge>}
            {naoAprovada && <V2Badge tone="amber">{t(FEDERATION_STATUS_LABELS[f.status] || f.status)}</V2Badge>}
          </div>
        </div>
        <Settings2 className="hidden h-6 w-6 text-gray-500 sm:block" aria-hidden="true" />
      </header>

      {papel.grant && <FedSupportAccessBanner federationId={f.id} grant={papel.grant} onExpired={papel.refetch} />}

      {naoAprovada && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {f.status === FEDERATION_STATUS.SUSPENDED ? t('A federação está suspensa pela plataforma: a página pública e as filiações ficam fechadas até a revisão.') : f.status === FEDERATION_STATUS.REJECTED ? t('O pedido de abertura foi recusado pela plataforma: {motivo}.', { motivo: f.review?.reason || t('sem motivo informado') }) : t('A federação ainda não foi aprovada pela plataforma. Você já pode preparar planos, Pix e página; a filiação abre depois da aprovação.')}
        </p>
      )}

      <FederationPendencias membersQ={membersQ} chargesQ={chargesQ} affiliationsQ={affiliationsQ} tournamentsQ={tournamentsQ} transfersQ={transfersQ} documentsQ={documentsQ} sanctionsQ={sanctionsQ} reportsQ={reportsQ} perms={perms} onIrParaAba={irParaAba} />

      <div className="space-y-3">
        <V2SectionNav ariaLabel={t('Seções da Central da federação')} dica="federacao-secoes" sections={sections} grupos={FED_SECTION_GROUPS} activeId={secaoAtiva.id} onSelect={(s) => setTab(s.tabs[0].value)} />
        {secaoAtiva.tabs.length > 1 && <V2SubTabs ariaLabel={t('Abas de {secao}', { secao: t(secaoAtiva.label) })} tabs={secaoAtiva.tabs} activeValue={tab} onSelect={(x) => setTab(x.value)} />}
      </div>

      <Suspense fallback={<V2Skeleton lines={6} />}>
        {secaoAtiva.id === 'hoje' && <FedHojePanel federation={f} membersQ={membersQ} chargesQ={chargesQ} plansQ={plansQ} affiliationsQ={affiliationsQ} tournamentsQ={tournamentsQ} perms={perms} onIrParaAba={irParaAba} />}
        {secaoAtiva.id === 'filiados' && tab === 'filiados-orgs' && <FedAffiliationsPanel affiliationsQ={affiliationsQ} />}
        {secaoAtiva.id === 'filiados' && ABAS_SECRETARIA.includes(tab) && <FedSecretariatPanel federation={f} tab={tab} membersQ={membersQ} transfersQ={transfersQ} incomingQ={incomingQ} documentsQ={documentsQ} importsQ={importsQ} plansQ={plansQ} />}
        {secaoAtiva.id === 'filiados' && tab !== 'filiados-orgs' && !ABAS_SECRETARIA.includes(tab) && <FedMembersPanel federation={f} membersQ={membersQ} documentsQ={documentsQ} tab={tab} />}
        {secaoAtiva.id === 'cursos' && <FedCoursesPanel federation={f} coursesQ={coursesQ} credentialsQ={credentialsQ} tab={tab} perms={perms} />}
        {secaoAtiva.id === 'disciplina' && <FedDisciplinePanel federation={f} membersQ={membersQ} sanctionsQ={sanctionsQ} reportsQ={reportsQ} tab={tab} />}
        {secaoAtiva.id === 'comunicacao' && <FedCommsPanel federation={f} newsQ={newsQ} tab={tab} />}
        {tab === 'comentarios' && <FedCommentsPanel federation={f} />}
        {secaoAtiva.id === 'acervo' && tab !== 'comentarios' && <FedAcervoPanel federation={f} docsQ={docsQ} tab={tab} isAdmin={admin} />}
        {secaoAtiva.id === 'agenda' && tab !== 'comentarios' && <FedAgendaPanel federation={f} perms={perms} />}
        {secaoAtiva.id === 'competicoes' && <FedCompetitionsPanel federation={f} tournamentsQ={tournamentsQ} resultsQ={resultsQ} tab={tab} />}
        {secaoAtiva.id === 'financeiro' && <FedFinancePanel federation={f} chargesQ={chargesQ} tab={tab} />}
        {secaoAtiva.id === 'indicadores' && <FedIndicatorsPanel federation={f} membersQ={membersQ} chargesQ={chargesQ} perms={perms} />}
        {secaoAtiva.id === 'equipe' && <FedStaffPanel federation={f} staffQ={staffQ} papel={papel} tab={tab} />}
        {secaoAtiva.id === 'config' && <FedSettingsPanel federation={f} plansQ={plansQ} tab={tab} />}
      </Suspense>
    </V2Page>
  );
}

export default function V2FederationManage() {
  const { federationId } = useParams();
  return <FederationGate><Central federationId={federationId} /></FederationGate>;
}
