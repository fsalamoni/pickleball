import { describe, it, expect } from 'vitest';
import {
  SHOP_CATALOG, isSoldOnline, shopProducts, shopHasStock, priceCartFromCatalog, exitsForSale,
  stockDriftFixes, counterSummary, myShopStatus, salesOutsideMercado, trackedStock,
  quantitiesByProduct, saleTotalMismatch, saleShares, isSaleFullyPaid, saleDateISO, saleTimeHHMM,
  myOrderView, saleWhenLabel, appOrdersSummary,
} from './shop.js';

const agua = { id: 'agua', name: 'Água', category: 'Bebida', sale_price: 5, sell_online: true, stock_qty: 10 };
const grip = { id: 'grip', name: 'Grip', category: 'Acessórios', sale_price: 25, sell_online: true };
const bola = { id: 'bola', name: 'Bola', sale_price: 30, sell_online: false };

describe('isSoldOnline / shopProducts — a vitrine sai do Mercado', () => {
  it('⭐ só entra o que está marcado para o app, ativo e com preço', () => {
    expect(isSoldOnline(agua)).toBe(true);
    expect(isSoldOnline(bola)).toBe(false);
    expect(isSoldOnline({ ...agua, active: false })).toBe(false);
    expect(isSoldOnline({ ...agua, sale_price: 0 })).toBe(false);
    expect(isSoldOnline({ ...agua, sale_price: undefined })).toBe(false);
  });

  it('monta a vitrine em ordem alfabética, com o preço de venda do Mercado', () => {
    const v = shopProducts([grip, bola, agua]);
    expect(v.map((p) => p.id)).toEqual(['agua', 'grip']);
    expect(v[0].price).toBe(5);
    expect(v[0].stock).toBe(10);
  });

  it('estoque ainda sem cópia vira null — não aparece como esgotado', () => {
    expect(shopProducts([grip])[0].stock).toBeNull();
    expect(shopHasStock({ stock: null }, 99)).toBe(true);
  });

  it('🐞 estoque gravado como VAZIO (null) não vira zero — Number(null) é 0', () => {
    expect(shopProducts([{ ...grip, stock_qty: null }])[0].stock).toBeNull();
    expect(shopHasStock({ stock_qty: null }, 5)).toBe(true);
  });

  it('shopHasStock compara com a quantidade pedida', () => {
    expect(shopHasStock({ stock: 2 }, 2)).toBe(true);
    expect(shopHasStock({ stock: 2 }, 3)).toBe(false);
    expect(shopHasStock({ stock_qty: 0 }, 1)).toBe(false);
  });

  it('o detalhe junta marca, tamanho, sabor e embalagem', () => {
    const [p] = shopProducts([{ ...agua, brand: 'Crystal', size: '500 ml', packaging: 'garrafa' }]);
    expect(p.detail).toBe('Crystal · 500 ml · garrafa');
  });
});

describe('priceCartFromCatalog — o preço é o do BANCO', () => {
  const porId = new Map([[agua.id, agua], [grip.id, grip], [bola.id, bola]]);

  it('⭐ ignora o preço que veio da tela', () => {
    const r = priceCartFromCatalog([{ product_id: 'agua', quantity: 2, price: 0.01 }], porId);
    expect(r.ok).toBe(true);
    expect(r.items).toEqual([{ product_id: 'agua', name: 'Água', price: 5, quantity: 2 }]);
    expect(r.total).toBe(10);
  });

  it('⭐ produto que saiu de venda recusa o carrinho', () => {
    const r = priceCartFromCatalog([{ product_id: 'bola', quantity: 1 }], porId);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/saiu de venda/);
  });

  it('estoque insuficiente recusa, dizendo qual', () => {
    const r = priceCartFromCatalog([{ product_id: 'agua', quantity: 11 }], porId);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Estoque insuficiente de Água.');
  });

  it('carrinho vazio e quantidade inválida recusam', () => {
    expect(priceCartFromCatalog([], porId).ok).toBe(false);
    expect(priceCartFromCatalog([{ product_id: 'agua', quantity: 0 }], porId).ok).toBe(false);
  });

  it('soma em centavos, sem erro de ponto flutuante', () => {
    const m = new Map([['x', { id: 'x', name: 'X', sale_price: 0.1, sell_online: true }]]);
    expect(priceCartFromCatalog([{ product_id: 'x', quantity: 3 }], m).total).toBe(0.3);
  });
});

