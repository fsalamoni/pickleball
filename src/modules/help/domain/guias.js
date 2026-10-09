/**
 * OS GUIAS das dicas — "me mostre como fazer isso", na tela de verdade.
 *
 * Um guia é uma TAREFA ("Criar um dia de jogo", "Reservar uma quadra"), não
 * um tema. Cada passo aponta para um elemento REAL da tela — marcado no código
 * com `data-dica="<âncora>"` — e a tela desenha o destaque, a seta e o cartão
 * em cima dele. Nada aqui abre sozinho: o guia começa quando a pessoa pede.
 *
 * Conteúdo puro, sem React nem I/O (como `tutorials.js` e `helpCenter.js`):
 * dá para testar que toda âncora citada existe no código, que toda rota
 * existe no roteador, e que nenhum guia manda alguém para uma porta fechada.
 *
 * ## O passo
 *
 * | campo       | para quê                                                      |
 * |-------------|---------------------------------------------------------------|
 * | `title`     | o que é aquilo, em poucas palavras                            |
 * | `body`      | um ou mais parágrafos (texto curto: é um cartão, não um manual)|
 * | `tip`       | observação opcional                                           |
 * | `target`    | âncora(s) `data-dica`; a primeira VISÍVEL vale                |
 * | `route`     | molde da tela do passo (`dicasRota.js`)                        |
 * | `goTo`      | para onde LEVAR a pessoa quando ela não está na tela          |
 * | `awayText`  | o que dizer quando ela não está na tela e não dá para levar   |
 * | `advanceOn` | 'click' (tocar no alvo) · `{ route }` · `{ appears: âncora }` |
 * | `action`    | a chamada para agir ("Toque em «Criar»")                      |
 *
 * Sem `advanceOn`, o passo avança pelo botão "Próximo". Com ele, a pessoa FAZ
 * a coisa de verdade e o guia acompanha — é a diferença entre ler sobre o
 * botão e apertar o botão.
 *
 * `goTo` aceita `:minhaArena` (a primeira arena que a pessoa gere): é o que
 * leva o gestor direto à Central da arena dele.
 *
 * ## Quem vê cada guia
 *
 * `flagObrigatoria` (com `formatos`): num dia de jogo o guia do FORMATO vale
 * mesmo com a flag dele desligada — flag tira a opção de ESCOLHER, não a de
 * conduzir o que está gravado. Já a flag de uma FUNCIONALIDADE (os grupos do
 * Play) tem de valer sempre: ensinar um cartão que não existe manda a pessoa
 * procurar o que não está lá.
 *
 * `flags` (basta uma ligada), `flagsTodas` (todas) e `semFlags` (nenhuma) —
 * a mesma regra dos artigos da central de ajuda — e `audience`: 'arena' (quem
 * gere arena), 'professor' (quem tem perfil de professor) ou 'admin' (quem
 * administra a plataforma). Guia de
 * funcionalidade desligada ou de papel que a pessoa não tem não aparece: ele a
 * mandaria para uma porta que não abre.
 *
 * ## Contrato
 *
 * Os ids de guia e de passo são CONTRATO: é por eles que se guarda "já fiz
 * este guia" (localStorage) e o guia em andamento (sessão). E as âncoras são
 * contrato com as telas — há guarda (`src/core/guards/dicas.test.js`) lendo o
 * código-fonte e reprovando âncora citada aqui que nenhuma tela tenha.
 */

import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats.js';
import { TUTORIALS, TUTORIAL_ID } from './tutorials.js';
import { casaAlgumaRota, casaRota } from './dicasRota.js';
import { STREAK_VACATION_COOLDOWN_DAYS, STREAK_VACATION_MAX_DAYS } from '@/modules/progression/domain/weekStreak.js';

/* ================================================================== áreas == */

/** As áreas do painel, na ordem em que aparecem. */
export const GUIA_AREA = Object.freeze({
  COMECAR: 'comecar',
  JOGAR: 'jogar',
  COMPETIR: 'competir',
  TREINO: 'treino',
  COMUNIDADE: 'comunidade',
  GAMIFICACAO: 'gamificacao',
  ARENAS: 'arenas',
  MINHA_ARENA: 'minha-arena',
  AULAS: 'aulas',
  CONTA: 'conta',
});

export const GUIA_AREA_META = Object.freeze({
  [GUIA_AREA.COMECAR]: { label: 'Primeiros passos', icon: 'Compass' },
  [GUIA_AREA.JOGAR]: { label: 'Jogar', icon: 'Swords' },
  [GUIA_AREA.COMPETIR]: { label: 'Competir', icon: 'Trophy' },
  [GUIA_AREA.TREINO]: { label: 'Treino', icon: 'Dumbbell' },
  [GUIA_AREA.COMUNIDADE]: { label: 'Comunidade', icon: 'Users' },
  [GUIA_AREA.GAMIFICACAO]: { label: 'Gamificação', icon: 'Sparkles' },
  [GUIA_AREA.ARENAS]: { label: 'Quadras e reservas', icon: 'CalendarCheck' },
  [GUIA_AREA.MINHA_ARENA]: { label: 'Para a sua arena', icon: 'Building2' },
  [GUIA_AREA.AULAS]: { label: 'Aulas', icon: 'GraduationCap' },
  [GUIA_AREA.CONTA]: { label: 'Conta e preferências', icon: 'Settings' },
});

/** Prefixo dos guias que vêm dos tutoriais das ferramentas. */
export const GUIA_DE_TUTORIAL = 'tutorial:';

/** O id do guia de um tutorial (o botão "Como funciona" das ferramentas). */
export function guiaIdDoTutorial(tutorialId) {
  return tutorialId ? `${GUIA_DE_TUTORIAL}${tutorialId}` : null;
}

/* ================================================================== guias == */

const TOQUE = (rotulo) => `Toque em «${rotulo}»`;

