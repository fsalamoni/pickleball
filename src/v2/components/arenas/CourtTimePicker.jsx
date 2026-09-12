/**
 * CourtTimePicker — a grade QUADRA × HORÁRIO, na visão do atleta.
 *
 * ## O buraco que ela fecha
 *
 * O calendário do atleta só sabia mostrar uma lista de horários. Com "Todas as
 * quadras", um horário livre aparecia como "2/3 quadras" — um número que não
 * diz QUAIS. Quem quisesse a quadra coberta, ou a quadra 1 de sempre, tinha de
 * trocar o filtro do topo uma vez por quadra e comparar de cabeça. Numa arena
 * de quatro quadras isso é quatro idas e voltas para responder uma pergunta
 * simples: "onde eu jogo às 19h?".
 *
 * A matriz responde de uma olhada. O admin já tinha a dele (`CourtDayGrid`);
 * esta é a do atleta, e a diferença não é cosmética:
 *
 *  · **não mostra nome de ninguém.** Para reservar basta saber que está
 *    ocupado; quem ocupou é assunto de quem ocupou;
 *  · **só o que está livre é clicável**, e clicar já ESCOLHE a quadra — o que
 *    tira a pergunta "afinal, em qual quadra eu caí?" do fim do fluxo;
 *  · **quantas quadras e horários a pessoa quiser**, no mesmo dia. Cada célula
 *    liga e desliga sozinha. Quem quer a quadra 1 às 19h e a quadra 2 às 20h
 *    marca as duas — o domínio (`bookingSelection`) junta o que dá para juntar
 *    e o serviço grava tudo num lote só.
 */

import React, { useMemo } from 'react';
import { cn } from '@/core/lib/utils';
import { weekdayOf } from '@/modules/arenas/domain/booking';
import {
  getSlotStatus, generateTimeSlots, isSlotSelectable, slotEndTime,
  SLOT_STATUS, SLOT_STATUS_COLORS, SLOT_STATUS_LABELS,
} from '@/modules/arenas/domain/slot_status';

const PASSO = 60;

/** Rótulo curtinho — na célula não cabe "Solicitação em andamento". */
const CURTO = {
  [SLOT_STATUS.AVAILABLE]: 'livre',
  [SLOT_STATUS.PENDING]: 'pedido',
  [SLOT_STATUS.CONFIRMED]: 'ocupado',
  [SLOT_STATUS.COMPLETED]: 'concluído',
  [SLOT_STATUS.UNAVAILABLE]: 'indisp.',
  [SLOT_STATUS.CLOSED]: '—',
};

export default function CourtTimePicker({
  date,
  courts = [],
  schedules = [],
  bookings = [],
  unavailabilities = [],
  selectedSlots = [],
  onPick,
}) {
  const weekday = weekdayOf(date);

  const quadras = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);

  /** As janelas que valem NESTE dia da semana. */
  const janelasDoDia = useMemo(
    () => (schedules || []).filter((s) => s?.is_active !== false
      && Array.isArray(s?.weekdays) && s.weekdays.includes(weekday)),
    [schedules, weekday],
  );

  /** Janelas de uma quadra (as sem `court_id` valem para todas). */
  const janelasDe = useMemo(
    () => (courtId) => janelasDoDia.filter((s) => !s.court_id || s.court_id === courtId),
    [janelasDoDia],
  );

  const horarios = useMemo(() => {
    const set = new Set();
    janelasDoDia.forEach((s) => generateTimeSlots(s.start_time, s.end_time, PASSO).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [janelasDoDia]);

  /** A matriz inteira, calculada uma vez. */
  const celulas = useMemo(() => {
    const mapa = new Map();
    horarios.forEach((time) => {
      quadras.forEach((court) => {
        const janelas = janelasDe(court.id);
        const { status } = getSlotStatus({
          date,
          time,
          courtId: court.id,
          schedules: janelas,
          bookings,
          unavailabilities,
        });
        mapa.set(`${time}|${court.id}`, {
          status,
          end: slotEndTime(time, { date, schedules: janelas }),
        });
      });
    });
    return mapa;
  }, [horarios, quadras, date, bookings, unavailabilities, janelasDe]);

  const estaSelecionado = (time, courtId) => selectedSlots
    .some((s) => s.start === time && (s.courtId || null) === courtId);

  if (quadras.length === 0 || horarios.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="w-full border-collapse text-center text-xs">
          <caption className="sr-only">
            Horários disponíveis por quadra em {date}. Escolha um horário livre na quadra em que quer jogar.
          </caption>
          <thead>
            <tr className="bg-paper">
              <th scope="col" className="sticky left-0 z-10 bg-paper px-2 py-2 text-left font-bold text-gray-500">
                Hora
              </th>
              {quadras.map((c) => (
                <th key={c.id} scope="col" className="min-w-[84px] px-2 py-2 font-bold text-ink">
                  {c.name || 'Quadra'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horarios.map((time) => (
              <tr key={time} className="border-t border-gray-100">
                <th scope="row" className="sticky left-0 z-10 bg-paper-pure px-2 py-1.5 text-left font-bold text-gray-600">
                  {time}
                </th>
                {quadras.map((court) => {
                  const celula = celulas.get(`${time}|${court.id}`) || { status: SLOT_STATUS.CLOSED };
                  const cor = SLOT_STATUS_COLORS[celula.status] || SLOT_STATUS_COLORS.closed;
                  const livre = isSlotSelectable(celula.status);
                  const marcado = estaSelecionado(time, court.id);
                  return (
                    <td key={court.id} className="p-0.5">
                      <button
                        type="button"
                        disabled={!livre}
                        onClick={() => onPick?.(court.id, time, celula.end)}
                        aria-pressed={marcado}
                        title={`${court.name || 'Quadra'} · ${time}${celula.end ? `–${celula.end}` : ''} · ${SLOT_STATUS_LABELS[celula.status]}`}
                        className={cn(
                          'flex h-10 w-full items-center justify-center rounded-lg border text-[10px] font-semibold transition-all',
                          cor.bg, cor.border, cor.text,
                          livre && 'cursor-pointer hover:ring-2 hover:ring-ink/20',
                          !livre && 'cursor-not-allowed opacity-70',
                          marcado && 'ring-2 ring-green-600 ring-offset-1',
                        )}
                      >
                        {marcado ? 'escolhido' : (CURTO[celula.status] || SLOT_STATUS_LABELS[celula.status])}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-5 text-gray-500">
        Toque nos horários <strong>livres</strong> que quiser — pode marcar
        <strong> mais de uma quadra</strong> e mais de um horário no mesmo dia.
      </p>
    </div>
  );
}
