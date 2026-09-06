# 16.11 — Plano de desenvolvimento do Mercado (Onda U)

> Regras do projeto: 1 PR por sprint atômico, worktree por feature, squash
> merge, delete branch, deploy automático no merge em `main`.
> Cada PR abaixo é **entregável e reversível sozinho** (flag OFF).

## Visão geral

| PR | Nome | Entrega | Testes novos | Arquivos | Depende de |
|---|---|---|---|---|---|
| U0 | Fundação e domínio | flags, enums, taxonomia, todas as máquinas de estado, pricing, search, reputação — **puro, sem UI** | ~284 | 34 | — |
| U1 | Dados e acesso | regras, índices, services, hooks | ~40 (emulador) | 26 | U0 |
| U2 | Vitrine pública | `/mercado`, busca, filtros, card, categoria | ~30 | 22 | U1 |
| U3 | Anúncio e mídia | detalhe do anúncio, wizard, upload+compressão | ~35 | 20 | U2 |
| U4 | Vendedor | onboarding, painel, lista de anúncios, configurações | ~30 | 18 | U3 |
| U5 | Negociação | ofertas, chat contextual, procura-se | ~35 | 14 | U4 |
| U6 | Pedidos e pagamento | checkout, kanban, Pix, comprovante, entrega | ~55 | 22 | U5 |
| U7 | Reputação e disputa | avaliações cegas, perfil do vendedor, disputa | ~30 | 12 | U6 |
| U8 | Admin e Functions | 8 abas admin, 10 Cloud Functions, notificações | ~35 | 24 | U6 |
| U9 | Integrações e polimento | PDV, catálogo, professor, feed, busca global, UX | ~25 | 20 | U8 |
| | **Total** | | **~599** | **~212** | |

Estimativa de esforço: **9 a 12 semanas** de trabalho focado de uma pessoa,
ou 5-6 semanas com dois desenvolvedores paralelizando (U2/U3 e U4/U5 são
paralelizáveis após U1).

---

## U0 — Fundação e domínio
**Branch**: `feat/mercado-fundacao`

Entrega:
- `src/core/featureFlags.js`: 8 flags novas, default OFF.
- `src/core/featureFlagGroups.js`: grupo "Mercado".
- `src/modules/marketplace/domain/` completo (16 arquivos de `03-DOMINIO §9`).
- `src/modules/marketplace/README.md`.
- `docs/FUTURO/MERCADO/` marcado como "em implementação".

Aceite:
- [ ] `npm test` verde com ~284 testes novos.
- [ ] Nenhum import de React ou Firebase em `domain/`.
- [ ] Flag ligada não muda **nada** na UI (ainda não há UI).
- [ ] `npm run lint` 0 erros, `npm run build` sem warning.

## U1 — Dados e acesso
**Branch**: `feat/mercado-dados`

Entrega:
- `firestore.rules`: helpers + 14 blocos `match` novos (aditivos).
- `firestore.indexes.json`: 31 índices novos.
- `services/`: `sellerService`, `listingService`, `offerService`,
  `orderService`, `reviewService`, `favoriteService`, `savedSearchService`,
  `categoryService`, `statsService`, `disputeService` (10 arquivos).
- `hooks/`: `useMarketListings`, `useMarketListing`, `useMarketSeller`,
  `useMarketOffers`, `useMarketOrders`, `useMarketFavorites`,
  `useMarketSearch`, `useMarketCategories`, `useMarketSellerStats`,
  `useMarketSettings` (10 arquivos).
- Testes de regras no emulador (40 asserções).

Aceite:
- [ ] `firebase emulators:exec` verde nas 40 asserções.
- [ ] Diff do `firestore.rules` só **acrescenta** (revisar linha a linha).
- [ ] Nenhum hook é chamado com a flag desligada (teste de runtime).

## U2 — Vitrine pública
**Branch**: `feat/mercado-vitrine`
- Rotas `/mercado`, `/mercado/buscar`, `/mercado/c/:slug`.
- `V2MarketListingCard`, `V2MarketListingGrid`, filtros (sidebar + sheet),
  chips, ordenação, paginação, skeletons, estados vazios.
- Hub "Mercado" no `V2Layout` (aditivo, gated).
- Faixa "Novidades no Mercado" na Home.

Aceite:
- [ ] Vitrine carrega em < 2s com 200 anúncios de teste.
- [ ] Filtro por categoria + cidade + preço devolve o esperado.
- [ ] Mobile: filtros em bottom sheet, grade 2 colunas, sem scroll lateral.
- [ ] Flag OFF: rota 404 e item de menu ausente (runtime test).

## U3 — Anúncio e mídia
**Branch**: `feat/mercado-anuncio`
- `/mercado/anuncio/:id` completa (galeria, ficha, vendedor, relacionados).
- Wizard de 6 passos com autosave em rascunho e pré-visualização.
- `V2MarketMediaUploader`: compressão client-side (≤1600px, WebP, ~150KB),
  thumbnail 400px, reordenar, capa, alt.
- `market_listing_stats`: contagem de view/impressão.

Aceite:
- [ ] Anunciar uma raquete com 5 fotos em < 3 min (cronometrado).
- [ ] Foto de 8MB vira ~150KB sem perda visível.
- [ ] Rascunho sobrevive a fechar o navegador.
- [ ] Vendedor vendo o próprio anúncio não vê "Comprar".

