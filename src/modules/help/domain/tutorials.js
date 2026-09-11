/**
 * TUTORIAIS da plataforma — conteúdo puro, sem I/O e sem React.
 *
 * Cada tutorial é uma lista de passos que a tela desenha em sequência. Está
 * aqui, e não dentro do componente, por três razões:
 *
 *  1. é CONTEÚDO, e conteúdo muda mais que interface: quem for corrigir um
 *     texto não precisa entender JSX nem mexer em estado de diálogo;
 *  2. dá para TESTAR — que todo passo tem título e corpo, que os ids são
 *     únicos e estáveis, que nenhum tutorial ficou vazio;
 *  3. os ids são CONTRATO: é por eles que se guarda "esta pessoa já viu este
 *     tutorial". Renomear um id faz o tutorial reaparecer para todo mundo.
 *
 * ## O que um tutorial promete
 *
 * Descrever a ferramenta como ela é HOJE. Um tutorial que ensina um botão que
 * não existe mais é pior do que nenhum: quem segue passo a passo conclui que
 * está fazendo algo errado. Ao mexer numa dessas telas, passe por aqui.
 *
 * ## O que NÃO vai aqui
 *
 * Regra de negócio. Estes textos explicam o que a tela faz; quem DECIDE o que
 * a tela faz é o domínio de cada módulo. Se um passo precisar calcular algo
 * para se explicar, o cálculo é de lá.
 */

import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats.js';

/**
 * Ids dos tutoriais. **CONTRATO**: é por eles que se guarda quem já viu o quê
 * (`v2:view:<uid>:tutorial:<id>`). Mudar um id equivale a mostrar o tutorial
 * de novo para toda a base.
 */
export const TUTORIAL_ID = Object.freeze({
  TOURNAMENT: 'torneio',
  GAME_DAY_PLAY: 'dia-de-jogo-play',
  GAME_DAY_AMERICANO: 'dia-de-jogo-americano',
  GAME_DAY_AMERICANO_LIVE: 'dia-de-jogo-americano-aprimorado',
});

/* ------------------------------------------------------------------ torneio */

