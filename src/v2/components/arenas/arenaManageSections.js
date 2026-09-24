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
  BarChart3, Building2, CalendarClock, CalendarDays, CalendarRange, ClipboardList,
  Crown, DollarSign, GraduationCap, Image, Info, LayoutGrid, Package, Puzzle,
  SlidersHorizontal, Star, Users, Wallet,
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
      ],
    },
    ...(modulos.membros ? [{
      id: 'membros',
      label: 'Membros',
      icon: Crown,
      tabs: [
        { value: 'membros', label: 'Membros', icon: Crown },
        ...(modulos.pacotes ? [{ value: 'planos', label: 'Pacotes de horas', icon: Package }] : []),
      ],
    }] : []),
    {
      id: 'comercial',
      label: 'Pagamentos e loja',
      icon: Wallet,
      tabs: [
        { value: 'pagamento', label: 'Pagamento', icon: Wallet },
        { value: 'mercado', label: 'Mercado', icon: Package },
      ],
    },
    {
      id: 'desempenho',
      label: 'Desempenho',
      icon: BarChart3,
      tabs: [
        ...(opsKpisOn ? [{ value: 'semana', label: 'Semana', icon: CalendarRange }] : []),
        { value: 'metricas', label: 'Métricas', icon: BarChart3 },
        { value: 'retornos', label: 'Retornos', icon: Star },
      ],
    },
    {
      id: 'equipe',
      label: 'Equipe e parceiros',
      icon: Users,
      tabs: [
        { value: 'admins', label: 'Admins', icon: Users },
        ...(coachResidentOn ? [{ value: 'professores', label: 'Professores', icon: GraduationCap }] : []),
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
