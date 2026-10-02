/**
 * POR QUE alguns dos meus jogos não estão no ranking — a resposta para
 * "joguei 30 e o ranking mostra 12". Pura: recebe o histórico de torneios
 * (`buildParticipationHistory`) e os jogos de dia de jogo (`domain/myGames`).
 *
 * "Meu desempenho" conta TODOS os jogos da pessoa, sempre. O ranking conta só
 * os que dá para atribuir a gente de verdade:
 *
 *  - torneio público e fora do rascunho (`isTournamentRankingEligible`);
 *  - partida em que TODOS têm conta (uma inscrição só com o nome digitado tira
 *    a partida inteira — de todo mundo);
 *  - dia de jogo PUBLICADO por quem organiza, também sem convidado sem conta.
 *
 * Sem esta explicação a diferença parece defeito, e a pessoa não tem como agir.
 */

import { isTournamentRankingEligible } from '@/modules/tournament/domain/rankingEligibility.js';
import { registrationSlotsWithoutAccount } from '@/modules/tournament/domain/registrationAccounts.js';
import { OUT_OF_RANKING_REASON } from '@/modules/games/domain/myGames.js';

/**
 * @param {{ history?: Array, gameDayGames?: Array }} args
 * @returns {{
 *   totalFora: number,
 *   torneio: { semConta: number, torneioFora: number },
 *   diaDeJogo: { naoPublicado: number, convidado: number, pendente: number },
 *   dias: Array<{ id: string, label: string, jogos: number, motivo: string }>,
 * }}
 */
export function rankingCoverageSummary({ history = [], gameDayGames = [] } = {}) {
  const torneio = { semConta: 0, torneioFora: 0 };
  (Array.isArray(history) ? history : []).forEach((grupo) => {
    const elegivel = isTournamentRankingEligible(grupo?.tournament);
    (grupo?.entries || []).forEach((entry) => {
      const jogos = Number(entry?.ranking?.played) || 0;
      if (jogos === 0) return;
      if (!elegivel) { torneio.torneioFora += jogos; return; }
      if (registrationSlotsWithoutAccount(entry?.registration).length > 0) torneio.semConta += jogos;
    });
  });

  const diaDeJogo = { naoPublicado: 0, convidado: 0, pendente: 0 };
  const porDia = new Map();
  (Array.isArray(gameDayGames) ? gameDayGames : []).forEach((g) => {
    if (!g || g.ranked) return;
    const motivo = g.outReason || OUT_OF_RANKING_REASON.PENDING_SYNC;
    if (motivo === OUT_OF_RANKING_REASON.NOT_PUBLISHED) diaDeJogo.naoPublicado += 1;
    else if (motivo === OUT_OF_RANKING_REASON.GUEST) diaDeJogo.convidado += 1;
    else diaDeJogo.pendente += 1;
    if (!g.gameDayId) return;
    const atual = porDia.get(g.gameDayId) || { id: g.gameDayId, label: g.label || 'Dia de jogo', jogos: 0, motivo };
    atual.jogos += 1;
    porDia.set(g.gameDayId, atual);
  });

  const dias = Array.from(porDia.values())
    .sort((a, b) => b.jogos - a.jogos || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, 5);
  const totalFora = torneio.semConta + torneio.torneioFora
    + diaDeJogo.naoPublicado + diaDeJogo.convidado + diaDeJogo.pendente;
  return { totalFora, torneio, diaDeJogo, dias };
}
