/**
 * V2BookingCalendar — Calendário público MENSAL interativo (Sprint 5 + sw-v73.5).
 *
 * Mostra uma grade 7×6 do mês. Cada célula representa um dia e mostra:
 *  - Número do dia
 *  - Badge de status agregado (livre / ocupado / fechado)
 *
 * Comportamento:
 *  - Navegação ←/→ entre meses
 *  - Filtro por quadra (se houver mais de 1)
 *  - Legenda no topo
 *  - Clicar num dia ABRE o <V2DaySlotsDialog> com os slots horários daquele dia
 *  - Dentro do dialog, user pode selecionar 1+ slots e clicar "Solicitar reserva"
 *  - O BookingRequestDialog é aberto com `preselectedSlots` já preenchidos
 *    (data + horário + court_id se filtrou uma quadra)
 *
 * Status agregado por dia (1 cor por dia na grade):
 *  - "Fechado" cinza: arena sem schedule aberto naquele dia OU todos os
 *    slots são CLOSED. NÃO clicável.
 *  - "Disponível" verde: tem pelo menos 1 slot AVAILABLE
 *  - "Ocupado" amber/vermelho: tem slots mas todos PENDING/CONFIRMED.
 *    Clicável para ver detalhe (sem seleção).
 *
 * OCUPAÇÃO (o que a bolinha não dizia):
 *  - a bolinha responde "tem vaga?" e para por aí. Um dia com UM horário
 *    livre e um dia INTEIRO livre saíam idênticos, e a pessoa tinha de abrir
 *    um por um para descobrir. Agora cada dia mostra a BARRA de ocupação
 *    (verde = livre, âmbar = pendente, vermelho = reservado, laranja =
 *    bloqueado) e quantos horários ainda têm quadra livre;
 *  - e a conta passou a ser por QUADRA (`courts` no agregador): antes uma
 *    reserva às 19h numa quadra fazia as 19h contarem como ocupadas na arena
 *    inteira — com as outras duas quadras livres. Ver `calendar_aggregate.js`.
 *
 * Regras de negócio (PRD):
 *  - "Apenas aparece como fechado os dias/horários que forem descritos
 *    como fechados pelos admins da arena, ou os dias/horários que não
 *    forem definidos como abertos por eles."
 *  - getSlotStatus já implementa: retorna CLOSED se NÃO tem schedule
 *    aberto para aquele dia/horário, ou se admin marcou indisponibilidade.
 *  - closed = sem schedule aberto (admin não definiu horário)
 *  - unavailable = admin marcou indisponibilidade explícita
 *  - available = schedule aberto + sem booking
 *
 * Não depende de nenhum backend novo — só usa getSlotStatus() e os hooks
 * cacheados (useArenaCourts, useArenaCourtSchedules, useArenaBookings,
 * useArenaUnavailabilities).
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import {
  useArena,
  useArenaCourts,
  useArenaCourtSchedules,
  useArenaUnavailabilities,
} from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import {
  SLOT_STATUS_COLORS,
  SLOT_STATUS_LABELS,
} from '@/modules/arenas/domain/slot_status';
import {
  aggregateDayStatus,
  buildMonthGrid,
  indexBookingsByDate,
  indexUnavailabilitiesByDate,
  findFirstFreeDate,
} from '@/modules/arenas/domain/calendar_aggregate';
import { courtsWithoutSchedule } from '@/modules/arenas/domain/court_schedule';
import { V2Button, V2Skeleton } from '@/v2/ui/primitives';
import V2DaySlotsDialog from './V2DaySlotsDialog';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { useArenaGameDays } from '@/modules/games/hooks/useArenaGameDays';
import { arenaGameDayTimeRange } from '@/modules/games/domain/arenaGameDay';

const WEEKDAY_LABELS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function addMonths(yearMonth, delta) {
  const d = new Date(yearMonth + '-01T12:00:00');
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 7);
}

function isSameMonth(dateStr, yearMonth) {
  return dateStr.startsWith(yearMonth + '-');
}

/** A legenda possível, na ordem em que faz sentido ler. */
const LEGENDA = [
  { status: 'available', cor: 'bg-green-500', texto: 'Tem horário livre' },
  { status: 'pending', cor: 'bg-amber-500', texto: 'Reservas pendentes' },
  { status: 'confirmed', cor: 'bg-red-500', texto: 'Reservado' },
  { status: 'completed', cor: 'bg-green-400', texto: 'Concluído' },
  { status: 'unavailable', cor: 'bg-orange-500', texto: 'Indisponível (admin)' },
  { status: 'closed', cor: 'bg-gray-300', texto: 'Fechado (sem horário)' },
];

