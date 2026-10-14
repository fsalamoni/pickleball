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
import { t, tk } from '@/core/i18n';
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
  [GUIA_AREA.COMECAR]: { label: tk('Primeiros passos'), icon: 'Compass' },
  [GUIA_AREA.JOGAR]: { label: tk('Jogar'), icon: 'Swords' },
  [GUIA_AREA.COMPETIR]: { label: tk('Competir'), icon: 'Trophy' },
  [GUIA_AREA.TREINO]: { label: tk('Treino'), icon: 'Dumbbell' },
  [GUIA_AREA.COMUNIDADE]: { label: tk('Comunidade'), icon: 'Users' },
  [GUIA_AREA.GAMIFICACAO]: { label: tk('Gamificação'), icon: 'Sparkles' },
  [GUIA_AREA.ARENAS]: { label: tk('Quadras e reservas'), icon: 'CalendarCheck' },
  [GUIA_AREA.MINHA_ARENA]: { label: tk('Para a sua arena'), icon: 'Building2' },
  [GUIA_AREA.AULAS]: { label: tk('Aulas'), icon: 'GraduationCap' },
  [GUIA_AREA.CONTA]: { label: tk('Conta e preferências'), icon: 'Settings' },
});

/** Prefixo dos guias que vêm dos tutoriais das ferramentas. */
export const GUIA_DE_TUTORIAL = 'tutorial:';

/** O id do guia de um tutorial (o botão "Como funciona" das ferramentas). */
export function guiaIdDoTutorial(tutorialId) {
  return tutorialId ? `${GUIA_DE_TUTORIAL}${tutorialId}` : null;
}

/* ================================================================== guias == */

const TOQUE = (rotulo) => `Toque em «${rotulo}»`;

/** As variáveis dos textos dos guias que vêm de constantes da regra. */
const VARIAVEIS = Object.freeze({
  semanasDeFerias: STREAK_VACATION_MAX_DAYS / 7,
  diasEntreFerias: STREAK_VACATION_COOLDOWN_DAYS,
});

/** Um texto de guia no idioma ativo (com as variáveis da regra). */
export const textoDoGuiaT = (texto) => (texto ? t(texto, VARIAVEIS) : texto);

/** A chamada para agir ("Toque em «Criar»") no idioma ativo. */
export function textoDaAcao(action) {
  const m = /^Toque em «(.+)»$/.exec(action || '');
  return m ? t('Toque em «{rotulo}»', { rotulo: t(m[1]) }) : textoDoGuiaT(action);
}

