/**
 * useActivityFacts — os fatos da atividade da PESSOA LOGADA.
 *
 * Uma consulta (React Query, 5 min de cache) busca as fontes; o domínio monta os
 * fatos com o perfil. Separado de propósito: mudar o perfil (foto, cidade)
 * remonta os fatos na hora, sem buscar tudo de novo.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchActivitySources } from '@/modules/progression/services/activityFactsService';
import { buildActivityFacts } from '@/modules/progression/domain/activityFacts';

export const ACTIVITY_FACTS_KEY = (uid) => ['gamification-facts', uid];

/**
 * @param {string} uid
 * @param {object|null} profile perfil do usuário (`userProfile` do contexto de auth)
 * @param {boolean} [enabled]
 */
export function useActivityFacts(uid, profile, enabled = true) {
  const query = useQuery({
    queryKey: ACTIVITY_FACTS_KEY(uid),
    queryFn: () => fetchActivitySources(uid),
    enabled: !!uid && enabled,
    staleTime: 5 * 60_000,
  });
  const facts = useMemo(
    () => (query.data ? buildActivityFacts(query.data, { profile: profile ? { ...profile, uid } : { uid } }) : null),
    [query.data, profile, uid],
  );
  return {
    facts,
    sources: query.data || null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
