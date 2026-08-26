import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  TrendingUp,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Flame,
  Globe,
  Hash,
  Sparkles,
  MapPin,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useMyTournaments, usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { getMyUpcomingMatches } from '@/modules/tournament/services/upcomingService';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
} from '@/modules/tournament/domain/constants';
import { PLATFORM_INTEREST_META, sanitizeInterests } from '@/modules/athletes/domain/profileMeta';
import { interestIcon } from '@/v2/components/profile/profileMetaIcons';
import { V2Skeleton, V2StatCard } from '@/v2/ui/primitives';

const INTEREST_BY_VALUE = Object.fromEntries(PLATFORM_INTEREST_META.map((m) => [m.value, m]));
// Ações rápidas padrão (quando o usuário não escolheu interesses).
const DEFAULT_QUICK_ACTIONS = ['play_tournaments', 'random_partners', 'book_courts', 'ranking'];

const LIVE_STATUSES = new Set([
  TOURNAMENT_STATUS.IN_PROGRESS,
  TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
  TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
]);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

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
  if (!start && !end) return 'Datas a definir';
  const fmt = (v) => v.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  if (start && end) return start.toDateString() === end.toDateString() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end);
}

function locationLabel(t) {
  return t?.city ? `${t.city}${t.state ? ` / ${t.state}` : ''}` : 'Local a definir';
}

