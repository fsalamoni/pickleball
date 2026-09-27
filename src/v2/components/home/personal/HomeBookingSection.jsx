/**
 * "Reservar quadra" na tela inicial — os HORÁRIOS LIVRES da arena de sempre.
 *
 * A arena de sempre é a da última reserva confirmada (ou a favorita). Os
 * horários saem da MESMA conta do calendário da arena (`arenaFreeTimesForDays`,
 * que usa `mergeArenaBlocks` + `freeTimesOfDay`) e das mesmas consultas —
 * abrir a arena depois não busca nada de novo.
 *
 * ⚠️ Ocupação só é afirmada com dado na mão: enquanto reservas ou bloqueios
 * carregam, ou se falharam, a seção NÃO diz que um horário está livre. É a
 * regra do calendário (docs/23 §12): mês sem reserva carregada parece mês
 * inteiro livre.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarClock, MapPin, Search } from 'lucide-react';
import { useArenaBookings, useMyBookings } from '@/modules/arenas/hooks/useBookings';
import {
  useArena, useArenaCourts, useArenaCourtSchedules, useArenaUnavailabilities, useMyFavoriteArenas,
} from '@/modules/arenas/hooks/useArenas';
import { useArenaGameDays } from '@/modules/games/hooks/useArenaGameDays';
import { useArenaClasses, useArenaInternalTournaments, useArenaOpenSlots } from '@/modules/arenas/hooks/useArenaV3';
import { addDaysISO } from '@/modules/arenas/domain/calendar';
import { arenaFreeTimesForDays, pickHomeArena, upcomingFreeTimes } from '@/modules/home/domain/homePlay';
import { agendaDayLabel } from '@/modules/home/domain/homeAgenda';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeEmpty, HomeSection } from './HomeSection';

function HorariosDaArena({ arenaId, nome, hoje, agora }) {
  const arena = useArena(arenaId);
  const quadras = useArenaCourts(arenaId);
  const janelas = useArenaCourtSchedules(arenaId);
  const reservas = useArenaBookings(arenaId);
  const bloqueios = useArenaUnavailabilities(arenaId);
  const diasDeJogo = useArenaGameDays(arenaId);
  const { data: vagasAbertas = [] } = useArenaOpenSlots(arenaId);
  const { data: aulas = [] } = useArenaClasses(arenaId);
  const { data: torneios = [] } = useArenaInternalTournaments(arenaId);

  const essenciais = [quadras, janelas, reservas, bloqueios, diasDeJogo];
  const carregando = essenciais.some((q) => q.isLoading);
  const falhou = essenciais.some((q) => q.isError);

  const livres = useMemo(() => {
    if (carregando || falhou) return [];
    const dias = arenaFreeTimesForDays([hoje, addDaysISO(hoje, 1)], {
      courts: quadras.data || [],
      schedules: janelas.data || [],
      bookings: reservas.data || [],
      unavailabilities: bloqueios.data || [],
      diasDeJogo: diasDeJogo.data || [],
      vagasAbertas,
      aulas,
      torneios,
    });
    return upcomingFreeTimes(dias, { agora, limite: 6 });
  }, [carregando, falhou, hoje, agora, quadras.data, janelas.data, reservas.data, bloqueios.data,
    diasDeJogo.data, vagasAbertas, aulas, torneios]);

  const nomeArena = arena.data?.name || nome || 'Sua arena';
  const link = `/arenas/${arenaId}#arena-reservar`;

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Livres em {nomeArena}
      </p>
      {carregando ? (
        <V2Skeleton className="h-16 rounded-3xl" />
      ) : falhou ? (
        <V2ErrorState
          inline
          title="Não carregou os horários da arena"
          description="Sem a agenda da arena não dá para dizer o que está livre."
          onRetry={() => essenciais.forEach((q) => q.isError && q.refetch())}
        />
      ) : livres.length === 0 ? (
        <HomeEmpty icon={CalendarClock} actions={<HomeAction to={link} primary>Ver outros dias</HomeAction>}>
          Hoje e amanhã já estão sem horário livre em {nomeArena}.
        </HomeEmpty>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={`Horários livres em ${nomeArena}`}>
          {livres.map((l) => (
            <li key={`${l.date}-${l.time}`}>
              <Link
                to={link}
                className="btn-press flex flex-col rounded-2xl border border-gray-100 bg-paper px-3.5 py-2 transition-colors hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
              >
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{agendaDayLabel(l.date, hoje)}</span>
                <span className="font-display text-lg font-bold leading-tight text-ink">{l.time}</span>
                <span className="text-[11px] text-gray-500">{l.freeCourts === 1 ? '1 quadra' : `${l.freeCourts} quadras`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HomeBookingSection({ reason, hoje, agora }) {
  const minhas = useMyBookings();
  const favoritas = useMyFavoriteArenas();
  const escolha = useMemo(
    () => pickHomeArena({ reservas: minhas.data || [], favoritas: favoritas.data || [] }),
    [minhas.data, favoritas.data],
  );
  const carregando = minhas.isLoading || favoritas.isLoading;
  const falhou = minhas.isError || favoritas.isError;

  return (
    <HomeSection id="reservar" icon={CalendarCheck} title="Reservar quadra" reason={reason} action={{ to: '/minhas-reservas', label: 'Minhas reservas' }}>
      <div className="space-y-4">
        {carregando ? (
          <V2Skeleton className="h-20 rounded-3xl" />
        ) : escolha ? (
          <HorariosDaArena arenaId={escolha.id} nome={escolha.name} hoje={hoje} agora={agora} />
        ) : falhou ? (
          <V2ErrorState
            inline
            title="Não carregou as suas arenas"
            description="As suas reservas continuam lá."
            onRetry={() => { minhas.refetch(); favoritas.refetch(); }}
          />
        ) : (
          <HomeEmpty icon={Search} actions={<HomeAction to="/arenas" primary>Encontrar uma arena</HomeAction>}>
            Reserve uma vez (ou favorite uma arena) e os horários livres dela aparecem aqui.
          </HomeEmpty>
        )}
        {escolha && (
          <div className="flex flex-wrap gap-2">
            <HomeAction to="/arenas"><Search className="h-3.5 w-3.5" aria-hidden="true" /> Outras arenas</HomeAction>
          </div>
        )}
      </div>
    </HomeSection>
  );
}
