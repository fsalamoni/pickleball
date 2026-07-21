/**
 * Domínio: Módulos opt-in por arena (Arena V3).
 *
 * Define o catálogo de módulos disponíveis, sua hierarquia (pai/filho),
 * e a gate logic que decide se uma arena pode usar cada módulo.
 *
 * PURO — sem I/O. Toda função é testável isoladamente.
 *
 * IMPORTANTE: este módulo é ADITIVO. Não altera nenhuma lógica existente.
 * As flags começam TODAS desligadas (DEFAULT_FEATURE_FLAGS em core/featureFlags.js).
 */

/**
 * Catálogo de módulos disponíveis para as arenas habilitarem.
 * Cada módulo é uma feature opt-in (liga/desliga por arena).
 */
export const ARENA_MODULE_ID = Object.freeze({
  // Matchmaking (sprint 1)
  MATCHMAKING: 'matchmaking',
  MATCHMAKING_OPEN_MATCH: 'matchmaking_open_match',
  MATCHMAKING_PARTNER_FINDER: 'matchmaking_partner_finder',
  MATCHMAKING_WAITLIST: 'matchmaking_waitlist',

  // Membros (sprint 2)
  MEMBERS: 'members',
  MEMBERS_TIERS: 'members_tiers',
  MEMBERS_PACKAGES: 'members_packages',
  MEMBERS_SUBSCRIPTION: 'members_subscription',
  MEMBERS_WALLET: 'members_wallet',

  // PDV (sprint 3)
  PDV: 'pdv',
  PDV_CATALOG: 'pdv_catalog',
  PDV_PIX_NATIVE: 'pdv_pix_native',
  PDV_SPLIT: 'pdv_split',

  // Aulas (sprint 4)
  CLASSES: 'classes',
  CLASSES_CATALOG: 'classes_catalog',
  CLASSES_PACKAGES: 'classes_packages',
  CLASSES_MARKETPLACE: 'classes_marketplace',

  // Torneios internos (sprint 5)
  LEAGUES: 'leagues',
  LEAGUES_INTERNAL: 'leagues_internal',
  LEAGUES_LADDER: 'leagues_ladder',
  LEAGUES_OPEN_PLAY: 'leagues_open_play',
  LEAGUES_PRIZING: 'leagues_prizing',

  // Marketing (sprint 6)
  MARKETING: 'marketing',
  MARKETING_CAMPAIGNS: 'marketing_campaigns',
  MARKETING_LOYALTY: 'marketing_loyalty',
  MARKETING_COUPONS: 'marketing_coupons',
  MARKETING_REFERRAL: 'marketing_referral',
  MARKETING_NPS: 'marketing_nps',

  // Operações (sprint 7)
  OPERATIONS: 'operations',
  OPERATIONS_CHECKLIST: 'operations_checklist',
  OPERATIONS_MAINTENANCE: 'operations_maintenance',
  OPERATIONS_INVENTORY: 'operations_inventory',
  OPERATIONS_STAFF: 'operations_staff',

  // IoT (sprint 8)
  IOT: 'iot',
  IOT_QR_KIOSK: 'iot_qr_kiosk',
  IOT_LIGHTING: 'iot_lighting',
  IOT_SENSORS: 'iot_sensors',
  IOT_VIDEO_REPLAY: 'iot_video_replay',

  // Multi-unidade (sprint 9)
  MULTI_UNIT: 'multi_unit',
  MULTI_UNIT_NETWORK: 'multi_unit_network',
  MULTI_UNIT_CONSOLIDATED_BI: 'multi_unit_consolidated_bi',
  MULTI_UNIT_CROSS_BOOKING: 'multi_unit_cross_booking',

  // White label (sprint 10)
  WHITE_LABEL: 'white_label',
  WHITE_LABEL_BRANDING: 'white_label_branding',
  WHITE_LABEL_DOMAIN: 'white_label_domain',
  WHITE_LABEL_APP: 'white_label_app',

  // AI (sprint 11)
  AI: 'ai',
  AI_PRICING: 'ai_pricing',
  AI_MATCHMAKING: 'ai_matchmaking',
  AI_FORECAST: 'ai_forecast',
});

