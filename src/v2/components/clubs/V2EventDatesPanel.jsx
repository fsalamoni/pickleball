import React, { lazy, Suspense, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Plus, Trash2, Check, X, Pencil, ChevronDown, ChevronRight, Users, Swords } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { V2Surface, V2Button, V2Badge, V2Select, V2ErrorState } from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
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
  useClub,
} from '@/modules/clubs/hooks/useClubs';
import { RSVP_STATUS, RSVP_STATUS_LABELS } from '@/modules/clubs/domain/constants';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS, isCourtByCourtFormat,
} from '@/modules/clubs/domain/gameDayFormats';
import { useGameDayFormatChoices } from '@/modules/games/hooks/useGameDayFormatChoices';
import {
  useCreateEventGameDay, useSyncEventGameDay, useArchiveEventGameDay,
} from '@/modules/games/hooks/useClubGameDay';
import { isModularEventDate } from '@/modules/games/domain/clubGameDay';
import { t, tn, fmtData } from '@/core/i18n';

// A organização de jogos carrega o módulo inteiro (as três visões por formato,
// o organizador legado, tutorial e telão) — dezenas de kB que só fazem sentido
// depois de alguém ABRIR a aba. Um evento de clube que não é dia de jogo nunca
// baixa nada disso.
const ClubGameDayTab = lazy(() => import('@/v2/components/clubs/ClubGameDayTab'));

