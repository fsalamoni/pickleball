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

const plural = (n, um, varios) => (n === 1 ? um : varios);

/**
 * @param {{ members?: object[], charges?: object[], affiliations?: object[], tournaments?: object[], transfers?: object[], documents?: object[], sanctions?: object[], reports?: object[] }} fontes
 * @param {string[]} perms permissões de quem vê (só vê o que pode resolver)
 * @param {{ hoje?: string }} quando
 * @returns {Array<{ id: string, count: number, label: string, aba: string, filtro?: string }>} — `filtro` abre a lista da aba já filtrada (`?filtro=`)
 */
export function federationPendingItems(fontes = {}, perms = [], { hoje = isoDate() } = {}) {
  const itens = [];
  const { members, charges, affiliations, tournaments, transfers, documents, sanctions, reports } = fontes;
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
    const n = reports.filter((x) => x.status === REPORT_STATUS.OPEN).length;
    if (n) itens.push({ id: 'ouvidoria', count: n, aba: 'ouvidoria', filtro: 'abertas', label: plural(n, tk('manifestação na ouvidoria sem resposta'), tk('manifestações na ouvidoria sem resposta')) });
  }
  if (pode(FED_PERMISSION.COMPETITIONS) && Array.isArray(tournaments)) {
    const n = tournaments.filter((tt) => sanctionState(tt).pending).length;
    if (n) itens.push({ id: 'chancelas', count: n, aba: 'chancelas', filtro: 'pendentes', label: plural(n, tk('pedido de chancela para analisar'), tk('pedidos de chancela para analisar')) });
  }
  if (pode(FED_PERMISSION.FINANCE) && Array.isArray(charges)) {
    const n = charges.filter((c) => c.status === CHARGE_STATUS.DECLARED).length;
    if (n) itens.push({ id: 'informados', count: n, aba: 'cobrancas', filtro: 'informadas', label: plural(n, tk('pagamento informado para confirmar'), tk('pagamentos informados para confirmar')) });
    const atras = charges.filter((c) => isChargeOverdue(c, hoje)).length;
    if (atras) itens.push({ id: 'atrasadas', count: atras, aba: 'cobrancas', filtro: 'vencidas', label: plural(atras, tk('cobrança vencida sem pagamento'), tk('cobranças vencidas sem pagamento')) });
  }
  return itens;
}

/**
 * O que espera a PESSOA filiada (vai para a faixa "Precisa de você" da Minha área).
 * @param {object[]|undefined} members as filiações da pessoa
 * @param {object[]|undefined} charges as cobranças da pessoa
 * @param {{ hoje?: string, invites?: object[], now?: number }} [opts] `invites`: os convites para filiar recebidos
 */
export function myFederationPending(members, charges, { hoje = isoDate(), invites, now = Date.now() } = {}) {
  const out = { pagar: undefined, vencendo: undefined, vencida: undefined, convites: undefined };
  if (Array.isArray(invites)) out.convites = invites.filter((inv) => isInvitePending(inv, now)).length;
  if (Array.isArray(charges)) out.pagar = charges.filter((c) => c.status === CHARGE_STATUS.OPEN).length;
  if (Array.isArray(members)) {
    const estados = members.map((m) => membershipState(m, hoje));
    out.vencendo = estados.filter((s) => s.expiring).length;
    out.vencida = estados.filter((s) => s.status === MEMBER_STATUS.EXPIRED).length;
  }
  return out;
}
