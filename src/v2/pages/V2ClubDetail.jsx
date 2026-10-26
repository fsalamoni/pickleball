import React, { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2, CalendarDays, Hash, Mail, MapPin, MessageSquare,
  MessagesSquare, Phone, Settings, Users, Medal, Share2, User, Users2,
  Gift, Globe2, IdCard, LayoutDashboard, Library, ListChecks, Newspaper, Trophy, Vote,
} from 'lucide-react';
import {
  useClub, useMyMembership, useJoinClub, useLeaveClub, useMyJoinRequest,
  useRequestToJoinClub, useMyClubInvite, useAcceptClubInvite, useDeclineClubInvite, useClubInviteCode,
} from '@/modules/clubs/hooks/useClubs';
import { useClubInternalRanking } from '@/modules/clubs/hooks/useClubInternalRanking';
import { CLUB_ROLE, JOIN_REQUEST_STATUS } from '@/modules/clubs/domain/constants';
import V2ClubMembers from '@/v2/components/clubs/V2ClubMembers';
import V2ClubEvents from '@/v2/components/clubs/V2ClubEvents';
import V2ClubFeed from '@/v2/components/clubs/V2ClubFeed';
import V2ClubForums from '@/v2/components/clubs/V2ClubForums';
import V2ClubAdmin from '@/v2/components/clubs/V2ClubAdmin';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface, V2BackLink, V2Page, HERO_TITLE } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';
import { OrgAffiliationBadges } from '@/v2/components/federations/FedTags';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { isAssociationOpen } from '@/modules/clubs/domain/association';
import { useMyAffiliation } from '@/modules/clubs/hooks/useClubAssociation';
import ClubAssociationTab from '@/v2/components/clubs/association/ClubAssociationTab';
import { ClubMemberBenefits, ClubNewsSection } from '@/v2/components/clubs/association/ClubShowcase';

// Atividade do clube (gamificação V2, flag `gamification_v2`): só para quem administra, sob demanda.
const ClubAccountsPublic = lazy(() => import('@/v2/components/clubs/association/ClubAccountsPublic'));
const ClubDocsPublic = lazy(() => import('@/v2/components/clubs/association/ClubDocsPublic'));
const ClubAgendaPublic = lazy(() => import('@/v2/components/clubs/association/ClubAgendaPublic'));
const ClubTournamentsPublic = lazy(() => import('@/v2/components/clubs/association/ClubTournamentsPublic'));
const ClubElectionsPublic = lazy(() => import('@/v2/components/clubs/association/ClubElectionsPublic'));
const ClubSelectionPublic = lazy(() => import('@/v2/components/clubs/association/ClubSelectionPublic'));
const ClubEngagementPanel = lazy(() => import('@/v2/components/gamification/issuer/ClubEngagementPanel'));

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
  const gamificationOn = true;
  const inviteLinkOn = true;
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState(() => (inviteLinkOn ? (searchParams.get('invite') || '') : ''));
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
  const { data: inviteCode } = useClubInviteCode(club, { enabled: isAdmin && inviteLinkOn });
  const associationFlag = useFeatureFlag(FEATURE_FLAG.CLUB_ASSOCIATION);
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
    ...(isAdmin && gamificationOn ? [{ value: 'atividade', label: t('Atividade'), icon: Trophy, dica: 'clube-aba-atividade' }] : []),
    ...(isAdmin ? [{ value: 'admin', label: t('Administração'), icon: Settings }] : []),
  ];
  const safeTab = (activeTab === 'admin' && !isAdmin) || (activeTab === 'atividade' && !(isAdmin && gamificationOn)) || (activeTab === 'ranking' && !clubRankingOn) || (['associacao', 'vantagens', 'comunicados'].includes(activeTab) && !showAssocTab) || (activeTab === 'documentos' && !showDocsTab) || (activeTab === 'agenda' && !showAgendaTab) || (activeTab === 'eleicoes' && !showAgendaTab)
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
            {inviteLinkOn && isAdmin && inviteCode && (
              <V2Button variant="ghost" size="sm" className="border-white/20 bg-white/10 text-white hover:border-white/40"
                onClick={() => {
                  const link = `${window.location.origin}/clubes/${club.id}?invite=${encodeURIComponent(inviteCode)}`;
                  navigator.clipboard?.writeText(link)
                    .then(() => toast.success(t('Link de convite copiado!')))
                    .catch(() => toast.error(t('Não foi possível copiar.')));
                }}>
                <Share2 className="h-4 w-4" /> {t('Copiar link de convite')}
              </V2Button>
            )}
            {associationFlag && isAdmin && (
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
            {safeTab === 'members' && <V2ClubMembers clubId={clubId} isAdmin={isAdmin} />}
            {safeTab === 'events' && <V2ClubEvents clubId={clubId} isAdmin={isAdmin} />}
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
            {safeTab === 'ranking' && clubRankingOn && <ClubRankingTab clubId={clubId} isAdmin={isAdmin} />}
            {safeTab === 'feed' && <V2ClubFeed clubId={clubId} isAdmin={isAdmin} />}
            {safeTab === 'forums' && <V2ClubForums clubId={clubId} isAdmin={isAdmin} initialThreadId={threadParam} onThreadChange={setThreadParam} />}
            {safeTab === 'atividade' && isAdmin && gamificationOn && (
              <Suspense fallback={<V2Skeleton lines={4} />}><ClubEngagementPanel club={{ id: clubId, name: club.name }} /></Suspense>
            )}
            {safeTab === 'admin' && isAdmin && <V2ClubAdmin club={club} />}
          </div>
        </>
      )}
    </V2Page>
  );
}

