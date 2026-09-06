# 16.06 — Rotas, telas e componentes do Mercado

## 1. Rotas (todas dentro de `V2App.jsx`, sob `V2Layout`)

Todas gated por `<MarketGuard>` = `FeatureFlagGuard flag="marketplace"`.

### Ambiente público (comprador)
| Rota | Página | O que é |
|---|---|---|
| `/mercado` | `V2Market` | Vitrine: destaques, categorias, perto de você, recentes, procurados |
| `/mercado/buscar` | `V2MarketSearch` | Resultado com filtros, ordenação, mapa opcional |
| `/mercado/c/:categorySlug` | `V2MarketSearch` | Mesma tela, categoria pré-filtrada |
| `/mercado/anuncio/:listingId` | `V2MarketListing` | Página do anúncio |
| `/mercado/vendedor/:slug` | `V2MarketSeller` | Perfil público do vendedor |
| `/mercado/procurados` | `V2MarketWanted` | Mural de "procura-se" |
| `/mercado/checkout/:listingId` | `V2MarketCheckout` | Fechar pedido |
| `/mercado/compras` | `V2MarketPurchases` | Minhas compras (abas) |
| `/mercado/compras/:orderId` | `V2MarketOrder` | Detalhe do pedido (visão comprador) |
| `/mercado/favoritos` | `V2MarketPurchases` (aba) | Favoritos e alertas |

### Ambiente de gestão (vendedor)
| Rota | Página | O que é |
|---|---|---|
| `/mercado/vender` | `V2MarketSellerHome` | Painel do vendedor (KPIs + atalhos) |
| `/mercado/vender/onboarding` | `V2MarketSellerOnboarding` | Stepper de 4 passos |
| `/mercado/vender/anuncios` | `V2MarketSellerListings` | Lista + ações em massa |
| `/mercado/vender/anuncios/novo` | `V2MarketListingEditor` | Wizard de 6 passos |
| `/mercado/vender/anuncios/:id/editar` | `V2MarketListingEditor` | Mesma tela |
| `/mercado/vender/ofertas` | `V2MarketSellerOffers` | Caixa de ofertas |
| `/mercado/vender/pedidos` | `V2MarketSellerOrders` | Kanban de pedidos |
| `/mercado/vender/pedidos/:orderId` | `V2MarketOrder` | Detalhe (visão vendedor) |
| `/mercado/vender/avaliacoes` | `V2MarketSellerReviews` | Recebidas + responder |
| `/mercado/vender/financeiro` | `V2MarketSellerFinance` | Extrato, exportar |
| `/mercado/vender/configuracoes` | `V2MarketSellerSettings` | Pix, políticas, entrega, férias |
| `/mercado/vender/analytics` | `V2MarketSellerAnalytics` | Por anúncio e agregado |

**19 rotas · 15 páginas V2 novas** (algumas compartilhadas).

### Admin
Nada de rota nova: tudo entra como abas do `/admin/painel` já existente
(ver `09-ADMIN-E-CONFIGURACOES.md`).

## 2. Navegação

`V2Layout.jsx` — hub novo **"Mercado"** (ícone `ShoppingBag`), aditivo,
renderizado só com a flag ligada:

```js
marketplaceOn && hub({
  id: 'mercado', label: 'Mercado', icon: ShoppingBag, to: '/mercado',
  children: [
    { to: '/mercado', label: 'Explorar', icon: Store },
    { to: '/mercado/procurados', label: 'Procurados', icon: Search },
    { to: '/mercado/compras', label: 'Minhas compras', icon: Package },
    isSeller && { to: '/mercado/vender', label: 'Minhas vendas', icon: Tags },
  ].filter(Boolean),
}),
```

- `isSeller` = existe `market_sellers/{sellerKey}` para o usuário. Sem isso,
  o item "Minhas vendas" **não é renderizado** (princípio do CLAUDE.md);
  quem ainda não vende chega pelo CTA "Vender" da vitrine.
- Bottom nav do celular: **não muda** (já tem 5 itens; trocar quebraria
  hábito). O Mercado entra pelo menu lateral e pela Home.
- Home (`V2Dashboard`): faixa "Novidades no Mercado" com 4 cards
  horizontais — aditiva, só com a flag.

## 3. Wireframes em texto (as telas que importam)

