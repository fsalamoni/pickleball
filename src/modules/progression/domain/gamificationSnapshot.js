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
 * As fontes das TRILHAS: o que a pessoa fez em cada área do jogo.
 *
 * Antes só os jogos e torneios alimentavam as trilhas, e todo jogo cai na
 * trilha "Torneiro" — as outras quatro (Social, Arena, Aulas e Clube) ficavam
 * zeradas para sempre, por construção. Agora elas saem dos FATOS (reservas
 * jogadas, aulas dadas, clubes, kudos), com os mesmos pesos da tabela de XP.
 *
 * Trilha mede ATIVIDADE por área; ela não soma no XP total (que continua sendo
 * composto por `computeTotalXpV2`). Fonte que não carregou NÃO é contada: nada
 * de afirmar que a pessoa "não fez" o que não deu para verificar.
 *
 * @param {object} stats
 * @param {object|null} facts `buildActivityFacts`
 * @returns {Record<string, number>}
 */
export function skillTreeSources(stats, facts) {
  const fontes = { ...statsToXpSources(stats) };
  if (!facts) return fontes;
  const c = facts.counts || {};
  const sabe = (nome) => (typeof facts.known === 'function' ? facts.known(nome) : true);
  const uma = (cond) => (cond ? 1 : 0);
  if (sabe('following')) fontes.follow_first = uma(c.follows >= 1);
  if (sabe('followers')) fontes.followed_by_10 = uma(c.followers >= 10);
  if (sabe('kudosIndex')) {
    fontes.kudos_given = c.kudosGiven || 0;
    fontes.kudos_received = c.kudosReceived || 0;
  }
  if (sabe('bookings')) {
    fontes.booking_first = uma(c.bookingsPlayed >= 1);
    fontes.booking_attended = c.bookingsPlayed || 0;
    fontes.arena_visited_3_different = uma(c.arenasVisited >= 3);
    fontes.arena_visited_10_different = uma(c.arenasVisited >= 10);
  }
  if (sabe('arenaReviews')) fontes.arena_reviewed = c.arenaReviews || 0;
  if (sabe('lessons')) {
    fontes.lesson_first = uma(c.lessonsCompleted >= 1);
    fontes.lesson_attended = c.lessonsCompleted || 0;
  }
  if (sabe('packageSales')) fontes.package_purchased = c.packages || 0;
  if (sabe('clinicSignups')) fontes.clinic_attended = c.clinics || 0;
  if (sabe('clubs')) {
    fontes.club_joined = c.clubsJoined || 0;
    fontes.club_created = c.clubsCreated || 0;
  }
  if (sabe('clubEventsCreated')) fontes.club_event_created = c.clubEventsCreated || 0;
  if (sabe('gameDaysCreated')) fontes.game_day_organized = c.gameDaysCreated || 0;
  return fontes;
}

/**
 * O que o documento materializado deve dizer, dado o XP já composto.
 *
 * @returns {{ xpTotal, level, tier, skillTrees, achievementsUnlocked, grantsXp, xpBreakdown }}
 */
export function calcProgressionFields({ xpTotal, breakdown, stats, unlockedCount, facts = null }) {
  const { trees } = buildSkillTrees(skillTreeSources(stats, facts), XP_WEIGHTS_V2);
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
