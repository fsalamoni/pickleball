/**
 * Os PONTOS DE DICA — as bolinhas que pulsam ao lado dos botões quando as
 * dicas estão ligadas.
 *
 * Cada ponto responde, num toque, à pergunta de quem olha um botão sem saber
 * o que ele faz: "se eu tocar AQUI, o que acontece?". Por isso o texto fala do
 * DESTINO ("Leva para…", "Abre…"), e não do botão em si. Quando existe um guia
 * para a tarefa, o ponto oferece "Me mostre como".
 *
 * Só aparece o ponto cujo alvo está VISÍVEL na tela naquele momento: botão
 * que depende de permissão, de funcionalidade ligada ou de dado carregado
 * simplesmente não ganha ponto quando não está lá. E nenhum aparece sozinho
 * sem as dicas ligadas.
 *
 * Os ids são CONTRATO (é por eles que se guarda "já vi este ponto").
 */
import { dicaVisivel } from './guias.js';
import { casaAlgumaRota } from './dicasRota.js';

/** No máximo tantos pontos por tela — mais que isso vira confete. */
export const MAX_PONTOS_POR_TELA = 6;

export const PONTOS_DE_DICA = Object.freeze([
  /* ------------------------------------------------------------- início -- */
  {
    id: 'inicio:personalizar',
    route: '/',
    target: 'inicio-personalizar',
    title: 'Escolha o que aparece aqui',
    body: 'Abre a escolha do que a tela inicial mostra.',
    guide: 'escolher-cards-do-inicio',
  },
  {
    id: 'inicio:procuro-jogo',
    route: '/',
    target: 'botao-procuro-jogo',
    title: 'Procuro jogo',
    body: 'Leva aos convites de quem está procurando parceiros — e é onde você publica o seu.',
    guide: 'encontrar-jogo',
  },
  {
    id: 'inicio:avisos',
    route: '/',
    target: 'botao-notificacoes',
    title: 'Seus avisos',
    body: 'Abre os avisos: convites, respostas de reserva, resultados e novidades dos clubes.',
  },
  {
    id: 'inicio:menu',
    route: '/',
    target: 'menu-principal',
    title: 'O menu',
    body: 'Cada tema leva às páginas dele: Competir, Jogar, Arenas, Aulas…',
    guide: 'conhecer-a-plataforma',
  },

  /* --------------------------------------------------------- jogar -- */
  {
    id: 'procura:publicar',
    route: '/procura-jogo',
    target: 'procura-publicar',
    title: 'Publicar convite',
    body: 'Abre o formulário do seu convite: quando, onde e quantas vagas.',
    guide: 'encontrar-jogo',
  },
  {
    id: 'procura:arenas',
    route: '/procura-jogo',
    target: 'procura-arenas',
    title: 'Jogos das arenas',
    body: 'Jogos com vaga que as arenas publicaram, com quadra já garantida. Dá para entrar ali mesmo.',
  },
  {
    id: 'dia-de-jogo:criar',
    route: '/dia-de-jogo',
    target: 'dia-de-jogo-criar',
    title: 'Novo dia de jogo',
    body: 'Abre o formulário: nome, formato, data, quadras e quem conduz as partidas.',
    guide: 'criar-dia-de-jogo',
  },
  {
    id: 'dia-de-jogo:regras',
    route: '/dia-de-jogo/*',
    target: 'dia-de-jogo-regras',
    title: 'Como funciona este dia',
    body: 'Abre o resumo do formato: se há placar, ranking do dia e como as duplas se formam.',
  },
  {
    id: 'dia-de-jogo:config',
    route: '/dia-de-jogo/*',
    target: 'dia-de-jogo-config',
    title: 'Configurações do dia',
    body: 'Abre o formato, as quadras e quem organiza as partidas.',
  },
  {
    id: 'dia-de-jogo:inserir',
    route: '/dia-de-jogo/*',
    target: 'dia-de-jogo-inserir-atletas',
    title: 'Inserir atletas',
    body: 'Abre a lista de atletas para incluir no dia. Quem chega depois entra a qualquer hora.',
  },
  {
    id: 'dia-de-jogo:sortear',
    route: '/dia-de-jogo/*',
    target: 'dia-de-jogo-sortear',
    title: 'Sortear jogos',
    body: 'Monta a grade de partidas com quem está inscrito, equilibrando duplas e nível.',
  },
  {
    id: 'dia-de-jogo:criar-partida',
    route: '/dia-de-jogo/*',
    target: 'dia-de-jogo-criar-partida',
    title: 'Criar a próxima partida',
    body: 'Chama os próximos da fila para a quadra livre.',
  },
  {
    id: 'dia-de-jogo:telao',
    route: '/dia-de-jogo/*',
    target: 'dia-de-jogo-telao',
    title: 'Abrir telão',
    body: 'Abre, em outra aba, o painel em tela cheia para uma TV ao lado da quadra.',
  },
  {
    id: 'dia-de-jogo:como-funciona',
    route: '/dia-de-jogo/*',
    target: 'dia-de-jogo-como-funciona',
    title: 'Como funciona',
    body: 'Mostra, na própria tela, como conduzir este formato, passo a passo.',
  },

  /* ------------------------------------------------------ competir -- */
  {
    id: 'torneios:criar',
    route: '/torneios',
    target: 'torneios-criar',
    title: 'Criar torneio',
    body: 'Abre o cadastro do torneio, em três etapas.',
    guide: 'criar-torneio',
  },
  {
    id: 'torneios:abas',
    route: '/torneios',
    target: 'torneios-abas',
    title: 'Públicos e os seus',
    body: 'Troca entre os torneios abertos a todos e aqueles em que você joga ou organiza.',
    guide: 'inscrever-em-torneio',
  },
  {
    id: 'torneio:inscrever',
    route: '/torneios/*',
    target: 'torneio-inscrever',
    title: 'Inscrever-se',
    body: 'Abre a inscrição nesta modalidade. Nas duplas, você informa o parceiro ali.',
  },
  {
    id: 'torneio:gerenciar',
    route: '/torneios/*',
    target: 'torneio-gerenciar',
    title: 'Gerenciar torneio',
    body: 'Leva ao console de organização: modalidades, inscrições, sorteio e resultados.',
    guide: 'tutorial:torneio',
  },
  {
    id: 'torneio-gestao:secoes',
    route: '/torneios/*/gerenciar',
    target: 'torneio-gestao-secoes',
    title: 'As etapas do torneio',
    body: 'Cada aba é uma etapa: Geral, Modalidades, Inscrições, Sorteio e Resultados. Dá para ir e voltar.',
    guide: 'tutorial:torneio',
  },
  {
    id: 'torneio-gestao:publica',
    route: '/torneios/*/gerenciar',
    target: 'torneio-pagina-publica',
    title: 'Página pública',
    body: 'Mostra o torneio como os atletas e o público o veem.',
  },
  {
    id: 'criar-torneio:etapas',
    route: '/torneios/criar',
    target: 'criar-torneio-etapas',
    title: 'As etapas do cadastro',
    body: 'Toque numa etapa para voltar a ela. Nada é definitivo até você criar.',
    guide: 'criar-torneio',
  },
  {
    id: 'ranking:abas',
    route: '/ranking',
    target: 'ranking-abas',
    title: 'Nacional ou 2.0–8.0',
    body: 'Troca entre o ranking nacional (ELO) e o nível 2.0–8.0 no estilo DUPR.',
    guide: 'entender-ranking',
  },
  {
    id: 'ranking:duplas',
    route: '/ranking',
    target: 'ranking-duplas-link',
    title: 'Ranking de duplas',
    body: 'Leva à classificação das parcerias, pelo aproveitamento.',
  },

  /* -------------------------------------------------------- arenas -- */
  {
    id: 'arenas:busca',
    route: '/arenas',
    target: 'arenas-busca',
    title: 'Buscar arena',
    body: 'Filtra as arenas por nome, cidade ou endereço enquanto você digita.',
    guide: 'reservar-quadra',
  },
  {
    id: 'arenas:cadastrar',
    route: '/arenas',
    target: 'arenas-cadastrar',
    title: 'Cadastrar arena',
    body: 'Abre o cadastro de uma arena nova — para quem tem ou administra uma.',
    guide: 'cadastrar-arena',
  },
  {
    id: 'arena:calendario',
    route: '/arenas/*',
    target: 'arena-calendario',
    title: 'Calendário de horários',
    body: 'Tocar num dia abre as quadras e os horários livres dele, para escolher e reservar.',
    guide: 'reservar-quadra',
  },
  {
    id: 'arena:solicitar',
    route: '/arenas/*',
    target: 'arena-solicitar',
    title: 'Solicitar reserva',
    body: 'Abre o pedido de reserva com data e horário digitados — para quem já sabe o que quer.',
  },
  {
    id: 'arena:gerir',
    route: '/arenas/*',
    target: 'arena-gerir',
    title: 'Gerir',
    body: 'Leva à Central da arena: pedidos, quadras, horários, preços e módulos.',
  },
  {
    id: 'central:pendencias',
    route: '/arenas/*/gerir',
    target: 'arena-pendencias',
    title: 'Precisa de você',
    body: 'Cada item leva à aba que resolve: pedidos de reserva, pedidos do app, faltas para marcar.',
    guide: 'responder-reservas',
  },
  {
    id: 'central:secoes',
    route: '/arenas/*/gerir',
    target: 'arena-secoes',
    title: 'As seções da Central',
    body: '"Atender" é o trabalho do dia; "Gerir" é como a arena é: estrutura, preços, marketing, equipe.',
    guide: 'configurar-quadras',
  },
  {
    id: 'reservas:ver-arenas',
    route: '/minhas-reservas',
    target: 'reservas-ver-arenas',
    title: 'Ver arenas',
    body: 'Leva à busca de quadras para reservar de novo.',
    guide: 'reservar-quadra',
  },

  /* -------------------------------------------- comunidade e aulas -- */
  {
    id: 'clubes:criar',
    route: '/clubes',
    target: 'clubes-criar',
    title: 'Criar clube',
    body: 'Abre o cadastro de um clube — você vira o administrador dele.',
    guide: 'criar-clube',
  },
  {
    id: 'clube:entrar',
    route: '/clubes/*',
    target: 'clube-entrar',
    title: 'Pedir para ingressar',
    body: 'Manda o pedido para o administrador do clube, que aprova ou não.',
  },
  {
    id: 'professores:sou',
    route: '/coaches',
    target: 'professor-sou',
    title: 'Sou professor',
    body: 'Abre o seu perfil de professor: é ele que aparece na busca e recebe pedidos de aula.',
    guide: 'virar-professor',
  },
  {
    id: 'professor:disponibilidade',
    route: '/aulas',
    target: 'professor-disponibilidade',
    title: 'Disponibilidade semanal',
    body: 'Os horários em que os alunos podem pedir aula. Só vale depois de salvar.',
    guide: 'disponibilidade-professor',
  },

  /* --------------------------------------------------- perfil e conta -- */
  {
    id: 'perfil:editar',
    route: '/perfil',
    target: 'perfil-editar',
    title: 'Editar perfil',
    body: 'Abre foto, cidade, interesses, nível e privacidade.',
    guide: 'completar-perfil',
  },
  {
    id: 'perfil:interesses',
    route: '/perfil/editar',
    target: 'perfil-interesses',
    title: 'Seus interesses',
    body: 'O que você marca aqui muda a tela inicial e as sugestões.',
  },
  {
    id: 'config:dicas',
    route: '/configuracoes',
    target: 'config-dicas',
    title: 'Dicas',
    body: 'Liga e desliga as dicas, e mostra de novo os pontos que você já viu.',
  },
  {
    id: 'config:aparencia',
    route: '/configuracoes',
    target: 'config-aparencia',
    title: 'Aparência',
    body: 'Troca entre claro, escuro e automático.',
    flags: ['dark_mode'],
  },
  {
    id: 'config:notificacoes',
    route: '/configuracoes',
    target: 'config-notificacoes',
    title: 'Notificações',
    body: 'Liga e desliga cada tipo de aviso.',
  },
  {
    id: 'notificacoes:filtros',
    route: '/notificacoes',
    target: 'notificacoes-filtros',
    title: 'Ache um aviso antigo',
    body: 'Só as não lidas, uma área (jogos, torneios, arenas…) ou uma palavra do aviso.',
    flags: ['notifications_center'],
  },
  {
    id: 'notificacoes:lista',
    route: '/notificacoes',
    target: 'notificacoes-lista',
    title: 'Lida ou não lida',
    body: 'Tocar no aviso abre o assunto. O botão ao lado marca como lido — ou como não lido, para voltar nele depois.',
    flags: ['notifications_center'],
  },
  /* ------------------------------------------------------ gamificação -- */
  {
    id: 'gamificacao:guia',
    route: '/gamification',
    target: 'gamificacao-guia',
    title: 'Como funciona',
    body: 'Abre o guia completo: cada conceito explicado, com busca e os números reais.',
    guide: 'gamificacao-entender',
    flags: ['gamification_v2'],
  },
  {
    id: 'gamificacao:preferencias',
    route: '/gamification',
    target: 'gamificacao-preferencias',
    title: 'Preferências',
    body: 'Abre a escolha do que os outros veem de você, dos avisos e de como você aparece.',
    guide: 'gamificacao-privacidade',
    flags: ['gamification_v2'],
  },
  {
    id: 'gamificacao:abas',
    route: '/gamification',
    target: 'gamificacao-abas',
    title: 'As seções',
    body: 'Jornada, Missões, Competir, Social e Recompensas — cada uma com um "Como funciona" no topo.',
    guide: 'gamificacao-missoes',
    flags: ['gamification_v2'],
  },
  {
    id: 'gamificacao:sequencia',
    route: '/gamification',
    target: 'sequencia',
    title: 'Sua sequência',
    body: 'Semanas seguidas jogando. Uma semana sem jogar por mês é perdoada; para viagens, há as férias.',
    guide: 'gamificacao-sequencia',
    flags: ['gamification_v2'],
  },
  {
    id: 'gamificacao:xp-origem',
    route: '/gamification',
    target: 'xp-origem',
    title: 'De onde vem o XP',
    body: 'Abre a conta do seu XP, por origem. Não existe XP escondido.',
    guide: 'gamificacao-entender',
    flags: ['gamification_v2'],
  },
  {
    id: 'gamificacao:oferecer',
    route: '/gamification',
    target: 'oferecer',
    title: 'Para quem oferece',
    body: 'Atalhos de quem tem arena, dá aulas ou administra um clube: desafios e recompensas para quem joga com você.',
    flags: ['gamification_v2'],
  },
  {
    id: 'conquistas:filtros',
    route: '/conquistas',
    target: 'conquistas-filtros',
    title: 'Filtre as conquistas',
    body: 'Por família e por raridade — ou só as que você já abriu.',
    guide: 'gamificacao-conquistas',
    flags: ['gamification_v2'],
  },
  {
    id: 'conquistas:lista',
    route: '/conquistas',
    target: 'conquistas-lista',
    title: 'O que falta para abrir',
    body: 'Cada cartão mostra o seu progresso. Abrir uma conquista rende XP de bônus.',
    flags: ['gamification_v2'],
  },
  {
    id: 'hall:abas',
    route: '/hall-da-fama',
    target: 'hall-abas',
    title: 'Hall ou temporada',
    body: 'O Hall soma o XP de sempre; a temporada, só o do mês — e recomeça todo mês.',
    guide: 'gamificacao-hall',
    flags: ['gamification_v2'],
  },
  {
    id: 'hall:posicao',
    route: '/hall-da-fama',
    target: 'hall-minha-posicao',
    title: 'Onde você está',
    body: 'A sua posição, e o atalho para escolher se você aparece no placar público.',
    flags: ['gamification_v2'],
  },
  {
    id: 'vinculos:abas',
    route: '/vinculos',
    target: 'vinculos-abas',
    title: 'Rivais, crews e mentorias',
    body: 'Três jeitos de jogar com os outros: quem você mais enfrenta, o seu grupo e quem ensina quem.',
    guide: 'gamificacao-vinculos',
    flags: ['gamification_v2'],
  },
  {
    id: 'revisao:periodo',
    route: '/gamification/revisao',
    target: 'revisao-periodo',
    title: 'Volte no tempo',
    body: 'As setas levam ao período anterior. A revisão compara com ele.',
    guide: 'gamificacao-revisao',
    flags: ['gamification_v2'],
  },
  {
    id: 'prefs:privacidade',
    route: '/gamification/configuracoes',
    target: 'prefs-privacidade',
    title: 'Quem vê você',
    body: 'Escolha se aparece no placar público e no perfil. A regra vale no servidor, não só na tela.',
    guide: 'gamificacao-privacidade',
    flags: ['gamification_v2'],
  },
  {
    id: 'guia-gamificacao:publico',
    route: '/gamification/como-funciona',
    target: 'guia-publico',
    title: 'Para quem é',
    body: 'Troque o público para ler o que vale para quem joga, ensina, tem arena ou administra um clube.',
    flags: ['gamification_v2'],
  },
  {
    id: 'arena:engajamento',
    route: '/arenas/*/gerir',
    target: 'arena-aba-engajamento',
    title: 'Engajamento',
    body: 'A saúde da arena, as metas do mês, os desafios e as recompensas que você oferece.',
    guide: 'gamificacao-oferecer-arena',
    flags: ['gamification_v2'],
    audience: 'arena',
  },
  {
    id: 'aulas:engajamento',
    route: '/aulas',
    target: 'professor-aba-engajamento',
    title: 'Engajamento',
    body: 'A saúde da sua agenda, as metas, os desafios e as recompensas para os seus alunos.',
    guide: 'gamificacao-oferecer-professor',
    flags: ['gamification_v2'],
    audience: 'professor',
  },
  {
    id: 'clube:atividade',
    route: '/clubes/*',
    target: 'clube-aba-atividade',
    title: 'Atividade do clube',
    body: 'Só quem administra vê: a saúde do clube, metas, desafios e recompensas para os membros.',
    flags: ['gamification_v2'],
  },
  {
    id: 'admin:gamificacao',
    route: '/admin/painel',
    target: 'admin-secao-gamificacao',
    title: 'Gamificação',
    body: 'Configuração, desafios, recompensas, integridade e métricas da gamificação da plataforma.',
    guide: 'gamificacao-admin-configurar',
    flags: ['gamification_v2'],
    audience: 'admin',
  },
]);

/**
 * Os pontos DESTA TELA que esta pessoa pode ver, na ordem do catálogo.
 * Se o alvo está mesmo visível quem decide é a tela (o domínio não vê DOM).
 */
export function pontosDaTela(caminho, ctx = {}) {
  return PONTOS_DE_DICA.filter((p) => casaAlgumaRota(p.route, caminho) && dicaVisivel(p, ctx));
}

/** Um ponto pelo id. */
export function pontoPorId(id) {
  return PONTOS_DE_DICA.find((p) => p.id === id) || null;
}
