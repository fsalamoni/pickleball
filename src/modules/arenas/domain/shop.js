/**
 * A loja da arena no aplicativo — UM cadastro de produto só (puro, testado).
 *
 * ## O problema
 *
 * A arena tinha DOIS cadastros de produto sem ligação:
 *
 *  - o **Mercado** (Central → Pagamentos e loja → Mercado): produtos, entradas,
 *    saídas, estoque calculado, validade, financeiro — a gestão de verdade;
 *  - a **loja do PDV** (módulo `pdv`): outro catálogo (`arena_products`), com
 *    outro estoque (um número solto no produto).
 *
 * A mesma garrafa de água seria cadastrada duas vezes, com dois estoques que
 * divergiriam no primeiro dia — o de sempre dos cadastros duplicados (foi o
 * que aconteceu com os professores). Em produção a loja do PDV ainda não tinha
 * produto nenhum: o momento de unificar era antes de existir dado nos dois.
 *
 * ## O desenho
 *
 * O Mercado é o cadastro. A loja do app é um CANAL de venda dele:
 *
 *  - o produto ganha `sell_online` (**"Vender pelo app"**) e usa o `sale_price`
 *    que o Mercado já tinha;
 *  - o atleta pede pelo app (`arena_sales`, como antes) — o preço é o do
 *    BANCO, nunca o que veio da tela;
 *  - a arena **entrega** no balcão, e a entrega vira uma **saída do Mercado**
 *    (tipo venda, com o comprador): o estoque, as vendas e o financeiro do
 *    Mercado passam a incluir o que foi vendido pelo app, sem digitar de novo;
 *  - o atleta não lê entradas e saídas (são da arena), então o produto carrega
 *    `stock_qty` — uma cópia do estoque que a arena mantém certa (a conta
 *    verdadeira continua sendo entradas − saídas; ver `stockDriftFixes`).
 *
 * ## Produto sem controle de estoque
 *
 * Nem tudo o que a arena vende tem estoque: aluguel de raquete é serviço, e
 * muita arena nunca registrou uma compra no Mercado. Se a conta fosse sempre
 * entradas − saídas, todo produto assim nasceria **esgotado** na loja do app
 * — e o primeiro pedido entregue o deixaria negativo. A regra é a do PDV
 * antigo ("estoque vazio = sem controle"), dita pelo que a arena FEZ:
 * produto **com pelo menos uma entrada** tem estoque controlado; sem nenhuma,
 * o app vende sem limite (`stock_qty` fica vazio). Ver `trackedStock`.
 */

import { calculateStock } from './inventory.js';
import { formatDateShortBR, todayISO } from './calendar.js';

/** Marca da venda feita a partir do Mercado. */
export const SHOP_CATALOG = 'mercado';

