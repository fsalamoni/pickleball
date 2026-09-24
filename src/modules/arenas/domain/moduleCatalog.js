/**
 * Catálogo dos módulos adicionais da arena — a fonte única de verdade sobre
 * O QUE cada módulo é, PARA QUEM serve, DE QUE depende e SE já existe.
 *
 * PURO — sem I/O, sem React. Tudo aqui é dado estático.
 *
 * Complementa `modules.js`, que guarda os ids (contrato de banco: o campo
 * `module_id` de `arena_module_states`) e os metadados de exibição básicos.
 * Aqui vive o que as três camadas precisam saber:
 *
 * - `audience`   quem vê o resultado (atleta / professor / arena)
 * - `benefit`    o que muda para cada um, em uma frase
 * - `status`     se o módulo existe de fato (ver ARENA_MODULE_STATUS)
 * - `requires`   dependências ALÉM do pai (ex.: carteira exige membros)
 * - `manage`     rota da gestão da arena, quando o módulo tem tela própria
 * - `public`     rota pública/do atleta, quando tem
 * - `config`     campos de configuração por arena (camada 2)
 * - `collections` coleções do Firestore que o módulo usa
 *
 * IMPORTANTE: o id nunca muda. Está gravado no banco.
 */

import { ARENA_MODULE_ID, ARENA_MODULE_META } from './modules.js';

/**
 * Estágio de cada módulo. Governa o que o admin da plataforma pode liberar.
 *
 * - `ready`    implementado e pronto para liberar.
 * - `beta`     implementado, mas novo: liberar com parcimônia.
 * - `planned`  desenhado, ainda sem código. NÃO é liberável.
 * - `external` depende de hardware/infra de terceiro que a plataforma não
 *              controla (fabricante de iluminação, DNS, loja de aplicativos).
 *              Liberável, mas com o limite escrito na tela.
 */
export const ARENA_MODULE_STATUS = Object.freeze({
  READY: 'ready',
  BETA: 'beta',
  PLANNED: 'planned',
  EXTERNAL: 'external',
});

export const ARENA_MODULE_STATUS_META = Object.freeze({
  [ARENA_MODULE_STATUS.READY]: {
    label: 'Disponível',
    tone: 'green',
    hint: 'Pronto para liberar às arenas.',
    releasable: true,
  },
  [ARENA_MODULE_STATUS.BETA]: {
    label: 'Novo',
    tone: 'amber',
    hint: 'Funciona, mas é recente — libere para poucas arenas primeiro.',
    releasable: true,
  },
  [ARENA_MODULE_STATUS.PLANNED]: {
    label: 'Em construção',
    tone: 'neutral',
    hint: 'Ainda não existe no código. Não pode ser liberado.',
    releasable: false,
  },
  [ARENA_MODULE_STATUS.EXTERNAL]: {
    label: 'Depende de terceiro',
    tone: 'purple',
    hint: 'Exige hardware ou infraestrutura fora da plataforma.',
    releasable: true,
  },
});

/** Públicos possíveis de um módulo. */
export const ARENA_MODULE_AUDIENCE = Object.freeze({
  ATHLETE: 'atleta',
  COACH: 'professor',
  ARENA: 'arena',
});

const { ATHLETE, COACH, ARENA } = ARENA_MODULE_AUDIENCE;
const { READY, BETA, PLANNED, EXTERNAL } = ARENA_MODULE_STATUS;

/**
 * Detalhamento por módulo. Chaveado pelo id do catálogo.
 *
 * `benefit` é escrito na voz de quem lê: o texto do atleta aparece para o
 * atleta, o da arena aparece no painel de quem decide ligar o módulo.
 */
