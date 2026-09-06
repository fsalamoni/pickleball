# 16.08 — Negociação, pedidos e pagamento

## 1. Os três caminhos até a venda

| Caminho | Quando | Resultado |
|---|---|---|
| **Comprar** | preço fixo aceito | pedido direto, `placed` |
| **Fazer oferta** | `accepts_offers: true` | negociação estruturada → pedido |
| **Conversar** | dúvida, combinar, negociar livre | chat; pode virar oferta ou pedido |

Os três coexistem. A oferta é o caminho *auditável* (fica registro do
valor combinado); o chat é o caminho *humano*. A UI empurra para a oferta
quando o assunto é preço ("Quer propor um valor? [Fazer oferta]" aparece
no composer do chat quando detecta "R$" — Fase 2).

## 2. Chat contextual (reaproveitando `chat/`)

**Não construir um segundo sistema de mensagens.** O módulo `chat/` já tem
`conversations` + `messages` (subcoleção), notificações e UI.

Extensão **aditiva** em `conversations`:
```js
context: { kind: 'market_listing'|'market_order'|'market_dispute', id: '...' }
```
Campo opcional. Conversas antigas não têm — o código lê com default `null`
e nada muda. A conversa ganha um **cabeçalho de contexto** (foto + título +
preço + status do pedido) e atalhos de ação ("Fazer oferta", "Ver pedido").

Id determinístico para não duplicar conversa:
`market_{listingId}_{buyerUid}` — abrir duas vezes cai na mesma thread.

## 3. Ofertas

Regras completas em `03-DOMINIO §3.2`. Pontos que a UI precisa acertar:

- Mostrar sempre **preço pedido × sua oferta × % de desconto**.
- Contador regressivo real ("expira em 14h").
- Contraproposta sugere o meio-termo arredondado.
- Ao aceitar, avisar claramente: **"A unidade fica reservada para o
  comprador por 60 minutos"** e o que acontece se ele não fechar.
- Oferta abaixo do mínimo com `auto_decline_below`: o comprador recebe
  "Sua oferta foi recusada automaticamente. Tente um valor maior." — sem
  revelar o mínimo.
- Notificar as duas pontas em cada rodada.

## 4. Checkout e pedido

### Criação (transação)
`createOrder()` roda uma **transação Firestore** que:
1. relê o anúncio (`status`, `quantity`, `reserved_for_uid`);
2. valida `canBuy` e o preço (da oferta aceita, se houver);
3. cria `market_orders/{id}` com `code` legível e snapshot dos itens;
4. decrementa `quantity` e, se zerar, `status: 'sold_out'`;
5. cria o primeiro `events/` (`status_change: → placed`);
6. marca a oferta como consumida (`order_id`).

Falha em qualquer passo → nada é escrito (atomicidade).

### SLAs e prazos (configuráveis)
| Etapa | Prazo | O que acontece ao estourar |
|---|---|---|
| `placed` → aceite do vendedor | 48h | pedido expira, estoque volta, comprador notificado |
| `awaiting_payment` → comprovante | 48h | pedido expira, estoque volta |
| `payment_review` → conferência | 24h | lembrete ao vendedor (não expira) |
| `paid` → envio/pronto | `ship_within_hours` do vendedor | lembrete + conta na reputação |
| `delivered` → confirmação | 7 dias | auto-conclui |
| `completed` → avaliar | 14 dias | libera a avaliação da outra parte |

Os expiradores são Cloud Functions agendadas (§7).

## 5. Pagamento — Pix manual (Fase 1)

**A plataforma NÃO recebe dinheiro.** Isso muda tudo do ponto de vista
regulatório e precisa estar visível, não escondido nos termos.

Fluxo:
1. Pedido `accepted` → o comprador vê o `V2MarketPixPanel`:
   - QR (se o vendedor subiu) ou chave copiável (`useClipboard` já existe),
   - nome do recebedor, valor exato, código do pedido para o campo de
     descrição, instruções do vendedor,
   - aviso: "Confira o nome do recebedor antes de pagar."
2. Comprador anexa o comprovante (`V2MarketProofUploader`) → `payment_review`.
3. Vendedor confere no app do banco e **confirma** ou **recusa** com motivo.
4. Confirmado → `paid`.

**Anti-golpe (obrigatório na UI):**
- Nome do recebedor sempre em destaque, comparável ao nome do vendedor.
- Aviso fixo: "Nunca pague fora do pedido. Pagamentos combinados por fora
  não têm registro e não podem ser mediados."
- Detectar e avisar quando o valor do comprovante não bate (Fase 2, OCR
  não entra na Fase 1 — é conferência humana).
