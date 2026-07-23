/**
 * V2ArenaAdminOpenMatch — Gestor cria/gerencia slots de Open Match.
 *
 * Rota: /arenas/:arenaId/gerir/open-match
 * Acesso: gestor da arena + platform admin.
 *
 * Lista slots existentes + formulário de criação.
 * Aditivo — não mexe em V2ArenaManage.
 */

import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Calendar, Plus, Trash2, X, Edit, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useArena,
  useMyManagedArenas,
} from '@/modules/arenas/hooks/useArenas';
import {
  useArenaOpenSlots,
  useCreateOpenSlot,
  useUpdateOpenSlot,
  useCancelOpenSlot,
  useDeleteOpenSlot,
  useCanArenaUseModule,
} from '@/modules/arenas/hooks/useArenaV3';
import { getAvailableSpots, getSlotFillPct, computeSlotStatus } from '@/modules/arenas/domain/openMatch';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface, V2Input, V2Field, V2Textarea } from '@/v2/ui/primitives';

function CreateSlotForm({ arenaId, onClose }) {
  const [form, setForm] = useState({
    date: '',
    start: '',
    end: '',
    total_spots: 4,
    format: 'duplas',
    court: '',
    price: '',
    min_level: '',
    max_level: '',
    notes: '',
  });
  const create = useCreateOpenSlot();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        total_spots: Number(form.total_spots) || 4,
      };
      if (payload.price === '') payload.price = null;
      else payload.price = Number(payload.price);

      if (payload.min_level === '') payload.min_level = null;
      else payload.min_level = Number(payload.min_level);

      if (payload.max_level === '') payload.max_level = null;
      else payload.max_level = Number(payload.max_level);

      await create.mutateAsync({ arenaId, input: payload });
      toast.success('Slot criado!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-ink">Novo slot de Open Match</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label="Data">
            <V2Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </V2Field>
          <V2Field label="Início">
            <V2Input
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              required
            />
          </V2Field>
          <V2Field label="Fim">
            <V2Input
              type="time"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              required
            />
          </V2Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label="Vagas">
            <V2Input
              type="number"
              min="2"
              max="20"
              value={form.total_spots}
              onChange={(e) => setForm({ ...form, total_spots: e.target.value })}
              required
            />
          </V2Field>
          <V2Field label="Quadra">
            <V2Input
              type="text"
              value={form.court}
              onChange={(e) => setForm({ ...form, court: e.target.value })}
              placeholder="Ex: Quadra 1"
            />
          </V2Field>
          <V2Field label="Formato">
            <select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
              className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink"
            >
              <option value="duplas">Duplas</option>
              <option value="simples">Simples</option>
              <option value="mistas">Duplas mistas</option>
              <option value="open">Open (livre)</option>
              <option value="treino">Treino</option>
            </select>
          </V2Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label="Preço (R$)">
            <V2Input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Vazio = usar preço da arena"
            />
          </V2Field>
          <V2Field label="Nível mín.">
            <V2Input
              type="number"
              min="0"
              max="7"
              step="0.5"
              value={form.min_level}
              onChange={(e) => setForm({ ...form, min_level: e.target.value })}
              placeholder="Opcional"
            />
          </V2Field>
          <V2Field label="Nível máx.">
            <V2Input
              type="number"
              min="0"
              max="7"
              step="0.5"
              value={form.max_level}
              onChange={(e) => setForm({ ...form, max_level: e.target.value })}
              placeholder="Opcional"
            />
          </V2Field>
        </div>
        <V2Field label="Observações">
          <V2Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Ex: Trazer raquete própria. Estacionamento no local."
            rows={2}
          />
        </V2Field>
        <div className="flex justify-end gap-2 pt-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </V2Button>
          <V2Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Criando...' : 'Criar slot'}
          </V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

function SlotAdminCard({ slot, onCancel, onDelete }) {
  const computed = computeSlotStatus(slot);
  const filled = (slot.participants || []).length;
  const total = slot.total_spots || 0;
  const fillPct = total > 0 ? Math.round((filled / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper-pure p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-display text-base font-bold text-ink">
            {slot.date} · {slot.start}–{slot.end}
          </div>
          {slot.court && (
            <div className="mt-0.5 text-xs text-gray-500">{slot.court}</div>
          )}
        </div>
        <V2Badge
          tone={
            slot.status === 'cancelled' ? 'red' :
            computed === 'full' ? 'amber' :
            computed === 'completed' ? 'neutral' :
            'green'
          }
        >
          {slot.status === 'cancelled' ? 'Cancelado' :
           computed === 'full' ? 'Lotado' :
           computed === 'completed' ? 'Encerrado' :
           `${filled}/${total} inscritos`}
        </V2Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {slot.format && <V2Badge tone="neutral">{slot.format}</V2Badge>}
        {Number.isFinite(slot.price) && slot.price > 0 && (
          <span className="text-amber-700">R$ {slot.price.toFixed(2)}</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {slot.status !== 'cancelled' && (
          <ConfirmDialog
            title="Cancelar este slot?"
            description={`O slot de ${slot.date} ${slot.start} será cancelado e os inscritos serão notificados.`}
            confirmLabel="Cancelar slot"
            onConfirm={() => onCancel(slot)}
            trigger={(
              <button
                type="button"
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
              >
                <X className="mr-1 inline h-3 w-3" /> Cancelar
              </button>
            )}
          />
        )}
        <ConfirmDialog
          title="Excluir slot definitivamente?"
          description={`O slot de ${slot.date} ${slot.start} será removido. Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onConfirm={() => onDelete(slot)}
          trigger={(
            <button
              type="button"
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
            >
              <Trash2 className="mr-1 inline h-3 w-3" /> Excluir
            </button>
          )}
        />
      </div>
    </div>
  );
}

export default function V2ArenaAdminOpenMatch() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const canUseModule = useCanArenaUseModule(arenaId, 'matchmaking_open_match');
  const { data: slots = [], isLoading: slotsLoading } = useArenaOpenSlots(arenaId, { limit: 100 });
  const cancel = useCancelOpenSlot();
  const del = useDeleteOpenSlot();
  const [showForm, setShowForm] = useState(false);

  if (arenaLoading) {
    return <V2Skeleton className="mx-auto h-96 max-w-[1100px] rounded-4xl" />;
  }
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            title="Arena não encontrada"
            action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar ao diretório</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canManage) return <Navigate to={`/arenas/${arena.id}`} replace />;

  const handleCancel = async (slot) => {
    try {
      await cancel.mutateAsync({ slotId: slot.id, reason: 'Cancelado pelo gestor' });
      toast.success('Slot cancelado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (slot) => {
    try {
      await del.mutateAsync(slot.id);
      toast.success('Slot excluído');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link
          to={`/arenas/${arena.id}/gerir`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao hub admin
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              Open Match · {arena.name}
            </h1>
            <p className="mt-2 font-medium text-gray-500">
              Publique vagas abertas para que os atletas se inscrevam.
            </p>
          </div>
          {!showForm && canUseModule && (
            <V2Button onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo slot
            </V2Button>
          )}
        </div>
      </div>

      {!canUseModule && (
        <V2Surface className="mb-6 border-amber-200 bg-amber-50/50">
          <p className="text-sm text-amber-800">
            <strong>Módulo não habilitado.</strong> Você precisa ativar o módulo &quot;Open Match&quot; nos
            <Link to={`/arenas/${arena.id}/gerir/modulos`} className="ml-1 font-bold underline">Módulos da arena</Link>.
          </p>
        </V2Surface>
      )}

      {showForm && (
        <div className="mb-6">
          <CreateSlotForm arenaId={arena.id} onClose={() => setShowForm(false)} />
        </div>
      )}

      {slotsLoading ? (
        <V2Skeleton className="h-48 rounded-4xl" />
      ) : slots.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Calendar}
            title="Nenhum slot ainda"
            description="Clique em 'Novo slot' para começar a receber inscrições."
            action={
              canUseModule && !showForm && (
                <V2Button onClick={() => setShowForm(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Criar primeiro slot
                </V2Button>
              )
            }
          />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {slots.map((slot) => (
            <SlotAdminCard
              key={slot.id}
              slot={slot}
              onCancel={handleCancel}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
