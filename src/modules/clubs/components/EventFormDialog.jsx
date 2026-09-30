import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useCreateClubEvent,
  useUpdateClubEvent,
} from '@/modules/clubs/hooks/useClubs';
import {
  CLUB_EVENT_TYPE,
  CLUB_EVENT_TYPE_LABELS,
  EVENT_VISIBILITY,
  EVENT_VISIBILITY_LABELS,
  isGameDayEvent,
} from '@/modules/clubs/domain/constants';

/*
 * O formulário de criar/editar evento de clube. A lista de eventos que
 * morava neste arquivo (`ClubEventsTab`, V1) saiu: a tela viva é
 * `v2/components/clubs/V2ClubEvents.jsx`, que importa só este diálogo.
 */

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
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div>
              <Label htmlFor="event_recurring" className="font-medium">Evento recorrente</Label>
              <p className="text-xs text-gray-500">
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
            <p className="text-xs text-gray-500">
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