/** 'sex., 3 de out.' — sem o ano, que já está no cabeçalho do mês. */
function labelDoDia(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d, 12).toLocaleDateString('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** As faixas da barra de ocupação, na ordem em que se lê o dia. */
function faixasDeOcupacao(count = {}) {
  return [
    { key: 'available', cls: 'bg-green-500', n: count.available || 0 },
    { key: 'pending', cls: 'bg-amber-400', n: count.pending || 0 },
    { key: 'confirmed', cls: 'bg-red-400', n: count.confirmed || 0 },
    { key: 'unavailable', cls: 'bg-orange-400', n: count.unavailable || 0 },
  ].filter((f) => f.n > 0);
}

function isPast(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

export default function V2BookingCalendar({ arenaId, arena: arenaProp }) {
  const { isAuthenticated } = useAuth();
  const { data: arenaData } = useArena(arenaId);
  const arena = arenaProp || arenaData;
  const { data: courts = [], isLoading: loadingCourts } = useArenaCourts(arenaId);
  const { data: schedules = [], isLoading: loadingSchedules } = useArenaCourtSchedules(arenaId);
  const loadingEstrutura = loadingCourts || loadingSchedules;
  const { data: bookings = [] } = useArenaBookings(arenaId);
  const { data: unavailabilities = [] } = useArenaUnavailabilities(arenaId);
  // Dias de jogo da arena (flag `arena_game_day`). Eles JÁ bloqueiam os slots
  // por `arena_unavailabilities` — o que falta é DIZER que o motivo é um dia
  // de jogo, em vez de deixar a pessoa achar que a arena fechou sem razão.
  const gameDayOn = useFeatureFlag(FEATURE_FLAG.ARENA_GAME_DAY);
  const { data: arenaGameDays = [] } = useArenaGameDays(gameDayOn ? arenaId : null);

  const today = new Date().toISOString().slice(0, 10);
  const [yearMonth, setYearMonth] = useState(today.slice(0, 7));
  const [courtId, setCourtId] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null);

  const activeCourts = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const showCourtFilter = activeCourts.length > 1;

  const grid = useMemo(() => buildMonthGrid(yearMonth), [yearMonth]);

  // Filtra schedules por quadra selecionada (se for uma)
  const filteredSchedules = useMemo(() => {
    if (courtId === 'all') return schedules;
    return schedules.filter((s) => !s.court_id || s.court_id === courtId);
  }, [courtId, schedules]);

  // Filtra bookings/unavailabilities por quadra (filtro client-side)
  const filteredBookings = useMemo(() => {
    const active = bookings.filter((b) => ['requested', 'negotiating', 'confirmed'].includes(b.status));
    if (courtId === 'all') return active;
    return active.filter((b) => !b.court_id || b.court_id === courtId);
  }, [bookings, courtId]);

  const filteredUnavailabilities = useMemo(() => {
    if (courtId === 'all') return unavailabilities;
    return unavailabilities.filter((u) => !u.court_id || u.court_id === courtId);
  }, [unavailabilities, courtId]);

  // Reservas e bloqueios indexados por DATA. A grade faz 42 dias × quadras
  // consultas de status; sem o índice, cada uma varre a lista inteira da
  // arena. Mesmo resultado, uma fração do custo.
  const bookingsByDate = useMemo(() => indexBookingsByDate(filteredBookings), [filteredBookings]);
  const unavByDate = useMemo(
    () => indexUnavailabilitiesByDate(filteredUnavailabilities),
    [filteredUnavailabilities],
  );

  // Para cada dia do mês, calcula status agregado.
  // Sem filtro de quadra, a conta é por QUADRA (horas-quadra) — é o que
  // permite dizer "ainda há 2 de 3 quadras livres às 19h" em vez de pintar o
  // dia inteiro de vermelho por causa de uma reserva.
  const dayStatusMap = useMemo(() => {
    const map = new Map();
    for (const date of grid) {
      map.set(date, aggregateDayStatus({
        date,
        courtId: courtId === 'all' ? null : courtId,
        courts: courtId === 'all' ? activeCourts : null,
        schedules: filteredSchedules,
        bookings: bookingsByDate.get(date) || [],
        unavailabilities: unavByDate.get(date) || [],
      }));
    }
    return map;
  }, [grid, courtId, activeCourts, filteredSchedules, bookingsByDate, unavByDate]);

  // data → dias de jogo daquela data (respeitando o filtro de quadra).
  const gameDaysByDate = useMemo(() => {
    const map = new Map();
    if (!gameDayOn) return map;
    arenaGameDays.forEach((g) => {
      if (!g.date) return;
      const slots = Array.isArray(g.arena_slots) ? g.arena_slots : [];
      if (courtId !== 'all' && !slots.some((s) => s.court_id === courtId)) return;
      map.set(g.date, [...(map.get(g.date) || []), g]);
    });
    return map;
  }, [arenaGameDays, gameDayOn, courtId]);

  /** Os status que este mês realmente tem (só dias do mês, e não os passados). */
  const coresDoMes = useMemo(() => {
    const set = new Set();
    grid.forEach((date) => {
      if (!isSameMonth(date, yearMonth) || isPast(date)) return;
      const meta = dayStatusMap.get(date);
      if (meta?.dayStatus) set.add(meta.dayStatus);
    });
    return set;
  }, [grid, yearMonth, dayStatusMap]);

  /** Quantos dias deste mês ainda têm vaga — o resumo que evita abrir 30 dias. */
  const resumoDoMes = useMemo(() => {
    let comVaga = 0;
    let abertos = 0;
    grid.forEach((date) => {
      if (!isSameMonth(date, yearMonth) || isPast(date)) return;
      const meta = dayStatusMap.get(date);
      if (!meta || meta.isAllClosed) return;
      abertos += 1;
      if (meta.hasAvailable) comVaga += 1;
    });
    return { comVaga, abertos };
  }, [grid, yearMonth, dayStatusMap]);

  // Mês sem nenhuma vaga é um beco: a pessoa clica "próximo mês" no escuro,
  // sem saber se procura por mais um mês ou por seis. Só calculamos quando o
  // beco acontece — e a busca começa no mês que ela está vendo, não hoje.
  const proximoLivre = useMemo(() => {
    if (resumoDoMes.comVaga > 0 || schedules.length === 0) return null;
    const inicio = yearMonth > today.slice(0, 7) ? `${yearMonth}-01` : today;
    return findFirstFreeDate({
      from: inicio,
      days: 180,
      courtId: courtId === 'all' ? null : courtId,
      courts: courtId === 'all' ? activeCourts : null,
      schedules: filteredSchedules,
      bookings: filteredBookings,
      unavailabilities: filteredUnavailabilities,
    });
  }, [
    resumoDoMes.comVaga, schedules.length, yearMonth, today, courtId, activeCourts,
    filteredSchedules, filteredBookings, filteredUnavailabilities,
  ]);

  function handleDayClick(date) {
    if (!isAuthenticated) {
      toast.error('Faça login para reservar.');
      return;
    }
    const meta = dayStatusMap.get(date);
    if (!meta || meta.isAllClosed) return; // dia fechado
    setSelectedDate(date);
  }

  // Arena sem NENHUMA quadra com horário publicado: o calendário inteiro sai
  // cinza, e um mês de cinza sem explicação parece defeito da plataforma. Dizer
  // o que está acontecendo é mais honesto — e poupa a pessoa de navegar mês a
  // mês procurando um dia aberto que não existe.
  const semHorarioPublicado = !loadingEstrutura
    && activeCourts.length > 0
    && courtsWithoutSchedule(activeCourts, schedules).length === activeCourts.length;

  if (!arena) return <V2Skeleton lines={4} />;

  const [year, month] = yearMonth.split('-').map(Number);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const mesLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div className="space-y-3">
      {/* Header: navegação de mês + filtro de quadra */}
      <div className="flex flex-wrap items-center gap-2">
        <V2Button size="sm" variant="ghost" onClick={() => setYearMonth(addMonths(yearMonth, -1))}>
          <ChevronLeft className="h-4 w-4" /> Mês anterior
        </V2Button>
        <div className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-paper px-3 py-1.5 text-sm font-bold text-ink capitalize">
          <Calendar className="h-4 w-4 text-green-700" />
          {monthLabel}
        </div>
        <V2Button size="sm" variant="ghost" onClick={() => setYearMonth(addMonths(yearMonth, 1))}>
          Próximo mês <ChevronRight className="h-4 w-4" />
        </V2Button>
        {showCourtFilter && (
          <select
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
            className="rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm"
          >
            <option value="all">Todas as quadras</option>
            {activeCourts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Legenda: só as cores que ESTE mês tem. Uma legenda que descreve
          estados inexistentes ensina a pessoa a não olhar para ela. */}
      <div className="flex flex-wrap gap-2 text-xs">
        {LEGENDA.filter(({ status }) => coresDoMes.has(status)).map(({ status, cor, texto }) => (
          <div key={status} className="flex items-center gap-1">
            <span className={cn('h-3 w-3 rounded-full', cor)} />
            <span className="text-gray-600">{texto}</span>
          </div>
        ))}
        {gameDayOn && arenaGameDays.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-acid" />
            <span className="text-gray-600">Dia de jogo da arena</span>
          </div>
        )}
      </div>

      {/* Resumo do mês numa linha. Quem procura quadra quer saber "tem vaga?"
          ANTES de abrir trinta dias um por um — e, quando não tem, quer saber
          para onde ir em vez de clicar "próximo mês" no escuro. */}
      {!loadingEstrutura && activeCourts.length > 0 && !semHorarioPublicado && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
          {resumoDoMes.comVaga > 0 ? (
            <span className="text-gray-700">
              <strong className="text-ink">{resumoDoMes.comVaga}</strong>
              {resumoDoMes.comVaga === 1 ? ' dia com horário livre' : ' dias com horário livre'}
              {resumoDoMes.abertos > resumoDoMes.comVaga && ` (de ${resumoDoMes.abertos} abertos)`}
              {' '}em <span className="capitalize">{mesLabel}</span>.
            </span>
          ) : (
            <span className="font-bold text-ink">
              {resumoDoMes.abertos > 0
                ? <>Nenhum horário livre em <span className="capitalize">{mesLabel}</span>.</>
                : <>Nenhum dia aberto em <span className="capitalize">{mesLabel}</span>.</>}
            </span>
          )}
          {proximoLivre && (
            <V2Button size="sm" variant="secondary" onClick={() => setYearMonth(proximoLivre.slice(0, 7))}>
              Próximo dia livre: {labelDoDia(proximoLivre)}
            </V2Button>
          )}
          {resumoDoMes.abertos > 0 && (
            <span className="text-gray-500">A barra de cada dia mostra a ocupação — verde é o que está livre.</span>
          )}
        </div>
      )}

      {activeCourts.length === 0 && !loadingEstrutura && (
        <div className="rounded-2xl border border-gray-200 bg-paper p-4 text-sm text-gray-600">
          <p className="font-bold text-ink">Esta arena ainda não cadastrou quadras.</p>
          <p className="mt-0.5 text-xs">Assim que ela cadastrar, os horários aparecem aqui para reserva.</p>
        </div>
      )}
      {semHorarioPublicado && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-bold">Esta arena ainda não publicou os horários de funcionamento.</p>
          <p className="mt-0.5 text-xs">
            Enquanto isso, nenhum dia fica disponível para reserva. Fale com a arena pelo contato
            abaixo, ou volte depois.
          </p>
        </div>
      )}

      {/* Grade do mês */}
      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-paper">
        {/* Header da semana */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {WEEKDAY_LABELS_PT.map((wd) => (
            <div key={wd} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {wd}
            </div>
          ))}
        </div>
        {/* Dias */}
        <div className="grid grid-cols-7">
          {grid.map((date) => {
            const meta = dayStatusMap.get(date);
            const diasDeJogo = gameDaysByDate.get(date) || [];
            const inMonth = isSameMonth(date, yearMonth);
            const past = isPast(date);
            const isToday = date === today;
            const c = SLOT_STATUS_COLORS[meta.dayStatus];
            const closed = meta.isAllClosed;
            const clickable = inMonth && !past && !closed;
            // A OCUPAÇÃO do dia, em vez de dois números soltos. A barra é
            // proporcional (verde livre / âmbar pendente / vermelho reservado
            // / laranja bloqueado) e o rótulo diz em quantos horários ainda
            // existe quadra livre — a pergunta de quem está marcando.
            const faixas = faixasDeOcupacao(meta.count);
            const totalHoras = meta.total || 0;
            const livres = meta.freeTimes || 0;
            const ocupadoPct = Math.round((meta.occupancy || 0) * 100);
            const rotulo = (() => {
              if (livres > 0) return { texto: `${livres}h ${livres === 1 ? 'livre' : 'livres'}`, cls: 'text-green-700' };
              if ((meta.count?.pending || 0) + (meta.count?.confirmed || 0) > 0) {
                return { texto: 'Lotado', cls: 'text-red-600' };
              }
              if (meta.count?.unavailable) return { texto: 'Bloqueado', cls: 'text-orange-600' };
              return null;
            })();
            // Tooltip (e aria-label): o mesmo que a barra diz, por extenso —
            // no celular não existe hover, mas o leitor de tela existe.
            const tooltip = (() => {
              if (!inMonth) return '';
              const dia = labelDoDia(date);
              if (past) return `${dia} · já passou`;
              if (closed) return `${dia} · sem horários abertos`;
              const parts = [dia];
              parts.push(livres > 0
                ? `${livres} ${livres === 1 ? 'horário' : 'horários'} com quadra livre`
                : 'sem horário livre');
              if (totalHoras > 0) parts.push(`${ocupadoPct}% ocupado`);
              diasDeJogo.forEach((g) => {
                const faixa = arenaGameDayTimeRange(g);
                parts.push(`Dia de jogo: ${g.title}${faixa ? ` (${faixa.start}–${faixa.end})` : ''}`);
              });
              return parts.join(' · ');
            })();

            return (
              <button
                key={date}
                type="button"
                disabled={!clickable}
                onClick={() => handleDayClick(date)}
                title={tooltip}
                aria-label={tooltip || date}
                className={cn(
                  'flex min-h-[76px] flex-col items-stretch gap-1 border-b border-r border-gray-100 p-1.5 text-left transition-all',
                  !inMonth && 'bg-gray-50/50 text-gray-300',
                  inMonth && !past && !closed && 'hover:bg-green-50 cursor-pointer',
                  inMonth && past && 'bg-gray-50/30 text-gray-300 cursor-not-allowed',
                  inMonth && !past && closed && 'bg-gray-50/70 text-gray-400 cursor-not-allowed',
                  isToday && 'ring-2 ring-inset ring-green-500',
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn(
                    'text-xs font-bold',
                    isToday && 'text-green-700',
                    inMonth ? 'text-ink' : 'text-gray-300',
                  )}>
                    {Number(date.slice(-2))}
                  </span>
                  {inMonth && !past && !closed && (
                    <span className={cn('h-2 w-2 rounded-full', c.dot)} aria-label={SLOT_STATUS_LABELS[meta.dayStatus]} />
                  )}
                </div>
                {inMonth && !past && totalHoras > 0 && (
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                    {faixas.map((f) => (
                      <span key={f.key} className={cn('h-full', f.cls)} style={{ width: `${(f.n / totalHoras) * 100}%` }} />
                    ))}
                  </div>
                )}
                {inMonth && !past && rotulo && (
                  <span className={cn('text-[9px] font-bold leading-none', rotulo.cls)}>{rotulo.texto}</span>
                )}
                {inMonth && !past && diasDeJogo.length > 0 && (
                  <span className="truncate rounded-full bg-acid px-1.5 py-0.5 text-[9px] font-bold leading-none text-ink">
                    Dia de jogo
                  </span>
                )}
                {inMonth && past && (
                  <span className="text-[9px] text-gray-300">passou</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!isAuthenticated && (
        <p className="text-center text-xs text-gray-400">
          <Link to="/login" className="text-green-700 underline">Faça login</Link> para reservar.
        </p>
      )}

      {/* Dialog de slots do dia selecionado */}
      {selectedDate && (
        <V2DaySlotsDialog
          arena={arena}
          arenaId={arenaId}
          date={selectedDate}
          courtId={courtId === 'all' ? null : courtId}
          courts={activeCourts}
          gameDays={gameDaysByDate.get(selectedDate) || []}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
