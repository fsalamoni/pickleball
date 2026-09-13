/**
 * CAMADA 3 — o guarda de tela dos módulos da arena.
 *
 * Módulo desligado NÃO é erro: é ausência. A regra do projeto vale aqui —
 * comando sem atribuição não é renderizado desabilitado, simplesmente não
 * existe. Por isso o padrão deste componente é não desenhar NADA.
 *
 *   <ArenaModuleGuard arenaId={arena.id} module={ARENA_MODULE_ID.MEMBERS}>
 *     <SecaoDeMembros />
 *   </ArenaModuleGuard>
 *
 * Há duas exceções em que dizer algo é melhor do que sumir, ambas explícitas:
 *
 * - `fallback`   o que desenhar no lugar (ex.: um convite para a arena ativar,
 *                quando quem olha é o gestor e não o atleta).
 * - `redirectTo` rota inteira que só existe com o módulo ligado: em vez de
 *                deixar a pessoa numa tela vazia, leva de volta.
 *
 * Enquanto carrega, o guarda não decide: `loading` (ou nada). Piscar o
 * conteúdo e escondê-lo em seguida é pior do que esperar meio segundo.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';

/**
 * @param {Object} props
 * @param {string} props.arenaId
 * @param {string} props.module — id do catálogo (ARENA_MODULE_ID.*)
 * @param {React.ReactNode} [props.children]
 * @param {React.ReactNode} [props.fallback] — o que mostrar quando desligado
 * @param {React.ReactNode} [props.loading] — o que mostrar enquanto carrega
 * @param {string} [props.redirectTo] — rota para onde voltar quando desligado
 */
export default function ArenaModuleGuard({
  arenaId,
  module: moduleId,
  children,
  fallback = null,
  loading = null,
  redirectTo,
}) {
  const { isOn, isLoading } = useArenaModules(arenaId);

  if (isLoading) return loading;
  if (isOn(moduleId)) return children;
  if (redirectTo) return <Navigate to={redirectTo} replace />;
  return fallback;
}