### 3.1 `/mercado` — Vitrine
```
┌───────────────────────────────────────────────────────────┐
│ Mercado                                    [ Vender ]     │
│ Compre e venda com a comunidade do pickleball             │
├───────────────────────────────────────────────────────────┤
│ [🔎 O que você procura?              ] [Filtros ⚙]        │
│ chips: Raquetes · Bolas · Calçados · Vestuário · Serviços │
├───────────────────────────────────────────────────────────┤
│ ⚡ Destaques                                    ver todos →│
│ [card][card][card][card]        (scroll horizontal)       │
├───────────────────────────────────────────────────────────┤
│ 📍 Perto de você — São Paulo/SP              trocar cidade│
│ [card][card][card][card]                                  │
├───────────────────────────────────────────────────────────┤
│ 🏟 Das arenas e professores                                │
│ [card][card][card][card]                                  │
├───────────────────────────────────────────────────────────┤
│ 🆕 Recém-anunciados            (grade 2 col mob / 4 desk) │
│ [card][card][card][card]                                  │
│ [card][card][card][card]           [ Carregar mais ]      │
├───────────────────────────────────────────────────────────┤
│ 🙋 Procurando agora                          ver todos →  │
│ "Raquete controle até R$ 700 · SP"  [Tenho isso]          │
└───────────────────────────────────────────────────────────┘
```

**Card do anúncio** (`V2MarketListingCard`) — o componente mais usado:
```
┌──────────────────┐
│  [foto 1:1]   ♡  │  ← favoritar, badge "Destaque"/"Novo"
│  R$ 690          │     badge de condição no canto
│  Selkirk Vanguard│
│  Seminovo · SP   │
│  👤 Fernando ★4.9│
└──────────────────┘
```

### 3.2 `/mercado/buscar` — Busca
- Desktop: sidebar de filtros (sticky) + grade.
- Mobile: barra de chips com contagem + **bottom sheet** de filtros
  (`max-h-[90dvh] overflow-y-auto`).
- Filtros: categoria (árvore), preço (slider + inputs), condição,
  tipo de vendedor, entrega, cidade/estado + raio, atributos da categoria
  (aparecem só quando uma categoria é escolhida), aceita oferta, nota mínima.
- Chips de filtro ativo removíveis + "Limpar tudo".
- Ordenação: relevância (default) · recentes · menor preço · maior preço ·
  mais perto · melhor avaliado.
