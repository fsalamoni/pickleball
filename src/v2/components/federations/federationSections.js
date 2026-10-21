/**
 * A Central da federação (`/federacoes/:id/gerir?aba=`): seções em dois
 * grupos — "Atender" (o trabalho do dia) e "Gerir" (como a federação é) —,
 * como a Central da arena. A seção só existe para quem tem a permissão dela
 * (`FED_PERMISSION`): a secretaria vê Filiados, o financeiro vê Financeiro,
 * o admin master vê tudo (os cargos são de cada federação). O valor de cada aba é ÚNICO e é contrato de
 * link (os avisos levam a `?aba=pedidos`, `?aba=cobrancas`).
 */
import { ArrowLeftRight, BadgeCheck, CalendarDays, Eye, Globe, Library, ScrollText, BarChart3, Building2, ClipboardList, CreditCard, FileText, FileUp, Gavel, GraduationCap, Handshake, Landmark, Medal, Megaphone, MessageSquare, MessageSquareWarning, Newspaper, Puzzle, Scale, ShieldCheck, SlidersHorizontal, Store, Sun, Tag, Trophy, Upload, UserCog, Users, Wallet, Inbox, ListChecks, Receipt } from 'lucide-react';
import { tk } from '@/core/i18n';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import { fedModuleOn } from '@/modules/federations/domain/federation';

export const FED_SECTION_GROUPS = Object.freeze([
  { id: 'atender', label: tk('Atender') },
  { id: 'gerir', label: tk('Gerir') },
]);

/**
 * @param {string[]} perms permissões de quem vê (`staffPerms(doc)`)
 * @param {object} [federation] a federação — as abas dos MÓDULOS só existem com o módulo ligado
 * @param {{ isMaster?: boolean }} [opts] admin master vê também a aba Cargos
 * @returns {Array<{ id: string, grupo: string, label: string, icon: Function, dica?: string, tabs: Array<{ value: string, label: string, icon: Function }> }>}
 */