export const ARENA_MODULE_DETAIL = Object.freeze({
  /* ------------------------------ 1. Matchmaking ----------------------- */
  [ARENA_MODULE_ID.MATCHMAKING]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Encher horário vago juntando gente do mesmo nível.',
    benefit: {
      [ARENA]: 'Transforma quadra parada em receita, sem ninguém precisar organizar o grupo.',
      [ATHLETE]: 'Acha jogo do seu nível na arena, mesmo sem ter com quem ir.',
    },
    collections: ['arena_open_slots', 'arena_waitlist', 'arena_matches'],
  },
  [ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'A arena publica um horário com vagas; os atletas do nível entram.',
    benefit: {
      [ARENA]: 'Publique o horário ocioso e deixe os atletas preencherem sozinhos.',
      [ATHLETE]: 'Entre em jogos abertos na sua faixa de nível, um clique.',
    },
    manage: '/arenas/:arenaId/gerir/open-match',
    public: '/arenas/:arenaId/open-match',
    // Parte da arena: aba "Jogo aberto" na Central e seção "Jogos abertos" na
    // página pública (entrar ali mesmo). As rotas seguem valendo — a pública é
    // a lista completa, a de gestão leva à aba —, mas não viram atalho.
    native: true,
    config: [
      {
        key: 'level_tolerance',
        label: 'Diferença de nível aceita',
        type: 'number',
        default: 1,
        min: 0.25,
        max: 3,
        step: 0.25,
        hint: 'Na régua 2.0–8.0. Quanto menor, mais parelho o jogo.',
      },
      {
        key: 'auto_confirm',
        label: 'Confirmar sem aprovação da arena',
        type: 'boolean',
        default: true,
        hint: 'Desligado, cada inscrição espera o aval da arena.',
      },
    ],
    collections: ['arena_open_slots'],
  },
  [ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER]: {
    status: READY,
    audience: [ATHLETE],
    summary: 'O atleta procura parceiro ou adversário dentro da arena.',
    benefit: {
      [ARENA]: 'Quem não tem dupla deixa de desistir da reserva.',
      [ATHLETE]: 'Encontre alguém do seu nível que também joga aqui.',
    },
    public: '/arenas/:arenaId/matchmaking',
    // A porta fica DENTRO da seção "Jogos abertos" da página da arena ("veja
    // quem joga aqui no seu nível"), não num botão solto no topo.
    native: true,
    collections: ['arena_matches'],
  },
  [ARENA_MODULE_ID.MATCHMAKING_WAITLIST]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Horário lotado vira fila: quem desiste libera para o próximo.',
    benefit: {
      [ARENA]: 'Cancelamento deixa de virar buraco na grade.',
      [ATHLETE]: 'Entre na fila e seja avisado assim que vagar.',
    },
    config: [
      {
        key: 'hold_minutes',
        label: 'Tempo para aceitar a vaga',
        type: 'number',
        default: 60,
        min: 5,
        max: 1440,
        step: 5,
        hint: 'Depois disso a vaga passa para o próximo da fila.',
      },
    ],
    collections: ['arena_waitlist'],
  },

  /* -------------------------------- 2. Membros ------------------------- */
  [ARENA_MODULE_ID.MEMBERS]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Uma relação contínua com quem joga sempre aqui.',
    benefit: {
      [ARENA]: 'Saia da venda avulsa: quem é de casa tem cadastro, histórico e benefício.',
      [ATHLETE]: 'Seja reconhecido na arena em que você joga sempre.',
    },
    manage: '/arenas/:arenaId/gerir/membros',
    public: '/arenas/:arenaId/membros',
    // Parte da arena: aba "Membros" na Central e seção "Planos e vantagens"
    // na página pública. As rotas acima seguem valendo (notificações antigas
    // apontam para elas), mas não viram botão de atalho — a funcionalidade já
    // está onde a pessoa está.
    native: true,
    collections: ['arena_members'],
  },
  [ARENA_MODULE_ID.MEMBERS_TIERS]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Níveis de membro (Bronze a Platina) com benefício em cada um.',
    benefit: {
      [ARENA]: 'Premie quem joga mais, automaticamente, pelo histórico de reservas.',
      [ATHLETE]: 'Suba de nível na arena e ganhe desconto e prioridade.',
    },
    requires: [ARENA_MODULE_ID.MEMBERS],
    collections: ['arena_members', 'arena_tier_configs'],
  },
  [ARENA_MODULE_ID.MEMBERS_PACKAGES]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Pacote pré-pago de horas, com validade.',
    benefit: {
      [ARENA]: 'Receba antes de o atleta jogar e garanta a frequência.',
      [ATHLETE]: 'Compre horas com desconto e use quando quiser.',
    },
    requires: [ARENA_MODULE_ID.MEMBERS],
    collections: ['arena_packages', 'arena_wallets'],
  },
  [ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Mensalidade com renovação e cobrança por Pix.',
    benefit: {
      [ARENA]: 'Receita previsível todo mês, com controle de quem está em dia.',
      [ATHLETE]: 'Pague uma vez por mês e jogue sem se preocupar.',
    },
    requires: [ARENA_MODULE_ID.MEMBERS],
    collections: ['arena_subscriptions'],
  },
  [ARENA_MODULE_ID.MEMBERS_WALLET]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Saldo do atleta na arena, com extrato.',
    benefit: {
      [ARENA]: 'Crédito, estorno e cashback sem dinheiro trocando de mão.',
      [ATHLETE]: 'Veja seu saldo e cada lançamento, sem discussão.',
    },
    requires: [ARENA_MODULE_ID.MEMBERS],
    collections: ['arena_wallets'],
  },

  /* ---------------------------------- 3. PDV --------------------------- */
  [ARENA_MODULE_ID.PDV]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Vender na arena o que já se vende no balcão.',
    benefit: {
      [ARENA]: 'Água, grip e aluguel de raquete entram no caixa junto com a reserva.',
      [ATHLETE]: 'Compre na arena pelo aplicativo, sem fila.',
    },
    manage: '/arenas/:arenaId/gerir/pdv',
    public: '/arenas/:arenaId/loja',
    // Integrado à arena (2026-09-24): a gestão é a aba "Pedidos do app" da
    // Central (Pagamentos e loja), os produtos são os do MERCADO (marcados
    // "Vender pelo app"), e a página da arena tem a seção "Loja". Sem atalho.
    native: true,
    collections: ['arena_inventory_products', 'arena_sales', 'arena_payments'],
  },
  [ARENA_MODULE_ID.PDV_CATALOG]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'A vitrine da loja na página da arena, com preço e estoque.',
    benefit: {
      [ARENA]: 'Cadastre uma vez no Mercado, venda sempre — e o estoque baixa sozinho na entrega.',
      [ATHLETE]: 'Veja o que a arena vende antes de chegar.',
    },
    requires: [ARENA_MODULE_ID.PDV],
    collections: ['arena_inventory_products'],
  },
  [ARENA_MODULE_ID.PDV_PIX_NATIVE]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'QR Pix gerado no aplicativo, sem maquininha.',
    benefit: {
      [ARENA]: 'Receba por Pix com a chave da arena, sem taxa de adquirente.',
      [ATHLETE]: 'Pague pelo celular, na hora.',
    },
    requires: [ARENA_MODULE_ID.PDV],
    collections: ['arena_payments'],
  },
  [ARENA_MODULE_ID.PDV_SPLIT]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Dividir a conta entre os jogadores da partida.',
    benefit: {
      [ARENA]: 'A conta fecha sozinha, sem alguém ficar devendo ao grupo.',
      [ATHLETE]: 'Divida a quadra com a turma sem calculadora no vestiário.',
    },
    requires: [ARENA_MODULE_ID.PDV],
    collections: ['arena_sales', 'arena_payments'],
  },

  /* -------------------------------- 4. Aulas --------------------------- */
  [ARENA_MODULE_ID.CLASSES]: {
    status: READY,
    audience: [ATHLETE, COACH, ARENA],
    summary: 'A agenda de aulas da arena, com os professores dela.',
    benefit: {
      [ARENA]: 'A aula deixa de ser combinada por fora e passa a ocupar a grade.',
      [COACH]: 'Sua agenda na arena, com os alunos e o histórico no mesmo lugar.',
      [ATHLETE]: 'Marque aula com o professor da arena direto pelo aplicativo.',
    },
    manage: '/arenas/:arenaId/gerir/aulas',
    public: '/arenas/:arenaId/aulas',
    // Integrado à arena (2026-09-24): a gestão é a seção Aulas da Central, e
    // a página da arena tem a seção "Aulas e professores". Sem atalho.
    native: true,
    collections: ['arena_coaches', 'arena_classes', 'arena_class_bookings'],
  },
  [ARENA_MODULE_ID.CLASSES_CATALOG]: {
    status: READY,
    audience: [ATHLETE, COACH],
    summary: 'Vitrine dos professores da arena, com nível, preço e horários.',
    benefit: {
      [ARENA]: 'Quem chega novo encontra com quem aprender, sem perguntar no balcão.',
      [COACH]: 'Um perfil na arena que traz aluno.',
      [ATHLETE]: 'Compare professores por preço, nível e horário.',
    },
    requires: [ARENA_MODULE_ID.CLASSES],
    collections: ['arena_coaches'],
  },
  [ARENA_MODULE_ID.CLASSES_PACKAGES]: {
    status: READY,
    audience: [ATHLETE, COACH],
    summary: 'Pacotes de aula (4 aulas por um valor).',
    benefit: {
      [ARENA]: 'O aluno se compromete com o ciclo, e a quadra fica reservada.',
      [COACH]: 'Venda o acompanhamento, não a aula avulsa.',
      [ATHLETE]: 'Feche um pacote e economize.',
    },
    requires: [ARENA_MODULE_ID.CLASSES],
    collections: ['arena_classes', 'arena_class_bookings'],
  },
  [ARENA_MODULE_ID.CLASSES_MARKETPLACE]: {
    status: READY,
    audience: [COACH, ARENA],
    summary: 'Professor de fora se candidata a dar aula na arena.',
    benefit: {
      [ARENA]: 'Amplie a oferta de aulas sem contratar, com comissão definida.',
      [COACH]: 'Ofereça suas aulas em arenas onde você ainda não dá aula.',
    },
    requires: [ARENA_MODULE_ID.CLASSES],
    config: [
      {
        key: 'commission_pct',
        label: 'Comissão da arena (%)',
        type: 'number',
        default: 20,
        min: 0,
        max: 90,
        step: 1,
        hint: 'Percentual que fica com a arena em cada aula do professor parceiro.',
      },
    ],
    collections: ['arena_coaches'],
  },

  /* ---------------------------- 5. Torneios internos ------------------- */
  [ARENA_MODULE_ID.LEAGUES]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Competição da casa, para a comunidade da arena.',
    benefit: {
      [ARENA]: 'Dê motivo para voltar toda semana, sem virar torneio nacional.',
      [ATHLETE]: 'Dispute com a turma da arena e acompanhe a sua posição.',
    },
    manage: '/arenas/:arenaId/gerir/torneios',
    public: '/arenas/:arenaId/torneios',
    // Integrado à arena (2026-09-24): a gestão é a seção Torneios da Central
    // (Da casa · Da plataforma), e a página da arena tem "Torneios da casa".
    native: true,
    collections: ['arena_internal_tournaments', 'arena_ladders'],
  },
  [ARENA_MODULE_ID.LEAGUES_INTERNAL]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Torneio que só aparece para quem é da arena.',
    benefit: {
      [ARENA]: 'Organize sem abrir para a plataforma inteira.',
      [ATHLETE]: 'Um torneio no seu nível, com gente que você conhece.',
    },
    requires: [ARENA_MODULE_ID.LEAGUES],
    collections: ['arena_internal_tournaments'],
  },
  [ARENA_MODULE_ID.LEAGUES_LADDER]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Ranking contínuo da arena, atualizado a cada resultado.',
    benefit: {
      [ARENA]: 'Uma tabela viva que traz o atleta de volta para defender posição.',
      [ATHLETE]: 'Suba na tabela da sua arena jogando.',
    },
    requires: [ARENA_MODULE_ID.LEAGUES],
    collections: ['arena_ladders'],
  },
  [ARENA_MODULE_ID.LEAGUES_OPEN_PLAY]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Sessões de jogo livre por categoria e dia.',
    benefit: {
      [ARENA]: 'Grade fixa de open play, com inscrição e presença controladas.',
      [ATHLETE]: 'Chegue e jogue: já existe uma sessão do seu nível.',
    },
    requires: [ARENA_MODULE_ID.LEAGUES],
    collections: ['game_days'],
  },
  [ARENA_MODULE_ID.LEAGUES_PRIZING]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Premiação do torneio interno (dinheiro, brinde ou crédito).',
    benefit: {
      [ARENA]: 'Prêmio em crédito volta como consumo na própria arena.',
      [ATHLETE]: 'Saiba o que está em jogo antes de se inscrever.',
    },
    requires: [ARENA_MODULE_ID.LEAGUES, ARENA_MODULE_ID.LEAGUES_INTERNAL],
    collections: ['arena_internal_tournaments'],
  },

  /* ---------------------------- 6. Marketing --------------------------- */
  [ARENA_MODULE_ID.MARKETING]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Trazer de volta quem já veio.',
    benefit: {
      [ARENA]: 'Falar com quem já joga aqui custa menos do que buscar gente nova.',
      [ATHLETE]: 'Receba as promoções da arena que você frequenta.',
    },
    manage: '/arenas/:arenaId/gerir/marketing',
    // Integrado à arena (2026-09-24): a gestão é a seção Marketing da Central
    // (uma aba por ferramenta), e os cupons divulgados viram "Promoções" na
    // página da arena e no pedido de reserva. Sem atalho.
    native: true,
    collections: ['arena_coupons', 'arena_campaigns', 'arena_referrals', 'arena_nps_responses'],
  },
  [ARENA_MODULE_ID.MARKETING_CAMPAIGNS]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Avisos segmentados para grupos de atletas.',
    benefit: {
      [ARENA]: 'Fale só com quem interessa: sumidos, membros, gente de um nível.',
      [ATHLETE]: 'Só recebe o que tem a ver com você.',
    },
    requires: [ARENA_MODULE_ID.MARKETING],
    collections: ['arena_campaigns', 'notifications'],
  },
  [ARENA_MODULE_ID.MARKETING_LOYALTY]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Programa de pontos por reserva e por consumo.',
    benefit: {
      [ARENA]: 'A décima reserva sai de graça — e é por isso que existe a nona.',
      [ATHLETE]: 'Acumule pontos jogando e troque por hora de quadra.',
    },
    requires: [ARENA_MODULE_ID.MARKETING],
    collections: ['arena_members'],
  },
  [ARENA_MODULE_ID.MARKETING_COUPONS]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Cupons de desconto com validade e limite de uso.',
    benefit: {
      [ARENA]: 'Encha o horário fraco com um desconto que você controla.',
      [ATHLETE]: 'Use o cupom da arena direto na reserva.',
    },
    requires: [ARENA_MODULE_ID.MARKETING],
    collections: ['arena_coupons'],
  },
  [ARENA_MODULE_ID.MARKETING_REFERRAL]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Indique e ganhe: crédito para quem indica e para quem chega.',
    benefit: {
      [ARENA]: 'Cliente novo trazido por quem já confia em você.',
      [ATHLETE]: 'Chame um amigo e os dois ganham crédito.',
    },
    requires: [ARENA_MODULE_ID.MARKETING],
    collections: ['arena_referrals'],
  },
  [ARENA_MODULE_ID.MARKETING_NPS]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Pergunta de satisfação depois da visita.',
    benefit: {
      [ARENA]: 'Descubra o problema antes de virar avaliação pública ruim.',
      [ATHLETE]: 'Uma pergunta só, e a arena escuta.',
    },
    requires: [ARENA_MODULE_ID.MARKETING],
    collections: ['arena_nps_responses'],
  },

  /* ---------------------------- 7. Operações --------------------------- */
  [ARENA_MODULE_ID.OPERATIONS]: {
    status: READY,
    audience: [ARENA],
    summary: 'O dia a dia de quem toca a arena.',
    benefit: {
      [ARENA]: 'Abertura, fechamento, conserto e estoque deixam de morar no WhatsApp.',
    },
    manage: '/arenas/:arenaId/gerir/operacoes',
    collections: ['arena_checklists', 'arena_maintenance_orders'],
  },
  [ARENA_MODULE_ID.OPERATIONS_CHECKLIST]: {
    status: READY,
    audience: [ARENA],
    summary: 'Checklist de abertura e fechamento, com responsável.',
    benefit: {
      [ARENA]: 'Todo turno cumpre a mesma rotina, e fica registrado quem cumpriu.',
    },
    requires: [ARENA_MODULE_ID.OPERATIONS],
    collections: ['arena_checklists'],
  },
  [ARENA_MODULE_ID.OPERATIONS_MAINTENANCE]: {
    status: READY,
    audience: [ARENA],
    summary: 'Ordens de manutenção ligadas à quadra.',
    benefit: {
      [ARENA]: 'Conserto vira tarefa com prazo — e pode fechar a quadra no calendário.',
    },
    requires: [ARENA_MODULE_ID.OPERATIONS],
    collections: ['arena_maintenance_orders', 'arena_unavailabilities'],
  },
  [ARENA_MODULE_ID.OPERATIONS_INVENTORY]: {
    status: READY,
    audience: [ARENA],
    summary: 'Estoque com alerta de mínimo.',
    benefit: {
      [ARENA]: 'Nunca mais acabar a água no sábado à tarde.',
    },
    requires: [ARENA_MODULE_ID.OPERATIONS],
    collections: ['arena_inventory_products', 'arena_inventory_entries', 'arena_inventory_exits'],
  },
  [ARENA_MODULE_ID.OPERATIONS_STAFF]: {
    status: READY,
    audience: [ARENA],
    summary: 'Equipe da arena com turno e função.',
    benefit: {
      [ARENA]: 'Saiba quem estava de plantão quando algo aconteceu.',
    },
    requires: [ARENA_MODULE_ID.OPERATIONS],
    collections: ['arena_settings'],
  },

  /* -------------------------------- 8. IoT ----------------------------- */
  [ARENA_MODULE_ID.IOT]: {
    status: BETA,
    audience: [ARENA],
    summary: 'Equipamentos da arena conectados ao sistema.',
    benefit: {
      [ARENA]: 'Totem, luz e sensor no mesmo cadastro, ligados às quadras.',
    },
    manage: '/arenas/:arenaId/gerir/avancado',
    collections: ['arena_devices'],
  },
  [ARENA_MODULE_ID.IOT_QR_KIOSK]: {
    status: BETA,
    audience: [ATHLETE, ARENA],
    summary: 'Totem de check-in por QR na entrada.',
    benefit: {
      [ARENA]: 'Presença confirmada sem ninguém no balcão — e no-show medido de verdade.',
      [ATHLETE]: 'Chegou, apontou a câmera, entrou.',
    },
    requires: [ARENA_MODULE_ID.IOT],
    manage: '/arenas/:arenaId/gerir/presenca',
    public: '/arenas/:arenaId/chegada',
    collections: ['arena_devices', 'arena_bookings'],
  },
  [ARENA_MODULE_ID.IOT_LIGHTING]: {
    status: EXTERNAL,
    audience: [ARENA],
    summary: 'Acender e apagar a quadra pelo aplicativo.',
    benefit: {
      [ARENA]: 'A luz acompanha a reserva. Exige o controlador do fabricante.',
    },
    requires: [ARENA_MODULE_ID.IOT],
    externalNote:
      'A plataforma cadastra o dispositivo e registra o comando, mas quem liga a luz '
      + 'é o controlador do fabricante. É preciso um endereço (webhook) que aceite o comando.',
    collections: ['arena_devices'],
  },
  [ARENA_MODULE_ID.IOT_SENSORS]: {
    status: EXTERNAL,
    audience: [ARENA],
    summary: 'Sensor de presença: uso real contra uso reservado.',
    benefit: {
      [ARENA]: 'Descubra o horário que é reservado e não é usado. Exige o sensor instalado.',
    },
    requires: [ARENA_MODULE_ID.IOT],
    externalNote: 'Depende de sensor físico que envie leitura para a plataforma.',
    collections: ['arena_devices'],
  },
  [ARENA_MODULE_ID.IOT_VIDEO_REPLAY]: {
    status: EXTERNAL,
    audience: [ATHLETE, ARENA],
    summary: 'Câmera na quadra com replay do ponto.',
    benefit: {
      [ARENA]: 'Serviço a mais para vender. Exige câmera e armazenamento de vídeo.',
      [ATHLETE]: 'Reveja o ponto depois do jogo.',
    },
    requires: [ARENA_MODULE_ID.IOT],
    externalNote:
      'Câmera, gravação e armazenamento de vídeo são serviços de terceiro. '
      + 'A plataforma guarda o cadastro e o link, não o vídeo.',
    collections: ['arena_devices'],
  },

  /* ---------------------------- 9. Multi-unidade ----------------------- */
  [ARENA_MODULE_ID.MULTI_UNIT]: {
    status: READY,
    audience: [ARENA],
    summary: 'Várias arenas sob a mesma rede.',
    benefit: {
      [ARENA]: 'Uma rede com várias unidades, olhada como um negócio só.',
    },
    manage: '/arenas/:arenaId/gerir/avancado',
    collections: ['arena_networks', 'arena_network_memberships'],
  },
  [ARENA_MODULE_ID.MULTI_UNIT_NETWORK]: {
    status: READY,
    audience: [ARENA],
    summary: 'Cadastro da rede e das unidades que fazem parte.',
    benefit: {
      [ARENA]: 'As unidades passam a se reconhecer como parte do mesmo grupo.',
    },
    requires: [ARENA_MODULE_ID.MULTI_UNIT],
    collections: ['arena_networks', 'arena_network_memberships'],
  },
  [ARENA_MODULE_ID.MULTI_UNIT_CONSOLIDATED_BI]: {
    status: READY,
    audience: [ARENA],
    summary: 'Números somados de todas as unidades.',
    benefit: {
      [ARENA]: 'Ocupação e receita da rede inteira, e a comparação entre unidades.',
    },
    requires: [ARENA_MODULE_ID.MULTI_UNIT, ARENA_MODULE_ID.MULTI_UNIT_NETWORK],
    collections: ['arena_networks'],
  },
  [ARENA_MODULE_ID.MULTI_UNIT_CROSS_BOOKING]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'O membro de uma unidade joga em qualquer outra.',
    benefit: {
      [ARENA]: 'O benefício vale na rede toda, o que segura o membro.',
      [ATHLETE]: 'Seu plano vale em todas as unidades.',
    },
    requires: [ARENA_MODULE_ID.MULTI_UNIT, ARENA_MODULE_ID.MULTI_UNIT_NETWORK, ARENA_MODULE_ID.MEMBERS],
    collections: ['arena_network_memberships', 'arena_members'],
  },

  /* ----------------------------- 10. White label ----------------------- */
  [ARENA_MODULE_ID.WHITE_LABEL]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'A arena com a cara dela.',
    benefit: {
      [ARENA]: 'Sua marca nas telas que os seus atletas usam.',
      [ATHLETE]: 'A página da arena com a identidade dela.',
    },
    manage: '/arenas/:arenaId/gerir/avancado',
    collections: ['arena_settings'],
  },
  [ARENA_MODULE_ID.WHITE_LABEL_BRANDING]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Cor e logo da arena nas telas dela.',
    benefit: {
      [ARENA]: 'A página pública e o telão saem com a sua cor e o seu logo.',
      [ATHLETE]: 'Você reconhece a arena de longe.',
    },
    requires: [ARENA_MODULE_ID.WHITE_LABEL],
    collections: ['arena_settings'],
  },
  [ARENA_MODULE_ID.WHITE_LABEL_DOMAIN]: {
    status: EXTERNAL,
    audience: [ARENA],
    summary: 'Endereço próprio (app.suaarena.com.br).',
    benefit: {
      [ARENA]: 'Um endereço seu. Exige apontar o DNS e configurar o hosting.',
    },
    requires: [ARENA_MODULE_ID.WHITE_LABEL],
    externalNote:
      'Domínio é configuração de DNS e de hospedagem, não de aplicação. '
      + 'A plataforma guarda o endereço desejado e mostra o passo a passo; '
      + 'a publicação é feita fora do sistema.',
    collections: ['arena_settings'],
  },
  [ARENA_MODULE_ID.WHITE_LABEL_APP]: {
    status: PLANNED,
    audience: [ARENA],
    summary: 'Aplicativo próprio da arena nas lojas.',
    benefit: {
      [ARENA]: 'Um aplicativo com o nome da arena — outro produto, não uma chave.',
    },
    requires: [ARENA_MODULE_ID.WHITE_LABEL],
    externalNote:
      'Publicar aplicativo nas lojas envolve contas de desenvolvedor, revisão e '
      + 'manutenção próprias. Não está no escopo da plataforma.',
    collections: [],
  },

  /* -------------------------------- 11. IA ----------------------------- */
  [ARENA_MODULE_ID.AI]: {
    status: READY,
    audience: [ARENA],
    summary: 'Leitura automática dos números da arena.',
    benefit: {
      [ARENA]: 'O sistema olha o seu histórico e sugere preço e previsão.',
    },
    manage: '/arenas/:arenaId/gerir/avancado',
    collections: ['bookings', 'arena_settings'],
  },
  [ARENA_MODULE_ID.AI_PRICING]: {
    status: READY,
    audience: [ATHLETE, ARENA],
    summary: 'Preço sugerido por demanda de cada horário.',
    benefit: {
      [ARENA]: 'Desconto onde sobra quadra, preço cheio onde falta — com base no seu histórico.',
      [ATHLETE]: 'Horário vazio fica mais barato.',
    },
    requires: [ARENA_MODULE_ID.AI],
    collections: ['bookings'],
  },
  [ARENA_MODULE_ID.AI_MATCHMAKING]: {
    status: READY,
    audience: [ATHLETE],
    summary: 'Sugestão de parceiro por afinidade de jogo.',
    benefit: {
      [ARENA]: 'Menos jogo desequilibrado, menos gente desistindo.',
      [ATHLETE]: 'Sugestões de quem combina com o seu jogo e o seu horário.',
    },
    requires: [ARENA_MODULE_ID.AI, ARENA_MODULE_ID.MATCHMAKING],
    collections: ['arena_matches'],
  },
  [ARENA_MODULE_ID.AI_FORECAST]: {
    status: READY,
    audience: [ARENA],
    summary: 'Previsão de ocupação e receita das próximas semanas.',
    benefit: {
      [ARENA]: 'Enxergue a semana que vem antes de ela chegar.',
    },
    requires: [ARENA_MODULE_ID.AI],
    collections: ['bookings'],
  },
});