const TORNEIO = {
  id: TUTORIAL_ID.TOURNAMENT,
  title: 'Como criar e gerenciar um torneio',
  subtitle: 'Do rascunho ao ranking, em sete passos.',
  steps: [
    {
      id: 'visao-geral',
      title: 'O caminho inteiro, de uma vez',
      body: [
        'Um torneio na plataforma segue sempre a mesma ordem: você cria o torneio, define as MODALIDADES, abre as INSCRIÇÕES, faz o SORTEIO e lança os RESULTADOS. O encerramento é automático quando o último resultado entra.',
        'Cada uma dessas etapas é uma aba do console de gestão. Você pode ir e voltar entre elas à vontade — nada é definitivo até você sortear, e mesmo depois há como corrigir.',
      ],
      tip: 'O torneio nasce como Rascunho. Enquanto estiver assim, só você o enxerga.',
    },
    {
      id: 'criar',
      title: '1. Criar o torneio',
      body: [
        'Em Torneios → Criar, você começa do zero ou a partir de um MODELO pronto (que já traz modalidades e formato sugeridos — dá para ajustar tudo depois).',
        'Preencha nome, datas, local, cidade e o prazo final das inscrições. O campo Acesso define se o torneio é público (aparece na busca) ou privado (só quem tem o link ou o código entra).',
        'Se o torneio acontece numa arena cadastrada, vincule-a: ele passa a aparecer também na página da arena.',
      ],
      tip: 'Não precisa acertar tudo agora. Nome, datas e acesso bastam para começar; o resto se edita na aba Geral.',
    },
    {
      id: 'modalidades',
      title: '2. Modalidades',
      body: [
        'Modalidade é cada disputa dentro do torneio — "Dupla Masculina B", "Simples Feminina A", "Mista Open". É nela que ficam as inscrições, os jogos e a classificação.',
        'Para cada uma você define: FORMATO (simples, duplas ou equipes), GÊNERO, FAIXA ETÁRIA, o MODELO DA CHAVE (grupos, eliminatória, todos contra todos, suíço, americano, mexicano…), as quadras disponíveis e o horário de início.',
        'Não existe limite: crie quantas modalidades o seu torneio tiver. Cada uma corre de forma independente das outras.',
      ],
      tip: 'Na dúvida sobre qual modelo de chave usar, abra o Guia de formatos (Torneios → Guia): ele explica cada um e quantos participantes cada um pede.',
    },
    {
      id: 'inscricoes',
      title: '3. Inscrições',
      body: [
        'Com as inscrições abertas, os atletas se inscrevem pela página pública do torneio. Você também pode inscrever alguém manualmente pela aba Inscrições.',
        'Cada inscrição tem um estado que você controla: Pagamento pendente → Confirmada → Check-in feito. Há também Lista de espera, para quando a modalidade lota, e Cancelada.',
        'Na aba você confirma pagamento, faz e desfaz check-in, promove alguém da lista de espera, edita os dados da inscrição e remove quem desistiu.',
      ],
      tip: 'O check-in serve para o dia do torneio: é como você separa quem apareceu de quem só se inscreveu, antes de sortear.',
    },
    {
      id: 'sorteio',
      title: '4. Sorteio',
      body: [
        'O sorteio monta os confrontos a partir de quem está inscrito, respeitando o modelo de chave da modalidade. Quando há informação de nível, ele equilibra os grupos em vez de sortear às cegas.',
        'Depois de sortear você não fica preso ao resultado: dá para MOVER um participante de grupo, SUBSTITUIR um jogador que faltou, RESORTEAR apenas os jogos que ainda não aconteceram e RECALCULAR quadras e horários sem mexer nos confrontos.',
        'Em formatos por rodada, é aqui que você gera a próxima rodada com base nos resultados já lançados.',
      ],
      tip: 'Corrigir o sorteio nunca apaga resultado já lançado — só os jogos que ainda não foram disputados são refeitos.',
    },
    {
      id: 'resultados',
      title: '5. Resultados',
      body: [
        'Na aba Resultados você lança o placar de cada jogo. A classificação da modalidade se atualiza sozinha a cada resultado.',
        'Errou um placar? Basta editar: a classificação, o chaveamento e as fases seguintes se recalculam a partir da correção.',
        'Quando uma fase termina, os classificados avançam para a próxima conforme o que você configurou na modalidade.',
      ],
      tip: 'Lance os resultados durante o torneio, não no fim. Quem está jogando acompanha tudo pela página pública e pelo telão.',
    },
    {
      id: 'encerrar',
      title: '6. Encerramento e ranking',
      body: [
        'Quando o último jogo de todas as modalidades é decidido, o torneio se ENCERRA sozinho — você não precisa fazer nada.',
        'A partir daí, os resultados de torneios públicos e encerrados entram no ranking e no rating da plataforma, e ficam disponíveis para exportação ao DUPR.',
        'O ranking é atualizado automaticamente quando os resultados são publicados.',
      ],
      tip: 'Torneio privado ou ainda em andamento não pontua no ranking geral. É de propósito: o ranking só conta disputa pública e concluída.',
    },
    {
      id: 'acompanhar',
      title: '7. Para quem está no ginásio',
      body: [
        'A página pública do torneio mostra chaves, jogos, horários e classificação para qualquer pessoa, sem login.',
        'O TELÃO abre uma visão em tela cheia, própria para uma TV ou tablet na beira da quadra, e se atualiza sozinho.',
        'Os grupos e as chaves também podem ser impressos, para afixar na parede.',
      ],
      tip: 'Deixe o telão aberto numa segunda tela enquanto você lança os resultados na primeira.',
    },
  ],
};

/* --------------------------------------------------------------- dia de jogo */

