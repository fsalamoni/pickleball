# `marketplace/` — Mercado (marketplace multi-vendedor)

> **Status: 📐 PLANEJADO — pasta estruturada, nenhum código escrito.**
> Desenho completo em `docs/FUTURO/MERCADO/`. Leia `docs/FUTURO/MERCADO/00-INDEX.md`
> antes de escrever a primeira linha.

## O que é

Marketplace público do PickleRush, com dois ambientes:
- **público (comprador)**: vitrine, busca, anúncio, negociação, pedido,
  pagamento, avaliação;
- **gestão (vendedor)**: painel, anúncios, ofertas, pedidos, entrega,
  financeiro, avaliações, configurações, analytics.

Vendem: atletas, arenas, professores, clubes, lojas e a plataforma.

## ⚠ Não confundir com o "Mercado da arena"

`arena_products` / `arena_sales` / `catalog_products` são do **PDV da
arena** (`arenas/`), que continua existindo. Este módulo usa **só** o
prefixo `market_` e nunca escreve em coleção `arena_*`.
Ver `docs/FUTURO/MERCADO/00-INDEX.md` § "Colisão de nomes".

## Estrutura

```
marketplace/
├── domain/        16 arquivos puros + .test.js  (~284 testes)
├── services/      10 services (I/O Firestore + auditoria)
├── hooks/         10 hooks React Query
├── components/    componentes específicos do módulo
└── README.md
```
Páginas ficam em `src/v2/pages/V2Market*.jsx`; componentes de UI em
`src/v2/components/marketplace/`.

## Flags (todas default OFF)

`marketplace` (mestra) · `marketplace_offers` · `marketplace_orders` ·
`marketplace_shipping` · `marketplace_reviews` · `marketplace_promotions` ·
`marketplace_wanted` · `marketplace_arena_sync`

Sub-flag só tem efeito com a mestra ligada.

## Coleções (16)

`market_sellers` · `market_listings` (+ subcoleção `private`) ·
`market_listing_stats` · `market_offers` · `market_orders` (+ subcoleção
`events`) · `market_reviews` · `market_favorites` · `market_saved_searches` ·
`market_categories` · `market_promotions` · `market_disputes` ·
`market_seller_stats` · `market_wanted_matches` · `market_shipping_zones` ·
`platform_settings/marketplace`

Denúncias ficam em `content_reports` (módulo `moderation/`), **não** aqui.

Schema completo: `docs/FUTURO/MERCADO/04-DATA-MODEL.md`.

## Rotas (19)

Públicas: `/mercado`, `/mercado/buscar`, `/mercado/c/:slug`,
`/mercado/anuncio/:id`, `/mercado/vendedor/:slug`, `/mercado/procurados`,
`/mercado/checkout/:id`, `/mercado/compras`, `/mercado/compras/:orderId`.

Gestão: `/mercado/vender` + `onboarding`, `anuncios`, `anuncios/novo`,
`anuncios/:id/editar`, `ofertas`, `pedidos`, `pedidos/:id`, `avaliacoes`,
`financeiro`, `configuracoes`, `analytics`.

## Regras que não se negocia

1. Dinheiro em **centavos inteiros**. Nunca float.
2. Chave Pix e endereço só depois do pedido `accepted`.
3. `market_orders` **nunca** é apagado. `events` é imutável.
4. Avaliação só com pedido `completed`, id determinístico
   `{orderId}_{authorUid}`.
5. Máquina de estado do pedido em `domain/orderStatus.js`, testada por
   tabela exaustiva.
6. Ação sem permissão **não é renderizada**.
7. Toda escrita relevante grava `audit_logs`.

## Onde achar mais
- `docs/FUTURO/MERCADO/` — 14 documentos
- `docs/FUTURO/CONFIANCA-E-MODERACAO/` — denúncia, bloqueio, strikes
- `docs/FUTURO/PLANO-MESTRE-MERCADO-FEED.md` — cronograma
