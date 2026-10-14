/**
 * MERCADO — ganchos do React Query. As chaves vêm de `marketKeys` (fonte
 * única: chave escrita duas vezes diverge e busca de novo o que já estava
 * em cache).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import * as svc from '../services/marketService';
import * as orders from '../services/marketOrderService';

export const marketKeys = {
  all: ['mercado'],
  settings: ['mercado', 'config'],
  feed: ['mercado', 'vitrine'],
  listing: (id) => ['mercado', 'anuncio', id],
  listingsByIds: (ids) => ['mercado', 'anuncios', [...ids].sort().join(',')],
  sellerListings: (key, pub) => ['mercado', 'vendedor', key, 'anuncios', pub ? 'publico' : 'todos'],
  seller: (key) => ['mercado', 'vendedor', key],
  sellerPrivate: (key) => ['mercado', 'vendedor', key, 'privado'],
  stores: ['mercado', 'lojas'],
  questions: (listingId) => ['mercado', 'anuncio', listingId, 'perguntas'],
  sellerQuestions: (key) => ['mercado', 'vendedor', key, 'perguntas'],
  favorites: (uid) => ['mercado', 'favoritos', uid],
  savedSearches: (uid) => ['mercado', 'buscas', uid],
  cart: (uid) => ['mercado', 'carrinho', uid],
  myOrders: (uid) => ['mercado', 'compras', uid],
  sellerOrders: (key) => ['mercado', 'vendedor', key, 'vendas'],
  order: (id) => ['mercado', 'pedido', id],
  orderEvents: (id) => ['mercado', 'pedido', id, 'eventos'],
  orderShipping: (id) => ['mercado', 'pedido', id, 'entrega'],
  orderReviews: (id) => ['mercado', 'pedido', id, 'avaliacoes'],
  dispute: (id) => ['mercado', 'pedido', id, 'disputa'],
  myOffers: (uid) => ['mercado', 'ofertas', uid],
  sellerOffers: (key) => ['mercado', 'vendedor', key, 'ofertas'],
  offer: (id) => ['mercado', 'oferta', id],
  sellerReviews: (key) => ['mercado', 'vendedor', key, 'avaliacoes'],
  admin: ['mercado', 'admin'],
};

/** O Mercado está ligado para quem vê? (a flag do admin) */
export const useMarketEnabled = () => useFeatureFlag(FEATURE_FLAG.MARKETPLACE);

export function useMarketSettings() {
  return useQuery({ queryKey: marketKeys.settings, queryFn: svc.getMarketSettings, staleTime: 5 * 60_000 });
}

export function usePublicListings({ enabled = true } = {}) {
  return useQuery({ queryKey: marketKeys.feed, queryFn: svc.listPublicListings, staleTime: 60_000, enabled });
}

export function useListing(id) {
  return useQuery({ queryKey: marketKeys.listing(id), queryFn: () => svc.getListing(id), enabled: !!id });
}

export function useListingsByIds(ids = []) {
  return useQuery({ queryKey: marketKeys.listingsByIds(ids), queryFn: () => svc.getListings(ids), enabled: ids.length > 0 });
}

export function useSeller(key) {
  return useQuery({ queryKey: marketKeys.seller(key), queryFn: () => svc.getSeller(key), enabled: !!key });
}

export function useSellerPrivate(key, { enabled = true } = {}) {
  return useQuery({ queryKey: marketKeys.sellerPrivate(key), queryFn: () => svc.getSellerPrivate(key), enabled: !!key && enabled });
}

export function useSellerListings(key, { publicOnly = false } = {}) {
  return useQuery({
    queryKey: marketKeys.sellerListings(key, publicOnly),
    queryFn: () => svc.listSellerListings(key, { publicOnly }),
    enabled: !!key,
  });
}

export function useQuestions(listingId) {
  return useQuery({ queryKey: marketKeys.questions(listingId), queryFn: () => svc.listQuestions(listingId), enabled: !!listingId });
}

export function useSellerQuestions(key) {
  return useQuery({ queryKey: marketKeys.sellerQuestions(key), queryFn: () => svc.listSellerQuestions(key), enabled: !!key });
}

