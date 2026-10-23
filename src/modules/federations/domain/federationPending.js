/**
 * "Precisa de você" — o que espera a EQUIPE da federação (lógica pura).
 * Fonte `undefined` = não carregou ou falhou: o item não entra, nunca vira 0
 * (`docs/27-FALHA-NAO-E-VAZIO.md`). As contas são as MESMAS das abas.
 */
import { tk } from '@/core/i18n';
import { AFFILIATION_STATUS, CHARGE_STATUS, DISCIPLINE_STATUS, DOC_STATUS, FED_PERMISSION, MEMBER_STATUS, REPORT_STATUS, TRANSFER_STATUS, isInvitePending } from './constants.js';
import { sanctionState } from './sanction.js';
import { isChargeOverdue } from './charges.js';
import { isoDate, membershipState } from './membership.js';
import { accountsPendingItems } from './accounts.js';
import { myPendingAssignments, refereeStaffPending } from './referees.js';
import { commissionTodo } from './elections.js';
import { directorStage, finalInviteOpen } from './competitions.js';
import { addDaysISO, licenseState, pendingLicenseRequests } from './coachLicenses.js';
import { openMinorReports, pendingBackgrounds } from './safeguarding.js';
import { DUES_STATUS, LINK_STATUS, canHomologate, canManageDues, canManageNetwork, duesState } from './national.js';

const plural = (n, um, varios) => (n === 1 ? um : varios);

/**
 * @param {{ members?: object[], charges?: object[], affiliations?: object[], tournaments?: object[], transfers?: object[], documents?: object[], sanctions?: object[], reports?: object[], accountReports?: object[] }} fontes
 * @param {string[]} perms permissões de quem vê (só vê o que pode resolver)
 * @param {{ hoje?: string }} quando
 * @returns {Array<{ id: string, count: number, label: string, aba: string, filtro?: string }>} — `filtro` abre a lista da aba já filtrada (`?filtro=`)
 */
