/**
 * A Central da federação (`/federacoes/:id/gerir?aba=`): seções em dois
 * grupos — "Atender" (o trabalho do dia) e "Gerir" (como a federação é) —,
 * como a Central da arena. A seção só existe para quem tem a permissão dela
 * (`FED_PERMISSION`): a secretaria vê Filiados, o financeiro vê Financeiro,
 * presidente e diretor veem tudo. O valor de cada aba é ÚNICO e é contrato de
 * link (os avisos levam a `?aba=pedidos`, `?aba=cobrancas`).
 */
import { Building2, ClipboardList, CreditCard, FileText, Medal, Puzzle, SlidersHorizontal, Sun, Trophy, UserCog, Users, Wallet, Inbox, ListChecks, Receipt } from 'lucide-react';
import { tk } from '@/core/i18n';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import { fedModuleOn } from '@/modules/federations/domain/federation';

export const FED_SECTION_GROUPS = Object.freeze([
  { id: 'atender', label: tk('Atender') },
  { id: 'gerir', label: tk('Gerir') },
]);

/**
 * @param {string[]} perms permissões de quem vê (`permissionsOf(role)`)
 * @param {object} [federation] a federação — as abas dos MÓDULOS só existem com o módulo ligado
 * @returns {Array<{ id: string, grupo: string, label: string, icon: Function, dica?: string, tabs: Array<{ value: string, label: string, icon: Function }> }>}
 */
export function buildFederationSections(perms = [], federation = null) {
  const pode = (p) => perms.includes(p);
  const admin = pode(FED_PERMISSION.ADMIN);
  const modulo = (id) => fedModuleOn(federation, id);
  return [
    { id: 'hoje', grupo: 'atender', label: tk('Hoje'), icon: Sun, tabs: [{ value: 'hoje', label: tk('Hoje'), icon: Sun }] },
    pode(FED_PERMISSION.MEMBERS) && {
      id: 'filiados', grupo: 'atender', label: tk('Filiados'), icon: Users, dica: 'federacao-secao-filiados',
      tabs: [
        { value: 'pedidos', label: tk('Pedidos'), icon: Inbox },
        { value: 'filiados', label: tk('Filiados'), icon: ListChecks },
        ...(modulo('affiliations') ? [{ value: 'filiados-orgs', label: tk('Clubes e arenas'), icon: Building2 }] : []),
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
    pode(FED_PERMISSION.FINANCE) && {
      id: 'financeiro', grupo: 'atender', label: tk('Financeiro'), icon: Wallet, dica: 'federacao-secao-financeiro',
      tabs: [
        { value: 'cobrancas', label: tk('Cobranças'), icon: Receipt },
        { value: 'recebidos', label: tk('Recebidos'), icon: Wallet },
      ],
    },
    admin && {
      id: 'equipe', grupo: 'gerir', label: tk('Equipe'), icon: UserCog, dica: 'federacao-secao-equipe',
      tabs: [{ value: 'equipe', label: tk('Equipe'), icon: UserCog }],
    },
    (admin || pode(FED_PERMISSION.FINANCE)) && {
      id: 'config', grupo: 'gerir', label: tk('Configurações'), icon: SlidersHorizontal, dica: 'federacao-secao-config',
      tabs: [
        { value: 'planos', label: tk('Planos'), icon: CreditCard },
        { value: 'pix', label: tk('Recebimento'), icon: Wallet },
        ...(admin ? [
          { value: 'pagina', label: tk('Página'), icon: FileText },
          { value: 'modulos', label: tk('Módulos'), icon: Puzzle },
        ] : []),
      ],
    },
  ].filter(Boolean);
}

/** A seção que contém a aba (ou a primeira seção). */
export function sectionOfTab(sections, aba) {
  return sections.find((s) => s.tabs.some((x) => x.value === aba)) || sections[0];
}
