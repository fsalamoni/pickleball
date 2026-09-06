# 16.05 — Regras de segurança do Mercado

> **Aditividade absoluta**: apenas blocos `match` novos ao final do arquivo
> e helpers novos junto dos existentes. Nenhuma regra atual é tocada.
> Toda regra abaixo precisa de asserção no emulador antes do merge.

## 1. Helpers novos (junto dos que já existem no topo do `firestore.rules`)

```javascript
// ---- Mercado ----------------------------------------------------------
function marketSellerData(sellerKey) {
  return get(/databases/$(database)/documents/market_sellers/$(sellerKey)).data;
}
function marketSellerExists(sellerKey) {
  return exists(/databases/$(database)/documents/market_sellers/$(sellerKey));
}
// Quem opera um vendedor: o dono, ou alguém na lista de gestores.
// Para arena e clube, a lista é derivada na criação E revalidada aqui contra
// as coleções canônicas — assim revogar um gestor de arena revoga a venda.
function isMarketSeller(sellerKey) {
  return isAuthed() && marketSellerExists(sellerKey) && (
    marketSellerData(sellerKey).owner_uid == request.auth.uid
    || (marketSellerData(sellerKey).get('manager_uids', []).hasAny([request.auth.uid]))
    || (marketSellerData(sellerKey).seller_type == 'arena'
        && isArenaManager(marketSellerData(sellerKey).entity_id))
    || (marketSellerData(sellerKey).seller_type == 'club'
        && isClubAdmin(marketSellerData(sellerKey).entity_id))
  );
}
function marketSellerActive(sellerKey) {
  return marketSellerExists(sellerKey)
    && marketSellerData(sellerKey).status == 'active';
}
function marketOrderData(orderId) {
  return get(/databases/$(database)/documents/market_orders/$(orderId)).data;
}
function isOrderBuyer(orderId) {
  return isAuthed() && marketOrderData(orderId).buyer_uid == request.auth.uid;
}
function isOrderSeller(orderId) {
  return isAuthed() && isMarketSeller(marketOrderData(orderId).seller_key);
}
function isOrderParty(orderId) {
  return isOrderBuyer(orderId) || isOrderSeller(orderId) || isPlatformAdmin();
}
// Anúncio visível ao público.
function listingIsPublic() {
  return resource.data.status in ['active','sold_out','paused'];
}
```

## 2. Blocos `match`

### `market_sellers`
```javascript
match /market_sellers/{sellerKey} {
  // Perfil público do vendedor é lido por qualquer autenticado — MAS os
  // campos sensíveis (contact, payment.pix_key) nunca devem ir ao cliente
  // comprador. Como as regras do Firestore não filtram campos, esses dados
  // moram numa SUBCOLEÇÃO privada (abaixo). O doc principal é público.
  allow read: if isAuthed();

  allow create: if isAuthed()
    && request.resource.data.owner_uid == request.auth.uid
    && request.resource.data.status in ['active','pending']
    && !request.resource.data.keys().hasAny(['verified','tier','limits_override']);

  allow update: if (isMarketSeller(sellerKey)
      && request.resource.data.owner_uid == resource.data.owner_uid
      && request.resource.data.seller_type == resource.data.seller_type
      && request.resource.data.entity_id == resource.data.entity_id
      && !request.resource.data.diff(resource.data).affectedKeys()
             .hasAny(['verified','verified_at','verified_by','tier',
                      'limits_override','status']))
    || isPlatformAdmin();

  allow delete: if isPlatformAdmin();

  // Dados sensíveis: contato e chave Pix. Só o vendedor e o admin leem.
  // O comprador recebe a chave Pix pelo PEDIDO (snapshot), nunca daqui.
  match /private/{docId} {
    allow read, write: if isMarketSeller(sellerKey) || isPlatformAdmin();
  }
}
```