const PLAY = {
  id: TUTORIAL_ID.GAME_DAY_PLAY,
  title: 'Dia de jogo — formato Play',
  subtitle: 'Jogo aberto, por ordem de chegada. Sem placar.',
  steps: [
    {
      id: 'o-que-e',
      title: 'O que é o Play',
      body: [
        'O Play é o "jogo aberto": as pessoas chegam, entram numa fila e jogam. Não há rodadas, não há grade montada antes — cada partida é criada na hora, quadra por quadra, com quem está disponível naquele momento.',
        'É o formato para o treino de sábado, o open play do clube, o dia em que ninguém sabe quem vai aparecer.',
      ],
      tip: 'O Play NÃO grava placar. Ele organiza quem joga com quem, não quem ganhou.',
    },
    {
      id: 'criar',
      title: '1. Criar o dia de jogo',
      body: [
        'Em Dia de jogo → Criar, escolha o formato Play e informe quantas QUADRAS estão disponíveis. É esse número que define quantas partidas podem acontecer ao mesmo tempo.',
        'A visibilidade decide se o dia aparece em "Procura-se jogo" para outras pessoas pedirem para entrar, ou se fica só para quem você chamar.',
        'Em "Quem pode organizar as partidas", escolha entre só você (e quem você nomear) ou qualquer inscrito.',
      ],
      tip: 'Quadras a mais não atrapalham: quadra sem gente na fila simplesmente fica livre.',
    },
    {
      id: 'participantes',
      title: '2. Participantes',
      body: [
        'Inclua os atletas na seção Participantes. Quem chegou depois entra a qualquer momento — e quem foi embora sai, sem bagunçar as partidas em andamento.',
        'Cada pessoa incluída entra no fim da ORDEM DE PARTICIPAÇÃO, que é a fila do dia.',
      ],
      tip: 'Num dia público, as pessoas também se inscrevem sozinhas pelo convite.',
    },
    {
      id: 'partidas',
      title: '3. Criar as partidas',
      body: [
        'Cada quadra tem o seu espaço. Numa quadra livre, "Criar jogo" chama os quatro primeiros disponíveis da fila. Numa quadra ocupada, "Criar próxima partida" encerra a atual e já chama os próximos.',
        'O sorteio respeita a ordem da fila e, quando há informação de nível, equilibra as duplas — sem furar a fila de quem está esperando há mais tempo.',
        'Quem termina de jogar volta para o fim da ordem, automaticamente.',
      ],
      tip: 'A seção "Ordem de participação" mostra a fila numerada e quem entra a seguir. É a pergunta que todo mundo faz: "quando eu jogo?".',
    },
    {
      id: 'ajustes',
      title: '4. Quando a vida real acontece',
      body: [
        'CLICANDO NUM NOME EM QUADRA você escolhe entre deixar a pessoa indisponível para aquela partida (entra o próximo da fila) ou SUBSTITUÍ-LA por alguém específico da ordem. O clique nunca executa nada sozinho: ele oferece as duas opções.',
        'CLICANDO NUM ATLETA DA FILA você pode pausá-lo por X partidas (ele descansa e volta sozinho) ou VINCULAR UMA DUPLA FIXA — duas pessoas que só entram juntas.',
        'Um jogo também pode ser cancelado: os quatro voltam para a fila e nenhuma próxima partida é criada.',
      ],
      tip: 'Dupla fixa com o parceiro indisponível faz os dois aguardarem. É o que garante que eles realmente joguem juntos.',
    },
    {
      id: 'previsao',
      title: '5. Previsão e telão',
      body: [
        'A previsão mostra quem entra em cada quadra a seguir — e é a MESMA conta que cria as partidas, então não gera falsa expectativa. A previsão de uma quadra ocupada é condicional: depende de qual partida terminar primeiro.',
        'O TELÃO (botão "Abrir telão") mostra tudo isso em tela cheia, para uma TV ou tablet ao lado da quadra, atualizando sozinho.',
        'Quem organiza também conduz o dia pelo próprio telão: criar partida, substituir, pausar, vincular dupla.',
      ],
      tip: 'Abra o telão em outra aba: ele fica na TV, e o painel continua com você.',
    },
  ],
};

