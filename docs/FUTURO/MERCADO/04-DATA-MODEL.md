# 16.04 — Modelo de dados do Mercado

> **Aditividade**: 16 coleções novas, todas com prefixo `market_`. Nenhuma
> coleção existente muda de shape. Nenhum campo obrigatório é adicionado a
> nada que já exista. Convenções do projeto: `snake_case` nos campos,
> `created_at`/`updated_at` com `serverTimestamp()`, ids determinísticos
> quando a unicidade é natural.

## Índice das coleções

| # | Coleção | Id | Volume esperado/ano | Dono |
|---|---|---|---|---|
| 1 | `market_sellers` | `{uid}` ou `{type}_{entityId}` | ~2k | vendedor |
| 2 | `market_listings` | auto | ~20k | vendedor |
| 3 | `market_listing_stats` | `{listingId}` | ~20k | sistema |
| 4 | `market_offers` | auto | ~15k | comprador |
| 5 | `market_orders` | auto | ~8k | comprador+vendedor |
| 6 | `market_order_events` | auto (subcoleção) | ~60k | sistema |
| 7 | `market_reviews` | `{orderId}_{authorUid}` | ~10k | autor |
| 8 | `market_favorites` | `{uid}_{listingId}` | ~40k | usuário |
| 9 | `market_saved_searches` | auto | ~5k | usuário |
| 10 | `market_categories` | `{slug}` | ~80 | admin |
| 11 | `market_promotions` | auto | ~1k | admin |
| 12 | `market_disputes` | `{orderId}` | ~200 | sistema |
| 13 | `market_seller_stats` | `{sellerKey}` | ~2k | sistema |
| 14 | `market_wanted_matches` | `{wantedId}_{listingId}` | ~10k | sistema |
| 15 | `market_shipping_zones` | auto | ~3k | vendedor |
| 16 | `market_reports` | — | ver docs/18 (`content_reports`) | — |

`market_reports` **não existe**: denúncia é unificada com o Feed em
`content_reports` (docs/18). Não crie uma coleção de denúncia só do Mercado.

---

## 1. `market_sellers/{sellerKey}`

Perfil de vendedor. `sellerKey` é **determinístico**:
- atleta: `athlete_{uid}`
- arena: `arena_{arenaId}`
- professor: `coach_{uid}`
- clube: `club_{clubId}`
- loja: `store_{storeId}` (id gerado no cadastro aprovado pelo admin)
- plataforma: `platform_main`

```js
{
  seller_key: 'athlete_Kx7CC0...',   // == id do doc
  seller_type: 'athlete',            // SELLER_TYPE
  entity_id:  'Kx7CC0...',           // uid | arenaId | clubId | storeId
  owner_uid:  'Kx7CC0...',           // quem responde por ele (para regras)
  manager_uids: ['uid1','uid2'],     // arena/clube/loja: quem pode operar
                                     //   (derivado de arena_managers/club_members
                                     //    na criação; revalidado nas regras)

  display_name: 'Fernando S.',
  slug: 'fernando-s',                // único; usado em /mercado/vendedor/:slug
  avatar_url: '', cover_url: '',
  bio: '', city: '', state: '',
  geo: { lat: -23.55, lng: -46.63 }, // opcional, só para "perto de mim"

  // Contato — NUNCA exibido publicamente
  contact: { phone: '', email: '', whatsapp_optin: false },

  // Pagamento (Fase 1: Pix manual)
  payment: {
    pix_key: '', pix_key_type: 'cpf'|'cnpj'|'email'|'phone'|'random',
    receiver_name: '', qr_code_url: '', instructions: '',
  },

  // Políticas públicas
  policies: {
    return_days: 7,                  // 0 = não aceita devolução
    return_text: '',
    ship_within_hours: 48,
    warranty_text: '',
    terms_text: '',
  },

  default_fulfillment: ['pickup','shipping'],
  pickup_locations: [{ label:'Arena X', arena_id:'', address:'', city:'', state:'' }],

  status: 'active'|'pending'|'suspended'|'banned',
  vacation_mode: false, vacation_until: null, vacation_message: '',

  verified: false, verified_at: null, verified_by: null,   // selo do admin
  cnpj: '',                                                 // só store
  tier: 'free'|'pro',                                       // Fase 5
  limits_override: null,                                    // admin pode elevar

  terms_accepted_at: <ts>, terms_version: 'market_terms_v1',

  created_at, updated_at, created_by,
}
```

