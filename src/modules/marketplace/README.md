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
10. **Denúncia** (`market_reports/{anúncio}_{uid}`): uma por pessoa e anúncio,
    criada pelo navegador, decidida só pelo admin. Tirar do ar (`moderateListing`)
    exige motivo, avisa quem vende, grava auditoria e encerra as denúncias
    abertas do anúncio. O admin decide disputa NO PRÓPRIO pedido (o papel
    `admin` sai de `orderRoleOf`); o Painel admin → Mercado só lista e leva lá.
11. **Cupom e vale-presente: o preço é do SERVIDOR.** A conta é
    `orderPricing` (`domain/promotions.js`: cupom primeiro, vale depois, nunca
    abaixo de zero) com a cópia em `functions/marketPromo.js` — paridade em
    `marketPromo.parity.test.js`. O cupom (`market_coupons/{seller_key}_{CODE}`)
    é gravado por quem vende, mas o uso (`uses_count`, `market_coupon_uses`)
    e todo vale (`market_gift_cards`, `marketGiftCardAction`) só o servidor
    escreve; cancelar o pedido devolve o uso e o saldo. Vale só vale na loja que
    o vendeu, e o código completo só aparece para quem o comprou ou resgatou.
    O cupom compartilhado por link (`/mercado/vendedor/:key?cupom=CODIGO`,
    `services/pendingCoupon.js`) fica guardado na aba e entra aplicado no
    carrinho daquela loja, uma vez. A rotina avisa, uma vez, o vale com saldo
    que vence em até 30 dias. O admin vê e desliga cupom (com motivo, avisando
    a loja) em Painel admin → Mercado → Cupons e vales.

## Telas

`/mercado` (vitrine), `/mercado/anuncio/:id`, `/mercado/vendedor/:key`,
`/mercado/favoritos`, `/mercado/carrinho`, `/mercado/pedidos` (+ `:id`),
`/mercado/vendas/:id`, `/mercado/ofertas/:id`, `/mercado/vender` (painel de
quem vende, `?como=` e `?aba=`), `/mercado/vender/anuncio/novo|:id` (editor),
`/mercado/loja/abrir`, `/mercado/vales` (vales que comprei ou resgatei). No
painel de quem vende, **Divulgar** (cupons, vale-presente, cartão da loja) e
**Desempenho** (números de 30/90 dias + planilha). Cartões para compartilhar
(anúncio, loja, cupom, vale) saem como PNG em `promo/ShareImageDialog`. Admin: seção **Mercado** do Painel admin (`mercado-*`:
Visão geral, Problemas em pedidos, Anúncios, Pedidos, Lojas, Cupons e vales, Configurações),
que some com a flag desligada; disputas e anúncios denunciados entram em
"Precisa de você".

**Dois ambientes (2026-10-15).** A barra do Mercado tem quatro itens: **Comprar**
(vitrine, anúncio, loja, carrinho), **Minhas compras** (Pedidos · Ofertas ·
Vales, abas de `MarketTabs`), **Salvos** (Favoritos · Buscas salvas) e **Vender**.
O topo de compras (`MarketHeader`: busca + carrinho, departamentos só na
vitrine) não aparece nas telas de quem vende. O painel de quem vende agrupa as
9 abas em 5 seções: Resumo · Anúncios · Negociações (Vendas, Ofertas,
Perguntas) · Divulgação (Cupons e vales, Desempenho) · Minha loja (Recebimento,
Vitrine). Os valores de `?aba=` não mudaram (avisos levam a eles). Na Minha
área, a seção **Mercado** e as pendências em "Precisa de você".

## Estrutura

