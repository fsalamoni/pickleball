/**
 * A Central da federação (`/federacoes/:id/gerir?aba=`): seções em dois
 * grupos — "Atender" (o trabalho do dia) e "Gerir" (como a federação é) —,
 * como a Central da arena. A seção só existe para quem tem a permissão dela
 * (`FED_PERMISSION`): a secretaria vê Filiados, o financeiro vê Financeiro,
 * o admin master vê tudo (os cargos são de cada federação). O valor de cada aba é ÚNICO e é contrato de
 * link (os avisos levam a `?aba=pedidos`, `?aba=cobrancas`).
 *
 * "Página pública" junta o que muda o que o público vê (Publicação, Conteúdo,
 * Transparência); "Configurações" fica com o funcionamento (planos, Pix,
 * módulos, regras, loja). As abas mudaram de seção, não de valor.
 */
import { ArrowLeftRight, BadgeCheck, Calculator, CalendarCheck, CalendarDays, Flag, Settings2, Star, Banknote, Eye, Globe, Library, ScrollText, BarChart3, Building2, ClipboardList, CreditCard, FileText, FileUp, Gavel, GraduationCap, Handshake, Landmark, Medal, Megaphone, MessageSquare, MessageSquareWarning, Newspaper, Puzzle, Scale, ShieldCheck, SlidersHorizontal, Store, Sun, Tag, Trophy, Upload, UserCog, Users, Wallet, Inbox, LifeBuoy, ListChecks, Receipt, Vote, Plane, FileSignature, Package, BookOpen } from 'lucide-react';
import { tk } from '@/core/i18n';
import { DISCIPLINE_STATUS, FED_PERMISSION } from '@/modules/federations/domain/constants';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { sanctionInForce } from '@/modules/federations/domain/discipline';
import { sanctionState } from '@/modules/federations/domain/sanction';

/**
 * O que ficou em aberto num módulo DESLIGADO (ver `residual` abaixo). Lista
 * que não carregou (`undefined`) não abre nada.
 */
export function residualModules(federation, { sanctions, tournaments, minorReports } = {}) {
  return {
    safeguarding: !fedModuleOn(federation, 'safeguarding') && Array.isArray(minorReports)
      && minorReports.some((r) => r.status !== 'closed'),
    // A ouvidoria desligada não some com a denúncia de proteção que ainda está aberta.
    minorReportsOpen: Array.isArray(minorReports) && minorReports.some((r) => r.status !== 'closed'),
    discipline: !fedModuleOn(federation, 'discipline') && Array.isArray(sanctions)
      && sanctions.some((s) => s.status === DISCIPLINE_STATUS.APPEALED || sanctionInForce(s)),
    tournaments: !fedModuleOn(federation, 'tournaments') && Array.isArray(tournaments)
      && tournaments.some((x) => sanctionState(x).pending),
  };
}

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
/**
 * `residual`: módulo DESLIGADO com coisa em aberto que precisa de decisão
 * (`discipline`: sanção em vigor ou recurso; `tournaments`: pedido de
 * chancela pendente). A seção segue aberta só com o que já existe — desligar
 * impede o novo, nunca deixa um recurso sem quem decida.
 */