const AMERICANO = {
  id: TUTORIAL_ID.GAME_DAY_AMERICANO,
  title: 'Dia de jogo — Americano',
  subtitle: 'Rodadas sorteadas de uma vez, com placar e ranking do dia.',
  steps: [
    {
      id: 'o-que-e',
      title: 'O que é o Americano',
      body: [
        'No Americano a grade de jogos é sorteada DE UMA VEZ: o sistema monta as rodadas com todos os participantes, e todo mundo entra e sai junto a cada rodada.',
        'Cada partida tem placar, e os resultados alimentam o ranking do dia.',
        'Mexicano e Rei da Quadra funcionam do mesmo jeito nesta tela — muda o critério do sorteio, não a forma de operar.',
      ],
      tip: 'Se o seu grupo é fechado e o horário é o mesmo para todos, este é o formato.',
    },
    {
      id: 'criar',
      title: '1. Criar e inscrever',
      body: [
        'Em Dia de jogo → Criar, escolha o formato Americano, a data, o horário e a visibilidade.',
        'Depois inclua os participantes na seção Participantes. Vale inscrever todo mundo antes de sortear: a grade é montada com quem está na lista.',
      ],
      tip: 'Dá para nomear outras pessoas como organizadoras do dia, no card Organização.',
    },
    {
      id: 'sortear',
      title: '2. Sortear os jogos',
      body: [
        'O sorteio monta a grade equilibrando duplas inéditas, adversários inéditos e o nível dos jogadores — para que todos joguem com todos e contra todos, tanto quanto o número de rodadas permitir.',
        'O sorteio é ADITIVO: sortear de novo acrescenta jogos aos que já existem, sem apagar os que já têm resultado. Se houver jogos ainda sem placar, o sistema pergunta se devem ser mantidos ou refeitos.',
        'Chegou alguém depois do sorteio? Inclua a pessoa e sorteie de novo: as rodadas seguintes já contam com ela.',
      ],
      tip: 'Informe o número de quadras: o sorteio distribui os jogos de cada rodada entre elas.',
    },
    {
      id: 'resultados',
      title: '3. Lançar resultados',
      body: [
        'Na seção Jogos, lance o placar de cada partida. O ranking do dia se atualiza a cada resultado.',
        'Também é possível criar uma partida avulsa na mão e excluir um jogo que não vai acontecer.',
        'Errou? Edite o placar: o ranking do dia recalcula na hora.',
      ],
      tip: 'Jogos sem placar simplesmente não contam — nada trava se uma partida não acontecer.',
    },
    {
      id: 'ranking',
      title: '4. Ranking do dia e ranking da plataforma',
      body: [
        'O RANKING DO DIA classifica os participantes pelos resultados daquele dia. Ele é automático e vive dentro do dia de jogo.',
        'Já o RANKING DA PLATAFORMA é uma decisão sua: na seção "Resultados no ranking", o criador do dia publica as partidas decididas no ranking geral, no rating e na exportação para o DUPR.',
        'Publicado uma vez, o dia continua sincronizado: corrigir um placar depois atualiza o ranking sozinho.',
      ],
      tip: 'Partidas em que todos os atletas são do mesmo clube também contam para o ranking daquele clube.',
    },
    {
      id: 'telao',
      title: '5. Telão',
      body: [
        'O botão "Abrir telão" mostra, em tela cheia, os jogos da rodada atual, os próximos jogos, o ranking do dia e os últimos resultados.',
        'Ele se atualiza sozinho e foi feito para ficar aberto numa TV ou tablet durante o dia inteiro.',
      ],
      tip: 'O telão é só leitura no Americano — ninguém que passar na frente da TV muda nada.',
    },
  ],
};