function ClubRankingTab({ clubId, isAdmin }) {
  const doublesOn = true;
  const [tab, setTab] = useState('individual'); // 'individual' | 'doubles'
  const [includeExternal, setIncludeExternal] = useState(false);
  const { data, isLoading } = useClubInternalRanking(clubId, { includeExternal });

  if (isLoading) return <V2Skeleton className="h-48 rounded-4xl" />;

  return (
    <V2Surface className="overflow-hidden p-0">
      <div className="border-b border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">{t('Ranking interno')}</h3>
            <p className="text-sm text-gray-500">{t('Casual, a partir dos placares dos dias de jogo. Não afeta o ranking nacional.')}</p>
            {/* Não há "Materializar ranking agora": o ranking interno é
                refeito pelo servidor a cada placar gravado, a cada publicação
                e a cada entrada/saída de membro. Vazio aqui significa que
                ainda não houve resultado — e é isso que o estado vazio diz. */}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone="neutral" className="rounded-full">
              <Users2 className="mr-1 h-3 w-3" />
              {t('{n} atletas do clube', { n: data?.clubUids?.length || 0 })}
            </V2Badge>
            {data?.sources && (
              <>
                <V2Badge tone="green" className="rounded-full">
                  <ListChecks className="mr-1 h-3 w-3" />
                  {data.sources.club} jogo(s) do clube
                </V2Badge>
                {includeExternal && data.sources.external > 0 && (
                  <V2Badge tone="amber" className="rounded-full">
                    <Globe2 className="mr-1 h-3 w-3" />
                    {data.sources.external} externo(s)
                  </V2Badge>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sub-abas: Individual | Duplas */}
        {doublesOn && (
          <div className="mt-3 inline-flex rounded-full border border-gray-100 bg-paper-pure p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab('individual')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                tab === 'individual' ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink',
              )}
            >
              <User className="h-3.5 w-3.5" /> {t('Individual')}
            </button>
            <button
              type="button"
              onClick={() => setTab('doubles')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                tab === 'doubles' ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink',
              )}
            >
              <Users2 className="h-3.5 w-3.5" /> {t('Duplas')}
            </button>
          </div>
        )}
      </div>

      {/* Toggle "Incluir resultados externos" — só para admins do clube */}
      <ExternalToggle
        includeExternal={includeExternal}
        onChange={setIncludeExternal}
        isAdmin={isAdmin}
      />

      {tab === 'individual' && (
        <IndividualRankingTable
          ranking={data?.individual || []}
          emptyMessage={t('Registre placares nos dias de jogo do clube para montar o ranking interno. Ele se atualiza sozinho, a cada resultado.')}
        />
      )}
      {tab === 'doubles' && doublesOn && (
        <DoublesRankingTable
          ranking={data?.doubles || []}
          emptyMessage={
            isAdmin
              ? t('Nenhuma dupla ranqueada ainda — materialize o ranking para começar.')
              : t('Nenhuma dupla com jogos suficientes no clube.')
          }
        />
      )}
    </V2Surface>
  );
}