const GUIAS_BASE = [
  /* ---------------------------------------------------- primeiros passos -- */
  {
    id: 'conhecer-a-plataforma',
    area: GUIA_AREA.COMECAR,
    title: 'Conhecer a plataforma',
    summary: 'Onde fica cada coisa: o menu, os atalhos, os avisos e as dicas.',
    keywords: ['menu', 'navegar', 'onde fica', 'começar', 'início', 'tour'],
    screens: ['/'],
    steps: [
      {
        id: 'menu',
        route: '/',
        goTo: '/',
        target: ['menu-principal', 'menu-celular'],
        title: 'O menu da plataforma',
        body: [
          'Tudo o que dá para fazer aqui está organizado em temas: Início, Competir, Jogar, Comunidade, Arenas, Aulas, Pickleball e Perfil.',
          'Ao entrar num tema, as páginas dele aparecem numa barra logo acima do conteúdo.',
        ],
        tip: 'No celular, o menu abre no botão de três linhas, no canto de cima.',
      },
      {
        id: 'competir',
        route: '/',
        target: ['menu-competir', 'nav-inferior-torneios'],
        title: 'Competir',
        body: 'Torneios, circuitos e o ranking. É aqui que você se inscreve num torneio, cria o seu e acompanha a sua posição.',
      },
      {
        id: 'jogar',
        route: '/',
        target: ['menu-jogar', 'menu-celular'],
        title: 'Jogar',
        body: 'Abre no Dia de jogo (os seus e os com vaga para você entrar), depois Procura-se jogo (tudo o que tem vaga nos próximos dias, com o botão de entrar) e Encontrar jogadores do seu nível.',
      },
      {
        id: 'arenas',
        route: '/',
        target: ['menu-arenas', 'menu-celular'],
        title: 'Arenas',
        body: 'Encontre uma quadra, veja os horários livres e peça a reserva. O que você reservou fica em Minhas reservas.',
      },
      {
        id: 'procuro-jogo',
        route: '/',
        target: 'botao-procuro-jogo',
        title: 'Atalho: Procuro jogo',
        body: 'Leva direto aos convites abertos — o jeito mais rápido de achar com quem jogar hoje.',
      },
      {
        id: 'avisos',
        route: '/',
        target: 'botao-notificacoes',
        title: 'Seus avisos',
        body: 'Convites, respostas de reserva, resultados e novidades dos seus clubes chegam neste sino. A lista rola: os mais antigos ficam embaixo.',
      },
      {
        id: 'dicas',
        route: '/',
        target: 'botao-dicas',
        title: 'As dicas moram aqui',
        body: [
          'Ligue ou desligue as dicas quando quiser. Ligadas, pontos pulsando nas telas mostram o que cada botão faz.',
          'E em "O que você quer fazer?" há um guia como este para cada tarefa.',
        ],
      },
    ],
  },
  {
    id: 'completar-perfil',
    area: GUIA_AREA.COMECAR,
    title: 'Completar o seu perfil',
    summary: 'Foto, cidade, interesses e nível — o que faz a plataforma trabalhar para você.',
    keywords: ['perfil', 'foto', 'nome', 'cidade', 'interesses', 'nível', 'editar'],
    screens: ['/perfil', '/perfil/editar'],
    steps: [
      {
        id: 'identidade',
        route: '/perfil/editar',
        goTo: '/perfil/editar',
        target: 'perfil-identidade',
        title: 'Quem é você',
        body: [
          'Foto, nome de exibição e tempo de experiência. É assim que atletas, arenas e organizadores te encontram.',
          'Cada cartão tem o seu botão de salvar: "Salvar alterações" guarda só o que está nele.',
        ],
        tip: 'Cartão fechado abre com um toque no título.',
      },
      {
        id: 'comunidade',
        route: '/perfil/editar',
        target: 'perfil-comunidade',
        title: 'Cidade e privacidade',
        body: 'A cidade traz torneios, jogos e arenas perto de você. Aqui você também decide quem vê o seu contato e se aparece no diretório de atletas.',
      },
      {
        id: 'interesses',
        route: '/perfil/editar',
        target: 'perfil-interesses',
        title: 'Seus interesses',
        body: 'Marque o que você quer fazer aqui: jogar torneios, organizar, achar parceiros, ter aulas, reservar quadras… A tela inicial e as sugestões partem disso.',
      },
      {
        id: 'nivel',
        route: '/perfil/editar',
        target: 'perfil-nivel',
        title: 'Seu nível',
        body: 'Informe o seu nível ou responda ao questionário. É ele que equilibra os sorteios dos dias de jogo e as sugestões de parceiros.',
      },
    ],
  },

  /* ------------------------------------------------------------- jogar -- */
  {
    id: 'encontrar-jogo',
    area: GUIA_AREA.JOGAR,
    title: 'Achar um jogo para hoje',
    summary: 'Os convites abertos, os jogos das arenas e como publicar o seu.',
    keywords: ['procura-se jogo', 'convite', 'parceiro', 'jogar hoje', 'jogo aberto'],
    screens: ['/procura-jogo'],
    steps: [
      {
        id: 'convites',
        route: '/procura-jogo',
        goTo: '/procura-jogo',
        target: ['procura-lista', 'procura-publicar'],
        title: 'Convites abertos',
        body: [
          'Aqui ficam os convites de quem procura gente para jogar: dia, lugar, nível e vagas.',
          'Achou um que combina? Toque em "Participar do dia de jogo".',
        ],
      },
      {
        id: 'arenas',
        route: '/procura-jogo',
        target: 'procura-arenas',
        title: 'Jogos abertos nas arenas',
        body: 'Arenas também publicam jogos com vaga, com quadra e horário já garantidos. Dá para entrar ali mesmo — e, se lotar, entrar na fila.',
      },
      {
        id: 'publicar',
        route: '/procura-jogo',
        target: 'procura-publicar',
        title: 'Não achou? Publique o seu',
        body: 'Em "Publicar convite" você diz quando, onde e quantas vagas tem. O convite aparece aqui para quem procura jogo.',
      },
    ],
  },
  {
    id: 'criar-dia-de-jogo',
    area: GUIA_AREA.JOGAR,
    title: 'Criar um dia de jogo',
    summary: 'Do nome ao formato, passo a passo no próprio formulário.',
    keywords: ['dia de jogo', 'criar', 'americano', 'play', 'formato', 'quadras', 'organizar'],
    screens: ['/dia-de-jogo'],
    steps: [
      {
        id: 'abrir',
        route: '/dia-de-jogo',
        goTo: '/dia-de-jogo',
        target: 'dia-de-jogo-criar',
        advanceOn: 'click',
        action: TOQUE('Novo dia de jogo'),
        title: 'Comece aqui',
        body: 'Um dia de jogo organiza uma tarde (ou manhã) de partidas: quem joga com quem, em que quadra — e, se você quiser, placar e ranking do dia.',
      },
      {
        id: 'nome',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-nome',
        title: 'Dê um nome',
        body: 'Algo que as pessoas reconheçam: "Treino de sábado", "Open do clube".',
      },
      {
        id: 'visibilidade',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-visibilidade',
        title: 'Quem vê',
        body: 'Público: aparece para outras pessoas pedirem para entrar. Privado: só quem você incluir.',
      },
      {
        id: 'quem-organiza',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-quem-organiza',
        title: 'Quem conduz as partidas',
        body: 'Só você (e quem você nomear) sorteia e cria as partidas — ou qualquer inscrito pode ajudar. Dá para mudar depois, nas configurações do dia.',
      },
      {
        id: 'data',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-data',
        title: 'Quando',
        body: 'Data e horário de início. Local e cidade ajudam quem vem de fora.',
      },
      {
        id: 'formato',
        route: '/dia-de-jogo',
        target: ['dia-de-jogo-formato', 'dia-de-jogo-nome'],
        title: 'O formato',
        body: [
          'Play: jogo aberto, por ordem de chegada, sem placar.',
          'Americano: as rodadas saem sorteadas de uma vez, com placar e ranking do dia.',
        ],
        tip: 'Outros formatos aparecem quando estão ligados na plataforma. "Como funciona este formato" explica cada um.',
      },
      {
        id: 'criar',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-confirmar',
        advanceOn: { route: '/dia-de-jogo/*' },
        action: TOQUE('Criar dia de jogo'),
        title: 'Pronto para criar',
        body: 'Criado o dia, a plataforma abre a tela dele.',
      },
      {
        id: 'depois',
        route: '/dia-de-jogo/*',
        awayText: 'Abra o dia de jogo que você criou — ele está em Jogar → Dia de jogo.',
        goTo: '/dia-de-jogo',
        target: ['dia-de-jogo-inserir-atletas', 'dia-de-jogo-participantes'],
        title: 'Agora, os participantes',
        body: 'Inclua os atletas em "Inserir atletas". Com gente no dia, os botões de sortear e de criar partidas passam a funcionar.',
        tip: 'O "Como funciona" desta tela abre o guia completo do formato que você escolheu.',
      },
    ],
  },
  {
    id: 'play-grupos',
    area: GUIA_AREA.JOGAR,
    // A flag aqui gateia a FUNCIONALIDADE, não só a escolha de um formato:
    // `flagObrigatoria` faz o guia respeitá-la mesmo num dia de Play que já
    // existe (ver `guiasDaTela`).
    flags: ['play_groups'],
    flagObrigatoria: true,
    formatos: [GAME_DAY_FORMAT.PLAY],
    title: 'Dividir o Play em grupos',
    summary: 'Por nível ou por tipo de dupla: cada grupo com a sua fila e as suas regras.',
    keywords: ['grupos', 'play', 'nível', 'turma', 'mista', 'fila', 'dividir', 'convidado'],
    screens: ['/dia-de-jogo/*'],
    steps: [
      {
        id: 'o-que-sao',
        route: '/dia-de-jogo/*',
        goTo: '/dia-de-jogo',
        awayText: 'Abra um dia de jogo no formato Play (Jogar → Dia de jogo).',
        target: 'dia-de-jogo-grupos',
        title: 'Grupos dentro do Play',
        body: [
          'Os grupos dividem a fila do dia: cada um tem a sua fila, e as partidas saem DENTRO do grupo — iniciantes jogam com iniciantes, mistas com mistas.',
          'Quem está sem grupo continua numa fila só dele, como o Play sempre foi.',
        ],
        tip: 'Quem criou o dia e os administradores nomeados montam e editam os grupos. Quem só conduz as partidas move as pessoas entre eles.',
      },
      {
        id: 'novo',
        route: '/dia-de-jogo/*',
        target: ['dia-de-jogo-grupos-novo', 'dia-de-jogo-grupos'],
        title: 'Criar um grupo',
        body: [
          'Com o cartão vazio, escolha um modelo (por nível, por tipo de dupla ou em branco). Depois, "Novo grupo" acrescenta quantos quiser.',
          'Cada grupo tem nome, faixa de nível, o tipo de dupla (livre, mista ou do mesmo sexo), a diferença máxima de nível dentro da partida e as quadras em que joga.',
        ],
        tip: '"Exigir" faz o grupo esperar até haver uma partida que cumpra as regras; sem isso, ele tenta cumprir e, se não der, joga assim mesmo.',
      },
      {
        id: 'distribuir',
        route: '/dia-de-jogo/*',
        target: ['dia-de-jogo-grupos-distribuir', 'dia-de-jogo-grupos'],
        title: 'Distribuir por nível',
        body: 'Coloca cada pessoa no grupo que combina com o nível dela. Você vê a prévia antes de aplicar — e nada muda até confirmar.',
        tip: 'Quem não tem nível conhecido não é barrado de nenhum grupo: vale o que você escolher.',
      },
      {
        id: 'convidados',
        route: '/dia-de-jogo/*',
        target: ['dia-de-jogo-inserir-atletas', 'dia-de-jogo-participantes'],
        title: 'Convidado avulso: nível e sexo',
        body: 'Ao inserir alguém que não tem conta, informe o nível e o sexo dessa pessoa. É o que a coloca no grupo certo — sem isso, ela entra sem grupo.',
      },
      {
        id: 'quadras',
        route: '/dia-de-jogo/*',
        target: 'dia-de-jogo-quadras',
        title: 'O grupo de cada quadra',
        body: [
          'Numa quadra livre você deixa o sorteio escolher o grupo ("Automático") ou manda um grupo específico para ela.',
          'No cartão Grupos, a política decide quem ocupa a quadra quando há mais de um grupo pronto: por tempo de espera, revezando ou por prioridade.',
        ],
      },
      {
        id: 'fila',
        route: '/dia-de-jogo/*',
        target: ['dia-de-jogo-ordem', 'dia-de-jogo-grupos'],
        title: 'A fila de cada grupo',
        body: 'O número é a posição DENTRO do grupo. Um grupo sem partida pronta diz o porquê no próprio cartão — falta gente, falta alguém do sexo da formação, o nível não combina.',
      },
      {
        id: 'telao',
        route: '/dia-de-jogo/*',
        target: 'dia-de-jogo-telao',
        title: 'No telão',
        body: 'A partida em quadra mostra o selo do grupo, a previsão diz de que grupo é cada quadra e a fila se divide por grupo.',
      },
    ],
  },
  {
    id: 'encontrar-jogadores',
    area: GUIA_AREA.JOGAR,
    title: 'Achar parceiros do seu nível',
    summary: 'Sugestões de atletas parecidos com você, perto de você.',
    keywords: ['parceiro', 'nível', 'jogadores', 'encontrar', 'rating'],
    screens: ['/encontrar-jogadores'],
    steps: [
      {
        id: 'filtros',
        route: '/encontrar-jogadores',
        goTo: '/encontrar-jogadores',
        target: 'jogadores-filtros',
        title: 'Nível e cidade',
        body: 'Combine "Nível parecido" e "Minha cidade" para ver só quem joga como você, perto de você.',
        tip: 'As sugestões precisam de um nível ou rating seu. Sem ele, a tela explica como conseguir.',
      },
      {
        id: 'lista',
        route: '/encontrar-jogadores',
        target: 'jogadores-lista',
        title: 'Os sugeridos',
        body: 'Cada cartão mostra o nível e a cidade. Mande uma mensagem para combinar o jogo.',
      },
    ],
  },

  /* ---------------------------------------------------------- competir -- */
  {
    id: 'inscrever-em-torneio',
    area: GUIA_AREA.COMPETIR,
    title: 'Inscrever-se num torneio',
    summary: 'Achar o torneio, escolher a modalidade e acompanhar os jogos.',
    keywords: ['torneio', 'inscrição', 'inscrever', 'modalidade', 'competir'],
    screens: ['/torneios', '/torneios/*'],
    steps: [
      {
        id: 'abas',
        route: '/torneios',
        goTo: '/torneios',
        target: 'torneios-abas',
        title: 'Públicos ou os seus',
        body: '"Públicos" mostra os torneios abertos a todos; "Meus torneios", aqueles em que você joga ou organiza.',
      },
      {
        id: 'escolher',
        route: '/torneios',
        target: ['torneios-lista', 'torneios-abas'],
        advanceOn: { route: '/torneios/*' },
        action: 'Toque num torneio para abrir',
        title: 'Escolha um torneio',
        body: 'Cada cartão mostra datas, cidade e se as inscrições estão abertas.',
      },
      {
        id: 'inscrever',
        route: '/torneios/*',
        goTo: '/torneios',
        awayText: 'Abra um torneio da lista de Torneios.',
        target: ['torneio-inscrever', 'torneio-abas'],
        title: 'Inscreva-se na modalidade',
        body: [
          'Na aba Visão geral, cada modalidade (por exemplo, "Dupla Mista B") tem o seu botão "Inscrever-se".',
          'Nas duplas, você informa o parceiro na própria inscrição.',
        ],
        tip: 'Torneio privado pede o código que o organizador passou.',
      },
      {
        id: 'acompanhar',
        route: '/torneios/*',
        target: 'torneio-abas',
        title: 'Depois de inscrito',
        body: 'Em Jogos você vê horários e adversários; em Ranking, a classificação. Os avisos chegam no sino.',
      },
    ],
  },
  {
    id: 'criar-torneio',
    area: GUIA_AREA.COMPETIR,
    title: 'Criar um torneio',
    summary: 'As três etapas do cadastro, no próprio formulário.',
    keywords: ['torneio', 'criar', 'organizar', 'rascunho', 'inscrições'],
    screens: ['/torneios', '/torneios/criar'],
    steps: [
      {
        id: 'etapas',
        route: '/torneios/criar',
        goTo: '/torneios/criar',
        target: 'criar-torneio-etapas',
        title: 'Três etapas',
        body: 'Identidade, acesso e regras, calendário. Dá para voltar a qualquer etapa antes de criar — e tudo se edita depois.',
      },
      {
        id: 'identidade',
        route: '/torneios/criar',
        target: 'criar-torneio-nome',
        title: 'Nome e local',
        body: 'Nome do torneio, cidade, UF e o local. Se ele acontece numa arena sua, vincule-a: o torneio aparece na página da arena.',
      },
      {
        id: 'avancar-1',
        route: '/torneios/criar',
        target: 'criar-torneio-avancar',
        advanceOn: { appears: 'criar-torneio-acesso' },
        action: TOQUE('Avançar'),
        title: 'Próxima etapa',
        body: 'Preenchido o nome, siga para o acesso e as regras.',
      },
      {
        id: 'acesso',
        route: '/torneios/criar',
        target: 'criar-torneio-acesso',
        title: 'Público ou privado',
        body: 'Público aparece na busca. Privado só recebe quem tem o link ou o código.',
      },
      {
        id: 'avancar-2',
        route: '/torneios/criar',
        target: 'criar-torneio-avancar',
        advanceOn: { appears: 'criar-torneio-datas' },
        action: TOQUE('Avançar'),
        title: 'Última etapa',
        body: 'Falta só o calendário.',
      },
      {
        id: 'datas',
        route: '/torneios/criar',
        target: 'criar-torneio-datas',
        title: 'Datas e prazo',
        body: 'Início, fim e o fim das inscrições.',
      },
      {
        id: 'criar',
        route: '/torneios/criar',
        target: 'criar-torneio-criar',
        title: 'Criar',
        body: [
          'O torneio nasce como rascunho: só você o vê.',
          'Depois vêm as modalidades, as inscrições e o sorteio — no console de gestão, em "Gerenciar torneio".',
        ],
        tip: 'No console, "Como funciona" abre o guia completo da organização.',
      },
    ],
  },
  {
    id: 'entender-ranking',
    area: GUIA_AREA.COMPETIR,
    title: 'Entender o ranking',
    summary: 'Os dois rankings, a busca e o ranking de duplas.',
    keywords: ['ranking', 'rating', 'posição', 'elo', 'dupr', 'duplas'],
    screens: ['/ranking', '/ranking/duplas'],
    steps: [
      {
        id: 'abas',
        route: '/ranking',
        goTo: '/ranking',
        target: 'ranking-abas',
        title: 'Dois rankings',
        body: 'Nacional (pontuação ELO) e Nível 2.0–8.0 (no estilo DUPR). Os dois se movem com os resultados publicados — de torneios e de dias de jogo.',
      },
      {
        id: 'como',
        route: '/ranking',
        target: ['ranking-como-funciona', 'ranking-abas'],
        title: 'O que conta',
        body: 'Abra "Como funciona o ranking?" para ver o que entra e o que não entra na conta.',
      },
      {
        id: 'busca',
        route: '/ranking',
        target: ['ranking-busca', 'ranking-abas'],
        title: 'Ache alguém',
        body: 'Busque por nome, cidade, estado ou nível. Os filtros ao lado recortam por região, gênero, clube e faixa etária.',
      },
      {
        id: 'duplas',
        route: '/ranking',
        target: ['ranking-duplas-link', 'ranking-abas'],
        title: 'E as duplas',
        body: 'O ranking de duplas classifica as parcerias pelo aproveitamento — a dupla que mais vence junto.',
      },
    ],
  },

  /* -------------------------------------------------------- comunidade -- */
  {
    id: 'entrar-num-clube',
    area: GUIA_AREA.COMUNIDADE,
    title: 'Entrar num clube',
    summary: 'Buscar o clube e pedir para participar (ou usar o código).',
    keywords: ['clube', 'entrar', 'participar', 'código', 'convite'],
    screens: ['/clubes', '/clubes/*'],
    steps: [
      {
        id: 'busca',
        route: '/clubes',
        goTo: '/clubes',
        target: 'clubes-busca',
        title: 'Busque o clube',
        body: 'Pelo nome. Os clubes de que você já participa aparecem no topo da página.',
        tip: 'O cartão de busca fechado abre com um toque no título.',
      },
      {
        id: 'escolher',
        route: '/clubes',
        target: ['clubes-lista', 'clubes-busca'],
        advanceOn: { route: '/clubes/*' },
        action: 'Toque num clube para abrir',
        title: 'Abra o clube',
        body: 'A página do clube mostra os eventos, os membros e como entrar.',
      },
      {
        id: 'entrar',
        route: '/clubes/*',
        goTo: '/clubes',
        awayText: 'Abra um clube da lista de Clubes.',
        target: ['clube-entrar', 'clube-codigo'],
        title: 'Peça para entrar',
        body: 'Em "Pedir para ingressar" o administrador do clube recebe o pedido. Tem um código de convite? Use "Entrar com código".',
      },
    ],
  },
  {
    id: 'criar-clube',
    area: GUIA_AREA.COMUNIDADE,
    title: 'Criar um clube',
    summary: 'O cadastro do clube, campo a campo.',
    keywords: ['clube', 'criar', 'grupo', 'comunidade'],
    screens: ['/clubes', '/clubes/criar'],
    steps: [
      {
        id: 'nome',
        route: '/clubes/criar',
        goTo: '/clubes/criar',
        target: 'clube-criar-nome',
        title: 'Nome e descrição',
        body: 'O nome é o que aparece na busca. A descrição conta para quem é o clube e como funciona.',
      },
      {
        id: 'onde',
        route: '/clubes/criar',
        target: 'clube-criar-cidade',
        title: 'Onde',
        body: 'Cidade, UF e a quadra principal ajudam quem procura um clube perto.',
      },
      {
        id: 'criar',
        route: '/clubes/criar',
        target: 'clube-criar-enviar',
        title: 'Criar',
        body: 'Criado o clube, você é o administrador: aprova quem pede para entrar, cria eventos e convida pelo código.',
      },
    ],
  },

  /* ------------------------------------------------------------ arenas -- */
  {
    id: 'reservar-quadra',
    area: GUIA_AREA.ARENAS,
    title: 'Reservar uma quadra',
    summary: 'Da busca da arena ao pedido de reserva, na tela de verdade.',
    keywords: ['reserva', 'reservar', 'quadra', 'arena', 'horário', 'calendário'],
    screens: ['/arenas', '/arenas/*'],
    steps: [
      {
        id: 'buscar',
        route: '/arenas',
        goTo: '/arenas',
        target: 'arenas-busca',
        title: 'Ache a arena',
        body: 'Busque por nome, cidade ou endereço — ou filtre pela cidade logo abaixo.',
      },
      {
        id: 'escolher',
        route: '/arenas',
        target: ['arenas-lista', 'arenas-busca'],
        advanceOn: { route: '/arenas/*' },
        action: 'Toque numa arena para abrir',
        title: 'Abra a arena',
        body: 'A página da arena mostra preços, quadras, regras e o calendário de horários.',
      },
      {
        id: 'dia',
        route: '/arenas/*',
        goTo: '/arenas',
        awayText: 'Abra uma arena da lista de Arenas.',
        target: 'arena-calendario',
        advanceOn: { appears: 'arena-horarios' },
        action: 'Toque num dia com horário livre',
        title: 'Escolha o dia',
        body: 'Cada dia mostra quantas horas livres tem. Dia apagado já passou ou está fechado.',
      },
      {
        id: 'horarios',
        route: '/arenas/*',
        target: 'arena-horarios',
        title: 'Quadra e horário',
        body: 'Toque nos horários que quiser — dá para escolher mais de um, e em mais de uma quadra. Em "Por quadra" você vê exatamente quais quadras estão livres.',
      },
      {
        id: 'continuar',
        route: '/arenas/*',
        target: 'arena-continuar',
        advanceOn: { appears: 'reserva-confirmar' },
        action: TOQUE('Continuar'),
        title: 'Siga para confirmar',
        body: 'O botão aparece assim que você escolhe pelo menos um horário.',
      },
      {
        id: 'confirmar',
        route: '/arenas/*',
        target: 'reserva-confirmar',
        title: 'Confirme o pedido',
        body: [
          'Avulsa ou toda semana, observações e convidados. O preço aparece antes de você enviar.',
          'Em "Solicitar reserva" a arena recebe o pedido — e você é avisado quando ela responder.',
        ],
      },
      {
        id: 'acompanhar',
        title: 'Acompanhe em Minhas reservas',
        body: 'O pedido aparece em Arenas → Minhas reservas, com o status. Mudou de ideia? Dá para cancelar ali.',
      },
    ],
  },
  {
    id: 'minhas-reservas',
    area: GUIA_AREA.ARENAS,
    title: 'Acompanhar as suas reservas',
    summary: 'Status, convites, jogos abertos e os seus planos nas arenas.',
    keywords: ['minhas reservas', 'status', 'cancelar', 'reserva'],
    screens: ['/minhas-reservas'],
    steps: [
      {
        id: 'lista',
        route: '/minhas-reservas',
        goTo: '/minhas-reservas',
        target: ['reservas-lista', 'reservas-ver-arenas'],
        title: 'Ativas e histórico',
        body: 'Cada reserva mostra a arena, o horário e o status: pedida, confirmada, recusada. Dá para cancelar ou pedir alteração ali mesmo.',
      },
      {
        id: 'arenas',
        route: '/minhas-reservas',
        target: 'reservas-ver-arenas',
        title: 'Reservar de novo',
        body: '"Ver arenas" leva à busca de quadras.',
      },
    ],
  },

  /* ---------------------------------------------------- a sua arena -- */
  {
    id: 'cadastrar-arena',
    area: GUIA_AREA.MINHA_ARENA,
    title: 'Cadastrar a sua arena',
    summary: 'O cadastro da arena, antes de abrir as reservas.',
    keywords: ['arena', 'cadastrar', 'criar', 'quadras', 'dono'],
    screens: ['/arenas', '/arenas/criar'],
    steps: [
      {
        id: 'nome',
        route: '/arenas/criar',
        goTo: '/arenas/criar',
        target: 'arena-criar-nome',
        title: 'Nome e descrição',
        body: 'Como a arena aparece na busca e na página dela.',
      },
      {
        id: 'local',
        route: '/arenas/criar',
        target: 'arena-criar-local',
        title: 'Onde fica',
        body: 'Endereço, bairro, cidade e UF — é por eles que os atletas acham a arena.',
      },
      {
        id: 'quadras',
        route: '/arenas/criar',
        target: 'arena-criar-quadras',
        title: 'Quadras e funcionamento',
        body: 'Um primeiro número. Depois você cadastra cada quadra e os horários dela na Central da arena.',
      },
      {
        id: 'enviar',
        route: '/arenas/criar',
        target: 'arena-criar-enviar',
        title: 'Cadastrar',
        body: 'Em seguida a plataforma abre os primeiros passos da arena. O guia "Cadastrar quadras e horários" continua dali.',
      },
    ],
  },
  {
    id: 'configurar-quadras',
    area: GUIA_AREA.MINHA_ARENA,
    audience: 'arena',
    title: 'Cadastrar quadras e horários',
    summary: 'Sem horário, a quadra não aparece para reserva. Veja onde se configura.',
    keywords: ['quadra', 'horário', 'janela', 'funcionamento', 'central da arena'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'secao',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=quadras',
        target: ['arena-aba-quadras', 'arena-secao-estrutura', 'arena-secoes'],
        title: 'Estrutura e preços → Quadras',
        body: 'A Central da arena é organizada em seções. As quadras moram em "Estrutura e preços".',
      },
      {
        id: 'nova',
        route: '/arenas/*/gerir',
        target: ['arena-nova-quadra', 'arena-quadras'],
        title: 'Cadastre as quadras',
        body: 'Uma por uma: nome, piso, se é coberta. Quadra inativa fica fora da reserva sem precisar apagar.',
      },
      {
        id: 'relogio',
        route: '/arenas/*/gerir',
        target: ['arena-horarios-quadra', 'arena-quadras'],
        advanceOn: { appears: 'arena-nova-janela' },
        action: 'Toque no relógio de uma quadra',
        title: 'Os horários de cada quadra',
        body: 'Cada quadra tem as suas janelas de funcionamento. Quadra sem janela não aparece no calendário.',
      },
      {
        id: 'janela',
        route: '/arenas/*/gerir',
        target: ['arena-nova-janela', 'arena-janelas'],
        title: 'Uma janela de horário',
        body: 'Dias da semana e das tantas às tantas. Pode haver mais de uma — manhã e noite, por exemplo.',
        tip: 'Uma janela sem quadra escolhida vale para a arena inteira.',
      },
    ],
  },
  {
    id: 'responder-reservas',
    area: GUIA_AREA.MINHA_ARENA,
    audience: 'arena',
    title: 'Responder pedidos de reserva',
    summary: 'Onde chegam os pedidos e como confirmar ou recusar.',
    keywords: ['pedido', 'reserva', 'confirmar', 'recusar', 'central da arena'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'pendencias',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=reservas',
        target: ['arena-pendencias', 'arena-secao-reservas', 'arena-secoes'],
        title: 'Precisa de você',
        body: 'O topo da Central junta o que espera a arena agir: pedidos de reserva, pedidos do app, faltas para marcar. Cada item leva à aba que resolve.',
      },
      {
        id: 'aba',
        route: '/arenas/*/gerir',
        target: ['arena-aba-reservas', 'arena-secao-reservas', 'arena-secoes'],
        title: 'Reservas → Solicitações',
        body: 'Os pedidos ativos, do mais próximo para o mais distante.',
      },
      {
        id: 'responder',
        route: '/arenas/*/gerir',
        target: ['reserva-confirmar-pedido', 'arena-aba-reservas'],
        title: 'Confirmar, propor ou recusar',
        body: 'Confirmar avisa o atleta na hora. "Propor" sugere outro valor; "Recusar" libera o horário.',
      },
    ],
  },
  {
    id: 'ligar-modulos',
    area: GUIA_AREA.MINHA_ARENA,
    audience: 'arena',
    flags: ['arena_modules'],
    title: 'Ligar os módulos da arena',
    summary: 'Membros, aulas, jogo aberto, loja, marketing: o que a arena ativa para si.',
    keywords: ['módulos', 'membros', 'aulas', 'loja', 'marketing', 'ativar'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'aba',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=modulos',
        target: ['arena-aba-modulos', 'arena-secao-configuracoes', 'arena-secoes'],
        title: 'Configurações → Módulos',
        body: 'Cada módulo liberado pela plataforma aparece aqui, com o que ele faz e para quem.',
      },
      {
        id: 'ativar',
        route: '/arenas/*/gerir',
        target: 'arena-modulos',
        title: 'Ative o que a arena usa',
        body: 'Ligado, o módulo vira uma seção da Central e da página da arena. Desligar não apaga nada: os dados voltam se você religar.',
      },
    ],
  },

  /* ------------------------------------------------------------- aulas -- */
  {
    id: 'encontrar-professor',
    area: GUIA_AREA.AULAS,
    title: 'Encontrar um professor',
    summary: 'Filtros por cidade e nível, e como pedir uma aula.',
    keywords: ['professor', 'aula', 'treino', 'coach'],
    screens: ['/coaches'],
    steps: [
      {
        id: 'filtros',
        route: '/coaches',
        goTo: '/coaches',
        target: 'professores-filtros',
        title: 'Filtre',
        body: 'Por cidade, modalidade e nível. O cartão de filtros fechado abre com um toque no título.',
      },
      {
        id: 'lista',
        route: '/coaches',
        target: ['professores-lista', 'professores-filtros'],
        title: 'Escolha e peça a aula',
        body: 'Abra o perfil do professor para ver a agenda e os preços, e peça a aula por ali.',
      },
    ],
  },
  {
    id: 'virar-professor',
    area: GUIA_AREA.AULAS,
    title: 'Começar a dar aulas',
    summary: 'Criar o seu perfil de professor e abrir a agenda.',
    keywords: ['professor', 'dar aula', 'coach', 'agenda', 'perfil de professor'],
    screens: ['/coaches', '/aulas'],
    steps: [
      {
        id: 'sou',
        route: '/coaches',
        goTo: '/coaches',
        target: 'professor-sou',
        advanceOn: { appears: 'professor-formulario' },
        action: TOQUE('Sou professor'),
        title: 'O seu perfil de professor',
        body: 'É ele que aparece na busca de professores e recebe os pedidos de aula.',
      },
      {
        id: 'formulario',
        route: '/coaches',
        target: 'professor-formulario',
        title: 'Conte como é a sua aula',
        body: 'Cidade, modalidades, níveis, valor e se está aceitando alunos. Salve para aparecer na busca.',
      },
      {
        id: 'painel',
        title: 'Depois: o Painel do professor',
        body: 'Com o perfil salvo, o menu Aulas ganha o "Painel do professor": agenda, alunos, clínicas e horários disponíveis.',
      },
    ],
  },
  {
    id: 'disponibilidade-professor',
    area: GUIA_AREA.AULAS,
    audience: 'professor',
    title: 'Definir os seus horários de aula',
    summary: 'A disponibilidade semanal que os alunos veem ao pedir aula.',
    keywords: ['disponibilidade', 'horário', 'agenda', 'professor', 'janela'],
    screens: ['/aulas'],
    steps: [
      {
        id: 'secoes',
        route: '/aulas',
        goTo: '/aulas?aba=agenda',
        target: 'professor-secoes',
        title: 'O Painel do professor',
        body: 'Perfil, Agenda, Alunos, Clínicas e o resto — cada seção com as suas abas.',
      },
      {
        id: 'disponibilidade',
        route: '/aulas',
        target: 'professor-disponibilidade',
        title: 'Disponibilidade semanal',
        body: 'Os dias e horários em que você dá aula. Os alunos só pedem aula dentro deles.',
      },
      {
        id: 'janela',
        route: '/aulas',
        target: ['professor-janela', 'professor-disponibilidade'],
        title: 'Acrescente janelas',
        body: '"+ Janela" acrescenta outro período no mesmo dia.',
      },
      {
        id: 'salvar',
        route: '/aulas',
        target: ['professor-salvar-disponibilidade', 'professor-disponibilidade'],
        title: 'Salve',
        body: 'Só vale depois de "Salvar disponibilidade".',
      },
    ],
  },

  /* ------------------------------------------------------------ treino -- */
  {
    id: 'treino-hoje',
    area: GUIA_AREA.TREINO,
    flags: ['training_center'],
    title: 'Treinar hoje',
    summary: 'A rotina, o treino do dia e o registro em três toques.',
    keywords: ['treino', 'treinar', 'hoje', 'rotina', 'começar', 'modo quadra', 'registrar'],
    screens: ['/treino'],
    steps: [
      {
        id: 'secoes',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-secoes',
        title: 'O Treino',
        body: 'Treinar (Hoje, Planos, Diário, Evolução), Conteúdo (Biblioteca, Meus, Recebidos) e Conversa (Dúvidas). Tudo no mesmo lugar.',
      },
      {
        id: 'rotina',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: ['treino-hoje-rotina', 'treino-aba-hoje'],
        title: 'A sua rotina',
        body: 'Dias, tempo e onde você treina. Com ela, o "Hoje" sugere um treino do seu tamanho. Dá para ajustar depois em "Ajustar".',
      },
      {
        id: 'comecar',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: ['treino-hoje-comecar', 'treino-aba-hoje'],
        title: 'Começar',
        body: 'Abre o modo quadra: a tela fica acesa e conta o tempo de cada bloco, um de cada vez.',
        tip: 'O "Hoje" vem do seu plano ativo; sem plano, do que o professor mandou com prazo; senão, de uma sugestão pelo seu nível.',
      },
      {
        id: 'registrar',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: ['treino-hoje-registrar', 'treino-aba-hoje'],
        title: 'Registre o que fez',
        body: 'O que fez, quanto tempo e o esforço (0 a 10). É o que alimenta o diário e a evolução.',
      },
    ],
  },
  {
    id: 'treino-plano',
    area: GUIA_AREA.TREINO,
    flags: ['training_center'],
    title: 'Montar um plano de semanas',
    summary: 'De 1 a 16 semanas, nos dias e no tempo que você tem.',
    keywords: ['plano', 'planejar', 'semanas', 'periodização', 'programa', 'treino'],
    screens: ['/treino', '/treino/planos/*'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-planos',
        advanceOn: 'click',
        action: TOQUE('Planos'),
        title: 'Os planos',
        body: 'Um plano dá a cada dia de treino o que fazer, por algumas semanas.',
      },
      {
        id: 'criar',
        route: '/treino',
        goTo: '/treino?aba=planos',
        target: 'treino-planos-criar',
        title: 'Crie o plano',
        body: 'Escolha o objetivo, as semanas e os dias. O assistente monta e você ajusta. O plano ativo vira o "Hoje".',
      },
      {
        id: 'semanas',
        route: '/treino/planos/*',
        target: ['treino-plano-semanas', 'treino-plano-editar-dia'],
        awayText: 'Abra um plano para ver as semanas dele.',
        title: 'Ajuste dia a dia',
        body: 'Cada semana mostra os dias; toque num dia para trocar, tirar ou acrescentar um item.',
        tip: 'Na ficha de qualquer drill, "Pôr no plano" acrescenta ele a um dia.',
      },
    ],
  },
  {
    id: 'treino-biblioteca',
    area: GUIA_AREA.TREINO,
    flags: ['training_center'],
    title: 'Achar um drill na Biblioteca',
    summary: 'Filtrar pelo seu nível, abrir a ficha e levar para o seu treino.',
    keywords: ['biblioteca', 'drill', 'exercício', 'achar', 'filtro', 'nível', 'indicar', 'copiar'],
    screens: ['/treino', '/treino/item/*'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-biblioteca',
        advanceOn: 'click',
        action: TOQUE('Biblioteca'),
        title: 'A Biblioteca',
        body: 'O conteúdo da Equipe PickleRush, dos professores, da comunidade e o que o seu professor deixou só para os alunos dele.',
      },
      {
        id: 'nivel',
        route: '/treino',
        goTo: '/treino?aba=biblioteca',
        target: ['treino-biblioteca-nivel', 'treino-biblioteca-filtros'],
        title: 'Do meu nível',
        body: 'Mostra só o que serve para o seu nível na plataforma (2.0 a 8.0). Sem nível, você vê tudo.',
      },
      {
        id: 'abrir',
        route: '/treino',
        goTo: '/treino?aba=biblioteca',
        target: 'treino-biblioteca-filtros',
        advanceOn: { route: '/treino/item/*' },
        action: 'Toque num item da lista',
        title: 'Abra a ficha',
        body: 'Filtre por tipo, habilidade e local, e toque num item. Cada um diz quem o criou.',
      },
      {
        id: 'levar',
        route: '/treino/item/*',
        target: ['treino-item-registrar', 'treino-item-plano'],
        title: 'Leve para o seu treino',
        body: '"Registrar que fiz" vai para o diário; "Pôr no plano" acrescenta a um dia da semana.',
      },
      {
        id: 'indicar',
        route: '/treino/item/*',
        target: ['treino-item-enviar', 'treino-item-plano'],
        title: 'Indique a alguém',
        body: '"Indicar" manda o item a outros atletas, com um recado. Chega na aba Recebidos deles.',
      },
    ],
  },
  {
    id: 'treino-criar',
    area: GUIA_AREA.TREINO,
    flags: ['training_center'],
    title: 'Criar um drill ou treino',
    summary: 'O tipo, o certo e o errado, fotos e vídeos — e quem vê.',
    keywords: ['criar', 'drill', 'treino', 'publicar', 'vídeo', 'foto', 'ia', 'privado', 'público'],
    screens: ['/treino', '/treino/novo'],
    steps: [
      {
        id: 'criar',
        route: '/treino',
        goTo: '/treino',
        target: 'treino-criar',
        advanceOn: { route: '/treino/novo' },
        action: TOQUE('Criar drill ou treino'),
        title: 'Comece por aqui',
        body: 'Qualquer pessoa cria. O formulário segue o modelo dos cursos de treinador.',
      },
      {
        id: 'tipo',
        route: '/treino/novo',
        goTo: '/treino/novo',
        target: 'treino-editor-tipo',
        title: 'O tipo',
        body: 'Drill, treino em blocos, fundamento, jogada, físico ou estudo. O formulário só mostra o que vale para o tipo escolhido.',
      },
      {
        id: 'ia',
        route: '/treino/novo',
        target: ['treino-editor-ia', 'treino-editor-tipo'],
        title: 'Criar com IA (se quiser)',
        body: 'Monta um pedido para você colar na IA que preferir; a resposta, colada de volta, preenche o formulário. O item leva o selo "IA".',
        tip: 'Revise tudo antes de publicar: a IA erra.',
      },
      {
        id: 'midia',
        route: '/treino/novo',
        target: ['treino-editor-midia', 'treino-editor-tipo'],
        title: 'Fotos e vídeos',
        body: 'Por link (YouTube, Vimeo) ou enviando o arquivo: vídeo de até 60 segundos e 60 MB, imagem de até 3 MB.',
      },
      {
        id: 'visibilidade',
        route: '/treino/novo',
        target: 'treino-editor-visibilidade',
        title: 'Quem vê',
        body: 'Só eu, público (passa pela revisão da equipe; o professor verificado publica direto) ou, para professor, só os seus alunos.',
      },
      {
        id: 'salvar',
        route: '/treino/novo',
        target: ['treino-editor-salvar', 'treino-editor-qualidade'],
        title: 'Salve',
        body: 'O medidor diz o que ainda falta — ele orienta, não impede salvar. O rascunho fica guardado no aparelho enquanto você escreve.',
      },
    ],
  },
  {
    id: 'treino-evolucao',
    area: GUIA_AREA.TREINO,
    flags: ['training_center'],
    title: 'Acompanhar o diário e a evolução',
    summary: 'O que você treinou, semana a semana, e quanto evoluiu.',
    keywords: ['diário', 'evolução', 'carga', 'esforço', 'semana', 'autoavaliação', 'registrar'],
    screens: ['/treino'],
    steps: [
      {
        id: 'diario',
        route: '/treino',
        goTo: '/treino?aba=diario',
        target: ['treino-diario-registrar', 'treino-aba-diario'],
        title: 'O diário',
        body: 'Cada treino registrado, com o planejado ao lado. O que ficou para depois não é falha: a semana segue.',
        tip: 'Não registre dor, lesão ou remédio: para isso, procure um profissional de saúde.',
      },
      {
        id: 'aba-evolucao',
        route: '/treino',
        goTo: '/treino?aba=diario',
        target: 'treino-aba-evolucao',
        advanceOn: 'click',
        action: TOQUE('Evolução'),
        title: 'A evolução',
        body: 'Os números que saem do diário.',
      },
      {
        id: 'carga',
        route: '/treino',
        goTo: '/treino?aba=evolucao',
        target: ['treino-evolucao-carga', 'treino-aba-evolucao'],
        title: 'Minutos e carga',
        body: 'Por semana: os minutos e a carga (esforço × minutos). Subir aos poucos é o que dá resultado.',
      },
      {
        id: 'avaliacao',
        route: '/treino',
        goTo: '/treino?aba=evolucao',
        target: ['treino-evolucao-avaliacao', 'treino-aba-evolucao'],
        title: 'Autoavaliação',
        body: 'A cada 4 semanas, como você se vê em cada fundamento. Comparar com a anterior mostra o que melhorou.',
      },
    ],
  },
  {
    id: 'treino-duvidas',
    area: GUIA_AREA.TREINO,
    flags: ['training_center'],
    title: 'Tirar uma dúvida com o professor',
    summary: 'Perguntas privadas, só entre você e o seu professor.',
    keywords: ['dúvida', 'pergunta', 'professor', 'conversa', 'treino'],
    screens: ['/treino'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-duvidas',
        advanceOn: 'click',
        action: TOQUE('Dúvidas'),
        title: 'As dúvidas',
        body: 'Só vocês dois veem a conversa.',
      },
      {
        id: 'nova',
        route: '/treino',
        goTo: '/treino?aba=duvidas',
        target: ['treino-duvidas-nova', 'treino-duvidas-lista'],
        title: 'Pergunte',
        body: 'Sobre um drill, um golpe ou o seu treino. Aparece para quem tem professor com vínculo ativo.',
        tip: 'Na ficha de um drill, "Perguntar ao professor" já leva o item junto.',
      },
    ],
  },
  {
    id: 'treino-alunos',
    area: GUIA_AREA.TREINO,
    audience: 'professor',
    flags: ['training_center'],
    title: 'Treinos para os seus alunos',
    summary: 'Enviar com prazo, confirmar sessões e responder dúvidas.',
    keywords: ['aluno', 'alunos', 'enviar', 'prazo', 'professor', 'confirmar', 'sessão'],
    screens: ['/treino', '/treino/item/*'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-alunos',
        advanceOn: 'click',
        action: TOQUE('Alunos'),
        title: 'Os seus alunos',
        body: 'O que cada um recebeu e fez, e as sessões que eles compartilharam com você.',
      },
      {
        id: 'lista',
        route: '/treino',
        goTo: '/treino?aba=alunos',
        target: ['treino-alunos-lista', 'treino-aba-alunos'],
        title: 'Quem treina com você',
        body: 'Só aparecem os alunos com vínculo ativo — é deles que você recebe sessões e dúvidas.',
      },
      {
        id: 'confirmar',
        route: '/treino',
        goTo: '/treino?aba=alunos',
        target: ['treino-alunos-confirmar', 'treino-alunos-lista'],
        title: 'Confirme e comente',
        body: 'Uma sessão compartilhada espera a sua confirmação. Um comentário curto vale mais que um longo.',
      },
      {
        id: 'enviar',
        title: 'Enviar um treino',
        body: 'Na ficha de qualquer item seu ou da Biblioteca, "Enviar ou indicar": escolha os alunos e o prazo. Chega na aba Recebidos deles.',
      },
    ],
  },
  {
    id: 'treino-admin',
    area: GUIA_AREA.TREINO,
    audience: 'admin',
    flags: ['training_center'],
    title: 'Cuidar do Centro de Treino (admin)',
    summary: 'Revisão, denúncias, conteúdo, biblioteca e as configurações.',
    keywords: ['admin', 'treino', 'revisão', 'denúncia', 'moderação', 'biblioteca', 'semente', 'configuração'],
    screens: ['/admin/painel'],
    steps: [
      {
        id: 'secao',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-revisao',
        target: 'admin-secao-treino',
        title: 'A seção Treino',
        body: 'Os números do topo levam às telas: itens, revisão, denúncias e biblioteca.',
      },
      {
        id: 'revisao',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-revisao',
        target: ['admin-treino-revisao', 'admin-secao-treino'],
        title: 'Revisão',
        body: 'O conteúdo público que passa por revisão espera aqui. "Aprovar e publicar" põe na Biblioteca; "Aprovar e verificar o professor" também faz o próximo conteúdo dele entrar direto; "Recusar" devolve ao autor com uma nota.',
      },
      {
        id: 'denuncias',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-denuncias',
        target: ['admin-treino-denuncias', 'admin-secao-treino'],
        title: 'Denúncias',
        body: 'O que alguém achou errado ou perigoso, com o motivo. Marque procedente ou improcedente, ou oculte o item — ele sai da Biblioteca na hora.',
      },
      {
        id: 'conteudo',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-conteudo',
        target: ['admin-treino-conteudo', 'admin-secao-treino'],
        title: 'Todo o conteúdo',
        body: 'Todos os itens, de todos os autores: buscar, destacar, ocultar e editar. Editar mantém a autoria; ocultar e excluir avisam o autor.',
      },
      {
        id: 'biblioteca',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-biblioteca',
        target: ['admin-treino-biblioteca', 'admin-secao-treino'],
        title: 'A biblioteca da plataforma',
        body: 'Instalar a biblioteca inicial da Equipe PickleRush e importar itens em lote. Instalar de novo é seguro: não mexe no que a equipe editou nem recria o que foi apagado.',
      },
      {
        id: 'config',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-config',
        target: ['admin-treino-config', 'admin-secao-treino'],
        title: 'As configurações',
        body: 'A revisão de atletas e de professores, quem pode publicar, o envio de imagens e vídeos (tamanho e duração) e o compartilhamento.',
      },
    ],
  },

  /* ------------------------------------------------------- gamificação -- */
  {
    id: 'gamificacao-entender',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Entender o XP, o nível e o tier',
    summary: 'O que a gamificação mede, de onde vem o seu XP e onde tirar dúvidas.',
    keywords: ['xp', 'nível', 'tier', 'pontos', 'gamificação', 'como funciona', 'jornada'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'resumo',
        route: '/gamification',
        goTo: '/gamification',
        target: 'gamificacao-resumo',
        title: 'O resumo da sua jornada',
        body: [
          'O tier é a faixa grande (Bronze, Prata, Ouro…); o nível é o degrau dentro dela. Ao lado, as semanas seguidas jogando e as conquistas que você já abriu.',
          'Tudo isso sai do que você faz de verdade na plataforma: jogos, torneios, missões e conquistas.',
        ],
        tip: 'XP não se gasta nem se compra — ele só mede o quanto você jogou e evoluiu.',
      },
      {
        id: 'origem',
        route: '/gamification',
        target: 'xp-origem',
        title: 'De onde vem o seu XP',
        body: 'Abra este cartão para ver a conta: quanto veio de jogos, de torneios, de bônus de conquistas e de missões. Não existe XP escondido.',
      },
      {
        id: 'como-funciona',
        route: '/gamification',
        target: 'gamificacao-como-funciona',
        title: 'O "Como funciona" de cada aba',
        body: 'No topo de cada seção há um cartão curto com o essencial daquela parte. Ele abre na primeira vez e depois lembra se você o recolheu.',
      },
      {
        id: 'guia',
        route: '/gamification',
        target: 'gamificacao-guia',
        advanceOn: { route: '/gamification/como-funciona' },
        action: 'Toque no ponto de interrogação',
        title: 'O guia completo',
        body: 'Cada conceito explicado, por público (atleta, professor, arena, clube), com os números reais da plataforma.',
      },
      {
        id: 'busca',
        route: '/gamification/como-funciona',
        target: 'guia-busca',
        title: 'Busque pelo que quer saber',
        body: 'Digite "sequência", "duelo" ou "privacidade". A busca ignora acento e mostra primeiro o termo que tem o nome que você digitou.',
      },
    ],
  },
  {
    id: 'gamificacao-missoes',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Cumprir missões e primeiros passos',
    summary: 'Metas curtas por dia, semana e mês — e o roteiro de quem está começando.',
    keywords: ['missão', 'missões', 'diária', 'semanal', 'mensal', 'primeiros passos', 'bônus'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'primeiros-passos',
        route: '/gamification',
        goTo: '/gamification?aba=jornada',
        target: 'primeiros-passos',
        title: 'Os primeiros passos',
        body: 'Um roteiro curto para quem acabou de chegar: cada passo concluído já soma XP. Quando você termina (ou dispensa), ele sai daqui.',
        tip: 'Dispensou sem querer? Em Preferências → "Como aparece para mim" dá para mostrá-los de novo.',
      },
      {
        id: 'abas',
        route: '/gamification',
        target: 'gamificacao-abas',
        title: 'As seções',
        body: 'Jornada, Missões, Competir, Social e Recompensas. A pessoa só vê as que a plataforma deixou ligadas.',
      },
      {
        id: 'aba-missoes',
        route: '/gamification',
        target: 'aba-missoes',
        advanceOn: 'click',
        action: TOQUE('Missões'),
        title: 'Missões',
        body: 'Abra a seção das suas metas.',
      },
      {
        id: 'missoes',
        route: '/gamification',
        target: 'missoes',
        title: 'Diárias, semanais e mensais',
        body: [
          'Cada missão é medida pelo que você joga de verdade; o progresso anda sozinho.',
          'Terminar todas as de um período rende um bônus de XP — e as missões novas chegam quando o período vira.',
        ],
        tip: 'Missão que não deu para cumprir não tira nada de você. Ela só não conta.',
      },
    ],
  },
  {
    id: 'gamificacao-sequencia',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Manter a sequência e tirar férias',
    summary: 'Semanas seguidas jogando, a folga automática e as férias.',
    keywords: ['sequência', 'streak', 'semanas', 'férias', 'folga', 'pausa'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'sequencia',
        route: '/gamification',
        goTo: '/gamification?aba=jornada',
        target: 'sequencia',
        title: 'A sua sequência',
        body: [
          'Conta as semanas seguidas (de segunda a domingo) em que você jogou pelo menos uma vez. A semana de agora ainda está aberta: se você não jogou ainda, ela aparece "em risco", não quebrada.',
          'Quem para por muito tempo volta a zero — o recorde, porém, fica guardado.',
        ],
        tip: 'Uma semana sem jogar por mês é perdoada sozinha (a folga automática). Duas seguidas, não.',
      },
      {
        id: 'ferias',
        route: '/gamification',
        target: ['sequencia-ferias', 'sequencia'],
        title: 'Férias',
        body: [
          `Vai viajar ou ficar parado? Declare férias e a sequência fica preservada por até ${STREAK_VACATION_MAX_DAYS / 7} semanas — elas não somam, mas também não quebram.`,
          `Dá para tirar férias de novo depois de ${STREAK_VACATION_COOLDOWN_DAYS} dias, para a pausa não virar atalho.`,
        ],
        tip: 'Voltou antes? Encerre as férias no mesmo cartão.',
      },
    ],
  },
  {
    id: 'gamificacao-revisao',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Ver a revisão da semana ou do mês',
    summary: 'O que você fez no período, comparado com o anterior.',
    keywords: ['revisão', 'resumo', 'semana', 'mês', 'balanço', 'período'],
    screens: ['/gamification/revisao'],
    steps: [
      {
        id: 'tipo',
        route: '/gamification/revisao',
        goTo: '/gamification/revisao',
        target: 'revisao-tipo',
        title: 'Semana ou mês',
        body: 'Escolha o tamanho do período. A revisão compara com o anterior para mostrar para onde você está indo.',
      },
      {
        id: 'periodo',
        route: '/gamification/revisao',
        target: 'revisao-periodo',
        title: 'Volte no tempo',
        body: 'As setas levam ao período anterior e de volta. Não dá para ver o futuro, claro.',
      },
      {
        id: 'corpo',
        route: '/gamification/revisao',
        target: 'revisao-corpo',
        title: 'O resumo',
        body: 'Jogos, vitórias, dias ativos e missões — e a conquista que está mais perto de abrir. Nada aqui é cobrança: é só um espelho.',
      },
    ],
  },
  {
    id: 'gamificacao-competir',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Competir: temporada, duelo e desafios',
    summary: 'O placar do mês, o duelo da semana e os desafios abertos.',
    keywords: ['competir', 'temporada', 'duelo', 'desafio', 'ranking', 'hall'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'aba',
        route: '/gamification',
        goTo: '/gamification',
        target: 'aba-competir',
        advanceOn: 'click',
        action: TOQUE('Competir'),
        title: 'Competir',
        body: 'Abra a seção da disputa.',
      },
      {
        id: 'temporada',
        route: '/gamification',
        target: 'temporada',
        title: 'A temporada do mês',
        body: 'Cada mês é uma temporada: o XP do mês decide a posição e recomeça do zero. No fim, os melhores recebem um prêmio em XP.',
        tip: 'Só aparece no placar público quem escolheu aparecer e já chegou ao tier mínimo.',
      },
      {
        id: 'duelo',
        route: '/gamification',
        target: 'duelo',
        title: 'O duelo da semana',
        body: 'Você é emparelhado com alguém de nível parecido e vence quem jogar melhor naquela semana. Só entra quem aceitou participar.',
      },
      {
        id: 'desafios',
        route: '/gamification',
        target: 'desafios',
        title: 'Desafios',
        body: 'Competições com começo, fim e placar, criadas pela plataforma, por arenas, professores e clubes. O servidor mede — você só joga.',
      },
    ],
  },
  {
    id: 'gamificacao-social',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Avaliar quem jogou com você',
    summary: 'Avaliações, cartas aos parceiros e a sua reputação.',
    keywords: ['avaliação', 'avaliar', 'carta', 'parceiro', 'reputação', 'elogio', 'social'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'aba',
        route: '/gamification',
        goTo: '/gamification',
        target: 'aba-social',
        advanceOn: 'click',
        action: TOQUE('Social'),
        title: 'Social',
        body: 'Abra a seção da convivência.',
      },
      {
        id: 'reputacao',
        route: '/gamification',
        target: 'reputacao',
        title: 'A sua reputação',
        body: 'A média das avaliações que você recebeu e os elogios mais comuns. Você vê só a média — nunca quem deu qual nota.',
      },
      {
        id: 'avaliacoes',
        route: '/gamification',
        target: 'avaliacoes',
        title: 'Avaliar um jogo',
        body: 'Depois de jogar, dê uma nota e escolha elogios. É rápido, e quem recebe vê só o conjunto.',
      },
      {
        id: 'cartas',
        route: '/gamification',
        target: 'cartas',
        title: 'Cartas aos parceiros',
        body: 'Um agradecimento curto a quem jogou com você. Anônimo por padrão; quem recebe pode apagar ou denunciar.',
      },
    ],
  },
  {
    id: 'gamificacao-vinculos',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Rivais, crews e mentorias',
    summary: 'Com quem você joga mais, os grupos de amigos e quem ensina quem.',
    keywords: ['vínculos', 'rival', 'crew', 'mentoria', 'mentor', 'grupo', 'amigos'],
    screens: ['/vinculos'],
    steps: [
      {
        id: 'abas',
        route: '/vinculos',
        goTo: '/vinculos',
        target: 'vinculos-abas',
        title: 'Três tipos de vínculo',
        body: 'Rivais (de quem você mais enfrenta), crews (grupos de amigos) e mentorias (um ensina, o outro aprende).',
      },
      {
        id: 'rivais',
        route: '/vinculos',
        target: 'vinculos-rivais',
        title: 'Rivais',
        body: 'Quem você mais enfrentou — e como ficou o placar entre vocês. Os rivais surgem sozinhos dos seus jogos.',
      },
      {
        id: 'aba-crews',
        route: '/vinculos',
        target: 'vinculos-aba-crews',
        advanceOn: 'click',
        action: TOQUE('Crews'),
        title: 'Crews',
        body: 'Abra os seus grupos.',
      },
      {
        id: 'crews',
        route: '/vinculos',
        target: 'vinculos-crews',
        title: 'Crie ou entre num grupo',
        body: 'Uma crew soma o que o grupo joga junto. Dá para sair quando quiser, em um toque.',
      },
      {
        id: 'aba-mentorias',
        route: '/vinculos',
        target: 'vinculos-aba-mentorias',
        advanceOn: 'click',
        action: TOQUE('Mentorias'),
        title: 'Mentorias',
        body: 'Abra as suas mentorias.',
      },
      {
        id: 'mentorias',
        route: '/vinculos',
        target: 'vinculos-mentorias',
        title: 'Ensinar ou aprender',
        body: 'Convide alguém como mentor ou como aprendiz. A outra pessoa precisa aceitar — ninguém é colocado numa mentoria sem querer.',
      },
    ],
  },
  {
    id: 'gamificacao-recompensas',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Pedir uma recompensa',
    summary: 'Benefícios de arenas, professores e clubes para quem joga e evolui.',
    keywords: ['recompensa', 'prêmio', 'benefício', 'código', 'resgatar', 'brinde'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'aba',
        route: '/gamification',
        goTo: '/gamification',
        target: 'aba-recompensas',
        advanceOn: 'click',
        action: TOQUE('Recompensas'),
        title: 'Recompensas',
        body: 'Abra a seção dos benefícios.',
      },
      {
        id: 'lista',
        route: '/gamification',
        target: 'recompensas',
        title: 'O que você pode pedir',
        body: [
          'Cada recompensa diz o critério (por exemplo, um tier ou um número de jogos) e quem a oferece.',
          'Quando você se qualifica, pede e recebe um código. Quem oferece confere e libera — nada é entregue sozinho.',
        ],
        tip: 'Recompensas não são compradas com XP: o XP mostra que você se qualificou, e não é gasto.',
      },
    ],
  },
  {
    id: 'gamificacao-hall',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Ver o Hall da Fama e a temporada',
    summary: 'Os maiores atletas por XP, por estado e por mês.',
    keywords: ['hall da fama', 'placar', 'ranking', 'temporada', 'estado', 'posição'],
    screens: ['/hall-da-fama'],
    steps: [
      {
        id: 'abas',
        route: '/hall-da-fama',
        goTo: '/hall-da-fama',
        target: 'hall-abas',
        title: 'Hall ou temporada',
        body: 'O Hall soma o XP de sempre; a temporada, só o do mês — e recomeça todo mês.',
      },
      {
        id: 'estado',
        route: '/hall-da-fama',
        target: 'hall-estado',
        title: 'Filtre por estado',
        body: 'Veja só os atletas do seu estado — ou o Brasil todo.',
      },
      {
        id: 'minha-posicao',
        route: '/hall-da-fama',
        target: 'hall-minha-posicao',
        title: 'Onde você está',
        body: 'A sua posição aparece aqui. Se você não está no placar público, o motivo vem dito — e o atalho leva às preferências, onde você escolhe se quer aparecer.',
      },
    ],
  },
  {
    id: 'gamificacao-conquistas',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Explorar as conquistas',
    summary: 'Os troféus, o que falta para abrir cada um e quanto XP dão.',
    keywords: ['conquista', 'troféu', 'raridade', 'medalha', 'progresso'],
    screens: ['/conquistas'],
    steps: [
      {
        id: 'filtros',
        route: '/conquistas',
        goTo: '/conquistas',
        target: 'conquistas-filtros',
        title: 'Filtre o catálogo',
        body: 'Por família (jogos, torneios, social…) e por raridade. Dá para ver só as que você já abriu.',
      },
      {
        id: 'lista',
        route: '/conquistas',
        target: 'conquistas-lista',
        title: 'O que falta para abrir',
        body: 'Cada cartão mostra o seu progresso. Ao abrir uma conquista você ganha XP de bônus — e pode escolher uma como título ao lado do seu nome.',
        tip: 'As conquistas que a plataforma ainda não consegue medir ficam numa lista "Em breve" e não entram na sua conta.',
      },
    ],
  },
  {
    id: 'gamificacao-privacidade',
    area: GUIA_AREA.GAMIFICACAO,
    flags: ['gamification_v2'],
    title: 'Escolher o que os outros veem de você',
    summary: 'Privacidade, avisos e como você aparece na gamificação.',
    keywords: ['privacidade', 'placar', 'preferências', 'avisos', 'título', 'ocultar', 'aparecer'],
    screens: ['/gamification', '/gamification/configuracoes'],
    steps: [
      {
        id: 'abrir',
        route: '/gamification',
        goTo: '/gamification',
        target: 'gamificacao-preferencias',
        advanceOn: { route: '/gamification/configuracoes' },
        action: 'Toque na engrenagem',
        title: 'As preferências',
        body: 'A engrenagem leva ao lugar onde você decide o que a gamificação mostra, o que ela avisa e como você aparece.',
      },
      {
        id: 'privacidade',
        route: '/gamification/configuracoes',
        target: 'prefs-privacidade',
        title: 'Privacidade',
        body: 'Escolha se o seu nome e a sua foto entram no placar público e se o seu perfil mostra tier e conquistas. A regra vale no servidor, não só na tela.',
        tip: 'Desligado, você continua ranqueando e recebendo prêmios — só ninguém vê.',
      },
      {
        id: 'interacao',
        route: '/gamification/configuracoes',
        target: 'prefs-interacao',
        title: 'Interação com outros atletas',
        body: 'Duelo, avaliações e cartas só chegam a você se você deixar. Desligar é de um toque e sem explicação.',
      },
      {
        id: 'avisos',
        route: '/gamification/configuracoes',
        target: 'prefs-avisos',
        title: 'Avisos',
        body: 'Só o que você quer receber no sino: resumo da semana, duelo e resultado dos desafios.',
      },
      {
        id: 'aparencia',
        route: '/gamification/configuracoes',
        target: 'prefs-aparencia',
        title: 'Como aparece para mim',
        body: 'Comemorações dos marcos e o título que fica ao lado do seu nome — o tier ou uma conquista que você escolher.',
      },
    ],
  },
  {
    id: 'gamificacao-oferecer-arena',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'arena',
    flags: ['gamification_v2'],
    title: 'Engajar os atletas da sua arena',
    summary: 'A saúde da arena, as metas do mês, e como criar desafios e recompensas.',
    keywords: ['engajamento', 'desafio', 'recompensa', 'meta', 'saúde', 'arena', 'fidelizar'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'aba',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=engajamento',
        target: 'arena-aba-engajamento',
        title: 'Engajamento',
        body: 'Fica em Desempenho. Reúne a saúde da arena, as metas do mês, os desafios e as recompensas que você oferece.',
      },
      {
        id: 'saude',
        route: '/arenas/*/gerir',
        target: 'oferta-saude',
        title: 'A saúde da arena',
        body: 'Uma nota de 0 a 100 que só você vê, com o que a puxou para cima e para baixo — e sugestões do que fazer.',
      },
      {
        id: 'metas',
        route: '/arenas/*/gerir',
        target: 'oferta-metas',
        title: 'Metas do mês',
        body: 'Escolha números a alcançar (jogos, jogadores novos…) e acompanhe o quanto já foi. Nada é cobrado de ninguém.',
      },
      {
        id: 'aba-desafios',
        route: '/arenas/*/gerir',
        target: 'oferta-aba-desafios',
        advanceOn: 'click',
        action: TOQUE('Desafios'),
        title: 'Desafios',
        body: 'Competições com placar medido pelo servidor.',
      },
      {
        id: 'novo-desafio',
        route: '/arenas/*/gerir',
        target: 'oferta-desafio-novo',
        advanceOn: { appears: 'oferta-desafio-form' },
        action: TOQUE('Novo desafio'),
        title: 'Crie um desafio',
        body: 'Por exemplo "Quem mais joga esta semana", com um brinde para o 1º lugar.',
      },
      {
        id: 'form-desafio',
        route: '/arenas/*/gerir',
        target: 'oferta-desafio-form',
        title: 'O que medir e por quanto tempo',
        body: [
          'Dê um nome, escolha o que será medido (jogos, vitórias, dias jogados…) e as datas de início e fim.',
          'Você define os prêmios; o placar é calculado pelo servidor a partir dos jogos reais, então ninguém precisa conferir à mão.',
        ],
      },
      {
        id: 'salvar-desafio',
        route: '/arenas/*/gerir',
        target: 'oferta-desafio-salvar',
        title: 'Salvar',
        body: 'O desafio aparece para os atletas. Antes de começar dá para editar; depois de começar, só cancelar.',
      },
    ],
  },
  {
    id: 'gamificacao-recompensa-arena',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'arena',
    flags: ['gamification_v2'],
    title: 'Criar uma recompensa na sua arena',
    summary: 'Um benefício com critério claro e código para você conferir.',
    keywords: ['recompensa', 'benefício', 'brinde', 'código', 'desconto', 'arena'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'aba',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=engajamento',
        target: 'oferta-aba-recompensas',
        advanceOn: 'click',
        action: TOQUE('Recompensas'),
        title: 'Recompensas',
        body: 'Os benefícios que você oferece a quem joga e evolui.',
      },
      {
        id: 'nova',
        route: '/arenas/*/gerir',
        target: 'oferta-recompensa-nova',
        advanceOn: { appears: 'oferta-recompensa-form' },
        action: TOQUE('Nova recompensa'),
        title: 'Nova recompensa',
        body: 'Pode ser uma hora de quadra, uma bebida, um desconto na aula…',
      },
      {
        id: 'form',
        route: '/arenas/*/gerir',
        target: 'oferta-recompensa-form',
        title: 'Critério claro',
        body: [
          'Diga o que é, quem pode pedir (um tier, um número de jogos) e quantas unidades há.',
          'Quem se qualifica pede e recebe um código; você confere e libera. Nada sai sem você.',
        ],
      },
      {
        id: 'salvar',
        route: '/arenas/*/gerir',
        target: 'oferta-recompensa-salvar',
        title: 'Salvar',
        body: 'Os pedidos chegam na lista abaixo: Liberar, Marcar como usada ou Recusar.',
      },
    ],
  },
  {
    id: 'gamificacao-oferecer-professor',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'professor',
    flags: ['gamification_v2'],
    title: 'Engajar os seus alunos',
    summary: 'A saúde da sua agenda, as metas, os desafios e as recompensas.',
    keywords: ['engajamento', 'alunos', 'desafio', 'recompensa', 'meta', 'professor'],
    screens: ['/aulas'],
    steps: [
      {
        id: 'secao',
        route: '/aulas',
        goTo: '/aulas?secao=engajamento',
        target: 'professor-aba-engajamento',
        title: 'Engajamento',
        body: 'No Painel do professor, esta seção reúne saúde, metas, desafios e recompensas para os seus alunos.',
      },
      {
        id: 'saude',
        route: '/aulas',
        target: 'oferta-saude',
        title: 'A saúde da sua agenda',
        body: 'Uma nota que só você vê, com o que ajuda e o que atrapalha — e sugestões do que fazer.',
      },
      {
        id: 'metas',
        route: '/aulas',
        target: 'oferta-metas',
        title: 'Metas do mês',
        body: 'Defina números a alcançar (aulas dadas, alunos novos…) e veja o quanto já foi.',
      },
      {
        id: 'desafios',
        route: '/aulas',
        target: 'oferta-aba-desafios',
        title: 'Desafios e recompensas',
        body: 'Nas abas ao lado você cria desafios para os alunos e benefícios que eles pedem ao se qualificar — com código para você conferir.',
      },
    ],
  },
  {
    id: 'gamificacao-admin-configurar',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'admin',
    flags: ['gamification_v2'],
    title: 'Configurar a gamificação (admin)',
    summary: 'Ligar e desligar módulos, ajustar prêmios e avisos da plataforma.',
    keywords: ['admin', 'configuração', 'módulos', 'prêmios', 'limiares', 'avisos', 'gamificação'],
    screens: ['/admin/painel'],
    steps: [
      {
        id: 'secao',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=gam-config',
        target: 'admin-secao-gamificacao',
        title: 'A seção Gamificação',
        body: 'Cinco telas: Configuração, Desafios, Recompensas, Integridade e Métricas. A flag gamification_v2 é o interruptor geral; o resto se decide aqui.',
      },
      {
        id: 'modulos',
        route: '/admin/painel',
        target: 'admin-gam-modulos',
        title: 'Módulos',
        body: 'Cada parte (missões, duelo, avaliações, recompensas…) liga e desliga sozinha. Módulo desligado some das telas e o servidor para de rodar a parte dele.',
      },
      {
        id: 'premios',
        route: '/admin/painel',
        target: 'admin-gam-premios',
        title: 'Prêmios e limiares',
        body: 'Quanto vale cada colocação da temporada, o tier mínimo do placar público e os limites das avaliações e dos duelos. Cada campo diz o intervalo aceito.',
      },
      {
        id: 'avisos',
        route: '/admin/painel',
        target: 'admin-gam-avisos',
        title: 'Avisos do servidor',
        body: 'Quais avisos o servidor envia. Cada pessoa ainda pode desligar o que não quer, nas preferências dela.',
      },
      {
        id: 'salvar',
        route: '/admin/painel',
        target: 'admin-gam-salvar',
        title: 'Salvar',
        body: 'Mostra quantas alterações estão pendentes. "Padrões de fábrica" volta tudo ao que a plataforma recomenda — só vale depois de salvar.',
        tip: 'Cada alteração fica na auditoria.',
      },
    ],
  },
  {
    id: 'gamificacao-admin-integridade',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'admin',
    flags: ['gamification_v2'],
    title: 'Revisar a integridade (admin)',
    summary: 'Sinais do antifarm, contas ocultas e cartas denunciadas.',
    keywords: ['admin', 'integridade', 'antifarm', 'moderação', 'sinais', 'cartas', 'denúncia'],
    screens: ['/admin/painel'],
    steps: [
      {
        id: 'abas',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=gam-integrity',
        target: 'admin-gam-integridade-abas',
        title: 'Sinais, contas e cartas',
        body: 'Três filas de revisão: o que o antifarm marcou, as contas que você ocultou e as cartas denunciadas.',
      },
      {
        id: 'sinais',
        route: '/admin/painel',
        target: 'admin-gam-sinais',
        title: 'O servidor marca, nunca pune',
        body: [
          'Cada sinal traz o motivo e a gravidade. Quem tem sinal grave fica fora do placar público até você decidir — o XP e os jogos continuam intactos.',
          'Marque como revisado quando tiver olhado; o que ficou sem decisão fica na fila "Abertos".',
        ],
      },
    ],
  },
  {
    id: 'gamificacao-admin-metricas',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'admin',
    flags: ['gamification_v2'],
    title: 'Acompanhar as métricas (admin)',
    summary: 'O retrato diário do uso: quem joga, quem engaja e para onde vai.',
    keywords: ['admin', 'métricas', 'retrato', 'uso', 'evolução', 'gamificação'],
    screens: ['/admin/painel'],
    steps: [
      {
        id: 'metricas',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=gam-metrics',
        target: 'admin-gam-metricas',
        title: 'O retrato diário',
        body: 'O servidor grava uma foto por dia, sem dados pessoais — só contagens. Aqui você acompanha a evolução e vê se algum módulo ficou parado.',
      },
    ],
  },

  /* -------------------------------------------------------- minha área -- */
  {
    id: 'minha-area',
    area: GUIA_AREA.COMECAR,
    flags: ['user_hub'],
    title: 'Conhecer a Minha área',
    summary: 'O que precisa de você e tudo o que é seu, num lugar só.',
    keywords: ['minha área', 'perfil', 'pendências', 'precisa de você', 'central', 'meus dados'],
    screens: ['/perfil'],
    steps: [
      {
        id: 'pendencias',
        route: '/perfil',
        goTo: '/perfil',
        target: ['minha-area-pendencias', 'minha-area-secoes'],
        title: 'Precisa de você',
        body: 'Pedidos de reserva, convites, aulas para responder, treinos recebidos e dúvidas esperando — cada linha leva ao lugar que resolve. Sem nada pendente, a faixa não aparece.',
      },
      {
        id: 'secoes',
        route: '/perfil',
        goTo: '/perfil',
        target: 'minha-area-secoes',
        title: 'As seções',
        body: 'Em "Você", o que é seu: resumo, perfil, jogo, agenda, torneios e conta. "Gerencio" aparece para quem dá aula, gere arena ou administra a plataforma.',
      },
      {
        id: 'editar',
        route: '/perfil',
        goTo: '/perfil',
        target: ['perfil-editar', 'minha-area-secoes'],
        title: 'Editar o perfil',
        body: 'Foto, cidade, interesses, nível e privacidade.',
      },
    ],
  },

  /* ------------------------------------------------------------- conta -- */
  {
    id: 'escolher-aparencia',
    area: GUIA_AREA.CONTA,
    flags: ['dark_mode'],
    title: 'Mudar a aparência (modo escuro)',
    summary: 'Claro, escuro ou automático — escolha sua, neste aparelho.',
    keywords: ['modo escuro', 'tema', 'aparência', 'claro', 'escuro'],
    screens: ['/configuracoes'],
    steps: [
      {
        id: 'cartao',
        route: '/configuracoes',
        goTo: '/configuracoes',
        target: 'config-aparencia',
        title: 'Aparência',
        body: 'Claro, Escuro ou Automático (acompanha o aparelho). A escolha é sua e fica neste aparelho.',
        tip: 'Também dá para trocar no menu do seu avatar e, no celular, na gaveta do menu.',
      },
    ],
  },
  {
    id: 'escolher-cards-do-inicio',
    area: GUIA_AREA.CONTA,
    flagsTodas: ['personalized_home', 'home_cards'],
    title: 'Escolher o que aparece no início',
    summary: 'Ligar, desligar e ordenar os cards da tela inicial.',
    keywords: ['início', 'cards', 'personalizar', 'tela inicial', 'ordem'],
    screens: ['/', '/configuracoes'],
    steps: [
      {
        id: 'personalizar',
        route: '/',
        goTo: '/',
        target: 'inicio-personalizar',
        advanceOn: { appears: 'inicio-seletor' },
        action: TOQUE('Personalizar'),
        title: 'Personalizar',
        body: 'O início mostra os cards que você escolher, na ordem que você quiser.',
      },
      {
        id: 'ligados',
        route: '/',
        target: 'inicio-seletor',
        title: 'Ligue, desligue e ordene',
        body: 'O interruptor tira ou põe o card; as setas mudam a ordem. A tela atrás muda na hora — não há o que salvar.',
        tip: '"Sugeridos para você" traz os cards do que você faz na plataforma.',
      },
    ],
  },
  {
    id: 'escolher-notificacoes',
    area: GUIA_AREA.CONTA,
    title: 'Escolher os seus avisos',
    summary: 'Quais notificações você quer receber.',
    keywords: ['notificação', 'aviso', 'push', 'e-mail', 'configurações'],
    screens: ['/configuracoes'],
    steps: [
      {
        id: 'notificacoes',
        route: '/configuracoes',
        goTo: '/configuracoes',
        target: 'config-notificacoes',
        title: 'Notificações',
        body: 'Ligue ou desligue cada tipo de aviso: torneios, reservas, clubes, mensagens.',
      },
      {
        id: 'push',
        route: '/configuracoes',
        target: ['config-push', 'config-notificacoes'],
        title: 'No celular',
        body: 'Com a plataforma instalada no celular, dá para receber os avisos como notificação do aparelho.',
      },
    ],
  },
  {
    id: 'privacidade-e-dados',
    area: GUIA_AREA.CONTA,
    title: 'Privacidade e os seus dados',
    summary: 'Quem vê o seu contato e como baixar tudo o que é seu.',
    keywords: ['privacidade', 'lgpd', 'dados', 'contato', 'diretório', 'baixar'],
    screens: ['/perfil/editar', '/configuracoes'],
    steps: [
      {
        id: 'contato',
        route: '/perfil/editar',
        goTo: '/perfil/editar',
        target: 'perfil-comunidade',
        title: 'Quem vê o seu contato',
        body: 'Em "Comunidade e privacidade" você escolhe o que fica visível e se aparece no diretório de atletas.',
      },
      {
        id: 'dados',
        route: '/configuracoes',
        goTo: '/configuracoes',
        target: 'config-dados',
        title: 'Baixar os seus dados',
        body: 'Em "Baixar meus dados" você recebe um arquivo com tudo o que a plataforma guarda sobre você.',
      },
    ],
  },
];

