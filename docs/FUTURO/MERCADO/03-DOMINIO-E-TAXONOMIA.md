# 16.03 — Domínio e taxonomia do Mercado

> Este documento é a especificação do que vai em `src/modules/marketplace/domain/`.
> **Tudo aqui é função pura, sem React e sem Firebase, com `.test.js` ao lado.**

## 1. Enums canônicos (`domain/constants.js`)

```js
export const MARKET_COLLECTIONS = Object.freeze({
  sellers:        'market_sellers',
  listings:       'market_listings',
  listing_stats:  'market_listing_stats',
  offers:         'market_offers',
  orders:         'market_orders',
  order_events:   'market_order_events',
  reviews:        'market_reviews',
  favorites:      'market_favorites',
  saved_searches: 'market_saved_searches',
  categories:     'market_categories',
  promotions:     'market_promotions',
  disputes:       'market_disputes',
  wanted_matches: 'market_wanted_matches',
  seller_stats:   'market_seller_stats',
  payouts:        'market_payouts',        // Fase 3
  settings:       'platform_settings',      // doc 'marketplace'
});

/** Quem vende. */
export const SELLER_TYPE = Object.freeze({
  ATHLETE:  'athlete',
  ARENA:    'arena',
  COACH:    'coach',
  CLUB:     'club',
  STORE:    'store',
  PLATFORM: 'platform',
});

/** O que é o anúncio. */
export const LISTING_TYPE = Object.freeze({
  PRODUCT_NEW:  'product_new',
  PRODUCT_USED: 'product_used',
  SERVICE:      'service',
  EXPERIENCE:   'experience',
  RENTAL:       'rental',
  WANTED:       'wanted',
  DONATION:     'donation',
});

/** Estado do anúncio. */
export const LISTING_STATUS = Object.freeze({
  DRAFT:      'draft',
  SCHEDULED:  'scheduled',
  IN_REVIEW:  'in_review',
  ACTIVE:     'active',
  PAUSED:     'paused',
  SOLD_OUT:   'sold_out',
  EXPIRED:    'expired',
  REJECTED:   'rejected',
  REMOVED:    'removed',
});

/** Conservação (só para product_used). */
export const CONDITION = Object.freeze({
  NEW_SEALED: 'new_sealed',
  NEW_OPEN:   'new_open',
  LIKE_NEW:   'like_new',
  GOOD:       'good',
  FAIR:       'fair',
  FOR_PARTS:  'for_parts',
});

/** Como chega ao comprador. */
export const FULFILLMENT = Object.freeze({
  PICKUP:   'pickup',
  SHIPPING: 'shipping',
  MEETUP:   'meetup',
  DIGITAL:  'digital',
  ON_SITE:  'on_site',
});

/** Pagamento (Fase 1 sem gateway). */
export const PAYMENT_METHOD = Object.freeze({
  PIX_MANUAL:      'pix_manual',
  CASH_ON_PICKUP:  'cash_on_pickup',
  EXTERNAL_LINK:   'external_link',
  ARENA_WALLET:    'arena_wallet',   // saldo de membro da arena
});

export const ORDER_STATUS = Object.freeze({
  PLACED:            'placed',
  ACCEPTED:          'accepted',
  AWAITING_PAYMENT:  'awaiting_payment',
  PAYMENT_REVIEW:    'payment_review',
  PAID:              'paid',
  PREPARING:         'preparing',
  READY_FOR_PICKUP:  'ready_for_pickup',
  SHIPPED:           'shipped',
  DELIVERED:         'delivered',
  COMPLETED:         'completed',
  CANCELLED_BUYER:   'cancelled_buyer',
  CANCELLED_SELLER:  'cancelled_seller',
  EXPIRED:           'expired',
  DISPUTED:          'disputed',
  REFUNDED:          'refunded',
});

export const OFFER_STATUS = Object.freeze({
  PENDING:     'pending',
  COUNTERED:   'countered',
  ACCEPTED:    'accepted',
  DECLINED:    'declined',
  EXPIRED:     'expired',
  WITHDRAWN:   'withdrawn',
});

export const MODERATION_STATUS = Object.freeze({
  AUTO_APPROVED: 'auto_approved',
  PENDING:       'pending',
  APPROVED:      'approved',
  REJECTED:      'rejected',
  FLAGGED:       'flagged',
});
```