export function federationPendingItems(fontes = {}, perms = [], { hoje = isoDate(), uid = null, now = Date.now() } = {}) {
  const itens = [];
  const { members, charges, affiliations, tournaments, transfers, documents, sanctions, reports, accountReports, refereeAssignments, refereeEvents, refereeRules } = fontes;
  const pode = (p) => perms.includes(p);

  if (pode(FED_PERMISSION.MEMBERS) && Array.isArray(members)) {
    const n = members.filter((m) => m.status === MEMBER_STATUS.PENDING).length;
    if (n) itens.push({ id: 'pedidos', count: n, aba: 'pedidos', label: plural(n, tk('pedido de filiação para analisar'), tk('pedidos de filiação para analisar')) });
    const venc = members.filter((m) => membershipState(m, hoje).expiring).length;
    if (venc) itens.push({ id: 'vencendo', count: venc, aba: 'filiados', filtro: 'vencendo', label: plural(venc, tk('filiação vence em 30 dias'), tk('filiações vencem em 30 dias')) });
  }
  if (pode(FED_PERMISSION.MEMBERS) && Array.isArray(affiliations)) {
    const n = affiliations.filter((a) => a.status === AFFILIATION_STATUS.PENDING).length;
    if (n) itens.push({ id: 'orgs', count: n, aba: 'filiados-orgs', filtro: 'pendentes', label: plural(n, tk('clube ou arena pedindo filiação'), tk('clubes ou arenas pedindo filiação')) });
  }
  if (pode(FED_PERMISSION.MEMBERS) && Array.isArray(transfers)) {
    const n = transfers.filter((x) => x.status === TRANSFER_STATUS.PENDING).length;
    if (n) itens.push({ id: 'transferencias', count: n, aba: 'transferencias', filtro: 'pendentes', label: plural(n, tk('transferência para responder'), tk('transferências para responder')) });
  }
  if (pode(FED_PERMISSION.MEMBERS) && Array.isArray(documents)) {
    const n = documents.filter((d) => d.status === DOC_STATUS.PENDING).length;
    if (n) itens.push({ id: 'documentos', count: n, aba: 'documentos', filtro: 'pendentes', label: plural(n, tk('documento para conferir'), tk('documentos para conferir')) });
  }
  if (pode(FED_PERMISSION.DISCIPLINE) && Array.isArray(sanctions)) {
    const n = sanctions.filter((x) => x.status === DISCIPLINE_STATUS.APPEALED).length;
    if (n) itens.push({ id: 'recursos', count: n, aba: 'sancoes', filtro: 'recurso', label: plural(n, tk('recurso de sanção para decidir'), tk('recursos de sanção para decidir')) });
  }
  if (pode(FED_PERMISSION.DISCIPLINE) && Array.isArray(reports)) {
    // A denúncia de proteção de menor não é da ouvidoria comum: é do responsável pela proteção (abaixo).
    const n = reports.filter((x) => x.status === REPORT_STATUS.OPEN && x.kind !== 'minor_protection').length;
    if (n) itens.push({ id: 'ouvidoria', count: n, aba: 'ouvidoria', filtro: 'abertas', label: plural(n, tk('manifestação na ouvidoria sem resposta'), tk('manifestações na ouvidoria sem resposta')) });
  }
  if (pode(FED_PERMISSION.COMPETITIONS) && Array.isArray(tournaments)) {
    const n = tournaments.filter((tt) => sanctionState(tt).pending).length;
    if (n) itens.push({ id: 'chancelas', count: n, aba: 'chancelas', filtro: 'pendentes', label: plural(n, tk('pedido de chancela para analisar'), tk('pedidos de chancela para analisar')) });
  }
  if (pode(FED_PERMISSION.COURSES) || pode(FED_PERMISSION.ADMIN)) {
    const r = refereeStaffPending({ assignments: refereeAssignments, events: refereeEvents, rules: refereeRules, hoje });
    if (r.semResposta) itens.push({ id: 'arbitragem-resposta', count: r.semResposta, aba: 'arbitragem', filtro: 'sem-resposta', label: plural(r.semResposta, tk('convocação de arbitragem sem resposta'), tk('convocações de arbitragem sem resposta')) });
    if (r.semCobertura) itens.push({ id: 'arbitragem-cobertura', count: r.semCobertura, aba: 'arbitragem', filtro: 'sem-cobertura', label: plural(r.semCobertura, tk('evento em 7 dias sem arbitragem completa'), tk('eventos em 7 dias sem arbitragem completa')) });
  }
  // Licença de professor e proteção de menores (Bloco 4).
  if (pode(FED_PERMISSION.COURSES) || pode(FED_PERMISSION.ADMIN)) {
    const n = pendingLicenseRequests(fontes.coachLicenses);
    if (n) itens.push({ id: 'licencas', count: n, aba: 'licencas', filtro: 'pedidos', label: plural(n, tk('pedido de licença de professor para analisar'), tk('pedidos de licença de professor para analisar')) });
  }
  if (pode(FED_PERMISSION.SAFEGUARDING)) {
    const denuncias = openMinorReports(fontes.minorReports);
    if (denuncias) itens.push({ id: 'protecao-denuncias', count: denuncias, aba: 'protecao-denuncias', label: plural(denuncias, tk('denúncia de proteção de menor em aberto'), tk('denúncias de proteção de menor em aberto')) });
    const certidoes = pendingBackgrounds(fontes.safeguardingRows);
    if (certidoes) itens.push({ id: 'protecao-certidoes', count: certidoes, aba: 'protecao', filtro: 'conferir', label: plural(certidoes, tk('certidão de antecedentes para conferir'), tk('certidões de antecedentes para conferir')) });
  }
  if (pode(FED_PERMISSION.FINANCE) && Array.isArray(charges)) {
    const n = charges.filter((c) => c.status === CHARGE_STATUS.DECLARED).length;
    if (n) itens.push({ id: 'informados', count: n, aba: 'cobrancas', filtro: 'informadas', label: plural(n, tk('pagamento informado para confirmar'), tk('pagamentos informados para confirmar')) });
    const atras = charges.filter((c) => isChargeOverdue(c, hoje)).length;
    if (atras) itens.push({ id: 'atrasadas', count: atras, aba: 'cobrancas', filtro: 'vencidas', label: plural(atras, tk('cobrança vencida sem pagamento'), tk('cobranças vencidas sem pagamento')) });
  }
  // Contas (módulo `accounts`): parecer do conselho, parecer recebido e o prazo de abril.
  itens.push(...accountsPendingItems(accountReports, perms, { hoje }));
  // Eleições: o que espera quem CONDUZ (a comissão; sem comissão, o admin).
  if (Array.isArray(fontes.elections) && Array.isArray(fontes.candidacies)) {
    const conduz = fontes.elections.filter((e) => (e.commission_uids || []).includes(uid) || (!(e.commission_uids || []).length && pode(FED_PERMISSION.ADMIN)));
    const todo = conduz.flatMap((e) => commissionTodo(e, fontes.candidacies, { hoje, nowMs: now }));
    const soma = (id) => todo.filter((x) => x.id === id).reduce((s, x) => s + (x.count || 0), 0);
    const chapas = soma('judge_candidacies');
    const impug = soma('judge_challenges');
    if (chapas) itens.push({ id: 'chapas', count: chapas, aba: 'eleicoes', label: plural(chapas, tk('chapa eleitoral para analisar'), tk('chapas eleitorais para analisar')) });
    if (impug) itens.push({ id: 'impugnacoes', count: impug, aba: 'eleicoes', label: plural(impug, tk('impugnação de chapa para julgar'), tk('impugnações de chapa para julgar')) });
  }
  itens.push(...nationalPendingItems(fontes, perms, { hoje }));
  return itens;
}

