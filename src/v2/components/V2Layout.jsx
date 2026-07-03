import React, { Suspense, lazy, useState, useMemo, useRef, useEffect } from 'react';
import { Link, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
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
  Search as SearchIcon,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
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

const BRAND = 'PickleRush';

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
        { to: '/', label: 'Visão Geral', icon: LayoutGrid, exact: true },
        arenasOn && { to: '/arenas', label: 'Explorar Quadras', icon: MapPin },
        { to: '/torneios', label: 'Torneios', icon: Trophy, tag: 'Novo' },
        communityFeedOn && { to: '/novidades', label: 'Comunidade', icon: Zap },
      ].filter(Boolean),
    },
    {
      title: 'Descobrir',
      items: [
        { to: '/atletas', label: 'Atletas', icon: Users },
        ratingOn && { to: '/ranking', label: 'Ranking', icon: Medal },
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
        performanceOn && { to: '/meu-desempenho', label: 'Meu desempenho', icon: BarChart3 },
        { to: '/minhas-reservas', label: 'Minhas reservas', icon: Building2 },
        { to: '/perfil', label: 'Meu Perfil', icon: User },
      ].filter(Boolean),
    },
    isPlatformAdmin && {
      title: 'Admin geral',
      items: [
        { to: '/admin/metricas', label: 'Métricas', icon: Settings },
        { to: '/admin/torneios', label: 'Torneios', icon: Settings },
        { to: '/admin/parceiros', label: 'Parceiros', icon: Settings },
      ],
    },
    {
      title: 'Aprender',
      items: [
        { to: '/regras', label: 'Regras', icon: BookOpen },
        { to: '/nivelamento', label: 'Nivelamento', icon: Award },
        sportHistoryOn && { to: '/historia', label: 'História do esporte', icon: History },
        { to: '/conduta', label: 'Conduta e fair play', icon: HeartHandshake },
        { to: '/politica-uso', label: 'Política de uso', icon: FileText },
      ].filter(Boolean),
    },
  ].filter(Boolean), [performanceOn, ratingOn, matchmakingOn, openGamesOn, affiliatesOn, communityFeedOn, arenasOn, sportHistoryOn, isPlatformAdmin]);
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
  const { notifications, unreadCount, markAsRead } = useNotifications();

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
        <div className="p-2 font-bold">Notificações</div>
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

export default function V2Layout({ children }) {
  const { userProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = useV2Nav();
  const mainRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const displayName = userProfile?.platform_name || userProfile?.full_name || 'Atleta';
  const displayPhoto = userProfile?.photo_url || null;
  const levelCode = userProfile?.leveling?.result?.level;
  const levelLabel = levelCode ? getLevelByCode(levelCode)?.name : 'Não nivelado';

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const closeMobile = () => setMobileOpen(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/atletas?q=${encodeURIComponent(q)}` : '/atletas');
    closeMobile();
  };

  const handleLogout = async () => {
    closeMobile();
    try { await signOut(); } finally { navigate('/'); }
  };

  return (
    <div className="v2-root flex h-[100dvh] w-full overflow-hidden bg-paper font-inter text-ink">
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

      <div className="relative flex w-full flex-1 flex-col">
        <header className="glass absolute top-0 z-20 flex h-20 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
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
                placeholder="Buscar atletas, cidades, clubes..."
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <Link
              to="/v1/inicio"
              className="hidden rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-ink hover:text-ink sm:inline-flex"
              title="Voltar para a versão anterior da plataforma"
            >
              App anterior
            </Link>
            <NotificationsMenu />
            <Link
              to="/procura-jogo"
              className="btn-press flex items-center gap-2 rounded-full bg-acid px-5 py-3 text-sm font-bold text-ink shadow-glow transition-all hover:bg-acid-light sm:px-6"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Procuro jogo</span>
            </Link>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-28 sm:px-6 lg:px-10 lg:pb-12">
          {children}
        </main>
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
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-8 border-t border-white/10 pt-6">
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold text-red-400 transition-colors hover:bg-white/10">
              <Settings className="h-5 w-5" /> Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