function formatDateTime(value) {
  if (!value) return t('Data a definir');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return t('Data a definir');
  return fmtData(d, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Lista os "dias de jogo" (ou datas) do evento. Cada um é um card colapsável
 * com abas internas: Participação (RSVP + editar/excluir) e — quando o evento
 * comporta jogos — Organização de jogos própria daquele dia.
 */
export default function EventDatesPanel({ event, clubId, showGames = false }) {
  const eventId = event.id;
  const term = showGames ? 'dia de jogo' : 'data';
  const termPlural = showGames ? t('Dias de jogo') : t('Datas');
  const { data: dates = [], isLoading, isError, refetch } = useEventDates(eventId);
  const { data: rsvps = [] } = useEventDateRsvps(eventId);
  const addDate = useAddEventDate(eventId);
  // O clube também é a ORIGEM de um dia de jogo. Com `showGames`, cada data
  // nova nasce como um `game_days` — o mesmo módulo do atleta e da arena.
  const { data: club = null } = useClub(clubId);
  const createGameDay = useCreateEventGameDay(event, club || { id: clubId });
  // Os formatos oferecidos na data NOVA saem da mesma fonte da criação do
  // atleta e da arena (`gameDayFormatChoices`): Americano aprimorado, Mexicano
  // e Rei da Quadra cada um com a própria flag. Uma data nova não tem formato
  // gravado, então não há `current` a preservar.
  const formatosOferecidos = useGameDayFormatChoices();
  const recurringOn = true;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    date_time: '',
    location: event.location || '',
    note: '',
    repeat_weeks: 1,
    format: GAME_DAY_FORMAT.AMERICANO,
    play_courts: 1,
  });

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
      toast.error(t('Informe a data e o horário.'));
      return;
    }
    try {
      const weeks = recurringOn ? Math.max(1, Math.min(52, Number(form.repeat_weeks) || 1)) : 1;
      const base = new Date(form.date_time);
      for (let i = 0; i < weeks; i += 1) {
        const dt = new Date(base.getTime());
        dt.setDate(dt.getDate() + i * 7);
        // Formato datetime-local (sem timezone) preservado.
        const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        const payload = { club_id: event.club_id, date_time: iso, location: form.location, note: form.note };
        // eslint-disable-next-line no-await-in-loop
        await (showGames
          ? createGameDay.mutateAsync({ ...payload, format: form.format, play_courts: form.play_courts })
          : addDate.mutateAsync(payload));
      }
      toast.success(showGames
          ? tn(weeks, 'Dia de jogo adicionado.', '{n} dias de jogo adicionados.')
          : tn(weeks, 'Data adicionada.', '{n} datas adicionadas.'));
      setForm((p) => ({ ...p, date_time: '', location: event.location || '', note: '', repeat_weeks: 1 }));
      setAdding(false);
    } catch (err) {
      toast.error(err.message || t('Não foi possível adicionar.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{t('{grupo} do evento', { grupo: termPlural })}</h3>
          <p className="text-sm text-gray-500">
              {showGames
                ? t('Cada dia de jogo tem local, horário, sua resposta de presença e organização de jogos própria.')
                : t('Cada data tem local, horário e sua resposta de presença.')}
          </p>
        </div>
        {!adding && (
          <V2Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> {showGames ? t('Novo dia de jogo') : t('Nova data')}
          </V2Button>
        )}
      </div>

      {adding && (
        <V2Surface className="rounded-xl border-green-200">
          <div className="p-4">
            <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new_date_time">{t('Data e hora *')}</Label>
                <Input id="new_date_time" type="datetime-local" value={form.date_time} onChange={(e) => setForm((p) => ({ ...p, date_time: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_date_location">{t('Local')}</Label>
                <Input id="new_date_location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} maxLength={160} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new_date_note">{t('Observação')}</Label>
                <Input id="new_date_note" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} maxLength={200} placeholder={t('Ex.: levar bola, quadra 2…')} />
              </div>
              {showGames && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="new_date_format">{t('Formato')}</Label>
                    <V2Select
                      id="new_date_format"
                      className="h-10 bg-white px-3"
                      value={form.format}
                      onChange={(e) => setForm((p) => ({ ...p, format: e.target.value }))}
                    >
                      {formatosOferecidos.map((value) => (
                        <option key={value} value={value}>{t(GAME_DAY_FORMAT_LABELS[value])}</option>
                      ))}
                    </V2Select>
                    <p className="text-xs text-gray-500">{t('Dá para mudar na aba de jogos, enquanto não houver partidas.')}</p>
                  </div>
                  {isCourtByCourtFormat(form.format) && (
                    <div className="space-y-1.5">
                      <Label htmlFor="new_date_courts">{t('Quadras')}</Label>
                      <V2NumberInput
                        compacto
                        id="new_date_courts"
                        min={1}
                        max={12}
                        value={form.play_courts}
                        onChange={(e) => setForm((p) => ({ ...p, play_courts: e.target.value }))}
                        rotulo={t('Quadras')}
                        className="max-w-48"
                      />
                      <p className="text-xs text-gray-500">{t('Quantas quadras rodam ao mesmo tempo.')}</p>
                    </div>
                  )}
                </>
              )}
              {recurringOn && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="new_date_repeat">{t('Repetir semanalmente por (semanas)')}</Label>
                  <V2NumberInput compacto id="new_date_repeat" min={1} max={52}
                    value={form.repeat_weeks}
                    onChange={(e) => setForm((p) => ({ ...p, repeat_weeks: e.target.value }))}
                    rotulo={t('Semanas')} className="max-w-48" />
                  <p className="text-xs text-gray-500">{t('1 = só esta data. Ex.: 4 cria esta e mais 3 semanas seguidas.')}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <V2Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('Cancelar')}</V2Button>
                <V2Button type="submit" size="sm" disabled={addDate.isPending || createGameDay.isPending}>{t('Adicionar')}</V2Button>
              </div>
            </form>
          </div>
        </V2Surface>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : isError ? (
        <V2ErrorState
          title={t('Não foi possível carregar as datas do evento')}
          description={t('A conexão falhou. Elas continuam lá.')}
          onRetry={refetch}
        />
      ) : dates.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={showGames ? t('Nenhum dia de jogo cadastrado') : t('Nenhuma data cadastrada')}
          description={showGames ? t('Adicione o primeiro dia de jogo com local e horário.') : t('Adicione a primeira data com local e horário.')}
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
  // Só tocam em data que virou MÓDULO (`game_day_id` preenchido). No legado
  // ficam inertes — nada é lido nem escrito em `game_days`.
  const syncGameDay = useSyncEventGameDay(event);
  const archiveGameDay = useArchiveEventGameDay();
  const gameDayId = isModularEventDate(date) ? date.game_day_id : null;
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
      toast.error(err.message || t('Não foi possível responder.'));
    }
  };

  const handleSave = async () => {
    try {
      await updateDate.mutateAsync({ dateId: date.id, updates: form });
      // Editar a data aqui e o dia de jogo continuar marcado para o horário
      // antigo seria a mesma divergência de sempre, agora dentro de um
      // documento só. O repasse não pode derrubar o salvamento da data.
      if (gameDayId) {
        await syncGameDay.mutateAsync({ gameDayId, date: { ...date, ...form } }).catch(() => {});
      }
      toast.success(t('Atualizado.'));
      setEditing(false);
    } catch (err) {
      toast.error(err.message || t('Não foi possível salvar.'));
    }
  };

  const handleDelete = async () => {
    try {
      // Arquiva o dia de jogo ANTES de apagar a data: `deleteGameDay` tira os
      // resultados do ranking, e apagar a data primeiro deixaria um jogo
      // publicado contando no rating sem nada apontando para ele.
      if (gameDayId) await archiveGameDay.mutateAsync(gameDayId);
      await deleteDate.mutateAsync(date.id);
      toast.success(term === 'dia de jogo' ? t('Dia de jogo removido.') : t('Data removida.'));
      setConfirmDelete(false);
    } catch (err) {
      toast.error(err.message || t('Não foi possível remover.'));
    }
  };

  return (
    <V2Surface className="overflow-hidden rounded-xl">
      {/* Cabeçalho colapsável */}
      <V2Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-paper"
      >
        <div className="flex min-w-0 items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
          <CalendarDays className="h-4 w-4 shrink-0 text-green-600" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{formatDateTime(date.date_time)}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
              {date.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {date.location}</span>}
              <span>{grouped[RSVP_STATUS.GOING].length} confirmado(s)</span>
            </div>
          </div>
        </div>
        <V2Badge variant={myStatus === RSVP_STATUS.GOING ? 'success' : 'secondary'} className="shrink-0 rounded-full">
          {myStatus ? t(RSVP_STATUS_LABELS[myStatus]) : t('Responder')}
        </V2Badge>
      </V2Button>

      {open && (
        <div className="border-t border-gray-100 p-4">
          {showGames ? (
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="presenca"><Users className="mr-1.5 h-4 w-4" /> {t('Participação')}</TabsTrigger>
                <TabsTrigger value="jogos"><Swords className="mr-1.5 h-4 w-4" /> {t('Organização de jogos')}</TabsTrigger>
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
                {/* Data nova → o MÓDULO único (`game_days`); data anterior à
                    Onda AS → o organizador legado, inalterado. */}
                <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
                  <ClubGameDayTab event={event} clubId={clubId} date={date} rsvps={rsvps} />
                </Suspense>
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
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={term === 'dia de jogo' ? t('Remover dia de jogo') : t('Remover data')}
        description={term === 'dia de jogo' ? t('O dia de jogo, suas respostas, participantes e jogos serão removidos.') : t('A data, suas respostas, participantes e jogos serão removidos.')}
        confirmLabel={t('Remover')}
        destructive
        loading={deleteDate.isPending || archiveGameDay.isPending}
        onConfirm={handleDelete}
      />
    </V2Surface>
  );
}

function PresenceSection({ date, editing, setEditing, form, setForm, onSave, saving, onDeleteRequest, myStatus, grouped, onRsvp, rsvpPending }) {
  return (
    <div className="space-y-4">
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('Data e hora')}</Label>
            <Input type="datetime-local" value={form.date_time} onChange={(e) => setForm((p) => ({ ...p, date_time: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Local')}</Label>
            <Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} maxLength={160} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('Observação')}</Label>
            <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} maxLength={200} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <V2Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="mr-1 h-3.5 w-3.5" /> {t('Cancelar')}</V2Button>
            <V2Button size="sm" onClick={onSave} disabled={saving}><Check className="mr-1 h-3.5 w-3.5" /> {t('Salvar')}</V2Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-gray-500">
            {date.note ? <p>{date.note}</p> : <p className="text-gray-400">{t('Sem observações.')}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <V2Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)} title={t('Editar')}>
              <Pencil className="h-4 w-4" />
            </V2Button>
            <V2Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={onDeleteRequest} title={t('Excluir')}>
              <Trash2 className="h-4 w-4" />
            </V2Button>
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs uppercase tracking-wide text-gray-500">{t('Sua presença')}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.values(RSVP_STATUS).map((status) => (
            <V2Button
              key={status}
              size="sm"
              variant={myStatus === status ? 'default' : 'outline'}
              disabled={rsvpPending}
              onClick={() => onRsvp(status)}
            >
              {t(RSVP_STATUS_LABELS[status])} · {grouped[status].length}
            </V2Button>
          ))}
        </div>
      </div>

      {grouped[RSVP_STATUS.GOING].length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {grouped[RSVP_STATUS.GOING].map((r) => (
            <V2Badge key={r.id} tone="neutral" className="rounded-full font-normal">{r.user_name}</V2Badge>
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

