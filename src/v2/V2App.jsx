import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import V2Layout from '@/v2/components/V2Layout';

// Páginas nativas v2 (design Athleisure Premium).
const V2Dashboard = lazy(() => import('@/v2/pages/V2Dashboard'));
const V2Arenas = lazy(() => import('@/v2/pages/V2Arenas'));
const V2ArenaDetail = lazy(() => import('@/v2/pages/V2ArenaDetail'));
const V2Tournaments = lazy(() => import('@/v2/pages/V2Tournaments'));
const V2Tournament = lazy(() => import('@/v2/pages/V2Tournament'));
const V2Athletes = lazy(() => import('@/v2/pages/V2Athletes'));
const V2AthleteProfile = lazy(() => import('@/v2/pages/V2AthleteProfile'));
const V2Ranking = lazy(() => import('@/v2/pages/V2Ranking'));
const V2FindPlayers = lazy(() => import('@/v2/pages/V2FindPlayers'));
const V2OpenGames = lazy(() => import('@/v2/pages/V2OpenGames'));
const V2Community = lazy(() => import('@/v2/pages/V2Community'));
const V2Partners = lazy(() => import('@/v2/pages/V2Partners'));
const V2Clubs = lazy(() => import('@/v2/pages/V2Clubs'));
const V2ClubDetail = lazy(() => import('@/v2/pages/V2ClubDetail'));
const V2Performance = lazy(() => import('@/v2/pages/V2Performance'));
const V2Bookings = lazy(() => import('@/v2/pages/V2Bookings'));
const V2Profile = lazy(() => import('@/v2/pages/V2Profile'));
const V2Chat = lazy(() => import('@/v2/pages/V2Chat'));

// Páginas nativas v2 de autoria e admin.
const V2CreateTournament = lazy(() => import('@/v2/pages/V2CreateTournament'));
const V2JoinTournament = lazy(() => import('@/v2/pages/V2JoinTournament'));
const V2CreateArena = lazy(() => import('@/v2/pages/V2CreateArena'));
const V2CreateClub = lazy(() => import('@/v2/pages/V2CreateClub'));
const V2Circuits = lazy(() => import('@/v2/pages/V2Circuits'));
const V2CircuitManage = lazy(() => import('@/v2/pages/V2CircuitManage'));
const V2Coaches = lazy(() => import('@/v2/pages/V2Coaches'));
const V2CoachProfile = lazy(() => import('@/v2/pages/V2CoachProfile'));
const V2CoachAgenda = lazy(() => import('@/v2/pages/V2CoachAgenda'));
const V2StudentLessons = lazy(() => import('@/v2/pages/V2StudentLessons'));
const V2ProfileEdit = lazy(() => import('@/v2/pages/V2ProfileEdit'));
const V2AdminMetrics = lazy(() => import('@/v2/pages/V2AdminMetrics'));
const V2AdminTournaments = lazy(() => import('@/v2/pages/V2AdminTournaments'));
const V2AdminPartners = lazy(() => import('@/v2/pages/V2AdminPartners'));

const V2AdminConsole = lazy(() => import('@/v2/pages/V2AdminConsole'));
const V2AdminOwnerRestore = lazy(() => import('@/v2/pages/V2AdminOwnerRestore'));
const V2AdminOwnerDebug = lazy(() => import('@/v2/pages/V2AdminOwnerDebug'));

