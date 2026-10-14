/**
 * MERCADO — enums, rótulos e nomes de coleção (lógica pura).
 *
 * O Mercado é o marketplace próprio da plataforma (flag `marketplace`). Não é
 * o "Mercado da arena" (`arena_*`, `catalog_products`): aqui tudo usa o
 * prefixo `market_`. Os valores dos enums são gravados no banco — nunca
 * renomeie um valor, só acrescente.
 */

export const MARKET_COLLECTIONS = Object.freeze({
  sellers: 'market_sellers',
  listings: 'market_listings',
  questions: 'market_questions',
  favorites: 'market_favorites',
  savedSearches: 'market_saved_searches',
  carts: 'market_carts',
  offers: 'market_offers',
  orders: 'market_orders',
  reviews: 'market_reviews',
  disputes: 'market_disputes',
  reports: 'market_reports',
  coupons: 'market_coupons',
  giftCards: 'market_gift_cards',
});

/** Documento de configuração do admin (em `platform_settings`). */
export const MARKET_SETTINGS_DOC = 'marketplace';

/** Quem vende. */
export const SELLER_TYPE = Object.freeze({
  ATHLETE: 'athlete',
  COACH: 'coach',
  ARENA: 'arena',
  STORE: 'store',
});

export const SELLER_TYPE_LABELS = Object.freeze({
  athlete: 'Atleta',
  coach: 'Professor',
  arena: 'Arena',
  store: 'Loja',
});

/** Estado do vendedor. Loja nasce `pending` até o admin aprovar. */
export const SELLER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
});

export const SELLER_STATUS_LABELS = Object.freeze({
  active: 'Ativo',
  pending: 'Em análise',
  rejected: 'Recusado',
  suspended: 'Suspenso',
});

/** O que é o anúncio. */
export const LISTING_TYPE = Object.freeze({
  NEW: 'product_new',
  USED: 'product_used',
});

/** Estado do anúncio. `removed` é da moderação: só o admin desfaz. */
export const LISTING_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  SOLD_OUT: 'sold_out',
  CLOSED: 'closed',
  REMOVED: 'removed',
});

export const LISTING_STATUS_LABELS = Object.freeze({
  draft: 'Rascunho',
  active: 'No ar',
  paused: 'Pausado',
  sold_out: 'Esgotado',
  closed: 'Encerrado',
  removed: 'Removido pela moderação',
});

/** Estados que o comprador vê na vitrine (o resto é só do vendedor). */
export const PUBLIC_LISTING_STATUSES = Object.freeze(['active', 'sold_out']);

/** Conservação. Produto novo é sempre `new`. */
export const CONDITION = Object.freeze({
  NEW: 'new',
  LIKE_NEW: 'like_new',
  GOOD: 'good',
  FAIR: 'fair',
});

export const CONDITION_LABELS = Object.freeze({
  new: 'Novo',
  like_new: 'Usado, como novo',
  good: 'Usado, bom estado',
  fair: 'Usado, com marcas de uso',
});

/** Como o produto chega a quem compra. */
export const FULFILLMENT = Object.freeze({
  PICKUP: 'pickup',
  MEETUP: 'meetup',
  SHIPPING: 'shipping',
});

export const FULFILLMENT_LABELS = Object.freeze({
  pickup: 'Retirar no local',
  meetup: 'Entrega combinada',
  shipping: 'Envio',
  // Só no pedido de vale-presente: não há nada a entregar.
  digital: 'Vale-presente (sem entrega)',
});

export const ORDER_STATUS = Object.freeze({
  PLACED: 'placed',
  ACCEPTED: 'accepted',
  PAYMENT_REVIEW: 'payment_review',
  PAID: 'paid',
  SHIPPED: 'shipped',
  READY: 'ready',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  DISPUTED: 'disputed',
});

export const ORDER_STATUS_LABELS = Object.freeze({
  placed: 'Aguardando o vendedor',
  accepted: 'Aguardando pagamento',
  payment_review: 'Pagamento em conferência',
  paid: 'Pago',
  shipped: 'Enviado',
  ready: 'Pronto para retirar',
  delivered: 'Entregue',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  disputed: 'Em disputa',
});

/** Pedido terminado: nada mais acontece com ele. */
export const ORDER_FINAL_STATUSES = Object.freeze(['completed', 'cancelled', 'expired']);

export const OFFER_STATUS = Object.freeze({
  PENDING: 'pending',
  COUNTERED: 'countered',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
  ORDERED: 'ordered',
});

export const OFFER_STATUS_LABELS = Object.freeze({
  pending: 'Esperando o vendedor',
  countered: 'Contraproposta do vendedor',
  accepted: 'Aceita',
  declined: 'Recusada',
  withdrawn: 'Retirada',
  expired: 'Expirada',
  ordered: 'Virou pedido',
});

export const DISPUTE_REASON = Object.freeze({
  NOT_RECEIVED: 'not_received',
  NOT_AS_DESCRIBED: 'not_as_described',
  DAMAGED: 'damaged',
  OTHER: 'other',
});

export const DISPUTE_REASON_LABELS = Object.freeze({
  not_received: 'Não recebi o produto',
  not_as_described: 'Diferente do anunciado',
  damaged: 'Chegou danificado',
  other: 'Outro motivo',
});

/** Por que alguém denuncia um anúncio (o valor é gravado: nunca renomeie). */
export const REPORT_REASON_LABELS = Object.freeze({
  fake: 'Produto falsificado ou réplica',
  prohibited: 'Item proibido no Mercado',
  misleading: 'Anúncio enganoso (foto, preço ou descrição)',
  scam: 'Parece golpe (pede pagamento por fora, contato fora do app)',
  offensive: 'Conteúdo ofensivo',
  other: 'Outro motivo',
});

export const DISPUTE_STATUS = Object.freeze({
  OPEN: 'open',
  RESOLVED_BUYER: 'resolved_buyer',
  RESOLVED_SELLER: 'resolved_seller',
});

/** Limites de mídia (iguais aos do Centro de Treino). */
export const MEDIA_LIMITS = Object.freeze({
  maxPhotos: 10,
  maxVideoSeconds: 60,
  maxVideoBytes: 60 * 1024 * 1024,
  maxImageBytes: 3 * 1024 * 1024,
  imageMaxSide: 1600,
  thumbMaxSide: 400,
});

/** Limites de texto. */
export const TEXT_LIMITS = Object.freeze({
  title: 90,
  description: 4000,
  question: 500,
  answer: 1000,
  review: 1000,
});
