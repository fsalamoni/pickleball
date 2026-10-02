import React, { useMemo } from 'react';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaReviews } from '@/modules/arenas/hooks/useArenas';
import { useArenaOpenSlots, useArenaClasses } from '@/modules/arenas/hooks/useArenaV3';
import { useArenaGameDays } from '@/modules/games/hooks/useArenaGameDays';
import { arenaMetrics, monthWindow } from '@/modules/progression/domain/supplyMetrics';
import { arenaSuggestions, computeArenaHealth } from '@/modules/progression/domain/supplyHealth';
import OwnerEngagementPanel from './OwnerEngagementPanel';
import HealthCard from './HealthCard';

/** Engajamento da arena: saúde, sugestões, metas, desafios e recompensas. @param {{ arena: { id: string, name?: string } }} props */
export default function ArenaEngagementPanel({ arena }) {
  const bookings = useArenaBookings(arena.id);
  const reviews = useArenaReviews(arena.id);
  const gameDays = useArenaGameDays(arena.id);
  const openSlots = useArenaOpenSlots(arena.id);
  const classes = useArenaClasses(arena.id);

  const ok = (q) => (q.isError ? undefined : q.data);
  const m = useMemo(() => arenaMetrics({
    bookings: ok(bookings), reviews: ok(reviews), gameDays: ok(gameDays), openSlots: ok(openSlots), classes: ok(classes),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [bookings.data, bookings.isError, reviews.data, reviews.isError, gameDays.data, gameDays.isError, openSlots.data, openSlots.isError, classes.data, classes.isError]);

  const health = useMemo(() => computeArenaHealth(m.health), [m.health]);
  const suggestions = useMemo(() => arenaSuggestions(m.health), [m.health]);

  const summary = <HealthCard health={health} suggestions={suggestions} unknown={m.unknown} title="Saúde da arena" basePath={`/arenas/${arena.id}/gerir`} />;
  return (
    <OwnerEngagementPanel ownerType="arena" issuer={{ type: 'arena', id: arena.id, name: arena.name }} summary={summary} actuals={m.actuals} monthKey={monthWindow().key} />
  );
}
