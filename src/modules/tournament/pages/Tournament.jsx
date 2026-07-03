import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  PLATFORM_TABS_LIST_CLASS,
  PLATFORM_TABS_TRIGGER_CLASS,
} from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Hash,
  Images,
  MapPin,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useTournament, useIsTournamentAdmin, useModalities } from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import { useClipboard } from '@/core/lib/useClipboard';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import TournamentOverviewTab from '../components/TournamentOverviewTab';
import TournamentMatchesTab from '../components/TournamentMatchesTab';
import TournamentRankingTab from '../components/TournamentRankingTab';
import TournamentAdminPanel from '../components/TournamentAdminPanel';
import TournamentGallery from '../components/TournamentGallery';

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
  [TOURNAMENT_STATUS.DRAFT]: 'bg-paper text-gray-600 border-gray-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'bg-green-100 text-green-700 border-green-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'bg-amber-100 text-amber-900 border-amber-200',
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-900 border-blue-200',
  [TOURNAMENT_STATUS.FINISHED]: 'bg-gray-200 text-gray-600 border-gray-200',
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
  const tone = STATUS_TONE[status] || 'bg-paper text-gray-600 border-gray-200';
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
  const { data: modalities = [] } = useModalities(tournamentId);
  const modalityPagesOn = useFeatureFlag(FEATURE_FLAG.MODALITY_PAGES);
  const galleryOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_GALLERY);
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
          <CardContent className="p-6 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-green-100 text-green-700">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-ink">Torneio não encontrado</h2>
            <p className="text-sm text-gray-500 mt-1">
              Verifique o link ou volte para <Link to="/inicio" className="text-green-700 underline">seus torneios</Link>.
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

  const showGalleryTab = modalityPagesOn && galleryOn;
  if (tab === 'fotos' && !showGalleryTab) {
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
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr,0.85fr]">
        <Card className="bg-ink text-white overflow-hidden rounded-[1.25rem] border-0 sm:rounded-[2rem]">
          <CardContent className="relative p-5 sm:p-8 lg:p-9">
            <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_50%)] lg:block" />
            <div className="relative max-w-3xl">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-white/10 text-white backdrop-blur-sm sm:h-14 sm:w-14 sm:rounded-[1.5rem]">
                  <Trophy className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">{tournament.name}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
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
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{label}</div>
                      <Icon className="h-4 w-4 text-white/70" />
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
            <h2 className="text-xl font-semibold text-ink">Ações rápidas</h2>

            <div className="mt-5 grid gap-3">
              {tournament.invite_code && (
                <Button
                  variant="outline"
                  className="justify-between"
                  onClick={() => copy(tournament.invite_code, 'Código copiado para a área de transferência.')}
                >
                  <span className="flex items-center gap-2 truncate">
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
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
            <TabsList className={`${PLATFORM_TABS_LIST_CLASS} min-w-full rounded-[1.5rem] bg-paper p-2 sm:min-w-0`}>
              <TabsTrigger
                value={PLAYER_TABS[0].value}
                className={PLATFORM_TABS_TRIGGER_CLASS}
              >
                {PLAYER_TABS[0].label}
              </TabsTrigger>
              {modalityPagesOn && (
                <ModalityTabsMenu tournamentId={tournamentId} modalities={modalities} />
              )}
              <TabsTrigger
                value={PLAYER_TABS[1].value}
                className={PLATFORM_TABS_TRIGGER_CLASS}
              >
                {PLAYER_TABS[1].label}
              </TabsTrigger>
              <TabsTrigger
                value={PLAYER_TABS[2].value}
                className={PLATFORM_TABS_TRIGGER_CLASS}
              >
                {PLAYER_TABS[2].label}
              </TabsTrigger>
              {showGalleryTab && (
                <TabsTrigger value="fotos" className={PLATFORM_TABS_TRIGGER_CLASS}>
                  <Images className="mr-1 h-4 w-4" /> Fotos
                </TabsTrigger>
              )}
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
        {showGalleryTab && (
          <TabsContent value="fotos" className="mt-4">
            <TournamentGallery tournamentId={tournament.id} canManage={!!isAdmin} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="admin" className="mt-4">
            <TournamentAdminPanel tournament={tournament} />
          </TabsContent>
        )}
      </Tabs>

      {!showGalleryTab && <TournamentGallery tournamentId={tournament.id} canManage={!!isAdmin} />}
    </div>
  );
}

function ModalityTabsMenu({ tournamentId, modalities }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-gray-500 transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid"
        >
          Modalidades
          <ChevronDown className="ml-1 h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[22rem] rounded-[1.5rem] border-white/80 bg-white/95 p-2 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-green-700/80">
          Modalidades do torneio
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-200" />
        {modalities.length === 0 ? (
          <DropdownMenuItem disabled className="rounded-[1.25rem] px-3 py-3 text-sm leading-6 text-gray-500">
            Ainda não há modalidades criadas para este torneio.
          </DropdownMenuItem>
        ) : (
          modalities.map((modality) => (
            <DropdownMenuItem
              key={modality.id}
              asChild
              className="rounded-[1.25rem] px-3 py-3 focus:bg-green-50"
            >
              <Link to={`/torneios/${tournamentId}/modalidades/${modality.id}`}>
                <div className="text-sm font-semibold text-ink">{modality.name}</div>
                <div className="mt-1 text-xs leading-5 text-gray-500">
                  {MODALITY_FORMAT_LABELS[modality.format] || modality.format}
                  {' · '}
                  {SKILL_LEVEL_LABELS[modality.skill_level] || modality.skill_level}
                </div>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
