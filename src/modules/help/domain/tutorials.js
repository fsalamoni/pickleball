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
import { tk } from '@/core/i18n';

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
  title: tk('Como criar e gerenciar um torneio'),
  subtitle: tk('Do rascunho ao ranking, em sete passos.'),
  steps: [
    {
      id: 'visao-geral',
      title: tk('O caminho inteiro, de uma vez'),
      body: [
        tk('Um torneio na plataforma segue sempre a mesma ordem: você cria o torneio, define as MODALIDADES, abre as INSCRIÇÕES, faz o SORTEIO e lança os RESULTADOS. O encerramento é automático quando o último resultado entra.'),
        tk('Cada uma dessas etapas é uma aba do console de gestão. Você pode ir e voltar entre elas à vontade — nada é definitivo até você sortear, e mesmo depois há como corrigir.'),
      ],
      tip: tk('O torneio nasce como Rascunho. Enquanto estiver assim, só você o enxerga.'),
    },
    {
      id: 'criar',
      title: tk('1. Criar o torneio'),
      body: [
        tk('Em Torneios → Criar torneio, você começa do zero ou a partir de um MODELO pronto (que já traz modalidades e formato sugeridos — dá para ajustar tudo depois).'),
        tk('Preencha nome, datas, local, cidade e o prazo final das inscrições. O campo Acesso define se o torneio é público (aparece na busca) ou privado (só quem tem o link ou o código entra).'),
        tk('Se o torneio acontece numa arena cadastrada, vincule-a: ele passa a aparecer também na página da arena.'),
      ],
      tip: tk('Não precisa acertar tudo agora. Nome, datas e acesso bastam para começar; o resto se edita na aba Geral.'),
    },
    {
      id: 'modalidades',
      title: tk('2. Modalidades'),
      body: [
        tk('Modalidade é cada disputa dentro do torneio — "Dupla Masculina B", "Simples Feminina A", "Mista Open". É nela que ficam as inscrições, os jogos e a classificação.'),
        tk('Para cada uma você define: FORMATO (simples, duplas ou equipes), GÊNERO, FAIXA ETÁRIA, o MODELO DA CHAVE (grupos, eliminatória, todos contra todos, suíço, americano, mexicano…), as quadras disponíveis e o horário de início.'),
        tk('Não existe limite: crie quantas modalidades o seu torneio tiver. Cada uma corre de forma independente das outras.'),
        tk('No cartão de cada fase ficam os TURNOS (1 turno, ou 2 turnos: ida e volta). E cada FASE tem um bloco "Regras avançadas", e ali praticamente tudo é seu: tamanho de cada grupo à mão, quantos passam em cada grupo, REPESCAGEM (vagas extras para os melhores da colocação seguinte ao corte), a ORDEM dos critérios de desempate e como comparar quem veio de grupos de tamanhos diferentes.'),
      ],
      tip: tk('Não mexer em nada é uma escolha legítima: em branco, cada campo vale o padrão do regulamento. Na dúvida sobre o modelo de chave, abra o Guia de formatos (Torneios → Guia).'),
    },
    {
      id: 'inscricoes',
      title: tk('3. Inscrições'),
      body: [
        tk('Com as inscrições abertas, os atletas se inscrevem pela página pública do torneio. Você também pode inscrever alguém manualmente pela aba Inscrições.'),
        tk('Cada inscrição tem um estado que você controla: Pagamento pendente → Confirmada → Check-in feito. Há também Lista de espera, para quando a modalidade lota, e Cancelada.'),
        tk('Na aba você confirma pagamento, faz e desfaz check-in, promove alguém da lista de espera, edita os dados da inscrição e remove quem desistiu.'),
      ],
      tip: tk('O check-in é opcional e não muda o sorteio: confirmada, com ou sem check-in, a inscrição joga. Ele serve para conferir, no dia, quem já chegou — quem não veio sai pela inscrição (cancelar), não pela falta do check-in.'),
    },
    {
      id: 'sorteio',
      title: tk('4. Sorteio'),
      body: [
        tk('O sorteio monta os confrontos a partir de quem está inscrito, respeitando o modelo de chave da modalidade. Quando há informação de nível, ele equilibra os grupos em vez de sortear às cegas.'),
        tk('ANTES de clicar, a aba mostra o plano para o número REAL de inscritos: quantos jogos, quantos jogos por atleta, quantos classificados e se a chave fecha — com as outras divisões possíveis ao lado. Número "quebrado" de inscritos é o caso normal, não um erro: grupos de tamanhos diferentes são comparados por aproveitamento.'),
        tk('É aqui também que se define a ENTRADA DIRETA — quem pula as primeiras fases e entra mais à frente, seja os N melhores cabeças (modelo de qualificatória), seja uma lista escolhida a dedo. A tela mostra os nomes e o que vai acontecer antes de você sortear.'),
        tk('Depois de sortear você não fica preso ao resultado: dá para MOVER um participante de grupo, SUBSTITUIR um jogador que faltou, RESORTEAR apenas os jogos que ainda não aconteceram e RECALCULAR quadras e horários sem mexer nos confrontos.'),
        tk('Em formatos por rodada, é aqui que você gera a próxima rodada com base nos resultados já lançados. E em torneio de várias fases, "Gerar próxima fase" mostra antes quem passa, quem entra por repescagem e quem entra direto.'),
      ],
      tip: tk('Corrigir o sorteio nunca apaga resultado já lançado — só os jogos que ainda não foram disputados são refeitos.'),
    },
    {
      id: 'resultados',
      title: tk('5. Resultados'),
      body: [
        tk('Na aba Resultados você lança o placar de cada jogo. A classificação da modalidade se atualiza sozinha a cada resultado.'),
        tk('Errou um placar? Basta editar: a classificação, o chaveamento e as fases seguintes se recalculam a partir da correção.'),
        tk('Quando uma fase termina, os classificados avançam para a próxima conforme o que você configurou na modalidade.'),
      ],
      tip: tk('Lance os resultados durante o torneio, não no fim. Quem está jogando acompanha tudo pela página pública e pelo telão.'),
    },
    {
      id: 'encerrar',
      title: tk('6. Encerramento e ranking'),
      body: [
        tk('Quando o último jogo de todas as modalidades é decidido, o torneio se ENCERRA sozinho — você não precisa fazer nada.'),
        tk('O ranking NÃO espera o encerramento: num torneio público, cada placar lançado já conta para o ranking e para o rating, na hora. Num torneio de três dias, quem jogou vê a evolução no mesmo dia.'),
        tk('Não há botão de "recalcular": a conta é disparada pelo próprio lançamento do resultado. Os dados também ficam disponíveis para exportação ao DUPR.'),
      ],
      tip: tk('Torneio em RASCUNHO, PRIVADO, cancelado ou arquivado não pontua. E como a conta é refeita por inteiro, cancelar um torneio TIRA do ranking o que já tinha contado.'),
    },
    {
      id: 'acompanhar',
      title: tk('7. Para quem está no ginásio'),
      body: [
        tk('A página pública do torneio mostra chaves, jogos, horários e classificação para qualquer pessoa, sem login.'),
        tk('O TELÃO abre uma visão em tela cheia, própria para uma TV ou tablet na beira da quadra, e se atualiza sozinho.'),
        tk('Os grupos e as chaves também podem ser impressos, para afixar na parede.'),
      ],
      tip: tk('Deixe o telão aberto numa segunda tela enquanto você lança os resultados na primeira.'),
    },
  ],
};