/** Detalhe padrão, para módulo do catálogo que ainda não foi detalhado. */
const DEFAULT_DETAIL = Object.freeze({
  status: PLANNED,
  audience: [ARENA],
  summary: '',
  benefit: {},
  requires: [],
  config: [],
  collections: [],
});

/**
 * Devolve o módulo completo (metadados de exibição + detalhamento), ou `null`
 * se o id não existir no catálogo.
 *
 * @param {string} moduleId
 * @returns {null | {
 *   id: string, label: string, description: string, icon: string, color: string,
 *   parent?: string, children: string[], status: string, audience: string[],
 *   summary: string, benefit: Record<string,string>, requires: string[],
 *   config: Array<Object>, collections: string[], manage?: string, public?: string,
 *   externalNote?: string,
 * }}
 */
export function getArenaModule(moduleId) {
  const meta = ARENA_MODULE_META[moduleId];
  if (!meta) return null;
  const detail = ARENA_MODULE_DETAIL[moduleId] || DEFAULT_DETAIL;
  return {
    id: moduleId,
    ...meta,
    children: meta.children || [],
    ...detail,
    audience: detail.audience || DEFAULT_DETAIL.audience,
    benefit: detail.benefit || {},
    requires: detail.requires || [],
    config: detail.config || [],
    collections: detail.collections || [],
  };
}

