import { describe, it, expect } from 'vitest';
import {
  addToCart, setCartQuantity, removeFromCart, saveForLater, moveToCart, cartCount, groupCartBySeller, checkLine, cartOnlyListing,
} from './cart.js';

const a = { id: 'a', seller_key: 'store_1', seller_name: 'Loja', title: 'Raquete', price_cents: 50000, quantity: 2, status: 'active', fulfillment: ['shipping', 'meetup'], media: [{ url: 'https://a' }] };
const b = { id: 'b', seller_key: 'store_1', seller_name: 'Loja', title: 'Bolas', price_cents: 3000, quantity: 10, status: 'active', fulfillment: ['shipping'] };
const c = { id: 'c', seller_key: 'arena_9', seller_name: 'Arena', title: 'Camiseta', price_cents: 7000, quantity: 1, status: 'active', fulfillment: ['pickup'] };

describe('carrinho', () => {
  it('"comprar agora" leva só o item ao fechamento, sem mexer no carrinho', () => {
    let cart = addToCart({}, a).cart;
    cart = addToCart(cart, c).cart;
    cart = addToCart(cart, b, 2).cart;
    const so = cartOnlyListing(cart, 'b');
    expect(so.items.map((i) => i.listing_id)).toEqual(['b']);
    expect(so.saved).toEqual([]);
    expect(groupCartBySeller(so, { a, b, c }).groups).toHaveLength(1);
    expect(cart.items).toHaveLength(3);
    expect(cartOnlyListing(cart, 'zzz')).toEqual(cart);
  });
  it('soma sem passar do estoque', () => {
    let cart = addToCart({}, a, 1).cart;
    cart = addToCart(cart, a, 5).cart;
    expect(cart.items[0].quantity).toBe(2);
    expect(cartCount(cart)).toBe(2);
  });
  it('quantidade, remover, salvar para depois e voltar', () => {
    let cart = addToCart(addToCart({}, a).cart, b).cart;
    cart = setCartQuantity(cart, 'b', 4);
    expect(cart.items.find((i) => i.listing_id === 'b').quantity).toBe(4);
    cart = saveForLater(cart, 'a');
    expect(cart.items.map((i) => i.listing_id)).toEqual(['b']);
    expect(cart.saved.map((i) => i.listing_id)).toEqual(['a']);
    cart = moveToCart(cart, 'a');
    expect(cart.saved).toEqual([]);
    expect(setCartQuantity(cart, 'a', 0).items.map((i) => i.listing_id)).toEqual(['b']);
    expect(removeFromCart(cart, 'b').items.map((i) => i.listing_id)).toEqual(['a']);
  });
  it('agrupa por vendedor com subtotal e entregas em comum', () => {
    let cart = addToCart({}, a).cart;
    cart = addToCart(cart, c).cart;
    cart = addToCart(cart, b, 2).cart;
    const g = groupCartBySeller(cart, { a, b, c });
    expect(g.sellers).toBe(2);
    expect(g.groups[0].seller_key).toBe('store_1');
    expect(g.groups[0].subtotal_cents).toBe(56000);
    expect(g.groups[0].fulfillment).toEqual(['shipping']);
    expect(g.total_cents).toBe(63000);
  });
  it('linha confere com o anúncio atual', () => {
    const line = { listing_id: 'a', quantity: 3, price_cents_at_add: 60000 };
    const r = checkLine(line, a);
    expect(r.ok).toBe(false);
    expect(r.problem).toMatch(/Só há 2/);
    expect(r.problem).toMatch(/baixou/);
    expect(checkLine(line, null).problem).toMatch(/Não está mais/);
    expect(checkLine(line, { ...a, status: 'paused' }).ok).toBe(false);
    expect(checkLine(line, undefined).unknown).toBe(true);
    expect(checkLine(line, undefined).ok).toBe(false);
  });
  it('🐞 nunca passa de 99 unidades (o servidor recusa acima)', () => {
    const muito = { ...b, id: 'm', quantity: 500 };
    let cart = addToCart({}, muito, 300).cart;
    expect(cart.items[0].quantity).toBe(99);
    cart = setCartQuantity(cart, 'm', 400);
    expect(cart.items[0].quantity).toBe(99);
  });
});