/**
 * Metadados de cada módulo para exibição no painel admin da arena.
 * Cada módulo tem label, descrição, ícone (lucide) e cor.
 */
export const ARENA_MODULE_META = Object.freeze({
  [ARENA_MODULE_ID.MATCHMAKING]: {
    label: 'Matchmaking',
    description: 'Vagas abertas, busca de parceiro e lista de espera.',
    icon: 'Users',
    color: 'blue',
    sprint: 1,
    children: [
      ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH,
      ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER,
      ARENA_MODULE_ID.MATCHMAKING_WAITLIST,
    ],
  },
  [ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH]: {
    label: 'Open Match',
    description: 'Arena publica horários com vagas; atletas do nível se inscrevem.',
    icon: 'UserPlus',
    color: 'blue',
    parent: ARENA_MODULE_ID.MATCHMAKING,
  },
  [ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER]: {
    label: 'Buscar parceiro',
    description: 'Atleta procura parceiro por nível e cidade.',
    icon: 'Search',
    color: 'blue',
    parent: ARENA_MODULE_ID.MATCHMAKING,
  },
  [ARENA_MODULE_ID.MATCHMAKING_WAITLIST]: {
    label: 'Lista de espera',
    description: 'Fila para horários lotados; notifica ao liberar vaga.',
    icon: 'ListOrdered',
    color: 'blue',
    parent: ARENA_MODULE_ID.MATCHMAKING,
  },

  [ARENA_MODULE_ID.MEMBERS]: {
    label: 'Membros',
    description: 'Programa de membros com tiers, pacotes, mensalidades e wallet.',
    icon: 'UserCheck',
    color: 'amber',
    sprint: 2,
    children: [
      ARENA_MODULE_ID.MEMBERS_TIERS,
      ARENA_MODULE_ID.MEMBERS_PACKAGES,
      ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION,
      ARENA_MODULE_ID.MEMBERS_WALLET,
    ],
  },
  [ARENA_MODULE_ID.MEMBERS_TIERS]: {
    label: 'Tiers (Bronze/Prata/Ouro)',
    description: 'Níveis de membro com benefícios e descontos progressivos.',
    icon: 'Award',
    color: 'amber',
    parent: ARENA_MODULE_ID.MEMBERS,
  },
  [ARENA_MODULE_ID.MEMBERS_PACKAGES]: {
    label: 'Pacotes pré-pagos',
    description: '10h por R$ X, vence em 60 dias.',
    icon: 'Package',
    color: 'amber',
    parent: ARENA_MODULE_ID.MEMBERS,
  },
  [ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION]: {
    label: 'Mensalidades',
    description: 'Recorrência com Pix automático.',
    icon: 'Repeat',
    color: 'amber',
    parent: ARENA_MODULE_ID.MEMBERS,
  },
  [ARENA_MODULE_ID.MEMBERS_WALLET]: {
    label: 'Wallet do atleta',
    description: 'Saldo na arena, cashback e pontos.',
    icon: 'Wallet',
    color: 'amber',
    parent: ARENA_MODULE_ID.MEMBERS,
  },

  [ARENA_MODULE_ID.PDV]: {
    label: 'PDV / Loja',
    description: 'Catálogo de produtos, Pix nativo e split payment.',
    icon: 'ShoppingCart',
    color: 'emerald',
    sprint: 3,
    children: [
      ARENA_MODULE_ID.PDV_CATALOG,
      ARENA_MODULE_ID.PDV_PIX_NATIVE,
      ARENA_MODULE_ID.PDV_SPLIT,
    ],
  },
  [ARENA_MODULE_ID.PDV_CATALOG]: {
    label: 'Catálogo de produtos',
    description: 'Venda de água, raquete, grip, bola, vestuário.',
    icon: 'Store',
    color: 'emerald',
    parent: ARENA_MODULE_ID.PDV,
  },
  [ARENA_MODULE_ID.PDV_PIX_NATIVE]: {
    label: 'Pix nativo',
    description: 'QR gerado no app, sem maquininha.',
    icon: 'QrCode',
    color: 'emerald',
    parent: ARENA_MODULE_ID.PDV,
  },
  [ARENA_MODULE_ID.PDV_SPLIT]: {
    label: 'Split payment',
    description: 'Divide o pagamento entre 2-4 jogadores.',
    icon: 'Split',
    color: 'emerald',
    parent: ARENA_MODULE_ID.PDV,
  },

  [ARENA_MODULE_ID.CLASSES]: {
    label: 'Aulas & instrutores',
    description: 'Catálogo de instrutores, pacotes e marketplace.',
    icon: 'GraduationCap',
    color: 'purple',
    sprint: 4,
    children: [
      ARENA_MODULE_ID.CLASSES_CATALOG,
      ARENA_MODULE_ID.CLASSES_PACKAGES,
      ARENA_MODULE_ID.CLASSES_MARKETPLACE,
    ],
  },
  [ARENA_MODULE_ID.CLASSES_CATALOG]: {
    label: 'Catálogo de instrutores',
    description: 'Perfis, vídeos, valor e avaliação.',
    icon: 'BookOpen',
    color: 'purple',
    parent: ARENA_MODULE_ID.CLASSES,
  },
  [ARENA_MODULE_ID.CLASSES_PACKAGES]: {
    label: 'Pacotes de aula',
    description: '4 aulas por R$X, avulsas ou recorrentes.',
    icon: 'PackageOpen',
    color: 'purple',
    parent: ARENA_MODULE_ID.CLASSES,
  },
  [ARENA_MODULE_ID.CLASSES_MARKETPLACE]: {
    label: 'Marketplace de instrutores',
    description: 'Instrutores autônomos se cadastram.',
    icon: 'Briefcase',
    color: 'purple',
    parent: ARENA_MODULE_ID.CLASSES,
  },

  [ARENA_MODULE_ID.LEAGUES]: {
    label: 'Torneios internos',
    description: 'Torneios, ladder, open play e premiação.',
    icon: 'Trophy',
    color: 'yellow',
    sprint: 5,
    children: [
      ARENA_MODULE_ID.LEAGUES_INTERNAL,
      ARENA_MODULE_ID.LEAGUES_LADDER,
      ARENA_MODULE_ID.LEAGUES_OPEN_PLAY,
      ARENA_MODULE_ID.LEAGUES_PRIZING,
    ],
  },
  [ARENA_MODULE_ID.LEAGUES_INTERNAL]: {
    label: 'Torneios só da arena',
    description: 'Não aparece no feed público de torneios.',
    icon: 'Trophy',
    color: 'yellow',
    parent: ARENA_MODULE_ID.LEAGUES,
  },
  [ARENA_MODULE_ID.LEAGUES_LADDER]: {
    label: 'Ladder semanal',
    description: 'Ranking semanal com pódio e rating.',
    icon: 'BarChart3',
    color: 'yellow',
    parent: ARENA_MODULE_ID.LEAGUES,
  },
  [ARENA_MODULE_ID.LEAGUES_OPEN_PLAY]: {
    label: 'Open Play',
    description: 'Sessões por categoria e dia da semana.',
    icon: 'Play',
    color: 'yellow',
    parent: ARENA_MODULE_ID.LEAGUES,
  },
  [ARENA_MODULE_ID.LEAGUES_PRIZING]: {
    label: 'Premiação',
    description: 'R$, brinde ou crédito na wallet.',
    icon: 'Gift',
    color: 'yellow',
    parent: ARENA_MODULE_ID.LEAGUES,
  },

  [ARENA_MODULE_ID.MARKETING]: {
    label: 'Marketing & fidelidade',
    description: 'Campanhas, pontos, cupons, referral e NPS.',
    icon: 'Megaphone',
    color: 'pink',
    sprint: 6,
    children: [
      ARENA_MODULE_ID.MARKETING_CAMPAIGNS,
      ARENA_MODULE_ID.MARKETING_LOYALTY,
      ARENA_MODULE_ID.MARKETING_COUPONS,
      ARENA_MODULE_ID.MARKETING_REFERRAL,
      ARENA_MODULE_ID.MARKETING_NPS,
    ],
  },
  [ARENA_MODULE_ID.MARKETING_CAMPAIGNS]: {
    label: 'Campanhas',
    description: 'E-mail, SMS, WhatsApp e push segmentados.',
    icon: 'Mail',
    color: 'pink',
    parent: ARENA_MODULE_ID.MARKETING,
  },
  [ARENA_MODULE_ID.MARKETING_LOYALTY]: {
    label: 'Programa de pontos',
    description: '10 reservas = 1h grátis.',
    icon: 'Star',
    color: 'pink',
    parent: ARENA_MODULE_ID.MARKETING,
  },
  [ARENA_MODULE_ID.MARKETING_COUPONS]: {
    label: 'Cupons',
    description: 'Carnaval, Black Friday, aniversário.',
    icon: 'Tag',
    color: 'pink',
    parent: ARENA_MODULE_ID.MARKETING,
  },
  [ARENA_MODULE_ID.MARKETING_REFERRAL]: {
    label: 'Indique e ganhe',
    description: 'R$ X para cada lado.',
    icon: 'Share2',
    color: 'pink',
    parent: ARENA_MODULE_ID.MARKETING,
  },
  [ARENA_MODULE_ID.MARKETING_NPS]: {
    label: 'NPS automatizado',
    description: 'Pesquisa pós-visita com reward.',
    icon: 'Smile',
    color: 'pink',
    parent: ARENA_MODULE_ID.MARKETING,
  },

  [ARENA_MODULE_ID.OPERATIONS]: {
    label: 'Operações & equipe',
    description: 'Checklist, manutenção, estoque e equipe.',
    icon: 'Wrench',
    color: 'slate',
    sprint: 7,
    children: [
      ARENA_MODULE_ID.OPERATIONS_CHECKLIST,
      ARENA_MODULE_ID.OPERATIONS_MAINTENANCE,
      ARENA_MODULE_ID.OPERATIONS_INVENTORY,
      ARENA_MODULE_ID.OPERATIONS_STAFF,
    ],
  },
  [ARENA_MODULE_ID.OPERATIONS_CHECKLIST]: {
    label: 'Checklist diário',
    description: 'Abertura, fechamento e tarefas com foto.',
    icon: 'ClipboardCheck',
    color: 'slate',
    parent: ARENA_MODULE_ID.OPERATIONS,
  },
  [ARENA_MODULE_ID.OPERATIONS_MAINTENANCE]: {
    label: 'Manutenção preventiva',
    description: 'Troca de rede, revisão de iluminação.',
    icon: 'Wrench',
    color: 'slate',
    parent: ARENA_MODULE_ID.OPERATIONS,
  },
  [ARENA_MODULE_ID.OPERATIONS_INVENTORY]: {
    label: 'Estoque',
    description: 'Alerta de mínimo e inventário.',
    icon: 'Box',
    color: 'slate',
    parent: ARENA_MODULE_ID.OPERATIONS,
  },
  [ARENA_MODULE_ID.OPERATIONS_STAFF]: {
    label: 'Equipe',
    description: 'Turno, comissão e folha.',
    icon: 'Users2',
    color: 'slate',
    parent: ARENA_MODULE_ID.OPERATIONS,
  },

  [ARENA_MODULE_ID.IOT]: {
    label: 'IoT & integrações',
    description: 'QR totem, iluminação, sensores e replay.',
    icon: 'Cpu',
    color: 'cyan',
    sprint: 8,
    children: [
      ARENA_MODULE_ID.IOT_QR_KIOSK,
      ARENA_MODULE_ID.IOT_LIGHTING,
      ARENA_MODULE_ID.IOT_SENSORS,
      ARENA_MODULE_ID.IOT_VIDEO_REPLAY,
    ],
  },
  [ARENA_MODULE_ID.IOT_QR_KIOSK]: {
    label: 'Totem QR',
    description: 'Check-in na entrada da arena.',
    icon: 'QrCode',
    color: 'cyan',
    parent: ARENA_MODULE_ID.IOT,
  },
  [ARENA_MODULE_ID.IOT_LIGHTING]: {
    label: 'Iluminação',
    description: 'Liga/desliga pelo app.',
    icon: 'Lightbulb',
    color: 'cyan',
    parent: ARENA_MODULE_ID.IOT,
  },
  [ARENA_MODULE_ID.IOT_SENSORS]: {
    label: 'Sensores de presença',
    description: 'Conta uso real vs reservado.',
    icon: 'Activity',
    color: 'cyan',
    parent: ARENA_MODULE_ID.IOT,
  },
  [ARENA_MODULE_ID.IOT_VIDEO_REPLAY]: {
    label: 'Replay em vídeo',
    description: 'Câmeras + IA gravam o jogo.',
    icon: 'Video',
    color: 'cyan',
    parent: ARENA_MODULE_ID.IOT,
  },

  [ARENA_MODULE_ID.MULTI_UNIT]: {
    label: 'Multi-unidade (rede)',
    description: 'Várias arenas na mesma rede com BI consolidado.',
    icon: 'Network',
    color: 'indigo',
    sprint: 9,
    children: [
      ARENA_MODULE_ID.MULTI_UNIT_NETWORK,
      ARENA_MODULE_ID.MULTI_UNIT_CONSOLIDATED_BI,
      ARENA_MODULE_ID.MULTI_UNIT_CROSS_BOOKING,
    ],
  },
  [ARENA_MODULE_ID.MULTI_UNIT_NETWORK]: {
    label: 'Rede de arenas',
    description: 'Franqueador com várias unidades.',
    icon: 'Network',
    color: 'indigo',
    parent: ARENA_MODULE_ID.MULTI_UNIT,
  },
  [ARENA_MODULE_ID.MULTI_UNIT_CONSOLIDATED_BI]: {
    label: 'BI consolidado',
    description: 'Visão 360° de todas as unidades.',
    icon: 'BarChartHorizontal',
    color: 'indigo',
    parent: ARENA_MODULE_ID.MULTI_UNIT,
  },
  [ARENA_MODULE_ID.MULTI_UNIT_CROSS_BOOKING]: {
    label: 'Pacote rede',
    description: 'Membro usa qualquer unidade.',
    icon: 'Globe',
    color: 'indigo',
    parent: ARENA_MODULE_ID.MULTI_UNIT,
  },

  [ARENA_MODULE_ID.WHITE_LABEL]: {
    label: 'White label',
    description: 'Marca, domínio e app próprios.',
    icon: 'Palette',
    color: 'rose',
    sprint: 10,
    children: [
      ARENA_MODULE_ID.WHITE_LABEL_BRANDING,
      ARENA_MODULE_ID.WHITE_LABEL_DOMAIN,
      ARENA_MODULE_ID.WHITE_LABEL_APP,
    ],
  },
  [ARENA_MODULE_ID.WHITE_LABEL_BRANDING]: {
    label: 'Cores e logo',
    description: 'Marca customizada por arena.',
    icon: 'Palette',
    color: 'rose',
    parent: ARENA_MODULE_ID.WHITE_LABEL,
  },
  [ARENA_MODULE_ID.WHITE_LABEL_DOMAIN]: {
    label: 'Domínio próprio',
    description: 'app.minhaarena.com.br.',
    icon: 'Link',
    color: 'rose',
    parent: ARENA_MODULE_ID.WHITE_LABEL,
  },
  [ARENA_MODULE_ID.WHITE_LABEL_APP]: {
    label: 'App white label',
    description: 'App próprio da arena.',
    icon: 'Smartphone',
    color: 'rose',
    parent: ARENA_MODULE_ID.WHITE_LABEL,
  },

  [ARENA_MODULE_ID.AI]: {
    label: 'AI & smart',
    description: 'Pricing dinâmico, smart matchmaking e previsão.',
    icon: 'Sparkles',
    color: 'violet',
    sprint: 11,
    children: [
      ARENA_MODULE_ID.AI_PRICING,
      ARENA_MODULE_ID.AI_MATCHMAKING,
      ARENA_MODULE_ID.AI_FORECAST,
    ],
  },
  [ARENA_MODULE_ID.AI_PRICING]: {
    label: 'Dynamic pricing',
    description: 'Tarifa por demanda, horário e clima.',
    icon: 'TrendingUp',
    color: 'violet',
    parent: ARENA_MODULE_ID.AI,
  },
  [ARENA_MODULE_ID.AI_MATCHMAKING]: {
    label: 'Smart matchmaking',
    description: 'ML para encontrar parceiro ideal.',
    icon: 'Brain',
    color: 'violet',
    parent: ARENA_MODULE_ID.AI,
  },
  [ARENA_MODULE_ID.AI_FORECAST]: {
    label: 'Previsão',
    description: 'Demanda, churn e receita previstos.',
    icon: 'LineChart',
    color: 'violet',
    parent: ARENA_MODULE_ID.AI,
  },
});

