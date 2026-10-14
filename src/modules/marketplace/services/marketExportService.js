/**
 * O que a exportação de dados (LGPD) leva do MERCADO. Cada parte falha
 * SOZINHA e vai para `incomplete` — nunca um arquivo "completo" com buraco.
 * O vendedor pessoal (atleta, professor, loja) leva a ficha, o Pix, os
 * anúncios e as vendas; o que é da ARENA fica com a arena.
 */
import {
  getCart, getSeller, getSellerPrivate, listMyFavorites, listMyGiftCards, listMyQuestions, listSavedSearches, listSellerCoupons, listSellerListings,
} from './marketService.js';
import { listMyOffers, listMyOrders, listMyReviews, listSellerOrders } from './marketOrderService.js';
import { listMyMarketUploads } from './marketMediaService.js';

const chavesPessoais = (uid) => ['athlete', 'coach', 'store'].map((t) => `${t}_${uid}`);

async function comoVendedor(uid) {
  const fichas = (await Promise.all(chavesPessoais(uid).map(getSeller))).filter(Boolean);
  return Promise.all(fichas.map(async (s) => ({
    seller: s,
    payment: await getSellerPrivate(s.id),
    listings: await listSellerListings(s.id),
    sales: await listSellerOrders(s.id),
    coupons: await listSellerCoupons(s.id),
  })));
}

/** @returns {Promise<{ market: object, incomplete: string[] }>} */
export async function collectMarketExport(uid) {
  const partes = [
    ['orders', 'Compras no Mercado', () => listMyOrders(uid)],
    ['offers', 'Ofertas no Mercado', () => listMyOffers(uid)],
    ['questions', 'Perguntas no Mercado', () => listMyQuestions(uid)],
    ['reviews', 'Avaliações no Mercado', () => listMyReviews(uid)],
    ['favorites', 'Favoritos do Mercado', () => listMyFavorites(uid)],
    ['saved_searches', 'Buscas salvas do Mercado', () => listSavedSearches(uid)],
    ['cart', 'Carrinho do Mercado', () => getCart(uid)],
    ['gift_cards', 'Vales-presente do Mercado', () => listMyGiftCards(uid)],
    ['selling', 'Vendas no Mercado', () => comoVendedor(uid)],
    ['media_paths', 'Lista de fotos e arquivos do Mercado', () => listMyMarketUploads(uid)],
  ];
  const lidas = await Promise.allSettled(partes.map(([, , ler]) => ler()));
  const market = {};
  const incomplete = [];
  partes.forEach(([chave, rotulo], i) => {
    if (lidas[i].status === 'fulfilled') market[chave] = lidas[i].value;
    else incomplete.push(rotulo);
  });
  return { market, incomplete };
}
