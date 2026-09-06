# `marketplace/domain/` — lógica pura (PLANEJADO)

Regras: sem React, sem Firebase, sem `Date.now()` interno (receber `now`),
`.test.js` obrigatório ao lado de cada arquivo.
Especificação completa: `docs/FUTURO/MERCADO/03-DOMINIO-E-TAXONOMIA.md`.

| Arquivo | Exporta (previsto) | Testes |
|---|---|---|
| `constants.js` | `MARKET_COLLECTIONS`, `SELLER_TYPE`, `LISTING_TYPE`, `LISTING_STATUS`, `CONDITION`, `FULFILLMENT`, `PAYMENT_METHOD`, `ORDER_STATUS`, `OFFER_STATUS`, `MODERATION_STATUS` + `*_LABELS` | 6 |
| `taxonomy.js` | `listCategories`, `findCategory`, `attributesFor`, `validateAttributes`, `categoryBreadcrumb`, `filterableAttributes` | 22 |
| `taxonomySeed.js` | `buildTaxonomySeed` | 4 |
| `listing.js` | `normalizeListingInput`, `validateListing`, `listingCompleteness` | 26 |
| `listingStatus.js` | `canTransitionListing`, `nextListingActions` | 18 |
| `offers.js` | `createOffer`, `applyOffer`, `isOfferExpired`, `shouldAutoDecline`, `suggestCounter` | 24 |
| `orderStatus.js` | `canTransitionOrder`, `nextActionsFor`, `orderStage`, `slaFor` | 30 |
| `order.js` | `buildOrderFromListing`, `buildOrderFromOffer`, `generateOrderCode`, `snapshotItem` | 16 |
| `pricing.js` | `computeOrderTotals`, `computeShipping`, `formatBRL`, `parseBRL`, `isPriceSane` | 28 |
| `eligibility.js` | `canSell`, `canBuy`, `activeListingLimit`, `dailyListingLimit` | 20 |
| `search.js` | `filterListings`, `rankListings`, `haversineKm`, `explainMatch` | 26 |
| `searchTerms.js` | `buildSearchTerms`, `normalizeTerm`, `tokenize` | 14 |
| `reputation.js` | `computeSellerStats`, `shouldRevealReviews`, `sellerBadges` | 18 |
| `disputes.js` | `canTransitionDispute`, `disputeWindowOpen` | 10 |
| `sellerProfile.js` | `buildSellerKey`, `normalizeSellerInput`, `validatePixConfig` | 12 |
| `promotions.js` | `activePromotionFor`, `promotionBoost` | 10 |
