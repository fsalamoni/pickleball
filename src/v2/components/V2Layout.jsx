import React, { Suspense, lazy, useState, useMemo, useRef, useEffect } from 'react';
import { Link, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  LayoutDashboard,
  MapPin,
  Trophy,
  Zap,
  Users,
  Medal,
  Swords,
  Megaphone,
  Building2,
  HeartHandshake,
  MessageSquare,
  BarChart3,
  User,
  Settings,
  BookOpen,
  Award,
  History,
  FileText,
  Menu,
  X,
  Plus,
  ChevronRight,
  Bell,
  LogOut,
  Pencil,
  Search as SearchIcon,
  GraduationCap,
  CalendarClock,
  Dices,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAutoRecomputeRatings } from '@/modules/rating/hooks/useRating';
import AuthFunnelTracker from '@/modules/analytics/components/AuthFunnelTracker';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { getLevelByCode } from '@/modules/leveling/data/levels';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/core/lib/utils';
import { V2Avatar } from '@/v2/ui/primitives';
import ProfileCompletionModal from '@/components/ProfileCompletionModal';
import V2OnboardingWizard from '@/v2/components/onboarding/V2OnboardingWizard';
import LegalConsentGate from '@/v2/components/legal/LegalConsentGate';

const BRAND = 'PickleRush';

/**
 * Títulos por rota (flag page_titles). Prefixos ordenados do mais específico
 * para o mais genérico; '/' é o fallback exato.
 */
const PAGE_TITLES = [
  ['/torneios', 'Torneios'],
  ['/arenas', 'Arenas'],
  ['/minhas-reservas', 'Minhas reservas'],
  ['/atletas', 'Atletas'],
  ['/atleta/', 'Atleta'],
  ['/ranking', 'Ranking'],
  ['/encontrar-jogadores', 'Encontrar jogadores'],
  ['/procura-jogo', 'Procura-se jogo'],
  ['/dia-de-jogo', 'Dia de jogo'],
  ['/clubes', 'Clubes'],
  ['/novidades', 'Comunidade'],
  ['/parceiros', 'Parceiros'],
  ['/chat', 'Mensagens'],
  ['/meu-desempenho', 'Meu desempenho'],
  ['/perfil', 'Meu perfil'],
  ['/regras', 'Regras'],
  ['/nivelamento', 'Nivelamento'],
  ['/historia', 'História do esporte'],
  ['/conduta', 'Conduta e fair play'],
  ['/legal', 'Termos e Documentos'],
  ['/politica-uso', 'Política de Uso'],
  ['/admin', 'Admin'],
];

function resolvePageTitle(pathname) {
  if (pathname === '/') return 'Visão Geral';
  const match = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : null;
}

