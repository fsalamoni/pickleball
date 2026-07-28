/**
 * Hook para o ranking interno do clube (Wave C.2) — individual e
 * duplas, com opção de incluir fontes externas.
 *
 * Estratégia:
 *  1. `fetchClubInternalRankingSources(clubId, { includeExternal })`
 *     busca as 3 fontes em paralelo (clube + Wave C + torneios).
 *  2. `normalizeAllSources` + `filterMatchesForClub` (domínio puro)
 *     consolidam em uma lista filtrada de jogos.
 *  3. `computeClubRanking` (individual) e `computeDoublesRanking`
 *     (duplas) derivam as duas tabelas.
 *  4. `summarizeSources` informa o usuário de onde vêm os pontos
 *     (clube vs externos, duplas vs individuais).
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { fetchClubInternalRankingSources } from '../services/clubInternalRankingService';
import {
  normalizeAllSources,
  filterMatchesForClub,
  summarizeSources,
} from '../domain/clubRankingSources';
import { computeClubRanking } from '../domain/clubRanking';
import { computeDoublesRanking } from '@/modules/rating/domain/doublesRanking';

/**
 * @param {string} clubId
 * @param {{ includeExternal?: boolean }} [options]
 */
export function useClubInternalRanking(clubId, options = {}) {
  const { includeExternal = false } = options;
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-internal-ranking', clubId, includeExternal, user?.uid],
    queryFn: async () => {
      const sources = await fetchClubInternalRankingSources(clubId, { includeExternal });
      const normalized = normalizeAllSources(sources);
      const filtered = filterMatchesForClub(normalized, sources.clubUids, {
        includeClub: true,
        includeExternal,
      });
      const summary = summarizeSources(filtered);
      // Para o ranking individual do clube, mantemos TODOS os jogos
      // (singles + duplas); o atleta individual participou de um lado.
      const individual = computeClubRanking(filtered.map((m) => ({
        side_a: m.side_a.map((uid) => ({ id: uid, name: uid, user_id: uid })),
        side_b: m.side_b.map((uid) => ({ id: uid, name: uid, user_id: uid })),
        score_a: m.points_a,
        score_b: m.points_b,
      })));
      // Para o ranking de duplas, mantemos só matches de 2×2.
      const doubles = computeDoublesRanking(filtered.map((m) => ({
        side_a: m.side_a,
        side_b: m.side_b,
        winner: m.winner,
        points_a: m.points_a,
        points_b: m.points_b,
      })));
      return {
        sources: summary,
        clubUids: sources.clubUids,
        matches: filtered,
        individual,
        doubles,
        includeExternal,
      };
    },
    enabled: !!clubId,
    staleTime: 60_000,
  });
}
