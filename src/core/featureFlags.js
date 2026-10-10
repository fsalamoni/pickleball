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
   * Dia de jogo (Play) — GRUPOS dentro do Play.
   *
   * Hoje o Play tem uma fila só: quem espera há mais tempo entra, e o nível só
   * entra na conta DEPOIS de escolhidos os quatro. Ligada, quem organiza cria
   * grupos (por nível, por tipo de dupla ou livres), coloca cada pessoa no seu
   * e o sorteio acontece DENTRO de cada grupo — com formação mista ou de mesmo
   * sexo, diferença máxima de nível, quadras próprias e uma política para
   * quando os grupos disputam as quadras (fila, revezamento ou prioridade).
   * O convidado avulso ganha nível e sexo na entrada e cai no grupo certo.
   *
   * Aditiva e sem impacto no banco: só campos OPCIONAIS (`play_groups` no dia,
   * `play_group_id` no participante, `group_id` na partida) — nenhuma coleção,
   * índice ou regra nova. Desligada, os grupos gravados são IGNORADOS e o Play
   * segue uma fila única, exatamente como antes. Ver `docs/39-PLAY-GRUPOS.md`.
   */
  PLAY_GROUPS: 'play_groups',

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
   * Dia de jogo — MEXICANO como formato ESCOLHÍVEL.
   *
   * O Mexicano sempre existiu no dia de jogo; a partir da Onda CE ele passa a
   * ser opcional, ligado pelo admin da plataforma. A flag decide só se o
   * formato APARECE para ser escolhido — na criação, na edição do formato e
   * no sorteio de grade, em toda origem (atleta, arena, clube, jogo aberto).
   *
   * O que ela NÃO faz, de propósito: tirar nada de quem já usa. Um dia de
   * jogo gravado como Mexicano continua abrindo, sorteando, lançando placar e
   * publicando como sempre, e o seletor dele mostra o formato que está
   * gravado mesmo com a flag desligada. Nenhum dado é lido de outro jeito,
   * nenhum é regravado. Fonte única das opções: `gameDayFormatChoices`.
   */
  GAMEDAY_MEXICANO: 'gameday_mexicano',

  /**
   * Dia de jogo — REI DA QUADRA como formato ESCOLHÍVEL.
   *
   * Mesma regra do Mexicano, com a própria chave: o admin liga um sem o
   * outro. Desligada, o Rei da Quadra some das listas de escolha daqui para
   * frente; os dias já gravados nele seguem funcionando (a próxima rodada,
   * que sai dos RESULTADOS da anterior, continua sendo gerada normalmente).
   */
  GAMEDAY_KING_OF_COURT: 'gameday_king_of_court',

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

  /**
   * MÓDULOS ADICIONAIS DA ARENA — a chave-mestra.
   *
   * Liga o mecanismo de três camadas dos módulos extras de arena:
   * (1) o admin da plataforma LIBERA cada módulo às arenas, em
   * Funcionalidades → Módulos de arena; (2) cada arena ATIVA para si o que foi
   * liberado, em Gestão → Configurações → Módulos; (3) atleta, professor e
   * equipe passam a ver a funcionalidade.
   *
   * Esta flag é a chave geral. Desligada, NADA disso existe: a aba do admin
   * não aparece, a aba da arena não aparece, e todo módulo resolve para
   * desligado — mesmo os que já estiverem liberados e ativados no banco.
   * É o botão de pânico, e é por isso que ele mora aqui e não no documento de
   * liberação.
   *
   * A liberação módulo a módulo NÃO é flag: são 45 módulos de produto, com
   * modo de liberação e observação, guardados em
   * `platform_settings/arena_modules`. Ver `docs/24-MODULOS-DE-ARENA/`.
   */
  ARENA_MODULES: 'arena_modules',

  /**
   * INÍCIO PERSONALIZADO — a tela inicial montada para cada pessoa.
   *
   * Junta o que a pessoa DISSE que quer (os interesses do cadastro/perfil) ao
   * que ela FAZ na plataforma (gere arena, dá aula, organiza torneio) e mostra
   * primeiro o que importa para ela: a agenda de todos os compromissos numa
   * linha do tempo, atalhos diretos (a Central da SUA arena, o painel de
   * professor, "criar torneio"…), torneios com inscrição aberta perto dela, o
   * resultado do último torneio, ranking e duplas, dias de jogo com vaga,
   * horários livres da arena de sempre, aulas e clubes.
   *
   * Só leitura: consulta o que as telas de sempre já consultam (com uma
   * leitura nova, de um documento/lista da própria pessoa, para o ranking) e
   * não grava nada. O único ato de escrita é o "Personalizar", que salva os
   * interesses no MESMO campo e pelo MESMO caminho do editor de perfil.
   * Desligada, a tela inicial segue exatamente como está.
   */
  PERSONALIZED_HOME: 'personalized_home',

  /**
   * INÍCIO SOB MEDIDA — cada pessoa escolhe os cards da tela inicial.
   *
   * Vale sobre a tela inicial personalizada (precisa de `personalized_home`).
   * Em vez de a tela decidir sozinha o que mostrar, a pessoa escolhe — em
   * Configurações → Página inicial ou no "Personalizar" do próprio início —
   * quais cards aparecem e em que ordem. O padrão são TRÊS: Dias de jogo,
   * Horários da arena e Ranking; o resto começa desligado e pode ser ligado
   * (o que a pessoa faz na plataforma vira SUGESTÃO no seletor). Avisos com
   * prazo, como a chamada da fila de um jogo aberto, aparecem sempre.
   *
   * Zero banco: a escolha fica no navegador, por usuário
   * (`v2:view:<uid>:inicio:cards`). Desligada, o início segue decidindo
   * sozinho, como antes.
   */
  HOME_CARDS: 'home_cards',

  /**
   * CAMPANHAS E CUPONS DA PLATAFORMA — o admin anuncia para todo mundo.
   *
   * As mesmas ferramentas do marketing da arena (cupons por tipo com arte de
   * tíquete, banners com cinco modelos ou arte enviada, destino de lista
   * fechada, aviso com o público contado antes, pausa e página da campanha),
   * emitidas pela PLATAFORMA, para todos os usuários ou por região/interesse.
   * Coleções próprias (`promo_coupons`, `promo_campaigns`, `promo_settings`),
   * aditivas: nenhuma coleção de arena é tocada. Desligada, a aba do admin
   * não existe e nada aparece para ninguém.
   */
  PLATFORM_MARKETING: 'platform_marketing',

  /**
   * CAMPANHAS E CUPONS DOS PROFESSORES — cada professor anuncia o que é seu.
   *
   * No painel do professor, a seção "Divulgação": cupons (desconto em aula,
   * aula grátis, clínica, brinde…) e campanhas com banner, para todos os
   * usuários ou só para os alunos, com o aviso indo para os alunos. O cupom
   * pode ser informado no pedido de aula e é contado quando o professor
   * confirma. Mesmas coleções aditivas do marketing da plataforma. Desligada,
   * a seção não existe e nada aparece para ninguém.
   */
  COACH_MARKETING: 'coach_marketing',

  /**
   * MODO ESCURO — cada pessoa escolhe a aparência: Claro, Escuro ou
   * Automático (acompanha o sistema do aparelho).
   *
   * A paleta escura é derivada da própria marca (ink, acid, paper) e mora
   * numa fonte única (`src/core/theme/palette.js`); as telas continuam
   * escrevendo as classes de sempre. Impresso é sempre claro, e o telão, o
   * totem e a moldura dos QR codes ficam claros de propósito.
   *
   * Zero banco: a escolha fica no navegador, por usuário
   * (`v2:view:<uid>:aparencia:tema`). Desligada, todo mundo vê o claro de
   * sempre, pixel a pixel — inclusive quem tinha escolhido o escuro (a escolha
   * fica guardada e volta se a flag for religada).
   */
  DARK_MODE: 'dark_mode',

  /**
   * DICAS GUIADAS — as dicas na tela, que cada pessoa liga ou desliga.
   *
   * Um botão "Dicas" no topo de toda tela. Ligadas, pontos pulsando ao lado
   * dos botões dizem aonde cada um leva, e "O que você quer fazer?" abre um
   * GUIA para cada tarefa — criar dia de jogo, reservar quadra, inscrever-se
   * num torneio, configurar as quadras da arena… — com destaque e SETA sobre
   * o botão de verdade, passo a passo, inclusive dentro dos formulários. Os
   * tutoriais das ferramentas ("Como funciona") viram guias na tela e deixam
   * de abrir sozinhos: nada aparece sem a pessoa pedir.
   *
   * Zero banco: a escolha fica no navegador, por usuário
   * (`v2:view:<uid>:dicas:*`). Desligada, o botão não existe e os tutoriais
   * seguem como antes (abrindo na primeira vez).
   */
  GUIDED_TIPS: 'guided_tips',

  /**
   * CADASTRO ESSENCIAL — o que o sorteio e a busca por perto precisam.
   *
   * O assistente de cadastro já exigia nome, nascimento, telefone, gênero,
   * cidade, UF, experiência, lado da quadra e interesses. Faltavam duas coisas
   * que o sorteio usa e que ficavam em branco: a CATEGORIA em que a pessoa
   * joga (masculina/feminina — a das duplas mistas e das categorias dos
   * torneios) e o NÍVEL (ao menos a autoindicação). Ligada, as duas passam a
   * ser obrigatórias, a UF precisa ser uma UF de verdade, e quem já está
   * dentro é chamado a completar SÓ o que falta, na próxima entrada. DUPR
   * (ID e rating) segue opcional, pedido junto do nível.
   *
   * Zero banco: são campos que o perfil já tinha (`competition_gender`,
   * `leveling_level`, `dupr_id`). Desligada, o cadastro segue como está.
   */
  ESSENTIAL_PROFILE: 'essential_profile',
  // MINHA REGIÃO: o que a plataforma mostra (dias de jogo, torneios, arenas,
  // professores, clubes, promoções) segue a região de cada pessoa — a cidade
  // e um raio, o estado, outro lugar ou todo lugar. Escolha no navegador, por
  // usuário; zero banco. Ver docs/34-MINHA-REGIAO.md.
  MY_REGION: 'my_region',

  /**
   * CENTRAL DE NOTIFICAÇÕES — a página `/notificacoes`, com TODOS os avisos
   * da pessoa, os novos e os antigos: agrupados por dia, filtráveis (não
   * lidas, área, busca), marcar como lida ou não lida. O sino passa a mostrar
   * os 20 mais novos e "Ver todas". Desligada, o sino mostra a lista inteira
   * (agora com rolagem) e a página não existe.
   *
   * Zero banco: lê a mesma consulta do sino (`user_id == uid`), e marcar lida
   * ou não lida usa os campos de sempre (`read`, `read_at`).
   */
  NOTIFICATIONS_CENTER: 'notifications_center',

  /**
   * AMERICANO APRIMORADO EM ETAPAS — formato de fase de torneio (inscrição
   * individual): em cada etapa os atletas jogam um Americano em grupos (de 4,
   * por padrão); a cada etapa os grupos são refeitos misturando quem ainda não
   * se encontrou, e a classificação é uma só, somando todas as etapas.
   * Desligada, o formato não é oferecido no editor de fases — modalidades já
   * criadas nele seguem funcionando.
   *
   * Zero banco: a etapa de cada jogo mora no nome do grupo que o jogo sempre
   * teve, e a fase ganha só `etapa_count` dentro de `stages[]`.
   */
  TOURNAMENT_AMERICANO_ETAPAS: 'tournament_americano_etapas',

  /**
   * MINHA ÁREA — o `/perfil` vira a central de cada pessoa: um resumo no
   * topo e seções pelo que ela FAZ (perfil, treino, jogos, agenda, torneios,
   * clubes, aulas, arena, conta). Desligada, o `/perfil` segue como está.
   * Zero banco: só lê o que as telas de hoje já leem. Ver docs/41-MINHA-AREA.md.
   */
  USER_HUB: 'user_hub',

  /**
   * CENTRO DE TREINO — `/treino`: biblioteca de drills e treinos da
   * plataforma, dos professores e da comunidade; criar com o modelo padrão
   * (passo a passo, certo × errado, diagrama de quadra, fotos e vídeos);
   * indicar a outros atletas e — só professor — enviar aos alunos; o treino
   * de hoje, planos, diário e evolução; dúvidas ao professor; e a seção
   * Treino do painel admin (conteúdo, revisão, denúncias, ajustes).
   * Coleções novas `training_*` e a pasta `treino/` do Storage (regras
   * aditivas). Desligada, nada disso aparece. Ver docs/40-CENTRO-DE-TREINO.md.
   */
  TRAINING_CENTER: 'training_center',
  // Balanço do jogo: depois de jogar, a pessoa que ligou para si responde como
  // foi e recebe a sugestão da semana de treino (só vale com training_center).
  GAME_DEBRIEF: 'game_debrief',
});

