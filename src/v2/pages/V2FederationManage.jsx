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
import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink, Eye, Landmark, ShieldCheck } from 'lucide-react';
import {
  useFederation, useFederationAffiliations, useFederationDocsAll, useFederationEvents, useFederationCharges, useFederationCourses, useFederationCredentials, useFederationDocuments, useFederationImports, useFederationMembers, useFederationNews, useFederationPlans,
  useFederationReports, useFederationResults, useFederationSanctions, useFederationStaff, useFederationTournaments, useFederationTransfers, useIncomingTransfers, useMyFederationRole,
} from '@/modules/federations/hooks/useFederations';
import { fedModuleOn, isFederationHidden, isFederationPublic } from '@/modules/federations/domain/federation';
import { FED_PERMISSION, FEDERATION_STATUS, FEDERATION_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Page, V2Skeleton } from '@/v2/ui/primitives';
import { V2SectionNav, V2SubTabs } from '@/v2/ui/V2SectionNav';
import { PAGE_TITLE } from '@/v2/ui/pageFrame';
import { FED_SECTION_GROUPS, buildFederationSections, residualModules, sectionOfTab } from '@/v2/components/federations/federationSections';
import { FedBadges, FedLogo, FederationGate, fedPath, fedPublicPath } from '@/v2/components/federations/federationUi';
import { fedPreviewPath } from '@/v2/components/federations/profile/FedStaffBar';
import FederationPendencias from '@/v2/components/federations/FederationPendencias';
import { FedSupportAccessBanner, FedSupportAccessGate } from '@/v2/components/federations/manage/FedSupportAccess';
import { FedHiddenBanner } from '@/v2/components/federations/manage/FedPublication';
import { t } from '@/core/i18n';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { descartarAlteracoes, haAlteracaoNaoSalva } from '@/v2/components/federations/manage/naoSalvo';

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
const FedCompliancePanel = lazy(() => import('@/v2/components/federations/manage/FedCompliancePanel'));

const ABAS_SECRETARIA = ['transferencias', 'documentos', 'importar'];