## 2. `market_listings/{id}` ⭐ coleção central

```js
{
  // --- identidade -------------------------------------------------------
  seller_key: 'athlete_Kx7...', seller_type: 'athlete',
  seller_uid: 'Kx7...',              // denormalizado p/ regras baratas
  seller_name: '', seller_avatar_url: '', seller_verified: false,
  seller_rating_avg: 4.9, seller_rating_count: 12,   // denormalizado (cron)

  // --- conteúdo ---------------------------------------------------------
  type: 'product_used',              // LISTING_TYPE
  title: 'Raquete Selkirk Vanguard Power Air',    // ≤ 90
  slug: 'raquete-selkirk-vanguard-power-air',
  description: '',                   // ≤ 4000, texto simples (sem HTML)
  category_slug: 'raquete-controle',
  category_path: ['raquetes','raquete-controle'],
  brand: 'Selkirk',
  condition: 'like_new',             // só product_used
  attributes: { peso_g: 225, core_mm: 16, grip_mm: 108, cor: 'preto' },
  catalog_ref: 'catalog_products/abc123',   // opcional (typeahead)

  media: [
    { url:'', path:'', width:1200, height:1200, kind:'image',
      alt:'', is_cover:true, order:0 },
  ],                                  // 1..10, obrigatória ≥1 (exceto wanted)

  // --- comércio ---------------------------------------------------------
  price_cents: 69000,
  compare_at_cents: null,            // "de/por"
  currency: 'BRL',
  accepts_offers: true,
  min_acceptable_cents: 60000,       // PRIVADO — regras impedem leitura pública
  auto_decline_below: true,
  quantity: 1, quantity_sold: 0,
  variants: [                        // opcional, simples
    { id:'v1', label:'Tamanho M', price_cents:null, quantity:3, sku:'' },
  ],
  reserved_until: null, reserved_for_uid: null,   // hold de oferta aceita

  // --- entrega ----------------------------------------------------------
  fulfillment: ['pickup','shipping'],
  pickup_location: { label:'', arena_id:'', city:'', state:'' },
  shipping: { mode:'fixed'|'to_agree'|'free', fixed_cents: 2500,
              zones_ref: 'market_shipping_zones/xyz', days_estimate: 5 },

  // --- localização e busca ---------------------------------------------
  city: 'São Paulo', state: 'SP',
  geo: { lat: -23.55, lng: -46.63 },
  search_terms: ['selkirk','vanguard','raquete', ...],   // ≤ 60

  // --- ciclo de vida ----------------------------------------------------
  status: 'active',                  // LISTING_STATUS
  moderation_status: 'auto_approved',// MODERATION_STATUS
  moderation_notes: '', moderated_by: null, moderated_at: null,
  published_at: <ts>, scheduled_for: null,
  expires_at: <ts>,                  // default +60 dias; cron expira
  renewed_count: 0,
  sold_at: null, sold_order_id: null,

  // --- destaque ---------------------------------------------------------
  promoted: false, promotion_id: null, promoted_until: null,

  // --- origem (integrações) --------------------------------------------
  source: { kind:'arena_product'|'coach_package'|'manual',
            id:'', sync:true },      // espelho: preço/estoque vêm da origem

  // --- contadores leves (o pesado vai em market_listing_stats) ----------
  favorite_count: 0, offer_count: 0, question_count: 0,

  created_at, updated_at, created_by,
}
```

**Notas de modelagem**
- `min_acceptable_cents` num doc público é um risco. Duas saídas:
  (a) guardar num doc irmão privado `market_listings/{id}/private/pricing`
  (subcoleção com regra restrita) — **escolhida**; (b) só no cliente do
  vendedor. Vamos de (a): o campo **não** fica no doc principal.
