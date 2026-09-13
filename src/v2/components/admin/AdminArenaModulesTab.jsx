/**
 * CAMADA 1 — Painel admin → Funcionalidades → "Módulos de arena".
 *
 * Aqui o admin da PLATAFORMA decide o que as arenas podem escolher. Não liga
 * nada para ninguém: libera. Quem liga é a arena, na tela dela.
 *
 * A distinção é o coração do mecanismo e está escrita na tela, porque é fácil
 * confundir "liberado" com "ativo".
 *
 * Só aparece com a chave-mestra (`arena_modules`) ligada — a própria aba é
 * injetada condicionalmente em `V2AdminConsole`.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Building2, Check, ChevronDown, Info, Layers, Loader2, Puzzle, Search, X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  ARENA_MODULE_STATUS,
  ARENA_MODULE_STATUS_META,
  arenaModuleTree,
} from '@/modules/arenas/domain/moduleCatalog';
import { MODULE_RELEASE_MODE } from '@/modules/arenas/domain/moduleAccess';
import {
  setArenaModuleRelease,
  setArenaModuleReleases,
} from '@/modules/arenas/services/platformModulesService';
import { usePlatformArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { arenaKeys } from '@/modules/arenas/hooks/arenaKeys';
import { ModuleIcon } from '@/v2/components/arenas/moduleIcons';
import {
  V2Badge, V2Button, V2Skeleton, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';

/** Sem acento e em minúsculas, para a busca não depender de digitação exata. */
function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* --------------------------- adoção pelas arenas -------------------------- */

/**
 * Quantas arenas ativaram cada módulo. Carregado SÓ quando o admin pede: é uma
 * varredura de `arena_module_states`, e não faz sentido pagá-la em toda
 * abertura da aba.
 */
function useModuleAdoption(enabled) {
  return useQuery({
    queryKey: ['arena-module-adoption'],
    enabled,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      if (!db) return {};
      const snap = await getDocs(
        query(collection(db, 'arena_module_states'), where('enabled', '==', true)),
      );
      const count = {};
      snap.docs.forEach((d) => {
        const mid = d.data()?.module_id;
        if (mid) count[mid] = (count[mid] || 0) + 1;
      });
      return count;
    },
  });
}

/* ------------------------------ linha do módulo --------------------------- */

function StatusBadge({ status }) {
  const meta = ARENA_MODULE_STATUS_META[status];
  if (!meta) return null;
  return <V2Badge tone={meta.tone} title={meta.hint}>{meta.label}</V2Badge>;
}