function useV2Nav() {
  const { isPlatformAdmin, user } = useAuth();
  const performanceOn = useFeatureFlag(FEATURE_FLAG.PLAYER_PERFORMANCE);
  const ratingOn = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const matchmakingOn = useFeatureFlag(FEATURE_FLAG.MATCHMAKING);
  const openGamesOn = useFeatureFlag(FEATURE_FLAG.OPEN_GAMES);
  const adminConsoleOn = useFeatureFlag(FEATURE_FLAG.ADMIN_CONSOLE);
  const affiliatesOn = useFeatureFlag(FEATURE_FLAG.AFFILIATE_LINKS);
  const communityFeedOn = useFeatureFlag(FEATURE_FLAG.COMMUNITY_FEED);
  const arenasOn = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const circuitsOn = useFeatureFlag(FEATURE_FLAG.CIRCUITS);
  const coachesOn = useFeatureFlag(FEATURE_FLAG.COACH_RESIDENT);
  const coachLessonsOn = useFeatureFlag(FEATURE_FLAG.COACH_LESSONS);
  const doublesRankingOn = useFeatureFlag(FEATURE_FLAG.DOUBLES_RANKING);
  const athleteAgendaOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_AGENDA);
  const gameDayOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_GAME_DAY);
  const legalCenterOn = useFeatureFlag(FEATURE_FLAG.LEGAL_CENTER);
  const settingsPageOn = useFeatureFlag(FEATURE_FLAG.SETTINGS_PAGE);
  const { totalArenas: myArenasCount, totalPendingBookings: myPendingBookings } = useMyArenaSummary();
  const showMyArenas = arenasOn && myArenasCount > 0;
  // Só busca o perfil de professor quando a área de aulas está ligada.
  const { data: myCoachProfile } = useCoach(coachLessonsOn ? user?.uid : null);
  const isCoach = coachLessonsOn && !!myCoachProfile;
  const sportHistoryOn = useFeatureFlag(FEATURE_FLAG.SPORT_HISTORY);

  const sections = useMemo(() => [
    {
      title: 'Plataforma',
      items: [
        { to: '/', label: 'Visão Geral', icon: LayoutGrid, exact: true },
        (arenasOn || isPlatformAdmin) && { to: '/arenas', label: 'Explorar Quadras', icon: MapPin, tag: !arenasOn && isPlatformAdmin ? 'Off' : undefined },
        { to: '/torneios', label: 'Torneios', icon: Trophy, tag: 'Novo' },
        circuitsOn && { to: '/circuits', label: 'Circuitos', icon: Award },
        coachesOn && { to: '/coaches', label: 'Professores', icon: GraduationCap },
        communityFeedOn && { to: '/novidades', label: 'Comunidade', icon: Zap },
      ].filter(Boolean),
    },
    {
      title: 'Descobrir',
      items: [
        { to: '/atletas', label: 'Atletas', icon: Users },
        ratingOn && { to: '/ranking', label: 'Ranking', icon: Medal },
        doublesRankingOn && { to: '/ranking/duplas', label: 'Ranking de duplas', icon: Medal },
        ratingOn && matchmakingOn && { to: '/encontrar-jogadores', label: 'Encontrar jogadores', icon: Swords },
        openGamesOn && { to: '/procura-jogo', label: 'Procura-se jogo', icon: Megaphone },
        { to: '/clubes', label: 'Clubes', icon: Building2 },
        affiliatesOn && { to: '/parceiros', label: 'Parceiros', icon: HeartHandshake },
      ].filter(Boolean),
    },
    {
      title: 'Você',
      items: [
        { to: '/chat', label: 'Mensagens', icon: MessageSquare },
        gameDayOn && { to: '/dia-de-jogo', label: 'Dia de jogo', icon: Dices },
        performanceOn && { to: '/meu-desempenho', label: 'Meu desempenho', icon: BarChart3 },
        showMyArenas && {
          to: '/arenas',
          label: 'Minhas arenas',
          icon: Building2,
          badge: myPendingBookings,
          badgeHint: myPendingBookings > 0
            ? `${myPendingBookings} pedido(s) de reserva aguardando resposta`
            : undefined,
        },
        arenasOn && { to: '/minhas-reservas', label: 'Minhas reservas', icon: Building2 },
        isCoach && { to: '/aulas', label: 'Ensino', icon: GraduationCap },
        coachLessonsOn && { to: '/minhas-aulas', label: 'Minhas aulas', icon: GraduationCap },
        { to: '/perfil', label: 'Meu Perfil', icon: User },
        settingsPageOn && { to: '/configuracoes', label: 'Configurações', icon: Settings },
      ].filter(Boolean),
    },
    isPlatformAdmin && {
      title: 'Admin geral',
      items: [
        adminConsoleOn && { to: '/admin/painel', label: 'Painel', icon: LayoutDashboard, tag: 'Novo' },
      ].filter(Boolean),
    },
    {
      title: 'Aprender',
      items: [
        { to: '/regras', label: 'Regras', icon: BookOpen },
        { to: '/nivelamento', label: 'Nivelamento', icon: Award },
        sportHistoryOn && { to: '/historia', label: 'História do esporte', icon: History },
        { to: '/conduta', label: 'Conduta e fair play', icon: HeartHandshake },
        { to: legalCenterOn ? '/legal' : '/politica-uso', label: 'Termos e Documentos', icon: FileText },
      ].filter(Boolean),
    },
  ].filter(Boolean), [performanceOn, ratingOn, matchmakingOn, openGamesOn, affiliatesOn, communityFeedOn, arenasOn, circuitsOn, coachesOn, coachLessonsOn, isCoach, sportHistoryOn, isPlatformAdmin, adminConsoleOn, gameDayOn, legalCenterOn, myArenasCount, myPendingBookings, showMyArenas]);

  // Árvore de hubs (flag nav_hubs): destinos centrais (nível 1, barra lateral)
  // com suas subpáginas (nível 2, barra superior). Organizada por tema.
  const hubs = useMemo(() => {
    const hub = (h) => {
      const children = (h.children || []).filter(Boolean);
      return { ...h, children };
    };
    return [
      hub({ id: 'inicio', label: 'Início', icon: LayoutGrid, to: '/', exact: true, children: [] }),
      hub({
        id: 'competir', label: 'Competir', icon: Trophy, to: '/torneios',
        children: [
          { to: '/torneios', label: 'Torneios', icon: Trophy },
          circuitsOn && { to: '/circuits', label: 'Circuitos', icon: Award },
          ratingOn && { to: '/ranking', label: 'Ranking', icon: Medal },
          doublesRankingOn && { to: '/ranking/duplas', label: 'Ranking de duplas', icon: Medal },
        ],
      }),
      hub({
        id: 'jogar', label: 'Jogar', icon: Swords, to: openGamesOn ? '/procura-jogo' : (gameDayOn ? '/dia-de-jogo' : '/encontrar-jogadores'),
        children: [
          ratingOn && matchmakingOn && { to: '/encontrar-jogadores', label: 'Encontrar jogadores', icon: Swords },
          openGamesOn && { to: '/procura-jogo', label: 'Procura-se jogo', icon: Megaphone },
          gameDayOn && { to: '/dia-de-jogo', label: 'Dia de jogo', icon: Dices },
        ],
      }),
      hub({
        id: 'comunidade', label: 'Comunidade', icon: Users, to: '/atletas',
        children: [
          { to: '/atletas', label: 'Atletas', icon: Users },
          { to: '/clubes', label: 'Clubes', icon: Building2 },
          communityFeedOn && { to: '/novidades', label: 'Novidades', icon: Zap },
          { to: '/chat', label: 'Mensagens', icon: MessageSquare },
        ],
      }),
      (arenasOn || isPlatformAdmin) && hub({
        id: 'arenas', label: 'Arenas', icon: Building2, to: '/arenas',
        badge: showMyArenas ? myPendingBookings : 0,
        badgeHint: showMyArenas && myPendingBookings > 0 ? `${myPendingBookings} pedido(s) de reserva aguardando resposta` : undefined,
        children: [
          { to: '/arenas', label: 'Explorar quadras', icon: MapPin },
          arenasOn && { to: '/minhas-reservas', label: 'Minhas reservas', icon: CalendarClock },
        ],
      }),
      (coachesOn || isCoach || coachLessonsOn) && hub({
        id: 'ensino', label: 'Aulas', icon: GraduationCap, to: coachesOn ? '/coaches' : '/minhas-aulas',
        children: [
          coachesOn && { to: '/coaches', label: 'Professores', icon: GraduationCap },
          coachLessonsOn && { to: '/minhas-aulas', label: 'Minhas aulas', icon: CalendarClock },
          isCoach && { to: '/aulas', label: 'Painel do professor', icon: GraduationCap },
        ],
      }),
      hub({
        id: 'aprender', label: 'Pickleball', icon: BookOpen, to: '/regras',
        children: [
          { to: '/regras', label: 'Regras', icon: BookOpen },
          { to: '/nivelamento', label: 'Nivelamento', icon: Award },
          sportHistoryOn && { to: '/historia', label: 'História do esporte', icon: History },
          { to: '/conduta', label: 'Conduta e fair play', icon: HeartHandshake },
        ],
      }),
      hub({
        id: 'perfil', label: 'Perfil', icon: User, to: '/perfil',
        children: [
          { to: '/perfil', label: 'Meu perfil', icon: User },
          performanceOn && { to: '/meu-desempenho', label: 'Meu desempenho', icon: BarChart3 },
          settingsPageOn && { to: '/configuracoes', label: 'Configurações', icon: Settings },
        ],
      }),
      // Parceiros da plataforma — seção própria e exclusiva, por último na lista.
      affiliatesOn && hub({
        id: 'parceiros', label: 'Parceiros', icon: HeartHandshake, to: '/parceiros',
        children: [{ to: '/parceiros', label: 'Parceiros', icon: HeartHandshake }],
      }),
      isPlatformAdmin && adminConsoleOn && hub({
        id: 'admin', label: 'Admin', icon: LayoutDashboard, to: '/admin/painel',
        children: [{ to: '/admin/painel', label: 'Painel admin', icon: LayoutDashboard }],
      }),
    ].filter(Boolean).filter((h) => h.id === 'inicio' || h.children.length > 0);
  }, [performanceOn, ratingOn, matchmakingOn, openGamesOn, affiliatesOn, communityFeedOn, arenasOn, circuitsOn, coachesOn, coachLessonsOn, isCoach, sportHistoryOn, isPlatformAdmin, adminConsoleOn, doublesRankingOn, athleteAgendaOn, gameDayOn, legalCenterOn, settingsPageOn, myPendingBookings, showMyArenas]);

  return { sections, hubs };
}

