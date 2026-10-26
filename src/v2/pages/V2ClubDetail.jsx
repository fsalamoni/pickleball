import React, { Suspense, lazy, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2, CalendarDays, Hash, Mail, MapPin, MessageSquare,
  MessagesSquare, Phone, Users, Medal,
  Gift, IdCard, LayoutDashboard, Library, Newspaper, Vote,
} from 'lucide-react';
import {
  useClub, useMyMembership, useJoinClub, useLeaveClub, useMyJoinRequest,
  useRequestToJoinClub, useMyClubInvite, useAcceptClubInvite, useDeclineClubInvite,
} from '@/modules/clubs/hooks/useClubs';
import { CLUB_ROLE, JOIN_REQUEST_STATUS } from '@/modules/clubs/domain/constants';
import V2ClubMembers from '@/v2/components/clubs/V2ClubMembers';
import V2ClubEvents from '@/v2/components/clubs/V2ClubEvents';
import LinkedGameDaysSection from '@/v2/components/games/LinkedGameDaysSection';
import V2ClubFeed from '@/v2/components/clubs/V2ClubFeed';
import V2ClubForums from '@/v2/components/clubs/V2ClubForums';
import ClubRankingTab from '@/v2/components/clubs/ClubRankingTab';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

import { V2Avatar, V2Button, V2EmptyState, V2Skeleton, V2Surface, V2BackLink, V2Page, HERO_TITLE } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';
import { OrgAffiliationBadges } from '@/v2/components/federations/FedTags';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { isAssociationOpen } from '@/modules/clubs/domain/association';
import { useMyAffiliation, useMyClubRole } from '@/modules/clubs/hooks/useClubAssociation';
import ClubAssociationTab from '@/v2/components/clubs/association/ClubAssociationTab';
import { ClubMemberBenefits, ClubNewsSection } from '@/v2/components/clubs/association/ClubShowcase';

const ClubAccountsPublic = lazy(() => import('@/v2/components/clubs/association/ClubAccountsPublic'));
const ClubDocsPublic = lazy(() => import('@/v2/components/clubs/association/ClubDocsPublic'));
const ClubAgendaPublic = lazy(() => import('@/v2/components/clubs/association/ClubAgendaPublic'));
const ClubTournamentsPublic = lazy(() => import('@/v2/components/clubs/association/ClubTournamentsPublic'));
const ClubElectionsPublic = lazy(() => import('@/v2/components/clubs/association/ClubElectionsPublic'));
const ClubSelectionPublic = lazy(() => import('@/v2/components/clubs/association/ClubSelectionPublic'));