/* ============================================ os tutoriais viram guias == */

/**
 * Onde cada passo dos tutoriais das ferramentas acontece na tela. O TEXTO é o
 * dos tutoriais (fonte única, `tutorials.js`); aqui só se diz ONDE apontar.
 */
const ANCORAS_DOS_TUTORIAIS = Object.freeze({
  [TUTORIAL_ID.TOURNAMENT]: {
    route: '/torneios/*/gerenciar',
    goTo: '/perfil/torneios',
    awayText: 'Abra um torneio que você organiza: Perfil → Meus torneios, e depois "Gerenciar torneio".',
    area: GUIA_AREA.COMPETIR,
    title: 'Organizar um torneio',
    summary: 'Do rascunho ao ranking: modalidades, inscrições, sorteio e resultados.',
    alvos: {
      'visao-geral': 'torneio-gestao-secoes',
      criar: ['torneio-aba-geral', 'torneio-gestao-secoes'],
      modalidades: ['torneio-aba-modalidades', 'torneio-gestao-secoes'],
      inscricoes: ['torneio-aba-inscricoes', 'torneio-gestao-secoes'],
      sorteio: ['torneio-aba-sorteio', 'torneio-gestao-secoes'],
      resultados: ['torneio-aba-resultados', 'torneio-gestao-secoes'],
      encerrar: ['torneio-status', 'torneio-aba-geral'],
      acompanhar: 'torneio-pagina-publica',
    },
  },
  [TUTORIAL_ID.GAME_DAY_PLAY]: {
    route: '/dia-de-jogo/*',
    goTo: '/dia-de-jogo',
    awayText: 'Abra um dia de jogo no formato Play (Jogar → Dia de jogo).',
    area: GUIA_AREA.JOGAR,
    title: 'Conduzir um dia de jogo — Play',
    summary: 'Participantes, a fila, as partidas quadra a quadra e o telão.',
    formatos: [GAME_DAY_FORMAT.PLAY],
    alvos: {
      'o-que-e': 'dia-de-jogo-regras',
      criar: ['dia-de-jogo-config', 'dia-de-jogo-regras'],
      participantes: ['dia-de-jogo-inserir-atletas', 'dia-de-jogo-participantes'],
      partidas: ['dia-de-jogo-criar-partida', 'dia-de-jogo-quadras'],
      'simples-duplas': 'dia-de-jogo-quadras',
      ajustes: ['dia-de-jogo-ordem', 'dia-de-jogo-quadras'],
      previsao: 'dia-de-jogo-telao',
    },
  },
  [TUTORIAL_ID.GAME_DAY_AMERICANO]: {
    route: '/dia-de-jogo/*',
    goTo: '/dia-de-jogo',
    awayText: 'Abra um dia de jogo no formato Americano (Jogar → Dia de jogo).',
    area: GUIA_AREA.JOGAR,
    title: 'Conduzir um dia de jogo — Americano',
    summary: 'Participantes, o sorteio da grade, os placares e o ranking do dia.',
    formatos: [GAME_DAY_FORMAT.AMERICANO, GAME_DAY_FORMAT.MEXICANO, GAME_DAY_FORMAT.KING_OF_COURT],
    alvos: {
      'o-que-e': 'dia-de-jogo-regras',
      criar: ['dia-de-jogo-inserir-atletas', 'dia-de-jogo-participantes'],
      sortear: ['dia-de-jogo-sortear', 'dia-de-jogo-jogos'],
      'simples-duplas': ['dia-de-jogo-sortear', 'dia-de-jogo-jogos'],
      resultados: 'dia-de-jogo-jogos',
      ranking: ['dia-de-jogo-publicar', 'dia-de-jogo-ranking'],
      telao: 'dia-de-jogo-telao',
    },
  },
  [TUTORIAL_ID.GAME_DAY_AMERICANO_LIVE]: {
    route: '/dia-de-jogo/*',
    goTo: '/dia-de-jogo',
    awayText: 'Abra um dia de jogo no formato Americano aprimorado (Jogar → Dia de jogo).',
    area: GUIA_AREA.JOGAR,
    title: 'Conduzir um dia de jogo — Americano aprimorado',
    summary: 'A fila, os dois passos por quadra, as concluídas e o ranking.',
    flags: ['gameday_americano_live'],
    formatos: [GAME_DAY_FORMAT.AMERICANO_LIVE],
    alvos: {
      'o-que-e': 'dia-de-jogo-regras',
      criar: ['dia-de-jogo-config', 'dia-de-jogo-regras'],
      fila: ['dia-de-jogo-inserir-atletas', 'dia-de-jogo-participantes'],
      'dois-passos': ['dia-de-jogo-lancar-resultado', 'dia-de-jogo-criar-partida', 'dia-de-jogo-quadras'],
      sorteio: ['dia-de-jogo-sortear-rodada', 'dia-de-jogo-ordem', 'dia-de-jogo-quadras'],
      'simples-duplas': 'dia-de-jogo-quadras',
      concluidas: ['dia-de-jogo-concluidas', 'dia-de-jogo-quadras'],
      'ranking-telao': 'dia-de-jogo-telao',
    },
  },
});

