/**
 * CENTRAL DE AJUDA — conteúdo puro, sem I/O e sem React.
 *
 * O manual da plataforma, dividido por TIPO DE USUÁRIO. A divisão não é
 * cosmética: quem administra uma arena e quem só joga têm perguntas
 * completamente diferentes, e um único texto corrido faria cada um garimpar o
 * que interessa no meio do que não interessa.
 *
 *   · Começar aqui   — vale para todo mundo, é a porta de entrada
 *   · Atleta         — jogar, competir, evoluir, conviver
 *   · Arena          — abrir, configurar, receber reservas, vender, medir
 *   · Professor      — perfil, agenda, alunos, pacotes, clínicas
 *   · Conta e dados  — privacidade, notificações, documentos, sair
 *
 * ## Por que conteúdo é DADO, e não JSX
 *
 *  1. conteúdo muda muito mais que interface — quem for corrigir um texto não
 *     precisa entender React;
 *  2. dá para TESTAR: que todo artigo tem título e corpo, que os ids não se
 *     repetem, que todo link interno aponta para uma rota que existe;
 *  3. dá para BUSCAR sem depender da tela;
 *  4. os ids são endereço: `/ajuda?s=atleta&a=inscrever-torneio` abre direto
 *     no artigo. Renomear um id quebra links que já circulam.
 *
 * ## Blocos
 *
 * Cada artigo é uma lista de blocos tipados, em vez de HTML solto:
 *
 *   { type: 'p',     text }            parágrafo
 *   { type: 'steps', items: [...] }    passo a passo numerado
 *   { type: 'list',  items: [...] }    lista de itens
 *   { type: 'tip',   text }            dica
 *   { type: 'warn',  text }            atenção — o que costuma dar errado
 *   { type: 'link',  to, label }       atalho para a tela de que se está falando
 *
 * Assim a tela desenha cada tipo do seu jeito, e o conteúdo nunca carrega
 * marcação — nada de `<b>` perdido num texto que um dia vira outra coisa.
 *
 * ## O que NÃO vai aqui
 *
 * Regra de negócio. Este texto descreve o que a plataforma faz; quem decide o
 * que ela faz é o domínio de cada módulo. E, como todo manual, ele só vale
 * enquanto for verdade: **mexeu numa tela, passe por aqui.**
 */

/** Ids das seções. São endereço — ver o cabeçalho. */
export const HELP_SECTION = Object.freeze({
  START: 'comecar',
  ATHLETE: 'atleta',
  ARENA: 'arena',
  COACH: 'professor',
  ACCOUNT: 'conta',
});

/* ---------------------------------------------------------- atalhos de bloco */

const p = (text) => ({ type: 'p', text });
const steps = (...items) => ({ type: 'steps', items });
const list = (...items) => ({ type: 'list', items });
const tip = (text) => ({ type: 'tip', text });
const warn = (text) => ({ type: 'warn', text });
const link = (to, label) => ({ type: 'link', to, label });

/* =========================================================== COMEÇAR AQUI == */

const COMECAR = {
  id: HELP_SECTION.START,
  label: 'Começar aqui',
  tagline: 'Vale para todo mundo — cinco minutos e você se vira sozinho.',
  audience: 'Todos',
  articles: [
    {
      id: 'o-que-e',
      title: 'O que é o PickleRush',
      summary: 'Para que serve a plataforma e o que dá para fazer nela.',
      keywords: ['início', 'plataforma', 'visão geral', 'começar'],
      blocks: [
        p('O PickleRush reúne, num lugar só, o que o pickleball amador brasileiro faz espalhado: organizar torneios, marcar o jogo de sábado, encontrar com quem jogar, achar quadra, achar professor, e acompanhar a própria evolução.'),
        p('Você usa a plataforma em um ou mais papéis ao mesmo tempo. A maioria das pessoas começa como ATLETA. Quem tem quadra também vira ARENA. Quem dá aula também vira PROFESSOR. Não é preciso escolher: os papéis convivem na mesma conta.'),
        list(
          'ATLETA — jogar, se inscrever em torneios, entrar em dias de jogo, ver ranking e evolução.',
          'ARENA — publicar suas quadras, receber reservas, vender no balcão, medir o movimento.',
          'PROFESSOR — ter perfil público, agenda de aulas, alunos, pacotes e clínicas.',
        ),
        tip('Esta central é dividida por esses papéis. Vá direto para a parte que é a sua — e volte aqui quando assumir outro.'),
      ],
    },
    {
      id: 'primeiros-passos',
      title: 'Primeiros passos: conta e perfil',
      summary: 'O que preencher logo no começo, e por quê.',
      keywords: ['conta', 'cadastro', 'perfil', 'criar conta', 'entrar'],
      blocks: [
        p('Crie a conta e preencha o perfil. Não é burocracia: quase tudo na plataforma usa esses dados para funcionar bem.'),
        steps(
          'Informe nome de exibição, cidade e estado — é como as outras pessoas te encontram.',
          'Diga o seu NÍVEL (ou faça o nivelamento). É o que faz os sorteios montarem jogos equilibrados.',
          'Se você tem rating DUPR, informe: ele entra como ponto de partida do seu rating na plataforma.',
          'Escolha os seus interesses — eles orientam o que a plataforma te sugere.',
          'Decida o que fica público. Contato só aparece se você quiser (veja "Privacidade").',
        ),
        link('/perfil/editar', 'Abrir e completar meu perfil'),
        tip('Perfil incompleto é a causa número um de "ninguém me chama para jogar": sem cidade e sem nível, você não aparece nas buscas certas.'),
      ],
    },
    {
      id: 'navegar',
      title: 'Como a plataforma é organizada',
      summary: 'O menu, os hubs e onde cada coisa mora.',
      keywords: ['menu', 'navegação', 'hub', 'onde fica'],
      blocks: [
        p('O menu lateral tem HUBS (temas). Ao entrar num hub, aparece uma segunda barra com as páginas daquele tema. É sempre dois níveis — nada fica escondido num terceiro.'),
        list(
          'Início — seu ponto de partida, com o que pede ação agora.',
          'Competir — torneios, circuitos e rankings.',
          'Jogar — dia de jogo, procura-se jogo, encontrar jogadores.',
          'Comunidade — atletas, clubes, novidades e mensagens.',
          'Arenas — explorar quadras e suas reservas.',
          'Aulas — professores, suas aulas e (se você dá aula) o painel do professor.',
          'Pickleball — regras, nivelamento, história e conduta.',
          'Perfil — seu perfil, desempenho, seus torneios e configurações.',
        ),
        p('A busca do topo procura em toda a plataforma: atletas, torneios, arenas, clubes.'),
        tip('O menu lateral recolhe, se você quiser mais espaço na tela. A preferência fica guardada no seu navegador.'),
      ],
    },
    {
      id: 'nivelamento',
      title: 'Nível, rating e ranking: o que é cada coisa',
      summary: 'Três conceitos que parecem o mesmo e não são.',
      keywords: ['nível', 'rating', 'ranking', 'dupr', 'elo', 'nivelamento'],
      blocks: [
        p('São três coisas diferentes, e confundi-las gera muita dúvida:'),
        list(
          'NÍVEL — o que você declara (ou valida no nivelamento): iniciante, intermediário, avançado… Serve para montar jogos equilibrados.',
          'RATING — um número que se move com os seus resultados. A plataforma tem dois: o ELO (ranking nacional) e um na escala 2.0–8.0, no estilo DUPR.',
          'RANKING — a sua posição comparada à das outras pessoas, calculada a partir do rating.',
        ),
        p('Para SORTEAR jogos equilibrados, a plataforma usa uma régua única (2.0–8.0), alimentada nesta ordem: DUPR informado → rating da plataforma → ELO → nível declarado. Você não precisa fazer nada: ela usa a melhor informação que tiver sobre você.'),
        link('/nivelamento', 'Fazer o nivelamento'),
        link('/ranking', 'Ver o ranking'),
        tip('Sem nenhuma dessas informações, o sorteio ainda funciona — só não consegue equilibrar. Vale preencher.'),
      ],
    },
    {
      id: 'aprender-o-esporte',
      title: 'Aprender o esporte',
      summary: 'Regras, nivelamento, história e conduta.',
      keywords: ['regras', 'aprender', 'história', 'conduta', 'fair play', 'nivelamento'],
      blocks: [
        p('O menu Pickleball reúne o conteúdo sobre o esporte em si — útil para quem está começando e para quem vai arbitrar ou organizar.'),
        list(
          'REGRAS — as regras do jogo, em português.',
          'NIVELAMENTO — como os níveis funcionam e como descobrir o seu.',
          'HISTÓRIA DO ESPORTE — de onde veio o pickleball.',
          'CONDUTA E FAIR PLAY — o combinado de convivência da plataforma.',
        ),
        link('/regras', 'Ver as regras'),
        link('/nivelamento', 'Entender o nivelamento'),
        link('/conduta', 'Conduta e fair play'),
      ],
    },
    {
      id: 'buscar',
      title: 'Achar qualquer coisa na plataforma',
      summary: 'A busca do topo, e o que ela alcança.',
      keywords: ['busca', 'procurar', 'encontrar', 'pesquisa'],
      blocks: [
        p('A busca no topo da tela procura em toda a plataforma de uma vez: atletas, torneios, arenas e clubes. É o caminho mais curto quando você sabe o nome do que procura.'),
        link('/buscar', 'Abrir a busca'),
        tip('Procurando uma FUNCIONALIDADE, e não um nome? Use a busca desta central de ajuda — ela procura no corpo dos textos, não só nos títulos.'),
      ],
    },
  ],
};