- `search_terms` limitado a 60 por causa do limite de `array-contains`
  e do tamanho do doc.
- Fotos ficam no Storage em `uploads/{uid}/market/{listingId}/...`.

### 2b. `market_listings/{id}/private/pricing` (subcoleção)
```js
{ min_acceptable_cents: 60000, auto_decline_below: true, cost_cents: null,
  internal_notes: '' }
```
Leitura: só vendedor e admin. Nunca vai pro cliente comprador.

## 3. `market_listing_stats/{listingId}`
```js
{ listing_id, seller_key,
  impressions: 0, views: 0, unique_views: 0,
  favorites: 0, contacts: 0, offers: 0, orders: 0,
  views_by_day: { '2026-09-06': 12 },   // últimos 30 dias, rolling
  updated_at }
```
Escrito por incremento (`increment()`) pelo cliente com regra restrita a
campos de contador — ou, melhor, por Cloud Function `onDocumentCreated` de
eventos. Fase 1: incremento client-side com `hasOnly` nas regras.

## 4. `market_offers/{id}`
```js
{ listing_id, listing_title, listing_cover_url,
  seller_key, seller_uid, buyer_uid, buyer_name, buyer_avatar_url,
  list_price_cents: 69000,
  amount_cents: 62000,               // valor da rodada atual
  message: '',
  status: 'pending',                 // OFFER_STATUS
  round: 1, max_rounds: 4,
  history: [ { by:'buyer', amount_cents:62000, message:'', at:<ts> },
             { by:'seller', amount_cents:65000, message:'', at:<ts> } ],
  expires_at: <ts>,                  // +72h, renovado a cada rodada
  accepted_at: null, order_id: null,
  conversation_id: null,             // chat contextual (módulo chat/)
  created_at, updated_at }
```

## 5. `market_orders/{id}` ⭐
```js
{
  code: 'PR-8F3K2',                  // legível, para falar no chat
  buyer_uid, buyer_name, buyer_avatar_url,
  seller_key, seller_uid, seller_type, seller_name,

  items: [{                          // Fase 1: sempre 1 item
    listing_id, title, cover_url, variant_id: null, variant_label: '',
    unit_price_cents: 65000, quantity: 1, subtotal_cents: 65000,
    snapshot: { category_slug, condition, brand },   // congela o anunciado
  }],

  offer_id: null,                    // se veio de oferta aceita

  totals: { subtotal_cents, shipping_cents, discount_cents,
            platform_fee_cents: 0, total_cents, seller_net_cents },

  fulfillment: 'pickup',             // FULFILLMENT escolhido
  pickup: { label:'Arena X', address:'', city:'', state:'', when_text:'' },
  shipping_address: {                // só shipping; revelado após 'accepted'
    name:'', phone:'', zip:'', street:'', number:'', complement:'',
    district:'', city:'', state:'' },
  tracking: { carrier:'', code:'', url:'', shipped_at:null,
              delivered_at:null },

  payment: { method:'pix_manual', status:'pending',
             pix_key_snapshot:'', receiver_name:'',
             proof: { url:'', path:'', sent_at:null },
             confirmed_at:null, confirmed_by:null, deadline_at:<ts> },

  status: 'placed',                  // ORDER_STATUS
  status_history: [{ status:'placed', at:<ts>, by:'uid', role:'buyer' }],

  buyer_note: '', seller_note: '',
  cancel_reason: '', cancelled_by: null,

  review_buyer_id: null, review_seller_id: null,   // ids em market_reviews
  dispute_id: null,
  conversation_id: null,

  auto_complete_at: null,            // delivered + 7 dias
  created_at, updated_at }
```

**Snapshot é sagrado**: o pedido guarda cópia do que foi anunciado. Se o
vendedor editar o anúncio depois, o pedido não muda. Isso é prova em disputa.

## 6. `market_orders/{orderId}/events/{eventId}` (subcoleção)
Trilha imutável — só create, nunca update/delete (nem pelo admin).
```js
{ type:'status_change'|'message'|'payment_proof'|'moderation'|'system',
  from_status:'accepted', to_status:'awaiting_payment',
  actor_uid, actor_role:'seller', note:'', meta:{}, at:<ts> }
```

