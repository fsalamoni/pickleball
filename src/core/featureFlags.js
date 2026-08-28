/**
 * Catálogo de feature flags da plataforma.
 *
 * As flags são guardadas em um único documento do Firestore
 * (`platform_settings/global`, campo `feature_flags`) e podem ser ligadas/
 * desligadas em tempo de execução pelo admin master na página de Métricas.
 *
 * NOTA: as funcionalidades que estavam LIGADAS em produção foram convertidas
 * em código permanente — deixaram de ser flags. Resta apenas a flag abaixo,
 * que segue DESLIGADA por padrão. O documento do Firestore pode ainda conter
 * chaves antigas: `normalizeFeatureFlags` as ignora (só lê chaves conhecidas),
 * então nada precisa ser alterado no banco.
 */

export const FEATURE_FLAG = Object.freeze({
  /**
   * Integração OFICIAL com o DUPR (fase 2 — reservado): puxar o rating por ID
   * e enviar partidas. Exige acesso de parceiro/clube DUPR e um backend com
   * credenciais. Sem efeito enquanto a integração não for implementada.
   */
  DUPR_OFFICIAL_SYNC: 'dupr_official_sync',

  /**
   * Home orientada a ação: a tela inicial ganha um bloco "O que fazer agora"
   * (próximo jogo, convites de dupla pendentes, torneios perto de você) e uma
   * faixa de evolução (streak, XP/nível, próxima conquista e metas). Aditivo —
   * desligada, a home segue exatamente como está.
   */
  ACTION_HOME: 'action_home',

  /**
   * Matchmaking inteligente: em "Encontrar jogadores", ordena e explica a
   * compatibilidade cruzando nível (escala 2.0–8.0), lado da quadra, cidade e
   * interesses em comum. Aditivo — desligada, a lista segue como está.
   */
  SMART_MATCHMAKING: 'smart_matchmaking',

  /**
   * Fluxo pós-jogo enxuto: ao lançar um resultado, o organizador vê um atalho
   * para "jogar de novo" com os mesmos atletas e um link para a evolução do
   * rating. Aditivo — desligada, o lançamento de resultado segue como está.
   */
  POST_GAME_FLOW: 'post_game_flow',

  /**
   * Notificações push (PWA): opt-in do atleta para receber avisos push
   * ("seu jogo é amanhã", "o sorteio saiu", "resultado lançado", "reserva
   * confirmada"), espelhando as notificações in-app. Requer configuração de
   * VAPID/FCM (env VITE_FIREBASE_VAPID_KEY). Aditivo e gracioso — desligada
   * ou sem VAPID, nada é registrado e nada muda.
   */
  PUSH_NOTIFICATIONS: 'push_notifications',

  /** Arena: painel operacional com KPIs semanais (ocupação, receita, mapa de
   * calor de horários, no-show). Aditivo — desligada, o painel segue como está. */
  ARENA_OPS_KPIS: 'arena_ops_kpis',

  /** Arena: checkout unificado reserva + PDV + Pix num fluxo só (Pix manual,
   * sem gateway). Aditivo — desligada, reserva e PDV seguem separados. */
  ARENA_UNIFIED_CHECKOUT: 'arena_unified_checkout',

  /** Arena: preço dinâmico (desconto em horário de baixa, preço de pico).
   * Aditivo — desligada, o preço segue a tabela padrão. */
  ARENA_DYNAMIC_PRICING: 'arena_dynamic_pricing',

  /** Arena: relacionamento com membros (mensalidade/pacotes, campanhas
   * segmentadas, responder avaliações). Aditivo — desligada, some. */
  ARENA_MEMBER_CRM: 'arena_member_crm',

  /** Professor: perfil público que se acha — filtros por nível/preço/local e
   * depoimentos/avaliações. Aditivo — desligada, o diretório segue como está. */
  COACH_PUBLIC_DISCOVERY: 'coach_public_discovery',

  /** Professor: agenda com reserva + pagamento (Pix manual) num fluxo, com
   * política de no-show. Aditivo — desligada, a solicitação de aula segue igual. */
  COACH_BOOKING_PAY: 'coach_booking_pay',

  /** Professor: gestão de alunos ligada à evolução (nível/rating, pacotes,
   * clínicas) no roster. Aditivo — desligada, o roster segue como está. */
  COACH_STUDENT_PROGRESS: 'coach_student_progress',

  /** Professor: nível validado pelo professor alimenta a semente do rating
   * (elo professor↔atleta↔ranking). Aditivo — desligada, a semente segue a
   * lógica atual (rating DUPR informado / nivelamento). */
  COACH_LEVEL_RATING_SEED: 'coach_level_rating_seed',
});