function ExternalToggle({ includeExternal, onChange, isAdmin }) {
  if (!isAdmin) {
    return null; // Só admins do clube podem ligar/desligar fontes externas
  }
  return (
    <div className="border-b border-gray-100 bg-paper/40 px-4 py-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={includeExternal}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Globe2 className="h-4 w-4 text-amber-600" /> {t('Incluir resultados externos')}
            {includeExternal && (
              <V2Badge tone="amber" className="rounded-full text-2xs">
                ON
              </V2Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {t('Quando ligado, o ranking do clube também considera os placares dos atletas do clube em torneios da plataforma e em dias de jogo de outros clubes. Útil para ter um retrato completo do desempenho dos associados.')}
          </p>
        </div>
      </label>
    </div>
  );
}

function IndividualRankingTable({ ranking, emptyMessage, action }) {
  if (ranking.length === 0) {
    return (
      <div className="p-4">
        <V2EmptyState
          icon={Medal}
          title={t('Sem ranking ainda')}
          description={emptyMessage}
          action={action}
        />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-2xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">{t('Atleta')}</th>
            <th className="px-4 py-3 text-center">J</th>
            <th className="px-4 py-3 text-center">V</th>
            <th className="px-4 py-3 text-center">D</th>
            <th className="px-4 py-3 text-center">{t('Aprov.')}</th>
            <th className="px-4 py-3 text-center">{t('Saldo')}</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="px-4 py-3 font-bold text-ink">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
              <td className="px-4 py-3 font-semibold text-ink">{r.name}</td>
              <td className="px-4 py-3 text-center tabular-nums text-gray-600">{r.games}</td>
              <td className="px-4 py-3 text-center tabular-nums font-bold text-green-700">{r.wins}</td>
              <td className="px-4 py-3 text-center tabular-nums text-gray-500">{r.losses}</td>
              <td className="px-4 py-3 text-center tabular-nums">{Math.round(r.win_rate * 100)}%</td>
              <td className={cn('px-4 py-3 text-center tabular-nums', r.points_balance > 0 ? 'text-green-700' : r.points_balance < 0 ? 'text-red-600' : 'text-gray-500')}>
                {r.points_balance > 0 ? `+${r.points_balance}` : r.points_balance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DoublesRankingTable({ ranking, emptyMessage }) {
  if (ranking.length === 0) {
    return (
      <div className="p-4">
        <V2EmptyState icon={Users2} title={t('Sem duplas ranqueadas')} description={emptyMessage} />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-2xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">{t('Dupla')}</th>
            <th className="px-4 py-3 text-center">J</th>
            <th className="px-4 py-3 text-center">V</th>
            <th className="px-4 py-3 text-center">D</th>
            <th className="px-4 py-3 text-center">{t('Aprov.')}</th>
            <th className="px-4 py-3 text-center">{t('Saldo')}</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.pair_key} className="border-t border-gray-100">
              <td className="px-4 py-3 font-bold text-ink">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
              <td className="px-4 py-3 font-semibold text-ink">
                <PairMembers members={r.members} />
              </td>
              <td className="px-4 py-3 text-center tabular-nums text-gray-600">{r.games}</td>
              <td className="px-4 py-3 text-center tabular-nums font-bold text-green-700">{r.wins}</td>
              <td className="px-4 py-3 text-center tabular-nums text-gray-500">{r.losses}</td>
              <td className="px-4 py-3 text-center tabular-nums">{Math.round(r.win_rate * 100)}%</td>
              <td className={cn('px-4 py-3 text-center tabular-nums', r.points_balance > 0 ? 'text-green-700' : r.points_balance < 0 ? 'text-red-600' : 'text-gray-500')}>
                {r.points_balance > 0 ? `+${r.points_balance}` : r.points_balance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PairMembers({ members }) {
  // Wave C.3: nomes/fotos vêm do materializado (server-side). Fallback
  // para id em caso de race condition.
  const list = (members || []).length > 0
    ? members
    : []; // vazio evita usar ids crus
  return (
    <div className="flex flex-wrap items-center gap-2">
      {list.map((m, idx) => (
        <span key={m.id} className="inline-flex items-center gap-1.5">
          {idx > 0 && <span className="text-xs text-gray-500">+</span>}
          <V2Avatar size="xs" name={m.name} photoUrl={m.photo_url} />
          <span className="text-sm">{m.name}</span>
        </span>
      ))}
    </div>
  );
}

function InfoChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1">
      <Icon className="h-3.5 w-3.5" /> {children}
    </span>
  );
}
