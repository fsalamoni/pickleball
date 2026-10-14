/**
 * Catálogo e cálculo de conquistas (lógica pura, sem I/O nem React).
 *
 * Cada conquista tem um predicado sobre um "resumo" do jogador (derivado de
 * `buildPlayerStats` + rating). `computeAchievements` separa desbloqueadas das
 * pendentes, preservando a ordem do catálogo.
 */

import { tk } from '@/core/i18n';

/** Catálogo ordenado (do mais fácil ao mais difícil), por trilha temática. */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_tournament', name: tk('Estreante'), description: tk('Participou do primeiro torneio.'), test: (s) => s.tournaments >= 1 },
  { id: 'first_win', name: tk('Primeira vitória'), description: tk('Venceu o primeiro jogo.'), test: (s) => s.wins >= 1 },
  { id: 'first_podium', name: tk('No pódio'), description: tk('Terminou entre os 3 primeiros.'), test: (s) => s.podiums >= 1 },
  { id: 'champion', name: tk('Campeão'), description: tk('Conquistou um título.'), test: (s) => s.titles >= 1 },
  { id: 'wins_10', name: tk('Dez de lá'), description: tk('Acumulou 10 vitórias.'), test: (s) => s.wins >= 10 },
  { id: 'wins_50', name: tk('Cinquentão'), description: tk('Acumulou 50 vitórias.'), test: (s) => s.wins >= 50 },
  { id: 'wins_100', name: tk('Centena de vitórias'), description: tk('Acumulou 100 vitórias.'), test: (s) => s.wins >= 100 },
  { id: 'played_25', name: tk('Pegando ritmo'), description: tk('Disputou 25 jogos.'), test: (s) => s.played >= 25 },
  { id: 'tournaments_10', name: tk('Maratonista'), description: tk('Disputou 10 torneios.'), test: (s) => s.tournaments >= 10 },
  { id: 'tournaments_25', name: tk('Veterano de quadra'), description: tk('Disputou 25 torneios.'), test: (s) => s.tournaments >= 25 },
  { id: 'played_100', name: tk('Centurião'), description: tk('Disputou 100 jogos.'), test: (s) => s.played >= 100 },
  { id: 'played_250', name: tk('Incansável'), description: tk('Disputou 250 jogos.'), test: (s) => s.played >= 250 },
  { id: 'podiums_10', name: tk('Frequentador do pódio'), description: tk('Subiu ao pódio 10 vezes.'), test: (s) => s.podiums >= 10 },
  { id: 'titles_5', name: tk('Colecionador de troféus'), description: tk('Conquistou 5 títulos.'), test: (s) => s.titles >= 5 },
  { id: 'titles_10', name: tk('Lenda'), description: tk('Conquistou 10 títulos.'), test: (s) => s.titles >= 10 },
  { id: 'rating_1100', name: tk('Em ascensão'), description: tk('Atingiu rating 1100.'), test: (s) => (s.rating || 0) >= 1100 },
  { id: 'rating_1300', name: tk('Elite'), description: tk('Atingiu rating 1300.'), test: (s) => (s.rating || 0) >= 1300 },
  { id: 'rating_1500', name: tk('Fora de série'), description: tk('Atingiu rating 1500.'), test: (s) => (s.rating || 0) >= 1500 },
  { id: 'week_streak_4', name: tk('Constância'), description: tk('Jogou em 4 semanas seguidas.'), test: (s) => (s.weekStreak || 0) >= 4 },
  { id: 'week_streak_12', name: tk('Rotina de atleta'), description: tk('Jogou em 12 semanas seguidas.'), test: (s) => (s.weekStreak || 0) >= 12 },
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
    weekStreak: Number(summary.weekStreak) || 0,
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
