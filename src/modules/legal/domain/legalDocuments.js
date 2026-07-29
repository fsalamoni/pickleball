/**
 * Registro dos documentos legais da plataforma (flag legal_center).
 *
 * Cada documento é DADO PURO (sem JSX) — o `title`, a metadata e as `sections`
 * são renderizados por um componente genérico (`LegalDocumentView`) usando os
 * primitivos de conteúdo (`V2ContentHero`/`V2ContentSection`/`V2BulletList`),
 * garantindo o MESMO padrão de design/layout das páginas de conteúdo.
 *
 * Versionamento: `version` é um inteiro. Ao bumpar a versão de um documento, o
 * consentimento registrado (`legal_consents`) passa a ficar "desatualizado" e o
 * usuário precisa aceitar novamente (o portão de consentimento reaparece para os
 * documentos essenciais — `gate: true`).
 *
 * Campos:
 *  - key          identificador estável (id do doc de consentimento)
 *  - route        segmento de rota (/legal/:route)
 *  - title/eyebrow/description   cabeçalho
 *  - version      inteiro; bump força novo aceite
 *  - effectiveDate 'YYYY-MM-DD'
 *  - category     'Essenciais' | 'Complementares' | 'Por papel'
 *  - audience     'all' | 'organizer' | 'arena_owner' | 'coach'
 *  - gate         true → entra no portão de consentimento bloqueante
 *  - icon         nome do ícone lucide (mapeado na view)
 *  - sections     [{ icon, title, description?, paragraphs?, bullets? }]
 */

export const LEGAL_ROLE = Object.freeze({
  ALL: 'all',
  ORGANIZER: 'organizer',
  ARENA_OWNER: 'arena_owner',
  COACH: 'coach',
});

export const LEGAL_CATEGORY = Object.freeze({
  ESSENTIAL: 'Essenciais',
  COMPLEMENTARY: 'Complementares',
  ROLE: 'Por papel',
});

/** Contato do controlador/encarregado para fins de LGPD e suporte. */
export const LEGAL_CONTACT_EMAIL = 'fsalamoni@gmail.com';
export const PLATFORM_NAME = 'PickleRush';

