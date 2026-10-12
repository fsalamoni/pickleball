/**
 * Domínio puro do layout em COLUNAS POR RODADA (flag bracket_tree).
 *
 * Serve a dois casos que se parecem na tela, mas não são a mesma coisa:
 *  - **chave (mata-mata)**: as colunas são as fases finais — Oitavas, Quartas,
 *    Semifinal, Final —, contadas de trás para frente;
 *  - **grupo único / pontos corridos**: não há fases finais; as colunas são as
 *    RODADAS em que os jogos foram distribuídos ("Rodada 1", "Rodada 2"…).
 *
 * Chamar de "Final" a última rodada de um grupo seria mentira: quem termina em
 * 1º é decidido pela tabela, não por aquele jogo. Por isso o rótulo depende do
 * TIPO da fase, não do formato visual.
 *
 * Um jogo de mata-mata tem `round` numérico e NÃO tem `group`. A chave dos
 * vencedores é `bracket` ausente ou 'wb' (exclui 'lb'/'gf' da dupla eliminação).
 */

/** Tipos de fase eliminatória (só neles existem "fases finais"). */
const KNOCKOUT_STAGE_TYPES = new Set(['knockout', 'double_knockout']);

/**
 * Os jogos formam uma CHAVE (mata-mata) ou apenas rodadas de um grupo?
 *
 * Decide pelo TIPO da fase. Sem essa informação (jogos antigos), mantém o
 * comportamento clássico de chave — só rebaixa para "rodadas" quando sabe que a
 * fase não é eliminatória (pontos corridos, suíço, americana…).
 *
 * @param {Array} matches
 * @returns {boolean}
 */
export function isKnockoutSet(matches = []) {
  const list = matches || [];
  if (list.some((m) => m?.bracket)) return true; // wb/lb/gf só existem em chave
  const types = list.map((m) => m?.stage_type).filter(Boolean);
  if (types.length === 0) return true;
  return types.some((t) => KNOCKOUT_STAGE_TYPES.has(t));
}

/** É um jogo da chave dos vencedores (single/duplo — winners)? */
export function isWinnersBracketMatch(m) {
  if (!m) return false;
  if (m.group) return false; // fase de grupos não é árvore
  if (m.bracket && m.bracket !== 'wb') return false; // exclui repescagem/grande final
  return Number.isFinite(Number(m.round));
}

/** Rótulo da rodada a partir da distância até a final. */
export function roundLabel(round, totalRounds) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quartas de final';
  if (fromEnd === 3) return 'Oitavas de final';
  return `Rodada ${round}`;
}

/**
 * Monta as colunas por rodada.
 *
 * @param {Array} matches
 * @returns {{
 *   columns: Array<{ round: number, label: string, matches: Array }>,
 *   totalRounds: number,
 *   kind: 'bracket'|'rounds',
 * }}
 *   `kind` diz o que a coluna significa: fases finais de uma chave
 *   (`bracket`) ou rodadas de um grupo (`rounds`).
 */
export function buildBracketColumns(matches = []) {
  const all = (matches || []).filter(isWinnersBracketMatch);
  const ko = all.filter((m) => !m.third_place);
  if (ko.length === 0) return { columns: [], totalRounds: 0, kind: 'rounds', thirdPlace: null };

  const byPosition = (a, b) => (Number(a.position) || 0) - (Number(b.position) || 0);
  const knockout = isKnockoutSet(ko);

  if (!knockout) {
    const rounds = [...new Set(ko.map((m) => Number(m.round)))].sort((a, b) => a - b);
    const columns = rounds.map((round) => ({
      round,
      label: `Rodada ${round}`,
      matches: ko.filter((m) => Number(m.round) === round).slice().sort(byPosition),
    }));
    return { columns, totalRounds: rounds[rounds.length - 1], kind: 'rounds', thirdPlace: null };
  }

  // ⭐ A CHAVE INTEIRA, desde o sorteio. O tamanho sai da 1ª rodada (os byes
  // também são jogos gravados), não da última rodada que já existe.
  // 🐞 Antes a coluna era rotulada pela maior rodada GRAVADA: logo depois do
  // sorteio de 8, a 1ª rodada aparecia como "Final" e as próximas nem existiam
  // na tela. Agora as fases que ainda não nasceram aparecem como vagas
  // ("Vencedor do jogo 3"), na posição certa da árvore.
  const firstRound = Math.min(...ko.map((m) => Number(m.round)));
  const first = ko.filter((m) => Number(m.round) === firstRound);
  const firstSize = Math.max(first.length, ...first.map((m) => Number(m.position) || 0));
  const finalRound = firstRound + Math.ceil(Math.log2(Math.max(1, firstSize)));

  const columns = [];
  let numero = 0;
  for (let round = firstRound; round <= finalRound; round += 1) {
    const count = Math.ceil(firstSize / 2 ** (round - firstRound));
    const prevStart = numero - (columns.length ? columns[columns.length - 1].matches.length : 0);
    const cells = [];
    for (let position = 1; position <= count; position += 1) {
      numero += 1;
      const real = ko.find((m) => Number(m.round) === round && (Number(m.position) || 0) === position);
      const from = round === firstRound ? null : [prevStart + 2 * position - 1, prevStart + 2 * position];
      cells.push(real
        ? { ...real, number: numero, from }
        : { id: `vaga-${round}-${position}`, round, position, placeholder: true, number: numero, from });
    }
    columns.push({ round, label: roundLabel(round, finalRound), matches: cells });
  }

  const tp = all.find((m) => m.third_place) || null;
  return { columns, totalRounds: finalRound, kind: 'bracket', thirdPlace: tp };
}