/* ================================================================ ATLETA == */

const ATLETA = {
  id: HELP_SECTION.ATHLETE,
  label: 'Atleta',
  tagline: 'Jogar, competir, evoluir e conviver.',
  audience: 'Quem joga',
  articles: [
    {
      id: 'achar-jogo',
      title: 'Achar com quem e onde jogar',
      summary: 'Três caminhos diferentes para sair do sofá.',
      keywords: ['jogar', 'parceiro', 'procura-se jogo', 'encontrar jogadores', 'quadra'],
      blocks: [
        p('A plataforma tem três caminhos, e eles servem a situações diferentes:'),
        list(
          'ENCONTRAR JOGADORES — para achar gente do seu nível, perto de você. Bom quando você quer montar um jogo do zero.',
          'PROCURA-SE JOGO — mural de convites abertos. Alguém já marcou algo e está chamando; você pede para entrar.',
          'DIA DE JOGO — o evento organizado (treino de sábado, open play do clube). Você entra como participante.',
        ),
        link('/encontrar-jogadores', 'Encontrar jogadores'),
        link('/procura-jogo', 'Ver convites abertos'),
        link('/arenas', 'Procurar uma quadra'),
        tip('Quer jogar hoje? Comece por "Procura-se jogo" — é onde já existe jogo marcado precisando de gente.'),
      ],
    },
    {
      id: 'dia-de-jogo',
      title: 'Participar de um dia de jogo',
      summary: 'Como funciona do lado de quem joga.',
      keywords: ['dia de jogo', 'play', 'americano', 'fila', 'participar'],
      blocks: [
        p('Dia de jogo é o evento de um dia: o treino, o open play, o americano do clube. Quem organiza cria; você entra como participante.'),
        p('O que você faz depende do formato:'),
        list(
          'PLAY — há uma FILA (ordem de participação). Você entra nela, joga, e volta para o fim. A tela mostra a sua posição e quem entra a seguir.',
          'AMERICANO — a grade de jogos é sorteada de uma vez. Você vê as suas partidas e os resultados.',
          'AMERICANO APRIMORADO — como o Play (fila, partida a partida), mas com placar e ranking do dia.',
        ),
        p('Em qualquer um deles você pode ficar indisponível por algumas partidas (para descansar) e pedir dupla fixa com alguém. Quem organiza aplica.'),
        link('/dia-de-jogo', 'Ver dias de jogo'),
        tip('Há um TELÃO por dia de jogo, feito para a TV da quadra: mostra quem está jogando, quem entra depois e o ranking do dia.'),
      ],
    },
    {
      id: 'organizar-dia-de-jogo',
      title: 'Organizar o seu próprio dia de jogo',
      summary: 'Você não precisa ser clube nem arena para organizar.',
      keywords: ['organizar', 'criar dia de jogo', 'formato', 'quadras'],
      blocks: [
        p('Qualquer atleta cria um dia de jogo. Escolha o formato, o número de quadras, a data e quem pode organizar as partidas (só você e quem você nomear, ou qualquer inscrito).'),
        p('Cada formato tem um tutorial completo dentro da própria tela — o botão "Como funciona" explica passo a passo, e pode ser revisto quando quiser.'),
        link('/dia-de-jogo', 'Criar um dia de jogo'),
        tip('Se o seu grupo varia (gente chegando e saindo), use Play ou Americano aprimorado. Se é o mesmo grupo do começo ao fim, o Americano é mais simples.'),
      ],
    },
    {
      id: 'inscrever-torneio',
      title: 'Se inscrever num torneio',
      summary: 'Do achar ao check-in no dia.',
      keywords: ['torneio', 'inscrição', 'inscrever', 'modalidade', 'dupla'],
      blocks: [
        p('Torneios públicos aparecem na busca. Torneios privados exigem link ou código de acesso.'),
        steps(
          'Abra o torneio e veja as MODALIDADES — cada uma é uma disputa (por exemplo, "Dupla Masculina B").',
          'Escolha a modalidade compatível com o seu gênero, faixa etária e nível.',
          'Se for de duplas, informe o parceiro. Ele não precisa ter conta para ser inscrito, mas sem conta não pontua no ranking.',
          'Confirme. Sua inscrição entra como pendente até quem organiza confirmar o pagamento.',
          'No dia, faça o CHECK-IN (ou peça a quem organiza) — é como o torneio sabe quem apareceu, antes de sortear.',
        ),
        link('/torneios', 'Ver torneios abertos'),
        warn('Modalidade cheia coloca você na LISTA DE ESPERA. Se alguém desistir, quem organiza promove da lista — vale ficar de olho.'),
      ],
    },
    {
      id: 'durante-torneio',
      title: 'Acompanhar o torneio no dia',
      summary: 'Onde ver a chave, o horário e o resultado.',
      keywords: ['chave', 'jogos', 'horário', 'resultado', 'telão'],
      blocks: [
        p('A página pública do torneio mostra chaves, grupos, jogos, horários e classificação, atualizados conforme os resultados são lançados. Não precisa estar logado para ver.'),
        p('No ginásio, costuma haver um TELÃO numa TV — a mesma informação, em letra grande, atualizando sozinha.'),
        tip('Os grupos e as chaves também podem ser impressos por quem organiza, para afixar na parede.'),
      ],
    },
    {
      id: 'organizar-torneio',
      title: 'Organizar um torneio',
      summary: 'Criar, gerir modalidades, inscrições, sorteio e resultados.',
      keywords: ['organizar torneio', 'criar torneio', 'sorteio', 'gestão'],
      blocks: [
        p('Qualquer pessoa cria um torneio. O caminho é sempre: criar → modalidades → inscrições → sorteio → resultados. O encerramento é automático quando o último resultado entra.'),
        p('Há um tutorial completo dentro do console de gestão, com os sete passos detalhados — ele abre na primeira vez e fica disponível no botão "Como funciona".'),
        link('/torneios/criar', 'Criar um torneio'),
        link('/torneios/guia', 'Guia dos formatos de chave'),
        tip('Não sabe qual modelo de chave usar? O Guia de formatos explica cada um e quantos participantes cada um pede.'),
      ],
    },
    {
      id: 'circuitos',
      title: 'Circuitos: torneios em série',
      summary: 'Quando vários torneios formam uma temporada.',
      keywords: ['circuito', 'série', 'temporada', 'etapa', 'ranking'],
      blocks: [
        p('Um CIRCUITO é um conjunto de torneios que correm juntos como uma temporada: cada torneio é uma etapa, e a classificação do circuito soma o desempenho das etapas.'),
        p('Você não se inscreve no circuito — você se inscreve nas etapas. A classificação acompanha sozinha.'),
        link('/circuits', 'Ver circuitos'),
      ],
    },
    {
      id: 'ranking-evolucao',
      title: 'Ranking, rating e a sua evolução',
      summary: 'De onde vêm os números e quando eles mudam.',
      keywords: ['ranking', 'rating', 'evolução', 'desempenho', 'duplas', 'dupr'],
      blocks: [
        p('Os resultados que contam vêm de duas fontes: torneios PÚBLICOS e ENCERRADOS, e dias de jogo cujo organizador publicou os resultados no ranking.'),
        list(
          'RANKING NACIONAL — a classificação geral, pelo rating ELO.',
          'RATING 2.0–8.0 — no estilo DUPR, baseado no placar e não só em vitória/derrota. Uma derrota apertada contra alguém muito mais forte pode subir o seu rating.',
          'RANKING DE DUPLAS — classifica PARCERIAS (você com cada pessoa), por aproveitamento.',
          'MEU DESEMPENHO — a sua evolução ao longo do tempo, jogo a jogo.',
        ),
        p('Tudo isso é atualizado NA HORA em que um resultado é publicado. Não há espera nem processamento noturno.'),
        link('/ranking', 'Ranking nacional'),
        link('/ranking/duplas', 'Ranking de duplas'),
        link('/meu-desempenho', 'Minha evolução'),
        tip('No ranking de duplas você escolhe uma AMOSTRA MÍNIMA (a partir de quantos jogos uma parceria entra). A escolha fica salva para as suas próximas visitas.'),
      ],
    },
    {
      id: 'comunidade',
      title: 'Clubes, mensagens e comunidade',
      summary: 'Conviver com quem joga com você.',
      keywords: ['clube', 'comunidade', 'mensagem', 'chat', 'fórum', 'mural'],
      blocks: [
        p('CLUBES são grupos de pessoas que jogam juntas. Dentro de um clube há mural, fóruns, eventos, membros e um ranking interno — só dos jogos daquele clube.'),
        p('Você entra num clube por convite ou pedindo para entrar. Quem administra aprova.'),
        list(
          'Atletas — o diretório de quem está na plataforma (quem optou por aparecer).',
          'Mensagens — conversa direta com outros atletas.',
          'Novidades — o que está acontecendo na sua rede.',
        ),
        link('/clubes', 'Ver clubes'),
        link('/chat', 'Minhas mensagens'),
      ],
    },
    {
      id: 'reservas-aulas',
      title: 'Reservar quadra e marcar aula',
      summary: 'Do lado de quem contrata.',
      keywords: ['reserva', 'quadra', 'aula', 'professor', 'agendar'],
      blocks: [
        p('Em Arenas você encontra quadras por cidade, vê preços e horários, e pede a reserva. A arena responde confirmando ou recusando — você acompanha em "Minhas reservas".'),
        p('Em Aulas você encontra professores, vê o perfil, os pacotes e a agenda, e marca. Suas aulas ficam em "Minhas aulas".'),
        link('/arenas', 'Procurar quadra'),
        link('/minhas-reservas', 'Minhas reservas'),
        link('/coaches', 'Procurar professor'),
        link('/minhas-aulas', 'Minhas aulas'),
        warn('Pedir reserva não é o mesmo que ter reserva: só vale depois que a arena confirma.'),
      ],
    },
  ],
};

