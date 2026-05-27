import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Calendar,
  Globe,
  Hash,
  MapPin,
  Plus,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyTournaments, usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_USER_ROLE,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';

const STATUS_TONE = {
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-900 border-blue-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'bg-amber-100 text-amber-900 border-amber-200',
  [TOURNAMENT_STATUS.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [TOURNAMENT_STATUS.FINISHED]: 'bg-slate-200 text-slate-700 border-slate-300',
  [TOURNAMENT_STATUS.CANCELLED]: 'bg-red-100 text-red-800 border-red-200',
};

const LIVE_STATUSES = new Set([
  TOURNAMENT_STATUS.IN_PROGRESS,
  TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
  TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
]);

const STATUS_PRIORITY = {
  [TOURNAMENT_STATUS.IN_PROGRESS]: 0,
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 1,
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 2,
  [TOURNAMENT_STATUS.DRAFT]: 3,
  [TOURNAMENT_STATUS.FINISHED]: 4,
  [TOURNAMENT_STATUS.CANCELLED]: 5,
};

function parseDate(value) {
  if (!value) return null;
  try {
    const date = typeof value === 'string'
      ? new Date(`${value}T00:00:00`)
      : value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDateRange(startsAt, endsAt) {
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);
  if (!start && !end) return null;
  const fmt = (value) => value.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  if (start && end) return start.toDateString() === end.toDateString() ? fmt(start) : `${fmt(start)} - ${fmt(end)}`;
  return fmt(start || end);
}

function compareTournaments(a, b) {
  const aPriority = STATUS_PRIORITY[a.status] ?? 99;
  const bPriority = STATUS_PRIORITY[b.status] ?? 99;
  if (aPriority !== bPriority) return aPriority - bPriority;

  const aDate = parseDate(a.starts_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bDate = parseDate(b.starts_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return aDate - bDate;
}

function roleLabel(role) {
  switch (role) {
    case TOURNAMENT_USER_ROLE.OWNER:
      return 'Owner';
    case TOURNAMENT_USER_ROLE.ADMIN:
      return 'Admin';
    case TOURNAMENT_USER_ROLE.PUBLIC:
      return 'Público';
    case TOURNAMENT_USER_ROLE.PLAYER:
    default:
      return 'Jogador';
  }
}

function roleBadgeVariant(role) {
  if (role === TOURNAMENT_USER_ROLE.OWNER || role === TOURNAMENT_USER_ROLE.ADMIN) return 'success';
  if (role === TOURNAMENT_USER_ROLE.PUBLIC) return 'outline';
  return 'secondary';
}

function locationLabel(tournament) {
  return tournament.city ? `${tournament.city}${tournament.state ? ` / ${tournament.state}` : ''}` : 'Local não informado';
}

export default function Dashboard() {
  const { data: tournaments = [], isLoading } = useMyTournaments();
  const { data: publicTournaments = [], isLoading: isLoadingPublic } = usePublicTournaments();
  const {
    visibleTournaments,
    managedTournaments,
    playerTournaments,
    discoverableTournaments,
  } = useMemo(() => {
    const byId = new Map();
    tournaments.forEach((t) => byId.set(t.id, t));
    publicTournaments.forEach((t) => {
      if (!byId.has(t.id)) byId.set(t.id, { ...t, my_role: TOURNAMENT_USER_ROLE.PUBLIC });
    });
    const visible = Array.from(byId.values()).sort(compareTournaments);
    return {
      visibleTournaments: visible,
      managedTournaments: visible.filter((t) => t.my_role === TOURNAMENT_USER_ROLE.OWNER || t.my_role === TOURNAMENT_USER_ROLE.ADMIN),
      playerTournaments: visible.filter((t) => t.my_role === TOURNAMENT_USER_ROLE.PLAYER),
      discoverableTournaments: visible.filter((t) => t.my_role === TOURNAMENT_USER_ROLE.PUBLIC),
    };
  }, [tournaments, publicTournaments]);

  const stats = useMemo(
    () => [
      {
        label: 'sob sua gestão',
        value: managedTournaments.length,
        icon: ShieldCheck,
      },
      {
        label: 'em andamento',
        value: visibleTournaments.filter((t) => LIVE_STATUSES.has(t.status)).length,
        icon: Activity,
      },
      {
        label: 'públicos',
        value: discoverableTournaments.length,
        icon: Globe,
      },
    ],
    [discoverableTournaments.length, managedTournaments, visibleTournaments],
  );

  if (isLoading || isLoadingPublic) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link to="/torneios/criar">
            Criar torneio <Plus className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/torneios/ingressar">
            Entrar com código <Hash className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-[1.35rem] border border-emerald-950/10 bg-white/82 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold text-slate-950">{value}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75">{label}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {visibleTournaments.length === 0 ? (
        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:px-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-100 text-emerald-700">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-slate-950">Sua área de torneios ainda está vazia</h3>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/torneios/criar">Criar primeiro torneio</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/torneios/publicos">Explorar torneios públicos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {managedTournaments.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title="Torneios sob sua gestão"
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/torneios/criar">Novo torneio</Link>
                  </Button>
                }
              />
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {managedTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} ctaLabel="Abrir" />
                ))}
              </div>
            </section>
          )}

          {playerTournaments.length > 0 && (
            <section className="space-y-4">
              <SectionHeader title="Torneios em que você joga" />
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {playerTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} ctaLabel="Ver detalhes" />
                ))}
              </div>
            </section>
          )}

          {discoverableTournaments.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title="Torneios públicos"
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/torneios/publicos">Ver todos</Link>
                  </Button>
                }
              />
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {discoverableTournaments.slice(0, 3).map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} ctaLabel="Explorar" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[1.12fr,0.88fr]">
        <Skeleton className="h-[24rem] rounded-[2rem]" />
        <Skeleton className="h-[24rem] rounded-[2rem]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-56 rounded-[1.5rem]" />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h3 className="text-2xl font-semibold text-slate-950">{title}</h3>
      {action}
    </div>
  );
}