/**
 * Encontra o módulo pai (se houver) de um dado módulo.
 * @param {string} moduleId
 * @returns {string|null} id do módulo pai ou null
 */
export function findParentModule(moduleId) {
  const meta = ARENA_MODULE_META[moduleId];
  return meta?.parent || null;
}

/**
 * Lista os filhos diretos de um módulo (se houver).
 * @param {string} moduleId
 * @returns {string[]}
 */
export function getChildModules(moduleId) {
  const meta = ARENA_MODULE_META[moduleId];
  return meta?.children || [];
}

/**
 * Verifica se um módulo é "pai" (tem filhos).
 */
export function isParentModule(moduleId) {
  const meta = ARENA_MODULE_META[moduleId];
  return Array.isArray(meta?.children) && meta.children.length > 0;
}

/**
 * Verifica se um módulo é "filho" (tem pai).
 */
export function isChildModule(moduleId) {
  const meta = ARENA_MODULE_META[moduleId];
  return Boolean(meta?.parent);
}

/**
 * Lista apenas os módulos raiz (sem pai).
 * Útil para renderizar a sidebar principal.
 */
export function listRootModules() {
  return Object.values(ARENA_MODULE_ID).filter((id) => isParentModule(id));
}

/**
 * Determina se uma arena pode usar um módulo.
 * Gate logic de 4 níveis:
 * 1. Master switch (`arena_modules`) desliga TUDO.
 * 2. Sub-flag pai deve estar ON (se o módulo for filho).
 * 3. Sub-flag específica deve estar ON.
 * 4. Arena deve ter habilitado o módulo (campo `enabled` em arena_module_states).
 *
 * @param {Object} args
 * @param {Object} args.platformFlags - flags globais (de platform_settings)
 * @param {Object|null} args.moduleState - estado do módulo na arena: { enabled, config }
 * @param {string} args.moduleId - id do módulo
 * @returns {boolean}
 */