/** Todos os ids do catálogo, na ordem de declaração (famílias e filhos). */
export function listArenaModuleIds() {
  return Object.keys(ARENA_MODULE_META);
}

/** Só as famílias (módulos com filhos), na ordem do catálogo. */
export function listArenaModuleFamilies() {
  return listArenaModuleIds().filter((id) => (ARENA_MODULE_META[id]?.children || []).length > 0);
}

/**
 * Árvore para renderizar: [{ family, children: [module, ...] }, ...].
 * Cada nó já vem completo (`getArenaModule`).
 */
export function arenaModuleTree() {
  return listArenaModuleFamilies().map((familyId) => ({
    family: getArenaModule(familyId),
    children: (ARENA_MODULE_META[familyId].children || [])
      .map(getArenaModule)
      .filter(Boolean),
  }));
}

/**
 * Um módulo pode ser LIBERADO pela plataforma? Depende só do estágio: o que
 * ainda não existe no código (`planned`) não pode ser oferecido a ninguém.
 * @param {string} moduleId
 * @returns {boolean}
 */
export function isModuleReleasable(moduleId) {
  const mod = getArenaModule(moduleId);
  if (!mod) return false;
  return ARENA_MODULE_STATUS_META[mod.status]?.releasable === true;
}

/**
 * Substitui `:arenaId` na rota do módulo. Devolve `null` quando o módulo não
 * tem aquela rota (nem toda funcionalidade tem tela própria).
 * @param {string} moduleId
 * @param {string} arenaId
 * @param {'manage'|'public'} kind
 * @returns {string|null}
 */
export function arenaModuleRoute(moduleId, arenaId, kind = 'manage') {
  const mod = getArenaModule(moduleId);
  const tpl = mod?.[kind];
  if (!tpl || !arenaId) return null;
  return tpl.replace(':arenaId', arenaId);
}

/**
 * Valor inicial da configuração de um módulo (os `default` do catálogo),
 * mesclado com o que a arena já gravou. Campo desconhecido é descartado —
 * a configuração nunca guarda lixo.
 * @param {string} moduleId
 * @param {Object|null|undefined} saved
 * @returns {Record<string, any>}
 */
export function moduleConfigWithDefaults(moduleId, saved) {
  const mod = getArenaModule(moduleId);
  const out = {};
  (mod?.config || []).forEach((field) => {
    const value = saved?.[field.key];
    if (field.type === 'boolean') {
      out[field.key] = typeof value === 'boolean' ? value : Boolean(field.default);
    } else if (field.type === 'number') {
      const n = Number(value);
      out[field.key] = Number.isFinite(n) ? n : Number(field.default);
    } else {
      out[field.key] = value == null ? (field.default ?? '') : String(value);
    }
  });
  return out;
}