function TournamentCard({ tournament, ctaLabel }) {
  const dateRange = formatDateRange(tournament.starts_at, tournament.ends_at);
  const statusTone = STATUS_TONE[tournament.status] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <Link to={`/torneios/${tournament.id}`} className="block h-full">
      <Card className="match-surface h-full overflow-hidden rounded-[1.75rem] border-white/80 bg-white/85">
        <CardContent className="flex h-full flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">
                {roleLabel(tournament.my_role)}
              </div>
              <h4 className="mt-2 flex items-center gap-3 text-lg font-semibold text-slate-950">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Trophy className="h-4.5 w-4.5" />
                </span>
                <span className="truncate">{tournament.name}</span>
              </h4>
            </div>

            <Badge variant={roleBadgeVariant(tournament.my_role)} className="shrink-0 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] shadow-none">
              {roleLabel(tournament.my_role)}
            </Badge>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-700" />
            <span className="truncate">{locationLabel(tournament)}</span>
          </div>

          {tournament.description && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{tournament.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium ${statusTone}`}>
              <Calendar className="h-3 w-3" />
              {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
            </span>
            {dateRange && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-950/10 bg-white/75 px-2.5 py-1">
                <Calendar className="h-3 w-3" /> {dateRange}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-950/10 bg-white/75 px-2.5 py-1">
              <Globe className="h-3 w-3" /> {TOURNAMENT_VISIBILITY_LABELS[tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE]}
            </span>
            {tournament.invite_code && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-950/10 bg-white/75 px-2.5 py-1">
                <Hash className="h-3 w-3" /> {tournament.invite_code}
              </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between pt-6 text-sm font-medium text-emerald-800">
            <span>{ctaLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