describe('exitsForSale — a entrega vira saída do Mercado', () => {
  it('⭐ uma saída por item, tipo venda, com o comprador e o pedido', () => {
    const saidas = exitsForSale({
      id: 's1', buyer_id: 'u1', buyer_name: 'Ana',
      items: [{ product_id: 'agua', quantity: 2, price: 5 }, { product_id: 'grip', quantity: 1, price: 25 }],
    }, '2026-09-24');
    expect(saidas).toHaveLength(2);
    expect(saidas[0]).toEqual({
      product_id: 'agua', date: '2026-09-24', quantity: 2, exit_type: 'sale', unit_price: 5,
      buyer_id: 'u1', buyer_name: 'Ana', reason: 'Pedido pelo app', sale_id: 's1', channel: 'app',
    });
  });

  it('pedido sem itens não gera saída', () => {
    expect(exitsForSale({ id: 's', items: [] }, '2026-09-24')).toEqual([]);
  });
});

describe('stockDriftFixes — a cópia do estoque fica certa', () => {
  const entradas = [{ product_id: 'agua', quantity: 12 }, { product_id: 'grip', quantity: 3 }];
  const saidas = [{ product_id: 'agua', quantity: 2 }];

  it('⭐ corrige só o que diverge da conta verdadeira', () => {
    const fixes = stockDriftFixes([agua, grip, bola], entradas, saidas);
    // água: 12 − 2 = 10 (certo); grip: sem cópia → 3; bola: não vende no app.
    expect(fixes).toEqual([{ id: 'grip', stock_qty: 3 }]);
  });

  it('com tudo certo, não grava nada', () => {
    expect(stockDriftFixes([agua], entradas, saidas)).toEqual([]);
  });

  it('estoque que ficou negativo é gravado como está (a arena precisa ver)', () => {
    expect(stockDriftFixes(
      [{ ...agua, stock_qty: 0 }],
      [{ product_id: 'agua', quantity: 1 }],
      [{ product_id: 'agua', quantity: 2 }],
    )).toEqual([{ id: 'agua', stock_qty: -1 }]);
  });

  it('⭐ produto SEM nenhuma entrada não tem estoque controlado: a cópia fica vazia', () => {
    // Aluguel de raquete, ou arena que nunca registrou compra: sem isto o
    // produto nasceria esgotado na loja e o primeiro pedido o deixaria negativo.
    expect(stockDriftFixes([{ ...grip }], [], [{ product_id: 'grip', quantity: 3 }])).toEqual([]);
    expect(stockDriftFixes([{ ...grip, stock_qty: 4 }], [], [])).toEqual([{ id: 'grip', stock_qty: null }]);
  });
});

describe('trackedStock — quem controla o estoque é quem registrou entrada', () => {
  it('com entrada: entradas − saídas', () => {
    expect(trackedStock('agua', [{ product_id: 'agua', quantity: 5 }], [{ product_id: 'agua', quantity: 2 }])).toBe(3);
  });

  it('sem entrada nenhuma: sem controle (null), mesmo com saídas', () => {
    expect(trackedStock('grip', [{ product_id: 'agua', quantity: 5 }], [{ product_id: 'grip', quantity: 2 }])).toBeNull();
  });
});

describe('quantitiesByProduct — o estoque é conferido pelo total do produto', () => {
  it('soma linhas repetidas do mesmo produto', () => {
    const m = quantitiesByProduct([
      { product_id: 'agua', quantity: 2 }, { product_id: 'grip', quantity: 1 }, { product_id: 'agua', quantity: 3 },
    ]);
    expect(m.get('agua')).toBe(5);
    expect(m.get('grip')).toBe(1);
  });
});

