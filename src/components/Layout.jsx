import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Trophy,
  FileText,
  LogOut,
  Bell,
  Menu,
  X,
  Plus,
  Hash,
  Globe,
  ShieldAlert,
  BarChart3,
  BookOpen,
  Award,
  HeartHandshake,
  FolderCog,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProfileCompletionModal from '@/components/ProfileCompletionModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/core/lib/utils';

const STANDALONE_PUBLIC_PAGES = ['Landing', 'Login'];
const UTILITY_PUBLIC_PAGES = ['PrivacyPolicy', 'ConductFairPlay', 'PickleballRules', 'Leveling'];
const APP_NAME = 'Pickleball';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signOut, isAuthenticated, isPlatformAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isStandalonePublicPage = STANDALONE_PUBLIC_PAGES.includes(currentPageName);
  const isUtilityPublicPage = UTILITY_PUBLIC_PAGES.includes(currentPageName);

  const { data: tournaments = [] } = useMyTournaments();
  const { notifications, unreadCount, markAsRead } = useNotifications();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (isStandalonePublicPage) {
    return <>{children}</>;
  }

  if (isUtilityPublicPage && (!isAuthenticated || !user)) {
    return <PublicUtilityLayout currentPageName={currentPageName}>{children}</PublicUtilityLayout>;
  }

  if (!isAuthenticated || !user) {
    return <div className="min-h-screen arena-page">{children}</div>;
  }

  const displayName = userProfile?.platform_name || user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const displayEmail = userProfile?.email || user?.email;
  const initial = displayName?.[0]?.toUpperCase() || 'U';
  const activeTournamentId = location.pathname.match(/\/torneios\/([^/]+)/)?.[1];

  return (
    <div className="min-h-screen arena-page">
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950 text-white border-b border-emerald-800/40 flex items-center justify-between px-4 z-50 shadow-lg shadow-slate-950/15">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-lime-300" /> {APP_NAME}
        </h1>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white hover:bg-white/10 hover:text-white">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 transform transition-transform duration-200 ease-in-out z-40 lg:translate-x-0',
          'bg-slate-950 text-emerald-50 border-r border-emerald-800/30 shadow-2xl shadow-slate-950/20',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-emerald-800/30 gap-2">
            <Trophy className="w-6 h-6 text-lime-300" />
            <h1 className="text-lg font-bold text-white">{APP_NAME}</h1>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              <NavItem to="/inicio" icon={LayoutDashboard} label="Início" active={currentPageName === 'Dashboard' || currentPageName === 'Inicio'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/perfil" icon={User} label="Meu Perfil" active={currentPageName === 'Profile'} onClick={() => setSidebarOpen(false)} />
            </div>

            {tournaments.length > 0 && (
              <>
                <div className="mt-6 mb-2 px-3">
                  <h3 className="text-xs font-semibold text-emerald-200/70 uppercase tracking-wider">Torneios</h3>
                </div>
                <div className="space-y-1">
                  {tournaments.map((t) => (
                    <NavItem
                      key={t.id}
                      to={`/torneios/${t.id}`}
                      icon={Trophy}
                      label={t.name}
                      active={activeTournamentId === t.id}
                      onClick={() => setSidebarOpen(false)}
                      badge={t.my_role === 'owner' ? 'Owner' : t.my_role === 'admin' ? 'Admin' : null}
                      dot={statusDot(t.status)}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 space-y-1">
              <NavItem to="/torneios/criar" icon={Plus} label="Criar torneio" active={currentPageName === 'CreateTournament'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/torneios/ingressar" icon={Hash} label="Ingressar com código" active={currentPageName === 'JoinTournament'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/torneios/publicos" icon={Globe} label="Torneios públicos" active={currentPageName === 'PublicTournamentsList'} onClick={() => setSidebarOpen(false)} />
            </div>

            <div className="mt-6 mb-2 px-3">
              <h3 className="text-xs font-semibold text-emerald-200/70 uppercase tracking-wider">Sobre o esporte</h3>
            </div>
            <div className="space-y-1">
              <NavItem to="/regras" icon={BookOpen} label="Regras" active={currentPageName === 'PickleballRules'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/nivelamento" icon={Award} label="Nivelamento" active={currentPageName === 'Leveling'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/conduta" icon={HeartHandshake} label="Conduta &amp; Fair Play" active={currentPageName === 'ConductFairPlay'} onClick={() => setSidebarOpen(false)} />
            </div>

            {isPlatformAdmin && (
              <>
                <div className="mt-6 mb-2 px-3">
                  <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Admin Geral
                  </h3>
                </div>
                <div className="space-y-1">
                  <NavItem to="/admin/torneios" icon={FolderCog} label="Torneios" active={currentPageName === 'AdminTournaments'} />
                  <NavItem to="/admin/metricas" icon={BarChart3} label="Métricas" active={currentPageName === 'AdminMetrics'} />
                </div>
              </>
            )}

            <div className="mt-6 space-y-1">
              <NavItem to="/politica-uso" icon={FileText} label="Política de Uso" active={currentPageName === 'PrivacyPolicy'} />
            </div>
          </nav>

          <div className="p-4 border-t border-emerald-800/30 bg-slate-900/70">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-lime-300 flex items-center justify-center text-slate-950 font-semibold shadow-sm">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-emerald-100/65 truncate" title={displayEmail}>{displayEmail}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0 text-emerald-100/70 hover:text-white hover:bg-red-500/20">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="hidden lg:flex h-16 bg-white/70 backdrop-blur-md border-b border-emerald-950/10 items-center justify-between px-6 sticky top-0 z-30 shadow-sm shadow-emerald-950/5">
          <h2 className="text-lg font-semibold arena-heading">{pageTitle(currentPageName)}</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-2 font-semibold">Notificações</div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">Nenhuma notificação</div>
              ) : (
                notifications.slice(0, 8).map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex-col items-start p-3 cursor-pointer"
                    onClick={() => !n.read && markAsRead(n.id)}
                  >
                    <div className={cn('font-medium text-sm', n.read ? 'text-slate-600' : 'text-slate-900')}>{n.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{n.message}</div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
      <ProfileCompletionModal />
    </div>
  );
}

function PublicUtilityLayout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen arena-page">
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950 text-white border-b border-emerald-800/40 flex items-center justify-between px-4 z-50 shadow-lg shadow-slate-950/15">
        <Link to="/" className="text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-lime-300" /> {APP_NAME}
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white hover:bg-white/10 hover:text-white">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 transform transition-transform duration-200 ease-in-out z-40 lg:translate-x-0',
          'bg-slate-950 text-emerald-50 border-r border-emerald-800/30 shadow-2xl shadow-slate-950/20',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="h-16 flex items-center px-6 border-b border-emerald-800/30 gap-2">
            <Trophy className="w-6 h-6 text-lime-300" />
            <h1 className="text-lg font-bold text-white">{APP_NAME}</h1>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            <NavItem to="/regras" icon={BookOpen} label="Regras" active={currentPageName === 'PickleballRules'} onClick={() => setSidebarOpen(false)} />
            <NavItem to="/nivelamento" icon={Award} label="Nivelamento" active={currentPageName === 'Leveling'} onClick={() => setSidebarOpen(false)} />
            <NavItem to="/conduta" icon={HeartHandshake} label="Conduta" active={currentPageName === 'ConductFairPlay'} onClick={() => setSidebarOpen(false)} />
            <NavItem to="/politica-uso" icon={FileText} label="Política" active={currentPageName === 'PrivacyPolicy'} onClick={() => setSidebarOpen(false)} />
          </nav>
          <div className="space-y-2 border-t border-emerald-800/30 bg-slate-900/70 p-4">
            <Button asChild className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild variant="outline" className="w-full border-emerald-700/40 bg-white/5 text-emerald-50 hover:bg-white/10 hover:text-white">
              <Link to="/">Página inicial</Link>
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="hidden lg:flex h-16 bg-white/70 backdrop-blur-md border-b border-emerald-950/10 items-center justify-between px-6 sticky top-0 z-30 shadow-sm shadow-emerald-950/5">
          <h2 className="text-lg font-semibold arena-heading">{pageTitle(currentPageName)}</h2>
          <Button asChild size="sm">
            <Link to="/login">Entrar</Link>
          </Button>
        </div>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

function pageTitle(name) {
  const map = {
    Dashboard: 'Início',
    Inicio: 'Início',
    Profile: 'Meu Perfil',
    CreateTournament: 'Criar torneio',
    JoinTournament: 'Ingressar com código',
    PublicTournamentsList: 'Torneios públicos',
    Tournament: 'Torneio',
    PickleballRules: 'Regras do Pickleball',
    Leveling: 'Nivelamento',
    ConductFairPlay: 'Conduta e Fair Play',
    PrivacyPolicy: 'Política de Uso',
    AdminTournaments: 'Torneios (Admin)',
    AdminMetrics: 'Métricas da Plataforma',
  };
  return map[name] || name || APP_NAME;
}

function statusDot(status) {
  switch (status) {
    case TOURNAMENT_STATUS.IN_PROGRESS:
      return { color: 'bg-blue-400', title: 'Em andamento' };
    case TOURNAMENT_STATUS.REGISTRATIONS_OPEN:
      return { color: 'bg-emerald-400', title: 'Inscrições abertas' };
    case TOURNAMENT_STATUS.REGISTRATIONS_CLOSED:
      return { color: 'bg-amber-400', title: 'Inscrições encerradas' };
    case TOURNAMENT_STATUS.FINISHED:
      return { color: 'bg-slate-400', title: 'Encerrado' };
    case TOURNAMENT_STATUS.CANCELLED:
      return { color: 'bg-red-400', title: 'Cancelado' };
    case TOURNAMENT_STATUS.DRAFT:
    default:
      return null;
  }
}

function NavItem({ to, icon: Icon, label, active, onClick, badge, dot }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-emerald-400/15 text-white ring-1 ring-emerald-300/25'
          : 'text-emerald-50/75 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {dot && (
        <span
          className={cn('w-2 h-2 rounded-full shrink-0', dot.color)}
          title={dot.title}
          aria-label={dot.title}
        />
      )}
      {badge && (
        <Badge variant="success" className="text-[10px]">
          {badge}
        </Badge>
      )}
    </Link>
  );
}