/* ================================================================= ARENA == */

const ARENA = {
  id: HELP_SECTION.ARENA,
  label: 'Arena',
  tagline: 'Abrir, configurar, receber reservas, vender e medir.',
  audience: 'Quem tem quadra',
  articles: [
    {
      id: 'criar-arena',
      title: 'Publicar a sua arena',
      summary: 'O mínimo para aparecer e começar a receber pedidos.',
      keywords: ['criar arena', 'cadastrar', 'publicar', 'onboarding'],
      blocks: [
        p('Criar a arena leva poucos minutos. O que a faz ser encontrada é o básico bem preenchido: nome, cidade, endereço, fotos e quadras.'),
        steps(
          'Crie a arena e preencha as informações: nome, descrição, endereço, contato.',
          'Envie FOTOS. É o que mais pesa na decisão de quem procura quadra.',
          'Cadastre as QUADRAS: quantas, tipo de piso, cobertura, iluminação.',
          'Defina PREÇOS por faixa de horário e dia da semana.',
          'Escreva as REGRAS da casa (antecedência, cancelamento, o que está incluído).',
        ),
        link('/arenas/criar', 'Criar minha arena'),
        tip('Há um roteiro de onboarding que conduz esses passos na ordem. Vale seguir até o fim antes de divulgar.'),
      ],
    },
    {
      id: 'gerir-reservas',
      title: 'Receber e gerenciar reservas',
      summary: 'Solicitações, calendário e clientes.',
      keywords: ['reserva', 'solicitação', 'calendário', 'agenda', 'cliente'],
      blocks: [
        p('Pedidos de reserva chegam em SOLICITAÇÕES. Você confirma ou recusa, e quem pediu é avisado. O contador no menu mostra quantos estão aguardando.'),
        list(
          'SOLICITAÇÕES — a fila de pedidos aguardando resposta.',
          'CALENDÁRIO — a visão de ocupação das quadras.',
          'RESERVAS (ADMIN) — criar e ajustar reservas você mesmo, inclusive para quem ligou por telefone.',
          'CLIENTES — quem já reservou na sua arena.',
        ),
        warn('Pedido sem resposta trava o horário na cabeça do cliente e não trava na sua agenda. Responder rápido é o que evita conflito de horário.'),
      ],
    },
    {
      id: 'precos-regras',
      title: 'Estrutura, preços e regras',
      summary: 'Quadras, faixas de preço e as condições da casa.',
      keywords: ['preço', 'quadra', 'regras', 'horário', 'valor'],
      blocks: [
        p('Em "Estrutura e preços" ficam as três coisas que definem o que você vende:'),
        list(
          'QUADRAS — cada quadra com as suas características.',
          'PREÇOS — por faixa de horário e dia. É comum ter valor diferente em horário de pico.',
          'REGRAS — antecedência mínima, política de cancelamento, o que está incluído.',
        ),
        tip('Regras escritas com clareza evitam a maior parte dos atritos. Quem lê antes reclama menos depois.'),
      ],
    },
    {
      id: 'loja-pdv',
      title: 'Loja e PDV (vender na arena)',
      summary: 'Catálogo, estoque e venda no balcão.',
      keywords: ['loja', 'pdv', 'venda', 'produto', 'estoque', 'mercado'],
      blocks: [
        p('A arena pode vender no balcão: bolinhas, bebidas, aluguel de raquete, o que for. O catálogo padrão já traz itens comuns, e você ajusta.'),
        list(
          'MERCADO — o catálogo da sua arena e o estoque.',
          'PDV — a tela de venda, para usar no balcão.',
          'PAGAMENTO — como você recebe.',
        ),
        warn('Só é possível vender o que está (ou esteve) em estoque. É proposital: evita vender o que não existe.'),
      ],
    },
    {
      id: 'equipe',
      title: 'Equipe, professores e clubes parceiros',
      summary: 'Quem mais pode operar a arena.',
      keywords: ['admin', 'equipe', 'professor', 'clube', 'parceiro'],
      blocks: [
        p('Você não precisa operar sozinho:'),
        list(
          'ADMINS — outras pessoas com poder de gerir a arena.',
          'PROFESSORES — professores parceiros, que aparecem ligados à sua arena.',
          'CLUBES — clubes que usam a sua estrutura.',
        ),
        tip('Nomear um admin é o jeito certo de dividir a operação. Compartilhar senha, não.'),
      ],
    },
    {
      id: 'desempenho-arena',
      title: 'Medir o movimento',
      summary: 'Como foi a semana, métricas e retornos.',
      keywords: ['métricas', 'desempenho', 'semana', 'ocupação', 'retorno'],
      blocks: [
        p('Em "Desempenho" a arena vê o que aconteceu, sem precisar de planilha:'),
        list(
          'SEMANA — o resumo de "como foi sua semana".',
          'MÉTRICAS — ocupação, reservas, receita.',
          'RETORNOS — o que os clientes acharam.',
        ),
        tip('Olhar o resumo semanal é o hábito que mais rende: dá para ver o horário ocioso antes que ele vire prejuízo do mês.'),
      ],
    },
    {
      id: 'modulos-arena',
      title: 'Módulos: ligar só o que você usa',
      summary: 'A arena não precisa de tudo ligado.',
      keywords: ['módulos', 'ativar', 'funcionalidades', 'open match', 'marketing'],
      blocks: [
        p('A gestão da arena é modular. Você liga só os módulos que fazem sentido para a sua operação — e a tela fica só com o que você usa.'),
        list(
          'Open match e matchmaking — jogos abertos na sua arena.',
          'Membros — sua base de alunos/mensalistas.',
          'Aulas — a agenda de aulas na sua estrutura.',
          'Torneios — torneios sediados por você.',
          'Marketing — divulgação.',
          'Operações — a rotina do dia a dia.',
        ),
        tip('Comece com o essencial (quadras, preços, reservas). Ligue o resto quando sentir falta — não antes.'),
      ],
    },
  ],
};

