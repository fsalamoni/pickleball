/**
 * V2AdminBootstrap — Boot inicial do Arena V3.
 *
 * Página SEM GATE de feature flag. Apenas platform_admin acessa.
 * Mostra TODAS as 50 flags da Arena V3 + master switch, com botão
 * "ON para todos" para ativar tudo de uma vez.
 *
 * Por que existe: depois do primeiro deploy da Arena V3, TODAS as
 * flags estão OFF no Firestore. Sem ligar o master switch
 * `arena_modules`, o usuário não consegue nem acessar
 * `/arenas/:id/gerir/modulos` para ligar módulos por arena.
 *
 * É uma porta de entrada para o admin master fazer o "first run"
 * sem precisar mexer no Firestore Console manualmente.
 *
 * Acesso: /admin/v3-bootstrap
 * Permissão: isPlatformAdmin (verificado via useAuth)
 */

import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Flag, Loader2, Power, RotateCcw, Zap,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG, FEATURE_FLAG_META } from '@/core/featureFlags';
import { setFeatureFlag, ARENA_V3_FLAG_KEYS } from '@/core/lib/featureFlagWriters';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { logger } from '@/core/lib/logger';

/** Família da flag (extraída do prefixo do key). */
function flagFamily(key) {
  if (key === 'arena_modules') return 'master';
  const m = key.match(/^arena_module_([a-z_]+?)(?:_|$)/);
  if (m) return m[1];
  return 'other';
}

const FAMILY_LABEL = {
  master: 'Master',
  matchmaking: 'Matchmaking',
  members: 'Membros',
  pdv: 'PDV',
  classes: 'Aulas',
  leagues: 'Torneios',
  marketing: 'Marketing',
  operations: 'Operações',
  iot: 'IoT',
  multi_unit: 'Multi-unidade',
  white_label: 'White label',
  ai: 'IA',
  other: 'Outros',
};

const FAMILY_COLOR = {
  master: 'rose',
  matchmaking: 'sky',
  members: 'amber',
  pdv: 'emerald',
  classes: 'violet',
  leagues: 'pink',
  marketing: 'fuchsia',
  operations: 'cyan',
  iot: 'blue',
  multi_unit: 'lime',
  white_label: 'slate',
  ai: 'purple',
};

