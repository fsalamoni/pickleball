/**
 * Skill Trees do jogador (lógica pura, sem I/O).
 *
 * 5 trilhas independentes de XP. O usuário tem um nível em cada trilha,
 * não apenas um "XP total".
 *
 * **Por que skill trees?**
 *  - Um usuário que joga game-day social toda semana mas não vai a torneio
 *    não está "preso" no Calouro.
 *  - Mostra o perfil multifacetado: alguém pode ser Elite em "Arena" e
 *    Calouro em "Torneio".
 *  - Permite matchmaking mais rico (você pode procurar "alguém com Crew
 *    forte" ou "professor com 100+ alunos").
 *
 * **Trilhas**:
 *  - `tournament` — participação e organização de torneios
 *  - `social` — follows, kudos, chat, posts, comunidade
 *  - `arena` — reservas, reviews, comparecimento em quadras
 *  - `coach` — aulas, pacotes, clínicas (lado aluno)
 *  - `club` — participação e organização de clubes/eventos
 *
 * Cada trilha tem seu próprio XP, nível (mesma curva 500*L), e "foco
 * atual" (última fonte que ganhou XP).
 *
 * Aditivo. Sem I/O. Sem breaking change.
 */

/** Trilhas oficiais. */
export const SKILL_TREE_KEYS = Object.freeze([
  'tournament',
  'social',
  'arena',
  'coach',
  'club',
]);

/** Metadados de cada trilha (para UI, sem JSX). */
export const SKILL_TREE_META = Object.freeze({
  tournament: {
    name: 'Torneiro',
    icon: '🏆',
    color: 'amber',
    description: 'Participação e organização de torneios.',
  },
  social: {
    name: 'Social',
    icon: '🤝',
    color: 'blue',
    description: 'Comunidade: follows, kudos, chat, mural, fórum.',
  },
  arena: {
    name: 'Arena',
    icon: '🏟️',
    color: 'teal',
    description: 'Reservas de quadras, reviews e comparecimento.',
  },
  coach: {
    name: 'Professor (aluno)',
    icon: '🎓',
    color: 'purple',
    description: 'Aulas, pacotes e clínicas com professores.',
  },
  club: {
    name: 'Clube',
    icon: '👥',
    color: 'green',
    description: 'Participação e organização de clubes e eventos.',
  },
});

/**
 * Mapeamento de fonte de XP V2 → trilha. Cada fonte pertence a UMA
 * trilha. Fontes que não estão no mapa (ex: `referral_*`, `bonus_*`,
 * `discovery_*`) não contam em nenhuma trilha (mas contam no XP total).
 */
const SOURCE_TO_TREE = Object.freeze({
  // tournament
  tournament_attended: 'tournament',
  tournament_podium: 'tournament',
  tournament_title: 'tournament',
  tournament_created: 'tournament',
  tournament_16plus_created: 'tournament',
  tournament_recurring_created: 'tournament',
  tournament_finished_fast: 'tournament',
  tournament_withdrew_late: 'tournament',
  game_played: 'tournament',
  game_won: 'tournament',
  game_day_attended: 'tournament',
  game_day_organized: 'tournament',
  game_day_published_to_ranking: 'tournament',
  game_result_logged: 'tournament',
  game_open_published: 'tournament',
  game_open_accepted: 'tournament',
  game_mexicano_played: 'tournament',
  game_king_of_court_played: 'tournament',
  teacher_first_lesson: 'tournament',
  teacher_10_lessons_month: 'tournament',
  teacher_lesson_attended: 'tournament',
  teacher_validated_student: 'tournament',
  teacher_clinic_created: 'tournament',
  teacher_clinic_full_fast: 'tournament',
  teacher_5star_20reviews: 'tournament',
  teacher_100_students: 'tournament',
  teacher_content_published: 'tournament',
  teacher_package_seasonal: 'tournament',
  // social
  follow_first: 'social',
  followed_by_10: 'social',
  kudos_given: 'social',
  kudos_received: 'social',
  chat_message: 'social',
  profile_completed: 'social',
  profile_photo_added: 'social',
  profile_cover_added: 'social',
  profile_bio_added: 'social',
  profile_quadrant_set: 'social',
  share_card_generated: 'social',
  help_newcomer_solution: 'social',
  forum_post: 'social',
  forum_comment: 'social',
  poll_created: 'social',
  newsfeed_post: 'social',
  photo_posted: 'social',
  referral_signed_up: 'social',
  referral_first_action: 'social',
  referral_organized_tournament: 'social',
  // arena
  booking_first: 'arena',
  booking_attended: 'arena',
  booking_cancelled_late: 'arena',
  booking_no_show: 'arena',
  arena_reviewed: 'arena',
  arena_visited_first: 'arena',
  arena_referred: 'arena',
  arena_visited_3_different: 'arena',
  arena_visited_10_different: 'arena',
  // coach (aluno)
  lesson_first: 'coach',
  lesson_attended: 'coach',
  package_purchased: 'coach',
  package_completed: 'coach',
  clinic_attended: 'coach',
  clinic_invited_friend: 'coach',
  level_validated_by_coach: 'coach',
  // club
  club_joined: 'club',
  club_created: 'club',
  club_event_created: 'club',
  club_event_rsvp: 'club',
  club_post: 'club',
  club_event_recurring_4w: 'club',
  club_member_invited: 'club',
  club_member_invited_became_admin: 'club',
  club_50_members: 'club',
  club_100_members: 'club',
  club_admin_6_months: 'club',
  club_event_published_to_ranking: 'club',
});

