# 16.09 — Admin e configurações do Mercado

## 1. Onde entra no painel admin

`V2AdminConsole.jsx` já tem navegação em 2 níveis (`SECTIONS` → `tabs`).
A adição é **aditiva**, no mesmo padrão de `buildSections(duprExportOn)`:
uma seção nova só é injetada quando a flag está ligada.

```js
// seção nova, injetada por buildSections quando marketplaceOn
{ id: 'commerce', label: 'Mercado', icon: ShoppingBag, tabs: [
  { id: 'market_overview',   label: 'Visão geral',   icon: LayoutDashboard },
  { id: 'market_listings',   label: 'Anúncios',      icon: Tags },
  { id: 'market_sellers',    label: 'Vendedores',    icon: Store },
  { id: 'market_orders',     label: 'Pedidos',       icon: Package },
  { id: 'market_moderation', label: 'Moderação',     icon: ShieldAlert },
  { id: 'market_categories', label: 'Categorias',    icon: FolderTree },
  { id: 'market_promotions', label: 'Destaques',     icon: Sparkles },
  { id: 'market_settings',   label: 'Configurações', icon: SlidersHorizontal },
] }
```

Componentes em `src/v2/components/admin/` (a pasta já existe):
`AdminMarketOverviewTab`, `AdminMarketListingsTab`, `AdminMarketSellersTab`,
`AdminMarketOrdersTab`, `AdminMarketModerationTab`, `AdminMarketCategoriesTab`,
`AdminMarketPromotionsTab`, `AdminMarketSettingsTab`.

## 2. Aba a aba

### 2.1 Visão geral
KPIs do Mercado: anúncios ativos · novos 7d · vendedores ativos · pedidos
(por status) · GMV mês · ticket médio · taxa de conversão · nota média da
plataforma · denúncias abertas · tempo médio de moderação.
Séries de 90 dias. Top 10 categorias, top 10 vendedores, top 10 anúncios.
Alertas: fila de moderação > N, disputas abertas, vendedores com
`cancel_rate` alto.

### 2.2 Anúncios
Busca global (título, vendedor, id, categoria), filtros por status,
moderação, tipo, período, faixa de preço, com ou sem pedido.
Ações: ver, ocultar, remover (com motivo), aprovar, rejeitar, promover,
editar categoria, notificar o vendedor, abrir o vendedor.
Ações em massa com confirmação e motivo obrigatório.

### 2.3 Vendedores
Lista com tipo, status, nº de anúncios, vendas, nota, denúncias, strikes.
Ações: **verificar** (concede o selo), suspender (com motivo e prazo),
banir, elevar limites (`limits_override`), mudar tier, ver o painel dele
em modo leitura ("ver como vendedor" — sem poder escrever), aprovar
cadastro de loja.

### 2.4 Pedidos
Só leitura + mediação. Busca por código, comprador, vendedor.
Ver a linha do tempo completa (`events`), o comprovante, o chat vinculado
(com aviso de acesso registrado em auditoria).
Ações: abrir disputa em nome de alguém, resolver disputa, cancelar pedido
travado, forçar conclusão.

### 2.5 Moderação
Fila unificada — **é a mesma fila do Feed** (docs/18). Aqui aparece
filtrada por `target_type: 'market_listing' | 'market_review' | 'market_seller'`.
Ordenação por gravidade × nº de denúncias × idade.
Ações rápidas com atalho de teclado; decisão sempre com motivo; tudo em
`audit_logs` e `moderation_actions`.

### 2.6 Categorias
Editor da árvore: criar, renomear, mover, ativar/desativar, ordenar,
definir ícone, editar atributos (chave, rótulo, tipo, obrigatório,
filtrável, opções, unidade).
Sobrepõe a semente em código; "remover" grava tombstone (mesmo mecanismo
do `catalog_products`). Aviso ao desativar categoria com anúncios ativos,
com opção de migrar em massa.