export function canArenaUseModule({ platformFlags, moduleState, moduleId }) {
  if (!moduleId) return false;
  if (!platformFlags) return false;

  // 1. Master switch
  if (!platformFlags.arena_modules) return false;

  // 2. Sub-flag pai (se for filho)
  const parent = findParentModule(moduleId);
  if (parent && !platformFlags[`arena_module_${parent}`]) return false;

  // 3. Sub-flag específica
  if (!platformFlags[`arena_module_${moduleId}`]) return false;

  // 4. Arena habilitou
  if (!moduleState?.enabled) return false;

  return true;
}

/**
 * Helper para normalizar um mapa de moduleStates em formato de busca rápida.
 * @param {Array<{ module_id: string, enabled: boolean, config?: Object }>} states
 * @returns {Object<string, { enabled: boolean, config?: Object }>}
 */
export function indexModuleStates(states) {
  const out = {};
  if (!Array.isArray(states)) return out;
  states.forEach((s) => {
    if (s?.module_id) {
      out[s.module_id] = { enabled: !!s.enabled, config: s.config || {} };
    }
  });
  return out;
}

/**
 * Gera o doc id determinístico para `arena_module_states`.
 * @param {string} arenaId
 * @param {string} moduleId
 * @returns {string}
 */
export function moduleStateDocId(arenaId, moduleId) {
  return `${arenaId}_${moduleId}`;
}

/**
 * Lista de todos os módulos (raiz + filhos) — para popular painel admin.
 * @returns {string[]}
 */
export function listAllModules() {
  return Object.values(ARENA_MODULE_ID);
}

/**
 * Valida se um moduleId é conhecido.
 */
export function isValidModuleId(moduleId) {
  return Object.values(ARENA_MODULE_ID).includes(moduleId);
}
