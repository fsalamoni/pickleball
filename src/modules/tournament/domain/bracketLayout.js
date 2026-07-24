/**
 * Domínio puro do layout da árvore de chaves (flag bracket_tree).
 *
 * Recebe os jogos de mata-mata (chave dos vencedores) e os organiza em colunas
 * por rodada, ordenados por posição, com rótulos amigáveis (Final, Semifinal,
 * Quartas, Oitavas, …). Sem I/O.
 *
 * Um jogo de mata-mata tem `round` numérico e NÃO tem `group`. A chave dos
 * vencedores é `bracket` ausente ou 'wb' (exclui 'lb'/'gf' da dupla eliminação).
 */

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
 * Monta as colunas da árvore.
 * @param {Array} matches
 * @returns {{ columns: Array<{ round, label, matches: Array }>, totalRounds: number }}
 */
export function buildBracketColumns(matches = []) {
  const ko = (matches || []).filter(isWinnersBracketMatch);
  if (ko.length === 0) return { columns: [], totalRounds: 0 };

  const rounds = [...new Set(ko.map((m) => Number(m.round)))].sort((a, b) => a - b);
  const totalRounds = rounds[rounds.length - 1];

  const columns = rounds.map((round) => ({
    round,
    label: roundLabel(round, totalRounds),
    matches: ko
      .filter((m) => Number(m.round) === round)
      .slice()
      .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0)),
  }));

  return { columns, totalRounds };
}
