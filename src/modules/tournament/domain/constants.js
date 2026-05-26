/**
 * Constantes do domínio de torneios de Pickleball.
 *
 * O nome dos enums é mantido em inglês para servir de chave técnica;
 * os rótulos para exibição são em pt-BR e ficam nos mapas *_LABELS.
 */

/** Formato de inscrição da modalidade. */
export const MODALITY_FORMAT = Object.freeze({
  SINGLES: 'singles',
  DOUBLES: 'doubles',
  AMERICANO: 'americano',
});

export const MODALITY_FORMAT_LABELS = Object.freeze({
  [MODALITY_FORMAT.SINGLES]: 'Simples',
  [MODALITY_FORMAT.DOUBLES]: 'Duplas',
  [MODALITY_FORMAT.AMERICANO]: 'Americana',
});

/** Estrutura de fase do torneio. */
export const TOURNAMENT_STAGE_TYPE = Object.freeze({
  ROUND_ROBIN: 'round_robin',         // pontos corridos (todos contra todos)
  GROUPS: 'groups',                   // grupos seguidos de classificação
  KNOCKOUT: 'knockout',               // chaves (mata-mata)
  DOUBLE_KNOCKOUT: 'double_knockout', // dupla eliminação (winners + losers brackets)
  SWISS: 'swiss',                     // sistema suíço (pareamento por pontuação)
  AMERICANO: 'americano',             // formato americano (rotação)
});

export const TOURNAMENT_STAGE_TYPE_LABELS = Object.freeze({
  [TOURNAMENT_STAGE_TYPE.ROUND_ROBIN]: 'Pontos corridos',
  [TOURNAMENT_STAGE_TYPE.GROUPS]: 'Fase de grupos',
  [TOURNAMENT_STAGE_TYPE.KNOCKOUT]: 'Chaves (mata-mata)',
  [TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT]: 'Dupla eliminação',
  [TOURNAMENT_STAGE_TYPE.SWISS]: 'Sistema suíço',
  [TOURNAMENT_STAGE_TYPE.AMERICANO]: 'Americana (rotação)',
});

/** Conjunto de regras oficiais aplicáveis. */
export const RULESET = Object.freeze({
  CBP: 'cbp', // Confederação Brasileira de Pickleball
  USAP: 'usap', // USA Pickleball
});

export const RULESET_LABELS = Object.freeze({
  [RULESET.CBP]: 'Regras Brasileiras (CBP)',
  [RULESET.USAP]: 'Regras Americanas (USAP)',
});

/** Pontuação alvo de um game. */
export const TARGET_SCORE = Object.freeze({
  ELEVEN: 11,
  FIFTEEN: 15,
  TWENTY_ONE: 21,
});

/** Visibilidade/acesso do torneio. */
export const TOURNAMENT_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  PRIVATE: 'private',
});

export const TOURNAMENT_VISIBILITY_LABELS = Object.freeze({
  [TOURNAMENT_VISIBILITY.PUBLIC]: 'Público',
  [TOURNAMENT_VISIBILITY.PRIVATE]: 'Privado',
});

/** Categoria de nível. */
export const SKILL_LEVEL = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  INTERMEDIATE_PLUS: 'intermediate_plus',
  ADVANCED: 'advanced',
  PRO: 'pro',
  OPEN: 'open',
  ELITE: 'elite',
});

export const SKILL_LEVEL_LABELS = Object.freeze({
  [SKILL_LEVEL.BEGINNER]: 'Iniciante (2.0–2.5)',
  [SKILL_LEVEL.INTERMEDIATE]: 'Intermediário (3.0)',
  [SKILL_LEVEL.INTERMEDIATE_PLUS]: 'Intermediário Plus (3.5–4.0)',
  [SKILL_LEVEL.ADVANCED]: 'Avançado (4.0)',
  [SKILL_LEVEL.PRO]: 'PRO (4.5)',
  [SKILL_LEVEL.OPEN]: 'Open (5.0+)',
  [SKILL_LEVEL.ELITE]: 'Elite (Profissional)',
});