const AMERICANO_LIVE = {
  id: TUTORIAL_ID.GAME_DAY_AMERICANO_LIVE,
  title: 'Dia de jogo — Americano aprimorado',
  subtitle: 'Partida a partida, quadra por quadra, com placar.',
  steps: [
    {
      id: 'o-que-e',
      title: 'O que é o Americano aprimorado',
      body: [
        'É o Americano organizado como o Play: as partidas nascem UMA A UMA, quadra por quadra, com quem está disponível na hora — mas COM placar, ranking do dia e publicação no ranking da plataforma.',
        'Na prática: a flexibilidade do jogo aberto (gente chegando, saindo, descansando uma partida) somada ao resultado do Americano.',
      ],
      tip: 'Se o seu grupo varia ao longo do dia mas você quer placar, é este o formato.',
    },
    {
      id: 'criar',
      title: '1. Criar o dia de jogo',
      body: [
        'Em Dia de jogo → Criar, escolha "Americano aprimorado" e informe quantas QUADRAS estão disponíveis.',
        'Como no Play, defina a visibilidade e quem pode organizar as partidas.',
      ],
      tip: 'Esta opção só aparece com a funcionalidade ligada no painel da plataforma.',
    },
    {
      id: 'fila',
      title: '2. Participantes e fila',
      body: [
        'Inclua os atletas. Cada um entra no fim da ORDEM DE PARTICIPAÇÃO, e quem termina de jogar volta para o fim dela.',
        'Vale tudo o que vale no Play: entrar e sair a qualquer hora, ficar indisponível por X partidas, vincular dupla fixa, substituir alguém que saiu no meio.',
      ],
      tip: 'A seção "Como o dia está indo" mostra quantas partidas já saíram, quantas duplas diferentes se formaram e quem jogou mais e menos.',
    },
    {
      id: 'dois-passos',
      title: '3. O fluxo de DOIS passos',
      body: [
        'É a diferença que dá nome ao formato. Numa quadra com partida em andamento, o botão é "LANÇAR RESULTADO": você digita o placar dos dois lados e salva.',
        'Lançado o resultado, a partida vai para as concluídas e a quadra FICA LIVRE. Só então aparece "GERAR PRÓXIMA PARTIDA".',
        'São dois cliques de propósito: entre um e outro você confere que o resultado entrou certo.',
      ],
      tip: 'No Play é um clique só (encerra e já chama a próxima). Aqui são dois, porque aqui existe placar para conferir.',
    },
    {
      id: 'sorteio',
      title: '4. Como o sorteio escolhe',
      body: [
        'Quem está há mais tempo na fila SEMPRE entra na próxima partida — ninguém fura a fila em nome do equilíbrio.',
        'Os outros três saem de uma janela dos primeiros da fila, escolhendo a combinação que menos repete duplas e adversários já vistos, e que melhor equilibra o nível.',
        'A previsão mostra as próximas partidas JÁ COM as duplas formadas. A previsão de quadra ocupada é condicional: depende de qual partida terminar primeiro.',
        'Ninguém pode estar em duas quadras ao mesmo tempo — nem no sorteio, nem na criação manual.',
      ],
      tip: 'O número de partidas sugerido é o que faria todos formarem dupla com todos e enfrentarem todos duas vezes. É referência, não obrigação.',
    },
    {
      id: 'concluidas',
      title: '5. Partidas concluídas',
      body: [
        'Todas as partidas do dia ficam registradas em ordem, com o placar. Dali você EDITA um resultado lançado errado ou EXCLUI uma partida que não deveria existir.',
        'Também dá para criar uma partida MANUALMENTE, escolhendo os quatro jogadores — com placar (registra um jogo que já aconteceu) ou sem placar (coloca a partida numa quadra livre).',
      ],
      tip: 'Editar um placar recalcula o ranking do dia na hora.',
    },
    {
      id: 'ranking-telao',
      title: '6. Ranking e telão',
      body: [
        'O RANKING DO DIA classifica os participantes pelos resultados do dia, automaticamente.',
        'Na seção "Resultados no ranking", o criador publica as partidas no ranking geral da plataforma, no rating e na exportação para o DUPR.',
        'O TELÃO deste formato mostra as quadras, a previsão com as duplas, as partidas concluídas com placar e o ranking do dia. Quem organiza também lança resultado e gera a próxima partida direto pelo telão.',
      ],
      tip: 'Publicado o dia, corrigir um placar depois atualiza o ranking sozinho.',
    },
  ],
};

/** Todos os tutoriais, por id. */
export const TUTORIALS = Object.freeze({
  [TUTORIAL_ID.TOURNAMENT]: TORNEIO,
  [TUTORIAL_ID.GAME_DAY_PLAY]: PLAY,
  [TUTORIAL_ID.GAME_DAY_AMERICANO]: AMERICANO,
  [TUTORIAL_ID.GAME_DAY_AMERICANO_LIVE]: AMERICANO_LIVE,
});

/**
 * Busca um tutorial pelo id.
 * @param {string} id
 * @returns {object|null} `null` quando o id não existe — quem chama deve
 *   simplesmente não oferecer o tutorial, nunca quebrar a tela por causa disso.
 */
export function getTutorial(id) {
  return TUTORIALS[id] || null;
}

/**
 * Qual tutorial de dia de jogo corresponde a um formato gravado.
 *
 * Mexicano e Rei da Quadra caem no tutorial do Americano de propósito: as três
 * telas são a mesma, e o que muda entre eles é o critério do sorteio, não a
 * forma de operar o dia.
 *
 * @param {string} format valor de `game_days.format`
 * @returns {string|null} id do tutorial, ou `null` se não houver um
 */
export function tutorialIdForGameDayFormat(format) {
  switch (format) {
    case GAME_DAY_FORMAT.PLAY:
      return TUTORIAL_ID.GAME_DAY_PLAY;
    case GAME_DAY_FORMAT.AMERICANO_LIVE:
      return TUTORIAL_ID.GAME_DAY_AMERICANO_LIVE;
    case GAME_DAY_FORMAT.AMERICANO:
    case GAME_DAY_FORMAT.MEXICANO:
    case GAME_DAY_FORMAT.KING_OF_COURT:
      return TUTORIAL_ID.GAME_DAY_AMERICANO;
    default:
      return null;
  }
}
