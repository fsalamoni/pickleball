/**
 * usePeople — nome e foto de um punhado de contas, pelo diretório de atletas.
 *
 * Compartilha o cache de `useAthlete` (mesma chave), então quem já foi visto em
 * outra tela não custa leitura. Quem não está no diretório (perfil escondido,
 * moderado) volta como "Atleta" — nunca o uid cru na cara de ninguém.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getAthlete } from '@/modules/athletes/services/athleteService';
import { getClub } from '@/modules/clubs/services/clubService';

/** @returns {{ people: Map<string, { name: string, photoUrl: string, known: boolean }>, isLoading: boolean }} */
export function usePeople(uids = []) {
  const unicos = useMemo(() => [...new Set((uids || []).filter(Boolean))].slice(0, 40), [uids]);
  const queries = useQueries({
    queries: unicos.map((uid) => ({
      queryKey: ['athlete', uid],
      queryFn: () => getAthlete(uid),
      staleTime: 5 * 60_000,
    })),
  });
  const people = useMemo(() => {
    const m = new Map();
    unicos.forEach((uid, i) => {
      const a = queries[i]?.data;
      m.set(uid, {
        name: a?.platform_name || a?.display_name || 'Atleta',
        photoUrl: a?.photo_url || '',
        known: Boolean(a),
      });
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unicos, queries.map((q) => q.dataUpdatedAt).join(',')]);
  return { people, isLoading: queries.some((q) => q.isLoading) };
}

/**
 * Nomes de clubes (para o placar de desafio entre clubes). Clube que a pessoa
 * não pode ler volta como "Clube" — a falha de leitura nunca derruba o placar.
 */
export function useClubNames(ids = []) {
  const unicos = useMemo(() => [...new Set((ids || []).filter(Boolean))].slice(0, 20), [ids]);
  const queries = useQueries({
    queries: unicos.map((id) => ({
      queryKey: ['club-name', id],
      queryFn: async () => {
        try { return (await getClub(id))?.name || null; } catch { return null; }
      },
      staleTime: 10 * 60_000,
    })),
  });
  return useMemo(() => {
    const m = new Map();
    unicos.forEach((id, i) => m.set(id, queries[i]?.data || 'Clube'));
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unicos, queries.map((q) => q.dataUpdatedAt).join(',')]);
}
