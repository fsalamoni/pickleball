/**
 * V2ArenaOpenMatch — Lista de slots de Open Match.
 *
 * Rota pública: /arenas/:arenaId/open-match
 *
 * Mostra slots abertos pela arena (com vagas). Atleta entra em 1-tap.
 * Se arena não tem o módulo `matchmaking_open_match` habilitado, mostra mensagem.
 *
 * Aditivo — não mexe em nenhuma página existente.
 */

import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Clock, MapPin, Users, X, Check } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useArena,
  useMyManagedArenas,
} from '@/modules/arenas/hooks/useArenas';
import {
  useArenaOpenSlots,
  useJoinOpenSlot,
  useLeaveOpenSlot,
  useUserWaitlistEntry,
  useJoinWaitlist,
  useSlotWaitlist,
} from '@/modules/arenas/hooks/useArenaV3';
import { useCanArenaUseModule } from '@/modules/arenas/hooks/useArenaV3';
import {
  getAvailableSpots,
  getSlotFillPct,
} from '@/modules/arenas/domain/openMatch';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

function SlotCard({ slot, arenaId, onJoin, onJoinWaitlist, onLeave, isIn, isInWaitlist, waitlistCount }) {
  const available = getAvailableSpots(slot);
  const fillPct = getSlotFillPct(slot);
  const isFull = available <= 0;
  const isPast = new Date(slot.date) < new Date(new Date().toISOString().slice(0, 10));

  return (
    <V2Surface className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">
            {slot.date} · {slot.start}–{slot.end}
          </h3>
          {slot.court && (
            <p className="mt-1 text-sm text-gray-500">
              <MapPin className="mr-1 inline h-3.5 w-3.5" /> {slot.court}
            </p>
          )}
        </div>
        <V2Badge tone={isFull ? 'red' : 'green'}>
          {isFull ? 'Lotado' : `${available} vaga${available === 1 ? '' : 's'}`}
        </V2Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {slot.format && <V2Badge tone="neutral">{slot.format}</V2Badge>}
        {Number.isFinite(slot.min_level) && Number.isFinite(slot.max_level) && (
          <V2Badge tone="neutral">Nível {slot.min_level}–{slot.max_level}</V2Badge>
        )}
        {Number.isFinite(slot.price) && slot.price > 0 && (
          <V2Badge tone="amber">R$ {slot.price.toFixed(2)}</V2Badge>
        )}
        {Number.isFinite(slot.price) && slot.price === 0 && (
          <V2Badge tone="green">Grátis</V2Badge>
        )}
      </div>

      {/* Barra de ocupação */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Ocupação</span>
          <span className="font-bold text-ink">{fillPct}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={['h-full rounded-full transition-all', isFull ? 'bg-red-400' : 'bg-emerald-400'].join(' ')}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {slot.notes && (
        <p className="mt-4 text-sm text-gray-600">{slot.notes}</p>
      )}

      <div className="mt-auto pt-4">
        {isPast ? (
          <p className="text-center text-xs text-gray-400">Slot já passou</p>
        ) : isIn ? (
          <V2Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={() => onLeave(slot.id)}
          >
            <X className="mr-1.5 h-4 w-4" /> Sair do slot
          </V2Button>
        ) : isFull ? (
          isInWaitlist ? (
            <V2Button variant="secondary" size="sm" className="w-full" disabled>
              <Check className="mr-1.5 h-4 w-4" /> Você está na fila ({waitlistCount}º)
            </V2Button>
          ) : (
            <V2Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => onJoinWaitlist(slot.id)}
            >
              <Users className="mr-1.5 h-4 w-4" /> Entrar na fila de espera
            </V2Button>
          )
        ) : (
          <V2Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => onJoin(slot.id)}
          >
            Inscrever-se
          </V2Button>
        )}
      </div>
    </V2Surface>
  );
}