/**
 * Constrói a estrutura de skill trees a partir de `xpBySource` (V2).
 *
 * @param {Record<string, number>} xpBySource — mapa fonte → count
 * @param {Record<string, number>} weights — pesos V2 (`XP_WEIGHTS_V2`)
 * @returns {{
 *   trees: Record<string, { xp: number, level: number }>,
 *   xpBySourceInTree: Record<string, Record<string, number>>,
 *   unassignedSources: string[]
 * }}
 */
export function buildSkillTrees(xpBySource = {}, weights = {}) {
  const trees = {};
  for (const key of SKILL_TREE_KEYS) {
    trees[key] = { xp: 0, level: 1 };
  }

  const xpBySourceInTree = {};
  for (const key of SKILL_TREE_KEYS) {
    xpBySourceInTree[key] = {};
  }

  const unassignedSources = [];

  for (const [source, count] of Object.entries(xpBySource || {})) {
    const tree = SOURCE_TO_TREE[source];
    const weight = weights[source] || 0;
    const amount = (Number(count) || 0) * weight;

    if (!tree) {
      unassignedSources.push(source);
      continue;
    }

    trees[tree].xp += amount;
    xpBySourceInTree[tree][source] = (xpBySourceInTree[tree][source] || 0) + amount;
  }

  // Calcular nível (mesma curva 500*L)
  for (const key of SKILL_TREE_KEYS) {
    const xp = trees[key].xp;
    let level = 1;
    let need = 500;
    let rem = Math.max(0, xp);
    while (rem >= need) {
      rem -= need;
      level += 1;
      need = 500 * level;
    }
    trees[key].level = level;
  }

  return { trees, xpBySourceInTree, unassignedSources };
}

/**
 * Retorna a trilha "principal" do usuário (a com mais XP).
 *
 * @param {Record<string, { xp: number, level: number }>} trees
 * @returns {string|null} chave da trilha (ex: 'tournament') ou null
 */
export function dominantTree(trees = {}) {
  let best = null;
  let bestXp = -Infinity;
  for (const key of SKILL_TREE_KEYS) {
    const t = trees[key];
    if (t && t.xp > bestXp) {
      bestXp = t.xp;
      best = key;
    }
  }
  return best;
}

/**
 * Resumo compacto: retorna lista ordenada de trilhas com meta.
 *
 * @param {Record<string, { xp: number, level: number }>} trees
 * @returns {Array<{ key: string, name: string, icon: string, color: string, xp: number, level: number, description: string }>}
 */
export function listSkillTrees(trees = {}) {
  return SKILL_TREE_KEYS.map((key) => {
    const meta = SKILL_TREE_META[key];
    const t = trees[key] || { xp: 0, level: 1 };
    return {
      key,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      description: meta.description,
      xp: t.xp,
      level: t.level,
    };
  });
}
