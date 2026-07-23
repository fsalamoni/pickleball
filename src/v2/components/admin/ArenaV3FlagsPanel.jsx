/**
 * ArenaV3FlagsPanel — lista das flags da Arena V3 agrupadas por família, com
 * toggles individuais e ações em massa (ativar/desativar todas). Extraído de
 * V2AdminBootstrap para ser reutilizável (página de boot + aba do painel admin).
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flag, Loader2, Power, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG_META } from '@/core/featureFlags';
import { setFeatureFlag, ARENA_V3_FLAG_KEYS } from '@/core/lib/featureFlagWriters';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { logger } from '@/core/lib/logger';

function flagFamily(key) {
  if (key === 'arena_modules') return 'master';
  const m = key.match(/^arena_module_([a-z_]+?)(?:_|$)/);
  return m ? m[1] : 'other';
}

const FAMILY_LABEL = {
  master: 'Master', matchmaking: 'Matchmaking', members: 'Membros', pdv: 'PDV',
  classes: 'Aulas', leagues: 'Torneios/Ligas', marketing: 'Marketing', operations: 'Operações',
  iot: 'IoT', multi_unit: 'Multi-unidade', white_label: 'White label', ai: 'IA', other: 'Outros',
};

export default function ArenaV3FlagsPanel({ compact = false }) {
  const { user } = useAuth();
  const { flags, isLoading, refresh } = useFeatureFlags();
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState('');

  const flagEntries = ARENA_V3_FLAG_KEYS
    .filter((key) => !filter
      || key.toLowerCase().includes(filter.toLowerCase())
      || (FEATURE_FLAG_META[key]?.label || '').toLowerCase().includes(filter.toLowerCase()))
    .map((key) => ({
      key,
      label: FEATURE_FLAG_META[key]?.label || key,
      description: FEATURE_FLAG_META[key]?.description || '',
      family: flagFamily(key),
      enabled: Boolean(flags?.[key]),
    }))
    .sort((a, b) => {
      if (a.family === 'master') return -1;
      if (b.family === 'master') return 1;
      return a.key.localeCompare(b.key);
    });

  const families = [...new Set(flagEntries.map((f) => f.family))];
  const enabledCount = ARENA_V3_FLAG_KEYS.filter((k) => flags?.[k]).length;

  async function handleToggle(key, enabled) {
    setBusy(key);
    try {
      await setFeatureFlag(key, enabled, user);
      logger.info('ArenaV3FlagsPanel: flag toggled', { key, enabled, by: user?.uid });
      await refresh();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar a flag.');
    } finally {
      setBusy(null);
    }
  }

  async function bulkSet(enabled) {
    setBusy('__all__');
    try {
      for (const key of ARENA_V3_FLAG_KEYS) {
        try { await setFeatureFlag(key, enabled, user); }
        catch (err) { logger.error('ArenaV3FlagsPanel: bulk failed', { key, err: err?.message }); }
      }
      await refresh();
      toast.success(enabled ? 'Todas as flags da Arena V3 ativadas.' : 'Todas as flags da Arena V3 desativadas.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid"><Power className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Arena V3 — Boot</h2>
              <p className="text-xs text-gray-500">Master switch + módulos. {enabledCount} / {ARENA_V3_FLAG_KEYS.length} ativas.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar…"
              className="h-10 rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm"
            />
            <ConfirmDialog
              title="Desativar todas as flags da Arena V3?"
              description="Todos os módulos da Arena V3 serão desligados. Nada é excluído; você pode religar depois."
              confirmLabel="Desativar todas"
              onConfirm={() => bulkSet(false)}
              trigger={<V2Button variant="ghost" size="sm" disabled={busy === '__all__' || isLoading}><Power className="h-4 w-4" /> Desativar todas</V2Button>}
            />
            <ConfirmDialog
              title="Ativar todas as flags da Arena V3?"
              description={`Ativa as ${ARENA_V3_FLAG_KEYS.length} flags da Arena V3 (master + módulos).`}
              confirmLabel="Ativar todas"
              destructive={false}
              onConfirm={() => bulkSet(true)}
              trigger={<V2Button size="sm" disabled={busy === '__all__' || isLoading}>{busy === '__all__' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Ativar todas</V2Button>}
            />
          </div>
        </div>
        {enabledCount === 0 && !compact && (
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <p className="text-xs text-amber-800">
              Nenhuma flag ativa. Ative pelo menos o master switch
              {' '}<code className="rounded bg-white px-1 text-ink">arena_modules</code> para destravar
              <code className="rounded bg-white px-1 text-ink">/arenas/:id/gerir/modulos</code>.
            </p>
          </div>
        )}
      </V2Surface>

      {families.map((family) => {
        const items = flagEntries.filter((f) => f.family === family);
        if (items.length === 0) return null;
        const on = items.filter((i) => i.enabled).length;
        return (
          <V2Surface key={family}>
            <div className="mb-3 flex items-center gap-2">
              <Flag className="h-5 w-5 text-ink" />
              <h3 className="font-display text-base font-bold text-ink">{FAMILY_LABEL[family] || family}</h3>
              <V2Badge tone={family === 'master' ? 'red' : 'neutral'}>{on} / {items.length}</V2Badge>
            </div>
            <div className="space-y-2">
              {items.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-paper p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-paper-pure px-1.5 py-0.5 font-mono text-xs text-ink">{f.key}</code>
                      {f.enabled && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    {!compact && <p className="mt-1 text-xs text-gray-500">{f.label}{f.description ? ` — ${f.description}` : ''}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(f.key, !f.enabled)}
                    disabled={busy === f.key || busy === '__all__'}
                    className={[
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                      f.enabled ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 text-gray-500 hover:bg-gray-300',
                      (busy === f.key || busy === '__all__') && 'opacity-50',
                    ].filter(Boolean).join(' ')}
                    title={f.enabled ? 'Desativar' : 'Ativar'}
                  >
                    {busy === f.key ? <Loader2 className="h-4 w-4 animate-spin" /> : f.enabled ? <CheckCircle2 className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </V2Surface>
        );
      })}
    </div>
  );
}