/** Hub ativo: o que contém a subpágina mais específica que casa com o path. */
function findActiveHub(pathname, hubs) {
  if (pathname === '/') return hubs.find((h) => h.id === 'inicio') || null;
  let best = null;
  let bestLen = -1;
  for (const h of hubs) {
    const candidates = h.children.length ? h.children : [{ to: h.to, exact: h.exact }];
    for (const c of candidates) {
      if (isActive(pathname, c) && c.to.length > bestLen) { best = h; bestLen = c.to.length; }
    }
  }
  return best;
}

function isActive(pathname, item) {
  if (item.exact) return pathname === item.to;
  const base = item.to.endsWith('/') ? item.to : `${item.to}/`;
  const current = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return current === base || current.startsWith(base);
}

function BrandLockup() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img src="/logo-claro.png" alt="PickleRush" className="h-9 w-9 object-contain" />
      <span className="font-display text-2xl font-bold tracking-tight text-ink">PickleRush</span>
    </Link>
  );
}

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  const showBadge = typeof item.badge === 'number' && item.badge > 0;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        'btn-press group flex items-center rounded-2xl px-4 py-3.5 transition-all',
        active ? 'bg-ink text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-ink',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0 transition-colors', active ? 'text-acid' : 'text-gray-400 group-hover:text-acid')} />
      <span className="ml-3 font-medium">{item.label}</span>
      {item.tag && !showBadge && (
        <span className="ml-auto rounded-full bg-acid/20 px-2 py-0.5 text-[10px] font-bold text-ink-lighter">{item.tag}</span>
      )}
      {showBadge && (
        <span
          className={cn(
            'ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
            active ? 'bg-acid text-ink' : 'bg-acid/90 text-ink',
          )}
          title={item.badgeHint || `${item.badge} pendência(s)`}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  );
}

