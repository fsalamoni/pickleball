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
  BarChart3,
  BookOpen,
  Award,
  HeartHandshake,
  FolderCog,
  Sparkles,
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

const PAGE_META = {
  Dashboard: {
    eyebrow: 'Painel',
    title: 'Sua central de torneios',
    description: 'Acompanhe inscrições, eventos e próximas decisões.',
  },
  Inicio: {
    eyebrow: 'Painel',
    title: 'Sua central de torneios',
    description: 'Acompanhe inscrições, eventos e próximas decisões.',
  },
  Profile: {
    eyebrow: 'Conta',
    title: 'Perfil do atleta',
    description: 'Organize sua identidade na plataforma e melhore a confiança nas inscrições.',
  },
  CreateTournament: {
    eyebrow: 'Organização',
    title: 'Criar novo torneio',
    description: 'Configure identidade, acesso, regras e calendário do evento.',
  },
  JoinTournament: {
    eyebrow: 'Convites',
    title: 'Ingressar com código',
    description: 'Entre rápido em eventos compartilhados sem perder contexto do torneio.',
  },
  PublicTournamentsList: {
    eyebrow: 'Explorar',
    title: 'Torneios públicos',
    description: 'Descubra eventos abertos e acompanhe oportunidades de participação.',
  },
  Tournament: {
    eyebrow: 'Evento',
    title: 'Operação do torneio',
    description: 'Modalidades, inscrições, jogos e ranking do evento.',
  },
  PickleballRules: {
    eyebrow: 'Esporte',
    title: 'Regras do pickleball',
    description: 'Consulte os fundamentos do jogo.',
  },
  Leveling: {
    eyebrow: 'Esporte',
    title: 'Nivelamento',
    description: 'Descubra os níveis de jogo e onde você se encaixa.',
  },
  ConductFairPlay: {
    eyebrow: 'Esporte',
    title: 'Conduta e fair play',
    description: 'Reforce o espírito esportivo do evento.',
  },
  PrivacyPolicy: {
    eyebrow: 'Informações',
    title: 'Política de uso',
    description: 'Termos e condições de uso da plataforma.',
  },
  AdminTournaments: {
    eyebrow: 'Admin geral',
    title: 'Gestão de torneios',
    description: 'Supervisione eventos da plataforma e realize ações administrativas.',
  },
  AdminMetrics: {
    eyebrow: 'Admin geral',
    title: 'Métricas da plataforma',
    description: 'Visualize indicadores de uso e desempenho.',
  },
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signOut, isAuthenticated, isPlatformAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isStandalonePublicPage = STANDALONE_PUBLIC_PAGES.includes(currentPageName);
  const isUtilityPublicPage = UTILITY_PUBLIC_PAGES.includes(currentPageName);
  const currentMeta = pageMeta(currentPageName);

  const { data: tournaments = [] } = useMyTournaments();
  const { notifications, unreadCount, markAsRead } = useNotifications();

  const handleLogout = async () => {
    setSidebarOpen(false);
    await signOut();
    navigate('/');
  };

  if (isStandalonePublicPage) return <>{children}</>;

  if (isUtilityPublicPage && (!isAuthenticated || !user)) {
    return <PublicUtilityLayout currentPageName={currentPageName}>{children}</PublicUtilityLayout>;
  }

  if (!isAuthenticated || !user) {
    return <div className="min-h-screen arena-page">{children}</div>;
  }

  const displayName = userProfile?.platform_name || user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const displayEmail = userProfile?.email || user?.email;
  const displayRole = isPlatformAdmin ? 'Admin geral da plataforma' : 'Atleta e organizador';
  const initial = displayName?.[0]?.toUpperCase() || 'U';
  const activeTournamentId = location.pathname.match(/\/torneios\/([^/]+)/)?.[1];

  return (
    <div className="min-h-screen arena-page">
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm transition-opacity lg:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="fixed inset-x-0 top-0 z-50 flex h-[4.75rem] items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 text-white backdrop-blur-xl lg:hidden">
        <BrandLockup to="/inicio" subtitle="Gestão de torneios" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen((open) => !open)}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(2,18,28,0.98),rgba(8,47,73,0.95))] text-sidebar-foreground shadow-[0_30px_80px_-35px_rgba(2,12,27,0.8)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-6">
            <BrandLockup to="/inicio" subtitle="Gestão de torneios de pickleball" />
            <div className="mt-5 grid gap-2">
              <Button asChild className="w-full justify-between bg-white text-slate-950 hover:bg-emerald-50">
                <Link to="/torneios/criar" onClick={() => setSidebarOpen(false)}>
                  Criar torneio <Plus className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-between border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/torneios/publicos" onClick={() => setSidebarOpen(false)}>
                  Ver públicos <Globe className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <SidebarSection title="Seu espaço" hint="Operação diária">
              <NavItem
                to="/inicio"
                icon={LayoutDashboard}
                label="Início"
                active={currentPageName === 'Dashboard' || currentPageName === 'Inicio'}
                onClick={() => setSidebarOpen(false)}
              />
              <NavItem
                to="/perfil"
                icon={User}
                label="Meu perfil"
                active={currentPageName === 'Profile'}
                onClick={() => setSidebarOpen(false)}
              />
              <NavItem
                to="/torneios/ingressar"
                icon={Hash}
                label="Ingressar com código"
                active={currentPageName === 'JoinTournament'}
                onClick={() => setSidebarOpen(false)}
              />
            </SidebarSection>

            {tournaments.length > 0 && (
              <SidebarSection title="Seus torneios" hint={`${tournaments.length} ativos`}>
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
              </SidebarSection>
            )}

            <SidebarSection title="Explore o jogo" hint="Conteúdo e referências">
              <NavItem
                to="/torneios/publicos"
                icon={Globe}
                label="Torneios públicos"
                active={currentPageName === 'PublicTournamentsList'}
                onClick={() => setSidebarOpen(false)}
              />
              <NavItem
                to="/regras"
                icon={BookOpen}
                label="Regras"
                active={currentPageName === 'PickleballRules'}
                onClick={() => setSidebarOpen(false)}
              />
              <NavItem
                to="/nivelamento"
                icon={Award}
                label="Nivelamento"
                active={currentPageName === 'Leveling'}
                onClick={() => setSidebarOpen(false)}
              />
              <NavItem
                to="/conduta"
                icon={HeartHandshake}
                label="Conduta e fair play"
                active={currentPageName === 'ConductFairPlay'}
                onClick={() => setSidebarOpen(false)}
              />
            </SidebarSection>

            {isPlatformAdmin && (
              <SidebarSection title="Admin geral" hint="Supervisão da plataforma">
                <NavItem
                  to="/admin/torneios"
                  icon={FolderCog}
                  label="Torneios"
                  active={currentPageName === 'AdminTournaments'}
                  onClick={() => setSidebarOpen(false)}
                />
                <NavItem
                  to="/admin/metricas"
                  icon={BarChart3}
                  label="Métricas"
                  active={currentPageName === 'AdminMetrics'}
                  onClick={() => setSidebarOpen(false)}
                />
              </SidebarSection>
            )}

            <SidebarSection title="Informações" hint="Documentos da plataforma">
              <NavItem
                to="/politica-uso"
                icon={FileText}
                label="Política de uso"
                active={currentPageName === 'PrivacyPolicy'}
                onClick={() => setSidebarOpen(false)}
              />
            </SidebarSection>
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#facc15,#34d399)] text-slate-950 shadow-[0_18px_36px_-24px_rgba(250,204,21,0.7)]">
                  <span className="text-sm font-semibold">{initial}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="truncate text-xs text-emerald-50/60" title={displayEmail}>{displayEmail}</p>
                </div>
              </div>
              <div className="mt-4 rounded-[1.15rem] border border-white/10 bg-white/5 px-3 py-2 text-xs text-emerald-50/75">
                {displayRole}
              </div>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="mt-4 w-full justify-between border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                Sair da plataforma <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-screen pt-[4.75rem] lg:ml-72 lg:pt-0">
        <header className="sticky top-[4.75rem] z-30 border-b border-white/70 bg-white/75 backdrop-blur-xl lg:top-0">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700/80">{currentMeta.eyebrow}</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 lg:text-3xl">{currentMeta.title}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{currentMeta.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentPageName !== 'PublicTournamentsList' && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/torneios/publicos">Explorar públicos</Link>
                </Button>
              )}
              {currentPageName !== 'CreateTournament' && (
                <Button asChild size="sm">
                  <Link to="/torneios/criar">Criar torneio</Link>
                </Button>
              )}
              <NotificationsMenu
                notifications={notifications}
                unreadCount={unreadCount}
                markAsRead={markAsRead}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <ProfileCompletionModal />
    </div>
  );
}

