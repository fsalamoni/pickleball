# `arenas/` — Arenas, reservas, PDV e Arena V3

> Diretório de arenas com perfil, fotos, contatos e preços; reservas avulsas,
> recorrentes, compartilhadas e aulas com professor; lista de espera; política
> de cancelamento; no-show tracking; favoritos, reviews, CRM; **Arena V3**:
> PDV, membros, ligas, marketing, IoT, operations, matchmaking.

## Status

- **Páginas V2**: 23+ — `V2Arenas`, `V2ArenaDetail`, `V2CreateArena`,
  `V2ArenaManage` (admin 2 níveis), `V2ArenaOnboarding` (stepper 4 passos),
  `V2Bookings`, `V2ArenaPDV`, `V2ArenaMembers`, `V2ArenaClasses`,
  `V2ArenaLeagues`, `V2ArenaMarketing`, `V2ArenaOperations`,
  `V2ArenaMatchmaking`, `V2ArenaModules`, `V2ArenaOpenMatch`,
  `V2ArenaAdvanced`, `V2ArenaAdminOpenMatch`, `V2ArenaAdminMembers`,
  `V2ArenaCoaches`
- **Componentes V2**: `V2ArenaActions`, `V2ArenaEditors`, `V2ArenaReviews`,
  `V2BookingRow`, `V2BookingCalendar` (mensal com badges), `V2DaySlotsDialog`
  (info do dia), `V2CourtDayGrid` (linhas=horários, colunas=quadras),
  `V2CourtSchedules`, `V2CourtPriceRules`, `V2ArenaCRM` (Onda 6b),
  `V2ArenaWaitlist` (Onda 6b), `V2ArenaCancellationPolicy` (Onda 6),
  `V2ArenaNoShow` (Onda 6)
- **Services**: 25+ — arenas, bookings, courts, schedules, favorites,
  managers, reviews, unavailabilities, waitlist, products, sales, payments,
  members, packages, subscriptions, ladders, matches, classes,
  class_bookings, campaigns, coupons, referrals, inventory, devices,
  open_slots, settings, module_states
- **Domain**: 25+ arquivos puros testados (booking, booking_conflict,
  booking_waitlist, calendar, calendar_aggregate, cancellation_policy,
  court, court_schedule, court_assignment, instant_booking, inventory,
  leagues, marketing, matchmaking, members, modules, openMatch, operations,
  pdv, pix_payment, pricing, review_response, settings, shared_booking,
  slot_status, waitlist)
- **Tests**: 400+ (este é o módulo mais testado)

## Schema (Firestore)

### `arenas/{id}` (campos principais)
- `name`, `description`, `address`, `city`, `state`
- `court_count` (legado), `photos[]`, `contact_*`
- `allow_instant_booking: bool`
- `house_rules_md`, `rules[]`, `payment.{pix_key,qr_code_url,receiver_name}`
- `price_rules[]` (com `court_id` opcional — ARE-05)
- `price_overrides[]` (com `court_id` opcional)
- `onboarding_complete.{fotos,precos,horarios,compartilhar}`
- `linked_club_ids[]` (Fase 8a)

### `arena_managers/{arenaId_uid}` (id determinista)
- `role` (`owner|manager`)

### `arena_courts/{id}`
- `court_type`, `surface_type`, `is_active`, `sort_order`

### `arena_court_schedules/{id}`
- Janelas recorrentes por quadra

### `arena_unavailabilities/{id}`
- Admin bloqueia slot

### `arena_bookings/{id}` ⭐ (coleção canônica)
- `booking_type`: 'single' | 'recurring' | 'coach_lesson' | 'shared'
- `slots[]` (`{date, start, end, court_id}`) — **court_id obrigatório**
- `responsibles[]` (multi, com `percent` e `share_type`)
- `status`: 'requested' | 'negotiating' | 'confirmed' | 'declined' | 'cancelled' | 'completed'
- `is_instant`, `payment_method`, `proposed_price`, `agreed_price`, `payment_status`

### `booking_waitlist/{entryId}` (Onda 6b)
- Lista de espera de reservas quando o horário está ocupado (`user_id`, `arena_id`,
  `date`, `start`). Coleção própria, separada do `arena_waitlist` do matchmaking
  Arena V3 (que usa `athlete_id`/`slot_id`).

### `arena_reviews/{id}` (rating 1-5 + response do manager)