function NotificationsMenu() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const markAllOn = useFeatureFlag(FEATURE_FLAG.NOTIFICATIONS_MARK_ALL);

  const handleMarkAll = async (event) => {
    // Mantém o dropdown aberto enquanto marca.
    event.preventDefault();
    try {
      await markAllAsRead();
    } catch {
      // Falha silenciosa: as notificações continuam não lidas.
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="btn-press relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:text-ink">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-acid text-[10px] font-bold text-ink">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 p-2">
          <span className="font-bold">Notificações</span>
          {markAllOn && unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-xs font-semibold text-gray-500 transition-colors hover:text-ink"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">Nenhuma notificação.</div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => {
                if (n.link) navigate(n.link);
                if (!n.read) markAsRead(n.id);
              }}
              className={cn('cursor-pointer items-start', !n.read && 'bg-acid/10')}
            >
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{n.title}</p>
                <p className="text-xs text-gray-500">{n.message}</p>
              </div>
              {!n.read && <div className="ml-2 mt-1 h-2 w-2 rounded-full bg-acid" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const BOTTOM_NAV_ITEMS = [
  { to: '/', label: 'Início', icon: LayoutGrid, exact: true },
  { to: '/torneios', label: 'Torneios', icon: Trophy },
  { to: '/atletas', label: 'Atletas', icon: Users },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/perfil', label: 'Perfil', icon: User },
];

function MobileBottomNav({ pathname }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-paper-pure/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
                active ? 'text-ink' : 'text-gray-400',
              )}
            >
              <span className={cn('flex h-8 w-14 items-center justify-center rounded-full transition-colors', active && 'bg-ink')}>
                <Icon className={cn('h-5 w-5', active && 'text-acid')} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function UserMenu({ displayName, displayPhoto, levelLabel, onLogout }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="btn-press hidden items-center justify-center rounded-full transition-opacity hover:opacity-80 sm:flex"
          aria-label="Menu do usuário"
        >
          <V2Avatar name={displayName} photoUrl={displayPhoto} size="md" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-bold text-ink">{displayName}</p>
          {levelLabel && <p className="truncate text-xs text-gray-500">{levelLabel}</p>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/perfil')}>
          <User className="mr-2 h-4 w-4" /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/perfil/editar')}>
          <Pencil className="mr-2 h-4 w-4" /> Editar perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Item de hub na barra lateral (nível 1) — colapsável para só ícone. */
function HubItem({ hub, active, collapsed, onClick }) {
  const Icon = hub.icon;
  const badge = typeof hub.badge === 'number' && hub.badge > 0 ? hub.badge : 0;
  return (
    <Link
      to={hub.to}
      onClick={onClick}
      title={collapsed ? hub.label : hub.badgeHint || undefined}
      aria-label={collapsed ? hub.label : undefined}
      className={cn(
        'btn-press group relative flex items-center rounded-2xl transition-all',
        collapsed ? 'justify-center px-0 py-3' : 'px-3.5 py-3',
        active ? 'bg-ink text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-ink',
      )}
    >
      <span className="relative flex items-center">
        <Icon className={cn('h-5 w-5 shrink-0 transition-colors', active ? 'text-acid' : 'text-gray-400 group-hover:text-acid')} />
        {collapsed && badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-acid px-1 text-[9px] font-bold text-ink">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {!collapsed && <span className="ml-3 truncate font-medium">{hub.label}</span>}
      {!collapsed && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-acid px-1.5 text-[10px] font-bold text-ink">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

/** Barra superior de subpáginas (nível 2) do hub ativo. Quebra em 2 linhas. */
function SubnavBar({ hub, pathname, onNavigate }) {
  return (
    <div className="z-10 flex-shrink-0 border-b border-gray-100 bg-paper-pure/95 px-4 py-2 backdrop-blur sm:px-6 lg:px-10">
      <div className="hide-scrollbar flex flex-wrap items-center gap-1.5">
        {hub.children.map((c) => {
          const Icon = c.icon;
          const active = isActive(pathname, c);
          return (
            <Link
              key={c.to + c.label}
              to={c.to}
              onClick={onNavigate}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                active ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:border-ink/40 hover:text-ink',
              )}
            >
              {Icon && <Icon className={cn('h-3.5 w-3.5', active ? 'text-acid' : 'text-gray-400')} />}
              {c.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function V2Layout({ children }) {
  const { userProfile, signOut, isRealPlatformAdmin, viewAsUser, toggleViewAsUser } = useAuth();
  // Mantém o ranking atualizado automaticamente para o admin da plataforma.
  useAutoRecomputeRatings();
  const location = useLocation();
  const navigate = useNavigate();
  const { sections, hubs } = useV2Nav();
  const mainRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileOnboardingOn = useFeatureFlag(FEATURE_FLAG.PROFILE_ONBOARDING);
  const onboardingWizardOn = useFeatureFlag(FEATURE_FLAG.ONBOARDING_WIZARD);
  const userMenuOn = useFeatureFlag(FEATURE_FLAG.NAV_USER_MENU);
  const bottomNavOn = useFeatureFlag(FEATURE_FLAG.MOBILE_BOTTOM_NAV);
  const navHubsOn = useFeatureFlag(FEATURE_FLAG.NAV_HUBS);
  const legalCenterOn = useFeatureFlag(FEATURE_FLAG.LEGAL_CENTER);
  // Local único de "Termos e Documentos" no rodapé da navegação: central legal
  // completa quando a flag está ligada; página de política como fallback.
  const legalDocsPath = legalCenterOn ? '/legal' : '/politica-uso';

  // Colapso da barra lateral (só ícones), persistido por usuário.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('v2_nav_collapsed') === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem('v2_nav_collapsed', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  const activeHub = useMemo(() => findActiveHub(location.pathname, hubs), [location.pathname, hubs]);
  const subnavHub = navHubsOn && activeHub && activeHub.children.length > 1 ? activeHub : null;
  // Fonte da navegação do drawer mobile: hubs (novo) ou seções (legado).
  const drawerGroups = navHubsOn
    ? hubs.map((h) => ({ title: h.label, items: h.children.length ? h.children : [{ to: h.to, label: h.label, icon: h.icon, exact: h.exact }] }))
    : sections;

  const displayName = userProfile?.platform_name || userProfile?.full_name || 'Atleta';
  const displayPhoto = userProfile?.photo_url || null;
  const levelCode = userProfile?.leveling?.result?.level;
  const levelLabel = levelCode ? getLevelByCode(levelCode)?.name : 'Não nivelado';

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const pageTitlesOn = useFeatureFlag(FEATURE_FLAG.PAGE_TITLES);
  const globalSearchOn = useFeatureFlag(FEATURE_FLAG.GLOBAL_SEARCH);
  useEffect(() => {
    if (!pageTitlesOn) return;
    const title = resolvePageTitle(location.pathname);
    document.title = title ? `${title} · ${BRAND}` : BRAND;
  }, [pageTitlesOn, location.pathname]);

  const closeMobile = () => setMobileOpen(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    const base = globalSearchOn ? '/buscar' : '/atletas';
    navigate(q ? `${base}?q=${encodeURIComponent(q)}` : base);
    closeMobile();
  };

  const handleLogout = async () => {
    closeMobile();
    try { await signOut(); } finally { navigate('/'); }
  };

  return (
    <div className="v2-root flex h-[100dvh] w-full overflow-hidden bg-paper font-inter text-ink">
      {/* Acessibilidade: link "pular para o conteúdo" — primeiro elemento
          focável, visível só ao receber foco pelo teclado. */}
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>
      {/* Instrumentação de funil (flag funnel_analytics; não renderiza nada) */}
      <AuthFunnelTracker />
      {/* Onboarding: o assistente em passos (flag onboarding_wizard) tem
          precedência sobre o modal simples de completude (profile_onboarding);
          ambos podem ser adiados pela sessão. */}
      {onboardingWizardOn
        ? <V2OnboardingWizard />
        : profileOnboardingOn && <ProfileCompletionModal />}
      {/* Portão de consentimento aos documentos essenciais (flag legal_center). */}
      <LegalConsentGate />
      {navHubsOn ? (
        <aside className={cn(
          'z-30 hidden flex-shrink-0 flex-col border-r border-gray-100 bg-paper-pure transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[248px]',
        )}>
          <div className={cn('flex h-20 items-center', collapsed ? 'justify-center px-2' : 'px-6')}>
            {collapsed ? (
              <Link to="/" aria-label="PickleRush"><img src="/logo-claro.png" alt="PickleRush" className="h-9 w-9 object-contain" /></Link>
            ) : <BrandLockup />}
          </div>
          <nav className="hide-scrollbar flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
            {hubs.map((hub) => (
              <HubItem key={hub.id} hub={hub} active={activeHub?.id === hub.id} collapsed={collapsed} />
            ))}
          </nav>
          {/* Termos e Documentos — separada da navegação, no rodapé da barra.
              Reúne todos os termos, contratos, documentos e políticas de uso. */}
          <Link
            to={legalDocsPath}
            title={collapsed ? 'Termos e Documentos' : undefined}
            aria-label={collapsed ? 'Termos e Documentos' : undefined}
            className={cn(
              'btn-press group mx-3 mb-2 flex items-center rounded-2xl py-2.5 text-sm font-medium transition-colors',
              collapsed ? 'justify-center px-0' : 'px-3.5',
              isActive(location.pathname, { to: legalDocsPath }) ? 'bg-ink text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-ink',
            )}
          >
            <FileText className={cn('h-4 w-4 shrink-0', isActive(location.pathname, { to: legalDocsPath }) ? 'text-acid' : 'text-gray-400 group-hover:text-acid')} />
            {!collapsed && <span className="ml-3">Termos e Documentos</span>}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'mx-3 mb-3 flex items-center gap-2 rounded-2xl border border-gray-100 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-ink/30 hover:text-ink',
              collapsed ? 'justify-center px-0' : 'px-3.5',
            )}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Recolher</>}
          </button>
          {!collapsed && (
            <Link
              to="/perfil"
              className="mx-3 mb-4 flex items-center gap-3 rounded-2.5xl border border-gray-100 bg-paper p-3 transition-colors hover:border-gray-200"
            >
              <V2Avatar name={displayName} photoUrl={displayPhoto} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{displayName}</p>
                <p className="truncate text-xs font-medium text-gray-500">{levelLabel}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          )}
        </aside>
      ) : (
        <aside className="z-30 hidden w-[280px] flex-shrink-0 flex-col border-r border-gray-100 bg-paper-pure lg:flex">
          <div className="flex h-24 items-center px-8">
            <BrandLockup />
          </div>
          <nav className="hide-scrollbar flex-1 space-y-1 overflow-y-auto px-4 py-4">
            {sections.map((section) => (
              <div key={section.title} className="mb-6 last:mb-0">
                <p className="mb-3 px-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">{section.title}</p>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <NavItem key={item.to} item={item} active={isActive(location.pathname, item)} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <Link
            to="/perfil"
            className="mx-4 mb-4 flex items-center gap-3 rounded-2.5xl border border-gray-100 bg-paper p-4 transition-colors hover:border-gray-200"
          >
            <div className="relative">
              <V2Avatar name={displayName} photoUrl={displayPhoto} size="md" />
              <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-paper bg-acid" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{displayName}</p>
              <p className="truncate text-xs font-medium text-gray-500">{levelLabel}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
        </aside>
      )}

      <div className="relative flex w-full flex-1 flex-col">
        <header className={cn(
          'glass z-20 flex h-20 w-full items-center justify-between px-4 sm:px-6 lg:px-10',
          navHubsOn ? 'flex-shrink-0 border-b border-gray-100' : 'absolute top-0',
        )}>
          <button
            onClick={() => setMobileOpen(true)}
            className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={handleSearch} className="hidden max-w-md flex-1 md:block">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-full border border-transparent bg-white py-3 pl-11 pr-4 text-sm text-ink shadow-sm transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-100"
                placeholder="Buscar atletas..."
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            {isRealPlatformAdmin && (
              <button
                type="button"
                onClick={toggleViewAsUser}
                title={viewAsUser ? 'Você está vendo como usuário comum. Toque para voltar à visão de admin.' : 'Ver a plataforma como um usuário comum.'}
                aria-pressed={viewAsUser}
                className={cn(
                  'btn-press flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-sm transition-colors',
                  viewAsUser ? 'bg-amber-400 text-ink hover:bg-amber-300' : 'bg-white text-gray-600 hover:text-ink',
                )}
              >
                {viewAsUser ? <Eye className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                <span className="hidden md:inline">{viewAsUser ? 'Vendo como usuário' : 'Visão admin'}</span>
              </button>
            )}
            <NotificationsMenu />
            {userMenuOn && (
              <UserMenu
                displayName={displayName}
                displayPhoto={displayPhoto}
                levelLabel={levelLabel}
                onLogout={handleLogout}
              />
            )}
            <Link
              to="/procura-jogo"
              className="btn-press flex items-center gap-2 rounded-full bg-acid px-5 py-3 text-sm font-bold text-ink shadow-glow transition-all hover:bg-acid-light sm:px-6"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Procuro jogo</span>
            </Link>
          </div>
        </header>

        {subnavHub && <SubnavBar hub={subnavHub} pathname={location.pathname} />}

        <main
          id="conteudo-principal"
          tabIndex={-1}
          ref={mainRef}
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 outline-none sm:px-6 lg:px-10 lg:pb-12',
            navHubsOn ? 'pt-6' : 'pt-28',
          )}
        >
          {children}
        </main>
        {bottomNavOn && <MobileBottomNav pathname={location.pathname} />}
      </div>

      <div
        className={cn(
          'fixed inset-0 z-40 flex-col bg-ink/80 backdrop-blur-md transition-opacity lg:hidden',
          mobileOpen ? 'flex opacity-100' : 'hidden opacity-0',
        )}
      >
        <div className="flex items-center justify-between p-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-escuro.png" alt={BRAND} className="h-8 object-contain" />
            <span className="font-display text-xl font-bold tracking-tight text-white">{BRAND}</span>
          </Link>
          <button
            onClick={closeMobile}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="hide-scrollbar flex-1 overflow-y-auto px-6 pb-10">
          {navHubsOn ? (
            /* Hubs: lista enxuta (nível 1). As subpáginas aparecem na barra
               superior ao entrar no hub — igual ao desktop. */
            <div className="space-y-1">
              {hubs.map((hub) => {
                const Icon = hub.icon;
                const active = activeHub?.id === hub.id;
                const badge = typeof hub.badge === 'number' && hub.badge > 0 ? hub.badge : 0;
                return (
                  <Link
                    key={hub.id}
                    to={hub.to}
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold transition-colors',
                      active ? 'bg-white/10 text-acid' : 'text-white hover:text-acid',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{hub.label}</span>
                    {badge > 0 && (
                      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-acid px-1.5 text-[10px] font-bold text-ink">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            drawerGroups.map((section) => (
              <div key={section.title} className="mb-8">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/40">{section.title}</p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={closeMobile}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold transition-colors',
                          isActive(location.pathname, item) ? 'bg-white/10 text-acid' : 'text-white hover:text-acid',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div className="mt-8 space-y-1 border-t border-white/10 pt-6">
            <Link
              to={legalDocsPath}
              onClick={closeMobile}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold text-white transition-colors hover:text-acid"
            >
              <FileText className="h-5 w-5" /> Termos e Documentos
            </Link>
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold text-red-400 transition-colors hover:bg-white/10">
              <LogOut className="h-5 w-5" /> Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
