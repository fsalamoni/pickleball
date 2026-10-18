/**
 * A Central da federação (`/federacoes/:id/gerir?aba=`): seções em dois
 * grupos — "Atender" (o trabalho do dia) e "Gerir" (como a federação é) —,
 * como a Central da arena. A seção só existe para quem tem a permissão dela
 * (`FED_PERMISSION`): a secretaria vê Filiados, o financeiro vê Financeiro,
 * presidente e diretor veem tudo. O valor de cada aba é ÚNICO e é contrato de
 * link (os avisos levam a `?aba=pedidos`, `?aba=cobrancas`).
 */
import { CreditCard, FileText, Puzzle, SlidersHorizontal, Sun, UserCog, Users, Wallet, Inbox, ListChecks, Receipt } from 'lucide-react';
import { tk } from '@/core/i18n';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';

export const FED_SECTION_GROUPS = Object.freeze([
  { id: 'atender', label: tk('Atender') },
  { id: 'gerir', label: tk('Gerir') },
]);

/**
 * @param {string[]} perms permissões de quem vê (`permissionsOf(role)`)
 * @returns {Array<{ id: string, grupo: string, label: string, icon: Function, dica?: string, tabs: Array<{ value: string, label: string, icon: Function }> }>}
 */
export function buildFederationSections(perms = []) {
  const pode = (p) => perms.includes(p);
  const admin = pode(FED_PERMISSION.ADMIN);
  return [
    { id: 'hoje', grupo: 'atender', label: tk('Hoje'), icon: Sun, tabs: [{ value: 'hoje', label: tk('Hoje'), icon: Sun }] },
    pode(FED_PERMISSION.MEMBERS) && {
      id: 'filiados', grupo: 'atender', label: tk('Filiados'), icon: Users, dica: 'federacao-secao-filiados',
      tabs: [
        { value: 'pedidos', label: tk('Pedidos'), icon: Inbox },
        { value: 'filiados', label: tk('Filiados'), icon: ListChecks },
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