// Ainda reutilizando as páginas provadas do app atual dentro do shell v2
// (conteúdo estático, gestão de arena, modalidade e evento).
// Autoria/gestão/conteúdo — nativo v2.
const V2FormatsGuide = lazy(() => import('@/v2/pages/V2FormatsGuide'));
const V2ModalityPage = lazy(() => import('@/v2/pages/V2ModalityPage'));
const V2ArenaManage = lazy(() => import('@/v2/pages/V2ArenaManage'));
const V2ArenaOnboarding = lazy(() => import('@/v2/pages/V2ArenaOnboarding'));
const V2ArenaModules = lazy(() => import('@/v2/pages/V2ArenaModules'));
const V2ArenaOpenMatch = lazy(() => import('@/v2/pages/V2ArenaOpenMatch'));
const V2ArenaAdminOpenMatch = lazy(() => import('@/v2/pages/V2ArenaAdminOpenMatch'));
const V2ArenaMatchmaking = lazy(() => import('@/v2/pages/V2ArenaMatchmaking'));
const V2ArenaMembers = lazy(() => import('@/v2/pages/V2ArenaMembers'));
const V2ArenaAdminMembers = lazy(() => import('@/v2/pages/V2ArenaAdminMembers'));
const V2ArenaPDV = lazy(() => import('@/v2/pages/V2ArenaPDV'));
const V2ArenaClasses = lazy(() => import('@/v2/pages/V2ArenaClasses'));
const V2ArenaLeagues = lazy(() => import('@/v2/pages/V2ArenaLeagues'));
const V2ArenaMarketing = lazy(() => import('@/v2/pages/V2ArenaMarketing'));
const V2ArenaOperations = lazy(() => import('@/v2/pages/V2ArenaOperations'));
const V2ArenaAdvanced = lazy(() => import('@/v2/pages/V2ArenaAdvanced'));
const V2EventDetail = lazy(() => import('@/v2/pages/V2EventDetail'));
const V2AdminBootstrap = lazy(() => import('@/v2/pages/V2AdminBootstrap'));

// Conteúdo de referência — nativo v2.
const V2Rules = lazy(() => import('@/v2/pages/V2Rules'));
const V2Leveling = lazy(() => import('@/v2/pages/V2Leveling'));
const V2History = lazy(() => import('@/v2/pages/V2History'));
const V2Conduct = lazy(() => import('@/v2/pages/V2Conduct'));
const V2Privacy = lazy(() => import('@/v2/pages/V2Privacy'));

function V2Spinner({ full = true }) {
  return (
    <div className={full ? 'v2-root flex h-[100dvh] w-full items-center justify-center bg-paper' : 'flex min-h-[60vh] w-full items-center justify-center'}>
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
    </div>
  );
}

/**
 * V2App — "Athleisure Premium", a camada de apresentação OFICIAL e INTEGRAL
 * da plataforma PickleRush.
 *
 * É montada em `/*` pelo `App.jsx` raiz para todo usuário autenticado, e a
 * camada V2 também atende as rotas públicas (landing, login, espectador,
 * impressão) por meio do mesmo `App.jsx`.
 *
 * Reutiliza integralmente a camada de dados (`src/modules/*` — hooks,
 * services, Firestore) como fonte única de domínio.
 */
