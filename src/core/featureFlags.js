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
   * Exportação de partidas para o DUPR (admin da plataforma): uma seção no
   * painel admin que extrai o histórico de partidas disputadas (torneios +
   * dias de jogo/eventos espelhados no ranking), com filtros por data, torneio,
   * clube, dia de jogo, evento, atleta e tipo, e gera um CSV no formato de
   * upload de clubes do DUPR (27 colunas). Aditivo e somente leitura —
   * desligada, a seção não existe e nada muda.
   */
  DUPR_MATCH_EXPORT: 'dupr_match_export',

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

  /**
   * GAMIFICATION V2 — master flag.
   *
   * Habilita o sistema novo de progressão (tiers com nome, skill trees,
   * XP multi-fonte, caps, missões, achievements V2 com 5 famílias,
   * streak com proteção). É a porta de entrada para todas as features
   * do roadmap `docs/FUTURO/GAMIFICACAO/00-ROADMAP.md`.
   *
   * **Comportamento desligado**: NADA muda. XP/nível/achievements V1
   * continuam funcionando exatamente como antes.
   *
   * **Comportamento ligado**: as rotas `/gamification`, `/conquistas`,
   * `/conquistas/:uid` e `/hall-da-fama` saem do empty state, e o bloco
   * "Sua progressão" aparece no `/perfil`. O cálculo de XP total V2 convive
   * com V1 via `computeXpCompatV1` (mesma numeração).
   *
   * Não há sub-flags: esta é a única chave da gamificação V2.
   *
   * Aditivo. Default OFF.
   */
  GAMIFICATION_V2: 'gamification_v2',

  /**
   * Dia de jogo (Play): RODÍZIO EQUILIBRADO na criação das partidas.
   *
   * Problema que resolve: hoje a próxima partida pega rigidamente os 4
   * primeiros da fila. Como as partidas terminam mais ou menos na ordem em
   * que começaram, a fila se reforma em blocos de 4 e os MESMOS quartetos
   * voltam a jogar juntos rodada após rodada — em 12 jogadores e 2 quadras,
   * medimos apenas 3 quartetos distintos em 41 partidas, um deles repetido
   * 14 vezes.
   *
   * Ligada, a escolha passa a olhar uma janela curta (4 vagas + 4 seguintes)
   * e prefere a combinação que menos repete encontros já ocorridos, pagando
   * um custo por descer na fila. As duplas dentro do quarteto também variam.
   *
   * Garantias: o primeiro elegível da fila entra SEMPRE; ninguém é chamado de
   * fora da janela; duplas fixas continuam juntas; a maior espera entre duas
   * partidas de um jogador cresce no máximo 1 jogo. Se não houver combinação
   * válida, cai de volta no comportamento atual.
   *
   * Aditiva e sem impacto no banco: o histórico é derivado das partidas já
   * carregadas. Desligada, NADA muda. Ver `games/domain/playRotation.js`.
   */
  PLAY_SMART_ROTATION: 'play_smart_rotation',

  /**
   * Dia de jogo — AMERICANO APRIMORADO.
   *
   * Formato novo (`americano_live`) que mescla os dois modelos existentes: a
   * organização quadra a quadra do Play com o sorteio e o placar do Americano.
   * As partidas são sorteadas UMA A UMA, com os participantes disponíveis
   * naquele momento, usando o motor do Americano — então valem as regras de
   * duplas inéditas, adversários inéditos, equilíbrio de participação e de
   * nível. Cada partida grava resultado, alimenta o ranking do dia e pode ir
   * para o ranking/rating da plataforma e para o DUPR.
   *
   * Aditiva: cria um formato NOVO. Nenhum dia de jogo existente muda de
   * comportamento, porque nenhum deles tem esse formato gravado. Desligada, a
   * opção nem aparece na criação.
   */
  GAMEDAY_AMERICANO_LIVE: 'gameday_americano_live',

  /**
   * CENTRAL DE AJUDA — a página `/ajuda`.
   *
   * Um manual completo da plataforma, separado por tipo de usuário (atleta,
   * arena, professor), mais o que é comum a todos (começar, conta e
   * privacidade). Só leitura: nenhuma consulta, nenhuma escrita, nenhuma
   * coleção. O conteúdo é estático, vem do domínio e é carregado sob demanda.
   *
   * Aditiva: uma rota nova e um link na navegação. Desligada, a rota redireciona
   * para a Home e o link não existe — nada muda para ninguém.
   */
  HELP_CENTER: 'help_center',

  /**
   * DIA DE JOGO DA ARENA — a arena cria o seu próprio dia de jogo.
   *
   * A arena marca o dia de jogo no calendário (o que FECHA a data e as quadras
   * escolhidas para reserva), define horário do dia todo ou por quadra, limite
   * de atletas por dia ou por quadra (ou nenhum), e se só a equipe da arena
   * conduz as partidas ou se os inscritos também. O atleta marca presença pela
   * página e pelo calendário da arena.
   *
   * Aditiva por construção: é o MESMO `game_days` que já existe, com campos
   * novos e opcionais (`arena_id`, `arena_slots`, `signup_mode`, `capacity`).
   * Um dia de jogo sem `arena_id` não é tocado por nada disso. Desligada, a
   * aba não aparece na arena, a seção some da página pública e a rota
   * redireciona — nada muda para ninguém.
   */
  ARENA_GAME_DAY: 'arena_game_day',
});

