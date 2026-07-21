/**
 * V2ArenaAdminMembers — Gestor visualiza membros e gerencia pacotes.
 *
 * Rota: /arenas/:arenaId/gerir/membros
 * Acesso: gestor + platform admin.
 *
 * Aditivo.
 */

import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Trophy, Package } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useCanArenaUseModule, useArenaMembers, useArenaPackages,
  useCreatePackage, useDeletePackage,
} from '@/modules/arenas/hooks/useArenaV3';
import { computeTier, MEMBER_TIER } from '@/modules/arenas/domain/members';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';

function CreatePackageForm({ arenaId, onClose }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    hours: 10,
    price: 250,
    validity_days: 60,
  });
  const create = useCreatePackage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        arenaId,
        input: {
          ...form,
          hours: Number(form.hours),
          price: Number(form.price),
          validity_days: Number(form.validity_days),
        },
      });
      toast.success('Pacote criado!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Novo pacote</h3>
      <V2Field label="Nome">
        <V2Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} placeholder="Ex: Pacote 10h" />
      </V2Field>
      <V2Field label="Descrição">
        <V2Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={500} />
      </V2Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Horas">
          <V2Input type="number" min="1" max="200" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
        </V2Field>
        <V2Field label="Preço (R$)">
          <V2Input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        </V2Field>
        <V2Field label="Validade (dias)">
          <V2Input type="number" min="1" max="365" value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: e.target.value })} required />
        </V2Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Criando...' : 'Criar pacote'}
        </V2Button>
      </div>
    </form>
  );
}

export default function V2ArenaAdminMembers() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const canMembers = useCanArenaUseModule(arenaId, 'members');
  const { data: members = [], isLoading: membersLoading } = useArenaMembers(arenaId);
  const { data: packages = [], isLoading: packagesLoading } = useArenaPackages(arenaId, { onlyActive: false });
  const del = useDeletePackage();
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

  const handleDelete = async (pkg) => {
    if (!window.confirm(`Excluir o pacote "${pkg.name}"?`)) return;
    try {
      await del.mutateAsync({ pkgId: pkg.id });
      toast.success('Pacote excluído');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const tierColors = {
    bronze: 'amber', silver: 'gray', gold: 'yellow', platinum: 'violet',
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao hub admin
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Membros · {arena.name}
        </h1>
        <p className="mt-2 font-medium text-gray-500">
          Gerencie membros e pacotes pré-pagos.
        </p>
      </div>

      {!canMembers && (
        <V2Surface className="mb-6 border-amber-200 bg-amber-50/50">
          <p className="text-sm text-amber-800">
            <strong>Módulo não habilitado.</strong> Ative em
            <Link to={`/arenas/${arena.id}/gerir/modulos`} className="ml-1 font-bold underline">Módulos da arena</Link>.
          </p>
        </V2Surface>
      )}

      {/* Pacotes */}
      <V2Surface className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Pacotes</h2>
          {canMembers && !showForm && (
            <V2Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo pacote
            </V2Button>
          )}
        </div>
        {showForm && (
          <div className="mb-4">
            <CreatePackageForm arenaId={arena.id} onClose={() => setShowForm(false)} />
          </div>
        )}
        {packagesLoading ? (
          <V2Skeleton className="h-32 rounded-2xl" />
        ) : packages.length === 0 ? (
          <V2EmptyState icon={Package} title="Nenhum pacote" description="Crie o primeiro pacote para começar a vender." />
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                <div>
                  <p className="font-bold text-ink">{pkg.name}</p>
                  <p className="text-xs text-gray-500">{pkg.hours}h · R$ {pkg.price.toFixed(2)} · {pkg.validity_days} dias · {pkg.sold_count || 0} vendido(s)</p>
                </div>
                <div className="flex items-center gap-2">
                  {pkg.active ? <V2Badge tone="green">Ativo</V2Badge> : <V2Badge tone="neutral">Inativo</V2Badge>}
                  <button
                    type="button"
                    onClick={() => handleDelete(pkg)}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="mr-1 inline h-3 w-3" /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </V2Surface>

      {/* Membros */}
      <V2Surface>
        <h2 className="mb-4 font-display text-lg font-bold text-ink">Membros ({members.length})</h2>
        {membersLoading ? (
          <V2Skeleton className="h-32 rounded-2xl" />
        ) : members.length === 0 ? (
          <V2EmptyState
            icon={Trophy}
            title="Nenhum membro ainda"
            description="Conforme atletas comprarem pacotes, eles aparecem aqui."
          />
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const tier = computeTier(m.points);
              const tone = tierColors[tier.id] || 'amber';
              return (
                <div key={m.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-ink">
                      {(m.user_name || 'A').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-ink">{m.user_name}</p>
                      <p className="text-xs text-gray-500">{m.points || 0} pontos · status: {m.status}</p>
                    </div>
                  </div>
                  <V2Badge tone={tone}>{tier.name}</V2Badge>
                </div>
              );
            })}
          </div>
        )}
      </V2Surface>
    </div>
  );
}
