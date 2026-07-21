/**
 * V2ArenaModules — Painel admin para ligar/desligar módulos V3 da arena.
 *
 * Rota: /arenas/:arenaId/gerir/modulos
 * Acesso: gestor da arena + platform admin.
 *
 * Mostra:
 * - Flag master (Arena V3) - se off, mostra aviso + link pro admin master
 * - Switches por módulo raiz + seus filhos
 * - Estado atual: ON/OFF, por arena + global
 * - Auditoria (quem ligou, quando)
 *
 * Aditivo — não mexe no V2ArenaManage.
 */

import React, { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Puzzle, Lock, Info } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaModuleStates,
  useToggleArenaModule,
  useSetArenaModuleState,
  useCanArenaUseModule,
} from '@/modules/arenas/hooks/useArenaV3';
import {
  ARENA_MODULE_ID,
  ARENA_MODULE_META,
  listRootModules,
  isParentModule,
} from '@/modules/arenas/domain/modules';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

const COLOR_CLASSES = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  pink: 'bg-pink-50 text-pink-700 border-pink-100',
  slate: 'bg-slate-50 text-slate-700 border-slate-100',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
};

function ModuleCard({ moduleId, arenaId, isChild = false }) {
  const meta = ARENA_MODULE_META[moduleId];
  const toggle = useToggleArenaModule();
  const setState = useSetArenaModuleState();
  const canUse = useCanArenaUseModule(arenaId, moduleId);
  const flags = useFeatureFlag();
  const parentFlagOn = !isChild || flags?.[`arena_module_${meta?.parent}`];
  const globalFlagOn = !!flags?.[`arena_module_${moduleId}`];
  const masterOn = !!flags?.arena_modules;
  const colorCls = COLOR_CLASSES[meta?.color] || COLOR_CLASSES.slate;

  const handleToggle = () => {
    if (!masterOn || !globalFlagOn) {
      toast.error('A plataforma ainda não ativou este módulo globalmente.');
      return;
    }
    toggle.mutate(
      { arenaId, moduleId },
      {
        onSuccess: () => {
          toast.success(canUse ? `${meta.label} desativado` : `${meta.label} ativado`);
        },
        onError: (err) => {
          toast.error(`Erro: ${err.message}`);
        },
      },
    );
  };

  const disabled = !masterOn || !globalFlagOn;
  const reason = !masterOn
    ? 'A flag master Arena V3 está desligada na plataforma'
    : !globalFlagOn
    ? 'A flag global deste módulo está desligada'
    : !parentFlagOn
    ? 'O módulo pai está desligado'
    : null;

  return (
    <div
      className={[
        'rounded-3xl border p-5 transition',
        isChild ? 'ml-6 mt-2' : '',
        canUse ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100 bg-paper-pure',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={['inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold', colorCls].join(' ')}>
              {meta?.label || moduleId}
            </span>
            {isChild && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">sub-módulo</span>
            )}
            {!globalFlagOn && (
              <V2Badge tone="amber">Global OFF</V2Badge>
            )}
            {globalFlagOn && !canUse && (
              <V2Badge tone="neutral">Desativado pela arena</V2Badge>
            )}
            {canUse && (
              <V2Badge tone="green">Ativo</V2Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-600">{meta?.description}</p>
          {reason && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
              <Lock className="h-3.5 w-3.5" /> {reason}
            </p>
          )}
        </div>
        <div>
          <button
            type="button"
            role="switch"
            aria-checked={canUse}
            disabled={disabled || toggle.isPending}
            onClick={handleToggle}
            className={[
              'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition',
              canUse ? 'bg-emerald-500' : 'bg-gray-300',
              disabled ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                canUse ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleFamily({ moduleId, arenaId }) {
  const meta = ARENA_MODULE_META[moduleId];
  const canUse = useCanArenaUseModule(arenaId, moduleId);
  const flags = useFeatureFlag();
  const globalFlagOn = !!flags?.[`arena_module_${moduleId}`];
  const colorCls = COLOR_CLASSES[meta?.color] || COLOR_CLASSES.slate;

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className={['flex h-10 w-10 items-center justify-center rounded-2xl', colorCls].join(' ')}>
          <Puzzle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-ink">{meta?.label}</h2>
          <p className="text-sm text-gray-500">{meta?.description}</p>
        </div>
        {globalFlagOn && canUse && <V2Badge tone="green">Família ativa</V2Badge>}
        {globalFlagOn && !canUse && <V2Badge tone="neutral">Família disponível</V2Badge>}
        {!globalFlagOn && <V2Badge tone="amber">Família indisponível</V2Badge>}
      </div>
      <ModuleCard moduleId={moduleId} arenaId={arenaId} />
      {isParentModule(moduleId) && (
        <div className="mt-2 space-y-2">
          {meta.children.map((childId) => (
            <ModuleCard key={childId} moduleId={childId} arenaId={arenaId} isChild />
          ))}
        </div>
      )}
    </V2Surface>
  );
}

export default function V2ArenaModules() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const flags = useFeatureFlag();
  const masterOn = !!flags?.arena_modules;

  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [], isLoading: managedLoading } = useMyManagedArenas();

  if (arenaLoading || managedLoading) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-4">
        <V2Skeleton className="h-12 w-1/3 rounded-4xl" />
        <V2Skeleton className="h-64 rounded-4xl" />
        <V2Skeleton className="h-64 rounded-4xl" />
      </div>
    );
  }

  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            title="Arena não encontrada"
            description="Verifique o link ou volte ao diretório."
            action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar ao diretório</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canManage) return <Navigate to={`/arenas/${arena.id}`} replace />;

  // Se flag master off, mostrar aviso (mas ainda renderizar para platform admin)
  const rootModules = listRootModules();

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Topo */}
      <div className="mb-6">
        <Link
          to={`/arenas/${arena.id}/gerir`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao hub admin
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              Módulos · {arena.name}
            </h1>
            <p className="mt-2 font-medium text-gray-500">
              Escolha quais ferramentas a sua arena vai usar. Você pode ligar e desligar a qualquer momento.
            </p>
          </div>
        </div>
      </div>

      {/* Aviso master off */}
      {!masterOn && (
        <V2Surface className="mb-6 border-amber-200 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-display text-base font-bold text-amber-900">
                A plataforma ainda não liberou os módulos V3
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                O admin da plataforma precisa ligar a flag <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">arena_modules</code> no Painel Admin.
                Você pode ver o catálogo, mas não consegue ativar nada até lá.
              </p>
            </div>
          </div>
        </V2Surface>
      )}

      {/* Renderiza todos os módulos raiz + filhos */}
      <div className="space-y-4">
        {rootModules.map((moduleId) => (
          <ModuleFamily key={moduleId} moduleId={moduleId} arenaId={arena.id} />
        ))}
      </div>

      {/* Footer info */}
      <V2Surface className="mt-6 bg-gray-50/50">
        <p className="text-xs text-gray-500">
          <strong>Como funciona:</strong> cada módulo tem 3 camadas de controle. (1) A flag master da plataforma
          (<code className="font-mono">arena_modules</code>) precisa estar ON. (2) A sub-flag global do módulo precisa estar ON.
          (3) A arena liga/desliga individualmente aqui. Se a sua arena tem um recurso que a plataforma já liberou
          e você quer usar, é só ativar o switch.
        </p>
      </V2Surface>
    </div>
  );
}
