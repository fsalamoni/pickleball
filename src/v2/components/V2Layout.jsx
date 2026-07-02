import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronRight,
  FileText,
  FolderCog,
  HeartHandshake,
  History,
  LayoutGrid,
  LogOut,
  MapPin,
  Medal,
  Megaphone,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Swords,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { cn } from '@/core/lib/utils';
import { V2Avatar } from '@/v2/ui/primitives';

const BRAND = 'PickleRush';

/** Constrói a árvore de navegação da v2 respeitando as feature flags ativas. */
function useV2Nav() {
  const { isPlatformAdmin } = useAuth();
  const performanceOn = useFeatureFlag(FEATURE_FLAG.PLAYER_PERFORMANCE);
  const ratingOn = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const matchmakingOn = useFeatureFlag(FEATURE_FLAG.MATCHMAKING);
  const openGamesOn = useFeatureFlag(FEATURE_FLAG.OPEN_GAMES);
  const affiliatesOn = useFeatureFlag(FEATURE_FLAG.AFFILIATE_LINKS);
  const communityFeedOn = useFeatureFlag(FEATURE_FLAG.COMMUNITY_FEED);
  const arenasOn = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const sportHistoryOn = useFeatureFlag(FEATURE_FLAG.SPORT_HISTORY);

  return useMemo(() => [
    {
      title: 'Plataforma',
      items: [
        { to: '/v2', label: 'Visão Geral', icon: LayoutGrid, exact: true },
        arenasOn && { to: '/v2/arenas', label: 'Explorar Quadras', icon: MapPin },
        { to: '/v2/torneios', label: 'Torneios', icon: Trophy, tag: 'Novo' },
        communityFeedOn && { to: '/v2/novidades', label: 'Comunidade', icon: Zap },
      ].filter(Boolean),
    },
    {
      title: 'Descobrir',
      items: [
        { to: '/v2/atletas', label: 'Atletas', icon: Users },
        ratingOn && { to: '/v2/ranking', label: 'Ranking', icon: Medal },
        ratingOn && matchmakingOn && { to: '/v2/encontrar-jogadores', label: 'Encontrar jogadores', icon: Swords },
        openGamesOn && { to: '/v2/procura-jogo', label: 'Procura-se jogo', icon: Megaphone },
        { to: '/v2/clubes', label: 'Clubes', icon: Building2 },
        affiliatesOn && { to: '/v2/parceiros', label: 'Parceiros', icon: HeartHandshake },
      ].filter(Boolean),
    },
    {
      title: 'Você',
      items: [
        { to: '/v2/chat', label: 'Mensagens', icon: MessageCircle },
        performanceOn && { to: '/v2/meu-desempenho', label: 'Meu desempenho', icon: Activity },
        arenasOn && { to: '/v2/minhas-reservas', label: 'Minhas reservas', icon: CalendarClock },
        { to: '/v2/perfil', label: 'Seu Perfil', icon: User },
      ].filter(Boolean),
    },
    isPlatformAdmin && {
      title: 'Admin geral',
      items: [
        { to: '/v2/admin/torneios', label: 'Torneios', icon: FolderCog },
        { to: '/v2/admin/metricas', label: 'Métricas', icon: BarChart3 },
        affiliatesOn && { to: '/v2/admin/parceiros', label: 'Parceiros', icon: HeartHandshake },
      ].filter(Boolean),
    },
    {
      title: 'Aprender',
      items: [
        { to: '/v2/regras', label: 'Regras', icon: BookOpen },
        { to: '/v2/nivelamento', label: 'Nivelamento', icon: Award },
        sportHistoryOn && { to: '/v2/historia', label: 'História do esporte', icon: History },
        { to: '/v2/conduta', label: 'Conduta e fair play', icon: HeartHandshake },
        { to: '/v2/politica-uso', label: 'Política de uso', icon: FileText },
      ].filter(Boolean),
    },
  ].filter(Boolean), [performanceOn, ratingOn, matchmakingOn, openGamesOn, affiliatesOn, communityFeedOn, arenasOn, sportHistoryOn, isPlatformAdmin]);
}

function isActive(pathname, item) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function BrandLockup() {
  return (
    <Link to="/v2" className="flex items-center gap-3">
      <img src="/logo-claro.png" alt="PickleRush" className="h-10 object-contain" />
    </Link>
  );
}

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
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
      {item.tag && (
        <span className="ml-auto rounded-full bg-acid/20 px-2 py-0.5 text-[10px] font-bold text-ink-lighter">{item.tag}</span>
      )}
    </Link>
  );
}

