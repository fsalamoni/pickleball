/**
 * V2CourtSchedulesModal — gerencia janelas de horário recorrentes
 * de uma quadra.
 *
 * Sprint 1 (ARE-04) do roadmap arena. Modal aberto pelo V2CourtsTab
 * ao clicar no ícone de relógio ao lado de cada quadra.
 *
 * Features:
 * - Lista de janelas agrupadas por dia da semana (grade semanal)
 * - Adicionar nova janela (form com weekdays multi-select chips)
 * - Editar janela existente
 * - Ativar/desativar (soft delete)
 * - Excluir permanentemente
 * - "Limpar tudo" (bulk delete com ConfirmDialog)
 *
 * Por que modal (não sub-tab): quadras são a entidade primária;
 * horários são secundários. Manter como modal evita proliferar tabs
 * e mantém o foco na lista de quadras.
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Clock, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  normalizeScheduleInput, SCHEDULE, formatTimeRange, summarizeSchedules,
  WEEKDAY_SHORT_PT,
} from '@/modules/arenas/domain/court_schedule';
import {
  useCourtSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule,
} from '@/modules/arenas/hooks/useArenas';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Badge, V2Button, V2Field, V2Input, V2Surface } from '@/v2/ui/primitives';

const WEEKDAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: d, label: WEEKDAY_SHORT_PT[d] }));

function ScheduleForm({ initial, onCancel, onSubmit, busy }) {
  const [form, setForm] = useState({
    weekdays: initial.weekdays || [],
    start_time: initial.start_time || '08:00',
    end_time: initial.end_time || '22:00',
    label: initial.label || '',
    is_active: initial.is_active !== false,
  });
  const [errors, setErrors] = useState({});

  const setField = (key) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((p) => ({ ...p, [key]: v }));
  };
  const toggleWeekday = (d) => {
    setForm((p) => {
      const has = p.weekdays.includes(d);
      const next = has ? p.weekdays.filter((x) => x !== d) : [...p.weekdays, d];
      return { ...p, weekdays: next.sort((a, b) => a - b) };
    });
  };
  const setAllWeekdays = () => setForm((p) => ({ ...p, weekdays: [0, 1, 2, 3, 4, 5, 6] }));
  const clearWeekdays = () => setForm((p) => ({ ...p, weekdays: [] }));
  const setWeekdays = (preset) => setForm((p) => ({ ...p, weekdays: [...preset] }));

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const { valid, errors: errs, value } = normalizeScheduleInput(form);
    if (!valid) { setErrors(errs); return; }
    onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <V2Field label="Dias da semana" required error={errors.weekdays}>
        <div className="flex flex-wrap items-center gap-1.5">
          {WEEKDAY_OPTIONS.map((d) => {
            const active = form.weekdays.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleWeekday(d.value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? 'border-ink bg-ink text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
                aria-pressed={active}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={() => setWeekdays([1, 2, 3, 4, 5])} className="text-gray-500 underline hover:text-ink">Seg–Sex</button>
          <button type="button" onClick={() => setWeekdays([0, 6])} className="text-gray-500 underline hover:text-ink">Fim de semana</button>
          <button type="button" onClick={setAllWeekdays} className="text-gray-500 underline hover:text-ink">Todos</button>
          <button type="button" onClick={clearWeekdays} className="text-gray-500 underline hover:text-ink">Limpar</button>
        </div>
      </V2Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <V2Field label="Início" required error={errors.start_time}>
          <V2Input type="time" value={form.start_time} onChange={setField('start_time')} />
        </V2Field>
        <V2Field label="Fim" required error={errors.end_time}>
          <V2Input type="time" value={form.end_time} onChange={setField('end_time')} />
        </V2Field>
        <V2Field label="Rótulo" hint="Opcional, ex: 'Comercial'">
          <V2Input value={form.label} onChange={setField('label')} maxLength={60} placeholder="Comercial, Nobre, …" />
        </V2Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setField('is_active')(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-ink focus:ring-ink"
        />
        Janela ativa
      </label>
      {Object.keys(errors).length > 0 && (
        <p className="text-xs text-red-600">{Object.values(errors)[0]}</p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <V2Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</V2Button>
        <V2Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : (initial.id ? 'Salvar' : 'Adicionar janela')}
        </V2Button>
      </div>
    </form>
  );
}

export default function V2CourtSchedulesModal({ arenaId, court, open, onClose }) {
  const { data, isLoading } = useCourtSchedules(open ? court?.id : null);
  const createSchedule = useCreateSchedule(arenaId, court?.id);
  const updateSchedule = useUpdateSchedule(court?.id);
  const deleteSchedule = useDeleteSchedule(court?.id);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  if (!open || !court) return null;

  const list = data?.list || [];
  const byWeekday = data?.byWeekday || {};
  const active = list.filter((s) => s.is_active !== false).length;

  async function handleAdd(value) {
    try {
      await createSchedule.mutateAsync(value);
      toast.success('Janela adicionada.');
      setAdding(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível adicionar a janela.');
    }
  }

  async function handleEdit(value) {
    if (!editing) return;
    try {
      await updateSchedule.mutateAsync({
        scheduleId: editing.id,
        input: { ...value, arena_id: arenaId, court_id: court.id },
      });
      toast.success('Janela atualizada.');
      setEditing(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar a janela.');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteSchedule.mutateAsync(deleting.id);
      toast.success('Janela removida.');
      setDeleting(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível remover a janela.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-paper-pure p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <h3 className="font-display text-lg font-bold text-ink">Horários — {court.name}</h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Janelas recorrentes em que esta quadra está disponível para reservas. Atletas veem o resumo em cards.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando janelas…</p>
        ) : list.length === 0 && !adding ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-paper p-6 text-center">
            <p className="text-sm text-gray-500">
              Nenhuma janela cadastrada. Adicione a primeira abaixo.
            </p>
            <V2Button size="sm" onClick={() => setAdding(true)} className="mt-3">
              <Plus className="mr-1 h-4 w-4" /> Adicionar janela
            </V2Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {Object.values(WEEKDAY_SHORT_PT).map((d) => (
                <div key={d} className="rounded bg-gray-50 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((w) => (
                <div key={w} className="min-h-[80px] space-y-1 rounded-2xl border border-gray-100 bg-paper p-1.5 text-[10px]">
                  {(byWeekday[w] || []).map((s) => (
                    <div
                      key={s.id}
                      className={`cursor-pointer truncate rounded px-1.5 py-1 text-center font-bold ${
                        s.is_active === false
                          ? 'bg-gray-100 text-gray-400 line-through'
                          : 'bg-ink text-acid'
                      }`}
                      title={`${s.label || ''} ${formatTimeRange(s.start_time, s.end_time)}`}
                      onClick={() => setEditing(s)}
                    >
                      {s.start_time}–{s.end_time}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-ink">
                  Janelas <V2Badge tone="neutral">{active} ativas</V2Badge>
                </div>
                {!adding && (
                  <V2Button size="sm" onClick={() => setAdding(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Nova janela
                  </V2Button>
                )}
              </div>

              {adding && (
                <ScheduleForm
                  onCancel={() => setAdding(false)}
                  onSubmit={handleAdd}
                  busy={createSchedule.isPending}
                />
              )}

              {list.length > 0 && (
                <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-paper">
                  {list.map((s) => {
                    const inactive = s.is_active === false;
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className={cn('font-semibold text-ink', inactive && 'text-gray-400 line-through')}>
                            {summarizeSchedules([s]) || '—'}
                          </div>
                          {s.label && <div className="text-xs text-gray-500">Rótulo: {s.label}</div>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(s)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-ink"
                            aria-label="Editar janela"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(s)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                            aria-label="Excluir janela"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
          onClick={() => setEditing(null)}
        >
          <div className="w-full max-w-xl rounded-3xl bg-paper-pure p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-display text-lg font-bold text-ink">Editar janela</h3>
            <ScheduleForm
              initial={editing}
              onCancel={() => setEditing(null)}
              onSubmit={handleEdit}
              busy={updateSchedule.isPending}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? 'Excluir janela?' : ''}
        description="A janela de horário será removida permanentemente. Reservas existentes permanecem."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        loading={deleteSchedule.isPending}
      />
    </div>
  );
}

// cn utilitário (re-export para não criar arquivo extra)
function cn(...args) {
  return args.filter(Boolean).join(' ');
}
