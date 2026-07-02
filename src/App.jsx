import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/core/lib/FirebaseAuthContext';
import { FeatureFlagsProvider } from '@/core/lib/FeatureFlagsContext';
import Layout from '@/components/Layout';
import { Toaster } from '@/components/ui/sonner';
import { recordPageView } from '@/core/services/observabilityService';
import V1Routes from '@/V1Routes';

// Experiência de design paralela (Athleisure Premium) sob /v2. Chunk isolado:
// só carrega quando a rota /v2 é acessada e não interfere no app atual.
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
              <Route path="/v1/*" element={<V1Routes ProtectedRoute={ProtectedRoute} AdminRoute={AdminRoute} />} />
              <Route path="/*" element={<V2App />} />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
        </FeatureFlagsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
