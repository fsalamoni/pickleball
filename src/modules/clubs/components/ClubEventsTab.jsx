import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useClubEvents,
  useCreateClubEvent,
  useDeleteClubEvent,
  useEventRsvps,
  useSetEventRsvp,
} from '@/modules/clubs/hooks/useClubs';
import {
  CLUB_EVENT_TYPE,
  CLUB_EVENT_TYPE_LABELS,
  RSVP_STATUS,
  RSVP_STATUS_LABELS,
} from '@/modules/clubs/domain/constants';

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TYPE_TONE = {
  [CLUB_EVENT_TYPE.SOCIAL]: 'success',
  [CLUB_EVENT_TYPE.TOURNAMENT]: 'warning',
  [CLUB_EVENT_TYPE.TRAINING]: 'secondary',
  [CLUB_EVENT_TYPE.MEETING]: 'outline',
  [CLUB_EVENT_TYPE.OTHER]: 'outline',
};

export default function ClubEventsTab({ clubId, isAdmin }) {
  const { data: events = [], isLoading } = useClubEvents(clubId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Confraternizações, torneios internos, treinos e reuniões do clube.</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo evento
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum evento planejado"
          description="Crie o primeiro evento do clube e convide os membros."
          action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Criar evento</Button>}
        />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} clubId={clubId} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      <CreateEventDialog clubId={clubId} open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function EventCard({ event, clubId, isAdmin }) {
  const { user } = useAuth();
  const { data: rsvps = [] } = useEventRsvps(event.id);
  const setRsvp = useSetEventRsvp(event.id);
  const deleteEvent = useDeleteClubEvent(clubId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canManage = isAdmin || event.created_by === user?.uid;
  const myRsvp = rsvps.find((r) => r.user_id === user?.uid)?.status;
  const goingCount = rsvps.filter((r) => r.status === RSVP_STATUS.GOING).length;
  const when = formatDateTime(event.starts_at);

  const handleRsvp = async (status) => {
    try {
      await setRsvp.mutateAsync({ event, status });
    } catch (err) {
      toast.error(err.message || 'Não foi possível registrar presença.');
    }
  };

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
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={TYPE_TONE[event.type] || 'outline'} className="rounded-full">
                {CLUB_EVENT_TYPE_LABELS[event.type] || 'Evento'}
              </Badge>
              <h4 className="text-base font-semibold text-slate-900">{event.title}</h4>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {when && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {when}</span>}
              {event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>}
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {goingCount} confirmado(s)</span>
            </div>
          </div>
          {canManage && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-500 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {event.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{event.description}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.values(RSVP_STATUS).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={myRsvp === status ? 'default' : 'outline'}
              disabled={setRsvp.isPending}
              onClick={() => handleRsvp(status)}
            >
              {RSVP_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>

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
      </CardContent>
    </Card>
  );
}

const INITIAL_EVENT = {
  title: '',
  description: '',
  type: CLUB_EVENT_TYPE.SOCIAL,
  location: '',
  starts_at: '',
};

function CreateEventDialog({ clubId, open, onClose }) {
  const createEvent = useCreateClubEvent(clubId);
  const [form, setForm] = useState(INITIAL_EVENT);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Informe o título do evento.');
      return;
    }
    try {
      await createEvent.mutateAsync(form);
      toast.success('Evento criado.');
      setForm(INITIAL_EVENT);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Não foi possível criar o evento.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo evento</DialogTitle>
          <DialogDescription>Planeje uma confraternização, torneio interno, treino ou reunião.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event_title">Título *</Label>
            <Input id="event_title" value={form.title} onChange={setField('title')} maxLength={120} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event_type">Tipo</Label>
              <select
                id="event_type"
                value={form.type}
                onChange={setField('type')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {Object.entries(CLUB_EVENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_when">Data e hora</Label>
              <Input id="event_when" type="datetime-local" value={form.starts_at} onChange={setField('starts_at')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_location">Local</Label>
            <Input id="event_location" value={form.location} onChange={setField('location')} maxLength={160} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_description">Descrição</Label>
            <textarea
              id="event_description"
              value={form.description}
              onChange={setField('description')}
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createEvent.isPending}>{createEvent.isPending ? 'Criando…' : 'Criar evento'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
