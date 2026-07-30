/**
 * Metadados do perfil do atleta: preferência de lado da quadra e interesses na
 * plataforma. Dado puro (ícones como string, mapeados na UI) — sem JSX.
 *
 * - `court_side`: lado da quadra que o atleta prefere jogar.
 * - `interests`: o que o atleta quer fazer na plataforma. Mapeia as
 *   funcionalidades existentes e alimenta a personalização do painel.
 */

/** Lado da quadra preferido. */
export const COURT_SIDE = Object.freeze({
  ANY: 'any',
  LEFT: 'left',
  RIGHT: 'right',
});

export const COURT_SIDE_LABELS = Object.freeze({
  [COURT_SIDE.ANY]: 'Qualquer lado',
  [COURT_SIDE.LEFT]: 'Esquerda',
  [COURT_SIDE.RIGHT]: 'Direita',
});

export const COURT_SIDE_OPTIONS = [
  COURT_SIDE.ANY, COURT_SIDE.LEFT, COURT_SIDE.RIGHT,
].map((value) => ({ value, label: COURT_SIDE_LABELS[value] }));

export function courtSideLabel(value) {
  return COURT_SIDE_LABELS[value] || null;
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
  { value: PLATFORM_INTEREST.PLAY_TOURNAMENTS, label: 'Participar de torneios', icon: 'Trophy', route: '/torneios', hint: 'Inscrever-se e competir' },
  { value: PLATFORM_INTEREST.ORGANIZE_TOURNAMENTS, label: 'Organizar torneios', icon: 'ClipboardList', route: '/torneios/criar', hint: 'Criar e administrar eventos' },
  { value: PLATFORM_INTEREST.RANDOM_PARTNERS, label: 'Encontrar parceria para jogos', icon: 'Users', route: '/procura-jogo', hint: 'Jogos avulsos com a comunidade' },
  { value: PLATFORM_INTEREST.TRAINING_PARTNERS, label: 'Parceria para treinos', icon: 'Handshake', route: '/procura-jogo', hint: 'Treinar com outros atletas' },
  { value: PLATFORM_INTEREST.PERSONAL_TRAINING, label: 'Organizar meu treino', icon: 'Dices', route: '/dia-de-jogo', hint: 'Montar seus dias de jogo' },
  { value: PLATFORM_INTEREST.FIND_COACH, label: 'Encontrar professores e aulas', icon: 'GraduationCap', route: '/coaches', hint: 'Aulas e nivelamento' },
  { value: PLATFORM_INTEREST.COACH_TEACH, label: 'Dar aulas (sou professor)', icon: 'GraduationCap', route: '/aulas', hint: 'Agenda e gestão de aulas' },
  { value: PLATFORM_INTEREST.ARENA_MANAGE, label: 'Gerir arena e quadras', icon: 'Building2', route: '/arenas', hint: 'Administrar minha arena' },
  { value: PLATFORM_INTEREST.BOOK_COURTS, label: 'Reservar quadras', icon: 'CalendarCheck', route: '/arenas', hint: 'Agendar quadras para jogar' },
  { value: PLATFORM_INTEREST.CLUBS, label: 'Participar de clubes', icon: 'Users', route: '/clubes', hint: 'Comunidades e dias de jogo' },
  { value: PLATFORM_INTEREST.COMMUNITY, label: 'Comunidade e novidades', icon: 'Zap', route: '/novidades', hint: 'Feed e interação social' },
  { value: PLATFORM_INTEREST.RANKING, label: 'Acompanhar ranking e evolução', icon: 'Medal', route: '/ranking', hint: 'Rating e desempenho' },
];

const INTEREST_META_BY_VALUE = Object.freeze(
  Object.fromEntries(PLATFORM_INTEREST_META.map((m) => [m.value, m])),
);

export function interestLabel(value) {
  return INTEREST_META_BY_VALUE[value]?.label || null;
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