### `arena_favorites/{uid_arenaId}` (id determinista)

### Arena V3 (35+ coleções, todas atrás de `ARENA_MODULE_*` flags)
- `arena_products`, `arena_sales`, `arena_payments` (PDV)
- `arena_members`, `arena_packages`, `arena_subscriptions`, `arena_wallets`,
  `arena_tier_configs` (members)
- `arena_ladders`, `arena_internal_tournaments`, `arena_matches` (leagues)
- `arena_classes`, `arena_class_bookings`, `arena_coaches` (Sistema C — aulas da arena)
- `arena_campaigns`, `arena_coupons`, `arena_referrals`,
  `arena_nps_responses` (marketing)
- `arena_checklists`, `arena_maintenance_orders`,
  `arena_inventory_*` (operations)
- `arena_devices` (IoT)
- `arena_open_slots` (matchmaking)
- `arena_settings`, `arena_module_states` (config)

## Fluxos principais

### Reserva simples
1. User clica em "Reservar" no calendar mensal
2. `V2DaySlotsDialog` mostra slots livres
3. User escolhe slot + `BookingRequestDialog` (single, instant?)
4. `bookingService.create` → valida conflito → salva

### Reserva compartilhada (Onda 8)
1. User cria reserva com `booking_type='shared'`
2. Convida outros atletas
3. Cada um aceita/recusa
4. Rateio (`shared_booking.js`) divide o valor por tempo de uso

### Aula com professor (Sistema A, Onda 8)
1. Professor agenda aula em arena parceira
2. `booking_type='coach_lesson'` + `coach_lesson_id` link
3. Alunos podem ingressar em aulas abertas
4. Aparece no calendário da arena marcado "aula com professor"

### Arena V3 módulo (PDV, members, etc)
1. Admin ativa `ARENA_MODULE_PDV` no `/admin/console`
2. `/admin/console` → V3 Boot executa migração
3. UI `/arenas/:id/pdv` habilitada
4. User usa normalmente

## Hooks expostos

```js
import { useArena } from '@/modules/arenas/hooks/useArena';
import { useArenaBookings } from '@/modules/arenas/hooks/useArenaBookings';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenaCourts';
import { useArenaWaitlist } from '@/modules/arenas/hooks/useArenaWaitlist';
import { useArenaCRM } from '@/modules/arenas/hooks/useArenaCRM';
import { useArenaCancellation } from '@/modules/arenas/hooks/useArenaCancellation';
```

## Feature flags principais

- `ARENAS` — master (gate da feature inteira)
- `SHARED_BOOKINGS` — reservas compartilhadas
- `BOOKING_WAITLIST` — lista de espera
- `CANCELLATION_POLICY` — política de cancelamento
- `NO_SHOW_TRACKING` — tracking de no-show
- `ARENA_CRM` — CRM leve
- `PARTNER_INVITES` — parceria professor↔arena
- `ATHLETE_SELF_CHECKIN` — auto check-in
- `ARENA_MODULE_*` (51 sub-flags) — sub-módulos V3

## Wave B (Sprint 14, 2026-07-27) — página pública completa

- **`ArenaCourtsSection`** (em `V2ArenaDetail`): lista de quadras
  (nome + tipo + superfície + status ativa). Reusa `useArenaCourts`.
- **`price_overrides`** agora exibidos em "Datas especiais" (amber)
  na seção de preços.
- **`pdvService`** em memória (item 1.4): `listArenaSales / listUserSales
  / listArenaPayments` agora usam query simples + sort por
  `created_at_ms` em memória. Padrão consistente com PRs #82/#84.

## Catálogo padrão + Organização e Gestão do mercado (flag `arena_product_catalog`)

- **`domain/productCatalog.js`** (+test): taxonomia (categorias/subcategorias/
  embalagens), normalização, `buildDedupKey`, similaridade (Jaccard) e
  `findDuplicates` — deduplicação antes de contribuir ao catálogo geral.
- **`domain/catalogSeed.js`**: gera centenas de produtos reais BR por
  marca × embalagem (refrigerantes, sucos, águas, energéticos, cervejas,
  salgadinhos, chocolates, salgados, lanches, pizzas, porções, esporte…).
- **`domain/inventory.js`**: campos ADITIVOS no produto do mercado
  (`catalog_id`, `subcategory`, `packaging`, `size`, `sale_price`, `min_stock`,
  `expiry_date`) + helpers `stockStatus`, `daysToExpiry`, `expiryStatus`.