/* ============================================================= PROFESSOR == */

const PROFESSOR = {
  id: HELP_SECTION.COACH,
  label: 'Professor',
  tagline: 'Ser encontrado, organizar a agenda e acompanhar alunos.',
  audience: 'Quem dá aula',
  articles: [
    {
      id: 'virar-professor',
      title: 'Ativar o seu perfil de professor',
      summary: 'Como aparecer na busca de professores.',
      keywords: ['professor', 'virar professor', 'perfil', 'ativar'],
      blocks: [
        p('No seu perfil há a opção "Sou professor(a)". Ao marcar, abrem-se os campos do professor: sobre as suas aulas, regiões de atuação e valor (opcional).'),
        steps(
          'Marque "Sou professor(a)" no seu perfil.',
          'Descreva as suas aulas: para quem são, como funcionam, o que a pessoa leva.',
          'Informe as regiões onde você atende.',
          'Complete o perfil público na área do professor: fotos, informações e conteúdo.',
        ),
        link('/perfil/editar', 'Ativar no meu perfil'),
        link('/aulas', 'Abrir o painel do professor'),
        tip('Perfil com foto e texto claro sobre "para quem é a aula" recebe mais contato do que perfil com preço e nada mais.'),
      ],
    },
    {
      id: 'agenda-professor',
      title: 'Agenda e calendário',
      summary: 'Onde as suas aulas vivem.',
      keywords: ['agenda', 'calendário', 'aula', 'horário'],
      blocks: [
        p('O painel do professor tem a AGENDA (o que vem a seguir) e o CALENDÁRIO (a visão do período). É por ali que você acompanha e organiza as aulas marcadas.'),
        link('/aulas', 'Minha agenda'),
        warn('Mantenha a agenda fiel à realidade: ela é o que o aluno vê ao tentar marcar.'),
      ],
    },
    {
      id: 'alunos',
      title: 'Alunos e evolução',
      summary: 'Acompanhar quem treina com você.',
      keywords: ['aluno', 'evolução', 'progresso', 'roster'],
      blocks: [
        p('A área de ALUNOS reúne quem treina com você. Os alunos ficam ligados à evolução deles na plataforma, então você acompanha o progresso sem pedir relatório a ninguém.'),
        tip('O nível validado por um professor vale como semente do rating do aluno — é uma forma de começar certo quem nunca competiu.'),
      ],
    },
    {
      id: 'pacotes-clinicas',
      title: 'Pacotes, clínicas e o lado comercial',
      summary: 'Como você empacota e cobra.',
      keywords: ['pacote', 'clínica', 'preço', 'comercial', 'loja'],
      blocks: [
        p('Além da aula avulsa, o painel tem:'),
        list(
          'PACOTES — conjuntos de aulas vendidos juntos.',
          'CLÍNICAS — eventos coletivos, com vagas.',
          'COMERCIAL — as condições do seu trabalho.',
          'LOJA — o que você vende junto com a aula.',
        ),
        tip('Pacote costuma resolver o maior problema do professor: a previsibilidade da agenda.'),
      ],
    },
    {
      id: 'parcerias',
      title: 'Parcerias com arenas e clubes',
      summary: 'Onde você dá aula.',
      keywords: ['parceria', 'arena', 'clube', 'parceiro'],
      blocks: [
        p('Você pode se vincular a arenas como professor parceiro — passando a aparecer na página delas — e a clubes.'),
        p('A arena também pode te convidar. O vínculo aparece nos dois lados.'),
        link('/coaches', 'Ver como apareço na busca'),
      ],
    },
  ],
};

