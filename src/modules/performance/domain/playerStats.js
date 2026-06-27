/**
 * Agregação pura do desempenho pessoal do jogador.
 *
 * Recebe o histórico de participações (já montado por
 * `tournament/domain/participation.js`, agrupado por torneio) e consolida um
 * resumo de desempenho: jogos, vitórias/derrotas, aproveitamento, pódios e
 * títulos — geral e por formato. Sem I/O: apenas transformação de dados.
 */

import { MODALITY_FORMAT, TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants';

/** Aproveitamento (0–1) a partir de vitórias e derrotas, ou null se não houve jogos decididos. */
export function winRate(wins, losses) {
  const decided = (Number(wins) || 0) + (Number(losses) || 0);
  if (decided === 0) return null;
  return (Number(wins) || 0) / decided;
}

function emptyBucket() {
  return { played: 0, wins: 0, losses: 0 };
}

function accumulate(bucket, ranking) {
  bucket.played += Number(ranking.played) || 0;
  bucket.wins += Number(ranking.wins) || 0;
  bucket.losses += Number(ranking.losses) || 0;
}

/**
 * Consolida o desempenho do jogador a partir do histórico agrupado por torneio.
 *
 * @param {Array<{ tournament: object|null, entries: Array<object> }>} history
 * @returns {{
 *   tournaments: number,
 *   registrations: number,
 *   played: number,
 *   wins: number,
 *   losses: number,
 *   winRate: number|null,
 *   titles: number,
 *   podiums: number,
 *   byFormat: Record<string, { played: number, wins: number, losses: number, winRate: number|null }>,
 * }}
 */
export function buildPlayerStats(history) {
  const groups = Array.isArray(history) ? history : [];

  const totals = emptyBucket();
  const byFormat = {};
  let registrations = 0;
  let titles = 0;
  let podiums = 0;

  groups.forEach((group) => {
    const finished = group?.tournament?.status === TOURNAMENT_STATUS.FINISHED;
    (group?.entries || []).forEach((entry) => {
      registrations += 1;
      const ranking = entry?.ranking;
      if (!ranking) return;

      accumulate(totals, ranking);

      const format = entry?.modality?.format || MODALITY_FORMAT.DOUBLES;
      if (!byFormat[format]) byFormat[format] = emptyBucket();
      accumulate(byFormat[format], ranking);

      // Pódios e títulos só contam em torneios já encerrados.
      if (finished && ranking.position) {
        if (ranking.position === 1) titles += 1;
        if (ranking.position <= 3) podiums += 1;
      }
    });
  });

  const byFormatWithRate = {};
  Object.entries(byFormat).forEach(([format, b]) => {
    byFormatWithRate[format] = { ...b, winRate: winRate(b.wins, b.losses) };
  });

  return {
    tournaments: groups.length,
    registrations,
    played: totals.played,
    wins: totals.wins,
    losses: totals.losses,
    winRate: winRate(totals.wins, totals.losses),
    titles,
    podiums,
    byFormat: byFormatWithRate,
  };
}