- **`services/catalogService.js`**: `listCatalogProducts`,
  `checkCatalogDuplicates`, `proposeCatalogProduct` (bloqueia duplicata exata),
  `adoptCatalogToArena` (puxa p/ o mercado + entrada inicial), `seedCatalog`
  (admin, idempotente por `dedup_key`).
- **`hooks/useCatalog.js`**: React Query do catálogo + mutações.
- **UI**: `V2ArenaGestaoTab` (guia de primeiros passos + alertas de estoque/
  validade + resumo) e `V2ArenaCatalogBrowser` (buscar/puxar do catálogo +
  sugerir produto novo com aviso de duplicidade). Seção **"Organização e
  Gestão"** no painel da arena (`V2ArenaManage`).
- **Coleção**: `catalog_products` (ver `docs/05-DATA-MODEL.md`).

## Dia de jogo da arena (flag `arena_game_day`, 2026-09-12)

A arena marca o próprio dia de jogo no calendário; as quadras e horários
escolhidos **ficam fechados para reserva**. O código mora no módulo `games/`
(é o mesmo `game_days`, com campos aditivos), mas ele encosta aqui em três
lugares — vale saber antes de mexer:

1. **`arena_unavailabilities`** ganha documentos com `source: 'game_day'` e
   `game_day_id`. É assim que a quadra fecha: nada foi ensinado a
   `checkBookingConflict`, `getSlotStatus` nem ao calendário mensal, que já
   respeitavam indisponibilidade. **Não apague esses documentos à mão** —
   quem cuida deles é `syncArenaGameDayBlocks`;
2. **`V2BookingCalendar`** marca o dia com um selo e **`V2DaySlotsDialog`**
   abre com o nome e o horário do dia de jogo. Sem isso, quem clicasse veria
   "indisponível" e concluiria que a arena fechou sem razão;
3. **`V2ArenaDetail`** ganhou a seção "Dias de jogo", acima do calendário — é
   por ali que o atleta marca presença.

⚠️ **Bug de regra corrigido junto**: `arena_unavailabilities` tinha uma regra só
para create/update/delete olhando `request.resource.data.arena_id`, que **não
existe num delete** — nenhum gestor conseguia apagar o próprio bloqueio, embora
a tela oferecesse o botão. Agora são três regras.

Detalhes: `docs/22-DIA-DE-JOGO-DA-ARENA.md`.

## Calendário e reserva: o que já foi auditado (2026-09-12)

Uma varredura de ponta a ponta achou **dois bugs de reserva** e um problema
operacional sério. Está tudo em `docs/23-ARENA-CALENDARIO-E-RESERVA.md`; o que
você precisa saber antes de tocar em horário:

⚠️ **O fim de um slot é `slotEndTime(time, { date, schedules })`** — domínio, em
`slot_status.js`. **Nunca** derive do "próximo horário da lista": numa arena com
horário PARTIDO (manhã e noite) a grade tem buracos, e isso gerava reserva de
nove horas. `hora + 1` cego também não serve: passa do fechamento numa janela
que acaba às 21:30.

⚠️ **Quadra sem janela de horário é INVISÍVEL** — fora do calendário, da reserva
e do dia de jogo. `courtScheduleStatus` / `courtsWithoutSchedule`
(`court_schedule.js`) respondem isso, e o aviso aparece em três alturas: na
linha da quadra, no topo da aba Quadras e no painel de prontidão da Central da
arena. Uma janela **sem `court_id` vale para a arena inteira**; quadra inativa
nunca vira alarme.

**As duas matrizes quadra × horário não são a mesma**, e não devem virar:

| | `CourtDayGrid` (admin) | `CourtTimePicker` (atleta) |
|---|---|---|
| nome de quem reservou | mostra | **não** |
| clicável | tudo | **só o que está livre** |
| efeito do clique | seleciona célula | **escolhe a quadra** e o horário |

## Reservar: o fluxo (2026-09-12)

```
calendário (o DIA) → grade (QUADRA e HORÁRIOS) → confirmar → pedido
```

⚠️ **`BookingRequestDialog` tem DOIS modos.** Com `selection` (vindo do
calendário) ele **confirma** — mostra a escolha agrupada por quadra e pergunta
só o que falta. Sem `selection` (botão "Solicitar reserva" da página da arena)
ele é o formulário completo de sempre. Há teste travando os dois; ao mexer num,
confira o outro.