/* --------------------------------------------------------------- dia de jogo */

const PLAY = {
  id: TUTORIAL_ID.GAME_DAY_PLAY,
  title: tk('Dia de jogo — formato Play'),
  subtitle: tk('Jogo aberto, por ordem de chegada. Sem placar.'),
  steps: [
    {
      id: 'o-que-e',
      title: tk('O que é o Play'),
      body: [
        tk('O Play é o "jogo aberto": as pessoas chegam, entram numa fila e jogam. Não há rodadas, não há grade montada antes — cada partida é criada na hora, quadra por quadra, com quem está disponível naquele momento.'),
        tk('É o formato para o treino de sábado, o open play do clube, o dia em que ninguém sabe quem vai aparecer.'),
      ],
      tip: tk('O Play NÃO grava placar. Ele organiza quem joga com quem, não quem ganhou.'),
    },
    {
      id: 'criar',
      title: tk('1. Criar o dia de jogo'),
      body: [
        tk('Em Dia de jogo → Novo dia de jogo, escolha o formato Play e informe quantas QUADRAS estão disponíveis. É esse número que define quantas partidas podem acontecer ao mesmo tempo.'),
        tk('A visibilidade decide se o dia aparece em "Procura-se jogo" para outras pessoas pedirem para entrar, ou se fica só para quem você chamar.'),
        tk('Em "Quem pode organizar as partidas", escolha entre só você (e quem você nomear) ou qualquer inscrito.'),
      ],
      tip: tk('Quadras a mais não atrapalham: quadra sem gente na fila simplesmente fica livre.'),
    },
    {
      id: 'participantes',
      title: tk('2. Participantes'),
      body: [
        tk('Inclua os atletas na seção Participantes. Quem chegou depois entra a qualquer momento — e quem foi embora sai, sem bagunçar as partidas em andamento.'),
        tk('Cada pessoa incluída entra no fim da ORDEM DE PARTICIPAÇÃO, que é a fila do dia.'),
      ],
      tip: tk('Num dia público, as pessoas também se inscrevem sozinhas pelo convite.'),
    },
    {
      id: 'partidas',
      title: tk('3. Criar as partidas'),
      body: [
        tk('Cada quadra tem o seu espaço. Numa quadra livre, "Criar jogo" chama os quatro primeiros disponíveis da fila. Numa quadra ocupada, "Criar próxima partida" encerra a atual e já chama os próximos.'),
        tk('O sorteio respeita a ordem da fila e, quando há informação de nível, equilibra as duplas — sem furar a fila de quem está esperando há mais tempo.'),
        tk('Quem termina de jogar volta para o fim da ordem, automaticamente.'),
      ],
      tip: tk('A seção "Ordem de participação" mostra a fila numerada e quem entra a seguir. É a pergunta que todo mundo faz: "quando eu jogo?".'),
    },
    {
      id: 'simples-duplas',
      title: tk('4. Simples ou duplas'),
      body: [
        tk('Cada quadra pode ser de DUPLAS (quatro jogadores) ou de SIMPLES (um contra um). Escolha em "Duplas | Simples", na própria quadra, antes de criar o jogo.'),
        tk('Numa quadra de simples entram os DOIS primeiros da fila — a ordem continua mandando. A dupla vinculada não vale no simples: ali cada um joga por si.'),
        tk('A quadra lembra o tipo do último jogo: a quadra 3 que recebeu um simples continua de simples até você trocar. Dá para ter quadra de duplas e quadra de simples ao mesmo tempo.'),
      ],
      tip: tk('Com poucas pessoas no começo do dia (2 ou 3), uma quadra de simples já põe gente para jogar enquanto o resto chega.'),
    },
    {
      id: 'ajustes',
      title: tk('5. Quando a vida real acontece'),
      body: [
        tk('CLICANDO NUM NOME EM QUADRA você escolhe entre deixar a pessoa indisponível para aquela partida (entra o próximo da fila) ou SUBSTITUÍ-LA por alguém específico da ordem. O clique nunca executa nada sozinho: ele oferece as duas opções.'),
        tk('CLICANDO NUM ATLETA DA FILA você pode pausá-lo por X partidas (ele descansa e volta sozinho) ou VINCULAR UMA DUPLA FIXA — duas pessoas que só entram juntas.'),
        tk('Um jogo também pode ser cancelado: os quatro voltam para a fila e nenhuma próxima partida é criada.'),
      ],
      tip: tk('Dupla fixa com o parceiro indisponível faz os dois aguardarem. É o que garante que eles realmente joguem juntos.'),
    },
    {
      id: 'previsao',
      title: tk('6. Previsão e telão'),
      body: [
        tk('A previsão mostra quem entra em cada quadra a seguir — e é a MESMA conta que cria as partidas, então não gera falsa expectativa. A previsão de uma quadra ocupada é condicional: depende de qual partida terminar primeiro.'),
        tk('O TELÃO (botão "Abrir telão") mostra tudo isso em tela cheia, para uma TV ou tablet ao lado da quadra, atualizando sozinho.'),
        tk('Quem organiza também conduz o dia pelo próprio telão: criar partida, substituir, pausar, vincular dupla.'),
      ],
      tip: tk('Abra o telão em outra aba: ele fica na TV, e o painel continua com você.'),
    },
  ],
};

