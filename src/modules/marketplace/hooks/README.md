# `marketplace/hooks/` — React Query (PLANEJADO)

Regras: um hook por recurso; `queryKey` estável e namespaceada
(`['market', ...]`); `staleTime` explícito; nenhum hook dispara com a flag
`marketplace` desligada (garantido por `runtime.test.jsx`).

| Hook | Chave | staleTime |
|---|---|---|
| `useMarketListings(filters)` | `['market','listings',filters]` | 60s |
| `useMarketListing(id)` | `['market','listing',id]` | 30s |
| `useMarketSearch(query)` | `['market','search',query]` | 30s |
| `useMarketSeller(sellerKey)` | `['market','seller',key]` | 5min |
| `useMarketSellerStats(sellerKey)` | `['market','sellerStats',key]` | 5min |
| `useMarketOffers(scope)` | `['market','offers',scope]` | 15s |
| `useMarketOrders(scope)` | `['market','orders',scope]` | 15s |
| `useMarketFavorites()` | `['market','favorites',uid]` | 60s |
| `useMarketCategories()` | `['market','categories']` | 30min |
| `useMarketSettings()` | `['market','settings']` | 30min |