- Nunca exibir a chave Pix antes do pedido aceito.

### `cash_on_pickup`
Pula `awaiting_payment`: vai de `accepted` → `ready_for_pickup`, e o
vendedor marca `paid` no encontro.

### `arena_wallet` (integração)
Se o comprador é membro da arena vendedora e tem saldo em `arena_wallets`,
o débito é interno. Só disponível quando `seller_type == 'arena'`. Fase 2.

## 6. Entrega

| Forma | Fluxo | Campos |
|---|---|---|
| `pickup` | `paid` → `ready_for_pickup` → comprador retira → `delivered` | local, janela de horário, instruções |
| `meetup` | combinado no chat; vendedor marca `delivered` com confirmação do comprador | texto livre |
| `shipping` | `paid` → `preparing` → `shipped` (transportadora + código) → `delivered` | endereço (revelado só após aceite), rastreio manual |
| `digital` | `paid` → entrega do código/voucher no pedido → `delivered` | campo de conteúdo digital |
| `on_site` | serviço prestado na arena; `delivered` quando o comprador confirma | data, arena |

Endereço do comprador: coletado no checkout, **guardado no pedido**, exibido
ao vendedor apenas de `accepted` em diante, e nunca em nenhuma listagem.

## 7. Cloud Functions do Mercado

Todas em `functions/index.js`, região `southamerica-east1` (padrão do
projeto), com Admin SDK (bypassa regras — por isso a lógica precisa ser
conservadora e auditada).

| Função | Gatilho | O que faz |
|---|---|---|
| `expireMarketListings` | schedule diário 03:00 | `active` com `expires_at` passado → `expired`; notifica o vendedor 3 dias antes |
| `publishScheduledListings` | schedule 15 min | `scheduled` com `scheduled_for` passado → `in_review`/`active` |
| `expireMarketOffers` | schedule horário | `pending`/`countered` vencidas → `expired`; libera reserva |
| `expireMarketOrders` | schedule horário | `placed`/`awaiting_payment` vencidos → `expired`; devolve estoque |
| `autoCompleteMarketOrders` | schedule diário | `delivered` + 7d → `completed`; libera avaliações |
| `revealMutualReviews` | schedule diário | libera avaliações cegas após ambas ou 14 dias |
| `aggregateSellerStats` | onWrite `market_reviews`, `market_orders` | recalcula `market_seller_stats` + denormaliza no anúncio |
| `matchWantedListings` | onCreate `market_listings` | casa com `wanted` ativos → `market_wanted_matches` + notificação |
| `notifySavedSearches` | onCreate `market_listings` | casa com `market_saved_searches` com alerta |
| `autoModerateListing` | onCreate `market_listings` | termos proibidos, sanidade de preço, duplicidade → `moderation_status` |
| `syncArenaProductToListing` | onWrite `arena_inventory_*` | espelha preço/estoque nos anúncios com `source.kind=='arena_product'` |

**10 funções novas** (hoje são 10 no total).

## 8. Notificações novas (`NOTIFICATION_TYPE`)

Aditivo em `core/services/notificationService.js`:
```
market_offer_received, market_offer_countered, market_offer_accepted,
market_offer_declined, market_offer_expiring,
market_order_placed, market_order_accepted, market_order_declined,
market_payment_pending, market_payment_proof, market_payment_confirmed,
market_order_shipped, market_order_ready, market_order_delivered,
market_order_completed, market_order_cancelled, market_order_expiring,
market_review_received, market_review_reminder,
market_listing_approved, market_listing_rejected, market_listing_expiring,
market_wanted_match, market_saved_search_hit, market_price_drop,
market_dispute_opened, market_dispute_resolved
```
Cada uma com `data` estruturado (`{kind, order_id}`) para ação direta no
sino — o padrão já existe (`partner_invite_quick_confirm`).

Preferências: nova seção em `notifications/domain/preferences.js`
("Mercado"), com granularidade por grupo (ofertas, pedidos, avaliações,
alertas de busca). Default: tudo ligado para pedidos e ofertas; alertas de
busca só se o usuário criou o alerta.

## 9. Disputas

Abre até `dispute_window_days` (7) após a entrega prevista. Congela:
avaliações, auto-conclusão, e marca o pedido visualmente para os dois.
Cria uma conversa de 3 vias (comprador, vendedor, `platform_admin`).
Admin resolve com nota pública para as partes; se procedente contra o
vendedor, gera `content_strikes` (docs/18) e conta em `cancel_rate`.

**Limite honesto da Fase 1**: sem gateway, "resolved_refund" é uma
**recomendação de estorno**, não um estorno. Os Termos precisam dizer isso
com todas as letras (`13-RISCOS §2`).
