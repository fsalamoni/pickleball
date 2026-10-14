/**
 * MERCADO — o pedido: estados, quem pode fazer o quê e os totais (lógica pura).
 *
 * ⚠️ Há uma CÓPIA desta tabela no servidor (`functions/marketplace.js`), que é
 * quem de fato aplica as ações (a regra do Firestore não deixa o navegador
 * escrever pedido). `functions/marketplace.parity.test.js` roda as duas e
 * exige o mesmo resultado — mexer num lado só quebra o teste, de propósito.
 *
 * Caminho feliz: placed → accepted → payment_review → paid → shipped|ready →
 * delivered → completed. O estoque sai na criação do pedido e volta se ele for
 * cancelado ou expirar.
 */
import { ORDER_STATUS as S } from './constants.js';
import { t, tk } from '@/core/i18n';

/** Ações: de onde saem, para onde vão, e quem pode. */
export const ORDER_ACTIONS = Object.freeze({
  accept: { from: [S.PLACED], to: S.ACCEPTED, roles: ['seller'], label: tk('Aceitar pedido'), tone: 'primary' },
  decline: { from: [S.PLACED], to: S.CANCELLED, roles: ['seller'], label: tk('Recusar'), tone: 'danger', needsReason: true },
  send_proof: { from: [S.ACCEPTED], to: S.PAYMENT_REVIEW, roles: ['buyer'], label: tk('Já paguei'), tone: 'primary' },
  confirm_payment: { from: [S.ACCEPTED, S.PAYMENT_REVIEW], to: S.PAID, roles: ['seller'], label: tk('Recebi o pagamento'), tone: 'primary' },
  reject_payment: { from: [S.PAYMENT_REVIEW], to: S.ACCEPTED, roles: ['seller'], label: tk('Não recebi'), tone: 'danger', needsReason: true },
  ship: { from: [S.PAID], to: S.SHIPPED, roles: ['seller'], label: tk('Marcar como enviado'), tone: 'primary', fulfillment: ['shipping'] },
  ready: { from: [S.PAID], to: S.READY, roles: ['seller'], label: tk('Pronto para entregar'), tone: 'primary', fulfillment: ['pickup', 'meetup'] },
  delivered: { from: [S.SHIPPED, S.READY], to: S.DELIVERED, roles: ['seller'], label: tk('Entreguei'), tone: 'secondary' },
  confirm_received: { from: [S.SHIPPED, S.READY, S.DELIVERED], to: S.COMPLETED, roles: ['buyer'], label: tk('Recebi o produto'), tone: 'primary' },
  cancel: { from: [S.PLACED, S.ACCEPTED], to: S.CANCELLED, roles: ['buyer'], label: tk('Cancelar pedido'), tone: 'danger', needsReason: true },
  seller_cancel: { from: [S.ACCEPTED, S.PAYMENT_REVIEW], to: S.CANCELLED, roles: ['seller'], label: tk('Cancelar pedido'), tone: 'danger', needsReason: true },
  open_dispute: { from: [S.PAYMENT_REVIEW, S.PAID, S.SHIPPED, S.READY, S.DELIVERED], to: S.DISPUTED, roles: ['buyer'], label: tk('Tive um problema'), tone: 'danger', needsReason: true },
  resolve_buyer: { from: [S.DISPUTED], to: S.CANCELLED, roles: ['admin'], label: tk('Dar razão ao comprador'), tone: 'danger', needsReason: true },
  resolve_seller: { from: [S.DISPUTED], to: S.COMPLETED, roles: ['admin'], label: tk('Dar razão ao vendedor'), tone: 'primary', needsReason: true },
  admin_cancel: { from: [S.PLACED, S.ACCEPTED, S.PAYMENT_REVIEW, S.PAID, S.SHIPPED, S.READY, S.DELIVERED], to: S.CANCELLED, roles: ['admin'], label: tk('Cancelar (admin)'), tone: 'danger', needsReason: true },
  expire: { from: [S.PLACED, S.ACCEPTED], to: S.EXPIRED, roles: ['system'], label: tk('Expirar') },
  auto_complete: { from: [S.SHIPPED, S.READY, S.DELIVERED], to: S.COMPLETED, roles: ['system'], label: tk('Concluir') },
});

/** Prazos (horas/dias) — o admin pode mudar na configuração do Mercado. */
export const ORDER_DEADLINES = Object.freeze({
  sellerAnswerHours: 72,
  paymentHours: 48,
  autoCompleteDays: 7,
  disputeWindowDays: 7,
});

/** Estados em que o estoque volta ao anúncio. */
export const RESTOCK_ON = Object.freeze([S.CANCELLED, S.EXPIRED]);

/**
 * A ação pode ser aplicada? Devolve o motivo quando não pode.
 * @returns {{ ok: boolean, to?: string, error?: string }}
 */
export function checkOrderAction(order, action, role) {
  const a = ORDER_ACTIONS[action];
  if (!a) return { ok: false, error: t('Ação desconhecida.') };
  if (!order) return { ok: false, error: t('Pedido não encontrado.') };
  if (!a.roles.includes(role)) return { ok: false, error: t('Você não pode fazer isso neste pedido.') };
  if (!a.from.includes(order.status)) return { ok: false, error: t('O pedido já mudou de estado. Atualize a página.') };
  if (a.fulfillment && !a.fulfillment.includes(order.fulfillment)) {
    return { ok: false, error: t('Esta ação não vale para a entrega escolhida.') };
  }
  return { ok: true, to: a.to };
}

