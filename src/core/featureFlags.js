/**
 * Catálogo de feature flags da plataforma.
 *
 * As flags são guardadas em um único documento do Firestore
 * (`platform_settings/global`, campo `feature_flags`) e podem ser ligadas/
 * desligadas em tempo de execução pelo admin master na página de Métricas.
 *
 * NOTA (2026-10-10): as 33 funcionalidades que estavam LIGADAS em produção
 * foram incorporadas — deixaram de ser flags e vivem em `PERMANENT_FEATURE`,
 * sempre `true`. Restam as flags de `FEATURE_FLAG` abaixo (lista viva em
 * `docs/46-INVENTARIO.md` §8), DESLIGADAS por padrão. A navegação
 * v3 (`nav_v3`, Fase 1 do plano de UX) foi ligada para todos e virou código
 * em 2026-10-11 — o ramo antigo foi apagado, não há mais flag. O documento
 * do Firestore ainda contém as chaves antigas: `normalizeFeatureFlags` as
 * ignora (só lê chaves conhecidas), então nada precisa ser alterado no banco.
 */

import { tk } from './i18n/engine.js';

export const FEATURE_FLAG = Object.freeze({
  /**
   * Integração OFICIAL com o DUPR (fase 2 — reservado): puxar o rating por ID
   * e enviar partidas. Exige acesso de parceiro/clube DUPR e um backend com
   * credenciais. Sem efeito enquanto a integração não for implementada.
   */
  DUPR_OFFICIAL_SYNC: 'dupr_official_sync',

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
   * MERCADO — o marketplace próprio da plataforma (`/mercado`).
   *
   * Vitrine de produtos de pickleball com busca, filtros, carrinho, favoritos,
   * perguntas, ofertas, pedidos com Pix direto ao vendedor e avaliações.
   * Vendem atletas e professores (Minha área → Vender), arenas (inclusive
   * produtos do Mercado da arena, com estoque único) e lojas aprovadas pelo
   * admin. NÃO é o Mercado interno da arena (`arena_*`): usa só coleções
   * `market_*`.
   *
   * Desligada, nada aparece — rota, menu, card do início, seção da Minha
   * área — e nenhuma coleção `market_*` é lida. Ligar e desligar não apaga
   * nada. Ver `src/modules/marketplace/README.md`.
   */
  MARKETPLACE: 'marketplace',

  /**
   * VÁRIOS IDIOMAS — português (padrão), inglês e espanhol.
   *
   * Cada pessoa escolhe o idioma em Configurações (e na tela de entrada); na
   * primeira visita vale o idioma do navegador, se for um dos suportados. O
   * texto em português continua sendo o código: sem catálogo ou sem tradução,
   * aparece em português. Catálogos por módulo, carregados só do idioma
   * escolhido (`src/core/i18n`, plano em docs/44-IDIOMAS.md).
   *
   * A escolha fica no aparelho (`picklerush:idioma`) e é copiada para
   * `users/{uid}.language` (campo opcional), para o aviso e o push saírem no
   * idioma de quem recebe e a escolha seguir a pessoa. Desligada,
   * tudo em português e nenhum seletor aparece — inclusive para quem tinha
   * escolhido outro idioma (a escolha é apagada ao abrir).
   */
  MULTI_LANGUAGE: 'multi_language',

});
/**
 * Funcionalidades INCORPORADAS (2026-10-10): eram flags, estavam ligadas em
 * produção e viraram permanentes por decisão do dono. Não são lidas do banco,
 * não aparecem no painel admin e valem `true` sempre — as constantes só
 * existem até os `if` que as consultam serem removidos, tela a tela
 * (guarda: `src/core/guards/flagsIncorporadas.test.js`).
 */
export const PERMANENT_FEATURE = Object.freeze({

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
  GAME_DEBRIEF: 'game_debrief',
});

/** Mapa { chave: true } das funcionalidades incorporadas. */
export const PERMANENT_FEATURES_ON = Object.freeze(
  Object.fromEntries(Object.values(PERMANENT_FEATURE).map((key) => [key, true])),
);

/** Metadados de exibição para o painel de flags (admin master). */
export const FEATURE_FLAG_META = Object.freeze({
  [FEATURE_FLAG.GAMEDAY_MEXICANO]: {
    label: tk('Dia de jogo — Mexicano'),
    description: tk('Oferece o Mexicano entre os formatos do dia de jogo: na criação, na troca de formato e no sorteio, no atleta, na arena, no clube e no jogo aberto. Desligada, a opção some daqui para frente — os dias já criados como Mexicano continuam funcionando normalmente.'),
  },
  [FEATURE_FLAG.GAMEDAY_KING_OF_COURT]: {
    label: tk('Dia de jogo — Rei da Quadra'),
    description: tk('Oferece o Rei da Quadra entre os formatos do dia de jogo: na criação, na troca de formato e no sorteio, no atleta, na arena, no clube e no jogo aberto. Desligada, a opção some daqui para frente — os dias já criados como Rei da Quadra continuam funcionando normalmente.'),
  },
  [FEATURE_FLAG.MARKETPLACE]: {
    label: tk('Mercado (marketplace)'),
    description: tk('Abre o Mercado em /mercado: anúncios de atletas, professores, arenas e lojas, com busca, filtros, carrinho, favoritos, perguntas, ofertas, pedidos com Pix direto ao vendedor e avaliações. Desligada, o Mercado some de todo lugar e nada é lido; anúncios e pedidos ficam guardados.'),
  },
  [FEATURE_FLAG.MULTI_LANGUAGE]: {
    label: tk('Vários idiomas (português, inglês, espanhol)'),
    description: tk('Mostra o seletor de idioma (Configurações e tela de entrada) e, na primeira visita, adota o idioma do navegador. O que ainda não foi traduzido aparece em português. Desligada, tudo em português e a escolha antiga é apagada. A escolha fica no aparelho.'),
  },
  [FEATURE_FLAG.DUPR_OFFICIAL_SYNC]: {
    label: tk('DUPR oficial (fase 2 — reservado)'),
    description: tk('Reservado para a integração OFICIAL com o DUPR (puxar rating por ID e enviar partidas). Exige acesso de parceiro/clube DUPR e backend com credenciais. Sem efeito enquanto a integração não for implementada.'),
  },
});

/** Valor padrão (todas as flags desligadas). */
export const DEFAULT_FEATURE_FLAGS = Object.freeze({
  ...PERMANENT_FEATURES_ON,
  ...Object.fromEntries(Object.values(FEATURE_FLAG).map((key) => [key, false])),
});

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
 * partindo de `DEFAULT_FEATURE_FLAGS` (flags ligáveis desligadas, permanentes
 * ligadas). Só lê chaves de `FEATURE_FLAG`; as demais são ignoradas.
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
