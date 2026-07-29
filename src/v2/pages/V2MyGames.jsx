/**
 * V2MyGames — rota legada. O conteúdo "Meus jogos" passou a ser uma sub-aba
 * dentro de "Meu desempenho". Esta rota apenas redireciona, preservando os
 * links antigos (/meus-jogos → /meu-desempenho).
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

export default function V2MyGames() {
  return <Navigate to="/meu-desempenho" replace />;
}