### `market_listings`
```javascript
match /market_listings/{listingId} {
  // Público: qualquer autenticado vê anúncios publicados. Rascunho, em
  // revisão, rejeitado e removido só o dono e o admin veem.
  allow read: if isAuthed() && (
    listingIsPublic()
    || isMarketSeller(resource.data.seller_key)
    || isPlatformAdmin()
  );

  allow create: if isAuthed()
    && isMarketSeller(request.resource.data.seller_key)
    && marketSellerActive(request.resource.data.seller_key)
    && request.resource.data.created_by == request.auth.uid
    && request.resource.data.seller_uid == request.auth.uid
    && request.resource.data.status in ['draft','scheduled','in_review','active']
    // campos que só o sistema/admin escreve
    && !request.resource.data.keys().hasAny([
         'promoted','promotion_id','promoted_until','moderated_by',
         'moderated_at','seller_verified','quantity_sold','sold_order_id',
         'min_acceptable_cents']);

  allow update: if
    // Dono edita o próprio anúncio, sem tocar em campos de sistema.
    (isMarketSeller(resource.data.seller_key)
      && request.resource.data.seller_key == resource.data.seller_key
      && request.resource.data.seller_uid == resource.data.seller_uid
      && !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['promoted','promotion_id','promoted_until',
                     'moderation_status','moderated_by','moderated_at',
                     'seller_verified','quantity_sold','sold_order_id',
                     'created_by','created_at','min_acceptable_cents'])
      && request.resource.data.status in
           ['draft','scheduled','in_review','active','paused','sold_out','expired'])
    // Qualquer autenticado pode incrementar SÓ os contadores leves.
    || (isAuthed() && listingIsPublic()
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['favorite_count','question_count','updated_at']))
    // Comprador reserva a unidade ao ter uma oferta aceita: só o sistema
    // (via transação do vendedor) mexe em reserved_*; por isso fica com o
    // vendedor, não com o comprador.
    || isPlatformAdmin();

  allow delete: if isPlatformAdmin();
  // Vendedor NÃO deleta: ele muda status para 'removed'/'expired'. Assim o
  // histórico de pedidos nunca aponta para um documento inexistente.

  match /private/{docId} {
    allow read, write: if isMarketSeller(get(/databases/$(database)/documents/
        market_listings/$(listingId)).data.seller_key) || isPlatformAdmin();
  }
}
```

### `market_offers`
```javascript
match /market_offers/{offerId} {
  allow read: if isAuthed() && (
    resource.data.buyer_uid == request.auth.uid
    || isMarketSeller(resource.data.seller_key)
    || isPlatformAdmin());

  allow create: if isAuthed()
    && request.resource.data.buyer_uid == request.auth.uid
    && request.resource.data.status == 'pending'
    && request.resource.data.round == 1
    && request.resource.data.amount_cents is int
    && request.resource.data.amount_cents > 0
    && exists(/databases/$(database)/documents/market_listings/$(request.resource.data.listing_id))
    // não se auto-oferta
    && get(/databases/$(database)/documents/market_listings/$(request.resource.data.listing_id))
         .data.seller_uid != request.auth.uid;

  allow update: if isAuthed() && (
    // vendedor: aceitar, recusar, contrapropor
    (isMarketSeller(resource.data.seller_key)
      && request.resource.data.status in ['accepted','declined','countered'])
    // comprador: retirar, aceitar contraproposta, contrapropor de volta
    || (resource.data.buyer_uid == request.auth.uid
      && request.resource.data.status in ['withdrawn','accepted','pending'])
  ) && request.resource.data.listing_id == resource.data.listing_id
    && request.resource.data.buyer_uid == resource.data.buyer_uid;

  allow delete: if isPlatformAdmin();
}
```