export default function V2ArenaOpenMatch() {
  const { arenaId } = useParams();
  const { user } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const canUseModule = useCanArenaUseModule(arenaId, 'matchmaking_open_match');
  const { data: slots = [], isLoading: slotsLoading } = useArenaOpenSlots(arenaId);
  const join = useJoinOpenSlot();
  const leave = useLeaveOpenSlot();
  const joinWl = useJoinWaitlist();
  const [filter, setFilter] = useState('open');  // 'open' | 'all' | 'full'

  // Auth gate
  if (!user) {
    return (
      <div className="mx-auto max-w-[500px]">
        <V2Surface>
          <V2EmptyState
            title="Faça login"
            description="Você precisa estar logado para ver vagas abertas."
            action={<V2Button asChild><Link to="/login">Entrar</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }

  if (arenaLoading) {
    return <V2Skeleton className="mx-auto h-96 max-w-[1200px] rounded-4xl" />;
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

  // Se o módulo não está habilitado, mostrar mensagem
  if (!canUseModule) {
    return (
      <div className="mx-auto max-w-[700px]">
        <div className="mb-4">
          <Link
            to={`/arenas/${arena.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar à arena
          </Link>
        </div>
        <V2Surface>
          <V2EmptyState
            icon={Calendar}
            title="Open Match indisponível nesta arena"
            description="Esta arena não ativou o recurso de Open Match. Procure outras arenas ou entre em contato com ela."
            action={<V2Button asChild variant="secondary"><Link to="/arenas">Ver outras arenas</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const filtered = slots.filter((s) => {
    if (s.status === 'cancelled') return false;
    if (filter === 'open' && (s.status === 'full' || s.date < today)) return false;
    if (filter === 'full' && s.status !== 'full') return false;
    return s.date >= today || filter === 'all';
  }).sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));

  const handleJoin = async (slotId) => {
    try {
      await join.mutateAsync(slotId);
      toast.success('Inscrito!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleLeave = async (slotId) => {
    try {
      await leave.mutateAsync(slotId);
      toast.success('Você saiu do slot');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleJoinWaitlist = async (slotId) => {
    try {
      await joinWl.mutateAsync(slotId);
      toast.success('Você está na fila!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Topo */}
      <div className="mb-6">
        <Link
          to={`/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar à arena
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              Open Match · {arena.name}
            </h1>
            <p className="mt-2 font-medium text-gray-500">
              Vagas abertas pela arena. Inscreva-se em 1-tap ou entre na fila de espera.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { v: 'open', label: 'Com vagas' },
          { v: 'full', label: 'Lotados' },
          { v: 'all', label: 'Todos' },
        ].map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => setFilter(f.v)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-bold transition',
              filter === f.v
                ? 'bg-ink text-acid'
                : 'bg-paper-pure text-gray-600 border border-gray-100 hover:border-ink',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {slotsLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-72 rounded-4xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Calendar}
            title="Nenhum slot no momento"
            description={filter === 'open' ? 'A arena ainda não publicou vagas abertas. Volte mais tarde!' : 'Não há slots com esse filtro.'}
          />
        </V2Surface>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((slot) => (
            <SlotWithWaitlist
              key={slot.id}
              slot={slot}
              arenaId={arena.id}
              onJoin={handleJoin}
              onJoinWaitlist={handleJoinWaitlist}
              onLeave={handleLeave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotWithWaitlist({ slot, arenaId, onJoin, onJoinWaitlist, onLeave }) {
  const { user } = useAuth();
  const isIn = (slot.participants || []).includes(user?.uid);
  const { data: entry } = useUserWaitlistEntry(slot.id);
  const isInWaitlist = entry && ['waiting', 'notified'].includes(entry.status);
  const { data: waitlist = [] } = useSlotWaitlist(slot.id);
  const waitlistCount = waitlist.filter((w) => w.status === 'waiting' || w.status === 'notified').length;

  return (
    <SlotCard
      slot={slot}
      arenaId={arenaId}
      onJoin={onJoin}
      onJoinWaitlist={onJoinWaitlist}
      onLeave={onLeave}
      isIn={isIn}
      isInWaitlist={isInWaitlist}
      waitlistCount={entry?.position || waitlistCount}
    />
  );
}