function Central({ federationId }) {
  const fq = useFederation(federationId);
  const papel = useMyFederationRole(federationId);
  const perms = papel.perms;
  // Sanções e chancelas carregam com a PERMISSÃO (não com o módulo): desligado o
  // módulo, o que ficou em aberto mantém a seção aberta (`residualModules`).
  const podeCompeticoes = perms.includes(FED_PERMISSION.COMPETITIONS);
  const sanctionsQ = useFederationSanctions(federationId, { enabled: papel.isStaff && perms.includes(FED_PERMISSION.DISCIPLINE) });
  const tournamentsQ = useFederationTournaments(federationId, { enabled: papel.isStaff && podeCompeticoes });
  const residual = useMemo(() => residualModules(fq.data, { sanctions: sanctionsQ.isSuccess ? sanctionsQ.data : undefined, tournaments: tournamentsQ.isSuccess ? tournamentsQ.data : undefined }), [fq.data, sanctionsQ.isSuccess, sanctionsQ.data, tournamentsQ.isSuccess, tournamentsQ.data]);
  const sections = useMemo(() => buildFederationSections(perms, fq.data, { isMaster: papel.isMaster, residual }), [perms, fq.data, papel.isMaster, residual]);
  const abasExistentes = useMemo(() => new Set(sections.flatMap((s) => s.tabs.map((x) => x.value))), [sections]);
  const [params, setParams] = useSearchParams();
  const tabPedida = params.get('aba') || '';
  const secaoPedida = params.get('secao') || '';
  const secaoAtiva = useMemo(() => {
    if (secaoPedida) return sections.find((s) => s.id === secaoPedida) || sectionOfTab(sections, tabPedida);
    return sectionOfTab(sections, tabPedida);
  }, [sections, tabPedida, secaoPedida]);
  const tab = secaoAtiva?.tabs.some((x) => x.value === tabPedida) ? tabPedida : secaoAtiva?.tabs[0]?.value;
  // `filtro` (opcional) abre a lista já filtrada (`useFiltroNaUrl`); trocar de aba sem ele limpa o da aba anterior.
  const trocarAba = useCallback((value, filtro) => {
    setParams((atual) => { const novo = new URLSearchParams(atual); novo.set('aba', value); novo.delete('secao'); if (filtro) novo.set('filtro', filtro); else novo.delete('filtro'); return novo; }, { replace: true });
  }, [setParams]);
  // Formulário com mudança pendente (`useAvisoNaoSalvo`) pergunta antes de a aba trocar e levar o que foi digitado.
  const [saindo, setSaindo] = useState(null);
  const setTab = useCallback((value, filtro) => {
    if (value !== tab && haAlteracaoNaoSalva()) { setSaindo({ value, filtro }); return; }
    trocarAba(value, filtro);
  }, [tab, trocarAba]);
  const irParaAba = (aba, filtro) => { if (sections.some((s) => s.tabs.some((x) => x.value === aba))) setTab(aba, filtro); };

  // Só quem tem a permissão consulta: a regra recusaria a leitura, e a falha
  // viraria "não carregou" numa seção que a pessoa nem vê.
  const podeFiliados = perms.includes(FED_PERMISSION.MEMBERS);
  const podeFinanceiro = perms.includes(FED_PERMISSION.FINANCE);
  const admin = perms.includes(FED_PERMISSION.ADMIN);
  const membersQ = useFederationMembers(federationId, { enabled: papel.isStaff && (podeFiliados || perms.includes(FED_PERMISSION.DISCIPLINE)) }); // a disciplina escolhe o filiado na lista
  const chargesQ = useFederationCharges(federationId, { enabled: papel.isStaff && podeFinanceiro });
  const plansQ = useFederationPlans(federationId, { enabled: papel.isStaff && (admin || podeFinanceiro || podeFiliados) });
  const staffQ = useFederationStaff(federationId, { enabled: papel.isStaff && perms.includes(FED_PERMISSION.STAFF) });
  const affiliationsQ = useFederationAffiliations(federationId, { enabled: papel.isStaff && podeFiliados && fedModuleOn(fq.data, 'affiliations') });
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
  const reportsQ = useFederationReports(federationId, { enabled: papel.isStaff && podeDisciplina });
  // PR 4 — comunicação: as notícias só com a permissão e o módulo.
  const newsQ = useFederationNews(federationId, { enabled: papel.isStaff && perms.includes(FED_PERMISSION.COMMS) && fedModuleOn(fq.data, 'news') });
  // Acervo oficial: a permissão do acervo ou o admin (o admin master antigo não tem `docs` gravado).
  const podeAcervo = (perms.includes(FED_PERMISSION.DOCS) || admin) && fedModuleOn(fq.data, 'official_docs');
  const docsQ = useFederationDocsAll(federationId, { enabled: papel.isStaff && podeAcervo });
  // Conformidade: a agenda pública só quando a aba abre (as assembleias do ano).
  const eventsQ = useFederationEvents(federationId, 'public', { enabled: papel.isStaff && admin && tab === 'conformidade' && fedModuleOn(fq.data, 'calendar') });

  if (fq.isError || papel.isError) return <V2Page><V2ErrorState title={t('Não carregou a federação')} onRetry={() => { fq.refetch(); papel.refetch(); }} /></V2Page>;
  if (fq.isLoading || papel.isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-24" /><V2Skeleton className="h-16" /><V2Skeleton className="h-64" /></V2Page>;
  const f = fq.data;
  if (!f) return <V2Page><V2EmptyState icon={Landmark} title={t('Federação não encontrada')} action={<V2Button asChild variant="secondary"><Link to="/federacoes">{t('Ver as federações')}</Link></V2Button>} /></V2Page>;
  if (papel.needsGrant) return <V2Page className="space-y-4"><V2BackLink to={fedPath(f)}>{f.acronym || f.name}</V2BackLink><FedSupportAccessGate federation={f} /></V2Page>;
  if (!papel.isStaff) return <Navigate to={fedPath(f)} replace />;

  const naoAprovada = f.status !== FEDERATION_STATUS.APPROVED;
  return (
    <V2Page className="space-y-6">
      <V2BackLink to={fedPath(f)}>{t('Página da federação')}</V2BackLink>
      <header className="flex flex-wrap items-center gap-4">
        <FedLogo federation={f} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />{t('Central da federação · área da equipe')}</p>
          <h1 className={PAGE_TITLE}>{f.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <FedBadges federation={f} />
            {papel.grant ? <V2Badge tone="amber">{t('Suporte da plataforma')}</V2Badge> : papel.roleName && <V2Badge tone="ink">{papel.roleName}</V2Badge>}
            {naoAprovada && <V2Badge tone="amber">{t(FEDERATION_STATUS_LABELS[f.status] || f.status)}</V2Badge>}
            {isFederationHidden(f) && <V2Badge tone="amber">{t('Oculta')}</V2Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <V2Button asChild variant="ghost" size="sm"><Link to={fedPreviewPath(f)}><Eye className="h-4 w-4" />{t('Ver como visitante')}</Link></V2Button>
          {isFederationPublic(f) && <V2Button asChild variant="ghost" size="sm"><a href={fedPublicPath(f)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{t('Página pública')}</a></V2Button>}
        </div>
      </header>

      {papel.grant && <FedSupportAccessBanner federationId={f.id} grant={papel.grant} onExpired={papel.refetch} />}

      {naoAprovada && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {f.status === FEDERATION_STATUS.SUSPENDED ? t('A federação está suspensa pela plataforma: a página pública e as filiações ficam fechadas até a revisão.') : f.status === FEDERATION_STATUS.REJECTED ? t('O pedido de abertura foi recusado pela plataforma: {motivo}.', { motivo: f.review?.reason || t('sem motivo informado') }) : t('A federação ainda não foi aprovada pela plataforma. Você já pode preparar planos, Pix e página. Depois da aprovação ela segue oculta até o admin da federação publicá-la.')}
        </p>
      )}

      <FedHiddenBanner federation={f} canPublish={admin} onOpen={() => setTab('publicacao')} />

      <FederationPendencias membersQ={membersQ} chargesQ={chargesQ} affiliationsQ={affiliationsQ} tournamentsQ={tournamentsQ} transfersQ={transfersQ} documentsQ={documentsQ} sanctionsQ={sanctionsQ} reportsQ={reportsQ} perms={perms} abas={abasExistentes} onIrParaAba={irParaAba} />

      <div className="space-y-3">
        <V2SectionNav ariaLabel={t('Seções da Central da federação')} dica="federacao-secoes" sections={sections} grupos={FED_SECTION_GROUPS} activeId={secaoAtiva.id} onSelect={(s) => setTab(s.tabs[0].value)} />
        {secaoAtiva.tabs.length > 1 && <V2SubTabs ariaLabel={t('Abas de {secao}', { secao: t(secaoAtiva.label) })} tabs={secaoAtiva.tabs} activeValue={tab} onSelect={(x) => setTab(x.value)} />}
      </div>

      <Suspense fallback={<V2Skeleton lines={6} />}>
        {secaoAtiva.id === 'hoje' && <FedHojePanel federation={f} membersQ={membersQ} chargesQ={chargesQ} plansQ={plansQ} affiliationsQ={affiliationsQ} tournamentsQ={tournamentsQ} perms={perms} onIrParaAba={irParaAba} />}
        {secaoAtiva.id === 'filiados' && tab === 'filiados-orgs' && <FedAffiliationsPanel affiliationsQ={affiliationsQ} />}
        {secaoAtiva.id === 'filiados' && ABAS_SECRETARIA.includes(tab) && <FedSecretariatPanel federation={f} tab={tab} membersQ={membersQ} transfersQ={transfersQ} incomingQ={incomingQ} documentsQ={documentsQ} importsQ={importsQ} plansQ={plansQ} />}
        {secaoAtiva.id === 'filiados' && tab !== 'filiados-orgs' && !ABAS_SECRETARIA.includes(tab) && <FedMembersPanel federation={f} membersQ={membersQ} documentsQ={documentsQ} plansQ={plansQ} tab={tab} />}
        {secaoAtiva.id === 'cursos' && <FedCoursesPanel federation={f} coursesQ={coursesQ} credentialsQ={credentialsQ} tab={tab} perms={perms} />}
        {secaoAtiva.id === 'disciplina' && <FedDisciplinePanel federation={f} membersQ={membersQ} sanctionsQ={sanctionsQ} reportsQ={reportsQ} tab={tab} />}
        {secaoAtiva.id === 'comunicacao' && <FedCommsPanel federation={f} newsQ={newsQ} tab={tab} />}
        {tab === 'comentarios' && <FedCommentsPanel federation={f} />}
        {secaoAtiva.id === 'acervo' && tab !== 'comentarios' && <FedAcervoPanel federation={f} docsQ={docsQ} tab={tab} isAdmin={admin} />}
        {secaoAtiva.id === 'agenda' && tab !== 'comentarios' && <FedAgendaPanel federation={f} perms={perms} />}
        {secaoAtiva.id === 'competicoes' && <FedCompetitionsPanel federation={f} tournamentsQ={tournamentsQ} resultsQ={resultsQ} tab={tab} />}
        {secaoAtiva.id === 'financeiro' && <FedFinancePanel federation={f} chargesQ={chargesQ} tab={tab} />}
        {tab === 'conformidade' && <FedCompliancePanel federation={f} staffQ={staffQ} docsQ={docsQ} eventsQ={eventsQ} abas={abasExistentes} onIrParaAba={irParaAba} />}
        {secaoAtiva.id === 'indicadores' && tab !== 'conformidade' && <FedIndicatorsPanel federation={f} membersQ={membersQ} chargesQ={chargesQ} perms={perms} />}
        {secaoAtiva.id === 'equipe' && <FedStaffPanel federation={f} staffQ={staffQ} papel={papel} tab={tab} />}
        {(secaoAtiva.id === 'config' || secaoAtiva.id === 'pagina-publica') && <FedSettingsPanel federation={f} plansQ={plansQ} tab={tab} />}
      </Suspense>
      <ConfirmDialog
        open={Boolean(saindo)}
        onOpenChange={(o) => { if (!o) setSaindo(null); }}
        destructive
        title={t('Sair sem salvar?')}
        description={t('O que você mudou nesta aba ainda não foi salvo e vai se perder.')}
        confirmLabel={t('Sair sem salvar')}
        cancelLabel={t('Continuar editando')}
        onConfirm={() => { descartarAlteracoes(); trocarAba(saindo.value, saindo.filtro); setSaindo(null); }}
      />
    </V2Page>
  );
}

export default function V2FederationManage() {
  const { federationId } = useParams();
  return <FederationGate><Central federationId={federationId} /></FederationGate>;
}
