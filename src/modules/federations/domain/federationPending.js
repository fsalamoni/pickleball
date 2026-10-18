/**
 * "Precisa de você" — o que espera a EQUIPE da federação (lógica pura).
 * Fonte `undefined` = não carregou ou falhou: o item não entra, nunca vira 0
 * (`docs/27-FALHA-NAO-E-VAZIO.md`). As contas são as MESMAS das abas.
 */
import { tk } from '@/core/i18n';
import { CHARGE_STATUS, FED_PERMISSION, MEMBER_STATUS } from './constants.js';
import { isChargeOverdue } from './charges.js';
import { isoDate, membershipState } from './membership.js';

const plural = (n, um, varios) => (n === 1 ? um : varios);

/**
 * @param {{ members?: object[], charges?: object[] }} fontes
 * @param {string[]} perms permissões de quem vê (só vê o que pode resolver)
 * @param {{ hoje?: string }} quando
 * @returns {Array<{ id: string, count: number, label: string, aba: string }>}
 */
export function federationPendingItems(fontes = {}, perms = [], { hoje = isoDate() } = {}) {
  const itens = [];
  const { members, charges } = fontes;
  const pode = (p) => perms.includes(p);

  if (pode(FED_PERMISSION.MEMBERS) && Array.isArray(members)) {
    const n = members.filter((m) => m.status === MEMBER_STATUS.PENDING).length;
    if (n) itens.push({ id: 'pedidos', count: n, aba: 'pedidos', label: plural(n, tk('pedido de filiação para analisar'), tk('pedidos de filiação para analisar')) });
    const venc = members.filter((m) => membershipState(m, hoje).expiring).length;
    if (venc) itens.push({ id: 'vencendo', count: venc, aba: 'filiados', label: plural(venc, tk('filiação vence em 30 dias'), tk('filiações vencem em 30 dias')) });
  }
  if (pode(FED_PERMISSION.FINANCE) && Array.isArray(charges)) {
    const n = charges.filter((c) => c.status === CHARGE_STATUS.DECLARED).length;
    if (n) itens.push({ id: 'informados', count: n, aba: 'cobrancas', label: plural(n, tk('pagamento informado para confirmar'), tk('pagamentos informados para confirmar')) });
    const atras = charges.filter((c) => isChargeOverdue(c, hoje)).length;
    if (atras) itens.push({ id: 'atrasadas', count: atras, aba: 'cobrancas', label: plural(atras, tk('cobrança vencida sem pagamento'), tk('cobranças vencidas sem pagamento')) });
  }
  return itens;
}

/**
 * O que espera a PESSOA filiada (vai para a faixa "Precisa de você" da Minha área).
 * @param {object[]|undefined} members as filiações da pessoa
 * @param {object[]|undefined} charges as cobranças da pessoa
 */
export function myFederationPending(members, charges, { hoje = isoDate() } = {}) {
  const out = { pagar: undefined, vencendo: undefined, vencida: undefined };
  if (Array.isArray(charges)) out.pagar = charges.filter((c) => c.status === CHARGE_STATUS.OPEN).length;
  if (Array.isArray(members)) {
    const estados = members.map((m) => membershipState(m, hoje));
    out.vencendo = estados.filter((s) => s.expiring).length;
    out.vencida = estados.filter((s) => s.status === MEMBER_STATUS.EXPIRED).length;
  }
  return out;
}