const GUIAS_BASE = [
  /* ---------------------------------------------------- primeiros passos -- */
  {
    id: 'conhecer-a-plataforma',
    area: GUIA_AREA.COMECAR,
    title: tk('Conhecer a plataforma'),
    summary: tk('Onde fica cada coisa: o menu, os atalhos, os avisos e as dicas.'),
    keywords: ['menu', 'navegar', 'onde fica', 'começar', 'início', 'tour'],
    screens: ['/'],
    steps: [
      {
        id: 'menu',
        route: '/',
        goTo: '/',
        target: ['menu-principal', 'menu-celular'],
        title: tk('O menu da plataforma'),
        body: [
          tk('Tudo o que dá para fazer aqui está organizado em temas: Início, Jogar, Competir, Arenas, Comunidade, Aulas e Minha área. Regras e nivelamento ficam na Ajuda.'),
          tk('Ao entrar num tema, as páginas dele aparecem numa barra logo acima do conteúdo.'),
          tk('O menu é seu: em Configurações → Menu você escolhe o que aparece e a ordem. A sua arena e o painel do professor moram na Minha área — e podem voltar ao menu, se quiser.'),
        ],
        tip: tk('No celular, o menu abre no botão de três linhas, no canto de cima.'),
      },
      {
        id: 'competir',
        route: '/',
        target: ['menu-competir', 'nav-inferior-torneios'],
        title: tk('Competir'),
        body: tk('Torneios, circuitos e o ranking. É aqui que você se inscreve num torneio, cria o seu e acompanha a sua posição.'),
      },
      {
        id: 'jogar',
        route: '/',
        target: ['menu-jogar', 'menu-celular'],
        title: tk('Jogar'),
        body: tk('Abre no Dia de jogo (os seus e os com vaga para você entrar), depois Procura-se jogo (tudo o que tem vaga nos próximos dias, com o botão de entrar) e Encontrar jogadores do seu nível.'),
      },
      {
        id: 'arenas',
        route: '/',
        target: ['menu-arenas', 'menu-celular'],
        title: tk('Arenas'),
        body: tk('Encontre uma quadra, veja os horários livres e peça a reserva. O que você reservou fica em Minhas reservas.'),
      },
      {
        id: 'procuro-jogo',
        route: '/',
        target: 'botao-procuro-jogo',
        title: tk('Atalho: Procuro jogo'),
        body: tk('Leva direto aos convites abertos — o jeito mais rápido de achar com quem jogar hoje.'),
      },
      {
        id: 'avisos',
        route: '/',
        target: 'botao-notificacoes',
        title: tk('Seus avisos'),
        body: tk('Convites, respostas de reserva, resultados e novidades dos seus clubes chegam neste sino. A lista rola: os mais antigos ficam embaixo.'),
      },
      {
        id: 'dicas',
        route: '/',
        target: 'botao-dicas',
        title: tk('As dicas moram aqui'),
        body: [
          tk('Ligue ou desligue as dicas quando quiser. Ligadas, pontos pulsando nas telas mostram o que cada botão faz.'),
          tk('E em "O que você quer fazer?" há um guia como este para cada tarefa.'),
        ],
      },
    ],
  },
  {
    id: 'completar-perfil',
    area: GUIA_AREA.COMECAR,
    title: tk('Completar o seu perfil'),
    summary: tk('Foto, cidade, interesses e nível — o que faz a plataforma trabalhar para você.'),
    keywords: ['perfil', 'foto', 'nome', 'cidade', 'interesses', 'nível', 'editar'],
    screens: ['/perfil', '/perfil/editar'],
    steps: [
      {
        id: 'identidade',
        route: '/perfil/editar',
        goTo: '/perfil/editar',
        target: 'perfil-identidade',
        title: tk('Quem é você'),
        body: [
          tk('Foto, nome de exibição e tempo de experiência. É assim que atletas, arenas e organizadores te encontram.'),
          tk('Cada cartão tem o seu botão de salvar: "Salvar alterações" guarda só o que está nele.'),
        ],
        tip: tk('Cartão fechado abre com um toque no título.'),
      },
      {
        id: 'comunidade',
        route: '/perfil/editar',
        target: 'perfil-comunidade',
        title: tk('Cidade e privacidade'),
        body: tk('A cidade traz torneios, jogos e arenas perto de você. Aqui você também decide quem vê o seu contato e se aparece no diretório de atletas.'),
      },
      {
        id: 'interesses',
        route: '/perfil/editar',
        target: 'perfil-interesses',
        title: tk('Seus interesses'),
        body: tk('Marque o que você quer fazer aqui: jogar torneios, organizar, achar parceiros, ter aulas, reservar quadras… A tela inicial e as sugestões partem disso.'),
      },
      {
        id: 'nivel',
        route: '/perfil/editar',
        target: 'perfil-nivel',
        title: tk('Seu nível'),
        body: tk('Informe o seu nível ou responda ao questionário. É ele que equilibra os sorteios dos dias de jogo e as sugestões de parceiros.'),
      },
    ],
  },

  /* ------------------------------------------------------------- jogar -- */
  {
    id: 'encontrar-jogo',
    area: GUIA_AREA.JOGAR,
    title: tk('Achar um jogo para hoje'),
    summary: tk('Os convites abertos, os jogos das arenas e como publicar o seu.'),
    keywords: ['procura-se jogo', 'convite', 'parceiro', 'jogar hoje', 'jogo aberto'],
    screens: ['/procura-jogo'],
    steps: [
      {
        id: 'convites',
        route: '/procura-jogo',
        goTo: '/procura-jogo',
        target: ['procura-lista', 'procura-publicar'],
        title: tk('Convites abertos'),
        body: [
          tk('Aqui ficam os convites de quem procura gente para jogar: dia, lugar, nível e vagas.'),
          tk('Achou um que combina? Toque em "Participar do dia de jogo".'),
        ],
      },
      {
        id: 'arenas',
        route: '/procura-jogo',
        target: 'procura-arenas',
        title: tk('Jogos abertos nas arenas'),
        body: tk('Arenas também publicam jogos com vaga, com quadra e horário já garantidos. Dá para entrar ali mesmo — e, se lotar, entrar na fila.'),
      },
      {
        id: 'publicar',
        route: '/procura-jogo',
        target: 'procura-publicar',
        title: tk('Não achou? Publique o seu'),
        body: tk('Em "Publicar convite" você diz quando, onde e quantas vagas tem. O convite aparece aqui para quem procura jogo.'),
      },
    ],
  },
  {
    id: 'criar-dia-de-jogo',
    area: GUIA_AREA.JOGAR,
    title: tk('Criar um dia de jogo'),
    summary: tk('Do nome ao formato, passo a passo no próprio formulário.'),
    keywords: ['dia de jogo', 'criar', 'americano', 'play', 'formato', 'quadras', 'organizar'],
    screens: ['/dia-de-jogo'],
    steps: [
      {
        id: 'abrir',
        route: '/dia-de-jogo',
        goTo: '/dia-de-jogo',
        target: 'dia-de-jogo-criar',
        advanceOn: 'click',
        action: TOQUE(tk('Novo dia de jogo')),
        title: tk('Comece aqui'),
        body: tk('Um dia de jogo organiza uma tarde (ou manhã) de partidas: quem joga com quem, em que quadra — e, se você quiser, placar e ranking do dia.'),
      },
      {
        id: 'nome',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-nome',
        title: tk('Dê um nome'),
        body: tk('Algo que as pessoas reconheçam: "Treino de sábado", "Open do clube".'),
      },
      {
        id: 'visibilidade',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-visibilidade',
        title: tk('Quem vê'),
        body: tk('Público: aparece para outras pessoas pedirem para entrar. Privado: só quem você incluir.'),
      },
      {
        id: 'quem-organiza',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-quem-organiza',
        title: tk('Quem conduz as partidas'),
        body: tk('Só você (e quem você nomear) sorteia e cria as partidas — ou qualquer inscrito pode ajudar. Dá para mudar depois, nas configurações do dia.'),
      },
      {
        id: 'data',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-data',
        title: tk('Quando'),
        body: tk('Data e horário de início. Local e cidade ajudam quem vem de fora.'),
      },
      {
        id: 'formato',
        route: '/dia-de-jogo',
        target: ['dia-de-jogo-formato', 'dia-de-jogo-nome'],
        title: tk('O formato'),
        body: [
          tk('Play: jogo aberto, por ordem de chegada, sem placar.'),
          tk('Americano: as rodadas saem sorteadas de uma vez, com placar e ranking do dia.'),
        ],
        tip: tk('Outros formatos aparecem quando estão ligados na plataforma. "Como funciona este formato" explica cada um.'),
      },
      {
        id: 'criar',
        route: '/dia-de-jogo',
        target: 'dia-de-jogo-confirmar',
        advanceOn: { route: '/dia-de-jogo/*' },
        action: TOQUE(tk('Criar dia de jogo')),
        title: tk('Pronto para criar'),
        body: tk('Criado o dia, a plataforma abre a tela dele.'),
      },
      {
        id: 'depois',
        route: '/dia-de-jogo/*',
        awayText: tk('Abra o dia de jogo que você criou — ele está em Jogar → Dia de jogo.'),
        goTo: '/dia-de-jogo',
        target: ['dia-de-jogo-inserir-atletas', 'dia-de-jogo-participantes'],
        title: tk('Agora, os participantes'),
        body: tk('Inclua os atletas em "Inserir atletas". Com gente no dia, os botões de sortear e de criar partidas passam a funcionar.'),
        tip: tk('O "Como funciona" desta tela abre o guia completo do formato que você escolheu.'),
      },
    ],
  },
  {
    id: 'play-grupos',
    area: GUIA_AREA.JOGAR,
    // A flag aqui gateia a FUNCIONALIDADE, não só a escolha de um formato:
    // `flagObrigatoria` faz o guia respeitá-la mesmo num dia de Play que já
    // existe (ver `guiasDaTela`).
    flagObrigatoria: true,
    formatos: [GAME_DAY_FORMAT.PLAY],
    title: tk('Dividir o Play em grupos'),
    summary: tk('Por nível ou por tipo de dupla: cada grupo com a sua fila e as suas regras.'),
    keywords: ['grupos', 'play', 'nível', 'turma', 'mista', 'fila', 'dividir', 'convidado'],
    screens: ['/dia-de-jogo/*'],
    steps: [
      {
        id: 'o-que-sao',
        route: '/dia-de-jogo/*',
        goTo: '/dia-de-jogo',
        awayText: tk('Abra um dia de jogo no formato Play (Jogar → Dia de jogo).'),
        target: 'dia-de-jogo-grupos',
        title: tk('Grupos dentro do Play'),
        body: [
          tk('Os grupos dividem a fila do dia: cada um tem a sua fila, e as partidas saem DENTRO do grupo — iniciantes jogam com iniciantes, mistas com mistas.'),
          tk('Quem está sem grupo continua numa fila só dele, como o Play sempre foi.'),
        ],
        tip: tk('Quem criou o dia e os administradores nomeados montam e editam os grupos. Quem só conduz as partidas move as pessoas entre eles.'),
      },
      {
        id: 'novo',
        route: '/dia-de-jogo/*',
        target: ['dia-de-jogo-grupos-novo', 'dia-de-jogo-grupos'],
        title: tk('Criar um grupo'),
        body: [
          tk('Com o cartão vazio, escolha um modelo (por nível, por tipo de dupla ou em branco). Depois, "Novo grupo" acrescenta quantos quiser.'),
          tk('Cada grupo tem nome, faixa de nível, o tipo de dupla (livre, mista ou do mesmo sexo), a diferença máxima de nível dentro da partida e as quadras em que joga.'),
        ],
        tip: tk('"Exigir" faz o grupo esperar até haver uma partida que cumpra as regras; sem isso, ele tenta cumprir e, se não der, joga assim mesmo.'),
      },
      {
        id: 'distribuir',
        route: '/dia-de-jogo/*',
        target: ['dia-de-jogo-grupos-distribuir', 'dia-de-jogo-grupos'],
        title: tk('Distribuir por nível'),
        body: tk('Coloca cada pessoa no grupo que combina com o nível dela. Você vê a prévia antes de aplicar — e nada muda até confirmar.'),
        tip: tk('Quem não tem nível conhecido não é barrado de nenhum grupo: vale o que você escolher.'),
      },
      {
        id: 'convidados',
        route: '/dia-de-jogo/*',
        target: ['dia-de-jogo-inserir-atletas', 'dia-de-jogo-participantes'],
        title: tk('Convidado avulso: nível e sexo'),
        body: tk('Ao inserir alguém que não tem conta, informe o nível e o sexo dessa pessoa. É o que a coloca no grupo certo — sem isso, ela entra sem grupo.'),
      },
      {
        id: 'quadras',
        route: '/dia-de-jogo/*',
        target: 'dia-de-jogo-quadras',
        title: tk('O grupo de cada quadra'),
        body: [
          tk('Numa quadra livre você deixa o sorteio escolher o grupo ("Automático") ou manda um grupo específico para ela.'),
          tk('No cartão Grupos, a política decide quem ocupa a quadra quando há mais de um grupo pronto: por tempo de espera, revezando ou por prioridade.'),
        ],
      },
      {
        id: 'fila',
        route: '/dia-de-jogo/*',
        target: ['dia-de-jogo-ordem', 'dia-de-jogo-grupos'],
        title: tk('A fila de cada grupo'),
        body: tk('O número é a posição DENTRO do grupo. Um grupo sem partida pronta diz o porquê no próprio cartão — falta gente, falta alguém do sexo da formação, o nível não combina.'),
      },
      {
        id: 'telao',
        route: '/dia-de-jogo/*',
        target: 'dia-de-jogo-telao',
        title: tk('No telão'),
        body: tk('A partida em quadra mostra o selo do grupo, a previsão diz de que grupo é cada quadra e a fila se divide por grupo.'),
      },
    ],
  },
  {
    id: 'encontrar-jogadores',
    area: GUIA_AREA.JOGAR,
    title: tk('Achar parceiros do seu nível'),
    summary: tk('Sugestões de atletas parecidos com você, perto de você.'),
    keywords: ['parceiro', 'nível', 'jogadores', 'encontrar', 'rating'],
    screens: ['/encontrar-jogadores'],
    steps: [
      {
        id: 'filtros',
        route: '/encontrar-jogadores',
        goTo: '/encontrar-jogadores',
        target: 'jogadores-filtros',
        title: tk('Nível e cidade'),
        body: tk('Combine "Nível parecido" e "Minha cidade" para ver só quem joga como você, perto de você.'),
        tip: tk('As sugestões precisam de um nível ou rating seu. Sem ele, a tela explica como conseguir.'),
      },
      {
        id: 'lista',
        route: '/encontrar-jogadores',
        target: 'jogadores-lista',
        title: tk('Os sugeridos'),
        body: tk('Cada cartão mostra o nível e a cidade. Mande uma mensagem para combinar o jogo.'),
      },
    ],
  },

  /* ---------------------------------------------------------- competir -- */
  {
    id: 'inscrever-em-torneio',
    area: GUIA_AREA.COMPETIR,
    title: tk('Inscrever-se num torneio'),
    summary: tk('Achar o torneio, escolher a modalidade e acompanhar os jogos.'),
    keywords: ['torneio', 'inscrição', 'inscrever', 'modalidade', 'competir'],
    screens: ['/torneios', '/torneios/*'],
    steps: [
      {
        id: 'abas',
        route: '/torneios',
        goTo: '/torneios',
        target: 'torneios-abas',
        title: tk('Públicos ou os seus'),
        body: tk('"Públicos" mostra os torneios abertos a todos; "Meus torneios", aqueles em que você joga ou organiza.'),
      },
      {
        id: 'escolher',
        route: '/torneios',
        target: ['torneios-lista', 'torneios-abas'],
        advanceOn: { route: '/torneios/*' },
        action: tk('Toque num torneio para abrir'),
        title: tk('Escolha um torneio'),
        body: tk('Cada cartão mostra datas, cidade e se as inscrições estão abertas.'),
      },
      {
        id: 'inscrever',
        route: '/torneios/*',
        goTo: '/torneios',
        awayText: tk('Abra um torneio da lista de Torneios.'),
        target: ['torneio-inscrever', 'torneio-abas'],
        title: tk('Inscreva-se na modalidade'),
        body: [
          tk('Na aba Visão geral, cada modalidade (por exemplo, "Dupla Mista B") tem o seu botão "Inscrever-se".'),
          tk('Nas duplas, você informa o parceiro na própria inscrição.'),
        ],
        tip: tk('Torneio privado pede o código que o organizador passou.'),
      },
      {
        id: 'acompanhar',
        route: '/torneios/*',
        target: 'torneio-abas',
        title: tk('Depois de inscrito'),
        body: tk('Em Jogos você vê horários e adversários; em Ranking, a classificação. Os avisos chegam no sino.'),
      },
    ],
  },
  {
    id: 'criar-torneio',
    area: GUIA_AREA.COMPETIR,
    title: tk('Criar um torneio'),
    summary: tk('As três etapas do cadastro, no próprio formulário.'),
    keywords: ['torneio', 'criar', 'organizar', 'rascunho', 'inscrições'],
    screens: ['/torneios', '/torneios/criar'],
    steps: [
      {
        id: 'etapas',
        route: '/torneios/criar',
        goTo: '/torneios/criar',
        target: 'criar-torneio-etapas',
        title: tk('Três etapas'),
        body: tk('Identidade, acesso e regras, calendário. Dá para voltar a qualquer etapa antes de criar — e tudo se edita depois.'),
      },
      {
        id: 'identidade',
        route: '/torneios/criar',
        target: 'criar-torneio-nome',
        title: tk('Nome e local'),
        body: tk('Nome do torneio, cidade, UF e o local. Se ele acontece numa arena sua, vincule-a: o torneio aparece na página da arena.'),
      },
      {
        id: 'avancar-1',
        route: '/torneios/criar',
        target: 'criar-torneio-avancar',
        advanceOn: { appears: 'criar-torneio-acesso' },
        action: TOQUE(tk('Avançar')),
        title: tk('Próxima etapa'),
        body: tk('Preenchido o nome, siga para o acesso e as regras.'),
      },
      {
        id: 'acesso',
        route: '/torneios/criar',
        target: 'criar-torneio-acesso',
        title: tk('Público ou privado'),
        body: tk('Público aparece na busca. Privado só recebe quem tem o link ou o código.'),
      },
      {
        id: 'avancar-2',
        route: '/torneios/criar',
        target: 'criar-torneio-avancar',
        advanceOn: { appears: 'criar-torneio-datas' },
        action: TOQUE(tk('Avançar')),
        title: tk('Última etapa'),
        body: tk('Falta só o calendário.'),
      },
      {
        id: 'datas',
        route: '/torneios/criar',
        target: 'criar-torneio-datas',
        title: tk('Datas e prazo'),
        body: tk('Início, fim e o fim das inscrições.'),
      },
      {
        id: 'criar',
        route: '/torneios/criar',
        target: 'criar-torneio-criar',
        title: tk('Criar'),
        body: [
          tk('O torneio nasce como rascunho: só você o vê.'),
          tk('Depois vêm as modalidades, as inscrições e o sorteio — no console de gestão, em "Gerenciar torneio".'),
        ],
        tip: tk('No console, "Como funciona" abre o guia completo da organização.'),
      },
    ],
  },
  {
    id: 'entender-ranking',
    area: GUIA_AREA.COMPETIR,
    title: tk('Entender o ranking'),
    summary: tk('Os dois rankings, a busca e o ranking de duplas.'),
    keywords: ['ranking', 'rating', 'posição', 'elo', 'dupr', 'duplas'],
    screens: ['/ranking', '/ranking/duplas'],
    steps: [
      {
        id: 'abas',
        route: '/ranking',
        goTo: '/ranking',
        target: 'ranking-abas',
        title: tk('Dois rankings'),
        body: tk('Nacional (pontuação ELO) e Nível 2.0–8.0 (no estilo DUPR). Os dois se movem com os resultados publicados — de torneios e de dias de jogo.'),
      },
      {
        id: 'como',
        route: '/ranking',
        target: ['ranking-como-funciona', 'ranking-abas'],
        title: tk('O que conta'),
        body: tk('Abra "Como funciona o ranking?" para ver o que entra e o que não entra na conta.'),
      },
      {
        id: 'busca',
        route: '/ranking',
        target: ['ranking-busca', 'ranking-abas'],
        title: tk('Ache alguém'),
        body: tk('Busque por nome, cidade, estado ou nível. Os filtros ao lado recortam por região, gênero, clube e faixa etária.'),
      },
      {
        id: 'duplas',
        route: '/ranking',
        target: ['ranking-duplas-link', 'ranking-abas'],
        title: tk('E as duplas'),
        body: tk('O ranking de duplas classifica as parcerias pelo aproveitamento — a dupla que mais vence junto.'),
      },
    ],
  },

  /* -------------------------------------------------------- comunidade -- */
  {
    id: 'entrar-num-clube',
    area: GUIA_AREA.COMUNIDADE,
    title: tk('Entrar num clube'),
    summary: tk('Buscar o clube e pedir para participar (ou usar o código).'),
    keywords: ['clube', 'entrar', 'participar', 'código', 'convite'],
    screens: ['/clubes', '/clubes/*'],
    steps: [
      {
        id: 'busca',
        route: '/clubes',
        goTo: '/clubes',
        target: 'clubes-busca',
        title: tk('Busque o clube'),
        body: tk('Pelo nome. Os clubes de que você já participa aparecem no topo da página.'),
        tip: tk('O cartão de busca fechado abre com um toque no título.'),
      },
      {
        id: 'escolher',
        route: '/clubes',
        target: ['clubes-lista', 'clubes-busca'],
        advanceOn: { route: '/clubes/*' },
        action: tk('Toque num clube para abrir'),
        title: tk('Abra o clube'),
        body: tk('A página do clube mostra os eventos, os membros e como entrar.'),
      },
      {
        id: 'entrar',
        route: '/clubes/*',
        goTo: '/clubes',
        awayText: tk('Abra um clube da lista de Clubes.'),
        target: ['clube-entrar', 'clube-codigo'],
        title: tk('Peça para entrar'),
        body: tk('Em "Pedir para ingressar" o administrador do clube recebe o pedido. Tem um código de convite? Use "Entrar com código".'),
      },
    ],
  },
  {
    id: 'criar-clube',
    area: GUIA_AREA.COMUNIDADE,
    title: tk('Criar um clube'),
    summary: tk('O cadastro do clube, campo a campo.'),
    keywords: ['clube', 'criar', 'grupo', 'comunidade'],
    screens: ['/clubes', '/clubes/criar'],
    steps: [
      {
        id: 'nome',
        route: '/clubes/criar',
        goTo: '/clubes/criar',
        target: 'clube-criar-nome',
        title: tk('Nome e descrição'),
        body: tk('O nome é o que aparece na busca. A descrição conta para quem é o clube e como funciona.'),
      },
      {
        id: 'onde',
        route: '/clubes/criar',
        target: 'clube-criar-cidade',
        title: tk('Onde'),
        body: tk('Cidade, UF e a quadra principal ajudam quem procura um clube perto.'),
      },
      {
        id: 'criar',
        route: '/clubes/criar',
        target: 'clube-criar-enviar',
        title: tk('Criar'),
        body: tk('Criado o clube, você é o administrador: aprova quem pede para entrar, cria eventos e convida pelo código.'),
      },
    ],
  },

  /* ------------------------------------------------------------ arenas -- */
  {
    id: 'reservar-quadra',
    area: GUIA_AREA.ARENAS,
    title: tk('Reservar uma quadra'),
    summary: tk('Da busca da arena ao pedido de reserva, na tela de verdade.'),
    keywords: ['reserva', 'reservar', 'quadra', 'arena', 'horário', 'calendário'],
    screens: ['/arenas', '/arenas/*'],
    steps: [
      {
        id: 'buscar',
        route: '/arenas',
        goTo: '/arenas',
        target: 'arenas-busca',
        title: tk('Ache a arena'),
        body: tk('Busque por nome, cidade ou endereço — ou filtre pela cidade logo abaixo.'),
      },
      {
        id: 'escolher',
        route: '/arenas',
        target: ['arenas-lista', 'arenas-busca'],
        advanceOn: { route: '/arenas/*' },
        action: tk('Toque numa arena para abrir'),
        title: tk('Abra a arena'),
        body: tk('A página da arena mostra preços, quadras, regras e o calendário de horários.'),
      },
      {
        id: 'dia',
        route: '/arenas/*',
        goTo: '/arenas',
        awayText: tk('Abra uma arena da lista de Arenas.'),
        target: 'arena-calendario',
        advanceOn: { appears: 'arena-horarios' },
        action: tk('Toque num dia com horário livre'),
        title: tk('Escolha o dia'),
        body: tk('Cada dia mostra quantas horas livres tem. Dia apagado já passou ou está fechado.'),
      },
      {
        id: 'horarios',
        route: '/arenas/*',
        target: 'arena-horarios',
        title: tk('Quadra e horário'),
        body: tk('Toque nos horários que quiser — dá para escolher mais de um, e em mais de uma quadra. Em "Por quadra" você vê exatamente quais quadras estão livres.'),
      },
      {
        id: 'continuar',
        route: '/arenas/*',
        target: 'arena-continuar',
        advanceOn: { appears: 'reserva-confirmar' },
        action: TOQUE(tk('Continuar')),
        title: tk('Siga para confirmar'),
        body: tk('O botão aparece assim que você escolhe pelo menos um horário.'),
      },
      {
        id: 'confirmar',
        route: '/arenas/*',
        target: 'reserva-confirmar',
        title: tk('Confirme o pedido'),
        body: [
          tk('Avulsa ou toda semana, observações e convidados. O preço aparece antes de você enviar.'),
          tk('Em "Solicitar reserva" a arena recebe o pedido — e você é avisado quando ela responder.'),
        ],
      },
      {
        id: 'acompanhar',
        title: tk('Acompanhe em Minhas reservas'),
        body: tk('O pedido aparece em Arenas → Minhas reservas, com o status. Mudou de ideia? Dá para cancelar ali.'),
      },
    ],
  },
  {
    id: 'minhas-reservas',
    area: GUIA_AREA.ARENAS,
    title: tk('Acompanhar as suas reservas'),
    summary: tk('Status, convites, jogos abertos e os seus planos nas arenas.'),
    keywords: ['minhas reservas', 'status', 'cancelar', 'reserva'],
    screens: ['/minhas-reservas'],
    steps: [
      {
        id: 'lista',
        route: '/minhas-reservas',
        goTo: '/minhas-reservas',
        target: ['reservas-lista', 'reservas-ver-arenas'],
        title: tk('Ativas e histórico'),
        body: tk('Cada reserva mostra a arena, o horário e o status: pedida, confirmada, recusada. Dá para cancelar ou pedir alteração ali mesmo.'),
      },
      {
        id: 'arenas',
        route: '/minhas-reservas',
        target: 'reservas-ver-arenas',
        title: tk('Reservar de novo'),
        body: tk('"Ver arenas" leva à busca de quadras.'),
      },
    ],
  },

  /* ---------------------------------------------------- a sua arena -- */
  {
    id: 'cadastrar-arena',
    area: GUIA_AREA.MINHA_ARENA,
    title: tk('Cadastrar a sua arena'),
    summary: tk('O cadastro da arena, antes de abrir as reservas.'),
    keywords: ['arena', 'cadastrar', 'criar', 'quadras', 'dono'],
    screens: ['/arenas', '/arenas/criar'],
    steps: [
      {
        id: 'nome',
        route: '/arenas/criar',
        goTo: '/arenas/criar',
        target: 'arena-criar-nome',
        title: tk('Nome e descrição'),
        body: tk('Como a arena aparece na busca e na página dela.'),
      },
      {
        id: 'local',
        route: '/arenas/criar',
        target: 'arena-criar-local',
        title: tk('Onde fica'),
        body: tk('Endereço, bairro, cidade e UF — é por eles que os atletas acham a arena.'),
      },
      {
        id: 'quadras',
        route: '/arenas/criar',
        target: 'arena-criar-quadras',
        title: tk('Quadras e funcionamento'),
        body: tk('Um primeiro número. Depois você cadastra cada quadra e os horários dela na Central da arena.'),
      },
      {
        id: 'enviar',
        route: '/arenas/criar',
        target: 'arena-criar-enviar',
        title: tk('Cadastrar'),
        body: tk('Em seguida a plataforma abre os primeiros passos da arena. O guia "Cadastrar quadras e horários" continua dali.'),
      },
    ],
  },
  {
    id: 'configurar-quadras',
    area: GUIA_AREA.MINHA_ARENA,
    audience: 'arena',
    title: tk('Cadastrar quadras e horários'),
    summary: tk('Sem horário, a quadra não aparece para reserva. Veja onde se configura.'),
    keywords: ['quadra', 'horário', 'janela', 'funcionamento', 'central da arena'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'secao',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=quadras',
        target: ['arena-aba-quadras', 'arena-secao-estrutura', 'arena-secoes'],
        title: tk('Estrutura e preços → Quadras'),
        body: tk('A Central da arena é organizada em seções. As quadras moram em "Estrutura e preços".'),
      },
      {
        id: 'nova',
        route: '/arenas/*/gerir',
        target: ['arena-nova-quadra', 'arena-quadras'],
        title: tk('Cadastre as quadras'),
        body: tk('Uma por uma: nome, piso, se é coberta. Quadra inativa fica fora da reserva sem precisar apagar.'),
      },
      {
        id: 'relogio',
        route: '/arenas/*/gerir',
        target: ['arena-horarios-quadra', 'arena-quadras'],
        advanceOn: { appears: 'arena-nova-janela' },
        action: tk('Toque no relógio de uma quadra'),
        title: tk('Os horários de cada quadra'),
        body: tk('Cada quadra tem as suas janelas de funcionamento. Quadra sem janela não aparece no calendário.'),
      },
      {
        id: 'janela',
        route: '/arenas/*/gerir',
        target: ['arena-nova-janela', 'arena-janelas'],
        title: tk('Uma janela de horário'),
        body: tk('Dias da semana e das tantas às tantas. Pode haver mais de uma — manhã e noite, por exemplo.'),
        tip: tk('Uma janela sem quadra escolhida vale para a arena inteira.'),
      },
    ],
  },
  {
    id: 'responder-reservas',
    area: GUIA_AREA.MINHA_ARENA,
    audience: 'arena',
    title: tk('Responder pedidos de reserva'),
    summary: tk('Onde chegam os pedidos e como confirmar ou recusar.'),
    keywords: ['pedido', 'reserva', 'confirmar', 'recusar', 'central da arena'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'pendencias',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=reservas',
        target: ['arena-pendencias', 'arena-secao-reservas', 'arena-secoes'],
        title: tk('Precisa de você'),
        body: tk('O topo da Central junta o que espera a arena agir: pedidos de reserva, pedidos do app, faltas para marcar. Cada item leva à aba que resolve.'),
      },
      {
        id: 'aba',
        route: '/arenas/*/gerir',
        target: ['arena-aba-reservas', 'arena-secao-reservas', 'arena-secoes'],
        title: tk('Reservas → Solicitações'),
        body: tk('Os pedidos ativos, do mais próximo para o mais distante.'),
      },
      {
        id: 'responder',
        route: '/arenas/*/gerir',
        target: ['reserva-confirmar-pedido', 'arena-aba-reservas'],
        title: tk('Confirmar, propor ou recusar'),
        body: tk('Confirmar avisa o atleta na hora. "Propor" sugere outro valor; "Recusar" libera o horário.'),
      },
    ],
  },
  {
    id: 'ligar-modulos',
    area: GUIA_AREA.MINHA_ARENA,
    audience: 'arena',
    title: tk('Ligar os módulos da arena'),
    summary: tk('Membros, aulas, jogo aberto, loja, marketing: o que a arena ativa para si.'),
    keywords: ['módulos', 'membros', 'aulas', 'loja', 'marketing', 'ativar'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'aba',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=modulos',
        target: ['arena-aba-modulos', 'arena-secao-configuracoes', 'arena-secoes'],
        title: tk('Configurações → Módulos'),
        body: tk('Cada módulo liberado pela plataforma aparece aqui, com o que ele faz e para quem.'),
      },
      {
        id: 'ativar',
        route: '/arenas/*/gerir',
        target: 'arena-modulos',
        title: tk('Ative o que a arena usa'),
        body: tk('Ligado, o módulo vira uma seção da Central e da página da arena. Desligar não apaga nada: os dados voltam se você religar.'),
      },
    ],
  },

  /* ------------------------------------------------------------- aulas -- */
  {
    id: 'encontrar-professor',
    area: GUIA_AREA.AULAS,
    title: tk('Encontrar um professor'),
    summary: tk('Filtros por cidade e nível, e como pedir uma aula.'),
    keywords: ['professor', 'aula', 'treino', 'coach'],
    screens: ['/coaches'],
    steps: [
      {
        id: 'filtros',
        route: '/coaches',
        goTo: '/coaches',
        target: 'professores-filtros',
        title: tk('Filtre'),
        body: tk('Por cidade, modalidade e nível. O cartão de filtros fechado abre com um toque no título.'),
      },
      {
        id: 'lista',
        route: '/coaches',
        target: ['professores-lista', 'professores-filtros'],
        title: tk('Escolha e peça a aula'),
        body: tk('Abra o perfil do professor para ver a agenda e os preços, e peça a aula por ali.'),
      },
    ],
  },
  {
    id: 'virar-professor',
    area: GUIA_AREA.AULAS,
    title: tk('Começar a dar aulas'),
    summary: tk('Criar o seu perfil de professor e abrir a agenda.'),
    keywords: ['professor', 'dar aula', 'coach', 'agenda', 'perfil de professor'],
    screens: ['/coaches', '/aulas'],
    steps: [
      {
        id: 'sou',
        route: '/coaches',
        goTo: '/coaches',
        target: 'professor-sou',
        advanceOn: { appears: 'professor-formulario' },
        action: TOQUE(tk('Sou professor')),
        title: tk('O seu perfil de professor'),
        body: tk('É ele que aparece na busca de professores e recebe os pedidos de aula.'),
      },
      {
        id: 'formulario',
        route: '/coaches',
        target: 'professor-formulario',
        title: tk('Conte como é a sua aula'),
        body: tk('Cidade, modalidades, níveis, valor e se está aceitando alunos. Salve para aparecer na busca.'),
      },
      {
        id: 'painel',
        title: tk('Depois: o Painel do professor'),
        body: tk('Com o perfil salvo, a Minha área ganha a seção "Professor", que leva ao painel: agenda, alunos, clínicas e horários disponíveis. Em Configurações → Menu, o padrão "Professor" põe o painel na barra lateral.'),
      },
    ],
  },
  {
    id: 'disponibilidade-professor',
    area: GUIA_AREA.AULAS,
    audience: 'professor',
    title: tk('Definir os seus horários de aula'),
    summary: tk('A disponibilidade semanal que os alunos veem ao pedir aula.'),
    keywords: ['disponibilidade', 'horário', 'agenda', 'professor', 'janela'],
    screens: ['/aulas'],
    steps: [
      {
        id: 'secoes',
        route: '/aulas',
        goTo: '/aulas?aba=agenda',
        target: 'professor-secoes',
        title: tk('O Painel do professor'),
        body: tk('Perfil, Agenda, Alunos, Clínicas e o resto — cada seção com as suas abas.'),
      },
      {
        id: 'disponibilidade',
        route: '/aulas',
        target: 'professor-disponibilidade',
        title: tk('Disponibilidade semanal'),
        body: tk('Os dias e horários em que você dá aula. Os alunos só pedem aula dentro deles.'),
      },
      {
        id: 'janela',
        route: '/aulas',
        target: ['professor-janela', 'professor-disponibilidade'],
        title: tk('Acrescente janelas'),
        body: tk('"+ Janela" acrescenta outro período no mesmo dia.'),
      },
      {
        id: 'salvar',
        route: '/aulas',
        target: ['professor-salvar-disponibilidade', 'professor-disponibilidade'],
        title: tk('Salve'),
        body: tk('Só vale depois de "Salvar disponibilidade".'),
      },
    ],
  },

  /* ------------------------------------------------------------ treino -- */
  {
    id: 'mercado-comprar',
    area: GUIA_AREA.COMUNIDADE,
    flags: ['marketplace'],
    title: tk('Comprar no Mercado'),
    summary: tk('Buscar, pôr no carrinho e pagar por Pix direto a quem vende.'),
    keywords: ['mercado', 'comprar', 'carrinho', 'raquete', 'usado', 'pix', 'marketplace'],
    screens: ['/mercado'],
    steps: [
      {
        id: 'busca',
        route: '/mercado',
        goTo: '/mercado',
        target: 'mercado-busca',
        title: tk('Busque pelo nome'),
        body: tk('Raquete, bola, tênis, marca. Os resultados vêm com filtros de preço, estado (novo ou usado), cidade e entrega.'),
      },
      {
        id: 'departamentos',
        route: '/mercado',
        target: 'mercado-departamentos',
        title: tk('Ou navegue pelos departamentos'),
        body: tk('Cada departamento abre os anúncios daquele tipo de produto.'),
      },
      {
        id: 'carrinho',
        route: '/mercado',
        target: 'mercado-carrinho',
        title: tk('O carrinho'),
        body: tk('Cada vendedor vira um pedido separado. Quando o vendedor aceita, a chave Pix dele aparece no pedido.'),
        tip: tk('Pague só pelo pedido, para a chave que aparece nele.'),
      },
    ],
  },
  {
    id: 'mercado-vender',
    area: GUIA_AREA.COMUNIDADE,
    flags: ['marketplace'],
    title: tk('Vender no Mercado'),
    summary: tk('A chave Pix, o primeiro anúncio e as vendas.'),
    keywords: ['mercado', 'vender', 'anunciar', 'anúncio', 'pix', 'marketplace'],
    screens: ['/mercado', '/mercado/vender'],
    steps: [
      {
        id: 'entrar',
        route: '/mercado',
        goTo: '/mercado',
        target: 'mercado-vender',
        advanceOn: { route: '/mercado/vender' },
        title: tk('Vender'),
        body: tk('Toque em "Vender" para abrir o seu painel de vendas.'),
      },
      {
        id: 'pix',
        route: '/mercado/vender',
        goTo: '/mercado/vender',
        target: 'mercado-vender-pix',
        title: tk('Primeiro, o Pix'),
        body: tk('Em "Recebimento", cadastre a chave Pix e o nome de quem recebe. Sem ela, não dá para aceitar pedidos.'),
      },
      {
        id: 'anuncios',
        route: '/mercado/vender',
        target: 'mercado-vender-anuncios',
        title: tk('Os seus anúncios'),
        body: tk('Aqui você cria anúncios (fotos, preço, entrega), pausa e edita.'),
      },
      {
        id: 'vendas',
        route: '/mercado/vender',
        target: 'mercado-vender-vendas',
        title: tk('As vendas'),
        body: tk('Cada pedido diz o que espera de você: aceitar, conferir o Pix, enviar ou entregar.'),
      },
    ],
  },
  {
    id: 'treino-hoje',
    area: GUIA_AREA.TREINO,
    title: tk('Treinar hoje'),
    summary: tk('A rotina, o treino do dia e o registro em três toques.'),
    keywords: ['treino', 'treinar', 'hoje', 'rotina', 'começar', 'modo quadra', 'registrar'],
    screens: ['/treino'],
    steps: [
      {
        id: 'secoes',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-secoes',
        title: tk('O Treino'),
        body: tk('Treinar (Hoje, Planos, Diário, Evolução), Conteúdo (Biblioteca, Meus, Recebidos) e Conversa (Dúvidas). Tudo no mesmo lugar.'),
      },
      {
        id: 'rotina',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: ['treino-hoje-rotina', 'treino-aba-hoje'],
        title: tk('A sua rotina'),
        body: tk('Dias, tempo e onde você treina. Com ela, o "Hoje" sugere um treino do seu tamanho. Dá para ajustar depois em "Ajustar".'),
      },
      {
        id: 'comecar',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: ['treino-hoje-comecar', 'treino-aba-hoje'],
        title: tk('Começar'),
        body: tk('Abre o modo quadra: a tela fica acesa e conta o tempo de cada bloco, um de cada vez.'),
        tip: tk('O "Hoje" vem do seu plano ativo; sem plano, do que o professor mandou com prazo; senão, de uma sugestão pelo seu nível.'),
      },
      {
        id: 'registrar',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: ['treino-hoje-registrar', 'treino-aba-hoje'],
        title: tk('Registre o que fez'),
        body: tk('O que fez, quanto tempo e o esforço (0 a 10). É o que alimenta o diário e a evolução.'),
      },
    ],
  },
  {
    id: 'treino-plano',
    area: GUIA_AREA.TREINO,
    title: tk('Montar um plano de semanas'),
    summary: tk('De 1 a 16 semanas, nos dias e no tempo que você tem.'),
    keywords: ['plano', 'planejar', 'semanas', 'periodização', 'programa', 'treino'],
    screens: ['/treino', '/treino/planos/*'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-planos',
        advanceOn: 'click',
        action: TOQUE(tk('Planos')),
        title: tk('Os planos'),
        body: tk('Um plano dá a cada dia de treino o que fazer, por algumas semanas.'),
      },
      {
        id: 'criar',
        route: '/treino',
        goTo: '/treino?aba=planos',
        target: 'treino-planos-criar',
        title: tk('Crie o plano'),
        body: tk('Escolha o objetivo, as semanas e os dias. O assistente monta e você ajusta. O plano ativo vira o "Hoje".'),
      },
      {
        id: 'semanas',
        route: '/treino/planos/*',
        target: ['treino-plano-semanas', 'treino-plano-editar-dia'],
        awayText: tk('Abra um plano para ver as semanas dele.'),
        title: tk('Ajuste dia a dia'),
        body: tk('Em "Editar o dia", acrescente vários itens da biblioteca de uma vez, mude a ordem e veja se cabem no tempo do plano. Dá para repetir o dia nas semanas seguintes.'),
        tip: tk('Na ficha de qualquer drill, "Pôr no plano" acrescenta ele a um dia.'),
      },
    ],
  },
  {
    id: 'treino-golpes',
    area: GUIA_AREA.TREINO,
    title: tk('Aprender um golpe pela trilha'),
    summary: tk('Os golpes do pickleball em ordem de aprender, com o corpo ponto a ponto.'),
    keywords: ['golpe', 'golpes', 'trilha', 'fundamento', 'técnica', 'aprender', 'certo', 'errado', 'movimento'],
    screens: ['/treino', '/treino/golpes', '/treino/item/*'],
    steps: [
      {
        id: 'abrir',
        route: '/treino',
        goTo: '/treino?aba=biblioteca',
        target: 'treino-biblioteca-golpes',
        advanceOn: { route: '/treino/golpes' },
        action: TOQUE(tk('Trilha dos golpes')),
        title: tk('A trilha dos golpes'),
        body: tk('Fica no topo da Biblioteca: todos os golpes e movimentos, do básico ao avançado.'),
      },
      {
        id: 'proximo',
        route: '/treino/golpes',
        target: ['treino-golpes-proximo', 'treino-golpes-familias'],
        title: tk('Por onde começar'),
        body: tk('O "Seu próximo golpe" continua de onde você parou. Ou escolha uma família: base, saque, fundo, transição, cozinha, rede.'),
      },
      {
        id: 'ficha',
        route: '/treino/item/*',
        target: 'treino-item-trilha',
        awayText: tk('Abra um golpe da trilha para ver a ficha dele.'),
        title: tk('O golpe por inteiro'),
        body: tk('Passo a passo, o corpo ponto a ponto, o certo e o errado e como saber se fez certo. Embaixo, o próximo golpe e os drills para treiná-lo.'),
        tip: tk('Marque o seu domínio na ficha: é ele que move a trilha.'),
      },
    ],
  },
  {
    id: 'treino-biblioteca',
    area: GUIA_AREA.TREINO,
    title: tk('Achar um drill na Biblioteca'),
    summary: tk('Filtrar pelo seu nível, abrir a ficha e levar para o seu treino.'),
    keywords: ['biblioteca', 'drill', 'exercício', 'achar', 'filtro', 'nível', 'indicar', 'copiar'],
    screens: ['/treino', '/treino/item/*'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-biblioteca',
        advanceOn: 'click',
        action: TOQUE(tk('Biblioteca')),
        title: tk('A Biblioteca'),
        body: tk('O conteúdo da Equipe PickleRush, dos professores, da comunidade e o que o seu professor deixou só para os alunos dele.'),
      },
      {
        id: 'nivel',
        route: '/treino',
        goTo: '/treino?aba=biblioteca',
        target: ['treino-biblioteca-nivel', 'treino-biblioteca-filtros'],
        title: tk('Do meu nível'),
        body: tk('Mostra só o que serve para o seu nível na plataforma (2.0 a 8.0). Sem nível, você vê tudo.'),
      },
      {
        id: 'abrir',
        route: '/treino',
        goTo: '/treino?aba=biblioteca',
        target: 'treino-biblioteca-filtros',
        advanceOn: { route: '/treino/item/*' },
        action: tk('Toque num item da lista'),
        title: tk('Abra a ficha'),
        body: tk('Filtre por tipo, habilidade e local, e toque num item. Cada um diz quem o criou.'),
      },
      {
        id: 'levar',
        route: '/treino/item/*',
        target: ['treino-item-registrar', 'treino-item-plano'],
        title: tk('Leve para o seu treino'),
        body: tk('"Registrar que fiz" vai para o diário; "Pôr no plano" acrescenta a um dia da semana.'),
      },
      {
        id: 'indicar',
        route: '/treino/item/*',
        target: ['treino-item-enviar', 'treino-item-plano'],
        title: tk('Indique a alguém'),
        body: tk('"Indicar" manda o item a outros atletas, com um recado. Chega na aba Recebidos deles.'),
      },
    ],
  },
  {
    id: 'treino-criar',
    area: GUIA_AREA.TREINO,
    title: tk('Criar um drill ou treino'),
    summary: tk('O tipo, o certo e o errado, fotos e vídeos — e quem vê.'),
    keywords: ['criar', 'drill', 'treino', 'publicar', 'vídeo', 'foto', 'ia', 'privado', 'público'],
    screens: ['/treino', '/treino/novo'],
    steps: [
      {
        id: 'criar',
        route: '/treino',
        goTo: '/treino',
        target: 'treino-criar',
        advanceOn: { route: '/treino/novo' },
        action: TOQUE(tk('Criar drill ou treino')),
        title: tk('Comece por aqui'),
        body: tk('Qualquer pessoa cria. O formulário segue o modelo dos cursos de treinador.'),
      },
      {
        id: 'tipo',
        route: '/treino/novo',
        goTo: '/treino/novo',
        target: 'treino-editor-tipo',
        title: tk('O tipo'),
        body: tk('Drill, treino em blocos, fundamento, jogada, físico ou estudo. O formulário só mostra o que vale para o tipo escolhido.'),
      },
      {
        id: 'ia',
        route: '/treino/novo',
        target: ['treino-editor-ia', 'treino-editor-tipo'],
        title: tk('Criar com IA (se quiser)'),
        body: tk('Monta um pedido para você colar na IA que preferir; a resposta, colada de volta, preenche o formulário. O item leva o selo "IA".'),
        tip: tk('Revise tudo antes de publicar: a IA erra.'),
      },
      {
        id: 'midia',
        route: '/treino/novo',
        target: ['treino-editor-midia', 'treino-editor-tipo'],
        title: tk('Fotos e vídeos'),
        body: tk('Por link (YouTube, Vimeo) ou enviando o arquivo: vídeo de até 60 segundos e 60 MB, imagem de até 3 MB.'),
      },
      {
        id: 'visibilidade',
        route: '/treino/novo',
        target: 'treino-editor-visibilidade',
        title: tk('Quem vê'),
        body: tk('Só eu, público (passa pela revisão da equipe; o professor verificado publica direto) ou, para professor, só os seus alunos.'),
      },
      {
        id: 'salvar',
        route: '/treino/novo',
        target: ['treino-editor-salvar', 'treino-editor-qualidade'],
        title: tk('Salve'),
        body: tk('O medidor diz o que ainda falta — ele orienta, não impede salvar. O rascunho fica guardado no aparelho enquanto você escreve.'),
      },
    ],
  },
  {
    id: 'treino-evolucao',
    area: GUIA_AREA.TREINO,
    title: tk('Acompanhar o diário e a evolução'),
    summary: tk('O que você treinou, semana a semana, e quanto evoluiu.'),
    keywords: ['diário', 'evolução', 'carga', 'esforço', 'semana', 'autoavaliação', 'registrar'],
    screens: ['/treino'],
    steps: [
      {
        id: 'diario',
        route: '/treino',
        goTo: '/treino?aba=diario',
        target: ['treino-diario-registrar', 'treino-aba-diario'],
        title: tk('O diário'),
        body: tk('Cada treino registrado, com o planejado ao lado. O que ficou para depois não é falha: a semana segue.'),
        tip: tk('Não registre dor, lesão ou remédio: para isso, procure um profissional de saúde.'),
      },
      {
        id: 'aba-evolucao',
        route: '/treino',
        goTo: '/treino?aba=diario',
        target: 'treino-aba-evolucao',
        advanceOn: 'click',
        action: TOQUE(tk('Evolução')),
        title: tk('A evolução'),
        body: tk('Os números que saem do diário.'),
      },
      {
        id: 'carga',
        route: '/treino',
        goTo: '/treino?aba=evolucao',
        target: ['treino-evolucao-carga', 'treino-aba-evolucao'],
        title: tk('Minutos e carga'),
        body: tk('Por semana: os minutos e a carga (esforço × minutos). Subir aos poucos é o que dá resultado.'),
      },
      {
        id: 'avaliacao',
        route: '/treino',
        goTo: '/treino?aba=evolucao',
        target: ['treino-evolucao-avaliacao', 'treino-aba-evolucao'],
        title: tk('Autoavaliação'),
        body: tk('A cada 4 semanas, como você se vê em cada fundamento. Comparar com a anterior mostra o que melhorou.'),
      },
    ],
  },
  {
    id: 'treino-balanco',
    area: GUIA_AREA.TREINO,
    title: tk('Fazer o balanço de um jogo'),
    summary: tk('Contar como foi o jogo e receber a semana de treino sugerida.'),
    keywords: ['balanço', 'depois do jogo', 'desempenho', 'ponto fraco', 'melhorar', 'sugestão', 'treino'],
    screens: ['/treino'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-balanco',
        advanceOn: 'click',
        action: TOQUE(tk('Balanço')),
        title: tk('O balanço do jogo'),
        body: tk('Depois de jogar, você conta como foi e a plataforma sugere o que treinar na semana.'),
      },
      {
        id: 'ligar',
        route: '/treino',
        goTo: '/treino?aba=balanco',
        target: ['treino-balanco-pendentes', 'treino-balanco-ligar'],
        title: tk('Só se você quiser'),
        body: tk('Ligado, os jogos dos últimos 7 dias (dia de jogo, torneio, reserva) aparecem aqui depois que terminam. Toque em "Fazer o balanço".'),
        tip: tk('Só você vê as respostas. Dá para desligar quando quiser.'),
      },
      {
        id: 'avulso',
        route: '/treino',
        goTo: '/treino?aba=balanco',
        target: ['treino-balanco-avulso', 'treino-balanco-ligar'],
        title: tk('Outro jogo'),
        body: tk('Jogou fora da plataforma? "Balanço de outro jogo" pede só a data.'),
      },
    ],
  },
  {
    id: 'treino-duvidas',
    area: GUIA_AREA.TREINO,
    title: tk('Tirar uma dúvida com o professor'),
    summary: tk('Perguntas privadas, só entre você e o seu professor.'),
    keywords: ['dúvida', 'pergunta', 'professor', 'conversa', 'treino'],
    screens: ['/treino'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-duvidas',
        advanceOn: 'click',
        action: TOQUE(tk('Dúvidas')),
        title: tk('As dúvidas'),
        body: tk('Só vocês dois veem a conversa.'),
      },
      {
        id: 'nova',
        route: '/treino',
        goTo: '/treino?aba=duvidas',
        target: ['treino-duvidas-nova', 'treino-duvidas-lista'],
        title: tk('Pergunte'),
        body: tk('Sobre um drill, um golpe ou o seu treino. Aparece para quem tem professor com vínculo ativo.'),
        tip: tk('Na ficha de um drill, "Perguntar ao professor" já leva o item junto.'),
      },
    ],
  },
  {
    id: 'treino-alunos',
    area: GUIA_AREA.TREINO,
    audience: 'professor',
    title: tk('Treinos para os seus alunos'),
    summary: tk('Enviar com prazo, confirmar sessões e responder dúvidas.'),
    keywords: ['aluno', 'alunos', 'enviar', 'prazo', 'professor', 'confirmar', 'sessão'],
    screens: ['/treino', '/treino/item/*'],
    steps: [
      {
        id: 'aba',
        route: '/treino',
        goTo: '/treino?aba=hoje',
        target: 'treino-aba-alunos',
        advanceOn: 'click',
        action: TOQUE(tk('Alunos')),
        title: tk('Os seus alunos'),
        body: tk('O que cada um recebeu e fez, e as sessões que eles compartilharam com você.'),
      },
      {
        id: 'lista',
        route: '/treino',
        goTo: '/treino?aba=alunos',
        target: ['treino-alunos-lista', 'treino-aba-alunos'],
        title: tk('Quem treina com você'),
        body: tk('Só aparecem os alunos com vínculo ativo — é deles que você recebe sessões e dúvidas.'),
      },
      {
        id: 'confirmar',
        route: '/treino',
        goTo: '/treino?aba=alunos',
        target: ['treino-alunos-confirmar', 'treino-alunos-lista'],
        title: tk('Confirme e comente'),
        body: tk('Uma sessão compartilhada espera a sua confirmação. Um comentário curto vale mais que um longo.'),
      },
      {
        id: 'enviar',
        title: tk('Enviar um treino'),
        body: tk('Na ficha de qualquer item seu ou da Biblioteca, "Enviar ou indicar": escolha os alunos e o prazo. Chega na aba Recebidos deles.'),
      },
    ],
  },
  {
    id: 'treino-admin',
    area: GUIA_AREA.TREINO,
    audience: 'admin',
    title: tk('Cuidar do Centro de Treino (admin)'),
    summary: tk('Revisão, denúncias, conteúdo, biblioteca e as configurações.'),
    keywords: ['admin', 'treino', 'revisão', 'denúncia', 'moderação', 'biblioteca', 'semente', 'configuração'],
    screens: ['/admin/painel'],
    steps: [
      {
        id: 'secao',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-revisao',
        target: 'admin-secao-treino',
        title: tk('A seção Treino'),
        body: tk('Os números do topo levam às telas: itens, revisão, denúncias e biblioteca.'),
      },
      {
        id: 'revisao',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-revisao',
        target: ['admin-treino-revisao', 'admin-secao-treino'],
        title: tk('Revisão'),
        body: tk('O conteúdo público que passa por revisão espera aqui. "Aprovar e publicar" põe na Biblioteca; "Aprovar e verificar o professor" também faz o próximo conteúdo dele entrar direto; "Recusar" devolve ao autor com uma nota.'),
      },
      {
        id: 'denuncias',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-denuncias',
        target: ['admin-treino-denuncias', 'admin-secao-treino'],
        title: tk('Denúncias'),
        body: tk('O que alguém achou errado ou perigoso, com o motivo. Marque procedente ou improcedente, ou oculte o item — ele sai da Biblioteca na hora.'),
      },
      {
        id: 'conteudo',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-conteudo',
        target: ['admin-treino-conteudo', 'admin-secao-treino'],
        title: tk('Todo o conteúdo'),
        body: tk('Todos os itens, de todos os autores: buscar, destacar, ocultar e editar. Editar mantém a autoria; ocultar e excluir avisam o autor.'),
      },
      {
        id: 'biblioteca',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-biblioteca',
        target: ['admin-treino-biblioteca', 'admin-secao-treino'],
        title: tk('A biblioteca da plataforma'),
        body: tk('Instalar a biblioteca inicial da Equipe PickleRush e importar itens em lote. Instalar de novo é seguro: não mexe no que a equipe editou nem recria o que foi apagado.'),
      },
      {
        id: 'config',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=treino-config',
        target: ['admin-treino-config', 'admin-secao-treino'],
        title: tk('As configurações'),
        body: tk('A revisão de atletas e de professores, quem pode publicar, o envio de imagens e vídeos (tamanho e duração) e o compartilhamento.'),
      },
    ],
  },

  /* ------------------------------------------------------- gamificação -- */
  {
    id: 'gamificacao-entender',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Entender o XP, o nível e o tier'),
    summary: tk('O que a gamificação mede, de onde vem o seu XP e onde tirar dúvidas.'),
    keywords: ['xp', 'nível', 'tier', 'pontos', 'gamificação', 'como funciona', 'jornada'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'resumo',
        route: '/gamification',
        goTo: '/gamification',
        target: 'gamificacao-resumo',
        title: tk('O resumo da sua jornada'),
        body: [
          tk('O tier é a faixa grande (Bronze, Prata, Ouro…); o nível é o degrau dentro dela. Ao lado, as semanas seguidas jogando e as conquistas que você já abriu.'),
          tk('Tudo isso sai do que você faz de verdade na plataforma: jogos, torneios, missões e conquistas.'),
        ],
        tip: tk('XP não se gasta nem se compra — ele só mede o quanto você jogou e evoluiu.'),
      },
      {
        id: 'origem',
        route: '/gamification',
        target: 'xp-origem',
        title: tk('De onde vem o seu XP'),
        body: tk('Abra este cartão para ver a conta: quanto veio de jogos, de torneios, de bônus de conquistas e de missões. Não existe XP escondido.'),
      },
      {
        id: 'como-funciona',
        route: '/gamification',
        target: 'gamificacao-como-funciona',
        title: tk('O "Como funciona" de cada aba'),
        body: tk('No topo de cada seção há um cartão curto com o essencial daquela parte. Ele abre na primeira vez e depois lembra se você o recolheu.'),
      },
      {
        id: 'guia',
        route: '/gamification',
        target: 'gamificacao-guia',
        advanceOn: { route: '/gamification/como-funciona' },
        action: tk('Toque no ponto de interrogação'),
        title: tk('O guia completo'),
        body: tk('Cada conceito explicado, por público (atleta, professor, arena, clube), com os números reais da plataforma.'),
      },
      {
        id: 'busca',
        route: '/gamification/como-funciona',
        target: 'guia-busca',
        title: tk('Busque pelo que quer saber'),
        body: tk('Digite "sequência", "duelo" ou "privacidade". A busca ignora acento e mostra primeiro o termo que tem o nome que você digitou.'),
      },
    ],
  },
  {
    id: 'gamificacao-missoes',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Cumprir missões e primeiros passos'),
    summary: tk('Metas curtas por dia, semana e mês — e o roteiro de quem está começando.'),
    keywords: ['missão', 'missões', 'diária', 'semanal', 'mensal', 'primeiros passos', 'bônus'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'primeiros-passos',
        route: '/gamification',
        goTo: '/gamification?aba=jornada',
        target: 'primeiros-passos',
        title: tk('Os primeiros passos'),
        body: tk('Um roteiro curto para quem acabou de chegar: cada passo concluído já soma XP. Quando você termina (ou dispensa), ele sai daqui.'),
        tip: tk('Dispensou sem querer? Em Preferências → "Como aparece para mim" dá para mostrá-los de novo.'),
      },
      {
        id: 'abas',
        route: '/gamification',
        target: 'gamificacao-abas',
        title: tk('As seções'),
        body: tk('Jornada, Missões, Competir, Social e Recompensas. A pessoa só vê as que a plataforma deixou ligadas.'),
      },
      {
        id: 'aba-missoes',
        route: '/gamification',
        target: 'aba-missoes',
        advanceOn: 'click',
        action: TOQUE(tk('Missões')),
        title: tk('Missões'),
        body: tk('Abra a seção das suas metas.'),
      },
      {
        id: 'missoes',
        route: '/gamification',
        target: 'missoes',
        title: tk('Diárias, semanais e mensais'),
        body: [
          tk('Cada missão é medida pelo que você joga de verdade; o progresso anda sozinho.'),
          tk('Terminar todas as de um período rende um bônus de XP — e as missões novas chegam quando o período vira.'),
        ],
        tip: tk('Missão que não deu para cumprir não tira nada de você. Ela só não conta.'),
      },
    ],
  },
  {
    id: 'gamificacao-sequencia',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Manter a sequência e tirar férias'),
    summary: tk('Semanas seguidas jogando, a folga automática e as férias.'),
    keywords: ['sequência', 'streak', 'semanas', 'férias', 'folga', 'pausa'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'sequencia',
        route: '/gamification',
        goTo: '/gamification?aba=jornada',
        target: 'sequencia',
        title: tk('A sua sequência'),
        body: [
          tk('Conta as semanas seguidas (de segunda a domingo) em que você jogou pelo menos uma vez. A semana de agora ainda está aberta: se você não jogou ainda, ela aparece "em risco", não quebrada.'),
          tk('Quem para por muito tempo volta a zero — o recorde, porém, fica guardado.'),
        ],
        tip: tk('Uma semana sem jogar por mês é perdoada sozinha (a folga automática). Duas seguidas, não.'),
      },
      {
        id: 'ferias',
        route: '/gamification',
        target: ['sequencia-ferias', 'sequencia'],
        title: tk('Férias'),
        body: [
          tk('Vai viajar ou ficar parado? Declare férias e a sequência fica preservada por até {semanasDeFerias} semanas — elas não somam, mas também não quebram.'),
          tk('Dá para tirar férias de novo depois de {diasEntreFerias} dias, para a pausa não virar atalho.'),
        ],
        tip: tk('Voltou antes? Encerre as férias no mesmo cartão.'),
      },
    ],
  },
  {
    id: 'gamificacao-revisao',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Ver a revisão da semana ou do mês'),
    summary: tk('O que você fez no período, comparado com o anterior.'),
    keywords: ['revisão', 'resumo', 'semana', 'mês', 'balanço', 'período'],
    screens: ['/gamification/revisao'],
    steps: [
      {
        id: 'tipo',
        route: '/gamification/revisao',
        goTo: '/gamification/revisao',
        target: 'revisao-tipo',
        title: tk('Semana ou mês'),
        body: tk('Escolha o tamanho do período. A revisão compara com o anterior para mostrar para onde você está indo.'),
      },
      {
        id: 'periodo',
        route: '/gamification/revisao',
        target: 'revisao-periodo',
        title: tk('Volte no tempo'),
        body: tk('As setas levam ao período anterior e de volta. Não dá para ver o futuro, claro.'),
      },
      {
        id: 'corpo',
        route: '/gamification/revisao',
        target: 'revisao-corpo',
        title: tk('O resumo'),
        body: tk('Jogos, vitórias, dias ativos e missões — e a conquista que está mais perto de abrir. Nada aqui é cobrança: é só um espelho.'),
      },
    ],
  },
  {
    id: 'gamificacao-competir',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Competir: temporada, duelo e desafios'),
    summary: tk('O placar do mês, o duelo da semana e os desafios abertos.'),
    keywords: ['competir', 'temporada', 'duelo', 'desafio', 'ranking', 'hall'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'aba',
        route: '/gamification',
        goTo: '/gamification',
        target: 'aba-competir',
        advanceOn: 'click',
        action: TOQUE(tk('Competir')),
        title: tk('Competir'),
        body: tk('Abra a seção da disputa.'),
      },
      {
        id: 'temporada',
        route: '/gamification',
        target: 'temporada',
        title: tk('A temporada do mês'),
        body: tk('Cada mês é uma temporada: o XP do mês decide a posição e recomeça do zero. No fim, os melhores recebem um prêmio em XP.'),
        tip: tk('Só aparece no placar público quem escolheu aparecer e já chegou ao tier mínimo.'),
      },
      {
        id: 'duelo',
        route: '/gamification',
        target: 'duelo',
        title: tk('O duelo da semana'),
        body: tk('Você é emparelhado com alguém de nível parecido e vence quem jogar melhor naquela semana. Só entra quem aceitou participar.'),
      },
      {
        id: 'desafios',
        route: '/gamification',
        target: 'desafios',
        title: tk('Desafios'),
        body: tk('Competições com começo, fim e placar, criadas pela plataforma, por arenas, professores e clubes. O servidor mede — você só joga.'),
      },
    ],
  },
  {
    id: 'gamificacao-social',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Avaliar quem jogou com você'),
    summary: tk('Avaliações, cartas aos parceiros e a sua reputação.'),
    keywords: ['avaliação', 'avaliar', 'carta', 'parceiro', 'reputação', 'elogio', 'social'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'aba',
        route: '/gamification',
        goTo: '/gamification',
        target: 'aba-social',
        advanceOn: 'click',
        action: TOQUE(tk('Social')),
        title: tk('Social'),
        body: tk('Abra a seção da convivência.'),
      },
      {
        id: 'reputacao',
        route: '/gamification',
        target: 'reputacao',
        title: tk('A sua reputação'),
        body: tk('A média das avaliações que você recebeu e os elogios mais comuns. Você vê só a média — nunca quem deu qual nota.'),
      },
      {
        id: 'avaliacoes',
        route: '/gamification',
        target: 'avaliacoes',
        title: tk('Avaliar um jogo'),
        body: tk('Depois de jogar, dê uma nota e escolha elogios. É rápido, e quem recebe vê só o conjunto.'),
      },
      {
        id: 'cartas',
        route: '/gamification',
        target: 'cartas',
        title: tk('Cartas aos parceiros'),
        body: tk('Um agradecimento curto a quem jogou com você. Anônimo por padrão; quem recebe pode apagar ou denunciar.'),
      },
    ],
  },
  {
    id: 'gamificacao-vinculos',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Rivais, crews e mentorias'),
    summary: tk('Com quem você joga mais, os grupos de amigos e quem ensina quem.'),
    keywords: ['vínculos', 'rival', 'crew', 'mentoria', 'mentor', 'grupo', 'amigos'],
    screens: ['/vinculos'],
    steps: [
      {
        id: 'abas',
        route: '/vinculos',
        goTo: '/vinculos',
        target: 'vinculos-abas',
        title: tk('Três tipos de vínculo'),
        body: tk('Rivais (de quem você mais enfrenta), crews (grupos de amigos) e mentorias (um ensina, o outro aprende).'),
      },
      {
        id: 'rivais',
        route: '/vinculos',
        target: 'vinculos-rivais',
        title: tk('Rivais'),
        body: tk('Quem você mais enfrentou — e como ficou o placar entre vocês. Os rivais surgem sozinhos dos seus jogos.'),
      },
      {
        id: 'aba-crews',
        route: '/vinculos',
        target: 'vinculos-aba-crews',
        advanceOn: 'click',
        action: TOQUE(tk('Crews')),
        title: tk('Crews'),
        body: tk('Abra os seus grupos.'),
      },
      {
        id: 'crews',
        route: '/vinculos',
        target: 'vinculos-crews',
        title: tk('Crie ou entre num grupo'),
        body: tk('Uma crew soma o que o grupo joga junto. Dá para sair quando quiser, em um toque.'),
      },
      {
        id: 'aba-mentorias',
        route: '/vinculos',
        target: 'vinculos-aba-mentorias',
        advanceOn: 'click',
        action: TOQUE(tk('Mentorias')),
        title: tk('Mentorias'),
        body: tk('Abra as suas mentorias.'),
      },
      {
        id: 'mentorias',
        route: '/vinculos',
        target: 'vinculos-mentorias',
        title: tk('Ensinar ou aprender'),
        body: tk('Convide alguém como mentor ou como aprendiz. A outra pessoa precisa aceitar — ninguém é colocado numa mentoria sem querer.'),
      },
    ],
  },
  {
    id: 'gamificacao-recompensas',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Pedir uma recompensa'),
    summary: tk('Benefícios de arenas, professores e clubes para quem joga e evolui.'),
    keywords: ['recompensa', 'prêmio', 'benefício', 'código', 'resgatar', 'brinde'],
    screens: ['/gamification'],
    steps: [
      {
        id: 'aba',
        route: '/gamification',
        goTo: '/gamification',
        target: 'aba-recompensas',
        advanceOn: 'click',
        action: TOQUE(tk('Recompensas')),
        title: tk('Recompensas'),
        body: tk('Abra a seção dos benefícios.'),
      },
      {
        id: 'lista',
        route: '/gamification',
        target: 'recompensas',
        title: tk('O que você pode pedir'),
        body: [
          tk('Cada recompensa diz o critério (por exemplo, um tier ou um número de jogos) e quem a oferece.'),
          tk('Quando você se qualifica, pede e recebe um código. Quem oferece confere e libera — nada é entregue sozinho.'),
        ],
        tip: tk('Recompensas não são compradas com XP: o XP mostra que você se qualificou, e não é gasto.'),
      },
    ],
  },
  {
    id: 'gamificacao-hall',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Ver o Hall da Fama e a temporada'),
    summary: tk('Os maiores atletas por XP, por estado e por mês.'),
    keywords: ['hall da fama', 'placar', 'ranking', 'temporada', 'estado', 'posição'],
    screens: ['/hall-da-fama'],
    steps: [
      {
        id: 'abas',
        route: '/hall-da-fama',
        goTo: '/hall-da-fama',
        target: 'hall-abas',
        title: tk('Hall ou temporada'),
        body: tk('O Hall soma o XP de sempre; a temporada, só o do mês — e recomeça todo mês.'),
      },
      {
        id: 'estado',
        route: '/hall-da-fama',
        target: 'hall-estado',
        title: tk('Filtre por estado'),
        body: tk('Veja só os atletas do seu estado — ou o Brasil todo.'),
      },
      {
        id: 'minha-posicao',
        route: '/hall-da-fama',
        target: 'hall-minha-posicao',
        title: tk('Onde você está'),
        body: tk('A sua posição aparece aqui. Se você não está no placar público, o motivo vem dito — e o atalho leva às preferências, onde você escolhe se quer aparecer.'),
      },
    ],
  },
  {
    id: 'gamificacao-conquistas',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Explorar as conquistas'),
    summary: tk('Os troféus, o que falta para abrir cada um e quanto XP dão.'),
    keywords: ['conquista', 'troféu', 'raridade', 'medalha', 'progresso'],
    screens: ['/conquistas'],
    steps: [
      {
        id: 'filtros',
        route: '/conquistas',
        goTo: '/conquistas',
        target: 'conquistas-filtros',
        title: tk('Filtre o catálogo'),
        body: tk('Por família (jogos, torneios, social…) e por raridade. Dá para ver só as que você já abriu.'),
      },
      {
        id: 'lista',
        route: '/conquistas',
        target: 'conquistas-lista',
        title: tk('O que falta para abrir'),
        body: tk('Cada cartão mostra o seu progresso. Ao abrir uma conquista você ganha XP de bônus — e pode escolher uma como título ao lado do seu nome.'),
        tip: tk('As conquistas que a plataforma ainda não consegue medir ficam numa lista "Em breve" e não entram na sua conta.'),
      },
    ],
  },
  {
    id: 'gamificacao-privacidade',
    area: GUIA_AREA.GAMIFICACAO,
    title: tk('Escolher o que os outros veem de você'),
    summary: tk('Privacidade, avisos e como você aparece na gamificação.'),
    keywords: ['privacidade', 'placar', 'preferências', 'avisos', 'título', 'ocultar', 'aparecer'],
    screens: ['/gamification', '/gamification/configuracoes'],
    steps: [
      {
        id: 'abrir',
        route: '/gamification',
        goTo: '/gamification',
        target: 'gamificacao-preferencias',
        advanceOn: { route: '/gamification/configuracoes' },
        action: tk('Toque na engrenagem'),
        title: tk('As preferências'),
        body: tk('A engrenagem leva ao lugar onde você decide o que a gamificação mostra, o que ela avisa e como você aparece.'),
      },
      {
        id: 'privacidade',
        route: '/gamification/configuracoes',
        target: 'prefs-privacidade',
        title: tk('Privacidade'),
        body: tk('Escolha se o seu nome e a sua foto entram no placar público e se o seu perfil mostra tier e conquistas. A regra vale no servidor, não só na tela.'),
        tip: tk('Desligado, você continua ranqueando e recebendo prêmios — só ninguém vê.'),
      },
      {
        id: 'interacao',
        route: '/gamification/configuracoes',
        target: 'prefs-interacao',
        title: tk('Interação com outros atletas'),
        body: tk('Duelo, avaliações e cartas só chegam a você se você deixar. Desligar é de um toque e sem explicação.'),
      },
      {
        id: 'avisos',
        route: '/gamification/configuracoes',
        target: 'prefs-avisos',
        title: tk('Avisos'),
        body: tk('Só o que você quer receber no sino: resumo da semana, duelo e resultado dos desafios.'),
      },
      {
        id: 'aparencia',
        route: '/gamification/configuracoes',
        target: 'prefs-aparencia',
        title: tk('Como aparece para mim'),
        body: tk('Comemorações dos marcos e o título que fica ao lado do seu nome — o tier ou uma conquista que você escolher.'),
      },
    ],
  },
  {
    id: 'gamificacao-oferecer-arena',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'arena',
    title: tk('Engajar os atletas da sua arena'),
    summary: tk('A saúde da arena, as metas do mês, e como criar desafios e recompensas.'),
    keywords: ['engajamento', 'desafio', 'recompensa', 'meta', 'saúde', 'arena', 'fidelizar'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'aba',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=engajamento',
        target: 'arena-aba-engajamento',
        title: tk('Engajamento'),
        body: tk('Fica em Desempenho. Reúne a saúde da arena, as metas do mês, os desafios e as recompensas que você oferece.'),
      },
      {
        id: 'saude',
        route: '/arenas/*/gerir',
        target: 'oferta-saude',
        title: tk('A saúde da arena'),
        body: tk('Uma nota de 0 a 100 que só você vê, com o que a puxou para cima e para baixo — e sugestões do que fazer.'),
      },
      {
        id: 'metas',
        route: '/arenas/*/gerir',
        target: 'oferta-metas',
        title: tk('Metas do mês'),
        body: tk('Escolha números a alcançar (jogos, jogadores novos…) e acompanhe o quanto já foi. Nada é cobrado de ninguém.'),
      },
      {
        id: 'aba-desafios',
        route: '/arenas/*/gerir',
        target: 'oferta-aba-desafios',
        advanceOn: 'click',
        action: TOQUE(tk('Desafios')),
        title: tk('Desafios'),
        body: tk('Competições com placar medido pelo servidor.'),
      },
      {
        id: 'novo-desafio',
        route: '/arenas/*/gerir',
        target: 'oferta-desafio-novo',
        advanceOn: { appears: 'oferta-desafio-form' },
        action: TOQUE(tk('Novo desafio')),
        title: tk('Crie um desafio'),
        body: tk('Por exemplo "Quem mais joga esta semana", com um brinde para o 1º lugar.'),
      },
      {
        id: 'form-desafio',
        route: '/arenas/*/gerir',
        target: 'oferta-desafio-form',
        title: tk('O que medir e por quanto tempo'),
        body: [
          tk('Dê um nome, escolha o que será medido (jogos, vitórias, dias jogados…) e as datas de início e fim.'),
          tk('Você define os prêmios; o placar é calculado pelo servidor a partir dos jogos reais, então ninguém precisa conferir à mão.'),
        ],
      },
      {
        id: 'salvar-desafio',
        route: '/arenas/*/gerir',
        target: 'oferta-desafio-salvar',
        title: tk('Salvar'),
        body: tk('O desafio aparece para os atletas. Antes de começar dá para editar; depois de começar, só cancelar.'),
      },
    ],
  },
  {
    id: 'gamificacao-recompensa-arena',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'arena',
    title: tk('Criar uma recompensa na sua arena'),
    summary: tk('Um benefício com critério claro e código para você conferir.'),
    keywords: ['recompensa', 'benefício', 'brinde', 'código', 'desconto', 'arena'],
    screens: ['/arenas/*/gerir'],
    steps: [
      {
        id: 'aba',
        route: '/arenas/*/gerir',
        goTo: '/arenas/:minhaArena/gerir?aba=engajamento',
        target: 'oferta-aba-recompensas',
        advanceOn: 'click',
        action: TOQUE(tk('Recompensas')),
        title: tk('Recompensas'),
        body: tk('Os benefícios que você oferece a quem joga e evolui.'),
      },
      {
        id: 'nova',
        route: '/arenas/*/gerir',
        target: 'oferta-recompensa-nova',
        advanceOn: { appears: 'oferta-recompensa-form' },
        action: TOQUE(tk('Nova recompensa')),
        title: tk('Nova recompensa'),
        body: tk('Pode ser uma hora de quadra, uma bebida, um desconto na aula…'),
      },
      {
        id: 'form',
        route: '/arenas/*/gerir',
        target: 'oferta-recompensa-form',
        title: tk('Critério claro'),
        body: [
          tk('Diga o que é, quem pode pedir (um tier, um número de jogos) e quantas unidades há.'),
          tk('Quem se qualifica pede e recebe um código; você confere e libera. Nada sai sem você.'),
        ],
      },
      {
        id: 'salvar',
        route: '/arenas/*/gerir',
        target: 'oferta-recompensa-salvar',
        title: tk('Salvar'),
        body: tk('Os pedidos chegam na lista abaixo: Liberar, Marcar como usada ou Recusar.'),
      },
    ],
  },
  {
    id: 'gamificacao-oferecer-professor',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'professor',
    title: tk('Engajar os seus alunos'),
    summary: tk('A saúde da sua agenda, as metas, os desafios e as recompensas.'),
    keywords: ['engajamento', 'alunos', 'desafio', 'recompensa', 'meta', 'professor'],
    screens: ['/aulas'],
    steps: [
      {
        id: 'secao',
        route: '/aulas',
        goTo: '/aulas?secao=engajamento',
        target: 'professor-aba-engajamento',
        title: tk('Engajamento'),
        body: tk('No Painel do professor, esta seção reúne saúde, metas, desafios e recompensas para os seus alunos.'),
      },
      {
        id: 'saude',
        route: '/aulas',
        target: 'oferta-saude',
        title: tk('A saúde da sua agenda'),
        body: tk('Uma nota que só você vê, com o que ajuda e o que atrapalha — e sugestões do que fazer.'),
      },
      {
        id: 'metas',
        route: '/aulas',
        target: 'oferta-metas',
        title: tk('Metas do mês'),
        body: tk('Defina números a alcançar (aulas dadas, alunos novos…) e veja o quanto já foi.'),
      },
      {
        id: 'desafios',
        route: '/aulas',
        target: 'oferta-aba-desafios',
        title: tk('Desafios e recompensas'),
        body: tk('Nas abas ao lado você cria desafios para os alunos e benefícios que eles pedem ao se qualificar — com código para você conferir.'),
      },
    ],
  },
  {
    id: 'gamificacao-admin-configurar',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'admin',
    title: tk('Configurar a gamificação (admin)'),
    summary: tk('Ligar e desligar módulos, ajustar prêmios e avisos da plataforma.'),
    keywords: ['admin', 'configuração', 'módulos', 'prêmios', 'limiares', 'avisos', 'gamificação'],
    screens: ['/admin/painel'],
    steps: [
      {
        id: 'secao',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=gam-config',
        target: 'admin-secao-gamificacao',
        title: tk('A seção Gamificação'),
        body: tk('Cinco telas: Configuração, Desafios, Recompensas, Integridade e Métricas. A flag gamification_v2 é o interruptor geral; o resto se decide aqui.'),
      },
      {
        id: 'modulos',
        route: '/admin/painel',
        target: 'admin-gam-modulos',
        title: tk('Módulos'),
        body: tk('Cada parte (missões, duelo, avaliações, recompensas…) liga e desliga sozinha. Módulo desligado some das telas e o servidor para de rodar a parte dele.'),
      },
      {
        id: 'premios',
        route: '/admin/painel',
        target: 'admin-gam-premios',
        title: tk('Prêmios e limiares'),
        body: tk('Quanto vale cada colocação da temporada, o tier mínimo do placar público e os limites das avaliações e dos duelos. Cada campo diz o intervalo aceito.'),
      },
      {
        id: 'avisos',
        route: '/admin/painel',
        target: 'admin-gam-avisos',
        title: tk('Avisos do servidor'),
        body: tk('Quais avisos o servidor envia. Cada pessoa ainda pode desligar o que não quer, nas preferências dela.'),
      },
      {
        id: 'salvar',
        route: '/admin/painel',
        target: 'admin-gam-salvar',
        title: tk('Salvar'),
        body: tk('Mostra quantas alterações estão pendentes. "Padrões de fábrica" volta tudo ao que a plataforma recomenda — só vale depois de salvar.'),
        tip: tk('Cada alteração fica na auditoria.'),
      },
    ],
  },
  {
    id: 'gamificacao-admin-integridade',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'admin',
    title: tk('Revisar a integridade (admin)'),
    summary: tk('Sinais do antifarm, contas ocultas e cartas denunciadas.'),
    keywords: ['admin', 'integridade', 'antifarm', 'moderação', 'sinais', 'cartas', 'denúncia'],
    screens: ['/admin/painel'],
    steps: [
      {
        id: 'abas',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=gam-integrity',
        target: 'admin-gam-integridade-abas',
        title: tk('Sinais, contas e cartas'),
        body: tk('Três filas de revisão: o que o antifarm marcou, as contas que você ocultou e as cartas denunciadas.'),
      },
      {
        id: 'sinais',
        route: '/admin/painel',
        target: 'admin-gam-sinais',
        title: tk('O servidor marca, nunca pune'),
        body: [
          tk('Cada sinal traz o motivo e a gravidade. Quem tem sinal grave fica fora do placar público até você decidir — o XP e os jogos continuam intactos.'),
          tk('Marque como revisado quando tiver olhado; o que ficou sem decisão fica na fila "Abertos".'),
        ],
      },
    ],
  },
  {
    id: 'gamificacao-admin-metricas',
    area: GUIA_AREA.GAMIFICACAO,
    audience: 'admin',
    title: tk('Acompanhar as métricas (admin)'),
    summary: tk('O retrato diário do uso: quem joga, quem engaja e para onde vai.'),
    keywords: ['admin', 'métricas', 'retrato', 'uso', 'evolução', 'gamificação'],
    screens: ['/admin/painel'],
    steps: [
      {
        id: 'metricas',
        route: '/admin/painel',
        goTo: '/admin/painel?tab=gam-metrics',
        target: 'admin-gam-metricas',
        title: tk('O retrato diário'),
        body: tk('O servidor grava uma foto por dia, sem dados pessoais — só contagens. Aqui você acompanha a evolução e vê se algum módulo ficou parado.'),
      },
    ],
  },

  /* -------------------------------------------------------- minha área -- */
  {
    id: 'minha-area',
    area: GUIA_AREA.COMECAR,
    title: tk('Conhecer a Minha área'),
    summary: tk('O que precisa de você e tudo o que é seu, num lugar só.'),
    keywords: ['minha área', 'perfil', 'pendências', 'precisa de você', 'central', 'meus dados'],
    screens: ['/perfil'],
    steps: [
      {
        id: 'pendencias',
        route: '/perfil',
        goTo: '/perfil',
        target: ['minha-area-pendencias', 'minha-area-secoes'],
        title: tk('Precisa de você'),
        body: tk('Pedidos de reserva, convites, aulas para responder, treinos recebidos e dúvidas esperando — cada linha leva ao lugar que resolve. Sem nada pendente, a faixa não aparece.'),
      },
      {
        id: 'secoes',
        route: '/perfil',
        goTo: '/perfil',
        target: 'minha-area-secoes',
        title: tk('As seções'),
        body: tk('Em "Você", o que é seu: resumo, perfil, jogo, agenda, torneios e conta. "Gerencio" aparece para quem dá aula, gere arena ou administra a plataforma.'),
      },
      {
        id: 'editar',
        route: '/perfil',
        goTo: '/perfil',
        target: ['perfil-editar', 'minha-area-secoes'],
        title: tk('Editar o perfil'),
        body: tk('Foto, cidade, interesses, nível e privacidade.'),
      },
    ],
  },

  /* ------------------------------------------------------------- conta -- */
  {
    id: 'escolher-aparencia',
    area: GUIA_AREA.CONTA,
    title: tk('Mudar a aparência (modo escuro)'),
    summary: tk('Claro, escuro ou automático — escolha sua, neste aparelho.'),
    keywords: ['modo escuro', 'tema', 'aparência', 'claro', 'escuro'],
    screens: ['/configuracoes'],
    steps: [
      {
        id: 'cartao',
        route: '/configuracoes',
        goTo: '/configuracoes',
        target: 'config-aparencia',
        title: tk('Aparência'),
        body: tk('Claro, Escuro ou Automático (acompanha o aparelho). A escolha é sua e fica neste aparelho.'),
        tip: tk('Também dá para trocar no menu do seu avatar e, no celular, na gaveta do menu.'),
      },
    ],
  },
  {
    id: 'escolher-cards-do-inicio',
    area: GUIA_AREA.CONTA,
    title: tk('Escolher o que aparece no início'),
    summary: tk('Ligar, desligar e ordenar os cards da tela inicial.'),
    keywords: ['início', 'cards', 'personalizar', 'tela inicial', 'ordem'],
    screens: ['/', '/configuracoes'],
    steps: [
      {
        id: 'personalizar',
        route: '/',
        goTo: '/',
        target: 'inicio-personalizar',
        advanceOn: { appears: 'inicio-seletor' },
        action: TOQUE(tk('Personalizar')),
        title: tk('Personalizar'),
        body: tk('O início mostra os cards que você escolher, na ordem que você quiser.'),
      },
      {
        id: 'ligados',
        route: '/',
        target: 'inicio-seletor',
        title: tk('Ligue, desligue e ordene'),
        body: tk('O interruptor tira ou põe o card; as setas mudam a ordem. A tela atrás muda na hora — não há o que salvar.'),
        tip: tk('"Sugeridos para você" traz os cards do que você faz na plataforma.'),
      },
    ],
  },
  {
    id: 'personalizar-menu',
    area: GUIA_AREA.CONTA,
    title: tk('Escolher o que aparece no menu'),
    summary: tk('A barra lateral enxuta, com os seus acessos — padrão por papel, editável.'),
    keywords: ['menu', 'barra lateral', 'navegação', 'personalizar', 'esconder', 'minha arena', 'painel do professor', 'ordem'],
    screens: ['/configuracoes'],
    steps: [
      {
        id: 'cartao',
        route: '/configuracoes',
        goTo: '/configuracoes#menu-lateral',
        target: 'config-menu',
        title: tk('Menu'),
        body: tk('Comece por um padrão — Atleta, Arena ou Professor — e depois ligue, desligue e ordene cada item. A barra muda na hora.'),
        tip: tk('Início e Minha área ficam sempre: é na Minha área que moram a sua arena, o painel do professor e estas configurações.'),
      },
      {
        id: 'atalho',
        route: '/',
        goTo: '/',
        target: ['menu-personalizar', 'menu-celular'],
        title: tk('O atalho na própria barra'),
        body: tk('"Personalizar o menu", no rodapé da barra lateral (e na gaveta do celular), abre este cartão.'),
      },
    ],
  },
  {
    id: 'escolher-notificacoes',
    area: GUIA_AREA.CONTA,
    title: tk('Escolher os seus avisos'),
    summary: tk('Quais notificações você quer receber.'),
    keywords: ['notificação', 'aviso', 'push', 'e-mail', 'configurações'],
    screens: ['/configuracoes'],
    steps: [
      {
        id: 'notificacoes',
        route: '/configuracoes',
        goTo: '/configuracoes',
        target: 'config-notificacoes',
        title: tk('Notificações'),
        body: tk('Ligue ou desligue cada tipo de aviso: torneios, reservas, clubes, mensagens.'),
      },
      {
        id: 'push',
        route: '/configuracoes',
        target: ['config-push', 'config-notificacoes'],
        title: tk('No celular'),
        body: tk('Com a plataforma instalada no celular, dá para receber os avisos como notificação do aparelho.'),
      },
    ],
  },
  {
    id: 'privacidade-e-dados',
    area: GUIA_AREA.CONTA,
    title: tk('Privacidade e os seus dados'),
    summary: tk('Quem vê o seu contato e como baixar tudo o que é seu.'),
    keywords: ['privacidade', 'lgpd', 'dados', 'contato', 'diretório', 'baixar'],
    screens: ['/perfil/editar', '/configuracoes'],
    steps: [
      {
        id: 'contato',
        route: '/perfil/editar',
        goTo: '/perfil/editar',
        target: 'perfil-comunidade',
        title: tk('Quem vê o seu contato'),
        body: tk('Em "Comunidade e privacidade" você escolhe o que fica visível e se aparece no diretório de atletas.'),
      },
      {
        id: 'dados',
        route: '/configuracoes',
        goTo: '/configuracoes',
        target: 'config-dados',
        title: tk('Baixar os seus dados'),
        body: tk('Em "Baixar meus dados" você recebe um arquivo com tudo o que a plataforma guarda sobre você.'),
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
    awayText: tk('Abra um torneio que você organiza: Perfil → Meus torneios, e depois "Gerenciar torneio".'),
    area: GUIA_AREA.COMPETIR,
    title: tk('Organizar um torneio'),
    summary: tk('Do rascunho ao ranking: modalidades, inscrições, sorteio e resultados.'),
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
    awayText: tk('Abra um dia de jogo no formato Play (Jogar → Dia de jogo).'),
    area: GUIA_AREA.JOGAR,
    title: tk('Conduzir um dia de jogo — Play'),
    summary: tk('Participantes, a fila, as partidas quadra a quadra e o telão.'),
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
    awayText: tk('Abra um dia de jogo no formato Americano (Jogar → Dia de jogo).'),
    area: GUIA_AREA.JOGAR,
    title: tk('Conduzir um dia de jogo — Americano'),
    summary: tk('Participantes, o sorteio da grade, os placares e o ranking do dia.'),
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
    awayText: tk('Abra um dia de jogo no formato Americano aprimorado (Jogar → Dia de jogo).'),
    area: GUIA_AREA.JOGAR,
    title: tk('Conduzir um dia de jogo — Americano aprimorado'),
    summary: tk('A fila, os dois passos por quadra, as concluídas e o ranking.'),
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

// A busca procura no texto JÁ traduzido (e nas palavras-chave, em português).
function textoDoGuia(g) {
  const passos = g.steps.map((p) => [p.title, ...lista(p.body), p.tip].filter(Boolean).map(textoDoGuiaT).join(' '));
  return normalizarBusca([t(g.title), t(g.summary || ''), ...(g.keywords || []), t(GUIA_AREA_META[g.area]?.label || ''), ...passos].join(' '));
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
      const titulo = normalizarBusca(`${t(g.title)} ${(g.keywords || []).join(' ')}`);
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

/** O texto do passo sempre como lista de parágrafos, no idioma ativo. */
export function paragrafos(passo) {
  return lista(passo?.body).map(textoDoGuiaT);
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
