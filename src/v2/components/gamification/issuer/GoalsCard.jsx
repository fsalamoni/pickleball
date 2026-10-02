import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { V2Badge, V2Button, V2ErrorState, V2Input, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useOwnerGoals } from '@/modules/progression/hooks/useOwnerGoals';
import { GOAL_METRICS, evaluateGoals, normalizeGoals } from '@/modules/progression/domain/supplyHealth';
import { cn } from '@/core/lib/utils';
import TermHint from '@/v2/components/gamification/TermHint';

/**
 * As metas do mês de um professor, uma arena ou um clube. O progresso é medido
 * (não digitado): `actuals` traz o número real de cada medida, e o que ainda não
 * deu para medir aparece como tal — nunca como "0 de 20".
 *
 * @param {{ ownerType: 'coach'|'arena'|'club', ownerId: string, monthKey: string, actuals: Record<string, number|null> }} props
 */
export default function GoalsCard({ ownerType, ownerId, monthKey, actuals }) {
  const g = useOwnerGoals(ownerType, ownerId, monthKey);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState([]);
  const catalogo = GOAL_METRICS[ownerType];
  const avaliadas = useMemo(() => evaluateGoals(ownerType, g.goals, actuals), [ownerType, g.goals, actuals]);

  if (g.isLoading) return <V2Skeleton className="h-40 rounded-4xl" />;
  if (g.isError) return <V2Surface><V2ErrorState inline title="Não deu para carregar as metas" onRetry={g.refetch} /></V2Surface>;

  const abrir = () => { setRascunho(g.goals.length ? g.goals.map((x) => ({ ...x })) : [{ metric: Object.keys(catalogo)[0], target: Object.values(catalogo)[0].suggested }]); setEditando(true); };
  const salvar = async () => {
    const limpas = normalizeGoals(ownerType, rascunho);
    try {
      await g.save.mutateAsync(limpas);
      toast.success('Metas salvas.');
      setEditando(false);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar agora.');
    }
  };
  const usados = new Set(rascunho.map((x) => x.metric));

  return (
    <V2Surface data-testid="goals-card" data-dica="oferta-metas" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Target className="h-5 w-5" aria-hidden="true" /> Metas do mês <TermHint term="metas" /></h2>
        {!editando && <V2Button size="sm" variant="secondary" onClick={abrir}><Pencil className="mr-1 h-3.5 w-3.5" /> {g.goals.length ? 'Editar' : 'Definir metas'}</V2Button>}
      </div>

      {editando ? (
        <div className="space-y-3">
          {rascunho.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_2.5rem] items-center gap-2">
              <V2Select aria-label="Medida" value={x.metric} onChange={(e) => setRascunho((r) => r.map((y, j) => (j === i ? { ...y, metric: e.target.value, target: catalogo[e.target.value].suggested } : y)))}>
                {Object.entries(catalogo).map(([id, m]) => <option key={id} value={id} disabled={usados.has(id) && id !== x.metric}>{m.label}</option>)}
              </V2Select>
              <V2Input aria-label="Meta" type="number" min={1} value={x.target} onChange={(e) => setRascunho((r) => r.map((y, j) => (j === i ? { ...y, target: e.target.value } : y)))} />
              <button type="button" aria-label="Remover meta" onClick={() => setRascunho((r) => r.filter((_, j) => j !== i))} className="rounded-full p-2 text-gray-500 hover:bg-paper"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {rascunho.length < 6 && rascunho.length < Object.keys(catalogo).length && (
              <V2Button variant="ghost" size="sm" onClick={() => { const livre = Object.keys(catalogo).find((m) => !usados.has(m)); setRascunho((r) => [...r, { metric: livre, target: catalogo[livre].suggested }]); }}><Plus className="mr-1 h-4 w-4" /> Meta</V2Button>
            )}
            <V2Button size="sm" disabled={g.save.isPending} onClick={salvar}>Salvar</V2Button>
            <V2Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</V2Button>
          </div>
          <p className="text-[11px] text-gray-400">As metas valem para o mês corrente. O progresso é contado a partir do que a plataforma já registra.</p>
        </div>
      ) : avaliadas.length === 0 ? (
        <p className="text-sm text-gray-600">Sem metas para este mês. Metas pequenas e mensuráveis funcionam melhor que metas grandes demais.</p>
      ) : (
        <ul className="space-y-3">
          {avaliadas.map((m) => (
            <li key={m.metric} data-goal={m.metric}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">{m.label}</span>
                {m.known ? <span className="tabular-nums text-gray-600">{m.value} de {m.target} {m.unit}</span> : <span className="text-xs text-gray-400">ainda não dá para medir</span>}
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <div className={cn('h-full rounded-full', m.done ? 'bg-green-500' : 'bg-amber-400')} style={{ width: `${Math.round(m.progress * 100)}%` }} />
              </div>
              {m.done && <V2Badge tone="green" className="mt-1">Meta batida 🎉</V2Badge>}
              {m.known && !m.done && <p className="mt-0.5 text-[11px] text-gray-400">Faltam {m.remaining} {m.unit}.</p>}
            </li>
          ))}
        </ul>
      )}
    </V2Surface>
  );
}