/** Metadados de exibição para o painel de flags (admin master). */
export const FEATURE_FLAG_META = Object.freeze({
  [FEATURE_FLAG.PERSONALIZED_HOME]: {
    label: 'Início personalizado',
    description:
      'A tela inicial passa a ser montada para cada pessoa, pelos interesses '
      + 'do perfil e pelo que ela faz na plataforma: agenda com todos os '
      + 'compromissos, atalhos diretos (a Central da arena de quem gere, o '
      + 'painel de quem dá aula, criar torneio de quem organiza), torneios com '
      + 'inscrição aberta perto, o resultado do último torneio, ranking e '
      + 'duplas, dias de jogo com vaga, horários livres, aulas e clubes. Nada '
      + 'encerrado ou vencido aparece. Só leitura. Desligada, a tela inicial '
      + 'segue como está.',
  },
  [FEATURE_FLAG.HOME_CARDS]: {
    label: 'Início sob medida (escolher os cards)',
    description:
      'Cada pessoa escolhe os cards da tela inicial e a ordem deles — em '
      + 'Configurações → Página inicial ou no "Personalizar" do próprio início. '
      + 'Por padrão vêm só três: Dias de jogo, Horários da arena e Ranking; o '
      + 'resto pode ser ligado, e o que a pessoa faz na plataforma aparece como '
      + 'sugestão. Precisa do "Início personalizado" ligado. A escolha fica no '
      + 'navegador de cada um; nada é gravado no banco. Desligada, o início '
      + 'segue decidindo sozinho o que mostrar.',
  },
  [FEATURE_FLAG.PLATFORM_MARKETING]: {
    label: 'Campanhas e cupons da plataforma',
    description:
      'Ganha a aba "Campanhas e cupons" aqui no painel (em Plataforma): cupons '
      + 'por tipo com arte de tíquete e código para copiar, campanhas com '
      + 'banner (cinco modelos ou arte enviada), destino da lista fechada, '
      + 'aviso para todos, por região ou por interesse — com o número de '
      + 'pessoas antes de enviar — e controle de uso. O que for divulgado '
      + 'aparece na tela inicial de todos. Desligada, nada disso existe.',
  },
  [FEATURE_FLAG.COACH_MARKETING]: {
    label: 'Campanhas e cupons dos professores',
    description:
      'Cada professor ganha, no painel dele, a seção "Divulgação": cupons '
      + '(desconto em aula, aula grátis, clínica, brinde…) e campanhas com '
      + 'banner, para todos os usuários ou só para os alunos, com aviso aos '
      + 'alunos. O aluno informa o cupom ao pedir a aula e ele é contado '
      + 'quando o professor confirma. Os banners e cupons aparecem na tela '
      + 'inicial e no perfil do professor. Desligada, nada disso existe.',
  },
  [FEATURE_FLAG.DARK_MODE]: {
    label: 'Modo escuro',
    description:
      'Cada pessoa passa a escolher a aparência da plataforma — Claro, Escuro '
      + 'ou Automático (acompanha o aparelho) — no menu do usuário, na gaveta '
      + 'do celular e em Configurações. O escuro segue as cores da marca, com '
      + 'contraste conferido. Impresso, telão e totem continuam claros. A '
      + 'escolha fica só no navegador de cada um; nada é gravado no banco. '
      + 'Desligada, todos veem o claro de sempre.',
  },
  [FEATURE_FLAG.ARENA_MODULES]: {
    label: 'Módulos adicionais da arena (chave geral)',
    description:
      'Liga o mecanismo dos módulos extras de arena. Com ela ativa, aparece a '
      + 'aba "Módulos de arena" aqui em Funcionalidades, onde você libera cada '
      + 'módulo às arenas — e cada arena passa a ter, em Configurações, a '
      + 'escolha de ativar para si o que foi liberado. Desligada, nada disso '
      + 'existe para ninguém: nem a aba daqui, nem a da arena, nem os módulos '
      + 'que já estiverem ativados.',
  },
  [FEATURE_FLAG.GUIDED_TIPS]: {
    label: 'Dicas guiadas (guias na tela)',
    description:
      'Um botão "Dicas" no topo de toda tela, que cada pessoa liga ou desliga. '
      + 'Ligadas, pontos pulsando mostram o que cada botão faz, e "O que você '
      + 'quer fazer?" traz um guia para cada tarefa (criar dia de jogo, '
      + 'reservar quadra, inscrever-se em torneio, configurar a arena…), com '
      + 'destaque e seta sobre o botão real, passo a passo. Os "Como funciona" '
      + 'das ferramentas viram guias na tela e param de abrir sozinhos. A '
      + 'escolha fica no navegador de cada um; nada é gravado no banco. '
      + 'Desligada, tudo segue como antes.',
  },
  [FEATURE_FLAG.ESSENTIAL_PROFILE]: {
    label: 'Cadastro essencial (categoria e nível obrigatórios)',
    description:
      'O cadastro passa a exigir também a categoria em que a pessoa joga '
      + '(masculina ou feminina — usada nas duplas mistas do dia de jogo e nas '
      + 'categorias dos torneios) e o nível, ao menos o que ela mesma indica. '
      + 'A UF passa a ser escolhida numa lista. Quem já tem conta é chamado a '
      + 'completar só o que falta, na próxima entrada. ID e rating DUPR seguem '
      + 'opcionais. Nada é gravado além do que a pessoa preencher. Desligada, o '
      + 'cadastro segue como está.',
  },
  [FEATURE_FLAG.MY_REGION]: {
    label: 'Minha região (cidade + raio, estado ou todo lugar)',
    description:
      'O que a plataforma mostra passa a seguir a região de cada pessoa: dias '
      + 'de jogo e jogos com vaga, torneios, arenas, professores, clubes e '
      + 'promoções. O padrão é a cidade do perfil e até 50 km; em Configurações '
      + '→ Minha região a pessoa escolhe outro raio, o estado inteiro, outro '
      + 'lugar (quem vai viajar), a localização do aparelho ou todo lugar. O que '
      + 'fica de fora não some: cada tela diz quantos são e oferece ver também. '
      + 'A escolha fica no navegador; nada é gravado no banco. Desligada, as '
      + 'telas seguem como estão.',
  },
  [FEATURE_FLAG.NOTIFICATIONS_CENTER]: {
    label: 'Central de notificações (histórico de avisos)',
    description:
      'Publica a página Notificações: todos os avisos de cada pessoa, os '
      + 'novos e os antigos, agrupados por dia (hoje, ontem, últimos 7 dias e '
      + 'por mês), com filtro de não lidas, filtro por área (jogos, torneios, '
      + 'arenas, clubes, aulas, mensagens, promoções), busca e marcar como '
      + 'lida ou não lida. O sino mostra os 20 mais novos e leva à página. '
      + 'Nada novo é gravado no banco. Desligada, o sino mostra a lista '
      + 'inteira, com rolagem, e a página não existe.',
  },
  [FEATURE_FLAG.TOURNAMENT_AMERICANO_ETAPAS]: {
    label: 'Torneio — Americano aprimorado em etapas',
    description:
      'Oferece um formato novo de fase para modalidades de inscrição '
      + 'individual: os atletas jogam em etapas, cada etapa um Americano em '
      + 'grupos (de 4, 5, 8 ou 9). A cada etapa os grupos são refeitos, '
      + 'misturando quem ainda não se encontrou para criar o máximo de jogos '
      + 'inéditos, e a classificação é uma só, somando todas as etapas — o '
      + 'campeão é quem foi melhor no total. O organizador escolhe quantas '
      + 'etapas. Desligada, o formato some do editor daqui para frente; as '
      + 'modalidades já criadas nele seguem funcionando.',
  },
  [FEATURE_FLAG.USER_HUB]: {
    label: 'Minha área (o perfil como central)',
    description:
      'O Perfil vira "Minha área": um resumo da pessoa no topo e as seções '
      + 'pelo que ela faz na plataforma — perfil e nível, treino, jogos, '
      + 'agenda, torneios, clubes, aulas, arena, conta e privacidade —, cada '
      + 'uma levando à tela que resolve. Só leitura; nada novo no banco. '
      + 'Desligada, o Perfil segue como está.',
  },
  [FEATURE_FLAG.TRAINING_CENTER]: {
    label: 'Centro de Treino',
    description:
      'Publica /treino: a biblioteca de drills e treinos (da PickleRush, dos '
      + 'professores e da comunidade), o modelo padrão para criar (objetivo, '
      + 'passo a passo, certo × errado, erros e correções, diagrama de quadra, '
      + 'fotos e vídeos por link ou envio), indicar a outros atletas e — só '
      + 'professor — enviar aos alunos com prazo; o treino de hoje, planos, '
      + 'diário e evolução; dúvidas ao professor. No painel admin, a seção '
      + 'Treino controla todo o conteúdo (editar, ocultar, destacar, excluir), '
      + 'a revisão do que é publicado, as denúncias, a biblioteca inicial e os '
      + 'limites de envio. Desligada, nada disso aparece.',
  },
  [FEATURE_FLAG.GAME_DEBRIEF]: {
    label: 'Balanço do jogo (treino sugerido depois de jogar)',
    description:
      'Depois de um dia de jogo, de um torneio ou de um jogo na arena, quem '
      + 'LIGOU o balanço nas próprias Configurações responde em menos de um '
      + 'minuto como foi, o que funcionou, o que faltou, se sentiu evolução e '
      + 'como estavam o corpo e a cabeça. A plataforma junta isso com os '
      + 'balanços anteriores e sugere a semana de treino (drills da '
      + 'biblioteca, no nível e nos dias da pessoa), que ela escolhe se põe '
      + 'nos seus treinos. Aba "Balanço" no /treino, lembrete no início e na '
      + 'Minha área, e missões semanais e mensais na gamificação para quem '
      + 'ligou. Só vale com o Centro de Treino ligado. Desligada, nada aparece.',
  },
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
  [FEATURE_FLAG.GAMEDAY_MEXICANO]: {
    label: 'Dia de jogo — Mexicano',
    description:
      'Oferece o Mexicano entre os formatos do dia de jogo: na criação, na '
      + 'troca de formato e no sorteio, no atleta, na arena, no clube e no '
      + 'jogo aberto. Desligada, a opção some daqui para frente — os dias já '
      + 'criados como Mexicano continuam funcionando normalmente.',
  },
  [FEATURE_FLAG.GAMEDAY_KING_OF_COURT]: {
    label: 'Dia de jogo — Rei da Quadra',
    description:
      'Oferece o Rei da Quadra entre os formatos do dia de jogo: na criação, '
      + 'na troca de formato e no sorteio, no atleta, na arena, no clube e no '
      + 'jogo aberto. Desligada, a opção some daqui para frente — os dias já '
      + 'criados como Rei da Quadra continuam funcionando normalmente.',
  },
  [FEATURE_FLAG.PLAY_SMART_ROTATION]: {
    label: 'Dia de jogo (Play) — rodízio equilibrado',
    description:
      'Varia os grupos e as duplas na criação das partidas do Play, sem furar '
      + 'a ordem de participação: o primeiro da fila entra sempre e a escolha '
      + 'fica dentro de uma janela curta. Evita que os mesmos quartetos se '
      + 'repitam rodada após rodada. Desligada, nada muda.',
  },
  [FEATURE_FLAG.PLAY_GROUPS]: {
    label: 'Dia de jogo (Play) — grupos',
    description:
      'Deixa quem organiza um Play criar GRUPOS — por nível, por tipo de dupla '
      + '(mistas, masculinas, femininas) ou livres — e sortear as partidas dentro '
      + 'de cada um. Cada grupo tem faixa de nível, formação das duplas, '
      + 'diferença máxima de nível e quadras próprias; uma política decide quem '
      + 'entra quando os grupos disputam as quadras. O convidado avulso informa '
      + 'nível e sexo e cai no grupo certo, e há uma distribuição automática por '
      + 'nível com prévia. Tudo vale no painel, no telão e na visão do jogador. '
      + 'Só campos opcionais no banco. Desligada, os grupos gravados são '
      + 'ignorados e o Play segue com a fila única de sempre.',
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