/** Metadados de exibição para o painel de flags (admin master). */
export const FEATURE_FLAG_META = Object.freeze({
  [FEATURE_FLAG.HELP_CENTER]: {
    label: 'Central de ajuda',
    description:
      'Publica a página /ajuda: um manual completo da plataforma, com partes '
      + 'separadas para atleta, arena e professor, além do que vale para todos '
      + '(primeiros passos, conta e privacidade). Ganha um link na navegação, '
      + 'em todas as telas. Só leitura — não consulta nem grava nada. '
      + 'Desligada, a página não existe e o link não aparece.',
  },
  [FEATURE_FLAG.ARENA_GAME_DAY]: {
    label: 'Dia de jogo da arena',
    description:
      'Deixa a arena criar os próprios dias de jogo, marcados no calendário: '
      + 'escolher data, quadras e horários (do dia todo ou de cada quadra), '
      + 'fechar essas quadras para reserva, definir limite de atletas por dia '
      + 'ou por quadra (ou nenhum) e decidir se só a equipe da arena conduz as '
      + 'partidas. Os atletas marcam presença pela página e pelo calendário da '
      + 'arena, e o dia de jogo abre no mesmo organizador de sempre. '
      + 'Desligada, a aba, a seção e a rota não existem.',
  },
  [FEATURE_FLAG.GAMEDAY_AMERICANO_LIVE]: {
    label: 'Dia de jogo — Americano aprimorado',
    description:
      'Formato novo que junta a organização do Play (quadra a quadra, um jogo '
      + 'por vez, com fila e pausa) ao sorteio e ao placar do Americano. As '
      + 'partidas saem uma a uma, sempre com quem está disponível no momento, '
      + 'e cada uma grava resultado, entra no ranking do dia e pode ir para o '
      + 'ranking da plataforma e o DUPR. Desligada, a opção nem aparece.',
  },
  [FEATURE_FLAG.PLAY_SMART_ROTATION]: {
    label: 'Dia de jogo (Play) — rodízio equilibrado',
    description:
      'Varia os grupos e as duplas na criação das partidas do Play, sem furar '
      + 'a ordem de participação: o primeiro da fila entra sempre e a escolha '
      + 'fica dentro de uma janela curta. Evita que os mesmos quartetos se '
      + 'repitam rodada após rodada. Desligada, nada muda.',
  },
  [FEATURE_FLAG.DUPR_OFFICIAL_SYNC]: {
    label: 'DUPR oficial (fase 2 — reservado)',
    description:
      'Reservado para a integração OFICIAL com o DUPR (puxar rating por ID e '
      + 'enviar partidas). Exige acesso de parceiro/clube DUPR e backend com '
      + 'credenciais. Sem efeito enquanto a integração não for implementada.',
  },
  [FEATURE_FLAG.DUPR_MATCH_EXPORT]: {
    label: 'DUPR · Exportação de partidas (CSV)',
    description:
      'Adiciona ao painel admin uma seção para extrair o histórico de partidas '
      + 'disputadas (torneios + dias de jogo/eventos espelhados no ranking), com '
      + 'filtros por data, torneio, clube, dia de jogo, evento, atleta e tipo, e '
      + 'gerar um CSV no formato de upload de clubes do DUPR. Somente leitura — '
      + 'desligada, a seção não existe.',
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
  [FEATURE_FLAG.GAMIFICATION_V2]: {
    label: 'Gamificação V2 (master)',
    description:
      'Liga o sistema novo de progressão: tiers com nome (Calouro→Imortal), '
      + '5 trilhas paralelas de XP, XP multi-fonte com limites anti-farm, '
      + 'conquistas V2 (5 famílias e 5 raridades), missões diárias, sequência '
      + 'com dias de folga e modo férias, kudos e programa de indicação. '
      + 'Desligada, NADA muda — XP/nível/conquistas V1 seguem intactos.',
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
