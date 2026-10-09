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
 * Sem arena gerida, nada é consultado. Uma contagem que FALHA não vira zero:
 * a arena fica fora de `pendingByArena` e `pendingError` acende.
 *
 * Sprint 0 (ARE-11 + ARE-20) do roadmap arena — `docs/arena-roadmap.md`.
 */

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { logger } from '@/core/lib/logger';
import { useMyManagedArenas } from './useArenas';
import { ARENA_COLLECTIONS, BOOKING_STATUS } from '../domain/constants';

const COL = ARENA_COLLECTIONS;

/**
 * Conta bookings REQUESTED em uma arena específica. Falha LANÇA: contar zero
 * numa leitura que falhou diria "nenhum pedido" com pedidos esperando.
 */
async function countPendingBookings(arenaId) {
  if (!db) return 0;
  const snap = await getDocs(
    query(
      collection(db, COL.bookings),
      where('arena_id', '==', arenaId),
      where('status', '==', BOOKING_STATUS.REQUESTED),
    ),
  );
  return snap.size;
}

export function useMyArenaSummary() {
  const { user } = useAuth();
  const { data: arenas = [], isLoading } = useMyManagedArenas();

  // Uma arena que falha não apaga as outras: cada contagem vem separada, e a
  // que falhou fica FORA de `pendingByArena` (desconhecida, nunca zero).
  const q = useQuery({
    queryKey: ['my-arena-pending-bookings', user?.uid, arenas.map((a) => a.id).join(',')],
    queryFn: async () => {
      const resultados = await Promise.allSettled(arenas.map((a) => countPendingBookings(a.id)));
      const counts = {};
      const failed = [];
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') counts[arenas[i].id] = r.value;
        else {
          failed.push(arenas[i].id);
          if (import.meta.env.DEV) {
            logger.warn('useMyArenaSummary: falha ao contar bookings', { arena_id: arenas[i].id, err: r.reason?.code });
          }
        }
      });
      return { counts, failed };
    },
    enabled: !!user?.uid && arenas.length > 0,
    staleTime: 30_000,
  });

  const pendingByArena = q.data?.counts || {};
  const totalPendingBookings = Object.values(pendingByArena).reduce((acc, n) => acc + n, 0);

  return {
    arenas,
    totalArenas: arenas.length,
    totalPendingBookings,
    pendingByArena,
    // Alguma contagem não veio: quem afirma "nada pendente" precisa saber.
    pendingError: q.isError || (q.data?.failed?.length || 0) > 0,
    pendingFailed: q.data?.failed || [],
    refetch: q.refetch,
    isLoading,
  };
}