/**
 * Camada nacional (Bloco 6): o lado da CONFEDERAÇÃO (`confLinks`,
 * `homologations`, `duesReceivable`) e o da ESTADUAL (`myLinks`, `duesOwed`).
 * Cada fonte só chega carregada para quem a lê; ausente, o item some.
 */
export function nationalPendingItems(fontes = {}, perms = [], { hoje = isoDate() } = {}) {
  const itens = [];
  const { confLinks, homologations, duesReceivable, myLinks, duesOwed } = fontes;
  const conta = (lista, fn) => (Array.isArray(lista) ? lista.filter(fn).length : 0);
  if (canManageNetwork(perms)) {
    const pedidos = conta(confLinks, (l) => l.status === LINK_STATUS.PENDING);
    if (pedidos) itens.push({ id: 'rede-pedidos', count: pedidos, aba: 'rede-filiadas', label: plural(pedidos, tk('federação pedindo filiação à confederação'), tk('federações pedindo filiação à confederação')) });
    const convites = conta(myLinks, (l) => l.status === LINK_STATUS.INVITED);
    if (convites) itens.push({ id: 'confederacao-convite', count: convites, aba: 'confederacao', label: plural(convites, tk('convite de confederação para responder'), tk('convites de confederação para responder')) });
  }
  if (canHomologate(perms)) {
    const n = conta(homologations, (x) => x.status === TRANSFER_STATUS.HOMOLOGATION);
    if (n) itens.push({ id: 'rede-homologacoes', count: n, aba: 'rede-homologacoes', label: plural(n, tk('transferência entre estados para homologar'), tk('transferências entre estados para homologar')) });
  }
  if (canManageDues(perms)) {
    const informadas = conta(duesReceivable, (d) => d.status === DUES_STATUS.DECLARED);
    if (informadas) itens.push({ id: 'rede-anuidades', count: informadas, aba: 'rede-anuidades', label: plural(informadas, tk('anuidade de filiada informada para confirmar'), tk('anuidades de filiadas informadas para confirmar')) });
    const devidas = conta(duesOwed, (d) => duesState(d, hoje) === 'overdue');
    if (devidas) itens.push({ id: 'confederacao-anuidades', count: devidas, aba: 'confederacao-anuidades', label: plural(devidas, tk('anuidade da confederação vencida'), tk('anuidades da confederação vencidas')) });
  }
  return itens;
}

/**
 * O que espera a PESSOA filiada (vai para a faixa "Precisa de você" da Minha área).
 * @param {object[]|undefined} members as filiações da pessoa
 * @param {object[]|undefined} charges as cobranças da pessoa
 * @param {{ hoje?: string, invites?: object[], now?: number }} [opts] `invites`: os convites para filiar recebidos
 */
export function myFederationPending(members, charges, { hoje = isoDate(), invites, assignments, finalInvites, directedReports, callupInvites, coachLicenses, now = Date.now() } = {}) {
  const out = { pagar: undefined, vencendo: undefined, vencida: undefined, convites: undefined, escalas: myPendingAssignments(assignments, hoje), finais: undefined, diretor: undefined, convocacoes: undefined, licenca: undefined };
  // Licença de professor (Bloco 4): vence em 30 dias sem pedido de renovação, ou venceu há até 30 dias.
  if (Array.isArray(coachLicenses)) {
    out.licenca = coachLicenses.filter((l) => {
      const s = licenseState(l, hoje);
      return (s.expiring && !s.renewing) || (s.status === 'expired' && String(l.valid_until) >= addDaysISO(hoje, -30));
    }).length;
  }
  // Competições (Bloco 2): convite da final esperando resposta; torneio que a pessoa dirige com checklist ou relatório faltando.
  if (Array.isArray(finalInvites)) out.finais = finalInvites.filter((i) => finalInviteOpen(i, now)).length;
  // Seleção (Bloco 3): convocação esperando resposta (o mesmo prazo do convite da final).
  if (Array.isArray(callupInvites)) out.convocacoes = callupInvites.filter((i) => finalInviteOpen(i, now)).length;
  if (Array.isArray(directedReports)) out.diretor = directedReports.filter((r) => directorStage(r, r, hoje) !== 'done' && !(directorStage(r, r, hoje) === 'checklist' && r.checklist?.complete)).length;
  if (Array.isArray(invites)) out.convites = invites.filter((inv) => isInvitePending(inv, now)).length;
  if (Array.isArray(charges)) out.pagar = charges.filter((c) => c.status === CHARGE_STATUS.OPEN).length;
  if (Array.isArray(members)) {
    const estados = members.map((m) => membershipState(m, hoje));
    out.vencendo = estados.filter((s) => s.expiring).length;
    out.vencida = estados.filter((s) => s.status === MEMBER_STATUS.EXPIRED).length;
  }
  return out;
}