⚠️ **Para pedir várias quadras/horários, use `createBookingsForSelection`**, não
`createBooking`: este grava uma reserva por quadra mas com os MESMOS horários
para todas, então "Quadra 1 às 19h e Quadra 2 às 20h" não cabe nele. A tradução
está em `domain/bookingSelection.js`:

| função | para quê |
|---|---|
| `toggleSelectionCell` | liga/desliga uma célula (quadra + dia + faixa) |
| `groupSelectionByCourt` | junta quadras com os MESMOS horários; separa o resto |
| `expandSelectionWeeks` | recorrência: repete a escolha inteira, +7 dias |
| `describableRecurrence` | o metadado `recurrence` **só quando é verdade** |
| `summarizeSelection` | o resumo que a tela mostra antes de confirmar |

`court_id: null` numa célula é legítimo: significa **"tanto faz a quadra"**, e a
arena atribui uma livre. Nunca se mistura com quadra escolhida no agrupamento.

## Preço da reserva: o TOTAL, sempre (2026-09-13)

⚠️ **`resolveArenaPrice` devolve o valor POR HORA.** Gravá-lo como
`proposed_price` foi um bug real: reserva de três horas chegando à arena
valendo uma. Quem quer o valor de uma reserva usa o domínio:

| função | devolve |
|---|---|
| `totalBookingPrice(arena, { courtId, slots, clientId })` | `{ total, hours, minutes, hourlyRates, breakdown }` — cada horário na SUA faixa |
| `priceWithDurationText(total, hours, rates)` | `"R$ 240,00 · 3h · R$ 80,00/h"` |
| `bookingPriceInfo(booking, { arena })` | o que MOSTRAR: acordado vence; com arena, recalcula (corrige o legado); sem ela, o gravado — nunca sem a duração |

O serviço **refaz a conta antes de escrever** (`precoDaReserva` em
`bookingService.js`), nos dois caminhos: a tela pode estimar, quem grava
confere. Nenhum campo novo; nenhum dado histórico reescrito.

## Ocupação no calendário mensal (2026-09-13)

⚠️ **`aggregateDayStatus` conta por QUADRA quando recebe `courts`.** Sem isso,
a arena inteira é contada como uma quadra só e UMA reserva às 19h faz as 19h
contarem como ocupadas — com as outras quadras livres. Passe as quadras ativas
sempre que não houver filtro de quadra.

| campo do retorno | o que é |
|---|---|
| `count` | horas-quadra por status (o denominador da barra) |
| `total` | horas-quadra abertas no dia |
| `occupancy` | fração ocupada, 0 a 1 |
| `freeTimes` | horários com PELO MENOS uma quadra livre — o que a pessoa procura |
| `openTimes` | horários abertos, livres ou não |

`indexBookingsByDate` / `indexUnavailabilitiesByDate` existem por custo: a
grade faz 42 dias × quadras consultas e cada uma varria a lista inteira da
arena. `findFirstFreeDate` responde "e quando, então?" quando o mês inteiro
está cheio — sem ele a tela é um beco com um botão de "próximo mês".

## Desempenho: como a arena abre rápido (2026-09-13)

⚠️ **Toda consulta de arena nasce em `arenaQueries.js` / `arenaKeys.js`.** Não
escreva `queryKey: ['arena-courts', id]` à mão: a PRÉ-BUSCA e o hook precisam
concordar bit a bit, e chave divergente não dá erro — faz a tela buscar de novo
o que já estava em cache, em silêncio, para sempre. Há teste lendo o
código-fonte e reprovando a chave literal (invalidar pode; DEFINIR não).

| peça | para quê |
|---|---|
| `arenaKeys.js` | as chaves, e só elas |
| `arenaQueries.js` | chave + função de busca (o formato guardado sai daqui: quadras e janelas vêm ORDENADAS) |
| `arenaPrefetch.js` | busca tudo o que a página vai pedir; semeia a arena que o cartão já tem, nunca por cima de dado guardado, e falha em silêncio |
| `useArenaPrefetch.js` | o gatilho — chame no `onMouseEnter`/`onFocus`/`onTouchStart` de qualquer link para uma arena |

Regras que valem a pena não desfazer:

- **`listMyManagedArenas` busca em PARALELO.** Roda em toda tela (o menu
  pergunta quais arenas você gere); em fila, quem gere cinco esperava cinco
  viagens antes da primeira pintura.