/** Categoria por gênero (CBP). */
export const GENDER_CATEGORY = Object.freeze({
  MALE: 'male',
  FEMALE: 'female',
  MIXED: 'mixed',
  OPEN: 'open',
});

export const GENDER_CATEGORY_LABELS = Object.freeze({
  [GENDER_CATEGORY.MALE]: 'Masculino',
  [GENDER_CATEGORY.FEMALE]: 'Feminino',
  [GENDER_CATEGORY.MIXED]: 'Misto',
  [GENDER_CATEGORY.OPEN]: 'Aberto',
});

/**
 * Preferência do jogador sobre em qual categoria deseja competir quando o
 * torneio tem chaves separadas por categoria (ex.: duplas masculinas,
 * duplas femininas, mistas). Trata-se exclusivamente de uma preferência
 * competitiva — não está relacionada à identidade de gênero da pessoa.
 */
export const COMPETITION_GENDER = Object.freeze({
  MALE: 'male',
  FEMALE: 'female',
});

export const COMPETITION_GENDER_LABELS = Object.freeze({
  [COMPETITION_GENDER.MALE]: 'Competir na categoria masculina',
  [COMPETITION_GENDER.FEMALE]: 'Competir na categoria feminina',
});

/** Faixa etária (CBP). */
export const AGE_CATEGORY = Object.freeze({
  OPEN: 'open',
  U19: 'u19',
  A35: '35plus',
  A50: '50plus',
  A60: '60plus',
  A70: '70plus',
});

export const AGE_CATEGORY_LABELS = Object.freeze({
  [AGE_CATEGORY.OPEN]: 'Open',
  [AGE_CATEGORY.U19]: 'Sub-19',
  [AGE_CATEGORY.A35]: '35+',
  [AGE_CATEGORY.A50]: '50+',
  [AGE_CATEGORY.A60]: '60+',
  [AGE_CATEGORY.A70]: '70+',
});

/** Status do torneio. */
export const TOURNAMENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  REGISTRATIONS_OPEN: 'registrations_open',
  REGISTRATIONS_CLOSED: 'registrations_closed',
  IN_PROGRESS: 'in_progress',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
});

export const TOURNAMENT_STATUS_LABELS = Object.freeze({
  [TOURNAMENT_STATUS.DRAFT]: 'Rascunho',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'Inscrições abertas',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'Inscrições encerradas',
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'Em andamento',
  [TOURNAMENT_STATUS.FINISHED]: 'Encerrado',
  [TOURNAMENT_STATUS.CANCELLED]: 'Cancelado',
});

/** Status de uma inscrição em uma modalidade. */
export const REGISTRATION_STATUS = Object.freeze({
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  WAITLIST: 'waitlist',
  CANCELLED: 'cancelled',
  WITHDRAWN: 'withdrawn',
});

export const REGISTRATION_STATUS_LABELS = Object.freeze({
  [REGISTRATION_STATUS.PENDING_PAYMENT]: 'Pagamento pendente',
  [REGISTRATION_STATUS.CONFIRMED]: 'Confirmada',
  [REGISTRATION_STATUS.CHECKED_IN]: 'Check-in feito',
  [REGISTRATION_STATUS.WAITLIST]: 'Lista de espera',
  [REGISTRATION_STATUS.CANCELLED]: 'Cancelada',
  [REGISTRATION_STATUS.WITHDRAWN]: 'Desistência (WO)',
});

/** Status de um jogo. */
export const MATCH_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  FINISHED: 'finished',
  WALKOVER: 'walkover',
  CANCELLED: 'cancelled',
});

export const MATCH_STATUS_LABELS = Object.freeze({
  [MATCH_STATUS.SCHEDULED]: 'Agendado',
  [MATCH_STATUS.IN_PROGRESS]: 'Em andamento',
  [MATCH_STATUS.FINISHED]: 'Encerrado',
  [MATCH_STATUS.WALKOVER]: 'WO',
  [MATCH_STATUS.CANCELLED]: 'Cancelado',
});

