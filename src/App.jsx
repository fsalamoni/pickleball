import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/core/lib/FirebaseAuthContext';
import { FeatureFlagsProvider } from '@/core/lib/FeatureFlagsContext';
import { Toaster } from '@/components/ui/sonner';
import { recordPageView } from '@/core/services/observabilityService';

// Páginas públicas (sem autenticação) — precisam funcionar fora do app autenticado.
// V2 é a camada de apresentação oficial e integral; a landing e o login moram
// nela desde a consolidação da V2 como base única.
const Landing = lazy(() => import('@/v2/pages/V2Landing'));
const Login = lazy(() => import('@/v2/pages/V2Login'));
const PublicTournament = lazy(() => import('@/pages/PublicTournament'));
const PrintTournament = lazy(() => import('@/pages/PrintTournament'));
const Telao = lazy(() => import('@/pages/Telao'));
const PublicClub = lazy(() => import('@/pages/PublicClub'));

// App principal (V2 / "Athleisure Premium"). Chunk isolado.
const V2App = lazy(() => import('@/v2/V2App'));

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
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return children;
}

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
    </div>
  );
}

/**
 * Entrada principal da plataforma. Usuários autenticados entram no V2App;
 * visitantes veem a landing na raiz e são levados ao login nas demais rotas.
 */
function MainEntry() {
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth, isAuthAvailable } = useAuth();
  const allowLocalPreview = import.meta.env.DEV && !isAuthAvailable;

  if (isLoadingAuth) return <FullScreenSpinner />;
  if (!isAuthenticated && !allowLocalPreview) {
    if (location.pathname === '/') return <Landing />;
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <V2App />;
}

function RouteTelemetry() {
  const location = useLocation();
  useEffect(() => {
    recordPageView(location.pathname);
    // Algumas navegações internas preservam a posição atual por intenção
    // explícita (ex.: navegação lateral).
    if (typeof window !== 'undefined' && !location.state?.preserveWindowScroll) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.pathname, location.state]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FeatureFlagsProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <RouteTelemetry />
          <Suspense fallback={<FullScreenSpinner />}>
            <Routes>
              {/* Páginas públicas (sem autenticação) */}
              <Route path="/login" element={<Login />} />
              <Route path="/p/:tournamentId" element={<PublicTournament />} />
              <Route path="/torneios/:tournamentId/imprimir" element={<PrintTournament />} />
              <Route path="/torneios/:tournamentId/telao" element={<Telao />} />
              <Route path="/c/:clubId" element={<PublicClub />} />

              {/* Redirects de compatibilidade com URLs legadas (V1) */}
              <Route path="/inicio" element={<Navigate to="/" replace />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/aviso-jogos" element={<Navigate to="/conduta" replace />} />
              <Route path="/boloes" element={<Navigate to="/torneios" replace />} />
              <Route path="/boloes/criar" element={<Navigate to="/torneios/criar" replace />} />
              <Route path="/boloes/ingressar" element={<Navigate to="/torneios/ingressar" replace />} />
              <Route path="/boloes/:tournamentId" element={<Navigate to="/torneios/:tournamentId" replace />} />

              {/* Plataforma principal (PickleRush / V2) */}
              <Route path="/*" element={<MainEntry />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
        </FeatureFlagsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