/* ================================================= CONTA, DADOS E AJUDA == */

const CONTA = {
  id: HELP_SECTION.ACCOUNT,
  label: 'Conta e privacidade',
  tagline: 'Seus dados, suas escolhas — e onde mexer em cada uma.',
  audience: 'Todos',
  articles: [
    {
      id: 'privacidade',
      title: 'O que aparece de você, e o que não',
      summary: 'Você decide o que é público.',
      keywords: ['privacidade', 'dados', 'público', 'contato', 'lgpd', 'diretório'],
      blocks: [
        p('Nome de exibição, cidade e nível fazem você ser encontrado — é o que permite te convidarem para jogar. Já CONTATO é escolha sua.'),
        list(
          'E-mail, telefone e endereço só ficam visíveis se você marcar como públicos.',
          'Você pode sair do diretório de atletas a qualquer momento ("Aparecer no diretório").',
          'Data de nascimento serve para faixa etária em torneios; não vira informação pública.',
        ),
        link('/perfil/editar', 'Revisar minha privacidade'),
        tip('Trocar de ideia é normal: essas opções podem ser mudadas quantas vezes você quiser, e valem imediatamente.'),
      ],
    },
    {
      id: 'notificacoes',
      title: 'Notificações',
      summary: 'O que te avisa, e como diminuir.',
      keywords: ['notificação', 'aviso', 'sino', 'push', 'e-mail'],
      blocks: [
        p('O sino reúne o que aconteceu com você: convites, respostas de reserva, resultados, movimentação dos seus clubes.'),
        p('Em Configurações você escolhe o que quer receber. Se a plataforma estiver instalada como aplicativo no celular, também pode receber notificações push.'),
        link('/configuracoes', 'Ajustar minhas notificações'),
      ],
    },
    {
      id: 'documentos',
      title: 'Termos, privacidade e conduta',
      summary: 'Os documentos da plataforma.',
      keywords: ['termos', 'política', 'privacidade', 'conduta', 'legal', 'documento'],
      blocks: [
        p('Os documentos ficam na central legal, sempre acessível pelo rodapé da navegação: termos de uso, política de privacidade e as políticas específicas.'),
        p('A CONDUTA E FAIR PLAY não é documento jurídico — é o combinado de convivência da plataforma. Vale a leitura.'),
        link('/legal', 'Central de documentos'),
        link('/conduta', 'Conduta e fair play'),
      ],
    },
    {
      id: 'parceiros',
      title: 'Parceiros da plataforma',
      summary: 'Quem apoia o pickleball por aqui.',
      keywords: ['parceiro', 'patrocinador', 'apoio', 'marca'],
      blocks: [
        p('A área de Parceiros reúne as marcas e empresas parceiras da plataforma, com o que cada uma oferece à comunidade.'),
        link('/parceiros', 'Ver parceiros'),
      ],
    },
    {
      id: 'problemas',
      title: 'Quando algo não funciona',
      summary: 'O que checar antes de pedir ajuda.',
      keywords: ['problema', 'erro', 'suporte', 'não funciona', 'bug'],
      blocks: [
        p('A maior parte dos "não funciona" tem uma dessas causas:'),
        list(
          'Perfil incompleto — sem cidade ou nível, você não aparece em buscas e sorteios.',
          'Falta de permissão — algumas ações são só de quem criou o torneio, o dia de jogo ou a arena.',
          'Estado do item — torneio em rascunho não aparece publicamente; inscrição pendente não é inscrição confirmada.',
          'Página desatualizada — recarregue antes de concluir que quebrou.',
        ),
        p('Se o problema persistir, descreva o que você tentou fazer, em qual tela, e o que aconteceu. Isso resolve mais rápido do que "deu erro".'),
      ],
    },
  ],
};