function guiaDoTutorial(tutorial) {
  const mapa = ANCORAS_DOS_TUTORIAIS[tutorial.id];
  if (!mapa) return null;
  return {
    id: guiaIdDoTutorial(tutorial.id),
    area: mapa.area,
    title: mapa.title,
    summary: mapa.summary,
    keywords: [...tutorial.title.toLowerCase().split(/\s+/), 'como funciona', 'tutorial'],
    screens: [mapa.route],
    flags: mapa.flags,
    tutorial: tutorial.id,
    formatos: mapa.formatos,
    steps: tutorial.steps.map((p, i) => ({
      id: p.id,
      route: mapa.route,
      ...(i === 0 ? { goTo: mapa.goTo } : {}),
      awayText: mapa.awayText,
      target: mapa.alvos[p.id],
      title: p.title,
      body: p.body,
      tip: p.tip,
    })),
  };
}

/** Todos os guias: os escritos aqui e os que vêm dos tutoriais. */
export const GUIAS = Object.freeze([
  ...GUIAS_BASE,
  ...Object.values(TUTORIALS).map(guiaDoTutorial).filter(Boolean),
].map((g) => Object.freeze(g)));

/* ============================================================ consultas == */

/**
 * O contexto de quem abre as dicas.
 * @typedef {object} DicasContexto
 * @property {Record<string, boolean>} [flags]
 * @property {boolean} [gereArena]
 * @property {boolean} [ehProfessor]
 * @property {boolean} [ehAdmin] administra a plataforma (Painel admin)
 * @property {string|null} [minhaArena] id da primeira arena que a pessoa gere
 */

