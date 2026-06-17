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
        <Card className="arena-panel-strong overflow-hidden rounded-[1.25rem] border-0 sm:rounded-[2rem]">
          <CardContent className="relative p-5 sm:p-8 lg:p-10">
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/80">
                <Sparkles className="h-3.5 w-3.5" /> Clubes da comunidade
              </span>
              <h2 className="mt-5 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">
                Encontre seu clube ou crie o seu.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/75 sm:text-base">
                Reúna sua turma, organize confraternizações e torneios internos e mantenha todos
                conectados em um só lugar.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-white text-slate-950 hover:bg-emerald-50">
                  <Link to="/clubes/criar"><Plus className="mr-1.5 h-4 w-4" /> Criar clube</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="p-6 sm:p-7">
            <span className="arena-chip">Ingressar com código</span>
            <h3 className="mt-4 text-2xl font-semibold text-slate-950">Tem um convite?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Digite o código compartilhado por um administrador para entrar no clube.
            </p>
            <form onSubmit={handleJoin} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
          </CardContent>
        </Card>
      </section>

      {myClubs.length > 0 && (
        <section className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/75">Meus clubes</div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">Clubes em que você participa</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {myClubs.map((club) => (
              <ClubCard key={club.id} club={club} myRole={club.my_role} />
            ))}
          </div>
        </section>
      )}

      <Card className="rounded-[2rem] border-white/80 bg-white/82">
        <CardContent className="p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-4 border-t border-emerald-950/8 pt-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-950">{filtered.length}</span> clube(s) na plataforma.
          </div>
        </CardContent>
      </Card>

      {isPreviewMode && (
        <Card className="rounded-[2rem] border-amber-300/70 bg-amber-50/85">
          <CardContent className="p-5 text-sm leading-6 text-amber-950">
            Prévia local sem Firebase: os clubes não são carregados neste ambiente.
            {authUnavailableReason ? ` ${authUnavailableReason}` : ''}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-48 rounded-[1.75rem]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="flex flex-col items-center px-4 py-10 text-center sm:px-10 sm:py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-100 text-emerald-700">
              <Building2 className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-slate-950">Nenhum clube encontrado</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              {clubs.length === 0
                ? 'Ainda não há clubes na plataforma. Crie o primeiro e convide sua turma!'
                : 'Ajuste a busca para ver mais clubes.'}
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link to="/clubes/criar"><Plus className="mr-1.5 h-4 w-4" /> Criar clube</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/75">Catálogo</div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">Todos os clubes</h3>
          </div>
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
      <Card className="match-surface h-full rounded-[1.75rem] border-white/80 bg-white/85">
        <CardContent className="flex h-full flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h4 className="flex min-w-0 items-center gap-3 text-lg font-semibold text-slate-950">
              {club.logo_url ? (
                <img src={club.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-2xl border border-emerald-900/10 object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
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

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="truncate">{location || 'Cidade não informada'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-emerald-700" />
              <span>{club.member_count || 0} membro(s)</span>
            </div>
          </div>

          {club.description && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{club.description}</p>
          )}

          <div className="mt-auto pt-6">
            {myRole || !joinState || joinState === 'none' ? (
              <div className="flex items-center justify-between text-sm font-medium text-emerald-800">
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
