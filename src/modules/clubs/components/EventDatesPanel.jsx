import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useEventDates,
  useAddEventDate,
  useUpdateEventDate,
  useDeleteEventDate,
  useEventDateRsvps,
  useSetEventDateRsvp,
} from '@/modules/clubs/hooks/useClubs';
import { RSVP_STATUS, RSVP_STATUS_LABELS } from '@/modules/clubs/domain/constants';

function formatDateTime(value) {
  if (!value) return 'Data a definir';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Data a definir';
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function EventDatesPanel({ event }) {
  const eventId = event.id;
  const { data: dates = [], isLoading } = useEventDates(eventId);
  const { data: rsvps = [] } = useEventDateRsvps(eventId);
  const addDate = useAddEventDate(eventId);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date_time: '', location: event.location || '', note: '' });

  const rsvpsByDate = useMemo(() => {
    const map = new Map();
    rsvps.forEach((r) => {
      if (!map.has(r.date_id)) map.set(r.date_id, []);
      map.get(r.date_id).push(r);
    });
    return map;
  }, [rsvps]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.date_time) {
      toast.error('Informe a data e o horário.');
      return;
    }
    try {
      await addDate.mutateAsync({ club_id: event.club_id, date_time: form.date_time, location: form.location, note: form.note });
      toast.success('Data adicionada.');
      setForm({ date_time: '', location: event.location || '', note: '' });
      setAdding(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível adicionar a data.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Datas do evento</h3>
          <p className="text-sm text-slate-500">Cada data tem local, horário e a sua resposta de presença.</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova data
          </Button>
        )}
      </div>

      {adding && (
        <Card className="rounded-xl border-emerald-200">
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new_date_time">Data e hora *</Label>
                <Input id="new_date_time" type="datetime-local" value={form.date_time} onChange={(e) => setForm((p) => ({ ...p, date_time: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_date_location">Local</Label>
                <Input id="new_date_location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} maxLength={160} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new_date_note">Observação</Label>
                <Input id="new_date_note" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} maxLength={200} placeholder="Ex.: levar bola, quadra 2…" />
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={addDate.isPending}>Adicionar data</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : dates.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma data cadastrada"
          description="Adicione a primeira data com local e horário."
        />
      ) : (
        <div className="space-y-3">
          {dates.map((d) => (
            <DateCard key={d.id} eventId={eventId} date={d} rsvps={rsvpsByDate.get(d.id) || []} />
          ))}
        </div>
      )}
    </div>
  );
}

function DateCard({ eventId, date, rsvps }) {
  const { user } = useAuth();
  const setRsvp = useSetEventDateRsvp(eventId);
  const updateDate = useUpdateEventDate(eventId);
  const deleteDate = useDeleteEventDate(eventId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    date_time: toLocalInput(date.date_time),
    location: date.location || '',
    note: date.note || '',
  });

  const myStatus = rsvps.find((r) => r.user_id === user?.uid)?.status;
  const grouped = {
    [RSVP_STATUS.GOING]: rsvps.filter((r) => r.status === RSVP_STATUS.GOING),
    [RSVP_STATUS.MAYBE]: rsvps.filter((r) => r.status === RSVP_STATUS.MAYBE),
    [RSVP_STATUS.NOT_GOING]: rsvps.filter((r) => r.status === RSVP_STATUS.NOT_GOING),
  };

  const handleRsvp = async (status) => {
    try {
      await setRsvp.mutateAsync({ dateId: date.id, status });
    } catch (err) {
      toast.error(err.message || 'Não foi possível responder.');
    }
  };

  const handleSave = async () => {
    try {
      await updateDate.mutateAsync({ dateId: date.id, updates: form });
      toast.success('Data atualizada.');
      setEditing(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDate.mutateAsync(date.id);
      toast.success('Data removida.');
      setConfirmDelete(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover.');
    }
  };

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={form.date_time} onChange={(e) => setForm((p) => ({ ...p, date_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Local</Label>
              <Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} maxLength={160} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observação</Label>
              <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} maxLength={200} />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="mr-1 h-3.5 w-3.5" /> Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={updateDate.isPending}><Check className="mr-1 h-3.5 w-3.5" /> Salvar</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <CalendarDays className="h-4 w-4 text-emerald-600" /> {formatDateTime(date.date_time)}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {date.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {date.location}</span>}
                  {date.note && <span>{date.note}</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {Object.values(RSVP_STATUS).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={myStatus === status ? 'default' : 'outline'}
                  disabled={setRsvp.isPending}
                  onClick={() => handleRsvp(status)}
                >
                  {RSVP_STATUS_LABELS[status]} · {grouped[status].length}
                </Button>
              ))}
            </div>

            {grouped[RSVP_STATUS.GOING].length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {grouped[RSVP_STATUS.GOING].map((r) => (
                  <Badge key={r.id} variant="secondary" className="rounded-full font-normal">{r.user_name}</Badge>
                ))}
              </div>
            )}
          </>
        )}

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Remover data"
          description="A data e as respostas associadas serão removidas."
          confirmLabel="Remover"
          destructive
          loading={deleteDate.isPending}
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