function formatMatchWhen(ms) {
  if (!ms) return 'Horário a definir';
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function V2Dashboard() {
  const { user, userProfile } = useAuth();
  const skillRatingOn = useFeatureFlag(FEATURE_FLAG.SKILL_RATING_DUPR);
  const { data: myTournaments = [], isLoading: loadingMine } = useMyTournaments();
  const { data: publicTournaments = [], isLoading: loadingPublic } = usePublicTournaments();
  const { data: ranking = [] } = useNationalRanking();

  const name = (userProfile?.platform_name || user?.displayName || 'Atleta').split(' ')[0];

  const me = useMemo(() => ranking.find((p) => p.id === user?.uid || p.uid === user?.uid) || null, [ranking, user?.uid]);

  const spotlight = useMemo(() => {
    const live = myTournaments.filter((t) => LIVE_STATUSES.has(t.status));
    const mineNotArchived = myTournaments.find((t) => !t.archived);
    return live[0] || mineNotArchived || publicTournaments[0] || null;
  }, [myTournaments, publicTournaments]);

  // Torneios com inscrição realmente aberta: status aberto E ainda não vencidos
  // pela data (prazo de inscrição e data de término não podem ter passado).
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const openTournaments = useMemo(() => publicTournaments.filter((t) => {
    if (t.status !== TOURNAMENT_STATUS.REGISTRATIONS_OPEN) return false;
    const deadline = parseDate(t.registration_deadline);
    if (deadline && deadline < today) return false;
    const ends = parseDate(t.ends_at);
    if (ends && ends < today) return false;
    return true;
  }), [publicTournaments, today]);
  const featured = openTournaments[0] || null;

  // Próximos jogos marcados (agendados) do atleta.
  const { data: upcomingMatches = [], isLoading: loadingUpcoming } = useQuery({
    queryKey: ['dashboard-upcoming', user?.uid],
    queryFn: () => getMyUpcomingMatches(user?.uid, { limit: 4 }),
    enabled: !!user?.uid,
    staleTime: 30_000,
  });

  // Ações rápidas personalizadas pelos interesses do usuário.
  const quickActions = useMemo(() => {
    const chosen = sanitizeInterests(userProfile?.interests);
    const keys = chosen.length > 0 ? chosen : DEFAULT_QUICK_ACTIONS;
    const seenRoutes = new Set();
    const out = [];
    keys.forEach((k) => {
      const meta = INTEREST_BY_VALUE[k];
      if (!meta || seenRoutes.has(meta.route)) return;
      seenRoutes.add(meta.route);
      out.push(meta);
    });
    return out.slice(0, 6);
  }, [userProfile?.interests]);

  const managedCount = useMemo(
    () => myTournaments.filter((t) => t.my_role === 'owner' || t.my_role === 'admin').length,
    [myTournaments],
  );
  const liveCount = useMemo(() => myTournaments.filter((t) => LIVE_STATUSES.has(t.status)).length, [myTournaments]);

  const isLoading = loadingMine || loadingPublic;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{greeting()}, {name} 👋</h1>
        <p className="mt-2 font-medium text-gray-500">
          {me
            ? <>Você está em <span className="font-bold text-ink">{me.position}º</span> no ranking nacional com rating <span className="font-bold text-ink">{me.rating}</span>.</>
            : 'Acompanhe seus torneios, quadras e a comunidade em um só lugar.'}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <V2Skeleton className="h-64 rounded-4xl md:col-span-2" />
          <V2Skeleton className="h-64 rounded-4xl" />
          <V2Skeleton className="h-64 rounded-4xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {/* Hero card */}
          <div className="group relative col-span-1 overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic md:col-span-2 xl:col-span-2">
            <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-acid opacity-20 blur-[80px] transition-opacity duration-700 group-hover:opacity-30" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid backdrop-blur-md">
                  {spotlight && LIVE_STATUSES.has(spotlight.status) ? 'Em destaque agora' : 'Comece por aqui'}
                </span>
                <h2 className="mt-4 font-display text-3xl font-bold text-white">
                  {spotlight ? spotlight.name : 'Sua jornada no pickleball'}
                </h2>
                <p className="mt-2 flex items-center gap-2 text-gray-300">
                  {spotlight ? (
                    <><MapPin className="h-4 w-4" /> {locationLabel(spotlight)} • {formatDateRange(spotlight.starts_at, spotlight.ends_at)}</>
                  ) : (
                    'Crie um torneio ou explore os eventos públicos da plataforma.'
                  )}
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4 rounded-2.5xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg">
                {spotlight ? (
                  <>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
                      {TOURNAMENT_STATUS_LABELS[spotlight.status] || spotlight.status}
                    </span>
                    <Link
                      to={`/torneios/${spotlight.id}`}
                      className="btn-press rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink transition-transform hover:scale-105"
                    >
                      Abrir torneio
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-300">Nenhum torneio em contexto ainda.</span>
                    <Link to="/torneios/criar" className="btn-press rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink hover:scale-105">
                      Criar torneio
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stat: rating / nível */}
          <V2StatCard
            icon={TrendingUp}
            accent="ink"
            label={me ? 'Rating nacional' : 'Seu nível'}
            value={me ? me.rating : (userProfile?.level || userProfile?.leveling_level || '—')}
            delta={me ? `${me.position}º` : null}
            deltaTone="green"
            hint={me ? `${me.wins}V – ${me.losses}D em ${me.games} jogo(s)` : 'Complete seu nivelamento no perfil'}
          />

          {/* Stat: torneios */}
          <V2StatCard
            icon={Flame}
            accent="acid"
            label="Torneios ativos"
            value={liveCount}
            hint={managedCount > 0 ? `${managedCount} sob sua gestão` : 'Participe ou crie um evento'}
          />

          {/* Torneios com inscrição aberta (com estado vazio explícito) */}
          <div className="group relative col-span-1 flex flex-col items-center justify-between overflow-hidden rounded-4xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white shadow-organic md:col-span-2 sm:flex-row xl:col-span-2">
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full border-[40px] border-white/10 transition-transform duration-700 group-hover:scale-110" />
            <div className="relative z-10 mb-6 text-center sm:mb-0 sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-200">
                {featured ? `Inscrições abertas · ${openTournaments.length} torneio(s)` : 'Torneios'}
              </p>
              <h3 className="mb-2 mt-1 font-display text-2xl font-bold">
                {featured ? featured.name : 'Nenhum torneio com inscrição aberta'}
              </h3>
              <p className="max-w-sm text-blue-100 opacity-90">
                {featured
                  ? `${TOURNAMENT_STATUS_LABELS[featured.status] || ''} • ${locationLabel(featured)}`
                  : 'No momento não há torneios com inscrição aberta. Explore os eventos ou crie o seu.'}
              </p>
            </div>
            <Link
              to={featured ? `/torneios/${featured.id}` : '/torneios'}
              className="relative z-10 whitespace-nowrap rounded-full bg-white px-8 py-3.5 font-bold text-indigo-700 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              {featured ? 'Garantir vaga' : 'Ver torneios'}
            </Link>
          </div>

          {/* Ações rápidas personalizadas pelos interesses */}
          <div className="col-span-1 grid grid-cols-2 gap-4 md:col-span-2 xl:col-span-2">
            {quickActions.map((a) => (
              <QuickAction key={a.value} to={a.route} icon={interestIcon(a.icon)} label={a.label} />
            ))}
          </div>
        </div>
      )}

      {/* Próximos jogos marcados (com estado vazio explícito) */}
      <div className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-ink" />
          <h2 className="font-display text-xl font-bold text-ink">Próximos jogos</h2>
        </div>
        {loadingUpcoming ? (
          <V2Skeleton className="h-28 rounded-4xl" />
        ) : upcomingMatches.length === 0 ? (
          <div className="flex items-center gap-3 rounded-4xl border border-gray-100 bg-paper-pure p-6 text-sm text-gray-500 shadow-organic-sm">
            <CalendarX className="h-5 w-5 shrink-0 text-gray-400" />
            Você não tem jogos marcados no momento.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingMatches.map((m) => (
              <Link
                key={m.matchId}
                to={`/torneios/${m.tournamentId}`}
                className="flex items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm transition-all hover:shadow-organic"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500"><Trophy className="h-3.5 w-3.5" /> {m.tournamentName}</div>
                  <div className="mt-1 font-bold text-ink">vs {m.opponent}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatMatchWhen(m.scheduledAt)}{m.court ? ` · ${m.court}` : ''}</div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-gray-300" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Discovery strip */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DiscoveryCard to="/atletas" icon={Trophy} title="Atletas" description="Encontre parceiros do seu nível na comunidade." />
        <DiscoveryCard to="/ranking" icon={Globe} title="Ranking nacional" description="Veja quem está no topo e onde você está." />
        {skillRatingOn && (
          <DiscoveryCard to="/ranking?tab=dupr" icon={Sparkles} title="Nível 2.0–8.0" description="Seu rating no formato DUPR, pelos jogos da plataforma." />
        )}
        <DiscoveryCard to="/novidades" icon={Hash} title="Comunidade" description="Movimentos recentes de torneios e jogos." />
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="btn-press group flex flex-col items-center justify-center gap-4 rounded-3xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:border-gray-300 hover:shadow-organic"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paper text-2xl text-ink transition-colors group-hover:bg-acid">
        <Icon className="h-6 w-6" />
      </div>
      <span className="font-display font-semibold text-ink">{label}</span>
    </Link>
  );
}

function DiscoveryCard({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="btn-press group flex items-center gap-4 rounded-3xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:border-gray-300 hover:shadow-organic"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white transition-colors group-hover:bg-acid group-hover:text-ink">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold text-ink">{title}</p>
        <p className="truncate text-sm text-gray-500">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-ink" />
    </Link>
  );
}
