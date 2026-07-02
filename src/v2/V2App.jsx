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

// Fluxos de autoria/admin/conteúdo: reutilizam as páginas provadas do app atual
// renderizadas dentro do shell v2, garantindo navegação completa sob /v2.
const CreateTournament = lazy(() => import('@/modules/tournament/pages/CreateTournament'));
const JoinTournament = lazy(() => import('@/modules/tournament/pages/JoinTournament'));
const TournamentFormatsGuide = lazy(() => import('@/modules/tournament/pages/TournamentFormatsGuide'));
const ModalityPage = lazy(() => import('@/modules/tournament/pages/ModalityPage'));
const CreateArena = lazy(() => import('@/modules/arenas/pages/CreateArena'));
const ArenaManage = lazy(() => import('@/modules/arenas/pages/ArenaManage'));
const CreateClub = lazy(() => import('@/modules/clubs/pages/CreateClub'));
const EventDetail = lazy(() => import('@/modules/clubs/pages/EventDetail'));
const Profile = lazy(() => import('@/pages/Profile'));
const PickleballRules = lazy(() => import('@/pages/PickleballRules'));
const Leveling = lazy(() => import('@/pages/Leveling'));
const SportHistory = lazy(() => import('@/pages/SportHistory'));
const ConductFairPlay = lazy(() => import('@/pages/ConductFairPlay'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const AdminTournaments = lazy(() => import('@/modules/admin/pages/AdminTournaments'));
const AdminMetrics = lazy(() => import('@/modules/admin/pages/AdminMetrics'));
const AdminPartners = lazy(() => import('@/modules/partners/pages/AdminPartners'));

function V2Spinner({ full = true }) {
  return (
    <div className={full ? 'v2-root flex h-[100dvh] w-full items-center justify-center bg-paper' : 'flex min-h-[60vh] w-full items-center justify-center'}>
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
    </div>
  );
}

/**
 * App v2 "Athleisure Premium" — experiência de design paralela sob /v2.
 *
 * Reutiliza integralmente a camada de dados (hooks/serviços/Firebase) do app
 * atual; apenas a apresentação é nova. Não altera nada do v1.
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
          <Route path="arenas/criar" element={<CreateArena />} />
          <Route path="arenas/:arenaId" element={<V2ArenaDetail />} />
          <Route path="arenas/:arenaId/gerir" element={<ArenaManage />} />
          <Route path="minhas-reservas" element={<V2Bookings />} />

          {/* Torneios */}
          <Route path="torneios" element={<V2Tournaments />} />
          <Route path="torneios/publicos" element={<Navigate to="/v2/torneios" replace />} />
          <Route path="torneios/criar" element={<CreateTournament />} />
          <Route path="torneios/ingressar" element={<JoinTournament />} />
          <Route path="torneios/guia" element={<TournamentFormatsGuide />} />
          <Route path="torneios/:tournamentId" element={<V2Tournament />} />
          <Route path="torneios/:tournamentId/modalidades/:modalityId" element={<ModalityPage />} />
          <Route path="torneios/:tournamentId/:tab" element={<V2Tournament />} />

          {/* Comunidade */}
          <Route path="atletas" element={<V2Athletes />} />
          <Route path="atleta/:uid" element={<V2AthleteProfile />} />
          <Route path="clubes" element={<V2Clubs />} />
          <Route path="clubes/criar" element={<CreateClub />} />
          <Route path="clubes/:clubId" element={<V2ClubDetail />} />
          <Route path="clubes/:clubId/eventos/:eventId" element={<EventDetail />} />
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
          <Route path="perfil/editar" element={<Profile />} />

          {/* Conteúdo do esporte */}
          <Route path="regras" element={<PickleballRules />} />
          <Route path="nivelamento" element={<Leveling />} />
          <Route path="historia" element={<SportHistory />} />
          <Route path="conduta" element={<ConductFairPlay />} />
          <Route path="politica-uso" element={<PrivacyPolicy />} />

          {/* Admin geral */}
          <Route path="admin/torneios" element={<AdminTournaments />} />
          <Route path="admin/metricas" element={<AdminMetrics />} />
          <Route path="admin/parceiros" element={<AdminPartners />} />

          <Route path="*" element={<Navigate to="/v2" replace />} />
        </Routes>
      </Suspense>
    </V2Layout>
  );
}
