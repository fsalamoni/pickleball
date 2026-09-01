/**
 * Achievements V2 — catálogo de conquistas expandido (lógica pura, sem I/O).
 *
 * **O QUE MUDA vs `achievements.js` (V1)**:
 *  - V1: 20 conquistas lineares baseadas em acúmulo.
 *  - V2: 80+ conquistas em **5 famílias** (carreira, social, descoberta,
 *    sazonal, comunidade) com **5 raridades** (comum, incomum, rara,
 *    épica, lendária) e **metadados visuais** (icon, lore, shareable).
 *
 * **5 FAMÍLIAS**:
 *  - `career`     — carreira (jogos, rating, títulos, USAP)
 *  - `social`     — social (follows, kudos, chat, comunidade)
 *  - `discovery`  — descoberta (perfis, arenas, professores)
 *  - `seasonal`   — sazonal (eventos da estação atual, rotativa)
 *  - `community`  — comunidade (clubes, ajudar, mentorear)
 *
 * **5 RARIDADES**:
 *  - `common`     (>50% dos usuários)    — cinza
 *  - `uncommon`   (20-50%)               — verde-azulado
 *  - `rare`       (5-20%)                — azul
 *  - `epic`       (1-5%)                 — roxa
 *  - `legendary`  (<1%)                  — dourada
 *
 * **MUDANÇAS DE ALGORITMO**:
 *  - V1: predicado puro `(summary) => boolean`.
 *  - V2: predicado `(user, context) => { unlocked, progress }` — pode
 *    reportar progresso (0-1) e motivo. Isso permite "X / Y para desbloquear".
 *
 * Aditivo. Sem breaking change (V1 `achievements.js` continua existindo).
 */

import { computeXpV2, levelFromXpV2 } from '../../progression/domain/progressionV2.js';
import { computeProtectedStreak } from '../../progression/domain/streakProtection.js';

// ────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTES
// ────────────────────────────────────────────────────────────────────────────

export const ACHIEVEMENT_FAMILY = Object.freeze({
  CAREER: 'career',
  SOCIAL: 'social',
  DISCOVERY: 'discovery',
  SEASONAL: 'seasonal',
  COMMUNITY: 'community',
});

export const ACHIEVEMENT_FAMILY_META = Object.freeze({
  [ACHIEVEMENT_FAMILY.CAREER]: {
    name: 'Carreira',
    color: 'amber',
    icon: '🏆',
    description: 'Torneios, rating, títulos, evolução de nível USAP.',
  },
  [ACHIEVEMENT_FAMILY.SOCIAL]: {
    name: 'Social',
    color: 'blue',
    icon: '🤝',
    description: 'Seguir, ser seguido, kudos, chat, comunidade.',
  },
  [ACHIEVEMENT_FAMILY.DISCOVERY]: {
    name: 'Descoberta',
    color: 'green',
    icon: '🗺️',
    description: 'Arenas, professores, clínicas, completar perfil.',
  },
  [ACHIEVEMENT_FAMILY.SEASONAL]: {
    name: 'Sazonal',
    color: 'pink',
    icon: '🌸',
    description: 'Eventos da estação (rotativa, 4x por ano).',
  },
  [ACHIEVEMENT_FAMILY.COMMUNITY]: {
    name: 'Comunidade',
    color: 'purple',
    icon: '🏛️',
    description: 'Clubes, ajudar novatos, mentorear.',
  },
});

export const ACHIEVEMENT_RARITY = Object.freeze({
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
});

export const ACHIEVEMENT_RARITY_META = Object.freeze({
  [ACHIEVEMENT_RARITY.COMMON]: {
    name: 'Comum',
    color: 'gray',
    order: 1,
    shareable: false,
  },
  [ACHIEVEMENT_RARITY.UNCOMMON]: {
    name: 'Incomum',
    color: 'teal',
    order: 2,
    shareable: true,
  },
  [ACHIEVEMENT_RARITY.RARE]: {
    name: 'Rara',
    color: 'blue',
    order: 3,
    shareable: true,
  },
  [ACHIEVEMENT_RARITY.EPIC]: {
    name: 'Épica',
    color: 'purple',
    order: 4,
    shareable: true,
  },
  [ACHIEVEMENT_RARITY.LEGENDARY]: {
    name: 'Lendária',
    color: 'amber',
    order: 5,
    shareable: true,
  },
});