/** Todas as seções, na ordem em que a página as apresenta. */
export const HELP_SECTIONS = Object.freeze([COMECAR, ATLETA, ARENA, PROFESSOR, CONTA]);

/* --------------------------------------------------------------- consultas */

/** Uma seção pelo id, ou `null`. */
export function getHelpSection(id) {
  return HELP_SECTIONS.find((s) => s.id === id) || null;
}

/** Um artigo pelo par (seção, artigo), ou `null`. */
export function getHelpArticle(sectionId, articleId) {
  const secao = getHelpSection(sectionId);
  if (!secao) return null;
  return secao.articles.find((a) => a.id === articleId) || null;
}

/** Todos os artigos, cada um sabendo de que seção veio. */
export function allHelpArticles() {
  return HELP_SECTIONS.flatMap((s) => s.articles.map((a) => ({
    ...a, sectionId: s.id, sectionLabel: s.label,
  })));
}

/** Texto pesquisável de um artigo (título, resumo, palavras-chave e corpo). */
function textoDoArtigo(artigo) {
  const blocos = (artigo.blocks || []).flatMap((b) => {
    if (b.type === 'steps' || b.type === 'list') return b.items;
    if (b.type === 'link') return [b.label];
    return [b.text];
  });
  return [artigo.title, artigo.summary, ...(artigo.keywords || []), ...blocos]
    .filter(Boolean).join(' ');
}

