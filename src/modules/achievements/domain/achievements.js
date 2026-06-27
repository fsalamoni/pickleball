/**
 * Catálogo e cálculo de conquistas (lógica pura, sem I/O nem React).
 *
 * Cada conquista tem um predicado sobre um "resumo" do jogador (derivado de
 * `buildPlayerStats` + rating). `computeAchievements` separa desbloqueadas das
 * pendentes, preservando a ordem do catálogo.
 */

/** Catálogo ordenado (do mais fácil ao mais difícil), por trilha temática. */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_tournament', name: 'Estreante', description: 'Participou do primeiro torneio.', test: (s) => s.tournaments >= 1 },
  { id: 'first_win', name: 'Primeira vitória', description: 'Venceu o primeiro jogo.', test: (s) => s.wins >= 1 },
  { id: 'first_podium', name: 'No pódio', description: 'Terminou entre os 3 primeiros.', test: (s) => s.podiums >= 1 },
  { id: 'champion', name: 'Campeão', description: 'Conquistou um título.', test: (s) => s.titles >= 1 },
  { id: 'wins_10', name: 'Dez de lá', description: 'Acumulou 10 vitórias.', test: (s) => s.wins >= 10 },
  { id: 'wins_50', name: 'Cinquentão', description: 'Acumulou 50 vitórias.', test: (s) => s.wins >= 50 },
  { id: 'tournaments_10', name: 'Maratonista', description: 'Disputou 10 torneios.', test: (s) => s.tournaments >= 10 },
  { id: 'played_100', name: 'Centurião', description: 'Disputou 100 jogos.', test: (s) => s.played >= 100 },
  { id: 'titles_5', name: 'Colecionador de troféus', description: 'Conquistou 5 títulos.', test: (s) => s.titles >= 5 },
  { id: 'rating_1100', name: 'Em ascensão', description: 'Atingiu rating 1100.', test: (s) => (s.rating || 0) >= 1100 },
  { id: 'rating_1300', name: 'Elite', description: 'Atingiu rating 1300.', test: (s) => (s.rating || 0) >= 1300 },
]);

/**
 * Normaliza o resumo do jogador para os campos usados pelos predicados.
 * @param {object} [summary]
 */
function normalizeSummary(summary = {}) {
  return {
    tournaments: Number(summary.tournaments) || 0,
    played: Number(summary.played) || 0,
    wins: Number(summary.wins) || 0,
    podiums: Number(summary.podiums) || 0,
    titles: Number(summary.titles) || 0,
    rating: Number.isFinite(summary.rating) ? summary.rating : 0,
  };
}

/**
 * Calcula conquistas desbloqueadas e pendentes a partir de um resumo do jogador.
 * @param {object} summary - `{ tournaments, played, wins, podiums, titles, rating }`
 * @returns {{ unlocked: Array<object>, locked: Array<object>, unlockedCount: number, total: number }}
 */
export function computeAchievements(summary) {
  const s = normalizeSummary(summary);
  const unlocked = [];
  const locked = [];
  ACHIEVEMENTS.forEach((a) => {
    const item = { id: a.id, name: a.name, description: a.description };
    if (a.test(s)) unlocked.push(item);
    else locked.push(item);
  });
  return { unlocked, locked, unlockedCount: unlocked.length, total: ACHIEVEMENTS.length };
}