const lista = (x) => (Array.isArray(x) ? x : (x ? [x] : []));

/**
 * A mesma regra de visibilidade dos artigos da central de ajuda, mais o papel.
 * @param {object} item guia ou ponto de dica
 * @param {DicasContexto} [ctx]
 */
export function dicaVisivel(item, ctx = {}) {
  const flags = ctx.flags || {};
  const ligada = (f) => Boolean(flags[f]);
  const algum = lista(item?.flags);
  if (algum.length > 0 && !algum.some(ligada)) return false;
  if (!lista(item?.flagsTodas).every(ligada)) return false;
  if (lista(item?.semFlags).some(ligada)) return false;
  if (item?.audience === 'arena' && !ctx.gereArena) return false;
  if (item?.audience === 'professor' && !ctx.ehProfessor) return false;
  if (item?.audience === 'admin' && !ctx.ehAdmin) return false;
  return true;
}

/** Um guia pelo id — `null` quando não existe (a tela não quebra por isso). */
export function guiaPorId(id) {
  return GUIAS.find((g) => g.id === id) || null;
}

/** Os guias que esta pessoa pode fazer, na ordem do catálogo. */
export function guiasVisiveis(ctx = {}) {
  return GUIAS.filter((g) => dicaVisivel(g, ctx));
}