### `market_orders`
```javascript
match /market_orders/{orderId} {
  allow read: if isAuthed() && (
    resource.data.buyer_uid == request.auth.uid
    || isMarketSeller(resource.data.seller_key)
    || isPlatformAdmin());

  allow create: if isAuthed()
    && request.resource.data.buyer_uid == request.auth.uid
    && request.resource.data.status == 'placed'
    && request.resource.data.totals.platform_fee_cents == 0   // Fase 1
    && request.resource.data.payment.status == 'pending'
    && !request.resource.data.keys().hasAny(['dispute_id','review_buyer_id',
                                             'review_seller_id']);

  allow update: if isAuthed() && (
      resource.data.buyer_uid == request.auth.uid
      || isMarketSeller(resource.data.seller_key)
      || isPlatformAdmin()
    )
    // campos imutáveis do pedido
    && request.resource.data.buyer_uid == resource.data.buyer_uid
    && request.resource.data.seller_key == resource.data.seller_key
    && request.resource.data.items == resource.data.items
    && request.resource.data.totals == resource.data.totals
    && request.resource.data.code == resource.data.code;
  // A validade da TRANSIÇÃO (placed→accepted etc.) é garantida no domínio +
  // service. As regras garantem a AUTORIZAÇÃO e a imutabilidade do que
  // importa. Testar as duas coisas — ver 12-TESTES.

  allow delete: if false;   // pedido nunca é apagado, nem pelo admin

  match /events/{eventId} {
    allow read: if isOrderParty(orderId);
    allow create: if isOrderParty(orderId)
      && request.resource.data.actor_uid == request.auth.uid;
    allow update, delete: if false;   // trilha imutável
  }
}
```

### `market_reviews`
```javascript
match /market_reviews/{reviewId} {
  // Só avaliações liberadas (cegueira mútua) são públicas.
  allow read: if isAuthed() && (
    resource.data.visible == true
    || resource.data.author_uid == request.auth.uid
    || resource.data.target_key == 'athlete_' + request.auth.uid
    || isPlatformAdmin());

  // Id determinístico {orderId}_{authorUid} garante 1 avaliação por parte.
  allow create: if isAuthed()
    && reviewId == request.resource.data.order_id + '_' + request.auth.uid
    && request.resource.data.author_uid == request.auth.uid
    && request.resource.data.rating is int
    && request.resource.data.rating >= 1 && request.resource.data.rating <= 5
    // só quem é parte de um pedido CONCLUÍDO avalia
    && isOrderParty(request.resource.data.order_id)
    && marketOrderData(request.resource.data.order_id).status == 'completed';

  allow update: if isAuthed() && (
    // autor edita o texto por 48h (checagem fina no service)
    (resource.data.author_uid == request.auth.uid
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['comment','rating','criteria','updated_at']))
    // avaliado responde publicamente
    || (isMarketSeller(resource.data.seller_key)
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['response','updated_at']))
    || isPlatformAdmin());

  allow delete: if isPlatformAdmin();
}
```

### Coleções pessoais (favoritos, buscas salvas)
```javascript
match /market_favorites/{favId} {
  allow read: if isAuthed() && resource.data.user_id == request.auth.uid;
  allow create: if isAuthed()
    && favId == request.auth.uid + '_' + request.resource.data.listing_id
    && request.resource.data.user_id == request.auth.uid;
  allow update, delete: if isAuthed() && resource.data.user_id == request.auth.uid;
}

match /market_saved_searches/{searchId} {
  allow read, update, delete: if isAuthed()
    && resource.data.user_id == request.auth.uid;
  allow create: if isAuthed() && request.resource.data.user_id == request.auth.uid;
}
```

### Coleções de sistema / admin
```javascript
match /market_categories/{slug} {
  allow read: if isAuthed();
  allow write: if isPlatformAdmin();
}
match /market_promotions/{id} {
  allow read: if isAuthed();
  allow write: if isPlatformAdmin();
}
match /market_seller_stats/{sellerKey} {
  allow read: if isAuthed();
  allow write: if isPlatformAdmin();   // Cloud Function usa Admin SDK (bypassa)
}
match /market_listing_stats/{listingId} {
  allow read: if isAuthed();
  // incremento de visualização por qualquer autenticado, só nesses campos
  allow create, update: if isAuthed()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['views','impressions','unique_views','contacts',
                   'views_by_day','updated_at']);
}
match /market_disputes/{orderId} {
  allow read: if isOrderParty(orderId);
  allow create: if isOrderParty(orderId)
    && request.resource.data.status == 'open';
  allow update: if isPlatformAdmin()
    || (isOrderParty(orderId)
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['description','evidence','updated_at']));
  allow delete: if false;
}
match /market_shipping_zones/{id} {
  allow read: if isAuthed();
  allow create: if isMarketSeller(request.resource.data.seller_key);
  allow update, delete: if isMarketSeller(resource.data.seller_key)
    || isPlatformAdmin();
}
match /market_wanted_matches/{id} {
  allow read: if isAuthed() && resource.data.wanted_uid == request.auth.uid;
  allow write: if isPlatformAdmin();
}
```

