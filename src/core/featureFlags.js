/**
 * Catálogo de feature flags da plataforma.
 *
 * As flags são guardadas em um único documento do Firestore
 * (`platform_settings/global`, campo `feature_flags`) e podem ser ligadas/
 * desligadas em tempo de execução pelo admin master na página de Métricas.
 *
 * TODAS as flags nascem DESLIGADAS (`false`). Enquanto uma flag está desligada
 * a funcionalidade associada fica completamente invisível e inerte — nada do
 * comportamento já existente é alterado. Isso garante que estas implementações
 * sejam puramente aditivas.
 */

export const FEATURE_FLAG = Object.freeze({
  /**
   * Torneios em múltiplas fases: permite ao admin do torneio configurar uma
   * modalidade com várias fases encadeadas (grupos/americano/mata-mata/etc.),
   * com divisão em grupos equilibrados, qualificação de classificados e
   * progressão automática entre as fases. Inscrição segue em lista única.
   */
  MULTI_PHASE_TOURNAMENTS: 'multi_phase_tournaments',

  /**
   * Cards de compartilhamento (UGC): habilita o botão "Compartilhar" que gera
   * um card visual do torneio (com QR Code e link público) pronto para
   * WhatsApp/Stories, além do compartilhamento por link pré-preenchido. É
   * puramente aditivo — desligado, o botão some e nada muda no fluxo atual.
   */
  SHARE_CARDS: 'share_cards',

  /**
   * Página "Meu Desempenho": painel pessoal do atleta com torneios disputados,
   * vitórias/derrotas, aproveitamento, pódios e títulos, consolidados a partir
   * dos jogos já registrados. Aditivo — desligado, a rota e o menu somem.
   */
  PLAYER_PERFORMANCE: 'player_performance',

  /**
   * Diretório de treinadores: permite ao atleta se declarar treinador (bio,
   * valor e regiões de atuação) e ser encontrado no diretório por um filtro
   * dedicado, com contato pelo chat existente. Aditivo — desligado, a seção do
   * perfil e o filtro/badge do diretório ficam ocultos.
   */
  COACH_DIRECTORY: 'coach_directory',

  /**
   * Rating ELO próprio + Ranking nacional: calcula um rating por jogador a
   * partir dos jogos finalizados e exibe um ranking público (filtrável por
   * cidade/estado/nível). O recálculo é acionado pelo admin master. Aditivo —
   * desligado, a rota /ranking, o menu e o botão de recálculo ficam ocultos.
   */
  PLAYER_RATING: 'player_rating',

  /**
   * Matchmaking por nível: página "Encontrar jogadores" que sugere parceiros e
   * adversários com rating próximo (e, opcionalmente, da mesma cidade), com
   * atalho para conversar. Depende de `player_rating` (usa o rating calculado).
   * Aditivo — desligado, a rota e o item de menu ficam ocultos.
   */
  MATCHMAKING: 'matchmaking',

  /**
   * "Procura-se jogo": mural de partidas sociais abertas. O atleta publica um
   * convite (quando, cidade, nível, formato, observações) e outros encontram
   * por cidade/nível e chamam pelo chat. Aditivo — desligado, a rota e o menu
   * ficam ocultos.
   */
  OPEN_GAMES: 'open_games',

  /**
   * Afiliados e parcerias: o admin cadastra links de afiliado/patrocinadores e
   * os atletas veem uma página de parceiros; os cliques são medidos via
   * analytics. Aditivo — desligado, as rotas e os menus ficam ocultos.
   */
  AFFILIATE_LINKS: 'affiliate_links',

  /**
   * Instrumentação de funil: envia eventos de produto (login, perfil completo,
   * torneio criado, inscrição criada, convite aberto) ao Firebase Analytics
   * para medir conversão e o efeito das demais funcionalidades. Aditivo e
   * invisível ao usuário — desligado, nenhum evento de funil é enviado.
   */
  FUNNEL_ANALYTICS: 'funnel_analytics',

  /**
   * Página rica do atleta (`/atleta/:uid`): reúne dados públicos, rating e
   * posição, desempenho, conquistas e clubes num só lugar. Aditivo — desligado,
   * a rota some e os links para ela não aparecem (o diretório segue igual).
   */
  ATHLETE_PROFILE_PAGE: 'athlete_profile_page',

  /**
   * Conquistas/medalhas: desbloqueadas por marcos (vitórias, pódios, títulos,
   * torneios, rating), calculadas a partir dos dados já existentes. Aditivo —
   * desligado, a seção de conquistas não aparece.
   */
  ACHIEVEMENTS: 'achievements',

  /**
   * Filtros segmentados no ranking nacional (clube, gênero, faixa etária),
   * além dos já existentes de estado/nível. Aditivo — desligado, apenas os
   * filtros atuais aparecem.
   */
  RANKING_FILTERS: 'ranking_filters',

  /**
   * Evolução do rating: a cada recálculo, grava um ponto histórico por jogador
   * e exibe um gráfico de evolução no perfil e em "Meu Desempenho". Aditivo —
   * desligado, o gráfico não aparece (os pontos seguem sendo registrados).
   */
  RATING_HISTORY: 'rating_history',

  /**
   * Confrontos diretos (head-to-head) e rivais: agrega os jogos do atleta por
   * adversário (vitórias/derrotas) e destaca os rivais mais frequentes, exibido
   * no perfil. Aditivo — desligado, a seção não aparece.
   */
  HEAD_TO_HEAD: 'head_to_head',

  /**
   * Seguir atletas: permite acompanhar outros atletas (botão Seguir no perfil e
   * no diretório), com notificação ao seguido. Base para o feed da comunidade.
   * Aditivo — desligado, os botões e contagens não aparecem.
   */
  FOLLOW_ATHLETES: 'follow_athletes',

  /**
   * Feed da comunidade: página "Novidades" agregando atividade recente
   * (torneios públicos, convites de jogo) e, se "seguir atletas" estiver on,
   * dos atletas que você segue. Aditivo — desligado, a rota e o menu somem.
   */
  COMMUNITY_FEED: 'community_feed',

  /**
   * Progressão do jogador: XP e nível de perfil, sequência (streak) de semanas
   * ativas e metas pessoais. XP/streak são calculados; metas ficam em
   * `player_goals` (do próprio dono). Aditivo — desligado, a seção não aparece.
   */
  PLAYER_PROGRESSION: 'player_progression',

  /**
   * Certificados/diplomas de torneio: gera uma imagem de campeão/participação
   * (reusa a infra dos share cards) na página pública de torneios encerrados.
   * Aditivo — desligado, o botão não aparece.
   */
  TOURNAMENT_CERTIFICATES: 'tournament_certificates',

  /**
   * Galeria de fotos do torneio: upload pelos admins do torneio e exibição na
   * página do torneio e na pública. Aditivo — desligado, a galeria não aparece.
   */
  TOURNAMENT_GALLERY: 'tournament_gallery',

  /**
   * Lista de espera: quando a modalidade lota, o atleta pode entrar na fila e o
   * admin promove ao abrir vaga. Aditivo — desligado, o fluxo atual (bloqueio
   * "modalidade lotada") permanece.
   */
  TOURNAMENT_WAITLIST: 'tournament_waitlist',

  /**
   * UX do torneio: "Meus próximos jogos" no painel inicial. Aditivo —
   * desligado, a seção não aparece.
   */
  TOURNAMENT_UX: 'tournament_ux',

  /**
   * Arenas: diretório de arenas/quadras com perfil completo (descrição,
   * endereço, contatos, redes, site, fotos), avaliações e reclamações dos
   * atletas, favoritos, card com QR para compartilhar, tabela de preços
   * (padrão por dia/horário + exceções) e solicitação de reservas (avulsas ou
   * recorrentes) com negociação de valor e status de pagamento. Administração
   * pela própria arena (dono/gestores) e contato pelo chat. Aditivo —
   * desligado, as rotas, o menu e os pontos de entrada ficam ocultos.
   */
  ARENAS: 'arenas',

  /**
   * História e curiosidades do esporte: página de conteúdo (na seção "sobre o
   * esporte") com a origem do pickleball, marcos, curiosidades e cultura.
   * Aditivo — desligado, a rota e o item de menu ficam ocultos.
   */
  SPORT_HISTORY: 'sport_history',

  /**
   * Página própria de cada modalidade: em vez do modal de informações, cada
   * modalidade ganha uma página com abas (informações gerais, inscrição, jogos,
   * ranking e fotos da modalidade). A visão geral do torneio e a administração/
   * sorteio continuam iguais; a inscrição rápida no card permanece. Aditivo —
   * desligado, o botão "Informações" volta a abrir o modal atual.
   */
  MODALITY_PAGES: 'modality_pages',

  /**
   * Inscrição de atletas pelo admin da plataforma: no modal "Inscrever
   * participante" dos torneios que o admin master criou ou administra, exibe
   * uma lista de todos os atletas cadastrados na plataforma (com filtro por
   * nome) para escolher quem inscrever, preenchendo os dados e vinculando a
   * inscrição à conta real do atleta. Restrito ao admin da plataforma. Aditivo
   * — desligado (ou para qualquer outro usuário), o modal segue exatamente como
   * está hoje.
   */
  ADMIN_ATHLETE_REGISTRATION: 'admin_athlete_registration',

  /**
   * Duplicar torneio: no hub administrativo, o criador/admin de um torneio pode
   * gerar uma cópia dele. Permite duplicar integralmente (definições,
   * modalidades e inscritos) ou escolher item a item — o conjunto de definições,
   * cada modalidade e, por modalidade, o conjunto de inscritos (podendo copiar a
   * modalidade sem os inscritos). O novo torneio nasce como rascunho, com novo
   * código de convite e o ator como owner; sorteio (grupos/jogos/ranking) nunca
   * é copiado. Aditivo — desligado, o botão não aparece e nada muda.
   */
  TOURNAMENT_DUPLICATION: 'tournament_duplication',

  /**
   * Sorteio com vagas fictícias: quando a modalidade define um número exato de
   * participantes e ainda faltam inscrições, o admin pode preencher as vagas
   * faltantes com atletas fictícios ("Atleta N", na ordem de inscrição) para já
   * sortear os jogos. O atleta fictício entra no equilíbrio do sorteio com o
   * gênero da modalidade (se houver) e o nível padrão da modalidade. Fictícios
   * não têm conta, não contam para o ranking e não ocupam vaga de inscrições
   * reais. Aditivo — desligado, os controles não aparecem e nada muda.
   */
  TOURNAMENT_PLACEHOLDER_DRAW: 'tournament_placeholder_draw',

  /**
   * Ciclo de vida e ranking oficial do torneio (conjunto integrado):
   *  - encerra o torneio automaticamente quando o último resultado de jogos é
   *    lançado, considerando todas as modalidades e fases;
   *  - dá ao admin um botão de "bloquear alterações" (com confirmação) que
   *    aparece após o encerramento, reversível por "desbloquear";
   *  - o ranking nacional passa a considerar SOMENTE torneios públicos e já
   *    encerrados (e exclui automaticamente torneios apagados). Aditivo —
   *    desligado, o encerramento é manual e o ranking mantém o cálculo anterior.
   */
  TOURNAMENT_LIFECYCLE: 'tournament_lifecycle',

  /**
   * Painel Admin centralizado (hub): adiciona em "Admin geral" um item
   * "Painel" que abre uma página única (/admin/painel) reunindo métricas,
   * gestão de torneios, parceiros, funcionalidades (flags), branding,
   * conteúdo da plataforma, auditoria e diagnóstico. Aditivo — desligado,
   * só existem as 3 rotas independentes (Métricas / Torneios / Parceiros).
   * O item de menu e a rota /admin/painel somem completamente.
   */
  ADMIN_CONSOLE: 'admin_console',

  /**
   * Completude de perfil (onboarding): monta o modal "Complete seu perfil"
   * no layout autenticado quando faltam os dados obrigatórios para torneios
   * (nome, nascimento, telefone, experiência). O atleta pode adiar ("Deixar
   * para depois", válido pela sessão) — o bloqueio duro continua existindo
   * apenas na inscrição. Aditivo — desligado, nada aparece.
   */
  PROFILE_ONBOARDING: 'profile_onboarding',

  /**
   * Menu do usuário no topo (desktop): avatar no cabeçalho que abre um menu
   * com Meu perfil, Editar perfil e Sair. Hoje não existe nenhuma forma de
   * sair da conta no desktop (o botão "Sair" só existe no menu mobile).
   * Aditivo — desligado, o cabeçalho permanece como está.
   */
  NAV_USER_MENU: 'nav_user_menu',

  /**
   * Navegação inferior no mobile: barra fixa com os 5 destinos principais
   * (Início, Torneios, Atletas, Chat, Perfil) para navegar com 1 toque sem
   * abrir o menu lateral. Aditivo — desligado, a barra não é renderizada.
   */
  MOBILE_BOTTOM_NAV: 'mobile_bottom_nav',

  /**
   * Cancelar torneio: adiciona ao hub administrativo a ação "Cancelar
   * torneio" (com confirmação). O status CANCELLED já existe e é
   * pré-requisito para arquivar, mas não havia botão para alcançá-lo.
   * Aditivo — desligado, as ações de status permanecem as atuais.
   */
  TOURNAMENT_CANCEL_ACTION: 'tournament_cancel_action',

  /**
   * Marcar todas como lidas: botão no menu de notificações que marca todas
   * as notificações não lidas de uma vez. Aditivo — desligado, o menu
   * permanece como está.
   */
  NOTIFICATIONS_MARK_ALL: 'notifications_mark_all',

  /**
   * Check-in de atletas: na aba de inscrições do torneio, o admin pode
   * marcar/desfazer o check-in de inscrições confirmadas. O status
   * "Check-in feito" já existia e já era considerado pelo sorteio; esta
   * flag adiciona a UI que faltava para registrá-lo. Aditivo — desligado,
   * a aba permanece como está.
   */
  TOURNAMENT_CHECKIN: 'tournament_checkin',

  /**
   * Instruções de pagamento (PIX) na inscrição: o admin configura a chave
   * PIX do torneio (aba Geral) e, ao se inscrever numa modalidade paga, o
   * atleta vê o valor, o QR Code e o "copia e cola" com botão de copiar,
   * podendo declarar "já paguei" (avisa os admins para confirmar). A
   * confirmação continua manual, pelo admin, como hoje. Aditivo —
   * desligado, o fluxo de inscrição permanece exatamente como está.
   */
  PAYMENT_INSTRUCTIONS: 'payment_instructions',

  /**
   * Resumo operacional do torneio: adiciona ao hub administrativo uma aba
   * "Resumo" com os contadores que hoje ficam espalhados (inscrições por
   * status, pagamentos pendentes, % de jogos concluídos, jogos sem horário)
   * e alertas de pendências. Somente leitura — nenhum dado novo é gravado.
   * Aditivo — desligado, a aba não aparece.
   */
  TOURNAMENT_OPS_DASHBOARD: 'tournament_ops_dashboard',

  /**
   * Convite e aceite de dupla: na inscrição de duplas, o atleta pode escolher
   * o parceiro entre os atletas do diretório (vinculando a conta real) — o
   * parceiro recebe uma notificação e confirma ou recusa na página do
   * torneio. O preenchimento manual continua disponível para convidados sem
   * conta. O status do convite não altera a máquina de status da inscrição.
   * Aditivo — desligado, a inscrição de duplas permanece exatamente como está.
   */
  PARTNER_INVITES: 'partner_invites',
});

