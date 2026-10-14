import { describe, it, expect } from 'vitest';
import { draftFromArenaProduct, draftFromCoachProduct } from './internalProducts';

describe('rascunho a partir dos mercados internos', () => {
  it('professor: nome, descrição, preço em reais e categoria quando dá para mapear', () => {
    expect(draftFromCoachProduct({ name: 'Camiseta do time', description: 'Dry fit', price: 79.9, category: 'vestuario' }))
      .toMatchObject({ title: 'Camiseta do time', description: 'Dry fit', price: '79,90', category_slug: 'vestuario', quantity: '1' });
    expect(draftFromCoachProduct({ name: 'Raquete', price: 0, category: 'equipamentos' }))
      .toMatchObject({ price: '', category_slug: '' });
  });

  it('arena: quantidade do estoque, retirada na arena e a marca no título', () => {
    const d = draftFromArenaProduct({ name: 'Bola X-40', brand: 'Franklin', sale_price: 25, category: 'Bola', stock_qty: 12 });
    expect(d).toMatchObject({ title: 'Bola X-40 Franklin', price: '25,00', category_slug: 'bolas', quantity: '12', fulfillment: ['pickup'] });
    expect(draftFromArenaProduct({ name: 'Água', category: 'Bebida', stock_qty: null }).quantity).toBe('1');
    expect(draftFromArenaProduct({ name: 'Água', category: 'Bebida', stock_qty: -2 }).quantity).toBe('0');
  });
});
