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

/**
 * Normaliza qualquer rótulo de formato para os DOIS únicos formatos reais da
 * plataforma: 'singles' (individual) e 'doubles' (duplas). Só um rótulo
 * explicitamente 'singles' vira individual; qualquer outro — 'doubles',
 * 'americano', 'mexicano', 'king_of_court', vazio/indefinido — é DUPLAS,
 * porque nesses formatos os jogos são disputados em duplas.
 *
 * @param {string|null|undefined} format
 * @returns {'singles'|'doubles'}
 */
export function normalizeStatsFormat(format) {
  return format === MODALITY_FORMAT.SINGLES ? MODALITY_FORMAT.SINGLES : MODALITY_FORMAT.DOUBLES;
}

/**
 * Descobre o formato REAL de uma inscrição para fins de estatística.
 *
 * Regra do produto: o formato é uma propriedade do JOGO, não de quem está
 * cadastrado. Se a inscrição tem um PARCEIRO (mesmo um convidado avulso, sem
 * conta na plataforma — basta o nome), é DUPLAS, qualquer que seja o rótulo da
 * modalidade (inclusive 'americano'). Só é individual quando NÃO há parceiro E
 * a modalidade é explicitamente 'singles'.
 *
 * @param {{ player_b_user_id?: string, player_b_name?: string }|null|undefined} registration
 * @param {{ format?: string }|null|undefined} modality
 * @returns {'singles'|'doubles'}
 */
export function resolveEntryFormat(registration, modality) {
  const hasPartner = Boolean(
    registration?.player_b_user_id || String(registration?.player_b_name || '').trim(),
  );
  if (hasPartner) return MODALITY_FORMAT.DOUBLES;
  return normalizeStatsFormat(modality?.format);
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

      // Formato REAL (duplas quando há parceiro; americano conta como duplas).
      const format = resolveEntryFormat(entry?.registration, entry?.modality);
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
