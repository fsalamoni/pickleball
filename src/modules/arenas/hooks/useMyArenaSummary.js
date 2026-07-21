/**
 * useMyArenaSummary — hook leve para o sidebar/dashboard.
 *
 * Retorna:
 * - arenas: lista de arenas gerenciadas pelo user (via listMyManagedArenas)
 * - totalArenas: contagem
 * - totalPendingBookings: soma de reservas com status REQUESTED em todas
 *   as arenas (badge para o item "Minhas arenas" no sidebar)
 *
 * Implementação:
 * - 1 query de arena_managers (já fornecida por useMyManagedArenas)
 * - N queries em arena_bookings (1 por arena) — para arenas gerenciadas
 * - Tudo via React Query com staleTime de 30s (igual ao resto do app)
 *
 * Retorna contagens zeradas se o user não é manager de nenhuma arena
 * (mais barato que lançar queries desnecessárias).
 *
 * Sprint 0 (ARE-11 + ARE-20) do roadmap arena — `docs/arena-roadmap.md`.
 */

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyManagedArenas } from './useArenas';
import { ARENA_COLLECTIONS, BOOKING_STATUS } from '../domain/constants';

const COL = ARENA_COLLECTIONS;

/** Conta bookings REQUESTED em uma arena específica. */
async function countPendingBookings(arenaId) {
  if (!db) return 0;
  try {
    const snap = await getDocs(
      query(
        collection(db, COL.bookings),
        where('arena_id', '==', arenaId),
        where('status', '==', BOOKING_STATUS.REQUESTED),
      ),
    );
    return snap.size;
  } catch (err) {
    // Em caso de erro de permissão (ex: arena sem manager logado), retorna 0
    // silenciosamente para não quebrar o sidebar. Log em dev.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[useMyArenaSummary] falha ao contar bookings de ${arenaId}:`, err?.code);
    }
    return 0;
  }
}

export function useMyArenaSummary() {
  const { user } = useAuth();
  const { data: arenas = [], isLoading } = useMyManagedArenas();

  const { data: pendingByArena = {} } = useQuery({
    queryKey: ['my-arena-pending-bookings', user?.uid, arenas.map((a) => a.id).join(',')],
    queryFn: async () => {
      const counts = await Promise.all(
        arenas.map(async (a) => [a.id, await countPendingBookings(a.id)]),
      );
      return Object.fromEntries(counts);
    },
    enabled: !!user?.uid && arenas.length > 0,
    staleTime: 30_000,
  });

  const totalPendingBookings = Object.values(pendingByArena).reduce((acc, n) => acc + n, 0);

  return {
    arenas,
    totalArenas: arenas.length,
    totalPendingBookings,
    pendingByArena,
    isLoading,
  };
}
