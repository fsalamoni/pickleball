import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/core/lib/FirebaseAuthContext';
import Layout from '@/components/Layout';
import { Toaster } from '@/components/ui/sonner';
import { recordPageView } from '@/core/services/observabilityService';

const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/Login'));
const Inicio = lazy(() => import('@/modules/tournament/pages/Dashboard'));
const Profile = lazy(() => import('@/pages/Profile'));
const CreateTournament = lazy(() => import('@/modules/tournament/pages/CreateTournament'));
const JoinTournament = lazy(() => import('@/modules/tournament/pages/JoinTournament'));
const PublicTournamentsList = lazy(() => import('@/modules/tournament/pages/PublicTournamentsList'));
const Tournament = lazy(() => import('@/modules/tournament/pages/Tournament'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const PickleballRules = lazy(() => import('@/pages/PickleballRules'));
const Leveling = lazy(() => import('@/pages/Leveling'));
const ConductFairPlay = lazy(() => import('@/pages/ConductFairPlay'));
const AdminMetrics = lazy(() => import('@/modules/admin/pages/AdminMetrics'));
const AdminTournaments = lazy(() => import('@/modules/admin/pages/AdminTournaments'));
const PublicTournament = lazy(() => import('@/pages/PublicTournament'));
const PrintTournament = lazy(() => import('@/pages/PrintTournament'));
const AthletesDirectory = lazy(() => import('@/modules/athletes/pages/AthletesDirectory'));
const ClubsDirectory = lazy(() => import('@/modules/clubs/pages/ClubsDirectory'));
const CreateClub = lazy(() => import('@/modules/clubs/pages/CreateClub'));
const ClubDetail = lazy(() => import('@/modules/clubs/pages/ClubDetail'));
const ChatPage = lazy(() => import('@/modules/chat/pages/ChatPage'));
const PageNotFound = lazy(() => import('@/pages/PageNotFound'));

const LOCAL_PREVIEW_PROTECTED_PATHS = new Set([
  '/torneios/criar',
  '/torneios/ingressar',
  '/torneios/publicos',
  '/atletas',
  '/clubes',
  '/clubes/criar',
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth, isAuthAvailable } = useAuth();
  const isLocalPreviewRoute = import.meta.env.DEV
    && !isAuthAvailable
    && LOCAL_PREVIEW_PROTECTED_PATHS.has(location.pathname);

  if (isLoadingAuth) return <FullScreenSpinner />;
  if (!isAuthenticated && !isLocalPreviewRoute) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, isPlatformAdmin } = useAuth();
  if (isLoadingAuth) return <FullScreenSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/inicio" replace />;
  return children;
}

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function withLayout(pageName, Component) {
  return (
    <Layout currentPageName={pageName}>
      <Component />
    </Layout>
  );
}

function RouteTelemetry() {
  const location = useLocation();
  useEffect(() => {
    recordPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <RouteTelemetry />
          <Suspense fallback={<FullScreenSpinner />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={withLayout('Landing', Landing)} />
              <Route path="/login" element={withLayout('Login', Login)} />
              <Route path="/regras" element={withLayout('PickleballRules', PickleballRules)} />
              <Route path="/nivelamento" element={withLayout('Leveling', Leveling)} />
              <Route path="/conduta" element={withLayout('ConductFairPlay', ConductFairPlay)} />
              <Route path="/politica-uso" element={withLayout('PrivacyPolicy', PrivacyPolicy)} />

              {/* Public spectator view (sem auth) */}
              <Route path="/p/:tournamentId" element={<PublicTournament />} />
              <Route path="/torneios/:tournamentId/imprimir" element={<PrintTournament />} />

              {/* Legacy redirects (Bolão → Pickleball) */}
              <Route path="/aviso-jogos" element={<Navigate to="/conduta" replace />} />
              <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />
              <Route path="/boloes" element={<Navigate to="/inicio" replace />} />
              <Route path="/boloes/criar" element={<Navigate to="/torneios/criar" replace />} />
              <Route path="/boloes/ingressar" element={<Navigate to="/torneios/ingressar" replace />} />
              <Route path="/boloes/:tournamentId" element={<Navigate to="/torneios/:tournamentId" replace />} />

              {/* Authenticated */}
              <Route path="/inicio" element={<ProtectedRoute>{withLayout('Inicio', Inicio)}</ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute>{withLayout('Profile', Profile)}</ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute>{withLayout('Chat', ChatPage)}</ProtectedRoute>} />
              <Route path="/torneios" element={<Navigate to="/inicio" replace />} />
              <Route path="/torneios/criar" element={<ProtectedRoute>{withLayout('CreateTournament', CreateTournament)}</ProtectedRoute>} />
              <Route path="/torneios/ingressar" element={<ProtectedRoute>{withLayout('JoinTournament', JoinTournament)}</ProtectedRoute>} />
              <Route path="/torneios/publicos" element={<ProtectedRoute>{withLayout('PublicTournamentsList', PublicTournamentsList)}</ProtectedRoute>} />
              <Route path="/torneios/:tournamentId" element={<ProtectedRoute>{withLayout('Tournament', Tournament)}</ProtectedRoute>} />
              <Route path="/torneios/:tournamentId/:tab" element={<ProtectedRoute>{withLayout('Tournament', Tournament)}</ProtectedRoute>} />

              {/* Comunidade: atletas e clubes */}
              <Route path="/atletas" element={<ProtectedRoute>{withLayout('AthletesDirectory', AthletesDirectory)}</ProtectedRoute>} />
              <Route path="/clubes" element={<ProtectedRoute>{withLayout('ClubsDirectory', ClubsDirectory)}</ProtectedRoute>} />
              <Route path="/clubes/criar" element={<ProtectedRoute>{withLayout('CreateClub', CreateClub)}</ProtectedRoute>} />
              <Route path="/clubes/:clubId" element={<ProtectedRoute>{withLayout('ClubDetail', ClubDetail)}</ProtectedRoute>} />

              {/* Platform admin */}
              <Route path="/admin" element={<AdminRoute>{withLayout('AdminTournaments', AdminTournaments)}</AdminRoute>} />
              <Route path="/admin/torneios" element={<AdminRoute>{withLayout('AdminTournaments', AdminTournaments)}</AdminRoute>} />
              <Route path="/admin/metricas" element={<AdminRoute>{withLayout('AdminMetrics', AdminMetrics)}</AdminRoute>} />

              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