function ModuleRow({ mod, entry, adoption, busy, onRelease, onMode, isFamily = false }) {
  const releasable = ARENA_MODULE_STATUS_META[mod.status]?.releasable === true;
  const released = Boolean(entry?.released);
  const forced = entry?.mode === MODULE_RELEASE_MODE.FORCED;

  return (
    <div
      className={[
        'rounded-2xl border p-4 transition-colors',
        released ? 'border-acid/50 bg-acid/[0.04]' : 'border-gray-100 bg-paper',
        !releasable && 'opacity-70',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-start gap-3">
        <ModuleIcon module={mod} size={isFamily ? 'md' : 'sm'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={isFamily ? 'font-display text-base font-bold text-ink' : 'text-sm font-bold text-ink'}>
              {mod.label}
            </span>
            <StatusBadge status={mod.status} />
            {released && forced && <V2Badge tone="blue">Obrigatório</V2Badge>}
            {typeof adoption === 'number' && adoption > 0 && (
              <V2Badge tone="neutral" title="Arenas que ativaram este módulo">
                <Building2 className="h-3 w-3" /> {adoption}
              </V2Badge>
            )}
            <code className="rounded bg-paper-pure px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
              {mod.id}
            </code>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{mod.summary || mod.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {mod.audience.map((who) => (
              <span
                key={who}
                className="rounded-full bg-paper-pure px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500"
              >
                {who}
              </span>
            ))}
          </div>

          {mod.status === ARENA_MODULE_STATUS.EXTERNAL && mod.externalNote && (
            <p className="mt-2 flex gap-1.5 rounded-xl bg-purple-50 p-2 text-[11px] leading-4 text-purple-800">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{mod.externalNote}</span>
            </p>
          )}
          {!releasable && (
            <p className="mt-2 flex gap-1.5 text-[11px] leading-4 text-gray-400">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{ARENA_MODULE_STATUS_META[mod.status]?.hint}</span>
            </p>
          )}

          {released && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Como a arena recebe
              </span>
              {[
                { id: MODULE_RELEASE_MODE.OPT_IN, label: 'A arena escolhe' },
                { id: MODULE_RELEASE_MODE.FORCED, label: 'Ativo para todas' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onMode(mod.id, opt.id)}
                  className={[
                    'rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors',
                    (entry?.mode || MODULE_RELEASE_MODE.OPT_IN) === opt.id
                      ? 'border-ink bg-ink text-paper-pure'
                      : 'border-gray-200 bg-paper-pure text-gray-500 hover:border-ink hover:text-ink',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 pt-1">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          ) : (
            <V2Toggle
              checked={released}
              onChange={(v) => {
                if (!releasable) {
                  toast.error('Este módulo ainda está em construção.');
                  return;
                }
                onRelease(mod.id, v);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- família ---------------------------------- */

function FamilyCard({ node, platformModules, adoption, busyId, onRelease, onMode, onBulk, openByDefault }) {
  const [open, setOpen] = useState(openByDefault);
  const all = [node.family, ...node.children];
  const releasable = all.filter((m) => ARENA_MODULE_STATUS_META[m.status]?.releasable);
  const releasedCount = all.filter((m) => platformModules[m.id]?.released).length;

  return (
    <V2Surface className="p-0 sm:p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-5 text-left sm:p-6"
        aria-expanded={open}
      >
        <ModuleIcon module={node.family} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold text-ink">{node.family.label}</span>
            <V2Badge tone={releasedCount > 0 ? 'green' : 'neutral'}>
              {releasedCount} / {all.length} liberados
            </V2Badge>
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">{node.family.summary}</span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <V2Button
              variant="ghost"
              size="sm"
              disabled={Boolean(busyId) || releasedCount === all.length}
              onClick={() => onBulk(releasable.map((m) => m.id), true)}
            >
              <Check className="h-4 w-4" /> Liberar a família inteira
            </V2Button>
            <V2Button
              variant="ghost"
              size="sm"
              disabled={Boolean(busyId) || releasedCount === 0}
              onClick={() => onBulk(all.map((m) => m.id), false)}
            >
              <X className="h-4 w-4" /> Retirar tudo
            </V2Button>
          </div>
          <div className="space-y-2">
            {all.map((mod) => (
              <ModuleRow
                key={mod.id}
                mod={mod}
                isFamily={mod.id === node.family.id}
                entry={platformModules[mod.id]}
                adoption={adoption?.[mod.id]}
                busy={busyId === mod.id}
                onRelease={onRelease}
                onMode={onMode}
              />
            ))}
          </div>
        </div>
      )}
    </V2Surface>
  );
}

/* --------------------------------- aba ------------------------------------ */

export default function AdminArenaModulesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const masterOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const { data: platformModules = {}, isLoading, isError, refetch } = usePlatformArenaModules();
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState('');
  const [showAdoption, setShowAdoption] = useState(false);
  const adoptionQuery = useModuleAdoption(showAdoption);

  const tree = useMemo(() => arenaModuleTree(), []);
  const term = fold(q).trim();
  const filtered = useMemo(() => {
    if (!term) return tree;
    const hit = (m) => fold(`${m.label} ${m.id} ${m.summary} ${m.description}`).includes(term);
    return tree
      .map((node) => (
        hit(node.family)
          ? node
          : { ...node, children: node.children.filter(hit) }
      ))
      .filter((node) => hit(node.family) || node.children.length > 0);
  }, [tree, term]);

  const totals = useMemo(() => {
    const all = tree.flatMap((n) => [n.family, ...n.children]);
    return {
      total: all.length,
      released: all.filter((m) => platformModules[m.id]?.released).length,
      pending: all.filter((m) => !ARENA_MODULE_STATUS_META[m.status]?.releasable).length,
    };
  }, [tree, platformModules]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: arenaKeys.modulosPlataforma() });
    qc.invalidateQueries({ queryKey: ['arena-module-adoption'] });
  };

  async function handleRelease(moduleId, released) {
    setBusyId(moduleId);
    try {
      await setArenaModuleRelease(
        moduleId,
        { released, mode: platformModules[moduleId]?.mode },
        user,
      );
      invalidate();
      toast.success(released ? 'Módulo liberado às arenas.' : 'Módulo retirado das arenas.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar a liberação.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMode(moduleId, mode) {
    setBusyId(moduleId);
    try {
      await setArenaModuleRelease(moduleId, { released: true, mode }, user);
      invalidate();
      toast.success(
        mode === MODULE_RELEASE_MODE.FORCED
          ? 'Passa a valer para TODAS as arenas, sem escolha.'
          : 'Cada arena escolhe se ativa.',
      );
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar o modo.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulk(ids, released) {
    setBusyId('__bulk__');
    try {
      await setArenaModuleReleases(
        ids.map((moduleId) => ({
          moduleId,
          released,
          mode: platformModules[moduleId]?.mode,
        })),
        user,
      );
      invalidate();
      toast.success(released ? 'Família liberada.' : 'Família retirada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar a família.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-acid/15 text-ink">
              <Puzzle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Módulos de arena</h2>
              <p className="max-w-2xl text-xs leading-5 text-gray-500">
                Aqui você <strong>libera</strong> o que as arenas podem escolher. Liberar não liga
                para ninguém: cada arena decide, em Configurações → Módulos, o que ativa para si e
                para os atletas dela. Um módulo em construção não pode ser liberado.
              </p>
            </div>
          </div>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar módulo…"
              className="h-10 w-60 rounded-2xl border border-gray-200 bg-paper-pure pl-10 pr-4 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <V2Badge tone={totals.released > 0 ? 'green' : 'neutral'}>
            {totals.released} liberados de {totals.total}
          </V2Badge>
          {totals.pending > 0 && (
            <V2Badge tone="neutral">{totals.pending} em construção</V2Badge>
          )}
          <V2Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdoption((v) => !v)}
            className="ml-auto"
          >
            <Layers className="h-4 w-4" />
            {showAdoption ? 'Ocultar adoção' : 'Ver adoção pelas arenas'}
          </V2Button>
        </div>

        {showAdoption && adoptionQuery.isLoading && (
          <p className="mt-2 text-xs text-gray-400">Contando as arenas…</p>
        )}
        {showAdoption && adoptionQuery.isError && (
          <p className="mt-2 text-xs text-red-600">
            Não foi possível contar a adoção.{' '}
            <button type="button" className="underline" onClick={() => adoptionQuery.refetch()}>
              Tentar de novo
            </button>
          </p>
        )}
      </V2Surface>

      {!masterOn && (
        <V2Surface className="border-amber-200 bg-amber-50">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">A chave geral está desligada</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Você pode preparar as liberações aqui, mas enquanto a flag{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">arena_modules</code>{' '}
                estiver desligada em <strong>Flags por assunto</strong>, nenhuma arena vê nem usa
                módulo nenhum.
              </p>
            </div>
          </div>
        </V2Surface>
      )}

      {isError && (
        <V2Surface className="border-red-100">
          <p className="text-sm text-red-700">
            Não foi possível carregar as liberações.{' '}
            <button type="button" className="font-bold underline" onClick={() => refetch()}>
              Tentar de novo
            </button>
          </p>
        </V2Surface>
      )}

      {isLoading ? (
        <V2Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <V2Surface>
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhum módulo encontrado para “{q}”.
          </p>
        </V2Surface>
      ) : (
        filtered.map((node) => (
          <FamilyCard
            key={node.family.id}
            node={node}
            platformModules={platformModules}
            adoption={adoptionQuery.data}
            busyId={busyId}
            onRelease={handleRelease}
            onMode={handleMode}
            onBulk={handleBulk}
            openByDefault={Boolean(term)}
          />
        ))
      )}
    </div>
  );
}
