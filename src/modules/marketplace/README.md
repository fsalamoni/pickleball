# `marketplace/` — Mercado (marketplace multi-vendedor)

> **Status: 🚧 em construção, atrás da flag `marketplace` (default OFF).**
> Plano e decisões do dono (D1–D12): `/mnt/project-files/market/plano-marketplace-picklerush.md`
> (fora do repositório). Desenho de origem em `docs/FUTURO/MERCADO/`.

## O que é

O marketplace da plataforma em `/mercado`: vitrine com busca, filtros e
ordenação, anúncio com fotos, vídeo e perguntas, favoritos, carrinho com
vários vendedores, ofertas, pedido, Pix, avaliação e disputa.

Vendem: **atletas** e **professores** (Minha área → Vender), **arenas**
(produtos próprios e os do Mercado interno, com estoque único) e **lojas**
(cadastro com CNPJ, aprovado pelo admin).

## ⚠ Não confundir com o "Mercado da arena"

`arena_products` / `arena_inventory_*` / `arena_sales` / `catalog_products`
são do **PDV/estoque da arena** (`arenas/`). Este módulo usa **só** o prefixo
`market_` e nunca escreve em coleção `arena_*`.

## Decisões que não podem regredir

1. **O Pix vai direto ao vendedor** (0% de comissão). A chave mora em
   `market_sellers/{key}/private/data` e só é copiada para o pedido quando o
   vendedor ACEITA — antes disso o comprador não vê, e o vendedor não vê o
   endereço (`shipping_visible`, gravado pelo servidor).
2. **Pedido, oferta, avaliação e disputa são escritos SÓ pelo servidor**
   (`functions/marketplace.js`, callables `marketPlaceOrders`,
   `marketOrderAction`, `marketOfferAction`, `marketSubmitReview`). Estoque e
   preço são reconferidos numa transação; a regra é `write: if false`.
3. **Um pedido por vendedor**: o carrinho com três vendedores vira três
   pedidos, e o problema de um não derruba os outros (`failures`).
4. **Cópias cliente × servidor com paridade**: a máquina de estados do pedido
   (`domain/orderStatus.js`), a da oferta (`offers.js`), a validação da
   avaliação, os termos proibidos e a configuração —
   `functions/marketplace.parity.test.js`.
5. **Chave do vendedor é contrato**: `athlete_{uid}`, `coach_{uid}`,
   `arena_{arenaId}`, `store_{uid}` (`domain/seller.js`). A regra decide quem
   opera cada uma (`isMarketOperator`).
6. **Zero índice composto**: consultas por igualdade/`in`, ordenação em
   memória (`domain/search.js`).
7. **Coleção `market_*` nova entra na exclusão de conta E na exportação** —
   `src/core/guards/exclusaoCobreColecoes.test.js` lê o `firestore.rules`.
8. **Avaliação cega**: aparece quando os dois lados avaliam ou em 14 dias.
9. **Loja nasce "em análise"** (`/mercado/loja/abrir`, `applyStore`) e só o
   admin aprova, recusa (com motivo), suspende ou dá o selo (Painel admin →
   Mercado → Lojas, `reviewSeller`, que avisa o dono e grava auditoria).
   Suspender PAUSA os anúncios públicos com `admin_paused: true` e a regra não
   deixa vendedor suspenso pôr anúncio de volta no ar; reativar devolve só os
   que a suspensão pausou.

## Telas

`/mercado` (vitrine), `/mercado/anuncio/:id`, `/mercado/vendedor/:key`,
`/mercado/favoritos`, `/mercado/carrinho`, `/mercado/pedidos` (+ `:id`),
`/mercado/vendas/:id`, `/mercado/ofertas/:id`, `/mercado/vender` (painel de
quem vende, `?como=` e `?aba=`), `/mercado/vender/anuncio/novo|:id` (editor),
`/mercado/loja/abrir`. Admin: seção **Mercado** do Painel admin (`mercado-*`),
que some com a flag desligada.

## Estrutura

```
marketplace/
├── domain/    constants, taxonomy, money, listing, search, cart, orderStatus,
│              offers, reputation, seller, settings (puro, com testes)
├── services/  marketService (vendedores, anúncios, perguntas, favoritos,
│              buscas, carrinho, configuração), marketOrderService (funções e
│              leituras de pedido/oferta/avaliação/disputa), marketMediaService
│              (fotos, vídeo e comprovante em `mercado/{uid}/`),
│              marketExportService (LGPD)
└── hooks/     useMarket.js (`marketKeys` é a fonte única das chaves)
```

## Coleções

`market_sellers` (+ `private/data`), `market_listings`, `market_questions`,
`market_favorites`, `market_saved_searches`, `market_carts`, `market_offers`,
`market_orders` (+ `events`, `private/shipping`), `market_reviews`,
`market_disputes`; configuração em `platform_settings/marketplace`. Detalhe
em `docs/05-DATA-MODEL.md` § Mercado. Regras provadas em
`tests/rules/marketplace.rules.test.js`; funções em
`tests/rules/marketplace.functions.test.js`.
