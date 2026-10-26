/**
 * V2ClubManage — a Central do clube (`/clubes/:clubId/gerir?aba=`).
 *
 * Como a Central da federação e da arena: seções em dois grupos (Atender ·
 * Gerir), a aba na URL, os painéis baixando sob demanda. Quem entra é a
 * administração do clube e quem tem cargo com mandato valendo
 * (`club_x/{clube}/staff`); cada cargo vê só as seções da sua permissão.
 * Sem permissão, a pessoa volta à página do clube.
 */
import React, { Suspense, lazy, useCallback, useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, ExternalLink, ShieldCheck } from 'lucide-react';
import { useClub } from '@/modules/clubs/hooks/useClubs';
import {
  useAllBenefits, useAllClubNews, useAllClubSponsors, useAllPlans, useClubAffiliations, useClubCharges, useClubPix, useClubRoles, useClubStaff, useMyClubRole,
} from '@/modules/clubs/hooks/useClubAssociation';
import { CLUB_PERM, isAssociationOpen } from '@/modules/clubs/domain/association';
import { canUseClubAgenda } from '@/modules/clubs/domain/agenda';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { V2Avatar, V2Badge, V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Page, V2Skeleton } from '@/v2/ui/primitives';
import { V2SectionNav, V2SubTabs } from '@/v2/ui/V2SectionNav';
import { PAGE_TITLE } from '@/v2/ui/pageFrame';
import { CLUB_SECTION_GROUPS, buildClubSections, sectionOfClubTab } from '@/v2/components/clubs/manage/clubManageSections';
import { t } from '@/core/i18n';

const ClubHojePanel = lazy(() => import('@/v2/components/clubs/manage/ClubHojePanel'));
const ClubMembersPanel = lazy(() => import('@/v2/components/clubs/manage/ClubMembersPanel'));
const ClubFinancePanel = lazy(() => import('@/v2/components/clubs/manage/ClubFinancePanel'));
const ClubStaffPanel = lazy(() => import('@/v2/components/clubs/manage/ClubStaffPanel'));
const ClubIndicatorsPanel = lazy(() => import('@/v2/components/clubs/manage/ClubIndicatorsPanel'));
const ClubSettingsPanel = lazy(() => import('@/v2/components/clubs/manage/ClubSettingsPanel'));
const ClubCommsPanel = lazy(() => import('@/v2/components/clubs/manage/ClubCommsPanel'));
const ClubStorePanel = lazy(() => import('@/v2/components/clubs/manage/ClubStorePanel'));
const ClubAccountsPanel = lazy(() => import('@/v2/components/clubs/manage/ClubAccountsPanel'));
const ClubDocsPanel = lazy(() => import('@/v2/components/clubs/manage/ClubDocsPanel'));
const ClubAgendaPanel = lazy(() => import('@/v2/components/clubs/manage/ClubAgendaPanel'));
const ClubDisciplinePanel = lazy(() => import('@/v2/components/clubs/manage/ClubDisciplinePanel'));
const ClubSafeguardingPanel = lazy(() => import('@/v2/components/clubs/manage/ClubSafeguardingPanel'));
const ClubSelectionPanel = lazy(() => import('@/v2/components/clubs/manage/ClubSelectionPanel'));
const ClubAssetsPanel = lazy(() => import('@/v2/components/clubs/manage/ClubAssetsPanel'));
const ClubPlansTab = lazy(() => import('@/v2/components/clubs/manage/ClubPlansPanel').then((m) => ({ default: m.ClubPlansTab })));
const ClubPixTab = lazy(() => import('@/v2/components/clubs/manage/ClubPlansPanel').then((m) => ({ default: m.ClubPixTab })));

