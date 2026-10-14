/**
 * "Hoje" — a abertura da Central da arena (Fase 3.3 do plano de UX).
 *
 * A faixa "Precisa de você" (acima das abas) já diz o que espera a arena;
 * aqui fica a AGENDA DO DIA: quem joga hoje, em que quadra, a que hora — a
 * pergunta que a recepção faz trinta vezes por dia. Lê as MESMAS consultas da
 * aba Reservas (mesma chave de cache). Com o módulo de operação ligado, a
 * rotina do dia (`children`) vem logo abaixo.
 */
import React from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import { todayISO, formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { arenaTodayAgenda } from '@/modules/arenas/domain/arenaToday';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function ArenaTodayPanel({ arena, onIrParaAba, children }) {
  const reservasQ = useArenaBookings(arena.id);
  const quadrasQ = useArenaCourts(arena.id);
  const hoje = todayISO();
  const agenda = arenaTodayAgenda(
    reservasQ.isError ? undefined : reservasQ.data,
    { hoje, courts: Array.isArray(quadrasQ.data) ? quadrasQ.data : [] },
  );

  return (
    <div className="space-y-6" data-secao-arena-gerir="hoje">
      <V2Surface>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">{t('Agenda de hoje · {data}', { data: formatDateShortBR(hoje) })}</h2>
          <div className="flex gap-2">
            <V2Button size="sm" variant="ghost" onClick={() => onIrParaAba('calendario')}>{t('Calendário')}</V2Button>
            <V2Button size="sm" variant="secondary" onClick={() => onIrParaAba('reservas')}>{t('Solicitações')}</V2Button>
          </div>
        </div>
        {reservasQ.isError ? (
          <V2ErrorState inline title={t('Não foi possível carregar as reservas de hoje')} description={t('A agenda continua lá — tente de novo.')} onRetry={() => reservasQ.refetch()} />
        ) : agenda === undefined || reservasQ.isLoading ? (
          <V2Skeleton lines={3} />
        ) : agenda.length === 0 ? (
          <V2EmptyState icon={CalendarDays} title={t('Nenhuma reserva confirmada para hoje')} description={t('As solicitações pendentes aparecem em Reservas.')} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {agenda.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="w-24 font-bold tabular-nums text-ink">{l.start}–{l.end}</span>
                <span className="flex-1 truncate text-ink">{l.athleteName}</span>
                {l.courtName && <V2Badge tone="neutral">{l.courtName}</V2Badge>}
                {l.checkedIn && <V2Badge tone="green"><Check className="h-3 w-3" aria-hidden /> {t('Chegou')}</V2Badge>}
              </li>
            ))}
          </ul>
        )}
      </V2Surface>
      {children}
    </div>
  );
}