export default function V2AdminBootstrap() {
  const { user, isPlatformAdmin } = useAuth();
  const { flags, isLoading, refresh } = useFeatureFlags();
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState('');

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  const flagEntries = Object.entries(FEATURE_FLAG_META)
    .filter(([key]) => ARENA_V3_FLAG_KEYS.includes(key))
    .filter(([key]) =>
      !filter ||
      key.toLowerCase().includes(filter.toLowerCase()) ||
      (FEATURE_FLAG_META[key]?.label || '').toLowerCase().includes(filter.toLowerCase())
    )
    .map(([key, meta]) => ({
      key,
      label: meta.label || key,
      description: meta.description || '',
      family: flagFamily(key),
      enabled: Boolean(flags?.[key]),
    }))
    .sort((a, b) => {
      if (a.family === 'master') return -1;
      if (b.family === 'master') return 1;
      return a.key.localeCompare(b.key);
    });

  const families = [...new Set(flagEntries.map((f) => f.family))];
  const enabledCount = flagEntries.filter((f) => f.enabled).length;

  async function handleToggle(key, enabled) {
    setBusy(key);
    try {
      await setFeatureFlag(key, enabled, user);
      logger.info('V3Bootstrap: flag toggled', { key, enabled, by: user?.uid });
      await refresh();
    } catch (err) {
      logger.error('V3Bootstrap: failed to toggle', { key, err: err?.message });
      alert('Não foi possível alterar a flag: ' + (err?.message || 'erro desconhecido'));
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkEnable() {
    if (!confirm(`Ativar TODAS as ${ARENA_V3_FLAG_KEYS.length} flags da Arena V3?`)) return;
    setBusy('__all__');
    try {
      for (const key of ARENA_V3_FLAG_KEYS) {
        try {
          await setFeatureFlag(key, true, user);
        } catch (err) {
          logger.error('V3Bootstrap: bulk enable failed for', { key, err: err?.message });
        }
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkDisable() {
    if (!confirm('Desativar TODAS as flags da Arena V3?')) return;
    setBusy('__all__');
    try {
      for (const key of ARENA_V3_FLAG_KEYS) {
        try {
          await setFeatureFlag(key, false, user);
        } catch (err) {
          logger.error('V3Bootstrap: bulk disable failed for', { key, err: err?.message });
        }
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {/* Header */}
      <div className="rounded-4xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Power className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Boot inicial</span>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Arena V3 — Feature Flags</h1>
            <p className="mt-2 text-sm text-white/90">
              Ative o master switch e os módulos da Arena V3. Esta página é SEM GATE —
              única forma de destravar o sistema no primeiro deploy.
            </p>
          </div>
          <div className="rounded-2xl bg-white/20 px-4 py-3 backdrop-blur">
            <div className="text-xs font-bold uppercase tracking-wider opacity-90">Flags ativas</div>
            <div className="font-display text-3xl font-bold">{enabledCount} / {flagEntries.length}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <V2Surface>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por nome..."
              className="h-10 rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm"
            />
            <V2Button variant="ghost" size="sm" onClick={() => setFilter('')}>
              <RotateCcw className="h-4 w-4" /> Limpar
            </V2Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <V2Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDisable}
              disabled={busy === '__all__' || isLoading}
            >
              {busy === '__all__' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              Desativar todas
            </V2Button>
            <V2Button
              size="sm"
              onClick={handleBulkEnable}
              disabled={busy === '__all__' || isLoading}
            >
              {busy === '__all__' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Ativar todas
            </V2Button>
          </div>
        </div>
      </V2Surface>

      {/* Alerta */}
      {enabledCount === 0 && (
        <V2Surface>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-ink">Nenhuma flag ativa</p>
              <p className="mt-1 text-xs text-gray-500">
                Por padrão, todas as 50 flags nascem desligadas. Isso garante
                zero impacto no app atual. Para usar a Arena V3, ative pelo
                menos o master switch <code className="rounded bg-paper px-1 text-ink">arena_modules</code> +
                os módulos que você quer.
              </p>
            </div>
          </div>
        </V2Surface>
      )}

      {/* Lista por família */}
      {families.map((family) => {
        const items = flagEntries.filter((f) => f.family === family);
        if (items.length === 0) return null;
        const familyEnabled = items.filter((i) => i.enabled).length;
        return (
          <V2Surface key={family}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-ink" />
                <h2 className="font-display text-lg font-bold text-ink">
                  {FAMILY_LABEL[family] || family}
                </h2>
                <V2Badge tone={family === 'master' ? 'red' : 'neutral'}>
                  {familyEnabled} / {items.length}
                </V2Badge>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-paper p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-paper-pure px-1.5 py-0.5 font-mono text-xs text-ink">
                        {f.key}
                      </code>
                      {f.enabled ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{f.label} — {f.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(f.key, !f.enabled)}
                    disabled={busy === f.key || busy === '__all__'}
                    className={[
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                      f.enabled
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300',
                      (busy === f.key || busy === '__all__') && 'opacity-50',
                    ].filter(Boolean).join(' ')}
                    title={f.enabled ? 'Clique para desativar' : 'Clique para ativar'}
                  >
                    {busy === f.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : f.enabled ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </V2Surface>
        );
      })}

      {/* Footer com links úteis */}
      <V2Surface>
        <h3 className="mb-3 font-display text-base font-bold text-ink">Próximos passos</h3>
        <ol className="space-y-2 text-sm text-gray-700">
          <li>
            <strong>1.</strong> Ative o master switch <code className="rounded bg-paper px-1">arena_modules</code> e
            as sub-flags que você quer usar.
          </li>
          <li>
            <strong>2.</strong> Vá em <Link to="/arenas" className="font-bold text-ink underline">/arenas</Link> e
            escolha uma arena. Acesse <code className="rounded bg-paper px-1">/arenas/&#123;id&#125;/gerir/modulos</code>{' '}
            para ativar módulos específicos daquela arena.
          </li>
          <li>
            <strong>3.</strong> Visite as páginas V2: <code className="rounded bg-paper px-1">/arenas/&#123;id&#125;/gerir/open-match</code>,{' '}
            <code className="rounded bg-paper px-1">/arenas/&#123;id&#125;/membros</code>,{' '}
            <code className="rounded bg-paper px-1">/arenas/&#123;id&#125;/pdv</code>, etc.
          </li>
          <li>
            <strong>4.</strong> Se for platform owner, pode também promover outros users a
            <code className="rounded bg-paper px-1">platform_admin</code> editando o doc
            <code className="rounded bg-paper px-1">users/&#123;uid&#125;</code> com o campo{' '}
            <code className="rounded bg-paper px-1">role: "platform_admin"</code>.
          </li>
        </ol>
      </V2Surface>
    </div>
  );
}
