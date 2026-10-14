/**
 * Metadados do perfil do atleta: preferência de lado da quadra e interesses na
 * plataforma. Dado puro (ícones como string, mapeados na UI) — sem JSX.
 *
 * - `court_side`: lado da quadra que o atleta prefere jogar.
 * - `interests`: o que o atleta quer fazer na plataforma. Mapeia as
 *   funcionalidades existentes e alimenta a personalização do painel.
 */

import { t, tk } from '@/core/i18n';

/** Lado da quadra preferido. */
export const COURT_SIDE = Object.freeze({
  ANY: 'any',
  LEFT: 'left',
  RIGHT: 'right',
});

export const COURT_SIDE_LABELS = Object.freeze({
  [COURT_SIDE.ANY]: tk('Qualquer lado'),
  [COURT_SIDE.LEFT]: tk('Esquerda'),
  [COURT_SIDE.RIGHT]: tk('Direita'),
});

export const COURT_SIDE_OPTIONS = [
  COURT_SIDE.ANY, COURT_SIDE.LEFT, COURT_SIDE.RIGHT,
].map((value) => ({ value, label: COURT_SIDE_LABELS[value] }));

export function courtSideLabel(value) {
  return COURT_SIDE_LABELS[value] ? t(COURT_SIDE_LABELS[value]) : null;
}

/** Interesses na plataforma (mapeiam as funcionalidades existentes). */
export const PLATFORM_INTEREST = Object.freeze({
  PLAY_TOURNAMENTS: 'play_tournaments',
  ORGANIZE_TOURNAMENTS: 'organize_tournaments',
  RANDOM_PARTNERS: 'random_partners',
  TRAINING_PARTNERS: 'training_partners',
  PERSONAL_TRAINING: 'personal_training',
  FIND_COACH: 'find_coach',
  COACH_TEACH: 'coach_teach',
  ARENA_MANAGE: 'arena_manage',
  BOOK_COURTS: 'book_courts',
  CLUBS: 'clubs',
  COMMUNITY: 'community',
  RANKING: 'ranking',
});

/**
 * Metadados de cada interesse: rótulo, ícone (nome lucide, mapeado na UI),
 * rota principal e um texto de apoio. A ordem define a exibição.
 */
export const PLATFORM_INTEREST_META = [
  { value: PLATFORM_INTEREST.PLAY_TOURNAMENTS, label: tk('Participar de torneios'), icon: 'Trophy', route: '/torneios', hint: tk('Inscrever-se e competir') },
  { value: PLATFORM_INTEREST.ORGANIZE_TOURNAMENTS, label: tk('Organizar torneios'), icon: 'ClipboardList', route: '/torneios/criar', hint: tk('Criar e administrar eventos') },
  { value: PLATFORM_INTEREST.RANDOM_PARTNERS, label: tk('Encontrar parceria para jogos'), icon: 'Users', route: '/procura-jogo', hint: tk('Jogos avulsos com a comunidade') },
  { value: PLATFORM_INTEREST.TRAINING_PARTNERS, label: tk('Parceria para treinos'), icon: 'Handshake', route: '/procura-jogo', hint: tk('Treinar com outros atletas') },
  { value: PLATFORM_INTEREST.PERSONAL_TRAINING, label: tk('Organizar meu treino'), icon: 'Dices', route: '/dia-de-jogo', hint: tk('Montar seus dias de jogo') },
  { value: PLATFORM_INTEREST.FIND_COACH, label: tk('Encontrar professores e aulas'), icon: 'GraduationCap', route: '/coaches', hint: tk('Aulas e nivelamento') },
  { value: PLATFORM_INTEREST.COACH_TEACH, label: tk('Dar aulas (sou professor)'), icon: 'GraduationCap', route: '/aulas', hint: tk('Agenda e gestão de aulas') },
  { value: PLATFORM_INTEREST.ARENA_MANAGE, label: tk('Gerir arena e quadras'), icon: 'Building2', route: '/arenas', hint: tk('Administrar minha arena') },
  { value: PLATFORM_INTEREST.BOOK_COURTS, label: tk('Reservar quadras'), icon: 'CalendarCheck', route: '/arenas', hint: tk('Agendar quadras para jogar') },
  { value: PLATFORM_INTEREST.CLUBS, label: tk('Participar de clubes'), icon: 'Users', route: '/clubes', hint: tk('Comunidades e dias de jogo') },
  { value: PLATFORM_INTEREST.COMMUNITY, label: tk('Comunidade e novidades'), icon: 'Zap', route: '/novidades', hint: tk('Feed e interação social') },
  { value: PLATFORM_INTEREST.RANKING, label: tk('Acompanhar ranking e evolução'), icon: 'Medal', route: '/ranking', hint: tk('Rating e desempenho') },
];

/** "Organizar meu treino" com o Centro de Treino ligado: leva ao `/treino`. */
const PERSONAL_TRAINING_COM_TREINO = Object.freeze({ icon: 'Dumbbell', route: '/treino', hint: tk('Treino do dia, rotina e biblioteca') });

/**
 * Os interesses como a tela os mostra. Com `treino` (flag `training_center`),
 * "Organizar meu treino" passa a levar ao Centro de Treino; sem ela, a lista
 * é exatamente a de sempre (o valor gravado no perfil não muda).
 * @param {{ treino?: boolean }} [opcoes]
 */
export function platformInterestMeta({ treino = false } = {}) {
  if (!treino) return PLATFORM_INTEREST_META;
  return PLATFORM_INTEREST_META.map((m) => (
    m.value === PLATFORM_INTEREST.PERSONAL_TRAINING ? { ...m, ...PERSONAL_TRAINING_COM_TREINO } : m
  ));
}

const INTEREST_META_BY_VALUE = Object.freeze(
  Object.fromEntries(PLATFORM_INTEREST_META.map((m) => [m.value, m])),
);

export function interestLabel(value) {
  return INTEREST_META_BY_VALUE[value]?.label ? t(INTEREST_META_BY_VALUE[value].label) : null;
}

export function interestMeta(value) {
  return INTEREST_META_BY_VALUE[value] || null;
}

/** Sanitiza uma lista de interesses recebida (mantém só valores conhecidos, dedup). */
export function sanitizeInterests(list) {
  const known = new Set(Object.values(PLATFORM_INTEREST));
  const out = [];
  (Array.isArray(list) ? list : []).forEach((v) => {
    if (known.has(v) && !out.includes(v)) out.push(v);
  });
  return out;
}

/** É um valor de lado de quadra válido? (ausência trata como 'any'). */
export function normalizeCourtSide(value) {
  return Object.values(COURT_SIDE).includes(value) ? value : COURT_SIDE.ANY;
}

/**
 * Em que lado das duplas MISTAS a pessoa entra no sorteio do dia de jogo:
 * 'male', 'female' ou null (não conta para misturar).
 *
 * Vale primeiro a CATEGORIA em que ela joga (`competition_gender`) — é a
 * pergunta que o sorteio faz. O gênero do perfil fica como reserva para quem
 * ainda não disse a categoria; "Outro" e "Prefiro não informar" não viram
 * palpite.
 */
export function playGenderOf(profile) {
  const categoria = profile?.competition_gender;
  if (categoria === 'male' || categoria === 'female') return categoria;
  const genero = profile?.gender;
  if (genero === 'male' || genero === 'female') return genero;
  return null;
}