function numero(v) {
  // `Number(null)` é 0: sem este cuidado, um estoque VAZIO (sem controle)
  // viraria "esgotado".
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * O estoque do produto como a loja deve tratá-lo: o número (entradas −
 * saídas) quando a arena controla o estoque dele, ou `null` quando não
 * controla — nenhuma entrada registrada.
 */
export function trackedStock(productId, entries = [], exits = []) {
  const controla = entries.some((e) => e?.product_id === productId);
  if (!controla) return null;
  return calculateStock(productId, entries, exits).quantity;
}

/**
 * O produto do Mercado está à venda pelo app?
 * Ativo, marcado para o app e com preço de venda.
 */
export function isSoldOnline(product) {
  return Boolean(product)
    && product.active !== false
    && product.sell_online === true
    && (numero(product.sale_price) ?? 0) > 0;
}

/**
 * A vitrine do app, a partir dos produtos do Mercado.
 * `stock` é `null` quando a cópia do estoque ainda não existe — aí o produto
 * não aparece como esgotado (quem confere de verdade é a entrega).
 *
 * @param {object[]} inventoryProducts
 * @returns {Array<{ id: string, name: string, price: number, category: string,
 *   stock: number|null, detail: string }>}
 */
export function shopProducts(inventoryProducts = []) {
  return inventoryProducts
    .filter(isSoldOnline)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: numero(p.sale_price),
      category: p.category || 'Outros',
      stock: numero(p.stock_qty),
      detail: [p.brand, p.size, p.flavor, p.packaging].filter(Boolean).join(' · '),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

/** Tem estoque para esta quantidade? Estoque desconhecido não barra. */
export function shopHasStock(product, quantity = 1) {
  const s = numero(product?.stock ?? product?.stock_qty);
  if (s == null) return true;
  return s >= quantity;
}

/**
 * Refaz o carrinho com os preços do BANCO.
 *
 * A tela manda produto e quantidade; o preço que vale é o `sale_price` do
 * Mercado naquele instante. Um carrinho montado na tela com preço velho (ou
 * forjado) não passa.
 *
 * @param {Array<{ product_id: string, quantity: number }>} items
 * @param {Map<string, object>} productsById produtos do Mercado, lidos do banco
 * @returns {{ ok: boolean, error?: string, items: object[], total: number }}
 */
export function priceCartFromCatalog(items = [], productsById = new Map()) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Carrinho vazio.', items: [], total: 0 };
  }
  const saida = [];
  for (const item of items) {
    const quantity = Math.round(Number(item?.quantity) || 0);
    if (quantity <= 0) return { ok: false, error: 'Quantidade inválida.', items: [], total: 0 };
    const p = productsById.get(item?.product_id);
    if (!p || !isSoldOnline(p)) {
      return { ok: false, error: 'Um dos produtos saiu de venda. Atualize a loja e tente de novo.', items: [], total: 0 };
    }
    if (!shopHasStock(p, quantity)) {
      return { ok: false, error: `Estoque insuficiente de ${p.name}.`, items: [], total: 0 };
    }
    const price = numero(p.sale_price);
    saida.push({ product_id: p.id, name: p.name, price, quantity });
  }
  const total = Math.round(saida.reduce((a, i) => a + i.price * i.quantity, 0) * 100) / 100;
  return { ok: true, items: saida, total };
}

/**
 * As saídas do Mercado que a ENTREGA de um pedido do app gera — uma por item,
 * do tipo venda, com o comprador e o pedido de origem.
 *
 * @param {object} sale o pedido (`arena_sales`)
 * @param {string} date data da entrega (YYYY-MM-DD)
 */
export function exitsForSale(sale, date) {
  return (sale?.items || []).map((i) => ({
    product_id: i.product_id,
    date,
    quantity: Math.round(Number(i.quantity) || 1),
    exit_type: 'sale',
    unit_price: numero(i.price) ?? 0,
    buyer_id: sale.buyer_id || '',
    buyer_name: sale.buyer_name || '',
    reason: 'Pedido pelo app',
    sale_id: sale.id,
    channel: 'app',
  }));
}

/**
 * Onde a cópia do estoque (`stock_qty`) está diferente da conta verdadeira
 * (`trackedStock`). Só olha produtos à venda pelo app — os outros não têm
 * quem leia a cópia.
 *
 * Quem roda isto é a ARENA, com entradas e saídas na mão (a regra só deixa a
 * arena lê-las e escrever o produto). Devolve só o que precisa ser gravado:
 * com tudo certo, a lista é vazia e nada é escrito.
 *
 * @returns {Array<{ id: string, stock_qty: number|null }>}
 */
export function stockDriftFixes(products = [], entries = [], exits = []) {
  return products
    .filter((p) => p?.sell_online === true)
    .map((p) => ({ id: p.id, atual: numero(p.stock_qty), real: trackedStock(p.id, entries, exits) }))
    .filter((x) => x.atual !== x.real)
    .map((x) => ({ id: x.id, stock_qty: x.real }));
}

/**
 * Soma as quantidades por produto — o mesmo produto pode aparecer em mais de
 * uma linha do pedido, e o estoque tem de ser conferido pelo total.
 * @returns {Map<string, number>}
 */
