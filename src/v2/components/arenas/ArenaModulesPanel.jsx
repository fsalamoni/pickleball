/**
 * CAMADA 2 — Gestão da arena → Configurações → "Módulos".
 *
 * Aqui a ARENA liga para si o que a plataforma liberou. É a única tela onde
 * `arena_module_states` é escrito.
 *
 * Três cuidados de uso que valeram desenho próprio:
 *
 * 1. **Ligar arrasta, desligar derruba.** A carteira não existe sem membros.
 *    Ligar a carteira liga membros junto (avisado antes, gravado no mesmo
 *    lote); desligar membros derruba carteira, pacotes e mensalidade — e isso
 *    é CONFIRMADO, com a lista do que vai sumir. Ninguém deve descobrir depois.
 * 2. **O que a arena vê não é o catálogo inteiro.** Só o que foi liberado.
 *    Módulo não liberado não aparece nem cinza: não é escolha dela.
 * 3. **A promessa é dita na voz de quem recebe.** Cada módulo mostra o que
 *    muda para o atleta, para o professor e para a arena — porque ligar um
 *    módulo é uma decisão de negócio, não de sistema.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowUpRight, Check, ChevronDown, Info, Loader2, Lock, Puzzle, Save, Sparkles,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ARENA_MODULE_STATUS,
  ARENA_MODULE_STATUS_META,
  arenaModuleRoute,
  arenaModuleTree,
  getArenaModule,
  moduleConfigWithDefaults,
} from '@/modules/arenas/domain/moduleCatalog';
import {
  MODULE_OFF_REASON,
  MODULE_RELEASE_MODE,
  modulesToDisableWith,
  modulesToEnableWith,
} from '@/modules/arenas/domain/moduleAccess';
import {
  useArenaModules,
  useSetArenaModule,
  useSetArenaModuleConfig,
} from '@/modules/arenas/hooks/useArenaModules';
import { ModuleIcon } from './moduleIcons';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';

const AUDIENCE_LABEL = {
  atleta: 'Para o atleta',
  professor: 'Para o professor',
  arena: 'Para a arena',
};

/** Lista de nomes de módulos em português corrido: "A, B e C". */
function nameList(ids) {
  const names = ids.map((id) => getArenaModule(id)?.label).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/* ----------------------------- configuração ------------------------------- */

function ModuleConfig({ arenaId, mod, current }) {
  const save = useSetArenaModuleConfig();
  const [draft, setDraft] = useState(() => moduleConfigWithDefaults(mod.id, current));
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(moduleConfigWithDefaults(mod.id, current)),
    [draft, current, mod.id],
  );

  const handleSave = async () => {
    try {
      await save.mutateAsync({ arenaId, moduleId: mod.id, config: draft });
      toast.success('Configuração salva.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        Como este módulo funciona nesta arena
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {mod.config.map((field) => (
          field.type === 'boolean' ? (
            <div key={field.key} className="sm:col-span-2">
              <V2Toggle
                id={`${mod.id}-${field.key}`}
                label={field.label}
                hint={field.hint}
                checked={Boolean(draft[field.key])}
                onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
              />
            </div>
          ) : (
            <V2Field key={field.key} label={field.label} hint={field.hint} htmlFor={`${mod.id}-${field.key}`}>
              <V2Input
                id={`${mod.id}-${field.key}`}
                type={field.type === 'number' ? 'number' : 'text'}
                min={field.min}
                max={field.max}
                step={field.step}
                value={draft[field.key] ?? ''}
                onChange={(e) => setDraft((d) => ({
                  ...d,
                  [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                }))}
              />
            </V2Field>
          )
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <V2Button size="sm" disabled={!dirty || save.isPending} onClick={handleSave}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configuração
        </V2Button>
      </div>
    </div>
  );
}

/* ------------------------------ card do módulo ---------------------------- */

function ModuleCard({ arenaId, mod, access, canManage, busy, onToggle, isFamily }) {
  const [showConfig, setShowConfig] = useState(false);
  const on = access.isOn(mod.id);
  const reason = access.reasonFor(mod.id);
  const forced = access.byId[mod.id]?.mode === MODULE_RELEASE_MODE.FORCED;
  const blockedByDependency = reason === MODULE_OFF_REASON.REQUIRES
    || reason === MODULE_OFF_REASON.FAMILY_OFF;
  const manageRoute = arenaModuleRoute(mod.id, arenaId, 'manage');
  const publicRoute = arenaModuleRoute(mod.id, arenaId, 'public');

  return (
    <div
      className={[
        'rounded-2xl border p-4 transition-colors',
        on ? 'border-acid/60 bg-acid/[0.05]' : 'border-gray-100 bg-paper',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <ModuleIcon module={mod} size={isFamily ? 'md' : 'sm'} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={isFamily ? 'font-display text-base font-bold text-ink' : 'text-sm font-bold text-ink'}>
              {mod.label}
            </span>
            {on && <V2Badge tone="green"><Check className="h-3 w-3" /> Ativo</V2Badge>}
            {forced && <V2Badge tone="blue">Incluído pela plataforma</V2Badge>}
            {mod.status === ARENA_MODULE_STATUS.BETA && <V2Badge tone="amber">Novo</V2Badge>}
          </div>

          <p className="mt-1 text-xs leading-5 text-gray-600">{mod.summary || mod.description}</p>

          {/* A promessa, na voz de quem recebe. */}
          <ul className="mt-2 space-y-1">
            {Object.entries(mod.benefit).map(([who, text]) => (
              <li key={who} className="flex gap-1.5 text-[11px] leading-4 text-gray-500">
                <span className="shrink-0 font-bold text-gray-400">{AUDIENCE_LABEL[who] || who}:</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {mod.status === ARENA_MODULE_STATUS.EXTERNAL && mod.externalNote && (
            <p className="mt-2 flex gap-1.5 rounded-xl bg-purple-50 p-2 text-[11px] leading-4 text-purple-800">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{mod.externalNote}</span>
            </p>
          )}

          {!on && blockedByDependency && (
            <p className="mt-2 flex gap-1.5 text-[11px] leading-4 text-amber-700">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                Precisa de <strong>{nameList(access.missingFor(mod.id))}</strong>. Ao ativar,
                ligamos junto.
              </span>
            </p>
          )}

          {on && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {manageRoute && (
                <Link
                  to={manageRoute}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-paper-pure px-2.5 py-1 text-[11px] font-bold text-ink hover:border-ink"
                >
                  Gerenciar <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
              {publicRoute && (
                <Link
                  to={publicRoute}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-paper-pure px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:border-ink hover:text-ink"
                >
                  Ver como o atleta vê <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
              {mod.config.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowConfig((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-paper-pure px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:border-ink hover:text-ink"
                >
                  Configurar
                  <ChevronDown className={`h-3 w-3 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}

          {on && showConfig && mod.config.length > 0 && (
            <ModuleConfig arenaId={arenaId} mod={mod} current={access.configOf(mod.id)} />
          )}
        </div>

        <div className="shrink-0 pt-1">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          ) : forced ? (
            <span title="A plataforma incluiu este módulo para todas as arenas.">
              <Lock className="h-4 w-4 text-gray-300" />
            </span>
          ) : (
            <V2Toggle
              checked={on}
              onChange={(v) => {
                if (!canManage) {
                  toast.error('Só quem administra a arena pode mexer nos módulos.');
                  return;
                }
                onToggle(mod.id, v);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- painel --------------------------------- */

/**
 * @param {{ arenaId: string, canManage?: boolean }} props
 */
export default function ArenaModulesPanel({ arenaId, canManage = false }) {
  const access = useArenaModules(arenaId);
  const setModule = useSetArenaModule();
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const tree = useMemo(() => arenaModuleTree(), []);
  // Só o que a plataforma liberou entra em tela. Módulo não liberado não é
  // escolha da arena — mostrar cinza só ensinaria a ignorar a lista.
  const visible = useMemo(() => {
    const released = new Set(access.releasedIds);
    return tree
      .map((node) => ({
        family: node.family,
        children: node.children.filter((c) => released.has(c.id)),
        familyReleased: released.has(node.family.id),
      }))
      .filter((node) => node.familyReleased || node.children.length > 0);
  }, [tree, access.releasedIds]);

  async function apply(moduleId, enabled) {
    setBusyId(moduleId);
    try {
      const res = await setModule.mutateAsync({
        arenaId,
        moduleId,
        enabled,
        platformModules: access.platformModules,
        arenaStates: access.arenaStates,
      });
      const label = getArenaModule(moduleId)?.label;
      if (enabled) {
        toast.success(
          res.together.length > 0
            ? `${label} ativado, junto com ${nameList(res.together)}.`
            : `${label} ativado.`,
        );
      } else {
        toast.success(
          res.together.length > 0
            ? `${label} desativado, e com ele ${nameList(res.together)}.`
            : `${label} desativado.`,
        );
      }
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar o módulo.');
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  function handleToggle(moduleId, enabled) {
    const ctx = { platformModules: access.platformModules, arenaStates: access.arenaStates };
    if (!enabled) {
      const falls = modulesToDisableWith(moduleId, ctx);
      if (falls.length > 0) {
        setConfirm({ moduleId, falls });
        return;
      }
    } else {
      const rises = modulesToEnableWith(moduleId, ctx);
      if (rises.length > 0) {
        setConfirm({ moduleId, rises });
        return;
      }
    }
    apply(moduleId, enabled);
  }

  if (access.isLoading) return <V2Skeleton className="h-72" />;

  if (access.isError) {
    return (
      <V2Surface>
        <p className="text-sm text-red-700">
          Não foi possível carregar os módulos.{' '}
          <button type="button" className="font-bold underline" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </p>
      </V2Surface>
    );
  }

  if (visible.length === 0) {
    return (
      <V2Surface>
        <V2EmptyState
          icon={Puzzle}
          title="Nenhum módulo disponível ainda"
          description={
            'Os módulos adicionais são funcionalidades extras que a plataforma libera às arenas — '
            + 'lista de espera, membros, pacotes, cupons, aulas, torneios internos e mais. '
            + 'Assim que a plataforma liberar alguma, ela aparece aqui para você ativar.'
          }
        />
      </V2Surface>
    );
  }

  const { summary } = access;

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-acid/15 text-ink">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink">Módulos adicionais</h2>
            <p className="max-w-2xl text-xs leading-5 text-gray-500">
              Funcionalidades extras que você liga <strong>só para a sua arena</strong>. Ligar um
              módulo faz a funcionalidade aparecer para você e para os seus atletas; desligar faz
              sumir da tela — nada é apagado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <V2Badge tone={summary.enabled > 0 ? 'green' : 'neutral'}>
                {summary.enabled} ativos
              </V2Badge>
              <V2Badge tone="neutral">{summary.released} disponíveis</V2Badge>
            </div>
          </div>
        </div>
        {!canManage && (
          <p className="mt-4 flex gap-1.5 rounded-2xl bg-paper p-3 text-xs text-gray-500">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Você está vendo em modo leitura. Só quem administra a arena pode ligar e desligar.
          </p>
        )}
      </V2Surface>

      {visible.map((node) => (
        <V2Surface key={node.family.id} className="space-y-2">
          {node.familyReleased && (
            <ModuleCard
              arenaId={arenaId}
              mod={node.family}
              access={access}
              canManage={canManage}
              busy={busyId === node.family.id}
              onToggle={handleToggle}
              isFamily
            />
          )}
          {node.children.length > 0 && (
            <div className="space-y-2 sm:pl-6">
              {node.children.map((child) => (
                <ModuleCard
                  key={child.id}
                  arenaId={arenaId}
                  mod={child}
                  access={access}
                  canManage={canManage}
                  busy={busyId === child.id}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </V2Surface>
      ))}

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(v) => !v && setConfirm(null)}
        destructive={Boolean(confirm?.falls)}
        title={
          confirm?.falls
            ? `Desativar ${getArenaModule(confirm.moduleId)?.label}?`
            : `Ativar ${getArenaModule(confirm?.moduleId)?.label}?`
        }
        description={
          confirm?.falls
            ? `Isto também desativa ${nameList(confirm.falls)}, porque dependem dele. `
              + 'Nada é apagado — as funcionalidades somem da tela e voltam se você ativar de novo.'
            : `Para funcionar, este módulo precisa de ${nameList(confirm?.rises || [])}. `
              + 'Vamos ativar tudo junto.'
        }
        confirmLabel={confirm?.falls ? 'Desativar tudo' : 'Ativar tudo'}
        loading={Boolean(busyId)}
        onConfirm={() => confirm && apply(confirm.moduleId, !confirm.falls)}
      />
    </div>
  );
}