export default function V2App() {
  const { isAuthenticated, isLoadingAuth, isAuthAvailable } = useAuth();
  const allowLocalPreview = import.meta.env.DEV && !isAuthAvailable;

  if (isLoadingAuth) return <V2Spinner />;
  if (!isAuthenticated && !allowLocalPreview) return <Navigate to="/login" replace />;

  return (
    <V2Layout>
      <Suspense fallback={<V2Spinner full={false} />}>
        <Routes>
          <Route index element={<V2Dashboard />} />

          {/* Arenas */}
          <Route path="arenas" element={<V2Arenas />} />
          <Route path="arenas/criar" element={<V2CreateArena />} />
          <Route path="arenas/:arenaId" element={<V2ArenaDetail />} />
          <Route path="arenas/:arenaId/gerir" element={<V2ArenaManage />} />
          <Route path="arenas/:arenaId/onboarding" element={<V2ArenaOnboarding />} />
          <Route path="arenas/:arenaId/gerir/modulos" element={<V2ArenaModules />} />
          <Route path="arenas/:arenaId/gerir/open-match" element={<V2ArenaAdminOpenMatch />} />
          <Route path="arenas/:arenaId/open-match" element={<V2ArenaOpenMatch />} />
          <Route path="arenas/:arenaId/matchmaking" element={<V2ArenaMatchmaking />} />
          <Route path="arenas/:arenaId/membros" element={<V2ArenaMembers />} />
          <Route path="arenas/:arenaId/gerir/membros" element={<V2ArenaAdminMembers />} />
          <Route path="arenas/:arenaId/loja" element={<V2ArenaPDV />} />
          <Route path="arenas/:arenaId/gerir/pdv" element={<V2ArenaPDV />} />
          <Route path="arenas/:arenaId/aulas" element={<V2ArenaClasses />} />
          <Route path="arenas/:arenaId/gerir/aulas" element={<V2ArenaClasses />} />
          <Route path="arenas/:arenaId/torneios" element={<V2ArenaLeagues />} />
          <Route path="arenas/:arenaId/gerir/torneios" element={<V2ArenaLeagues />} />
          <Route path="arenas/:arenaId/marketing" element={<V2ArenaMarketing />} />
          <Route path="arenas/:arenaId/gerir/marketing" element={<V2ArenaMarketing />} />
          <Route path="arenas/:arenaId/gerir/operacoes" element={<V2ArenaOperations />} />
          <Route path="circuits" element={<V2Circuits />} />
          <Route path="circuits/:circuitId" element={<V2CircuitManage />} />
          <Route path="coaches" element={<V2Coaches />} />
          <Route path="coaches/:coachId" element={<V2CoachProfile />} />
          <Route path="aulas" element={<V2CoachAgenda />} />
          <Route path="minhas-aulas" element={<V2StudentLessons />} />
          <Route path="arenas/:arenaId/avancado" element={<V2ArenaAdvanced />} />
          <Route path="arenas/:arenaId/gerir/avancado" element={<V2ArenaAdvanced />} />
          <Route path="minhas-reservas" element={<V2Bookings />} />

          {/* Torneios */}
          <Route path="torneios" element={<V2Tournaments />} />
          <Route path="torneios/publicos" element={<Navigate to="/torneios" replace />} />
          <Route path="torneios/criar" element={<V2CreateTournament />} />
          <Route path="torneios/ingressar" element={<V2JoinTournament />} />
          <Route path="torneios/guia" element={<V2FormatsGuide />} />
          <Route path="torneios/:tournamentId" element={<V2Tournament />} />
          <Route path="torneios/:tournamentId/modalidades/:modalityId" element={<V2ModalityPage />} />
          <Route path="torneios/:tournamentId/:tab" element={<V2Tournament />} />

          {/* Comunidade */}
          <Route path="atletas" element={<V2Athletes />} />
          <Route path="atleta/:uid" element={<V2AthleteProfile />} />
          <Route path="clubes" element={<V2Clubs />} />
          <Route path="clubes/criar" element={<V2CreateClub />} />
          <Route path="clubes/:clubId" element={<V2ClubDetail />} />
          <Route path="clubes/:clubId/eventos/:eventId" element={<V2EventDetail />} />
          <Route path="novidades" element={<V2Community />} />
          <Route path="chat" element={<V2Chat />} />

          {/* Jogo e rating */}
          <Route path="ranking" element={<V2Ranking />} />
          <Route path="encontrar-jogadores" element={<V2FindPlayers />} />
          <Route path="procura-jogo" element={<V2OpenGames />} />
          <Route path="parceiros" element={<V2Partners />} />

          {/* Você */}
          <Route path="meu-desempenho" element={<V2Performance />} />
          <Route path="perfil" element={<V2Profile />} />
          <Route path="perfil/editar" element={<V2ProfileEdit />} />

          {/* Conteúdo do esporte */}
          <Route path="regras" element={<V2Rules />} />
          <Route path="nivelamento" element={<V2Leveling />} />
          <Route path="historia" element={<V2History />} />
          <Route path="conduta" element={<V2Conduct />} />
          <Route path="politica-uso" element={<V2Privacy />} />

          {/* Admin geral */}
          <Route path="admin/torneios" element={<V2AdminTournaments />} />
          <Route path="admin/metricas" element={<V2AdminMetrics />} />
          <Route path="admin/parceiros" element={<V2AdminPartners />} />
          <Route path="admin/perfis" element={<Navigate to="/admin/painel?tab=profiles" replace />} />
          <Route path="admin/painel" element={<V2AdminConsole />} />
          <Route path="admin/owner-restore" element={<V2AdminOwnerRestore />} />
          <Route path="admin/owner-debug" element={<V2AdminOwnerDebug />} />

          {/* V3 Bootstrap: liga flags da Arena V3 sem gate de feature flag */}
          <Route path="admin/v3-bootstrap" element={<V2AdminBootstrap />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </V2Layout>
  );
}
