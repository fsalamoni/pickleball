/**
 * V2DaySlotsDialog — o dia aberto: é aqui que se reserva.
 *
 * Aberto ao clicar num dia do calendário mensal (`V2BookingCalendar`).
 *
 * ## O fluxo, em duas telas e nenhuma pergunta repetida
 *
 *   calendário (o DIA) → esta tela (QUADRA e HORÁRIOS) → confirmar
 *   (avulsa ou recorrente, observações, convidados) → pedido enviado
 *
 * Antes eram as mesmas duas telas, mas a segunda **re-perguntava tudo**: data,
 * horário, "qualquer/específicas/todas", "avulso/recorrente". Quem já tinha
 * escolhido escolhia de novo, num vocabulário diferente — e as duas respostas
 * podiam se contradizer. Hoje a segunda tela CONFIRMA o que esta produziu.
 *
 * ## Duas leituras do mesmo dia
 *
 *  · **Por quadra** (padrão com mais de uma quadra) — a matriz quadra ×
 *    horário. Cada célula liga e desliga sozinha, então dá para pedir
 *    **quantas quadras e horários quiser**, inclusive horários diferentes em
 *    quadras diferentes;
 *  · **Por horário** — a lista agregada, para quem não se importa com qual
 *    quadra sai ("tanto faz": a arena atribui uma livre).
 *
 * A ordem da tela segue a intenção: resumo → **grade** → reservas do dia →
 * indisponibilidades. Quem abriu veio reservar; o resto é contexto.
 *
 * ## Regra de negócio
 *
 * Só `AVAILABLE` é selecionável (`isSlotSelectable`). REQUESTED, NEGOTIATING e
 * CONFIRMED bloqueiam o horário, e indisponibilidade da arena também — mas
 * todos continuam VISÍVEIS, porque ver a forma do dia é meio caminho para
 * escolher outro.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Calendar, X, ShoppingCart, Loader2, Users, Ban, Check, Clock, AlertCircle, MapPin,
  Trash2, UserPlus,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import {
  useArenaCourtSchedules,
  useArenaUnavailabilities,
} from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings, useUpdateBookingStatus } from '@/modules/arenas/hooks/useBookings';
import { useInviteToBooking } from '@/modules/arenas/hooks/useSharedBookings';
import { BOOKING_STATUS } from '@/modules/arenas/domain/constants';
import AthleteMultiPicker from '@/modules/athletes/components/AthleteMultiPicker';
import { useJoinWaitlist, useMyWaitlist } from '@/modules/arenas/hooks/useBookingWaitlist';
import { isOnWaitlist } from '@/modules/arenas/domain/booking_waitlist';
import {
  getSlotStatus,
  generateTimeSlots,
  isSlotSelectable,
  slotEndTime,
  SLOT_STATUS_COLORS,
  SLOT_STATUS_LABELS,
  SLOT_STATUS,
} from '@/modules/arenas/domain/slot_status';
import { weekdayOf } from '@/modules/arenas/domain/booking';
import { isCourtFreeForSlot } from '@/modules/arenas/domain/court_assignment';
import { formatPrice, totalBookingPrice, priceWithDurationText, bookingPriceInfo } from '@/modules/arenas/domain/pricing';
import { V2Button, V2Badge, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';
import BookingRequestDialog from '@/modules/arenas/components/BookingRequestDialog';
import CourtTimePicker from './CourtTimePicker';
import { sortSelection, summarizeSelection } from '@/modules/arenas/domain/bookingSelection';
import { arenaGameDayTimeRange, mergeGameDayBlocks } from '@/modules/games/domain/arenaGameDay';

const STEP = 60;

const STATUS_PRIORITY = {
  [SLOT_STATUS.PENDING]: 1,
  [SLOT_STATUS.CONFIRMED]: 2,
  [SLOT_STATUS.UNAVAILABLE]: 3,
  [SLOT_STATUS.AVAILABLE]: 0,
  [SLOT_STATUS.CLOSED]: 4,
  [SLOT_STATUS.COMPLETED]: 5,
};

const BOOKING_STATUS_LABELS = {
  requested: 'Solicitação em andamento',
  negotiating: 'Em negociação',
  confirmed: 'Reservado',
  pending_payment: 'Aguardando pagamento',
  checked_in: 'Check-in feito',
  cancelled: 'Cancelada',
  withdrawn: 'Desistência',
  completed: 'Concluída',
};

function statusBadgeTone(status) {
  if (status === 'confirmed' || status === 'checked_in' || status === 'completed') return 'green';
  if (status === 'requested' || status === 'negotiating' || status === 'pending_payment') return 'amber';
  if (status === 'cancelled' || status === 'withdrawn') return 'red';
  return 'neutral';
}

function timeOverlap(slotA, slotB) {
  // slot: { date, start, end } (HH:MM)
  if (slotA.date !== slotB.date) return false;
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const aS = toMin(slotA.start), aE = toMin(slotA.end);
  const bS = toMin(slotB.start), bE = toMin(slotB.end);
  return aS < bE && bS < aE;
}

function expandBookingSlots(booking) {
  // Aceita booking com .slots (array) OU .date+start+end (legacy)
  if (Array.isArray(booking.slots) && booking.slots.length > 0) return booking.slots;
  if (booking.date) return [{ date: booking.date, start: booking.start, end: booking.end }];
  return [];
}

export default function V2DaySlotsDialog({
  arena, arenaId, date, courtId: initialCourtId, courts = [], onClose,
  // Dias de jogo da arena NESTA data (flag `arena_game_day`). Sem eles — que é
  // o padrão — a tela é exatamente a de antes.
  gameDays = [],
}) {
  const { isAuthenticated, user } = useAuth();
  const { data: schedules = [], isLoading: loadingSchedules } = useArenaCourtSchedules(arenaId);
  const { data: bookings = [], isLoading: loadingBookings } = useArenaBookings(arenaId);
  const { data: unavailabilities = [], isLoading: loadingUnav } = useArenaUnavailabilities(arenaId);
  const cancelBooking = useUpdateBookingStatus();
  const inviteToBooking = useInviteToBooking();

  const [courtId, setCourtId] = useState(initialCourtId || '');
  const [selectedSlots, setSelectedSlots] = useState([]);
  // Duas leituras do mesmo dia: 'quadra' (matriz quadra × horário) e 'horario'
  // (lista agregada, "tanto faz a quadra"). A MATRIZ é o padrão quando há mais
  // de uma quadra, porque é o que a pessoa vem fazer: escolher onde e quando.
  // A lista agregada continua a um clique, para quem não se importa com qual
  // quadra sai.
  const [visao, setVisao] = useState('quadra');
  const [bookingOpen, setBookingOpen] = useState(false);
  // Cancelamento das próprias reservas (seleção múltipla) + convite.
  const [selectedCancel, setSelectedCancel] = useState([]); // booking ids
  const [inviteFor, setInviteFor] = useState(null); // booking a convidar
  const [inviteSel, setInviteSel] = useState([]);

  const weekday = weekdayOf(date);
  const dateLabel = useMemo(() => {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }, [date]);

  // Reservas ATIVAS do dia (REQUESTED, NEGOTIATING, CONFIRMED, PENDING_PAYMENT)
  const activeBookingsOfDay = useMemo(() => {
    if (!bookings) return [];
    return bookings
      .filter((b) => ['requested', 'negotiating', 'confirmed', 'pending_payment'].includes(b.status))
      .map((b) => ({ ...b, _slots: expandBookingSlots(b) }))
      .filter((b) => b._slots.some((s) => s.date === date))
      // Filtra por quadra se selecionada
      .filter((b) => !courtId || !b.court_id || b.court_id === courtId);
  }, [bookings, date, courtId]);

  /**
   * Os horários fechados NESTE dia.
   *
   * ⚠️ Sai dos bloqueios gravados MAIS os que o dia de jogo implica. Marcar um
   * dia de jogo grava uma cópia em `arena_unavailabilities`, e era só essa
   * cópia que a grade olhava — se ela não chegou (regra, rede, dia de jogo
   * criado antes de a cópia existir), a grade oferecia para reserva a quadra
   * que está com um dia de jogo em cima. O dia de jogo é a fonte; a cópia é
   * conveniência. `mergeGameDayBlocks` não duplica o que já foi gravado.
   */
  const unavailabilitiesOfDay = useMemo(() => {
    const todos = mergeGameDayBlocks(unavailabilities || [], gameDays || []);
    return todos
      .filter((u) => u.date === date)
      .filter((u) => !courtId || !u.court_id || u.court_id === courtId);
  }, [unavailabilities, gameDays, date, courtId]);

  // Slots do dia (1h cada, dentro dos schedules)
  const slotsWithStatus = useMemo(() => {
    if (loadingSchedules || loadingBookings || loadingUnav || weekday == null) return [];
    const daySchedules = schedules.filter(
      (s) => s.is_active !== false && Array.isArray(s.weekdays) && s.weekdays.includes(weekday),
    );
    if (daySchedules.length === 0) return [];

    const filteredSchedules = courtId
      ? daySchedules.filter((s) => !s.court_id || s.court_id === courtId)
      : daySchedules;
    if (filteredSchedules.length === 0) return [];

    const ranges = filteredSchedules.map((s) => ({ start: s.start_time, end: s.end_time }));
    const allTimes = new Set();
    for (const r of ranges) {
      const slots = generateTimeSlots(r.start, r.end, STEP);
      slots.forEach((t) => allTimes.add(t));
    }
    const times = Array.from(allTimes).sort();

    // Filtra bookings/unavs por court
    const dayBookings = activeBookingsOfDay.map((b) => ({ ...b, slots: b._slots }));
    const dayUnavs = unavailabilitiesOfDay;

    // Quando o atleta olha "Todas as quadras" e há mais de uma, o horário só
    // está de fato indisponível se TODAS as quadras estiverem ocupadas. Contamos
    // quantas quadras estão livres (schedule + sem reserva + sem indisponibilidade).
    const multiCourtAll = !courtId && courts.length > 1;
    const activeCourtList = courts.filter((c) => c.is_active !== false);

    return times.map((time) => {
      const slot = { date, start: time, end: slotEndTime(time, { date, schedules: filteredSchedules }) };
      const result = getSlotStatus({
        date, time,
        courtId: courtId || null,
        schedules: filteredSchedules,
        bookings: dayBookings,
        unavailabilities: dayUnavs,
      });

      // Encontra o booking específico (se houver) — pega o primeiro que cobre o slot
      const coveringBooking = dayBookings.find((b) =>
        b._slots.some((s) => timeOverlap(s, slot)),
      );
      // Encontra a unavailability que cobre
      const coveringUnav = dayUnavs.find((u) => {
        const uSlot = { date, start: u.start_time, end: u.end_time };
        return timeOverlap(uSlot, slot);
      });

      let status = result.status;
      let booking = coveringBooking || result.booking;
      let unavailability = coveringUnav || result.unavailability;
      let freeCourts = null;
      const totalCourts = activeCourtList.length;

      if (multiCourtAll && result.status !== SLOT_STATUS.CLOSED) {
        freeCourts = activeCourtList.filter((court) => {
          if (!isCourtFreeForSlot(court.id, { date: slot.date, start: slot.start, end: slot.end }, dayBookings, filteredSchedules)) {
            return false;
          }
          const blocked = dayUnavs.some((u) => (!u.court_id || u.court_id === court.id)
            && timeOverlap({ date, start: u.start_time, end: u.end_time }, slot));
          return !blocked;
        }).length;
        // Há quadra livre → o horário é selecionável, mesmo que outra quadra esteja ocupada.
        if (freeCourts > 0) {
          status = SLOT_STATUS.AVAILABLE;
          booking = null;
          unavailability = null;
        } else if (result.status === SLOT_STATUS.AVAILABLE) {
          // Nenhuma quadra livre, mas o base achava disponível → está tudo ocupado.
          status = SLOT_STATUS.CONFIRMED;
        }
      }

      // `end` viaja junto: é ele que a seleção usa, e quem o calculou aqui
      // tinha as janelas da quadra em mãos.
      return { time, end: slot.end, status, booking, unavailability, freeCourts, totalCourts, schedule: result.schedule };
    });
    // `courts` entra nas dependências: a contagem "N de M quadras livres" sai
    // dela, e sem isso o número congelava no que estivesse carregado no
    // primeiro render.
  }, [loadingSchedules, loadingBookings, loadingUnav, weekday, date, courtId, schedules, courts, activeBookingsOfDay, unavailabilitiesOfDay]);

  const quadrasAtivas = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const podeVerPorQuadra = !courtId && quadrasAtivas.length > 1;
  // Filtrou uma quadra (ou só há uma)? A matriz vira uma coluna só — volta
  // para a lista. Voltando a "todas", a matriz volta a ser o padrão.
  useEffect(() => { setVisao(podeVerPorQuadra ? 'quadra' : 'horario'); }, [podeVerPorQuadra]);

  /**
   * Escolher na matriz é escolher QUADRA e HORÁRIO de uma vez — e quantas
   * quadras e horários a pessoa quiser. Cada célula liga e desliga sozinha.
   */
  function pickCourtSlot(cid, time, end) {
    setSelectedSlots((prev) => {
      const existe = prev.some((x) => x.start === time && x.courtId === cid);
      if (existe) return prev.filter((x) => !(x.start === time && x.courtId === cid));
      return [...prev, { date, start: time, end: end || slotEndTime(time, { date }), courtId: cid }]
        .sort((a, b) => a.start.localeCompare(b.start) || String(a.courtId).localeCompare(String(b.courtId)));
    });
  }

  /** A seleção no formato do domínio: célula = quadra + dia + faixa. */
  const selecaoDeCelulas = useMemo(
    () => sortSelection(selectedSlots.map((x) => ({
      court_id: x.courtId || null, date: x.date, start: x.start, end: x.end,
    }))),
    [selectedSlots],
  );
  const nomePorQuadra = useMemo(
    () => new Map(courts.map((c) => [c.id, c.name])),
    [courts],
  );
  const resumo = useMemo(
    () => summarizeSelection(selecaoDeCelulas, nomePorQuadra),
    [selecaoDeCelulas, nomePorQuadra],
  );

  /** Só os status que existem na tela — a legenda não inventa cores. */
  const statusPresentes = useMemo(() => {
    const ordem = [
      SLOT_STATUS.AVAILABLE, SLOT_STATUS.PENDING, SLOT_STATUS.CONFIRMED,
      SLOT_STATUS.COMPLETED, SLOT_STATUS.UNAVAILABLE, SLOT_STATUS.CLOSED,
    ];
    const presentes = new Set(slotsWithStatus.map((x) => x.status));
    return ordem.filter((k) => presentes.has(k));
  }, [slotsWithStatus]);

  const quadrasDaSelecao = useMemo(
    () => Array.from(new Set(selectedSlots.map((x) => x.courtId || null))),
    [selectedSlots],
  );

  /**
   * O TOTAL, somado QUADRA A QUADRA — cada uma com a sua tabela.
   *
   * Antes o preço saía de uma quadra só, aplicada a todos os horários: com
   * duas quadras de tabelas diferentes, o número estava errado; e o rodapé
   * dizia "a partir de", que é a forma educada de não responder.
   */
  const preco = useMemo(() => {
    let total = 0;
    let minutos = 0;
    const taxas = new Set();
    quadrasDaSelecao.forEach((cid) => {
      const slotsDaQuadra = selectedSlots
        .filter((x) => (x.courtId || null) === cid)
        .map((x) => ({ date: x.date, start: x.start, end: x.end }));
      const r = totalBookingPrice(arena, { courtId: cid || courtId || null, slots: slotsDaQuadra });
      total += r.total;
      minutos += r.minutes;
      r.hourlyRates.forEach((t) => taxas.add(t));
    });
    return {
      total: Math.round(total * 100) / 100,
      horas: Math.round((minutos / 60) * 100) / 100,
      taxas: Array.from(taxas),
    };
  }, [arena, courtId, selectedSlots, quadrasDaSelecao]);

  // Resumo do dia
  const summary = useMemo(() => {
    const counts = { available: 0, pending: 0, confirmed: 0, unavailable: 0, closed: 0 };
    for (const s of slotsWithStatus) {
      if (s.status === SLOT_STATUS.AVAILABLE) counts.available += 1;
      else if (s.status === SLOT_STATUS.PENDING) counts.pending += 1;
      else if (s.status === SLOT_STATUS.CONFIRMED) counts.confirmed += 1;
      else if (s.status === SLOT_STATUS.UNAVAILABLE) counts.unavailable += 1;
      else counts.closed += 1;
    }
    return counts;
  }, [slotsWithStatus]);

  function toggleSlot(time) {
    const slot = slotsWithStatus.find((s) => s.time === time);
    if (!slot || !isSlotSelectable(slot.status)) return;
    setSelectedSlots((prev) => {
      const exists = prev.find((s) => s.start === time);
      if (exists) return prev.filter((s) => s.start !== time);
      // O fim NÃO é "o próximo horário da grade": numa arena com horário
      // partido (manhã e noite) isso virava uma reserva de nove horas. Quem
      // sabe onde a janela fecha é o domínio.
      const end = slot.end || slotEndTime(time, { date });
      return [...prev, { date, start: time, end, courtId: courtId || null }].sort((a, b) => a.start.localeCompare(b.start));
    });
  }

  function clearSelection() { setSelectedSlots([]); }

  function handleConfirm() {
    if (!isAuthenticated) return;
    if (selectedSlots.length === 0) return;
    setBookingOpen(true);
  }

  // Reservas do próprio usuário no dia (canceláveis por ele).
  const myBookingsOfDay = useMemo(
    () => activeBookingsOfDay.filter((b) => b.athlete_id === user?.uid && b.status !== BOOKING_STATUS.CANCELLED),
    [activeBookingsOfDay, user?.uid],
  );

  function toggleCancelSelect(id) {
    setSelectedCancel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function cancelOne(booking) {
    try {
      await cancelBooking.mutateAsync({ booking, status: BOOKING_STATUS.CANCELLED, options: { byManager: false } });
      setSelectedCancel((prev) => prev.filter((x) => x !== booking.id));
      toast.success('Reserva cancelada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível cancelar a reserva.');
    }
  }

  async function cancelSelected() {
    const targets = myBookingsOfDay.filter((b) => selectedCancel.includes(b.id));
    if (targets.length === 0) return;
    let ok = 0;
    for (const b of targets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await cancelBooking.mutateAsync({ booking: b, status: BOOKING_STATUS.CANCELLED, options: { byManager: false } });
        ok += 1;
      } catch { /* segue cancelando as demais */ }
    }
    setSelectedCancel([]);
    if (ok > 0) toast.success(`${ok} reserva(s) cancelada(s).`);
    else toast.error('Não foi possível cancelar as reservas selecionadas.');
  }

  async function sendInvites() {
    if (!inviteFor || inviteSel.length === 0) { setInviteFor(null); return; }
    try {
      await inviteToBooking.mutateAsync({ booking: inviteFor, invitees: inviteSel });
      toast.success('Convite(s) enviado(s).');
      setInviteFor(null);
      setInviteSel([]);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível convidar.');
    }
  }

  const loading = loadingSchedules || loadingBookings || loadingUnav;
  const hasAvailable = slotsWithStatus.some((s) => s.status === SLOT_STATUS.AVAILABLE);
  const noSchedule = !loading && slotsWithStatus.length === 0;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-organic-md sm:rounded-3xl" style={{ maxHeight: '90vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-700" />
              <h3 className="font-display text-lg font-bold text-ink capitalize">{dateLabel}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-ink"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Há dia de jogo neste dia? Diz isso ANTES dos horários: sem este
              aviso, quem clica num dia tomado por um dia de jogo vê só
              "indisponível" e conclui que a arena fechou sem motivo. */}
          {gameDays.length > 0 && (
            <div className="border-b border-acid/40 bg-acid/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60">Dia de jogo na arena</p>
              <ul className="mt-1.5 space-y-1">
                {gameDays.map((g) => (
                  <li key={g.id} className="text-sm text-ink">
                    <strong>{g.title}</strong>
                    <span className="text-gray-600"> · {(arenaGameDayTimeRange(g) ? `${arenaGameDayTimeRange(g).start}–${arenaGameDayTimeRange(g).end}` : '')}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-gray-600">
                As quadras usadas ficam fechadas para reserva neste horário. Para jogar, marque
                presença em <strong>Dias de jogo</strong>, na página da arena.
              </p>
            </div>
          )}

          {/* Filtro de quadra */}
          {courts.length > 1 && (
            <div className="border-b border-gray-100 p-4">
              <label className="block text-xs font-bold text-gray-500">Filtrar por quadra</label>
              <select
                value={courtId}
                onChange={(e) => { setCourtId(e.target.value); setSelectedSlots([]); }}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-paper-pure px-3 py-2 text-sm"
              >
                <option value="">Todas as quadras</option>
                {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Body scrollable */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : (
              <>
                {/* Resumo do dia */}
                <div className="border-b border-gray-100 bg-paper-pure p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Resumo do dia</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {/* Tudo aqui é contado em HORÁRIOS — e é o que o texto diz.
                        Antes o mesmo número saía como "2 solicitações em
                        andamento", o que fazia contar reservas; com várias
                        quadras, um horário ocupado não é uma reserva. */}
                    <V2Badge tone="green">
                      <Check className="h-3 w-3" /> {summary.available} {summary.available === 1 ? 'horário' : 'horários'}
                      {podeVerPorQuadra ? ' com quadra livre' : (summary.available === 1 ? ' disponível' : ' disponíveis')}
                    </V2Badge>
                    {summary.pending > 0 && (
                      <V2Badge tone="amber">
                        <AlertCircle className="h-3 w-3" /> {summary.pending} {summary.pending === 1 ? 'horário' : 'horários'} com solicitação em andamento
                      </V2Badge>
                    )}
                    {summary.confirmed > 0 && (
                      <V2Badge tone="red">
                        <Check className="h-3 w-3" /> {summary.confirmed} {summary.confirmed === 1 ? 'horário já reservado' : 'horários já reservados'}
                      </V2Badge>
                    )}
                    {summary.unavailable > 0 && (
                      <V2Badge tone="amber">
                        <Ban className="h-3 w-3" /> {summary.unavailable} {summary.unavailable === 1 ? 'horário indisponível' : 'horários indisponíveis'}
                      </V2Badge>
                    )}
                    {summary.closed > 0 && (
                      <V2Badge tone="neutral">
                        <X className="h-3 w-3" /> {summary.closed} {summary.closed === 1 ? 'horário fechado' : 'horários fechados'} (sem horário de funcionamento)
                      </V2Badge>
                    )}
                  </div>
                </div>

                {/* Grade de slots — PRIMEIRA coisa depois do resumo. Quem abre
                    este diálogo veio reservar; a lista de reservas dos outros e
                    as indisponibilidades vêm depois, como contexto. */}
                <div className="p-4">
                  {noSchedule ? (
                    <V2EmptyState
                      icon={Calendar}
                      title="Arena fechada neste dia"
                      description={
                        courtId
                          ? 'Esta arena não definiu horários abertos para esta quadra neste dia da semana.'
                          : 'A arena não definiu horários abertos para este dia da semana. Tente outro dia ou outra quadra.'
                      }
                    />
                  ) : (
                    <>
                      {/* Nada livre? Isso é um AVISO acima da grade, não uma
                          parede no lugar dela: ver a forma do dia (o que está
                          reservado, o que está bloqueado) é meio caminho para
                          escolher outro dia com consciência. */}
                      {!hasAvailable && (
                        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          <p className="font-bold">Sem horários livres neste dia.</p>
                          <p className="mt-0.5 text-xs">
                            Está tudo reservado, em negociação ou bloqueado pela arena. Veja abaixo
                            como o dia está, e tente outro dia — ou outra quadra no filtro acima.
                          </p>
                        </div>
                      )}

                      {/* Duas leituras do mesmo dia. "Por horário" responde
                          QUANDO; "Por quadra" responde ONDE — e essa segunda
                          pergunta não tinha resposta antes: o atleta via "2/3
                          quadras livres" sem saber quais. */}
                      {podeVerPorQuadra && (
                        <div className="mb-3 inline-flex rounded-full border border-gray-200 bg-paper p-1">
                          {[['horario', 'Por horário'], ['quadra', 'Por quadra']].map(([v, label]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setVisao(v)}
                              aria-pressed={visao === v}
                              className={cn(
                                'rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors',
                                visao === v ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Legenda: SÓ o que está na tela. Mostrar "Concluído" e
                          "Fechado" num dia que não tem nem um nem outro é
                          ruído que ensina a ignorar a legenda. */}
                      <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
                        {statusPresentes.map((k) => {
                          const c = SLOT_STATUS_COLORS[k];
                          return (
                            <div key={k} className="flex items-center gap-1">
                              <span className={cn('h-2.5 w-2.5 rounded-full', c.dot)} />
                              <span className="text-gray-600">{SLOT_STATUS_LABELS[k]}</span>
                            </div>
                          );
                        })}
                      </div>
                      {visao === 'quadra' ? (
                        <CourtTimePicker
                          date={date}
                          courts={quadrasAtivas}
                          schedules={schedules}
                          bookings={activeBookingsOfDay.map((b) => ({ ...b, slots: b._slots }))}
                          unavailabilities={unavailabilitiesOfDay}
                          selectedSlots={selectedSlots}
                          onPick={pickCourtSlot}
                        />
                      ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {slotsWithStatus.map(({ time, status, booking, unavailability, freeCourts, totalCourts }) => {
                          const c = SLOT_STATUS_COLORS[status];
                          const isSelected = selectedSlots.some((s) => s.start === time);
                          const canSelect = isSlotSelectable(status);
                          const showCourts = freeCourts != null && status === SLOT_STATUS.AVAILABLE;
                          const tooltip = (() => {
                            if (status === SLOT_STATUS.UNAVAILABLE) {
                              const reason = unavailability?.notes || 'Indisponível';
                              return `${time} · Indisponível: ${reason}`;
                            }
                            if (status === SLOT_STATUS.PENDING) {
                              return `${time} · Solicitação: ${booking?.athlete_name || 'outro atleta'}`;
                            }
                            if (status === SLOT_STATUS.CONFIRMED) {
                              return `${time} · Reservado: ${booking?.athlete_name || 'outro atleta'}`;
                            }
                            if (status === SLOT_STATUS.COMPLETED) {
                              return `${time} · Concluído`;
                            }
                            if (status === SLOT_STATUS.CLOSED) {
                              return `${time} · Fechado (sem horário)`;
                            }
                            if (showCourts) {
                              return `${time} · ${freeCourts} de ${totalCourts} quadra(s) livre(s)`;
                            }
                            return `${time} · ${SLOT_STATUS_LABELS[status]}`;
                          })();
                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={!canSelect}
                              onClick={() => toggleSlot(time)}
                              title={tooltip}
                              className={cn(
                                'flex flex-col items-center justify-center rounded-2xl border-2 p-3 transition-all',
                                c.bg, c.border,
                                isSelected && 'ring-2 ring-green-500 ring-offset-1',
                                canSelect ? 'hover:scale-[1.03] cursor-pointer' : 'cursor-not-allowed opacity-70',
                              )}
                            >
                              <div className={cn('font-display text-base font-bold', c.text)}>{time}</div>
                              <div className={cn('text-[10px] uppercase tracking-widest', c.text)}>
                                {SLOT_STATUS_LABELS[status]}
                              </div>
                              {(status === SLOT_STATUS.PENDING || status === SLOT_STATUS.CONFIRMED) && booking?.athlete_name && (
                                <div className="mt-1 truncate text-[9px] italic text-gray-600">
                                  {booking.athlete_name}
                                </div>
                              )}
                              {showCourts && !isSelected && (
                                <div className="mt-1 text-[9px] font-semibold text-green-700">
                                  {freeCourts}/{totalCourts} quadra{totalCourts === 1 ? '' : 's'}
                                </div>
                              )}
                              {isSelected && <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-green-700"><Check className="h-3 w-3" /> Selecionado</div>}
                            </button>
                          );
                        })}
                      </div>
                      )}
                    </>
                  )}
                </div>

                {/* Reservas existentes */}
                {activeBookingsOfDay.length > 0 && (
                  <div className="border-b border-gray-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        <Users className="mr-1 inline h-3 w-3" /> Reservas neste dia ({activeBookingsOfDay.length})
                      </p>
                      {selectedCancel.length > 0 && (
                        <button
                          type="button"
                          onClick={cancelSelected}
                          disabled={cancelBooking.isPending}
                          className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          <Trash2 className="h-3 w-3" /> Cancelar selecionadas ({selectedCancel.length})
                        </button>
                      )}
                    </div>
                    {myBookingsOfDay.length > 0 && (
                      <p className="mt-1 text-[11px] text-gray-400">
                        Marque suas reservas para cancelar em conjunto, ou cancele/convide em cada uma.
                      </p>
                    )}
                    <ul className="mt-2 space-y-2">
                      {activeBookingsOfDay
                        .sort((a, b) => {
                          // Ordena por horário do primeiro slot + status
                          const aTime = a._slots[0]?.start || '';
                          const bTime = b._slots[0]?.start || '';
                          if (aTime !== bTime) return aTime.localeCompare(bTime);
                          return (STATUS_PRIORITY[a.status] || 9) - (STATUS_PRIORITY[b.status] || 9);
                        })
                        .map((b) => {
                          const slotsText = b._slots
                            .map((s) => `${s.start}–${s.end}`)
                            .join(', ');
                          const courtName = b.court_id
                            ? courts.find((c) => c.id === b.court_id)?.name || 'Quadra'
                            : 'Qualquer quadra';
                          const mine = isAuthenticated && b.athlete_id === user?.uid;
                          const canCancel = mine && b.status !== BOOKING_STATUS.CANCELLED && b.status !== BOOKING_STATUS.COMPLETED;
                          const acceptedCount = Array.isArray(b.participants)
                            ? b.participants.filter((p) => p.status === 'accepted').length
                            : 0;
                          return (
                            <li key={b.id} className={cn(
                              'rounded-2xl border p-3 text-sm',
                              b.status === 'confirmed' ? 'border-red-200 bg-red-50/40' :
                              b.status === 'requested' || b.status === 'negotiating' ? 'border-amber-200 bg-amber-50/40' :
                              'border-gray-200 bg-paper',
                            )}>
                              <div className="flex flex-wrap items-center gap-2">
                                {canCancel && (
                                  <input
                                    type="checkbox"
                                    checked={selectedCancel.includes(b.id)}
                                    onChange={() => toggleCancelSelect(b.id)}
                                    className="h-4 w-4 rounded border-gray-300"
                                    aria-label="Selecionar reserva para cancelar"
                                  />
                                )}
                                <span className="font-bold text-ink">{b.athlete_name || 'Atleta'}</span>
                                {mine && <V2Badge tone="blue">Sua reserva</V2Badge>}
                                <V2Badge tone={statusBadgeTone(b.status)}>
                                  {BOOKING_STATUS_LABELS[b.status] || b.status}
                                </V2Badge>
                                {acceptedCount > 1 && (
                                  <V2Badge tone="neutral"><Users className="h-3 w-3" /> {acceptedCount}</V2Badge>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {slotsText}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {courtName}
                                </span>
                              </div>
                              {/* O valor com a DURAÇÃO ao lado, recalculado
                                  pela tabela: era aqui que várias reservas
                                  pendentes apareciam todas com o preço de uma
                                  hora, qualquer que fosse o tamanho delas. */}
                              {(() => {
                                const info = bookingPriceInfo(b, { arena });
                                if (info.value == null) return null;
                                return (
                                  <div className="mt-1 text-xs font-bold text-green-700">
                                    {info.text}
                                    {info.agreed && <span className="ml-1 font-normal text-gray-500">acordado</span>}
                                  </div>
                                );
                              })()}
                              {mine ? (
                                <>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => { setInviteFor(inviteFor?.id === b.id ? null : b); setInviteSel([]); }}
                                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-paper"
                                    >
                                      <UserPlus className="h-3 w-3" /> Convidar participantes
                                    </button>
                                    {canCancel && (
                                      <button
                                        type="button"
                                        onClick={() => cancelOne(b)}
                                        disabled={cancelBooking.isPending}
                                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                                      >
                                        <Trash2 className="h-3 w-3" /> Cancelar
                                      </button>
                                    )}
                                  </div>
                                  {inviteFor?.id === b.id && (
                                    <div className="mt-2 rounded-2xl border border-gray-100 bg-paper-pure p-3">
                                      <AthleteMultiPicker
                                        value={inviteSel}
                                        onChange={setInviteSel}
                                        exclude={[user?.uid, ...(b.participant_ids || []), ...(b.invited_ids || [])]}
                                        placeholder="Buscar atleta para convidar…"
                                      />
                                      <div className="mt-2 flex justify-end gap-2">
                                        <V2Button size="sm" variant="ghost" onClick={() => { setInviteFor(null); setInviteSel([]); }}>Fechar</V2Button>
                                        <V2Button size="sm" onClick={sendInvites} disabled={inviteToBooking.isPending || inviteSel.length === 0}>
                                          {inviteToBooking.isPending ? 'Enviando…' : `Convidar (${inviteSel.length})`}
                                        </V2Button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                isAuthenticated && b._slots[0] && (
                                  <div className="mt-2">
                                    <WaitlistButton arena={arena} slot={b._slots[0]} />
                                  </div>
                                )
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}

                {/* Indisponibilidades admin */}
                {unavailabilitiesOfDay.length > 0 && (
                  <div className="border-b border-gray-100 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      <Ban className="mr-1 inline h-3 w-3" /> Indisponibilidades ({unavailabilitiesOfDay.length})
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-gray-600">
                      {unavailabilitiesOfDay.map((u) => {
                        const courtName = u.court_id
                          ? courts.find((c) => c.id === u.court_id)?.name || 'Quadra'
                          : 'Todas as quadras';
                        return (
                          <li key={u.id} className="flex items-center gap-2">
                            <Ban className="h-3 w-3 shrink-0 text-orange-500" />
                            <span><strong>{u.start_time}–{u.end_time}</strong> · {courtName}</span>
                            {u.notes && <span className="italic text-gray-500">— {u.notes}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer: seleção + ação */}
          <div className="border-t border-gray-100 bg-paper p-4">
            {selectedSlots.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-green-700" />
                    <span className="text-sm font-bold text-ink">
                      {selectedSlots.length} horário{selectedSlots.length > 1 ? 's' : ''} selecionado{selectedSlots.length > 1 ? 's' : ''}
                    </span>
                    <button onClick={clearSelection} className="text-xs text-gray-500 underline">
                      Limpar
                    </button>
                  </div>
                  {/* O resumo diz QUADRA e HORÁRIOS, agrupado — é o que a
                      pessoa precisa reler antes de confirmar, e é a resposta
                      que faltava à pergunta "afinal eu pedi o quê?". */}
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                    {resumo.porQuadra.map((q) => (
                      <li key={q.court_id || 'qualquer'}>
                        <strong className="text-ink">{q.nome}</strong>
                        {' · '}
                        {q.slots.map((sl) => `${sl.start}–${sl.end}`).join(', ')}
                      </li>
                    ))}
                  </ul>
                  {preco.total > 0 && (
                    <div className="mt-1 text-base font-bold text-green-700">
                      Total: {formatPrice(preco.total)}
                      <span className="ml-1 text-xs font-normal text-gray-500">
                        · {priceWithDurationText(preco.total, preco.horas, preco.taxas).replace(`${formatPrice(preco.total)} · `, '')}
                      </span>
                    </div>
                  )}
                </div>
                <V2Button onClick={handleConfirm}>
                  Continuar
                </V2Button>
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400">
                {hasAvailable
                  ? 'Toque nos horários que quiser — pode ser mais de uma quadra e mais de um horário.'
                  : 'Sem horários disponíveis para selecionar neste dia.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {bookingOpen && (
        <BookingRequestDialog
          arena={arena}
          // A escolha inteira vai adiante como SELEÇÃO. O passo seguinte não
          // re-pergunta data, horário nem quadra: ele confirma o que já foi
          // escolhido e pergunta só o que falta (avulsa ou recorrente,
          // observações, convidados, pagamento).
          selection={selecaoDeCelulas}
          onClose={() => {
            setBookingOpen(false);
            clearSelection();
            onClose();
          }}
        />
      )}
    </>
  );
}

/**
 * WaitlistButton — atleta pede para ser avisado se um horário ocupado vagar
 * (flag booking_waitlist). Mostra estado "na lista" quando já inscrito.
 */
function WaitlistButton({ arena, slot }) {
  const join = useJoinWaitlist();
  const { user } = useAuth();
  const { data: myWaitlist = [] } = useMyWaitlist(true);
  const already = isOnWaitlist(myWaitlist, user?.uid, { ...slot, court_id: slot.court_id || null });

  if (already) {
    return <V2Badge tone="blue">Na lista de espera</V2Badge>;
  }
  return (
    <V2Button size="sm" variant="secondary" disabled={join.isPending}
      onClick={async () => {
        try {
          await join.mutateAsync({ arena_id: arena.id, date: slot.date, start: slot.start, end: slot.end, court_id: slot.court_id || null });
          toast.success('Você entrou na lista de espera. Avisaremos se vagar.');
        } catch (err) {
          toast.error(err?.message || 'Não foi possível entrar na lista.');
        }
      }}>
      Avise-me se vagar
    </V2Button>
  );
}
