/**
 * V2ArenaModules — a rota própria dos módulos adicionais da arena.
 *
 * Rota: `/arenas/:arenaId/gerir/modulos`
 * Acesso: gestor da arena + admin da plataforma.
 *
 * O conteúdo é o MESMO de Gestão → Configurações → Módulos
 * (`ArenaModulesPanel`). Esta rota existe por dois motivos:
 *
 * 1. link direto — é para cá que apontam a ajuda, os avisos e os atalhos;
 * 2. compatibilidade — o endereço já existia e continua funcionando.
 *
 * Com a chave-mestra desligada, a rota volta para a Central da arena: página
 * que não tem o que mostrar não deve existir.
 */

import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import ArenaModulesPanel from '@/v2/components/arenas/ArenaModulesPanel';
import { V2Skeleton, V2Surface } from '@/v2/ui/primitives';

export default function V2ArenaModules() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const masterOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();

  if (!masterOn) return <Navigate to={`/arenas/${arenaId}/gerir`} replace />;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4">
        <V2Skeleton className="h-32 rounded-4xl" />
        <V2Skeleton className="h-72 rounded-4xl" />
      </div>
    );
  }

  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink">Arena não encontrada</h2>
          <Link to="/arenas" className="mt-2 inline-block text-sm font-bold text-ink underline">
            Voltar ao diretório
          </Link>
        </V2Surface>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;
  if (!canManage) return <Navigate to={`/arenas/${arena.id}`} replace />;

  return (
    <div className="mx-auto max-w-[900px]">
      <Link
        to={`/arenas/${arena.id}/gerir`}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Central da arena
      </Link>
      <h1 className="mb-5 font-display text-3xl font-bold tracking-tight text-ink">
        Módulos · {arena.name}
      </h1>
      <ArenaModulesPanel arenaId={arena.id} canManage={canManage} />
    </div>
  );
}