- Rodapé: "Não achou? [Salvar busca e me avisar] [Publicar procura-se]".
- Estado 0 resultados com sugestões de relaxamento ("sem o filtro de cidade
  há 23 resultados").

### 3.3 `/mercado/anuncio/:id` — Página do anúncio
```
┌─────────────────────────┬─────────────────────────────────┐
│ [galeria 1..10]         │ Selkirk Vanguard Power Air      │
│  ▢ ▢ ▢ ▢                │ Seminovo · Raquetes › Controle  │
│                         │                                 │
│                         │ R$ 690          (de R$ 890)     │
│                         │ ou faça uma oferta              │
│                         │                                 │
│                         │ [  Comprar  ] [ Fazer oferta ]  │
│                         │ [ Conversar ]  ♡ Favoritar      │
│                         │                                 │
│                         │ 📦 Retirada Arena X · Envio R$25│
│                         │ 🔁 Devolução em 7 dias          │
│                         ├─────────────────────────────────┤
│                         │ 👤 Fernando S.   ★4.9 (12)      │
│                         │ Nível 4.2 · Arena X · SP        │
│                         │ 87 partidas · membro há 2 anos  │
│                         │ [Ver perfil] [Todos os anúncios]│
└─────────────────────────┴─────────────────────────────────┘
  Descrição
  Ficha técnica (atributos em grade)
  Entrega e pagamento
  Políticas do vendedor
  Avaliações do vendedor (3 últimas + ver todas)
  ⚠ Denunciar anúncio
  Anúncios semelhantes  [card][card][card][card]
```
- Botões renderizados por `nextActionsFor()` — vendedor vendo o próprio
  anúncio vê **[Editar] [Pausar] [Ver estatísticas]** no lugar de comprar.
- Contato (telefone/WhatsApp) **não aparece**. Conversa é pelo chat.

### 3.4 `/mercado/checkout/:listingId`
Passo único, com resumo travado à direita:
1. Entrega (radio: retirada / envio / combinar) → se envio, formulário de
   endereço com CEP.
2. Observação para o vendedor (opcional).
3. Resumo: item, subtotal, frete, total. Aviso claro:
   **"O pagamento é combinado diretamente com o vendedor via Pix. O
   PickleRush não intermedia o pagamento."**
4. Aceite: "Li e concordo com os Termos do Mercado".
5. [Fazer pedido]

### 3.5 `/mercado/vender` — Painel do vendedor
```
┌───────────────────────────────────────────────────────────┐
│ Minhas vendas                    [+ Novo anúncio]         │
├───────────────────────────────────────────────────────────┤
│ [ 12 ativos ] [ 3 ofertas ] [ 2 a enviar ] [ R$ 1.240 mês]│
├───────────────────────────────────────────────────────────┤
│ ⚠ Precisa de você                                          │
│  • 2 ofertas expiram hoje              [Responder]        │
│  • 1 comprovante para conferir          [Conferir]        │
│  • 1 pedido para enviar (prazo 12h)     [Marcar enviado]  │
├───────────────────────────────────────────────────────────┤
│ Seus anúncios (5 mais vistos)          ver todos →        │
│ [linha: foto · título · preço · 124 views · 8 ♡ · ativo] │
├───────────────────────────────────────────────────────────┤
│ Reputação  ★4.9 (12)  · resposta em 2h · 100% concluídos  │
└───────────────────────────────────────────────────────────┘
```
O bloco "Precisa de você" é o coração do painel: sempre o que está travando
dinheiro, ordenado por urgência.

### 3.6 Wizard de anúncio (`V2MarketListingEditor`)
6 passos, com autosave em rascunho a cada passo, barra de progresso,
"Pré-visualizar como comprador" sempre disponível:
1. **Tipo** — cards grandes (produto novo/usado, serviço, experiência,
   aluguel, procura-se, doação).
2. **O que é** — typeahead no `catalog_products` + categoria; ao escolher,
   preenche marca/categoria/atributos.
3. **Detalhes** — título, descrição, condição, atributos da categoria.
4. **Fotos** — dropzone, reordenar arrastando, capa, recorte 1:1,
   compressão automática, alt text sugerido.
5. **Preço e estoque** — preço, "de/por", aceita oferta + mínimo privado,
   quantidade, variações.
6. **Entrega** — formas, local de retirada (com atalho para as arenas do
   usuário), frete fixo/zonas, prazo.
→ **Revisar e publicar** (ou salvar rascunho / agendar).

Validação inline por passo; nunca deixa avançar com erro; erro sempre em
pt-BR e ligado ao campo.

### 3.7 Kanban de pedidos (`V2MarketSellerOrders`)
Colunas = agrupamento da máquina de estado:
`Novos · Aguardando pagamento · Conferir comprovante · Preparar · Enviados/Prontos · Concluídos · Problemas`
Card com: código, foto, comprador, valor, tempo na coluna (vira vermelho
após SLA), ações da etapa. Mobile: abas em vez de colunas.

## 4. Componentes novos

`src/v2/components/marketplace/` (~26 componentes)

```
V2MarketListingCard.jsx          card do anúncio (grade + horizontal)
V2MarketListingGrid.jsx          grade responsiva + skeleton + paginação
V2MarketFilters.jsx              sidebar desktop
V2MarketFiltersSheet.jsx         bottom sheet mobile
V2MarketFilterChips.jsx          chips ativos
V2MarketSortSelect.jsx
V2MarketCategoryNav.jsx          árvore/breadcrumb de categoria
V2MarketGallery.jsx              galeria com swipe/zoom/miniaturas
V2MarketPriceTag.jsx             preço, de/por, parcelamento textual
V2MarketSellerCard.jsx           card de confiança do vendedor
V2MarketSellerBadges.jsx
V2MarketOfferDialog.jsx          fazer oferta / contrapropor
V2MarketOfferRow.jsx             linha da caixa de ofertas
V2MarketOrderStatusBadge.jsx
V2MarketOrderTimeline.jsx        linha do tempo a partir dos events
V2MarketOrderActions.jsx         só ações permitidas (nextActionsFor)
V2MarketPixPanel.jsx             QR/chave + copiar + enviar comprovante
V2MarketProofUploader.jsx
V2MarketShippingForm.jsx         endereço + CEP
V2MarketTrackingForm.jsx
V2MarketReviewDialog.jsx         avaliar com critérios
V2MarketReviewList.jsx
V2MarketMediaUploader.jsx        dropzone + reordenar + compressão
V2MarketListingWizard.jsx        casca do wizard (6 passos)
V2MarketListingPreview.jsx       "ver como comprador"
V2MarketStatCard.jsx             KPI do painel do vendedor
V2MarketEmptyState.jsx           estados vazios com CTA certo
V2MarketReportDialog.jsx         denunciar (compartilhado com docs/18)
```

## 5. Design (aplicar `docs/07-DESIGN-STANDARD.md`)

- Paleta existente: `ink` (fundo escuro), `acid` (#C8FF3D, ação), `paper`.
- Preço em `acid` só no card em destaque; no corpo, alto contraste neutro
  (preço em verde-limão em tudo cansa e some).
- Badges de status do pedido com cor semântica consistente e **texto**
  (nunca só cor — acessibilidade).
- Foto sempre 1:1 no card (evita layout shift); `aspect-square` + skeleton.
- Densidade: card compacto no mobile (2 col), confortável no desktop.
- Toda `V2Dialog` com `max-h-[90dvh] overflow-y-auto`.
- Seções longas do painel do vendedor usam `V2CollapsibleCard` com
  `sectionId` estável (ver `docs/14` §1 — id que muda apaga a preferência
  de todo mundo).