/** Metadados de exibição para o painel de flags (admin master). */
export const FEATURE_FLAG_META = Object.freeze({
  [FEATURE_FLAG.DUPR_OFFICIAL_SYNC]: {
    label: 'DUPR oficial (fase 2 — reservado)',
    description:
      'Reservado para a integração OFICIAL com o DUPR (puxar rating por ID e '
      + 'enviar partidas). Exige acesso de parceiro/clube DUPR e backend com '
      + 'credenciais. Sem efeito enquanto a integração não for implementada.',
  },
  [FEATURE_FLAG.ACTION_HOME]: {
    label: 'Home orientada a ação',
    description:
      'A tela inicial ganha um bloco "O que fazer agora" (próximo jogo, '
      + 'convites de dupla pendentes, torneios perto) e uma faixa de evolução '
      + '(streak, XP/nível, próxima conquista e metas). Desligada, a home segue '
      + 'exatamente como está.',
  },
  [FEATURE_FLAG.SMART_MATCHMAKING]: {
    label: 'Matchmaking inteligente',
    description:
      'Em "Encontrar jogadores", ordena e explica a compatibilidade cruzando '
      + 'nível (2.0–8.0), lado da quadra, cidade e interesses em comum. '
      + 'Desligada, a lista segue como está.',
  },
  [FEATURE_FLAG.POST_GAME_FLOW]: {
    label: 'Fluxo pós-jogo enxuto',
    description:
      'Ao lançar um resultado, mostra atalho para "jogar de novo" com os '
      + 'mesmos atletas e link para a evolução do rating. Desligada, o '
      + 'lançamento segue como está.',
  },
  [FEATURE_FLAG.PUSH_NOTIFICATIONS]: {
    label: 'Notificações push (PWA)',
    description:
      'Opt-in do atleta para receber avisos push ("seu jogo é amanhã", "o '
      + 'sorteio saiu", "resultado lançado", "reserva confirmada"), espelhando '
      + 'as notificações in-app. Requer configuração de VAPID/FCM. Desligada ou '
      + 'sem VAPID, nada é registrado e nada muda.',
  },
  [FEATURE_FLAG.ARENA_OPS_KPIS]: {
    label: 'Arena · Painel operacional (KPIs)',
    description:
      'Visão sintética "como foi minha semana": ocupação, receita, mapa de '
      + 'calor de horários e no-show num só lugar. Desligada, o painel segue como está.',
  },
  [FEATURE_FLAG.ARENA_UNIFIED_CHECKOUT]: {
    label: 'Arena · Checkout unificado (reserva + PDV + Pix)',
    description:
      'Reservar quadra, adicionar produtos e pagar por Pix num fluxo só '
      + '(Pix manual, sem gateway). Desligada, reserva e PDV seguem separados.',
  },
  [FEATURE_FLAG.ARENA_DYNAMIC_PRICING]: {
    label: 'Arena · Preço dinâmico',
    description:
      'Desconto em horário de baixa e preço de pico para encher a grade. '
      + 'Desligada, o preço segue a tabela padrão por dia/horário.',
  },
  [FEATURE_FLAG.ARENA_MEMBER_CRM]: {
    label: 'Arena · Relacionamento com membros',
    description:
      'Mensalidade/pacotes, campanhas segmentadas e resposta pública às '
      + 'avaliações, num painel de relacionamento. Desligada, some.',
  },
  [FEATURE_FLAG.COACH_PUBLIC_DISCOVERY]: {
    label: 'Professor · Perfil público que se acha',
    description:
      'Filtros por nível, preço e localização no diretório e depoimentos/'
      + 'avaliações no perfil. Desligada, o diretório segue como está.',
  },
  [FEATURE_FLAG.COACH_BOOKING_PAY]: {
    label: 'Professor · Agenda com reserva + pagamento',
    description:
      'Disponibilidade → aluno reserva → paga (Pix manual) num fluxo, com '
      + 'política de no-show. Desligada, a solicitação de aula segue como está.',
  },
  [FEATURE_FLAG.COACH_STUDENT_PROGRESS]: {
    label: 'Professor · Alunos ligados à evolução',
    description:
      'No roster, mostra o progresso do aluno (nível/rating), pacotes e '
      + 'clínicas. Desligada, o roster segue como está.',
  },
  [FEATURE_FLAG.COACH_LEVEL_RATING_SEED]: {
    label: 'Professor · Nível validado alimenta o rating',
    description:
      'O nível validado pelo professor vira semente do rating (elo professor↔'
      + 'atleta↔ranking). Desligada, a semente segue a lógica atual.',
  },
});

/** Valor padrão (todas as flags desligadas). */
export const DEFAULT_FEATURE_FLAGS = Object.freeze(
  Object.fromEntries(Object.values(FEATURE_FLAG).map((key) => [key, false])),
);

/** Todas as chaves de flag conhecidas (fonte única de verdade para contagens). */
export const ALL_FLAG_KEYS = Object.freeze(Object.values(FEATURE_FLAG));

/**
 * Conta flags de forma consistente em toda a UI: `total` é o número de flags
 * definidas em `FEATURE_FLAG`; `active` são as ligadas dentre elas (ignora
 * chaves órfãs no mapa do Firestore). Use este helper em TODA exibição de
 * "X ativas de Y" para não divergir entre telas.
 * @param {Record<string, boolean>|null|undefined} flags
 * @returns {{ total: number, active: number }}
 */
export function countFlags(flags) {
  const total = ALL_FLAG_KEYS.length;
  const active = ALL_FLAG_KEYS.filter((key) => Boolean(flags?.[key])).length;
  return { total, active };
}

/**
 * Normaliza um mapa de flags vindo do Firestore, garantindo booleanos e
 * preenchendo as ausentes com `false`. Ignora chaves desconhecidas.
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {Record<string, boolean>}
 */
export function normalizeFeatureFlags(raw) {
  const out = { ...DEFAULT_FEATURE_FLAGS };
  if (raw && typeof raw === 'object') {
    Object.values(FEATURE_FLAG).forEach((key) => {
      if (typeof raw[key] === 'boolean') out[key] = raw[key];
    });
  }
  return out;
}