### `platform_settings/marketplace`
Já coberto pelo `match /platform_settings/{docId}` existente? **Verifique** —
se a regra atual for restritiva a `global`, adicione o doc `marketplace` na
mesma regra (leitura por autenticado, escrita por `isPlatformAdmin()`).

## 3. Regras do Storage (aditivo em `storage.rules`)

O caminho `uploads/{uid}/**` já cobre as fotos do Mercado (15 MB por imagem,
25 MB por arquivo). **Nenhuma mudança é necessária para o Mercado.**
Convenção de pasta: `uploads/{uid}/market/{listingId}/{n}.webp` e
`uploads/{uid}/market/proofs/{orderId}.jpg` (comprovante Pix).

⚠ Um comprovante Pix em `uploads/{uid}` é legível por **qualquer
autenticado** com a URL. É aceitável (mesmo padrão do PDV/reserva hoje),
mas precisa estar nos Termos, e a UI deve orientar a **cobrir dados
sensíveis**. Endurecer isso é item da Fase 2 (mover comprovantes para um
caminho com regra por participante do pedido).

## 4. Matriz de permissão (resumo testável)

| Ação | Visitante | Autenticado | Comprador do pedido | Vendedor | Gestor arena/clube | Admin |
|---|---|---|---|---|---|---|
| Ver anúncio ativo | ❌* | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver rascunho | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ver `min_acceptable` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Criar anúncio | ❌ | ✅ (se `canSell`) | — | ✅ | ✅ | ✅ |
| Editar anúncio alheio | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Promover anúncio | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fazer oferta | ❌ | ✅ | — | ❌ (própria) | ❌ | ✅ |
| Criar pedido | ❌ | ✅ | — | ❌ (próprio) | ❌ | ✅ |
| Mudar status do pedido | ❌ | ❌ | ✅ (subconjunto) | ✅ (subconjunto) | ✅ | ✅ |
| Ver chave Pix do vendedor | ❌ | ❌ | ✅ (após `accepted`) | ✅ | ✅ | ✅ |
| Ver endereço do comprador | ❌ | ❌ | ✅ | ✅ (após `accepted`) | ✅ | ✅ |
| Avaliar | ❌ | ❌ | ✅ (pedido `completed`) | ✅ | ✅ | ✅ |
| Apagar pedido | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Moderar | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

\* Fase 1 exige login para ver o Mercado. Vitrine pública sem login (SEO) é
item da Onda W — exige regra `allow read: if true` só para `status=='active'`
e uma decisão explícita sobre expor conteúdo de usuário à internet aberta.

## 5. Testes de regras (emulador) — mínimo obrigatório

40 asserções, no espírito das 24 do dia de jogo:

1-6 · leitura de anúncio por status × papel
7-10 · criação de anúncio sem `canSell`, com seller_key alheio, com campo
de sistema, com vendedor suspenso
11-14 · edição: campo de sistema bloqueado, contador liberado, seller_key
imutável, delete negado ao vendedor
15-18 · `min_acceptable_cents` inacessível ao comprador (subcoleção privada)
19-23 · oferta: auto-oferta negada, update por terceiro negado, transições
24-30 · pedido: criação com fee ≠ 0 negada, itens imutáveis, delete sempre
negado, evento imutável, leitura por terceiro negada
31-34 · avaliação: sem pedido concluído negada, id determinístico, dupla
avaliação impossível, resposta só do avaliado
35-37 · favorito/busca salva de outro usuário negados
38-40 · admin: promover, moderar, verificar vendedor
