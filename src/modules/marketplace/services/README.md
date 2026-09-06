# `marketplace/services/` — I/O Firestore (PLANEJADO)

Regras: sem React; sem regra de negócio pesada (isso é `domain/`);
`logger` em vez de `console`; `createAuditLog` após mutação relevante;
toda query precisa de índice em `firestore.indexes.json`.

| Arquivo | Responsabilidade |
|---|---|
| `sellerService.js` | CRUD de `market_sellers` + subcoleção privada (Pix, contato) |
| `listingService.js` | CRUD de `market_listings`, publicar, pausar, renovar, `search_terms`, subcoleção `private/pricing` |
| `offerService.js` | criar/responder oferta, reserva de unidade, expiração |
| `orderService.js` | **checkout transacional**, transições de status, eventos, comprovante, rastreio |
| `reviewService.js` | avaliação (id determinístico), resposta pública, revelação mútua |
| `favoriteService.js` | favoritos + aviso de queda de preço |
| `savedSearchService.js` | buscas salvas e alertas |
| `categoryService.js` | overlay de `market_categories` sobre a semente |
| `statsService.js` | incrementos em `market_listing_stats`, leitura de `market_seller_stats` |
| `disputeService.js` | abrir, anexar evidência, resolver |
| `marketSettingsService.js` | `platform_settings/marketplace` |