/** Normaliza para busca: minúsculas e SEM acento — ninguém digita acento. */
export function normalizeForSearch(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Busca nos artigos. Todos os termos precisam aparecer (E, não OU): quem digita
 * duas palavras está estreitando a busca, não ampliando.
 *
 * @param {string} termo
 * @param {{ sectionId?: string|null }} [opts] limita a uma seção
 * @returns {Array<object>} artigos, com `sectionId`/`sectionLabel`
 */
export function searchHelp(termo, opts = {}) {
  const base = opts.sectionId
    ? allHelpArticles().filter((a) => a.sectionId === opts.sectionId)
    : allHelpArticles();

  const termos = normalizeForSearch(termo).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return base;

  return base.filter((artigo) => {
    const alvo = normalizeForSearch(textoDoArtigo(artigo));
    return termos.every((t) => alvo.includes(t));
  });
}

/* ===================================================== AJUDA CONTEXTUAL == */

/**
 * De onde a pessoa VEIO → o que provavelmente ela quer saber.
 *
 * É a diferença entre uma central de ajuda útil e uma inútil. Sem isto, quem
 * travou na tela de sorteio precisa: achar o link de ajuda, adivinhar que o
 * assunto é "Atleta", e caçar o artigo no meio de dez. Quatro passos de
 * atrito no exato momento em que a pessoa já está irritada.
 *
 * O padrão aceita um asterisco como UM segmento de rota: o molde
 * "/torneios/(asterisco)/gerenciar" casa com "/torneios/abc123/gerenciar".
 * A ordem importa: vence o primeiro que casar, então o específico vem antes
 * do genérico.
 */
export const HELP_ROUTE_HINTS = Object.freeze([
  // --- torneio (do mais específico ao mais genérico) -----------------------
  { pattern: '/torneios/criar', label: 'criar um torneio',
    refs: [[HELP_SECTION.ATHLETE, 'organizar-torneio'], [HELP_SECTION.START, 'nivelamento']] },
  { pattern: '/torneios/*/gerenciar', label: 'gerenciar o torneio',
    refs: [[HELP_SECTION.ATHLETE, 'organizar-torneio'], [HELP_SECTION.ATHLETE, 'durante-torneio']] },
  { pattern: '/torneios/*/modalidades/*', label: 'a modalidade',
    refs: [[HELP_SECTION.ATHLETE, 'organizar-torneio'], [HELP_SECTION.ATHLETE, 'inscrever-torneio']] },
  { pattern: '/torneios/guia', label: 'os formatos de chave',
    refs: [[HELP_SECTION.ATHLETE, 'organizar-torneio']] },
  { pattern: '/torneios/*', label: 'este torneio',
    refs: [[HELP_SECTION.ATHLETE, 'inscrever-torneio'], [HELP_SECTION.ATHLETE, 'durante-torneio']] },
  { pattern: '/torneios', label: 'torneios',
    refs: [[HELP_SECTION.ATHLETE, 'inscrever-torneio'], [HELP_SECTION.ATHLETE, 'organizar-torneio']] },
  { pattern: '/circuits', label: 'circuitos',
    refs: [[HELP_SECTION.ATHLETE, 'circuitos']] },
  { pattern: '/meus-jogos', label: 'seus jogos',
    refs: [[HELP_SECTION.ATHLETE, 'ranking-evolucao'], [HELP_SECTION.ATHLETE, 'achar-jogo']] },

  // --- dia de jogo ---------------------------------------------------------
  { pattern: '/clubes/*/eventos/*', label: 'este dia de jogo do clube',
    refs: [[HELP_SECTION.ATHLETE, 'dia-de-jogo'], [HELP_SECTION.ATHLETE, 'organizar-dia-de-jogo'], [HELP_SECTION.ATHLETE, 'comunidade']] },
  { pattern: '/dia-de-jogo/*', label: 'este dia de jogo',
    refs: [[HELP_SECTION.ATHLETE, 'dia-de-jogo'], [HELP_SECTION.ATHLETE, 'organizar-dia-de-jogo']] },
  { pattern: '/dia-de-jogo', label: 'dia de jogo',
    refs: [[HELP_SECTION.ATHLETE, 'organizar-dia-de-jogo'], [HELP_SECTION.ATHLETE, 'dia-de-jogo']] },
  { pattern: '/procura-jogo', label: 'procura-se jogo',
    refs: [[HELP_SECTION.ATHLETE, 'achar-jogo']] },
  { pattern: '/encontrar-jogadores', label: 'encontrar jogadores',
    refs: [[HELP_SECTION.ATHLETE, 'achar-jogo']] },

  // --- ranking e evolução --------------------------------------------------
  { pattern: '/ranking/duplas', label: 'o ranking de duplas',
    refs: [[HELP_SECTION.ATHLETE, 'ranking-evolucao'], [HELP_SECTION.START, 'nivelamento']] },
  { pattern: '/ranking', label: 'o ranking',
    refs: [[HELP_SECTION.ATHLETE, 'ranking-evolucao'], [HELP_SECTION.START, 'nivelamento']] },
  { pattern: '/meu-desempenho', label: 'seu desempenho',
    refs: [[HELP_SECTION.ATHLETE, 'ranking-evolucao']] },
  { pattern: '/nivelamento', label: 'o nivelamento',
    refs: [[HELP_SECTION.START, 'nivelamento']] },

  // --- arena ---------------------------------------------------------------
  { pattern: '/arenas/criar', label: 'criar uma arena',
    refs: [[HELP_SECTION.ARENA, 'criar-arena']] },
  { pattern: '/arenas/*/onboarding', label: 'configurar a arena',
    refs: [[HELP_SECTION.ARENA, 'criar-arena'], [HELP_SECTION.ARENA, 'precos-regras']] },
  { pattern: '/arenas/*/gerir/pdv', label: 'o PDV',
    refs: [[HELP_SECTION.ARENA, 'loja-pdv']] },
  { pattern: '/arenas/*/gerir/modulos', label: 'os módulos da arena',
    refs: [[HELP_SECTION.ARENA, 'modulos-arena']] },
  { pattern: '/arenas/*/gerir/professores', label: 'professores parceiros',
    refs: [[HELP_SECTION.ARENA, 'equipe'], [HELP_SECTION.COACH, 'parcerias']] },
  { pattern: '/arenas/*/gerir', label: 'gerenciar a arena',
    refs: [[HELP_SECTION.ARENA, 'gerir-reservas'], [HELP_SECTION.ARENA, 'precos-regras'], [HELP_SECTION.ARENA, 'desempenho-arena']] },
  { pattern: '/minhas-reservas', label: 'suas reservas',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas']] },
  { pattern: '/arenas', label: 'arenas',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas'], [HELP_SECTION.ARENA, 'criar-arena']] },

  // --- professor -----------------------------------------------------------
  { pattern: '/aulas', label: 'o painel do professor',
    refs: [[HELP_SECTION.COACH, 'agenda-professor'], [HELP_SECTION.COACH, 'alunos'], [HELP_SECTION.COACH, 'pacotes-clinicas']] },
  { pattern: '/minhas-aulas', label: 'suas aulas',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas']] },
  { pattern: '/coaches/*', label: 'este professor',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas']] },
  { pattern: '/coaches', label: 'professores',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas'], [HELP_SECTION.COACH, 'virar-professor']] },

  // --- comunidade e conta --------------------------------------------------
  { pattern: '/clubes/*', label: 'este clube',
    refs: [[HELP_SECTION.ATHLETE, 'comunidade']] },
  { pattern: '/clubes', label: 'clubes',
    refs: [[HELP_SECTION.ATHLETE, 'comunidade']] },
  { pattern: '/novidades', label: 'as novidades da comunidade',
    refs: [[HELP_SECTION.ATHLETE, 'comunidade']] },
  { pattern: '/parceiros', label: 'os parceiros',
    refs: [[HELP_SECTION.ACCOUNT, 'parceiros']] },
  { pattern: '/buscar', label: 'a busca',
    refs: [[HELP_SECTION.START, 'buscar'], [HELP_SECTION.START, 'navegar']] },
  { pattern: '/regras', label: 'as regras do jogo',
    refs: [[HELP_SECTION.START, 'aprender-o-esporte']] },
  { pattern: '/conduta', label: 'o código de conduta',
    refs: [[HELP_SECTION.START, 'aprender-o-esporte'], [HELP_SECTION.ACCOUNT, 'documentos']] },
  { pattern: '/historia', label: 'a história do pickleball',
    refs: [[HELP_SECTION.START, 'aprender-o-esporte'], [HELP_SECTION.START, 'o-que-e']] },
  { pattern: '/chat', label: 'mensagens',
    refs: [[HELP_SECTION.ATHLETE, 'comunidade']] },
  { pattern: '/atletas', label: 'o diretório de atletas',
    refs: [[HELP_SECTION.ACCOUNT, 'privacidade']] },
  { pattern: '/perfil/editar', label: 'editar seu perfil',
    refs: [[HELP_SECTION.START, 'primeiros-passos'], [HELP_SECTION.ACCOUNT, 'privacidade'], [HELP_SECTION.COACH, 'virar-professor']] },
  { pattern: '/perfil', label: 'seu perfil',
    refs: [[HELP_SECTION.START, 'primeiros-passos'], [HELP_SECTION.ACCOUNT, 'privacidade']] },
  { pattern: '/configuracoes', label: 'configurações',
    refs: [[HELP_SECTION.ACCOUNT, 'notificacoes'], [HELP_SECTION.ACCOUNT, 'privacidade']] },
  { pattern: '/legal', label: 'os documentos',
    refs: [[HELP_SECTION.ACCOUNT, 'documentos']] },
]);

/** O padrão casa com o caminho? `*` vale por UM segmento. */
function casaRota(pattern, pathname) {
  const p = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  const alvo = p.split('/').filter(Boolean);
  const molde = pattern.split('/').filter(Boolean);
  if (molde.length > alvo.length) return false;
  return molde.every((seg, i) => seg === '*' || seg === alvo[i]);
}

/**
 * Artigos sugeridos para quem chegou de uma determinada tela.
 *
 * @param {string} pathname caminho de onde a pessoa veio
 * @returns {{ label: string, articles: Array<object> }|null} `null` quando a
 *   rota não tem pista — a tela então não mostra o bloco, em vez de mostrar
 *   uma sugestão qualquer. Sugestão errada é pior que nenhuma: ensina a
 *   pessoa a ignorar o bloco.
 */
export function helpForRoute(pathname) {
  if (!pathname) return null;
  const pista = HELP_ROUTE_HINTS.find((r) => casaRota(r.pattern, pathname));
  if (!pista) return null;

  const artigos = pista.refs
    .map(([s, a]) => {
      const artigo = getHelpArticle(s, a);
      if (!artigo) return null;
      const secao = getHelpSection(s);
      return { ...artigo, sectionId: s, sectionLabel: secao.label };
    })
    .filter(Boolean);

  return artigos.length > 0 ? { label: pista.label, articles: artigos } : null;
}

/* ============================================================ PERGUNTAS == */

/**
 * As perguntas que mais aparecem, na linguagem de quem pergunta.
 *
 * Ficam na tela inicial da central porque a maioria das dúvidas é a mesma —
 * e porque "buscar" pressupõe saber o nome da coisa. Quem não sabe o nome
 * precisa reconhecer a pergunta.
 */
export const HELP_FAQ = Object.freeze([
  { q: 'Como me inscrevo num torneio?', section: HELP_SECTION.ATHLETE, article: 'inscrever-torneio' },
  { q: 'Como organizo um dia de jogo?', section: HELP_SECTION.ATHLETE, article: 'organizar-dia-de-jogo' },
  { q: 'Como funciona a fila do Play?', section: HELP_SECTION.ATHLETE, article: 'dia-de-jogo' },
  { q: 'Por que meu ranking não mudou?', section: HELP_SECTION.ATHLETE, article: 'ranking-evolucao' },
  { q: 'Qual a diferença entre nível, rating e ranking?', section: HELP_SECTION.START, article: 'nivelamento' },
  { q: 'Quem vê meu telefone e meu e-mail?', section: HELP_SECTION.ACCOUNT, article: 'privacidade' },
  { q: 'Como publico minha arena?', section: HELP_SECTION.ARENA, article: 'criar-arena' },
  { q: 'Como apareço como professor?', section: HELP_SECTION.COACH, article: 'virar-professor' },
]);

/** As perguntas frequentes já resolvidas em artigos (ignora ref quebrada). */
export function faqArticles() {
  return HELP_FAQ
    .map((f) => {
      const artigo = getHelpArticle(f.section, f.article);
      if (!artigo) return null;
      return { ...artigo, question: f.q, sectionId: f.section, sectionLabel: getHelpSection(f.section).label };
    })
    .filter(Boolean);
}

/**
 * Quebra um texto nos trechos que casam com os termos buscados, para a tela
 * poder destacá-los. Devolve pedaços `{ text, match }` em ordem.
 *
 * Existe porque um resultado de busca sem destaque obriga a pessoa a reler o
 * artigo inteiro procurando por que ele apareceu.
 */
export function highlightParts(texto, termo) {
  const original = String(texto || '');
  const termos = normalizeForSearch(termo).split(/\s+/).filter(Boolean);
  if (termos.length === 0 || !original) return [{ text: original, match: false }];

  // Compara na versão normalizada mas RECORTA no original: é o que preserva
  // acento e maiúscula no texto mostrado.
  const normalizado = normalizeForSearch(original);
  const marcas = new Array(original.length).fill(false);
  termos.forEach((t) => {
    let de = normalizado.indexOf(t);
    while (de !== -1) {
      for (let i = de; i < de + t.length && i < marcas.length; i += 1) marcas[i] = true;
      de = normalizado.indexOf(t, de + t.length);
    }
  });

  const partes = [];
  let inicio = 0;
  for (let i = 1; i <= original.length; i += 1) {
    if (i === original.length || marcas[i] !== marcas[inicio]) {
      partes.push({ text: original.slice(inicio, i), match: marcas[inicio] });
      inicio = i;
    }
  }
  return partes;
}

/**
 * Um pedaço do CORPO do artigo em volta do primeiro termo encontrado.
 *
 * A busca procura no texto inteiro, então um artigo pode aparecer por causa de
 * uma frase no meio dele. Sem mostrar essa frase, o resultado parece
 * arbitrário — a pessoa abre, não acha, e desconfia da busca.
 *
 * @returns {string|null} `null` quando o casamento foi só no título/resumo,
 *   que a tela já mostra.
 */
export function searchSnippet(artigo, termo, janela = 150) {
  const termos = normalizeForSearch(termo).split(/\s+/).filter(Boolean);
  if (termos.length === 0 || !artigo) return null;

  const corpo = (artigo.blocks || []).flatMap((b) => {
    if (b.type === 'steps' || b.type === 'list') return b.items;
    if (b.type === 'link') return [];
    return [b.text];
  }).filter(Boolean);

  for (const texto of corpo) {
    const alvo = normalizeForSearch(texto);
    const pos = termos.map((t) => alvo.indexOf(t)).filter((i) => i >= 0);
    if (pos.length === 0) continue;

    const centro = Math.min(...pos);
    if (texto.length <= janela) return texto;
    const de = Math.max(0, centro - Math.floor(janela / 3));
    const ate = Math.min(texto.length, de + janela);
    return `${de > 0 ? '…' : ''}${texto.slice(de, ate).trim()}${ate < texto.length ? '…' : ''}`;
  }
  return null;
}

/**
 * O artigo seguinte DENTRO da mesma seção, ou o primeiro da próxima.
 *
 * Quem termina de ler raramente terminou de aprender. Sem isso, o fim do
 * artigo é um beco: só resta rolar de volta e procurar de novo.
 *
 * @returns {object|null} `null` no último artigo da última seção.
 */
export function nextHelpArticle(sectionId, articleId) {
  const todos = allHelpArticles();
  const i = todos.findIndex((a) => a.sectionId === sectionId && a.id === articleId);
  if (i < 0 || i + 1 >= todos.length) return null;
  return todos[i + 1];
}

/**
 * O endereço da central A PARTIR de uma tela — reexportado de `helpLink.js`.
 *
 * É o que faz o link de ajuda de qualquer canto chegar já sabendo do que se
 * trata. Sem isto, quem clica em "ajuda" na tela de sorteio cai numa página
 * genérica e recomeça a procura do zero.
 *
 * Mora noutro arquivo porque quem o chama é o LAYOUT, presente em toda tela:
 * importá-lo daqui arrastaria os 33 artigos para o chunk que todo mundo baixa.
 * Quem monta um link deve importar de `helpLink.js`.
 */
export { helpLinkFor } from './helpLink.js';