## 7. `market_reviews/{orderId}_{authorUid}`
Id determinístico: **uma avaliação por pedido por pessoa**, impossível
duplicar.
```js
{ order_id, listing_id, seller_key,
  author_uid, author_name, author_avatar_url,
  author_role: 'buyer'|'seller',
  target_key: 'athlete_...'|'uid',   // quem está sendo avaliado
  rating: 5,                         // 1..5
  criteria: { description_match:5, communication:5, shipping_speed:4 },
  comment: '',                       // ≤ 1000
  media: [],                         // até 3 fotos
  visible: false,                    // vira true na cegueira mútua
  response: { text:'', at:null },    // resposta pública do avaliado
  reported: false,
  created_at, updated_at }
```

## 8. `market_favorites/{uid}_{listingId}`
```js
{ user_id, listing_id, seller_key, price_cents_at_save, created_at }
```
`price_cents_at_save` permite avisar "baixou de preço".

## 9. `market_saved_searches/{id}`
```js
{ user_id, label:'Raquete até 800 em SP',
  query: { text:'', category_slug:'', filters:{}, sort:'' },
  alert: true, alert_channel:['in_app','push'],
  last_notified_at, match_count, created_at }
```

## 10. `market_categories/{slug}` (overlay do admin sobre a semente)
```js
{ slug, parent_slug, label, icon, sort_order, active:true,
  attributes:[{key,label,type,required,filterable,options,unit}],
  status:'active'|'removed',        // 'removed' = tombstone sobre a semente
  updated_at, updated_by }
```

## 11. `market_promotions/{id}`
```js
{ listing_id, seller_key, kind:'featured'|'category_top'|'home_banner',
  starts_at, ends_at, boost_weight: 0.2,
  granted_by:'admin_uid', paid:false, amount_cents:0, note:'',
  active:true, created_at }
```

## 12. `market_disputes/{orderId}`
```js
{ order_id, opened_by:'buyer', reason:'not_received'|'not_as_described'|
    'damaged'|'seller_no_show'|'other',
  description:'', evidence:[{url,path,by}],
  status:'open'|'under_review'|'resolved_refund'|'resolved_release'|'inconclusive',
  assigned_admin_uid:null, resolution_note:'', resolved_at:null,
  messages_conversation_id:null, created_at, updated_at }
```

## 13. `market_seller_stats/{sellerKey}`
Agregado recalculado por Cloud Function.
```js
{ seller_key, rating_avg, rating_count, rating_histogram:{1:0,...,5:12},
  sales_count, gmv_cents, completion_rate, cancel_rate,
  avg_response_minutes, avg_ship_hours,
  active_listings, badges:['resposta_rapida'], last_sale_at, updated_at }
```

## 14. `market_wanted_matches/{wantedId}_{listingId}`
```js
{ wanted_id, wanted_uid, listing_id, seller_key, score, notified_at, created_at }
```

## 15. `market_shipping_zones/{id}`
```js
{ seller_key, label:'Sudeste', states:['SP','RJ','MG','ES'],
  price_cents: 2500, free_above_cents: 30000, days_estimate: 5, active:true }
```

## 16. `platform_settings/marketplace` (documento único de configuração)
```js
{
  enabled_seller_types: ['athlete','arena','coach','club','store','platform'],
  moderation_mode: 'post',           // 'pre' | 'post'
  auto_moderation: { banned_terms:[], min_photos:1, price_sanity:true },
  fee_percent: 0, fee_min_cents: 0,
  listing_ttl_days: 60,
  offer_ttl_hours: 72, offer_max_rounds: 4, offer_hold_minutes: 60,
  payment_deadline_hours: 48,
  auto_complete_days: 7,
  dispute_window_days: 7,
  limits: { athlete:{active:20,per_day:10}, coach:{active:50,per_day:20},
            club:{active:50,per_day:20}, arena:{active:200,per_day:50},
            store:{active:1000,per_day:200} },
  prohibited_categories: [],
  require_verified_email: true, require_phone: true, min_account_age_days: 0,
  allow_wanted: true, allow_donation: true,
  home_banner: { active:false, image_url:'', link:'', title:'' },
  terms_version: 'market_terms_v1',
  updated_at, updated_by,
}
```
Fica **fora** de `platform_settings/global` (que hoje guarda as flags) para
não inchar um doc lido em toda sessão.