```
marketplace/
├── domain/    constants, taxonomy, money, listing, search, cart, orderStatus,
│              offers, reputation, seller, settings, metrics (puro, com testes)
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
`market_disputes`, `market_reports`, `market_coupons` (+ `market_coupon_uses`),
`market_gift_cards`; configuração em `platform_settings/marketplace`. Detalhe
em `docs/05-DATA-MODEL.md` § Mercado. Regras provadas em
`tests/rules/marketplace.rules.test.js`; funções em
`tests/rules/marketplace.functions.test.js`.

## O que traz a pessoa de volta

- **Buscas salvas** (`/mercado/buscas`): "Salvar busca" na lista de
  resultados; a tela mostra quantos anúncios chegaram desde a última vez e os
  primeiros. A conta é `domain/discovery.js` (`savedSearchMatches`) e o aviso
  diário do servidor (`marketSavedSearchAlerts`, 10h) usa a CÓPIA
  `functions/marketSearch.js` — paridade em `marketSearch.parity.test.js`.
  Um aviso por busca a cada 20 h, só com o aviso ligado.
- **Preço baixou**: `marketPriceDropNotify` avisa quem favoritou quando o
  preço fica abaixo do menor já avisado (`price_alert_cents`, travado na
  regra) — subir e descer de novo não vira spam.
- **Vistos recentemente**: no aparelho, por conta (`v2:view:<uid>:mercado:vistos`),
  zero banco.
- **Perto de você** usa a Minha região (`useRegionalList`), do mais perto ao
  mais longe.

- **Fotos** (editor do anúncio): arrastar do computador e soltar, várias de
  uma vez (na ordem escolhida), reordenar arrastando uma sobre a outra (ou
  pelas setas), e **Ajustar** cada foto: tamanho, enquadramento no card e
  rotação. O arquivo NÃO muda: `media[].aspect` (largura ÷ altura, medida no
  envio) e `media[].frame = { rotate, zoom, x, y }` são aplicados por CSS
  (`domain/mediaFrame.js` + `MarketPhoto`). O card recorta (`mode="cover"`);
  a galeria e a foto ampliada mostram a foto inteira, só girada
  (`mode="contain"`). Foto antiga sem `aspect` sai como sempre
  (`object-cover`). O pedido e o carrinho copiam `cover_aspect`/`cover_frame`.
  **Nunca** desenhe foto de anúncio com `<img>` cru: use `MarketPhoto`.
- **Selo "Gerado por IA"**: `media[].ai_generated` (declarado por quem
  publica, na foto e no vídeo) vira o carimbo `AiStamp` no card, na galeria e
  na foto ampliada. A plataforma não verifica: a declaração e a
  responsabilidade são do vendedor (Política de Imagens e IA).
- **Termos do Mercado**: quatro documentos com `marketGate: true` em
  `legal/domain/legalDocuments.js` (Termos Gerais v2, do Comprador, do
  Vendedor e a Política de Imagens, Vídeos e IA, rota `mercado-imagens-e-ia`).
  `MarketTermsGate` pede o aceite no primeiro acesso a `/mercado` e a cada
  versão nova (`pendingMarketConsents`), gravado em `legal_consents` como os
  demais. Subir a `version` de um deles pede novo aceite a todos.

**Mais perto de Shopee e eBay (2026-10-15, zero banco).** Busca com sugestões
(categorias e marcas) e buscas recentes no aparelho (`domain/suggestions.js`);
"nada encontrado" com "Salvar esta busca" e "Talvez você goste"; filtro de
frete grátis (`frete=gratis`, também na cópia do servidor) e cidade dentro da
UF; preço aplicado ao digitar. No anúncio: "Comprar agora" compra SÓ aquele
item (`?so=` no carrinho, `cartOnlyListing`), bloco "Entrega e garantias"
(prazo de envio e devolução das `policies` de QUALQUER vendedor + janela de
disputa), "Só {n} restantes", "No PickleRush desde", vistos recentemente. No
pedido: rastreio com transportadora de lista e link (`domain/carriers.js`),
motivos de cancelamento (`CANCEL_REASONS`), uma ação principal e as
destrutivas em linha separada, linha do tempo que mostra onde parou
(`timelineSteps`), "Comprar de novo", recibo para imprimir; lista de pedidos
com busca e situações (`domain/orderFilters.js`). Quem vende: uma ação por
estado + menu "⋯" (duplicar, republicar, compartilhar; confirmações em
diálogo), perguntas sem resposta primeiro, oferta vencida sem "Responder"
(`offerDisplayStatus`), aba Avaliações, políticas editáveis por todo vendedor
(`saveSellerPolicies`), "Modo férias" (= pausar/retomar todos, sem campo novo),
editor com navegação por partes e prévia no celular. Servidor: aviso de
avaliação recebida e lembrete 12 h antes do prazo de resposta
(`deadline_reminded_at_ms`, gravado só pelo servidor).
