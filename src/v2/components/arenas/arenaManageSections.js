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
  Clock, Cpu, Crown, DollarSign, Gift, GraduationCap, Image, Info, LayoutGrid, Megaphone,
  Network, Package, Palette, Puzzle, ShoppingBag, SlidersHorizontal, Smile, Sparkles, Star, Sun,
  Swords, Tag, Trophy, UserCheck, Users, Wallet, Wrench,
} from 'lucide-react';
import { tk } from '@/core/i18n';

/**
 * As duas linhas da barra de seções. A ordem das seções dentro de cada linha é
 * a do ciclo de vida (abaixo); a linha diz para que a seção serve:
 *  - **Atender** — o trabalho do dia, com cliente na frente: reservas, jogo
 *    aberto, membros, aulas, torneios, loja e a rotina da casa.
 *  - **Gerir** — como a arena é: perfil, estrutura e preços, marketing,
 *    desempenho, equipe e o que ela liga para si.
 * Atender vem em cima porque é por onde se entra (a aba padrão é Hoje).
 */
export const ARENA_SECTION_GROUPS = Object.freeze([
  { id: 'atender', label: tk('Atender') },
  { id: 'gerir', label: tk('Gerir') },
]);

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
  coachResidentOn, linkedClubsOn, crmOn, opsKpisOn, arenaModulesOn, engajamentoOn = false, modulos = {},
}) {
  return [
    // Hoje (Fase 3.3): a abertura da Central — a agenda do dia e, com o módulo
    // de operação, a rotina. É por onde se entra; "Precisa de você" fica acima.
    { id: 'hoje', grupo: 'atender', label: tk('Hoje'), icon: Sun, tabs: [{ value: 'hoje', label: tk('Hoje'), icon: Sun }] },
    {
      id: 'perfil',
      grupo: 'gerir',
      label: tk('Perfil'),
      icon: Building2,
      tabs: [
        { value: 'info', label: tk('Informações'), icon: Info },
        { value: 'fotos', label: tk('Fotos'), icon: Image },
        // A marca é a cara da arena: mora junto das informações e das fotos.
        ...(modulos.marca ? [{ value: 'marca', label: tk('Marca'), icon: Palette }] : []),
      ],
    },
    {
      id: 'estrutura',
      grupo: 'gerir',
      label: tk('Estrutura e preços'),
      icon: LayoutGrid,
      // `dica`: âncora das dicas guiadas (a seta de "Cadastrar quadras e horários").
      dica: 'arena-secao-estrutura',
      tabs: [
        { value: 'quadras', label: tk('Quadras'), icon: LayoutGrid, dica: 'arena-aba-quadras' },
        { value: 'precos', label: tk('Preços'), icon: DollarSign },
        { value: 'regras', label: tk('Regras'), icon: ClipboardList },
      ],
    },
    {
      id: 'reservas',
      grupo: 'atender',
      label: tk('Reservas'),
      icon: CalendarClock,
      dica: 'arena-secao-reservas',
      tabs: [
        { value: 'reservas', label: tk('Solicitações'), icon: CalendarClock, dica: 'arena-aba-reservas' },
        { value: 'calendario', label: tk('Calendário'), icon: CalendarDays },
        { value: 'calendario-admin', label: tk('Reservas (admin)'), icon: CalendarRange },
        ...(crmOn ? [{ value: 'clientes', label: tk('Clientes'), icon: Users }] : []),
        // "Quem veio?" é uma pergunta sobre as reservas do dia.
        ...(modulos.presenca ? [{ value: 'presenca', label: tk('Presença'), icon: UserCheck }] : []),
      ],
    },
    // Jogo aberto: a arena publica horário com vaga e os atletas preenchem.
    // Vem logo depois de Reservas porque é o mesmo negócio — vender horário
    // de quadra — e ocupa a quadra como uma reserva.
    ...(modulos.jogoAberto ? [{
      id: 'jogo-aberto',
      grupo: 'atender',
      label: tk('Jogo aberto'),
      icon: Swords,
      tabs: [
        { value: 'jogo-aberto', label: tk('Jogos publicados'), icon: Swords },
      ],
    }] : []),
    ...(modulos.membros ? [{
      id: 'membros',
      grupo: 'atender',
      label: tk('Membros'),
      icon: Crown,
      tabs: [
        { value: 'membros', label: tk('Membros'), icon: Crown },
        ...(modulos.pacotes ? [{ value: 'planos', label: tk('Pacotes de horas'), icon: Package }] : []),
      ],
    }] : []),
    // Aulas: a agenda E os professores. Com o módulo ligado, "Professores"
    // sai de Equipe e vem para cá, virando a lista ÚNICA (parceiros da
    // plataforma + quem dá aula). O valor da aba continua `professores`:
    // links antigos (`?aba=professores`) seguem levando ao lugar certo.
    ...(modulos.aulas ? [{
      id: 'aulas',
      grupo: 'atender',
      label: tk('Aulas'),
      icon: GraduationCap,
      tabs: [
        { value: 'aulas', label: tk('Agenda'), icon: CalendarDays },
        { value: 'professores', label: tk('Professores'), icon: GraduationCap },
      ],
    }] : []),
    // Torneios (Onda CB): os torneios DA CASA são os torneios da PLATAFORMA
    // sediados aqui, com as regras da plataforma — o antigo "torneio da casa",
    // uma competição paralela, saiu (o jogo aberto faz o que ele fazia). A
    // seção existe com o módulo `leagues` (Ranking da casa) ou quando a arena
    // já sedia algum torneio — sem nenhum dos dois, a Central é a de antes.
    // O valor `torneios` continua o mesmo: links antigos (`?aba=torneios`)
    // seguem levando à seção certa.
    ...(modulos.torneios || modulos.torneiosPlataforma ? [{
      id: 'torneios',
      grupo: 'atender',
      label: tk('Torneios'),
      icon: Trophy,
      tabs: [
        { value: 'torneios', label: tk('Torneios da casa'), icon: Trophy },
        ...(modulos.torneios ? [{ value: 'ranking-da-casa', label: tk('Ranking da casa'), icon: Crown }] : []),
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
      grupo: 'gerir',
      label: tk('Marketing'),
      icon: Megaphone,
      tabs: (() => {
        const ferramentas = [
          ...(modulos.cupons ? [{ value: 'cupons', label: tk('Cupons'), icon: Tag }] : []),
          ...(modulos.campanhas ? [{ value: 'campanhas', label: tk('Campanhas'), icon: Megaphone }] : []),
          ...(modulos.satisfacao ? [{ value: 'satisfacao', label: tk('Satisfação'), icon: Smile }] : []),
          ...(modulos.indicacoes ? [{ value: 'indicacoes', label: tk('Indicações'), icon: Gift }] : []),
        ];
        return ferramentas.length > 0 ? ferramentas : [{ value: 'marketing', label: tk('Ferramentas'), icon: Megaphone }];
      })(),
    }] : []),
    {
      id: 'comercial',
      grupo: 'atender',
      label: tk('Pagamentos e loja'),
      icon: Wallet,
      tabs: [
        ...(modulos.loja ? [{ value: 'pedidos', label: tk('Pedidos do app'), icon: ShoppingBag }] : []),
        { value: 'pagamento', label: tk('Pagamento'), icon: Wallet },
        { value: 'mercado', label: tk('Mercado'), icon: Package },
      ],
    },
    // Operação: a rotina de quem toca a arena. "Hoje" existe sempre que o
    // módulo está ligado — é o resumo do dia, e explica o que ligar quando
    // nenhuma ferramenta está. Os equipamentos (IoT) moram aqui porque são o
    // que existe fisicamente na arena, e a seção existe mesmo só com eles.
    ...(modulos.operacao || modulos.equipamentos ? [{
      id: 'operacao',
      grupo: 'atender',
      label: tk('Operação'),
      icon: ClipboardCheck,
      tabs: [
        ...(modulos.operacao ? [{ value: 'operacao', label: tk('Rotina do dia'), icon: Sun }] : []),
        ...(modulos.checklists ? [{ value: 'checklists', label: tk('Rotinas'), icon: ClipboardList }] : []),
        ...(modulos.manutencao ? [{ value: 'manutencao', label: tk('Manutenção'), icon: Wrench }] : []),
        ...(modulos.equipamentos ? [{ value: 'equipamentos', label: tk('Equipamentos'), icon: Cpu }] : []),
      ],
    }] : []),
    {
      id: 'desempenho',
      grupo: 'gerir',
      label: tk('Desempenho'),
      icon: BarChart3,
      tabs: [
        ...(opsKpisOn ? [{ value: 'semana', label: tk('Semana'), icon: CalendarRange }] : []),
        { value: 'metricas', label: tk('Métricas'), icon: BarChart3 },
        // Gamificação V2: saúde da arena, metas, desafios e recompensas (flag
        // `gamification_v2`). Mora com os números porque começa por eles.
        ...(engajamentoOn ? [{ value: 'engajamento', label: tk('Engajamento'), icon: Trophy, dica: 'arena-aba-engajamento' }] : []),
        { value: 'retornos', label: tk('Retornos'), icon: Star },
        // Leituras do negócio: a rede somada e a leitura automática dos números.
        ...(modulos.inteligencia ? [{ value: 'inteligencia', label: tk('Inteligência'), icon: Sparkles }] : []),
        ...(modulos.rede ? [{ value: 'rede', label: tk('Rede'), icon: Network }] : []),
      ],
    },
    {
      id: 'equipe',
      grupo: 'gerir',
      label: tk('Equipe e parceiros'),
      icon: Users,
      tabs: [
        { value: 'admins', label: tk('Admins'), icon: Users },
        // O plantão (módulo de operação): nome, função e turno de quem trabalha
        // aqui. Mora com a equipe, que é onde se procura quem trabalha na arena.
        ...(modulos.plantao ? [{ value: 'plantao', label: tk('Plantão'), icon: Clock }] : []),
        ...(coachResidentOn && !modulos.aulas ? [{ value: 'professores', label: tk('Professores'), icon: GraduationCap }] : []),
        ...(linkedClubsOn ? [{ value: 'clubes', label: tk('Clubes'), icon: Users }] : []),
      ],
    },
    // Configurações fecha o ciclo: o que a arena LIGA para si. Vem por último
    // de propósito — é a seção em que se escolhe o que existe, e escolher só
    // faz sentido depois de conhecer o resto.
    ...(arenaModulesOn ? [{
      id: 'configuracoes',
      grupo: 'gerir',
      label: tk('Configurações'),
      icon: SlidersHorizontal,
      dica: 'arena-secao-configuracoes',
      tabs: [
        { value: 'modulos', label: tk('Módulos'), icon: Puzzle, dica: 'arena-aba-modulos' },
      ],
    }] : []),
  ];
}

/**
 * Abas que mudaram de nome continuam abrindo: link antigo em aviso, em
 * favorito ou em mensagem não pode cair em Reservas sem explicação.
 *
 * - `torneios-plataforma` (Onda BG): os torneios da plataforma sediados aqui
 *   viraram os torneios da casa (Onda CB), na aba `torneios`.
 */
export const ARENA_TAB_ALIASES = Object.freeze({
  'torneios-plataforma': 'torneios',
});

/** A aba de verdade por trás de um valor pedido na URL. */
export function resolveArenaTabAlias(tab) {
  return ARENA_TAB_ALIASES[tab] || tab;
}
