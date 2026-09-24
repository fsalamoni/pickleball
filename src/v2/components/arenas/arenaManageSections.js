/**
 * As seções e abas da Central da arena — a estrutura de navegação, sozinha.
 *
 * Mora fora da página para poder ser testada sem montar a tela, e porque a
 * navegação depende de uma regra que ninguém vê: **o valor de cada aba é
 * único em toda a Central**. A seção ativa é descoberta procurando qual seção
 * tem a aba atual — duas seções com uma aba "professores" e a pessoa nunca
 * conseguiria abrir a segunda. Há teste travando isso.
 */
import {
  BarChart3, Building2, CalendarClock, CalendarDays, CalendarRange, ClipboardCheck, ClipboardList,
  Clock, Cpu, Crown, DollarSign, Gift, Globe, GraduationCap, Image, Info, LayoutGrid, Megaphone,
  Network, Package, Palette, Puzzle, ShoppingBag, SlidersHorizontal, Smile, Sparkles, Star, Sun,
  Swords, Tag, Trophy, UserCheck, Users, Wallet, Wrench,
} from 'lucide-react';

// Navegação em dois níveis do admin da arena. Ordem = ciclo de vida, do
// início ao fim: identidade → estrutura/preços → reservas → comercial →
// resultados → equipe/parceiros. Cada seção agrupa sub-abas por tema.
// `coachResidentOn` injeta a aba de professores parceiros na seção de equipe.
//
// Os MÓDULOS que viraram parte da arena (`modulos`) entram como seções
// próprias, logo depois de Reservas — é onde o cliente vira membro, aluno ou
// competidor. Desligado o módulo, a seção não existe e a Central fica
// idêntica ao que era.
export function buildArenaSections({
  coachResidentOn, linkedClubsOn, crmOn, opsKpisOn, arenaModulesOn, modulos = {},
}) {
  return [
    {
      id: 'perfil',
      label: 'Perfil',
      icon: Building2,
      tabs: [
        { value: 'info', label: 'Informações', icon: Info },
        { value: 'fotos', label: 'Fotos', icon: Image },
        // A marca é a cara da arena: mora junto das informações e das fotos.
        ...(modulos.marca ? [{ value: 'marca', label: 'Marca', icon: Palette }] : []),
      ],
    },
    {
      id: 'estrutura',
      label: 'Estrutura e preços',
      icon: LayoutGrid,
      tabs: [
        { value: 'quadras', label: 'Quadras', icon: LayoutGrid },
        { value: 'precos', label: 'Preços', icon: DollarSign },
        { value: 'regras', label: 'Regras', icon: ClipboardList },
      ],
    },
    {
      id: 'reservas',
      label: 'Reservas',
      icon: CalendarClock,
      tabs: [
        { value: 'reservas', label: 'Solicitações', icon: CalendarClock },
        { value: 'calendario', label: 'Calendário', icon: CalendarDays },
        { value: 'calendario-admin', label: 'Reservas (admin)', icon: CalendarRange },
        ...(crmOn ? [{ value: 'clientes', label: 'Clientes', icon: Users }] : []),
        // "Quem veio?" é uma pergunta sobre as reservas do dia.
        ...(modulos.presenca ? [{ value: 'presenca', label: 'Presença', icon: UserCheck }] : []),
      ],
    },
    // Jogo aberto: a arena publica horário com vaga e os atletas preenchem.
    // Vem logo depois de Reservas porque é o mesmo negócio — vender horário
    // de quadra — e ocupa a quadra como uma reserva.
    ...(modulos.jogoAberto ? [{
      id: 'jogo-aberto',
      label: 'Jogo aberto',
      icon: Swords,
      tabs: [
        { value: 'jogo-aberto', label: 'Jogos publicados', icon: Swords },
      ],
    }] : []),
    ...(modulos.membros ? [{
      id: 'membros',
      label: 'Membros',
      icon: Crown,
      tabs: [
        { value: 'membros', label: 'Membros', icon: Crown },
        ...(modulos.pacotes ? [{ value: 'planos', label: 'Pacotes de horas', icon: Package }] : []),
      ],
    }] : []),
    // Aulas: a agenda E os professores. Com o módulo ligado, "Professores"
    // sai de Equipe e vem para cá, virando a lista ÚNICA (parceiros da
    // plataforma + quem dá aula). O valor da aba continua `professores`:
    // links antigos (`?aba=professores`) seguem levando ao lugar certo.
    ...(modulos.aulas ? [{
      id: 'aulas',
      label: 'Aulas',
      icon: GraduationCap,
      tabs: [
        { value: 'aulas', label: 'Agenda', icon: CalendarDays },
        { value: 'professores', label: 'Professores', icon: GraduationCap },
      ],
    }] : []),
    // Torneios: os DA CASA (módulo `leagues`) e os DA PLATAFORMA sediados
    // aqui — que antes apareciam na página pública e em lugar nenhum da
    // gestão. A seção existe se houver qualquer um dos dois.
    ...(modulos.torneios || modulos.torneiosPlataforma ? [{
      id: 'torneios',
      label: 'Torneios',
      icon: Trophy,
      tabs: [
        ...(modulos.torneios ? [{ value: 'torneios', label: 'Da casa', icon: Trophy }] : []),
        ...(modulos.torneiosPlataforma ? [{ value: 'torneios-plataforma', label: 'Da plataforma', icon: Globe }] : []),
      ],
    }] : []),
    // Pagamentos e loja. Com a loja do app ligada (módulo `pdv`), o BALCÃO
    // dos pedidos vem primeiro — é a aba que a equipe abre o dia inteiro — e
    // os produtos continuam no Mercado, que é o cadastro único.
    // Marketing: trazer de volta quem já veio. Uma aba por ferramenta ligada
    // (cupons, campanhas, satisfação, indicações). Com o módulo ligado e
    // nenhuma ferramenta, a seção tem UMA aba que explica e leva aos módulos
    // — seção sem aba não existe, e seção sumida esconderia o que falta ligar.
    ...(modulos.marketing ? [{
      id: 'marketing',
      label: 'Marketing',
      icon: Megaphone,
      tabs: (() => {
        const ferramentas = [
          ...(modulos.cupons ? [{ value: 'cupons', label: 'Cupons', icon: Tag }] : []),
          ...(modulos.campanhas ? [{ value: 'campanhas', label: 'Campanhas', icon: Megaphone }] : []),
          ...(modulos.satisfacao ? [{ value: 'satisfacao', label: 'Satisfação', icon: Smile }] : []),
          ...(modulos.indicacoes ? [{ value: 'indicacoes', label: 'Indicações', icon: Gift }] : []),
        ];
        return ferramentas.length > 0 ? ferramentas : [{ value: 'marketing', label: 'Ferramentas', icon: Megaphone }];
      })(),
    }] : []),
    {
      id: 'comercial',
      label: 'Pagamentos e loja',
      icon: Wallet,
      tabs: [
        ...(modulos.loja ? [{ value: 'pedidos', label: 'Pedidos do app', icon: ShoppingBag }] : []),
        { value: 'pagamento', label: 'Pagamento', icon: Wallet },
        { value: 'mercado', label: 'Mercado', icon: Package },
      ],
    },
    // Operação: a rotina de quem toca a arena. "Hoje" existe sempre que o
    // módulo está ligado — é o resumo do dia, e explica o que ligar quando
    // nenhuma ferramenta está. Os equipamentos (IoT) moram aqui porque são o
    // que existe fisicamente na arena, e a seção existe mesmo só com eles.
    ...(modulos.operacao || modulos.equipamentos ? [{
      id: 'operacao',
      label: 'Operação',
      icon: ClipboardCheck,
      tabs: [
        ...(modulos.operacao ? [{ value: 'operacao', label: 'Hoje', icon: Sun }] : []),
        ...(modulos.checklists ? [{ value: 'checklists', label: 'Rotinas', icon: ClipboardList }] : []),
        ...(modulos.manutencao ? [{ value: 'manutencao', label: 'Manutenção', icon: Wrench }] : []),
        ...(modulos.equipamentos ? [{ value: 'equipamentos', label: 'Equipamentos', icon: Cpu }] : []),
      ],
    }] : []),
    {
      id: 'desempenho',
      label: 'Desempenho',
      icon: BarChart3,
      tabs: [
        ...(opsKpisOn ? [{ value: 'semana', label: 'Semana', icon: CalendarRange }] : []),
        { value: 'metricas', label: 'Métricas', icon: BarChart3 },
        { value: 'retornos', label: 'Retornos', icon: Star },
        // Leituras do negócio: a rede somada e a leitura automática dos números.
        ...(modulos.inteligencia ? [{ value: 'inteligencia', label: 'Inteligência', icon: Sparkles }] : []),
        ...(modulos.rede ? [{ value: 'rede', label: 'Rede', icon: Network }] : []),
      ],
    },
    {
      id: 'equipe',
      label: 'Equipe e parceiros',
      icon: Users,
      tabs: [
        { value: 'admins', label: 'Admins', icon: Users },
        // O plantão (módulo de operação): nome, função e turno de quem trabalha
        // aqui. Mora com a equipe, que é onde se procura quem trabalha na arena.
        ...(modulos.plantao ? [{ value: 'plantao', label: 'Plantão', icon: Clock }] : []),
        ...(coachResidentOn && !modulos.aulas ? [{ value: 'professores', label: 'Professores', icon: GraduationCap }] : []),
        ...(linkedClubsOn ? [{ value: 'clubes', label: 'Clubes', icon: Users }] : []),
      ],
    },
    // Configurações fecha o ciclo: o que a arena LIGA para si. Vem por último
    // de propósito — é a seção em que se escolhe o que existe, e escolher só
    // faz sentido depois de conhecer o resto.
    ...(arenaModulesOn ? [{
      id: 'configuracoes',
      label: 'Configurações',
      icon: SlidersHorizontal,
      tabs: [
        { value: 'modulos', label: 'Módulos', icon: Puzzle },
      ],
    }] : []),
  ];
}
