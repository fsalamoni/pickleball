/**
 * V2CourtsTab — gerenciamento de quadras em uma arena.
 *
 * Sprint 1 (ARE-01) do roadmap arena. Substitui o simples `court_count`
 * por uma lista real de quadras nomeadas, cada uma com tipo, superfície,
 * status ativo e ordem configurável.
 *
 * Features:
 * - Lista quadras existentes com drag-free reorder (botões ↑/↓)
 * - Adicionar nova quadra (form modal-like inline)
 * - Editar quadra existente (inline)
 * - Ativar/desativar (soft delete: `is_active: false`)
 * - Excluir permanentemente (com ConfirmDialog)
 * - Renumeração automática de sort_order (max+1 ao criar)
 * - Botão "Reordenar" para normalizar depois de muitas edições
 *
 * Por que drag-and-drop NÃO: react-dnd adiciona 20KB e a arena tem
 * tipicamente 2-6 quadras — botões são mais acessíveis e mais leves.
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { normalizeCourtInput, COURT, nextSortOrder, sortCourts } from '@/modules/arenas/domain/court';
import {
  useArenaCourts, useCreateCourt, useUpdateCourt, useDeleteCourt, useReorderCourts, useNormalizeCourtOrder,
} from '@/modules/arenas/hooks/useArenas';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea } from '@/v2/ui/primitives';

const COURT_TYPE_OPTIONS = Object.entries(COURT.TYPE_LABELS).map(([value, label]) => ({ value, label }));
const SURFACE_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  ...Object.entries(COURT.SURFACE_LABELS).map(([value, label]) => ({ value, label })),
];

function CourtForm({ initial = {}, onCancel, onSubmit, busy }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    court_type: initial.court_type || 'outdoor',
    surface_type: initial.surface_type || '',
    is_active: initial.is_active !== false,
    notes: initial.notes || '',
    sort_order: initial.sort_order ?? '',
  });
  const [errors, setErrors] = useState({});
  const setField = (key) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((p) => ({ ...p, [key]: v }));
  };
  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const { valid, errors: errs, value } = normalizeCourtInput({
      ...form,
      sort_order: form.sort_order === '' ? undefined : Number(form.sort_order),
    });
    if (!valid) { setErrors(errs); return; }
    onSubmit(value);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <V2Field label="Nome da quadra" required error={errors.name}>
          <V2Input value={form.name} onChange={setField('name')} placeholder="Ex.: Quadra 1, Coberta A" maxLength={60} />
        </V2Field>
        <V2Field label="Tipo" error={errors.court_type}>
          <V2Select value={form.court_type} onChange={setField('court_type')} options={COURT_TYPE_OPTIONS} />
        </V2Field>
        <V2Field label="Superfície" error={errors.surface_type}>
          <V2Select value={form.surface_type} onChange={setField('surface_type')} options={SURFACE_TYPE_OPTIONS} />
        </V2Field>
        <V2Field label="Ordem" hint="Menor aparece primeiro. Deixe vazio para automático.">
          <V2Input
            type="number"
            min="0"
            max="9999"
            value={form.sort_order}
            onChange={setField('sort_order')}
            placeholder="Auto"
          />
        </V2Field>
      </div>
      <V2Field label="Observações" hint="Opcional, até 500 chars.">
        <V2Textarea value={form.notes} onChange={setField('notes')} maxLength={500} rows={2} />
      </V2Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setField('is_active')(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-ink focus:ring-ink"
        />
        Quadra ativa (visível para reservas)
      </label>
      {Object.keys(errors).length > 0 && (
        <p className="text-xs text-red-600">{Object.values(errors)[0]}</p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <V2Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</V2Button>
        <V2Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : (initial.id ? 'Salvar alterações' : 'Adicionar quadra')}
        </V2Button>
      </div>
    </form>
  );
}

export default function V2CourtsTab({ arena }) {
  const { data: courts = [], isLoading } = useArenaCourts(arena.id);
  const createCourt = useCreateCourt(arena.id);
  const updateCourt = useUpdateCourt(arena.id);
  const deleteCourt = useDeleteCourt(arena.id);
  const reorder = useReorderCourts(arena.id);
  const normalize = useNormalizeCourtOrder(arena.id);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // court sendo editado
  const [deleting, setDeleting] = useState(null);

  const active = courts.filter((c) => c.is_active !== false).length;
  const inactive = courts.length - active;

  async function handleAdd(value) {
    try {
      await createCourt.mutateAsync({ ...value, arena_id: arena.id });
      toast.success(`Quadra "${value.name}" adicionada.`);
      setAdding(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível adicionar a quadra.');
    }
  }

  async function handleEdit(value) {
    if (!editing) return;
    try {
      await updateCourt.mutateAsync({ courtId: editing.id, input: { ...value, arena_id: arena.id } });
      toast.success('Quadra atualizada.');
      setEditing(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar a quadra.');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteCourt.mutateAsync(deleting.id);
      toast.success(`Quadra "${deleting.name}" removida.`);
      setDeleting(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível remover a quadra.');
    }
  }

  async function move(court, dir) {
    const sorted = sortCourts(courts);
    const idx = sorted.findIndex((c) => c.id === court.id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[target]] = [next[target], next[idx]];
    try {
      await reorder.mutateAsync(next.map((c) => c.id));
    } catch (err) {
      toast.error(err?.message || 'Não foi possível reordenar.');
    }
  }

  async function handleNormalize() {
    try {
      await normalize.mutateAsync();
      toast.success('Ordem das quadras normalizada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível normalizar.');
    }
  }

  return (
    <V2Surface className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold text-ink">Quadras</h3>
            <V2Badge tone="neutral">{active} ativa{active === 1 ? '' : 's'}</V2Badge>
            {inactive > 0 && <V2Badge tone="warning">{inactive} inativa{inactive === 1 ? '' : 's'}</V2Badge>}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Cadastre cada quadra individualmente. Atletas veem só as ativas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {courts.length > 1 && (
            <V2Button variant="ghost" size="sm" onClick={handleNormalize} disabled={normalize.isPending}>
              Reordenar
            </V2Button>
          )}
          {!adding && (
            <V2Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nova quadra
            </V2Button>
          )}
        </div>
      </div>

      {adding && (
        <CourtForm
          initial={{ sort_order: nextSortOrder(courts) }}
          onCancel={() => setAdding(false)}
          onSubmit={handleAdd}
          busy={createCourt.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando quadras…</p>
      ) : courts.length === 0 && !adding ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-paper p-6 text-center">
          <p className="text-sm text-gray-500">
            Nenhuma quadra cadastrada ainda. Comece adicionando a primeira.
          </p>
          <V2Button size="sm" onClick={() => setAdding(true)} className="mt-3">
            <Plus className="mr-1 h-4 w-4" /> Adicionar quadra
          </V2Button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-paper">
          {courts.map((c, idx) => {
            const inactive = c.is_active === false;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(c, -1)}
                    disabled={idx === 0 || reorder.isPending}
                    className="flex h-5 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-ink disabled:opacity-30"
                    aria-label="Mover para cima"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(c, 1)}
                    disabled={idx === courts.length - 1 || reorder.isPending}
                    className="flex h-5 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-ink disabled:opacity-30"
                    aria-label="Mover para baixo"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('truncate font-semibold text-ink', inactive && 'text-gray-400 line-through')}>
                      {c.name}
                    </span>
                    {inactive && <V2Badge tone="neutral">Inativa</V2Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    <span>{COURT.TYPE_LABELS[c.court_type] || c.court_type}</span>
                    {c.surface_type && <span>· {COURT.SURFACE_LABELS[c.surface_type]}</span>}
                    <span>· ordem {c.sort_order ?? 0}</span>
                    {c.notes && <span className="truncate italic">· {c.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-ink"
                    aria-label="Editar quadra"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <ConfirmDialog
                    title={`Excluir "${c.name}"?`}
                    description="A quadra será removida permanentemente. Reservas existentes manterão referência histórica."
                    confirmLabel="Excluir"
                    onConfirm={handleDelete}
                    trigger={
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                        aria-label="Excluir quadra"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-3xl bg-paper-pure p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-display text-lg font-bold text-ink">Editar quadra</h3>
            <CourtForm
              initial={editing}
              onCancel={() => setEditing(null)}
              onSubmit={handleEdit}
              busy={updateCourt.isPending}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Excluir "${deleting.name}"?` : ''}
        description="A quadra será removida permanentemente. Reservas existentes manterão referência histórica."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        loading={deleteCourt.isPending}
      />
    </V2Surface>
  );
}