export function quantitiesByProduct(items = []) {
  const m = new Map();
  for (const i of items) {
    if (!i?.product_id) continue;
    m.set(i.product_id, (m.get(i.product_id) || 0) + Math.max(1, Math.round(Number(i.quantity) || 1)));
  }
  return m;
}

/**
 * Confere o total do pedido contra a tabela de HOJE do Mercado.
 *
 * O pedido criado pelo aplicativo já sai com o preço do banco. Mas uma conta
 * mexendo direto no banco consegue gravar um pedido com o valor que quiser —
 * a regra do Firestore não tem como somar itens. Quem entrega é a última
 * barreira, e ela precisa VER quando o valor não bate. Devolve o total pela
 * tabela quando ele difere do gravado (também quando o preço mudou desde o
 * pedido, que é informação útil no balcão); `null` quando confere ou quando
 * não há como conferir.
 *
 * @param {object} sale
 * @param {Map<string, object>} productsById
 * @returns {number|null}
 */
export function saleTotalMismatch(sale, productsById = new Map()) {
  const itens = Array.isArray(sale?.items) ? sale.items : [];
  if (itens.length === 0) return null;
  let centavos = 0;
  for (const i of itens) {
    const p = productsById.get(i?.product_id);
    const preco = numero(p?.sale_price);
    if (preco == null) return null;
    centavos += Math.round(preco * 100) * Math.max(1, Math.round(Number(i.quantity) || 1));
  }
  const pelaTabela = centavos / 100;
  const gravado = Math.round((Number(sale.total) || 0) * 100) / 100;
  return Math.abs(pelaTabela - gravado) >= 0.01 ? pelaTabela : null;
}

/**
 * O balcão do dia: o que falta entregar e o caixa.
 * @param {object[]} sales pedidos da arena
 * @param {string} hoje YYYY-MM-DD
 * @param {(sale: object) => string} dataDe data (YYYY-MM-DD) do pedido
 */
export function counterSummary(sales = [], hoje, dataDe) {
  const vivos = sales.filter((v) => v.status !== 'cancelled');
  const aEntregar = vivos.filter((v) => !v.stock_applied);
  const doDia = vivos.filter((v) => dataDe(v) === hoje);
  const caixa = Math.round(doDia.reduce((a, v) => a + (Number(v.total) || 0), 0) * 100) / 100;
  return { aEntregar, doDia, caixa };
}

/**
 * Minhas compras numa (ou em todas as) arena(s): as que ainda vou retirar e
 * as partes de conta dividida que ainda não paguei.
 *
 * @param {object[]} sales pedidos em que estou (comprei ou divido)
 * @param {string} uid
 * @param {Set<string>} pagas pedidos em que já registrei a minha parte
 */
export function myShopStatus(sales = [], uid, pagas = new Set()) {
  const vivos = sales.filter((v) => v.status !== 'cancelled');
  const aRetirar = vivos.filter((v) => v.buyer_id === uid && !v.stock_applied);
  const aPagar = vivos.filter((v) => (
    v.buyer_id !== uid
    && Array.isArray(v.split_with) && v.split_with.includes(uid)
    && !pagas.has(v.id)
  ));
  return { aRetirar, aPagar };
}

/**
 * As vendas que o painel de Métricas soma como "PDV": só as ANTIGAS, de fora
 * do Mercado. As do app, quando entregues, já são saídas do Mercado — somar as
 * duas seria contar a mesma água duas vezes.
 */
export function salesOutsideMercado(sales = []) {
  return sales.filter((s) => s?.catalog !== SHOP_CATALOG);
}

/**
 * Quem paga o quê num pedido, e em que pé está cada parte.
 *
 * Quem DEVE pagar sai do pedido (a divisão, ou o comprador sozinho), não dos
 * pagamentos que existem: numa conta dividida, quem ainda não registrou a
 * parte não tem documento de pagamento — e contar só os documentos era
 * declarar a conta "paga" com gente devendo.
 *
 * @param {object} sale
 * @param {object[]} payments pagamentos do pedido (`sale_id` igual)
 * @returns {Array<{ user_id: string, amount: number, status: 'none'|'pending'|'paid'|'cancelled',
 *   payment_id: string|null }>}
 */
