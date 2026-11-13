/**
 * O PÓDIO de uma divisão de liga — os três primeiros, DERIVADO dos jogos.
 *
 * Só liga ENCERRADA tem pódio (é quem organiza que encerra: até lá a tabela
 * ainda muda). De onde sai cada degrau:
 *
 *   • playoff jogado até a final → campeão e vice são os da FINAL; o 3º é o
 *     vencedor do jogo de 3º lugar e, sem esse jogo, o mais bem colocado na
 *     tabela da temporada entre os que não chegaram à final;
 *   • playoff começado e não terminado → sem pódio (a liga foi encerrada com a
 *     chave pela metade: ninguém foi campeão);
 *   • sem playoff (ou playoff nunca montado) → os três primeiros da tabela;
 *   • escada → os três primeiros da escada.
 *
 * Quem desistiu não sobe ao pódio; quem não jogou nenhuma partida também não.
 * Nada é gravado: a mesma conta vale na estante de troféus, na Carreira e na
 * página da liga.
 *
 * Puro: recebe os documentos já lidos.
 */
import { LEAGUE_STATUS } from './leagueFormats.js';
import { computeLadder, isLadderFormat } from './leagueLadder.js';
import { playoffState } from './leaguePlayoff.js';
import { computeLeagueStandings, hasResult } from './leagueResults.js';
import { normalizeSeason } from './leagueSeason.js';

const SEM_PODIO = Object.freeze({ complete: false, places: [] });

/**
 * @param {object} league liga (com `status`, `format`, `season`, `standings`)
 * @param {Array<object>} entries inscrições DA DIVISÃO (com `id`)
 * @param {Array<object>} matches jogos DA DIVISÃO (todas as fases)
 * @returns {{ complete: boolean, places: Array<{ position: 1|2|3, entryId: string, name: string, players: Array<{ uid: string|null, name: string }> }> }}
 */
export function leagueDivisionPodium(league, entries, matches) {
  if (!league || league.status !== LEAGUE_STATUS.FINISHED) return SEM_PODIO;
  const es = (Array.isArray(entries) ? entries : []).filter((e) => e?.id);
  const ms = Array.isArray(matches) ? matches : [];
  const porId = new Map(es.map((e) => [e.id, e]));
  let ids;

  if (isLadderFormat(league.format)) {
    const escada = computeLadder(es, ms.filter((m) => m.phase === 'ladder'), league.standings);
    if (!escada.sessions.some((s) => s.complete)) return SEM_PODIO;
    ids = escada.rows.filter((r) => r.position != null && r.sessions > 0).slice(0, 3).map((r) => r.entry_id);
  } else {
    const temporada = ms.filter((m) => m.phase !== 'playoff');
    const tabela = computeLeagueStandings(es, temporada, league.standings)
      .filter((r) => !r.withdrawn && r.played > 0)
      .map((r) => r.entry_id);
    const season = normalizeSeason(league.season);
    const po = playoffState(ms, { thirdPlace: season.playoff.third_place });
    if (po.stage === 'none') {
      if (!temporada.some(hasResult)) return SEM_PODIO;
      ids = tabela.slice(0, 3);
    } else if (po.stage === 'done') {
      const finalistas = [po.champion, po.runner_up];
      ids = [...finalistas, po.third || tabela.find((id) => !finalistas.includes(id))];
    } else {
      return SEM_PODIO;
    }
  }

  const places = ids
    .map((id, i) => ({ id, position: i + 1 }))
    .filter((p) => p.id && porId.has(p.id) && porId.get(p.id).status !== 'withdrawn')
    .map((p) => {
      const e = porId.get(p.id);
      return {
        position: p.position,
        entryId: e.id,
        name: e.name || '',
        players: (Array.isArray(e.players) ? e.players : []).map((j) => ({ uid: (j && j.uid) || null, name: String((j && j.name) || '').trim() })),
      };
    });
  return { complete: places.some((p) => p.position === 1), places };
}
