import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlayerH2HRecords } from '../services/headToHeadService.js';
import { buildHeadToHead, topRivals } from '../domain/headToHead.js';
import { publishedGameDayGamesQuery } from '@/modules/games/hooks/usePublishedGameDayGames';
import { gameDayGamesToH2HRecords } from '@/modules/games/domain/myGames';

/**
 * Confrontos diretos de um atleta, já agregados. Só busca quando habilitado.
 *
 * Junta as DUAS origens de jogo da plataforma: torneios (por inscrição) e os
 * dias de jogo publicados no ranking (por pessoa). 🐞 Antes só os torneios
 * entravam: quem jogava em dia de jogo não tinha confronto direto nenhum.
 *
 * Os dias de jogo são um complemento: se a leitura deles falhar, os confrontos
 * de torneio continuam aparecendo (e vice-versa não — o torneio é a base).
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
      const [torneios, diasDeJogo] = await Promise.allSettled([
        getPlayerH2HRecords(uid),
        qc.fetchQuery(publishedGameDayGamesQuery(uid)),
      ]);
      // O torneio é a base: se ele falha, a consulta falha (falha não é vazio).
      if (torneios.status === 'rejected') throw torneios.reason;
      const jogosDoDia = diasDeJogo.status === 'fulfilled' ? diasDeJogo.value : [];
      const records = [...torneios.value, ...gameDayGamesToH2HRecords(jogosDoDia)];
      const h2h = buildHeadToHead(records);
      // `incompleto`: os dias de jogo não carregaram — quem mostra pode dizer.
      return { h2h, rivals: topRivals(h2h), incompleto: diasDeJogo.status === 'rejected' };
    },
  });
}
