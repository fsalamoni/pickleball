import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, CalendarDays, Hash, Mail, MapPin, MessageSquare,
  MessagesSquare, Phone, Settings, Users,
} from 'lucide-react';
import {
  useClub, useMyMembership, useJoinClub, useLeaveClub, useMyJoinRequest,
  useRequestToJoinClub, useMyClubInvite, useAcceptClubInvite, useDeclineClubInvite,
} from '@/modules/clubs/hooks/useClubs';
import { CLUB_ROLE, JOIN_REQUEST_STATUS } from '@/modules/clubs/domain/constants';
import V2ClubMembers from '@/v2/components/clubs/V2ClubMembers';
import V2ClubEvents from '@/v2/components/clubs/V2ClubEvents';
import V2ClubFeed from '@/v2/components/clubs/V2ClubFeed';
import V2ClubForums from '@/v2/components/clubs/V2ClubForums';
import V2ClubAdmin from '@/v2/components/clubs/V2ClubAdmin';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

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
  const [code, setCode] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'members';
  const threadParam = searchParams.get('thread') || null;

  const setActiveTab = (t) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', t);
    if (t !== 'forums') next.delete('thread');
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

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      await joinClub.mutateAsync(code.trim());
      toast.success('Você entrou no clube!');
      setCode('');
    } catch (err) {
      toast.error(err.message || 'Código inválido para este clube.');
    }
  };
  const handleLeave = async () => {
    try {
      await leaveClub.mutateAsync();
      toast.success('Você saiu do clube.');
      navigate('/v2/clubes');
    } catch (err) {
      toast.error(err.message || 'Não foi possível sair do clube.');
    }
  };
  const handleRequestJoin = async () => {
    try {
      const res = await requestToJoin.mutateAsync(club);
      if (res?.alreadyMember) toast.success('Você já é membro deste clube.');
      else toast.success('Pedido enviado! Os administradores foram avisados.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível enviar o pedido.');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-6">
        <V2Skeleton className="h-52 rounded-4xl" />
        <V2Skeleton className="h-80 rounded-4xl" />
      </div>
    );
  }

  if (isError || !club) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState icon={Building2} title="Clube não encontrado"
            description="O clube que você procura não existe ou foi removido."
            action={<Link to="/v2/clubes" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Voltar para clubes</Link>} />
        </V2Surface>
      </div>
    );
  }

  const location = [club.city, club.state].filter(Boolean).join(' / ');
  const tabs = [
    { value: 'members', label: 'Membros', icon: Users },
    { value: 'events', label: 'Eventos', icon: CalendarDays },
    { value: 'feed', label: 'Mural', icon: MessageSquare },
    { value: 'forums', label: 'Fóruns', icon: MessagesSquare },
    ...(isAdmin ? [{ value: 'admin', label: 'Administração', icon: Settings }] : []),
  ];
  const safeTab = activeTab === 'admin' && !isAdmin ? 'members' : activeTab;

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link to="/v2/clubes" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar para clubes
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {club.logo_url
              ? <V2Avatar name={club.name} photoUrl={club.logo_url} size="xl" className="h-16 w-16 rounded-2xl" />
              : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white"><Building2 className="h-7 w-7" /></span>}
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold text-white">{club.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-300">
                {location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {location}</span>}
                <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {club.member_count || 0} membro(s)</span>
              </div>
              {isMember && (
                <span className={cn('mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold', isAdmin ? 'bg-acid text-ink' : 'bg-white/15 text-white')}>
                  {isAdmin ? 'Você é admin' : 'Você é membro'}
                </span>
              )}
            </div>
          </div>
          {isMember && (
            <V2Button variant="ghost" size="sm" onClick={handleLeave} className="border-white/20 bg-white/10 text-white hover:border-white/40">
              Sair do clube
            </V2Button>
          )}
        </div>

        {club.description && <p className="relative z-10 mt-5 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-gray-300">{club.description}</p>}

        <div className="relative z-10 mt-5 flex flex-wrap gap-2 text-xs text-gray-300">
          {club.home_venue && <InfoChip icon={Building2}>{club.home_venue}</InfoChip>}
          {club.contact_email && <InfoChip icon={Mail}>{club.contact_email}</InfoChip>}
          {club.contact_phone && <InfoChip icon={Phone}>{club.contact_phone}</InfoChip>}
        </div>
      </div>

      {/* Non-member: join */}
      {!isMember && (
        <V2Surface className="mt-6">
          {myInvite ? (
            <>
              <h3 className="font-display text-lg font-bold text-ink">Você foi convidado para este clube</h3>
              <p className="mt-1 text-sm text-gray-500">{myInvite.inviter_name || 'Um administrador'} convidou você a participar.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <V2Button onClick={async () => { try { await acceptInvite.mutateAsync(myInvite); toast.success('Convite aceito!'); } catch (err) { toast.error(err.message); } }} disabled={acceptInvite.isPending}>Aceitar convite</V2Button>
                <V2Button variant="ghost" onClick={async () => { try { await declineInvite.mutateAsync(myInvite); toast.success('Convite recusado.'); } catch (err) { toast.error(err.message); } }} disabled={declineInvite.isPending}>Recusar</V2Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display text-lg font-bold text-ink">Participe deste clube</h3>
              {myRequest?.status === JOIN_REQUEST_STATUS.PENDING ? (
                <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">Pedido enviado — aguardando aprovação.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-gray-500">
                    {myRequest?.status === JOIN_REQUEST_STATUS.REJECTED ? 'Seu pedido anterior não foi aprovado. Você pode pedir novamente.' : 'Peça para ingressar ou entre direto com o código de convite.'}
                  </p>
                  <V2Button className="mt-4" onClick={handleRequestJoin} disabled={requestToJoin.isPending || !isAuthenticated}>
                    {requestToJoin.isPending ? 'Enviando…' : 'Pedir para ingressar'}
                  </V2Button>
                </>
              )}
              <form onSubmit={handleJoin} className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row">
                <div className="relative flex-1">
                  <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TENHO UM CÓDIGO" maxLength={12}
                    className="w-full rounded-full border border-gray-200 bg-paper-pure py-3 pl-11 pr-4 text-sm uppercase tracking-[0.2em] text-ink focus:border-gray-300 focus:ring-4 focus:ring-gray-100" disabled={!isAuthenticated} />
                </div>
                <V2Button type="submit" variant="ghost" disabled={joinClub.isPending || !code.trim() || !isAuthenticated}>
                  {joinClub.isPending ? 'Entrando…' : 'Entrar com código'}
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
                <button key={t.value} onClick={() => setActiveTab(t.value)}
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
            {safeTab === 'feed' && <V2ClubFeed clubId={clubId} isAdmin={isAdmin} />}
            {safeTab === 'forums' && <V2ClubForums clubId={clubId} isAdmin={isAdmin} initialThreadId={threadParam} onThreadChange={setThreadParam} />}
            {safeTab === 'admin' && isAdmin && <V2ClubAdmin club={club} />}
          </div>
        </>
      )}
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