/**
 * Os guias DESTA TELA — "Nesta tela" no painel. O guia do tutorial da
 * ferramenta vem primeiro (é o mais específico); num dia de jogo, só o do
 * formato do dia (`ctx.formatoDoDia`).
 */
export function guiasDaTela(caminho, ctx = {}) {
  const formato = ctx.formatoDoDia || null;
  const daTela = GUIAS.filter((g) => casaAlgumaRota(g.screens, caminho))
    .filter((g) => {
      if (!g.formatos) return dicaVisivel(g, ctx);
      // No dia de jogo, o guia é o do FORMATO do dia. E o formato que o dia
      // já tem vale mesmo com a flag dele desligada: flag tira a opção de
      // escolher daqui para frente, nunca a de conduzir o que está gravado.
      if (formato) {
        return g.formatos.includes(formato) && (!g.flagObrigatoria || dicaVisivel(g, ctx));
      }
      return dicaVisivel(g, ctx);
    });
  return [...daTela.filter((g) => g.tutorial), ...daTela.filter((g) => !g.tutorial)];
}

/** Sem acento, sem caixa. */
export function normalizarBusca(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function textoDoGuia(g) {
  const passos = g.steps.map((p) => [p.title, ...lista(p.body), p.tip].filter(Boolean).join(' '));
  return normalizarBusca([g.title, g.summary, ...(g.keywords || []), GUIA_AREA_META[g.area]?.label, ...passos].join(' '));
}

/**
 * "O que você quer fazer?" — busca nos guias. Vários termos ESTREITAM (E).
 * O título pesa mais que o corpo: quem digita "reservar" quer o guia de
 * reservar primeiro, não um que cita reserva no quarto passo.
 */
export function buscarGuias(termo, ctx = {}) {
  const termos = normalizarBusca(termo).split(/\s+/).filter((t) => t.length >= 2);
  if (termos.length === 0) return [];
  return guiasVisiveis(ctx)
    .map((g) => {
      const todo = textoDoGuia(g);
      if (!termos.every((t) => todo.includes(t))) return null;
      const titulo = normalizarBusca(`${g.title} ${(g.keywords || []).join(' ')}`);
      const peso = termos.filter((t) => titulo.includes(t)).length;
      return { g, peso };
    })
    .filter(Boolean)
    .sort((a, b) => b.peso - a.peso)
    .map((x) => x.g);
}

/** Os guias agrupados por área, na ordem das áreas; área vazia some. */
export function guiasPorArea(ctx = {}) {
  const visiveis = guiasVisiveis(ctx);
  return Object.values(GUIA_AREA)
    .map((area) => ({ area, ...GUIA_AREA_META[area], guias: visiveis.filter((g) => g.area === area) }))
    .filter((x) => x.guias.length > 0);
}

/** As âncoras de um passo, na ordem de preferência. */
export function alvosDoPasso(passo) {
  return lista(passo?.target);
}

/** O texto do passo sempre como lista de parágrafos. */
export function paragrafos(passo) {
  return lista(passo?.body);
}

/**
 * Para onde levar a pessoa neste passo — `null` quando não dá (`:minhaArena`
 * sem arena, ou nenhum destino).
 */
/**
 * Para onde levar quando o passo está na TELA certa mas o ponto não apareceu —
 * a pessoa está noutra aba da mesma tela (a Central da arena no Calendário, o
 * painel do professor em Alunos). Vale o `goTo` deste passo ou do passo
 * anterior mais próximo, desde que ele leve à MESMA tela (`route`): um
 * `goTo` para a LISTA (`/dia-de-jogo`) não serve a quem já está dentro de um
 * dia de jogo — tiraria a pessoa de onde ela está.
 * @returns {string|null}
 */
export function destinoDeRecuo(guia, idx, ctx = {}) {
  const passo = guia?.steps?.[idx];
  if (!passo?.route) return null;
  for (let i = idx; i >= 0; i -= 1) {
    const d = destinoDoPasso(guia.steps[i], ctx);
    if (d && casaRota(passo.route, d.split(/[?#]/)[0])) return d;
  }
  return null;
}

/**
 * O passo que ABRE o lugar deste passo — o formulário, o diálogo, o cartão:
 * o anterior mais próximo, na mesma tela, que avança por um clique ou pelo
 * aparecimento de algo. Quando a pessoa fecha o formulário no meio do guia, é
 * para ele que "Abrir de novo" volta. `-1` quando não há.
 * @returns {number}
 */
export function passoQueAbre(guia, idx) {
  const passo = guia?.steps?.[idx];
  if (!passo?.route) return -1;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const p = guia.steps[i];
    if (p.route !== passo.route) continue;
    if (p.advanceOn === 'click' || p.advanceOn?.appears) return i;
  }
  return -1;
}

export function destinoDoPasso(passo, ctx = {}) {
  const alvo = passo?.goTo;
  if (!alvo) return null;
  if (alvo.includes(':minhaArena')) {
    if (!ctx.minhaArena) return null;
    return alvo.replace(':minhaArena', encodeURIComponent(ctx.minhaArena));
  }
  return alvo;
}
