/**
 * CoachPartnersSection — parceiros do professor (arenas onde ele atende).
 * O professor vê os vínculos, pode aceitar/recusar convites pendentes,
 * sair de parcerias ativas e SOLICITAR parceria com uma arena (item 4.2).
 * Espelha os "professores parceiros" da arena, pelo lado do professor.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, MapPin, LogOut, Handshake, Check, X, Plus } from 'lucide-react';
import {
  useCoachResidencies, useRemoveCoachResidency,
  useAcceptCoachResidency, useDeclineCoachResidency,
} from '../hooks/useCoaches.js';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import ConfirmDialog from '@/components/ConfirmDialog';
import CoachAddArenaForm from './CoachAddArenaForm';
import {
  V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

function PartnerArenaCard({ coachId, residency }) {
  const { data: arena } = useArena(residency.arena_id);
  const remove = useRemoveCoachResidency();
  const accept = useAcceptCoachResidency();
  const decline = useDeclineCoachResidency();
  if (!arena) return null;
  const isPaused = residency.status === 'paused';
  const isPending = residency.status === 'pending';

  if (isPending) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-ink">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/arenas/${arena.id}`} className="font-bold text-ink hover:underline">{arena.name}</Link>
              <V2Badge tone="amber">Convite pendente</V2Badge>
            </div>
            <p className="mt-1 text-xs text-amber-800">Esta arena convidou você como professor parceiro.</p>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <V2Button size="sm" variant="ghost" onClick={async () => {
            try { await decline.mutateAsync({ coachId, arenaId: arena.id }); toast.success('Convite recusado.'); }
            catch (err) { toast.error(err?.message || 'Não foi possível recusar.'); }
          }} disabled={decline.isPending}>
            <X className="h-3.5 w-3.5" /> Recusar
          </V2Button>
          <V2Button size="sm" onClick={async () => {
            try { await accept.mutateAsync({ coachId, arenaId: arena.id }); toast.success('Parceria aceita!'); }
            catch (err) { toast.error(err?.message || 'Não foi possível aceitar.'); }
          }} disabled={accept.isPending}>
            <Check className="h-3.5 w-3.5" /> Aceitar
          </V2Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-ink">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/arenas/${arena.id}`} className="font-bold text-ink hover:underline">{arena.name}</Link>
            {isPaused ? <V2Badge tone="amber">Pausado</V2Badge> : <V2Badge tone="green">Ativo</V2Badge>}
          </div>
          {arena.city && <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400"><MapPin className="h-3 w-3" /> {arena.city}{arena.state ? `, ${arena.state}` : ''}</p>}
          {residency.notes && <p className="mt-1 text-xs text-gray-500">{residency.notes}</p>}
        </div>
      </div>
      <ConfirmDialog
        title="Sair da parceria?"
        description={`Você deixará de aparecer como professor parceiro de ${arena.name}.`}
        confirmLabel="Sair"
        onConfirm={async () => {
          try { await remove.mutateAsync({ coachId, arenaId: arena.id }); toast.success('Você saiu da parceria.'); }
          catch (err) { toast.error(err?.message || 'Não foi possível sair.'); }
        }}
        trigger={(
          <button type="button" className="rounded-full border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Sair da parceria">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      />
    </div>
  );
}

export default function CoachPartnersSection({ coachId }) {
  const { data: residencies = [], isLoading } = useCoachResidencies(coachId);
  const [adding, setAdding] = useState(false);

  return (
    <V2Surface>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Parceiros</h2>
        </div>
        <V2Button size="sm" variant="ghost" onClick={() => setAdding((s) => !s)}>
          <Plus className="h-4 w-4" /> {adding ? 'Fechar' : 'Adicionar arena'}
        </V2Button>
      </div>
      <p className="-mt-2 mb-3 text-sm text-gray-500">
        Arenas onde você atende. Você pode ser convidado por uma arena ou
        solicitar a parceria (item 4.2) — a arena avalia antes de publicar.
      </p>

      {adding && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50/40 p-3">
          <CoachAddArenaForm coachId={coachId} onClose={() => setAdding(false)} />
        </div>
      )}

      {isLoading ? (
        <V2Skeleton lines={3} />
      ) : residencies.length === 0 ? (
        <V2EmptyState
          icon={Handshake}
          title="Nenhuma parceria ainda"
          description="Adicione uma arena parceira ou aguarde um convite. As parcerias aparecem no seu perfil público."
        />
      ) : (
        <div className="space-y-2">
          {residencies.map((r) => <PartnerArenaCard key={r.id} coachId={coachId} residency={r} />)}
        </div>
      )}
    </V2Surface>
  );
}
