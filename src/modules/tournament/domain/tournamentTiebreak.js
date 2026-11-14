/**
 * A ORDEM DE DESEMPATE do torneio — UMA só, nas regras gerais, valendo para
 * todas as modalidades e fases (pedido do Flavio, 2026-11-14).
 *
 * ## De onde a ordem vem
 *
 * 1. `tournaments.tiebreak_order` — a ordem das regras gerais (aba Geral da
 *    gestão). Com ela gravada, nada mais conta: a mesma ordem classifica todo
 *    grupo, todo pontos corridos, toda tabela e todo pódio do torneio.
 * 2. Torneio ANTIGO, de antes da regra única: a ordem que cada fase já tinha
 *    gravada (`stages[].tiebreak_order`). Nada foi migrado — mudar a ordem de
 *    um torneio em andamento mudaria classificações já vistas por todo mundo.
 *    Ela vale até o organizador salvar a ordem do torneio; a partir daí as
 *    ordens das fases são ignoradas (ficam no banco, sem efeito).
 * 3. A oficial (USA Pickleball 15.B.4).
 *
 * Modalidade de EQUIPES não entra: ela classifica pelos critérios do formato
 * de equipes (confrontos → etapas → pontos → confronto direto).
 *
 * Lógica pura: sem React, sem Firebase.
 */
import { DEFAULT_TIEBREAK_ORDER, normalizeTiebreakOrder } from './tiebreak.js';
import { BRACKET_FORMATS, normalizePhases } from './phases.js';

/** O torneio já tem a ordem nas regras gerais? */
export function hasTournamentTiebreak(tournament) {
  return Array.isArray(tournament?.tiebreak_order) && tournament.tiebreak_order.length > 0;
}

/**
 * A ordem que VALE numa fase (ou no torneio, sem fase).
 *
 * @param {object|null} tournament
 * @param {object|null} [phase] a fase (crua ou normalizada) — só importa no torneio antigo
 * @returns {string[]} nunca vazia
 */
export function effectiveTiebreakOrder(tournament, phase = null) {
  if (hasTournamentTiebreak(tournament)) return normalizeTiebreakOrder(tournament.tiebreak_order);
  const daFase = phase?.tiebreak_order;
  return normalizeTiebreakOrder(Array.isArray(daFase) && daFase.length ? daFase : DEFAULT_TIEBREAK_ORDER);
}

/** A modalidade classifica pelos critérios de equipes (não pela ordem do torneio). */
export const isTeamModality = (modality) => Boolean(modality?.team_config);

/**
 * O que está valendo no torneio inteiro — para a capa e para as regras gerais.
 *
 * `uniform`: uma ordem só para todas as fases que classificam por tabela (o
 * caso de todo torneio novo e de todo torneio antigo cujas fases concordam).
 * Senão, `variants` diz qual ordem vale onde — o torneio antigo cujas fases
 * foram configuradas com ordens diferentes, até o organizador unificar.
 *
 * @param {object|null} tournament
 * @param {Array<object>} [modalities]
 * @returns {{
 *   source: 'tournament'|'phases'|'default',
 *   uniform: boolean,
 *   order: string[],
 *   variants: Array<{ order: string[], where: Array<{ modalityId: string, modalityName: string, stageIndex: number }> }>,
 *   hasTeamModality: boolean,
 * }}
 */
export function tournamentTiebreakSummary(tournament, modalities = []) {
  const lista = Array.isArray(modalities) ? modalities : [];
  const hasTeamModality = lista.some(isTeamModality);
  if (hasTournamentTiebreak(tournament)) {
    const order = effectiveTiebreakOrder(tournament);
    return { source: 'tournament', uniform: true, order, variants: [], hasTeamModality };
  }

  // Torneio antigo: a ordem de cada fase que classifica por tabela (o
  // mata-mata decide pela chave, não por desempate).
  const porOrdem = new Map();
  let personalizada = false;
  lista.filter((m) => !isTeamModality(m)).forEach((m) => {
    normalizePhases(m.stages).forEach((fase, stageIndex) => {
      if (BRACKET_FORMATS.has(fase.type)) return;
      if (fase.tiebreak_order.length > 0) personalizada = true;
      const order = effectiveTiebreakOrder(null, fase);
      const chave = order.join('|');
      if (!porOrdem.has(chave)) porOrdem.set(chave, { order, where: [] });
      porOrdem.get(chave).where.push({ modalityId: m.id, modalityName: m.name || '', stageIndex });
    });
  });
  const variants = [...porOrdem.values()];
  if (variants.length <= 1) {
    const order = variants[0]?.order || [...DEFAULT_TIEBREAK_ORDER];
    return { source: personalizada ? 'phases' : 'default', uniform: true, order, variants: [], hasTeamModality };
  }
  return { source: 'phases', uniform: false, order: [...DEFAULT_TIEBREAK_ORDER], variants, hasTeamModality };
}
