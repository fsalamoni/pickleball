/**
 * useGameRecords — os jogos da pessoa, num formato só, com QUEM jogou.
 *
 * Junta torneio (confrontos por inscrição), dia de jogo (espelho publicado e
 * fonte do dia) e liga, cada um com `at`, `won`, nomes, as CONTAS (uid) de parceiros e
 * adversários e a chave do jogo (`matchKey`) — o que a revisão da semana, a
 * avaliação pós-jogo e a carta ao companheiro consomem.
 *
 * A fonte que falhar não some em silêncio: `incomplete` diz qual faltou, e quem
 * mostra números avisa. Torneio é a base (se falha, o hook falha); dia de
 * jogo e liga são complemento.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tk } from '@/core/i18n';
import { getPlayerH2HRecords } from '@/modules/rating/services/headToHeadService';
import { useMyGameDayGames } from '@/modules/games/hooks/useGameDays';
import { useLeagueGamesOf } from '@/modules/leagues/hooks/useLeagues';
import { PLAYER_RECORDS_KEY } from './useProgression';

/**
 * @typedef {{
 *   at: number, won: boolean|null, source: 'tournament'|'game_day'|'league', label?: string,
 *   partner?: string, opponents?: string[], partnerUids: string[], opponentUids: string[],
 *   matchKey: string|null, kind?: string,
 * }} GameRecord
 */

/** Normaliza os formatos para `GameRecord`. Pura. */
export function toGameRecords({ tournamentRecords = [], gameDayGames = [], leagueGames = [] } = {}) {
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
  const solto = (source, padrao) => (g) => ({
    at: Number(g.at) || 0,
    won: typeof g.won === 'boolean' ? g.won : null,
    source,
    label: g.label || padrao,
    partner: g.partner || '',
    opponents: Array.isArray(g.opponents) ? g.opponents : [],
    partnerUids: g.partnerUids || [],
    opponentUids: g.opponentUids || [],
    matchKey: g.matchKey || null,
    kind: g.kind,
  });
  const deDia = (gameDayGames || []).map(solto('game_day', 'Dia de jogo'));
  const deLiga = (leagueGames || []).map(solto('league', 'Liga'));
  return [...deTorneio, ...deDia, ...deLiga].filter((r) => r.at > 0).sort((a, b) => b.at - a.at);
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
  const ligas = useLeagueGamesOf(uid, enabled);
  const records = useMemo(
    () => toGameRecords({ tournamentRecords: torneios.data || [], gameDayGames: dias.data || [], leagueGames: ligas.data || [] }),
    [torneios.data, dias.data, ligas.data],
  );
  const incomplete = [];
  if (torneios.isError) incomplete.push(tk('torneios'));
  if (dias.isError) incomplete.push(tk('dias de jogo'));
  if (ligas.isError) incomplete.push(tk('ligas'));
  return {
    records,
    isLoading: torneios.isLoading || dias.isLoading || ligas.isLoading,
    isError: torneios.isError && dias.isError && ligas.isError,
    incomplete,
    refetch: () => { torneios.refetch(); dias.refetch(); ligas.refetch(); },
  };
}