describe('saleTotalMismatch — o balcão VÊ quando o valor não bate', () => {
  const porId = new Map([[agua.id, agua], [grip.id, grip]]);

  it('pedido com o preço da tabela: confere (null)', () => {
    expect(saleTotalMismatch({ total: 35, items: [{ product_id: 'agua', quantity: 2 }, { product_id: 'grip', quantity: 1 }] }, porId))
      .toBeNull();
  });

  it('⭐ pedido gravado com valor forjado: devolve o total pela tabela', () => {
    expect(saleTotalMismatch({ total: 0.01, items: [{ product_id: 'grip', quantity: 2 }] }, porId)).toBe(50);
  });

  it('produto que não está mais no Mercado: não há como conferir (null)', () => {
    expect(saleTotalMismatch({ total: 1, items: [{ product_id: 'sumiu', quantity: 1 }] }, porId)).toBeNull();
  });
});

describe('counterSummary — o balcão do dia', () => {
  const dataDe = (v) => v.dia;
  it('a entregar, do dia e o caixa (cancelada fica de fora)', () => {
    const r = counterSummary([
      { id: '1', dia: '2026-09-24', total: 10, stock_applied: false },
      { id: '2', dia: '2026-09-24', total: 5.5, stock_applied: true },
      { id: '3', dia: '2026-09-23', total: 99, stock_applied: false },
      { id: '4', dia: '2026-09-24', total: 50, status: 'cancelled' },
    ], '2026-09-24', dataDe);
    expect(r.aEntregar.map((v) => v.id)).toEqual(['1', '3']);
    expect(r.doDia.map((v) => v.id)).toEqual(['1', '2']);
    expect(r.caixa).toBe(15.5);
  });
});

describe('myShopStatus — minhas compras', () => {
  it('⭐ o que vou retirar e as partes que ainda não paguei', () => {
    const r = myShopStatus([
      { id: 'a', buyer_id: 'eu', stock_applied: false },
      { id: 'b', buyer_id: 'eu', stock_applied: true },
      { id: 'c', buyer_id: 'ana', split_with: ['ana', 'eu'] },
      { id: 'd', buyer_id: 'ana', split_with: ['ana', 'eu'] },
      { id: 'e', buyer_id: 'ana', split_with: ['ana', 'eu'], status: 'cancelled' },
    ], 'eu', new Set(['d']));
    expect(r.aRetirar.map((v) => v.id)).toEqual(['a']);
    expect(r.aPagar.map((v) => v.id)).toEqual(['c']);
  });
});

describe('salesOutsideMercado — sem contar a mesma venda duas vezes', () => {
  it('⭐ as vendas do app ficam de fora (já são saídas do Mercado)', () => {
    const r = salesOutsideMercado([{ id: 'antiga' }, { id: 'app', catalog: SHOP_CATALOG }]);
    expect(r.map((s) => s.id)).toEqual(['antiga']);
  });
});

describe('saleShares / isSaleFullyPaid — a conta só fecha quando TODOS pagaram', () => {
  const dividida = {
    id: 's1', buyer_id: 'ana', total: 30,
    split_details: [{ user_id: 'ana', amount: 10 }, { user_id: 'bia', amount: 10 }, { user_id: 'caio', amount: 10 }],
  };

  it('⭐🐞 quem ainda não registrou a parte conta como devendo (antes: a conta fechava sem ele)', () => {
    const pagos = [{ id: 'p1', sale_id: 's1', payer_id: 'ana', status: 'paid' }];
    expect(isSaleFullyPaid(dividida, pagos)).toBe(false);
    expect(saleShares(dividida, pagos).map((p) => p.status)).toEqual(['paid', 'none', 'none']);
  });

  it('todas as partes pagas: fechada', () => {
    const pagos = ['ana', 'bia', 'caio'].map((u) => ({ id: u, sale_id: 's1', payer_id: u, status: 'paid' }));
    expect(isSaleFullyPaid(dividida, pagos)).toBe(true);
  });

  it('pedido sem divisão: o comprador paga o total', () => {
    const sozinho = { id: 's2', buyer_id: 'ana', total: 12 };
    expect(saleShares(sozinho, [{ id: 'p', sale_id: 's2', payer_id: 'ana', status: 'pending' }]))
      .toEqual([{ user_id: 'ana', amount: 12, status: 'pending', payment_id: 'p' }]);
  });

  it('pagamento de OUTRO pedido não conta', () => {
    expect(isSaleFullyPaid({ id: 's3', buyer_id: 'ana', total: 5 }, [{ sale_id: 'x', payer_id: 'ana', status: 'paid' }]))
      .toBe(false);
  });
});