const AMERICANO = {
  id: TUTORIAL_ID.GAME_DAY_AMERICANO,
  title: tk('Dia de jogo — Americano'),
  subtitle: tk('Rodadas sorteadas de uma vez, com placar e ranking do dia.'),
  steps: [
    {
      id: 'o-que-e',
      title: tk('O que é o Americano'),
      body: [
        tk('No Americano a grade de jogos é sorteada DE UMA VEZ: o sistema monta as rodadas com todos os participantes, e todo mundo entra e sai junto a cada rodada.'),
        tk('Cada partida tem placar, e os resultados alimentam o ranking do dia.'),
        tk('Mexicano e Rei da Quadra — quando a plataforma oferece esses formatos — funcionam do mesmo jeito nesta tela: muda o critério do sorteio, não a forma de operar.'),
      ],
      tip: tk('Se o seu grupo é fechado e o horário é o mesmo para todos, este é o formato.'),
    },
    {
      id: 'criar',
      title: tk('1. Criar e inscrever'),
      body: [
        tk('Em Dia de jogo → Novo dia de jogo, escolha o formato Americano, a data, o horário e a visibilidade.'),
        tk('Depois inclua os participantes na seção Participantes. Vale inscrever todo mundo antes de sortear: a grade é montada com quem está na lista.'),
      ],
      tip: tk('Dá para nomear outras pessoas como organizadoras do dia: no cartão "Configurações do dia de jogo", em "Quem organiza as partidas".'),
    },
    {
      id: 'sortear',
      title: tk('2. Sortear os jogos'),
      body: [
        tk('O sorteio monta a grade equilibrando duplas inéditas, adversários inéditos e o nível dos jogadores — para que todos joguem com todos e contra todos, tanto quanto o número de rodadas permitir.'),
        tk('O sorteio é ADITIVO: sortear de novo acrescenta jogos aos que já existem, sem apagar os que já têm resultado. Se houver jogos ainda sem placar, o sistema pergunta se devem ser mantidos ou refeitos.'),
        tk('Chegou alguém depois do sorteio? Inclua a pessoa e sorteie de novo: as rodadas seguintes já contam com ela.'),
      ],
      tip: tk('Informe o número de quadras: o sorteio distribui os jogos de cada rodada entre elas.'),
    },
    {
      id: 'simples-duplas',
      title: tk('3. Simples ou duplas'),
      body: [
        tk('No sorteio do Americano você escolhe o TIPO DE JOGO: duplas (dois contra dois) ou simples (um contra um). No simples, quem menos jogou entra primeiro e ninguém repete adversário enquanto houver outro para enfrentar.'),
        tk('A partida avulsa ("Inserir partida") também pode ser de duplas ou simples. O mesmo dia pode ter os dois.'),
        tk('Simples e duplas têm RANKINGS DO DIA SEPARADOS — uma vitória no simples não soma nas duplas.'),
      ],
      tip: tk('Mexicano e Rei da Quadra são sempre de duplas: é assim que os dois formatos funcionam.'),
    },
    {
      id: 'resultados',
      title: tk('4. Lançar resultados'),
      body: [
        tk('Na seção Jogos, lance o placar de cada partida. O ranking do dia se atualiza a cada resultado.'),
        tk('Também é possível criar uma partida avulsa na mão e excluir um jogo que não vai acontecer.'),
        tk('A regra é UM set. Jogou mais de um? Toque em "Sets" ao lado do placar e acrescente quantos sets houve (até 5): vence quem ganhou mais sets, e os pontos de todos os sets contam no saldo.'),
        tk('Errou? Edite o placar: o ranking do dia recalcula na hora.'),
      ],
      tip: tk('Jogos sem placar simplesmente não contam — nada trava se uma partida não acontecer.'),
    },
    {
      id: 'ranking',
      title: tk('5. Ranking do dia e ranking da plataforma'),
      body: [
        tk('O RANKING DO DIA classifica os participantes pelos resultados daquele dia. Ele é automático e vive dentro do dia de jogo.'),
        tk('Já o RANKING DA PLATAFORMA é uma decisão sua: na seção "Resultados no ranking", o criador do dia publica as partidas decididas no ranking geral, no rating e na exportação para o DUPR. Cada jogo vai para o lugar certo: o simples para o rating de simples, as duplas para o rating e o ranking de duplas.'),
        tk('Publicado uma vez, o dia continua sincronizado: corrigir um placar depois atualiza o ranking sozinho.'),
      ],
      tip: tk('Partidas em que todos os atletas são do mesmo clube também contam para o ranking daquele clube.'),
    },
    {
      id: 'telao',
      title: tk('6. Telão'),
      body: [
        tk('O botão "Abrir telão" mostra, em tela cheia, os jogos da rodada atual, os próximos jogos, o ranking do dia e os últimos resultados.'),
        tk('Ele se atualiza sozinho e foi feito para ficar aberto numa TV ou tablet durante o dia inteiro.'),
      ],
      tip: tk('O telão é só leitura no Americano — ninguém que passar na frente da TV muda nada.'),
    },
  ],
};

