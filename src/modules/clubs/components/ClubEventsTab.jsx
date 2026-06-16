import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Pencil, Plus, Repeat, Trash2, Users, ArrowRight, Globe, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  useUpdateClubEvent,
  useDeleteClubEvent,
  useEventInvites,
  useSetEventResponse,
} from '@/modules/clubs/hooks/useClubs';
import {
  CLUB_EVENT_TYPE,
  CLUB_EVENT_TYPE_LABELS,
  RSVP_STATUS,
  RSVP_STATUS_LABELS,
  INVITE_STATUS,
  EVENT_VISIBILITY,
  EVENT_VISIBILITY_LABELS,
  eventTypeLabel,
  isGameDayEvent,
  isPrivateEvent,
} from '@/modules/clubs/domain/constants';

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TYPE_TONE = {
  [CLUB_EVENT_TYPE.GAME_DAY]: 'success',
  [CLUB_EVENT_TYPE.SOCIAL]: 'success',
  [CLUB_EVENT_TYPE.TOURNAMENT]: 'warning',
  [CLUB_EVENT_TYPE.MEETING]: 'outline',
  [CLUB_EVENT_TYPE.OTHER]: 'outline',
  training: 'success',
};

export default function ClubEventsTab({ clubId, isAdmin }) {
  const { data: events = [], isLoading } = useClubEvents(clubId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Dias de jogo, confraternizações, torneios internos e reuniões do clube.</p>
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

      <EventFormDialog clubId={clubId} open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function EventCard({ event, clubId, isAdmin }) {
  const { user } = useAuth();
  const { data: invites = [] } = useEventInvites(event.id);
  const setResponse = useSetEventResponse(event);
  const deleteEvent = useDeleteClubEvent(clubId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const canManage = isAdmin || event.created_by === user?.uid;
  const myRsvp = invites.find((r) => r.user_id === user?.uid)?.status;
  const goingCount = invites.filter((r) => r.status === INVITE_STATUS.GOING).length;
  const when = formatDateTime(event.starts_at);
  const gameDay = isGameDayEvent(event.type);
  const isPrivate = isPrivateEvent(event);

  const handleRsvp = async (status) => {
    try {
      await setResponse.mutateAsync(status);
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
                {eventTypeLabel(event.type)}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {isPrivate ? <Lock className="mr-1 h-3 w-3" /> : <Globe className="mr-1 h-3 w-3" />}
                {isPrivate ? 'Privado' : 'Público'}
              </Badge>
              {event.recurring && (
                <Badge variant="secondary" className="rounded-full">
                  <Repeat className="mr-1 h-3 w-3" /> Recorrente
                </Badge>
              )}
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
              disabled={setResponse.isPending}
              onClick={() => handleRsvp(status)}
            >
              {RSVP_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
          </Button>
          <Button asChild size="sm" variant="secondary" className="ml-auto">
            <Link to={`/clubes/${clubId}/eventos/${event.id}`}>
              {gameDay ? 'Organizar / ingressar' : 'Ingressar no evento'} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
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
      </CardContent>
    </Card>
  );
}

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Diálogo único para criar ou editar um evento. Quando `event` é informado,
 * opera em modo edição.
 */
export function EventFormDialog({ clubId, event, open, onClose }) {
  const isEdit = !!event;
  const createEvent = useCreateClubEvent(clubId);
  const updateEvent = useUpdateClubEvent(clubId);
  const buildInitial = () => ({
    title: event?.title || '',
    description: event?.description || '',
    type: event?.type || CLUB_EVENT_TYPE.GAME_DAY,
    location: event?.location || '',
    starts_at: toLocalInput(event?.starts_at),
    recurring: !!event?.recurring,
    visibility: event?.visibility || EVENT_VISIBILITY.PUBLIC,
  });
  const [form, setForm] = useState(buildInitial);

  // Reinicializa o formulário ao abrir (importante no modo edição).
  React.useEffect(() => {
    if (open) setForm(buildInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event]);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Informe o título do evento.');
      return;
    }
    try {
      if (isEdit) {
        await updateEvent.mutateAsync({ eventId: event.id, updates: form });
        toast.success('Evento atualizado.');
      } else {
        await createEvent.mutateAsync(form);
        toast.success('Evento criado.');
      }
      onClose();
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar o evento.');
    }
  };

  const pending = createEvent.isPending || updateEvent.isPending;
  const gameDay = isGameDayEvent(form.type);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar evento' : 'Novo evento'}</DialogTitle>
          <DialogDescription>
            Organize um dia de jogo, confraternização, torneio interno ou reunião.
          </DialogDescription>
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
              <Label htmlFor="event_when">{form.recurring ? 'Primeira data e hora' : 'Data e hora'}</Label>
              <Input id="event_when" type="datetime-local" value={form.starts_at} onChange={setField('starts_at')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_location">Local</Label>
            <Input id="event_location" value={form.location} onChange={setField('location')} maxLength={160} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <Label htmlFor="event_recurring" className="font-medium">Evento recorrente</Label>
              <p className="text-xs text-slate-500">
                {gameDay ? 'Permite adicionar várias datas na página do dia de jogo.' : 'Permite cadastrar mais de uma data na página do evento.'}
              </p>
            </div>
            <Switch
              id="event_recurring"
              checked={form.recurring}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, recurring: v }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_visibility">Visibilidade</Label>
            <select
              id="event_visibility"
              value={form.visibility}
              onChange={setField('visibility')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.entries(EVENT_VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {form.visibility === EVENT_VISIBILITY.PRIVATE
                ? 'Apenas atletas convidados verão e participarão do evento.'
                : 'Todos os atletas do clube poderão ver e participar.'}
            </p>
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
            <Button type="submit" disabled={pending}>{pending ? 'Salvando…' : (isEdit ? 'Salvar' : 'Criar evento')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