export const LEGAL_DOCUMENTS = [
  /* ----------------------------- Essenciais ----------------------------- */
  {
    key: 'termos-de-uso',
    route: 'termos-de-uso',
    title: 'Termos de Uso',
    eyebrow: 'Documento essencial',
    description: 'Condições gerais que regem o uso da plataforma PickleRush por todos os usuários.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.ESSENTIAL,
    audience: LEGAL_ROLE.ALL,
    gate: true,
    icon: 'FileText',
    sections: [
      {
        icon: 'FileText',
        title: 'Natureza da plataforma',
        description: 'Uma ferramenta tecnológica para a comunidade do pickleball.',
        paragraphs: [
          'A PickleRush é uma plataforma tecnológica (aplicativo web/PWA) que conecta a comunidade amadora de pickleball no Brasil: atletas, organizadores de torneios, clubes, arenas e professores. A plataforma disponibiliza ferramentas para criação e gestão de torneios, reservas de quadra, aulas, clubes, ranking, comunidade e mensagens.',
          'A PickleRush é uma facilitadora tecnológica. Não organiza eventos, não fornece quadras, não presta aulas, não intermedia pagamentos e não é parte nas relações entre usuários (por exemplo, entre atleta e arena, ou entre aluno e professor). Os valores exibidos são de responsabilidade de quem os cadastra e servem apenas como referência.',
        ],
      },
      {
        icon: 'UserCheck',
        title: 'Conta, elegibilidade e cadastro',
        paragraphs: [
          'Para usar recursos autenticados é necessário criar uma conta com dados verdadeiros, completos e atualizados. Você é responsável por manter a confidencialidade das suas credenciais e por toda atividade realizada na sua conta.',
        ],
        bullets: [
          'É proibido criar contas com identidade falsa ou se passar por terceiros.',
          'Menores de 18 anos só podem usar a plataforma com consentimento e supervisão dos responsáveis legais (ver Termo de Ciência de Riscos e a Política de Privacidade).',
          'A PickleRush pode suspender ou encerrar contas que violem estes Termos.',
        ],
      },
      {
        icon: 'ShieldCheck',
        title: 'Uso aceitável',
        description: 'O que se espera de cada usuário.',
        bullets: [
          'Respeitar a legislação aplicável, as regras do esporte (CBP/USAP) e o fair play.',
          'Não lançar resultados fraudulentos, não manipular ranking, inscrições ou nivelamento.',
          'Não publicar conteúdo ilegal, ofensivo, discriminatório, spam ou que viole direitos de terceiros.',
          'Não tentar burlar a segurança, engenharia reversa, coleta automatizada (scraping) ou sobrecarga da plataforma.',
        ],
      },
      {
        icon: 'Scale',
        title: 'Conteúdo do usuário e propriedade intelectual',
        paragraphs: [
          'Você mantém a titularidade do conteúdo que publica (nome, fotos, textos, resultados). Ao publicar, você concede à PickleRush uma licença não exclusiva para hospedar e exibir esse conteúdo no funcionamento normal da plataforma (por exemplo, mostrar seu nome no chaveamento de um torneio).',
          'A marca, o design, o código e os demais elementos da PickleRush são protegidos e não podem ser copiados ou reutilizados sem autorização.',
        ],
      },
      {
        icon: 'AlertTriangle',
        title: 'Isenções e limitação de responsabilidade',
        paragraphs: [
          'A plataforma é fornecida "no estado em que se encontra". A PickleRush não garante disponibilidade ininterrupta e não se responsabiliza pela conduta de usuários, pela realização ou qualidade de eventos, aulas e reservas, nem por prejuízos decorrentes de relações firmadas entre usuários.',
          'Na máxima extensão permitida em lei, a responsabilidade da PickleRush limita-se ao funcionamento da ferramenta tecnológica.',
        ],
      },
      {
        icon: 'Gavel',
        title: 'Alterações, encerramento e foro',
        paragraphs: [
          'Estes Termos podem ser atualizados para refletir mudanças de funcionalidade ou requisitos legais. Alterações relevantes exigirão novo aceite. A versão vigente é sempre a publicada nesta central.',
          'Você pode encerrar sua conta a qualquer momento. Aplica-se a legislação brasileira, elegendo-se o foro do domicílio do consumidor quando aplicável.',
        ],
      },
    ],
  },
  {
    key: 'privacidade',
    route: 'privacidade',
    title: 'Política de Privacidade',
    eyebrow: 'Documento essencial · LGPD',
    description: 'Como tratamos, protegemos e compartilhamos seus dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.ESSENTIAL,
    audience: LEGAL_ROLE.ALL,
    gate: true,
    icon: 'ShieldCheck',
    sections: [
      {
        icon: 'Database',
        title: 'Dados que coletamos',
        bullets: [
          'Cadastro: nome, e-mail e, quando informados, nome de exibição, telefone, cidade/estado e data de nascimento.',
          'Uso esportivo: inscrições, resultados, ranking, nivelamento, reservas, aulas, clubes e mensagens.',
          'Técnicos: identificadores de dispositivo/sessão e registros de auditoria de ações administrativas.',
          'Fotos e mídia que você opte por enviar (foto de perfil, imagens de arena/clube).',
        ],
      },
      {
        icon: 'Eye',
        title: 'Finalidades e bases legais',
        paragraphs: [
          'Tratamos dados para: operar a plataforma e suas funcionalidades (execução de contrato); calcular ranking e organizar eventos (legítimo interesse esportivo); cumprir obrigações legais; e, quando aplicável, com base no seu consentimento (por exemplo, comunicações opcionais).',
        ],
      },
      {
        icon: 'Users',
        title: 'Visibilidade e compartilhamento',
        paragraphs: [
          'Nome, inscrições, resultados e ranking são visíveis a outros participantes do mesmo contexto (torneio, clube, dia de jogo). Dados de contato (telefone, e-mail) não são exibidos publicamente.',
          'Compartilhamos dados apenas com operadores necessários à prestação do serviço (por exemplo, infraestrutura de nuvem — Google Firebase) e quando exigido por lei. Não vendemos dados pessoais.',
        ],
      },
      {
        icon: 'UserCheck',
        title: 'Direitos do titular',
        paragraphs: [
          'Conforme a LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, informação sobre compartilhamentos e eliminação dos dados tratados com base no consentimento.',
        ],
        bullets: [
          `Solicitações pelo e-mail do encarregado: ${LEGAL_CONTACT_EMAIL}.`,
          'A exportação dos seus dados em JSON está disponível na página de Configurações.',
          'A exclusão da conta remove seus dados pessoais, ressalvados os que a lei obriga a reter.',
        ],
      },
      {
        icon: 'Lock',
        title: 'Segurança, retenção e menores',
        paragraphs: [
          'Adotamos medidas técnicas e organizacionais para proteger seus dados (controle de acesso via regras de segurança e auditoria). Retemos os dados pelo tempo necessário às finalidades ou obrigações legais.',
          'Dados de menores são tratados no melhor interesse do menor e exigem consentimento do responsável legal.',
        ],
      },
      {
        icon: 'RefreshCw',
        title: 'Alterações',
        paragraphs: [
          'Esta política pode ser atualizada. Mudanças relevantes exigirão novo aceite e a versão vigente estará sempre publicada nesta central.',
        ],
      },
    ],
  },
  {
    key: 'riscos-e-responsabilidade',
    route: 'riscos-e-responsabilidade',
    title: 'Termo de Ciência de Riscos e Isenção de Responsabilidade',
    eyebrow: 'Documento essencial',
    description: 'Ciência dos riscos inerentes à prática esportiva e à participação em eventos, reservas e aulas organizados por terceiros.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.ESSENTIAL,
    audience: LEGAL_ROLE.ALL,
    gate: true,
    icon: 'AlertTriangle',
    sections: [
      {
        icon: 'AlertTriangle',
        title: 'Riscos da atividade física',
        paragraphs: [
          'O pickleball é uma atividade física que envolve riscos inerentes, incluindo quedas, lesões musculares e articulares, contato e imprevistos. Ao participar de jogos, dias de jogo, torneios, aulas e reservas, você declara estar ciente desses riscos e apto à prática.',
        ],
        bullets: [
          'Recomenda-se avaliação médica antes de iniciar ou intensificar a prática esportiva.',
          'Você é responsável por respeitar seus limites, aquecer-se e usar equipamentos adequados.',
        ],
      },
      {
        icon: 'ShieldCheck',
        title: 'Responsabilidade pela organização e pelos locais',
        paragraphs: [
          'Eventos, aulas e reservas são organizados e conduzidos por usuários (organizadores, arenas, professores, clubes), não pela PickleRush. A segurança do local, a supervisão, os primeiros socorros e o cumprimento de normas são responsabilidade de quem organiza e/ou opera o espaço.',
        ],
      },
      {
        icon: 'Scale',
        title: 'Isenção de responsabilidade da plataforma',
        paragraphs: [
          'Na máxima extensão permitida em lei, você isenta a PickleRush de responsabilidade por danos pessoais ou materiais decorrentes da prática esportiva, de eventos, aulas ou reservas contratados por meio da plataforma. A PickleRush disponibiliza a ferramenta tecnológica, não a atividade em si.',
        ],
      },
      {
        icon: 'UserCheck',
        title: 'Menores e responsáveis',
        paragraphs: [
          'Quando o participante for menor de idade, o responsável legal declara ciência e assume a responsabilidade pela participação do menor, autorizando-a nos termos deste documento.',
        ],
      },
    ],
  },

  /* --------------------------- Complementares --------------------------- */
  {
    key: 'cookies',
    route: 'cookies',
    title: 'Política de Cookies',
    eyebrow: 'Complementar',
    description: 'Como usamos cookies e tecnologias semelhantes para operar e melhorar a plataforma.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    icon: 'Cookie',
    sections: [
      {
        icon: 'Cookie',
        title: 'O que usamos',
        bullets: [
          'Cookies/armazenamento essenciais: sessão de login, preferências (tema, navegação) e segurança.',
          'Armazenamento local (localStorage): estado da interface e recursos do PWA (funcionamento offline/instalação).',
          'Não utilizamos cookies de publicidade de terceiros.',
        ],
      },
      {
        icon: 'Eye',
        title: 'Gerenciamento',
        paragraphs: [
          'Você pode limpar ou bloquear cookies/armazenamento nas configurações do seu navegador. Alguns recursos essenciais podem deixar de funcionar corretamente sem eles.',
        ],
      },
    ],
  },
  {
    key: 'diretrizes-comunidade',
    route: 'diretrizes-comunidade',
    title: 'Diretrizes da Comunidade',
    eyebrow: 'Complementar',
    description: 'Regras de convivência para feed, fóruns, chat, clubes e demais espaços sociais da plataforma.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    icon: 'HeartHandshake',
    sections: [
      {
        icon: 'HeartHandshake',
        title: 'Respeito é a regra',
        paragraphs: [
          'Os espaços sociais (comunidade, fóruns de clube, chat, avaliações) existem para somar. Trate todos com respeito, dentro e fora das quadras.',
        ],
      },
      {
        icon: 'Ban',
        title: 'Condutas proibidas',
        bullets: [
          'Discurso de ódio, discriminação, assédio, ameaças ou bullying.',
          'Conteúdo sexual, violento, ilegal ou que exponha terceiros sem consentimento.',
          'Spam, golpes, correntes e divulgação não autorizada.',
          'Desinformação sobre resultados, ranking ou identidade de atletas.',
        ],
      },
      {
        icon: 'ShieldCheck',
        title: 'Moderação e denúncias',
        paragraphs: [
          'Conteúdos e contas que violem estas diretrizes podem ser removidos ou suspensos. Avaliações de arena e conteúdos de clube contam com moderação. Denúncias podem ser enviadas pelos canais disponíveis na plataforma ou ao suporte.',
        ],
      },
    ],
  },
  {
    key: 'pagamentos-reembolsos',
    route: 'pagamentos-reembolsos',
    title: 'Política de Pagamentos e Reembolsos',
    eyebrow: 'Complementar',
    description: 'Como funcionam os valores exibidos, os pagamentos entre usuários e os reembolsos.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    icon: 'CreditCard',
    sections: [
      {
        icon: 'CreditCard',
        title: 'A plataforma não processa pagamentos',
        paragraphs: [
          'Atualmente a PickleRush não intermedia nem processa pagamentos. Valores de inscrição, reserva, aula, mensalidade e produtos são definidos e cobrados diretamente pelo organizador, arena, professor ou clube responsável — por exemplo, via PIX informado por eles.',
          'Instruções de pagamento (como uma chave PIX) exibidas na plataforma são fornecidas por esses responsáveis. Confira sempre os dados antes de pagar.',
        ],
      },
      {
        icon: 'Landmark',
        title: 'Confirmação e comprovantes',
        paragraphs: [
          'A confirmação de pagamento é feita manualmente pelo responsável (por exemplo, o admin do torneio marca a inscrição como paga). Guarde seus comprovantes. A PickleRush apenas registra o status informado pelos responsáveis.',
        ],
      },
      {
        icon: 'RefreshCw',
        title: 'Reembolsos',
        paragraphs: [
          'Pedidos de reembolso devem ser tratados diretamente com quem recebeu o pagamento (organizador, arena, professor ou clube), conforme a política de cancelamento aplicável. A PickleRush não retém valores e, portanto, não realiza reembolsos.',
        ],
      },
    ],
  },
  {
    key: 'cancelamento',
    route: 'cancelamento',
    title: 'Política de Cancelamento',
    eyebrow: 'Complementar',
    description: 'Regras gerais de cancelamento de inscrições, reservas e aulas.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    icon: 'CalendarX',
    sections: [
      {
        icon: 'CalendarX',
        title: 'Cancelamentos dependem de cada responsável',
        paragraphs: [
          'Cada arena, organizador, professor e clube pode definir suas próprias regras e prazos de cancelamento. Quando houver política de cancelamento configurada (por exemplo, prazo mínimo de antecedência de uma reserva), a plataforma informa e aplica esse prazo.',
        ],
      },
      {
        icon: 'AlertTriangle',
        title: 'Cancelamentos tardios e no-show',
        bullets: [
          'Cancelamentos fora do prazo podem ser sinalizados como tardios.',
          'A ausência sem aviso (no-show) pode ser registrada pela arena.',
          'Eventuais cobranças ou penalidades são de responsabilidade do respectivo prestador, não da PickleRush.',
        ],
      },
    ],
  },

  /* ------------------------------ Por papel ----------------------------- */
  {
    key: 'termos-organizador',
    route: 'termos-organizador',
    title: 'Termos do Organizador de Torneios',
    eyebrow: 'Por papel · Organizador',
    description: 'Responsabilidades de quem cria e administra torneios na plataforma.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.ROLE,
    audience: LEGAL_ROLE.ORGANIZER,
    gate: false,
    icon: 'Trophy',
    sections: [
      {
        icon: 'Trophy',
        title: 'Responsabilidade pelo evento',
        paragraphs: [
          'Ao criar um torneio, você é o responsável pela sua organização, regras, comunicação com inscritos, arbitragem, premiação e realização. A PickleRush fornece apenas as ferramentas de gestão.',
        ],
      },
      {
        icon: 'CreditCard',
        title: 'Inscrições, valores e dados dos inscritos',
        bullets: [
          'Os valores de inscrição são definidos e cobrados por você; a plataforma não intermedia pagamentos.',
          'Você acessa dados dos inscritos apenas para a gestão do seu evento e deve tratá-los conforme a LGPD.',
          'É proibido usar os dados dos inscritos para finalidades alheias ao torneio.',
        ],
      },
      {
        icon: 'ShieldCheck',
        title: 'Integridade e conduta',
        paragraphs: [
          'Você se compromete a lançar resultados verdadeiros, tratar os participantes com isonomia e cumprir a legislação e as regras do esporte. Fraudes ou abusos podem levar à suspensão do torneio e da conta.',
        ],
      },
    ],
  },
  {
    key: 'termos-arena',
    route: 'termos-arena',
    title: 'Termos do Proprietário de Arena',
    eyebrow: 'Por papel · Arena',
    description: 'Responsabilidades de quem cadastra e gerencia arenas, quadras, reservas e mercado.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.ROLE,
    audience: LEGAL_ROLE.ARENA_OWNER,
    gate: false,
    icon: 'Building2',
    sections: [
      {
        icon: 'Building2',
        title: 'Veracidade e operação do espaço',
        paragraphs: [
          'Você declara ter legitimidade para cadastrar e operar a arena e suas quadras, e que as informações (endereço, preços, horários, fotos, regras) são verdadeiras e atualizadas. A operação física, a segurança e a manutenção do espaço são de sua responsabilidade.',
        ],
      },
      {
        icon: 'CalendarX',
        title: 'Reservas, preços e cancelamentos',
        bullets: [
          'Você define preços, disponibilidade e política de cancelamento das suas quadras.',
          'A confirmação de reservas e pagamentos é feita por você; a plataforma não processa pagamentos.',
          'Você deve honrar as reservas confirmadas e comunicar alterações com antecedência razoável.',
        ],
      },
      {
        icon: 'ShieldCheck',
        title: 'Clientes, dados e conformidade',
        paragraphs: [
          'Dados de clientes acessados para a gestão de reservas, mensalidades e mercado devem ser tratados conforme a LGPD e usados apenas para essa finalidade. Você é responsável pela conformidade fiscal e legal da sua operação.',
        ],
      },
    ],
  },
  {
    key: 'termos-professor',
    route: 'termos-professor',
    title: 'Termos do Professor',
    eyebrow: 'Por papel · Professor',
    description: 'Responsabilidades de quem oferece aulas, pacotes e clínicas na plataforma.',
    version: 1,
    effectiveDate: '2026-07-29',
    category: LEGAL_CATEGORY.ROLE,
    audience: LEGAL_ROLE.COACH,
    gate: false,
    icon: 'GraduationCap',
    sections: [
      {
        icon: 'GraduationCap',
        title: 'Prestação das aulas',
        paragraphs: [
          'Ao se cadastrar como professor, você declara ter qualificação e legitimidade para oferecer aulas de pickleball. A relação de ensino é firmada diretamente entre você e o aluno; a PickleRush apenas facilita o encontro e a agenda.',
        ],
      },
      {
        icon: 'CreditCard',
        title: 'Valores, pacotes e cancelamentos',
        bullets: [
          'Preços, pacotes, créditos e política de cancelamento das aulas são definidos por você.',
          'Cobranças e reembolsos são tratados diretamente com o aluno; a plataforma não intermedia pagamentos.',
        ],
      },
      {
        icon: 'ShieldCheck',
        title: 'Dados de alunos e conduta',
        paragraphs: [
          'As fichas e notas de evolução dos alunos devem ser tratadas com confidencialidade e conforme a LGPD, usadas apenas para o acompanhamento pedagógico. Aulas com menores exigem consentimento dos responsáveis. Você se compromete com conduta ética e segura.',
        ],
      },
    ],
  },
];

/** Índice key → documento. */
export const LEGAL_DOCUMENTS_BY_KEY = Object.freeze(
  Object.fromEntries(LEGAL_DOCUMENTS.map((d) => [d.key, d])),
);

/** Índice route → documento. */
export const LEGAL_DOCUMENTS_BY_ROUTE = Object.freeze(
  Object.fromEntries(LEGAL_DOCUMENTS.map((d) => [d.route, d])),
);

/** Documento por key. */
export function getLegalDocument(key) {
  return LEGAL_DOCUMENTS_BY_KEY[key] || null;
}

/** Documento por segmento de rota. */
export function getLegalDocumentByRoute(route) {
  return LEGAL_DOCUMENTS_BY_ROUTE[route] || null;
}
