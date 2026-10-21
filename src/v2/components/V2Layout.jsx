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
  Sparkles,
  Crown,
  Landmark,
  History,
  FileText,
  Menu,
  X,
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
  LifeBuoy,
  Dumbbell,
  SlidersHorizontal,
  Store,
  ShoppingBag,
  Heart,
  Tag,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { bottomNavItems } from '@/core/domain/bottomNav';
import { navRotulos } from '@/core/domain/navRotulos';
import { useSidebarNav } from '@/core/lib/useSidebarNav';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { recordEvent } from '@/core/services/observabilityService';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { myCurrentTournaments } from '@/modules/home/domain/homeTournaments';
import { hojeLocal } from '@/modules/home/domain/freshness';
import AuthFunnelTracker from '@/modules/analytics/components/AuthFunnelTracker';
import NotificationsBell, { NOTIFICATIONS_PATH } from '@/v2/components/notifications/NotificationsBell';
import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { formatUnreadBadge } from '@/modules/notifications/domain/noticeFeed';
import { getLevelByCode } from '@/modules/leveling/data/levels';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/core/lib/utils';
import { PAGE_FRAME, V2Avatar } from '@/v2/ui/primitives';
import BrandMark, { LogoImg } from '@/v2/ui/BrandMark';
import { ThemeDrawerSwitcher, ThemeMenuSection } from '@/v2/components/theme/ThemeSwitcher';
import V2OnboardingWizard from '@/v2/components/onboarding/V2OnboardingWizard';
import V2OfflineBanner from '@/v2/components/V2OfflineBanner';
import InstallInviteBar from '@/v2/components/InstallInviteBar';
// De `helpLink` e não de `helpCenter`: o layout está em toda tela, e importar
// do arquivo do conteúdo traria os 33 artigos da ajuda no chunk de todo mundo.
import { helpLinkFor } from '@/modules/help/domain/helpLink';
import DicasProvider from '@/v2/components/dicas/DicasProvider';
import BotaoDicas from '@/v2/components/dicas/BotaoDicas';
import { LanguageMenu } from '@/v2/components/idioma/LanguageSwitcher';
import { useAncoraDoAviso } from '@/v2/ui/useAncoraDoAviso';
import { usePushNoAparelho } from '@/core/lib/usePushNoAparelho';
// Gamificação V2 em segundo plano: só baixa o código com a flag ligada e uma conta logada.
const GamificationBackground = lazy(() => import('@/v2/components/gamification/GamificationBackground'));
// Paleta de comandos: só baixa quando a pessoa abre.
const V2CommandPalette = lazy(() => import('@/v2/components/search/V2CommandPalette'));
import LegalConsentGate from '@/v2/components/legal/LegalConsentGate';
import MarketTermsGate from '@/v2/components/legal/MarketTermsGate';
import { useMyConsents } from '@/modules/legal/hooks/useConsents';
import { pendingGateConsents, pendingMarketConsents } from '@/modules/legal/domain/consent';
import { t, tk, tn } from '@/core/i18n';

const BRAND = 'PickleRush';

/**
 * Títulos por rota (flag page_titles). Prefixos ordenados do mais específico
 * para o mais genérico; '/' é o fallback exato.
 */
const PAGE_TITLES = [
  ['/torneios', tk('Torneios')],
  ['/arenas', tk('Arenas')],
  ['/minhas-reservas', tk('Minhas reservas')],
  ['/atletas', tk('Atletas')],
  ['/atleta/', tk('Atleta')],
  ['/ranking', tk('Ranking')],
  ['/encontrar-jogadores', (r) => r.pessoas],
  ['/procura-jogo', (r) => r.vagas],
  ['/dia-de-jogo', tk('Dia de jogo')],
  ['/clubes', tk('Clubes')],
  ['/novidades', tk('Comunidade')],
  ['/parceiros', tk('Parceiros')],
  ['/chat', tk('Mensagens')],
  ['/meu-desempenho', tk('Meu desempenho')],
  ['/treino', tk('Treino')],
  ['/perfil', tk('Meu perfil')],
  ['/regras', tk('Regras')],
  ['/nivelamento', tk('Nivelamento')],
  ['/historia', tk('História do esporte')],
  ['/conduta', tk('Conduta e fair play')],
  ['/legal', tk('Termos e Documentos')],
  ['/politica-uso', tk('Política de Uso')],
  ['/gamification/como-funciona', tk('Como funciona a gamificação')],
  ['/gamification/revisao', tk('Revisão da gamificação')],
  ['/gamification/configuracoes', tk('Preferências da gamificação')],
  ['/gamification', (r) => r.gamificacao],
  ['/hall-da-fama', tk('Hall da Fama')],
  ['/conquistas', tk('Conquistas')],
  ['/vinculos', tk('Vínculos')],
  ['/notificacoes', tk('Notificações')],
  ['/mercado', tk('Mercado')],
  ['/admin', tk('Admin')],
];

/**
 * Para onde vai quem toca em "Jogar": o Dia de jogo (os seus dias e os com vaga
 * para você). Sem ele, Procura-se jogo; sem os dois, Encontrar jogadores.
 */
function jogarHubTo({ gameDayOn, openGamesOn }) {
  if (gameDayOn) return '/dia-de-jogo';
  return openGamesOn ? '/procura-jogo' : '/encontrar-jogadores';
}