/** O papel de quem vê o pedido. */
export function orderRoleOf(order, uid, { managerUids = [], isAdmin = false } = {}) {
  if (!order || !uid) return null;
  if (order.buyer_uid === uid) return 'buyer';
  if (order.seller_uid === uid || (order.seller_manager_uids || []).includes(uid) || managerUids.includes(uid)) return 'seller';
  if (isAdmin) return 'admin';
  return null;
}

/**
 * Botões que aparecem para quem vê o pedido — só os que a pessoa PODE fazer
 * (ação sem permissão não é renderizada).
 */
export function nextActionsFor(order, role, { now = Date.now(), disputeWindowDays } = {}) {
  const janela = Number(disputeWindowDays) || ORDER_DEADLINES.disputeWindowDays;
  if (!order || !role) return [];
  return Object.entries(ORDER_ACTIONS)
    .filter(([id]) => checkOrderAction(order, id, role).ok)
    .filter(([id]) => {
      if (id !== 'open_dispute') return true;
      // A mesma data que o servidor usa (`open_dispute` em functions/marketplace.js).
      // Pago e nunca enviado (ou pagamento sem conferência): o prazo não corre.
      const since = [S.PAID, S.PAYMENT_REVIEW].includes(order.status) ? 0
        : Number(order.delivered_at_ms || order.shipped_at_ms || order.ready_at_ms || 0);
      return !since || now - since <= janela * 86400000;
    })
    .map(([id, a]) => ({ id, label: t(a.label), tone: a.tone || 'secondary', needsReason: Boolean(a.needsReason) }));
}

/** O que o pedido espera, dito para cada lado ("Aguardando você pagar"). */
export function orderWaitingOn(order, role) {
  const st = order?.status;
  if (role === 'admin') return st === 'disputed' ? t('Leia o relato e o histórico e decida a favor de um dos lados.') : '';
  const me = role === 'buyer' ? 'buyer' : 'seller';
  const map = {
    placed: { seller: t('Aceite ou recuse o pedido.'), buyer: t('Esperando o vendedor aceitar.') },
    accepted: { buyer: t('Pague pelo Pix e avise.'), seller: t('Esperando o pagamento do comprador.') },
    payment_review: { seller: t('Confira se o Pix chegou.'), buyer: t('O vendedor está conferindo o pagamento.') },
    paid: order?.fulfillment === 'digital' ? { seller: t('Pago.'), buyer: t('Pago.') } : { seller: order?.fulfillment === 'shipping' ? t('Envie e informe o rastreio.') : t('Combine a entrega e marque como pronto.'), buyer: t('O vendedor está preparando o pedido.') },
    shipped: { buyer: t('Confirme quando receber.'), seller: t('Esperando o comprador confirmar o recebimento.') },
    ready: { buyer: t('Retire o produto e confirme o recebimento.'), seller: t('Entregue o produto ao comprador.') },
    delivered: order?.fulfillment === 'digital'
      ? { buyer: t('O vale-presente está em Mercado → Vales. Dê o código a quem vai ganhar.'), seller: t('O vale foi entregue na conta do comprador.') }
      : { buyer: t('Confirme o recebimento.'), seller: t('Esperando o comprador confirmar.') },
    disputed: { buyer: t('A moderação está analisando.'), seller: t('A moderação está analisando.') },
  };
  return map[st]?.[me] || '';
}

/** Totais do pedido (centavos). Taxa da plataforma na Fase 1 é 0. */
export function computeOrderTotals(items = [], { shippingCents = 0, feePercent = 0 } = {}) {
  const subtotal = items.reduce((n, i) => n + Math.round(i.unit_price_cents) * Math.max(1, Math.floor(i.quantity)), 0);
  const shipping = Math.max(0, Math.round(shippingCents || 0));
  const total = subtotal + shipping;
  const fee = Math.round((subtotal * Math.max(0, feePercent)) / 100);
  return {
    subtotal_cents: subtotal,
    shipping_cents: shipping,
    total_cents: total,
    platform_fee_cents: fee,
    seller_net_cents: total - fee,
  };
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código legível do pedido ("MC-7K2QF"), para falar no chat. */
export function orderCode(random = Math.random) {
  let s = '';
  for (let i = 0; i < 5; i += 1) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `MC-${s}`;
}

/** Passos do pedido para a linha do tempo da tela, com o atual marcado. */
export function orderTimeline(order) {
  const shipping = order?.fulfillment === 'shipping';
  if (order?.fulfillment === 'digital') {
    const st = [{ id: 'accepted', label: t('Pedido feito') }, { id: 'paid', label: t('Pago') }, { id: 'delivered', label: t('Vale entregue') }];
    const r = { accepted: 0, payment_review: 0, paid: 1, delivered: 2, completed: 2, disputed: 1 }[order.status];
    return st.map((s, i) => ({ ...s, done: r != null && i <= r, current: i === r }));
  }
  const steps = [
    { id: 'placed', label: t('Pedido feito') },
    { id: 'accepted', label: t('Aceito') },
    { id: 'paid', label: t('Pago') },
    { id: shipping ? 'shipped' : 'ready', label: shipping ? t('Enviado') : t('Pronto') },
    { id: 'completed', label: t('Recebido') },
  ];
  const rank = {
    placed: 0, accepted: 1, payment_review: 1, paid: 2, shipped: 3, ready: 3, delivered: 3, completed: 4, disputed: 2,
  };
  const at = rank[order?.status];
  return steps.map((s, i) => ({ ...s, done: at != null && i <= at, current: i === at }));
}