## U4 — Ambiente do vendedor
**Branch**: `feat/mercado-vendedor`
- Onboarding (4 passos + aceite de termos).
- Painel com "Precisa de você" + KPIs.
- Lista de anúncios com ações em massa.
- Configurações (todas as seções de `07-VENDEDOR §8`).

Aceite:
- [ ] `canSell` bloqueia quem não pode, com motivo em pt-BR.
- [ ] Gestor de arena consegue vender pela arena; ex-gestor não consegue.
- [ ] Modo férias esconde os botões de compra sem despublicar.

## U5 — Negociação
**Branch**: `feat/mercado-negociacao`
- Ofertas ponta a ponta (criar, contrapropor, aceitar, recusar, expirar).
- Caixa de ofertas do vendedor.
- Chat contextual (campo `context` em `conversations`, cabeçalho, atalhos).
- "Procura-se" (`wanted`) + mural.

Aceite:
- [ ] 4 rodadas de contraproposta e o limite trava na 5ª.
- [ ] Oferta abaixo do mínimo é auto-recusada sem revelar o mínimo.
- [ ] Conversas antigas (sem `context`) continuam abrindo normalmente.

## U6 — Pedidos e pagamento
**Branch**: `feat/mercado-pedidos`
- Checkout transacional.
- Kanban do vendedor + detalhe do pedido (2 papéis).
- Pix: painel, copiar chave, comprovante, conferência.
- Entrega: retirada, combinar, envio com rastreio.
- "Minhas compras".

Aceite:
- [ ] Pedido completo `placed → completed` no emulador.
- [ ] Duas compras simultâneas da última unidade: uma falha limpa.
- [ ] Chave Pix invisível antes de `accepted` (teste de regra).
- [ ] Endereço do comprador invisível antes de `accepted`.
- [ ] `market_orders` nunca deletável (teste de regra).

## U7 — Reputação e disputa
**Branch**: `feat/mercado-reputacao`
- Avaliação mútua cega, com critérios e resposta pública.
- Perfil público do vendedor com histograma e badges.
- Disputa: abrir, evidências, conversa de 3 vias, resolução.

Aceite:
- [ ] Avaliar sem pedido concluído é impossível (regra + UI).
- [ ] Segunda avaliação do mesmo pedido é impossível (id determinístico).
- [ ] Avaliações só ficam visíveis pela regra da cegueira mútua.

## U8 — Admin e Cloud Functions
**Branch**: `feat/mercado-admin`
- 8 abas do painel admin.
- `platform_settings/marketplace` com formulário completo.
- 10 Cloud Functions (`08-NEGOCIACAO §7`).
- 27 tipos de notificação + preferências.
- Auditoria em tudo.

Aceite:
- [ ] Admin remove um anúncio denunciado em 2 cliques, com motivo.
- [ ] Expiradores rodam no emulador e não tocam em pedido concluído.
- [ ] Toda ação de admin aparece em `audit_logs` com motivo.

## U9 — Integrações e polimento
**Branch**: `feat/mercado-integracoes`
- PDV da arena ↔ Mercado (espelho + Function de sync).
- Typeahead no `catalog_products` + "todos os anúncios deste produto".
- Pacotes do professor, aba "À venda" no perfil e no clube.
- Compartilhar anúncio no Feed (se docs/17 já estiver de pé).
- Busca global inclui anúncios.
- Passada de UX/UI: microcopy, animações, vazios, acessibilidade,
  renomear a aba da arena para "Loja da arena".

Aceite:
- [ ] Arena publica 5 produtos do PDV sem redigitar.
- [ ] Vender no PDV baixa o estoque do anúncio (e vice-versa).
- [ ] Checklist de entrega do CLAUDE.md §7 inteiro verde.

---

## Ordem de ligação das flags em produção

```
1. marketplace                 (só admin enxerga na prática — dogfood 1 semana)
2. + marketplace_offers        (dogfood com 5 vendedores convidados)
3. + marketplace_orders        (beta fechado: 3 arenas + 20 atletas, 2 semanas)
4. + marketplace_reviews
5. + marketplace_shipping
6. + marketplace_wanted, marketplace_arena_sync
7. + marketplace_promotions    (só quando houver demanda de destaque)
```

Critério para avançar de etapa: zero bug crítico aberto, funil sem queda
inexplicada, e ao menos 5 pedidos concluídos na etapa anterior.

## Rollback

Cada etapa é revertida desligando a flag correspondente. Dados permanecem.
Nenhum PR desta onda altera comportamento com as flags desligadas — isso é
testado por um `runtime.test.jsx` por PR a partir do U2.

## Riscos do plano

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Custo de egress de imagem estourar | alta | compressão + thumbnail obrigatórios no U3, medir no beta |
| Busca ficar lenta > 5k anúncios | média | contrato de `rankListings` já isola a origem; migração para índice externo é trocar o service |
| Golpe/fraude no Pix manual | média | avisos na UI, moderação, strikes, disputa; Fase 3 resolve de verdade |
| Marketplace vazio no lançamento | alta | semear com 3 arenas parceiras + 30 anúncios antes de abrir |
| Escopo inflar (gateway, frete) | alta | não-objetivos de `01-VISAO §4` são contrato |