Cada enum tem um `*_LABELS` em pt-BR ao lado (padrão do projeto — ver
`BOOKING_STATUS_LABELS` em `arenas/domain/constants.js`).

## 2. Taxonomia de categorias (`domain/taxonomy.js`)

A taxonomia é **semente em código** (como `catalogSeed.js` faz hoje), com
sobreposição opcional do Firestore (`market_categories`) para o admin
editar sem deploy. Mesma estratégia de merge por chave + tombstone.

```
raquetes/
  ├─ raquete-controle          attrs: marca, peso_g, core_mm, face, grip_mm, formato
  ├─ raquete-potencia
  ├─ raquete-hibrida
  └─ raquete-infantil
bolas/
  ├─ bola-outdoor              attrs: marca, quantidade, cor, aprovacao
  └─ bola-indoor
calcados/                      attrs: marca, numeracao, genero, tipo_solado
vestuario/
  ├─ camisetas                 attrs: marca, tamanho, genero, cor
  ├─ shorts-saias
  ├─ agasalhos
  └─ meias
acessorios/
  ├─ overgrip                  attrs: marca, cor, quantidade
  ├─ protetor-de-borda
  ├─ bolsas-e-mochilas         attrs: marca, capacidade_raquetes
  ├─ oculos-e-protecao
  ├─ munhequeira-e-bone
  └─ elasticos-e-treino
equipamento-de-quadra/
  ├─ redes-e-postes            attrs: tipo, portatil, altura_regulavel
  ├─ marcacao-de-quadra
  ├─ maquina-de-bolas
  └─ iluminacao
saude-e-performance/
  ├─ suplementos               (⚠ ver itens restritos, 13-RISCOS)
  ├─ fisioterapia-e-recuperacao
  └─ hidratacao
servicos/
  ├─ aula-particular           attrs: nivel_alvo, duracao_min, arena_id
  ├─ pacote-de-aulas           attrs: qtd_aulas, validade_dias
  ├─ clinica-e-workshop
  ├─ arbitragem
  ├─ customizacao-de-raquete
  └─ filmagem-e-analise
experiencias/
  ├─ camp-e-imersao            attrs: data_inicio, data_fim, cidade, vagas
  ├─ viagem-e-torneio
  └─ ingresso-de-evento        (⚠ revenda: ver 13-RISCOS §4)
aluguel/
  ├─ aluguel-de-raquete
  └─ aluguel-de-equipamento
outros/
```

### Atributos (facetas)

Cada categoria declara `attributes: [{key, label, type, required, options, unit}]`.
`type ∈ {text, number, select, multiselect, boolean, range}`.
Os atributos:
1. viram **campos do formulário** de anúncio;
2. viram **filtros** na busca (só os `filterable: true`);
3. entram no **índice de texto** (`search_terms`) do anúncio.

Funções puras:
```js
listCategories()                          // árvore completa (semente + overlay)
findCategory(slug)                        // com herança de atributos do pai
attributesFor(slug)                       // atributos efetivos
validateAttributes(slug, values)          // {valid, errors, value}
categoryBreadcrumb(slug)                  // ['Raquetes','Controle']
filterableAttributes(slug)
```

## 3. Máquinas de estado

### 3.1 Anúncio (`domain/listingStatus.js`)

```
draft ──publicar──▶ in_review ──aprovar──▶ active
  │                    │                     │
  │                    └──rejeitar──▶ rejected
  └──agendar──▶ scheduled ──(cron)──▶ in_review

active ⇄ paused            (vendedor)
active ──estoque=0──▶ sold_out ──repor──▶ active
active ──expires_at──▶ expired ──renovar──▶ in_review
qualquer ──moderação──▶ removed  (terminal, só admin reverte)
```

`canTransitionListing(from, to, actor)` — pura, tabelada, testada.
`actor ∈ {'seller','admin','system'}`.

Se a config do admin for `moderation_mode: 'post'`, `publicar` vai direto
para `active` com `moderation_status: 'auto_approved'` e a moderação é
posterior. Se for `'pre'`, passa por `in_review`.

### 3.2 Oferta (`domain/offers.js`)