---

## Índices compostos necessários (`firestore.indexes.json`)

Aditivo — só acrescente ao array `indexes`.

```jsonc
// --- listagem pública ---
market_listings: [status ASC, published_at DESC]
market_listings: [status ASC, category_slug ASC, published_at DESC]
market_listings: [status ASC, state ASC, city ASC, published_at DESC]
market_listings: [status ASC, category_slug ASC, price_cents ASC]
market_listings: [status ASC, seller_type ASC, published_at DESC]
market_listings: [status ASC, search_terms ARRAY, published_at DESC]
market_listings: [status ASC, promoted DESC, published_at DESC]
market_listings: [status ASC, type ASC, published_at DESC]
// --- painel do vendedor ---
market_listings: [seller_key ASC, status ASC, updated_at DESC]
market_listings: [seller_key ASC, created_at DESC]
// --- moderação/cron ---
market_listings: [moderation_status ASC, created_at ASC]
market_listings: [status ASC, expires_at ASC]
market_listings: [status ASC, scheduled_for ASC]
// --- ofertas ---
market_offers: [seller_key ASC, status ASC, created_at DESC]
market_offers: [buyer_uid ASC, status ASC, created_at DESC]
market_offers: [listing_id ASC, status ASC, created_at DESC]
market_offers: [status ASC, expires_at ASC]
// --- pedidos ---
market_orders: [buyer_uid ASC, created_at DESC]
market_orders: [seller_key ASC, status ASC, created_at DESC]
market_orders: [seller_uid ASC, created_at DESC]
market_orders: [status ASC, payment.deadline_at ASC]
market_orders: [status ASC, auto_complete_at ASC]
// --- avaliações ---
market_reviews: [target_key ASC, visible ASC, created_at DESC]
market_reviews: [order_id ASC, created_at DESC]
market_reviews: [author_uid ASC, created_at DESC]
// --- favoritos / buscas ---
market_favorites: [user_id ASC, created_at DESC]
market_saved_searches: [user_id ASC, created_at DESC]
market_saved_searches: [alert ASC, last_notified_at ASC]
// --- promoções ---
market_promotions: [active ASC, ends_at ASC]
// --- vendedores ---
market_sellers: [status ASC, seller_type ASC, created_at DESC]
market_sellers: [owner_uid ASC]
```

**~31 índices novos** (hoje o projeto tem 32 no total — vai dobrar; é
esperado para um marketplace e cada um é justificado por uma query real
listada em `services/`).

## Estimativa de custo (Firestore + Storage)

Premissa: 3.000 usuários ativos/mês, 20k anúncios, 8k pedidos/ano.

| Item | Volume/mês | Custo aprox. |
|---|---|---|
| Leituras (vitrine 200 docs × 15k sessões) | ~3M | US$ 1,80 |
| Leituras (detalhe, painel, pedidos) | ~1,5M | US$ 0,90 |
| Escritas | ~120k | US$ 0,22 |
| Storage de fotos (20k anúncios × 5 fotos × 400KB) | 40 GB | US$ 1,04/mês |
| Egress de imagens | ~300 GB | US$ 36,00 ⚠ |

**O egress de imagem é o custo dominante.** Mitigações obrigatórias na
Onda U3 (não são "nice to have"):
1. Redimensionar no cliente antes do upload (máx. 1600px, WebP, ~150KB).
2. Gerar e usar **thumbnail de 400px** nos cards da vitrine.
3. `cacheControl: public, max-age=31536000, immutable` (já é o padrão do
   `storageService`).
4. Paginação real (24 por página), nunca carregar a vitrine inteira.
