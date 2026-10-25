/**
 * As seções da Central do clube (`/clubes/:clubId/gerir?aba=`), como as da
 * federação e da arena: dois grupos (Atender · Gerir), a aba na URL, e cada
 * cargo vendo só o que a sua permissão alcança. O `value` de cada aba é único
 * em toda a Central (a seção ativa é achada pela aba) e é contrato de link:
 * os avisos do servidor levam a ele — nunca renomeie.
 */
import { BarChart3, CircleDollarSign, IdCard, Landmark, LayoutDashboard, Settings, Tag } from 'lucide-react';
import { CLUB_PERM } from '@/modules/clubs/domain/association';
import { t, tk } from '@/core/i18n';

export const CLUB_SECTION_GROUPS = Object.freeze([
  { id: 'atender', label: tk('Atender') },
  { id: 'gerir', label: tk('Gerir') },
]);

const tem = (perms, ...algumas) => perms.includes(CLUB_PERM.ADMIN) || algumas.some((p) => perms.includes(p));

/**
 * @param {string[]} perms permissões da pessoa (`clubPermsOf`)
 * @returns {Array<{ id: string, label: string, grupo: string, icon: any, dica: string, tabs: Array<{ value: string, label: string, dica?: string }> }>}
 */
export function buildClubSections(perms = []) {
  const secoes = [
    { id: 'hoje', label: t('Hoje'), grupo: 'atender', icon: LayoutDashboard, dica: 'clube-secao-hoje', tabs: [{ value: 'hoje', label: t('Hoje') }], ok: true },
    {
      id: 'associados', label: t('Associados'), grupo: 'atender', icon: IdCard, dica: 'clube-secao-associados',
      tabs: [{ value: 'associados', label: t('Associados') }], ok: tem(perms, CLUB_PERM.MEMBERS),
    },
    {
      id: 'financeiro', label: t('Financeiro'), grupo: 'atender', icon: CircleDollarSign, dica: 'clube-secao-financeiro',
      tabs: [{ value: 'cobrancas', label: t('Cobranças') }], ok: tem(perms, CLUB_PERM.FINANCE),
    },
    {
      id: 'planos', label: t('Planos'), grupo: 'gerir', icon: Tag, dica: 'clube-secao-planos',
      tabs: [
        { value: 'planos', label: t('Planos de associação') },
        // A chave Pix é configuração (a regra de `cfg` só deixa o administrador gravar).
        ...(perms.includes(CLUB_PERM.ADMIN) ? [{ value: 'pix', label: t('Pix do clube') }] : []),
      ],
      ok: tem(perms, CLUB_PERM.FINANCE),
    },
    {
      id: 'diretoria', label: t('Diretoria'), grupo: 'gerir', icon: Landmark, dica: 'clube-secao-diretoria',
      tabs: [
        { value: 'equipe', label: t('Equipe e mandatos') },
        // Montar os cargos é da presidência: só o master tem a permissão "admin".
        ...(perms.includes(CLUB_PERM.ADMIN) ? [{ value: 'cargos', label: t('Cargos') }] : []),
      ],
      ok: tem(perms, CLUB_PERM.STAFF),
    },
    {
      id: 'indicadores', label: t('Indicadores'), grupo: 'gerir', icon: BarChart3, dica: 'clube-secao-indicadores',
      tabs: [{ value: 'indicadores', label: t('Indicadores') }], ok: tem(perms, CLUB_PERM.MEMBERS, CLUB_PERM.FINANCE),
    },
    {
      id: 'config', label: t('Configurações'), grupo: 'gerir', icon: Settings, dica: 'clube-secao-config',
      tabs: [{ value: 'config', label: t('Associação do clube') }], ok: perms.includes(CLUB_PERM.ADMIN),
    },
  ];
  return secoes.filter((s) => s.ok).map(({ ok: _ok, ...resto }) => resto);
}

/** A seção que contém a aba pedida (ou a primeira, "Hoje"). */
export function sectionOfClubTab(sections, tab) {
  return sections.find((s) => s.tabs.some((x) => x.value === tab)) || sections[0];
}
