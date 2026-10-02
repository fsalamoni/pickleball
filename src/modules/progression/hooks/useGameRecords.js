/**
 * useGameRecords — os jogos da pessoa, num formato só, com QUEM jogou.
 *
 * Junta torneio (confrontos por inscrição) e dia de jogo (espelho publicado e
 * fonte do dia), cada um com `at`, `won`, nomes, as CONTAS (uid) de parceiros e
 * adversários e a chave do jogo (`matchKey`) — o que a revisão da semana, a
 * avaliação pós-jogo e a carta ao companheiro consomem.
 *
 * A fonte que falhar não some em silêncio: `incomplete` diz qual faltou, e quem
 * mostra números avisa. Torneio é a base (se falha, o hook falha); o dia de
 * jogo é complemento.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPlayerH2HRecords } from '@/modules/rating/services/headToHeadService';
import { useMyGameDayGames } from '@/modules/games/hooks/useGameDays';
import { PLAYER_RECORDS_KEY } from './useProgression';

/**
 * @typedef {{
 *   at: number, won: boolean|null, source: 'tournament'|'game_day', label?: string,
 *   partner?: string, opponents?: string[], partnerUids: string[], opponentUids: string[],
 *   matchKey: string|null, kind?: string,
 * }} GameRecord
 */

/** Normaliza os dois formatos para `GameRecord`. Pura. */
export function toGameRecords({ tournamentRecords = [], gameDayGames = [] } = {}) {
  const deTorneio = (tournamentRecords || []).map((r) => ({
    at: Number(r.at) || 0,
    won: typeof r.won === 'boolean' ? r.won : null,
    source: 'tournament',
    label: 'Torneio',
    partner: '',
    opponents: String(r.opponent || '').split(' / ').map((s) => s.trim()).filter(Boolean),
    partnerUids: r.partnerUids || [],
    opponentUids: r.opponentUids || [],
    matchKey: r.matchKey || null,
  }));
  const deDia = (gameDayGames || []).map((g) => ({
    at: Number(g.at) || 0,
    won: typeof g.won === 'boolean' ? g.won : null,
    source: 'game_day',
    label: g.label || 'Dia de jogo',
    partner: g.partner || '',
    opponents: Array.isArray(g.opponents) ? g.opponents : [],
    partnerUids: g.partnerUids || [],
    opponentUids: g.opponentUids || [],
    matchKey: g.matchKey || null,
    kind: g.kind,
  }));
  return [...deTorneio, ...deDia].filter((r) => r.at > 0).sort((a, b) => b.at - a.at);
}

/**
 * @param {string} uid
 * @param {boolean} [enabled]
 */
export function useGameRecords(uid, enabled = true) {
  const torneios = useQuery({
    queryKey: PLAYER_RECORDS_KEY(uid),
    queryFn: () => getPlayerH2HRecords(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
  const dias = useMyGameDayGames();
  const records = useMemo(
    () => toGameRecords({ tournamentRecords: torneios.data || [], gameDayGames: dias.data || [] }),
    [torneios.data, dias.data],
  );
  const incomplete = [];
  if (torneios.isError) incomplete.push('torneios');
  if (dias.isError) incomplete.push('dias de jogo');
  return {
    records,
    isLoading: torneios.isLoading || dias.isLoading,
    isError: torneios.isError && dias.isError,
    incomplete,
    refetch: () => { torneios.refetch(); dias.refetch(); },
  };
}
