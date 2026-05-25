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
  Shield,
  ShieldAlert,
  UserCheck,
  FolderCog,
  Sprout,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyPools } from '@/modules/pool/hooks/usePools';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
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

const STANDALONE_PUBLIC_PAGES = ['Landing', 'Login', 'ResponsibleGaming'];
const UTILITY_PUBLIC_PAGES = ['PrivacyPolicy'];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signOut, isAuthenticated, isPlatformAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isStandalonePublicPage = STANDALONE_PUBLIC_PAGES.includes(currentPageName);
  const isUtilityPublicPage = UTILITY_PUBLIC_PAGES.includes(currentPageName);

  const { pools } = useMyPools();
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
  const activePoolId = location.pathname.match(/\/boloes\/([^/]+)/)?.[1];

  return (
    <div className="min-h-screen arena-page">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950 text-white border-b border-emerald-800/40 flex items-center justify-between px-4 z-50 shadow-lg shadow-slate-950/15">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-300" /> Bolão Copa 2026
        </h1>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white hover:bg-white/10 hover:text-white">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out z-40 lg:translate-x-0',
          'bg-slate-950 text-emerald-50 border-r border-emerald-800/30 shadow-2xl shadow-slate-950/20',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-emerald-800/30 gap-2">
            <Trophy className="w-6 h-6 text-amber-300" />
            <h1 className="text-lg font-bold text-white">
              Bolão Copa 2026
            </h1>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              <NavItem to="/inicio" icon={LayoutDashboard} label="Início" active={currentPageName === 'Dashboard' || currentPageName === 'Inicio'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/perfil" icon={User} label="Meu Perfil" active={currentPageName === 'Profile'} onClick={() => setSidebarOpen(false)} />
            </div>

            {pools.length > 0 && (
              <>
                <div className="mt-6 mb-2 px-3">
                  <h3 className="text-xs font-semibold text-emerald-200/70 uppercase tracking-wider">Bolões</h3>
                </div>
                <div className="space-y-1">
                  {pools.map((p) => (
                    <NavItem
                      key={p.id}
                      to={`/boloes/${p.id}`}
                      icon={Trophy}
                      label={p.name}
                      active={activePoolId === p.id}
                      onClick={() => setSidebarOpen(false)}
                      badge={p.userRole === 'owner' ? 'Admin' : p.userRole === 'admin' ? 'Admin' : null}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 space-y-1">
              <NavItem to="/boloes/criar" icon={Plus} label="Criar Bolão" active={currentPageName === 'CreatePool'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/boloes/ingressar" icon={Hash} label="Ingressar com Código" active={currentPageName === 'JoinPool'} onClick={() => setSidebarOpen(false)} />
            </div>

            {isPlatformAdmin && (
              <>
                <div className="mt-6 mb-2 px-3">
                  <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Admin Geral
                  </h3>
                </div>
                <div className="space-y-1">
                  <NavItem to="/admin/solicitacoes" icon={UserCheck} label="Solicitações" active={currentPageName === 'AdminCreatorRequests'} />
                  <NavItem to="/admin/jogos" icon={Trophy} label="Jogos & Resultados" active={currentPageName === 'AdminMatches'} />
                  <NavItem to="/admin/boloes" icon={FolderCog} label="Bolões" active={currentPageName === 'AdminPools'} />
                  <NavItem to="/admin/seed" icon={Sprout} label="Seed inicial" active={currentPageName === 'AdminSeed'} />
                  <NavItem to="/admin/metricas" icon={Shield} label="Métricas" active={currentPageName === 'AdminMetrics'} />
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
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-amber-300 flex items-center justify-center text-slate-950 font-semibold shadow-sm">
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
          <Trophy className="w-5 h-5 text-amber-300" /> Bolão Copa 2026
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
            <Trophy className="w-6 h-6 text-amber-300" />
            <h1 className="text-lg font-bold text-white">Bolão Copa 2026</h1>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="mb-4 rounded-md border border-emerald-700/25 bg-white/5 p-3 text-xs leading-5 text-emerald-50/75">
              Consulte responsabilidades e privacidade da plataforma.
            </div>
            <div className="space-y-1">
              <NavItem to="/politica-uso" icon={FileText} label="Política de Uso" active={currentPageName === 'PrivacyPolicy'} onClick={() => setSidebarOpen(false)} />
            </div>
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
    CreatePool: 'Criar Bolão',
    JoinPool: 'Ingressar em um Bolão',
    Pool: 'Bolão',
    AdminCreatorRequests: 'Painel Administrativo',
    AdminMatches: 'Jogos & Resultados (Admin)',
    AdminPools: 'Gerenciamento de Bolões',
    AdminMetrics: 'Métricas da Plataforma',
    PrivacyPolicy: 'Política de Uso',
  };
  return map[name] || name || 'Bolão Copa 2026';
}

function NavItem({ to, icon: Icon, label, active, onClick, badge }) {
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
      {badge && (
        <Badge variant="success" className="text-[10px]">
          {badge}
        </Badge>
      )}
    </Link>
  );
}
