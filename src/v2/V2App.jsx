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
const V2ProfileEdit = lazy(() => import('@/v2/pages/V2ProfileEdit'));
const V2AdminMetrics = lazy(() => import('@/v2/pages/V2AdminMetrics'));
const V2AdminTournaments = lazy(() => import('@/v2/pages/V2AdminTournaments'));
const V2AdminPartners = lazy(() => import('@/v2/pages/V2AdminPartners'));

// Ainda reutilizando as páginas provadas do app atual dentro do shell v2
// (conteúdo estático, gestão de arena, modalidade e evento).
// Autoria/gestão/conteúdo — nativo v2.
const V2FormatsGuide = lazy(() => import('@/v2/pages/V2FormatsGuide'));
const V2ModalityPage = lazy(() => import('@/v2/pages/V2ModalityPage'));
const V2ArenaManage = lazy(() => import('@/v2/pages/V2ArenaManage'));
const V2EventDetail = lazy(() => import('@/v2/pages/V2EventDetail'));

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
          <Route path="arenas/criar" element={<V2CreateArena />} />
          <Route path="arenas/:arenaId" element={<V2ArenaDetail />} />
          <Route path="arenas/:arenaId/gerir" element={<V2ArenaManage />} />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </V2Layout>
  );
}