function resolvePageTitle(pathname, { userHubOn = false } = {}) {
  if (pathname === '/') return t('Visão Geral');
  const match = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix));
  // Minha área (flag `user_hub`): o `/perfil` é a central da pessoa.
  if (match && userHubOn && match[0] === '/perfil') return t('Minha área');
  if (!match) return null;
  // Rótulo que vem do vocabulário da navegação é função.
  return typeof match[1] === 'function' ? match[1](navRotulos()) : t(match[1]);
}

function useV2Nav() {
  const { isPlatformAdmin, user } = useAuth();
  const marketplaceOn = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  const federationsOn = useFeatureFlag(FEATURE_FLAG.FEDERATIONS);
  const performanceOn = true;
  const ratingOn = true;
  const matchmakingOn = true;
  const openGamesOn = true;
  const adminConsoleOn = true;
  const affiliatesOn = true;
  const communityFeedOn = true;
  const arenasOn = true;
  const circuitsOn = true;
  const coachesOn = true;
  const coachLessonsOn = true;
  const doublesRankingOn = true;
  const athleteAgendaOn = true;
  const gameDayOn = true;
  const legalCenterOn = true;
  const settingsPageOn = true;
  const tournamentAdminConsoleOn = true;
  const { arenas: myArenas, pendingByArena, totalArenas: myArenasCount, totalPendingBookings: myPendingBookings } = useMyArenaSummary();
  const rotulos = navRotulos();
  const showMyArenas = arenasOn && myArenasCount > 0;
  // Só busca o perfil de professor quando a área de aulas está ligada.
  const { data: myCoachProfile } = useCoach(coachLessonsOn ? user?.uid : null);
  const isCoach = coachLessonsOn && !!myCoachProfile;
  const sportHistoryOn = true;
  // Gamificação V2 (flag `gamification_v2`): a jornada, o Hall e as conquistas entram no menu.
  const gamificationOn = true;
  // Centro de Treino (flag `training_center`): entra no hub do perfil.
  const trainingOn = true;
  // Minha área (flag `user_hub`): o perfil vira a central da pessoa — só o nome muda aqui.
  const userHubOn = true;

  const sections = useMemo(() => [
    {
      title: t('Plataforma'),
      items: [
        { to: '/', label: t('Visão Geral'), icon: LayoutGrid, exact: true },
        (arenasOn || isPlatformAdmin) && { to: '/arenas', label: t('Explorar Quadras'), icon: MapPin, tag: !arenasOn && isPlatformAdmin ? 'Off' : undefined },
        { to: '/torneios', label: t('Torneios'), icon: Trophy, tag: t('Novo') },
        circuitsOn && { to: '/circuits', label: t('Circuitos'), icon: Award },
        coachesOn && { to: '/coaches', label: t('Professores'), icon: GraduationCap },
        communityFeedOn && { to: '/novidades', label: t('Comunidade'), icon: Zap },
      ].filter(Boolean),
    },
    {
      title: t('Descobrir'),
      items: [
        { to: '/atletas', label: t('Atletas'), icon: Users },
        ratingOn && { to: '/ranking', label: t('Ranking'), icon: Medal },
        doublesRankingOn && { to: '/ranking/duplas', label: t('Ranking de duplas'), icon: Medal },
        ratingOn && matchmakingOn && { to: '/encontrar-jogadores', label: rotulos.pessoas, icon: Swords },
        openGamesOn && { to: '/procura-jogo', label: rotulos.vagas, icon: Megaphone },
        { to: '/clubes', label: t('Clubes'), icon: Building2 },
        affiliatesOn && { to: '/parceiros', label: t('Parceiros'), icon: HeartHandshake },
      ].filter(Boolean),
    },
    {
      title: t('Você'),
      items: [
        { to: '/chat', label: t('Mensagens'), icon: MessageSquare },
        gameDayOn && { to: '/dia-de-jogo', label: t('Dia de jogo'), icon: Dices },
        performanceOn && { to: '/meu-desempenho', label: t('Meu desempenho'), icon: BarChart3 },
        gamificationOn && { to: '/gamification', label: rotulos.gamificacao, icon: Sparkles },
        showMyArenas && {
          to: '/arenas',
          label: t('Minhas arenas'),
          icon: Building2,
          badge: myPendingBookings,
          badgeHint: myPendingBookings > 0
            ? `${myPendingBookings} pedido(s) de reserva aguardando resposta`
            : undefined,
        },
        arenasOn && { to: '/minhas-reservas', label: t('Minhas reservas'), icon: Building2 },
        isCoach && { to: '/aulas', label: t('Ensino'), icon: GraduationCap },
        coachLessonsOn && { to: '/minhas-aulas', label: t('Minhas aulas'), icon: GraduationCap },
        { to: '/perfil', label: userHubOn ? t('Minha área') : t('Meu Perfil'), icon: User },
        trainingOn && { to: '/treino', label: t('Treino'), icon: Dumbbell },
        tournamentAdminConsoleOn && { to: '/perfil/torneios', label: rotulos.meusTorneios, icon: Trophy },
        settingsPageOn && { to: '/configuracoes', label: t('Configurações'), icon: Settings },
      ].filter(Boolean),
    },
    isPlatformAdmin && {
      title: t('Admin geral'),
      items: [
        adminConsoleOn && { to: '/admin/painel', label: t('Painel'), icon: LayoutDashboard, tag: t('Novo') },
      ].filter(Boolean),
    },
    {
      title: t('Aprender'),
      items: [
        { to: '/regras', label: t('Regras'), icon: BookOpen },
        { to: '/nivelamento', label: t('Nivelamento'), icon: Award },
        sportHistoryOn && { to: '/historia', label: t('História do esporte'), icon: History },
        { to: '/conduta', label: t('Conduta e fair play'), icon: HeartHandshake },
        { to: legalCenterOn ? '/legal' : '/politica-uso', label: t('Termos e Documentos'), icon: FileText },
      ].filter(Boolean),
    },
  ].filter(Boolean), [performanceOn, ratingOn, matchmakingOn, openGamesOn, affiliatesOn, communityFeedOn, arenasOn, circuitsOn, coachesOn, coachLessonsOn, isCoach, sportHistoryOn, isPlatformAdmin, adminConsoleOn, gameDayOn, legalCenterOn, myArenasCount, myPendingBookings, showMyArenas, gamificationOn, trainingOn, userHubOn, rotulos]);

  // Árvore de hubs (flag nav_hubs): destinos centrais (nível 1, barra lateral)
  // com suas subpáginas (nível 2, barra superior). Organizada por tema.
  const hubs = useMemo(() => {
    const hub = (h) => {
      const children = (h.children || []).filter(Boolean);
      return { ...h, children };
    };
    return [
      hub({ id: 'inicio', dica: 'menu-inicio', label: t('Início'), icon: LayoutGrid, to: '/', exact: true, children: [] }),
      hub({
        id: 'competir', dica: 'menu-competir', label: t('Competir'), icon: Trophy, to: '/torneios',
        children: [
          { to: '/torneios', label: t('Torneios'), icon: Trophy },
          circuitsOn && { to: '/circuits', label: t('Circuitos'), icon: Award },
          ratingOn && { to: '/ranking', label: t('Ranking'), icon: Medal },
          doublesRankingOn && { to: '/ranking/duplas', label: t('Ranking de duplas'), icon: Medal },
          // Gamificação V2: a temporada do mês, os desafios e o Hall da Fama são competição.
          gamificationOn && { to: '/gamification', label: rotulos.gamificacao, icon: Sparkles },
          gamificationOn && { to: '/hall-da-fama', label: t('Hall da Fama'), icon: Crown },
        ],
      }),
      // Jogar abre no DIA DE JOGO (os seus dias e os com vaga para você) e as
      // abas seguem a ordem de uso: organizar/entrar num dia, procurar jogo,
      // procurar gente. A ordem é contrato de tela (há teste travando).
      hub({
        id: 'jogar', dica: 'menu-jogar', label: t('Jogar'), icon: Swords, to: jogarHubTo({ gameDayOn, openGamesOn }),
        children: [
          gameDayOn && { to: '/dia-de-jogo', label: rotulos.abaDiaDeJogo, icon: Dices },
          openGamesOn && { to: '/procura-jogo', label: rotulos.vagas, icon: Megaphone },
          ratingOn && matchmakingOn && { to: '/encontrar-jogadores', label: rotulos.pessoas, icon: Swords },
        ],
      }),
      hub({
        id: 'comunidade', dica: 'menu-comunidade', label: t('Comunidade'), icon: Users, to: '/atletas',
        children: [
          { to: '/atletas', label: t('Atletas'), icon: Users },
          { to: '/clubes', label: t('Clubes'), icon: Building2 },
          communityFeedOn && { to: '/novidades', label: t('Novidades'), icon: Zap },
          { to: '/chat', label: t('Mensagens'), icon: MessageSquare },
        ],
      }),
      // Quem GERE arena tem a porta dela no 1º nível, acima de "Arenas" (que é
      // a lista para quem reserva). Com 2+ arenas, uma aba cada.
      showMyArenas && hub({
        id: 'minha-arena', label: myArenas.length === 1 ? (myArenas[0].name || t('Minha arena')) : t('Minhas arenas'),
        icon: LayoutDashboard, to: `/arenas/${myArenas[0].id}/gerir`,
        badge: myPendingBookings,
        badgeHint: myPendingBookings > 0 ? `${myPendingBookings} pedido(s) de reserva aguardando resposta` : undefined,
        children: myArenas.map((a) => ({
          to: `/arenas/${a.id}/gerir`, label: a.name || t('Arena'), icon: LayoutDashboard, badge: pendingByArena[a.id] || 0,
        })),
      }),
      (arenasOn || isPlatformAdmin) && hub({
        id: 'arenas', dica: 'menu-arenas', label: t('Arenas'), icon: Building2, to: '/arenas',
        children: [
          { to: '/arenas', label: rotulos.reservar, icon: MapPin },
          arenasOn && { to: '/minhas-reservas', label: t('Minhas reservas'), icon: CalendarClock },
        ],
      }),
      (coachesOn || isCoach || coachLessonsOn) && hub({
        id: 'ensino', dica: 'menu-aulas', label: t('Aulas'), icon: GraduationCap, to: coachesOn ? '/coaches' : '/minhas-aulas',
        children: [
          coachesOn && { to: '/coaches', label: t('Professores'), icon: GraduationCap },
          coachLessonsOn && { to: '/minhas-aulas', label: t('Minhas aulas'), icon: CalendarClock },
          // O painel do professor é hub próprio (abaixo).
        ],
      }),
      isCoach && hub({
        id: 'professor', label: t('Painel do professor'), icon: GraduationCap, to: '/aulas',
        children: [{ to: '/aulas', label: t('Painel do professor'), icon: GraduationCap }],
      }),
      // "Pickleball" (regras, nivelamento, história) não fica no 1º nível (§5.1):
      // continua na Ajuda e nas rotas de sempre; o menu fica com o que a pessoa FAZ.
      hub({
        id: 'perfil', dica: 'menu-perfil', label: userHubOn ? t('Minha área') : t('Perfil'), icon: User, to: '/perfil',
        children: [
          { to: '/perfil', label: userHubOn ? t('Minha área') : t('Meu perfil'), icon: User },
          trainingOn && { to: '/treino', label: t('Treino'), icon: Dumbbell },
          performanceOn && { to: '/meu-desempenho', label: t('Meu desempenho'), icon: BarChart3 },
          gamificationOn && { to: '/conquistas', label: t('Conquistas'), icon: Award },
          tournamentAdminConsoleOn && { to: '/perfil/torneios', label: rotulos.meusTorneios, icon: Trophy },
          settingsPageOn && { to: '/configuracoes', label: t('Configurações'), icon: Settings },
        ],
      }),
      // Federações (flag `federations`): hub próprio no menu — o diretório, a
      // filiação de quem é filiado e a Central de quem gere (pela página dela).
      federationsOn && hub({
        id: 'federacoes', dica: 'menu-federacoes', label: t('Federações'), icon: Landmark, to: '/federacoes',
        children: [{ to: '/federacoes', label: t('Federações'), icon: Landmark }],
      }),
      // Mercado (flag `marketplace`): comprar e vender, separado do mercado interno das arenas.
      marketplaceOn && hub({
        id: 'mercado', dica: 'menu-mercado', label: t('Mercado'), icon: Store, to: '/mercado',
        children: [
          // Dois ambientes: quem compra (as três primeiras) e quem vende (a última).
          { to: '/mercado', label: t('Comprar'), icon: Store, exact: true, also: ['/mercado/anuncio', '/mercado/vendedor', '/mercado/carrinho'] },
          { to: '/mercado/pedidos', label: t('Minhas compras'), icon: ShoppingBag, also: ['/mercado/vales'], dica: 'mercado-compras' },
          { to: '/mercado/favoritos', label: t('Salvos'), icon: Heart, also: ['/mercado/buscas'], dica: 'mercado-salvos' },
          { to: '/mercado/vender', label: t('Vender'), icon: Tag, also: ['/mercado/vendas', '/mercado/loja'], dica: 'mercado-vender' },
        ],
      }),
      // Parceiros da plataforma — seção própria e exclusiva, por último na lista.
      affiliatesOn && hub({
        id: 'parceiros', label: t('Parceiros'), icon: HeartHandshake, to: '/parceiros',
        children: [{ to: '/parceiros', label: t('Parceiros'), icon: HeartHandshake }],
      }),
      isPlatformAdmin && adminConsoleOn && hub({
        id: 'admin', label: t('Admin'), icon: LayoutDashboard, to: '/admin/painel',
        children: [{ to: '/admin/painel', label: t('Painel admin'), icon: LayoutDashboard }],
      }),
    ].filter(Boolean).filter((h) => h.id === 'inicio' || h.children.length > 0);
  }, [performanceOn, ratingOn, matchmakingOn, openGamesOn, affiliatesOn, communityFeedOn, arenasOn, circuitsOn, coachesOn, coachLessonsOn, isCoach, sportHistoryOn, isPlatformAdmin, adminConsoleOn, doublesRankingOn, athleteAgendaOn, gameDayOn, legalCenterOn, settingsPageOn, myPendingBookings, showMyArenas, gamificationOn, trainingOn, userHubOn, myArenas, pendingByArena, rotulos, marketplaceOn, federationsOn]);

  // A barra lateral e a gaveta mostram só os hubs que a pessoa escolheu
  // (core/domain/sidebarNav.js — padrão por papel, editável em Configurações
  // → Menu). `hubs` continua completo: é o que a busca indexa e o que diz em
  // que hub a pessoa está, mesmo num hub escondido.
  const papeis = useMemo(() => ({
    arenas: showMyArenas, professor: isCoach, admin: !!isPlatformAdmin, mercado: marketplaceOn, federacoes: federationsOn,
  }), [showMyArenas, isCoach, isPlatformAdmin, marketplaceOn, federationsOn]);
  const { itens: escolhidos } = useSidebarNav(papeis);
  const hubsVisiveis = useMemo(
    () => escolhidos.map((id) => hubs.find((h) => h.id === id)).filter(Boolean),
    [escolhidos, hubs],
  );

  return { sections, hubs, hubsVisiveis, myArenas, pendingByArena, isCoach, marketplaceOn };
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
  const current = pathname.endsWith('/') ? pathname : `${pathname}/`;
  // `also`: outras rotas que pertencem a este item (ex.: o carrinho é de "Comprar").
  if (item.also?.some((p) => current.startsWith(`${p}/`))) return true;
  if (item.exact) return pathname === item.to;
  const base = item.to.endsWith('/') ? item.to : `${item.to}/`;
  return current === base || current.startsWith(base);
}