### 2.7 Destaques
Conceder destaque (cortesia ou pago) a um anúncio: tipo, janela, peso do
boost, observação. Lista dos ativos e agendados, com receita registrada.
Banner da home do Mercado configurável aqui.

### 2.8 Configurações
Formulário sobre `platform_settings/marketplace` (schema em `04-DATA-MODEL` §16):
- Quem pode vender (checkboxes por `SELLER_TYPE`); loja exige aprovação.
- Moderação: pré ou pós; termos proibidos; mínimo de fotos; sanidade de preço.
- Comissão: percentual e mínimo (Fase 1 travados em 0 com aviso).
- Prazos: TTL do anúncio, TTL da oferta, rodadas, hold, prazo de pagamento,
  auto-conclusão, janela de disputa.
- Limites por tipo de vendedor (ativos e por dia).
- Requisitos: e-mail verificado, telefone, idade mínima da conta.
- Ligar/desligar `wanted` e `donation`.
- Categorias proibidas.
- Versão dos Termos do Mercado (bump força novo aceite).
- Banner da home.

Toda escrita: `auditService.createAuditLog` com o diff.

## 3. Feature flags novas

Em `src/core/featureFlags.js` (todas **default OFF**), agrupadas em
`featureFlagGroups.js` sob um grupo novo **"Mercado"**:

```js
/** Mercado (marketplace) — flag MESTRA. Sem ela, nada existe: rotas,
 *  menu, hooks e leituras. Aditiva. */
MARKETPLACE: 'marketplace',

/** Ofertas e contrapropostas. Desligada: só preço fixo e conversar. */
MARKETPLACE_OFFERS: 'marketplace_offers',

/** Pedidos e checkout. Desligada: o Mercado vira classificado — o
 *  comprador só conversa com o vendedor, sem pedido nem pagamento. */
MARKETPLACE_ORDERS: 'marketplace_orders',

/** Envio com endereço e rastreio. Desligada: só retirada e combinar. */
MARKETPLACE_SHIPPING: 'marketplace_shipping',

/** Avaliações e reputação de vendedor. */
MARKETPLACE_REVIEWS: 'marketplace_reviews',

/** Destaques/boost pagos ou cortesia. */
MARKETPLACE_PROMOTIONS: 'marketplace_promotions',

/** "Procura-se": anúncio de demanda + casamento automático. */
MARKETPLACE_WANTED: 'marketplace_wanted',

/** Espelhar produtos do PDV da arena no Mercado. */
MARKETPLACE_ARENA_SYNC: 'marketplace_arena_sync',
```

**8 flags novas.** A hierarquia é dura: toda sub-flag só tem efeito com
`MARKETPLACE` ligada. Isso é testado (`featureFlagGroups.test.js` ganha
asserções).

Estratégia de rollout: liga `marketplace` + `marketplace_offers` para
dogfood (só admin vê, porque a plataforma pode gatear por role); depois
`marketplace_orders`; `shipping` e `promotions` por último.

## 4. Auditoria

Ações novas em `audit_logs` (`action` sempre em snake_case pt-BR-neutro):
```
market_seller_created, market_seller_verified, market_seller_suspended,
market_seller_banned, market_seller_limits_changed,
market_listing_created, market_listing_updated, market_listing_published,
market_listing_paused, market_listing_removed, market_listing_moderated,
market_listing_promoted,
market_offer_created, market_offer_accepted, market_offer_declined,
market_order_created, market_order_status_changed, market_order_cancelled,
market_payment_confirmed, market_payment_rejected,
market_review_created, market_review_responded, market_review_removed,
market_dispute_opened, market_dispute_resolved,
market_category_changed, market_settings_changed
```

Regra: **toda ação de admin sobre conteúdo alheio grava motivo**. Sem
motivo, o botão não submete.

## 5. Métricas para o `analytics/`
Ver `01-VISAO-E-ESCOPO §8`. O painel admin lê agregados diários gravados
por Cloud Function (não varre coleção inteira no cliente — isso quebraria
o custo).