function NotificationsMenu() {
  const navigate = useNavigate();
  const { notifications = [], unreadCount = 0, markAsRead } = useNotifications();

  const handleSelect = (n) => {
    if (!n.read && markAsRead) markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="btn-press relative flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-ink"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[70vh] w-[20rem] overflow-y-auto rounded-3xl border-gray-100 bg-white/95 p-2 shadow-organic backdrop-blur-xl sm:w-[22rem]"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div>
            <div className="font-display text-sm font-bold text-ink">Notificações</div>
            <div className="text-xs text-gray-500">Atualizações recentes da sua operação</div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acid/20 text-ink">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
        <DropdownMenuSeparator className="bg-gray-100" />
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-500">Nenhuma notificação no momento.</div>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="mt-1 flex cursor-pointer flex-col items-start rounded-2xl px-3 py-3 focus:bg-paper"
              onClick={() => handleSelect(n)}
            >
              <div className={cn('text-sm font-semibold', n.read ? 'text-gray-500' : 'text-ink')}>{n.title}</div>
              <div className="mt-1 text-xs leading-5 text-gray-500">{n.message}</div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function V2Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signOut } = useAuth();
  const nav = useV2Nav();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const mainRef = useRef(null);

  // Rola o conteúdo ao topo a cada navegação (o container de rolagem é o <main>,
  // não a janela) — replica o comportamento do protótipo do design.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const displayName = userProfile?.platform_name || user?.displayName || user?.email?.split('@')[0] || 'Atleta';
  const displayPhoto = userProfile?.photo_url || user?.photoURL || '';
  const levelLabel = userProfile?.level || userProfile?.leveling_level || 'Nível a definir';

  const closeMobile = () => setMobileOpen(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/v2/atletas?q=${encodeURIComponent(q)}` : '/v2/atletas');
    closeMobile();
  };

  const handleLogout = async () => {
    closeMobile();
    try {
      await signOut();
    } finally {
      navigate('/');
    }
  };

  return (
    <div className="v2-root flex h-[100dvh] w-full overflow-hidden bg-paper font-inter text-ink">
      {/* Sidebar (desktop) */}
      <aside className="z-30 hidden w-[280px] flex-shrink-0 flex-col border-r border-gray-100 bg-paper-pure lg:flex">
        <div className="flex h-24 items-center px-8">
          <BrandLockup />
        </div>
        <nav className="hide-scrollbar flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {nav.map((section) => (
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
          to="/v2/perfil"
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

      {/* Main area */}
      <div className="relative flex w-full flex-1 flex-col">
        {/* Topbar (glass) */}
        <header className="glass absolute top-0 z-20 flex h-20 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={handleSearch} className="hidden max-w-md flex-1 md:block">
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 transition-colors group-focus-within:text-ink">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full rounded-full border border-gray-200 bg-white/80 p-3 pl-11 text-sm text-ink transition-all placeholder-gray-400 focus:border-gray-300 focus:bg-white focus:ring-4 focus:ring-gray-100"
                placeholder="Buscar atletas, cidades, clubes..."
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <Link
              to="/inicio"
              className="hidden rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-ink hover:text-ink sm:inline-flex"
              title="Voltar para a versão atual da plataforma"
            >
              App atual
            </Link>
            <NotificationsMenu />
            <Link
              to="/v2/procura-jogo"
              className="btn-press flex items-center gap-2 rounded-full bg-acid px-5 py-3 text-sm font-bold text-ink shadow-glow transition-all hover:bg-acid-light sm:px-6"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Procuro jogo</span>
            </Link>
          </div>
        </header>

        {/* Scroll area */}
        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-28 sm:px-6 lg:px-10 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile menu overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 flex-col bg-ink/80 backdrop-blur-md transition-opacity lg:hidden',
          mobileOpen ? 'flex opacity-100' : 'hidden opacity-0',
        )}
      >
        <div className="flex items-center justify-between p-6">
          <img src="/logo-escuro.png" alt={BRAND} className="h-8 object-contain" />
          <button
            onClick={closeMobile}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="hide-scrollbar flex-1 overflow-y-auto px-6 pb-10">
          {nav.map((section) => (
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
                      <Icon className="h-5 w-5" /> {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-4 flex flex-col gap-3">
            <Link to="/inicio" onClick={closeMobile} className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-center font-bold text-white">
              Voltar ao app atual
            </Link>
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-bold text-white/80">
              Sair <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
