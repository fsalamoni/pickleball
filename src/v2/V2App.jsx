import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import V2Layout from '@/v2/components/V2Layout';
import V2Dashboard from '@/v2/pages/V2Dashboard';
import V2Arenas from '@/v2/pages/V2Arenas';
import V2Tournaments from '@/v2/pages/V2Tournaments';
import V2Athletes from '@/v2/pages/V2Athletes';
import V2Ranking from '@/v2/pages/V2Ranking';
import V2FindPlayers from '@/v2/pages/V2FindPlayers';
import V2OpenGames from '@/v2/pages/V2OpenGames';
import V2Community from '@/v2/pages/V2Community';
import V2Partners from '@/v2/pages/V2Partners';
import V2Clubs from '@/v2/pages/V2Clubs';
import V2Performance from '@/v2/pages/V2Performance';
import V2Bookings from '@/v2/pages/V2Bookings';
import V2Profile from '@/v2/pages/V2Profile';

function V2Spinner() {
  return (
    <div className="v2-root flex h-[100dvh] w-full items-center justify-center bg-paper">
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
      <Routes>
        <Route index element={<V2Dashboard />} />
        <Route path="arenas" element={<V2Arenas />} />
        <Route path="torneios" element={<V2Tournaments />} />
        <Route path="atletas" element={<V2Athletes />} />
        <Route path="ranking" element={<V2Ranking />} />
        <Route path="encontrar-jogadores" element={<V2FindPlayers />} />
        <Route path="procura-jogo" element={<V2OpenGames />} />
        <Route path="novidades" element={<V2Community />} />
        <Route path="parceiros" element={<V2Partners />} />
        <Route path="clubes" element={<V2Clubs />} />
        <Route path="meu-desempenho" element={<V2Performance />} />
        <Route path="minhas-reservas" element={<V2Bookings />} />
        <Route path="perfil" element={<V2Profile />} />
        <Route path="*" element={<Navigate to="/v2" replace />} />
      </Routes>
    </V2Layout>
  );
}