export function saleShares(sale, payments = []) {
  if (!sale) return [];
  const partes = Array.isArray(sale.split_details) && sale.split_details.length > 1
    ? sale.split_details.map((p) => ({ user_id: p.user_id, amount: numero(p.amount) ?? 0 }))
    : [{ user_id: sale.buyer_id, amount: numero(sale.total) ?? 0 }];
  const doPedido = payments.filter((p) => p?.sale_id === sale.id);
  return partes.map((parte) => {
    const pg = doPedido.find((p) => p.payer_id === parte.user_id);
    return {
      ...parte,
      status: pg ? (pg.status || 'pending') : 'none',
      payment_id: pg ? pg.id : null,
    };
  });
}

/** Todas as partes do pedido estão pagas? */
export function isSaleFullyPaid(sale, payments = []) {
  const partes = saleShares(sale, payments);
  return partes.length > 0 && partes.every((p) => p.status === 'paid');
}

/** Quando o pedido foi feito, em ms (`created_at_ms`, ou o carimbo do servidor). */
function msDoPedido(sale) {
  const ms = Number(sale?.created_at_ms);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const ts = sale?.created_at;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  return null;
}

const doisDigitos = (n) => String(n).padStart(2, '0');

/** O DIA do pedido ('YYYY-MM-DD', no fuso de quem olha). `null` sem data. */
export function saleDateISO(sale) {
  const ms = msDoPedido(sale);
  if (!ms) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** A HORA do pedido ('HH:MM') — no balcão, "pediu às 19:42" é o que importa. */
export function saleTimeHHMM(sale) {
  const ms = msDoPedido(sale);
  if (!ms) return null;
  const d = new Date(ms);
  return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

/**
 * Um pedido visto por quem PEDIU ou por quem DIVIDE a conta.
 *
 * @param {object} sale
 * @param {string} uid
 * @param {object[]} myPayments os meus pagamentos (`payer_id == uid`)
 */
export function myOrderView(sale, uid, myPayments = []) {
  const souComprador = sale?.buyer_id === uid;
  const dividida = Array.isArray(sale?.split_with) && sale.split_with.length > 1;
  const cancelado = sale?.status === 'cancelled';
  const etapa = cancelado ? 'cancelado' : sale?.stock_applied ? 'entregue' : 'a_retirar';
  const minha = saleShares(sale, myPayments.filter((p) => p?.payer_id === uid))
    .find((p) => p.user_id === uid) || null;
  return {
    etapa,
    souComprador,
    dividida,
    pago: sale?.status === 'paid',
    minhaParte: minha ? minha.amount : null,
    minhaParteStatus: minha ? minha.status : null,
    // Quem pediu desiste enquanto está em aberto, não entregue e não dividido
    // — as mesmas condições que a regra do Firestore confere.
    podeDesistir: souComprador && sale?.status === 'pending' && !sale?.stock_applied && !dividida,
    // Quem divide a conta (e não é quem pediu) registra a própria parte.
    podeRegistrarParte: !cancelado && !souComprador && Boolean(minha) && minha.status === 'none',
  };
}

/** "Hoje, 19:42" para o pedido do dia; "Qui, 23/07" para os outros. */
export function saleWhenLabel(sale, hoje = todayISO()) {
  const dia = saleDateISO(sale);
  if (!dia) return '';
  if (dia !== hoje) return formatDateShortBR(dia);
  const hora = saleTimeHHMM(sale);
  return hora ? `Hoje, ${hora}` : 'Hoje';
}

/**
 * Os pedidos do app num período, para as Métricas. O VALOR deles não entra
 * aqui: quando entregue, o pedido vira saída do Mercado e é contado lá.
 */
export function appOrdersSummary(sales = []) {
  const vivos = sales.filter((s) => s?.catalog === SHOP_CATALOG && s.status !== 'cancelled');
  return {
    total: vivos.length,
    entregues: vivos.filter((s) => s.stock_applied).length,
    pagos: vivos.filter((s) => s.status === 'paid').length,
  };
}