function PublicUtilityLayout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentMeta = pageMeta(currentPageName);

  return (
    <div className="min-h-screen arena-page">
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm transition-opacity lg:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="fixed inset-x-0 top-0 z-50 flex h-[4.75rem] items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 text-white backdrop-blur-xl lg:hidden">
        <BrandLockup to="/" subtitle="Guia do esporte" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen((open) => !open)}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(2,18,28,0.98),rgba(8,47,73,0.95))] text-sidebar-foreground shadow-[0_30px_80px_-35px_rgba(2,12,27,0.8)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-6">
            <BrandLockup to="/" subtitle="Regras, nivelamento e cultura do esporte" />
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <SidebarSection title="Sobre o esporte" hint="Leitura pública">
              <NavItem to="/regras" icon={BookOpen} label="Regras" active={currentPageName === 'PickleballRules'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/nivelamento" icon={Award} label="Nivelamento" active={currentPageName === 'Leveling'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/conduta" icon={HeartHandshake} label="Conduta" active={currentPageName === 'ConductFairPlay'} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/politica-uso" icon={FileText} label="Política de uso" active={currentPageName === 'PrivacyPolicy'} onClick={() => setSidebarOpen(false)} />
            </SidebarSection>
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
              <div className="text-sm font-semibold text-white">Quer acessar a plataforma completa?</div>
              <p className="mt-2 text-xs leading-6 text-emerald-50/70">
                Entre para criar torneios, acompanhar inscrições e operar modalidades.
              </p>
              <div className="mt-4 grid gap-2">
                <Button asChild className="w-full bg-white text-slate-950 hover:bg-emerald-50">
                  <Link to="/login" onClick={() => setSidebarOpen(false)}>Entrar</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                >
                  <Link to="/" onClick={() => setSidebarOpen(false)}>Página inicial</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-screen pt-[4.75rem] lg:ml-72 lg:pt-0">
        <header className="sticky top-[4.75rem] z-30 border-b border-white/70 bg-white/75 backdrop-blur-xl lg:top-0">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700/80">{currentMeta.eyebrow}</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 lg:text-3xl">{currentMeta.title}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{currentMeta.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/">Página inicial</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/login">Entrar</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 lg:px-8 lg:pb-12">{children}</main>
      </div>
    </div>
  );
}

function pageMeta(name) {
  return PAGE_META[name] || {
    eyebrow: 'Plataforma',
    title: name || APP_NAME,
    description: '',
  };
}

function BrandLockup({ to, subtitle }) {
  return (
    <Link to={to} className="flex items-center gap-3 text-white">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-emerald-50">
        <Trophy className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold uppercase tracking-[0.24em] text-emerald-50/80">{APP_NAME}</div>
        <div className="truncate text-sm text-emerald-50/60">{subtitle}</div>
      </div>
    </Link>
  );
}

function SidebarSection({ title, hint, children }) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-3 px-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/60">{title}</h3>
          {hint ? <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/40">{hint}</span> : null}
        </div>
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function NotificationsMenu({ notifications, unreadCount, markAsRead }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-11 w-11">
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-0 bg-red-500 px-1 text-[10px] text-white shadow-none">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] rounded-[1.25rem] border-white/80 bg-white/95 p-2 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 py-2">
          <div>
            <div className="text-sm font-semibold text-slate-950">Notificações</div>
            <div className="text-xs text-slate-500">Atualizações recentes da sua operação</div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
        <DropdownMenuSeparator className="bg-slate-200" />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-500">Nenhuma notificação no momento.</div>
        ) : (
          notifications.slice(0, 8).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="mt-1 flex cursor-pointer flex-col items-start rounded-[1rem] px-3 py-3 focus:bg-emerald-50"
              onClick={() => !n.read && markAsRead(n.id)}
            >
              <div className={cn('text-sm font-medium', n.read ? 'text-slate-600' : 'text-slate-950')}>{n.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{n.message}</div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
        'group flex items-center gap-3 rounded-[1.15rem] px-3 py-3 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-white text-slate-950 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.55)]'
          : 'text-emerald-50/75 hover:bg-white/10 hover:text-white',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
          active
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-white/10 bg-white/5 text-emerald-100/80 group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white',
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>

      <span className="min-w-0 flex-1 truncate">{label}</span>

      {dot && <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot.color)} title={dot.title} aria-label={dot.title} />}

      {badge && (
        <Badge variant="success" className="rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em] shadow-none">
          {badge}
        </Badge>
      )}
    </Link>
  );
}
