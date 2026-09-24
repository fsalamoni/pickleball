/**
 * `/arenas/:arenaId/gerir/open-match` — a rota antiga do jogo aberto na gestão.
 *
 * O jogo aberto virou parte da Central da arena (aba **Jogo aberto**, painel em
 * `v2/components/arenas/openMatch/ArenaOpenMatchAdminPanel.jsx`). A rota fica
 * porque avisos antigos e links salvos apontam para ela: leva à aba certa.
 */
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export default function V2ArenaAdminOpenMatch() {
  const { arenaId } = useParams();
  return <Navigate to={`/arenas/${arenaId}/gerir?aba=jogo-aberto`} replace />;
}
