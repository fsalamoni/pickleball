/**
 * V2ArenaCoaches — Gestão de professores parceiros da arena.
 *
 * Rota: /arenas/:arenaId/gerir/professores
 * Acesso: gestor da arena + platform admin. Gated pela flag coach_resident.
 *
 * Vincula professores (perfis públicos do Sistema A) como parceiros da arena
 * via residências (coach_arenas). Aditivo — reusa o serviço existente.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, GraduationCap, Search, Plus, Trash2, Pause, Play, MapPin,
} from 'lucide-react';
import { FEATURE_FLAG } from '@/core/featureFlags';
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useCoaches, useArenaCoaches, useAddCoachResidency,
  useRemoveCoachResidency, useUpdateCoachResidency,
} from '@/modules/coaches/hooks/useCoaches';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2SearchInput,
  V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

/* ----------------------- Adicionar parceiro ----------------------- */

function AddPartner({ arenaId, linkedIds, onDone }) {
  const { data: coaches = [], isLoading } = useCoaches({ acceptingOnly: false });
  const add = useAddCoachResidency();
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return coaches
      .filter((c) => !linkedIds.has(c.id))
      .filter((c) => !term || `${c.display_name} ${(c.modalities || []).join(' ')} ${(c.regions || []).join(' ')}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [coaches, q, linkedIds]);

  const handleAdd = async () => {
    if (!selected) return;
    try {
      await add.mutateAsync({ coach_id: selected.id, arena_id: arenaId, notes });
      toast.success(`${selected.display_name} vinculado como parceiro.`);
      onDone();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível vincular.');
    }
  };

  return (
    <V2Surface className="border-green-200 bg-green-50/40">
      <h3 className="font-display text-base font-bold text-ink">Vincular professor parceiro</h3>
      <p className="mt-1 text-xs text-gray-500">Busque um professor cadastrado na plataforma e vincule à sua arena.</p>

      {selected ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-sm font-bold text-acid">
              {selected.display_name?.[0] || '?'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-ink">{selected.display_name}</p>
              {selected.modalities?.length > 0 && <p className="text-xs text-gray-500">{selected.modalities.join(' · ')}</p>}
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-xs font-bold text-gray-500 hover:text-ink">Trocar</button>
          </div>
          <V2Field label="Notas (opcional)" hint="Ex.: atende terças e quintas; foco em iniciantes.">
            <V2Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onDone}>Cancelar</V2Button>
            <V2Button onClick={handleAdd} disabled={add.isPending}>{add.isPending ? 'Vinculando…' : 'Vincular parceiro'}</V2Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <V2SearchInput icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar professor por nome, modalidade ou região…" />
          <div className="mt-3 space-y-2">
            {isLoading ? (
              <V2Skeleton lines={3} />
            ) : results.length === 0 ? (
              <p className="text-sm text-gray-500">
                {coaches.filter((c) => !linkedIds.has(c.id)).length === 0
                  ? 'Todos os professores disponíveis já são parceiros.'
                  : 'Nenhum professor encontrado. Ele precisa ter um perfil de professor na plataforma.'}
              </p>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left transition-colors hover:border-ink"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ink text-xs font-bold text-acid">
                    {c.display_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink line-clamp-1">{c.display_name}</p>
                    {c.modalities?.length > 0 && <p className="text-xs text-gray-500 line-clamp-1">{c.modalities.join(' · ')}</p>}
                  </div>
                  <Plus className="h-4 w-4 text-gray-400" />
                </button>
              ))
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <V2Button type="button" variant="ghost" onClick={onDone}>Fechar</V2Button>
          </div>
        </div>
      )}
    </V2Surface>
  );
}

/* --------------------------- Card do parceiro --------------------------- */

function PartnerCard({ arenaId, coach }) {
  const residency = coach.residency || {};
  const isPaused = residency.status === 'paused';
  const update = useUpdateCoachResidency();
  const remove = useRemoveCoachResidency();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(residency.notes || '');

  const toggle = async () => {
    try {
      await update.mutateAsync({ coachId: coach.id, arenaId, patch: { status: isPaused ? 'active' : 'paused' } });
      toast.success(isPaused ? 'Parceria reativada.' : 'Parceria pausada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar.');
    }
  };
  const saveNotes = async () => {
    try {
      await update.mutateAsync({ coachId: coach.id, arenaId, patch: { notes } });
      toast.success('Notas salvas.');
      setEditingNotes(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-sm font-bold text-acid">
            {coach.display_name?.[0] || '?'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/coaches/${coach.id}`} className="font-bold text-ink hover:underline">{coach.display_name}</Link>
              {isPaused ? <V2Badge tone="amber">Pausado</V2Badge> : <V2Badge tone="green">Ativo</V2Badge>}
            </div>
            {coach.modalities?.length > 0 && <p className="text-xs text-gray-500">{coach.modalities.join(' · ')}</p>}
            {coach.regions?.length > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400"><MapPin className="h-3 w-3" /> {coach.regions.join(' · ')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={toggle} disabled={update.isPending} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-white disabled:opacity-50" aria-label={isPaused ? 'Reativar' : 'Pausar'}>
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
          <ConfirmDialog
            title="Remover parceiro?"
            description={`${coach.display_name} deixará de aparecer como professor parceiro da arena.`}
            confirmLabel="Remover"
            onConfirm={async () => {
              try { await remove.mutateAsync({ coachId: coach.id, arenaId }); toast.success('Parceiro removido.'); }
              catch (err) { toast.error(err?.message || 'Não foi possível remover.'); }
            }}
            trigger={(
              <button type="button" className="rounded-full border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Remover">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          />
        </div>
      </div>

      {editingNotes ? (
        <div className="mt-3 space-y-2">
          <V2Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Notas sobre a parceria (visíveis só no admin)" />
          <div className="flex justify-end gap-2">
            <V2Button size="sm" variant="ghost" onClick={() => { setNotes(residency.notes || ''); setEditingNotes(false); }}>Cancelar</V2Button>
            <V2Button size="sm" onClick={saveNotes} disabled={update.isPending}>Salvar notas</V2Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditingNotes(true)} className="mt-2 text-xs font-bold text-gray-500 hover:text-ink">
          {residency.notes ? `Notas: ${residency.notes}` : '+ Adicionar notas'}
        </button>
      )}
    </div>
  );
}

/* ---------------------- Gerenciador reutilizável ---------------------- */

/**
 * Corpo da gestão de parceiros — usado tanto na página dedicada quanto como
 * aba dentro do hub admin da arena (V2ArenaManage).
 */
export function ArenaCoachesManager({ arena, showTitle = true }) {
  const { data: partners = [], isLoading: partnersLoading } = useArenaCoaches(arena.id, { activeOnly: false });
  const [adding, setAdding] = useState(false);
  const linkedIds = useMemo(() => new Set(partners.map((c) => c.id)), [partners]);

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">
              {showTitle ? 'Professores parceiros' : 'Parceiros'} ({partners.length})
            </h2>
          </div>
          {!adding && (
            <V2Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" /> Vincular professor</V2Button>
          )}
        </div>
        <p className="-mt-2 mb-3 text-sm text-gray-500">
          Vincule professores cadastrados na plataforma. Os parceiros ativos aparecem na página pública da arena.
        </p>

        {adding && (
          <div className="mb-4">
            <AddPartner arenaId={arena.id} linkedIds={linkedIds} onDone={() => setAdding(false)} />
          </div>
        )}

        {partnersLoading ? (
          <V2Skeleton lines={3} />
        ) : partners.length === 0 ? (
          <V2EmptyState
            icon={GraduationCap}
            title="Nenhum professor parceiro"
            description="Vincule professores cadastrados na plataforma para divulgá-los na página da arena."
          />
        ) : (
          <div className="space-y-2">
            {partners.map((coach) => <PartnerCard key={coach.id} arenaId={arena.id} coach={coach} />)}
          </div>
        )}
      </V2Surface>
    </div>
  );
}

/* ------------------------------- Página -------------------------------- */

function V2ArenaCoachesContent() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();

  if (arenaLoading) return <V2Skeleton className="mx-auto h-96 max-w-[1000px] rounded-4xl" />;
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

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao hub admin
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Professores parceiros · {arena.name}</h1>
        <p className="mt-2 font-medium text-gray-500">Vincule professores à arena. Os parceiros ativos aparecem na página pública.</p>
      </div>
      <ArenaCoachesManager arena={arena} showTitle={false} />
    </div>
  );
}

export default function V2ArenaCoaches() {
  return (
    <FeatureFlagGuard
      flag={FEATURE_FLAG.COACH_RESIDENT}
      label="Professores residentes"
      description="A gestão de professores parceiros da arena fica disponível quando a flag Professores residentes está ligada."
    >
      <V2ArenaCoachesContent />
    </FeatureFlagGuard>
  );
}
