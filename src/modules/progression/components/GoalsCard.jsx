import React, { useState } from 'react';
import { toast } from 'sonner';
import { Target, Plus, Trash2, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/ConfirmDialog';
import { GOAL_METRIC_LABELS, goalProgress } from '../domain/progression.js';
import { useGoals, useCreateGoal, useDeleteGoal } from '../hooks/useProgression.js';

/**
 * Metas pessoais do usuário. Presentational quanto ao gating (a flag
 * `player_progression` é verificada pelo pai).
 *
 * @param {{ uid: string, values: Record<string, number> }} props
 */
export default function GoalsCard({ uid, values }) {
  const { data: goals = [] } = useGoals(uid);
  const create = useCreateGoal();
  const remove = useDeleteGoal();
  const [metric, setMetric] = useState('games');
  const [target, setTarget] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await create.mutateAsync({ metric, target });
      setTarget('');
      toast.success('Meta criada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível criar a meta.');
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Target className="h-4 w-4 text-emerald-600" /> Minhas metas
        </h2>

        <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Métrica</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(GOAL_METRIC_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="w-24">
            <span className="mb-1 block text-xs text-slate-500">Alvo</span>
            <Input type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <Button type="submit" disabled={create.isPending}>
            <Plus className="h-4 w-4" /> <span className="ml-1">Adicionar</span>
          </Button>
        </form>

        {goals.length === 0 ? (
          <p className="text-sm text-slate-500">Você ainda não definiu metas. Crie uma acima.</p>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const p = goalProgress(g, values);
              return (
                <div key={g.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">
                      {GOAL_METRIC_LABELS[g.metric] || g.metric}: {g.target}
                    </span>
                    <div className="flex items-center gap-2">
                      {p.done && <Check className="h-4 w-4 text-emerald-600" />}
                      <span className="text-xs text-slate-500 tabular-nums">{p.current}/{p.target}</span>
                      <ConfirmDialog
                        title="Remover meta?"
                        description="A meta será removida permanentemente."
                        confirmLabel="Remover"
                        onConfirm={() => remove.mutate(g.id)}
                        trigger={(
                          <button type="button" aria-label="Remover meta" className="text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      />
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${p.done ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${Math.round(p.ratio * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