function BrandLockup() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <BrandMark className="h-9 w-9" />
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
        <span className="ml-auto rounded-full bg-acid/20 px-2 py-0.5 text-2xs font-bold text-ink-lighter">{item.tag}</span>
      )}
      {showBadge && (
        <span
          className={cn(
            'ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-2xs font-bold',
            active ? 'bg-acid text-ink' : 'bg-acid/90 text-ink',
          )}
          title={item.badgeHint || tn(item.badge, '{n} pendência', '{n} pendências', { n: item.badge })}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  );
}

const BOTTOM_NAV_ICONS = {
  inicio: LayoutGrid, jogar: Swords, arenas: Building2, torneios: Trophy, treino: Dumbbell,
  painel: GraduationCap, central: LayoutDashboard, 'minha-area': User,
};

/**
 * O quarto item da barra muda com a pessoa (core/domain/bottomNav.js). O
 * Treino "recente" é preferência do navegador, por uid — zero banco.
 */
function useBottomNav({ uid, pathname, arenas, pendingByArena, ehProfessor }) {
  const { data: meusTorneios = [] } = useMyTournaments();
  useEffect(() => {
    if (uid && pathname.startsWith('/treino')) writeViewPreference(uid, 'treino:ultimo-acesso', String(Date.now()));
  }, [uid, pathname]);
  return useMemo(() => bottomNavItems({
    arenas: (arenas || []).map((a) => ({ id: a.id, pendencias: pendingByArena?.[a.id] || 0 })),
    ehProfessor,
    temTorneioAtual: myCurrentTournaments(meusTorneios, hojeLocal()).length > 0,
    treinoUltimoAcessoMs: Number(readViewPreference(uid, 'treino:ultimo-acesso')) || null,
  }).map((i) => ({ ...i, label: t(i.label), icon: BOTTOM_NAV_ICONS[i.icon] || LayoutGrid })), [arenas, pendingByArena, ehProfessor, meusTorneios, uid]);
}

