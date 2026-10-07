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
 * ## Artigo de funcionalidade atrás de flag
 *
 * `flags: ['chave']` no artigo: ele só aparece na central quando QUALQUER uma
 * dessas flags está ligada (`helpCatalog`). Assim o texto nasce junto com a
 * funcionalidade e aparece sozinho no dia em que o admin a liga — sem mandar
 * ninguém, antes disso, para uma porta que não abre.
 *
 * ## "Mostre na tela" (dicas guiadas)
 *
 * `guias: ['id']` no artigo: com a flag `guided_tips`, o fim do artigo ganha
 * um botão que começa o GUIA daquele assunto na tela de verdade (`guias.js`) —
 * ler e depois fazer, sem procurar o botão sozinho. Só aparecem os guias
 * visíveis para a pessoa (flags e papel); há teste conferindo que cada id
 * existe no catálogo de guias.
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
      guias: ['conhecer-a-plataforma'],
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
      guias: ['completar-perfil'],
      blocks: [
        p('Crie a conta e preencha o perfil. Não é burocracia: quase tudo na plataforma usa esses dados para funcionar bem.'),
        steps(
          'Informe nome de exibição, cidade e estado — é como as outras pessoas te encontram.',
          'Diga o seu NÍVEL (ou faça o nivelamento). É o que faz os sorteios montarem jogos equilibrados.',
          'Diga a CATEGORIA em que você joga (masculina ou feminina). É o que monta as duplas mistas do dia de jogo e as categorias dos torneios.',
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
      guias: ['conhecer-a-plataforma'],
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
      id: 'dicas',
      flags: ['guided_tips'],
      title: 'Dicas: a plataforma mostra na tela, quando você pedir',
      summary: 'Guias que apontam o botão de verdade, e pontos que explicam cada tela.',
      keywords: ['dicas', 'dica', 'guia', 'tutorial', 'seta', 'como faço', 'ajuda na tela', 'passo a passo', 'como funciona'],
      guias: ['conhecer-a-plataforma'],
      blocks: [
        p('O botão DICAS, no topo de toda tela (a lâmpada), abre o painel das dicas. Nada aparece sozinho: as dicas surgem quando você pede — nunca no meio do que você está fazendo.'),
        steps(
          'Toque em "Dicas" e escreva o que você quer fazer ("reservar quadra", "criar torneio") — ou escolha um guia da lista, separada por assunto. Em "Nesta tela" ficam os guias do lugar onde você está.',
          'O guia leva você até a tela certa, escurece o resto e aponta com uma SETA o botão em que tocar.',
          'Faça o que o passo pede — tocar no botão, abrir o formulário — e o guia avança sozinho. "Voltar", "Próximo" e o X ficam no cartão; o Esc também sai.',
        ),
        p('Ligando "Dicas na tela", aparecem PONTOS pulsando ao lado dos botões de cada tela. Tocar num ponto explica aonde aquele botão leva e, quando há, oferece "Me mostre como". "Entendi" marca o ponto como visto: ele para de pulsar.'),
        tip('O botão "Como funciona" das ferramentas (torneio, dia de jogo) também vira um guia na tela. E, no fim dos artigos desta central, "Mostre na tela" começa o guia daquele assunto.'),
        p('A escolha é da sua conta e fica guardada neste aparelho — num tablet compartilhado, ninguém herda as dicas do outro. Para desligar, ligar de novo ou mostrar outra vez os pontos já vistos: Configurações, cartão "Dicas".'),
        link('/configuracoes', 'Ajustar as dicas'),
      ],
    },
    {
      id: 'inicio-personalizado',
      flags: ['personalized_home'],
      // Com o início sob medida, quem manda são os cards (o artigo seguinte):
      // aqui "Personalizar" muda os interesses, e lá abre o seletor dos cards.
      semFlags: ['home_cards'],
      title: 'A sua tela inicial',
      summary: 'Por que ela mostra o que mostra, e como mudar.',
      keywords: ['início', 'tela inicial', 'home', 'personalizar', 'interesses', 'atalhos', 'agenda', 'hoje'],
      blocks: [
        p('A tela inicial é montada para VOCÊ: o que aparece nela e em que ordem depende do que você faz na plataforma e do que disse que gosta.'),
        list(
          'O QUE VOCÊ FAZ vem primeiro — se você gere uma arena, dá aula ou organiza torneio, essas seções abrem a tela.',
          'O QUE VOCÊ JÁ USA vem junto — quem tem reserva, dia de jogo ou torneio marcado vê essa seção mesmo sem ter marcado o interesse.',
          'O QUE VOCÊ DISSE QUE GOSTA completa — são os interesses do seu perfil.',
        ),
        p('No topo ficam a sua agenda de hoje numa frase, os atalhos para o que você mais usa (criar dia de jogo, torneios abertos, a Central da sua arena com os pedidos esperando, o painel do professor…) e, mais abaixo, o seu último torneio, o ranking e as duplas.'),
        steps(
          'Toque em "Personalizar", no topo da tela inicial.',
          'Marque ou desmarque os assuntos que quer ver.',
          'Pronto: a tela muda na hora. Os seus interesses do perfil são atualizados juntos.',
        ),
        tip('A tela inicial NUNCA mostra coisa vencida: torneio encerrado, dia de jogo que já passou, inscrição com prazo esgotado, cupom vencido e horário que já passou ficam de fora. Seção sem nada atual some ou diz que não há nada.'),
        warn('Se uma parte não carregar (conexão), a seção diz que não carregou, com "Tentar de novo" — ela não afirma que você não tem nada.'),
        link('/perfil/editar', 'Revisar os meus interesses no perfil'),
      ],
    },
    {
      id: 'inicio-sob-medida',
      flagsTodas: ['personalized_home', 'home_cards'],
      title: 'A sua tela inicial: você escolhe os cards',
      summary: 'Ligue, desligue e ponha na ordem o que aparece no seu início.',
      keywords: ['início', 'tela inicial', 'home', 'personalizar', 'cards', 'cartões', 'ordem', 'esconder', 'mostrar', 'página inicial', 'enxuto', 'poluído', 'cheio'],
      guias: ['escolher-cards-do-inicio'],
      blocks: [
        p('A tela inicial mostra os CARDS que você escolher, na ordem que você quiser. De começo vêm três: DIAS DE JOGO, HORÁRIOS DA ARENA e RANKING. Qualquer um deles pode sair, e os outros podem entrar.'),
        steps(
          'Toque em "Personalizar", no topo da tela inicial — ou vá em Configurações, no cartão "Página inicial".',
          'Ligue ou desligue cada card no interruptor. O que você liga entra no fim da lista.',
          'Use as setas para subir ou descer um card. A tela muda na hora — não há o que salvar.',
        ),
        p('Para acrescentar há, entre outros: Sua agenda, Atalhos, Torneios, Seu último torneio, Aulas e professores, Seus clubes e Comunidade — e, para quem gere arena, dá aula ou organiza torneio, o card de cada uma dessas frentes. Promoções e destaques e Sua evolução aparecem quando essas funcionalidades estão ligadas na plataforma.'),
        tip('Em "Sugeridos para você" ficam os cards do que você FAZ na plataforma (a sua arena, as suas aulas, os torneios que organiza) e do que marcou nos interesses do perfil, com o motivo e um toque em "Adicionar". É sugestão: a tela não volta a se encher sozinha.'),
        p('O que tem PRAZO aparece sempre, fora dos cards — como a chamada da fila de um jogo aberto, que vence em 1 hora. Dá até para deixar o início só com o resumo do dia: desligue tudo. "Restaurar o padrão" volta aos três de começo.'),
        tip('A escolha é da SUA conta e fica guardada neste aparelho: num tablet compartilhado, cada pessoa vê o próprio início. Em outro aparelho, escolha de novo. Card escondido não carrega nada — o início fica mais leve.'),
        warn('Como sempre, o início nunca mostra coisa vencida, e uma parte que não carregar diz que não carregou, com "Tentar de novo" — ela não afirma que você não tem nada.'),
        link('/configuracoes', 'Escolher os cards do meu início'),
      ],
    },
    {
      id: 'nivelamento',
      title: 'Nível, rating e ranking: o que é cada coisa',
      summary: 'Três conceitos que parecem o mesmo e não são.',
      keywords: ['nível', 'rating', 'ranking', 'dupr', 'elo', 'nivelamento'],
      guias: ['completar-perfil', 'entender-ranking'],
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
      summary: 'Quatro caminhos diferentes para sair do sofá.',
      keywords: ['jogar', 'parceiro', 'procura-se jogo', 'encontrar jogadores', 'quadra', 'jogo aberto', 'participar', 'entrar', 'sair', 'clube', 'dia de jogo'],
      guias: ['encontrar-jogo', 'encontrar-jogadores'],
      blocks: [
        p('A plataforma tem quatro caminhos, e eles servem a situações diferentes:'),
        list(
          'ENCONTRAR JOGADORES — para achar gente do seu nível, perto de você. Bom quando você quer montar um jogo do zero.',
          'PROCURA-SE JOGO — mural de convites abertos. Alguém já marcou algo e está chamando; você pede para entrar.',
          'JOGOS ABERTOS NAS ARENAS — horário com vaga que uma arena publicou. Você entra direto, sem convite e sem precisar de dupla. Aparecem em "Procura-se jogo" e na página da arena.',
          'DIA DE JOGO — o evento organizado (treino de sábado, open play do clube, o dia que a arena marca no calendário). Você entra como participante.',
        ),
        p('Tocar em "Jogar" abre o DIA DE JOGO: os seus dias e, logo abaixo, "Com vaga para você". Ao lado ficam Procura-se jogo e Encontrar jogadores.'),
        p('Os dias de jogo dos próximos dias aparecem no "Jogar" do início, em "Procura-se jogo" e no Dia de jogo: os públicos (dos atletas e das arenas) e os dos CLUBES de que você é membro — esses são privados do clube, e só quem é do clube os vê. Cada um tem o botão de entrar ali mesmo: "Participar" (no dia da arena, "Marcar presença"; quando a arena inscreve por quadra, "Escolher a quadra"). O que você já marcou fica com "Você vai" e o botão de sair. O que já passou não aparece.'),
        p('No início só aparece o que você pode entrar: o jogo aberto fora da sua faixa de nível fica em "Procura-se jogo", com o motivo escrito.'),
        link('/dia-de-jogo', 'Ver os dias com vaga para você'),
        link('/procura-jogo', 'Ver jogos com vaga e convites'),
        link('/encontrar-jogadores', 'Encontrar jogadores'),
        link('/arenas', 'Procurar uma quadra'),
        tip('Quer jogar hoje? Toque em "Jogar": os dias com vaga estão logo ali, com o botão de entrar.'),
      ],
    },
    {
      id: 'minha-regiao',
      title: 'Ver o que acontece perto de você (Minha região)',
      summary: 'A sua cidade e um raio, o estado, outro lugar ou todo lugar.',
      keywords: ['região', 'regiao', 'cidade', 'perto', 'distância', 'distancia', 'raio', 'km', 'localização', 'viajar', 'outro estado', 'todo lugar'],
      flags: ['my_region'],
      blocks: [
        p('Dias de jogo, torneios, arenas, professores, clubes e promoções aparecem a partir da SUA região. O padrão é a cidade do seu perfil e as cidades a até 50 km.'),
        steps(
          'Toque no botão com o alfinete (ex.: "Porto Alegre + 50 km") em qualquer uma dessas telas — ou vá em Configurações → Minha região.',
          'Escolha: só a sua cidade, a cidade e as vizinhas (10, 25, 50, 100 ou 200 km), o estado inteiro, outro lugar ou todo lugar.',
          'Pronto: muda na hora, em toda a plataforma.',
        ),
        list(
          'OUTRO LUGAR — vai viajar? Digite a cidade (ou só escolha o estado). Também dá para usar a localização do aparelho: ela serve só para achar a cidade mais próxima, não é enviada nem guardada.',
          'TODO LUGAR — sem filtro, inclusive outros estados e países. O que está mais perto continua aparecendo primeiro.',
          'O QUE FICA DE FORA não some: cada tela diz quantos são ("3 em outras regiões") e deixa ver também, só naquela tela.',
          'BUSCAR PELO NOME (uma arena, um clube) procura em todo lugar — quem digita o nome quer achar onde ela estiver.',
        ),
        link('/configuracoes#minha-regiao', 'Escolher a minha região'),
        tip('A distância é medida entre as CIDADES. Sem cidade no perfil, a plataforma mostra tudo e pede a cidade — informe no seu perfil.'),
      ],
    },
    {
      id: 'gamificacao-jornada',
      title: 'Gamificação: o que é e onde fica cada coisa',
      summary: 'XP, missões, conquistas, temporada, avaliações e recompensas — tudo medido pelo que você joga de verdade, sem cobrança.',
      keywords: ['gamificação', 'gamificacao', 'xp', 'nível', 'nivel', 'missão', 'missao', 'conquista', 'hall da fama', 'temporada', 'desafio', 'recompensa', 'duelo', 'mentoria', 'avaliação', 'carta', 'reputação', 'revisão', 'como funciona', 'jornada'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-entender'],
      blocks: [
        p('A gamificação transforma o que você já faz — jogar, disputar torneios, avaliar parceiros — em XP, nível e conquistas. Nada aqui é cobrança: ninguém perde pontos por ficar uma semana sem jogar, e nada se compra com XP.'),
        p('A tela "Gamificação" tem cinco seções. Cada uma começa com um cartão "Como funciona" curto, e cada conceito tem um "?" ao lado do nome que explica em uma frase.'),
        list(
          'JORNADA — o seu tier, o nível, a sequência de semanas, os primeiros passos, a revisão da semana e as conquistas em destaque.',
          'MISSÕES — metas curtas por dia, semana e mês, cumpridas só de jogar.',
          'COMPETIR — a temporada do mês, o duelo da semana e os desafios abertos.',
          'SOCIAL — avaliações de jogos, cartas aos companheiros, reputação, e os vínculos (rivais, crews e mentorias).',
          'RECOMPENSAS — benefícios que a plataforma, arenas, professores e clubes oferecem a quem cumpre um critério.',
        ),
        link('/gamification', 'Abrir a Gamificação'),
        link('/gamification/como-funciona', 'O guia completo, com busca'),
        link('/conquistas', 'Minhas conquistas'),
        link('/hall-da-fama', 'Hall da Fama e temporada'),
        link('/gamification/configuracoes', 'Preferências e privacidade'),
        tip('Cada parte pode estar desligada pela plataforma. Se uma seção não aparece para você, é porque ela ainda não foi ativada — o seu XP e as suas conquistas continuam valendo.'),
        tip('Jogos combinados entre as mesmas pessoas para inflar números são marcados para revisão da plataforma — nunca punidos automaticamente.'),
      ],
    },
    {
      id: 'gamificacao-xp',
      title: 'XP, nível e tier: como a conta é feita',
      summary: 'De onde vem o seu XP, o que é nível, o que é tier e por que ele não é moeda.',
      keywords: ['xp', 'nível', 'nivel', 'tier', 'pontos', 'calouro', 'imortal', 'de onde vem', 'bônus', 'conta'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-entender'],
      blocks: [
        p('O XP não é um contador que você clica: ele é recalculado do zero a partir da sua atividade real. Por isso não dá para "ganhar de mentirinha" — e, se um resultado for corrigido, o seu XP acompanha.'),
        list(
          'JOGOS E TORNEIOS — cada jogo disputado e cada vitória somam; disputar um torneio soma, e o pódio e o título somam mais.',
          'CONQUISTAS — muitas dão um bônus de XP, uma vez só.',
          'MISSÕES e PRIMEIROS PASSOS — o bônus de quem cumpre todas as de um período, e o roteiro de quem chegou agora.',
          'PRÊMIOS DA PLATAFORMA — temporada, duelo e desafios. Quem concede é o servidor; o seu aparelho não consegue escrevê-los.',
        ),
        p('NÍVEL é o degrau dentro da sua faixa: cada nível pede um pouco mais de XP que o anterior, e a barra do hub mostra quanto falta. TIER é a faixa da jornada, do Calouro ao Imortal — é identidade, não prêmio.'),
        warn('O XP não é moeda: não se gasta nem se compra nada com ele. Ele mede a sua trajetória, e é por isso que pedir uma recompensa nunca diminui o seu XP.'),
        warn('Não confunda o nível da gamificação com o seu NÍVEL DE JOGO (2.0–8.0): aquele mede a sua habilidade e vem do nivelamento e dos resultados; o da gamificação mede a sua participação.'),
        tip('No hub, "De onde vem o meu XP" mostra a conta parcela por parcela. Não existe XP escondido.'),
        link('/gamification', 'Ver o meu XP'),
        link('/gamification/como-funciona', 'Os valores exatos, no guia'),
      ],
    },
    {
      id: 'gamificacao-missoes',
      title: 'Missões e primeiros passos',
      summary: 'Metas por dia, semana e mês — e o roteiro de quem acabou de chegar.',
      keywords: ['missão', 'missao', 'missões', 'diária', 'semanal', 'mensal', 'bônus', 'primeiros passos', 'roteiro', 'onboarding', 'resgatar'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-missoes'],
      blocks: [
        p('As missões são metas pequenas, medidas pelo que você joga: jogos, torneios, avaliações, reservas. Não existe botão de "marcar como feita" — o progresso anda sozinho.'),
        steps(
          'Abra a Gamificação e toque em "Missões".',
          'Escolha o período: hoje, esta semana ou este mês.',
          'Cumpriu todas as do período? Toque em "Resgatar +XP" para receber o bônus.',
        ),
        list(
          'O DIA vira à meia-noite (horário de Brasília), a SEMANA na segunda-feira e o MÊS no dia 1º.',
          'Missão não cumprida simplesmente expira. Não há punição nem dívida.',
          'O sorteio mistura os tipos e não sorteia missão de um recurso que esteja desligado.',
        ),
        p('Já os PRIMEIROS PASSOS são um roteiro curto para quem chegou agora — nível, foto, cadastro, ranking, atletas, clube, torneio e convite. A plataforma detecta sozinha o que você já fez. O roteiro some quando você conclui ou dispensa, e dá para trazê-lo de volta em Preferências.'),
        link('/gamification', 'Ver as minhas missões'),
        link('/gamification/configuracoes', 'Preferências (mostrar os primeiros passos de novo)'),
      ],
    },
    {
      id: 'gamificacao-sequencia',
      title: 'Sequência, folga automática e férias',
      summary: 'Semanas seguidas jogando: como se conta, o que perdoa uma semana parada e como pausar de propósito.',
      keywords: ['sequência', 'sequencia', 'streak', 'semanas', 'folga', 'férias', 'ferias', 'pausa', 'recorde', 'em risco', 'quebrou', 'viagem'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-sequencia'],
      blocks: [
        p('A sequência conta as semanas seguidas em que você jogou pelo menos uma vez — torneio, dia de jogo ou partida com resultado registrado. A semana vai de segunda a domingo, no horário de Brasília.'),
        list(
          'A SEMANA DE AGORA ainda está aberta: se você não jogou nela, nada se perde até domingo à meia-noite. Ela aparece como "em risco", não como quebrada.',
          'FOLGA AUTOMÁTICA — uma semana sem jogar por mês não quebra a sequência. Duas seguidas, ou duas no mesmo mês, quebram. Você não faz nada: é uma regra, não um saldo.',
          'FÉRIAS — vai viajar, se machucar ou descansar? Avise no cartão da sequência: até 4 semanas por vez não contam nem quebram, e só dá para tirar outras 90 dias depois.',
          'Semanas de folga e de férias não somam: "8 semanas" são oito semanas em que você realmente jogou.',
          'RECORDE — fica guardado. As conquistas de sequência usam o recorde; a tela e as recompensas usam a sequência de agora.',
        ),
        steps(
          'Abra a Gamificação → Jornada e ache o cartão "Sequência".',
          'Toque em "Avisar férias" e confirme em "Começar férias".',
          'Voltou antes? Toque em "Encerrar férias" no mesmo cartão.',
        ),
        warn('Quem para por muito tempo, sem férias, volta a zero — mas o recorde fica. Voltar a jogar já começa uma sequência nova.'),
        link('/gamification', 'Ver a minha sequência'),
      ],
    },
    {
      id: 'gamificacao-competir',
      title: 'Temporada, Hall da Fama, duelo e desafios',
      summary: 'As quatro formas de competir na gamificação e como cada uma é decidida.',
      keywords: ['temporada', 'hall da fama', 'duelo', 'desafio', 'ranking', 'placar', 'competir', 'prêmio', 'estado', 'posição', 'evento'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-competir', 'gamificacao-hall'],
      blocks: [
        list(
          'TEMPORADA — cada mês é uma temporada, disputada com o XP ganho NO mês: quem chegou agora também disputa. No fim do mês o servidor concede prêmios em XP pela colocação e pela participação.',
          'HALL DA FAMA — o placar público dos maiores XP de todos os tempos, com filtro por estado. Há um tier mínimo para aparecer.',
          'DUELO DA SEMANA — toda segunda-feira o servidor emparelha você com alguém de nível parecido. Vence quem somar mais vitórias até domingo. Recusar é um toque e não tem penalidade.',
          'DESAFIOS — competições com começo, fim e placar, criadas pela plataforma, por arenas, professores e clubes. Entrar é opcional; quem mede é o servidor.',
        ),
        steps(
          'Abra a Gamificação e toque em "Competir".',
          'Veja o banner da temporada, o seu duelo e os desafios abertos — com o que cada um mede, o prazo e o prêmio.',
          'Para o placar completo, abra o Hall da Fama.',
        ),
        warn('Aparecer para os outros, com nome e foto, depende da sua escolha em Preferências. Escondido, você continua ranqueando e recebendo os prêmios — só ninguém vê.'),
        tip('Enquanto um sinal grave de integridade está aberto, a conta fica fora do placar PÚBLICO até a equipe olhar — mas continua com a posição, o XP e os prêmios.'),
        link('/gamification', 'Competir'),
        link('/hall-da-fama', 'Hall da Fama e temporada'),
      ],
    },
    {
      id: 'gamificacao-social',
      title: 'Avaliações, cartas, reputação e vínculos',
      summary: 'Reconhecer quem jogou com você — com anonimato, controle de quem recebe e saída em um toque.',
      keywords: ['avaliação', 'avaliacao', 'avaliar', 'carta', 'reputação', 'reputacao', 'elogio', 'estrelas', 'kudos', 'rival', 'crew', 'mentoria', 'mentor', 'vínculos', 'vinculos', 'denunciar'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-social', 'gamificacao-vinculos'],
      blocks: [
        list(
          'AVALIAÇÃO — depois do jogo, estrelas e elogios (sem texto livre). Quem recebe vê só a média e os elogios mais citados, nunca quem deu qual nota.',
          'REPUTAÇÃO — a média que você recebeu; só fica pública depois de avaliações suficientes, para uma nota ruim isolada não definir ninguém.',
          'CARTA AO COMPANHEIRO — uma frase de gratidão ao parceiro de dupla. Anônima por padrão; quem recebe pode apagar ou denunciar.',
          'RIVAIS — de quem você mais enfrenta, com o placar entre vocês.',
          'CREWS — a sua turma fixa de dupla ou de quadra. Dá para sair quando quiser.',
          'MENTORIAS — um mentor acompanha aprendizes. O convite precisa ser ACEITO pela outra pessoa; enquanto isso, nada acontece.',
        ),
        steps(
          'Abra a Gamificação e toque em "Social".',
          'Em "Avalie seus jogos", escolha o jogo e dê a nota.',
          'Para rivais, crews e mentorias, abra "Vínculos".',
        ),
        warn('Só avalia quem jogou aquela partida, uma vez por pessoa. Trocas de nota por vingança ou favor são marcadas para a equipe revisar — nunca punidas automaticamente.'),
        tip('Não quer receber avaliações ou cartas? Desligue em Preferências. Cada um tem o seu interruptor, sem explicação.'),
        link('/gamification', 'Abrir a seção Social'),
        link('/vinculos', 'Rivais, crews e mentorias'),
      ],
    },
    {
      id: 'gamificacao-recompensas',
      title: 'Recompensas: como pedir e receber',
      summary: 'Benefícios reais liberados por marcos — não se compram com XP.',
      keywords: ['recompensa', 'recompensas', 'prêmio', 'brinde', 'benefício', 'código', 'resgatar', 'elegível', 'critério'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-recompensas'],
      blocks: [
        p('Uma recompensa é uma porta que se abre quando você cruza um marco: ser de um tier, ter uma conquista, estar entre os melhores da temporada, manter uma sequência ou ter jogado um número de partidas. O XP mostra a sua trajetória; ele não é moeda, então nada é "comprado".'),
        steps(
          'Abra a Gamificação e toque em "Recompensas".',
          'Cada recompensa mostra, critério por critério, o que você já cumpre e o que falta.',
          'Elegível? Toque em "Pedir esta recompensa" e guarde o seu código.',
          'Apresente o código a quem oferece (arena, professor, clube ou a plataforma). Ele confere e marca como usada.',
        ),
        warn('Nada é entregue sozinho: quem oferece confere e libera. A conferência usa os dados públicos de progressão da pessoa, nunca dados pessoais.'),
        link('/gamification', 'Ver as recompensas'),
      ],
    },
    {
      id: 'gamificacao-privacidade',
      title: 'Privacidade na gamificação',
      summary: 'O que os outros veem de você e como mudar — a regra vale no servidor, não só na tela.',
      keywords: ['privacidade', 'placar', 'hall', 'perfil', 'esconder', 'aparecer', 'ocultar', 'preferências', 'avisos', 'título', 'lgpd'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-privacidade'],
      blocks: [
        p('Você decide o que os outros veem. Cada interruptor responde na hora e vale no servidor: a temporada e o Hall já nascem sem quem pediu para ficar de fora.'),
        list(
          'APARECER NO PLACAR PÚBLICO — nome e foto na temporada e no Hall da Fama. Desligado, você continua ranqueando e recebendo os prêmios, mas ninguém vê.',
          'MOSTRAR TIER E CONQUISTAS NO PERFIL — desligado, a página de conquistas públicas fica indisponível para quem abrir o seu perfil.',
          'DUELOS, AVALIAÇÕES E CARTAS — cada um tem o seu interruptor.',
          'AVISOS — resumo da semana, duelo e resultado de desafios: o que você desligar, não chega.',
          'COMO APARECE PARA MIM — as comemorações dos marcos e o título ao lado do seu nome (o tier ou uma conquista que você escolher).',
        ),
        link('/gamification/configuracoes', 'Abrir as preferências'),
        tip('Há também um tier mínimo para aparecer no placar público, definido pela plataforma. Abaixo dele, você ranqueia e recebe prêmios, mas não aparece.'),
      ],
    },
    {
      id: 'gamificacao-clube',
      title: 'Engajamento do seu clube (gamificação)',
      summary: 'Para quem administra um clube: atividade, metas, desafios e recompensas para os membros.',
      keywords: ['clube', 'atividade', 'engajamento', 'membros', 'desafio', 'recompensa', 'meta', 'administrar', 'gamificação'],
      flags: ['gamification_v2'],
      blocks: [
        p('Quem administra um clube vê a aba "Atividade" na página do clube. Ela mostra a vida do clube pelo que foi publicado — partidas dos dias de jogo, membros que jogaram, membros novos — e é visível só para quem administra.'),
        list(
          'METAS DO MÊS — números que você escolhe, com o progresso medido pelos registros (partidas publicadas, membros novos), não por marcação manual.',
          'DESAFIOS — competições entre os membros, com métrica, prazo e prêmio em XP. O servidor mede e premia.',
          'RECOMPENSAS — benefícios para membros que cruzam um marco. Você confere o código e marca como usado.',
        ),
        link('/clubes', 'Abrir os meus clubes'),
        tip('As abas Desafios e Recompensas só aparecem se a plataforma deixou o módulo ligado.'),
      ],
    },
    {
      id: 'jogo-aberto-arena',
      title: 'Entrar num jogo aberto de uma arena',
      summary: 'Horário com vaga, sem precisar montar o grupo.',
      keywords: ['jogo aberto', 'open match', 'vaga', 'fila de espera', 'arena', 'parceiro', 'dia de jogo', 'formato', 'quem vai'],
      blocks: [
        p('Algumas arenas publicam horários com vagas — o "jogo aberto". Você entra sozinho, e a arena junta quem entrou. Não precisa levar dupla.'),
        steps(
          'Na página da arena, veja "Jogos abertos": os que cabem no seu nível vêm primeiro.',
          'Toque em "Quero jogar". Pronto: você está no jogo, e ele aparece em "Minhas reservas" e em "Dia de jogo".',
          'Não vai mais? Toque em "Sair deste jogo" — a vaga volta para quem está esperando.',
        ),
        p('Cada jogo aberto é também um DIA DE JOGO. Em "Ver o jogo: regras e quem vai" você vê o formato (Americano, Play, Mexicano…), como as partidas saem, se há placar, as quadras e a lista de quem vai — e, na hora, as partidas e o ranking do dia.'),
        p('O jogo diz a faixa de nível e o seu nível, lado a lado. Fora da faixa, o botão avisa e não deixa entrar. Se a plataforma ainda não sabe o seu nível, você pode entrar.'),
        p('Jogo lotado vira FILA DE ESPERA: entre na fila e, quando alguém sair, a vaga é oferecida a você — com um prazo para confirmar, e o horário-limite aparece na própria chamada. A chamada aparece na página da arena e em "Minhas reservas".'),
        link('/procura-jogo', 'Ver jogos abertos em todas as arenas'),
        link('/minhas-reservas', 'Meus jogos e filas'),
        tip('Sem jogo pronto? Na mesma seção da arena há "veja quem joga aqui no seu nível", para combinar um jogo com alguém que frequenta o lugar.'),
        warn('Chamado da fila e não vai poder? Toque em "Não vou poder": a vaga passa na hora para o próximo, em vez de ficar presa até o prazo acabar.'),
      ],
    },
    {
      id: 'ranking-da-casa',
      title: 'O ranking da casa de uma arena',
      summary: 'Jogos abertos e torneios da casa somando pontos, por temporada.',
      keywords: ['ranking da casa', 'ranking', 'classificação', 'pontos', 'temporada', 'arena', 'torneio da casa', 'jogo aberto', 'ladder'],
      blocks: [
        p('Arenas com o ranking da casa ligado somam, numa classificação só, o que acontece nas quadras delas: os JOGOS ABERTOS com placar (e os demais dias de jogo da arena) e os TORNEIOS DA CASA — os torneios da plataforma sediados ali.'),
        steps(
          'Na página da arena, toque em "Ver o ranking" (em "Ranking da casa").',
          'Escolha a temporada (o ano) e, se quiser, a modalidade: Americano, Mexicano, Rei da Quadra… ou só os torneios.',
          'A sua linha aparece destacada, e a sua posição fica no topo quando você está fora do pódio.',
        ),
        list(
          'Cada jogo aberto dá pontos pela colocação no ranking do dia: 1º 100, 2º 70, 3º 50, 4º 35, e 10 para quem jogou.',
          'Cada categoria de torneio da casa vale o dobro: 1º 200, 2º 140, 3º 100, 4º 70, e 20 para quem jogou.',
          'Empate em pontos: vale quem tem mais títulos, depois mais vitórias, depois quem somou em menos eventos.',
        ),
        p('O ranking se monta sozinho, a cada resultado lançado — ninguém precisa clicar em nada. Torneio conta quando termina (a colocação só existe no fim). O Play não tem placar, então não pontua.'),
        tip('Em "De onde vêm os pontos" estão a tabela, cada jogo e torneio que entrou e o que ainda não entrou, com o motivo.'),
      ],
    },
    {
      id: 'loja-arena',
      title: 'Pedir na loja de uma arena',
      summary: 'Água, grip, aluguel de raquete: peça pelo app e retire no balcão.',
      keywords: ['loja', 'pedido', 'comprar', 'produto', 'dividir a conta', 'pix', 'arena'],
      blocks: [
        p('Arenas com a loja ligada mostram "Loja" na página delas. Você pede pelo aplicativo e a arena é avisada na hora — é só retirar no balcão, sem fila.'),
        steps(
          'Na página da arena, toque em "Fazer um pedido" (ou "Abrir a loja").',
          'Coloque os produtos no pedido e toque em "Fazer o pedido".',
          'Retire no balcão. O pedido aparece como "Entregue" quando a arena entregar.',
        ),
        list(
          'PAGAR — se a arena tem Pix, a chave aparece nas suas compras daquela loja. Quem confirma o recebimento é a arena.',
          'DIVIDIR A CONTA — se a arena permitir, busque quem divide com você. Cada um recebe um aviso e registra a própria parte.',
          'DESISTIR — enquanto não foi entregue, toque em "Desistir" no pedido. Conta dividida se cancela no balcão, porque alguém pode já ter pago.',
        ),
        link('/minhas-reservas', 'Minhas compras (em Minhas reservas)'),
        tip('Seus pedidos de todas as arenas, e as contas divididas com você, ficam em "Minhas reservas → Compras nas arenas".'),
        warn('Vale o preço da arena no momento do pedido. Se ela mudou o preço depois que você abriu a loja, o pedido sai com o preço novo.'),
      ],
    },
    {
      id: 'vantagens-arena',
      title: 'Promoções, indicação e pontos numa arena',
      summary: 'Descontos divulgados, "indique e ganhe" e o que conta como fidelidade.',
      keywords: ['promoção', 'cupom', 'desconto', 'código', 'copiar', 'indicação', 'indique e ganhe', 'fui indicado', 'vale', 'pontos', 'fidelidade', 'pesquisa', 'nps', 'banner', 'tela inicial', 'cidade', 'região'],
      blocks: [
        p('Arenas com o marketing ligado podem ter vantagens para quem joga lá. Tudo aparece na própria página da arena:'),
        list(
          'PROMOÇÕES — descontos e vales que a arena divulgou, cada um num tíquete com a regra em uma linha (valor mínimo, prazo, uma vez por pessoa). TOQUE NO CÓDIGO para copiar. O desconto aparece no pedido de reserva com um toque para aplicar (ou cole o código); o VALE (uma bebida, uma aula, um brinde) você mostra na recepção.',
          'INDIQUE E GANHE — toque em "Quero meu código" e mande para um amigo; o cartão mostra as regras da arena (quanto cada lado ganha). Quem você indicar digita o seu código no campo "Foi indicado por alguém?" ao pedir a primeira reserva, e a arena credita quando confirmar. Todos os seus códigos ficam no seu Perfil, em "Meus códigos de indicação".',
          'PONTOS — para quem é membro da arena, cada reserva concluída soma pontos, que a recepção troca por crédito. Seus pontos ficam em "Você nesta arena".',
          'PESQUISA — depois de jogar, a arena pode perguntar de 0 a 10 o quanto você a recomendaria. A nota vai no toque; o comentário é opcional.',
        ),
        steps(
          'Abra a página da arena e veja "Promoções" e "Indique e ganhe".',
          'Na reserva, toque na promoção (ou digite o código) antes de enviar o pedido.',
          'O desconto aparece no valor estimado. Ele é conferido de novo quando a arena confirma.',
        ),
        link('/arenas', 'Procurar uma arena'),
        tip('Na TELA INICIAL, "Promoções" mostra as promoções que as arenas da SUA CIDADE escolheram divulgar ali. Pelo seletor ao lado você troca para o seu estado, para outra cidade (se vai viajar) ou para o Brasil todo; a escolha fica guardada. A cidade vem do seu perfil — sem ela, a tela pede que você escolha.'),
        tip('O código de indicação é seu naquela arena: cada arena tem o próprio. Ele não é criado só porque você abriu a página — só quando você pede.'),
        tip('Foi indicado? O campo "Foi indicado por alguém?" aparece no pedido de reserva quando a arena tem o programa ligado (e, se ele vale só para quem nunca reservou ali, na sua primeira reserva). A arena confere o código ao confirmar — se não valer, a reserva mostra o motivo.'),
        warn('O cupom só é contado como usado quando a arena CONFIRMA a reserva. Pedido recusado não gasta o seu cupom.'),
      ],
    },
    {
      id: 'promocoes-plataforma-professores',
      flags: ['platform_marketing', 'coach_marketing'],
      title: 'Promoções da plataforma e dos professores',
      summary: 'Onde achar os cupons, como usar na aula e quando o desconto vale.',
      keywords: ['promoção', 'promoções', 'cupom', 'código', 'desconto', 'professor', 'aula', 'plataforma', 'campanha', 'vale', 'aula experimental', 'copiar'],
      blocks: [
        p('Além das arenas, a própria plataforma e os professores podem lançar cupons e campanhas. Tudo o que está valendo agora fica em "Promoções" — e, se for da sua região, também na tela inicial.'),
        list(
          'DESCONTO NA AULA — o professor dá um percentual ou um valor na aula. Você usa ao pedir a aula.',
          'AULA EXPERIMENTAL — uma aula por conta do professor. Também entra no pedido de aula.',
          'VALES — clínica, brinde, equipamento, evento. Mostre o código ao professor (ou à equipe da plataforma) na hora: eles registram o uso.',
        ),
        steps(
          'Abra "Promoções" (ou a seção Promoções no perfil do professor). TOQUE NO CÓDIGO para copiar.',
          'Para aula: toque em "Usar ao pedir a aula" — o pedido já abre com o cupom. No pedido, os cupons do professor também aparecem para tocar.',
          'O pedido mostra a estimativa com o desconto. O desconto é conferido e aplicado quando o professor CONFIRMA a aula; o valor final aparece na aula, em "Minhas aulas".',
        ),
        tip('Alguns cupons de professor são "só para alunos" — você os vê se já for aluno dele. Se o cupom não valer (venceu, esgotou, você já usou, é só para alunos), a tela diz o motivo antes de você enviar.'),
        tip('Aula recorrente: o cupom vale para UMA aula (a primeira da série), porque ele conta um uso só.'),
        warn('A aula foi cancelada ou recusada depois de o cupom ser aplicado? O uso volta para você, e dá para usar o cupom de novo noutro pedido.'),
        link('/promocoes', 'Ver as promoções'),
        link('/minhas-aulas', 'Minhas aulas'),
      ],
    },
    {
      id: 'planos-arena',
      title: 'Pacote de horas, saldo e mensalidade numa arena',
      summary: 'Comprar horas adiantado, onde conferir o que você tem, e quando é abatido.',
      keywords: ['pacote', 'horas', 'plano', 'membro', 'saldo', 'carteira', 'mensalidade', 'nível', 'desconto'],
      blocks: [
        p('Arenas com o programa de membros ligado mostram "Planos e vantagens" na página delas, logo depois dos preços. Ali você vê o seu nível, as horas de pacote que restam, o saldo e a mensalidade.'),
        steps(
          'Na página da arena, em "Planos e vantagens", toque em "Quero este pacote".',
          'A arena recebe o pedido. Quando ela receber o pagamento, as horas entram na sua carteira daquela arena.',
          'Nas próximas reservas, as horas são abatidas sozinhas do valor — você vê o abatimento no pedido.',
        ),
        list(
          'ONDE CONFERIR — "Minhas reservas → Planos e saldo nas arenas" junta o que você tem em cada arena, e quando o primeiro pacote vence.',
          'QUAL PACOTE SAI PRIMEIRO — o que vence antes. Assim nenhum pacote expira com horas sobrando enquanto outro é gasto.',
          'SALDO — crédito na carteira da arena (de indicação, por exemplo) também é abatido da reserva, depois das horas e dos descontos.',
        ),
        link('/minhas-reservas', 'Meus planos e saldo'),
        warn('As horas só saem da carteira quando a arena CONFIRMA a reserva. Pedido recusado não gasta nada.'),
      ],
    },
    {
      id: 'dia-de-jogo',
      title: 'Participar de um dia de jogo',
      summary: 'Como funciona do lado de quem joga.',
      keywords: ['dia de jogo', 'play', 'americano', 'fila', 'participar', 'simples', 'duplas'],
      guias: ['encontrar-jogo'],
      blocks: [
        p('Dia de jogo é o evento de um dia: o treino, o open play, o americano do clube. Quem organiza cria; você entra como participante.'),
        p('O que você faz depende do formato:'),
        list(
          'PLAY — há uma FILA (ordem de participação). Você entra nela, joga, e volta para o fim. A tela mostra a sua posição e quem entra a seguir.',
          'AMERICANO — a grade de jogos é sorteada de uma vez. Você vê as suas partidas e os resultados.',
          'AMERICANO APRIMORADO — como o Play (fila, partida a partida), mas com placar e ranking do dia.',
        ),
        p('Em qualquer um deles você pode ficar indisponível por algumas partidas (para descansar) e pedir dupla fixa com alguém. Quem organiza aplica.'),
        p('Os jogos podem ser de DUPLAS ou de SIMPLES (um contra um) — quem organiza escolhe, quadra a quadra ou no sorteio. Quando o dia tem os dois, são dois rankings do dia, separados, e cada resultado publicado vai para o rating certo: simples para o de simples, duplas para o de duplas.'),
        link('/dia-de-jogo', 'Ver dias de jogo'),
        tip('Há um TELÃO por dia de jogo, feito para a TV da quadra: mostra quem está jogando, quem entra depois e o ranking do dia.'),
      ],
    },
    {
      id: 'organizar-dia-de-jogo',
      title: 'Organizar o seu próprio dia de jogo',
      summary: 'Você não precisa ser clube nem arena para organizar.',
      keywords: ['organizar', 'criar dia de jogo', 'formato', 'quadras', 'simples', 'duplas', 'um contra um'],
      guias: ['criar-dia-de-jogo'],
      blocks: [
        p('Qualquer atleta cria um dia de jogo. Escolha o formato, o número de quadras, a data e quem pode organizar as partidas (só você e quem você nomear, ou qualquer inscrito).'),
        p('Americano e Play estão sempre na lista. Americano aprimorado, Mexicano e Rei da Quadra são formatos opcionais: aparecem quando a plataforma os oferece. Um dia de jogo já criado num deles continua funcionando normalmente, mesmo que o formato deixe de ser oferecido.'),
        p('Cada formato tem um tutorial completo dentro da própria tela — o botão "Como funciona" explica passo a passo, sempre que você quiser.'),
        list(
          'SIMPLES OU DUPLAS — no Play e no Americano aprimorado, cada quadra tem "Duplas | Simples": na de simples entram os dois primeiros da fila. No Americano, o tipo se escolhe no sorteio. A partida criada à mão também pode ser dos dois tipos.',
          'RANKING DO DIA — com jogo simples e em duplas no mesmo dia, são duas tabelas, independentes. Uma vitória no simples não soma nas duplas.',
          'NA PUBLICAÇÃO — o simples vai para o rating de simples; as duplas, para o rating e o ranking de duplas.',
        ),
        link('/dia-de-jogo', 'Criar um dia de jogo'),
        tip('Se o seu grupo varia (gente chegando e saindo), use Play ou Americano aprimorado. Se é o mesmo grupo do começo ao fim, o Americano é mais simples.'),
      ],
    },
    {
      id: 'play-grupos',
      title: 'Dividir o Play em grupos',
      summary: 'Grupos por nível ou por tipo de dupla, cada um com a sua fila.',
      keywords: [
        'grupos', 'play', 'nível', 'turma', 'mista', 'mesmo sexo', 'fila', 'iniciante',
        'convidado', 'avulso', 'revezar', 'prioridade',
      ],
      flags: ['play_groups'],
      guias: ['play-grupos'],
      blocks: [
        p('No Play comum há uma fila só: entra quem espera há mais tempo. Com GRUPOS, o dia ganha uma fila por grupo e as partidas saem DENTRO de cada um — iniciantes jogam com iniciantes, as mistas ficam entre si. Quem está sem grupo segue numa fila própria, como sempre foi.'),
        list(
          'POR NÍVEL — o grupo tem uma faixa (por exemplo, de 2.0 a 3.5) e só recebe quem está nela. A régua é a mesma de todos os sorteios da plataforma, de 2.0 a 8.0.',
          'POR TIPO DE DUPLA — "mista" monta uma dupla com um homem e uma mulher de cada lado; "mesmo sexo" monta duplas só de homens ou só de mulheres.',
          'DIFERENÇA MÁXIMA — limita a distância de nível entre quem joga a mesma partida, mesmo dentro da faixa.',
          'EXIGIR OU PREFERIR — "exigir" faz o grupo esperar até haver uma partida que cumpra as regras; sem exigir, ele tenta cumpri-las e, se não der, joga assim mesmo, para a quadra não ficar parada por uma preferência.',
          'QUADRAS DO GRUPO — o grupo pode jogar só em certas quadras (a quadra 1 para o avançado, por exemplo).',
          'COMPLETAR COM QUEM ESTÁ SEM GRUPO — quando faltar gente no grupo, ele chama quem não tem grupo, sem tirar ninguém dos outros.',
          'ENTRADA — o grupo pode ser fechado: só a organização coloca gente nele.',
        ),
        steps(
          'No dia de jogo (formato Play), abra o cartão Grupos e escolha um modelo, ou crie do zero.',
          'Toque em "Distribuir por nível": a prévia mostra onde cada pessoa cairia, e nada muda até você confirmar.',
          'Ao inserir um CONVIDADO sem conta, informe o nível e o sexo dele — é o que o coloca no grupo certo.',
          'Numa quadra livre, deixe em "Automático" ou mande um grupo específico para ela.',
        ),
        p('Quando mais de um grupo está pronto para a mesma quadra, a POLÍTICA decide: por tempo de espera (o grupo cujo primeiro da fila espera há mais), revezando os grupos em círculo, ou por prioridade (a ordem da lista).'),
        p('Um grupo sem partida pronta diz o porquê no próprio cartão: falta gente, falta alguém do sexo que a formação pede, o nível não combina, está em pausa. Ninguém precisa adivinhar.'),
        p('A dupla vinculada só vale entre pessoas do MESMO grupo. A tela avisa quando o parceiro está em outro, e mover um dos dois leva o outro junto.'),
        list(
          'PARA QUEM JOGA — você vê o seu grupo, a sua posição NA FILA DELE e pode trocar de grupo, entre os que estão abertos.',
          'NO TELÃO — a partida em quadra mostra o selo do grupo, a previsão diz de que grupo é cada quadra e a fila se divide por grupo.',
        ),
        link('/dia-de-jogo', 'Abrir um dia de jogo'),
        tip('Quem cria o dia monta e edita os grupos; quem conduz as partidas (inclusive administradores nomeados) move as pessoas entre eles.'),
        warn('Com a funcionalidade desligada pela plataforma, os grupos gravados no dia são ignorados e o Play volta a ter uma fila só — nada se perde: ligando de novo, eles voltam.'),
      ],
    },
    {
      id: 'inscrever-torneio',
      title: 'Se inscrever num torneio',
      summary: 'Do achar ao check-in no dia.',
      keywords: ['torneio', 'inscrição', 'inscrever', 'modalidade', 'dupla'],
      guias: ['inscrever-em-torneio'],
      blocks: [
        p('Torneios públicos aparecem na busca. Torneios privados exigem link ou código de acesso.'),
        steps(
          'Abra o torneio e veja as MODALIDADES — cada uma é uma disputa (por exemplo, "Dupla Masculina B").',
          'Escolha a modalidade compatível com o seu gênero, faixa etária e nível.',
          'Se for de duplas, informe o parceiro. Ele não precisa ter conta para ser inscrito, mas sem conta não pontua no ranking.',
          'Confirme. Sua inscrição entra como pendente até quem organiza confirmar o pagamento.',
          'No dia, se o torneio usar, faça o CHECK-IN: ele é opcional e só confirma que você chegou — com ou sem check-in, a inscrição confirmada joga e entra no sorteio.',
        ),
        p('O botão "Fazer check-in" aparece na modalidade quando o torneio começa, para quem FEZ a inscrição. Se foi a sua dupla ou a organização que inscreveu você, o check-in é com ela ou na mesa da organização.'),
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
      guias: ['criar-torneio', 'tutorial:torneio'],
      blocks: [
        p('Qualquer pessoa cria um torneio. O caminho é sempre: criar → modalidades → inscrições → sorteio → resultados. O encerramento é automático quando o último resultado entra.'),
        p('Há um tutorial completo dentro do console de gestão, com os sete passos detalhados — sempre à mão no botão "Como funciona".'),
        p('Se o número de inscritos não bateu com o formato ideal — grupos de tamanhos diferentes, chave que não fecha, alguém que precisa entrar mais à frente — veja "Quando o número de inscritos não é o ideal".'),
        link('/torneios/criar', 'Criar um torneio'),
        link('/torneios/guia', 'Guia dos formatos de chave'),
        tip('Não sabe qual modelo de chave usar? O Guia de formatos explica cada um e quantos participantes cada um pede.'),
      ],
    },
    {
      id: 'dois-turnos',
      title: 'Dois turnos (ida e volta)',
      summary: 'Cada confronto duas vezes, com os lados trocados no returno.',
      keywords: ['turno', 'turnos', 'returno', 'ida e volta', 'dois turnos', '2 turnos', 'pontos corridos', 'grupos', 'americano'],
      blocks: [
        p('Em pontos corridos, fase de grupos e Americano, cada fase pode ter 1 ou 2 TURNOS. Com 2, tudo o que acontece no 1º turno se repete no returno, com os lados trocados — o dobro de jogos para cada um.'),
        steps(
          'No console do torneio, abra Modalidades e edite (ou crie) a modalidade.',
          'No cartão da fase, em "Turnos", escolha "2 turnos (ida e volta)".',
          'Salve. O sorteio já sai com os dois turnos, e a explicação da fase mostra quantos jogos dá.',
        ),
        list(
          'PONTOS CORRIDOS E GRUPOS — cada um enfrenta cada outro duas vezes. É a saída para o grupo de 3, que no 1 turno daria só 2 jogos por atleta.',
          'AMERICANO — cada dupla joga junta duas vezes, e você enfrenta cada outro jogador 4 vezes no total.',
          'Vale também numa modalidade com VÁRIAS fases: cada fase tem o seu.',
        ),
        tip('Mudou de ideia depois de sortear? Trocar os turnos vale para o próximo sorteio — re-sortear apaga os jogos da fase, e a tela avisa antes.'),
      ],
    },
    {
      id: 'americano-etapas',
      title: 'Americano aprimorado em etapas',
      summary: 'Grupos refeitos a cada etapa e uma classificação só, somando tudo.',
      keywords: ['americano', 'etapas', 'etapa', 'grupos misturados', 'mistura', 'rotação', 'classificação única', 'americano aprimorado'],
      flags: ['tournament_americano_etapas'],
      blocks: [
        p('Um formato de fase para inscrição INDIVIDUAL. Os atletas jogam em etapas; em cada etapa, um Americano em grupos — num grupo de 4, cada um forma dupla com cada outro uma vez: 3 jogos. Terminada a etapa, os grupos são REFEITOS, misturando quem ainda não se encontrou, e a etapa seguinte começa.'),
        p('A classificação é UMA só, somando o que cada um fez em todas as etapas. O campeão é quem teve o melhor desempenho no total.'),
        list(
          'EXEMPLO — 8 atletas, grupos de 4, 3 etapas: 2 grupos por etapa, 3 jogos por etapa, 9 jogos para cada um. Na etapa 2, cada grupo leva dois de cada grupo da etapa 1; na etapa 3, quem seguiu junto encontra os dois que ainda faltavam — e todos terminam tendo jogado com e contra todos.',
          'A MISTURA — a plataforma escolhe os grupos de cada etapa para criar o máximo de jogos inéditos. Repetição sempre chega (8 atletas se esgotam rápido), mas ela é a menor possível e espalhada.',
          'QUANTAS ETAPAS — você escolhe, de 1 a 12, e pode mudar no meio: a próxima etapa só é gerada quando a anterior termina.',
          'TAMANHO DOS GRUPOS — 4, 5, 8 ou 9 (os tamanhos que fecham um Americano). Quando os inscritos não dividem certo, saem grupos vizinhos (9 = 5 + 4) e a mistura reveza quem fica no grupo maior.',
          'DOIS TURNOS — em cada etapa, cada dupla pode jogar junta duas vezes.',
        ),
        steps(
          'Em Modalidades, crie a modalidade com inscrição Simples (individual).',
          'Na fase, escolha "Americano aprimorado em etapas", o número de etapas e os atletas por grupo. A explicação ao lado mostra quantos jogos dá e a previsão de encontros inéditos.',
          'Na aba de sorteio, sorteie: sai a etapa 1.',
          'Quando os jogos da etapa terminarem, toque em "Gerar etapa 2 de 3". Repita até a última.',
        ),
        tip('Quer uma fase depois (semifinal e final com os melhores)? Adicione uma fase de chave: ela só é gerada depois da última etapa, com os primeiros da classificação geral.'),
      ],
    },
    {
      id: 'inscritos-numero-incomum',
      title: 'Quando o número de inscritos não é o ideal',
      summary: 'Grupos de tamanhos diferentes, repescagem, byes e quem entra direto.',
      keywords: [
        'inscritos', 'ímpar', 'grupos desiguais', 'repescagem', 'bye',
        'entrada direta', 'desempate', 'chave incompleta', 'qualificatória',
      ],
      blocks: [
        p('Chegaram 19 inscritos? Isso é o caso NORMAL de torneio amador, não um erro a corrigir. O que um número "quebrado" exige não é um inscrito a mais — é a regra de comparação certa.'),
        p('Na aba de sorteio, a plataforma mostra as divisões possíveis para o número REAL de inscritos, com quantos jogos cada uma dá, quantos jogos por atleta e se a chave fecha. Grupo de 4 ou 5 costuma ser o melhor tamanho; grupo de 3 pede ida e volta, senão são só 2 jogos para quem viajou até lá.'),
        list(
          'GRUPOS DE TAMANHOS DIFERENTES — comparados por COLOCAÇÃO primeiro (todos os 1ºs, depois os 2ºs) e, dentro dela, por APROVEITAMENTO: 3 vitórias em 3 jogos valem mais que 3 em 4.',
          'REPESCAGEM — se faltam classificados para fechar a chave, ela chama os melhores da colocação seguinte ao corte. Um 4º nunca entra na frente de um 3º: a comparação é sempre entre iguais.',
          'BYES — numa chave que não é potência de 2, quem passa direto na primeira rodada são os melhores cabeças, e são exatamente as vagas que faltam. Não existe "partida" de ninguém contra ninguém.',
          'ENTRADA DIRETA — os N melhores cabeças (ou uma lista escolhida a dedo) podem pular as primeiras fases e entrar mais à frente. É o modelo de qualificatória: os favoritos esperam, os demais disputam as vagas.',
        ),
        p('O desempate dentro do grupo segue o regulamento: vitórias, CONFRONTO DIRETO, saldo, saldo no confronto direto, pontos a favor e pontos sofridos. Empate de três ou mais é resolvido numa mini-tabela só entre os empatados.'),
        p('E nada disso é obrigatório: em cada fase, o bloco "Regras avançadas" deixa você trocar a ordem dos critérios, o método de comparação entre grupos, quantos passam em cada grupo e de qual colocação sai a repescagem.'),
        link('/torneios/guia', 'Guia dos formatos de chave'),
        tip('Quem organiza não precisa decorar nada disso: cada controle tem a explicação ao lado, e a fase mostra na tela de sorteio quais regras estão em vigor.'),
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
      guias: ['entender-ranking'],
      blocks: [
        p('Os resultados que contam vêm de duas fontes, e elas têm gatilhos diferentes: em TORNEIO público, cada placar lançado já conta — não é preciso esperar o torneio encerrar; em DIA DE JOGO, contam quando quem organiza PUBLICA os resultados no ranking.'),
        p('Fica de fora o que não é resultado de verdade: torneio em rascunho, cancelado, privado ou arquivado. E como a conta é sempre refeita por inteiro, cancelar ou arquivar TIRA do ranking o que já tinha contado.'),
        warn('Só contam partidas em que TODOS os atletas têm conta na plataforma. Se alguém foi inscrito ou inserido só pelo nome, a partida fica fora do ranking para TODOS da partida — inclusive para você. Quem organiza resolve: no dia de jogo, em "Resultados no ranking" → "Vincular a uma conta"; no torneio, no lápis da inscrição. Os jogos já lançados passam a contar sozinhos.'),
        p('Em MEU DESEMPENHO aparecem TODOS os seus jogos, contem ou não no ranking — e, quando algum não conta, o motivo, com o dia de jogo para abrir.'),
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
      guias: ['entrar-num-clube', 'criar-clube'],
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
      guias: ['reservar-quadra', 'minhas-reservas', 'encontrar-professor'],
      blocks: [
        p('Em Arenas você encontra quadras por cidade, vê preços e horários, e pede a reserva. A arena responde confirmando ou recusando — você acompanha em "Minhas reservas".'),
        p('Em Aulas você encontra professores, vê o perfil, os pacotes e a agenda, e marca. Suas aulas ficam em "Minhas aulas".'),
        p('Se a arena tem agenda de aulas, as próximas aparecem na própria página dela, em "Aulas e professores" — dá para se matricular ali mesmo. As matrículas de todas as arenas também ficam em "Minhas aulas".'),
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
      id: 'gamificacao-engajamento-arena',
      title: 'Engajamento dos seus clientes (gamificação)',
      summary: 'Saúde da arena, metas, desafios e recompensas para quem joga aí.',
      keywords: ['gamificação', 'gamificacao', 'engajamento', 'clientes', 'desafio', 'recompensa', 'meta', 'saúde', 'fidelizar', 'prêmio', 'código'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-oferecer-arena', 'gamificacao-recompensa-arena'],
      blocks: [
        p('Na Central da arena, em Desempenho → Engajamento, você acompanha a saúde da arena, define metas e oferece desafios e recompensas a quem joga aí. Tudo nasce do que acontece nas suas quadras — nada é digitado à mão.'),
        list(
          'SAÚDE — uma nota de 0 a 100 que só você vê, com o número que motivou cada dimensão e sugestões com motivo concreto. Uma arena nova não tem "nota zero em satisfação": tem satisfação ainda não medida.',
          'METAS DO MÊS — números que você escolhe (jogos, jogadores novos…); o progresso sai das reservas reais e a meta recomeça todo mês.',
          'DESAFIOS — competições com métrica, prazo e prêmio em XP. O servidor mede e credita; você não calcula nada.',
          'RECOMPENSAS — um benefício (hora de quadra, bebida, desconto) para quem cumpre critérios. Quem se qualifica pede e recebe um código; você confere e marca como usado.',
        ),
        steps(
          'Abra a Central da arena → Desempenho → Engajamento.',
          'Em "Desafios", toque em "Novo desafio": dê um nome, escolha o que medir, as datas e os prêmios.',
          'Em "Recompensas", toque em "Nova recompensa" e defina o critério e a quantidade.',
          'Quando alguém pedir, use Liberar, Marcar como usada ou Recusar na lista de pedidos.',
        ),
        warn('Fonte que não carregou aparece como "não deu para medir", nunca como zero — e o desafio publicado não pode mais ser editado, só cancelado.'),
        tip('Cada módulo (saúde, desafios, recompensas) pode estar desligado pela plataforma; a aba mostra só o que está ligado.'),
      ],
    },
    {
      id: 'criar-arena',
      title: 'Publicar a sua arena',
      summary: 'O mínimo para aparecer e começar a receber pedidos.',
      keywords: ['criar arena', 'cadastrar', 'publicar', 'onboarding'],
      guias: ['cadastrar-arena'],
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
      guias: ['responder-reservas'],
      blocks: [
        p('Pedidos de reserva chegam em SOLICITAÇÕES. Você confirma ou recusa, e quem pediu é avisado. O contador no menu mostra quantos estão aguardando.'),
        list(
          'SOLICITAÇÕES — a fila de pedidos aguardando resposta.',
          'CALENDÁRIO — a visão de ocupação das quadras.',
          'RESERVAS (ADMIN) — criar e ajustar reservas você mesmo, inclusive para quem ligou por telefone.',
          'CLIENTES — quem já reservou na sua arena.',
        ),
        tip('No topo da Central, "Precisa de você" junta o que está esperando a arena agir — reservas para confirmar, pedidos do app para entregar, faltas para marcar e mensalidades em atraso. Toque num item para ir direto à aba que resolve.'),
        warn('Pedido sem resposta trava o horário na cabeça do cliente e não trava na sua agenda. Responder rápido é o que evita conflito de horário.'),
      ],
    },
    {
      id: 'precos-regras',
      title: 'Estrutura, preços e regras',
      summary: 'Quadras, faixas de preço e as condições da casa.',
      keywords: ['preço', 'quadra', 'regras', 'horário', 'valor'],
      guias: ['configurar-quadras'],
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
      title: 'Mercado e loja do app (vender na arena)',
      summary: 'Um cadastro de produto, dois jeitos de vender: no balcão e pelo aplicativo.',
      keywords: ['loja', 'pdv', 'venda', 'produto', 'estoque', 'mercado', 'pedido', 'app', 'balcão'],
      blocks: [
        p('A arena pode vender o que quiser: bolinhas, bebidas, aluguel de raquete. Tudo nasce num lugar só — o MERCADO (em "Pagamentos e loja"): produtos, compras (entradas), vendas (saídas), estoque e financeiro. O catálogo padrão já traz itens comuns, e você ajusta.'),
        p('Com o módulo Loja (PDV) ligado, o atleta também pode PEDIR PELO APLICATIVO e retirar no balcão:'),
        steps(
          'No Mercado, edite o produto e marque "Vender pelo app". Ele entra na loja com o preço de venda que já está lá — não precisa cadastrar de novo.',
          'O atleta pede pela página da arena. Você recebe um aviso na hora.',
          'Em "Pagamentos e loja → Pedidos do app" está o balcão: o que falta entregar, quem pagou, quem ainda deve a parte da conta.',
          'Ao entregar, toque em "Entreguei": a venda vira uma saída do Mercado, com o nome de quem comprou, e o estoque baixa.',
        ),
        list(
          'PAGAMENTO — o atleta paga por Pix (com a chave da arena, se o módulo Pix estiver ligado) ou no balcão. Quem confirma que recebeu é você: "Confirmar recebimento" ou "Recebi no balcão".',
          'CONTA DIVIDIDA — cada pessoa registra a própria parte. O pedido só aparece como pago quando TODAS as partes estiverem pagas.',
          'CANCELAR — o que já saiu do estoque volta, e quem pediu é avisado com o motivo.',
          'ESTOQUE — a aba Estoque abre em "À venda": só o que você tem para vender agora. Esgotados, vencidos, produtos ainda sem compra registrada e inativos ficam nos filtros ao lado, com a contagem — nada some, só sai da frente.',
          'NA LOJA DO APP — esgotado e vencido saem da vitrine sozinhos. Quem chega por uma campanha de um produto esgotado é avisado de que ele acabou por enquanto.',
        ),
        tip('Produto sem nenhuma compra (entrada) registrada é vendido pelo app sem limite de estoque — serve para serviços, como aluguel de raquete. Registre uma compra e o app passa a respeitar o estoque.'),
        tip('Puxou itens do catálogo e ainda não comprou? Eles aparecem em "Sem compra registrada", não como esgotados — e não disparam alerta de reposição. O alerta é só do que você já comprou alguma vez.'),
        warn('O valor do pedido é o da tabela do Mercado na hora do pedido. Se um pedido chegar com valor que não bate com a tabela de hoje, a tela de pedidos avisa — confira antes de entregar.'),
      ],
    },
    {
      id: 'marketing-arena',
      title: 'Marketing: promoções, campanhas, satisfação e indicação',
      summary: 'Trazer gente, trazer de volta e saber o que acharam — dentro da gestão.',
      keywords: ['marketing', 'cupom', 'promoção', 'campanha', 'mensagem', 'nps', 'satisfação', 'indicação', 'fidelidade', 'vale', 'hora grátis', 'bebida', 'controle de uso', 'custo', 'banner', 'tela inicial', 'arte', 'modelo', 'tíquete', 'copiar'],
      blocks: [
        p('Com o módulo Marketing ligado, a gestão da arena ganha a seção MARKETING, com uma aba para cada ferramenta que você ligar em Configurações → Módulos:'),
        list(
          'CUPONS — comece escolhendo o que o cupom DÁ. Desconto e hora grátis entram sozinhos no preço da reserva. Aula particular, aula em grupo, clínica, comida, bebida, brinde, aluguel de equipamento e inscrição em evento são VALES: a pessoa mostra o código na recepção e você toca em "Registrar uso". Cada cupom tem mínimo, limite de usos, prazo e "uma vez por pessoa"; marque "Divulgar na página da arena" para ele virar PROMOÇÃO — e, logo abaixo, "Também como banner na tela inicial" para ele aparecer na tela inicial de quem é da SUA CIDADE.',
          'ARTE DO CUPOM — cada cupom é um TÍQUETE, com o código no canhoto (toque nele para copiar — na lista também, para mandar a alguém). Escolha um dos cinco modelos (Clássico, Neon, Quadra, Festa, Sol), personalize textos e cores, ou envie a sua imagem: 1200 × 600 px (2:1), mínimo 800 × 400, sem o código escrito nela — a plataforma põe o código ao lado. "Salvar como meu modelo" guarda o desenho para os próximos cupons; os cinco da plataforma nunca mudam.',
          'CONTROLE DE USO (dentro de Cupons) — usos, custo e receita de cada cupom e de cada tipo. Custo é o desconto dado, os vales entregues (usos × o custo que você informa, que só a arena vê) e os créditos de indicação; receita é o que pagaram as reservas que usaram o cupom.',
          'CAMPANHAS — um BANNER (na página da arena e, se quiser, na tela inicial) que leva a um lugar da plataforma, e/ou um aviso no aplicativo para um público (membros, sumidos, frequentes, todo mundo). A tela diz para quantas pessoas vai o aviso ANTES de enviar, e não envia para público vazio. Veja "Banners de campanha".',
          'SATISFAÇÃO — a nota de 0 a 10 que os atletas dão depois de jogar, com os COMENTÁRIOS, que é onde está o que fazer.',
          'INDICAÇÕES — defina as REGRAS do programa: quanto ganha quem indica, quanto ganha quem chega, se vale só para quem nunca reservou aqui e o limite por pessoa. O atleta pega o código na página da arena, que já mostra essas regras. Quando alguém chegar dizendo que foi indicado, registre aqui: os valores vêm das regras e são conferidos.',
        ),
        steps(
          'Configurações → Módulos: ligue Marketing e as ferramentas que for usar.',
          'Abra a seção Marketing da gestão. Cada ferramenta ligada é uma aba.',
          'Crie uma promoção e marque "Divulgar na página da arena" para ela chegar a quem procura horário.',
        ),
        tip('Desligue o cupom em vez de apagar: apagar leva junto a contagem de usos, e aí ninguém responde mais "quanto essa promoção rendeu?".'),
        tip('Na arte, título e texto em branco usam o benefício e a descrição do próprio cupom. Assim, se você mudar o desconto depois, o tíquete acompanha sozinho.'),
        tip('Vale sem custo informado aparece com "Informar" no controle de uso — e o custo total fica marcado como incompleto, nunca como zero.'),
        warn('O desconto é conferido de novo pelo sistema quando o pedido é gravado, e o uso só é contado na CONFIRMAÇÃO. Um cupom desligado depois do pedido não vale mais.'),
      ],
    },
    {
      id: 'banners-campanha',
      title: 'Banners de campanha: criar, enviar a sua arte e para onde levar',
      summary: 'Um banner que leva a pessoa direto à reserva, ao torneio, ao produto — feito aqui ou enviado pronto.',
      keywords: ['banner', 'campanha', 'modelo', 'arte', 'imagem', 'tamanho', 'destaque', 'link', 'divulgar', 'tela inicial', 'upload'],
      blocks: [
        p('Em Marketing → Campanhas, "Nova campanha" monta o banner em cinco passos: o nome, para onde ele leva, o desenho, onde aparece e até quando, e (se quiser) um aviso no aplicativo.'),
        list(
          'PARA ONDE LEVA — a página da campanha, reservar quadra, jogos abertos, um dia de jogo, um torneio, um produto da loja, planos e membros, aulas, promoções ou o ranking da casa. Só aparecem os destinos dos módulos que a arena ligou. Nenhum link é digitado: o banner inteiro é clicável e leva ao lugar certo.',
          'CRIAR NA PLATAFORMA — comece por um dos cinco modelos (Destaque, Oferta, Evento, Vitrine e Chamado), troque os textos e as cores e veja como fica no computador e no celular. "Usar a cor da arena" aplica a sua marca. Quando a cor do texto some no fundo, a tela avisa.',
          'MEUS MODELOS — "Salvar como meu modelo" guarda o desenho para a próxima campanha. Os cinco modelos da plataforma nunca mudam: editar um deles e salvar cria um modelo SEU, ao lado deles.',
          'ENVIAR A SUA IMAGEM — a tela mostra a especificação antes de você escolher: 1600 × 800 px (proporção 2:1), no mínimo 1200 × 600, JPG, PNG ou WebP, até 2 MB (máximo 5 MB). Texto e logo dentro da ÁREA SEGURA (os 80% centrais da largura e 70% da altura), porque no celular as laterais são cortadas. Não desenhe botão: o banner já é clicável.',
          'ONDE APARECE — "Na página da arena" põe o banner no topo, em Em destaque. "Também na tela inicial" põe no carrossel de quem é da cidade ou do estado da arena. O banner sai sozinho na data que você escolher (até 120 dias).',
        ),
        steps(
          'Configurações → Módulos: ligue Marketing e Campanhas.',
          'Marketing → Campanhas → Nova campanha.',
          'Escolha o destino, depois o modelo (ou envie a imagem), e confira a pré-visualização.',
          'Marque onde o banner aparece e até quando. O aviso no aplicativo é opcional.',
          'Publicar campanha: a confirmação resume onde aparece, para onde leva e para quantas pessoas vai o aviso.',
        ),
        tip('Na lista, "Ver como o atleta vê" abre o destino; "Pausar" tira o banner do ar sem apagar nada, e "Voltar ao ar" traz de volta. "Editar o banner" troca desenho, destino e data — o aviso já enviado não é reenviado.'),
        warn('A imagem enviada precisa de uma DESCRIÇÃO: é o que o leitor de tela lê e o que aparece se a imagem não carregar. Tudo o que estiver escrito na imagem precisa estar na descrição.'),
      ],
    },
    {
      id: 'operacao-arena',
      title: 'Operação: a rotina do dia, manutenção e estoque',
      summary: 'O que está pendente hoje, numa olhada — e o conserto que fecha a quadra.',
      keywords: ['operação', 'rotina', 'checklist', 'abertura', 'fechamento', 'manutenção', 'estoque', 'plantão', 'equipamento'],
      blocks: [
        p('Com o módulo de operação ligado, a gestão ganha a seção OPERAÇÃO. Cada ferramenta liga separadamente, em Configurações → Módulos:'),
        list(
          'HOJE — o resumo do dia: itens de rotina pendentes, ordens de manutenção abertas, produto acabando e quem está de plantão. Cada número leva à aba que resolve.',
          'ROTINAS — abertura e fechamento escritos uma vez e cumpridos todo dia. Cada dia recomeça, e os últimos 30 ficam guardados como prova do que foi feito.',
          'MANUTENÇÃO — o conserto vira ordem com prazo. Se marcar "fechar a quadra", o horário sai da venda no calendário; concluir ou cancelar devolve na hora.',
          'EQUIPAMENTOS — com o módulo de equipamentos, o cadastro do que existe na arena (totem, luz, sensor) e onde fica.',
        ),
        p('O plantão (quem trabalha na arena, com função e turno) fica em Equipe e parceiros → Plantão.'),
        tip('Abra "Hoje" de manhã: se está tudo em dia, a tela diz isso numa linha, sem cartões para conferir.'),
        warn('Quem vai jogar vê o horário fechado como "Manutenção programada", sem o motivo. O motivo da ordem fica só com a arena.'),
      ],
    },
    {
      id: 'presenca-arena',
      title: 'Presença e totem de chegada',
      summary: 'Quem chegou, quem não veio — sem ninguém no balcão.',
      keywords: ['presença', 'chegada', 'check-in', 'totem', 'qr', 'falta', 'no-show'],
      blocks: [
        p('Com o totem ligado, a gestão ganha a aba PRESENÇA, em Reservas. Ali estão as reservas do dia, quem chegou e quem não veio.'),
        steps(
          'Em Reservas → Presença, toque em "Abrir o totem" num tablet da recepção.',
          'O atleta aponta a câmera para o QR do totem. Com um único horário marcado, a chegada é confirmada sozinha.',
          'Quem chegou sem o celular: na lista do dia, toque em "Chegou".',
          'Depois que a janela do horário fecha, a tela oferece marcar as faltas do dia de uma vez.',
        ),
        tip('A taxa de falta é calculada sobre o que já foi decidido no dia — às 9h da manhã ela não conta como falta o jogo das 20h.'),
        warn('A falta só é afirmada depois que a janela fecha (o horário mais 30 minutos). Antes disso, a pessoa pode estar estacionando.'),
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
          'PLANTÃO — com o módulo de operação, a lista de quem trabalha na arena: nome, função e turno. Não pede telefone nem e-mail — serve para saber quem estava aqui quando algo aconteceu.',
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
          'INTELIGÊNCIA — com o módulo ligado, a leitura dos últimos 30 dias: média, previsão da semana e preço sugerido por horário. É sugestão: nada muda de preço sozinho.',
          'REDE — com o módulo de multi-unidade, a rede de unidades que você administra. O atleta passa a ver as outras unidades na página da arena.',
        ),
        tip('Olhar o resumo semanal é o hábito que mais rende: dá para ver o horário ocioso antes que ele vire prejuízo do mês.'),
      ],
    },
    {
      id: 'modulos-arena',
      title: 'Módulos: ligar só o que você usa',
      summary: 'A arena não precisa de tudo ligado.',
      keywords: ['módulos', 'ativar', 'funcionalidades', 'open match', 'marketing'],
      guias: ['ligar-modulos'],
      blocks: [
        p('A gestão da arena é modular. Você liga só os módulos que fazem sentido para a sua operação — e a tela fica só com o que você usa.'),
        list(
          'Jogo aberto — vira a seção JOGO ABERTO da gestão: você publica horário com vaga, vê quem vem e quem está na fila. Cada jogo aberto é um DIA DE JOGO (você escolhe o formato, as quadras e quem conduz), e "Organizar o jogo" leva ao sorteio, ao placar e ao telão. A página da arena ganha "Jogos abertos", com o botão de entrar ali mesmo, e os jogos aparecem também em "Procura-se jogo".',
          'Membros — sua base de alunos/mensalistas. Ligado, vira a seção MEMBROS da gestão.',
          'Aulas — a agenda de aulas na sua estrutura. Ligado, vira a seção AULAS da gestão (agenda + professores), e a página da arena ganha "Aulas e professores".',
          'Ranking da casa — soma os jogos abertos com placar e os torneios da casa numa classificação por temporada, sozinho, a cada resultado. Ligado, a seção TORNEIOS da gestão ganha a aba RANKING DA CASA, e a página da arena ganha a chamada para ele. Os torneios da casa são os torneios da PLATAFORMA sediados aqui — crie com "Criar torneio aqui"; o antigo torneio interno saiu (o jogo aberto faz o que ele fazia).',
          'Loja (PDV) — o atleta pede pelo app os produtos do Mercado marcados "Vender pelo app". Ligado, vira a aba PEDIDOS DO APP em "Pagamentos e loja", e a página da arena ganha "Loja".',
          'Marketing — vira a seção MARKETING da gestão (cupons, campanhas, satisfação e indicações). Cupom marcado "Divulgar na página da arena" vira promoção na página e no pedido de reserva, e o atleta pega o código de indicação ali mesmo.',
          'Operação — vira a seção OPERAÇÃO da gestão: o resumo de hoje, rotinas, manutenção (que pode fechar a quadra) e o alerta de estoque. O plantão fica em Equipe e parceiros.',
          'Totem de chegada — vira a aba PRESENÇA, em Reservas: quem chegou, quem não veio e as faltas marcadas de uma vez. Na página da arena, o atleta vê "Chegou?" na hora do jogo.',
          'Marca, rede e inteligência — Marca fica em Perfil (a cor e o logo vão para a página da arena); Rede e Inteligência ficam em Desempenho. A antiga página "Avançado" não existe mais.',
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
      id: 'gamificacao-engajamento-professor',
      title: 'Engajamento dos seus alunos (gamificação)',
      summary: 'Saúde da sua base, metas e desafios e recompensas só para os seus alunos.',
      keywords: ['gamificação', 'gamificacao', 'engajamento', 'alunos', 'desafio', 'recompensa', 'meta', 'saúde', 'fidelizar'],
      flags: ['gamification_v2'],
      guias: ['gamificacao-oferecer-professor'],
      blocks: [
        p('No Painel do professor, a seção "Engajamento" mostra a saúde da sua base (alunos ativos, aulas no mês), as metas que você define e os desafios e recompensas que você oferece aos seus alunos.'),
        list(
          'SAÚDE — uma nota que só você vê, com o que ajuda e o que atrapalha. Para o professor, ela olha a agenda, os alunos que voltam e as avaliações.',
          'METAS DO MÊS — números a alcançar (aulas dadas, alunos novos…), medidos pelos seus registros.',
          'DESAFIOS e RECOMPENSAS — só para os seus alunos. O servidor mede os desafios; nas recompensas, o aluno pede, recebe um código e você confere.',
        ),
        steps(
          'Abra o Painel do professor e toque em "Engajamento".',
          'Em "Resumo", veja a saúde e ajuste as metas do mês.',
          'Em "Desafios" ou "Recompensas", toque em "Novo desafio" / "Nova recompensa".',
        ),
        tip('Os números vêm das suas aulas e alunos reais. Quando uma fonte não carrega, a tela diz "não deu para medir" — nunca mostra zero no lugar.'),
        link('/aulas', 'Abrir o painel de aulas (aba Engajamento)'),
      ],
    },
    {
      id: 'virar-professor',
      title: 'Ativar o seu perfil de professor',
      summary: 'Como aparecer na busca de professores.',
      keywords: ['professor', 'virar professor', 'perfil', 'ativar'],
      guias: ['virar-professor'],
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
      guias: ['disponibilidade-professor'],
      blocks: [
        p('O painel do professor tem a AGENDA (o que vem a seguir) e o CALENDÁRIO (a visão do período). É por ali que você acompanha e organiza as aulas marcadas.'),
        p('Dá aula na agenda de uma arena? Quando a arena vincula o cadastro de professor à sua conta, as aulas dela aparecem na sua agenda — e, abrindo a aula, você vê os alunos matriculados.'),
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
      id: 'divulgacao-professor',
      flags: ['coach_marketing'],
      title: 'Cupons e campanhas do professor',
      summary: 'Criar cupom, divulgar com banner, avisar os alunos e medir o uso.',
      keywords: ['divulgação', 'cupom', 'campanha', 'banner', 'promoção', 'desconto', 'aula experimental', 'alunos', 'aviso', 'controle de uso', 'vale'],
      blocks: [
        p('No painel do professor, a seção DIVULGAÇÃO tem as mesmas ferramentas das arenas: cupons (com a arte de tíquete e o código para copiar), campanhas com banner e o controle de uso.'),
        steps(
          'Abra o painel do professor → Divulgação → Cupons e crie um cupom: desconto na aula, aula experimental ou um vale (clínica, brinde, equipamento…).',
          'Escolha a arte (cinco modelos, os seus modelos ou uma imagem sua), o prazo, o limite de usos e se vale uma vez por pessoa.',
          'Decida onde ele aparece: no seu perfil, na vitrine de Promoções e, se quiser, na tela inicial (Brasil todo, um estado ou uma cidade). Marque "só para os meus alunos" se for exclusivo.',
          'Em Campanhas, publique um banner e/ou um aviso no aplicativo. O público são os seus alunos, CONTADOS antes de enviar; o banner pode levar a "Marcar aula", às suas clínicas, à loja ou ao seu perfil.',
        ),
        p('O desconto na aula entra no PEDIDO: o aluno informa o código (ou toca no cupom) e, quando você confirma a aula, o cupom é conferido contra o banco e aplicado — o valor já descontado aparece na aula, para você e para o aluno. Se não valer, a aula é confirmada assim mesmo, e o aluno vê o motivo.'),
        list(
          'Cancelou ou recusou uma aula com cupom aplicado? O uso volta para o aluno. Se foi o aluno quem cancelou, o uso volta quando você abre a sua agenda.',
          'Aula recorrente: o cupom cobre uma aula da série, não todas.',
          'Vale (clínica, brinde…): na hora de entregar, registre o uso em Divulgação → Cupons → "Registrar uso de um cupom".',
          'Cupons → Controle de uso: quantas vezes cada cupom foi usado, o custo e a receita — "—" quando não dá para saber, nunca zero.',
        ),
        warn('O aviso de uma campanha não pode ser cancelado depois de enviado. Mantenha a tela aberta até terminar: se a conexão cair no meio, a campanha mostra para quantas pessoas o aviso foi CONFIRMADO.'),
        link('/aulas', 'Abrir o painel do professor'),
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
      guias: ['privacidade-e-dados'],
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
      guias: ['escolher-notificacoes'],
      blocks: [
        p('O sino, no topo de toda tela, reúne o que aconteceu com você: convites, respostas de reserva, resultados, movimentação dos seus clubes. O número nele é o de avisos que você ainda não abriu.'),
        list(
          'Tocar num aviso leva ao assunto dele e o marca como lido.',
          'A lista do sino rola: os avisos mais antigos ficam embaixo.',
          '"Marcar todas como lidas" zera o número de uma vez.',
          'A engrenagem no rodapé do sino leva às preferências.',
        ),
        p('Em Configurações você escolhe quais categorias quer ver: uma categoria silenciada some do sino e não conta no número. Se a plataforma estiver instalada como aplicativo no celular, também pode receber notificações push.'),
        link('/configuracoes#notificacoes', 'Ajustar minhas notificações'),
      ],
    },
    {
      id: 'central-de-notificacoes',
      flags: ['notifications_center'],
      title: 'Ver as notificações antigas',
      summary: 'Todos os seus avisos num lugar só, com filtros e busca.',
      keywords: ['notificação antiga', 'histórico', 'aviso antigo', 'central de notificações', 'não lida', 'sino', 'perdi um aviso'],
      blocks: [
        p('O sino mostra os avisos mais novos. Todos os outros — inclusive os de meses atrás — ficam em Notificações: toque em "Ver todas as notificações", no rodapé do sino, ou em Notificações no menu.'),
        list(
          'Os avisos vêm agrupados por dia: hoje, ontem, os últimos 7 dias e, daí para trás, mês a mês.',
          '"Não lidas" mostra só o que você ainda não abriu.',
          'Os filtros por área separam jogos, torneios, arenas, clubes, aulas, mensagens e promoções.',
          'A busca procura no texto dos avisos — "quadra 2", o nome de quem convidou, o nome do torneio.',
          'O botão ao lado de cada aviso marca como lido — ou como NÃO lido, para lembrar de voltar nele.',
        ),
        tip('Silenciou uma categoria e quer ver o que chegou dela? Lá aparece quantos avisos estão escondidos, com "Mostrar também".'),
        link('/notificacoes', 'Abrir minhas notificações'),
      ],
    },
    {
      id: 'modo-escuro',
      flags: ['dark_mode'],
      title: 'Modo escuro: claro, escuro ou automático',
      summary: 'Escolha a aparência da plataforma — é só sua.',
      keywords: ['modo escuro', 'escuro', 'tema', 'aparência', 'noite', 'claro', 'automático', 'dark'],
      guias: ['escolher-aparencia'],
      blocks: [
        p('A plataforma tem três aparências: CLARO (o visual de sempre), ESCURO (fundo escuro, mais confortável à noite e com pouca luz) e AUTOMÁTICO, que acompanha o seu aparelho — claro de dia, escuro quando o celular ou o computador escurecer.'),
        steps(
          'No computador: toque no seu avatar, no canto de cima, e escolha em "Aparência".',
          'No celular: abra o menu (as três linhas) e escolha em "Aparência".',
          'Ou em Configurações, no cartão "Aparência", que mostra uma miniatura de cada modo.',
        ),
        tip('A escolha é da SUA conta, e fica guardada neste aparelho. Num tablet compartilhado, cada pessoa que entrar vê a aparência que escolheu — ninguém herda a do outro. Em outro aparelho, escolha de novo.'),
        p('O telão do dia de jogo e do torneio, o totem da arena e a versão para impressão continuam CLAROS de propósito: são feitos para quem está na quadra, na recepção e no papel. Os cards que você baixa para compartilhar e o certificado também saem sempre iguais.'),
        link('/configuracoes', 'Escolher a aparência'),
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

/*
 * Todas as consultas existem em duas formas: as exportadas abaixo, sobre o
 * catálogo INTEIRO (é o que os testes de integridade varrem — todo artigo,
 * ligado ou não), e as de `helpCatalog(flags)`, sobre o que está LIGADO para
 * quem abre a central. A tela usa sempre a segunda.
 */
const secaoEm = (secoes, id) => secoes.find((s) => s.id === id) || null;
const artigoEm = (secoes, sectionId, articleId) => {
  const secao = secaoEm(secoes, sectionId);
  return secao ? secao.articles.find((a) => a.id === articleId) || null : null;
};
const todosEm = (secoes) => secoes.flatMap((s) => s.articles.map((a) => ({
  ...a, sectionId: s.id, sectionLabel: s.label,
})));

/** Uma seção pelo id, ou `null`. */
export function getHelpSection(id) {
  return secaoEm(HELP_SECTIONS, id);
}

/** Um artigo pelo par (seção, artigo), ou `null`. */
export function getHelpArticle(sectionId, articleId) {
  return artigoEm(HELP_SECTIONS, sectionId, articleId);
}

/** Todos os artigos, cada um sabendo de que seção veio. */
export function allHelpArticles() {
  return todosEm(HELP_SECTIONS);
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
  return buscarEm(HELP_SECTIONS, termo, opts);
}

function buscarEm(secoes, termo, opts = {}) {
  const base = opts.sectionId
    ? todosEm(secoes).filter((a) => a.sectionId === opts.sectionId)
    : todosEm(secoes);

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
    refs: [
      [HELP_SECTION.ATHLETE, 'organizar-torneio'],
      [HELP_SECTION.ATHLETE, 'inscritos-numero-incomum'],
      [HELP_SECTION.ATHLETE, 'durante-torneio'],
    ] },
  { pattern: '/torneios/*/modalidades/*', label: 'a modalidade',
    refs: [
      [HELP_SECTION.ATHLETE, 'organizar-torneio'],
      [HELP_SECTION.ATHLETE, 'inscritos-numero-incomum'],
      [HELP_SECTION.ATHLETE, 'inscrever-torneio'],
    ] },
  { pattern: '/torneios/guia', label: 'os formatos de chave',
    refs: [[HELP_SECTION.ATHLETE, 'organizar-torneio'], [HELP_SECTION.ATHLETE, 'inscritos-numero-incomum']] },
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
    refs: [[HELP_SECTION.ATHLETE, 'dia-de-jogo'], [HELP_SECTION.ATHLETE, 'organizar-dia-de-jogo'], [HELP_SECTION.ATHLETE, 'play-grupos']] },
  { pattern: '/dia-de-jogo', label: 'dia de jogo',
    refs: [[HELP_SECTION.ATHLETE, 'organizar-dia-de-jogo'], [HELP_SECTION.ATHLETE, 'dia-de-jogo']] },
  { pattern: '/procura-jogo', label: 'procura-se jogo',
    refs: [[HELP_SECTION.ATHLETE, 'achar-jogo'], [HELP_SECTION.ATHLETE, 'jogo-aberto-arena'], [HELP_SECTION.ATHLETE, 'minha-regiao']] },
  { pattern: '/encontrar-jogadores', label: 'encontrar jogadores',
    refs: [[HELP_SECTION.ATHLETE, 'achar-jogo']] },

  // --- ranking e evolução --------------------------------------------------
  { pattern: '/ranking/duplas', label: 'o ranking de duplas',
    refs: [[HELP_SECTION.ATHLETE, 'ranking-evolucao'], [HELP_SECTION.START, 'nivelamento']] },
  { pattern: '/gamification/como-funciona', label: 'o guia da gamificação',
    refs: [[HELP_SECTION.ATHLETE, 'gamificacao-jornada'], [HELP_SECTION.ATHLETE, 'gamificacao-xp']] },
  { pattern: '/gamification/revisao', label: 'a sua revisão',
    refs: [[HELP_SECTION.ATHLETE, 'gamificacao-jornada'], [HELP_SECTION.ATHLETE, 'gamificacao-missoes']] },
  { pattern: '/gamification/configuracoes', label: 'as preferências da gamificação',
    refs: [[HELP_SECTION.ATHLETE, 'gamificacao-privacidade'], [HELP_SECTION.ATHLETE, 'gamificacao-social']] },
  { pattern: '/gamification', label: 'a gamificação',
    refs: [
      [HELP_SECTION.ATHLETE, 'gamificacao-jornada'],
      [HELP_SECTION.ATHLETE, 'gamificacao-xp'],
      [HELP_SECTION.ATHLETE, 'gamificacao-missoes'],
      [HELP_SECTION.ATHLETE, 'gamificacao-sequencia'],
    ] },
  { pattern: '/hall-da-fama', label: 'o Hall da Fama',
    refs: [[HELP_SECTION.ATHLETE, 'gamificacao-competir'], [HELP_SECTION.ATHLETE, 'gamificacao-privacidade']] },
  { pattern: '/vinculos', label: 'rivais, crews e mentorias',
    refs: [[HELP_SECTION.ATHLETE, 'gamificacao-social']] },
  { pattern: '/conquistas', label: 'suas conquistas',
    refs: [[HELP_SECTION.ATHLETE, 'gamificacao-jornada'], [HELP_SECTION.ATHLETE, 'gamificacao-xp']] },
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
  { pattern: '/arenas/*/open-match', label: 'os jogos abertos desta arena',
    refs: [[HELP_SECTION.ATHLETE, 'jogo-aberto-arena']] },
  { pattern: '/arenas/*/matchmaking', label: 'quem joga nesta arena',
    refs: [[HELP_SECTION.ATHLETE, 'jogo-aberto-arena'], [HELP_SECTION.ATHLETE, 'achar-jogo']] },
  { pattern: '/arenas/*/loja', label: 'a loja desta arena',
    refs: [[HELP_SECTION.ATHLETE, 'loja-arena']] },
  { pattern: '/arenas/*/gerir/operacoes', label: 'a operação da arena',
    refs: [[HELP_SECTION.ARENA, 'operacao-arena']] },
  { pattern: '/arenas/*/gerir/presenca', label: 'a presença do dia',
    refs: [[HELP_SECTION.ARENA, 'presenca-arena']] },
  { pattern: '/arenas/*/gerir/avancado', label: 'marca, rede e inteligência',
    refs: [[HELP_SECTION.ARENA, 'desempenho-arena'], [HELP_SECTION.ARENA, 'modulos-arena']] },
  { pattern: '/arenas/*/avancado', label: 'marca, rede e inteligência',
    refs: [[HELP_SECTION.ARENA, 'desempenho-arena'], [HELP_SECTION.ARENA, 'modulos-arena']] },
  { pattern: '/arenas/*/gerir/marketing', label: 'o marketing da arena',
    refs: [[HELP_SECTION.ARENA, 'marketing-arena'], [HELP_SECTION.ARENA, 'banners-campanha']] },
  { pattern: '/arenas/*/marketing', label: 'o marketing da arena',
    refs: [[HELP_SECTION.ARENA, 'marketing-arena'], [HELP_SECTION.ARENA, 'banners-campanha']] },
  { pattern: '/arenas/*/torneios', label: 'os torneios e o ranking da casa',
    refs: [[HELP_SECTION.ATHLETE, 'ranking-da-casa'], [HELP_SECTION.ARENA, 'modulos-arena']] },
  { pattern: '/arenas/*/membros', label: 'você nesta arena',
    refs: [[HELP_SECTION.ATHLETE, 'vantagens-arena']] },
  { pattern: '/arenas/*/gerir/pdv', label: 'os pedidos do app',
    refs: [[HELP_SECTION.ARENA, 'loja-pdv']] },
  { pattern: '/arenas/*/gerir/modulos', label: 'os módulos da arena',
    refs: [[HELP_SECTION.ARENA, 'modulos-arena']] },
  { pattern: '/arenas/*/gerir/professores', label: 'professores parceiros',
    refs: [[HELP_SECTION.ARENA, 'equipe'], [HELP_SECTION.COACH, 'parcerias']] },
  { pattern: '/arenas/*/gerir', label: 'gerenciar a arena',
    refs: [[HELP_SECTION.ARENA, 'gerir-reservas'], [HELP_SECTION.ARENA, 'precos-regras'], [HELP_SECTION.ARENA, 'desempenho-arena'], [HELP_SECTION.ARENA, 'loja-pdv'], [HELP_SECTION.ARENA, 'marketing-arena'], [HELP_SECTION.ARENA, 'banners-campanha']] },
  { pattern: '/minhas-reservas', label: 'suas reservas',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas'], [HELP_SECTION.ATHLETE, 'jogo-aberto-arena'], [HELP_SECTION.ATHLETE, 'loja-arena'], [HELP_SECTION.ATHLETE, 'planos-arena']] },
  { pattern: '/arenas', label: 'arenas',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas'], [HELP_SECTION.ARENA, 'criar-arena']] },

  // --- professor -----------------------------------------------------------
  { pattern: '/aulas', label: 'o painel do professor',
    refs: [[HELP_SECTION.COACH, 'agenda-professor'], [HELP_SECTION.COACH, 'alunos'], [HELP_SECTION.COACH, 'pacotes-clinicas'], [HELP_SECTION.COACH, 'divulgacao-professor']] },
  { pattern: '/minhas-aulas', label: 'suas aulas',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas'], [HELP_SECTION.ATHLETE, 'promocoes-plataforma-professores']] },
  { pattern: '/coaches/*', label: 'este professor',
    refs: [[HELP_SECTION.ATHLETE, 'reservas-aulas'], [HELP_SECTION.ATHLETE, 'promocoes-plataforma-professores']] },

  // --- promoções da plataforma e dos professores --------------------------
  { pattern: '/promocoes', label: 'promoções',
    refs: [[HELP_SECTION.ATHLETE, 'promocoes-plataforma-professores'], [HELP_SECTION.ATHLETE, 'vantagens-arena']] },
  { pattern: '/campanhas/*', label: 'esta campanha',
    refs: [[HELP_SECTION.ATHLETE, 'promocoes-plataforma-professores']] },
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
  { pattern: '/notificacoes', label: 'as notificações',
    refs: [[HELP_SECTION.ACCOUNT, 'central-de-notificacoes'], [HELP_SECTION.ACCOUNT, 'notificacoes']] },
  { pattern: '/configuracoes', label: 'configurações',
    refs: [[HELP_SECTION.ACCOUNT, 'modo-escuro'], [HELP_SECTION.ATHLETE, 'minha-regiao'], [HELP_SECTION.START, 'inicio-sob-medida'], [HELP_SECTION.START, 'dicas'], [HELP_SECTION.ACCOUNT, 'notificacoes'], [HELP_SECTION.ACCOUNT, 'privacidade']] },
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
  return pistaEm(HELP_SECTIONS, pathname);
}

function pistaEm(secoes, pathname) {
  if (!pathname) return null;
  const pista = HELP_ROUTE_HINTS.find((r) => casaRota(r.pattern, pathname));
  if (!pista) return null;

  const artigos = pista.refs
    .map(([s, a]) => {
      const artigo = artigoEm(secoes, s, a);
      if (!artigo) return null;
      const secao = secaoEm(secoes, s);
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
  // Gamificação: com a flag desligada, as perguntas somem junto com os artigos.
  { q: 'Como o meu XP é calculado?', section: HELP_SECTION.ATHLETE, article: 'gamificacao-xp' },
  { q: 'Perdi a minha sequência. E agora?', section: HELP_SECTION.ATHLETE, article: 'gamificacao-sequencia' },
  { q: 'Quem vê o meu nome no Hall da Fama?', section: HELP_SECTION.ATHLETE, article: 'gamificacao-privacidade' },
  { q: 'Como peço uma recompensa?', section: HELP_SECTION.ATHLETE, article: 'gamificacao-recompensas' },
  // Com as dicas guiadas desligadas, a pergunta some junto com o artigo.
  { q: 'Como a plataforma me mostra onde tocar?', section: HELP_SECTION.START, article: 'dicas' },
]);

/** As perguntas frequentes já resolvidas em artigos (ignora ref quebrada). */
export function faqArticles() {
  return perguntasEm(HELP_SECTIONS);
}

function perguntasEm(secoes) {
  return HELP_FAQ
    .map((f) => {
      const artigo = artigoEm(secoes, f.section, f.article);
      if (!artigo) return null;
      return { ...artigo, question: f.q, sectionId: f.section, sectionLabel: secaoEm(secoes, f.section).label };
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
  return proximoEm(HELP_SECTIONS, sectionId, articleId);
}

function proximoEm(secoes, sectionId, articleId) {
  const todos = todosEm(secoes);
  const i = todos.findIndex((a) => a.sectionId === sectionId && a.id === articleId);
  if (i < 0 || i + 1 >= todos.length) return null;
  return todos[i + 1];
}

/* ======================================================= LIGADO OU NÃO == */

/**
 * O artigo vale para quem abre a central? Artigo sem `flags` vale sempre. Com
 * `flags`, vale quando QUALQUER uma delas está ligada — documentar o que está
 * desligado manda a pessoa para uma porta que não abre (a lição da
 * gamificação). Assim o artigo já nasce escrito, e aparece sozinho no dia em
 * que o admin liga a funcionalidade.
 *
 * Duas formas a mais, para quando uma funcionalidade MUDA outra:
 *  - `flagsTodas`: vale só com TODAS ligadas (o início sob medida só existe
 *    sobre o início personalizado);
 *  - `semFlags`: some quando QUALQUER uma está ligada — o artigo que descreve
 *    o jeito antigo sai no dia em que o novo entra, em vez de os dois
 *    ensinarem coisas diferentes para o mesmo botão.
 *
 * @param {object} artigo
 * @param {Record<string, boolean>} [flags]
 */
export function helpArticleVisible(artigo, flags = {}) {
  const lista = (x) => (Array.isArray(x) ? x : []);
  const ligada = (f) => Boolean(flags?.[f]);
  const algum = lista(artigo?.flags);
  return (algum.length === 0 || algum.some(ligada))
    && lista(artigo?.flagsTodas).every(ligada)
    && !lista(artigo?.semFlags).some(ligada);
}

/**
 * A central como QUEM ABRE a vê: as mesmas consultas, só sobre os artigos
 * ligados. Seção sem nenhum artigo ligado não aparece.
 *
 * @param {Record<string, boolean>} [flags]
 */
export function helpCatalog(flags = {}) {
  const secoes = HELP_SECTIONS
    .map((s) => ({ ...s, articles: s.articles.filter((a) => helpArticleVisible(a, flags)) }))
    .filter((s) => s.articles.length > 0);
  return {
    sections: secoes,
    getSection: (id) => secaoEm(secoes, id),
    getArticle: (s, a) => artigoEm(secoes, s, a),
    all: () => todosEm(secoes),
    search: (termo, opts) => buscarEm(secoes, termo, opts),
    forRoute: (pathname) => pistaEm(secoes, pathname),
    faq: () => perguntasEm(secoes),
    next: (s, a) => proximoEm(secoes, s, a),
  };
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
