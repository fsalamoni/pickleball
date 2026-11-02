/**
 * "Ligar em todos os meus jogos": quais dias de jogo mudam.
 *
 * Os que a pessoa CRIOU, de hoje em diante (ou sem data), fora os arquivados
 * e os que já estão como pedido. Dia que já passou não ganha câmera; dia de
 * outra pessoa é dela para decidir.
 *
 * @param {Array<object>} gameDays os dias de jogo da pessoa
 * @param {string} uid
 * @param {boolean} on
 * @param {string} today `AAAA-MM-DD` local
 * @returns {string[]} ids
 */
export function lineControlTargets(gameDays, uid, on, today) {
  if (!uid) return [];
  return (gameDays || [])
    .filter((g) => g?.id && g.created_by === uid && g.status !== 'archived')
    .filter((g) => !g.date || String(g.date) >= today)
    .filter((g) => (g.line_control === true) !== on)
    .map((g) => g.id);
}