function MobileBottomNav({ pathname, userHubOn = false, items }) {
  return (
    <nav
      aria-label={t('Navegação principal')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-paper-pure/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);
          const badge = typeof item.badge === 'number' && item.badge > 0 ? item.badge : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              data-dica={item.dica}
              onClick={() => recordEvent('nav_bottom_click', { item: item.id || item.to })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-semibold transition-colors',
                active ? 'text-ink' : 'text-gray-400',
              )}
            >
              <span className={cn('relative flex h-8 w-14 items-center justify-center rounded-full transition-colors', active && 'bg-ink')}>
                <Icon className={cn('h-5 w-5', active && 'text-acid')} />
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-acid px-1 text-2xs font-bold leading-none text-ink">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              {userHubOn && item.to === '/perfil' ? t('Minha área') : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function UserMenu({ displayName, displayPhoto, levelLabel, onLogout }) {
  const navigate = useNavigate();
  const userHubOn = true;
  const location = useLocation();
  const helpCenterOn = true;
  const centralAvisosOn = true;
  // A mesma assinatura do sino (uma só por pessoa): contar aqui não custa leitura.
  const { unreadCount } = useNotifications();
  const seloAvisos = formatUnreadBadge(unreadCount);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="btn-press hidden items-center justify-center rounded-full transition-opacity hover:opacity-80 sm:flex"
          aria-label={t('Menu do usuário')}
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
          <User className="mr-2 h-4 w-4" /> {userHubOn ? t('Minha área') : t('Meu perfil')}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/perfil/editar')}>
          <Pencil className="mr-2 h-4 w-4" /> Editar perfil
        </DropdownMenuItem>
        {/* A central de notificações (flag notifications_center): o histórico
            completo, também a partir daqui — o sino mostra só os mais novos. */}
        {centralAvisosOn && (
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(NOTIFICATIONS_PATH)}>
            <Bell className="mr-2 h-4 w-4" />
            <span className="flex-1">{t('Notificações')}</span>
            {seloAvisos && (
              <span className="ml-2 rounded-full bg-acid px-1.5 text-2xs font-bold text-ink">{seloAvisos}</span>
            )}
          </DropdownMenuItem>
        )}
        {/* Terceiro ponto de acesso à ajuda (além da barra lateral e da gaveta
            do celular): é aqui que a pessoa procura quando não sabe nem por
            onde começar a procurar. */}
        {helpCenterOn && (
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(helpLinkFor(location.pathname))}>
            <LifeBuoy className="mr-2 h-4 w-4" /> Central de ajuda
          </DropdownMenuItem>
        )}
        {/* Aparência (modo escuro, flag dark_mode): some com a flag desligada. */}
        <ThemeMenuSection />
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
      onClick={(e) => { recordEvent('nav_hub_click', { hub: hub.id, origem: 'lateral' }); onClick?.(e); }}
      data-dica={hub.dica}
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
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-acid px-1 text-2xs font-bold text-ink">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {!collapsed && <span className="ml-3 truncate font-medium">{hub.label}</span>}
      {!collapsed && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-acid px-1.5 text-2xs font-bold text-ink">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

/** Barra superior de subpáginas (nível 2) do hub ativo. Quebra em 2 linhas. */
function SubnavBar({ hub, pathname, onNavigate }) {
  return (
    // O mesmo recuo e a mesma calha de rolagem do <main>: com barra de rolagem
    // clássica (Windows) a moldura do conteúdo encolhe a largura dela, e a
    // barra de abas precisa encolher junto para começar na mesma linha.
    <div className="z-10 flex-shrink-0 overflow-hidden border-b border-gray-100 bg-paper-pure/95 px-4 py-2 backdrop-blur [scrollbar-gutter:stable] sm:px-6 lg:px-10">
      {/* A mesma moldura das páginas: as abas começam na linha do título. */}
      <div className={cn(PAGE_FRAME, 'hide-scrollbar flex flex-wrap items-center gap-1.5')}>
        {hub.children.map((c) => {
          const Icon = c.icon;
          const active = isActive(pathname, c);
          return (
            <Link
              key={c.to + c.label}
              to={c.to}
              onClick={onNavigate}
              data-dica={c.dica}
              aria-current={active ? 'page' : undefined}
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
  const { user, userProfile, signOut, isRealPlatformAdmin, isPlatformAdmin, viewAsUser, toggleViewAsUser } = useAuth();
  // O ranking NÃO é recalculado aqui: quem materializa os rankings é só o
  // servidor (functions/platformRankings.js). O recálculo que rodava no
  // navegador do admin era um segundo escritor das mesmas coleções — ver
  // docs/18-RANKINGS.md §8.
  const location = useLocation();
  const navigate = useNavigate();
  // Aviso com `?ancora=secao` → `#secao` (a regra de avisos não aceita `#`).
  useAncoraDoAviso();
  // Push deste aparelho: renova o token e abre o aviso tocado com o app aberto.
  usePushNoAparelho(user, navigate);
  const { sections, hubs, hubsVisiveis, myArenas, pendingByArena, isCoach, marketplaceOn } = useV2Nav();
  const bottomItems = useBottomNav({
    uid: user?.uid, pathname: location.pathname, arenas: myArenas, pendingByArena, ehProfessor: isCoach,
  });
  const userHubOn = true;
  const mainRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Paleta de comandos: ícone de busca, campo do cabeçalho e Ctrl/⌘+K.
  const [paletaAberta, setPaletaAberta] = useState(false);
  const abrirPaleta = (origem) => { recordEvent('search_open', { origem }); setPaletaAberta(true); };
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirPaleta('teclado'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const userMenuOn = true;
  const bottomNavOn = true;
  const navHubsOn = true;
  const legalCenterOn = true;
  const helpCenterOn = true;
  const centralAvisosOn = true;
  const gamificacaoOn = true;
  // A mesma assinatura do sino: o selo da gaveta não custa leitura nenhuma.
  const { unreadCount: avisosNaoLidos } = useNotifications();
  // Local único de "Termos e Documentos" no rodapé da navegação: central legal
  // completa quando a flag está ligada; página de política como fallback.
  const legalDocsPath = legalCenterOn ? '/legal' : '/politica-uso';

  // Portão de consentimento essencial e onboarding NUNCA podem ficar abertos ao
  // mesmo tempo: o Dialog (Radix) do onboarding desativa cliques fora dele
  // (pointer-events no body), o que travaria o overlay de consentimento — o
  // usuário via ambos e não conseguia clicar/preencher nada no primeiro acesso.
  // Regra: mostra o consentimento PRIMEIRO; o onboarding só entra quando os
  // consentimentos essenciais estão carregados e sem pendências.
  const { consentMap, isLoading: consentsLoading, isFetched: consentsFetched } = useMyConsents();
  const consentGateBlocking = legalCenterOn && !!user && (
    consentsLoading || !consentsFetched || pendingGateConsents(consentMap).length > 0
  );
  // 🐞 A mesma regra vale para os termos do Mercado: com o cadastro inicial
  // aberto por cima, os termos ficavam na tela e nenhum toque respondia (era o
  // "trava no celular"). Os termos vêm primeiro; o cadastro, depois do aceite.
  const marketGateBlocking = !consentGateBlocking && marketplaceOn
    && location.pathname.startsWith('/mercado') && pendingMarketConsents(consentMap).length > 0;
  // Com um aviso de aceite NA TELA, a página atrás não monta: nenhum diálogo
  // dela (um link com `?criar=1`, `?marcar=1`) abre por cima do aviso e o trava.
  // Enquanto os aceites só carregam, a página monta normalmente (sem esperar).
  const avisoNaTela = (consentGateBlocking && consentsFetched) || marketGateBlocking;

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

  const displayName = userProfile?.platform_name || userProfile?.full_name || t('Atleta');
  const displayPhoto = userProfile?.photo_url || null;
  const levelCode = userProfile?.leveling?.result?.level;
  const levelLabel = levelCode ? getLevelByCode(levelCode)?.name : t('Não nivelado');

  // Também quando os termos do Mercado entram ou saem: a página dos termos e a
  // do Mercado usam o mesmo <main>, e o aceite (no fim dos termos) abriria o
  // Mercado rolado lá para baixo.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, marketGateBlocking]);

  const pageTitlesOn = true;
  const globalSearchOn = true;
  useEffect(() => {
    if (!pageTitlesOn) return;
    const title = resolvePageTitle(location.pathname, { userHubOn });
    document.title = title ? `${title} · ${BRAND}` : BRAND;
  }, [pageTitlesOn, location.pathname, userHubOn]);

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
    <DicasProvider>
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
      {/* Portão de consentimento aos documentos essenciais (flag legal_center).
          Tem precedência sobre o onboarding para evitar dois modais
          bloqueantes simultâneos. */}
      <LegalConsentGate />
      {!consentGateBlocking && !marketGateBlocking && <V2OnboardingWizard />}
      {navHubsOn ? (
        <aside className={cn(
          'z-30 hidden flex-shrink-0 flex-col border-r border-gray-100 bg-paper-pure transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[248px]',
        )}>
          <div className={cn('flex h-20 items-center', collapsed ? 'justify-center px-2' : 'px-6')}>
            {collapsed ? (
              <Link to="/" aria-label="PickleRush"><BrandMark className="h-9 w-9" /></Link>
            ) : <BrandLockup />}
          </div>
          <nav data-dica="menu-principal" aria-label={t('Menu principal')} className="hide-scrollbar flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
            {hubsVisiveis.map((hub) => (
              <HubItem key={hub.id} hub={hub} active={activeHub?.id === hub.id} collapsed={collapsed} />
            ))}
          </nav>
          {/* Central de ajuda — no rodapé da barra, junto dos documentos e
              acima do botão de recolher. Fica FORA dos hubs de propósito: ajuda
              não é um tema da plataforma, é o que se procura quando se está
              perdido em qualquer um deles. Por isso aparece em toda tela. */}
          {helpCenterOn && (
            <Link
              to={helpLinkFor(location.pathname)}
              title={collapsed ? t('Central de ajuda') : undefined}
              aria-label={collapsed ? t('Central de ajuda') : undefined}
              className={cn(
                'btn-press group mx-3 mb-2 flex items-center rounded-2xl py-2.5 text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-0' : 'px-3.5',
                isActive(location.pathname, { to: '/ajuda' }) ? 'bg-ink text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-ink',
              )}
            >
              <LifeBuoy className={cn('h-4 w-4 shrink-0', isActive(location.pathname, { to: '/ajuda' }) ? 'text-acid' : 'text-gray-400 group-hover:text-acid')} />
              {!collapsed && <span className="ml-3">{t('Central de ajuda')}</span>}
            </Link>
          )}

          {/* Termos e Documentos — separada da navegação, no rodapé da barra.
              Reúne todos os termos, contratos, documentos e políticas de uso. */}
          <Link
            to={legalDocsPath}
            title={collapsed ? t('Termos e Documentos') : undefined}
            aria-label={collapsed ? t('Termos e Documentos') : undefined}
            className={cn(
              'btn-press group mx-3 mb-2 flex items-center rounded-2xl py-2.5 text-sm font-medium transition-colors',
              collapsed ? 'justify-center px-0' : 'px-3.5',
              isActive(location.pathname, { to: legalDocsPath }) ? 'bg-ink text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-ink',
            )}
          >
            <FileText className={cn('h-4 w-4 shrink-0', isActive(location.pathname, { to: legalDocsPath }) ? 'text-acid' : 'text-gray-400 group-hover:text-acid')} />
            {!collapsed && <span className="ml-3">{t('Termos e Documentos')}</span>}
          </Link>
          {/* O menu é da pessoa: o que aparece aqui se escolhe em Configurações → Menu. */}
          <Link
            to="/configuracoes#menu-lateral"
            data-dica="menu-personalizar"
            title={collapsed ? t('Personalizar o menu') : undefined}
            aria-label={collapsed ? t('Personalizar o menu') : undefined}
            className={cn(
              'btn-press group mx-3 mb-2 flex items-center rounded-2xl py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-ink',
              collapsed ? 'justify-center px-0' : 'px-3.5',
            )}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-gray-500 group-hover:text-acid" />
            {!collapsed && <span className="ml-3">{t('Personalizar o menu')}</span>}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'mx-3 mb-3 flex items-center gap-2 rounded-2xl border border-gray-100 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-ink/30 hover:text-ink',
              collapsed ? 'justify-center px-0' : 'px-3.5',
            )}
            title={collapsed ? t('Expandir menu') : t('Recolher menu')}
            aria-label={collapsed ? t('Expandir menu') : t('Recolher menu')}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> {t('Recolher')}</>}
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
                <p className="mb-3 px-4 text-2xs font-bold uppercase tracking-widest text-gray-500">{section.title}</p>
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

      <div className="relative flex min-w-0 w-full flex-1 flex-col">
        {/* Sem `w-full`: com `content-box` a largura 100% NÃO conta o recuo lateral,
            e o topo passava da tela em 2× o recuo (o avatar cortado). Esticado
            pela coluna, ele cabe; o content-box fica só para a área segura somar
            à altura. */}
        <header
          className={cn(
            'glass z-20 flex items-center justify-between px-4 sm:px-6 lg:px-10',
            'h-14 lg:h-20',
            navHubsOn ? 'flex-shrink-0 border-b border-gray-100' : 'absolute top-0',
          )}
          style={{ paddingTop: 'env(safe-area-inset-top)', boxSizing: 'content-box' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            data-dica="menu-celular"
            className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm lg:hidden"
            aria-label={t('Abrir menu')}
          >
            <Menu className="h-5 w-5" />
          </button>

          <button type="button"
            onClick={() => abrirPaleta('cabecalho')}
            className="hidden min-w-0 max-w-md flex-1 items-center gap-3 rounded-full bg-white py-3 pl-4 pr-4 text-left text-sm text-gray-500 shadow-sm hover:text-ink focus:outline-none focus:ring-4 focus:ring-gray-100 xl:flex"
            aria-label={t('Buscar ou ir para (Ctrl K)')}
          >
            <SearchIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">{t('Buscar ou ir para…')}</span>
            <kbd className="rounded-md border border-gray-200 px-1.5 py-0.5 text-2xs">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-3">
            {isRealPlatformAdmin && (
              <button
                type="button"
                onClick={toggleViewAsUser}
                title={viewAsUser ? t('Você está vendo como usuário comum. Toque para voltar à visão de admin.') : t('Ver a plataforma como um usuário comum.')}
                aria-pressed={viewAsUser}
                className={cn(
                  'btn-press flex h-10 min-w-10 items-center justify-center gap-2 rounded-full px-2.5 text-xs font-bold shadow-sm transition-colors sm:h-11 sm:min-w-11 xl:px-4',
                  viewAsUser ? 'bg-amber-400 text-ink hover:bg-amber-300' : 'bg-white text-gray-600 hover:text-ink',
                )}
              >
                {viewAsUser ? <Eye className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                <span className="hidden xl:inline">{viewAsUser ? t('Vendo como usuário') : t('Visão admin')}</span>
              </button>
            )}
            {/* Dicas (flag guided_tips): o único pedaço das dicas que existe com
                elas desligadas — é por ele que a pessoa liga. */}
            <BotaoDicas />
            <button type="button"
              onClick={() => abrirPaleta('icone')}
              aria-label={t('Buscar ou ir para')}
              title={t('Buscar')}
              className="btn-press flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-paper sm:h-11 sm:w-11 xl:hidden"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
            {/* Mensagens saiu da barra inferior e mora aqui, ao lado do sino. */}
            <Link
              to="/chat"
              aria-label={t('Mensagens')}
              title={t('Mensagens')}
              className="btn-press flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-paper sm:h-11 sm:w-11"
            >
              <MessageSquare className="h-5 w-5" />
            </Link>
            <NotificationsBell />
            {/* Idioma (flag multi_language): a bandeira do idioma atual; também em Configurações. */}
            <LanguageMenu />
            {userMenuOn && (
              <UserMenu
                displayName={displayName}
                displayPhoto={displayPhoto}
                levelLabel={levelLabel}
                onLogout={handleLogout}
              />
            )}
          </div>
        </header>

        <V2OfflineBanner />
        <InstallInviteBar />
        {/* Com os termos do Mercado na tela, as abas do Mercado não levam a lugar nenhum. */}
        {subnavHub && !marketGateBlocking && <SubnavBar hub={subnavHub} pathname={location.pathname} />}

        <main
          id="conteudo-principal"
          tabIndex={-1}
          ref={mainRef}
          className={cn(
            // Calha estável: página curta e página comprida ficam com a mesma
            // largura, e o conteúdo não pula quando a barra de rolagem aparece.
            'flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 outline-none [scrollbar-gutter:stable] sm:px-6 lg:px-10 lg:pb-12',
            navHubsOn ? 'pt-6' : 'pt-28',
          )}
        >
          {/* Termos do Mercado: uma página no lugar do Mercado (no primeiro
              acesso a /mercado e a cada versão nova), não uma janela por cima. */}
          {marketGateBlocking ? <MarketTermsGate /> : (avisoNaTela ? null : children)}
        </main>
        {gamificacaoOn && user?.uid && (
          <Suspense fallback={null}><GamificationBackground /></Suspense>
        )}
        {paletaAberta && (
          <Suspense fallback={null}>
            <V2CommandPalette
              open={paletaAberta}
              onOpenChange={setPaletaAberta}
              hubs={hubs}
              arenas={myArenas}
              treinoOn
              isPlatformAdmin={isPlatformAdmin}
              mercadoOn={marketplaceOn}
            />
          </Suspense>
        )}
        {bottomNavOn && (
          <MobileBottomNav pathname={location.pathname} userHubOn={userHubOn} items={bottomItems} />
        )}
      </div>

      <div
        className={cn(
          'fixed inset-0 z-40 flex-col bg-ink/80 backdrop-blur-md transition-opacity lg:hidden',
          mobileOpen ? 'flex opacity-100' : 'hidden opacity-0',
        )}
      >
        <div className="flex items-center justify-between p-6">
          <Link to="/" className="flex items-center gap-3">
            <LogoImg versao="escuro" alt={BRAND} className="h-8" />
            <span className="font-display text-xl font-bold tracking-tight text-white">{BRAND}</span>
          </Link>
          <button
            onClick={closeMobile}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            aria-label={t('Fechar menu')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="hide-scrollbar flex-1 overflow-y-auto px-6 pb-10">
          <form onSubmit={handleSearch} className="mb-4">
            <label htmlFor="busca-gaveta" className="sr-only">{t('Buscar')}</label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              <input
                id="busca-gaveta"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-base text-white placeholder:text-white/60 focus:border-acid focus:outline-none"
                placeholder={t('Buscar atletas, torneios, arenas…')}
              />
            </div>
          </form>
          {navHubsOn ? (
            /* Hubs: lista enxuta (nível 1). As subpáginas aparecem na barra
               superior ao entrar no hub — igual ao desktop. */
            <div className="space-y-1">
              {hubsVisiveis.map((hub) => {
                const Icon = hub.icon;
                const active = activeHub?.id === hub.id;
                const badge = typeof hub.badge === 'number' && hub.badge > 0 ? hub.badge : 0;
                return (
                  <Link
                    key={hub.id}
                    to={hub.to}
                    onClick={() => { recordEvent('nav_hub_click', { hub: hub.id, origem: 'gaveta' }); closeMobile(); }}
                    data-dica={hub.dica}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold transition-colors',
                      active ? 'bg-white/10 text-acid' : 'text-white hover:text-acid',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{hub.label}</span>
                    {badge > 0 && (
                      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-acid px-1.5 text-2xs font-bold text-ink">
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
                <p className="mb-3 text-2xs font-bold uppercase tracking-widest text-white/40">{section.title}</p>
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
            {/* No celular não há o menu do avatar: a aparência mora aqui. */}
            <ThemeDrawerSwitcher />
            <Link
              to="/configuracoes#menu-lateral"
              onClick={closeMobile}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold text-white transition-colors hover:text-acid"
            >
              <SlidersHorizontal className="h-5 w-5" /> Personalizar o menu
            </Link>
            {centralAvisosOn && (
              <Link
                to={NOTIFICATIONS_PATH}
                onClick={closeMobile}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold text-white transition-colors hover:text-acid"
              >
                <Bell className="h-5 w-5" />
                <span className="flex-1">{t('Notificações')}</span>
                {avisosNaoLidos > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-acid px-1.5 text-2xs font-bold text-ink">
                    {formatUnreadBadge(avisosNaoLidos)}
                  </span>
                )}
              </Link>
            )}
            {helpCenterOn && (
              <Link
                to={helpLinkFor(location.pathname)}
                onClick={closeMobile}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-display font-semibold text-white transition-colors hover:text-acid"
              >
                <LifeBuoy className="h-5 w-5" /> Central de ajuda
              </Link>
            )}
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
    </DicasProvider>
  );
}