function Central({ clubId }) {
  const clubQ = useClub(clubId);
  const papel = useMyClubRole(clubId);
  const perms = papel.perms;
  const admin = perms.includes(CLUB_PERM.ADMIN);
  const podeMembros = admin || perms.includes(CLUB_PERM.MEMBERS);
  const podeFinancas = admin || perms.includes(CLUB_PERM.FINANCE);
  const podeContas = podeFinancas || perms.includes(CLUB_PERM.FISCAL); // o conselho fiscal vê as contas e dá o parecer
  const [params, setParams] = useSearchParams();

  // Só quem tem a permissão consulta: a regra recusaria a leitura, e a falha
  // viraria "não carregou" numa seção que a pessoa nem vê.
  const podeDisciplina = admin || perms.includes(CLUB_PERM.DISCIPLINE); // a disciplina escolhe quem sancionar na lista de associados
  const podeEsporte = admin || perms.includes(CLUB_PERM.SPORTS); // a diretoria esportiva escolhe quem convocar na lista de associados
  const affiliationsQ = useClubAffiliations(clubId, { enabled: papel.isStaff && (podeMembros || podeDisciplina || podeEsporte) });
  const chargesQ = useClubCharges(clubId, { enabled: papel.isStaff && podeFinancas });
  const plansQ = useAllPlans(clubId, { enabled: papel.isStaff && (podeMembros || podeFinancas) });
  const pixQ = useClubPix(clubId, { enabled: papel.isStaff && admin });
  const podeEquipe = admin || perms.includes(CLUB_PERM.STAFF);
  const staffQ = useClubStaff(clubId, { enabled: papel.isStaff && podeEquipe });
  const rolesQ = useClubRoles(clubId, { enabled: papel.isStaff && podeEquipe });

  const sections = useMemo(() => buildClubSections(perms), [perms]);
  const tabPedida = params.get('aba') || '';
  const secaoPedida = params.get('secao') || '';
  const secaoAtiva = useMemo(
    () => (secaoPedida && sections.find((s) => s.id === secaoPedida)) || sectionOfClubTab(sections, tabPedida),
    [sections, tabPedida, secaoPedida],
  );
  const tab = secaoAtiva?.tabs.some((x) => x.value === tabPedida) ? tabPedida : secaoAtiva?.tabs[0]?.value;

  // Comunicação: cada aba consulta só a sua coleção, e só quem tem `comms` (a regra recusaria os demais).
  const emComunicacao = papel.isStaff && (admin || perms.includes(CLUB_PERM.COMMS));
  const newsQ = useAllClubNews(clubId, { enabled: emComunicacao && tab === 'comunicados' });
  const benefitsQ = useAllBenefits(clubId, { enabled: emComunicacao && tab === 'vantagens' });
  const sponsorsQ = useAllClubSponsors(clubId, { enabled: emComunicacao && tab === 'patrocinadores' });
  const planosVantagensQ = useAllPlans(clubId, { enabled: emComunicacao && tab === 'vantagens' });

  // `filtro` (opcional) abre a lista já filtrada; trocar de aba sem ele limpa o da aba anterior.
  const setTab = useCallback((value, filtro) => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.set('aba', value); novo.delete('secao');
      if (filtro) novo.set('filtro', filtro); else novo.delete('filtro');
      return novo;
    }, { replace: true });
  }, [setParams]);
  const irParaAba = (aba, filtro) => { if (sections.some((s) => s.tabs.some((x) => x.value === aba))) setTab(aba, filtro); };

  if (clubQ.isError || papel.isError) return <V2Page><V2ErrorState title={t('Não carregou o clube')} onRetry={() => { clubQ.refetch(); papel.refetch(); }} /></V2Page>;
  if (clubQ.isLoading || papel.isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-24" /><V2Skeleton className="h-16" /><V2Skeleton className="h-64" /></V2Page>;
  const club = clubQ.data;
  if (!club) return <V2Page><V2EmptyState icon={Building2} title={t('Clube não encontrado')} action={<V2Button asChild variant="secondary"><Link to="/clubes">{t('Ver os clubes')}</Link></V2Button>} /></V2Page>;
  if (!papel.isStaff) return <Navigate to={`/clubes/${clubId}`} replace />;

  return (
    <V2Page className="space-y-6">
      <V2BackLink to={`/clubes/${clubId}`}>{t('Página do clube')}</V2BackLink>
      <header className="flex flex-wrap items-center gap-4">
        <V2Avatar name={club.name} photoUrl={club.logo_url} size="xl" className="h-16 w-16 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />{t('Central do clube · área da gestão')}</p>
          <h1 className={PAGE_TITLE}>{club.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <V2Badge tone={admin ? 'ink' : 'neutral'}>{admin ? t('Administração') : (papel.roleName || t('Equipe'))}</V2Badge>
            {club.association?.enabled
              ? <V2Badge tone={isAssociationOpen(club) ? 'green' : 'amber'}>{isAssociationOpen(club) ? t('Associação aberta') : t('Associação em preparo')}</V2Badge>
              : <V2Badge tone="neutral">{t('Associação desligada')}</V2Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <V2Button asChild variant="ghost" size="sm"><Link to={`/clubes/${clubId}`}>{t('Ver como associado')}</Link></V2Button>
          {isAssociationOpen(club) && <V2Button asChild variant="ghost" size="sm"><a href={`/c/${clubId}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{t('Página pública')}</a></V2Button>}
        </div>
      </header>

      <div className="space-y-3">
        <V2SectionNav ariaLabel={t('Seções da Central do clube')} dica="clube-secoes" sections={sections} grupos={CLUB_SECTION_GROUPS} activeId={secaoAtiva.id} onSelect={(s) => setTab(s.tabs[0].value)} />
        {secaoAtiva.tabs.length > 1 && <V2SubTabs ariaLabel={t('Abas de {secao}', { secao: secaoAtiva.label })} tabs={secaoAtiva.tabs} activeValue={tab} onSelect={(x) => setTab(x.value)} />}
      </div>

      <Suspense fallback={<V2Skeleton lines={6} />}>
        {tab === 'hoje' && <ClubHojePanel club={club} affiliationsQ={affiliationsQ} chargesQ={chargesQ} plansQ={plansQ} pixQ={pixQ} staffQ={staffQ} perms={perms} onIrParaAba={irParaAba} />}
        {tab === 'associados' && <ClubMembersPanel club={club} affiliationsQ={affiliationsQ} plansQ={plansQ} perms={perms} />}
        {['sancoes', 'ouvidoria'].includes(tab) && podeDisciplina && <ClubDisciplinePanel club={club} affiliationsQ={affiliationsQ} tab={tab} />}
        {['protecao', 'menores', 'protecao-regras'].includes(tab) && podeDisciplina && <ClubSafeguardingPanel club={club} affiliationsQ={affiliationsQ} tab={tab} />}
        {tab === 'selecao' && podeEsporte && <ClubSelectionPanel club={club} affiliationsQ={affiliationsQ} />}
        {tab === 'cobrancas' && <ClubFinancePanel club={club} chargesQ={chargesQ} />}
        {tab === 'planos' && <ClubPlansTab club={club} plansQ={plansQ} canEdit={podeFinancas} canAdopt={podeMembros} />}
        {tab === 'pix' && admin && <ClubPixTab club={club} />}
        {(tab === 'equipe' || tab === 'cargos') && <ClubStaffPanel club={club} staffQ={staffQ} rolesQ={rolesQ} papel={papel} tab={tab} />}
        {emComunicacao && ['comunicados', 'vantagens', 'patrocinadores', 'divulgacao'].includes(tab) && (
          <ClubCommsPanel
            club={club}
            tab={tab}
            newsQ={newsQ}
            benefitsQ={benefitsQ}
            sponsorsQ={sponsorsQ}
            plansQ={planosVantagensQ}
            associados={(affiliationsQ.data || []).filter((a) => a.status === 'active').length}
          />
        )}
        {podeContas && ['contas', 'orcamento', 'lancamentos', 'prestacao'].includes(tab) && <ClubAccountsPanel club={club} perms={perms} tab={tab} onIrParaAba={irParaAba} />}
        {tab === 'documentos' && (admin || perms.includes(CLUB_PERM.DOCS)) && <ClubDocsPanel club={club} perms={perms} />}
        {tab === 'agenda' && canUseClubAgenda(perms) && <ClubAgendaPanel club={club} perms={perms} />}
        {tab === 'loja' && podeFinancas && <ClubStorePanel club={club} />}
        {tab === 'patrimonio' && (podeContas || perms.includes(CLUB_PERM.SPORTS)) && <ClubAssetsPanel club={club} perms={perms} />}
        {tab === 'indicadores' && <ClubIndicatorsPanel club={club} affiliationsQ={affiliationsQ} chargesQ={chargesQ} perms={perms} />}
        {tab === 'config' && admin && <ClubSettingsPanel club={club} />}
      </Suspense>
    </V2Page>
  );
}

export default function V2ClubManage() {
  const { clubId } = useParams();
  const { flags, isLoading } = useFeatureFlags();
  if (isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-64" /></V2Page>;
  if (!flags?.[FEATURE_FLAG.CLUB_ASSOCIATION]) return <Navigate to={`/clubes/${clubId}`} replace />;
  return <Central clubId={clubId} />;
}
