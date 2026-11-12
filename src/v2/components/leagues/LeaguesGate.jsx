/**
 * Porta das telas de liga: enquanto as flags carregam, esqueleto; sem nenhuma
 * flag de ligas ligada, volta aos torneios. A barreira de verdade é o servidor.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { V2Page, V2Skeleton } from '@/v2/ui/primitives';
import { useLeaguesVisible } from '@/modules/leagues/hooks/useLeagues';

export default function LeaguesGate({ children }) {
  const { visible, loading } = useLeaguesVisible();
  if (loading) return <V2Page className="space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-64" /></V2Page>;
  if (!visible) return <Navigate to="/torneios" replace />;
  return children;
}