export function useFavorites(uid) {
  return useQuery({ queryKey: marketKeys.favorites(uid), queryFn: () => svc.listMyFavorites(uid), enabled: !!uid });
}

export function useToggleFavorite(uid) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, on }) => svc.toggleFavorite(uid, listingId, on),
    // Otimista: o coração muda no toque; volta se a escrita falhar.
    onMutate: async ({ listingId, on }) => {
      const key = marketKeys.favorites(uid);
      await qc.cancelQueries({ queryKey: key });
      const antes = qc.getQueryData(key);
      qc.setQueryData(key, (xs = []) => (on
        ? [...xs.filter((f) => f.listing_id !== listingId), { id: `${uid}_${listingId}`, uid, listing_id: listingId }]
        : xs.filter((f) => f.listing_id !== listingId)));
      return { antes };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(marketKeys.favorites(uid), ctx?.antes),
    onSettled: () => qc.invalidateQueries({ queryKey: marketKeys.favorites(uid) }),
  });
}

export function useSavedSearches(uid) {
  return useQuery({ queryKey: marketKeys.savedSearches(uid), queryFn: () => svc.listSavedSearches(uid), enabled: !!uid });
}

export function useCart(uid) {
  return useQuery({ queryKey: marketKeys.cart(uid), queryFn: () => svc.getCart(uid), enabled: !!uid });
}

/** Grava o carrinho inteiro (otimista: a tela muda na hora). */
export function useSaveCart(uid) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cart) => svc.saveCart(uid, cart),
    onMutate: async (cart) => {
      const key = marketKeys.cart(uid);
      await qc.cancelQueries({ queryKey: key });
      const antes = qc.getQueryData(key);
      qc.setQueryData(key, cart);
      return { antes };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(marketKeys.cart(uid), ctx?.antes),
  });
}

export function useMyOrders(uid) {
  return useQuery({ queryKey: marketKeys.myOrders(uid), queryFn: () => orders.listMyOrders(uid), enabled: !!uid });
}

export function useSellerOrders(key) {
  return useQuery({ queryKey: marketKeys.sellerOrders(key), queryFn: () => orders.listSellerOrders(key), enabled: !!key });
}

export function useOrder(id) {
  return useQuery({ queryKey: marketKeys.order(id), queryFn: () => orders.getOrder(id), enabled: !!id });
}

export function useOrderEvents(id) {
  return useQuery({ queryKey: marketKeys.orderEvents(id), queryFn: () => orders.listOrderEvents(id), enabled: !!id });
}

export function useOrderShipping(id, { enabled = true } = {}) {
  return useQuery({ queryKey: marketKeys.orderShipping(id), queryFn: () => orders.getOrderShipping(id), enabled: !!id && enabled });
}

export function useOrderReviews(id, { enabled = true } = {}) {
  return useQuery({ queryKey: marketKeys.orderReviews(id), queryFn: () => orders.getOrderReviews(id), enabled: !!id && enabled });
}

export function useDispute(id, { enabled = true } = {}) {
  return useQuery({ queryKey: marketKeys.dispute(id), queryFn: () => orders.getDispute(id), enabled: !!id && enabled });
}

export function useMyOffers(uid) {
  return useQuery({ queryKey: marketKeys.myOffers(uid), queryFn: () => orders.listMyOffers(uid), enabled: !!uid });
}

export function useSellerOffers(key) {
  return useQuery({ queryKey: marketKeys.sellerOffers(key), queryFn: () => orders.listSellerOffers(key), enabled: !!key });
}

export function useOffer(id) {
  return useQuery({ queryKey: marketKeys.offer(id), queryFn: () => orders.getOffer(id), enabled: !!id });
}

export function useSellerReviews(key) {
  return useQuery({ queryKey: marketKeys.sellerReviews(key), queryFn: () => orders.listSellerReviews(key), enabled: !!key });
}

/**
 * Uma mutação do Mercado que, ao terminar, refaz tudo do Mercado em cache
 * (pedido mexe em estoque, oferta vira pedido, avaliação muda a nota…).
 * ponytail: invalida o Mercado inteiro; afinar por chave se pesar.
 */
export function useMarketMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: marketKeys.all }) });
}
