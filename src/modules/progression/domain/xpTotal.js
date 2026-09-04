/**
 * xpTotal — composição do XP total do atleta (lógica pura, sem I/O).
 *
 * Por que existe: o XP vinha SÓ das cinco fontes de estatística de torneio
 * (partidas, vitórias, pódios, títulos, torneios). Conquista com bônus e
 * missão concluída não valiam nada — o catálogo tem 42.100 XP em bônus de
 * conquista que nunca eram creditados, e cada missão prometia "+30 XP" na
 * tela sem entregar. A recompensa era decorativa.
 *
 * Aqui as três parcelas viram um total só:
 *
 *   XP = atividade  +  bônus de conquista  +  XP de missão
 *
 * **Por que isso não abre farm**: nenhuma parcela é um contador que a UI
 * incrementa. Cada uma é DERIVADA de um fato que só existe uma vez:
 *  - atividade → estatísticas reais de jogo;
 *  - conquista → documento em `user_achievements_v2` (idempotente por id);
 *  - missão → documento do dia (um por dia, progresso medido, nunca regride).
 * Recalcular do zero sempre dá o mesmo número.
 */
import { computeXpV2 } from './progressionV2.js';
import { ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2.js';
import { MISSION_BONUS_XP } from './missions.js';

/** Bônus de XP por id de conquista, indexado uma vez. */
const BONUS_POR_CONQUISTA = ACHIEVEMENTS_V2.reduce((acc, a) => {
  if (a?.id && a.xpBonus > 0) acc[a.id] = a.xpBonus;
  return acc;
}, Object.create(null));

/**
 * Soma o bônus das conquistas REGISTRADAS do atleta.
 *
 * Usa os ids persistidos (não o cálculo ao vivo): conquista só vale XP
 * depois de virar documento, então o número não oscila entre renders.
 *
 * @param {Iterable<string>} unlockedIds ids de `user_achievements_v2`
 * @returns {number}
 */
export function achievementBonusXp(unlockedIds) {
  if (!unlockedIds) return 0;
  let total = 0;
  const vistos = new Set();
  for (const id of unlockedIds) {
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    total += BONUS_POR_CONQUISTA[id] || 0;
  }
  return total;
}

/**
 * Soma o XP das missões concluídas nos documentos informados.
 *
 * Uma missão vale XP quando o progresso medido alcançou o alvo. O bônus de
 * "todas do dia" só entra quando o atleta resgatou.
 *
 * @param {Array<{scope?: string, missions?: Array<object>, bonusClaimed?: boolean}>} missionDocs
 * @returns {number}
 */
export function missionXp(missionDocs) {
  if (!Array.isArray(missionDocs)) return 0;
  let total = 0;
  for (const doc of missionDocs) {
    if (!doc || !Array.isArray(doc.missions)) continue;
    let todasFeitas = doc.missions.length > 0;
    for (const m of doc.missions) {
      const alvo = Number(m?.target) || 1;
      const atual = Number(m?.current) || 0;
      if (atual >= alvo) total += Math.max(0, Number(m?.xp) || 0);
      else todasFeitas = false;
    }
    if (todasFeitas && doc.bonusClaimed) {
      total += MISSION_BONUS_XP[doc.scope] || 0;
    }
  }
  return total;
}

/**
 * XP total do atleta, com a origem de cada parcela.
 *
 * A separação importa para a interface poder explicar de onde veio o número
 * — "ganhei XP e não sei por quê" é pior que não ganhar.
 *
 * @param {{
 *   statsSources?: Record<string, number>,
 *   unlockedAchievementIds?: Iterable<string>,
 *   missionDocs?: Array<object>,
 * }} args
 * @returns {{ xpTotal: number, breakdown: { activity: number, achievements: number, missions: number } }}
 */
export function computeTotalXpV2({
  statsSources = {},
  unlockedAchievementIds = null,
  missionDocs = null,
} = {}) {
  const activity = Math.max(0, computeXpV2(statsSources).xpTotal || 0);
  const achievements = achievementBonusXp(unlockedAchievementIds);
  const missions = missionXp(missionDocs);
  return {
    xpTotal: activity + achievements + missions,
    breakdown: { activity, achievements, missions },
  };
}