```
pending ──vendedor aceita──▶ accepted ──(gera pedido)──▶ fim
   │  ├──vendedor contrapropõe──▶ countered ──comprador aceita──▶ accepted
   │  │                                └──comprador contrapropõe──▶ pending (rodada+1)
   │  ├──vendedor recusa──▶ declined
   │  ├──comprador retira──▶ withdrawn
   │  └──expires_at (72h)──▶ expired
```
Regras:
- Máximo `max_rounds` (default 4) de idas e vindas — depois só aceita ou recusa.
- Uma oferta `pending` por (comprador, anúncio). Nova substitui a anterior.
- Oferta abaixo de `min_acceptable_price` (privado) pode ser **auto-recusada**
  se o vendedor ligou `auto_decline_below`.
- Aceitar a oferta **reserva** a unidade por `hold_minutes` (default 60) —
  `reserved_until` no anúncio. Expirou, libera.
- `applyOffer(offer, action, payload)` → novo estado + evento, pura.

### 3.3 Pedido (`domain/orderStatus.js`)

```
                     ┌──────── cancelled_buyer  (até accepted)
placed ──aceita──▶ accepted ──▶ awaiting_payment
   └──recusa──▶ cancelled_seller       │
                                        │ comprador envia comprovante
                                        ▼
                                 payment_review
                                        │ vendedor confere
                        ┌───────────────┴───────────────┐
                   (recusa)                          (confirma)
                        ▼                                ▼
                 awaiting_payment                      paid
                                                         │
                                              ┌──────────┴──────────┐
                                     entrega=pickup           entrega=shipping
                                              ▼                     ▼
                                     ready_for_pickup         preparing ─▶ shipped
                                              └──────────┬──────────┘
                                                         ▼
                                                    delivered
                                                         │ confirma recebimento
                                                         ▼   (ou auto em 7 dias)
                                                    completed  ──▶ avaliações liberadas
qualquer(≤delivered) ──abrir disputa──▶ disputed ──▶ refunded | completed
awaiting_payment ──payment_deadline──▶ expired
```

`canTransitionOrder(from, to, actor)` com `actor ∈ {'buyer','seller','admin','system'}`.
`nextActionsFor(order, viewerRole)` → lista de ações permitidas **e visíveis**
(princípio: ação sem permissão não é renderizada).
Cada transição grava um `market_order_events` (trilha imutável).

### 3.4 Disputa (`domain/disputes.js`)
```
open ──▶ under_review ──▶ resolved_refund | resolved_release | inconclusive
```

## 4. Preço, totais e taxa (`domain/pricing.js`)

```js
computeOrderTotals({ items, shipping, discount, feeConfig })
// → { subtotal, shipping_total, discount_total, platform_fee, total,
//     seller_net, breakdown[] }
```
- Fase 1: `platform_fee = 0` sempre (config `fee_percent: 0`), mas o cálculo
  já existe e é testado, para a Fase 3 ser só configuração.
- Todo dinheiro em **centavos inteiros** (`price_cents`). Nunca float.
  `formatBRL(cents)` e `parseBRL(str)` no domínio, testados com casos
  clássicos (`"1.234,56"`, `"R$ 1234,56"`, `"1234.56"`).
- `isPriceSane(cents, category)` — heurística de faixa por categoria; só
  avisa, não bloqueia.
- `computeShipping({ fulfillment, sellerConfig, buyerState })` — Fase 1:
  fixo por região declarado pelo vendedor (`shipping_rules[]`), ou "a combinar".

## 5. Elegibilidade e limites (`domain/eligibility.js`)

```js
canSell(user, sellerProfile, config) → { allowed, reasons[] }
```
Checagens (todas configuráveis pelo admin):
- perfil obrigatório completo (`isRequiredProfileComplete` do `core/lib`);
- e-mail verificado; telefone informado;
- aceite dos Termos do Mercado (`legal_consents`);
- conta com idade mínima (`min_account_age_days`, default 0);
- tipo de vendedor habilitado na config global;
- sem strike ativo bloqueante (`content_strikes`, ver docs/18);
- limite de anúncios ativos por tier:
  `athlete: 20 · coach: 50 · club: 50 · arena: 200 · store: 1000 · platform: ∞`;
- limite de novos anúncios por dia (anti-spam): `athlete: 10`.

```js
canBuy(user, listing, config) → { allowed, reasons[] }
```
- não é o próprio vendedor; não está bloqueado pelo vendedor
  (`user_blocks`, docs/18); anúncio `active`; estoque > 0; vendedor não
  está em modo férias; `wanted`/`donation` não geram pedido.

## 6. Busca e relevância (`domain/search.js`)

