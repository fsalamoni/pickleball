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
import { Building2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import ArenaModulesPanel from '@/v2/components/arenas/ArenaModulesPanel';
import { V2Skeleton, V2Surface, V2ErrorState, V2BackLink, V2Page, PAGE_TITLE } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function V2ArenaModules() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const masterOn = true;
  const { data: arena, isLoading, isError: arenaFalhou, refetch: recarregarArena } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();

  if (!masterOn) return <Navigate to={`/arenas/${arenaId}/gerir`} replace />;

  if (isLoading) {
    return (
      <V2Page className="space-y-4">
        <V2Skeleton className="h-32 rounded-4xl" />
        <V2Skeleton className="h-72 rounded-4xl" />
      </V2Page>
    );
  }

  if (!arena && arenaFalhou) {
    return (
      <V2Page>
        <V2ErrorState
          title={t('Não foi possível abrir os módulos desta arena')}
          description={t('A conexão falhou no meio do caminho. Tente de novo.')}
          onRetry={() => recarregarArena()}
        />
      </V2Page>
    );
  }

  if (!arena) {
    return (
      <V2Page>
        <V2Surface className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink">{t('Arena não encontrada')}</h2>
          <Link to="/arenas" className="mt-2 inline-block text-sm font-bold text-ink underline">
            {t('Voltar ao diretório')}
          </Link>
        </V2Surface>
      </V2Page>
    );
  }

  const canManage = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;
  if (!canManage) return <Navigate to={`/arenas/${arena.id}`} replace />;

  return (
    <V2Page>
      <V2BackLink to={`/arenas/${arena.id}/gerir`} className="mb-3">{t('Central da arena')}</V2BackLink>
      <h1 className={`mb-5 ${PAGE_TITLE}`}>
        {t('Módulos · {name}', { name: arena.name })}
      </h1>
      <ArenaModulesPanel arenaId={arena.id} canManage={canManage} />
    </V2Page>
  );
}
