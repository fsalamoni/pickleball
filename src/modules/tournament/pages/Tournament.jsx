import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Check,
  Copy,
  Eye,
  Hash,
  MapPin,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useTournament, useIsTournamentAdmin } from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import { useClipboard } from '@/core/lib/useClipboard';
import TournamentOverviewTab from '../components/TournamentOverviewTab';
import TournamentMatchesTab from '../components/TournamentMatchesTab';
import TournamentRankingTab from '../components/TournamentRankingTab';
import TournamentAdminPanel from '../components/TournamentAdminPanel';

// Abas visíveis a qualquer participante. As inscrições e a lista de
// modalidades passaram a viver dentro da própria "Visão geral", com o botão
// de inscrição e o modal de informações em cada cartão de modalidade.
// Ações de gestão ficam exclusivamente na aba "Admin".
const PLAYER_TABS = [
  { value: 'visao-geral', label: 'Visão geral' },
  { value: 'jogos', label: 'Jogos' },
  { value: 'ranking', label: 'Ranking' },
];

// Abas obsoletas que ainda podem aparecer em links salvos. Redirecionamos
// para a nova home da modalidade (visão geral).
const LEGACY_PLAYER_TABS = new Set(['modalidades', 'inscritos']);

const STATUS_TONE = {
  [TOURNAMENT_STATUS.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'bg-amber-100 text-amber-900 border-amber-200',
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-900 border-blue-200',
  [TOURNAMENT_STATUS.FINISHED]: 'bg-slate-200 text-slate-700 border-slate-300',
  [TOURNAMENT_STATUS.CANCELLED]: 'bg-red-100 text-red-800 border-red-200',
};

function parseDate(value) {
  if (!value) return null;
  try {
    const date = typeof value === 'string'
      ? new Date(`${value}T00:00:00`)
      : value?.toDate
        ? value.toDate()
        : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return null;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateRange(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate && !endDate) return null;
  const fmt = (value) => value.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  if (startDate && endDate) {
    return startDate.toDateString() === endDate.toDateString() ? fmt(startDate) : `${fmt(startDate)} a ${fmt(endDate)}`;
  }
  return fmt(startDate || endDate);
}

function StatusPill({ status }) {
  const tone = STATUS_TONE[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${tone}`}>
      <Calendar className="w-3 h-3" /> {TOURNAMENT_STATUS_LABELS[status] || status}
    </span>
  );
}

export default function Tournament() {
  const { tournamentId, tab = 'visao-geral' } = useParams();
  const navigate = useNavigate();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: isAdmin } = useIsTournamentAdmin(tournamentId);
  const { copy, copied } = useClipboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
          <Skeleton className="h-[18rem] rounded-[2rem]" />
          <div className="grid gap-4">
            <Skeleton className="h-44 rounded-[1.75rem]" />
            <Skeleton className="h-32 rounded-[1.75rem]" />
          </div>
        </div>
        <Skeleton className="h-16 rounded-[1.75rem]" />
        <Skeleton className="h-[26rem] rounded-[2rem]" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="rounded-[2rem] border-white/80 bg-white/85">
          <CardContent className="p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-100 text-emerald-700">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-slate-950">Torneio não encontrado</h2>
            <p className="text-sm text-slate-600 mt-1">
              Verifique o link ou volte para <Link to="/inicio" className="text-emerald-700 underline">seus torneios</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redireciona automaticamente abas obsoletas (ex.: /sorteio) para a área correta.
  if (tab === 'sorteio') {
    navigate(`/torneios/${tournamentId}/${isAdmin ? 'admin' : 'jogos'}`, { replace: true });
    return null;
  }
  if (LEGACY_PLAYER_TABS.has(tab)) {
    navigate(`/torneios/${tournamentId}/visao-geral`, { replace: true });
    return null;
  }
  if (tab === 'admin' && !isAdmin) {
    navigate(`/torneios/${tournamentId}/visao-geral`, { replace: true });
    return null;
  }

  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/p/${tournament.id}` : '';
  const dateRange = formatDateRange(tournament.starts_at, tournament.ends_at);
  const registrationDeadline = formatDate(tournament.registration_deadline);
  const locationLabel = tournament.city
    ? `${tournament.city}${tournament.state ? ` / ${tournament.state}` : ''}`
    : 'Local ainda não informado';
  const surfaceCards = [
    {
      label: 'Local',
      value: locationLabel,
      icon: MapPin,
    },
    {
      label: 'Datas do evento',
      value: dateRange || 'Datas a definir',
      icon: Calendar,
    },
    {
      label: 'Inscrições até',
      value: registrationDeadline || 'Prazo ainda não definido',
      icon: Hash,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
        <Card className="arena-panel-strong overflow-hidden rounded-[2rem] border-0">
          <CardContent className="relative p-6 sm:p-8 lg:p-9">
            <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_50%)] lg:block" />
            <div className="relative max-w-3xl">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-white/10 text-white backdrop-blur-sm">
                  <Trophy className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-semibold leading-tight text-white lg:text-4xl">{tournament.name}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-emerald-50/75 sm:text-base">
                    {tournament.description || 'Acompanhe modalidades, jogos, ranking e operação do evento.'}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <StatusPill status={tournament.status} />
                <Badge variant="secondary" className="rounded-full border-0 bg-white/15 px-3 py-1 text-xs text-white shadow-none">
                  {TOURNAMENT_VISIBILITY_LABELS[tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE]}
                </Badge>
                {isAdmin && (
                  <Badge variant="secondary" className="rounded-full border-0 bg-amber-300 px-3 py-1 text-xs font-semibold text-amber-950 shadow-none">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Admin do torneio
                  </Badge>
                )}
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {surfaceCards.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-[1.35rem] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50/70">{label}</div>
                      <Icon className="h-4 w-4 text-emerald-50/80" />
                    </div>
                    <div className="mt-3 text-sm font-medium leading-6 text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/80 bg-white/82">
          <CardContent className="p-6 sm:p-7">
            <h2 className="text-xl font-semibold text-slate-950">Ações rápidas</h2>

            <div className="mt-5 grid gap-3">
              {tournament.invite_code && (
                <Button
                  variant="outline"
                  className="justify-between"
                  onClick={() => copy(tournament.invite_code, 'Código copiado para a área de transferência.')}
                >
                  <span className="flex items-center gap-2 truncate">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    Código: <strong className="tabular-nums">{tournament.invite_code}</strong>
                  </span>
                </Button>
              )}
              {isPublic && (
                <Button
                  variant="outline"
                  className="justify-between"
                  onClick={() => copy(publicUrl, 'Link público copiado!')}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Share2 className="h-4 w-4" /> Compartilhar link público
                  </span>
                </Button>
              )}
              <Button asChild variant="outline" className="justify-between">
                <Link to={`/p/${tournament.id}`} target="_blank" rel="noreferrer">
                  <span className="flex items-center gap-2 truncate">
                    <Eye className="h-4 w-4" /> Abrir visão pública
                  </span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate(`/torneios/${tournamentId}/${v}`)}
        className="w-full"
      >
        <div className="rounded-[1.75rem] border border-white/80 bg-white/82 p-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
          <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex h-auto min-w-full justify-start gap-2 rounded-[1.5rem] bg-secondary/45 p-2 sm:min-w-0">
            {PLAYER_TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_14px_30px_-22px_rgba(15,23,42,0.45)]"
              >
                {t.label}
              </TabsTrigger>
            ))}
            {isAdmin && (
              <TabsTrigger
                value="admin"
                className="ml-1 rounded-full bg-amber-100 text-amber-950 hover:bg-amber-200 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_14px_30px_-22px_rgba(180,83,9,0.55)]"
              >
                <ShieldAlert className="w-4 h-4 mr-1" /> Admin
              </TabsTrigger>
            )}
            </TabsList>
          </div>
        </div>

        <TabsContent value="visao-geral" className="mt-4">
          <TournamentOverviewTab tournament={tournament} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="jogos" className="mt-4">
          <TournamentMatchesTab tournament={tournament} isAdmin={false} />
        </TabsContent>
        <TabsContent value="ranking" className="mt-4">
          <TournamentRankingTab tournament={tournament} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-4">
            <TournamentAdminPanel tournament={tournament} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
