/**
 * marks — os MARCOS: o que merece uma comemoração.
 *
 * "Subiu para o tier Aprendiz!" é melhor que "nível 4" (lição final do estudo:
 * storytelling importa mais que número). Marco é o instante em que a pessoa
 * cruza uma linha que ela reconhece — subiu de tier, completou 100 jogos,
 * emendou 12 semanas.
 *
 * ## Comemorar uma vez, e só o que importa agora
 *
 * Cada marco tem uma chave estável (`tier_Aprendiz`, `games_100`, `streak_12`)
 * e, depois de comemorado, vai para `prefs.celebrated`. Dois cuidados:
 *
 *  1. **Quem chega já com história não leva uma chuva de confete.** A primeira
 *     vez que o app olha para um veterano, ele tem 8 marcos "novos". Dentro de
 *     cada FAMÍLIA (tier, jogos, vitórias, semanas) só o mais alto é
 *     comemorado; os de baixo são marcados como vistos em silêncio.
 *  2. **Comemoração é desligável** (`prefs.display.celebrations`): quem
 *     desligou não vê nada — mas os marcos continuam registrados, para não
 *     explodirem tudo de uma vez se ele religar.
 *
 * Lógica pura, sem I/O.
 */
import { TIERS } from './tiers.js';

const GAME_MARKS = [10, 25, 50, 100, 250, 500, 1000];
const WIN_MARKS = [10, 25, 50, 100, 250];
const STREAK_MARKS = [4, 8, 12, 26, 52];
const LEVEL_MARKS = [5, 10, 15, 20, 25, 30, 40, 50];

/** @typedef {{ key: string, family: string, rank: number, emoji: string, title: string, message: string, tone: 'gold'|'blue'|'green'|'purple' }} Mark */

function tierMarks(tierName) {
  const idx = TIERS.findIndex((t) => t.name === tierName);
  if (idx <= 0) return []; // Calouro é o ponto de partida: não se comemora
  return TIERS.slice(1, idx + 1).map((t, i) => ({
    key: `tier_${t.name}`,
    family: 'tier',
    rank: i + 1,
    emoji: t.icon,
    title: `Você subiu para ${t.name}!`,
    message: t.description,
    tone: t.tier >= 4 ? 'gold' : 'purple',
  }));
}

function countMarks(total, lista, family, emoji, titulo, mensagem, tone) {
  return lista.filter((n) => total >= n).map((n) => ({
    key: `${family}_${n}`, family, rank: n, emoji, title: titulo(n), message: mensagem(n), tone,
  }));
}

/**
 * Todos os marcos que a pessoa JÁ ALCANÇOU (comemorados ou não).
 *
 * @param {{ tier?: string, level?: number, games?: number, wins?: number, streakWeeks?: number,
 *   titles?: number, podiums?: number }} s
 * @returns {Mark[]}
 */
export function reachedMarks(s = {}) {
  const marks = [
    ...tierMarks(s.tier),
    ...countMarks(Number(s.level) || 0, LEVEL_MARKS, 'level', '⚡',
      (n) => `Nível ${n} alcançado!`, () => 'A curva de nível é longa — cada marco é seu.', 'blue'),
    ...countMarks(Number(s.games) || 0, GAME_MARKS, 'games', '🎾',
      (n) => `Seu ${n}º jogo!`, (n) => `${n} jogos disputados na plataforma.`, 'green'),
    ...countMarks(Number(s.wins) || 0, WIN_MARKS, 'wins', '🏆',
      (n) => `${n} vitórias!`, () => 'Cada vitória foi conquistada em quadra.', 'gold'),
    ...countMarks(Number(s.streakWeeks) || 0, STREAK_MARKS, 'streak', '🔥',
      (n) => `${n} semanas seguidas!`, () => 'Constância é o que separa quem joga de quem evolui.', 'gold'),
  ];
  if ((Number(s.titles) || 0) >= 1) {
    marks.push({ key: 'first_title', family: 'title', rank: 1, emoji: '👑', title: 'Seu primeiro título!', message: 'Campeão. Ninguém tira isso de você.', tone: 'gold' });
  }
  if ((Number(s.podiums) || 0) >= 1) {
    marks.push({ key: 'first_podium', family: 'podium', rank: 1, emoji: '🥉', title: 'Seu primeiro pódio!', message: 'Entre os três melhores.', tone: 'gold' });
  }
  return marks;
}

/**
 * Separa o que comemorar agora do que só registrar.
 *
 * @param {Mark[]} reached saída de `reachedMarks`
 * @param {Record<string, number>} celebrated `prefs.celebrated`
 * @returns {{ celebrate: Mark[], silent: string[] }}
 *   `celebrate`: no máximo UM por família (o mais alto); `silent`: chaves a
 *   registrar sem comemorar.
 */
export function pendingMarks(reached, celebrated = {}) {
  const novos = (reached || []).filter((m) => !celebrated[m.key]);
  const porFamilia = new Map();
  novos.forEach((m) => {
    const atual = porFamilia.get(m.family);
    if (!atual || m.rank > atual.rank) porFamilia.set(m.family, m);
  });
  const celebrate = [...porFamilia.values()];
  const celebrados = new Set(celebrate.map((m) => m.key));
  return { celebrate, silent: novos.filter((m) => !celebrados.has(m.key)).map((m) => m.key) };
}

/**
 * Planeja a gravação: tudo que foi visto (comemorado ou silenciado) entra no
 * mapa. Se a comemoração está desligada, TUDO entra como visto — só que nada é
 * mostrado.
 *
 * @returns {{ show: Mark[], record: Record<string, number> }}
 */
export function planCelebrations(reached, celebrated, { enabled = true, now = Date.now() } = {}) {
  const { celebrate, silent } = pendingMarks(reached, celebrated);
  const record = {};
  [...celebrate.map((m) => m.key), ...silent].forEach((k) => { record[k] = now; });
  return { show: enabled ? celebrate : [], record };
}
