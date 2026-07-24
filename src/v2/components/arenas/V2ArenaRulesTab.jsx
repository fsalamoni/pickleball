/**
 * V2ArenaRulesTab — Aba admin de regras estruturadas (Sprint 5).
 *
 * Lista editável de regras com:
 *  - Título
 *  - Descrição
 *  - Categoria (Geral, Cancelamento, Pagamento, Conduta, Equipamento, Segurança, Outro)
 *  - Reordenação (↑/↓)
 *  - Adicionar / remover regra
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Save, Plus, Trash2, ChevronUp, ChevronDown, ListChecks, Lightbulb } from 'lucide-react';
import { useArena, useUpdateArena } from '@/modules/arenas/hooks/useArenas';
import {
  normalizeArenaRules, ARENA_RULE_CATEGORIES,
} from '@/modules/arenas/domain/arena_rules';
import {
  V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2Skeleton, V2Toggle,
} from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { DEFAULT_CANCELLATION_HOURS } from '@/modules/arenas/domain/cancellation_policy';

function newBlankRule() {
  return { id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title: '', description: '', category: ARENA_RULE_CATEGORIES.GENERAL, order: 0 };
}

export default function V2ArenaRulesTab() {
  const { arenaId } = useParams();
  const { data: arena, isLoading } = useArena(arenaId);
  const update = useUpdateArena();
  const [rules, setRules] = useState(() => arena?.rules || []);
  const [saving, setSaving] = useState(false);

  // Sync rules quando arena carrega
  React.useEffect(() => {
    if (arena?.rules) setRules(arena.rules);
  }, [arena?.id]);

  function addRule() {
    setRules((prev) => [...prev, { ...newBlankRule(), order: prev.length }]);
  }

  function updateRule(idx, patch) {
    setRules((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  function removeRule(idx) {
    setRules((prev) => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order: i })));
  }

  function moveRule(idx, dir) {
    setRules((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((r, i) => ({ ...r, order: i }));
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const normalized = normalizeArenaRules(rules);
      if (normalized.length === 0) {
        toast.error('Adicione ao menos uma regra válida.');
        setSaving(false);
        return;
      }
      await update.mutateAsync({ id: arenaId, updates: { rules: normalized } });
      toast.success(`${normalized.length} regra(s) salvas.`);
      setRules(normalized);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <V2Skeleton lines={4} />;
  if (!arena) return null;

  return (
    <div className="space-y-4">
      <CancellationPolicyCard arena={arena} arenaId={arenaId} update={update} />
      <V2Surface>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-green-700" /> Regras da arena
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Adicione regras uma a uma. Os atletas verão na página pública da arena.
            </p>
          </div>
          <div className="flex gap-2">
            <V2Button size="sm" variant="secondary" onClick={addRule}>
              <Plus className="h-4 w-4" /> Adicionar regra
            </V2Button>
            <V2Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar todas'}
            </V2Button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {rules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-paper p-6 text-center">
              <p className="text-sm text-gray-500">Nenhuma regra cadastrada ainda.</p>
              <V2Button size="sm" variant="secondary" onClick={addRule} className="mt-2">
                <Plus className="h-4 w-4" /> Adicionar primeira regra
              </V2Button>
            </div>
          ) : (
            rules.map((r, idx) => (
              <div key={r.id} className="rounded-2xl border border-gray-200 bg-paper p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button
                      onClick={() => moveRule(idx, -1)}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-ink disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-bold text-gray-400">{idx + 1}</span>
                    <button
                      onClick={() => moveRule(idx, 1)}
                      disabled={idx === rules.length - 1}
                      className="text-gray-400 hover:text-ink disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <V2Field label="Título">
                          <V2Input
                            value={r.title}
                            onChange={(e) => updateRule(idx, { title: e.target.value })}
                            maxLength={80}
                            placeholder="Ex: Não fumar nas quadras"
                          />
                        </V2Field>
                      </div>
                      <V2Field label="Categoria">
                        <V2Select value={r.category} onChange={(e) => updateRule(idx, { category: e.target.value })}>
                          {Object.entries(ARENA_RULE_CATEGORIES).map(([k, v]) => (
                            <option key={k} value={v}>{v}</option>
                          ))}
                        </V2Select>
                      </V2Field>
                    </div>
                    <V2Field label="Descrição">
                      <V2Textarea
                        value={r.description}
                        onChange={(e) => updateRule(idx, { description: e.target.value })}
                        rows={2}
                        maxLength={500}
                        placeholder="Detalhe: contexto, sanção, etc."
                      />
                    </V2Field>
                  </div>
                  <button
                    onClick={() => removeRule(idx)}
                    className="mt-1 text-red-500 hover:text-red-700"
                    aria-label="Remover regra"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </V2Surface>

      <V2Surface className="border-amber-200 bg-amber-50/40">
        <h4 className="flex items-center gap-1.5 text-sm font-bold text-amber-800"><Lightbulb className="h-4 w-4" /> Dica</h4>
        <p className="mt-1 text-sm text-amber-900">
          Use categorias para agrupar (ex: Pagamento → &quot;PIX antecipado&quot;, &quot;Sem devolução em 24h&quot;).
          Regras curtas e diretas funcionam melhor.
        </p>
      </V2Surface>
    </div>
  );
}

/**
 * Card da política de cancelamento (flag cancellation_policy). Sem taxa —
 * apenas prazo de antecedência e observação, que geram um aviso ao cancelar
 * fora do prazo. Desligada a flag, o card não aparece.
 */
function CancellationPolicyCard({ arena, arenaId, update }) {
  const on = useFeatureFlag(FEATURE_FLAG.CANCELLATION_POLICY);
  const [form, setForm] = useState({
    enabled: arena.cancellation_policy_enabled === true,
    hours: Number.isFinite(Number(arena.cancellation_deadline_hours)) ? Number(arena.cancellation_deadline_hours) : DEFAULT_CANCELLATION_HOURS,
    notes: arena.cancellation_notes || '',
  });
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    setForm({
      enabled: arena.cancellation_policy_enabled === true,
      hours: Number.isFinite(Number(arena.cancellation_deadline_hours)) ? Number(arena.cancellation_deadline_hours) : DEFAULT_CANCELLATION_HOURS,
      notes: arena.cancellation_notes || '',
    });
  }, [arena?.id]);

  if (!on) return null;

  async function save() {
    setSaving(true);
    try {
      await update.mutateAsync({
        id: arenaId,
        updates: {
          cancellation_policy_enabled: form.enabled,
          cancellation_deadline_hours: Math.max(0, Math.trunc(Number(form.hours) || 0)),
          cancellation_notes: form.notes,
        },
      });
      toast.success('Política de cancelamento salva.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <V2Surface>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">Política de cancelamento</h3>
          <p className="mt-1 text-sm text-gray-500">
            Defina a antecedência esperada para cancelar. Cancelamentos fora do prazo recebem um aviso. Sem cobrança de taxa.
          </p>
        </div>
        <V2Toggle checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
      </div>
      {form.enabled && (
        <div className="mt-4 space-y-3">
          <V2Field label="Prazo mínimo para cancelar (horas antes do início)">
            <V2Input
              type="number" min="0" max="336"
              value={form.hours}
              onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
            />
          </V2Field>
          <V2Field label="Observação (opcional)">
            <V2Textarea
              value={form.notes}
              maxLength={500}
              rows={2}
              placeholder="Ex.: Cancelamentos tardios podem impactar reservas futuras."
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </V2Field>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <V2Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar política'}
        </V2Button>
      </div>
    </V2Surface>
  );
}
