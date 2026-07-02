import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Pencil, Plus, Repeat, Trash2, Users, ArrowRight, Globe, Lock } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClubEvents, useDeleteClubEvent, useEventInvites } from '@/modules/clubs/hooks/useClubs';
import {
  CLUB_EVENT_TYPE,
  INVITE_STATUS,
  eventTypeLabel,
  isGameDayEvent,
  isPrivateEvent,
} from '@/modules/clubs/domain/constants';
import { EventFormDialog } from '@/modules/clubs/components/ClubEventsTab';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TYPE_TONE = {
  [CLUB_EVENT_TYPE.GAME_DAY]: 'green',
  [CLUB_EVENT_TYPE.SOCIAL]: 'green',
  [CLUB_EVENT_TYPE.TOURNAMENT]: 'amber',
  [CLUB_EVENT_TYPE.MEETING]: 'neutral',
  [CLUB_EVENT_TYPE.OTHER]: 'neutral',
  training: 'green',
};

export default function V2ClubEvents({ clubId, isAdmin }) {
  const { data: events = [], isLoading } = useClubEvents(clubId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Dias de jogo, confraternizações, torneios internos e reuniões do clube.</p>
        <V2Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo evento</V2Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <V2Skeleton key={i} className="h-28 rounded-4xl" />)}</div>
      ) : events.length === 0 ? (
        <V2EmptyState
          icon={CalendarDays}
          title="Nenhum evento planejado"
          description="Crie o primeiro evento do clube e convide os membros."
          action={<V2Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Criar evento</V2Button>}
        />
      ) : (
        <div className="space-y-3">
          {events.map((event) => <EventCard key={event.id} event={event} clubId={clubId} isAdmin={isAdmin} />)}
        </div>
      )}

      <EventFormDialog clubId={clubId} open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function EventCard({ event, clubId, isAdmin }) {
  const { user } = useAuth();
  const { data: invites = [] } = useEventInvites(event.id);
  const deleteEvent = useDeleteClubEvent(clubId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const canManage = isAdmin || event.created_by === user?.uid;
  const participantCount = invites.filter((r) => r.status !== INVITE_STATUS.INVITED).length;
  const when = formatDateTime(event.starts_at);
  const gameDay = isGameDayEvent(event.type);
  const isPrivate = isPrivateEvent(event);

  const handleDelete = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success('Evento removido.');
      setConfirmDelete(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover o evento.');
    }
  };

  return (
    <div className="rounded-4xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone={TYPE_TONE[event.type] || 'neutral'}>{eventTypeLabel(event.type)}</V2Badge>
            <V2Badge tone="neutral">
              {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {isPrivate ? 'Privado' : 'Público'}
            </V2Badge>
            {event.recurring && <V2Badge tone="neutral"><Repeat className="h-3 w-3" /> Recorrente</V2Badge>}
            <h4 className="font-display text-base font-bold text-ink">{event.title}</h4>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {when && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {when}</span>}
            {event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>}
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {participantCount} participante(s)</span>
          </div>
        </div>
        {canManage && (
          <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {event.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{event.description}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <V2Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5" /> Editar</V2Button>
        <V2Button asChild size="sm" variant="secondary" className="ml-auto">
          <Link to={`/v2/clubes/${clubId}/eventos/${event.id}`}>
            {gameDay ? 'Organizar / ingressar' : 'Ingressar no evento'} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </V2Button>
      </div>

      <EventFormDialog clubId={clubId} event={event} open={editOpen} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Remover evento"
        description={`Tem certeza que deseja remover "${event.title}"?`}
        confirmLabel="Remover"
        destructive
        loading={deleteEvent.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
