import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/core/lib/FirebaseAuthContext';
import Layout from '@/components/Layout';
import { Toaster } from '@/components/ui/sonner';
import { recordPageView } from '@/core/services/observabilityService';

const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/Login'));
const Inicio = lazy(() => import('@/modules/pool/pages/Dashboard'));
const Profile = lazy(() => import('@/pages/Profile'));
const CreatePool = lazy(() => import('@/modules/pool/pages/CreatePool'));
const JoinPool = lazy(() => import('@/modules/pool/pages/JoinPool'));
const Pool = lazy(() => import('@/modules/pool/pages/Pool'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const ResponsibleGaming = lazy(() => import('@/pages/ResponsibleGaming'));
const AdminMatches = lazy(() => import('@/modules/admin/pages/AdminMatches'));
const AdminMetrics = lazy(() => import('@/modules/admin/pages/AdminMetrics'));
const AdminSeed = lazy(() => import('@/modules/admin/pages/AdminSeed'));
const AdminCreatorRequests = lazy(() => import('@/modules/admin/pages/AdminCreatorRequests'));
const AdminPools = lazy(() => import('@/modules/admin/pages/AdminPools'));
const PageNotFound = lazy(() => import('@/pages/PageNotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return <FullScreenSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, isPlatformAdmin } = useAuth();
  if (isLoadingAuth) return <FullScreenSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;
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
        <BrowserRouter>
          <RouteTelemetry />
          <Suspense fallback={<FullScreenSpinner />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={withLayout('Landing', Landing)} />
              <Route path="/login" element={withLayout('Login', Login)} />
              <Route path="/regras" element={<Navigate to="/inicio" replace />} />
              <Route path="/politica-uso" element={withLayout('PrivacyPolicy', PrivacyPolicy)} />
              <Route path="/aviso-jogos" element={withLayout('ResponsibleGaming', ResponsibleGaming)} />

              {/* Authenticated */}
              <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />
              <Route path="/inicio" element={<ProtectedRoute>{withLayout('Inicio', Inicio)}</ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute>{withLayout('Profile', Profile)}</ProtectedRoute>} />
              <Route path="/boloes" element={<Navigate to="/inicio" replace />} />
              <Route path="/boloes/criar" element={<ProtectedRoute>{withLayout('CreatePool', CreatePool)}</ProtectedRoute>} />
              <Route path="/boloes/ingressar" element={<ProtectedRoute>{withLayout('JoinPool', JoinPool)}</ProtectedRoute>} />
              <Route path="/boloes/:poolId" element={<ProtectedRoute>{withLayout('Pool', Pool)}</ProtectedRoute>} />
              <Route path="/boloes/:poolId/:tab" element={<ProtectedRoute>{withLayout('Pool', Pool)}</ProtectedRoute>} />

              {/* Platform admin */}
              <Route path="/admin" element={<AdminRoute>{withLayout('AdminCreatorRequests', AdminCreatorRequests)}</AdminRoute>} />
              <Route path="/admin/solicitacoes" element={<AdminRoute>{withLayout('AdminCreatorRequests', AdminCreatorRequests)}</AdminRoute>} />
              <Route path="/admin/jogos" element={<AdminRoute>{withLayout('AdminMatches', AdminMatches)}</AdminRoute>} />
              <Route path="/admin/metricas" element={<AdminRoute>{withLayout('AdminMetrics', AdminMetrics)}</AdminRoute>} />
              <Route path="/admin/seed" element={<AdminRoute>{withLayout('AdminSeed', AdminSeed)}</AdminRoute>} />
              <Route path="/admin/boloes" element={<AdminRoute>{withLayout('AdminPools', AdminPools)}</AdminRoute>} />

              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
