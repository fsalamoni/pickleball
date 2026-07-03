import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowRight,
  Building2,
  Hash,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSectionHeader, PlatformSurfaceCard } from '@/components/ui/platform-page';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useClubs,
  useMyClubs,
  useJoinClub,
  useMyJoinRequests,
  useMyClubInvites,
  useRequestToJoinClub,
} from '@/modules/clubs/hooks/useClubs';
import { JOIN_REQUEST_STATUS } from '@/modules/clubs/domain/constants';

function locationText(club) {
  return [club.city, club.state].filter(Boolean).join(' / ') || null;
}

export default function ClubsDirectory() {
  const { isAuthAvailable, authUnavailableReason } = useAuth();
  const { data: clubs = [], isLoading } = useClubs();
  const { data: myClubs = [] } = useMyClubs();
  const { data: myRequests = [] } = useMyJoinRequests();
  const { data: myInvites = [] } = useMyClubInvites();
  const joinClub = useJoinClub();
  const requestToJoin = useRequestToJoinClub();
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const isPreviewMode = import.meta.env.DEV && !isAuthAvailable;

  const myClubIds = useMemo(() => new Set(myClubs.map((c) => c.id)), [myClubs]);
  const pendingRequestIds = useMemo(
    () => new Set(myRequests.filter((r) => r.status === JOIN_REQUEST_STATUS.PENDING).map((r) => r.club_id)),
    [myRequests],
  );
  const invitedClubIds = useMemo(() => new Set(myInvites.map((i) => i.club_id)), [myInvites]);

  const joinStateFor = (clubId) => {
    if (myClubIds.has(clubId)) return null;
    if (invitedClubIds.has(clubId)) return 'invited';
    if (pendingRequestIds.has(clubId)) return 'pending';
    return 'none';
  };

  const handleRequest = async (club) => {
    try {
      const res = await requestToJoin.mutateAsync(club);
      if (res?.alreadyMember) toast.success('Você já é membro deste clube.');
      else toast.success(`Pedido enviado para ${club.name}.`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível enviar o pedido.');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs
      .filter((c) => {
        if (!q) return true;
        const haystack = [c.name, c.city, c.state, c.description].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }, [clubs, search]);

  const handleJoin = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const club = await joinClub.mutateAsync(trimmed);
      toast.success(`Você entrou no clube ${club.name}.`);
      setCode('');
    } catch (err) {
      toast.error(err.message || 'Não foi possível ingressar no clube.');
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <Card className="bg-ink text-white overflow-hidden rounded-[1.25rem] border-0 sm:rounded-[2rem]">
          <CardContent className="relative p-5 sm:p-8 lg:p-10">
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                <Sparkles className="h-3.5 w-3.5" /> Clubes da comunidade
              </span>
              <h2 className="mt-5 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">
                Encontre seu clube ou crie o seu.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
                Reúna sua turma, organize confraternizações e torneios internos e mantenha todos
                conectados em um só lugar.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-white text-ink hover:bg-acid/10">
                  <Link to="/clubes/criar"><Plus className="mr-1.5 h-4 w-4" /> Criar clube</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <PlatformSurfaceCard>
            <PlatformSectionHeader
              eyebrow="Ingressar com código"
              title="Tem um convite?"
              description="Digite o código compartilhado por um administrador para entrar no clube."
            />
            <form onSubmit={handleJoin} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  maxLength={12}
                  className="pl-9 uppercase tracking-[0.2em]"
                />
              </div>
              <Button type="submit" disabled={joinClub.isPending || !code.trim()}>
                {joinClub.isPending ? 'Entrando…' : 'Ingressar'}
              </Button>
            </form>
        </PlatformSurfaceCard>
      </section>

      {myClubs.length > 0 && (
        <section className="space-y-4">
          <PlatformSectionHeader
            eyebrow="Meus clubes"
            title="Clubes em que você participa"
            description="Acesse rapidamente os espaços em que você já está dentro da operação da comunidade."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {myClubs.map((club) => (
              <ClubCard key={club.id} club={club} myRole={club.my_role} />
            ))}
          </div>
        </section>
      )}

      <PlatformSurfaceCard contentClassName="p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clube por nome, cidade ou descrição"
              className="h-12 rounded-full border-white/80 bg-white/80 pl-11 pr-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
            <span className="font-semibold text-ink">{filtered.length}</span> clube(s) na plataforma.
          </div>
      </PlatformSurfaceCard>

      {isPreviewMode && (
        <PlatformSurfaceCard className="border-amber-300/70 bg-amber-50/85" contentClassName="p-5 text-sm leading-6 text-amber-950">
            Prévia local sem Firebase: os clubes não são carregados neste ambiente.
            {authUnavailableReason ? ` ${authUnavailableReason}` : ''}
        </PlatformSurfaceCard>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-48 rounded-[1.75rem]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PlatformSurfaceCard contentClassName="p-2">
          <EmptyState
            icon={Building2}
            title="Nenhum clube encontrado"
            description={clubs.length === 0
              ? 'Ainda não há clubes na plataforma. Crie o primeiro e convide sua turma.'
              : 'Ajuste a busca para ver mais clubes.'}
            action={(
              <Button asChild>
                <Link to="/clubes/criar"><Plus className="mr-1.5 h-4 w-4" /> Criar clube</Link>
              </Button>
            )}
          />
        </PlatformSurfaceCard>
      ) : (
        <section className="space-y-4">
          <PlatformSectionHeader
            eyebrow="Catálogo"
            title="Todos os clubes"
            description="Descubra grupos já organizados, veja onde você já tem convite e peça entrada quando fizer sentido."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                myRole={myClubIds.has(club.id) ? (club.my_role || 'member') : null}
                joinState={joinStateFor(club.id)}
                onRequest={handleRequest}
                requesting={requestToJoin.isPending}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ClubCard({ club, myRole, joinState = null, onRequest, requesting = false }) {
  const location = locationText(club);
  const handleRequestClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRequest?.(club);
  };
  return (
    <Link to={`/clubes/${club.id}`} className="block h-full">
      <Card className="h-full rounded-[1.75rem] border-white/80 bg-white/85">
        <CardContent className="flex h-full flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h4 className="flex min-w-0 items-center gap-3 text-lg font-semibold text-ink">
              {club.logo_url ? (
                <img src={club.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-2xl border border-gray-100 object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                  <Building2 className="h-4.5 w-4.5" />
                </span>
              )}
              <span className="truncate">{club.name}</span>
            </h4>
            {myRole && (
              <Badge variant={myRole === 'admin' ? 'warning' : 'success'} className="shrink-0 rounded-full uppercase tracking-[0.12em]">
                {myRole === 'admin' ? 'Admin' : 'Membro'}
              </Badge>
            )}
          </div>

          <div className="mt-4 space-y-2 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-green-700" />
              <span className="truncate">{location || 'Cidade não informada'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-green-700" />
              <span>{club.member_count || 0} membro(s)</span>
            </div>
          </div>

          {club.description && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-500">{club.description}</p>
          )}

          <div className="mt-auto pt-6">
            {myRole || !joinState || joinState === 'none' ? (
              <div className="flex items-center justify-between text-sm font-medium text-green-700">
                <span>Abrir clube</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            ) : null}
            {!myRole && joinState === 'none' && (
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={handleRequestClick} disabled={requesting}>
                Pedir para ingressar
              </Button>
            )}
            {!myRole && joinState === 'pending' && (
              <Badge variant="secondary" className="mt-3 w-full justify-center rounded-full py-1.5">Pedido enviado</Badge>
            )}
            {!myRole && joinState === 'invited' && (
              <Badge variant="warning" className="mt-3 w-full justify-center rounded-full py-1.5">Você foi convidado — abrir</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