describe('saleDateISO / saleTimeHHMM — no fuso de quem olha', () => {
  it('lê created_at_ms e cai para o carimbo do servidor', () => {
    const ms = new Date(2026, 8, 24, 19, 42).getTime();
    expect(saleDateISO({ created_at_ms: ms })).toBe('2026-09-24');
    expect(saleTimeHHMM({ created_at: { seconds: ms / 1000 } })).toBe('19:42');
    expect(saleDateISO({})).toBeNull();
  });

  it('"Hoje, 19:42" no dia; a data como gente lê nos outros', () => {
    const ms = new Date(2026, 8, 24, 19, 42).getTime();
    expect(saleWhenLabel({ created_at_ms: ms }, '2026-09-24')).toBe('Hoje, 19:42');
    expect(saleWhenLabel({ created_at_ms: ms }, '2026-09-25')).not.toContain('2026-09-24');
    expect(saleWhenLabel({}, '2026-09-24')).toBe('');
  });
});

describe('myOrderView — o pedido visto por quem pediu ou divide', () => {
  const base = { id: 's1', buyer_id: 'eu', total: 10, status: 'pending', stock_applied: false, split_with: [] };

  it('⭐ quem pediu desiste enquanto está em aberto e não entregue', () => {
    expect(myOrderView(base, 'eu').podeDesistir).toBe(true);
    expect(myOrderView({ ...base, stock_applied: true }, 'eu').podeDesistir).toBe(false);
    expect(myOrderView({ ...base, status: 'paid' }, 'eu').podeDesistir).toBe(false);
  });

  it('⭐ conta dividida não se desiste pelo app (alguém pode já ter pago)', () => {
    const dividida = { ...base, split_with: ['eu', 'bia'], split_details: [{ user_id: 'eu', amount: 5 }, { user_id: 'bia', amount: 5 }] };
    expect(myOrderView(dividida, 'eu').podeDesistir).toBe(false);
  });

  it('⭐ quem divide e ainda não registrou a parte vê o botão; depois de registrar, não', () => {
    const dividida = { ...base, split_with: ['eu', 'bia'], split_details: [{ user_id: 'eu', amount: 5 }, { user_id: 'bia', amount: 5 }] };
    const v = myOrderView(dividida, 'bia');
    expect(v.podeRegistrarParte).toBe(true);
    expect(v.minhaParte).toBe(5);
    const depois = myOrderView(dividida, 'bia', [{ id: 'p', sale_id: 's1', payer_id: 'bia', status: 'pending' }]);
    expect(depois.podeRegistrarParte).toBe(false);
    expect(depois.minhaParteStatus).toBe('pending');
  });

  it('etapas: a retirar, entregue, cancelado', () => {
    expect(myOrderView(base, 'eu').etapa).toBe('a_retirar');
    expect(myOrderView({ ...base, stock_applied: true }, 'eu').etapa).toBe('entregue');
    expect(myOrderView({ ...base, status: 'cancelled' }, 'eu').etapa).toBe('cancelado');
  });
});

describe('appOrdersSummary — os pedidos do app nas Métricas', () => {
  it('conta só os do app e vivos; o valor fica com o Mercado', () => {
    expect(appOrdersSummary([
      { catalog: 'mercado', stock_applied: true, status: 'paid' },
      { catalog: 'mercado', stock_applied: false, status: 'pending' },
      { catalog: 'mercado', status: 'cancelled' },
      { status: 'paid' },
    ])).toEqual({ total: 2, entregues: 1, pagos: 1 });
  });
});
