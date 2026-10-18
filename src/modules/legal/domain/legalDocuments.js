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
 *  - marketGate   true → entra no aviso de termos do Mercado (primeiro acesso a /mercado)
 *  - icon         nome do ícone lucide (mapeado na view)
 *  - flag         (opcional) chave de FEATURE_FLAG: com a flag desligada o
 *                 documento não aparece (a funcionalidade não existe ainda)
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
    key: 'politica-de-uso',
    route: 'politica-de-uso',
    title: 'Política de Uso',
    eyebrow: 'Complementar',
    description: 'Condições gerais de uso da plataforma: natureza esportiva da ferramenta, conduta esperada e uso aceitável.',
    version: 1,
    effectiveDate: '2026-07-30',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    icon: 'FileText',
    sections: [
      {
        icon: 'FileText',
        title: 'Natureza da plataforma',
        description: 'Ferramenta esportiva para a comunidade amadora de pickleball.',
        paragraphs: [
          'A PickleRush é uma ferramenta tecnológica para a comunidade amadora de pickleball no Brasil: criação e gestão de torneios, reservas de quadra, aulas, clubes, ranking, comunidade e mensagens. Organizadores criam torneios, definem regras, abrem inscrições, sorteiam chaves, lançam resultados e calculam rankings.',
          'A plataforma não organiza eventos, não fornece quadras, não administra premiações nem intermedia pagamentos. Os valores exibidos (por exemplo, uma taxa de inscrição) servem apenas como referência; a cobrança e o controle financeiro são responsabilidade de quem os cadastra.',
        ],
      },
      {
        icon: 'ShieldCheck',
        title: 'Conduta e responsabilidade',
        description: 'Cada usuário responde pelos próprios atos.',
        paragraphs: [
          'O uso deve respeitar a legislação aplicável, as regras do esporte (CBP/USAP) e os princípios de fair play. Fraude no lançamento de resultados, identidade falsa ou ofensa a outros usuários podem levar à suspensão da conta e do torneio.',
        ],
      },
      {
        icon: 'UserCheck',
        title: 'Uso aceitável',
        bullets: [
          'Fornecer dados verdadeiros e manter a conta segura.',
          'Não manipular ranking, inscrições, nivelamento ou resultados.',
          'Não publicar conteúdo ilegal, ofensivo, discriminatório ou spam.',
          'Não tentar burlar a segurança, fazer engenharia reversa ou coleta automatizada (scraping).',
        ],
      },
      {
        icon: 'Eye',
        title: 'Privacidade e dados',
        paragraphs: [
          'O tratamento de dados pessoais segue a Política de Privacidade, disponível nesta central. Nomes, inscrições, resultados e ranking são visíveis a outros participantes do mesmo contexto; dados de contato (telefone, e-mail) não são exibidos publicamente.',
        ],
      },
      {
        icon: 'RefreshCw',
        title: 'Alterações',
        paragraphs: [
          'Esta política pode ser atualizada para refletir mudanças de funcionalidade, requisitos legais ou de segurança. A versão vigente será sempre a publicada nesta central.',
        ],
      },
    ],
  },
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
    key: 'termos-mercado',
    route: 'termos-mercado',
    title: 'Termos Gerais do Mercado',
    eyebrow: 'Mercado · Termos gerais',
    description: 'O que o Mercado PickleRush é, o que ele não é, e as regras que valem para quem compra e para quem vende.',
    version: 2,
    effectiveDate: '2026-10-14',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    marketGate: true,
    flag: 'marketplace',
    icon: 'ShoppingBag',
    sections: [
      {
        icon: 'ShoppingBag',
        title: '1. O que é o Mercado',
        description: 'Um espaço de anúncios que aproxima quem quer vender de quem quer comprar.',
        paragraphs: [
          'O Mercado é a área da PickleRush em que atletas, professores, arenas e lojas publicam anúncios de produtos ligados ao pickleball. A PickleRush atua apenas como provedora de aplicação de internet (Lei nº 12.965/2014, Marco Civil da Internet): oferece o espaço para o anúncio e ferramentas para que as pessoas interessadas se encontrem e conversem.',
          'Estes Termos Gerais valem para todas as pessoas que usam o Mercado. Eles são completados pelos Termos do Comprador, pelos Termos do Vendedor e pela Política de Imagens, Vídeos e Conteúdo Gerado por IA, e se somam aos Termos de Uso, à Política de Privacidade e às Diretrizes da Comunidade da plataforma. Em caso de conflito, as regras específicas do Mercado prevalecem no que tratam do Mercado.',
        ],
      },
      {
        icon: 'Ban',
        title: '2. O que a PickleRush não é e não faz',
        description: 'A PickleRush não participa do negócio feito entre as partes.',
        bullets: [
          'Não é vendedora, fornecedora, fabricante, importadora, distribuidora nem proprietária dos produtos anunciados.',
          'Não é parte do contrato de compra e venda, não é intermediadora de pagamento, corretora, mandatária, representante, depositária nem garantidora de nenhuma das partes.',
          'Não recebe, guarda, retém nem repassa valores: o pagamento vai diretamente do comprador ao vendedor, pelo meio que eles usarem.',
          'Não cobra comissão sobre as vendas e não define preço, frete, prazo, forma de entrega, garantia ou qualquer condição do negócio.',
          'Não armazena, inspeciona, testa, embala, transporta nem entrega produtos, e não contrata nem indica transportadora.',
          'Não emite nota fiscal, recibo ou termo de garantia em nome de ninguém, e não recolhe tributos devidos pelas partes.',
          'Não verifica nem garante a existência, a propriedade, a origem, a autenticidade, a qualidade, a segurança, a legalidade ou o estado dos produtos, nem a veracidade dos anúncios, das fotos e dos vídeos, nem a identidade, a capacidade ou a solvência de quem compra e de quem vende.',
        ],
      },
      {
        icon: 'Scale',
        title: '3. O negócio é entre comprador e vendedor',
        paragraphs: [
          'A compra e venda feita a partir de um anúncio é um contrato firmado direta e exclusivamente entre comprador e vendedor (Código Civil, arts. 481 e seguintes). São deles, e só deles, a decisão de negociar, as condições combinadas, o pagamento, a entrega, a troca, a devolução e a garantia, bem como os direitos e deveres que nascem do negócio.',
          'Quando o vendedor for fornecedor (loja, arena ou quem vende com habitualidade), a relação com o comprador é de consumo e o vendedor responde perante ele nos termos do Código de Defesa do Consumidor. Entre particulares, valem o combinado e o Código Civil, inclusive as regras sobre vícios ocultos (arts. 441 a 446).',
        ],
      },
      {
        icon: 'FileText',
        title: '4. As ferramentas do Mercado',
        bullets: [
          'Pedido, oferta, carrinho, mensagens, perguntas, avaliações, cupons, avisos e o registro de problema no pedido são ferramentas de organização e de comunicação entre as partes.',
          'Os status do pedido ("aceito", "pago", "enviado", "recebido") são informados pelas próprias partes. Eles não são recibo, comprovante de pagamento, prova de entrega nem garantia dada pela PickleRush.',
          'O registro de problema permite que as partes deixem por escrito o que aconteceu e que a PickleRush avalie medidas sobre anúncios e contas. Ele não é arbitragem nem mediação, não obriga as partes, não substitui o atendimento do próprio vendedor e não impede que qualquer pessoa procure o Procon, o consumidor.gov.br ou o Poder Judiciário.',
          'Usar as ferramentas não torna a PickleRush participante do negócio nem cria para ela qualquer obrigação de garantir o resultado da compra.',
        ],
      },
      {
        icon: 'ShieldCheck',
        title: '5. O que a PickleRush faz',
        bullets: [
          'Mantém o Mercado funcionando com cuidado razoável, sem prometer que ele estará sempre disponível ou livre de falhas.',
          'Trata os dados pessoais conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e a Política de Privacidade, mostrando dados de contato e de entrega só a quem precisa deles para concluir o pedido.',
          'Pode recusar, pausar ou retirar anúncios, e advertir, suspender ou encerrar contas que descumpram estes documentos ou a lei, por decisão própria ou a partir de denúncia, sem dever de vigiar previamente o que é publicado.',
          'Atende às ordens das autoridades e da Justiça e colabora com elas na forma da lei.',
        ],
      },
      {
        icon: 'AlertTriangle',
        title: '6. Limites de responsabilidade',
        paragraphs: [
          'Na máxima extensão permitida pela lei, a PickleRush não responde por perdas e danos decorrentes do negócio entre as partes, como: produto não entregue, entregue com atraso, extraviado ou avariado no transporte; produto diferente do anúncio, com defeito, falsificado ou de origem ilícita; pagamento feito e não reconhecido, ou feito a pessoa errada; golpes e fraudes praticados por usuários ou por terceiros, sobretudo fora da plataforma; desistência, inadimplência ou conduta de qualquer das partes; e encontros presenciais combinados entre elas.',
          'Nada nestes documentos afasta direitos que a lei garante e que não podem ser renunciados. A PickleRush responde, nos termos da lei, pelos próprios atos e pelo funcionamento da ferramenta que oferece.',
        ],
      },
      {
        icon: 'Lock',
        title: '7. Segurança e prevenção de golpes',
        bullets: [
          'Combine e registre tudo pelo pedido e pelas mensagens do Mercado. Desconfie de quem pede para negociar ou pagar por fora.',
          'Antes de pagar, confira se o nome de quem recebe o Pix é o mesmo do vendedor mostrado no pedido.',
          'Nunca envie senhas, códigos de verificação ou fotos de documentos. A PickleRush nunca pede esses dados.',
          'Em encontros para retirada, prefira lugares públicos e movimentados, de dia, e confira o produto antes de concluir.',
          'Se cair num golpe com Pix, procure imediatamente o seu banco (há um mecanismo de devolução do Banco Central para casos de fraude) e registre um boletim de ocorrência. Denuncie o anúncio ou a conta na PickleRush.',
        ],
      },
      {
        icon: 'Gavel',
        title: '8. Indenização, lei aplicável e alterações',
        paragraphs: [
          'Quem descumprir estes documentos ou a lei responde pelos danos que causar e, se a PickleRush for cobrada ou processada por um ato seu, deve indenizá-la, inclusive pelas despesas razoáveis de defesa.',
          `Estes documentos seguem a lei brasileira. Quando houver relação de consumo, a ação pode ser proposta no foro do domicílio do consumidor. A PickleRush pode atualizar estes documentos; mudanças relevantes recebem nova versão e pedem novo aceite antes do uso do Mercado. Dúvidas: ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    key: 'termos-comprador-mercado',
    route: 'termos-comprador-mercado',
    title: 'Termos do Comprador',
    eyebrow: 'Mercado · Quem compra',
    description: 'A responsabilidade de quem compra no Mercado PickleRush.',
    version: 1,
    effectiveDate: '2026-10-14',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    marketGate: true,
    flag: 'marketplace',
    icon: 'CreditCard',
    sections: [
      {
        icon: 'UserCheck',
        title: '1. Você decide e responde pela sua compra',
        paragraphs: [
          'Ao comprar no Mercado, você reconhece que a PickleRush apenas facilita o encontro de interesses entre você e o vendedor, que ela não presta nenhum serviço no negócio e que não vende, não entrega, não recebe o pagamento e não garante o produto.',
          'A decisão de comprar é sua. Você assume a responsabilidade por avaliar o que está comprando e de quem está comprando: ler o anúncio inteiro, ver todas as fotos e vídeos (inclusive o selo "Gerado por IA", quando houver), perguntar o que for preciso antes de pedir, conferir as avaliações e a página do vendedor, a forma de entrega, o frete, o prazo e a política de troca e devolução, e verificar compatibilidade, tamanho e autenticidade quando isso importar.',
        ],
      },
      {
        icon: 'Scale',
        title: '2. Isenção da PickleRush',
        paragraphs: [
          'Na máxima extensão permitida pela lei, você isenta a PickleRush de responsabilidade pelo produto e pelo negócio, incluindo defeitos, vícios, diferenças em relação ao anúncio, falsificação, atraso, extravio, avaria no transporte, não entrega e desistência do vendedor. Reclamações sobre o produto, a entrega, a troca, a devolução, o reembolso ou a garantia devem ser feitas ao vendedor.',
          'Seus direitos legais continuam valendo contra o vendedor. Se ele for fornecedor, você tem as garantias do Código de Defesa do Consumidor, inclusive o direito de se arrepender em até 7 dias do recebimento nas compras feitas pela internet (art. 49) e a garantia contra vícios (arts. 18 e 26). Entre particulares, vale o combinado e o Código Civil.',
        ],
      },
      {
        icon: 'CreditCard',
        title: '3. Pagamento',
        bullets: [
          'O pagamento é feito diretamente ao vendedor (em regra por Pix), e a chave aparece depois que ele aceita o pedido.',
          'Confira o nome de quem recebe antes de pagar. Pague só pelo valor e pela chave mostrados no pedido.',
          'Como a PickleRush não recebe o dinheiro, ela não estorna, não reembolsa, não bloqueia e não devolve valores. Devolução é sempre com o vendedor; em caso de fraude no Pix, procure o seu banco.',
          'Avise no pedido quando pagar e guarde o comprovante.',
        ],
      },
      {
        icon: 'Truck',
        title: '4. Recebimento e retirada',
        bullets: [
          'Informe um endereço correto e completo quando houver envio. Endereço errado ou ausência no recebimento é assunto a resolver com o vendedor e a transportadora.',
          'Confira o produto ao receber; se houver problema, registre com fotos e avise o vendedor pelo pedido o quanto antes, dentro do prazo mostrado nele.',
          'Confirme o recebimento apenas quando de fato tiver recebido. A confirmação conclui o pedido.',
          'Encontros para retirada são combinados entre você e o vendedor, por conta e risco de ambos.',
        ],
      },
      {
        icon: 'HeartHandshake',
        title: '5. Conduta de quem compra',
        bullets: [
          'Faça pedidos e ofertas apenas quando tiver intenção real de comprar, e pague dentro do prazo combinado.',
          'Use os dados do vendedor (nome, chave Pix, local de retirada) somente para esta compra.',
          'Avalie com honestidade e só sobre a compra. Avaliação falsa, ameaça ou chantagem por avaliação levam à suspensão.',
          'Menores de 18 anos só compram com autorização e acompanhamento do responsável legal.',
        ],
      },
    ],
  },
  {
    key: 'termos-vendedor-mercado',
    route: 'termos-vendedor-mercado',
    title: 'Termos do Vendedor',
    eyebrow: 'Mercado · Quem vende',
    description: 'O vendedor responde, de forma única e exclusiva, pelo produto, pela venda, pelo transporte e pelos documentos.',
    version: 1,
    effectiveDate: '2026-10-14',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    marketGate: true,
    flag: 'marketplace',
    icon: 'Building2',
    sections: [
      {
        icon: 'Scale',
        title: '1. Responsabilidade única e exclusiva do vendedor',
        description: 'A PickleRush não participa da venda; quem vende responde por ela.',
        bullets: [
          'O produto: existência, propriedade ou direito de vender, origem lícita, autenticidade, qualidade, estado, segurança e conformidade com as normas que se aplicam a ele (como certificações exigidas por lei).',
          'O anúncio: título, descrição, características, estado de uso, defeitos, preço, frete, prazos e as fotos e vídeos. O anúncio obriga quem o publica (CDC, arts. 30, 31 e 37).',
          'A venda: aceitar ou recusar pedidos e ofertas, cumprir o que foi combinado, receber o pagamento e conferir que ele de fato entrou na sua conta.',
          'A troca, a devolução, o reembolso, a garantia e o atendimento ao comprador, inclusive o direito de arrependimento quando você for fornecedor.',
          'Os tributos, licenças e obrigações fiscais e regulatórias da sua atividade.',
        ],
      },
      {
        icon: 'Truck',
        title: '2. Transporte e entrega',
        bullets: [
          'A forma de entrega (envio, retirada ou encontro) é oferecida e cumprida por você. Se houver envio, a escolha, a contratação e o pagamento da transportadora ou dos Correios, a embalagem, o seguro, o código de rastreio e o prazo são de sua única e exclusiva responsabilidade.',
          'O risco do produto é seu até a entrega ao comprador, salvo o que vocês combinarem por escrito e a lei permitir (Código Civil, art. 492).',
          'Respeite as restrições de transporte de cada produto (por exemplo, baterias e itens perigosos).',
          'A PickleRush não indica, não contrata, não paga e não responde por transportadoras, nem por extravio, avaria ou atraso.',
        ],
      },
      {
        icon: 'FileText',
        title: '3. Documentos do negócio',
        bullets: [
          'Nota fiscal, recibo, termo de garantia, manual e demais documentos exigidos por lei são emitidos e entregues por você, quando cabíveis.',
          'Loja, arena e quem vende com habitualidade devem informar com clareza nome ou razão social, CPF ou CNPJ, endereço e meios de contato, as características essenciais do produto, o preço total com o frete e as condições da oferta, como pede o Decreto nº 7.962/2013 (comércio eletrônico).',
          'As condições de troca e devolução devem estar escritas na sua página e respeitar a lei.',
        ],
      },
      {
        icon: 'Ban',
        title: '4. O que não pode ser vendido',
        bullets: [
          'Produtos falsificados, réplicas ou que imitem marca de terceiros.',
          'Produtos roubados, furtados, contrabandeados ou de origem que você não possa comprovar.',
          'Produtos ilegais, perigosos, recolhidos (recall) ou cuja venda dependa de autorização que você não tem.',
          'Qualquer coisa que não seja do universo do esporte, além do que as Diretrizes da Comunidade e a lei proíbem.',
        ],
      },
      {
        icon: 'Lock',
        title: '5. Dados do comprador',
        paragraphs: [
          'Nome, endereço e telefone do comprador aparecem para você só depois do aceite, e só podem ser usados para concluir aquela venda. Quanto a esses dados, você é controlador independente perante a Lei Geral de Proteção de Dados: deve guardá-los com segurança, não compartilhá-los e não usá-los para propaganda sem consentimento, e descartá-los quando não forem mais necessários.',
        ],
      },
      {
        icon: 'Gavel',
        title: '6. Isenção e indenização',
        paragraphs: [
          'Você isenta a PickleRush de responsabilidade por reclamações, cobranças, multas, autuações e ações relacionadas aos seus produtos, anúncios, vendas, entregas e documentos, e se compromete a indenizá-la, inclusive pelas despesas razoáveis de defesa, caso ela venha a ser cobrada ou condenada por fato seu.',
          'Descumprir estes Termos pode levar à retirada de anúncios e à suspensão ou ao encerramento das vendas e da conta, sem prejuízo das medidas legais.',
        ],
      },
    ],
  },
  {
    key: 'politica-imagens-ia-mercado',
    route: 'mercado-imagens-e-ia',
    title: 'Política de Imagens, Vídeos e Conteúdo Gerado por IA',
    eyebrow: 'Mercado · Fotos e vídeos',
    description: 'Como devem ser as fotos e os vídeos dos anúncios, e quando marcar que foram gerados ou alterados por inteligência artificial.',
    version: 1,
    effectiveDate: '2026-10-14',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    marketGate: true,
    flag: 'marketplace',
    icon: 'Camera',
    sections: [
      {
        icon: 'Camera',
        title: '1. Fotos e vídeos mostram o produto real',
        bullets: [
          'Use fotos e vídeos do próprio produto que será entregue, mostrando o estado, as marcas de uso e os defeitos.',
          'Imagem de catálogo ou do fabricante só pode ser usada para produto novo idêntico ao anunciado, e a descrição deve dizer que a imagem é ilustrativa.',
          'Ajustar luz, contraste, enquadramento, tamanho e rotação é permitido, desde que o produto continue como é de verdade.',
        ],
      },
      {
        icon: 'Sparkles',
        title: '2. Quando marcar "Gerada ou alterada por IA"',
        paragraphs: [
          'Marque a opção na foto ou no vídeo sempre que ele tiver sido criado por inteligência artificial ou alterado por ela de um jeito que mude o que o comprador vê: o produto montado ou "renderizado", cores, forma, tamanho ou acessórios diferentes, defeitos apagados, ou o produto colocado num cenário criado por IA. A plataforma mostra o selo "Gerado por IA" sobre a imagem, nos cards e na foto ampliada.',
          'Não precisa marcar ajustes simples que não mudam o produto, como corte, luz, contraste, nitidez ou um fundo liso no lugar do original sem alterar o produto em si.',
        ],
      },
      {
        icon: 'UserCheck',
        title: '3. A declaração é sua',
        bullets: [
          'Quem publica declara se a imagem ou o vídeo foi gerado ou alterado por IA e responde, de forma única e exclusiva, pela veracidade dessa informação e pelo conteúdo publicado.',
          'A PickleRush não analisa nem certifica automaticamente as imagens. A presença ou a ausência do selo não é uma garantia dada pela plataforma.',
          'Imagem gerada por IA não pode ser usada para enganar o comprador sobre o produto. Publicidade enganosa é proibida pelo Código de Defesa do Consumidor (art. 37).',
        ],
      },
      {
        icon: 'Ban',
        title: '4. O que não pode ser publicado',
        bullets: [
          'Imagens ou vídeos de que você não tem os direitos (Lei nº 9.610/1998, de direitos autorais), como fotos de outros vendedores ou de sites sem autorização.',
          'Imagem de pessoa sem autorização dela (Código Civil, art. 20), e de criança ou adolescente identificável sem autorização do responsável.',
          'Montagens que imitem pessoas reais (deepfake), marcas de terceiros em produto que não é da marca, conteúdo sexual, violento ou discriminatório.',
          'Dados pessoais visíveis, como documentos, placas de veículo, endereços e telefones.',
        ],
      },
      {
        icon: 'AlertTriangle',
        title: '5. Medidas e denúncias',
        paragraphs: [
          'Anúncios com imagem enganosa, sem o selo quando ele era devido ou que descumpram esta política podem ser pausados ou retirados, e a conta pode ser suspensa. Qualquer pessoa pode denunciar um anúncio pelo botão de denúncia.',
          'Ainda não há no Brasil uma lei em vigor que regule a rotulagem de conteúdo gerado por IA; esta política adota a transparência como boa prática e será atualizada quando a legislação mudar.',
        ],
      },
    ],
  },
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
  {
    key: 'termos-federacao',
    route: 'termos-federacao',
    title: 'Termos para Federações',
    eyebrow: 'Federações · Quem administra',
    description: 'O que a PickleRush oferece a uma federação, o que a federação se compromete a fazer com os filiados e os dados deles, e o que a plataforma não é.',
    version: 1,
    effectiveDate: '2026-10-18',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    flag: 'federations',
    icon: 'Landmark',
    sections: [
      {
        icon: 'Landmark',
        title: '1. O que é a gestão de federação na PickleRush',
        description: 'Uma ferramenta para a entidade; a entidade continua sendo quem é.',
        paragraphs: [
          'A PickleRush oferece à federação uma área de gestão: página pública, planos de filiação, pedidos de filiação, cobrança por Pix, carteirinha digital com verificação pública, equipe com papéis e, conforme forem liberados, torneios chancelados, ranking oficial e módulos adicionais.',
          'A federação é uma pessoa jurídica própria, com CNPJ, estatuto e dirigentes. A PickleRush não é a federação, não a representa, não a reconhece como entidade oficial do esporte e não responde pelos atos dela. Os selos "Verificada" e "Oficial" dizem apenas que a plataforma conferiu os dados informados ou que a entidade é a reconhecida na sua abrangência, conforme as informações disponíveis na data.',
        ],
      },
      {
        icon: 'UserCheck',
        title: '2. Quem pede a abertura e quem responde',
        bullets: [
          'Quem pede a abertura declara ter poderes para representar a entidade e informa CNPJ e razão social verdadeiros. Aprovada, essa pessoa vira presidente na plataforma e pode nomear a equipe.',
          'Os atos da equipe na plataforma (aprovar filiação, confirmar pagamento, suspender filiado, publicar informação) são atos da federação, e ela responde por eles perante os filiados e a lei.',
          'A PickleRush pode recusar, suspender ou encerrar a área de uma federação que informe dados falsos, cobre sem prestar o que promete, descumpra a lei ou estes Termos, avisando o motivo.',
        ],
      },
      {
        icon: 'HandCoins',
        title: '3. Mensalidades, anuidades e Pix',
        bullets: [
          'Os valores dos planos são definidos pela federação. O pagamento é feito por Pix diretamente para a chave informada pela federação; a PickleRush não recebe, não guarda, não repassa e não intermedeia o dinheiro, e não cobra comissão sobre ele.',
          'A federação confere o recebimento e confirma na plataforma. Confirmar ativa a filiação e emite a carteirinha; a confirmação é responsabilidade da federação, e um pagamento confirmado sem ter entrado é problema entre a federação e o filiado.',
          'Recibo, nota fiscal, tributos e a destinação do que foi arrecadado são da federação. A PickleRush só registra o histórico para os dois lados.',
        ],
      },
      {
        icon: 'Lock',
        title: '4. Dados dos filiados',
        paragraphs: [
          'Ao receber um pedido de filiação, a federação passa a ver nome, foto, categoria e os dados que o próprio filiado informou. Quanto a esses dados, a federação é controladora independente perante a Lei Geral de Proteção de Dados: só pode usá-los para a finalidade da filiação (cadastro, cobrança, carteirinha, competições e comunicados da entidade), deve guardá-los com segurança e não pode vendê-los, compartilhá-los com terceiros fora dessa finalidade nem usá-los para propaganda sem consentimento.',
          'A carteirinha digital mostra ao público apenas o que a verificação pública libera: nome, foto (se o filiado permitir), federação, tipo de vínculo, número e validade. A federação não deve expor outros dados do filiado em páginas, listas ou materiais públicos.',
        ],
      },
      {
        icon: 'Gavel',
        title: '5. Isenção e responsabilidade',
        paragraphs: [
          'A federação isenta a PickleRush de responsabilidade por reclamações, cobranças, multas e ações relacionadas às suas filiações, cobranças, decisões esportivas e disciplinares, comunicados e ao uso que fizer dos dados dos filiados, e se compromete a indenizá-la, inclusive pelas despesas razoáveis de defesa, caso ela venha a ser cobrada ou condenada por fato da federação.',
          'A PickleRush pode alterar estes Termos avisando com antecedência razoável; a versão em vigor é a publicada na Central legal. Descumpri-los pode levar à suspensão da área da federação, sem prejuízo das medidas legais.',
        ],
      },
    ],
  },
  {
    key: 'termos-filiacao',
    route: 'termos-filiacao',
    title: 'Termos de Filiação',
    eyebrow: 'Federações · Quem se filia',
    description: 'O que acontece quando você pede filiação a uma federação pela PickleRush: o que a federação passa a ver, como se paga, o que a carteirinha vale e como sair.',
    version: 1,
    effectiveDate: '2026-10-18',
    category: LEGAL_CATEGORY.COMPLEMENTARY,
    audience: LEGAL_ROLE.ALL,
    gate: false,
    flag: 'federations',
    icon: 'IdCard',
    sections: [
      {
        icon: 'Landmark',
        title: '1. Com quem você está se filiando',
        paragraphs: [
          'A filiação é um vínculo entre você e a federação, uma entidade própria, com CNPJ e dirigentes, que não é a PickleRush. A plataforma apenas organiza o pedido, a cobrança, a carteirinha e o histórico. Regras da federação (estatuto, regulamentos, decisões esportivas e disciplinares) são dela, e dúvidas sobre elas são respondidas pela federação, pelo contato que aparece na página dela.',
        ],
      },
      {
        icon: 'Eye',
        title: '2. O que a federação passa a ver',
        bullets: [
          'Ao pedir filiação, a equipe da federação vê o seu nome, a foto, a categoria em que joga, o plano escolhido e o que você escrever no pedido. E-mail, telefone, nascimento e endereço do seu cadastro NÃO são enviados por este pedido; se a federação precisar deles, ela pede a você diretamente.',
          'A federação é responsável, perante a Lei Geral de Proteção de Dados, pelo uso que fizer dos dados que recebe. Você pode cancelar a filiação a qualquer momento nesta plataforma; isso encerra o vínculo aqui, mas não apaga o que a federação já guardou fora dela.',
        ],
      },
      {
        icon: 'HandCoins',
        title: '3. Pagamento por Pix',
        bullets: [
          'O valor é o do plano que você escolheu, com os descontos que a federação definir (por idade, por exemplo). O pagamento é feito por Pix diretamente para a conta da federação. A PickleRush não recebe o dinheiro, não cobra taxa e não devolve valores: estorno e reembolso são tratados com a federação.',
          'Depois de pagar, você informa na plataforma ("Já paguei") e a federação confirma. A filiação só fica ativa, e a carteirinha só vale, depois dessa confirmação. Guarde o comprovante.',
          'Mensalidade e anuidade têm validade. Perto do vencimento a plataforma avisa; vencida, a filiação fica como "vencida" até a renovação, e a carteirinha deixa de verificar como em dia.',
        ],
      },
      {
        icon: 'IdCard',
        title: '4. A carteirinha digital',
        bullets: [
          'A carteirinha mostra nome, foto (se você permitir), federação, tipo de vínculo, número e validade, e um código com QR. Qualquer pessoa com o código pode verificar, sem conta, se a filiação está em dia — e vê só esses dados.',
          'A carteirinha é emitida pela federação; a PickleRush só a exibe e verifica. Ela não é documento de identidade e vale o que a federação e as entidades que a reconhecem decidirem.',
          'Você escolhe se a foto aparece na verificação pública, se a filiação aparece no seu perfil público e se você entra no diretório de filiados da federação. Essas escolhas ficam com você e podem ser mudadas a qualquer hora.',
        ],
      },
      {
        icon: 'Gavel',
        title: '5. Recusa, suspensão e cancelamento',
        paragraphs: [
          'A federação pode recusar um pedido ou suspender uma filiação, informando o motivo, que você lê na plataforma. Discordâncias são tratadas com a federação, pelos canais dela. A PickleRush não arbitra decisões da federação, mas pode suspender a área de uma federação que descumpra os Termos para Federações.',
          'Você pode cancelar a sua filiação a qualquer momento. O cancelamento encerra a validade da carteirinha e não gera reembolso automático. Ao excluir a sua conta na PickleRush, as suas filiações ficam registradas na federação sem o seu nome, e os códigos de carteirinha são apagados.',
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
