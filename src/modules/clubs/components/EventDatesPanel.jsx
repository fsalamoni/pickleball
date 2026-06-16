import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Plus, Trash2, Check, X, Pencil, ChevronDown, ChevronRight, Users, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import GameDayOrganizer from '@/modules/clubs/components/GameDayOrganizer';

function formatDateTime(value) {
  if (!value) return 'Data a definir';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Data a definir';
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Lista os "dias de jogo" (ou datas) do evento. Cada um é um card colapsável
 * com abas internas: Participação (RSVP + editar/excluir) e — quando o evento
 * comporta jogos — Organização de jogos própria daquele dia.
 */
export default function EventDatesPanel({ event, clubId, showGames = false }) {
  const eventId = event.id;
  const term = showGames ? 'dia de jogo' : 'data';
  const termPlural = showGames ? 'Dias de jogo' : 'Datas';
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
      toast.success(`${showGames ? 'Dia de jogo' : 'Data'} adicionado.`);
      setForm({ date_time: '', location: event.location || '', note: '' });
      setAdding(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível adicionar.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{termPlural} do evento</h3>
          <p className="text-sm text-slate-500">
            Cada {term} tem local, horário, sua resposta de presença{showGames ? ' e organização de jogos própria.' : '.'}
          </p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> {showGames ? 'Novo dia de jogo' : 'Nova data'}
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
                <Button type="submit" size="sm" disabled={addDate.isPending}>Adicionar</Button>
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
          title={`Nenhum ${term} cadastrado`}
          description={`Adicione o primeiro ${term} com local e horário.`}
        />
      ) : (
        <div className="space-y-3">
          {dates.map((d) => (
            <DateCard
              key={d.id}
              event={event}
              clubId={clubId}
              date={d}
              rsvps={rsvpsByDate.get(d.id) || []}
              showGames={showGames}
              term={term}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DateCard({ event, clubId, date, rsvps, showGames, term }) {
  const { user } = useAuth();
  const eventId = event.id;
  const setRsvp = useSetEventDateRsvp(eventId);
  const updateDate = useUpdateEventDate(eventId);
  const deleteDate = useDeleteEventDate(eventId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState('presenca');
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
      toast.success('Atualizado.');
      setEditing(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDate.mutateAsync(date.id);
      toast.success(`${term === 'dia de jogo' ? 'Dia de jogo' : 'Data'} removido.`);
      setConfirmDelete(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover.');
    }
  };

  return (
    <Card className="overflow-hidden rounded-xl">
      {/* Cabeçalho colapsável */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
          <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{formatDateTime(date.date_time)}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
              {date.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {date.location}</span>}
              <span>{grouped[RSVP_STATUS.GOING].length} confirmado(s)</span>
            </div>
          </div>
        </div>
        <Badge variant={myStatus === RSVP_STATUS.GOING ? 'success' : 'secondary'} className="shrink-0 rounded-full">
          {myStatus ? RSVP_STATUS_LABELS[myStatus] : 'Responder'}
        </Badge>
      </button>

      {open && (
        <CardContent className="border-t border-slate-100 p-4">
          {showGames ? (
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="presenca"><Users className="mr-1.5 h-4 w-4" /> Participação</TabsTrigger>
                <TabsTrigger value="jogos"><Swords className="mr-1.5 h-4 w-4" /> Organização de jogos</TabsTrigger>
              </TabsList>
              <TabsContent value="presenca">
                <PresenceSection
                  date={date}
                  editing={editing}
                  setEditing={setEditing}
                  form={form}
                  setForm={setForm}
                  onSave={handleSave}
                  saving={updateDate.isPending}
                  onDeleteRequest={() => setConfirmDelete(true)}
                  myStatus={myStatus}
                  grouped={grouped}
                  onRsvp={handleRsvp}
                  rsvpPending={setRsvp.isPending}
                />
              </TabsContent>
              <TabsContent value="jogos">
                <GameDayOrganizer event={event} clubId={clubId} dateId={date.id} />
              </TabsContent>
            </Tabs>
          ) : (
            <PresenceSection
              date={date}
              editing={editing}
              setEditing={setEditing}
              form={form}
              setForm={setForm}
              onSave={handleSave}
              saving={updateDate.isPending}
              onDeleteRequest={() => setConfirmDelete(true)}
              myStatus={myStatus}
              grouped={grouped}
              onRsvp={handleRsvp}
              rsvpPending={setRsvp.isPending}
            />
          )}
        </CardContent>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Remover ${term}`}
        description={`O ${term}, suas respostas, participantes e jogos serão removidos.`}
        confirmLabel="Remover"
        destructive
        loading={deleteDate.isPending}
        onConfirm={handleDelete}
      />
    </Card>
  );
}

function PresenceSection({ date, editing, setEditing, form, setForm, onSave, saving, onDeleteRequest, myStatus, grouped, onRsvp, rsvpPending }) {
  return (
    <div className="space-y-4">
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
            <Button size="sm" onClick={onSave} disabled={saving}><Check className="mr-1 h-3.5 w-3.5" /> Salvar</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-slate-600">
            {date.note ? <p>{date.note}</p> : <p className="text-slate-400">Sem observações.</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)} title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={onDeleteRequest} title="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs uppercase tracking-wide text-slate-500">Sua presença</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.values(RSVP_STATUS).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={myStatus === status ? 'default' : 'outline'}
              disabled={rsvpPending}
              onClick={() => onRsvp(status)}
            >
              {RSVP_STATUS_LABELS[status]} · {grouped[status].length}
            </Button>
          ))}
        </div>
      </div>

      {grouped[RSVP_STATUS.GOING].length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {grouped[RSVP_STATUS.GOING].map((r) => (
            <Badge key={r.id} variant="secondary" className="rounded-full font-normal">{r.user_name}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
