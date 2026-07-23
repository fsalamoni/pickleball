/**
 * V2ArenaOperations — Checklists + manutenção da arena.
 * Rota: /arenas/:arenaId/gerir/operacoes (admin)
 */

import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ClipboardCheck, Wrench, Plus, Check, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useCanArenaUseModule, useArenaChecklists, useCreateChecklist, useToggleChecklistItem,
  useArenaMaintenance, useCreateMaintenance, useUpdateMaintenanceStatus,
} from '@/modules/arenas/hooks/useArenaV3';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';

const PRIORITY_TONE = { low: 'neutral', medium: 'blue', high: 'amber', urgent: 'red' };
const STATUS_TONE = { pending: 'amber', in_progress: 'blue', done: 'green', cancelled: 'neutral' };
const STATUS_LABEL = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído', cancelled: 'Cancelado' };

function CreateMaintenanceForm({ arenaId, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });
  const create = useCreateMaintenance();
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ arenaId, input: { ...form, due_date: form.due_date || null } });
      toast.success('Ordem criada!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Nova ordem de manutenção</h3>
      <V2Field label="Título">
        <V2Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
      </V2Field>
      <V2Field label="Descrição">
        <V2Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={1000} />
      </V2Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Prioridade">
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </V2Field>
        <V2Field label="Prazo">
          <V2Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </V2Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={create.isPending}>Criar</V2Button>
      </div>
    </form>
  );
}

export default function V2ArenaOperations() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const canChecklist = useCanArenaUseModule(arenaId, 'operations_checklist');
  const canMaintenance = useCanArenaUseModule(arenaId, 'operations_maintenance');
  const { data: checklists = [] } = useArenaChecklists(arenaId, { onlyActive: false });
  const { data: maintenance = [] } = useArenaMaintenance(arenaId);
  const toggle = useToggleChecklistItem();
  const updateMaint = useUpdateMaintenanceStatus();
  const [showForm, setShowForm] = useState(false);

  if (arenaLoading) return <V2Skeleton className="mx-auto h-96 max-w-[1100px] rounded-4xl" />;
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState title="Arena não encontrada" action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar</Link>} />
        </V2Surface>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canManage) return <Navigate to={`/arenas/${arena.id}`} replace />;

  if (!canChecklist && !canMaintenance) {
    return (
      <div className="mx-auto max-w-[700px]">
        <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <V2Surface>
          <V2EmptyState icon={Wrench} title="Operações indisponíveis" description="Módulo não habilitado." />
        </V2Surface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Operações · {arena.name}
        </h1>
      </div>

      {/* Manutenção */}
      {canMaintenance && (
        <V2Surface className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">Manutenção</h2>
            {!showForm && (
              <V2Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova ordem
              </V2Button>
            )}
          </div>
          {showForm && (
            <div className="mb-4">
              <CreateMaintenanceForm arenaId={arena.id} onClose={() => setShowForm(false)} />
            </div>
          )}
          {maintenance.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma ordem de manutenção.</p>
          ) : (
            <div className="space-y-2">
              {maintenance.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                  <div>
                    <p className="font-bold text-ink">{m.title}</p>
                    <p className="text-xs text-gray-500">{m.due_date || 'Sem prazo'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <V2Badge tone={PRIORITY_TONE[m.priority] || 'neutral'}>{m.priority}</V2Badge>
                    <V2Badge tone={STATUS_TONE[m.status] || 'neutral'}>{STATUS_LABEL[m.status] || m.status}</V2Badge>
                    {m.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => updateMaint.mutate({ orderId: m.id, status: 'done' })}
                        className="rounded-full p-1.5 text-emerald-500 hover:bg-emerald-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </V2Surface>
      )}

      {/* Checklists */}
      {canChecklist && (
        <V2Surface>
          <h2 className="mb-3 font-display text-lg font-bold text-ink">Checklists</h2>
          {checklists.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum checklist cadastrado.</p>
          ) : (
            <div className="space-y-4">
              {checklists.map((cl) => (
                <div key={cl.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-ink">{cl.title}</h3>
                    <V2Badge tone="blue">{cl.completed_pct || 0}%</V2Badge>
                  </div>
                  <ul className="space-y-1">
                    {(cl.items || []).map((item, idx) => (
                      <li key={idx}>
                        <button
                          type="button"
                          onClick={() => toggle.mutate({ checklistId: cl.id, itemIdx: idx })}
                          className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-gray-50"
                        >
                          {item.completed ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <X className="h-4 w-4 text-gray-300" />
                          )}
                          <span className={item.completed ? 'text-sm text-gray-400 line-through' : 'text-sm text-ink'}>
                            {item.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </V2Surface>
      )}
    </div>
  );
}
