import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlayerH2HRecords } from '../services/headToHeadService.js';
import { buildHeadToHead, topRivals } from '../domain/headToHead.js';
import { publishedGameDayGamesQuery } from '@/modules/games/hooks/usePublishedGameDayGames';
import { gameDayGamesToH2HRecords } from '@/modules/games/domain/myGames';
import { fetchLeagueGames } from '@/modules/leagues/hooks/useLeagues';

/**
 * Confrontos diretos de um atleta, já agregados. Só busca quando habilitado.
 *
 * Junta as TRÊS origens de jogo da plataforma: torneios (por inscrição), os
 * dias de jogo publicados no ranking (por pessoa) e os jogos de liga que o
 * ranking conta. 🐞 Antes só os torneios entravam: quem jogava em dia de jogo
 * não tinha confronto direto nenhum.
 *
 * Dias de jogo e ligas são complemento: se a leitura deles falhar, os
 * confrontos de torneio continuam aparecendo (e vice-versa não — o torneio é a
 * base), com `incompleto` marcado.
 *
 * @param {string} uid
 * @param {boolean} [enabled]
 */
export function useHeadToHead(uid, enabled = true) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['head-to-head', uid],
    enabled: !!uid && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [torneios, diasDeJogo, ligas] = await Promise.allSettled([
        // A MESMA consulta que as datas de jogo usam (cache compartilhado).
        qc.fetchQuery({
          queryKey: ['player-h2h-records', uid],
          queryFn: () => getPlayerH2HRecords(uid),
          staleTime: 60_000,
        }),
        qc.fetchQuery(publishedGameDayGamesQuery(uid)),
        fetchLeagueGames(qc, uid),
      ]);
      // O torneio é a base: se ele falha, a consulta falha (falha não é vazio).
      if (torneios.status === 'rejected') throw torneios.reason;
      const jogosDoDia = diasDeJogo.status === 'fulfilled' ? diasDeJogo.value : [];
      const jogosDeLiga = (ligas.status === 'fulfilled' ? ligas.value : []).filter((g) => g.ranked);
      const records = [...torneios.value, ...gameDayGamesToH2HRecords([...jogosDoDia, ...jogosDeLiga])];
      const h2h = buildHeadToHead(records);
      // `incompleto`: dias de jogo ou ligas não carregaram — quem mostra pode dizer.
      return { h2h, rivals: topRivals(h2h), incompleto: diasDeJogo.status === 'rejected' || ligas.status === 'rejected' };
    },
  });
}
