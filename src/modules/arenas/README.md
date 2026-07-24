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

### `arena_waitlist/{entryId}` (Onda 6b)
- Lista de espera quando slot cheio

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

## Onde achar mais

- `docs/06-MODULES.md` § arenas
- `docs/08-ARENA-ROADMAP.md` — sprints 0-10
- `docs/10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md` — status atual
- `docs/10-ARENA-V3/10-MODULES-CATALOG.md` — 51+ módulos
- `docs/09-UX-ANALYSIS/07-arena.md` — auditoria UX
- `docs/09-UX-ANALYSIS/13-arena-refino.md` — refino entregue