/** Metadados de exibição para o painel de flags (admin master). */
export const FEATURE_FLAG_META = Object.freeze({
  [FEATURE_FLAG.MULTI_PHASE_TOURNAMENTS]: {
    label: 'Torneios em múltiplas fases',
    description:
      'Habilita a configuração de modalidades com várias fases encadeadas '
      + '(grupos, americano, mata-mata, dupla eliminação, suíço), com divisão '
      + 'em grupos equilibrados por gênero e nível, sorteio ou seleção manual, '
      + 'qualificação de classificados e progressão automática entre fases. '
      + 'A inscrição continua em lista única por modalidade.',
  },
  [FEATURE_FLAG.SHARE_CARDS]: {
    label: 'Cards de compartilhamento (UGC)',
    description:
      'Habilita o botão "Compartilhar" na página pública do torneio, que gera '
      + 'um card visual com QR Code e link, otimizado para WhatsApp e Stories, '
      + 'e o compartilhamento por link/texto pré-preenchido. Ajuda na divulgação '
      + 'e aquisição orgânica. Desligado, o botão fica oculto e nada muda.',
  },
  [FEATURE_FLAG.PLAYER_PERFORMANCE]: {
    label: 'Meu Desempenho (estatísticas do atleta)',
    description:
      'Habilita a página pessoal "Meu Desempenho" com torneios disputados, '
      + 'vitórias/derrotas, aproveitamento, pódios e títulos por formato, '
      + 'consolidados dos jogos já registrados. Estimula a retenção e prepara '
      + 'recursos premium. Desligado, a rota e o item de menu ficam ocultos.',
  },
  [FEATURE_FLAG.COACH_DIRECTORY]: {
    label: 'Diretório de treinadores',
    description:
      'Permite que atletas se declarem treinadores (bio, valor e regiões de '
      + 'atuação) no perfil e sejam encontrados por um filtro dedicado no '
      + 'diretório de atletas, com contato pelo chat. Abre espaço para um novo '
      + 'público e parcerias. Desligado, a seção e o filtro ficam ocultos.',
  },
  [FEATURE_FLAG.PLAYER_RATING]: {
    label: 'Rating ELO + Ranking nacional',
    description:
      'Calcula um rating ELO por jogador a partir dos jogos finalizados e '
      + 'publica um ranking nacional (filtrável por cidade/estado/nível). O '
      + 'recálculo é feito sob demanda pelo admin na própria página de Métricas. '
      + 'Cria autoridade de marca e engajamento. Desligado, a rota /ranking, o '
      + 'item de menu e o botão de recálculo ficam ocultos.',
  },
  [FEATURE_FLAG.MATCHMAKING]: {
    label: 'Matchmaking por nível',
    description:
      'Página "Encontrar jogadores" que sugere parceiros e adversários com '
      + 'rating próximo (opcionalmente da mesma cidade), com atalho para o chat. '
      + 'Requer o "Rating ELO" ativado. Desligado, a rota e o menu ficam ocultos.',
  },
  [FEATURE_FLAG.OPEN_GAMES]: {
    label: 'Procura-se jogo',
    description:
      'Mural de partidas sociais abertas: o atleta publica um convite (quando, '
      + 'cidade, nível, formato e observações) e outros encontram por cidade/nível '
      + 'e chamam pelo chat. Aumenta a retenção fora dos torneios. Desligado, a '
      + 'rota e o item de menu ficam ocultos.',
  },
  [FEATURE_FLAG.AFFILIATE_LINKS]: {
    label: 'Afiliados e parcerias',
    description:
      'Permite ao admin cadastrar links de afiliado e patrocinadores, exibidos '
      + 'em uma página de parceiros para os atletas; os cliques são medidos via '
      + 'analytics. Primeira fonte de receita sem barreira. Desligado, as rotas '
      + 'e os itens de menu ficam ocultos.',
  },
  [FEATURE_FLAG.FUNNEL_ANALYTICS]: {
    label: 'Instrumentação de funil (analytics)',
    description:
      'Envia eventos de produto (login, perfil completo, torneio criado, '
      + 'inscrição, convite aberto) ao Firebase Analytics para medir conversão e '
      + 'retenção. Invisível ao usuário. Desligado, nenhum evento de funil é enviado.',
  },
  [FEATURE_FLAG.ATHLETE_PROFILE_PAGE]: {
    label: 'Página rica do atleta',
    description:
      'Habilita a página de perfil do atleta (/atleta/:uid) com desempenho, '
      + 'rating, conquistas e clubes, e torna o diretório e o ranking clicáveis '
      + 'para ela. Desligado, a rota e os links ficam ocultos.',
  },
  [FEATURE_FLAG.ACHIEVEMENTS]: {
    label: 'Conquistas / medalhas',
    description:
      'Exibe medalhas desbloqueadas por marcos (vitórias, pódios, títulos, '
      + 'torneios e rating) no perfil do atleta e em "Meu Desempenho", calculadas '
      + 'dos dados existentes. Desligado, a seção de conquistas não aparece.',
  },
  [FEATURE_FLAG.RANKING_FILTERS]: {
    label: 'Rankings segmentados',
    description:
      'Adiciona filtros de clube, gênero e faixa etária ao ranking nacional, '
      + 'além de estado e nível. Desligado, apenas os filtros atuais aparecem.',
  },
  [FEATURE_FLAG.RATING_HISTORY]: {
    label: 'Evolução do rating',
    description:
      'Mostra um gráfico de evolução do rating (snapshots a cada recálculo) no '
      + 'perfil do atleta e em "Meu Desempenho". Desligado, o gráfico não aparece.',
  },
  [FEATURE_FLAG.HEAD_TO_HEAD]: {
    label: 'Confrontos diretos e rivais',
    description:
      'Agrega os jogos do atleta por adversário (vitórias/derrotas) e destaca os '
      + 'rivais mais frequentes, no perfil. Desligado, a seção não aparece.',
  },
  [FEATURE_FLAG.FOLLOW_ATHLETES]: {
    label: 'Seguir atletas',
    description:
      'Permite seguir outros atletas (botão no perfil e no diretório), com '
      + 'notificação ao seguido e contagem de seguidores. Desligado, os botões '
      + 'e contagens ficam ocultos.',
  },
  [FEATURE_FLAG.COMMUNITY_FEED]: {
    label: 'Feed da comunidade',
    description:
      'Página "Novidades" com a atividade recente da comunidade (torneios '
      + 'públicos, convites de jogo) e dos atletas que você segue. Desligado, a '
      + 'rota e o item de menu ficam ocultos.',
  },
  [FEATURE_FLAG.PLAYER_PROGRESSION]: {
    label: 'Progressão (XP, streak e metas)',
    description:
      'Mostra XP e nível de perfil, sequência de semanas ativas e metas pessoais '
      + 'em "Meu Desempenho". XP e streak são calculados dos dados; as metas são '
      + 'do próprio atleta. Desligado, a seção não aparece.',
  },
  [FEATURE_FLAG.TOURNAMENT_CERTIFICATES]: {
    label: 'Certificados de torneio',
    description:
      'Gera um certificado/diploma (imagem para download) de campeão ou '
      + 'participação na página pública de torneios encerrados. Desligado, o '
      + 'botão não aparece.',
  },
  [FEATURE_FLAG.TOURNAMENT_GALLERY]: {
    label: 'Galeria de fotos do torneio',
    description:
      'Permite aos admins do torneio enviar fotos, exibidas na página do torneio '
      + 'e na visão pública. Desligado, a galeria não aparece.',
  },
  [FEATURE_FLAG.TOURNAMENT_WAITLIST]: {
    label: 'Lista de espera',
    description:
      'Quando a modalidade lota, o atleta pode entrar na lista de espera e o '
      + 'admin promove ao abrir vaga. Desligado, permanece o bloqueio atual.',
  },
  [FEATURE_FLAG.TOURNAMENT_UX]: {
    label: 'Meus próximos jogos',
    description:
      'Mostra os próximos jogos agendados do atleta no painel inicial. '
      + 'Desligado, a seção não aparece.',
  },
  [FEATURE_FLAG.ARENAS]: {
    label: 'Arenas (quadras e reservas)',
    description:
      'Habilita o diretório de arenas com perfil completo (descrição, endereço, '
      + 'contatos, redes sociais, site e fotos), avaliações e reclamações dos '
      + 'atletas, favoritos e card com QR para compartilhar. As arenas definem '
      + 'preços padrão por dia/horário e exceções por ocasião/cliente, e recebem '
      + 'solicitações de reserva avulsas ou recorrentes, com negociação de valor '
      + 'e acompanhamento de pagamento; contato pelo chat e notificações a cada '
      + 'movimento. Desligado, as rotas e os menus ficam ocultos.',
  },
  [FEATURE_FLAG.SPORT_HISTORY]: {
    label: 'História e curiosidades do esporte',
    description:
      'Publica uma página, na seção "sobre o esporte", com a origem do '
      + 'pickleball, marcos históricos, curiosidades e cultura do jogo. '
      + 'Desligado, a rota e o item de menu ficam ocultos.',
  },
  [FEATURE_FLAG.MODALITY_PAGES]: {
    label: 'Página própria de cada modalidade',
    description:
      'Cada modalidade ganha uma página dedicada com abas de informações gerais, '
      + 'inscrição (mantendo a inscrição rápida no card), jogos, ranking e fotos '
      + 'da modalidade, no lugar do modal de informações. Também adiciona o '
      + 'seletor de modalidades na navegação do torneio e move a galeria geral '
      + 'para uma aba própria quando a flag de fotos estiver ligada. Desligado, '
      + 'o botão "Informações" volta a abrir o modal atual e a visão do torneio '
      + 'permanece no formato anterior.',
  },
  [FEATURE_FLAG.ADMIN_ATHLETE_REGISTRATION]: {
    label: 'Inscrição de atletas pelo admin',
    description:
      'No modal "Inscrever participante" dos torneios que o admin da plataforma '
      + 'criou ou administra, exibe uma lista de todos os atletas cadastrados '
      + '(com filtro por nome) para escolher quem inscrever: os dados são '
      + 'preenchidos automaticamente e a inscrição fica vinculada à conta real '
      + 'do atleta. Restrito ao admin da plataforma. Desligado, o modal '
      + 'permanece exatamente como está.',
  },
  [FEATURE_FLAG.TOURNAMENT_DUPLICATION]: {
    label: 'Duplicar torneio',
    description:
      'Adiciona, no hub administrativo do torneio, um botão para duplicá-lo. O '
      + 'criador/admin escolhe duplicar integralmente (definições, modalidades e '
      + 'inscritos) ou item a item: o conjunto de definições, cada modalidade e, '
      + 'por modalidade, o conjunto de inscritos (é possível copiar a modalidade '
      + 'sem os inscritos). O novo torneio nasce como rascunho, com novo código '
      + 'de convite; o sorteio não é copiado. Desligado, o botão não aparece.',
  },
  [FEATURE_FLAG.TOURNAMENT_PLACEHOLDER_DRAW]: {
    label: 'Sorteio com vagas fictícias',
    description:
      'Quando a modalidade tem um número exato de participantes e faltam '
      + 'inscrições, permite preencher as vagas com atletas fictícios ("Atleta N") '
      + 'para já sortear os jogos. O fictício entra no equilíbrio com o gênero da '
      + 'modalidade e o nível padrão dela. Não conta para o ranking nem ocupa vaga '
      + 'de inscrições reais. Desligado, os controles não aparecem.',
  },
  [FEATURE_FLAG.TOURNAMENT_LIFECYCLE]: {
    label: 'Encerramento automático, bloqueio e ranking oficial',
    description:
      'Encerra o torneio automaticamente ao lançar o último resultado (todas as '
      + 'modalidades e fases); adiciona ao admin um botão de bloquear/desbloquear '
      + 'alterações após o encerramento; e faz o ranking nacional considerar '
      + 'somente torneios públicos e encerrados, excluindo automaticamente os '
      + 'apagados. Desligado, o encerramento é manual e o ranking mantém o '
      + 'cálculo anterior.',
  },
  [FEATURE_FLAG.ADMIN_CONSOLE]: {
    label: 'Painel Admin centralizado (hub)',
    description:
      'Adiciona em "Admin geral" um item "Painel" que abre uma página única '
      + '(/admin/painel) reunindo métricas, gestão de torneios, parceiros, '
      + 'funcionalidades (flags), branding, conteúdo da plataforma, auditoria '
      + 'e diagnóstico. Desligado, só existem as 3 rotas independentes '
      + '(Métricas / Torneios / Parceiros) e o item do menu some.',
  },
  [FEATURE_FLAG.PROFILE_ONBOARDING]: {
    label: 'Completar perfil (onboarding)',
    description:
      'Mostra o modal "Complete seu perfil" no app autenticado quando faltam '
      + 'os dados obrigatórios para torneios (nome, nascimento, telefone e '
      + 'experiência). O atleta pode adiar pela sessão; o bloqueio duro segue '
      + 'existindo apenas na inscrição. Desligado, nada aparece.',
  },
  [FEATURE_FLAG.NAV_USER_MENU]: {
    label: 'Menu do usuário no topo (desktop)',
    description:
      'Adiciona o avatar do usuário no cabeçalho, abrindo um menu com Meu '
      + 'perfil, Editar perfil e Sair — inclui a saída da conta no desktop, '
      + 'que hoje só existe no menu mobile. Desligado, o cabeçalho fica igual.',
  },
  [FEATURE_FLAG.MOBILE_BOTTOM_NAV]: {
    label: 'Navegação inferior (mobile)',
    description:
      'Exibe uma barra fixa na base da tela em celulares com os 5 destinos '
      + 'principais (Início, Torneios, Atletas, Chat, Perfil), permitindo '
      + 'navegar com 1 toque sem abrir o menu lateral. Desligado, a barra '
      + 'não é renderizada.',
  },
  [FEATURE_FLAG.TOURNAMENT_CANCEL_ACTION]: {
    label: 'Cancelar torneio',
    description:
      'Adiciona ao hub administrativo do torneio a ação "Cancelar torneio" '
      + 'com confirmação. O status Cancelado já existia e é pré-requisito '
      + 'para arquivar, mas não havia botão para alcançá-lo. Desligado, as '
      + 'ações de status permanecem as atuais.',
  },
  [FEATURE_FLAG.NOTIFICATIONS_MARK_ALL]: {
    label: 'Marcar notificações como lidas (todas)',
    description:
      'Adiciona ao menu de notificações um botão para marcar todas as não '
      + 'lidas de uma vez. Desligado, o menu permanece como está.',
  },
  [FEATURE_FLAG.TOURNAMENT_CHECKIN]: {
    label: 'Check-in de atletas no torneio',
    description:
      'Permite ao admin do torneio marcar e desfazer o check-in de '
      + 'inscrições confirmadas na aba de inscrições, com contador por '
      + 'modalidade. O sorteio já considerava o status "Check-in feito"; '
      + 'esta flag adiciona a interface para registrá-lo. Desligado, a aba '
      + 'permanece como está.',
  },
  [FEATURE_FLAG.PAYMENT_INSTRUCTIONS]: {
    label: 'Instruções de pagamento (PIX)',
    description:
      'O admin configura a chave PIX do torneio na aba Geral e o atleta, ao '
      + 'se inscrever numa modalidade paga, vê o valor, o QR Code e o código '
      + '"copia e cola", podendo declarar que pagou (os admins são avisados '
      + 'para conferir e confirmar). A confirmação do pagamento continua '
      + 'manual, como hoje. Desligado, o fluxo de inscrição fica igual.',
  },
  [FEATURE_FLAG.TOURNAMENT_OPS_DASHBOARD]: {
    label: 'Resumo operacional do torneio',
    description:
      'Adiciona ao hub administrativo do torneio uma aba "Resumo" com '
      + 'inscrições por status, pagamentos pendentes, progresso dos jogos, '
      + 'jogos sem horário e alertas de pendências — a visão única de "como '
      + 'está meu torneio". Somente leitura. Desligado, a aba não aparece.',
  },
  [FEATURE_FLAG.PARTNER_INVITES]: {
    label: 'Convite e aceite de dupla',
    description:
      'Na inscrição de duplas, o atleta escolhe o parceiro entre os atletas '
      + 'do diretório (a inscrição fica vinculada à conta real dele). O '
      + 'parceiro é notificado e confirma ou recusa na página do torneio; o '
      + 'organizador vê o status do convite nas inscrições. O preenchimento '
      + 'manual continua disponível para convidados sem conta. Desligado, a '
      + 'inscrição de duplas fica exatamente como está.',
  },
});

/** Valor padrão (todas as flags desligadas). */
export const DEFAULT_FEATURE_FLAGS = Object.freeze(
  Object.fromEntries(Object.values(FEATURE_FLAG).map((key) => [key, false])),
);

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