const AMERICANO_LIVE = {
  id: TUTORIAL_ID.GAME_DAY_AMERICANO_LIVE,
  title: tk('Dia de jogo — Americano aprimorado'),
  subtitle: tk('Partida a partida, quadra por quadra, com placar.'),
  steps: [
    {
      id: 'o-que-e',
      title: tk('O que é o Americano aprimorado'),
      body: [
        tk('É o Americano organizado como o Play: as partidas nascem UMA A UMA, quadra por quadra, com quem está disponível na hora — mas COM placar, ranking do dia e publicação no ranking da plataforma.'),
        tk('Na prática: a flexibilidade do jogo aberto (gente chegando, saindo, descansando uma partida) somada ao resultado do Americano.'),
      ],
      tip: tk('Se o seu grupo varia ao longo do dia mas você quer placar, é este o formato.'),
    },
    {
      id: 'criar',
      title: tk('1. Criar o dia de jogo'),
      body: [
        tk('Em Dia de jogo → Novo dia de jogo, escolha "Americano aprimorado" e informe quantas QUADRAS estão disponíveis.'),
        tk('Como no Play, defina a visibilidade e quem pode organizar as partidas.'),
      ],
      tip: tk('Esta opção só aparece com a funcionalidade ligada no painel da plataforma.'),
    },
    {
      id: 'fila',
      title: tk('2. Participantes e fila'),
      body: [
        tk('Inclua os atletas. Cada um entra no fim da ORDEM DE PARTICIPAÇÃO, e quem termina de jogar volta para o fim dela.'),
        tk('Vale tudo o que vale no Play: entrar e sair a qualquer hora, ficar indisponível por X partidas, vincular dupla fixa, substituir alguém que saiu no meio.'),
      ],
      tip: tk('A seção "Como o dia está indo" mostra quantas partidas já saíram, quantas duplas diferentes se formaram e quem jogou mais e menos.'),
    },
    {
      id: 'dois-passos',
      title: tk('3. O fluxo de DOIS passos'),
      body: [
        tk('É a diferença que dá nome ao formato. Numa quadra com partida em andamento, o botão é "LANÇAR RESULTADO": você digita o placar dos dois lados e salva.'),
        tk('O placar é de UM set. Se jogaram mais, toque em "Adicionar set" antes de lançar e digite cada set: vence quem ganhou mais sets.'),
        tk('Lançado o resultado, a partida vai para as concluídas e a quadra FICA LIVRE. Só então aparece "GERAR PRÓXIMA PARTIDA".'),
        tk('São dois cliques de propósito: entre um e outro você confere que o resultado entrou certo.'),
      ],
      tip: tk('No Play é um clique só (encerra e já chama a próxima). Aqui são dois, porque aqui existe placar para conferir.'),
    },
    {
      id: 'sorteio',
      title: tk('4. Como o sorteio escolhe'),
      body: [
        tk('Quem está há mais tempo na fila SEMPRE entra na próxima partida — ninguém fura a fila em nome do equilíbrio.'),
        tk('Os outros três saem de uma janela dos primeiros da fila, escolhendo a combinação que menos repete duplas e adversários já vistos, e que melhor equilibra o nível.'),
        tk('A previsão mostra as próximas partidas JÁ COM as duplas formadas. A previsão de quadra ocupada é condicional: depende de qual partida terminar primeiro.'),
        tk('Ninguém pode estar em duas quadras ao mesmo tempo — nem no sorteio, nem na criação manual.'),
      ],
      tip: tk('O número de partidas sugerido é o que faria todos formarem dupla com todos e enfrentarem todos duas vezes. É referência, não obrigação.'),
    },
    {
      id: 'simples-duplas',
      title: tk('5. Simples ou duplas'),
      body: [
        tk('Cada quadra pode ser de DUPLAS ou de SIMPLES. Na quadra livre, escolha "Duplas | Simples" e só então gere a partida. A quadra lembra o tipo do último jogo até você trocar.'),
        tk('No simples, quem está há mais tempo na fila joga, e o adversário é o que ele menos enfrentou, com nível parecido. A dupla vinculada não vale no simples.'),
        tk('Simples e duplas têm RANKINGS DO DIA SEPARADOS — no painel e no telão. Publicado, o simples vai para o rating de simples, e as duplas para o de duplas.'),
      ],
      tip: tk('A criação manual também tem os dois tipos: um contra um ou dois contra dois, com ou sem placar.'),
    },
    {
      id: 'concluidas',
      title: tk('6. Partidas concluídas'),
      body: [
        tk('Todas as partidas do dia ficam registradas em ordem, com o placar. Dali você EDITA um resultado lançado errado ou EXCLUI uma partida que não deveria existir.'),
        tk('Também dá para criar uma partida MANUALMENTE, escolhendo os jogadores (dois no simples, quatro nas duplas) — com placar (registra um jogo que já aconteceu) ou sem placar (coloca a partida numa quadra livre).'),
      ],
      tip: tk('Editar um placar recalcula o ranking do dia na hora.'),
    },
    {
      id: 'ranking-telao',
      title: tk('7. Ranking e telão'),
      body: [
        tk('O RANKING DO DIA classifica os participantes pelos resultados do dia, automaticamente.'),
        tk('Na seção "Resultados no ranking", o criador publica as partidas no ranking geral da plataforma, no rating e na exportação para o DUPR.'),
        tk('O TELÃO deste formato mostra as quadras, a previsão com as duplas, as partidas concluídas com placar e o ranking do dia. Quem organiza também lança resultado e gera a próxima partida direto pelo telão.'),
      ],
      tip: tk('Publicado o dia, corrigir um placar depois atualiza o ranking sozinho.'),
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