/**
 * Estações suportadas (sazonais).
 */
export const SEASON_KEY = Object.freeze({
  SUMMER: 'summer',    // jan-mar
  AUTUMN: 'autumn',    // abr-jun
  WINTER: 'winter',    // jul-set
  SPRING: 'spring',    // out-dez
});

/**
 * Retorna a estação atual baseado em uma data (padrão sul: out-dez=primavera).
 *
 * @param {Date} [date]
 * @returns {string} SEASON_KEY
 */
export function currentSeason(date = new Date()) {
  const m = date.getMonth(); // 0-11
  if (m >= 0 && m <= 2) return SEASON_KEY.SUMMER;
  if (m >= 3 && m <= 5) return SEASON_KEY.AUTUMN;
  if (m >= 6 && m <= 8) return SEASON_KEY.WINTER;
  return SEASON_KEY.SPRING;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. CATÁLOGO DE CONQUISTAS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Helper para criar definição de conquista.
 */
const def = (id, family, rarity, name, description, test, extra = {}) => ({
  id,
  family,
  rarity,
  name,
  description,
  test,
  shareable: extra.shareable ?? (rarity !== ACHIEVEMENT_RARITY.COMMON),
  icon: extra.icon || null,
  lore: extra.lore || null,
  xpBonus: extra.xpBonus || 0,
  hidden: extra.hidden || false,
});

/**
 * Catálogo completo de conquistas V2.
 * 80 conquistas, 5 famílias, 5 raridades.
 *
 * Cada `test` recebe `(user, context)` e retorna:
 *  - `boolean` (true = desbloqueada, false = bloqueada)
 *  - ou `{ unlocked: boolean, progress?: number (0-1), reason?: string }`
 */
export const ACHIEVEMENTS_V2 = Object.freeze([
  // ──────────────────────────────────────────────────────────────────
  // FAMÍLIA: CARREIRA (28 conquistas)
  // ──────────────────────────────────────────────────────────────────
  def('career_welcome', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.COMMON,
    'Bem-vindo', 'Criou a conta na plataforma.',
    (u) => Boolean(u?.createdAt || u?.uid),
    { icon: '👋' }),

  def('career_first_tournament', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.COMMON,
    'Estreante', 'Participou do primeiro torneio.',
    (u) => (u?.stats?.tournaments || 0) >= 1,
    { icon: '🌱' }),

  def('career_first_win', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.COMMON,
    'Primeira vitória', 'Venceu o primeiro jogo.',
    (u) => (u?.stats?.wins || 0) >= 1,
    { icon: '🎉' }),

  def('career_first_podium', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.COMMON,
    'No pódio', 'Terminou entre os 3 primeiros.',
    (u) => (u?.stats?.podiums || 0) >= 1,
    { icon: '🥉' }),

  def('career_first_title', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Campeão', 'Conquistou um título.',
    (u) => (u?.stats?.titles || 0) >= 1,
    { icon: '🏆', xpBonus: 50 }),

  def('career_10_wins', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.COMMON,
    'Dez de lá', 'Acumulou 10 vitórias.',
    (u) => (u?.stats?.wins || 0) >= 10),

  def('career_50_wins', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Cinquentão', 'Acumulou 50 vitórias.',
    (u) => (u?.stats?.wins || 0) >= 50,
    { icon: '🎖️' }),

  def('career_100_wins', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.RARE,
    'Centena de vitórias', 'Acumulou 100 vitórias.',
    (u) => (u?.stats?.wins || 0) >= 100,
    { icon: '💯', xpBonus: 100 }),

  def('career_25_games', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.COMMON,
    'Pegando ritmo', 'Disputou 25 jogos.',
    (u) => (u?.stats?.played || 0) >= 25),

  def('career_100_games', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.RARE,
    'Centurião', 'Disputou 100 jogos.',
    (u) => (u?.stats?.played || 0) >= 100,
    { icon: '⚔️', xpBonus: 200 }),

  def('career_250_games', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.RARE,
    'Incansável', 'Disputou 250 jogos.',
    (u) => (u?.stats?.played || 0) >= 250,
    { icon: '🏃', xpBonus: 500 }),

  def('career_10_tournaments', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Maratonista', 'Disputou 10 torneios.',
    (u) => (u?.stats?.tournaments || 0) >= 10,
    { icon: '🎽' }),

  def('career_25_tournaments', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.RARE,
    'Veterano de quadra', 'Disputou 25 torneios.',
    (u) => (u?.stats?.tournaments || 0) >= 25,
    { icon: '🎖️', xpBonus: 250 }),

  def('career_10_podiums', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Frequentador do pódio', 'Subiu ao pódio 10 vezes.',
    (u) => (u?.stats?.podiums || 0) >= 10),

  def('career_5_titles', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Colecionador de troféus', 'Conquistou 5 títulos.',
    (u) => (u?.stats?.titles || 0) >= 5,
    { icon: '🏆' }),

  def('career_10_titles', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.EPIC,
    'Lenda', 'Conquistou 10 títulos.',
    (u) => (u?.stats?.titles || 0) >= 10,
    { icon: '👑', xpBonus: 1000 }),

  def('career_rating_1100', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Em ascensão', 'Atingiu rating 1100.',
    (u) => (u?.rating || 0) >= 1100),

  def('career_rating_1300', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.RARE,
    'Elite', 'Atingiu rating 1300.',
    (u) => (u?.rating || 0) >= 1300,
    { icon: '⭐', xpBonus: 200 }),

  def('career_rating_1500', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.EPIC,
    'Fora de série', 'Atingiu rating 1500.',
    (u) => (u?.rating || 0) >= 1500,
    { icon: '🌟', xpBonus: 500 }),

  def('career_rating_1700', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.LEGENDARY,
    'Imortal do rating', 'Atingiu rating 1700+.',
    (u) => (u?.rating || 0) >= 1700,
    { icon: '🔥', xpBonus: 2000, lore: 'O rating onde só os deuses chegam.' }),

  def('career_streak_4', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Constância', 'Jogou em 4 semanas seguidas.',
    (u) => (u?.streak?.weeks || 0) >= 4,
    { icon: '🔥' }),

  def('career_streak_12', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.RARE,
    'Rotina de atleta', 'Jogou em 12 semanas seguidas.',
    (u) => (u?.streak?.weeks || 0) >= 12,
    { icon: '💪', xpBonus: 300 }),

  def('career_streak_26', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.EPIC,
    'Meio ano de quadra', 'Jogou em 26 semanas seguidas.',
    (u) => (u?.streak?.weeks || 0) >= 26,
    { icon: '🗓️', xpBonus: 1000 }),

  def('career_streak_52', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.LEGENDARY,
    'Um ano de quadra', 'Jogou em 52 semanas seguidas.',
    (u) => (u?.streak?.weeks || 0) >= 52,
    { icon: '🌟', xpBonus: 5000, lore: 'Você dedicou um ano inteiro ao esporte.' }),

  def('career_tri_champion', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.RARE,
    'Tri-campeão', 'Venceu 3 títulos consecutivos.',
    (u) => (u?.consecutive_titles || 0) >= 3,
    { icon: '🏅' }),

  def('career_nocaute', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.RARE,
    'Nocaute', 'Venceu um jogo por 11-0.',
    (u) => (u?.knockout_wins || 0) >= 1,
    { icon: '💥' }),

  def('career_revanche', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Revanche', 'Perdeu antes, ganhou depois para o mesmo adversário.',
    (u) => (u?.revenge_wins || 0) >= 1,
    { icon: '🗡️' }),

  def('career_level_up_2_to_3', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.UNCOMMON,
    'Dobrador de níveis', 'Subiu de USAP 2.0 → 3.0.',
    (u) => {
      const cur = u?.leveling?.level || u?.leveling_level || null;
      const validations = u?.validations || [];
      if (!cur) return false;
      // se atingiu 3.0 em algum momento (validado ou autorrelatado)
      if (cur === 'intermediario' || cur === '3.0' || cur === '3.5' || cur === 'avancado' || cur === '4.0' || cur === 'pro' || cur === '4.5' || cur === 'open' || cur === '5.0+') {
        const startLevel = u?.leveling?.start_level || null;
        return !startLevel || ['iniciante_1', 'iniciante_2', 'iniciante_plus', '2.0', '2.5'].includes(startLevel);
      }
      return false;
    },
    { icon: '📈' }),

  // ──────────────────────────────────────────────────────────────────
  // FAMÍLIA: SOCIAL (15 conquistas)
  // ──────────────────────────────────────────────────────────────────
  def('social_first_follow', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.COMMON,
    'Sociável', 'Seguiu o primeiro atleta.',
    (u) => (u?.follows_count || 0) >= 1,
    { icon: '👋' }),

  def('social_first_chat', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.COMMON,
    'Conversador', 'Enviou a primeira mensagem no chat.',
    (u) => (u?.chats_sent || 0) >= 1,
    { icon: '💬' }),

  def('social_first_kudos_received', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.COMMON,
    'Reconhecido', 'Recebeu o primeiro 👏.',
    (u) => (u?.kudos_received || 0) >= 1,
    { icon: '👏' }),

  def('social_first_post', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.COMMON,
    'Voz', 'Fez o primeiro post em mural ou fórum.',
    (u) => (u?.posts_count || 0) >= 1,
    { icon: '📝' }),

  def('social_50_kudos_given', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Apoiador', 'Deu 50 kudos na comunidade.',
    (u) => (u?.kudos_given || 0) >= 50,
    { icon: '🙌' }),

  def('social_10_followers', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Puxador', '10 atletas te seguem.',
    (u) => (u?.followers_count || 0) >= 10,
    { icon: '🧲' }),

  def('social_100_followers', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.RARE,
    'Influenciador', '100 atletas te seguem.',
    (u) => (u?.followers_count || 0) >= 100,
    { icon: '📢', xpBonus: 200 }),

  def('social_10_photos', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Embaixador visual', 'Postou 10 fotos com #picklerush.',
    (u) => (u?.photos_posted || 0) >= 10,
    { icon: '📸' }),

  def('social_5_referrals', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.EPIC,
    'Embaixador', '5 amigos entraram pelo seu código de convite.',
    (u) => (u?.referrals_activated || 0) >= 5,
    { icon: '🤝', xpBonus: 500 }),

  def('social_500_kudos_given', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.RARE,
    'Rei do 👏', 'Deu 500 kudos.',
    (u) => (u?.kudos_given || 0) >= 500,
    { icon: '👑' }),

  def('social_match_review_5star', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Match Review 5⭐', 'Recebeu 10 reviews 5⭐ de adversários.',
    (u) => (u?.match_reviews_5star || 0) >= 10,
    { icon: '⭐' }),

  def('social_1000_followers', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.EPIC,
    'Influência', '1.000 atletas te seguem.',
    (u) => (u?.followers_count || 0) >= 1000,
    { icon: '🌟', xpBonus: 1000 }),

  def('social_5_letters', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Carta ao companheiro', 'Enviou 5 cartas pós-torneio de duplas.',
    (u) => (u?.letters_sent || 0) >= 5,
    { icon: '✉️' }),

  def('social_policy_accepted', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.COMMON,
    'Cidadão', 'Aceitou a Política de Uso.',
    (u) => Boolean(u?.legal_consents?.privacy_policy),
    { icon: '📜' }),

  def('social_mascot', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.LEGENDARY,
    'Mascote da comunidade', 'Apareceu em 3+ posts de boas-vindas de novos membros.',
    (u) => (u?.welcome_mentions || 0) >= 3,
    { icon: '🦄', xpBonus: 2000, lore: 'Você é o primeiro rosto que novatos veem.' }),

  // ──────────────────────────────────────────────────────────────────
  // FAMÍLIA: DESCOBERTA (15 conquistas)
  // ──────────────────────────────────────────────────────────────────
  def('discovery_profile_complete', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.COMMON,
    'Identidade completa', 'Perfil 100% preenchido.',
    (u) => Boolean(u?.profile_completeness >= 1 || u?.profile_completed),
    { icon: '🪪' }),

  def('discovery_photo', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.COMMON,
    'Cara conhecida', 'Adicionou foto de perfil.',
    (u) => Boolean(u?.photo_url),
    { icon: '🤳' }),

  def('discovery_localized', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.COMMON,
    'Localizado', 'Definiu cidade e estado.',
    (u) => Boolean(u?.city && u?.state),
    { icon: '📍' }),

  def('discovery_leveling_done', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.COMMON,
    'Auto-conhecimento', 'Fez o teste de nivelamento.',
    (u) => Boolean(u?.leveling?.level || u?.leveling_level),
    { icon: '🧠' }),

  def('discovery_first_tournament_watched', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.COMMON,
    'Espectador', 'Viu o primeiro torneio ao vivo.',
    (u) => (u?.tournaments_watched || 0) >= 1,
    { icon: '👀' }),

  def('discovery_first_booking', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.COMMON,
    'Frequentador', 'Fez a primeira reserva de arena.',
    (u) => (u?.bookings_count || 0) >= 1,
    { icon: '📅' }),

  def('discovery_first_lesson', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.COMMON,
    'Aluno aplicado', 'Teve a primeira aula com professor.',
    (u) => (u?.lessons_count || 0) >= 1,
    { icon: '🎓' }),

  def('discovery_first_arena_review', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.COMMON,
    'Crítico', 'Avaliou a primeira arena.',
    (u) => (u?.arena_reviews || 0) >= 1,
    { icon: '✏️' }),

  def('discovery_3_arenas', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.UNCOMMON,
    'Explorador urbano', 'Visitou 3 arenas diferentes.',
    (u) => (u?.arenas_visited_count || 0) >= 3,
    { icon: '🧭' }),

  def('discovery_5_clinics', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.UNCOMMON,
    'Workshop lover', 'Participou de 5 clínicas/workshops.',
    (u) => (u?.clinics_count || 0) >= 5,
    { icon: '🛠️' }),

  def('discovery_package', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.UNCOMMON,
    'Comprometido', 'Comprou pacote de 5+ aulas com professor.',
    (u) => (u?.packages_count || 0) >= 1,
    { icon: '📦' }),

  def('discovery_10_lessons', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.RARE,
    'Disciplina', 'Completou 10 aulas com professor.',
    (u) => (u?.lessons_completed || 0) >= 10,
    { icon: '📚', xpBonus: 200 }),

  def('discovery_10_arena_reviews', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.RARE,
    'Explorador de quadras', 'Avaliou 10+ arenas diferentes.',
    (u) => (u?.arena_reviews || 0) >= 10,
    { icon: '🏟️' }),

  def('discovery_10_arenas', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.EPIC,
    'Mapa do tesouro', 'Jogou em 10 arenas diferentes.',
    (u) => (u?.arenas_visited_count || 0) >= 10,
    { icon: '🗺️', xpBonus: 500 }),

  def('discovery_3_states', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.LEGENDARY,
    'Globetrotter', 'Jogou em 3 estados diferentes do Brasil.',
    (u) => (u?.states_visited || []).length >= 3,
    { icon: '🇧🇷', xpBonus: 1000 }),

  // ──────────────────────────────────────────────────────────────────
  // FAMÍLIA: SAZONAL (10 conquistas, rotativas)
  // ──────────────────────────────────────────────────────────────────
  def('seasonal_summer_solstice', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Solstício de Verão', 'Participou de torneio em dezembro.',
    (u) => Array.isArray(u?.tournaments_by_month) && u.tournaments_by_month[11] >= 1,
    { icon: '☀️', hidden: true }),

  def('seasonal_carnaval', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Carnaval de Quadra', 'Jogou game-day no Carnaval (fev).',
    (u) => Array.isArray(u?.game_days_by_month) && u.game_days_by_month[1] >= 1,
    { icon: '🎭', hidden: true }),

  def('seasonal_pascoa', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.RARE,
    'Páscoa Solidária', 'Organizou torneio beneficente (mar/abr).',
    (u) => (u?.charity_tournaments || 0) >= 1,
    { icon: '🐣', hidden: true }),

  def('seasonal_festa_junina', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Festa Junina', 'Jogou em junho.',
    (u) => Array.isArray(u?.games_by_month) && u.games_by_month[5] >= 1,
    { icon: '🌽', hidden: true }),

  def('seasonal_inverno_quente', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.RARE,
    'Inverno Quente', '12 jogos em julho ou agosto.',
    (u) => {
      const months = u?.games_by_month || [];
      return (months[6] || 0) + (months[7] || 0) >= 12;
    },
    { icon: '❄️', hidden: true, xpBonus: 200 }),

  def('seasonal_volta_aulas', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Volta às Aulas', 'Fez 1ª aula com novo professor em fevereiro.',
    (u) => (u?.new_coach_in_feb || 0) >= 1,
    { icon: '📒', hidden: true }),

  def('seasonal_black_friday', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Black Friday do Esporte', 'Comprou pacote de aulas em novembro.',
    (u) => (u?.november_purchase || 0) >= 1,
    { icon: '🛍️', hidden: true }),

  def('seasonal_reveillon', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.UNCOMMON,
    'Réveillon Esportivo', 'Jogou na última semana do ano.',
    (u) => (u?.last_week_december_games || 0) >= 1,
    { icon: '🎆', hidden: true }),

  def('seasonal_birthday_month', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.COMMON,
    'Aniversariante do Mês', 'Jogou no mês do seu aniversário.',
    (u) => Boolean(u?.birth_month && u?.birth_month >= 1 && u?.birth_month <= 12
      && Array.isArray(u?.games_by_month) && u.games_by_month[u.birth_month - 1] >= 1),
    { icon: '🎂', hidden: true }),

  def('seasonal_three_seasons', ACHIEVEMENT_FAMILY.SEASONAL, ACHIEVEMENT_RARITY.EPIC,
    'Troféu da Temporada', 'Jogou em 3 estações consecutivas.',
    (u) => (u?.consecutive_seasons_played || 0) >= 3,
    { icon: '🏆', hidden: true, xpBonus: 500 }),

  // ──────────────────────────────────────────────────────────────────
  // FAMÍLIA: COMUNIDADE (15 conquistas)
  // ──────────────────────────────────────────────────────────────────
  def('community_first_club', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.COMMON,
    'Associado', 'Entrou no primeiro clube.',
    (u) => (u?.clubs_joined || 0) >= 1,
    { icon: '🏛️' }),

  def('community_founder', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.RARE,
    'Fundador', 'Criou um clube.',
    (u) => (u?.clubs_created || 0) >= 1,
    { icon: '🪧', xpBonus: 100 }),

  def('community_club_post', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.COMMON,
    'Voz do clube', 'Fez o primeiro post em clube.',
    (u) => (u?.club_posts || 0) >= 1,
    { icon: '📢' }),

  def('community_event_organizer', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.UNCOMMON,
    'Animador', 'Criou o primeiro evento no clube.',
    (u) => (u?.club_events_created || 0) >= 1,
    { icon: '🎉' }),

  def('community_recruiter', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.UNCOMMON,
    'Recrutador', 'Convidou 3 pessoas para o clube.',
    (u) => (u?.club_invites_accepted || 0) >= 3,
    { icon: '🧑‍🤝‍🧑' }),

  def('community_pillar', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.RARE,
    'Pilar', 'Admin de clube há 6 meses.',
    (u) => (u?.club_admin_months || 0) >= 6,
    { icon: '🏛️', xpBonus: 500 }),

  def('community_50_members', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.EPIC,
    'Mega clube', 'Seu clube chegou a 50 membros.',
    (u) => (u?.biggest_club_members || 0) >= 50,
    { icon: '🎊', xpBonus: 1000 }),

  def('community_100_members', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.LEGENDARY,
    'Comunidade', 'Seu clube chegou a 100 membros.',
    (u) => (u?.biggest_club_members || 0) >= 100,
    { icon: '🌟', xpBonus: 2500, lore: 'Você construiu uma comunidade.' }),

  def('community_gameday_host', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.UNCOMMON,
    'Anfitrião', 'Criou o primeiro dia de jogo.',
    (u) => (u?.game_days_created || 0) >= 1,
    { icon: '🏠' }),

  def('community_gameday_ref', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.UNCOMMON,
    'Árbitro social', 'Fechou game-day com placar lançado.',
    (u) => (u?.game_days_closed_with_score || 0) >= 1,
    { icon: '📋' }),

  def('community_ambassador', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.EPIC,
    'Embaixador', 'Alguém que você convidou virou admin de clube.',
    (u) => (u?.invitees_who_became_admin || 0) >= 1,
    { icon: '🎖️', xpBonus: 200 }),

  def('community_recurring', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.EPIC,
    'Tradição do clube', 'Evento recorrente por 4+ semanas.',
    (u) => (u?.recurring_events_count || 0) >= 1,
    { icon: '🔁', xpBonus: 300 }),

  def('community_arena_referral', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.RARE,
    'Patrocinador', 'Indicou uma arena parceira.',
    (u) => (u?.arenas_referred || 0) >= 1,
    { icon: '🏟️' }),

  def('community_help_newcomer', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.EPIC,
    'Mentor da comunidade', '10 respostas marcadas como "solução" para novatos.',
    (u) => (u?.help_solutions || 0) >= 10,
    { icon: '🤲', xpBonus: 300 }),

  def('community_1y_admin', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.LEGENDARY,
    'Pilar da comunidade', 'Admin de clube 100+ membros há 1 ano.',
    (u) => (u?.club_admin_1y_of_100 || false),
    { icon: '🏛️', xpBonus: 5000, lore: 'Você é o que mantém a chama acesa.' }),

  // ──────────────────────────────────────────────────────────────────
  // TROFÉUS LENDÁRIOS DE PLATAFORMA (one-shot, on-platform)
  // ──────────────────────────────────────────────────────────────────
  def('platform_100k_xp', ACHIEVEMENT_FAMILY.CAREER, ACHIEVEMENT_RARITY.LEGENDARY,
    'Imortal do PickleRush', 'Atingiu 100.000 XP totais.',
    (u) => (u?.xp_total || 0) >= 100000,
    { icon: '🔥', xpBonus: 5000, lore: 'Topo absoluto da plataforma. Você é o jogo.' }),

  def('platform_100_athletes', ACHIEVEMENT_FAMILY.SOCIAL, ACHIEVEMENT_RARITY.LEGENDARY,
    'Conexão', 'Jogou com 100+ atletas diferentes.',
    (u) => (u?.unique_opponents || 0) >= 100,
    { icon: '🕸️', xpBonus: 2000 }),

  def('platform_100_arena_visited', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.LEGENDARY,
    'Centauro das Arenas', 'Jogou em 100+ arenas diferentes.',
    (u) => (u?.arenas_visited_count || 0) >= 100,
    { icon: '🏛️', xpBonus: 2000 }),

  def('platform_5_states', ACHIEVEMENT_FAMILY.DISCOVERY, ACHIEVEMENT_RARITY.LEGENDARY,
    'Poliglota do Brasil', 'Jogou em 5+ estados.',
    (u) => (u?.states_visited || []).length >= 5,
    { icon: '🗾', xpBonus: 1000 }),

  def('platform_100_validations', ACHIEVEMENT_FAMILY.COMMUNITY, ACHIEVEMENT_RARITY.LEGENDARY,
    'Mentor de 100', 'Validou o nível de 100 alunos como professor.',
    (u) => (u?.coach_students_validated || 0) >= 100,
    { icon: '🎓', xpBonus: 5000, lore: 'Você multiplicou o esporte em 100 pessoas.' }),
]);

// ────────────────────────────────────────────────────────────────────────────
// 3. COMPUTAÇÃO
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza o "user" recebido pelos predicados.
 *
 * @param {object} user
 * @returns {object} user normalizado
 */
export function normalizeUser(user = {}) {
  if (!user || typeof user !== 'object') return {};
  return { ...user };
}

/**
 * Avalia uma conquista individual.
 *
 * @param {object} def — definição da conquista
 * @param {object} user
 * @param {object} context
 * @returns {{ unlocked: boolean, progress: number, reason: string|null }}
 */
export function evaluateAchievement(def, user, context = {}) {
  if (!def || typeof def.test !== 'function') {
    return { unlocked: false, progress: 0, reason: 'def-inválida' };
  }
  const result = def.test(user, context);
  if (typeof result === 'boolean') {
    return { unlocked: result, progress: result ? 1 : 0, reason: null };
  }
  if (result && typeof result === 'object') {
    return {
      unlocked: Boolean(result.unlocked),
      progress: Number.isFinite(result.progress) ? Math.max(0, Math.min(1, result.progress)) : (result.unlocked ? 1 : 0),
      reason: result.reason || null,
    };
  }
  return { unlocked: false, progress: 0, reason: 'test-inválido' };
}

/**
 * Computa todas as conquistas V2 (unlocked + locked) a partir do user.
 *
 * @param {object} user
 * @param {object} [context]
 * @param {{ family?: string, rarity?: string }} [filters]
 * @returns {{
 *   unlocked: Array<{ id, name, description, family, rarity, icon, lore, xpBonus, shareable, progress, reason }>,
 *   locked: Array<{ id, name, description, family, rarity, icon, lore, xpBonus, shareable, progress, reason }>,
 *   total: number,
 *   unlockedCount: number,
 *   byFamily: Record<string, { unlocked: number, total: number }>,
 *   byRarity: Record<string, { unlocked: number, total: number }>,
 * }}
 */
export function computeAchievementsV2(user, context = {}, filters = {}) {
  const normUser = normalizeUser(user);
  const unlocked = [];
  const locked = [];
  const byFamily = {};
  const byRarity = {};

  for (const def of ACHIEVEMENTS_V2) {
    // Aplicar filtros
    if (filters.family && def.family !== filters.family) continue;
    if (filters.rarity && def.rarity !== filters.rarity) continue;

    const result = evaluateAchievement(def, normUser, context);

    const item = {
      id: def.id,
      name: def.name,
      description: def.description,
      family: def.family,
      rarity: def.rarity,
      icon: def.icon,
      lore: def.lore,
      xpBonus: def.xpBonus || 0,
      shareable: def.shareable !== false,
      progress: result.progress,
      reason: result.reason,
      hidden: def.hidden,
    };

    if (byFamily[def.family]) byFamily[def.family].total += 1;
    else byFamily[def.family] = { unlocked: 0, total: 1 };
    if (byRarity[def.rarity]) byRarity[def.rarity].total += 1;
    else byRarity[def.rarity] = { unlocked: 0, total: 1 };

    if (result.unlocked) {
      unlocked.push(item);
      byFamily[def.family].unlocked += 1;
      byRarity[def.rarity].unlocked += 1;
    } else {
      locked.push(item);
    }
  }

  return {
    unlocked,
    locked,
    total: ACHIEVEMENTS_V2.length,
    unlockedCount: unlocked.length,
    byFamily,
    byRarity,
  };
}

/**
 * XP bônus total das conquistas desbloqueadas.
 *
 * @param {object} user
 * @returns {number}
 */
export function totalAchievementXp(user) {
  const { unlocked } = computeAchievementsV2(user);
  return unlocked.reduce((s, a) => s + (a.xpBonus || 0), 0);
}

/**
 * Conquista por ID.
 *
 * @param {string} id
 * @returns {object|null}
 */
export function getAchievementV2ById(id) {
  return ACHIEVEMENTS_V2.find((a) => a.id === id) || null;
}

/**
 * Lista conquistas por família.
 *
 * @param {string} family
 * @returns {Array<object>}
 */
export function listAchievementsByFamily(family) {
  return ACHIEVEMENTS_V2.filter((a) => a.family === family);
}

/**
 * Conta conquistas por raridade.
 *
 * @returns {Record<string, number>}
 */
export function countByRarity() {
  const out = {};
  for (const a of ACHIEVEMENTS_V2) {
    out[a.rarity] = (out[a.rarity] || 0) + 1;
  }
  return out;
}