export default function V2ClubDetail() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: club, isLoading, isError } = useClub(clubId);
  const { data: membership } = useMyMembership(clubId);
  const { data: myRequest } = useMyJoinRequest(clubId);
  const { data: myInvite } = useMyClubInvite(clubId);
  const joinClub = useJoinClub();
  const leaveClub = useLeaveClub(clubId);
  const requestToJoin = useRequestToJoinClub();
  const acceptInvite = useAcceptClubInvite(clubId);
  const declineInvite = useDeclineClubInvite(clubId);
  const clubRankingOn = true;
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState(() => searchParams.get('invite') || '');
  const activeTab = searchParams.get('tab') || 'members';
  const threadParam = searchParams.get('thread') || null;

  const setActiveTab = (t) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', t);
    if (t !== 'forums') next.delete('thread');
    if (t !== 'documentos') next.delete('doc');
    if (t !== 'agenda') next.delete('evento');
    if (t !== 'eleicoes') { next.delete('eleicao'); next.delete('apoiar'); }
    setSearchParams(next, { replace: true });
  };
  const setThreadParam = (threadId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'forums');
    if (threadId) next.set('thread', threadId); else next.delete('thread');
    setSearchParams(next, { replace: true });
  };

  const isMember = !!membership;
  const isAdmin = membership?.role === CLUB_ROLE.ADMIN;
  const associationFlag = useFeatureFlag(FEATURE_FLAG.CLUB_ASSOCIATION);
  // Quem administra (e, com a associação ligada, quem tem cargo) opera na Central do clube, não nesta página.
  const papel = useMyClubRole(clubId, { association: associationFlag });
  const assocOpen = associationFlag && isAssociationOpen(club);
  const myAff = useMyAffiliation(clubId, { enabled: associationFlag && !assocOpen && isMember });
  // Fechada ao público, a aba segue para quem já tem filiação (a situação e a carteirinha dela).
  const showAssocTab = associationFlag && isMember && (assocOpen || Boolean(myAff.data));
  // Os documentos oficiais valem para todo membro de um clube que ligou a associação (mesmo fechada ao público).
  const showDocsTab = associationFlag && isMember && Boolean(club?.association?.enabled);
  const docParam = searchParams.get('doc') || null;
  const eventoParam = searchParams.get('evento') || null;
  // A agenda oficial vale para todo membro de um clube que ligou a associação (como os documentos).
  const showAgendaTab = showDocsTab;

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      await joinClub.mutateAsync(code.trim());
      toast.success(t('Você entrou no clube!'));
      setCode('');
    } catch (err) {
      toast.error(err.message || t('Código inválido para este clube.'));
    }
  };
  const handleLeave = async () => {
    try {
      await leaveClub.mutateAsync();
      toast.success(t('Você saiu do clube.'));
      navigate('/clubes');
    } catch (err) {
      toast.error(err.message || t('Não foi possível sair do clube.'));
    }
  };
  const handleRequestJoin = async () => {
    try {
      const res = await requestToJoin.mutateAsync(club);
      if (res?.alreadyMember) toast.success(t('Você já é membro deste clube.'));
      else toast.success(t('Pedido enviado! Os administradores foram avisados.'));
    } catch (err) {
      toast.error(err.message || t('Não foi possível enviar o pedido.'));
    }
  };

  if (isLoading) {
    return (
      <V2Page className="space-y-6">
        <V2Skeleton className="h-52 rounded-4xl" />
        <V2Skeleton className="h-80 rounded-4xl" />
      </V2Page>
    );
  }

  if (isError || !club) {
    return (
      <V2Page>
        <V2Surface>
          <V2EmptyState icon={Building2} title={t('Clube não encontrado')}
            description={t('O clube que você procura não existe ou foi removido.')}
            action={<Link to="/clubes" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{t('Voltar para clubes')}</Link>} />
        </V2Surface>
      </V2Page>
    );
  }

  // Links antigos (avisos já gravados, favoritos): as abas "Administração" e "Atividade" viraram a Central do clube.
  const destinoLegado = { admin: 'ingresso', atividade: 'engajamento' }[activeTab];
  if (destinoLegado && isAdmin) return <Navigate to={`/clubes/${clubId}/gerir?aba=${destinoLegado}`} replace />;

  const location = [club.city, club.state].filter(Boolean).join(' / ');
  const tabs = [
    { value: 'members', label: t('Membros'), icon: Users },
    { value: 'events', label: t('Eventos'), icon: CalendarDays },
    ...(showAssocTab ? [{ value: 'associacao', label: t('Associação'), icon: IdCard, dica: 'clube-aba-associacao' }] : []),
    ...(showAssocTab ? [
      { value: 'vantagens', label: t('Vantagens'), icon: Gift, dica: 'clube-aba-vantagens' },
      { value: 'comunicados', label: t('Comunicados'), icon: Newspaper, dica: 'clube-aba-comunicados' },
    ] : []),
    ...(showAgendaTab ? [{ value: 'agenda', label: t('Agenda'), icon: CalendarDays, dica: 'clube-aba-agenda' }] : []),
    ...(showAgendaTab ? [{ value: 'eleicoes', label: t('Eleições'), icon: Vote, dica: 'clube-aba-eleicoes' }] : []),
    ...(showDocsTab ? [{ value: 'documentos', label: t('Documentos'), icon: Library, dica: 'clube-aba-documentos' }] : []),
    ...(clubRankingOn ? [{ value: 'ranking', label: t('Ranking'), icon: Medal }] : []),
    { value: 'feed', label: t('Mural'), icon: MessageSquare },
    { value: 'forums', label: t('Fóruns'), icon: MessagesSquare },
  ];
  const safeTab = (['admin', 'atividade'].includes(activeTab)) || (activeTab === 'ranking' && !clubRankingOn) || (['associacao', 'vantagens', 'comunicados'].includes(activeTab) && !showAssocTab) || (activeTab === 'documentos' && !showDocsTab) || (activeTab === 'agenda' && !showAgendaTab) || (activeTab === 'eleicoes' && !showAgendaTab)
    ? 'members' : activeTab;

  return (
    <V2Page>
      <V2BackLink to="/clubes" className="mb-5">{t('Voltar para clubes')}</V2BackLink>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {club.logo_url
              ? <V2Avatar name={club.name} photoUrl={club.logo_url} size="xl" className="h-16 w-16 rounded-2xl" />
              : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white"><Building2 className="h-7 w-7" /></span>}
            <div className="min-w-0">
              <h1 className={HERO_TITLE}>{club.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-300">
                {location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {location}</span>}
                <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {club.member_count || 0} membro(s)</span>
                <OrgAffiliationBadges kind="club" orgId={club.id} />
              </div>
              {isMember && (
                <span className={cn('mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold', isAdmin ? 'bg-acid text-ink' : 'bg-white/15 text-white')}>
                  {isAdmin ? t('Você é admin') : t('Você é membro')}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {(isAdmin || papel.isStaff) && (
              <V2Button asChild size="sm" variant="ghost" className="border-white/20 bg-white/10 text-white hover:border-white/40" data-dica="clube-central">
                <Link to={`/clubes/${club.id}/gerir`}><LayoutDashboard className="h-4 w-4" /> {t('Central do clube')}</Link>
              </V2Button>
            )}
            {isMember && (
              <V2Button variant="ghost" size="sm" onClick={handleLeave} className="border-white/20 bg-white/10 text-white hover:border-white/40">
                {t('Sair do clube')}
              </V2Button>
            )}
          </div>
        </div>

        {club.description && <p className="relative z-10 mt-5 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-gray-300">{club.description}</p>}

        <div className="relative z-10 mt-5 flex flex-wrap gap-2 text-xs text-gray-300">
          {club.home_venue && <InfoChip icon={Building2}>{club.home_venue}</InfoChip>}
          {club.contact_email && <InfoChip icon={Mail}>{club.contact_email}</InfoChip>}
          {club.contact_phone && <InfoChip icon={Phone}>{club.contact_phone}</InfoChip>}
        </div>
      </div>

      {/* Clube-associação aberto ao público: quem ainda não é membro vê os planos primeiro. */}
      {!isMember && assocOpen && (
        <div className="mt-6 space-y-5">
          <ClubAssociationTab club={club} />
          <ClubNewsSection clubId={clubId} limite={3} />
          <Suspense fallback={null}><ClubAgendaPublic club={club} eventId={activeTab === 'agenda' ? eventoParam : null} compacto={activeTab !== 'agenda'} /></Suspense>
          <Suspense fallback={null}><ClubDocsPublic club={club} docId={activeTab === 'documentos' ? docParam : null} compacto={activeTab !== 'documentos'} /></Suspense>
          <Suspense fallback={null}><ClubTournamentsPublic clubId={clubId} /></Suspense>
          <Suspense fallback={null}><ClubSelectionPublic clubId={clubId} /></Suspense>
          <Suspense fallback={null}><ClubAccountsPublic clubId={clubId} /></Suspense>
        </div>
      )}

      {/* Non-member: join */}
      {!isMember && (
        <V2Surface className="mt-6">
          {myInvite ? (
            <>
              <h3 className="font-display text-lg font-bold text-ink">{t('Você foi convidado para este clube')}</h3>
              <p className="mt-1 text-sm text-gray-500">{t('{nome} convidou você a participar.', { nome: myInvite.inviter_name || t('Um administrador') })}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <V2Button onClick={async () => { try { await acceptInvite.mutateAsync(myInvite); toast.success(t('Convite aceito!')); } catch (err) { toast.error(err.message); } }} disabled={acceptInvite.isPending}>{t('Aceitar convite')}</V2Button>
                <V2Button variant="ghost" onClick={async () => { try { await declineInvite.mutateAsync(myInvite); toast.success(t('Convite recusado.')); } catch (err) { toast.error(err.message); } }} disabled={declineInvite.isPending}>{t('Recusar')}</V2Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display text-lg font-bold text-ink">{t('Participe deste clube')}</h3>
              {myRequest?.status === JOIN_REQUEST_STATUS.PENDING ? (
                <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">{t('Pedido enviado — aguardando aprovação.')}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-gray-500">
                    {myRequest?.status === JOIN_REQUEST_STATUS.REJECTED ? t('Seu pedido anterior não foi aprovado. Você pode pedir novamente.') : t('Peça para ingressar ou entre direto com o código de convite.')}
                  </p>
                  <V2Button className="mt-4" onClick={handleRequestJoin} disabled={requestToJoin.isPending || !isAuthenticated} data-dica="clube-entrar">
                    {requestToJoin.isPending ? t('Enviando…') : t('Pedir para ingressar')}
                  </V2Button>
                </>
              )}
              <form onSubmit={handleJoin} data-dica="clube-codigo" className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row">
                <div className="relative flex-1">
                  <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('TENHO UM CÓDIGO')} maxLength={12}
                    className="w-full rounded-full border border-gray-200 bg-paper-pure py-3 pl-11 pr-4 text-sm uppercase tracking-[0.2em] text-ink focus:border-gray-300 focus:ring-4 focus:ring-gray-100" disabled={!isAuthenticated} />
                </div>
                <V2Button type="submit" variant="ghost" disabled={joinClub.isPending || !code.trim() || !isAuthenticated}>
                  {joinClub.isPending ? t('Entrando…') : t('Entrar com código')}
                </V2Button>
              </form>
            </>
          )}
        </V2Surface>
      )}

      {/* Member: tabs */}
      {isMember && (
        <>
          <div className="mt-6 inline-flex flex-wrap gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.value} onClick={() => setActiveTab(t.value)} data-dica={t.dica}
                  className={cn('inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors',
                    safeTab === t.value ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            {safeTab === 'members' && <V2ClubMembers clubId={clubId} />}
            {safeTab === 'events' && (
              <>
                <V2ClubEvents clubId={clubId} isAdmin={isAdmin} />
                <LinkedGameDaysSection clubId={clubId} />
              </>
            )}
            {safeTab === 'associacao' && showAssocTab && <ClubAssociationTab club={club} />}
            {safeTab === 'vantagens' && showAssocTab && <ClubMemberBenefits club={club} onVerAssociacao={() => setActiveTab('associacao')} />}
            {safeTab === 'comunicados' && showAssocTab && (
              <div className="space-y-6">
                <ClubNewsSection clubId={clubId} member publicOn={assocOpen} titulo={false} limite={10} />
                <Suspense fallback={null}><ClubSelectionPublic clubId={clubId} enabled={assocOpen} /></Suspense>
                {assocOpen && <Suspense fallback={null}><ClubAccountsPublic clubId={clubId} /></Suspense>}
              </div>
            )}
            {safeTab === 'agenda' && showAgendaTab && <Suspense fallback={<V2Skeleton lines={4} />}><ClubAgendaPublic club={club} member eventId={eventoParam} /></Suspense>}
            {safeTab === 'eleicoes' && showAgendaTab && <Suspense fallback={<V2Skeleton lines={4} />}><ClubElectionsPublic club={club} /></Suspense>}
            {safeTab === 'documentos' && showDocsTab &&<Suspense fallback={<V2Skeleton lines={4} />}><ClubDocsPublic club={club} member docId={docParam} /></Suspense>}
            {safeTab === 'ranking' && clubRankingOn && <ClubRankingTab clubId={clubId} />}
            {/* Moderar o que se publica (apagar post, fixar tópico) é do contexto da publicação: a administração faz aqui mesmo. */}
            {safeTab === 'feed' && <V2ClubFeed clubId={clubId} isAdmin={isAdmin} />}
            {safeTab === 'forums' && <V2ClubForums clubId={clubId} isAdmin={isAdmin} initialThreadId={threadParam} onThreadChange={setThreadParam} />}
          </div>
        </>
      )}
    </V2Page>
  );
}

function InfoChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1">
      <Icon className="h-3.5 w-3.5" /> {children}
    </span>
  );
}