Fase 1 é **busca client-side sobre uma janela consultada no Firestore**
(mesmo padrão da busca global existente), porque Firestore não faz
full-text. Estratégia:

1. **Query no Firestore** por facetas indexáveis: `status`, `category_slug`,
   `state`, `city`, `seller_type`, `price_cents` (range), ordenado por
   `created_at` ou `price_cents`. Limite de 200-500 docs.
2. **Refino puro no cliente**: texto (normalizado, sem acento, tokenizado
   contra `search_terms[]` denormalizado no anúncio), atributos, raio
   geográfico (haversine sobre `geo.lat/lng`), aceita-oferta, nota mínima.
3. **Score de relevância** (pura, testada):

```
score = 0.35·textMatch          (título > atributos > descrição)
      + 0.20·proximity          (mesma cidade=1, estado=0.6, raio decai)
      + 0.15·sellerTrust        (nota média × log(nº vendas) normalizado)
      + 0.15·freshness          (decaimento exponencial, meia-vida 7 dias)
      + 0.10·engagement         (favoritos + cliques normalizados)
      + 0.05·completeness       (fotos, atributos preenchidos, política)
      + boost                   (promoção ativa, aditivo e SINALIZADO na UI)
```

`rankListings(listings, query, context)` → array ordenado + `explain` por
item (por que apareceu) — o `explain` alimenta o "Por que estou vendo isto".

**Fase 4**: quando passar de ~5k anúncios ativos, migrar para Algolia/
Typesense ou um índice invertido em Cloud Function. O contrato de
`rankListings` não muda; muda só a origem dos candidatos.

## 7. `search_terms` — o truque que faz a busca funcionar

Ao salvar um anúncio, o service denormaliza no documento:
```js
search_terms: buildSearchTerms({ title, brand, category, attributes, city })
// → ['selkirk','vanguard','raquete','controle','sao','paulo','usado', ...]
//   minúsculo, sem acento, sem stopword, deduplicado, máx. 60 termos
```
Permite `array-contains` no Firestore para uma primeira filtragem barata e
casamento exato no cliente. `buildSearchTerms` é pura e testada.

## 8. Reputação (`domain/reputation.js`)

```js
computeSellerStats(reviews, orders) → {
  rating_avg, rating_count, rating_histogram,
  sales_count, completion_rate, cancel_rate,
  avg_response_minutes, avg_ship_hours,
  badges: ['verificado','resposta_rapida','vendedor_destaque', ...]
}
```
Regras:
- **Só quem concluiu um pedido avalia.** Sem pedido, sem avaliação. Isso
  mata avaliação falsa na raiz.
- Avaliação é **mútua e cega**: as duas só ficam públicas quando ambas foram
  enviadas ou após 14 dias — evita retaliação.
- Nota do vendedor = média ponderada com decaimento (últimos 12 meses pesam
  mais). `rating_avg` só aparece com ≥ 3 avaliações; abaixo disso mostra
  "novo vendedor".
- Badges são derivados, nunca escritos à mão (exceto `verificado`, que o
  admin concede).

## 9. Arquivos previstos em `domain/` (com contagem de testes alvo)

| Arquivo | Responsabilidade | Testes |
|---|---|---|
| `constants.js` | enums + labels + nomes de coleção | 6 |
| `taxonomy.js` | árvore, herança, atributos | 22 |
| `taxonomySeed.js` | semente das categorias | 4 |
| `listing.js` | normalizar/validar input de anúncio | 26 |
| `listingStatus.js` | máquina de estado do anúncio | 18 |
| `offers.js` | ofertas, rodadas, expiração, auto-recusa | 24 |
| `orderStatus.js` | máquina de estado do pedido | 30 |
| `order.js` | montar pedido a partir de anúncio/oferta | 16 |
| `pricing.js` | totais, taxa, centavos, BRL, frete | 28 |
| `eligibility.js` | canSell / canBuy / limites | 20 |
| `search.js` | filtros, score, explain, haversine | 26 |
| `searchTerms.js` | normalização e tokenização | 14 |
| `reputation.js` | agregados, badges, cegueira mútua | 18 |
| `disputes.js` | máquina de estado da disputa | 10 |
| `sellerProfile.js` | normalização do perfil de vendedor | 12 |
| `promotions.js` | destaque, janela, boost no score | 10 |
| **Total** | | **~284** |
