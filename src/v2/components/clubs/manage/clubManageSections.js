/**
 * As seções da Central do clube (`/clubes/:clubId/gerir?aba=`), como as da
 * federação e da arena: dois grupos (Atender · Gerir), a aba na URL, e cada
 * cargo vendo só o que a sua permissão alcança. O `value` de cada aba é único
 * em toda a Central (a seção ativa é achada pela aba) e é contrato de link:
 * os avisos do servidor levam a ele — nunca renomeie.
 */
import { BarChart3, Calculator, CalendarDays, CircleDollarSign, Gavel, IdCard, Landmark, LayoutDashboard, Library, Megaphone, MessageSquareWarning, Package, Scale, Settings, ShieldCheck, Store, Tag, Users } from 'lucide-react';
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
      id: 'disciplina', label: t('Disciplina'), grupo: 'atender', icon: Gavel, dica: 'clube-secao-disciplina',
      tabs: [
        { value: 'sancoes', label: t('Sanções'), icon: Scale },
        { value: 'ouvidoria', label: t('Ouvidoria'), icon: MessageSquareWarning },
      ],
      ok: tem(perms, CLUB_PERM.DISCIPLINE),
    },
    {
      id: 'protecao', label: t('Proteção de menores'), grupo: 'atender', icon: ShieldCheck, dica: 'clube-secao-protecao',
      tabs: [
        { value: 'protecao', label: t('Quem trabalha com menores'), icon: ShieldCheck },
        { value: 'menores', label: t('Associados menores'), icon: Users },
        { value: 'protecao-regras', label: t('Regras'), icon: Scale },
      ],
      ok: tem(perms, CLUB_PERM.DISCIPLINE),
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
      id: 'comunicacao', label: t('Comunicação'), grupo: 'gerir', icon: Megaphone, dica: 'clube-secao-comunicacao',
      tabs: [
        { value: 'comunicados', label: t('Comunicados') },
        { value: 'vantagens', label: t('Vantagens') },
        { value: 'patrocinadores', label: t('Patrocinadores') },
        { value: 'divulgacao', label: t('Cupons e campanhas') },
      ],
      ok: tem(perms, CLUB_PERM.COMMS),
    },
    {
      id: 'documentos', label: t('Documentos'), grupo: 'gerir', icon: Library, dica: 'clube-secao-documentos',
      tabs: [{ value: 'documentos', label: t('Documentos oficiais') }], ok: tem(perms, CLUB_PERM.DOCS),
    },
    {
      // A secretaria (docs) marca qualquer evento; a diretoria esportiva (sports), só a agenda esportiva.
      id: 'agenda', label: t('Agenda'), grupo: 'gerir', icon: CalendarDays, dica: 'clube-secao-agenda',
      tabs: [{ value: 'agenda', label: t('Agenda oficial') }], ok: tem(perms, CLUB_PERM.DOCS, CLUB_PERM.SPORTS),
    },
    {
      id: 'contas', label: t('Contas'), grupo: 'gerir', icon: Calculator, dica: 'clube-secao-contas',
      tabs: [
        { value: 'contas', label: t('Visão geral') },
        { value: 'orcamento', label: t('Orçamento') },
        { value: 'lancamentos', label: t('Lançamentos') },
        { value: 'prestacao', label: t('Prestação de contas') },
      ],
      ok: tem(perms, CLUB_PERM.FINANCE, CLUB_PERM.FISCAL),
    },
    {
      // O conselho fiscal lê o inventário; quem edita é o financeiro, a diretoria esportiva e a administração.
      id: 'patrimonio', label: t('Patrimônio'), grupo: 'gerir', icon: Package, dica: 'clube-secao-patrimonio',
      tabs: [{ value: 'patrimonio', label: t('Bens e empréstimos') }], ok: tem(perms, CLUB_PERM.FINANCE, CLUB_PERM.SPORTS, CLUB_PERM.FISCAL),
    },
    {
      id: 'loja', label: t('Loja'), grupo: 'gerir', icon: Store, dica: 'clube-secao-loja',
      tabs: [{ value: 'loja', label: t('Loja do clube') }], ok: tem(perms, CLUB_PERM.FINANCE),
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