export function buildFederationSections(perms = [], federation = null, { isMaster = false } = {}) {
  const pode = (p) => perms.includes(p);
  const admin = pode(FED_PERMISSION.ADMIN);
  const modulo = (id) => fedModuleOn(federation, id);
  // A moderação dos comentários (docs ou admin) mora no Acervo; sem acervo, na Agenda.
  const moderaComentarios = admin || pode(FED_PERMISSION.DOCS);
  const abaComentarios = { value: 'comentarios', label: tk('Comentários'), icon: MessageSquare };
  return [
    { id: 'hoje', grupo: 'atender', label: tk('Hoje'), icon: Sun, tabs: [{ value: 'hoje', label: tk('Hoje'), icon: Sun }] },
    pode(FED_PERMISSION.MEMBERS) && {
      id: 'filiados', grupo: 'atender', label: tk('Filiados'), icon: Users, dica: 'federacao-secao-filiados',
      tabs: [
        { value: 'pedidos', label: tk('Pedidos'), icon: Inbox },
        { value: 'filiados', label: tk('Filiados'), icon: ListChecks },
        ...(modulo('affiliations') ? [{ value: 'filiados-orgs', label: tk('Clubes e arenas'), icon: Building2 }] : []),
        { value: 'transferencias', label: tk('Transferências'), icon: ArrowLeftRight },
        { value: 'documentos', label: tk('Documentos'), icon: FileUp },
        { value: 'importar', label: tk('Importar'), icon: Upload },
      ],
    },
    pode(FED_PERMISSION.COURSES) && modulo('courses') && {
      id: 'cursos', grupo: 'atender', label: tk('Cursos'), icon: GraduationCap, dica: 'federacao-secao-cursos',
      tabs: [
        { value: 'cursos', label: tk('Cursos'), icon: GraduationCap },
        { value: 'credenciais', label: tk('Credenciais'), icon: ShieldCheck },
      ],
    },
    pode(FED_PERMISSION.DISCIPLINE) && modulo('discipline') && {
      id: 'disciplina', grupo: 'atender', label: tk('Disciplina'), icon: Gavel, dica: 'federacao-secao-disciplina',
      tabs: [
        { value: 'sancoes', label: tk('Sanções'), icon: Scale },
        { value: 'ouvidoria', label: tk('Ouvidoria'), icon: MessageSquareWarning },
      ],
    },
    pode(FED_PERMISSION.COMPETITIONS) && (modulo('tournaments') || modulo('ranking')) && {
      id: 'competicoes', grupo: 'atender', label: tk('Competições'), icon: Trophy, dica: 'federacao-secao-competicoes',
      tabs: [
        ...(modulo('tournaments') ? [
          { value: 'chancelas', label: tk('Chancelas'), icon: Trophy },
          { value: 'resultados', label: tk('Resultados'), icon: ClipboardList },
        ] : []),
        ...(modulo('ranking') ? [{ value: 'ranking', label: tk('Ranking'), icon: Medal }] : []),
      ],
    },
    pode(FED_PERMISSION.COMMS) && (modulo('news') || modulo('promos') || (admin && modulo('sponsors'))) && {
      id: 'comunicacao', grupo: 'atender', label: tk('Comunicação'), icon: Megaphone, dica: 'federacao-secao-comunicacao',
      tabs: [
        ...(modulo('news') ? [{ value: 'noticias', label: tk('Notícias'), icon: Newspaper }] : []),
        ...(modulo('promos') ? [{ value: 'divulgacao', label: tk('Cupons e campanhas'), icon: Tag }] : []),
        ...(admin && modulo('sponsors') ? [{ value: 'patrocinadores', label: tk('Patrocinadores'), icon: Handshake }] : []),
      ],
    },
    (pode(FED_PERMISSION.DOCS) || admin) && modulo('official_docs') && {
      id: 'acervo', grupo: 'atender', label: tk('Acervo oficial'), icon: Library, dica: 'federacao-secao-acervo',
      tabs: [
        { value: 'acervo', label: tk('Documentos'), icon: ScrollText },
        { value: 'transparencia', label: tk('Transparência'), icon: Eye },
        abaComentarios,
      ],
    },
    (admin || pode(FED_PERMISSION.DOCS) || pode(FED_PERMISSION.COMPETITIONS)) && modulo('calendar') && {
      id: 'agenda', grupo: 'atender', label: tk('Agenda'), icon: CalendarDays, dica: 'federacao-secao-agenda',
      tabs: [
        { value: 'agenda', label: tk('Calendário oficial'), icon: CalendarDays },
        ...(moderaComentarios && !modulo('official_docs') ? [abaComentarios] : []),
      ],
    },
    pode(FED_PERMISSION.FINANCE) && {
      id: 'financeiro', grupo: 'atender', label: tk('Financeiro'), icon: Wallet, dica: 'federacao-secao-financeiro',
      tabs: [
        { value: 'cobrancas', label: tk('Cobranças'), icon: Receipt },
        { value: 'recebidos', label: tk('Recebidos'), icon: Wallet },
      ],
    },
    (pode(FED_PERMISSION.MEMBERS) || pode(FED_PERMISSION.FINANCE)) && {
      id: 'indicadores', grupo: 'gerir', label: tk('Indicadores'), icon: BarChart3, dica: 'federacao-secao-indicadores',
      tabs: [{ value: 'indicadores', label: tk('Indicadores'), icon: BarChart3 }],
    },
    pode(FED_PERMISSION.STAFF) && {
      id: 'equipe', grupo: 'gerir', label: tk('Equipe'), icon: UserCog, dica: 'federacao-secao-equipe',
      tabs: [
        { value: 'equipe', label: tk('Pessoas'), icon: UserCog },
        ...(isMaster ? [{ value: 'cargos', label: tk('Cargos'), icon: BadgeCheck, dica: 'federacao-aba-cargos' }] : []),
      ],
    },
    (admin || pode(FED_PERMISSION.FINANCE)) && {
      id: 'config', grupo: 'gerir', label: tk('Configurações'), icon: SlidersHorizontal, dica: 'federacao-secao-config',
      tabs: [
        { value: 'planos', label: tk('Planos'), icon: CreditCard },
        { value: 'pix', label: tk('Recebimento'), icon: Wallet },
        ...(admin ? [
          { value: 'publicacao', label: tk('Publicação'), icon: Globe, dica: 'federacao-aba-publicacao' },
          { value: 'pagina', label: tk('Página'), icon: FileText },
          { value: 'modulos', label: tk('Módulos'), icon: Puzzle },
          { value: 'regras', label: tk('Regras'), icon: ClipboardList },
          { value: 'governanca', label: tk('Governança'), icon: Landmark },
        ] : []),
        ...((admin || pode(FED_PERMISSION.FINANCE)) && modulo('store') ? [{ value: 'loja', label: tk('Loja'), icon: Store }] : []),
      ],
    },
  ].filter(Boolean);
}

/** A seção que contém a aba (ou a primeira seção). */
export function sectionOfTab(sections, aba) {
  return sections.find((s) => s.tabs.some((x) => x.value === aba)) || sections[0];
}