- **As abas da Central são `lazy`**, com `<Suspense>` em volta só da ÁREA das
  abas — nunca da página, ou trocar de aba apaga o cabeçalho. 170 kB → 37 kB.
- **O diálogo do dia é `lazy` COM aquecimento** (`requestIdleCallback`): baixa
  sozinho depois da pintura, então o clique continua instantâneo.
- **`useArenaBookings` traz a coleção INTEIRA da arena.** Não há como recortar
  por data no servidor (a data mora dentro de `slots`, que é vetor). Antes de
  "otimizar" com um campo novo ou um índice: isso mexe no banco, e as reservas
  antigas não teriam o campo — sumiriam da tela.

## Nunca mostre data ISO (2026-09-13)

⚠️ `2026-07-23 · 19:00` era o que a reserva mostrava ao atleta E à arena.
Use `domain/calendar.js`:

| função | saída |
|---|---|
| `formatSlotLabel(slot)` | `Qui, 23/07 · 19:00–20:00` |
| `formatDateShortBR(d)` | `Qui, 23/07` — **com o ano** quando não é o corrente |
| `formatDateBR(d)` / `formatDayMonth(d)` | `23/07/2026` / `23/07` |
| `formatDateLongBR(d)` | `Quinta-feira, 23 de julho de 2026` |

São montadas a partir das constantes do módulo, não de `toLocaleDateString`:
mesma entrada, mesmo texto, sem depender da configuração da máquina. Entrada
inválida vira string vazia — nunca `Invalid Date`.

## Bloqueio de horário: quem pode reservar o quê (2026-09-13)

⚠️ **Conferir outras RESERVAS não basta.** O serviço ignorava os bloqueios da
arena, e o formulário completo de reserva (data e hora digitadas) não passa
pelo calendário — dava para pedir exatamente a quadra fechada, ou a que está
com um dia de jogo em cima.

| função | onde |
|---|---|
| `checkUnavailabilityConflict(slots, bloqueios)` | `domain/booking_conflict.js` |
| `unavailabilityConflictMessage(conflicts)` | idem — diz o MOTIVO, e dia de jogo tem saída própria |
| `mergeGameDayBlocks(gravados, diasDeJogo)` | `modules/games/domain/arenaGameDay.js` |

Regras que valem a pena não desfazer:

- **O dia de jogo é a FONTE do bloqueio; a cópia em `arena_unavailabilities` é
  conveniência.** Some a cópia e o sistema inteiro deixava de saber. Some o
  merge e o problema volta.
- **Use o merge para calcular STATUS, nunca para LISTAR bloqueios numa tela de
  gestão**: o derivado não tem documento, e um botão de apagar apontaria para
  o nada — pior, apagar a cópia GRAVADA abre a quadra com o dia de jogo ainda
  marcado nela.
- **Bloqueio não depende de feature flag.** A flag gateia o que se mostra.
- **Encostar não é sobrepor** (18h–20h convive com 20h–22h), e bloqueio sem
  `court_id` fecha a arena inteira — mesma regra do status de slot.

## ⚠️ `orderBy` + `where` = índice composto (2026-09-13)

Consulta com filtro de igualdade num campo **e** `orderBy` noutro exige índice
composto. **Sem ele a consulta FALHA** — e como o padrão é
`const { data = [] } = useX()`, o erro vira lista vazia e a tela mente em
silêncio. Cinco consultas do projeto estavam assim, mortas desde que foram
escritas (bloqueios do calendário, torneios da arena, as duas da fila de
espera, checklists).

O padrão daqui é **um `where` só, ordenação em memória** (como
`listArenaGameDays`). Com `limit`, o corte vai junto para a memória — cortar
antes de ordenar devolve N quaisquer.

`src/core/guards/indicesCompostos.test.js` lê o código e o
`firestore.indexes.json` e reprova quem reintroduzir a combinação sem índice.

## Onde achar mais

- `docs/06-MODULES.md` § arenas
- `docs/08-ARENA-ROADMAP.md` — sprints 0-10
- `docs/10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md` — status atual
- `docs/10-ARENA-V3/10-MODULES-CATALOG.md` — 51+ módulos
- `docs/09-UX-ANALYSIS/07-arena.md` — auditoria UX
- `docs/09-UX-ANALYSIS/13-arena-refino.md` — refino entregue
