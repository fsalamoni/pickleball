/**
 * gamificationSnapshot — o que o motor do cliente monta a partir das fontes:
 * a visão das conquistas (medidas × "em breve") e o documento materializado de
 * progressão. Puro, sem I/O — o hook só junta as leituras e chama isto.
 */
import { ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2.js';
import { isAchievementTracked, ACHIEVEMENT_TRACKING } from './activityFacts.js';
import { levelFromXpV2, XP_WEIGHTS_V2 } from './progressionV2.js';
import { tierFromXp } from './tiers.js';
import { buildSkillTrees, toSkillTreeSnapshots } from './skillTrees.js';
import { makeEmptyProgressionV2 } from './progressionV2Schema.js';

/** Quantas conquistas são mensuráveis hoje (o "y" do "x de y"). */
export const TRACKED_ACHIEVEMENT_COUNT = ACHIEVEMENTS_V2.filter((a) => isAchievementTracked(a.id)).length;

/**
 * Separa o resultado de `computeAchievementsV2` em: conquistadas, em andamento e
 * "em breve" (a plataforma ainda não mede). As "em breve" ficam FORA da conta —
 * prometer o que nada consegue medir é o defeito que a camada de fatos resolve.
 *
 * @param {ReturnType<import('@/modules/achievements/domain/achievementsV2.js').computeAchievementsV2>} result
 */
export function splitAchievements(result) {
  const r = result || { unlocked: [], locked: [], byFamily: {} };
  const soon = [];
  const locked = [];
  (r.locked || []).forEach((a) => {
    if (isAchievementTracked(a.id)) locked.push(a);
    else soon.push({ ...a, soonReason: ACHIEVEMENT_TRACKING[a.id] });
  });
  // conquista medida e ganha nunca some por estar na lista "em breve"
  const unlocked = r.unlocked || [];
  const byFamily = {};
  [...unlocked, ...locked].forEach((a) => {
    const f = byFamily[a.family] || (byFamily[a.family] = { unlocked: 0, total: 0 });
    f.total += 1;
  });
  unlocked.forEach((a) => { byFamily[a.family].unlocked += 1; });
  return {
    unlocked,
    locked,
    soon,
    total: unlocked.length + locked.length,
    unlockedCount: unlocked.length,
    byFamily,
  };
}

/** As fontes de XP por atividade (as mesmas cinco de sempre). */
export function statsToXpSources(stats) {
  return {
    tournament_attended: stats?.tournaments || 0,
    tournament_podium: stats?.podiums || 0,
    tournament_title: stats?.titles || 0,
    game_played: stats?.played || 0,
    game_won: stats?.wins || 0,
  };
}

/**
 * O que o documento materializado deve dizer, dado o XP já composto.
 *
 * @returns {{ xpTotal, level, tier, skillTrees, achievementsUnlocked, grantsXp, xpBreakdown }}
 */
export function calcProgressionFields({ xpTotal, breakdown, stats, unlockedCount }) {
  const { trees } = buildSkillTrees(statsToXpSources(stats), XP_WEIGHTS_V2);
  return {
    xpTotal,
    level: levelFromXpV2(xpTotal).level,
    tier: tierFromXp(xpTotal).name,
    skillTrees: toSkillTreeSnapshots(trees),
    achievementsUnlocked: unlockedCount,
    grantsXp: breakdown?.grants || 0,
    xpBreakdown: {
      activity: breakdown?.activity || 0,
      achievements: breakdown?.achievements || 0,
      missions: breakdown?.missions || 0,
      onboarding: breakdown?.onboarding || 0,
      grants: breakdown?.grants || 0,
    },
  };
}

/** O documento gravado já diz o mesmo? (evita reescrever a cada render) */
export function progressionIsCurrent(atual, calc) {
  if (!atual) return false;
  const a = atual.xpBreakdown || {};
  const b = calc.xpBreakdown;
  return atual.xpTotal === calc.xpTotal
    && atual.level === calc.level
    && atual.tier === calc.tier
    && atual.achievementsUnlocked === calc.achievementsUnlocked
    && (atual.grantsXp || 0) === calc.grantsXp
    && ['activity', 'achievements', 'missions', 'onboarding', 'grants'].every((k) => (a[k] || 0) === b[k]);
}

/** O próximo documento de progressão (mantém `createdAt`). */
export function nextProgressionDoc(uid, atual, calc, now = Date.now()) {
  const base = atual || makeEmptyProgressionV2(uid);
  return {
    ...base,
    uid,
    xpTotal: calc.xpTotal,
    level: calc.level,
    tier: calc.tier,
    skillTrees: calc.skillTrees,
    achievementsUnlocked: calc.achievementsUnlocked,
    achievementsTotal: ACHIEVEMENTS_V2.length,
    grantsXp: calc.grantsXp,
    xpBreakdown: calc.xpBreakdown,
    source: atual ? 'recomputed' : 'seed',
    updatedAt: now,
    createdAt: (atual && atual.createdAt) || now,
  };
}

/** Quantos adversários distintos (por nome, ou uid quando há). */
export function countUniqueOpponents({ h2hRecords = [], gameDayGames = [] } = {}) {
  const set = new Set();
  (h2hRecords || []).forEach((r) => { if (r?.opponent) set.add(String(r.opponent).trim().toLowerCase()); });
  (gameDayGames || []).forEach((g) => {
    (g?.opponentUids || []).forEach((u) => set.add(`uid:${u}`));
    if (!g?.opponentUids?.length) (g?.opponents || []).forEach((n) => { if (n && n !== 'Atleta') set.add(String(n).trim().toLowerCase()); });
  });
  return set.size;
}
