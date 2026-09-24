/**
 * `/arenas/:arenaId/gerir/pdv` — a rota antiga do balcão da loja.
 *
 * O balcão virou parte da Central da arena (aba **Pedidos do app**, painel em
 * `v2/components/arenas/shop/ArenaShopOrdersPanel.jsx`), e os produtos são os
 * do Mercado. A rota fica porque avisos antigos e links salvos apontam para
 * ela: leva à aba certa.
 */
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export default function V2ArenaAdminPDV() {
  const { arenaId } = useParams();
  return <Navigate to={`/arenas/${arenaId}/gerir?aba=pedidos`} replace />;
}