/** Papel de admin de torneio. */
export const TOURNAMENT_ADMIN_ROLE = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
});

export const TOURNAMENT_USER_ROLE = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  PLAYER: 'player',
  PUBLIC: 'public',
});

/** Capacidade máxima por modalidade. Requisito do produto: até 500 inscritos. */
export const MAX_REGISTRATIONS_PER_MODALITY = 500;

export const REGISTRATION_PROVISIONAL_LABEL = 'Provisório';

/** Tempo de experiência do usuário em pickleball. */
export const PICKLEBALL_EXPERIENCE = Object.freeze({
  UP_TO_6_MONTHS: 'up_to_6_months',
  SIX_TO_TWELVE_MONTHS: 'six_to_twelve_months',
  ONE_TO_TWO_YEARS: 'one_to_two_years',
  MORE_THAN_TWO_YEARS: 'more_than_two_years',
});

export const PICKLEBALL_EXPERIENCE_LABELS = Object.freeze({
  [PICKLEBALL_EXPERIENCE.UP_TO_6_MONTHS]: '6 meses ou menos',
  [PICKLEBALL_EXPERIENCE.SIX_TO_TWELVE_MONTHS]: 'Entre 6 meses e 1 ano',
  [PICKLEBALL_EXPERIENCE.ONE_TO_TWO_YEARS]: 'Entre 1 e 2 anos',
  [PICKLEBALL_EXPERIENCE.MORE_THAN_TWO_YEARS]: 'Mais de 2 anos',
});

/** Status de uma quadra. */
export const COURT_STATUS = Object.freeze({
  AVAILABLE: 'available',
  IN_USE: 'in_use',
  MAINTENANCE: 'maintenance',
  CLOSED: 'closed',
});

export const COURT_STATUS_LABELS = Object.freeze({
  [COURT_STATUS.AVAILABLE]: 'Disponível',
  [COURT_STATUS.IN_USE]: 'Em uso',
  [COURT_STATUS.MAINTENANCE]: 'Manutenção',
  [COURT_STATUS.CLOSED]: 'Fechada',
});

/** Templates de torneio pré-configurados. */
export const TOURNAMENT_TEMPLATE = Object.freeze({
  ROUND_ROBIN_SIMPLE: 'round_robin_simple',
  GROUPS_THEN_KO: 'groups_then_ko',
  SINGLE_KO: 'single_ko',
  DOUBLE_KO: 'double_ko',
  SWISS_THEN_KO: 'swiss_then_ko',
  AMERICANO_OPEN: 'americano_open',
});

export const TOURNAMENT_TEMPLATE_LABELS = Object.freeze({
  [TOURNAMENT_TEMPLATE.ROUND_ROBIN_SIMPLE]: 'Pontos corridos (simples)',
  [TOURNAMENT_TEMPLATE.GROUPS_THEN_KO]: 'Grupos + mata-mata',
  [TOURNAMENT_TEMPLATE.SINGLE_KO]: 'Eliminação simples',
  [TOURNAMENT_TEMPLATE.DOUBLE_KO]: 'Dupla eliminação',
  [TOURNAMENT_TEMPLATE.SWISS_THEN_KO]: 'Suíço + mata-mata',
  [TOURNAMENT_TEMPLATE.AMERICANO_OPEN]: 'Americana aberta',
});

/** Códigos USAP por nível, úteis para comunicação cruzada. */
export const SKILL_LEVEL_USAP_RANGE = Object.freeze({
  [SKILL_LEVEL.BEGINNER]: [2.0, 2.5],
  [SKILL_LEVEL.INTERMEDIATE]: [3.0, 3.0],
  [SKILL_LEVEL.INTERMEDIATE_PLUS]: [3.5, 4.0],
  [SKILL_LEVEL.ADVANCED]: [4.0, 4.0],
  [SKILL_LEVEL.PRO]: [4.5, 4.5],
  [SKILL_LEVEL.OPEN]: [5.0, 6.0],
  [SKILL_LEVEL.ELITE]: [5.5, 6.0],
});