export function buildFederationSections(perms = [], federation = null, { isMaster = false, residual = {} } = {}) {
  const pode = (p) => perms.includes(p);
  const admin = pode(FED_PERMISSION.ADMIN);
  const modulo = (id) => fedModuleOn(federation, id);
  // A moderação dos comentários (docs ou admin) mora no Acervo; sem acervo, na Agenda.
  const moderaComentarios = admin || pode(FED_PERMISSION.DOCS);
  const abaComentarios = { value: 'comentarios', label: tk('Comentários'), icon: MessageSquare };
  // Administração (Bloco 5): contratos de patrocínio (financeiro/admin; o conselho fiscal lê) e patrimônio (também competições).
  const veContratos = modulo('sponsors') && (admin || pode(FED_PERMISSION.FINANCE) || pode(FED_PERMISSION.FISCAL));
  const veBens = modulo('assets') && (admin || pode(FED_PERMISSION.FINANCE) || pode(FED_PERMISSION.FISCAL) || pode(FED_PERMISSION.COMPETITIONS));
  return [
    { id: 'hoje', grupo: 'atender', label: tk('Hoje'), icon: Sun, tabs: [{ value: 'hoje', label: tk('Hoje'), icon: Sun }] },
    pode(FED_PERMISSION.MEMBERS) && {
      id: 'filiados', grupo: 'atender', label: tk('Filiados e cadastrados'), icon: Users, dica: 'federacao-secao-filiados',
      tabs: [
        { value: 'pedidos', label: tk('Pedidos'), icon: Inbox },
        // Uma aba por TIPO lá dentro (`?tipo=`) e a pasta de cada um (`?pasta=`): os valores das abas da Central não mudam.
        { value: 'filiados', label: tk('Cadastro'), icon: ListChecks, dica: 'federacao-aba-cadastro' },
        ...(modulo('affiliations') ? [{ value: 'filiados-orgs', label: tk('Vínculos de clubes e arenas'), icon: Building2 }] : []),
        { value: 'transferencias', label: tk('Transferências'), icon: ArrowLeftRight },
        { value: 'documentos', label: tk('Documentos'), icon: FileUp },
        ...(modulo('insurance') ? [{ value: 'ocorrencias', label: tk('Seguro e ocorrências'), icon: LifeBuoy, dica: 'federacao-aba-ocorrencias' }] : []),
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
    // Arbitragem: a equipe de arbitragem (`courses`) ou o admin (o admin master antigo não tem `courses` gravado).
    (pode(FED_PERMISSION.COURSES) || admin) && modulo('referees') && {
      id: 'arbitragem', grupo: 'atender', label: tk('Arbitragem'), icon: Flag, dica: 'federacao-secao-arbitragem',
      tabs: [
        { value: 'arbitragem', label: tk('Escalas'), icon: CalendarCheck },
        { value: 'arbitragem-quadro', label: tk('Quadro'), icon: Users, dica: 'federacao-aba-arbitragem-quadro' },
        { value: 'arbitragem-avaliacoes', label: tk('Avaliações e súmulas'), icon: Star },
        { value: 'arbitragem-diarias', label: tk('Diárias'), icon: Banknote },
        { value: 'arbitragem-regras', label: tk('Regras e níveis'), icon: Settings2 },
      ],
    },
    // Licença de professor (Bloco 4): quem cuida dos cursos (`courses`) ou o admin.
    (pode(FED_PERMISSION.COURSES) || admin) && modulo('coach_licenses') && {
      id: 'professores', grupo: 'atender', label: tk('Professores'), icon: BadgeCheck, dica: 'federacao-secao-professores',
      tabs: [
        { value: 'licencas', label: tk('Licenças'), icon: BadgeCheck, dica: 'federacao-aba-licencas' },
        { value: 'licencas-niveis', label: tk('Níveis da licença'), icon: Settings2, dica: 'federacao-aba-licencas-niveis' },
      ],
    },
    // Proteção de menores (Bloco 4): só quem tem a permissão própria — a certidão e a denúncia são sensíveis.
    // Desligado com denúncia em aberto: fica só a aba das denúncias, até a última ser concluída.
    pode(FED_PERMISSION.SAFEGUARDING) && (modulo('safeguarding') || residual.safeguarding) && {
      id: 'protecao', grupo: 'atender', label: tk('Proteção de menores'), icon: ShieldCheck, dica: 'federacao-secao-protecao',
      tabs: modulo('safeguarding') ? [
        { value: 'protecao', label: tk('Quem trabalha com menores'), icon: Users, dica: 'federacao-aba-protecao' },
        ...(modulo('discipline') || residual.minorReportsOpen ? [{ value: 'protecao-denuncias', label: tk('Denúncias'), icon: MessageSquareWarning, dica: 'federacao-aba-protecao-denuncias' }] : []),
        { value: 'protecao-regras', label: tk('Regras'), icon: Settings2, dica: 'federacao-aba-protecao-regras' },
      ] : [{ value: 'protecao-denuncias', label: tk('Denúncias'), icon: MessageSquareWarning, dica: 'federacao-aba-protecao-denuncias' }],
    },
    pode(FED_PERMISSION.DISCIPLINE) && (modulo('discipline') || residual.discipline) && {
      id: 'disciplina', grupo: 'atender', label: tk('Disciplina'), icon: Gavel, dica: 'federacao-secao-disciplina',
      tabs: [
        { value: 'sancoes', label: tk('Sanções'), icon: Scale },
        ...(modulo('discipline') ? [{ value: 'ouvidoria', label: tk('Ouvidoria'), icon: MessageSquareWarning }] : []),
      ],
    },
    pode(FED_PERMISSION.COMPETITIONS) && (modulo('tournaments') || modulo('ranking') || residual.tournaments) && {
      id: 'competicoes', grupo: 'atender', label: tk('Competições'), icon: Trophy, dica: 'federacao-secao-competicoes',
      tabs: [
        ...(modulo('tournaments') || residual.tournaments ? [{ value: 'chancelas', label: tk('Chancelas'), icon: Trophy, dica: 'federacao-tab-chancelas' }] : []),
        ...(modulo('tournaments') ? [{ value: 'resultados', label: tk('Resultados'), icon: ClipboardList, dica: 'federacao-tab-resultados' }] : []),
        // Sem o módulo de ranking a aba segue existindo como "Categorias": é nela que se criam as categorias (FGP 1000 · G1) dos torneios.
        ...(modulo('ranking') || modulo('tournaments') ? [{ value: 'ranking', label: modulo('ranking') ? tk('Ranking') : tk('Categorias'), icon: Medal, dica: 'federacao-tab-ranking' }] : []),
      ],
    },
    // Seleção e editais: a equipe de competições prepara; o financeiro registra custos pagos e pagamentos dos editais.
    (pode(FED_PERMISSION.COMPETITIONS) || admin || pode(FED_PERMISSION.FINANCE)) && (modulo('selection') || modulo('grants')) && {
      id: 'selecao', grupo: 'atender', label: tk('Seleção e editais'), icon: Plane, dica: 'federacao-secao-selecao',
      tabs: [
        ...(modulo('selection') ? [{ value: 'convocacoes', label: tk('Convocações'), icon: Plane, dica: 'federacao-tab-convocacoes' }] : []),
        ...(modulo('grants') ? [{ value: 'editais', label: tk('Editais'), icon: FileSignature, dica: 'federacao-tab-editais' }] : []),
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
    // Eleições: o admin prepara e publica o edital; quem CONDUZ é a comissão eleitoral.
    admin && modulo('elections') && {
      id: 'eleicoes', grupo: 'gerir', label: tk('Eleições'), icon: Vote, dica: 'federacao-secao-eleicoes',
      tabs: [{ value: 'eleicoes', label: tk('Eleições'), icon: Vote }],
    },
    pode(FED_PERMISSION.FINANCE) && {
      id: 'financeiro', grupo: 'atender', label: tk('Financeiro'), icon: Wallet, dica: 'federacao-secao-financeiro',
      tabs: [
        { value: 'cobrancas', label: tk('Cobranças'), icon: Receipt },
        { value: 'recebidos', label: tk('Recebidos'), icon: Wallet },
      ],
    },
    // Contas (módulo `accounts`): o financeiro prepara; o conselho fiscal lê tudo e dá o parecer.
    (admin || pode(FED_PERMISSION.FINANCE) || pode(FED_PERMISSION.FISCAL)) && modulo('accounts') && {
      id: 'contas', grupo: 'gerir', label: tk('Contas'), icon: Calculator, dica: 'federacao-secao-contas',
      tabs: [
        { value: 'orcamento', label: tk('Visão geral'), icon: BarChart3 },
        { value: 'orcamento-anual', label: tk('Orçamento'), icon: Calculator, dica: 'federacao-aba-orcamento-anual' },
        { value: 'lancamentos', label: tk('Lançamentos'), icon: Receipt, dica: 'federacao-aba-lancamentos' },
        { value: 'prestacao-contas', label: tk('Prestação de contas'), icon: ScrollText, dica: 'federacao-aba-prestacao-contas' },
      ],
    },
    (admin || pode(FED_PERMISSION.MEMBERS) || pode(FED_PERMISSION.FINANCE)) && {
      id: 'indicadores', grupo: 'gerir', label: tk('Indicadores'), icon: BarChart3, dica: 'federacao-secao-indicadores',
      tabs: [
        { value: 'indicadores', label: tk('Indicadores'), icon: BarChart3 },
        // A conformidade com a Lei Geral do Esporte (zero banco): só o admin.
        ...(admin ? [{ value: 'conformidade', label: tk('Conformidade'), icon: Scale, dica: 'federacao-aba-conformidade' }] : []),
        // O relatório anual (PDF para a assembleia): só o admin, das leituras que a Central já faz.
        ...(admin ? [{ value: 'relatorio-anual', label: tk('Relatório anual'), icon: BookOpen, dica: 'federacao-aba-relatorio-anual' }] : []),
      ],
    },
    (veContratos || veBens) && {
      id: 'administracao', grupo: 'gerir', label: tk('Administração'), icon: Package, dica: 'federacao-secao-administracao',
      tabs: [
        ...(veContratos ? [{ value: 'contratos-patrocinio', label: tk('Contratos de patrocínio'), icon: FileSignature, dica: 'federacao-aba-contratos' }] : []),
        ...(veBens ? [{ value: 'patrimonio', label: tk('Patrimônio'), icon: Package, dica: 'federacao-aba-patrimonio' }] : []),
      ],
    },
    // Tudo o que muda o que o PÚBLICO vê, num lugar só (separado de planos, Pix, módulos e regras).
    admin && {
      id: 'pagina-publica', grupo: 'gerir', label: tk('Página pública'), icon: Globe, dica: 'federacao-secao-pagina-publica',
      tabs: [
        { value: 'publicacao', label: tk('Publicação'), icon: Globe, dica: 'federacao-aba-publicacao' },
        { value: 'pagina', label: tk('Conteúdo'), icon: FileText },
        { value: 'governanca', label: tk('Transparência'), icon: Landmark },
      ],
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
          { value: 'modulos', label: tk('Módulos'), icon: Puzzle },
          { value: 'regras', label: tk('Regras'), icon: ClipboardList, dica: 'federacao-aba-regras' },
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
